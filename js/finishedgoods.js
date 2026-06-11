/* ═══════════════════════════════════════════════════════
   FINISHEDGOODS.JS — Finished Goods Inventory
   Per-category mode: 'finished_goods' | 'direct'
   
   FG Mode flow:
     Production DONE  → credit finishedGoods stock
     POS Sale         → deduct finishedGoods stock (not ingredients)
     Supply ORDERED   → reserve finishedGoods stock
     Supply PAID      → deduct finishedGoods stock
     Adjustment       → spoilage/disposal/correction
     
   Direct Mode (default):
     POS Sale         → deduct ingredients (as today, unchanged)
═══════════════════════════════════════════════════════ */

/* ── Getters ── */
function getFinishedGoods() {
  return Array.isArray(APP_STATE.finishedGoods) ? APP_STATE.finishedGoods : [];
}

function getFGMovements() {
  return Array.isArray(APP_STATE.fgMovements) ? APP_STATE.fgMovements : [];
}

function getFGRecord(productId) {
  return getFinishedGoods().find(r => String(r.productId) === String(productId)) || null;
}

function getFGStock(productId) {
  const rec = getFGRecord(productId);
  return rec ? Number(rec.stock || 0) : 0;
}

function getFGReserved(productId) {
  const rec = getFGRecord(productId);
  return rec ? Number(rec.reserved || 0) : 0;
}

function getFGAvailable(productId) {
  return Math.max(0, getFGStock(productId) - getFGReserved(productId));
}

/* ── Core write ── */
function _setFGRecord(productId, productName, delta, reservedDelta, reason, type) {
  const goods = getFinishedGoods();
  const idx   = goods.findIndex(r => String(r.productId) === String(productId));
  const prev  = idx >= 0 ? goods[idx] : { productId, productName, stock: 0, reserved: 0 };
  const newStock    = Math.max(0, Number(prev.stock    || 0) + delta);
  const newReserved = Math.max(0, Number(prev.reserved || 0) + reservedDelta);
  const updated     = { ...prev, productId, productName, stock: newStock, reserved: newReserved, updatedAt: new Date().toISOString() };

  if (idx >= 0) goods[idx] = updated;
  else          goods.push(updated);

  updateState('finishedGoods', () => goods);

  // Log movement
  const movements = getFGMovements();
  movements.push({
    id:          generateId(),
    productId,
    productName,
    type,
    delta,
    reservedDelta,
    stockBefore:    Number(prev.stock    || 0),
    stockAfter:     newStock,
    reservedBefore: Number(prev.reserved || 0),
    reservedAfter:  newReserved,
    reason,
    createdAt:   new Date().toISOString(),
    createdBy:   APP_STATE.currentUserRole || 'STAFF'
  });
  updateState('fgMovements', () => movements);
}

/* ── Production credits finished goods on Done ── */
function creditFinishedGoods(productId, productName, qty, jobName) {
  _setFGRecord(productId, productName, qty, 0,
    'Production: ' + (jobName || 'Production run'), 'production-credit');
  if (typeof renderFinishedGoodsTable === 'function') renderFinishedGoodsTable();
}

/* ── POS deducts finished goods (FG mode only) ── */
function deductFGForCart(cart) {
  cart.forEach(line => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(line.productId));
    if (!product) return;
    if (!isFinishedGoodsProduct(product)) return; // direct mode — skip
    const qty = Number(line.quantity || 0) * Number(line.multiplier || 1);
    _setFGRecord(product.id, product.name, -qty, 0,
      'POS Sale', 'sale-deduction');
  });
  if (typeof renderFinishedGoodsTable === 'function') renderFinishedGoodsTable();
}

/* ── Supply — reserve and deduct finished goods ── */
function reserveFGForSupply(order) {
  (order.items || []).forEach(item => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
    if (!product || !isFinishedGoodsProduct(product)) return;
    const qty = Number(item.quantity || 0);
    _setFGRecord(product.id, product.name, 0, qty,
      'Supply reserved: ' + (order.clientName || order.id), 'supply-reserve');
  });
  if (typeof renderFinishedGoodsTable === 'function') renderFinishedGoodsTable();
}

function deductFGForSupply(order) {
  (order.items || []).forEach(item => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
    if (!product || !isFinishedGoodsProduct(product)) return;
    const qty = Number(item.quantity || 0);
    // Remove stock and release the reservation simultaneously
    _setFGRecord(product.id, product.name, -qty, -qty,
      'Supply delivered: ' + (order.clientName || order.id), 'supply-deduction');
  });
  if (typeof renderFinishedGoodsTable === 'function') renderFinishedGoodsTable();
}

function releaseFGReserveForSupply(order) {
  (order.items || []).forEach(item => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
    if (!product || !isFinishedGoodsProduct(product)) return;
    const qty = Number(item.quantity || 0);
    _setFGRecord(product.id, product.name, 0, -qty,
      'Supply cancelled: ' + (order.clientName || order.id), 'supply-reserve-release');
  });
  if (typeof renderFinishedGoodsTable === 'function') renderFinishedGoodsTable();
}

/* ── Adjustments (spoilage, disposal, correction) ── */
const FG_ADJUSTMENT_TYPES = ['Spoiled','Disposed','Expired','Damaged','Correction','Other'];

function openFGAdjustmentModal(productId) {
  const product = (APP_STATE.products || []).find(p => String(p.id) === String(productId));
  if (!product) return;
  const rec = getFGRecord(productId);

  setElementValue('fgAdjProductId',   productId);
  setElementValue('fgAdjProductName', product.name);
  setElementValue('fgAdjCurrent',     getFGStock(productId) + ' units');
  setElementValue('fgAdjType',        'Spoiled');
  setElementValue('fgAdjQty',         '');
  setElementValue('fgAdjReason',      '');

  openModal('fgAdjustmentModal');
}

function saveFGAdjustment() {
  const productId   = getElementValue('fgAdjProductId');
  const productName = getElementValue('fgAdjProductName');
  const type        = getElementValue('fgAdjType') || 'Spoiled';
  const qty         = safeNumber(getElementValue('fgAdjQty'));
  const reason      = sanitizeText(getElementValue('fgAdjReason')) || type;

  if (!productId) { showNotification('No product selected', 'error'); return; }
  if (!qty)       { showNotification('Enter quantity', 'error'); return; }

  const delta = type === 'Correction' ? qty : -Math.abs(qty);
  _setFGRecord(productId, productName, delta, 0,
    type + (reason ? ': ' + reason : ''), 'adjustment');

  closeModal('fgAdjustmentModal');
  renderFinishedGoodsTable();
  showNotification('Adjustment saved', 'success');
}

/* ════════════════════════════════════════════════════════
   INVENTORY VIEWS
════════════════════════════════════════════════════════ */

function renderFinishedGoodsTable() {
  const container = document.getElementById('fgInventoryContainer');
  if (!container) return;

  // Only show FG-mode products
  const fgProducts = (APP_STATE.products || []).filter(p => isFinishedGoodsProduct(p));

  if (!fgProducts.length) {
    container.innerHTML = `<div class="empty-state">
      No products in Finished Goods mode yet.<br>
      <span style="font-size:12px;color:var(--gray-400);">
        Switch a category to Finished Goods mode in Settings → Categories.
      </span>
    </div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${fgProducts.map(p => {
            const stock     = getFGStock(p.id);
            const reserved  = getFGReserved(p.id);
            const available = getFGAvailable(p.id);
            const reorder   = Number(p.reorderLevel || 0);
            const low       = available <= reorder;
            const soldOut   = available <= 0;
            const statusBadge = soldOut
              ? '<span class="badge-sold-out">Sold Out</span>'
              : low
                ? '<span class="badge-low-stock">Low Stock</span>'
                : '<span class="badge dark">OK</span>';

            return `
              <tr ${soldOut ? 'class="low-stock-row"' : ''}>
                <td style="font-weight:700;">${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.category)}</td>
                <td style="font-variant-numeric:tabular-nums;">${stock}</td>
                <td style="font-variant-numeric:tabular-nums;color:${reserved>0?'#ea580c':'var(--gray-400)'};">
                  ${reserved > 0 ? reserved : '—'}
                </td>
                <td style="font-variant-numeric:tabular-nums;font-weight:800;">
                  ${available}
                </td>
                <td>${statusBadge}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-sm btn-secondary"
                      data-action="open-fg-adjustment" data-id="${p.id}">Adjust</button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Inventory Movement Log (both raw + FG) ── */
function renderInventoryMovementLog() {
  const container = document.getElementById('inventoryMovementLog');
  if (!container) return;

  const rawMovements = (APP_STATE.inventoryMovements || []).map(m => ({
    ...m, logType: 'raw', displayName: m.ingredientName
  }));
  const fgMovements = getFGMovements().map(m => ({
    ...m, logType: 'fg', displayName: m.productName
  }));

  const all = [...rawMovements, ...fgMovements]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100); // last 100

  if (!all.length) {
    container.innerHTML = `<div class="empty-state">No inventory movements yet</div>`;
    return;
  }

  const typeColors = {
    'restock':              '#16a34a',
    'sale-deduction':       '#dc2626',
    'production-credit':    '#2563eb',
    'supply-reserve':       '#ea580c',
    'supply-deduction':     '#dc2626',
    'supply-reserve-release':'#6b7280',
    'supply-stock-restored':'#16a34a',
    'adjustment':           '#9333ea',
    'void-restore':         '#16a34a',
  };

  const typeLabels = {
    'restock':              'Restock',
    'sale-deduction':       'Sale',
    'production-credit':    'Production',
    'supply-reserve':       'Supply Reserved',
    'supply-deduction':     'Supply Delivered',
    'supply-reserve-release':'Supply Cancelled',
    'supply-stock-restored':'Supply Restored',
    'adjustment':           'Adjustment',
    'void-restore':         'Void Restored',
  };

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Item</th>
            <th>Inventory</th>
            <th>Change</th>
            <th>Before</th>
            <th>After</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${all.map(m => {
            const color   = typeColors[m.type] || '#6b7280';
            const label   = typeLabels[m.type] || m.type;
            const isRaw   = m.logType === 'raw';
            const change  = isRaw
              ? (m.quantityAdded > 0 ? '+' + m.quantityAdded : '-' + m.quantityUsed)
              : (m.delta >= 0 ? '+' + m.delta : String(m.delta));
            const before  = isRaw ? m.previousStock : m.stockBefore;
            const after   = isRaw ? m.newStock : m.stockAfter;
            const date    = new Date(m.createdAt).toLocaleString('en-PH', {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
            });

            return `
              <tr>
                <td style="font-size:11px;color:var(--gray-500);white-space:nowrap;">${date}</td>
                <td>
                  <span style="font-size:9px;font-weight:800;padding:2px 8px;
                    border-radius:999px;background:${color}20;color:${color};
                    border:1px solid ${color}40;">${label}</span>
                </td>
                <td style="font-weight:700;">${escapeHtml(m.displayName || '')}</td>
                <td>
                  <span style="font-size:10px;padding:1px 6px;border-radius:999px;
                    background:${isRaw ? 'var(--gray-100)' : '#2563eb20'};
                    color:${isRaw ? 'var(--gray-600)' : '#2563eb'};font-weight:700;">
                    ${isRaw ? 'Raw' : 'Finished'}
                  </span>
                </td>
                <td style="font-variant-numeric:tabular-nums;font-weight:800;
                  color:${m.delta >= 0 || m.quantityAdded > 0 ? '#16a34a' : '#dc2626'};">
                  ${change}
                </td>
                <td style="font-variant-numeric:tabular-nums;color:var(--gray-500);">${before ?? '—'}</td>
                <td style="font-variant-numeric:tabular-nums;">${after ?? '—'}</td>
                <td style="font-size:11px;color:var(--gray-500);">${escapeHtml(m.reason || '')}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Exports ── */
window.getFinishedGoods           = getFinishedGoods;
window.getFGMovements             = getFGMovements;
window.getFGRecord                = getFGRecord;
window.getFGStock                 = getFGStock;
window.getFGAvailable             = getFGAvailable;
window.creditFinishedGoods        = creditFinishedGoods;
window.deductFGForCart            = deductFGForCart;
window.reserveFGForSupply         = reserveFGForSupply;
window.deductFGForSupply          = deductFGForSupply;
window.releaseFGReserveForSupply  = releaseFGReserveForSupply;
window.openFGAdjustmentModal      = openFGAdjustmentModal;
window.saveFGAdjustment           = saveFGAdjustment;
window.renderFinishedGoodsTable   = renderFinishedGoodsTable;
window.renderInventoryMovementLog = renderInventoryMovementLog;
window.FG_ADJUSTMENT_TYPES        = FG_ADJUSTMENT_TYPES;
