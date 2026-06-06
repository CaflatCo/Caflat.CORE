/* ═══════════════════════════════════════════════════════
   SUPPLY.JS — Supplier Order Tracking
   B2B order management: Drafted → Ordered → Delivered
   → Invoiced → Paid. Full timestamp trail per status.
   Feature-toggled via settings.supplierModeEnabled.
═══════════════════════════════════════════════════════ */

const SUPPLY_STATUSES = ['DRAFTED', 'ORDERED', 'DELIVERED', 'INVOICED', 'PAID'];
const SUPPLY_STATUS_LABELS = {
  DRAFTED:   'Draft',
  ORDERED:   'Ordered',
  DELIVERED: 'Delivered',
  INVOICED:  'Invoiced',
  PAID:      'Paid',
  CANCELLED: 'Cancelled',
  PARTIAL:   'Partial'
};

/* ── Data accessors ── */
function getSupplyOrders() {
  return Array.isArray(APP_STATE.supplyOrders) ? APP_STATE.supplyOrders : [];
}

function getSupplierClients() {
  return Array.isArray(APP_STATE.supplierClients) ? APP_STATE.supplierClients : [];
}

function getSupplyOrderById(id) {
  return getSupplyOrders().find(o => String(o.id) === String(id));
}

/* ── Client management ── */
function saveSupplierClient() {
  const name    = sanitizeText(document.getElementById('clientName')?.value || '');
  const contact = sanitizeText(document.getElementById('clientContact')?.value || '');
  const email   = sanitizeText(document.getElementById('clientEmail')?.value || '');
  const address = sanitizeText(document.getElementById('clientAddress')?.value || '');
  const editId  = document.getElementById('clientId')?.value || '';

  if (!name) { showNotification('Client name is required', 'error'); return; }

  const clients = getSupplierClients();
  if (editId) {
    const idx = clients.findIndex(c => String(c.id) === String(editId));
    if (idx >= 0) clients[idx] = { ...clients[idx], name, contact, email, address };
  } else {
    clients.push({ id: generateId(), name, contact, email, address, createdAt: new Date().toISOString() });
  }

  updateState('supplierClients', () => clients);
  closeModal('clientModal');
  clearClientForm();
  renderClientsList();
  renderClientDropdowns();
  showNotification('Client saved', 'success');
}

function deleteSupplierClient(clientId) {
  if (!confirm('Delete this client?')) return;
  updateState('supplierClients', () => getSupplierClients().filter(c => String(c.id) !== String(clientId)));
  renderClientsList();
  renderClientDropdowns();
  showNotification('Client deleted', 'success');
}

function openClientModal(clientId = null) {
  clearClientForm();
  if (clientId) {
    const client = getSupplierClients().find(c => String(c.id) === String(clientId));
    if (client) {
      setElementValue('clientId',      client.id);
      setElementValue('clientName',    client.name);
      setElementValue('clientContact', client.contact || '');
      setElementValue('clientEmail',   client.email   || '');
      setElementValue('clientAddress', client.address || '');
    }
  }
  openModal('clientModal');
}

function clearClientForm() {
  ['clientId','clientName','clientContact','clientEmail','clientAddress']
    .forEach(id => setElementValue(id, ''));
}

function renderClientsList() {
  const container = document.getElementById('clientsList');
  if (!container) return;
  const clients = getSupplierClients();

  if (!clients.length) {
    container.innerHTML = `<div class="empty-state">No clients yet — add your first client</div>`;
    return;
  }

  container.innerHTML = clients.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);
      margin-bottom:8px;background:var(--white);">
      <div>
        <div style="font-weight:800;font-size:13px;">${escapeHtml(c.name)}</div>
        <div style="font-size:11px;color:var(--gray-400);">
          ${[c.contact, c.email].filter(Boolean).map(escapeHtml).join(' · ') || 'No contact info'}
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-secondary" data-action="edit-client" data-id="${c.id}">Edit</button>
        <button class="btn btn-sm btn-secondary" data-action="delete-client" data-id="${c.id}">Delete</button>
      </div>
    </div>`).join('');
}

function renderClientDropdowns() {
  const selects = document.querySelectorAll('.supply-client-select');
  const clients = getSupplierClients();
  selects.forEach(select => {
    const current = select.value;
    select.innerHTML = `<option value="">Select Client</option>` +
      clients.map(c => `<option value="${c.id}"${current === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  });
}

/* ── Supply order management ── */
function openSupplyOrderModal(orderId = null) {
  clearSupplyOrderForm();
  renderClientDropdowns();
  renderSupplyLineItems([]);

  if (orderId) {
    const order = getSupplyOrderById(orderId);
    if (order) hydrateSupplyOrderForm(order);
  } else {
    // Pre-fill today's date
    const today = new Date().toISOString().slice(0, 10);
    setElementValue('supplyOrderDate', today);
    setElementValue('supplyInvoiceNumber', generateInvoiceNumber());
  }
  openModal('supplyOrderModal');
}

function hydrateSupplyOrderForm(order) {
  setElementValue('supplyOrderId',      order.id);
  setElementValue('supplyInvoiceNumber',order.invoiceNumber);
  setElementValue('supplyOrderDate',    order.orderDate || '');
  setElementValue('supplyNotes',        order.notes || '');

  const clientSelect = document.getElementById('supplyClientSelect');
  if (clientSelect) clientSelect.value = order.clientId || '';

  renderSupplyLineItems(order.items || []);
}

function clearSupplyOrderForm() {
  ['supplyOrderId','supplyInvoiceNumber','supplyOrderDate','supplyNotes']
    .forEach(id => setElementValue(id, ''));
  renderSupplyLineItems([]);
}

function renderSupplyLineItems(items = []) {
  const container = document.getElementById('supplyLineItems');
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => addSupplyLineItemRow(item));
}

function addSupplyLineItemRow(item = null) {
  const container = document.getElementById('supplyLineItems');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'supply-line-row';
  row.innerHTML = `
    <input type="text"   class="supply-item-desc"  placeholder="Item description"
      value="${escapeHtml(item?.description || '')}" style="flex:2;" />
    <input type="number" class="supply-item-qty"   placeholder="Qty"
      value="${item?.qty || ''}" min="0" step="0.01" style="width:80px;" />
    <input type="number" class="supply-item-price" placeholder="Unit Price"
      value="${item?.unitPrice || ''}" min="0" step="0.01" style="width:110px;" />
    <div class="supply-item-total" style="width:100px;text-align:right;font-weight:700;font-size:13px;">
      ${item ? formatCurrency((item.qty || 0) * (item.unitPrice || 0)) : '₱0.00'}
    </div>
    <button type="button" class="btn btn-sm btn-secondary supply-remove-line">✕</button>`;

  // Live total update
  ['supply-item-qty','supply-item-price'].forEach(cls => {
    row.querySelector(`.${cls}`).addEventListener('input', () => updateSupplyLineTotal(row));
  });
  row.querySelector('.supply-remove-line').addEventListener('click', () => {
    row.remove();
    updateSupplyOrderTotal();
  });

  container.appendChild(row);
}

function updateSupplyLineTotal(row) {
  const qty   = Number(row.querySelector('.supply-item-qty')?.value   || 0);
  const price = Number(row.querySelector('.supply-item-price')?.value || 0);
  const totalEl = row.querySelector('.supply-item-total');
  if (totalEl) totalEl.textContent = formatCurrency(qty * price);
  updateSupplyOrderTotal();
}

function updateSupplyOrderTotal() {
  const rows = document.querySelectorAll('#supplyLineItems .supply-line-row');
  let total = 0;
  rows.forEach(row => {
    const qty   = Number(row.querySelector('.supply-item-qty')?.value   || 0);
    const price = Number(row.querySelector('.supply-item-price')?.value || 0);
    total += qty * price;
  });
  const totalEl = document.getElementById('supplyOrderTotal');
  if (totalEl) totalEl.textContent = formatCurrency(total);
}

function collectSupplyLineItems() {
  return Array.from(document.querySelectorAll('#supplyLineItems .supply-line-row'))
    .map(row => ({
      description: sanitizeText(row.querySelector('.supply-item-desc')?.value  || ''),
      qty:         Number(row.querySelector('.supply-item-qty')?.value          || 0),
      unitPrice:   Number(row.querySelector('.supply-item-price')?.value        || 0),
      total:       Number(row.querySelector('.supply-item-qty')?.value || 0) *
                   Number(row.querySelector('.supply-item-price')?.value || 0)
    }))
    .filter(item => item.description);
}

function saveSupplyOrder() {
  const id            = getElementValue('supplyOrderId') || generateId();
  const invoiceNumber = sanitizeText(getElementValue('supplyInvoiceNumber'));
  const clientId      = document.getElementById('supplyClientSelect')?.value || '';
  const orderDate     = getElementValue('supplyOrderDate');
  const notes         = sanitizeText(getElementValue('supplyNotes'));
  const items         = collectSupplyLineItems();

  if (!clientId)   { showNotification('Please select a client',       'error'); return; }
  if (!orderDate)  { showNotification('Order date is required',        'error'); return; }
  if (!items.length){ showNotification('Add at least one line item',   'error'); return; }

  const client = getSupplierClients().find(c => String(c.id) === String(clientId));
  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  const orders = getSupplyOrders();
  const existing = orders.find(o => String(o.id) === String(id));

  if (existing) {
    // Update — preserve statusHistory
    existing.invoiceNumber = invoiceNumber;
    existing.clientId      = clientId;
    existing.clientName    = client?.name || '';
    existing.orderDate     = orderDate;
    existing.notes         = notes;
    existing.items         = items;
    existing.grandTotal    = grandTotal;
    existing.updatedAt     = new Date().toISOString();
    updateState('supplyOrders', () => orders);
  } else {
    const timestamp = new Date().toISOString();
    const newOrder = {
      id, invoiceNumber, clientId,
      clientName: client?.name || '',
      orderDate, notes, items, grandTotal,
      status: 'DRAFTED',
      statusHistory: [{ status: 'DRAFTED', changedAt: timestamp, note: 'Order created' }],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    orders.push(newOrder);
    updateState('supplyOrders', () => orders);
  }

  closeModal('supplyOrderModal');
  renderSupplyTable();
  showNotification('Supply order saved', 'success');
}

function deleteSupplyOrder(orderId) {
  if (!confirm('Delete this supply order?')) return;
  updateState('supplyOrders', () => getSupplyOrders().filter(o => String(o.id) !== String(orderId)));
  renderSupplyTable();
  showNotification('Order deleted', 'success');
}

/* ── Status advancement ── */
function advanceSupplyStatus(orderId) {
  const orders  = getSupplyOrders();
  const order   = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const currentIdx = SUPPLY_STATUSES.indexOf(order.status);
  if (currentIdx === -1 || currentIdx >= SUPPLY_STATUSES.length - 1) {
    showNotification('Order is already at final status', 'info');
    return;
  }

  const nextStatus = SUPPLY_STATUSES[currentIdx + 1];
  const note = prompt(`Note for status change to ${SUPPLY_STATUS_LABELS[nextStatus]} (optional):`) || '';
  const timestamp = new Date().toISOString();

  order.status = nextStatus;
  order.updatedAt = timestamp;
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: nextStatus, changedAt: timestamp, note });

  updateState('supplyOrders', () => orders);
  renderSupplyTable();
  showNotification(`Order advanced to ${SUPPLY_STATUS_LABELS[nextStatus]}`, 'success');
}

function cancelSupplyOrder(orderId) {
  if (!confirm('Cancel this supply order?')) return;
  const orders = getSupplyOrders();
  const order  = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const timestamp = new Date().toISOString();
  order.status    = 'CANCELLED';
  order.updatedAt = timestamp;
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: 'CANCELLED', changedAt: timestamp, note: 'Manually cancelled' });

  updateState('supplyOrders', () => orders);
  renderSupplyTable();
  showNotification('Order cancelled', 'success');
}

/* ── Status badge ── */
function supplyStatusBadge(status) {
  const map = {
    DRAFTED:   'background:#f4f4f4;color:#555;border:1px solid #e0e0e0;',
    ORDERED:   'background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;',
    DELIVERED: 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;',
    INVOICED:  'background:#fdf4ff;color:#7e22ce;border:1px solid #e9d5ff;',
    PAID:      'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;',
    CANCELLED: 'background:#f9fafb;color:#9ca3af;border:1px solid #e5e7eb;',
    PARTIAL:   'background:#fff7ed;color:#b45309;border:1px solid #fed7aa;'
  };
  const style = map[status] || map.DRAFTED;
  const label = SUPPLY_STATUS_LABELS[status] || status;
  return `<span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;
    font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;${style}">${escapeHtml(label)}</span>`;
}

/* ── Supply table render ── */
function renderSupplyTable() {
  const tbody = document.querySelector('#supplyTable tbody');
  if (!tbody) return;

  const statusFilter  = document.getElementById('supplyStatusFilter')?.value  || '';
  const clientFilter  = document.getElementById('supplyClientFilter')?.value  || '';
  const fromDate = document.getElementById('supplyFromDate')?.value
    ? new Date(`${document.getElementById('supplyFromDate').value}T00:00:00`) : null;
  const toDate = document.getElementById('supplyToDate')?.value
    ? new Date(`${document.getElementById('supplyToDate').value}T23:59:59`) : null;

  let orders = getSupplyOrders().filter(o => {
    const d = new Date(o.orderDate || o.createdAt);
    if (fromDate && d < fromDate) return false;
    if (toDate   && d > toDate)   return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (clientFilter && o.clientId !== clientFilter) return false;
    return true;
  });

  tbody.innerHTML = '';

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No supply orders found</td></tr>`;
    return;
  }

  orders.slice().reverse().forEach(order => {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];

    // Extract key timestamps from history
    const getTs = status => {
      const entry = history.find(h => h.status === status);
      return entry ? new Date(entry.changedAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'2-digit' }) : '—';
    };

    const isPaid      = order.status === 'PAID';
    const isCancelled = order.status === 'CANCELLED';
    const canAdvance  = !isPaid && !isCancelled;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-family:var(--font-mono);font-size:11px;font-weight:700;">
        ${escapeHtml(order.invoiceNumber || '')}
      </td>
      <td style="font-weight:700;">${escapeHtml(order.clientName || '—')}</td>
      <td>${order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'2-digit'}) : '—'}</td>
      <td>
        <div style="display:grid;gap:2px;">
          ${SUPPLY_STATUSES.map(s => {
            const entry = history.find(h => h.status === s);
            if (!entry) return `<div style="font-size:10px;color:var(--gray-300);">
              ${SUPPLY_STATUS_LABELS[s]}: —</div>`;
            const d = new Date(entry.changedAt);
            return `<div style="font-size:10px;color:var(--gray-600);">
              <span style="font-weight:700;">${SUPPLY_STATUS_LABELS[s]}:</span>
              ${d.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'2-digit'})}
              ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
              ${entry.note ? `<span style="color:var(--gray-400);"> · ${escapeHtml(entry.note)}</span>` : ''}
            </div>`;
          }).join('')}
          ${history.find(h => h.status === 'CANCELLED')
            ? `<div style="font-size:10px;color:var(--danger);font-weight:700;">CANCELLED</div>` : ''}
        </div>
      </td>
      <td style="font-weight:700;font-variant-numeric:tabular-nums;">
        ${formatCurrency(order.grandTotal || 0)}
      </td>
      <td>${supplyStatusBadge(order.status)}</td>
      <td style="font-size:11px;color:var(--gray-400);max-width:120px;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(order.notes||'')}">
        ${escapeHtml(order.notes || '—')}
      </td>
      <td>
        <div class="table-actions">
          ${canAdvance
            ? `<button class="btn btn-sm" data-action="advance-supply-status" data-id="${order.id}">
                Advance →</button>` : ''}
          <button class="btn btn-sm btn-secondary" data-action="edit-supply-order" data-id="${order.id}">Edit</button>
          ${canAdvance
            ? `<button class="btn btn-sm btn-secondary" data-action="cancel-supply-order" data-id="${order.id}">Cancel</button>`
            : ''}
          <button class="btn btn-sm btn-secondary" data-action="delete-supply-order" data-id="${order.id}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

/* ── Supply summary KPIs ── */
function renderSupplyKPIs() {
  const orders    = getSupplyOrders();
  const total     = orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
  const paid      = orders.filter(o => o.status === 'PAID').reduce((s,o) => s + Number(o.grandTotal||0), 0);
  const pending   = orders.filter(o => !['PAID','CANCELLED'].includes(o.status)).length;
  const overdue   = orders.filter(o => o.status === 'DELIVERED' || o.status === 'INVOICED').length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('supplyTotalRevenue',  formatCurrency(total));
  set('supplyTotalPaid',     formatCurrency(paid));
  set('supplyPendingCount',  pending);
  set('supplyOverdueCount',  overdue);
}

/* ── CSV Export for Google Sheets ── */
function exportSupplyCSV() {
  const orders = getSupplyOrders();
  if (!orders.length) { showNotification('No orders to export', 'error'); return; }

  const getTs = (order, status) => {
    const entry = (order.statusHistory || []).find(h => h.status === status);
    return entry ? new Date(entry.changedAt).toLocaleString('en-PH') : '';
  };

  const headers = [
    'Invoice #','Client','Order Date','Items','Grand Total',
    'Status','Drafted At','Ordered At','Delivered At','Invoiced At','Paid At',
    'Cancelled At','Notes'
  ];

  const rows = orders.map(o => {
    const itemSummary = (o.items || []).map(i => `${i.description} x${i.qty}`).join('; ');
    return [
      `"${o.invoiceNumber || ''}"`,
      `"${o.clientName    || ''}"`,
      `"${o.orderDate     || ''}"`,
      `"${itemSummary}"`,
      Number(o.grandTotal || 0).toFixed(2),
      `"${o.status || ''}"`,
      `"${getTs(o,'DRAFTED')}"`,
      `"${getTs(o,'ORDERED')}"`,
      `"${getTs(o,'DELIVERED')}"`,
      `"${getTs(o,'INVOICED')}"`,
      `"${getTs(o,'PAID')}"`,
      `"${getTs(o,'CANCELLED')}"`,
      `"${(o.notes||'').replace(/"/g,'""')}"`
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadTextFile(`supply-orders-${new Date().toISOString().slice(0,10)}.csv`, csv);
  showNotification('Supply orders exported — ready for Google Sheets', 'success');
}

/* ── Nav toggle based on setting ── */
function applySupplierModeToggle() {
  const enabled = APP_STATE.settings?.supplierModeEnabled === true;
  const navBtn  = document.getElementById('navSupply');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';
}

/* ── Full render entry point ── */
function renderSupplyView() {
  renderSupplyKPIs();
  renderSupplyTable();
  renderClientDropdowns();
  const filterClients = document.getElementById('supplyClientFilter');
  if (filterClients) {
    const clients = getSupplierClients();
    filterClients.innerHTML = `<option value="">All Clients</option>` +
      clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }
}

/* ── Exports ── */
window.getSupplyOrders        = getSupplyOrders;
window.getSupplierClients     = getSupplierClients;
window.saveSupplierClient     = saveSupplierClient;
window.deleteSupplierClient   = deleteSupplierClient;
window.openClientModal        = openClientModal;
window.renderClientsList      = renderClientsList;
window.renderClientDropdowns  = renderClientDropdowns;
window.openSupplyOrderModal   = openSupplyOrderModal;
window.saveSupplyOrder        = saveSupplyOrder;
window.deleteSupplyOrder      = deleteSupplyOrder;
window.advanceSupplyStatus    = advanceSupplyStatus;
window.cancelSupplyOrder      = cancelSupplyOrder;
window.addSupplyLineItemRow   = addSupplyLineItemRow;
window.renderSupplyTable      = renderSupplyTable;
window.renderSupplyKPIs       = renderSupplyKPIs;
window.renderSupplyView       = renderSupplyView;
window.exportSupplyCSV        = exportSupplyCSV;
window.applySupplierModeToggle= applySupplierModeToggle;
