/* ═══════════════════════════════════════════════════════
   SHOPPINGLIST.JS — Floating Shopping List Widget
   Three modes: Production Jobs | Low Stock | Free List
   Persists last 5 saved lists.
   Widget follows user across all views.
═══════════════════════════════════════════════════════ */

let _swMode      = 'lowstock';   // 'production' | 'lowstock' | 'free'
let _swOpen      = false;
let _swItems     = [];           // current list items
let _swFreeItems = [];           // free list manual items

/* ── Helpers ── */
function _getIngredients() { return APP_STATE.ingredients || []; }
function _getShoppingLists() { return Array.isArray(APP_STATE.shoppingLists) ? APP_STATE.shoppingLists : []; }

/* ════════════════════════════════════════════════════════
   WIDGET OPEN/CLOSE
════════════════════════════════════════════════════════ */

function toggleShoppingWidget() {
  _swOpen = !_swOpen;
  const panel = document.getElementById('shoppingWidgetPanel');
  const fab   = document.getElementById('shoppingWidgetFab');

  if (panel) {
    if (_swOpen) {
      panel.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      panel.classList.remove('active');
      if (!document.querySelector('.modal-overlay.active')) {
        document.body.style.overflow = '';
      }
    }
  }
  if (fab) fab.style.transform = _swOpen ? 'scale(0.92)' : 'scale(1)';

  if (_swOpen) {
    const hasActiveJobs = (APP_STATE.productionJobs || []).some(j =>
      ['PLANNED','IN_PROGRESS'].includes(j.status));
    if (!APP_STATE.settings?.productionModeEnabled || !hasActiveJobs) {
      _swMode = _swMode === 'production' ? 'lowstock' : _swMode;
    }
    _swGenerate();
    _swRenderTabBar();
    _swPopulateIngSelect();
  }
}

/* ════════════════════════════════════════════════════════
   MODE SWITCHING
════════════════════════════════════════════════════════ */

function switchWidgetMode(mode) {
  _swMode = mode;
  if (mode === 'free') {
    // Don't regenerate — keep free items as-is
  } else {
    _swGenerate();
  }
  _swRenderTabBar();
  _swRenderList();
  const addRow = document.getElementById('swFreeAddRow');
  if (addRow) addRow.style.display = mode === 'free' ? 'block' : 'none';
}

function _swRenderTabBar() {
  const tabs = { production: 'swTabProduction', lowstock: 'swTabLowstock', free: 'swTabFree' };
  Object.entries(tabs).forEach(([mode, id]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const active = mode === _swMode;
    btn.style.background = active ? 'var(--black)' : 'white';
    btn.style.color       = active ? 'white' : 'var(--gray-400)';
  });
  // Hide production tab if not enabled
  const prodTab = document.getElementById('swTabProduction');
  if (prodTab) prodTab.style.display = APP_STATE.settings?.productionModeEnabled ? 'block' : 'none';
}

/* ════════════════════════════════════════════════════════
   GENERATE LIST FROM MODE
════════════════════════════════════════════════════════ */

function _swGenerate() {
  if (_swMode === 'production') _swItems = _generateFromProduction();
  else if (_swMode === 'lowstock') _swItems = _generateFromLowStock();
  // free mode uses _swFreeItems directly
  _swRenderList();
}

function _generateFromProduction() {
  if (typeof getIngredientForecast !== 'function') return [];
  const forecast = getIngredientForecast();
  return forecast
    .filter(item => item.shortfall > 0)
    .map(item => {
      const ing     = _getIngredients().find(i => i.id === item.id) || {};
      const pkgQty  = Number(ing.packageQuantity || 0);
      const pkgCost = Number(ing.packageCost || 0);
      const hasPkgData = pkgQty > 1 && pkgCost > 0;
      const packs   = hasPkgData ? Math.max(1, Math.ceil(item.shortfall / pkgQty)) : null;
      return {
        id: item.id, name: item.name, unit: ing.unit || item.unit || '',
        shortfall: item.shortfall, onHand: item.onHand,
        pkgQty, pkgCost, hasPkgData,
        packs, totalCost: hasPkgData ? packs * pkgCost : 0,
        checked: false
      };
    });
}

function _generateFromLowStock() {
  return _getIngredients()
    .filter(ing => Number(ing.stock || 0) <= Number(ing.reorderLevel || 0))
    .map(ing => {
      const stock      = Number(ing.stock || 0);
      const reorder    = Number(ing.reorderLevel || 0);
      const pkgQty     = Number(ing.packageQuantity || 0);
      const pkgCost    = Number(ing.packageCost || 0);
      const hasPkgData = pkgQty > 1 && pkgCost > 0;
      const shortfall  = Math.max(reorder - stock, 0);
      const packs      = hasPkgData ? Math.max(1, Math.ceil(shortfall / pkgQty)) : null;
      return {
        id: ing.id, name: ing.name, unit: ing.unit || '',
        shortfall, onHand: stock, pkgQty, pkgCost, hasPkgData,
        packs, totalCost: hasPkgData ? packs * pkgCost : 0,
        checked: false
      };
    });
}

/* ════════════════════════════════════════════════════════
   FREE LIST
════════════════════════════════════════════════════════ */

function _swPopulateIngSelect() {
  const sel = document.getElementById('swIngSelect');
  if (!sel) return;
  const ings = _getIngredients();
  sel.innerHTML = '<option value="">Select ingredient…</option>' +
    ings.map(i => `<option value="${i.id}">${escapeHtml(i.name)} (${i.unit || ''})</option>`).join('');
}

function addFreeListItem() {
  const selEl = document.getElementById('swIngSelect');
  const qtyEl = document.getElementById('swIngQty');
  if (!selEl || !selEl.value) { showNotification('Select an ingredient', 'error'); return; }

  const ing     = _getIngredients().find(i => i.id === selEl.value);
  if (!ing) return;

  const qty     = Number(qtyEl?.value || 0);
  const pkgQty  = Number(ing.packageQuantity || 0);
  const pkgCost = Number(ing.packageCost || 0);
  const hasPkgData = pkgQty > 1 && pkgCost > 0;
  const packs   = hasPkgData && qty > 0 ? Math.max(1, Math.ceil(qty / pkgQty)) : null;

  const existing = _swFreeItems.find(i => i.id === ing.id);
  if (existing) {
    existing.shortfall = qty;
    existing.packs     = packs;
    existing.hasPkgData= hasPkgData;
    existing.totalCost = hasPkgData && packs ? packs * pkgCost : 0;
  } else {
    _swFreeItems.push({
      id: ing.id, name: ing.name, unit: ing.unit || '',
      shortfall: qty, onHand: Number(ing.stock || 0),
      pkgQty, pkgCost, hasPkgData,
      packs, totalCost: hasPkgData && packs ? packs * pkgCost : 0,
      checked: false, isFreeItem: true
    });
  }

  selEl.value = '';
  if (qtyEl) qtyEl.value = '';
  _swRenderList();
  _swUpdateBadge();
  showNotification(`${ing.name} added`, 'success');
}

function addCustomListItem() {
  const nameEl = document.getElementById('swCustomName');
  const qtyEl  = document.getElementById('swCustomQty');
  const unitEl = document.getElementById('swCustomUnit');
  const costEl = document.getElementById('swCustomCost');

  const name = (nameEl?.value || '').trim();
  if (!name) { showNotification('Enter an item name', 'error'); return; }

  const qty  = Number(qtyEl?.value || 0);
  const unit = (unitEl?.value || '').trim();
  const cost = Number(costEl?.value || 0);

  _swFreeItems.push({
    id: null, name, unit,
    shortfall: qty, onHand: 0,
    pkgQty: 0, pkgCost: cost, hasPkgData: cost > 0,
    packs: null, totalCost: cost,
    checked: false, isFreeItem: true, isCustom: true
  });

  if (nameEl) nameEl.value = '';
  if (qtyEl)  qtyEl.value  = '';
  if (unitEl) unitEl.value = '';
  if (costEl) costEl.value = '';
  _swRenderList();
  _swUpdateBadge();
  showNotification(`${name} added`, 'success');
}

/* ════════════════════════════════════════════════════════
   RENDER LIST
════════════════════════════════════════════════════════ */

function _swRenderList() {
  const container = document.getElementById('shoppingWidgetList');
  if (!container) return;

  const items = _swMode === 'free' ? _swFreeItems : _swItems;

  if (!items.length) {
    const emptyMsg = {
      production: 'No shortfalls in active production jobs',
      lowstock:   'All ingredients are above reorder level',
      free:       'Add ingredients above to start your list'
    }[_swMode];
    container.innerHTML = `<div style="font-size:12px;color:var(--gray-400);
      padding:16px 0;text-align:center;">${emptyMsg}</div>`;
    _swUpdateTotal(0);
    _swUpdateBadge();
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const hasPackageData = item.hasPkgData && item.pkgCost > 0;
    const qty = item.shortfall > 0
      ? `${item.shortfall % 1 === 0 ? item.shortfall : item.shortfall.toFixed(2)} ${item.unit}`.trim()
      : item.unit || '';
    const pkgLine = hasPackageData && item.packs
      ? `${item.packs} × ${item.pkgQty}${item.unit} pkg`
      : '';
    const costDisplay = hasPackageData && item.totalCost > 0
      ? formatCurrency(item.totalCost)
      : item.isCustom && item.pkgCost > 0
        ? formatCurrency(item.pkgCost)
        : '—';
    return `<div style="display:flex;align-items:flex-start;gap:8px;
      padding:10px 0;border-bottom:1px solid var(--border);
      opacity:${item.checked ? '0.4' : '1'};">
      <input type="checkbox" ${item.checked ? 'checked' : ''}
        onchange="_swToggleCheck(${idx}, this.checked)"
        style="margin-top:3px;width:15px;height:15px;cursor:pointer;flex-shrink:0;" />
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:800;
          ${item.checked ? 'text-decoration:line-through;' : ''}">
          ${escapeHtml(item.name)}
        </div>
        <div style="font-size:11px;color:var(--gray-400);margin-top:2px;">
          ${qty}${pkgLine ? ` · ${pkgLine}` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:900;
          color:${costDisplay === '—' ? 'var(--gray-300)' : 'var(--black)'};">
          ${costDisplay}
        </div>
      </div>
      ${item.isFreeItem ? `
      <button type="button" onclick="_swRemoveFree(${idx})"
        style="background:none;border:none;cursor:pointer;color:var(--gray-300);
          font-size:16px;padding:0 2px;flex-shrink:0;line-height:1;">✕</button>` : ''}
    </div>`;
  }).join('');

  const total = items.reduce((s, i) => s + Number(i.totalCost || 0), 0);
  _swUpdateTotal(total);
  _swUpdateBadge();
}

function _swToggleCheck(idx, checked) {
  const items = _swMode === 'free' ? _swFreeItems : _swItems;
  if (items[idx]) items[idx].checked = checked;
  _swRenderList();
}

function _swRemoveFree(idx) {
  _swFreeItems.splice(idx, 1);
  _swRenderList();
}

function _swUpdateTotal(total) {
  const el = document.getElementById('swTotal');
  if (el) el.textContent = total > 0 ? formatCurrency(total) : '₱0.00';
}

function _swUpdateBadge() {
  const items = _swMode === 'free' ? _swFreeItems : _swItems;
  const unchecked = items.filter(i => !i.checked).length;
  const badge = document.getElementById('swBadge');
  if (!badge) return;
  if (unchecked > 0) {
    badge.textContent = unchecked;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ════════════════════════════════════════════════════════
   SAVE / SHARE
════════════════════════════════════════════════════════ */

function saveShoppingList() {
  const items = _swMode === 'free' ? _swFreeItems : _swItems;
  if (!items.length) { showNotification('List is empty', 'error'); return; }

  const total   = items.reduce((s, i) => s + Number(i.totalCost || 0), 0);
  const dateStr = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const modeLabel = { production: 'Production', lowstock: 'Low Stock', free: 'Custom' }[_swMode];

  const newList = {
    id:      typeof generateId === 'function' ? generateId() : Date.now().toString(),
    name:    `${modeLabel} — ${dateStr}`,
    mode:    _swMode,
    items:   [...items],
    total,
    savedAt: new Date().toISOString()
  };

  let lists = _getShoppingLists();
  lists.push(newList);
  if (lists.length > 5) lists = lists.slice(lists.length - 5);
  if (typeof updateState === 'function') updateState('shoppingLists', () => lists);
  showNotification('Shopping list saved', 'success');
}

function shareShoppingList() {
  const items = _swMode === 'free' ? _swFreeItems : _swItems;
  if (!items.length) { showNotification('List is empty', 'error'); return; }

  const dateStr = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const total   = items.reduce((s, i) => s + Number(i.totalCost || 0), 0);
  const modeLabel = { production: 'Production Jobs', lowstock: 'Low Stock', free: 'Custom List' }[_swMode];

  let text = `SHOPPING LIST — ${dateStr}\n(${modeLabel})\n`;
  text += '─────────────────────────\n';
  items.forEach(item => {
    const check = item.checked ? '✓' : '□';
    text += `${check} ${item.name}\n`;
    text += `   Need: ${item.shortfall > 0 ? item.shortfall.toFixed(1) + ' ' + item.unit : item.unit}`;
    text += ` · Buy: ${item.packs} pack${item.packs !== 1 ? 's' : ''}`;
    if (item.totalCost > 0) text += ` · ${formatCurrency(item.totalCost)}`;
    text += '\n';
  });
  text += '─────────────────────────\n';
  if (total > 0) text += `Total: ${formatCurrency(total)}\n`;
  text += '\nGenerated by Caflat.CORE';

  if (navigator.share) {
    navigator.share({ title: 'Shopping List', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() =>
      showNotification('Copied to clipboard', 'success'));
  }
}

/* ── Expose globally ── */
window.toggleShoppingWidget = toggleShoppingWidget;
window.switchWidgetMode     = switchWidgetMode;
window.addFreeListItem      = addFreeListItem;
window.addCustomListItem    = addCustomListItem;
window._swToggleCheck       = _swToggleCheck;
window._swRemoveFree        = _swRemoveFree;
window.saveShoppingList     = saveShoppingList;
window.shareShoppingList    = shareShoppingList;
window.openShoppingListModal= toggleShoppingWidget;
