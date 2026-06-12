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
  if (panel) panel.style.display = _swOpen ? 'block' : 'none';
  if (fab)   fab.style.transform = _swOpen ? 'scale(0.92)' : 'scale(1)';
  if (_swOpen) {
    // Check if Production Mode is on — default to production if jobs exist
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
      const ing    = _getIngredients().find(i => i.id === item.id) || {};
      const pkgQty = Math.max(1, Number(ing.packageQty || 1));
      const pkgCost= Number(ing.packageCost || 0);
      const packs  = Math.max(1, Math.ceil(item.shortfall / pkgQty));
      return {
        id: item.id, name: item.name, unit: item.unit || '',
        shortfall: item.shortfall, onHand: item.onHand,
        pkgQty, pkgCost, packs, totalCost: packs * pkgCost,
        pkgWarning: pkgQty < 10 && item.shortfall > 50,
        checked: false
      };
    });
}

function _generateFromLowStock() {
  return _getIngredients()
    .filter(ing => Number(ing.stock || 0) <= Number(ing.reorderLevel || 0))
    .map(ing => {
      const stock  = Number(ing.stock || 0);
      const reorder= Number(ing.reorderLevel || 0);
      const pkgQty = Math.max(1, Number(ing.packageQty || 1));
      const pkgCost= Number(ing.packageCost || 0);
      const shortfall = Math.max(pkgQty, reorder - stock + pkgQty);
      const packs     = Math.max(1, Math.ceil(shortfall / pkgQty));
      return {
        id: ing.id, name: ing.name, unit: ing.unit || '',
        shortfall, onHand: stock, pkgQty, pkgCost,
        packs, totalCost: packs * pkgCost,
        pkgWarning: pkgQty < 10 && shortfall > 50,
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

  const ing    = _getIngredients().find(i => i.id === selEl.value);
  if (!ing) return;

  const qty    = Number(qtyEl?.value || 0);
  const pkgQty = Math.max(1, Number(ing.packageQty || 1));
  const pkgCost= Number(ing.packageCost || 0);
  const packs  = qty > 0 ? Math.max(1, Math.ceil(qty / pkgQty)) : 1;

  // If already in free list, update quantity
  const existing = _swFreeItems.find(i => i.id === ing.id);
  if (existing) {
    existing.shortfall = qty;
    existing.packs = packs;
    existing.totalCost = packs * pkgCost;
  } else {
    _swFreeItems.push({
      id: ing.id, name: ing.name, unit: ing.unit || '',
      shortfall: qty, onHand: Number(ing.stock || 0),
      pkgQty, pkgCost, packs, totalCost: packs * pkgCost,
      pkgWarning: false, checked: false, isFreeItem: true
    });
  }

  // Reset selectors
  selEl.value = '';
  if (qtyEl) qtyEl.value = '';
  _swRenderList();
  _swUpdateBadge();
  showNotification(`${ing.name} added`, 'success');
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
    const hasPackageData = item.pkgCost > 0;
    return `<div style="display:flex;align-items:flex-start;gap:8px;
      padding:9px 0;border-bottom:1px solid var(--gray-100);
      opacity:${item.checked ? '0.4' : '1'};">
      <input type="checkbox" ${item.checked ? 'checked' : ''}
        onchange="_swToggleCheck(${idx}, this.checked)"
        style="margin-top:3px;width:15px;height:15px;cursor:pointer;flex-shrink:0;" />
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:800;
          ${item.checked ? 'text-decoration:line-through;' : ''}">
          ${escapeHtml(item.name)}
          ${item.pkgWarning ? '<span style="color:#b45309;font-size:9px;"> ⚠ check pkg size</span>' : ''}
        </div>
        <div style="font-size:10px;color:var(--gray-400);margin-top:1px;">
          ${item.shortfall > 0 ? `Need: ${item.shortfall.toFixed(1)} ${item.unit}` : item.unit}
          ${item.pkgQty ? ` · Pkg: ${item.pkgQty} ${item.unit}` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:13px;font-weight:900;">${item.packs} pk</div>
        <div style="font-size:11px;color:${hasPackageData ? 'var(--black)' : 'var(--gray-300)'};">
          ${hasPackageData ? formatCurrency(item.totalCost) : '—'}
        </div>
      </div>
      ${_swMode === 'free' ? `
      <button type="button" onclick="_swRemoveFree(${idx})"
        style="background:none;border:none;cursor:pointer;color:var(--gray-300);
          font-size:14px;padding:0 2px;flex-shrink:0;">✕</button>` : ''}
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
window._swToggleCheck       = _swToggleCheck;
window._swRemoveFree        = _swRemoveFree;
window.saveShoppingList     = saveShoppingList;
window.shareShoppingList    = shareShoppingList;
window.openShoppingListModal= toggleShoppingWidget; // backwards compat
