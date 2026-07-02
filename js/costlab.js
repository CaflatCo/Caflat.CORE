/* ═══════════════════════════════════════════════════════
   COSTLAB.JS — Cost & Profitability Lab
   Calculates ingredient, packaging, labor, overhead costs.
   Auto-snapshots products daily. Per-product overrides.
═══════════════════════════════════════════════════════ */

/* ─── Core calculation ─── */
function calcProductCost(product, overrides = {}) {
  const ingredients = APP_STATE.ingredients || [];
  const yield_ = product.recipeMode === 'batch' ? Math.max(1, product.batchYield || 1) : 1;

  let ingCost = 0;
  (product.recipe || []).forEach(line => {
    const ing = ingredients.find(i => String(i.id) === String(line.ingredientId));
    if (!ing || !line.quantity) return;
    const perUnit = product.recipeMode === 'batch' ? line.quantity / yield_ : line.quantity;
    ingCost += perUnit * Number(ing.costPerUnit || 0);
  });

  const packCost = (product.packagingItems || []).reduce((s, p) => s + Number(p.cost || 0), 0);

  const globalSettings   = APP_STATE.costLabSettings || {};
  const productOverrides = APP_STATE.costLabOverrides?.[product.id] || {};
  const laborCost    = Number(overrides.laborCostPerUnit    ?? productOverrides.laborCostPerUnit    ?? globalSettings.laborCostPerUnit    ?? 0);
  const overheadCost = Number(overrides.overheadCostPerUnit ?? productOverrides.overheadCostPerUnit ?? globalSettings.overheadCostPerUnit ?? 0);

  const totalCost = ingCost + packCost + laborCost + overheadCost;
  const price     = Number(product.price || 0);
  const profit    = price - totalCost;
  const margin    = price > 0 ? (profit / price * 100) : 0;

  return { ingCost, packCost, laborCost, overheadCost, totalCost, price, profit, margin, yield_ };
}

/* ─── Daily auto-snapshot ─── */
function _autoSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const history = APP_STATE.costHistory || [];
  const todaysIds = new Set(history.filter(h => h.date === today).map(h => h.productId));

  const newEntries = (APP_STATE.products || [])
    .filter(p => !todaysIds.has(p.id) && ((p.recipe?.length > 0) || (p.packagingItems?.length > 0)))
    .map(p => {
      const { totalCost, margin, price } = calcProductCost(p);
      return { date: today, productId: p.id, productName: p.name, totalCost, margin, price };
    });

  if (!newEntries.length) return;

  let updated = [...history, ...newEntries];
  if (updated.length > 365) updated = updated.slice(-365);
  updateState('costHistory', () => updated);
}

/* ─── Margin badge pill ─── */
function _marginBadge(margin) {
  const target = Number(APP_STATE.costLabSettings?.targetMargin ?? 60);
  if (margin < 0)
    return `<span class="cl-badge cl-badge-loss">LOSS</span>`;
  if (margin >= target)
    return `<span class="cl-badge cl-badge-green">${margin.toFixed(1)}%</span>`;
  if (margin >= target - 10)
    return `<span class="cl-badge cl-badge-amber">${margin.toFixed(1)}%</span>`;
  return `<span class="cl-badge cl-badge-red">${margin.toFixed(1)}%</span>`;
}

/* ─── Status text ─── */
function _marginStatus(margin) {
  const target = Number(APP_STATE.costLabSettings?.targetMargin ?? 60);
  if (margin < 0)            return { label: 'LOSS',     color: '#dc2626' };
  if (margin >= target)      return { label: 'Healthy',  color: '#15803d' };
  if (margin >= target - 10) return { label: 'Low',      color: '#c2410c' };
  return                            { label: 'Critical', color: '#dc2626' };
}

/* ─── Stat cards ─── */
function _renderCLStats(products, costs) {
  if (!products.length) {
    return `<div class="cl-empty-stats">
      No products with recipes yet — add ingredients to products to see cost analysis.</div>`;
  }

  const target = Number(APP_STATE.costLabSettings?.targetMargin ?? 60);
  const sorted = [...costs].sort((a, b) => b.margin - a.margin);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const avgMargin = costs.reduce((s, c) => s + c.margin, 0) / costs.length;
  const mostProfitable = [...costs].sort((a, b) => b.profit - a.profit)[0];
  const needRepricing = costs.filter(c => c.margin < target).length;

  return `<div class="cl-stats-grid">
    <div class="stat-card">
      <div class="label">Best Margin</div>
      <div class="value">${best.margin.toFixed(1)}%</div>
      <div class="sub">${escapeHtml(best.name)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Worst Margin</div>
      <div class="value">${worst.margin.toFixed(1)}%</div>
      <div class="sub">${escapeHtml(worst.name)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Avg Margin</div>
      <div class="value">${avgMargin.toFixed(1)}%</div>
      <div class="sub">${costs.length} product${costs.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="stat-card">
      <div class="label">Most Profitable</div>
      <div class="value">${formatCurrency(mostProfitable.profit)}</div>
      <div class="sub">${escapeHtml(mostProfitable.name)}</div>
    </div>
    <div class="stat-card${needRepricing > 0 ? ' dark' : ''}">
      <div class="label">Need Repricing</div>
      <div class="value">${needRepricing}</div>
      <div class="sub">${needRepricing > 0 ? `below ${target}% target` : 'All on target'}</div>
    </div>
  </div>`;
}

/* ─── Product table ─── */
function _renderCLTable(products, costs) {
  if (!products.length) {
    return `<div style="padding:40px;text-align:center;color:var(--gray-400);font-size:12px;">
      No products match your search.</div>`;
  }

  const rows = products.map((p, idx) => {
    const c = costs[idx];
    const status = _marginStatus(c.margin);
    const lossStyle = c.margin < 0 ? 'border-left:3px solid #dc2626;' : '';

    return `
      <tr class="cl-product-row" style="${lossStyle}" onclick="toggleCostDetail('${p.id}')">
        <td style="font-weight:700;">${escapeHtml(p.name)}</td>
        <td class="num">${formatCurrency(c.ingCost)}</td>
        <td class="num">${formatCurrency(c.packCost)}</td>
        <td class="num">${formatCurrency(c.laborCost + c.overheadCost)}</td>
        <td class="num" style="font-weight:800;">${formatCurrency(c.totalCost)}</td>
        <td class="num">${formatCurrency(c.price)}</td>
        <td class="num" style="color:${c.profit >= 0 ? 'inherit' : '#dc2626'};font-weight:700;">${formatCurrency(c.profit)}</td>
        <td>${_marginBadge(c.margin)}</td>
        <td style="font-size:11px;font-weight:700;color:${status.color};">${status.label}</td>
        <td class="cl-chevron" id="cl-arrow-${p.id}">›</td>
      </tr>
      <tr id="cl-detail-${p.id}" style="display:none;">
        <td colspan="10" style="padding:0;background:var(--gray-50);">
          <div id="cl-detail-inner-${p.id}" style="padding:20px 24px;"></div>
        </td>
      </tr>`;
  }).join('');

  return `<table class="data-table cl-table">
    <thead>
      <tr>
        <th>Product</th>
        <th>Recipe</th>
        <th>Packaging</th>
        <th>Labor + OH</th>
        <th>Total Cost</th>
        <th>Price</th>
        <th>Profit/Unit</th>
        <th>Margin</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ─── Cost history mini bar chart ─── */
function _renderHistoryBars(productId) {
  const history = (APP_STATE.costHistory || [])
    .filter(h => h.productId === productId)
    .slice(-6);

  if (history.length < 2) {
    return `<div style="font-size:11px;color:var(--gray-400);padding:6px 0;">
      Revisit tomorrow to start tracking cost changes over time.</div>`;
  }

  const maxCost = Math.max(...history.map(h => h.totalCost));

  const bars = history.map(h => {
    const pct = maxCost > 0 ? Math.max(8, Math.round((h.totalCost / maxCost) * 100)) : 8;
    const label = h.date.slice(5);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
      <div style="width:100%;max-width:36px;background:var(--gray-200);border-radius:3px 3px 0 0;
        height:56px;display:flex;align-items:flex-end;overflow:hidden;">
        <div style="width:100%;height:${pct}%;background:#065f46;border-radius:3px 3px 0 0;min-height:4px;"></div>
      </div>
      <div style="font-size:9px;font-weight:700;color:var(--gray-400);">${label}</div>
      <div style="font-size:9px;font-weight:800;color:var(--gray-600);">${formatCurrency(h.totalCost)}</div>
    </div>`;
  }).join('');

  return `<div style="display:flex;gap:6px;align-items:flex-end;">${bars}</div>`;
}

/* ─── Toggle inline detail ─── */
let _clOpenId = null;

function toggleCostDetail(productId) {
  const row   = document.getElementById(`cl-detail-${productId}`);
  const arrow = document.getElementById(`cl-arrow-${productId}`);
  if (!row) return;

  const isOpen = row.style.display !== 'none';

  if (_clOpenId && _clOpenId !== productId) {
    const prev      = document.getElementById(`cl-detail-${_clOpenId}`);
    const prevArrow = document.getElementById(`cl-arrow-${_clOpenId}`);
    if (prev)      prev.style.display = 'none';
    if (prevArrow) prevArrow.textContent = '›';
  }

  if (isOpen) {
    row.style.display = 'none';
    if (arrow) arrow.textContent = '›';
    _clOpenId = null;
  } else {
    row.style.display = '';
    if (arrow) arrow.textContent = '⌄';
    _clOpenId = productId;
    _renderCLDetail(productId);
  }
}

/* ─── Inline detail content ─── */
function _renderCLDetail(productId) {
  const container = document.getElementById(`cl-detail-inner-${productId}`);
  if (!container) return;

  const product = (APP_STATE.products || []).find(p => p.id === productId);
  if (!product) return;

  const productOverride = APP_STATE.costLabOverrides?.[productId] || {};
  const globalSettings  = APP_STATE.costLabSettings || {};
  const c = calcProductCost(product);
  const ingredients = APP_STATE.ingredients || [];

  const ingLines = (product.recipe || []).map(line => {
    const ing = ingredients.find(i => String(i.id) === String(line.ingredientId));
    if (!ing) return '';
    const perUnit = product.recipeMode === 'batch'
      ? line.quantity / Math.max(1, product.batchYield || 1)
      : line.quantity;
    const lineCost = perUnit * Number(ing.costPerUnit || 0);
    return `<div class="cl-breakdown-row">
      <span>${escapeHtml(ing.name)}</span>
      <span>${perUnit.toFixed(4)} × ${formatCurrency(Number(ing.costPerUnit || 0))} = <strong>${formatCurrency(lineCost)}</strong></span>
    </div>`;
  }).filter(Boolean).join('');

  const packLines = (product.packagingItems || []).map(pk => `
    <div class="cl-breakdown-row">
      <span>${escapeHtml(pk.name || 'Packaging')}</span>
      <span><strong>${formatCurrency(Number(pk.cost || 0))}</strong></span>
    </div>`).join('');

  const laborDefault    = productOverride.laborCostPerUnit    ?? globalSettings.laborCostPerUnit    ?? 0;
  const overheadDefault = productOverride.overheadCostPerUnit ?? globalSettings.overheadCostPerUnit ?? 0;
  const hasOverride     = productOverride.laborCostPerUnit !== undefined || productOverride.overheadCostPerUnit !== undefined;

  container.innerHTML = `
    <div class="cl-detail-grid">

      <!-- LEFT: Cost Breakdown -->
      <div>
        <div class="cl-section-label">Cost Breakdown</div>

        <div class="cl-breakdown-list">
          ${ingLines || `<div style="font-size:11px;color:var(--gray-400);padding:6px 0;">No recipe ingredients linked</div>`}
          ${packLines}
          <div class="cl-breakdown-row">
            <span>Labor</span>
            <span><strong>${formatCurrency(c.laborCost)}</strong></span>
          </div>
          <div class="cl-breakdown-row">
            <span>Overhead</span>
            <span><strong>${formatCurrency(c.overheadCost)}</strong></span>
          </div>
        </div>

        <div class="cl-summary-box">
          <div class="cl-summary-row">
            <span>Total Cost</span>
            <strong style="font-size:13px;">${formatCurrency(c.totalCost)}</strong>
          </div>
          <div class="cl-summary-row">
            <span>Selling Price</span>
            <strong>${formatCurrency(c.price)}</strong>
          </div>
          <div class="cl-summary-row cl-summary-divider">
            <span>Profit / Unit</span>
            <strong style="color:${c.profit >= 0 ? '#15803d' : '#dc2626'};">${formatCurrency(c.profit)}</strong>
          </div>
          <div class="cl-summary-row">
            <span>Margin</span>
            <span>${_marginBadge(c.margin)}</span>
          </div>
        </div>

        <!-- Cost History -->
        <div style="margin-top:16px;">
          <div class="cl-section-label" style="margin-bottom:6px;">Cost History (last 6)</div>
          ${_renderHistoryBars(productId)}
        </div>
      </div>

      <!-- RIGHT: Simulator + Overrides -->
      <div>
        <div class="cl-section-label">Price Simulator</div>

        <div class="cl-panel-box" style="margin-bottom:14px;">
          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:10px;font-weight:800;">Selling Price</label>
            <input type="number" min="0" step="0.01"
              id="clSimPrice-${productId}" value="${c.price}"
              oninput="clSimulate('price','${productId}')"
              class="cl-sim-input" />
            <div id="clSimPriceResult-${productId}" class="cl-sim-result"></div>
          </div>

          <div class="form-group" style="margin-bottom:10px;">
            <label style="font-size:10px;font-weight:800;">Target Margin %</label>
            <input type="number" min="0" max="100" step="1"
              id="clSimMargin-${productId}" value="${Number(globalSettings.targetMargin ?? 60)}"
              oninput="clSimulate('margin','${productId}')"
              class="cl-sim-input" />
            <div id="clSimMarginResult-${productId}" class="cl-sim-result"></div>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:10px;font-weight:800;">Yield Adjuster (units)</label>
            <input type="number" min="1" step="1"
              id="clSimYield-${productId}" value="${c.yield_}"
              oninput="clSimulate('yield','${productId}')"
              class="cl-sim-input" />
            <div id="clSimYieldResult-${productId}" class="cl-sim-result"></div>
          </div>
        </div>

        <div class="cl-section-label">Per-Product Overrides</div>

        <div class="cl-panel-box">
          <div style="font-size:11px;color:var(--gray-400);margin-bottom:10px;">
            Override global labor &amp; overhead for this product only.
          </div>

          <div class="form-group" style="margin-bottom:8px;">
            <label style="font-size:10px;font-weight:800;">Labor ${getCurrencySymbol()}/unit</label>
            <input type="number" min="0" step="0.01"
              id="clOvrLabor-${productId}"
              placeholder="${laborDefault > 0 ? laborDefault : 'Global default'}"
              value="${productOverride.laborCostPerUnit ?? ''}"
              class="cl-sim-input" />
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label style="font-size:10px;font-weight:800;">Overhead ${getCurrencySymbol()}/unit</label>
            <input type="number" min="0" step="0.01"
              id="clOvrOverhead-${productId}"
              placeholder="${overheadDefault > 0 ? overheadDefault : 'Global default'}"
              value="${productOverride.overheadCostPerUnit ?? ''}"
              class="cl-sim-input" />
          </div>

          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-sm" type="button"
              onclick="saveCostLabOverrides('${productId}')">Save Overrides</button>
            ${hasOverride ? `<button class="btn btn-sm btn-secondary" type="button"
              onclick="clearCostLabOverrides('${productId}')">Clear</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

/* ─── Price Simulator ─── */
function clSimulate(type, productId) {
  const product = (APP_STATE.products || []).find(p => p.id === productId);
  if (!product) return;

  const c = calcProductCost(product);

  if (type === 'price') {
    const newPrice  = Number(document.getElementById(`clSimPrice-${productId}`)?.value || 0);
    const newProfit = newPrice - c.totalCost;
    const newMargin = newPrice > 0 ? (newProfit / newPrice * 100) : 0;
    const el = document.getElementById(`clSimPriceResult-${productId}`);
    if (el) el.innerHTML = `Profit: <strong>${formatCurrency(newProfit)}</strong>&nbsp;&nbsp;Margin: ${_marginBadge(newMargin)}`;
  }

  if (type === 'margin') {
    const targetM = Number(document.getElementById(`clSimMargin-${productId}`)?.value || 0);
    const el = document.getElementById(`clSimMarginResult-${productId}`);
    if (el) {
      if (targetM >= 100) {
        el.innerHTML = `<span style="color:var(--gray-400);">100% margin is not achievable</span>`;
      } else if (targetM < 0) {
        el.innerHTML = `<span style="color:var(--gray-400);">Enter a value between 0–99%</span>`;
      } else {
        const suggestedPrice = c.totalCost / (1 - targetM / 100);
        el.innerHTML = `Suggested price: <strong>${formatCurrency(suggestedPrice)}</strong>`;
      }
    }
  }

  if (type === 'yield') {
    const newYield  = Math.max(1, Number(document.getElementById(`clSimYield-${productId}`)?.value || 1));
    const ingredients = APP_STATE.ingredients || [];
    let ingCostRaw = 0;
    (product.recipe || []).forEach(line => {
      const ing = ingredients.find(i => String(i.id) === String(line.ingredientId));
      if (!ing || !line.quantity) return;
      ingCostRaw += line.quantity * Number(ing.costPerUnit || 0);
    });
    const adjIngCost = product.recipeMode === 'batch' ? ingCostRaw / newYield : ingCostRaw;
    const adjTotal   = adjIngCost + c.packCost + c.laborCost + c.overheadCost;
    const el = document.getElementById(`clSimYieldResult-${productId}`);
    if (el) el.innerHTML = `Adjusted cost/unit: <strong>${formatCurrency(adjTotal)}</strong>`;
  }
}

/* ─── Save per-product overrides ─── */
function saveCostLabOverrides(productId) {
  const laborEl    = document.getElementById(`clOvrLabor-${productId}`);
  const overheadEl = document.getElementById(`clOvrOverhead-${productId}`);
  const overrides  = { ...(APP_STATE.costLabOverrides || {}) };
  const entry      = {};

  if (laborEl?.value !== '')    entry.laborCostPerUnit    = Number(laborEl.value);
  if (overheadEl?.value !== '') entry.overheadCostPerUnit = Number(overheadEl.value);

  if (Object.keys(entry).length === 0) {
    showNotification('Enter at least one value to save', 'error');
    return;
  }

  overrides[productId] = entry;
  updateState('costLabOverrides', () => overrides);
  showNotification('Overrides saved', 'success');
  _renderCLDetail(productId);
  _softRefreshCLTable();
}

function clearCostLabOverrides(productId) {
  const overrides = { ...(APP_STATE.costLabOverrides || {}) };
  delete overrides[productId];
  updateState('costLabOverrides', () => overrides);
  showNotification('Overrides cleared', 'success');
  _renderCLDetail(productId);
  _softRefreshCLTable();
}

/* ─── Soft table refresh (re-renders costs without closing open detail) ─── */
function _softRefreshCLTable() {
  const products = _clFilteredProducts();
  const costs    = products.map(p => ({ ...calcProductCost(p), name: p.name, id: p.id }));
  const wrap     = document.getElementById('clTableWrap');
  if (!wrap) return;

  const reopenId = _clOpenId;
  wrap.innerHTML = _renderCLTable(products, costs);
  if (reopenId) {
    const row   = document.getElementById(`cl-detail-${reopenId}`);
    const arrow = document.getElementById(`cl-arrow-${reopenId}`);
    if (row) { row.style.display = ''; }
    if (arrow) { arrow.textContent = '⌄'; }
    _renderCLDetail(reopenId);
  }
}

/* ─── Settings modal ─── */
function openCostLabSettings() {
  const s  = APP_STATE.costLabSettings || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('clSettingsTargetMargin', s.targetMargin        ?? 60);
  set('clSettingsLabor',        s.laborCostPerUnit     ?? 0);
  set('clSettingsOverhead',     s.overheadCostPerUnit  ?? 0);
  openModal('clSettingsModal');
}

function saveCostLabSettings() {
  const n = id => Number(document.getElementById(id)?.value || 0);
  updateState('costLabSettings', () => ({
    targetMargin:        n('clSettingsTargetMargin'),
    laborCostPerUnit:    n('clSettingsLabor'),
    overheadCostPerUnit: n('clSettingsOverhead')
  }));
  closeModal('clSettingsModal');
  showNotification('Cost Lab settings saved', 'success');
  renderCostLab();
}

/* ─── Refresh only table + count (keeps search input focused) ─── */
function _clRefreshTable() {
  const products = _clFilteredProducts();
  const costs    = products.map(p => ({ ...calcProductCost(p), name: p.name, id: p.id }));

  const countEl = document.getElementById('clCount');
  if (countEl) countEl.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;

  _clOpenId = null;
  const wrap = document.getElementById('clTableWrap');
  if (wrap) wrap.innerHTML = _renderCLTable(products, costs);
}

/* ─── Get filtered products ─── */
function _clFilteredProducts() {
  const search    = document.getElementById('clSearch')?.value?.toLowerCase() || '';
  const catFilter = document.getElementById('clCatFilter')?.value || 'All';
  let products = (APP_STATE.products || []).filter(
    p => (p.recipe?.length > 0) || (p.packagingItems?.length > 0)
  );
  if (search) products = products.filter(p => p.name.toLowerCase().includes(search));
  if (catFilter !== 'All') {
    products = products.filter(p => {
      const cats = APP_STATE.categories || [];
      const match = cats.find(c => (typeof c === 'string' ? c : c.name) === catFilter);
      if (!match) return false;
      const catName = typeof match === 'string' ? match : match.name;
      return p.category === catName || String(p.categoryId) === String(match.id);
    });
  }
  return products;
}

/* ─── Main render ─── */
function renderCostLab() {
  const container = document.getElementById('clContainer');
  if (!container) return;

  _autoSnapshot();
  _clOpenId = null;

  const allProducts = (APP_STATE.products || []).filter(
    p => (p.recipe?.length > 0) || (p.packagingItems?.length > 0)
  );
  const allCosts = allProducts.map(p => ({ ...calcProductCost(p), name: p.name, id: p.id }));

  const cats      = (APP_STATE.categories || []).map(c => typeof c === 'string' ? c : c.name);
  const catOptions = ['All', ...cats].map(c =>
    `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  const filtered      = _clFilteredProducts();
  const filteredCosts = filtered.map(p => ({ ...calcProductCost(p), name: p.name, id: p.id }));

  container.innerHTML = `
    <div style="padding:20px 20px 0;">
      ${_renderCLStats(allProducts, allCosts)}
    </div>

    <div class="cl-filter-bar">
      <input id="clSearch" type="text" placeholder="Search products…"
        oninput="_clRefreshTable()"
        style="flex:1;min-width:160px;padding:8px 12px;border:1.5px solid var(--border);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);
          background:var(--white);color:var(--gray-900);" />
      <select id="clCatFilter" onchange="_clRefreshTable()"
        style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);background:var(--white);
          color:var(--gray-900);">${catOptions}</select>
      <span id="clCount" style="font-size:11px;color:var(--gray-400);white-space:nowrap;">
        ${filtered.length} product${filtered.length !== 1 ? 's' : ''}</span>
    </div>

    <div id="clTableWrap" style="overflow-x:auto;">
      ${_renderCLTable(filtered, filteredCosts)}
    </div>`;
}

/* ── Exports ── */
window.calcProductCost       = calcProductCost;
window.renderCostLab         = renderCostLab;
window._clRefreshTable       = _clRefreshTable;
window.openCostLabSettings   = openCostLabSettings;
window.saveCostLabSettings   = saveCostLabSettings;
window.saveCostLabOverrides  = saveCostLabOverrides;
window.clearCostLabOverrides = clearCostLabOverrides;
window.toggleCostDetail      = toggleCostDetail;
window.clSimulate            = clSimulate;
