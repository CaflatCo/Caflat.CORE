
function _createSupplySalesRecord(order) {
  if (!order || order.salesRecordId) return;

  const sales = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  const saleId = `SUP-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  const sale = {
    id: saleId,
    orderNumber: order.invoiceNumber || order.orderNumber || saleId,
    customerName: order.clientName || order.client || 'Supply Client',
    channel: 'SUPPLY',
    source: 'SUPPLY_ORDER',
    sourceOrderId: order.id,
    paymentStatus: 'PAID',
    status: 'COMPLETED',
    total: Number(order.grandTotal || order.total || 0),
    createdAt: new Date().toISOString(),
    items: Array.isArray(order.items) ? order.items : []
  };

  sales.push(sale);
  updateState('sales', () => sales);

  order.salesRecordId = saleId;

  if (typeof refreshDashboard === 'function') refreshDashboard();
  if (typeof renderSalesTable === 'function') renderSalesTable();
}

/* ═══════════════════════════════════════════════════════
   SUPPLY.JS — Supplier Order Tracking v2
   Product-linked line items (productId required).
   Inventory integration:
     ORDERED   → reserve stock (soft hold)
     DELIVERED → deduct stock (hard deduction)
     CANCELLED → release reservation
     VOIDED    → release reservation
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
  VOIDED:    'Voided'
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

/* ═══════════════════════════════════════════════════════
   CLIENT MANAGEMENT
═══════════════════════════════════════════════════════ */

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
    clients.push({ id: generateId(), name, contact, email, address,
      createdAt: new Date().toISOString() });
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
  updateState('supplierClients', () =>
    getSupplierClients().filter(c => String(c.id) !== String(clientId)));
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
      clients.map(c =>
        `<option value="${c.id}"${current === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`
      ).join('');
  });
}

/* ═══════════════════════════════════════════════════════
   PRODUCT-LINKED LINE ITEMS
   Each row has a product dropdown (productId required).
   Supplier price defaults to product retail price.
   Qty defaults to 1, editable.
═══════════════════════════════════════════════════════ */

function buildProductOptions(selectedProductId = '') {
  const products = Array.isArray(APP_STATE.products) ? APP_STATE.products : [];
  return `<option value="">Select Product</option>` +
    products.map(p =>
      `<option value="${p.id}" data-price="${Number(p.price||0)}"
        ${String(selectedProductId) === String(p.id) ? ' selected' : ''}>
        ${escapeHtml(p.name)}
      </option>`
    ).join('');
}

function addSupplyLineItemRow(item = null) {
  const container = document.getElementById('supplyLineItems');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'supply-line-row';
  row.dataset.productId = item?.productId || '';

  row.innerHTML = `
    <select class="supply-item-product" style="flex:2;padding:7px 10px;
      border:1px solid var(--gray-200);border-radius:var(--radius-md);
      font-family:var(--font-main);font-size:12px;background:var(--white);">
      ${buildProductOptions(item?.productId || '')}
    </select>
    <input type="number" class="supply-item-qty" placeholder="Qty"
      value="${item?.qty || 1}" min="0.01" step="0.01"
      style="width:72px;padding:7px 10px;border:1px solid var(--gray-200);
        border-radius:var(--radius-md);font-family:var(--font-main);font-size:12px;" />
    <input type="number" class="supply-item-price" placeholder="Unit Price"
      value="${item?.unitPrice || ''}" min="0" step="0.01"
      style="width:110px;padding:7px 10px;border:1px solid var(--gray-200);
        border-radius:var(--radius-md);font-family:var(--font-main);font-size:12px;" />
    <div class="supply-item-total"
      style="width:90px;text-align:right;font-weight:800;font-size:13px;
        font-variant-numeric:tabular-nums;flex-shrink:0;">
      ${item ? formatCurrency((item.qty||0) * (item.unitPrice||0)) : '₱0.00'}
    </div>
    <button type="button" class="btn btn-sm btn-secondary supply-remove-line"
      style="flex-shrink:0;">✕</button>`;

  // Product select → auto-fill price from product retail price
  const productSelect = row.querySelector('.supply-item-product');
  const priceInput    = row.querySelector('.supply-item-price');

  productSelect.addEventListener('change', () => {
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const retailPrice    = Number(selectedOption?.dataset?.price || 0);
    // Only auto-fill if price is currently empty
    if (!priceInput.value && retailPrice > 0) {
      priceInput.value = retailPrice;
    }
    row.dataset.productId = productSelect.value;
    updateSupplyLineTotal(row);
  });

  row.querySelector('.supply-item-qty')?.addEventListener('input',   () => updateSupplyLineTotal(row));
  row.querySelector('.supply-item-price')?.addEventListener('input', () => updateSupplyLineTotal(row));

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
  let total = 0;
  document.querySelectorAll('#supplyLineItems .supply-line-row').forEach(row => {
    total += Number(row.querySelector('.supply-item-qty')?.value   || 0) *
             Number(row.querySelector('.supply-item-price')?.value || 0);
  });
  const el = document.getElementById('supplyOrderTotal');
  if (el) el.textContent = formatCurrency(total);
}

function collectSupplyLineItems() {
  return Array.from(document.querySelectorAll('#supplyLineItems .supply-line-row'))
    .map(row => {
      const productId   = row.querySelector('.supply-item-product')?.value || '';
      const qty         = Number(row.querySelector('.supply-item-qty')?.value   || 0);
      const unitPrice   = Number(row.querySelector('.supply-item-price')?.value || 0);
      const product     = (APP_STATE.products||[]).find(p => String(p.id) === String(productId));
      if (!productId || !product) return null;
      return {
        productId,
        productName: product.name,
        description: product.name,          // kept for CSV/display compat
        qty,
        unitPrice,
        total: qty * unitPrice,
        multiplier: 1                       // supply orders are always unit-based
      };
    })
    .filter(Boolean);
}

/* ═══════════════════════════════════════════════════════
   SUPPLY ORDER CRUD
═══════════════════════════════════════════════════════ */

function openSupplyOrderModal(orderId = null) {
  clearSupplyOrderForm();
  renderClientDropdowns();
  renderSupplyLineItems([]);

  if (orderId) {
    const order = getSupplyOrderById(orderId);
    if (order) hydrateSupplyOrderForm(order);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    setElementValue('supplyOrderDate',     today);
    setElementValue('supplyInvoiceNumber', generateInvoiceNumber());
  }
  openModal('supplyOrderModal');
}

function hydrateSupplyOrderForm(order) {
  setElementValue('supplyOrderId',       order.id);
  setElementValue('supplyInvoiceNumber', order.invoiceNumber);
  setElementValue('supplyOrderDate',     order.orderDate || '');
  setElementValue('supplyNotes',         order.notes || '');
  const clientSelect = document.getElementById('supplyClientSelect');
  if (clientSelect) clientSelect.value = order.clientId || '';
  renderSupplyLineItems(order.items || []);
}

function renderSupplyLineItems(items = []) {
  const container = document.getElementById('supplyLineItems');
  if (!container) return;
  container.innerHTML = '';
  if (!items.length) {
    addSupplyLineItemRow(); // always start with one empty row
    return;
  }
  items.forEach(item => addSupplyLineItemRow(item));
}

function clearSupplyOrderForm() {
  ['supplyOrderId','supplyInvoiceNumber','supplyOrderDate','supplyNotes']
    .forEach(id => setElementValue(id, ''));
  const container = document.getElementById('supplyLineItems');
  if (container) container.innerHTML = '';
}

function saveSupplyOrder() {
  const id            = getElementValue('supplyOrderId') || generateId();
  const invoiceNumber = sanitizeText(getElementValue('supplyInvoiceNumber'));
  const clientId      = document.getElementById('supplyClientSelect')?.value || '';
  const orderDate     = getElementValue('supplyOrderDate');
  const notes         = sanitizeText(getElementValue('supplyNotes'));
  const items         = collectSupplyLineItems();

  if (!clientId)    { showNotification('Please select a client',          'error'); return; }
  if (!orderDate)   { showNotification('Order date is required',           'error'); return; }
  if (!items.length){ showNotification('Add at least one product line',    'error'); return; }

  const client     = getSupplierClients().find(c => String(c.id) === String(clientId));
  const grandTotal = items.reduce((s, i) => s + i.total, 0);
  const orders     = getSupplyOrders();
  const existing   = orders.find(o => String(o.id) === String(id));

  if (existing) {
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
    orders.push({
      id, invoiceNumber, clientId,
      clientName: client?.name || '',
      orderDate, notes, items, grandTotal,
      status: 'DRAFTED',
      reservedStock: false,
      stockDeducted: false,
      statusHistory: [{ status: 'DRAFTED', changedAt: timestamp, note: 'Order created' }],
      createdAt: timestamp,
      updatedAt: timestamp
    });
    updateState('supplyOrders', () => orders);
  }

  closeModal('supplyOrderModal');
  renderSupplyTable();
  showNotification('Supply order saved', 'success');
}

function deleteSupplyOrder(orderId) {
  if (!confirm('Delete this supply order?')) return;
  const order = getSupplyOrderById(orderId);
  // Release any reservation before deleting
  if (order?.reservedStock) _releaseSupplyReservation(order);
  updateState('supplyOrders', () => getSupplyOrders().filter(o => String(o.id) !== String(orderId)));
  renderSupplyTable();
  showNotification('Order deleted', 'success');
}

/* ═══════════════════════════════════════════════════════
   INVENTORY INTEGRATION
   ORDERED   → reserve (soft hold — reduces available qty)
   DELIVERED → hard deduct (uses same engine as POS sales)
   CANCELLED/VOIDED → release reservation
═══════════════════════════════════════════════════════ */

/* Build a cart-compatible array from supply order items */
function _supplyItemsToCart(order) {
  return (order.items || []).map(item => ({
    productId:  item.productId,
    name:       item.productName || item.description || '',
    quantity:   Number(item.qty || 0),
    multiplier: 1,
    price:      Number(item.unitPrice || 0),
    total:      Number(item.total || 0)
  }));
}

/* ORDERED — reserve stock (subtract from available, not from actual stock) */
function _reserveSupplyStock(order) {
  // We record reservation in a separate field so available = stock - reserved
  const reservations = Array.isArray(APP_STATE.stockReservations)
    ? APP_STATE.stockReservations : [];

  (order.items || []).forEach(item => {
    reservations.push({
      id:        generateId(),
      orderId:   order.id,
      productId: item.productId,
      qty:       Number(item.qty || 0),
      createdAt: new Date().toISOString()
    });
  });

  updateState('stockReservations', () => reservations);

  _logInventoryMovements(order, 'supply-reservation', 0,
    `Reserved for supply order ${order.invoiceNumber}`);
}

/* CANCELLED / VOIDED — release reservation */
function _releaseSupplyReservation(order) {
  const reservations = (APP_STATE.stockReservations || [])
    .filter(r => String(r.orderId) !== String(order.id));
  updateState('stockReservations', () => reservations);

  _logInventoryMovements(order, 'supply-reservation-released', 0,
    `Reservation released: ${order.invoiceNumber}`);
}

/* DELIVERED — hard deduct using same engine as POS sales */
function _deductSupplyStock(order) {
  const cart = _supplyItemsToCart(order);
  if (!cart.length) return;

  // Deduct product stock
  const updatedProducts = (APP_STATE.products || []).map(product => {
    const units = cart.reduce((sum, line) => {
      if (String(line.productId) !== String(product.id)) return sum;
      return sum + Number(line.quantity || 0);
    }, 0);
    if (!units) return product;
    return { ...product, stock: Math.max(0, Number(product.stock || 0) - units) };
  });
  updateState('products', () => updatedProducts);

  // Deduct ingredient stock via recipe
  const ingredientDeltas = new Map();
  cart.forEach(line => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(line.productId));
    if (!product || !Array.isArray(product.recipe)) return;
    const batchYield = Math.max(1, Number(product.batchYield || 1));
    const recipeMode = String(product.recipeMode || 'unit');
    product.recipe.forEach(ri => {
      const perUnit = recipeMode === 'batch'
        ? Number(ri.quantity||0) / batchYield
        : Number(ri.quantity||0);
      ingredientDeltas.set(ri.ingredientId,
        (ingredientDeltas.get(ri.ingredientId) || 0) + perUnit * Number(line.quantity||0));
    });
  });

  if (ingredientDeltas.size) {
    const updatedIngredients = (APP_STATE.ingredients || []).map(ing => {
      const used = ingredientDeltas.get(ing.id);
      if (!used) return ing;
      return { ...ing, stock: Math.max(0, Number(ing.stock||0) - used) };
    });
    updateState('ingredients', () => updatedIngredients);
  }

  // Release reservation now that stock is hard-deducted
  _releaseSupplyReservation(order);

  _logInventoryMovements(order, 'supply-delivery-deduction', 0,
    `Stock deducted on delivery: ${order.invoiceNumber}`);

  // Refresh product/inventory views
  if (typeof renderProductsTable   === 'function') renderProductsTable();
  if (typeof renderInventoryTable  === 'function') renderInventoryTable();
  if (typeof renderPOSProducts     === 'function') renderPOSProducts();
  if (typeof refreshDashboard      === 'function') refreshDashboard();
}

function _logInventoryMovements(order, type, qty, reason) {
  const movements = Array.isArray(APP_STATE.inventoryMovements)
    ? APP_STATE.inventoryMovements : [];

  (order.items || []).forEach(item => {
    movements.push({
      id:             generateId(),
      orderId:        order.id,
      invoiceNumber:  order.invoiceNumber,
      productId:      item.productId,
      productName:    item.productName || item.description || '',
      type,
      quantityAdded:  0,
      quantityUsed:   Number(item.qty || 0),
      reason,
      createdAt:      new Date().toISOString(),
      createdBy:      APP_STATE.currentUserRole || 'STAFF'
    });
  });

  updateState('inventoryMovements', () => movements);
}

/* ── Overselling guard for supply orders ── */
function _checkSupplyStockAvailability(order) {
  const errors = [];
  const reservations = Array.isArray(APP_STATE.stockReservations)
    ? APP_STATE.stockReservations : [];

  (order.items || []).forEach(item => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
    if (!product) return;

    // Total reserved by OTHER orders (not this one)
    const alreadyReserved = reservations
      .filter(r => String(r.productId) === String(item.productId) &&
                   String(r.orderId) !== String(order.id))
      .reduce((s, r) => s + Number(r.qty || 0), 0);

    const available = Number(product.stock || 0) - alreadyReserved;
    const requested = Number(item.qty || 0);

    if (requested > available) {
      errors.push(`${product.name}: need ${requested}, only ${available} available`);
    }
  });
  return errors;
}

/* ═══════════════════════════════════════════════════════
   STATUS ADVANCEMENT with inventory hooks
═══════════════════════════════════════════════════════ */

function advanceSupplyStatus(orderId) {
  const orders = getSupplyOrders();
  const order  = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const currentIdx = SUPPLY_STATUSES.indexOf(order.status);
  if (currentIdx === -1 || currentIdx >= SUPPLY_STATUSES.length - 1) {
    showNotification('Order is already at final status', 'info');
    return;
  }

  const nextStatus  = SUPPLY_STATUSES[currentIdx + 1];
  const nextLabel   = SUPPLY_STATUS_LABELS[nextStatus];

  // ── ORDERED: reserve stock ──
  if (nextStatus === 'ORDERED' && !order.reservedStock) {
    const errors = _checkSupplyStockAvailability(order);
    if (errors.length) {
      if (!confirm(`Stock warning:\n${errors.join('\n')}\n\nProceed anyway?`)) return;
    }
    _reserveSupplyStock(order);
    order.reservedStock = true;
  }

  // ── PAID: create sales record ──
  if (nextStatus === 'PAID' && !order.salesRecordId) {
    _createSupplySalesRecord(order);
  }

  // ── DELIVERED: hard deduct ──
  if (nextStatus === 'DELIVERED' && !order.stockDeducted) {
    if (!confirm(`Mark as Delivered?\nThis will permanently deduct stock for all line items.`)) return;
    _deductSupplyStock(order);
    order.stockDeducted  = true;
    order.reservedStock  = false;
  }

  const note      = window.prompt(`Note for "${nextLabel}" (optional):`) || '';
  const timestamp = new Date().toISOString();

  order.status    = nextStatus;
  order.updatedAt = timestamp;
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: nextStatus, changedAt: timestamp, note });

  updateState('supplyOrders', () => orders);
  renderSupplyTable();
  renderSupplyKPIs();
  showNotification(`Order advanced to ${nextLabel}`, 'success');
}

function cancelSupplyOrder(orderId) {
  if (!confirm('Cancel this supply order?')) return;
  const orders = getSupplyOrders();
  const order  = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  // Release reservation if exists
  if (order.reservedStock) {
    _releaseSupplyReservation(order);
    order.reservedStock = false;
  }

  const timestamp = new Date().toISOString();
  order.status    = 'CANCELLED';
  order.updatedAt = timestamp;
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: 'CANCELLED', changedAt: timestamp, note: 'Manually cancelled' });

  updateState('supplyOrders', () => orders);
  renderSupplyTable();
  showNotification('Order cancelled — reservation released', 'success');
}

/* ═══════════════════════════════════════════════════════
   STATUS BADGE
═══════════════════════════════════════════════════════ */

function supplyStatusBadge(status) {
  const styles = {
    DRAFTED:   'background:#f4f4f4;color:#555;border:1px solid #e0e0e0;',
    ORDERED:   'background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;',
    DELIVERED: 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;',
    INVOICED:  'background:#fdf4ff;color:#7e22ce;border:1px solid #e9d5ff;',
    PAID:      'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;',
    CANCELLED: 'background:#f9fafb;color:#9ca3af;border:1px solid #e5e7eb;',
    VOIDED:    'background:#f9fafb;color:#9ca3af;border:1px solid #e5e7eb;'
  };
  const style = styles[status] || styles.DRAFTED;
  return `<span style="display:inline-flex;align-items:center;padding:3px 10px;
    border-radius:999px;font-size:9px;font-weight:800;letter-spacing:1px;
    text-transform:uppercase;${style}">${escapeHtml(SUPPLY_STATUS_LABELS[status] || status)}</span>`;
}

/* ═══════════════════════════════════════════════════════
   SUPPLY TABLE RENDER
═══════════════════════════════════════════════════════ */

function renderSupplyTable() {
  const tbody = document.querySelector('#supplyTable tbody');
  if (!tbody) return;

  const statusFilter = document.getElementById('supplyStatusFilter')?.value || '';
  const clientFilter = document.getElementById('supplyClientFilter')?.value || '';
  const fromDate = document.getElementById('supplyFromDate')?.value
    ? new Date(`${document.getElementById('supplyFromDate').value}T00:00:00`) : null;
  const toDate = document.getElementById('supplyToDate')?.value
    ? new Date(`${document.getElementById('supplyToDate').value}T23:59:59`) : null;

  const orders = getSupplyOrders().filter(o => {
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
    const getTs   = status => {
      const e = history.find(h => h.status === status);
      return e ? new Date(e.changedAt).toLocaleDateString('en-PH',
        { month:'short', day:'numeric', year:'2-digit' }) : '—';
    };

    const isPaid      = order.status === 'PAID';
    const isCancelled = ['CANCELLED','VOIDED'].includes(order.status);
    const canAdvance  = !isPaid && !isCancelled;

    // Item summary — product names
    const itemSummary = (order.items||[])
      .map(i => `${escapeHtml(i.productName||i.description||'')} ×${i.qty}`)
      .join(', ');

    tbody.innerHTML += `
      <tr>
        <td style="font-family:var(--font-mono);font-size:11px;font-weight:700;">
          ${escapeHtml(order.invoiceNumber||'')}</td>
        <td style="font-weight:700;">${escapeHtml(order.clientName||'—')}</td>
        <td style="font-size:11px;max-width:140px;overflow:hidden;
          text-overflow:ellipsis;white-space:nowrap;" title="${itemSummary}">
          ${itemSummary||'—'}</td>
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
                ${entry.note
                  ? `<span style="color:var(--gray-400);"> · ${escapeHtml(entry.note)}</span>`
                  : ''}
              </div>`;
            }).join('')}
          </div>
        </td>
        <td style="font-weight:800;font-variant-numeric:tabular-nums;">
          ${formatCurrency(order.grandTotal||0)}</td>
        <td>${supplyStatusBadge(order.status)}
          ${order.reservedStock
            ? `<div style="font-size:9px;color:#c2410c;font-weight:700;
                letter-spacing:1px;margin-top:3px;">STOCK RESERVED</div>` : ''}
          ${order.stockDeducted
            ? `<div style="font-size:9px;color:#1d4ed8;font-weight:700;
                letter-spacing:1px;margin-top:3px;">STOCK DEDUCTED</div>` : ''}
        </td>
        <td style="font-size:11px;color:var(--gray-400);max-width:100px;overflow:hidden;
          text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(order.notes||'')}">
          ${escapeHtml(order.notes||'—')}</td>
        <td>
          <div class="table-actions">
            ${canAdvance
              ? `<button class="btn btn-sm" data-action="advance-supply-status"
                  data-id="${order.id}">Advance →</button>` : ''}
            <button class="btn btn-sm btn-secondary" data-action="edit-supply-order"
              data-id="${order.id}">Edit</button>
            ${canAdvance
              ? `<button class="btn btn-sm btn-secondary" data-action="cancel-supply-order"
                  data-id="${order.id}">Cancel</button>` : ''}
            <button class="btn btn-sm btn-secondary" data-action="delete-supply-order"
              data-id="${order.id}">Delete</button>
          </div>
        </td>
      </tr>`;
  });
}

/* ═══════════════════════════════════════════════════════
   KPI CARDS
═══════════════════════════════════════════════════════ */

function renderSupplyKPIs() {
  const orders  = getSupplyOrders();
  const total   = orders.reduce((s,o) => s + Number(o.grandTotal||0), 0);
  const paid    = orders.filter(o => o.status==='PAID')
                        .reduce((s,o) => s + Number(o.grandTotal||0), 0);
  const pending = orders.filter(o => !['PAID','CANCELLED','VOIDED'].includes(o.status)).length;
  const awaitingPayment = orders.filter(o =>
    ['DELIVERED','INVOICED'].includes(o.status)).length;

  const set = (id,v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('supplyTotalRevenue',  formatCurrency(total));
  set('supplyTotalPaid',     formatCurrency(paid));
  set('supplyPendingCount',  pending);
  set('supplyOverdueCount',  awaitingPayment);
}

/* ═══════════════════════════════════════════════════════
   CSV EXPORT
═══════════════════════════════════════════════════════ */

function exportSupplyCSV() {
  const orders = getSupplyOrders();
  if (!orders.length) { showNotification('No orders to export', 'error'); return; }

  const getTs = (order, status) => {
    const e = (order.statusHistory||[]).find(h => h.status === status);
    return e ? new Date(e.changedAt).toLocaleString('en-PH') : '';
  };

  const headers = ['Invoice #','Client','Order Date','Products','Grand Total',
    'Status','Stock Reserved','Stock Deducted',
    'Drafted At','Ordered At','Delivered At','Invoiced At','Paid At',
    'Cancelled At','Notes'];

  const rows = orders.map(o => {
    const productSummary = (o.items||[])
      .map(i => `${i.productName||i.description||''} x${i.qty} @${i.unitPrice}`)
      .join('; ');
    return [
      `"${o.invoiceNumber||''}"`,
      `"${o.clientName||''}"`,
      `"${o.orderDate||''}"`,
      `"${productSummary}"`,
      Number(o.grandTotal||0).toFixed(2),
      `"${o.status||''}"`,
      o.reservedStock ? 'YES' : 'NO',
      o.stockDeducted ? 'YES' : 'NO',
      `"${getTs(o,'DRAFTED')}"`,
      `"${getTs(o,'ORDERED')}"`,
      `"${getTs(o,'DELIVERED')}"`,
      `"${getTs(o,'INVOICED')}"`,
      `"${getTs(o,'PAID')}"`,
      `"${getTs(o,'CANCELLED')}"`,
      `"${(o.notes||'').replace(/"/g,'""')}"`
    ].join(',');
  });

  downloadTextFile(
    `supply-orders-${new Date().toISOString().slice(0,10)}.csv`,
    [headers.join(','), ...rows].join('\n')
  );
  showNotification('Supply orders exported', 'success');
}

/* ═══════════════════════════════════════════════════════
   CART → SUPPLY ORDER CONVERSION
═══════════════════════════════════════════════════════ */

function openSupplierOrderPrompt() {
  const cart    = typeof getCart === 'function' ? getCart() : [];
  const clients = getSupplierClients();

  if (!cart.length)    { showNotification('Cart is empty', 'error'); return; }
  if (!clients.length) { showNotification('Add a client in the Supply tab first', 'error'); return; }

  renderClientDropdowns();
  setElementValue('supplierOrderInvoiceNum',    generateInvoiceNumber());
  setElementValue('supplierOrderDeliveryDate',
    new Date(Date.now() + 86400000).toISOString().slice(0,10));
  setElementValue('supplierOrderNotes', '');

  renderSupplierOrderCartSummary(cart);
  openModal('supplierOrderPromptModal');
}

function renderSupplierOrderCartSummary(cart) {
  const container = document.getElementById('supplierOrderCartSummary');
  const totalEl   = document.getElementById('supplierOrderCartTotal');
  if (!container) return;

  let grandTotal = 0;
  container.innerHTML = cart.map(item => {
    const lineTotal = Number(item.price||0) * Number(item.quantity||0);
    grandTotal += lineTotal;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:5px 0;border-bottom:1px solid var(--gray-100);font-size:12px;">
        <div>
          <span style="font-weight:700;">${escapeHtml(item.name)}</span>
          <span style="color:var(--gray-400);margin-left:6px;">
            ×${item.quantity} @ ${formatCurrency(item.price)}
          </span>
        </div>
        <span style="font-weight:800;">${formatCurrency(lineTotal)}</span>
      </div>`;
  }).join('');

  if (totalEl) totalEl.textContent = formatCurrency(grandTotal);
}

function confirmSupplierOrder() {
  const cart         = typeof getCart === 'function' ? getCart() : [];
  const clientId     = document.getElementById('supplierOrderClientSelect')?.value || '';
  const notes        = sanitizeText(getElementValue('supplierOrderNotes'));
  const deliveryDate = getElementValue('supplierOrderDeliveryDate');
  const invoiceNumber= getElementValue('supplierOrderInvoiceNum');

  if (!cart.length) { showNotification('Cart is empty', 'error'); return; }
  if (!clientId)    { showNotification('Please select a client', 'error'); return; }

  const client    = getSupplierClients().find(c => String(c.id) === String(clientId));
  const timestamp = new Date().toISOString();

  // Cart items are already product-linked — convert directly
  const items = cart.map(item => ({
    productId:   item.productId,
    productName: item.name,
    description: item.name,
    qty:         Number(item.quantity||0) * Number(item.multiplier||1),
    unitPrice:   Number(item.price||0),
    total:       Number(item.price||0) * Number(item.quantity||0),
    multiplier:  1
  }));

  const subtotal   = items.reduce((s,i) => s + i.total, 0);
  const discount   = typeof calculateCartDiscount === 'function' ? calculateCartDiscount() : 0;
  const tax        = typeof calculateCartTax      === 'function' ? calculateCartTax()      : 0;
  const grandTotal = Math.max(0, subtotal - discount + tax);

  const newOrder = {
    id: generateId(), invoiceNumber, clientId,
    clientName:   client?.name || '',
    orderDate:    new Date().toISOString().slice(0,10),
    deliveryDate: deliveryDate || '',
    notes, items, subtotal, discount, tax, grandTotal,
    status:        'ORDERED',
    reservedStock: false,
    stockDeducted: false,
    statusHistory: [
      { status:'DRAFTED',  changedAt: timestamp, note:'Auto-created from POS cart' },
      { status:'ORDERED',  changedAt: timestamp,
        note:`Converted from POS cart by ${APP_STATE.currentUserRole||'STAFF'}` }
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
    source:    'pos-cart'
  };

  // Reserve stock immediately since status starts at ORDERED
  _reserveSupplyStock(newOrder);
  newOrder.reservedStock = true;

  const orders = getSupplyOrders();
  orders.push(newOrder);
  updateState('supplyOrders', () => orders);

  if (typeof clearCart === 'function') clearCart(true);
  closeModal('supplierOrderPromptModal');
  renderSupplyTable();
  renderSupplyKPIs();
  showNotification(
    `Supply order ${invoiceNumber} created for ${client?.name||'client'} — stock reserved`,
    'success'
  );
}

/* ═══════════════════════════════════════════════════════
   NAV / CART BUTTON TOGGLE
═══════════════════════════════════════════════════════ */

function applySupplierModeToggle() {
  const enabled = APP_STATE.settings?.supplierModeEnabled === true;
  const navBtn  = document.getElementById('navSupply');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';
  if (typeof applySupplierCartButton === 'function') applySupplierCartButton();
}

function applySupplierCartButton() {
  const btn     = document.getElementById('supplierOrderBtn');
  const enabled = APP_STATE.settings?.supplierModeEnabled === true;
  if (btn) btn.style.display = enabled ? 'block' : 'none';
}

function renderSupplyView() {
  renderSupplyKPIs();
  renderSupplyTable();
  renderClientDropdowns();
  renderClientsList();

  const filterClients = document.getElementById('supplyClientFilter');
  if (filterClients) {
    const clients = getSupplierClients();
    filterClients.innerHTML = `<option value="">All Clients</option>` +
      clients.map(c =>
        `<option value="${c.id}">${escapeHtml(c.name)}</option>`
      ).join('');
  }
}

/* ── Exports ── */
window.getSupplyOrders          = getSupplyOrders;
window.getSupplierClients       = getSupplierClients;
window.saveSupplierClient       = saveSupplierClient;
window.deleteSupplierClient     = deleteSupplierClient;
window.openClientModal          = openClientModal;
window.renderClientsList        = renderClientsList;
window.renderClientDropdowns    = renderClientDropdowns;
window.openSupplyOrderModal     = openSupplyOrderModal;
window.saveSupplyOrder          = saveSupplyOrder;
window.deleteSupplyOrder        = deleteSupplyOrder;
window.advanceSupplyStatus      = advanceSupplyStatus;
window.cancelSupplyOrder        = cancelSupplyOrder;
window.addSupplyLineItemRow     = addSupplyLineItemRow;
window.renderSupplyTable        = renderSupplyTable;
window.renderSupplyKPIs         = renderSupplyKPIs;
window.renderSupplyView         = renderSupplyView;
window.exportSupplyCSV          = exportSupplyCSV;
window.applySupplierModeToggle  = applySupplierModeToggle;
window.applySupplierCartButton  = applySupplierCartButton;
window.openSupplierOrderPrompt  = openSupplierOrderPrompt;
window.confirmSupplierOrder     = confirmSupplierOrder;
