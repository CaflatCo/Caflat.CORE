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

/* ── Debounce helper for keyboard-friendly inputs ── */
function _labDebounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
const _labRefreshDebounced = _labDebounce(() => {
  // Only refresh calculations — never re-render ingredient rows
  // Re-rendering rows destroys the focused input and kills the keyboard
  if (typeof renderLabPricing          === 'function') renderLabPricing();
  if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
  if (typeof renderLabCharts           === 'function') renderLabCharts();
}, 500);

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

  renderLabRecipeBuilder();
  _renderInlineDraftsList();
  renderLabPricing();
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

/* ═══════════════════════════════════════════════════════
   SECTION 1 — RECIPE BUILDER RENDER
═══════════════════════════════════════════════════════ */

function renderLabRecipeBuilder() {
  _renderLabIngredientRows();
  _renderLabPackagingRows();
  _updateLabCategorySelect();
  _syncBatchSizeInput();
  _updateLabIngCatalogDropdown();
  _syncRecipeModeToggle();
}

function _syncRecipeModeToggle() {
  const toggle = document.getElementById('labRecipeModeToggle');
  if (toggle && LAB_SESSION) toggle.value = LAB_SESSION.recipeMode || 'batch';
  // Update qty labels
  const label = LAB_SESSION?.recipeMode === 'batch' ? 'Qty/batch' : 'Qty/unit';
  document.querySelectorAll('[id^="labQtyLabel_"]').forEach(el => {
    el.textContent = label;
  });
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
      style="padding:12px 14px;border:1.5px solid var(--gray-200);
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

function _updateLabIngCatalogDropdown() {
  // No-op — replaced by openLabIngPickerModal
}

function _updateLabCategorySelect() {
  const sel = document.getElementById('labCategorySelect');
  if (!sel || !LAB_SESSION) return;
  const cats = (APP_STATE.categories || []).map(c => typeof c === 'object' ? c.name : c);
  sel.innerHTML = `<option value="">Select Category</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}"
      ${LAB_SESSION.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function _syncBatchSizeInput() {
  const inp = document.getElementById('labBatchSize');
  if (!inp || !LAB_SESSION) return;
  // Never overwrite while user is editing (works on iOS Safari too)
  if (inp.dataset.userEditing === '1') return;
  if (document.activeElement === inp) return;
  // Sync only if value differs from state
  const stateVal = LAB_SESSION.batchSize || 1;
  inp.value = stateVal > 1 ? String(stateVal) : '';
  inp.placeholder = 'e.g. 24';
}

function _renderLabIngredientRows() {
  const container = document.getElementById('labIngredientRows');
  if (!container || !LAB_SESSION) return;
  container.innerHTML = '';

  if (!LAB_SESSION.ingredients.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--gray-400);padding:12px 0 8px;">' +
      'No ingredients yet — add from catalog or use a temp ingredient.</div>';
    return;
  }

  const isBatch  = LAB_SESSION.recipeMode === 'batch';
  const batch    = Math.max(1, LAB_SESSION.batchSize || 1);
  const qtyLabel = isBatch ? 'per batch' : 'per unit';

  LAB_SESSION.ingredients.forEach((ing, idx) => {
    // Cost per cookie = lineCost / batchSize (if batch mode)
    const rawQty   = Number(ing.qty || 0);
    const cpUnit   = Number(ing.costPerUnit || 0);
    const lineCost = rawQty * cpUnit;                     // total for the qty entered
    const perCookie= isBatch ? lineCost / batch : lineCost; // cost per single unit

    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:0;margin-bottom:1px;' +
      'border:1.5px solid var(--gray-200);border-radius:12px;' +
      'background:var(--white);overflow:hidden;';
    row.dataset.idx = idx;

    // ── Name column ──
    const nameCol = '<div style="flex:0 0 180px;padding:12px 14px;border-right:1px solid var(--gray-100);">' +
      (ing.isTemp ? '<span style="font-size:8px;font-weight:800;letter-spacing:1px;padding:1px 6px;' +
        'border-radius:999px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;margin-right:6px;">TEMP</span>' : '') +
      '<div style="font-size:13px;font-weight:800;">' + escapeHtml(ing.name) + '</div>' +
      '<div style="font-size:10px;color:var(--gray-400);margin-top:1px;">' + escapeHtml(ing.unit || '') + '</div>' +
    '</div>';

    // ── Quantity column ──
    const qtyCol =
      '<div style="flex:0 0 140px;padding:8px 12px;border-right:1px solid var(--gray-100);">' +
        '<div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;' +
          'color:var(--gray-400);margin-bottom:4px;">Qty <span style="font-weight:400;text-transform:none;">' + qtyLabel + '</span></div>' +
        '<input type="number" value="' + (ing.qty || '') + '" min="0" step="0.01" placeholder="0" ' +
          'id="labQtyInput_' + idx + '" ' +
          'style="width:100%;padding:5px 8px;border:1.5px solid var(--gray-200);border-radius:8px;' +
            'font-size:14px;font-weight:700;font-family:var(--font-main);" ' +
          'oninput="LAB_SESSION.ingredients[' + idx + '].qty=Number(this.value||0);_labRefreshDebounced();" />' +
      '</div>';

    // ── Cost/unit column (read-only if from catalog, editable if temp) ──
    const costEditable = ing.isTemp;
    const cpuDisplay   = cpUnit > 0 ? '₱' + cpUnit.toFixed(4) : '—';
    const costCol =
      '<div style="flex:0 0 130px;padding:8px 12px;border-right:1px solid var(--gray-100);">' +
        '<div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;' +
          'color:var(--gray-400);margin-bottom:4px;">₱ / unit</div>' +
        (costEditable
          ? '<input type="number" value="' + (cpUnit || '') + '" min="0" step="0.001" placeholder="0.000" ' +
              'style="width:100%;padding:5px 8px;border:1.5px solid var(--gray-200);border-radius:8px;' +
                'font-size:13px;font-family:var(--font-main);" ' +
              'oninput="LAB_SESSION.ingredients[' + idx + '].costPerUnit=Number(this.value||0);_labRefreshDebounced();" />'
          : '<div style="font-size:13px;font-weight:700;padding:5px 0;color:var(--gray-600);">' + cpuDisplay + '</div>') +
      '</div>';

    // ── Cost per cookie column (computed) ──
    const perUnitLabel = isBatch ? 'per cookie' : 'line cost';
    const costPerCol =
      '<div style="flex:1;padding:8px 12px;border-right:1px solid var(--gray-100);">' +
        '<div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;' +
          'color:var(--gray-400);margin-bottom:4px;">' + perUnitLabel + '</div>' +
        '<div class="lab-line-cost" style="font-size:16px;font-weight:900;' +
          'font-variant-numeric:tabular-nums;color:' + (perCookie > 0 ? 'var(--black)' : 'var(--gray-300)') + ';">' +
          formatCurrency(perCookie) +
        '</div>' +
      '</div>';

    // ── Remove button ──
    const removeBtn =
      '<button type="button" class="lab-remove-ing" data-idx="' + idx + '" ' +
        'style="flex:0 0 44px;align-self:stretch;background:none;border:none;' +
        'cursor:pointer;font-size:16px;color:var(--gray-300);font-family:var(--font-main);">✕</button>';

    row.innerHTML = nameCol + qtyCol + costCol + costPerCol + removeBtn;
    container.appendChild(row);
  });

  // Total row
  if (LAB_SESSION.ingredients.length > 0) {
    const totalPerCookie = LAB_SESSION.ingredients.reduce((sum, ing) => {
      const raw = Number(ing.qty||0) * Number(ing.costPerUnit||0);
      return sum + (isBatch ? raw / batch : raw);
    }, 0);
    const totalRow = document.createElement('div');
    totalRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;' +
      'padding:10px 14px;margin-top:4px;border-top:2px solid var(--black);';
    totalRow.innerHTML =
      '<span style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">' +
        'Ingredient cost per ' + (isBatch ? 'cookie' : 'unit') +
      '</span>' +
      '<span style="font-size:18px;font-weight:900;font-variant-numeric:tabular-nums;">' +
        formatCurrency(totalPerCookie) +
      '</span>';
    container.appendChild(totalRow);
  }

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
      <input type="text" placeholder="e.g. Cookie Box"
        value="${escapeHtml(pkg.name)}"
        style="flex:2;padding:7px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
        oninput="LAB_SESSION.packaging[${idx}].name=this.value;" />
      <input type="number" placeholder="Cost ₱"
        value="${pkg.cost}" min="0" step="0.01"
        style="width:110px;padding:7px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
        oninput="LAB_SESSION.packaging[${idx}].cost=Number(this.value||0);_refreshLabCalcs();" />
      <button type="button" class="btn btn-sm btn-secondary"
        onclick="LAB_SESSION.packaging.splice(${idx},1);_renderLabPackagingRows();_refreshLabCalcs();">
        ✕</button>`;
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
    const scarColor = ing.scarcity==='hard'     ? '#dc2626'
                    : ing.scarcity==='seasonal'  ? '#ea580c' : '#16a34a';
    const scarLabel = ing.scarcity==='hard'     ? 'Hard to Source'
                    : ing.scarcity==='seasonal'  ? 'Seasonal' : 'Common';
    const qty = LAB_SESSION.recipeMode === 'batch'
      ? Number(ing.qty||0) / Math.max(1, batchSize)
      : Number(ing.qty||0);
    const batchTotal = qty * batchSize;

    return `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr;
        gap:10px;align-items:center;padding:10px 12px;
        border-bottom:1px solid var(--gray-100);font-size:12px;">
        <div>
          <div style="font-weight:700;">${escapeHtml(ing.name)}</div>
          <div style="font-size:10px;color:var(--gray-400);">
            ${ing.isTemp ? 'Temporary' : ing.unit}
          </div>
        </div>
        <div style="text-align:center;">
          <span style="font-size:9px;font-weight:800;letter-spacing:1px;
            text-transform:uppercase;padding:2px 8px;border-radius:999px;
            background:${scarColor}20;color:${scarColor};">
            ${scarLabel}
          </span>
        </div>
        <div style="text-align:right;color:var(--gray-500);font-size:11px;">
          ${batchTotal.toFixed(2)} ${ing.unit} per batch
        </div>
      </div>`;
  }).join('');

  // Overall risk
  const hardCount   = ings.filter(i => i.scarcity === 'hard').length;
  const seasonCount = ings.filter(i => i.scarcity === 'seasonal').length;
  const tempCount   = ings.filter(i => i.isTemp).length;

  const riskLevel = hardCount > 0 ? 'HIGH'
                  : (seasonCount > 0 || tempCount > 1) ? 'MEDIUM'
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
          ${tempCount} temporary ingredient${tempCount!==1?'s':''}
        </div>
      </div>
      <span style="font-size:16px;font-weight:900;color:${riskColor};">${riskLevel}</span>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;
      gap:10px;padding:8px 12px;background:var(--black);border-radius:var(--radius-md)
        var(--radius-md) 0 0;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);">Ingredient</div>
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);text-align:center;">
        Availability Risk</div>
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:rgba(255,255,255,.7);text-align:right;">
        Qty per Batch</div>
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
  _renderInlineDraftsList();
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

function renderLabDraftsList() {
  const container = document.getElementById('labDraftsList');
  if (!container) return;
  const drafts = APP_STATE.labDrafts || [];
  if (!drafts.length) {
    container.innerHTML = `<div class="cost-preview-empty">No saved drafts yet</div>`;
    return;
  }
  container.innerHTML = drafts.slice().reverse().map(d => _draftCard(d)).join('');
}

function _renderInlineDraftsList() {
  // Renders the drafts list inside the active session view (labInlineDraftsList)
  const container = document.getElementById('labInlineDraftsList');
  if (!container) return;
  const drafts = APP_STATE.labDrafts || [];
  if (!drafts.length) {
    container.innerHTML = `<div class="cost-preview-empty" style="font-size:11px;">No drafts yet</div>`;
    return;
  }
  container.innerHTML = drafts.slice().reverse().map(d => _draftCard(d)).join('');
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
  // Do NOT re-render ingredient rows here — that kills keyboard focus
  // Only update calculated outputs
  renderLabPricing();
  renderLabSupplyAssessment();
  renderLabCharts();
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
  _renderInlineDraftsList();
  renderLabPricing();
  renderLabSupplyAssessment();
  renderLabChartSelector();
  renderLabCharts();

  // Set name field
  setElementValue('labDraftName', LAB_SESSION.name || '');

  // Packaging toggle — wire direct handler every render
  const pkgSection = document.getElementById('labPackagingSection');
  if (pkgSection) pkgSection.style.display = LAB_SESSION.packagingEnabled ? 'block' : 'none';
  const pkgToggle = document.getElementById('labPackagingToggle');
  if (pkgToggle) {
    pkgToggle.checked = LAB_SESSION.packagingEnabled;
    pkgToggle.onchange = function() {
      LAB_SESSION.packagingEnabled = this.checked;
      const sec = document.getElementById('labPackagingSection');
      if (sec) sec.style.display = this.checked ? 'block' : 'none';
      _renderLabPackagingRows();
      if (typeof renderLabPricing          === 'function') renderLabPricing();
      if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
      if (typeof renderLabCharts           === 'function') renderLabCharts();
    };
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

  // Waste slider — set value and wire direct handlers
  const wasteSlider = document.getElementById('labWasteSlider');
  if (wasteSlider) {
    wasteSlider.value = LAB_SESSION.wastePercent;
    wasteSlider.oninput = function() {
      LAB_SESSION.wastePercent = Number(this.value || 0);
      const d = document.getElementById('labWasteDisplay');
      if (d) d.textContent = this.value + '%';
      if (typeof renderLabPricing === 'function') renderLabPricing();
      if (typeof renderLabCharts  === 'function') renderLabCharts();
    };
    wasteSlider.onchange = wasteSlider.oninput; // iOS Safari
  }
  const wasteDisp = document.getElementById('labWasteDisplay');
  if (wasteDisp) wasteDisp.textContent = LAB_SESSION.wastePercent + '%';
}

/* ── Exports ── */
window.getLabCategoryPresets    = getLabCategoryPresets;
window._renderLabIngredientRows  = _renderLabIngredientRows;
window.openLabIngPickerModal     = openLabIngPickerModal;
window._renderLabIngPickerList   = _renderLabIngPickerList;
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
window._renderInlineDraftsList  = _renderInlineDraftsList;
window.openLabConvertModal      = openLabConvertModal;
window.confirmLabConvert        = confirmLabConvert;
window.labCalcViabilityScore    = labCalcViabilityScore;
window.labCalcScenarios         = labCalcScenarios;
window.LAB_SESSION              = null;

function clearLabSession() {
  LAB_SESSION = null;
  renderLabView();
}
window.clearLabSession = clearLabSession;
