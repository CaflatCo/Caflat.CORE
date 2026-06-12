/* ═══════════════════════════════════════════════════════
   SHOPPINGLIST.JS — Shopping List Generator
   Two modes:
   1. From Production Jobs — shortfall across active jobs
   2. From Low Stock      — ingredients at/below reorder level
   Manual items can be added to either.
   Last 5 lists saved. Clearable.
═══════════════════════════════════════════════════════ */

let _slMode      = 'lowstock';   // 'production' | 'lowstock'
let _slManual    = [];           // [{ name, qty, unit, estCost }]
let _slGenerated = [];           // computed items from mode

/* ── Helpers ── */
function _getIngredients() { return APP_STATE.ingredients || []; }
function _getShoppingLists() { return Array.isArray(APP_STATE.shoppingLists) ? APP_STATE.shoppingLists : []; }

/* ════════════════════════════════════════════════════════
   GENERATE LIST ITEMS
════════════════════════════════════════════════════════ */

function _generateFromProduction() {
  if (typeof getIngredientForecast !== 'function') return [];
  const forecast = getIngredientForecast();
  return forecast
    .filter(item => item.shortfall > 0)
    .map(item => {
      const ing       = _getIngredients().find(i => i.id === item.id) || {};
      const pkgQty    = Math.max(1, Number(ing.packageQty  || 1));
      const pkgCost   = Number(ing.packageCost || 0);
      const packs     = Math.max(1, Math.ceil(item.shortfall / pkgQty));
      const totalCost = packs * pkgCost;
      // Warn if package size looks suspicious (e.g. set to 1g for a bulk ingredient)
      const pkgWarning = pkgQty < 10 && item.shortfall > 50;
      return {
        id:          item.id,
        name:        item.name,
        unit:        item.unit || '',
        shortfall:   item.shortfall,
        onHand:      item.onHand,
        needed:      item.total,
        pkgQty,
        pkgCost,
        packs,
        totalCost,
        pkgWarning,
        reason:      'Production shortfall',
        checked:     false
      };
    });
}

function _generateFromLowStock() {
  return _getIngredients()
    .filter(ing => {
      const stock   = Number(ing.stock || 0);
      const reorder = Number(ing.reorderLevel || 0);
      return stock <= reorder;
    })
    .map(ing => {
      const stock     = Number(ing.stock   || 0);
      const reorder   = Number(ing.reorderLevel || 0);
      const pkgQty    = Math.max(1, Number(ing.packageQty   || 1));
      const pkgCost   = Number(ing.packageCost  || 0);
      const shortfall = Math.max(pkgQty, reorder - stock + pkgQty);
      const packs     = Math.max(1, Math.ceil(shortfall / pkgQty));
      const totalCost = packs * pkgCost;
      const pkgWarning = pkgQty < 10 && shortfall > 50;
      return {
        id:          ing.id,
        name:        ing.name,
        unit:        ing.unit || '',
        shortfall,
        onHand:      stock,
        needed:      reorder,
        pkgQty,
        pkgCost,
        packs,
        totalCost,
        pkgWarning,
        reason:      'Low stock (reorder at ' + reorder + ' ' + (ing.unit || '') + ')',
        checked:     false
      };
    });
}

function generateShoppingList() {
  _slGenerated = _slMode === 'production'
    ? _generateFromProduction()
    : _generateFromLowStock();
  renderShoppingListModal();
}

/* ════════════════════════════════════════════════════════
   MODAL RENDER
════════════════════════════════════════════════════════ */

function openShoppingListModal() {
  const prodModeOn = APP_STATE.settings?.productionModeEnabled;
  _slMode   = prodModeOn ? 'production' : 'lowstock';
  _slManual = [];
  generateShoppingList();
  openModal('shoppingListModal');
}

function renderShoppingListModal() {
  const allItems  = _slGenerated.concat(
    _slManual.map(m => ({ ...m, isManual: true, checked: m.checked || false }))
  );
  const grandTotal = allItems.reduce((s, i) => s + Number(i.totalCost || i.estCost || 0), 0);
  const prodModeOn = APP_STATE.settings?.productionModeEnabled;
  const dateStr    = new Date().toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  const container = document.getElementById('shoppingListContent');
  if (!container) return;

  container.innerHTML = `
    <!-- Mode tabs -->
    <div style="display:flex;gap:0;margin-bottom:16px;border:1.5px solid var(--gray-200);
      border-radius:var(--radius-lg);overflow:hidden;">
      ${prodModeOn ? `
      <button type="button" onclick="switchShoppingListMode('production')"
        style="flex:1;padding:8px;font-size:11px;font-weight:800;font-family:var(--font-main);
          border:none;cursor:pointer;transition:background .15s;
          background:${_slMode==='production'?'var(--black)':'var(--white)'};
          color:${_slMode==='production'?'white':'var(--gray-600)'};">
        From Production Jobs
      </button>` : ''}
      <button type="button" onclick="switchShoppingListMode('lowstock')"
        style="flex:1;padding:8px;font-size:11px;font-weight:800;font-family:var(--font-main);
          border:none;cursor:pointer;transition:background .15s;
          background:${_slMode==='lowstock'?'var(--black)':'var(--white)'};
          color:${_slMode==='lowstock'?'white':'var(--gray-600)'};">
        From Low Stock
      </button>
    </div>

    <div style="font-size:11px;color:var(--gray-400);margin-bottom:12px;">
      ${dateStr} ·
      ${_slMode === 'production'
        ? 'Shortfall across active production jobs'
        : 'Ingredients at or below reorder level'}
    </div>

    <!-- Items -->
    ${!allItems.length
      ? `<div class="empty-state" style="padding:20px 0;">
          ${_slMode === 'production'
            ? 'No ingredient shortfalls in active production jobs'
            : 'All ingredients are above reorder level'}
        </div>`
      : allItems.map((item, idx) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;
          border-bottom:1px solid var(--gray-100);
          opacity:${item.checked ? '0.45' : '1'};">
          <!-- Checkbox -->
          <input type="checkbox" ${item.checked ? 'checked' : ''}
            onchange="_slToggleCheck(${idx}, this.checked)"
            style="margin-top:3px;width:16px;height:16px;cursor:pointer;flex-shrink:0;" />
          <!-- Info -->
          <div style="flex:1;">
            <div style="font-weight:800;font-size:13px;
              ${item.checked ? 'text-decoration:line-through;' : ''}">
              ${escapeHtml(item.name)}
              ${item.isManual ? '<span style="font-size:9px;color:var(--gray-400);margin-left:4px;">MANUAL</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:2px;">
              ${item.isManual
                ? (item.unit ? escapeHtml(item.unit) : 'manual item')
                : `Need: ${item.shortfall.toFixed(1)} ${item.unit} · On hand: ${item.onHand.toFixed(1)} ${item.unit}`}
            </div>
            ${!item.isManual && item.pkgQty ? `
            <div style="font-size:11px;color:${item.pkgWarning ? '#b45309' : 'var(--gray-500)'};margin-top:2px;">
              Package: ${item.pkgQty} ${item.unit} · ${formatCurrency(item.pkgCost)} each
              ${item.pkgWarning ? '· <b>Check package size in Ingredients</b>' : ''}
            </div>` : ''}
          </div>
          <!-- Buy + Cost -->
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:13px;font-weight:900;">
              ${item.isManual
                ? (item.estCost > 0 ? formatCurrency(item.estCost) : '—')
                : `${item.packs} ${item.packs === 1 ? 'pack' : 'packs'}`}
            </div>
            ${!item.isManual ? `
            <div style="font-size:11px;color:${item.totalCost > 0 ? 'var(--black)' : 'var(--gray-400)'};
              font-weight:${item.totalCost > 0 ? '700' : '400'};">
              ${item.totalCost > 0 ? formatCurrency(item.totalCost) : '—'}
            </div>` : ''}
          </div>
        </div>`).join('')}

    <!-- Manual add row -->
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100);">
      <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;color:var(--gray-400);margin-bottom:8px;">
        Add manually
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <input type="text" id="slManualName" placeholder="Item name" style="flex:2;min-width:120px;
          padding:6px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);" />
        <input type="text" id="slManualQty" placeholder="Qty/note" style="width:90px;
          padding:6px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);" />
        <input type="number" id="slManualCost" placeholder="₱ est." min="0" style="width:90px;
          padding:6px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);" />
        <button class="btn btn-secondary" type="button"
          onclick="_slAddManual()">+ Add</button>
      </div>
    </div>

    <!-- Total -->
    ${grandTotal > 0 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;
      margin-top:14px;padding-top:12px;border-top:2px solid var(--black);">
      <span style="font-size:12px;font-weight:800;letter-spacing:1px;
        text-transform:uppercase;">Estimated Total</span>
      <span style="font-size:20px;font-weight:900;">${formatCurrency(grandTotal)}</span>
    </div>` : ''}

    <!-- Saved lists -->
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--gray-100);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:10px;font-weight:800;letter-spacing:1.5px;
          text-transform:uppercase;color:var(--gray-400);">Saved Lists</span>
        ${_getShoppingLists().length > 0
          ? `<button type="button" onclick="clearAllShoppingLists()"
              style="font-size:10px;color:#dc2626;background:none;border:none;
                cursor:pointer;font-family:var(--font-main);">Clear all</button>`
          : ''}
      </div>
      ${_getShoppingLists().length === 0
        ? `<div style="font-size:11px;color:var(--gray-400);">No saved lists yet</div>`
        : _getShoppingLists().slice().reverse().map((list, idx) => `
          <div style="display:flex;align-items:center;justify-content:space-between;
            padding:6px 0;border-bottom:1px solid var(--gray-100);">
            <div>
              <div style="font-size:12px;font-weight:700;">${escapeHtml(list.name)}</div>
              <div style="font-size:10px;color:var(--gray-400);">
                ${list.items.length} items · ${formatCurrency(list.total)}
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-secondary" type="button"
                onclick="loadSavedShoppingList('${list.id}')">Load</button>
              <button class="btn btn-sm btn-secondary" type="button"
                onclick="deleteShoppingList('${list.id}')"
                style="color:#dc2626;border-color:#fca5a5;">✕</button>
            </div>
          </div>`).join('')}
    </div>`;
}

window.switchShoppingListMode = function(mode) {
  _slMode = mode;
  generateShoppingList();
};

window._slToggleCheck = function(idx, checked) {
  const total = _slGenerated.length;
  if (idx < total) _slGenerated[idx].checked = checked;
  else _slManual[idx - total].checked = checked;
  renderShoppingListModal();
};

window._slAddManual = function() {
  const name = sanitizeText(document.getElementById('slManualName')?.value || '');
  const qty  = sanitizeText(document.getElementById('slManualQty')?.value  || '');
  const cost = Number(document.getElementById('slManualCost')?.value || 0);
  if (!name) { showNotification('Enter item name', 'error'); return; }
  _slManual.push({ name, unit: qty, estCost: cost, isManual: true, checked: false });
  setElementValue('slManualName', ''); setElementValue('slManualQty', '');
  setElementValue('slManualCost', '');
  renderShoppingListModal();
};

/* ── Save current list ── */
function saveShoppingList() {
  const allItems  = _slGenerated.concat(_slManual.map(m => ({ ...m, isManual: true })));
  if (!allItems.length) { showNotification('List is empty', 'error'); return; }

  const total     = allItems.reduce((s, i) => s + Number(i.totalCost || i.estCost || 0), 0);
  const dateStr   = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const modeLbl   = _slMode === 'production' ? 'Production' : 'Low Stock';
  const newList   = {
    id:        generateId(),
    name:      `${modeLbl} — ${dateStr}`,
    mode:      _slMode,
    items:     allItems,
    total,
    savedAt:   new Date().toISOString()
  };

  let lists = _getShoppingLists();
  lists.push(newList);
  // Keep only last 5
  if (lists.length > 5) lists = lists.slice(lists.length - 5);
  updateState('shoppingLists', () => lists);
  showNotification('Shopping list saved', 'success');
  renderShoppingListModal();
}

function loadSavedShoppingList(listId) {
  const list = _getShoppingLists().find(l => l.id === listId);
  if (!list) return;
  _slMode      = list.mode || 'lowstock';
  _slGenerated = list.items.filter(i => !i.isManual);
  _slManual    = list.items.filter(i => i.isManual);
  renderShoppingListModal();
  showNotification(`Loaded: ${list.name}`, 'success');
}

function deleteShoppingList(listId) {
  updateState('shoppingLists', () => _getShoppingLists().filter(l => l.id !== listId));
  renderShoppingListModal();
}

function clearAllShoppingLists() {
  if (!confirm('Clear all saved shopping lists?')) return;
  updateState('shoppingLists', () => []);
  renderShoppingListModal();
  showNotification('Shopping lists cleared', 'success');
}

/* ── Share / Copy ── */
function shareShoppingList() {
  const allItems = _slGenerated.concat(_slManual);
  if (!allItems.length) { showNotification('List is empty', 'error'); return; }

  const dateStr = new Date().toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
  const total = allItems.reduce((s, i) => s + Number(i.totalCost || i.estCost || 0), 0);

  let text = `SHOPPING LIST — ${dateStr}\n`;
  text += `─────────────────────────\n`;
  allItems.forEach(item => {
    const check = item.checked ? '✓' : '□';
    if (item.isManual) {
      text += `${check} ${item.name}${item.unit ? ' · ' + item.unit : ''}`;
      if (item.estCost > 0) text += `  ${formatCurrency(item.estCost)}`;
      text += '\n';
    } else {
      text += `${check} ${item.name}\n`;
      text += `   Need: ${item.shortfall.toFixed(1)} ${item.unit} · Buy: ${item.packs} pack${item.packs !== 1 ? 's' : ''} (${item.pkgQty} ${item.unit} each)\n`;
      if (item.totalCost > 0) text += `   Cost: ${formatCurrency(item.totalCost)}\n`;
    }
  });
  text += `─────────────────────────\n`;
  if (total > 0) text += `Estimated total: ${formatCurrency(total)}\n`;
  text += `\nGenerated by Caflat.CORE`;

  if (navigator.share) {
    navigator.share({ title: 'Shopping List', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => {
      showNotification('Copied to clipboard', 'success');
    });
  }
}

window.openShoppingListModal  = openShoppingListModal;
window.generateShoppingList   = generateShoppingList;
window.saveShoppingList       = saveShoppingList;
window.loadSavedShoppingList  = loadSavedShoppingList;
window.deleteShoppingList     = deleteShoppingList;
window.clearAllShoppingLists  = clearAllShoppingLists;
window.shareShoppingList      = shareShoppingList;
window.renderShoppingListModal= renderShoppingListModal;
