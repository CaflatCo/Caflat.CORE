/* ═══════════════════════════════════════════════════════
   PRODUCTLAB.JS — Product Lab (Rebuilt)
   Clean 3-panel workspace: Setup | Recipe | Results
   All calculation logic preserved, render layer rebuilt.
═══════════════════════════════════════════════════════ */

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

/* Debounce and refresh defined in render layer below */

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
    recipeMode:   'batch',  // default to batch mode — more natural for bakers
    batchSize:    24,       // sensible default for a cookie batch
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
      padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-lg);
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

  LAB_SESSION.category      = category;
  LAB_SESSION.presetId      = preset.id;
  // Only set batchSize from preset if user hasn't entered one yet
  if (!LAB_SESSION.batchSize || LAB_SESSION.batchSize <= 1) {
    LAB_SESSION.batchSize   = preset.batchSize;
  }
  LAB_SESSION.marginTargets = [...preset.marginTargets];

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

  _renderLabIngredientRows();
  _renderLabPackagingRows();;
  ;
  _labRefreshCalcs();
  showNotification(`${category} preset applied — all values editable`, 'success');
}

/* ═══════════════════════════════════════════════════════
   CALCULATIONS — all pure functions
═══════════════════════════════════════════════════════ */

function labCalcIngredientCost() {
  if (!LAB_SESSION) return 0;
  const batchSize = Math.max(1, LAB_SESSION.batchSize || 1);
  return LAB_SESSION.ingredients.reduce((s, ing) => {
    const qty = LAB_SESSION.recipeMode === 'batch'
      ? Number(ing.qty || 0) / batchSize   // per-batch qty ÷ batch size = per unit
      : Number(ing.qty || 0);              // already per unit
    return s + qty * Number(ing.costPerUnit || 0);
  }, 0);
}

function labCalcPackagingCost() {
  if (!LAB_SESSION || !LAB_SESSION.packagingEnabled) return 0;
  return LAB_SESSION.packaging.reduce((s, p) => s + Number(p.cost || 0), 0);
}

function labCalcTotalCost() {
  return labCalcIngredientCost() + labCalcPackagingCost();
}

function labCalcCostPerUnit() {
  // labCalcIngredientCost() already returns per-unit cost in both modes
  // labCalcPackagingCost() returns per-unit packaging cost
  // So total is already per unit — no further division needed
  return labCalcTotalCost();
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
  if (!price) return 0;
  const waste      = (LAB_SESSION?.wastePercent || 0) / 100;
  const cost       = labCalcCostPerUnit();
  const effectiveRev = price * (1 - waste);
  if (!effectiveRev) return 0;
  return ((effectiveRev - cost) / effectiveRev) * 100;
}

function labCalcBreakEven(price) {
  if (!price) return 0;
  // Total batch cost = cost per unit × batch size
  const batchCost = labCalcCostPerUnit() * Math.max(1, LAB_SESSION?.batchSize || 1);
  return Math.ceil(batchCost / price);
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
  // labCalcIngredientCost() is already per-unit cost
  // Scale back to batch total, then divide by each size
  const currentBatch   = Math.max(1, LAB_SESSION?.batchSize || 1);
  const batchIngCost   = labCalcIngredientCost() * currentBatch;
  const pkgCostPerUnit = labCalcPackagingCost();
  return sizes.map(size => ({
    size,
    costPerUnit: (batchIngCost / size) + pkgCostPerUnit
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
  const scarCount    = ings.filter(i => i.scarcity === 'hard').length;
  const seasonCount  = ings.filter(i => i.scarcity === 'seasonal').length;
  // Supply score based only on scarcity — no live inventory check in Lab
  const supplyScore  = Math.min(100, Math.max(0,
    ((commonCount / total) * 100) -
    (scarCount * 20) - (seasonCount * 10)));

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

function openLabIngPickerModal() {
  if (!LAB_SESSION) return;
  _renderLabIngPickerList('');
  openModal('labIngPickerModal');
  // Bind search
  const search = document.getElementById('labIngPickerSearch');
  if (search) {
    search.value = '';
    search.oninput = () => _renderLabIngPickerList(search.value);
    setTimeout(() => search.focus(), 100);
  }
}


function _renderLabIngPickerList(query) {
  const container = document.getElementById('labIngPickerList');
  if (!container) return;
  const ings = (APP_STATE.ingredients || [])
    .filter(i => !query || i.name.toLowerCase().includes(query.toLowerCase()));

  if (!ings.length) {
    container.innerHTML = `<div class="cost-preview-empty" style="grid-column:1/-1;">
      No ingredients found</div>`;
    return;
  }

  container.innerHTML = ings.map(i => `
    <button type="button"
      style="padding:12px 14px;border:1.5px solid var(--border);
        border-radius:var(--radius-lg);background:var(--white);cursor:pointer;
        text-align:left;font-family:var(--font-main);transition:all .15s ease;"
      onmouseover="this.style.borderColor='#000'"
      onmouseout="this.style.borderColor='var(--gray-200)'"
      onclick="addLabIngredientFromCatalog('${i.id}');
        document.getElementById('labIngPickerSearch').value='';
        _renderLabIngPickerList('');">
      <div style="font-weight:800;font-size:12px;">${escapeHtml(i.name)}</div>
      <div style="font-size:10px;color:var(--gray-400);margin-top:2px;">
        ${escapeHtml(i.unit||'')} · ₱${Number(i.costPerUnit||0).toFixed(3)}/unit
  
      </div>
    </button>`).join('');
}


function _updateLabCategorySelect() {
  const sel = document.getElementById('labCategorySelect');
  if (!sel || !LAB_SESSION) return;
  const cats = (APP_STATE.categories || []).map(c => typeof c === 'object' ? c.name : c);
  sel.innerHTML = `<option value="">Select Category</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}"
      ${LAB_SESSION.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
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
  _labRefreshCalcs();
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
  _labRefreshCalcs();
  closeModal('labTempIngModal');
}


function addLabPackagingItem() {
  if (!LAB_SESSION) return;
  LAB_SESSION.packaging.push({ id: generateId(), name: '', cost: 0 });
  _renderLabPackagingRows();
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
      <input type="text" placeholder="e.g. Cookie Box"
        value="${escapeHtml(pkg.name)}"
        style="flex:2;padding:7px 10px;border:1px solid var(--border);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
        oninput="LAB_SESSION.packaging[${idx}].name=this.value;" />
      <input type="number" placeholder="Cost ₱"
        value="${pkg.cost}" min="0" step="0.01"
        style="width:110px;padding:7px 10px;border:1px solid var(--border);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
        oninput="LAB_SESSION.packaging[${idx}].cost=Number(this.value||0);_labRefreshCalcs();" />
      <button type="button" class="btn btn-sm btn-secondary"
        onclick="LAB_SESSION.packaging.splice(${idx},1);_renderLabPackagingRows();_labRefreshCalcs();">
        ✕</button>`;
    container.appendChild(row);
  });
  // Event delegation on #view-lab handles packaging row events
}


function saveLabDraft() {
  if (!LAB_SESSION) return;

  // Build a meaningful auto-name if blank
  const inputName = sanitizeText(document.getElementById('labDraftName')?.value || '');
  const autoName  = inputName
    || (LAB_SESSION.ingredients?.length
        ? `${LAB_SESSION.category || 'Lab'} — ${LAB_SESSION.ingredients.slice(0,2).map(i=>i.name).join(', ')}`
        : `Draft — ${new Date().toLocaleDateString()}`);

  LAB_SESSION.name      = autoName;
  LAB_SESSION.updatedAt = new Date().toISOString();

  // Sync name back to input field
  setElementValue('labDraftName', autoName);

  const drafts = Array.isArray(APP_STATE.labDrafts) ? APP_STATE.labDrafts : [];
  const idx    = drafts.findIndex(d => d.id === LAB_SESSION.id);
  if (idx >= 0) drafts[idx] = { ...LAB_SESSION };
  else          drafts.push({ ...LAB_SESSION });

  updateState('labDrafts', () => drafts);
  // Render drafts list in both landing and the inline panel (if visible)
  renderLabDraftsList();
  ;
  showNotification(`Draft "${autoName}" saved`, 'success');
}


function loadLabDraft(draftId) {
  const draft = (APP_STATE.labDrafts || []).find(d => d.id === draftId);
  if (!draft) return;
  LAB_SESSION = { ...draft };
  renderLabView();
  // Sync name field after render
  setTimeout(() => setElementValue('labDraftName', draft.name || ''), 50);
  showNotification(`Draft "${draft.name}" loaded`, 'success');
}


function deleteLabDraft(draftId) {
  if (!confirm('Delete this draft?')) return;
  updateState('labDrafts', () => (APP_STATE.labDrafts||[]).filter(d => d.id !== draftId));
  renderLabDraftsList();
  showNotification('Draft deleted', 'success');
}


function _draftCard(d) {
  const perUnit = d.ingredients
    ? d.ingredients.reduce((s,i) => s + Number(i.qty||0)*Number(i.costPerUnit||0), 0) /
      Math.max(1, d.batchSize||1)
    : 0;
  const isActive = LAB_SESSION && LAB_SESSION.id === d.id;
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 14px;border:1.5px solid ${isActive?'var(--black)':'var(--gray-200)'};
      border-radius:var(--radius-lg);margin-bottom:8px;
      background:${isActive?'var(--gray-50)':'var(--white)'};">
      <div>
        <div style="font-weight:800;font-size:13px;">
          ${escapeHtml(d.name || 'Untitled')}
          ${isActive?'<span style="font-size:9px;color:var(--gray-400);margin-left:6px;">CURRENT</span>':''}
        </div>
        <div style="font-size:11px;color:var(--gray-400);">
          ${d.category||'—'} · ₱${perUnit.toFixed(2)}/unit ·
          <span style="color:${d.status==='converted'?'#16a34a':'var(--gray-400)'};font-weight:700;">
            ${d.status==='converted' ? `Converted → ${d.convertedProductName||'Product'}` : 'Draft'}
          </span>
          · ${new Date(d.updatedAt||d.createdAt).toLocaleDateString()}
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        ${!isActive ? `<button class="btn btn-sm" data-action="load-lab-draft"
          data-id="${d.id}">Open</button>` : ''}
        <button class="btn btn-sm btn-secondary" data-action="delete-lab-draft"
          data-id="${d.id}">Delete</button>
      </div>
    </div>`;
}


function openLabConvertModal() {
  if (!LAB_SESSION) return;
  const scenarios = labCalcScenarios();
  const container = document.getElementById('labConvertScenarios');
  if (container) {
    container.innerHTML = [
      ...scenarios.map((sc, i) => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;
          border:1.5px solid var(--border);border-radius:var(--radius-lg);
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
          border:1.5px solid var(--border);border-radius:var(--radius-lg);
          cursor:pointer;margin-bottom:8px;">
          <input type="radio" name="labConvertScenario" value="custom"
            style="width:16px;height:16px;" />
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;font-size:12px;">Custom price</span>
            <input type="number" id="labConvertCustomPrice" min="0" step="0.01"
              placeholder="₱0.00"
              style="width:100px;padding:5px 8px;border:1px solid var(--border);
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


function _labDebounce(fn, delay) {
  let t;
  return function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), delay); };
}
const _labRefreshDebounced = _labDebounce(_labRefreshCalcs, 300);

function _labRefreshCalcs() {
  if (!LAB_SESSION) return;
  _updateCostDisplay();
  _updateScenarios();
}

/* ── Batch size helpers ── */
function adjustBatchSize(delta) {
  if (!LAB_SESSION) return;
  const inp = document.getElementById('labBatchSize');
  LAB_SESSION.batchSize = Math.max(1, (LAB_SESSION.batchSize || 1) + delta);
  if (inp) inp.value = LAB_SESSION.batchSize;
  _labRefreshCalcs();
}

function setBatchSize(n) {
  if (!LAB_SESSION) return;
  LAB_SESSION.batchSize = n;
  const inp = document.getElementById('labBatchSize');
  if (inp) inp.value = n;
  // Highlight active quick btn
  document.querySelectorAll('.lab-quick-btn').forEach(b => {
    b.classList.toggle('lab-quick-active', Number(b.textContent) === n);
  });
  _labRefreshCalcs();
  _renderLabIngredientRows();
}

/* ── Mode toggle ── */
function setLabMode(mode) {
  if (!LAB_SESSION) return;
  LAB_SESSION.recipeMode = mode;
  document.getElementById('labModeBatch')?.classList.toggle('lab-mode-active', mode === 'batch');
  document.getElementById('labModeUnit')?.classList.toggle('lab-mode-active', mode === 'unit');
  document.getElementById('labBatchSizeField').style.display = mode === 'batch' ? '' : 'none';
  _renderLabIngredientRows();
  _labRefreshCalcs();
}

/* ── Margin target update ── */
function setLabMargin(idx, val) {
  if (!LAB_SESSION) return;
  LAB_SESSION.marginTargets[idx] = Math.min(99, Math.max(0, Number(val) || 0));
  _labRefreshCalcs();
}

/* ── Cost display update (no re-render) ── */
function _updateCostDisplay() {
  if (!LAB_SESSION) return;
  const ingCost = labCalcIngredientCost();
  const pkgCost = labCalcPackagingCost();
  const total   = labCalcTotalCost();
  const perUnit = labCalcCostPerUnit();

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatCurrency(val);
  };
  set('labIngCostTotal', ingCost);
  set('labPkgCostTotal', pkgCost);
  set('labTotalCost',    total);
  set('labCostPerUnit',  perUnit);

  // Also update ingredient row line costs without full re-render
  document.querySelectorAll('.lab-line-cost').forEach((el, i) => {
    const ing  = LAB_SESSION.ingredients[i];
    if (!ing) return;
    const batch = Math.max(1, LAB_SESSION.batchSize || 1);
    const raw   = Number(ing.qty || 0) * Number(ing.costPerUnit || 0);
    const cost  = LAB_SESSION.recipeMode === 'batch' ? raw / batch : raw;
    el.textContent = formatCurrency(cost);
    el.style.color = cost > 0 ? 'var(--black)' : 'var(--gray-300)';
  });

  // Update ingredient total row
  const totalEl = document.getElementById('labIngTotal');
  if (totalEl) totalEl.textContent = formatCurrency(ingCost);
}

/* ── Scenarios panel update ── */
function _updateScenarios() {
  const container = document.getElementById('labScenariosContainer');
  if (!container || !LAB_SESSION) return;

  const scenarios = labCalcScenarios();
  const labels    = ['Conservative', 'Target', 'Premium'];
  const colors    = ['#374151', '#111827', '#000000'];

  container.innerHTML = scenarios.map((sc, i) => `
    <div style="padding:16px;border:1.5px solid var(--border);border-radius:var(--radius-lg);
      margin-bottom:10px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;width:3px;height:100%;
        background:${colors[i]};border-radius:2px 0 0 2px;"></div>
      <div style="padding-left:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div>
            <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
              text-transform:uppercase;color:var(--gray-400);">${labels[i] || `Scenario ${i+1}`}</div>
            <div style="font-size:22px;font-weight:900;font-variant-numeric:tabular-nums;
              margin-top:2px;">${formatCurrency(sc.price)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9px;font-weight:800;letter-spacing:1px;
              text-transform:uppercase;color:var(--gray-400);">Margin</div>
            <div style="font-size:18px;font-weight:900;color:${sc.effectiveMargin !== 0 && isFinite(sc.effectiveMargin) ? (sc.effectiveMargin > 0 ? '#16a34a' : 'var(--danger)') : 'var(--gray-300)'};">
              ${isFinite(sc.effectiveMargin) ? sc.effectiveMargin.toFixed(1) + '%' : '—'}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:9px;color:var(--gray-400);font-weight:700;
              letter-spacing:1px;text-transform:uppercase;">Profit / Unit</div>
            <div style="font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;">
              ${formatCurrency(sc.profitPerUnit)}</div>
          </div>
          <div>
            <div style="font-size:9px;color:var(--gray-400);font-weight:700;
              letter-spacing:1px;text-transform:uppercase;">Break-even</div>
            <div style="font-size:12px;font-weight:800;">${sc.breakEven} units</div>
          </div>
          <div>
            <div style="font-size:9px;color:var(--gray-400);font-weight:700;
              letter-spacing:1px;text-transform:uppercase;">Batch Revenue</div>
            <div style="font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;">
              ${formatCurrency(sc.batchRevenue)}</div>
          </div>
          <div>
            <div style="font-size:9px;color:var(--gray-400);font-weight:700;
              letter-spacing:1px;text-transform:uppercase;">Batch Profit</div>
            <div style="font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;
              color:${sc.batchProfit > 0 ? '#16a34a' : sc.batchProfit < 0 ? 'var(--danger)' : 'var(--gray-400)'};">
              ${formatCurrency(sc.batchProfit)}</div>
          </div>
        </div>
        <!-- Margin bar -->
        <div style="margin-top:10px;height:4px;background:var(--gray-100);border-radius:999px;overflow:hidden;">
          <div style="height:100%;background:${colors[i]};border-radius:999px;
            width:${Math.min(100, Math.max(0, sc.effectiveMargin))}%;
            transition:width .3s ease;"></div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ── Ingredient rows render ── */
function _renderLabIngredientRows() {
  const container = document.getElementById('labIngredientRows');
  if (!container || !LAB_SESSION) return;
  container.innerHTML = '';

  if (!LAB_SESSION.ingredients.length) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;border:1.5px dashed var(--border);
        border-radius:var(--radius-lg);color:var(--gray-400);">
        <div style="font-size:12px;font-weight:600;">No ingredients yet</div>
        <div style="font-size:11px;margin-top:4px;">Add from catalog or use a temp ingredient</div>
      </div>`;
    return;
  }

  const isBatch = LAB_SESSION.recipeMode === 'batch';
  const batch   = Math.max(1, LAB_SESSION.batchSize || 1);

  LAB_SESSION.ingredients.forEach((ing, idx) => {
    const rawQty    = Number(ing.qty || 0);
    const cpUnit    = Number(ing.costPerUnit || 0);
    const lineCost  = rawQty * cpUnit;
    const perCookie = isBatch ? lineCost / batch : lineCost;

    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:8px;border:1.5px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;background:var(--white);';
    row.innerHTML = `
      <div style="display:flex;align-items:center;padding:10px 12px;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;">
            ${ing.isTemp ? `<span style="font-size:8px;font-weight:800;padding:1px 5px;
              border-radius:999px;background:#fff7ed;color:#c2410c;
              border:1px solid #fed7aa;flex-shrink:0;">TEMP</span>` : ''}
            <span style="font-size:12px;font-weight:800;truncate;">${escapeHtml(ing.name)}</span>
          </div>
          <span style="font-size:10px;color:var(--gray-400);">${escapeHtml(ing.unit || '')}</span>
        </div>
        <div style="flex:0 0 90px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
            color:var(--gray-400);margin-bottom:3px;">${isBatch ? 'Qty (batch)' : 'Qty (unit)'}</div>
          <input type="number" value="${rawQty || ''}" min="0" step="0.01" placeholder="0"
            style="width:100%;padding:5px 7px;border:1.5px solid var(--border);
              border-radius:var(--radius-sm);font-size:13px;font-weight:700;
              font-family:var(--font-main);"
            oninput="LAB_SESSION.ingredients[${idx}].qty=Number(this.value||0);_labRefreshDebounced();" />
        </div>
        ${ing.isTemp ? `
        <div style="flex:0 0 90px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
            color:var(--gray-400);margin-bottom:3px;">₱/unit</div>
          <input type="number" value="${cpUnit || ''}" min="0" step="0.001" placeholder="0.000"
            style="width:100%;padding:5px 7px;border:1.5px solid var(--border);
              border-radius:var(--radius-sm);font-size:13px;font-family:var(--font-main);"
            oninput="LAB_SESSION.ingredients[${idx}].costPerUnit=Number(this.value||0);_labRefreshDebounced();" />
        </div>` : `
        <div style="flex:0 0 90px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
            color:var(--gray-400);margin-bottom:3px;">₱/unit</div>
          <div style="font-size:12px;font-weight:700;color:var(--gray-600);padding:6px 0;">
            ₱${cpUnit.toFixed(4)}</div>
        </div>`}
        <div style="flex:0 0 80px;text-align:right;">
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
            color:var(--gray-400);margin-bottom:3px;">${isBatch ? 'per unit' : 'cost'}</div>
          <div class="lab-line-cost" style="font-size:14px;font-weight:900;
            font-variant-numeric:tabular-nums;
            color:${perCookie > 0 ? 'var(--black)' : 'var(--gray-300)'}">
            ${formatCurrency(perCookie)}</div>
        </div>
        <button type="button"
          style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;
            background:none;cursor:pointer;color:var(--gray-300);font-size:14px;
            display:flex;align-items:center;justify-content:center;font-family:var(--font-main);"
          onmouseover="this.style.background='var(--gray-100)';this.style.color='var(--danger)';"
          onmouseout="this.style.background='none';this.style.color='var(--gray-300)';"
          onclick="LAB_SESSION.ingredients.splice(${idx},1);_renderLabIngredientRows();_labRefreshCalcs();">✕</button>
      </div>`;
    container.appendChild(row);
  });

  // Total row
  const ingTotal = labCalcIngredientCost();
  const totalRow = document.createElement('div');
  totalRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-top:4px;border-top:1.5px solid var(--black);';
  totalRow.innerHTML = `
    <span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
      Ingredient Cost / ${isBatch ? 'unit' : 'unit'}
    </span>
    <span id="labIngTotal" style="font-size:16px;font-weight:900;font-variant-numeric:tabular-nums;">
      ${formatCurrency(ingTotal)}
    </span>`;
  container.appendChild(totalRow);
}

/* ── Draft dropdown ── */
function toggleLabDraftDropdown() {
  const dd = document.getElementById('labDraftDropdown');
  if (!dd) return;
  const open = dd.style.display !== 'none';
  dd.style.display = open ? 'none' : 'block';
  if (!open) _renderDraftDropdownList();
}

function _renderDraftDropdownList() {
  const list = document.getElementById('labDraftDropdownList');
  if (!list) return;
  const drafts = APP_STATE.labDrafts || [];
  if (!drafts.length) {
    list.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--gray-400);text-align:center;">No saved drafts</div>`;
    return;
  }
  list.innerHTML = drafts.slice().reverse().map(d => {
    const isActive = LAB_SESSION && LAB_SESSION.id === d.id;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:8px 10px;border-radius:var(--radius-sm);margin-bottom:2px;
        background:${isActive ? 'var(--gray-50)' : 'transparent'};"
        onmouseover="this.style.background='var(--gray-50)'"
        onmouseout="this.style.background='${isActive ? 'var(--gray-50)' : 'transparent'}'">
        <div>
          <div style="font-size:12px;font-weight:700;">${escapeHtml(d.name || 'Untitled')}</div>
          <div style="font-size:10px;color:var(--gray-400);">${d.category || '—'} · ${new Date(d.updatedAt || d.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:4px;">
          ${!isActive ? `<button class="btn btn-sm" type="button"
            onclick="loadLabDraft('${d.id}');toggleLabDraftDropdown();">Open</button>` : `<span style="font-size:9px;font-weight:800;color:var(--gray-400);letter-spacing:1px;">ACTIVE</span>`}
          <button class="btn btn-sm btn-secondary" type="button"
            onclick="deleteLabDraft('${d.id}');_renderDraftDropdownList();">✕</button>
        </div>
      </div>`;
  }).join('');
}

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#labDraftDropdownWrap')) {
    const dd = document.getElementById('labDraftDropdown');
    if (dd) dd.style.display = 'none';
  }
});

/* ── Main renderLabView ── */
function renderLabView() {
  const empty     = document.getElementById('labEmptyState');
  const workspace = document.getElementById('labWorkspace');

  if (!LAB_SESSION) {
    if (empty)     empty.style.display     = 'flex';
    if (workspace) workspace.style.display = 'none';
    // Update draft label
    const label = document.getElementById('labCurrentDraftLabel');
    if (label) label.textContent = 'Drafts';
    return;
  }

  if (empty)     empty.style.display     = 'none';
  if (workspace) workspace.style.display = 'block';

  // Sync all config inputs to LAB_SESSION state
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('labDraftName', LAB_SESSION.name || '');
  setVal('labBatchSize', LAB_SESSION.batchSize || 24);
  setVal('labWasteInput', LAB_SESSION.wastePercent || 0);
  setVal('labMargin0', LAB_SESSION.marginTargets[0] ?? 55);
  setVal('labMargin1', LAB_SESSION.marginTargets[1] ?? 65);
  setVal('labMargin2', LAB_SESSION.marginTargets[2] ?? 75);

  // Mode buttons
  const mode = LAB_SESSION.recipeMode || 'batch';
  document.getElementById('labModeBatch')?.classList.toggle('lab-mode-active', mode === 'batch');
  document.getElementById('labModeUnit')?.classList.toggle('lab-mode-active', mode !== 'batch');
  const bsField = document.getElementById('labBatchSizeField');
  if (bsField) bsField.style.display = mode === 'batch' ? '' : 'none';

  // Category select
  _updateLabCategorySelect();

  // Packaging toggle
  const pkgToggle = document.getElementById('labPackagingToggle');
  if (pkgToggle) {
    pkgToggle.checked = !!LAB_SESSION.packagingEnabled;
    pkgToggle.onchange = function() {
      LAB_SESSION.packagingEnabled = this.checked;
      const sec = document.getElementById('labPackagingSection');
      if (sec) sec.style.display = this.checked ? 'block' : 'none';
      _renderLabPackagingRows();
      _labRefreshCalcs();
    };
  }
  const pkgSec = document.getElementById('labPackagingSection');
  if (pkgSec) pkgSec.style.display = LAB_SESSION.packagingEnabled ? 'block' : 'none';

  // Waste input live wire
  const wasteInp = document.getElementById('labWasteInput');
  if (wasteInp) {
    wasteInp.value = LAB_SESSION.wastePercent || 0;
    wasteInp.oninput = function() {
      LAB_SESSION.wastePercent = Math.min(50, Math.max(0, Number(this.value || 0)));
      _labRefreshDebounced();
    };
  }

  // Draft label
  const label = document.getElementById('labCurrentDraftLabel');
  if (label) label.textContent = LAB_SESSION.name || 'New Session';

  // Render everything
  _renderLabIngredientRows();
  _renderLabPackagingRows();
  _updateCostDisplay();
  _updateScenarios();
}

/* ── clearLabSession ── */
function clearLabSession() {
  if (LAB_SESSION && !confirm('Clear current session? Unsaved changes will be lost.')) return;
  LAB_SESSION = null;
  renderLabView();
}

/* ── Exports ── */
window.getLabCategoryPresets       = getLabCategoryPresets;
window._renderLabIngredientRows    = _renderLabIngredientRows;
window.openLabIngPickerModal       = openLabIngPickerModal;
window._renderLabIngPickerList     = _renderLabIngPickerList;
window._renderLabPackagingRows     = _renderLabPackagingRows;
window._labRefreshDebounced        = _labRefreshDebounced;
window._labRefreshCalcs            = _labRefreshCalcs;
window.saveLabCategoryPreset       = saveLabCategoryPreset;
window.deleteLabCategoryPreset     = deleteLabCategoryPreset;
window.openLabPresetModal          = openLabPresetModal;
window.saveLabPresetFromForm       = saveLabPresetFromForm;
window.renderLabPresetsList        = renderLabPresetsList;
window.startNewLabSession          = startNewLabSession;
window.applyLabPreset              = applyLabPreset;
window.addLabIngredientFromCatalog = addLabIngredientFromCatalog;
window.addLabTempIngredient        = addLabTempIngredient;
window.addLabPackagingItem         = addLabPackagingItem;
window.renderLabView               = renderLabView;
window.saveLabDraft                = saveLabDraft;
window.loadLabDraft                = loadLabDraft;
window.deleteLabDraft              = deleteLabDraft;
window.openLabConvertModal         = openLabConvertModal;
window.confirmLabConvert           = confirmLabConvert;
window.labCalcViabilityScore       = labCalcViabilityScore;
window.labCalcScenarios            = labCalcScenarios;
window.clearLabSession             = clearLabSession;
window.toggleLabDraftDropdown      = toggleLabDraftDropdown;
window.adjustBatchSize             = adjustBatchSize;
window.setBatchSize                = setBatchSize;
window.setLabMode                  = setLabMode;
window.setLabMargin                = setLabMargin;
window.LAB_SESSION                 = null;
