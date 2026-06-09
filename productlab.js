/* ═══════════════════════════════════════════════════════
   PRODUCTLAB.JS — Product Lab
   Standalone analysis sandbox. Reads from live system
   (ingredients, products, categories) but never writes
   unless user explicitly converts a draft to a product.

   Sections:
   1. Recipe Builder + Category Presets
   2. Cost & Pricing
   3. Supply Assessment
   4. Analysis Output (selectable charts)
   5. Save & Convert
   [Optional] Strategic + Launch toggles
═══════════════════════════════════════════════════════ */

/* ── Default category presets ── */
const LAB_DEFAULT_PRESETS = [
  {
    id: 'preset-cookies',
    category: 'Cookies',
    marginTargets: [55, 65, 75],
    batchSize: 24,
    shelfLifeDays: 7,
    ingredients: [
      { name: 'All-Purpose Flour', unit: 'g', qty: 125, tempCost: 0.02 },
      { name: 'Butter',            unit: 'g', qty: 113, tempCost: 0.45 },
      { name: 'White Sugar',       unit: 'g', qty: 100, tempCost: 0.05 },
      { name: 'Egg',               unit: 'pcs', qty: 1, tempCost: 8.00 },
    ]
  },
  {
    id: 'preset-drinks',
    category: 'Drinks',
    marginTargets: [60, 70, 80],
    batchSize: 1,
    shelfLifeDays: 1,
    ingredients: [
      { name: 'Espresso Shot', unit: 'ml', qty: 30,  tempCost: 3.50 },
      { name: 'Milk',          unit: 'ml', qty: 200, tempCost: 0.08 },
    ]
  },
  {
    id: 'preset-pastries',
    category: 'Pastries',
    marginTargets: [55, 65, 75],
    batchSize: 12,
    shelfLifeDays: 3,
    ingredients: [
      { name: 'All-Purpose Flour', unit: 'g', qty: 250, tempCost: 0.02 },
      { name: 'Butter',            unit: 'g', qty: 150, tempCost: 0.45 },
    ]
  }
];

/* ── Chart definitions ── */
const LAB_CHARTS = [
  { id: 'viability',    label: 'Product Viability Score',    locked: true  },
  { id: 'waterfall',    label: 'Cost Waterfall',             locked: false },
  { id: 'gauge',        label: 'Margin Gauge',               locked: false },
  { id: 'ingredients',  label: 'Ingredient Cost Breakdown',  locked: false },
  { id: 'breakeven',    label: 'Break-Even Burn Chart',      locked: false },
  { id: 'stock',        label: 'Stock Coverage',             locked: false },
  { id: 'batchcurve',   label: 'Batch Size vs Cost',         locked: false },
  { id: 'radar',        label: 'Scenario Comparison Radar',  locked: false },
  { id: 'scenarios',    label: 'Pricing Scenarios Bar',      locked: false },
];

const LAB_CHART_PRESETS = {
  financial: ['viability','waterfall','gauge','scenarios'],
  supply:    ['viability','stock','ingredients','batchcurve'],
  full:      LAB_CHARTS.map(c => c.id),
  minimal:   ['viability','waterfall'],
};

/* ── Active lab session (in-memory, not persisted until saved) ── */
let LAB_SESSION = null;

function _newSession() {
  return {
    id:           generateId(),
    name:         '',
    category:     '',
    presetId:     null,
    ingredients:  [],   // { id, name, unit, qty, costPerUnit, scarcity, isTemp, tempCost }
    packaging:    [],   // { id, name, cost }
    packagingEnabled: false,
    batchSize:    24,
    wastePercent: 0,
    marginTargets:[55, 65, 75],
    selectedScenario: 1,  // index 0,1,2 or 3=custom
    customPrice:  0,
    chartConfig: {
      selected: [...LAB_CHART_PRESETS.full],
      order:    [...LAB_CHART_PRESETS.full],
      preset:   'full'
    },
    strategicEnabled: false,
    launchEnabled:    false,
    launchChecklist:  {},
    status:     'draft',    // draft | converted
    convertedProductId:   null,
    convertedProductName: null,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString()
  };
}

/* ═══════════════════════════════════════════════════════
   CATEGORY PRESETS MANAGEMENT
═══════════════════════════════════════════════════════ */

function getLabCategoryPresets() {
  const stored = Array.isArray(APP_STATE.labCategoryPresets) ? APP_STATE.labCategoryPresets : [];
  if (stored.length) return stored;
  // Seed defaults on first use
  updateState('labCategoryPresets', () => LAB_DEFAULT_PRESETS);
  return LAB_DEFAULT_PRESETS;
}

function getPresetForCategory(category) {
  return getLabCategoryPresets().find(p =>
    p.category.toLowerCase() === (category || '').toLowerCase()
  ) || null;
}

function saveLabCategoryPreset(preset) {
  const presets = getLabCategoryPresets();
  const idx = presets.findIndex(p => p.id === preset.id);
  if (idx >= 0) presets[idx] = preset;
  else presets.push(preset);
  updateState('labCategoryPresets', () => presets);
  renderLabPresetsList();
  showNotification('Preset saved', 'success');
}

function deleteLabCategoryPreset(presetId) {
  if (!confirm('Delete this category preset?')) return;
  updateState('labCategoryPresets', () =>
    getLabCategoryPresets().filter(p => p.id !== presetId));
  renderLabPresetsList();
  showNotification('Preset deleted', 'success');
}

function openLabPresetModal(presetId = null) {
  const el = id => document.getElementById(id);
  if (presetId) {
    const p = getLabCategoryPresets().find(x => x.id === presetId);
    if (p) {
      setElementValue('labPresetId',       p.id);
      setElementValue('labPresetCategory', p.category);
      setElementValue('labPresetBatch',    p.batchSize);
      setElementValue('labPresetShelf',    p.shelfLifeDays);
      setElementValue('labPresetM0',       p.marginTargets[0]);
      setElementValue('labPresetM1',       p.marginTargets[1]);
      setElementValue('labPresetM2',       p.marginTargets[2]);
    }
  } else {
    ['labPresetId','labPresetCategory','labPresetBatch',
     'labPresetShelf','labPresetM0','labPresetM1','labPresetM2']
      .forEach(id => setElementValue(id, ''));
  }
  openModal('labPresetModal');
}

function saveLabPresetFromForm() {
  const id       = getElementValue('labPresetId') || generateId();
  const category = sanitizeText(getElementValue('labPresetCategory'));
  const batchSize= Number(getElementValue('labPresetBatch') || 24);
  const shelfLife= Number(getElementValue('labPresetShelf') || 7);
  const m0       = Number(getElementValue('labPresetM0') || 55);
  const m1       = Number(getElementValue('labPresetM1') || 65);
  const m2       = Number(getElementValue('labPresetM2') || 75);
  if (!category) { showNotification('Category name required', 'error'); return; }
  saveLabCategoryPreset({ id, category, marginTargets:[m0,m1,m2],
    batchSize, shelfLifeDays: shelfLife, ingredients:[] });
  closeModal('labPresetModal');
}

function renderLabPresetsList() {
  const container = document.getElementById('labPresetsList');
  if (!container) return;
  const presets = getLabCategoryPresets();
  container.innerHTML = presets.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);
      margin-bottom:8px;background:var(--white);">
      <div>
        <div style="font-weight:800;font-size:13px;">${escapeHtml(p.category)}</div>
        <div style="font-size:11px;color:var(--gray-400);">
          Batch: ${p.batchSize} · Shelf: ${p.shelfLifeDays}d ·
          Margins: ${p.marginTargets.join('% / ')}%
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-secondary"
          data-action="edit-lab-preset" data-id="${p.id}">Edit</button>
        <button class="btn btn-sm btn-secondary"
          data-action="delete-lab-preset" data-id="${p.id}">Delete</button>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════
   SESSION MANAGEMENT
═══════════════════════════════════════════════════════ */

function startNewLabSession() {
  LAB_SESSION = _newSession();
  renderLabView();
}

function applyLabPreset(category) {
  if (!LAB_SESSION) return;
  const preset = getPresetForCategory(category);
  if (!preset) return;

  LAB_SESSION.category     = category;
  LAB_SESSION.presetId     = preset.id;
  LAB_SESSION.batchSize    = preset.batchSize;
  LAB_SESSION.marginTargets= [...preset.marginTargets];

  // Pre-fill ingredients from preset, matching to live catalog first
  LAB_SESSION.ingredients = preset.ingredients.map(pi => {
    const liveIng = (APP_STATE.ingredients || []).find(i =>
      i.name.toLowerCase().includes(pi.name.toLowerCase()) ||
      pi.name.toLowerCase().includes(i.name.toLowerCase())
    );
    return {
      id:          generateId(),
      name:        liveIng ? liveIng.name : pi.name,
      unit:        liveIng ? (liveIng.unit || pi.unit) : pi.unit,
      qty:         pi.qty,
      costPerUnit: liveIng ? Number(liveIng.costPerUnit || 0) : Number(pi.tempCost || 0),
      scarcity:    'common',
      isTemp:      !liveIng,
      liveId:      liveIng ? liveIng.id : null,
      tempCost:    liveIng ? Number(liveIng.costPerUnit || 0) : Number(pi.tempCost || 0)
    };
  });

  renderLabRecipeBuilder();
  renderLabPricing();
  showNotification(`${category} preset applied — all values editable`, 'success');
}

/* ═══════════════════════════════════════════════════════
   CALCULATIONS — all pure functions
═══════════════════════════════════════════════════════ */

function labCalcIngredientCost() {
  if (!LAB_SESSION) return 0;
  return LAB_SESSION.ingredients.reduce((s, ing) =>
    s + Number(ing.qty || 0) * Number(ing.costPerUnit || 0), 0);
}

function labCalcPackagingCost() {
  if (!LAB_SESSION || !LAB_SESSION.packagingEnabled) return 0;
  return LAB_SESSION.packaging.reduce((s, p) => s + Number(p.cost || 0), 0);
}

function labCalcTotalCost() {
  return labCalcIngredientCost() + labCalcPackagingCost();
}

function labCalcCostPerUnit() {
  const batch = Math.max(1, LAB_SESSION?.batchSize || 1);
  return labCalcTotalCost() / batch;
}

function labCalcPriceForMargin(marginPct) {
  const cost = labCalcCostPerUnit();
  if (marginPct >= 100) return cost * 100;
  return cost / (1 - marginPct / 100);
}

function labCalcMarginForPrice(price) {
  const cost = labCalcCostPerUnit();
  if (!price) return 0;
  return ((price - cost) / price) * 100;
}

function labCalcEffectiveMargin(price) {
  const waste      = (LAB_SESSION?.wastePercent || 0) / 100;
  const cost       = labCalcCostPerUnit();
  const effectiveRev = price * (1 - waste);
  return ((effectiveRev - cost) / effectiveRev) * 100;
}

function labCalcBreakEven(price) {
  const totalBatchCost = labCalcTotalCost();
  if (!price) return 0;
  return Math.ceil(totalBatchCost / price);
}

function labCalcScenarios() {
  if (!LAB_SESSION) return [];
  return LAB_SESSION.marginTargets.map((m, i) => {
    const price          = labCalcPriceForMargin(m);
    const profitPerUnit  = price - labCalcCostPerUnit();
    const effectiveMargin= labCalcEffectiveMargin(price);
    const breakEven      = labCalcBreakEven(price);
    const batchRevenue   = price * (LAB_SESSION.batchSize || 1);
    const batchProfit    = profitPerUnit * (LAB_SESSION.batchSize || 1);
    return { index:i, margin:m, price, profitPerUnit,
      effectiveMargin, breakEven, batchRevenue, batchProfit };
  });
}

function labCalcBatchCurve() {
  const sizes = [6, 12, 24, 48, 96, 192];
  const ingCost = labCalcIngredientCost();
  const pkgCost = labCalcPackagingCost();
  return sizes.map(size => ({
    size,
    costPerUnit: (ingCost + pkgCost) / size
  }));
}

function labCalcViabilityScore() {
  if (!LAB_SESSION) return { financial:0, supply:0, production:0, overall:0 };
  const scenarios      = labCalcScenarios();
  const targetScenario = scenarios[1] || scenarios[0];
  const targetMargin   = LAB_SESSION.marginTargets[1] || 65;

  // Financial Health (0-100)
  const actualMargin  = targetScenario ? targetScenario.effectiveMargin : 0;
  const financialScore= Math.min(100, Math.max(0,
    (actualMargin / targetMargin) * 100));

  // Supply Security (0-100)
  const ings           = LAB_SESSION.ingredients;
  const total          = ings.length || 1;
  const commonCount    = ings.filter(i => i.scarcity === 'common').length;
  const sufficientCount= ings.filter(i => {
    const liveIng = (APP_STATE.ingredients||[]).find(x => x.id === i.liveId);
    if (!liveIng) return false;
    const needed = Number(i.qty||0) * (LAB_SESSION.batchSize||1);
    return Number(liveIng.stock||0) >= needed;
  }).length;
  const scarCount    = ings.filter(i => i.scarcity === 'hard').length;
  const supplyScore  = Math.min(100, Math.max(0,
    ((commonCount / total) * 50) +
    ((sufficientCount / total) * 50) -
    (scarCount * 10)));

  // Production Risk (based on ingredient count + temp ingredients)
  const tempCount      = ings.filter(i => i.isTemp).length;
  const productionScore= Math.min(100, Math.max(0,
    100 - (tempCount * 15) - Math.max(0, ings.length - 5) * 5));

  const overall = Math.round((financialScore * 0.5) +
                             (supplyScore    * 0.3) +
                             (productionScore* 0.2));

  return {
    financial:  Math.round(financialScore),
    supply:     Math.round(supplyScore),
    production: Math.round(productionScore),
    overall
  };
}

/* ═══════════════════════════════════════════════════════
   SECTION 1 — RECIPE BUILDER RENDER
═══════════════════════════════════════════════════════ */

function renderLabRecipeBuilder() {
  _renderLabIngredientRows();
  _renderLabPackagingRows();
  _updateLabCategorySelect();
  _syncBatchSizeInput();
  _updateLabIngCatalogDropdown();
}

function _updateLabIngCatalogDropdown() {
  const sel = document.getElementById('labIngFromCatalog');
  if (!sel) return;
  const ings = APP_STATE.ingredients || [];
  // Never filter — user must be able to add same ingredient multiple times
  sel.innerHTML = `<option value="">+ Add ingredient from catalog…</option>` +
    ings.map(i => `<option value="${i.id}">
      ${escapeHtml(i.name)} (${i.unit||''}) — ₱${Number(i.costPerUnit||0).toFixed(3)}/unit
    </option>`).join('');
}

function _updateLabCategorySelect() {
  const sel = document.getElementById('labCategorySelect');
  if (!sel || !LAB_SESSION) return;
  const cats = APP_STATE.categories || [];
  sel.innerHTML = `<option value="">Select Category</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}"
      ${LAB_SESSION.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function _syncBatchSizeInput() {
  const inp = document.getElementById('labBatchSize');
  if (inp && LAB_SESSION) inp.value = LAB_SESSION.batchSize;
}

function _renderLabIngredientRows() {
  const container = document.getElementById('labIngredientRows');
  if (!container || !LAB_SESSION) return;
  container.innerHTML = '';
  LAB_SESSION.ingredients.forEach((ing, idx) => {
    const liveIng = ing.liveId
      ? (APP_STATE.ingredients||[]).find(i => i.id === ing.liveId)
      : null;
    const stock      = liveIng ? Number(liveIng.stock || 0) : null;
    const needed     = Number(ing.qty || 0) * (LAB_SESSION.batchSize || 1);
    const sufficient = stock !== null ? stock >= needed : null;
    const lineCost   = Number(ing.qty || 0) * Number(ing.costPerUnit || 0);

    const row = document.createElement('div');
    row.className = 'lab-ingredient-row';
    row.dataset.idx = idx;
    row.innerHTML = `
      <div class="lab-ing-name">
        ${ing.isTemp
          ? `<span class="lab-temp-badge">TEMP</span> `
          : ''}
        <span style="font-weight:700;font-size:12px;">${escapeHtml(ing.name)}</span>
        <span style="font-size:10px;color:var(--gray-400);margin-left:4px;">${escapeHtml(ing.unit)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:10px;color:var(--gray-400);">Qty/unit</label>
        <input type="number" class="lab-ing-qty" value="${ing.qty}"
          min="0" step="0.01" data-idx="${idx}"
          style="width:80px;padding:5px 8px;border:1px solid var(--gray-200);
            border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <label style="font-size:10px;color:var(--gray-400);">Cost/unit ₱</label>
        <input type="number" class="lab-ing-cost" value="${ing.costPerUnit}"
          min="0" step="0.001" data-idx="${idx}"
          style="width:90px;padding:5px 8px;border:1px solid var(--gray-200);
            border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      </div>
      <div style="font-size:11px;font-weight:800;width:70px;text-align:right;
        font-variant-numeric:tabular-nums;">
        ${formatCurrency(lineCost)}
      </div>
      <select class="lab-ing-scarcity" data-idx="${idx}"
        style="padding:5px 8px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:11px;font-family:var(--font-main);">
        <option value="common"   ${ing.scarcity==='common'   ?'selected':''}>Common</option>
        <option value="seasonal" ${ing.scarcity==='seasonal' ?'selected':''}>Seasonal</option>
        <option value="hard"     ${ing.scarcity==='hard'     ?'selected':''}>Hard to Source</option>
      </select>
      ${stock !== null ? `
        <div style="font-size:10px;${sufficient?'color:#16a34a;':'color:#dc2626;font-weight:700;'}
          white-space:nowrap;">
          ${sufficient ? '✓' : '⚠'} ${stock.toFixed(0)} ${ing.unit} on hand
        </div>` : `
        <div style="font-size:10px;color:var(--gray-400);">Not in inventory</div>`}
      <button type="button" class="btn btn-sm btn-secondary lab-remove-ing"
        data-idx="${idx}">✕</button>`;
    container.appendChild(row);
  });
  _bindIngredientRowEvents();
}

function _bindIngredientRowEvents() {
  // Event delegation on #view-lab handles all row events — this is now a no-op
}

function _renderLabPackagingRows() {
  const container = document.getElementById('labPackagingRows');
  const section   = document.getElementById('labPackagingSection');
  if (!container || !LAB_SESSION) return;
  if (section) section.style.display = LAB_SESSION.packagingEnabled ? 'block' : 'none';
  container.innerHTML = '';
  if (!LAB_SESSION.packagingEnabled) return;
  LAB_SESSION.packaging.forEach((pkg, idx) => {
    const row = document.createElement('div');
    row.className = 'packaging-row';
    row.innerHTML = `
      <input type="text" class="packaging-name lab-pkg-name" placeholder="e.g. Cookie Box"
        value="${escapeHtml(pkg.name)}" data-idx="${idx}"
        style="flex:2;padding:7px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      <input type="number" class="packaging-cost lab-pkg-cost" placeholder="Cost ₱"
        value="${pkg.cost}" min="0" step="0.01" data-idx="${idx}"
        style="width:110px;padding:7px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      <button type="button" class="btn btn-sm btn-secondary lab-remove-pkg"
        data-idx="${idx}">✕</button>`;
    container.appendChild(row);
  });
  // Event delegation on #view-lab handles packaging row events
}

function addLabIngredientFromCatalog(ingredientId) {
  if (!LAB_SESSION) return;
  const ing = (APP_STATE.ingredients||[]).find(i => String(i.id) === String(ingredientId));
  if (!ing) return;
  LAB_SESSION.ingredients.push({
    id: generateId(), name: ing.name, unit: ing.unit || 'g',
    qty: 0, costPerUnit: Number(ing.costPerUnit || 0),
    scarcity: 'common', isTemp: false, liveId: ing.id
  });
  _renderLabIngredientRows();
  _refreshLabCalcs();
}

function addLabTempIngredient() {
  const name = sanitizeText(document.getElementById('labTempIngName')?.value || '');
  const unit = sanitizeText(document.getElementById('labTempIngUnit')?.value || 'g');
  const cost = Number(document.getElementById('labTempIngCost')?.value || 0);
  if (!name) { showNotification('Ingredient name required', 'error'); return; }
  if (!LAB_SESSION) return;
  LAB_SESSION.ingredients.push({
    id: generateId(), name, unit, qty: 0,
    costPerUnit: cost, scarcity: 'common', isTemp: true, liveId: null
  });
  setElementValue('labTempIngName', '');
  setElementValue('labTempIngCost', '');
  _renderLabIngredientRows();
  _refreshLabCalcs();
  closeModal('labTempIngModal');
}

function addLabPackagingItem() {
  if (!LAB_SESSION) return;
  LAB_SESSION.packaging.push({ id: generateId(), name: '', cost: 0 });
  _renderLabPackagingRows();
}

/* ═══════════════════════════════════════════════════════
   SECTION 2 — PRICING RENDER
═══════════════════════════════════════════════════════ */

function renderLabPricing() {
  if (!LAB_SESSION) return;
  const ingCost  = labCalcIngredientCost();
  const pkgCost  = labCalcPackagingCost();
  const total    = labCalcTotalCost();
  const perUnit  = labCalcCostPerUnit();
  const scenarios= labCalcScenarios();

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('labIngCostTotal',  formatCurrency(ingCost));
  set('labPkgCostTotal',  formatCurrency(pkgCost));
  set('labTotalCost',     formatCurrency(total));
  set('labCostPerUnit',   formatCurrency(perUnit));
  set('labBatchTotal',    formatCurrency(total));

  // Render scenario columns
  const container = document.getElementById('labScenariosContainer');
  if (!container) return;
  container.innerHTML = scenarios.map((sc, i) => `
    <div class="lab-scenario-card${LAB_SESSION.selectedScenario === i ? ' active' : ''}"
      data-scenario="${i}">
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;
        font-weight:800;color:${LAB_SESSION.selectedScenario===i?'rgba(255,255,255,.6)':'var(--gray-400)'};
        margin-bottom:8px;">
        ${i===0?'CONSERVATIVE':i===1?'TARGET':'PREMIUM'}
      </div>
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">
        <input type="number" class="lab-margin-input" data-scenario="${i}"
          value="${sc.margin.toFixed(1)}" min="0" max="99" step="0.5"
          style="width:56px;padding:4px 6px;border:1px solid ${LAB_SESSION.selectedScenario===i?'rgba(255,255,255,.3)':'var(--gray-200)'};
            border-radius:var(--radius-md);font-size:12px;font-weight:800;
            background:${LAB_SESSION.selectedScenario===i?'rgba(255,255,255,.1)':'var(--white)'};
            color:${LAB_SESSION.selectedScenario===i?'white':'black'};
            font-family:var(--font-main);text-align:center;" />
        <span style="font-size:11px;font-weight:700;">% margin</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="font-size:11px;color:${LAB_SESSION.selectedScenario===i?'rgba(255,255,255,.6)':'var(--gray-400)'};
          white-space:nowrap;">Price ₱</span>
        <input type="number" class="lab-price-input" data-scenario="${i}"
          value="${sc.price.toFixed(2)}" min="0" step="0.01"
          style="width:100px;padding:5px 8px;font-size:16px;font-weight:900;
            border:1px solid ${LAB_SESSION.selectedScenario===i?'rgba(255,255,255,.3)':'var(--gray-200)'};
            border-radius:var(--radius-md);
            background:${LAB_SESSION.selectedScenario===i?'rgba(255,255,255,.1)':'var(--white)'};
            color:${LAB_SESSION.selectedScenario===i?'white':'black'};
            font-family:var(--font-main);font-variant-numeric:tabular-nums;" />
      </div>
      <div style="font-size:11px;margin-bottom:2px;">
        Profit/unit: <strong>${formatCurrency(sc.profitPerUnit)}</strong>
      </div>
      <div style="font-size:11px;margin-bottom:2px;">
        Effective margin: <strong>${sc.effectiveMargin.toFixed(1)}%</strong>
      </div>
      <div style="font-size:11px;margin-bottom:2px;">
        Break-even: <strong>${sc.breakEven} units</strong>
      </div>
      <div style="font-size:11px;">
        Batch profit: <strong>${formatCurrency(sc.batchProfit)}</strong>
      </div>
      <div style="margin-top:8px;">
        <button type="button" class="lab-select-scenario"
          data-scenario="${i}"
          style="width:100%;padding:6px;font-size:10px;font-weight:800;
            letter-spacing:1px;text-transform:uppercase;cursor:pointer;
            border-radius:var(--radius-md);font-family:var(--font-main);
            background:${LAB_SESSION.selectedScenario===i?'rgba(255,255,255,.2)':'var(--black)'};
            color:${LAB_SESSION.selectedScenario===i?'white':'white'};
            border:${LAB_SESSION.selectedScenario===i?'2px solid rgba(255,255,255,.5)':'none'};">
          ${LAB_SESSION.selectedScenario===i ? '✓ Selected' : 'Select'}
        </button>
      </div>
    </div>`).join('');

  // Event delegation on #view-lab handles scenario inputs

  // Waste display
  const wasteEl = document.getElementById('labWastePercent');
  if (wasteEl) wasteEl.value = LAB_SESSION.wastePercent;
}

/* ═══════════════════════════════════════════════════════
   SECTION 3 — SUPPLY ASSESSMENT RENDER
═══════════════════════════════════════════════════════ */

function renderLabSupplyAssessment() {
  const container = document.getElementById('labSupplyContainer');
  if (!container || !LAB_SESSION) return;

  const ings = LAB_SESSION.ingredients;
  if (!ings.length) {
    container.innerHTML = `<div class="empty-state">Add ingredients to see supply assessment</div>`;
    return;
  }

  const batchSize = LAB_SESSION.batchSize || 1;
  const rows = ings.map(ing => {
    const liveIng = ing.liveId
      ? (APP_STATE.ingredients||[]).find(i => i.id === ing.liveId)
      : null;
    const needed     = Number(ing.qty || 0) * batchSize;
    const onHand     = liveIng ? Number(liveIng.stock || 0) : null;
    const sufficient = onHand !== null ? onHand >= needed : null;
    const shortfall  = onHand !== null ? Math.max(0, needed - onHand) : null;

    const scarColor = ing.scarcity==='hard' ? '#dc2626'
                    : ing.scarcity==='seasonal' ? '#ea580c' : '#16a34a';
    const scarLabel = ing.scarcity==='hard' ? 'Hard to Source'
                    : ing.scarcity==='seasonal' ? 'Seasonal' : 'Common';

    return `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1.5fr;
        gap:10px;align-items:center;padding:10px 12px;
        border-bottom:1px solid var(--gray-100);font-size:12px;">
        <div>
          <div style="font-weight:700;">${escapeHtml(ing.name)}</div>
          <div style="font-size:10px;color:var(--gray-400);">
            ${ing.isTemp ? 'Temporary ingredient' : `${ing.unit}`}
          </div>
        </div>
        <div style="text-align:center;">
          <span style="font-size:9px;font-weight:800;letter-spacing:1px;
            text-transform:uppercase;padding:2px 8px;border-radius:999px;
            background:${scarColor}20;color:${scarColor};">
            ${scarLabel}
          </span>
        </div>
        <div style="text-align:right;font-variant-numeric:tabular-nums;">
          ${needed.toFixed(2)} ${ing.unit}<br>
          <span style="font-size:10px;color:var(--gray-400);">needed</span>
        </div>
        <div style="text-align:right;font-variant-numeric:tabular-nums;">
          ${onHand !== null ? `${onHand.toFixed(2)} ${ing.unit}` : '—'}<br>
          <span style="font-size:10px;color:var(--gray-400);">on hand</span>
        </div>
        <div style="text-align:right;">
          ${ing.isTemp
            ? `<span style="font-size:10px;color:var(--gray-400);">Not in catalog</span>`
            : sufficient
              ? `<span style="color:#16a34a;font-weight:700;font-size:11px;">✓ Sufficient</span>`
              : `<span style="color:#dc2626;font-weight:700;font-size:11px;">
                  ⚠ Short ${shortfall?.toFixed(2)} ${ing.unit}</span>`}
        </div>
      </div>`;
  }).join('');

  // Overall risk
  const hardCount    = ings.filter(i => i.scarcity === 'hard').length;
  const seasonCount  = ings.filter(i => i.scarcity === 'seasonal').length;
  const shortCount   = ings.filter(i => {
    const l = i.liveId ? (APP_STATE.ingredients||[]).find(x => x.id===i.liveId) : null;
    if (!l) return false;
    return Number(l.stock||0) < Number(i.qty||0) * batchSize;
  }).length;
  const tempCount    = ings.filter(i => i.isTemp).length;

  const riskLevel  = (hardCount > 0 || shortCount > 2) ? 'HIGH'
                   : (seasonCount > 0 || shortCount > 0 || tempCount > 0) ? 'MEDIUM'
                   : 'LOW';
  const riskColor  = riskLevel==='HIGH' ? '#dc2626'
                   : riskLevel==='MEDIUM' ? '#ea580c' : '#16a34a';

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:12px 14px;border-radius:var(--radius-lg);margin-bottom:14px;
      background:${riskColor}15;border:1.5px solid ${riskColor}40;">
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:2px;
          text-transform:uppercase;color:${riskColor};">Overall Supply Risk</div>
        <div style="font-size:12px;color:var(--gray-600);margin-top:2px;">
          ${hardCount} hard-to-source · ${seasonCount} seasonal ·
          ${shortCount} with insufficient stock · ${tempCount} not in catalog
        </div>
      </div>
      <span style="font-size:16px;font-weight:900;color:${riskColor};">${riskLevel}</span>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1.5fr;
      gap:10px;padding:8px 12px;background:var(--black);border-radius:var(--radius-md)
        var(--radius-md) 0 0;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);">Ingredient</div>
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);text-align:center;">Risk</div>
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);text-align:right;">Needed</div>
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);text-align:right;">On Hand</div>
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);text-align:right;">Status</div>
    </div>
    <div style="border:1.5px solid var(--gray-200);border-top:none;
      border-radius:0 0 var(--radius-md) var(--radius-md);">${rows}</div>`;
}

/* ═══════════════════════════════════════════════════════
   SECTION 4 — CHARTS (Chart.js based)
═══════════════════════════════════════════════════════ */

let _labChartInstances = {};

function _destroyLabCharts() {
  Object.values(_labChartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
  _labChartInstances = {};
}

function renderLabChartSelector() {
  const container = document.getElementById('labChartSelector');
  if (!container || !LAB_SESSION) return;

  // Preset buttons
  const presetBtns = Object.keys(LAB_CHART_PRESETS).map(key => `
    <button type="button" class="template-chip lab-chart-preset" data-preset="${key}"
      style="${LAB_SESSION.chartConfig.preset===key?'background:var(--black);color:white;':''}">
      ${key.charAt(0).toUpperCase() + key.slice(1)}
    </button>`).join('');

  // Chart toggles
  const toggles = LAB_CHARTS.map(chart => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:8px 12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);
      margin-bottom:6px;background:var(--white);">
      <span style="font-size:12px;font-weight:${chart.locked?'800':'600'};">
        ${escapeHtml(chart.label)}
        ${chart.locked ? `<span style="font-size:9px;color:var(--gray-400);
          margin-left:4px;">Always shown</span>` : ''}
      </span>
      <label class="toggle-switch" style="pointer-events:${chart.locked?'none':'auto'};">
        <input type="checkbox" class="lab-chart-toggle" data-chart="${chart.id}"
          ${LAB_SESSION.chartConfig.selected.includes(chart.id) ? 'checked' : ''}
          ${chart.locked ? 'disabled' : ''} />
        <div class="toggle-track"></div>
        <div class="toggle-knob"></div>
      </label>
    </div>`).join('');

  container.innerHTML = `
    <div style="margin-bottom:12px;">
      <div style="font-size:10px;font-weight:800;letter-spacing:2px;
        text-transform:uppercase;color:var(--gray-400);margin-bottom:8px;">Quick Presets</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${presetBtns}</div>
    </div>
    <div style="font-size:10px;font-weight:800;letter-spacing:2px;
      text-transform:uppercase;color:var(--gray-400);margin-bottom:8px;">
      Individual Charts
    </div>
    ${toggles}`;

  // Bind preset buttons
  container.querySelectorAll('.lab-chart-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      LAB_SESSION.chartConfig.selected = [...LAB_CHART_PRESETS[preset]];
      LAB_SESSION.chartConfig.order    = [...LAB_CHART_PRESETS[preset]];
      LAB_SESSION.chartConfig.preset   = preset;
      renderLabChartSelector();
      renderLabCharts();
    });
  });

  // Bind toggles
  container.querySelectorAll('.lab-chart-toggle').forEach(inp => {
    inp.addEventListener('change', () => {
      const chartId = inp.dataset.chart;
      if (inp.checked) {
        if (!LAB_SESSION.chartConfig.selected.includes(chartId)) {
          LAB_SESSION.chartConfig.selected.push(chartId);
          LAB_SESSION.chartConfig.order.push(chartId);
        }
      } else {
        LAB_SESSION.chartConfig.selected = LAB_SESSION.chartConfig.selected.filter(c => c !== chartId);
        LAB_SESSION.chartConfig.order    = LAB_SESSION.chartConfig.order.filter(c => c !== chartId);
      }
      LAB_SESSION.chartConfig.preset = null;
      renderLabCharts();
    });
  });
}

function renderLabCharts() {
  const container = document.getElementById('labChartsOutput');
  if (!container || !LAB_SESSION) return;

  _destroyLabCharts();
  const selected = LAB_SESSION.chartConfig.order.filter(
    id => LAB_SESSION.chartConfig.selected.includes(id));

  container.innerHTML = '';

  selected.forEach(chartId => {
    const chartDef = LAB_CHARTS.find(c => c.id === chartId);
    if (!chartDef) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'lab-chart-wrapper';
    wrapper.id = `labChart_${chartId}`;
    wrapper.innerHTML = `
      <div class="lab-chart-title">${escapeHtml(chartDef.label)}</div>
      <div class="lab-chart-inner" id="labChartInner_${chartId}"></div>`;
    container.appendChild(wrapper);
  });

  // Render each chart after DOM is ready
  requestAnimationFrame(() => {
    selected.forEach(chartId => {
      _renderSingleLabChart(chartId);
    });
  });
}

function _renderSingleLabChart(chartId) {
  if (typeof Chart === 'undefined') return;
  const inner = document.getElementById(`labChartInner_${chartId}`);
  if (!inner) return;

  switch(chartId) {
    case 'viability':   _renderViabilityScore(inner);   break;
    case 'waterfall':   _renderWaterfall(inner);         break;
    case 'gauge':       _renderGauge(inner);             break;
    case 'ingredients': _renderIngredientBar(inner);     break;
    case 'breakeven':   _renderBreakevenBurn(inner);     break;
    case 'stock':       _renderStockCoverage(inner);     break;
    case 'batchcurve':  _renderBatchCurve(inner);        break;
    case 'radar':       _renderRadar(inner);             break;
    case 'scenarios':   _renderScenariosBar(inner);      break;
  }
}

function _renderViabilityScore(container) {
  const score = labCalcViabilityScore();
  const overall = score.overall;
  const color = overall >= 70 ? '#16a34a' : overall >= 50 ? '#ea580c' : '#dc2626';
  const label = overall >= 70 ? 'VIABLE' : overall >= 50 ? 'VIABLE WITH CAUTION' : 'NEEDS REVIEW';

  container.innerHTML = `
    <div style="text-align:center;padding:12px 0;">
      <div style="font-size:48px;font-weight:900;color:${color};line-height:1;">
        ${overall}%</div>
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;
        text-transform:uppercase;color:${color};margin-bottom:16px;">${label}</div>
    </div>
    ${[
      ['Financial Health',  score.financial,  'Margin vs target after waste'],
      ['Supply Security',   score.supply,     'Ingredient availability & stock'],
      ['Production Risk',   score.production, 'Recipe complexity & sourcing'],
    ].map(([label, val, sub]) => {
      const c = val>=70?'#16a34a':val>=50?'#ea580c':'#dc2626';
      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;">${label}</span>
            <span style="font-size:11px;font-weight:900;color:${c};">${val}%</span>
          </div>
          <div style="height:8px;background:var(--gray-100);border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${val}%;background:${c};
              border-radius:999px;transition:width .5s ease;"></div>
          </div>
          <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">${sub}</div>
        </div>`;
    }).join('')}`;
}

function _renderWaterfall(container) {
  const canvas  = document.createElement('canvas');
  canvas.height = 200;
  container.appendChild(canvas);
  const scenarios  = labCalcScenarios();
  const sc         = scenarios[LAB_SESSION.selectedScenario] || scenarios[1] || scenarios[0];
  if (!sc) return;

  const ingCost  = labCalcIngredientCost() / (LAB_SESSION.batchSize||1);
  const pkgCost  = labCalcPackagingCost()  / (LAB_SESSION.batchSize||1);
  const waste    = sc.price * (LAB_SESSION.wastePercent||0) / 100;
  const profit   = sc.price - ingCost - pkgCost - waste;

  _labChartInstances['waterfall'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Selling Price','Ingredients','Packaging','Waste Impact','Net Profit'],
      datasets: [{
        data:            [sc.price, -ingCost, -pkgCost, -waste, profit],
        backgroundColor: ['#000','#555','#888','#ea580c', profit>=0?'#16a34a':'#dc2626'],
        borderRadius: 4, borderSkipped: false
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label: ctx=>`₱${Math.abs(ctx.parsed.y).toFixed(2)}`}}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:9},color:'#999'}},
        y:{grid:{color:'#f0f0f0'},ticks:{callback:v=>`₱${Math.abs(v).toFixed(0)}`,font:{size:9}}}
      }
    }
  });
}

function _renderGauge(container) {
  const scenarios = labCalcScenarios();
  const sc = scenarios[LAB_SESSION.selectedScenario] || scenarios[1] || scenarios[0];
  const margin = sc ? sc.effectiveMargin : 0;
  const color  = margin>=70?'#16a34a':margin>=50?'#ea580c':'#dc2626';
  const label  = margin>=75?'Premium':margin>=60?'Healthy':margin>=40?'Acceptable':'Danger Zone';

  container.innerHTML = `
    <div style="text-align:center;padding:16px 0;">
      <svg viewBox="0 0 200 110" width="180" style="display:block;margin:0 auto;">
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke="#f0f0f0" stroke-width="18" stroke-linecap="round"/>
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round"
          stroke-dasharray="${Math.min(251, (margin/100)*251)} 251"/>
        <text x="100" y="88" text-anchor="middle"
          font-family="Helvetica" font-weight="900" font-size="26" fill="${color}">
          ${margin.toFixed(1)}%
        </text>
        <text x="100" y="106" text-anchor="middle"
          font-family="Helvetica" font-size="10" fill="#999">${label}</text>
      </svg>
      <div style="font-size:10px;color:var(--gray-400);margin-top:4px;">
        Effective margin after ${LAB_SESSION.wastePercent}% waste
      </div>
    </div>`;
}

function _renderIngredientBar(container) {
  if (!LAB_SESSION.ingredients.length) return;
  const canvas  = document.createElement('canvas');
  canvas.height = 180;
  container.appendChild(canvas);
  const data = LAB_SESSION.ingredients
    .map(ing => ({ label: ing.name, val: Number(ing.qty||0)*Number(ing.costPerUnit||0) }))
    .sort((a,b) => b.val-a.val);

  _labChartInstances['ingredients'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.label.length > 12 ? d.label.slice(0,12)+'…' : d.label),
      datasets: [{
        data: data.map(d => d.val),
        backgroundColor: data.map((_,i) => i===0?'#000':`hsl(0,0%,${Math.min(70,35+i*10)}%)`),
        borderRadius: 4, borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:ctx=>`₱${ctx.parsed.x.toFixed(4)}`}}},
      scales:{
        x:{grid:{color:'#f0f0f0'},ticks:{callback:v=>`₱${v.toFixed(2)}`,font:{size:9}}},
        y:{grid:{display:false},ticks:{font:{size:9},color:'#555'}}
      }
    }
  });
}

function _renderBreakevenBurn(container) {
  const scenarios = labCalcScenarios();
  const sc = scenarios[LAB_SESSION.selectedScenario] || scenarios[1] || scenarios[0];
  if (!sc) return;
  const batch     = LAB_SESSION.batchSize || 1;
  const breakEven = sc.breakEven;
  const profit    = Math.max(0, batch - breakEven);
  const bePct     = Math.min(100, (breakEven / batch) * 100);

  container.innerHTML = `
    <div style="padding:8px 0;">
      <div style="font-size:12px;margin-bottom:8px;">
        Batch of <strong>${batch}</strong> units at <strong>${formatCurrency(sc.price)}</strong>
      </div>
      <div style="background:var(--gray-100);border-radius:var(--radius-md);
        overflow:hidden;height:32px;position:relative;margin-bottom:8px;">
        <div style="height:100%;width:${bePct}%;background:#555;
          display:flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:800;color:white;white-space:nowrap;
          transition:width .5s ease;">
          ${breakEven > 0 ? `${breakEven} to break even` : ''}
        </div>
        ${profit > 0 ? `
        <div style="position:absolute;right:0;top:0;height:100%;
          width:${100-bePct}%;background:#16a34a;display:flex;align-items:center;
          justify-content:center;font-size:10px;font-weight:800;color:white;white-space:nowrap;">
          ${profit} pure profit
        </div>` : ''}
      </div>
      <div style="font-size:11px;color:var(--gray-500);">
        You need to sell <strong style="color:#000;">${breakEven} of ${batch} units</strong>
        before making any profit.
        ${profit > 0
          ? ` Every unit after that is <strong style="color:#16a34a;">${formatCurrency(sc.profitPerUnit)}</strong> profit.`
          : ` This batch does not break even at this price.`}
      </div>
    </div>`;
}

function _renderStockCoverage(container) {
  const batchSize = LAB_SESSION.batchSize || 1;
  const ings      = LAB_SESSION.ingredients.filter(i => i.liveId);
  if (!ings.length) {
    container.innerHTML = `<div class="cost-preview-empty">No catalog ingredients to show</div>`;
    return;
  }
  container.innerHTML = ings.map(ing => {
    const live    = (APP_STATE.ingredients||[]).find(i => i.id === ing.liveId);
    if (!live) return '';
    const onHand  = Number(live.stock || 0);
    const needed  = Number(ing.qty || 0) * batchSize;
    const batches = needed > 0 ? Math.floor(onHand / Number(ing.qty||1)) : 0;
    const pct     = needed > 0 ? Math.min(100, (onHand / needed) * 100) : 100;
    const color   = pct >= 100 ? '#16a34a' : pct >= 50 ? '#ea580c' : '#dc2626';
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:11px;font-weight:700;">${escapeHtml(ing.name)}</span>
          <span style="font-size:11px;color:${color};font-weight:700;">
            ${batches} batch${batches!==1?'es':''} available
          </span>
        </div>
        <div style="height:8px;background:var(--gray-100);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:999px;"></div>
        </div>
        <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">
          ${onHand.toFixed(2)} ${ing.unit} on hand · needs ${needed.toFixed(2)} per batch
        </div>
      </div>`;
  }).join('');
}

function _renderBatchCurve(container) {
  const canvas = document.createElement('canvas');
  canvas.height = 180;
  container.appendChild(canvas);
  const curve = labCalcBatchCurve();
  _labChartInstances['batchcurve'] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: curve.map(p => p.size),
      datasets: [{
        label: 'Cost per unit',
        data:  curve.map(p => p.costPerUnit),
        borderColor: '#000', backgroundColor: 'rgba(0,0,0,.05)',
        pointBackgroundColor: '#000', tension: 0.3, fill: true
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:ctx=>`₱${ctx.parsed.y.toFixed(4)} per unit`}}},
      scales:{
        x:{title:{display:true,text:'Batch Size',font:{size:9}},
           grid:{display:false},ticks:{font:{size:9}}},
        y:{title:{display:true,text:'Cost/unit (₱)',font:{size:9}},
           grid:{color:'#f0f0f0'},ticks:{callback:v=>`₱${v.toFixed(2)}`,font:{size:9}}}
      }
    }
  });
}

function _renderRadar(container) {
  const canvas = document.createElement('canvas');
  canvas.height = 220;
  container.appendChild(canvas);
  const scenarios = labCalcScenarios();
  const colors    = ['#666','#000','#aaa'];
  const labels    = ['Margin %','Profit/Unit','Eff. Margin','Batch Profit','Units to BE'];
  const maxVals   = [100, 500, 100, 50000, 100];

  _labChartInstances['radar'] = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels,
      datasets: scenarios.map((sc, i) => ({
        label:           ['Conservative','Target','Premium'][i],
        data:            [
          Math.min(100, sc.margin),
          Math.min(100, (sc.profitPerUnit / maxVals[1]) * 100),
          Math.min(100, sc.effectiveMargin),
          Math.min(100, (sc.batchProfit / maxVals[3]) * 100),
          Math.max(0, 100 - (sc.breakEven / (LAB_SESSION.batchSize||1)) * 100)
        ],
        borderColor:     colors[i],
        backgroundColor: `${colors[i]}22`,
        pointBackgroundColor: colors[i],
        borderWidth: i===1 ? 2.5 : 1.5
      }))
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:12}}},
      scales:{r:{min:0,max:100,ticks:{display:false},
        grid:{color:'#e5e7eb'},pointLabels:{font:{size:9}}}}
    }
  });
}

function _renderScenariosBar(container) {
  const canvas = document.createElement('canvas');
  canvas.height = 180;
  container.appendChild(canvas);
  const scenarios = labCalcScenarios();
  _labChartInstances['scenarios'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Conservative','Target','Premium'],
      datasets: [
        {
          label: 'Price',
          data:  scenarios.map(s => s.price),
          backgroundColor: ['#888','#000','#333'],
          borderRadius: 4
        },
        {
          label: 'Cost/unit',
          data:  scenarios.map(() => labCalcCostPerUnit()),
          backgroundColor: '#dc262640',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom',labels:{font:{size:9},boxWidth:12}},
        tooltip:{callbacks:{label:ctx=>`₱${ctx.parsed.y.toFixed(2)}`}}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:9}}},
        y:{grid:{color:'#f0f0f0'},ticks:{callback:v=>`₱${v.toFixed(0)}`,font:{size:9}}}
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════
   SECTION 5 — SAVE & CONVERT
═══════════════════════════════════════════════════════ */

function saveLabDraft() {
  if (!LAB_SESSION) return;
  const name = sanitizeText(document.getElementById('labDraftName')?.value || '') ||
    `Draft — ${new Date().toLocaleDateString()}`;
  LAB_SESSION.name      = name;
  LAB_SESSION.updatedAt = new Date().toISOString();

  const drafts  = Array.isArray(APP_STATE.labDrafts) ? APP_STATE.labDrafts : [];
  const idx     = drafts.findIndex(d => d.id === LAB_SESSION.id);
  if (idx >= 0) drafts[idx] = { ...LAB_SESSION };
  else          drafts.push({ ...LAB_SESSION });

  updateState('labDrafts', () => drafts);
  renderLabDraftsList();
  showNotification(`Draft "${name}" saved`, 'success');
}

function loadLabDraft(draftId) {
  const draft = (APP_STATE.labDrafts || []).find(d => d.id === draftId);
  if (!draft) return;
  LAB_SESSION = { ...draft };
  renderLabView();
  showNotification(`Draft "${draft.name}" loaded`, 'success');
}

function deleteLabDraft(draftId) {
  if (!confirm('Delete this draft?')) return;
  updateState('labDrafts', () => (APP_STATE.labDrafts||[]).filter(d => d.id !== draftId));
  renderLabDraftsList();
  showNotification('Draft deleted', 'success');
}

function renderLabDraftsList() {
  const container = document.getElementById('labDraftsList');
  if (!container) return;
  const drafts = APP_STATE.labDrafts || [];
  if (!drafts.length) {
    container.innerHTML = `<div class="cost-preview-empty">No saved drafts yet</div>`;
    return;
  }
  container.innerHTML = drafts.slice().reverse().map(d => {
    const perUnit = d.ingredients
      ? d.ingredients.reduce((s,i) => s + Number(i.qty||0)*Number(i.costPerUnit||0), 0) /
        Math.max(1, d.batchSize||1)
      : 0;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);
        margin-bottom:8px;background:var(--white);">
        <div>
          <div style="font-weight:800;font-size:13px;">${escapeHtml(d.name || 'Untitled')}</div>
          <div style="font-size:11px;color:var(--gray-400);">
            ${d.category||'—'} · ₱${perUnit.toFixed(2)}/unit ·
            <span style="color:${d.status==='converted'?'#16a34a':'var(--gray-400)'};font-weight:700;">
              ${d.status==='converted' ? `Converted → ${d.convertedProductName||'Product'}` : 'Draft'}
            </span>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm" data-action="load-lab-draft" data-id="${d.id}">Open</button>
          <button class="btn btn-sm btn-secondary" data-action="delete-lab-draft"
            data-id="${d.id}">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function openLabConvertModal() {
  if (!LAB_SESSION) return;
  const scenarios = labCalcScenarios();
  const container = document.getElementById('labConvertScenarios');
  if (container) {
    container.innerHTML = [
      ...scenarios.map((sc, i) => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;
          border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);
          cursor:pointer;margin-bottom:8px;">
          <input type="radio" name="labConvertScenario" value="${i}"
            ${LAB_SESSION.selectedScenario===i?'checked':''}
            style="width:16px;height:16px;" />
          <div>
            <div style="font-weight:800;font-size:12px;">
              ${['Conservative','Target','Premium'][i]}
              — ${formatCurrency(sc.price)} (${sc.margin.toFixed(1)}% margin)
            </div>
            <div style="font-size:11px;color:var(--gray-500);">
              Profit/unit: ${formatCurrency(sc.profitPerUnit)}
            </div>
          </div>
        </label>`),
      `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;
          border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);
          cursor:pointer;margin-bottom:8px;">
          <input type="radio" name="labConvertScenario" value="custom"
            style="width:16px;height:16px;" />
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;font-size:12px;">Custom price</span>
            <input type="number" id="labConvertCustomPrice" min="0" step="0.01"
              placeholder="₱0.00"
              style="width:100px;padding:5px 8px;border:1px solid var(--gray-200);
                border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
          </div>
        </label>`
    ].join('');
  }
  setElementValue('labConvertName', LAB_SESSION.name || '');
  openModal('labConvertModal');
}

function confirmLabConvert() {
  const scenarioInput = document.querySelector('input[name="labConvertScenario"]:checked');
  if (!scenarioInput) { showNotification('Please select a price scenario', 'error'); return; }

  const scenarios = labCalcScenarios();
  let price;
  if (scenarioInput.value === 'custom') {
    price = Number(document.getElementById('labConvertCustomPrice')?.value || 0);
    if (!price) { showNotification('Enter a custom price', 'error'); return; }
  } else {
    price = scenarios[Number(scenarioInput.value)]?.price || 0;
  }

  const productName = sanitizeText(document.getElementById('labConvertName')?.value || LAB_SESSION.name || 'New Product');
  if (!productName) { showNotification('Product name required', 'error'); return; }

  // Pre-fill the Add Product modal
  closeModal('labConvertModal');

  if (typeof clearProductForm === 'function') clearProductForm();
  setElementValue('productId',   '');
  setElementValue('productName', productName);
  setElementValue('productPrice', price.toFixed(2));
  setElementValue('productStock', 0);

  // Set category
  const catSel = document.getElementById('productCategory');
  if (catSel) catSel.value = LAB_SESSION.category || '';

  // Set recipe mode
  setElementValue('recipeMode',  'unit');
  setElementValue('batchYield',  LAB_SESSION.batchSize || 1);

  // Add catalog ingredients as recipe rows
  LAB_SESSION.ingredients
    .filter(i => i.liveId && !i.isTemp)
    .forEach(i => {
      if (typeof addRecipeRow === 'function') {
        addRecipeRow({ ingredientId: i.liveId, quantity: i.qty });
      }
    });

  // Add packaging if enabled
  if (LAB_SESSION.packagingEnabled) {
    LAB_SESSION.packaging.forEach(p => {
      if (typeof addPackagingRow === 'function') addPackagingRow(p);
    });
  }

  // Final dropdown sync + preview
  if (typeof renderIngredientDropdowns === 'function') renderIngredientDropdowns();

  // Mark draft as converted
  LAB_SESSION.status               = 'converted';
  LAB_SESSION.convertedProductName = productName;
  LAB_SESSION.convertedAt          = new Date().toISOString();
  saveLabDraft();

  // Switch to Products view and open modal
  if (typeof switchPage === 'function') switchPage('products');
  setTimeout(() => {
    if (typeof renderProductTemplates   === 'function') renderProductTemplates();
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
    openModal('productModal');
    showNotification(`Lab converted — review and save your product`, 'success');
  }, 150);
}

/* ═══════════════════════════════════════════════════════
   MAIN VIEW RENDER
═══════════════════════════════════════════════════════ */

function _refreshLabCalcs() {
  renderLabPricing();
  renderLabSupplyAssessment();
  renderLabCharts();
  _renderLabIngredientRows();
}

function renderLabView() {
  if (!LAB_SESSION) {
    // Show drafts list + new session button
    const main = document.getElementById('labMainContent');
    if (main) main.style.display = 'none';
    const landing = document.getElementById('labLandingContent');
    if (landing) landing.style.display = 'block';
    renderLabDraftsList();
    renderLabPresetsList();
    return;
  }

  const main    = document.getElementById('labMainContent');
  const landing = document.getElementById('labLandingContent');
  if (main)    main.style.display    = 'block';
  if (landing) landing.style.display = 'none';

  renderLabRecipeBuilder();
  renderLabPricing();
  renderLabSupplyAssessment();
  renderLabChartSelector();
  renderLabCharts();

  // Set name field
  setElementValue('labDraftName', LAB_SESSION.name || '');

  // Packaging toggle — sync section visibility only, not checkbox
  // (checkbox.checked is already set by user; re-setting it here fires change event again)
  const pkgSection = document.getElementById('labPackagingSection');
  if (pkgSection) pkgSection.style.display = LAB_SESSION.packagingEnabled ? 'block' : 'none';
  const pkgToggle = document.getElementById('labPackagingToggle');
  if (pkgToggle && pkgToggle.checked !== LAB_SESSION.packagingEnabled) {
    pkgToggle.checked = LAB_SESSION.packagingEnabled;
  }

  // Strategic/Launch toggles
  const strat = document.getElementById('labStrategicToggle');
  const launch = document.getElementById('labLaunchToggle');
  if (strat)  {
    strat.checked = LAB_SESSION.strategicEnabled;
    document.getElementById('labStrategicSection')?.style.setProperty(
      'display', LAB_SESSION.strategicEnabled ? 'block' : 'none');
  }
  if (launch) {
    launch.checked = LAB_SESSION.launchEnabled;
    document.getElementById('labLaunchSection')?.style.setProperty(
      'display', LAB_SESSION.launchEnabled ? 'block' : 'none');
  }

  // Waste slider — only sync if not currently being dragged
  const wasteSlider = document.getElementById('labWasteSlider');
  if (wasteSlider && Number(wasteSlider.value) !== LAB_SESSION.wastePercent) {
    wasteSlider.value = LAB_SESSION.wastePercent;
  }
  const wasteDisp = document.getElementById('labWasteDisplay');
  if (wasteDisp) wasteDisp.textContent = LAB_SESSION.wastePercent + '%';
}

/* ── Exports ── */
window.getLabCategoryPresets    = getLabCategoryPresets;
window._renderLabIngredientRows  = _renderLabIngredientRows;
window._renderLabPackagingRows   = _renderLabPackagingRows;
window._refreshLabCalcs          = _refreshLabCalcs;
window.saveLabCategoryPreset    = saveLabCategoryPreset;
window.deleteLabCategoryPreset  = deleteLabCategoryPreset;
window.openLabPresetModal       = openLabPresetModal;
window.saveLabPresetFromForm    = saveLabPresetFromForm;
window.renderLabPresetsList     = renderLabPresetsList;
window.startNewLabSession       = startNewLabSession;
window.applyLabPreset           = applyLabPreset;
window.addLabIngredientFromCatalog = addLabIngredientFromCatalog;
window.addLabTempIngredient     = addLabTempIngredient;
window.addLabPackagingItem      = addLabPackagingItem;
window.renderLabView            = renderLabView;
window.renderLabCharts          = renderLabCharts;
window.renderLabChartSelector   = renderLabChartSelector;
window.saveLabDraft             = saveLabDraft;
window.loadLabDraft             = loadLabDraft;
window.deleteLabDraft           = deleteLabDraft;
window.renderLabDraftsList      = renderLabDraftsList;
window.openLabConvertModal      = openLabConvertModal;
window.confirmLabConvert        = confirmLabConvert;
window.labCalcViabilityScore    = labCalcViabilityScore;
window.labCalcScenarios         = labCalcScenarios;
window.LAB_SESSION              = null;
