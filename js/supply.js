window.supplyTableLimit=5;

function _auditSupplyEvent(action, order, outcome='SUCCESS', details='') {
  try {
    if (typeof pushAuditEntry === 'function') {
      pushAuditEntry({
        action,
        outcome,
        referenceId: order?.id || '',
        invoiceNumber: order?.invoiceNumber || '',
        details: details || `${order?.clientName || ''}`
      });
    }
  } catch(e) { console.error(e); }
}


async function _createSupplySalesRecord(order) {
  if (!order || order.salesRecordId) return;

  const timestamp     = new Date().toISOString();
  const saleId        = typeof generateId === 'function' ? generateId()
                        : `SUP-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  // receiptNumber must match what _buildCanonicalString reads
  const receiptNumber = order.invoiceNumber || saleId;

  // Normalise items to match POS sale structure
  const items = (order.items || []).map(item => ({
    id:          typeof generateId === 'function' ? generateId() : String(Date.now()),
    productId:   item.productId   || '',
    variantId:   '',
    name:        item.productName || item.description || '',
    quantity:    Number(item.qty  || item.quantity || 0),
    multiplier:  1,
    price:       Number(item.unitPrice || item.price || 0),
    total:       Number(item.total     || 0)
  }));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = Number(order.discount || 0);
  const tax      = Number(order.tax      || 0);
  const total    = Number(order.grandTotal || subtotal);

  const sale = {
    id: saleId,
    receiptNumber,                        // canonical hash reads this field
    channel:       'SUPPLY',
    status:        'COMPLETED',
    paymentStatus: 'PAID',
    orderType:     'Supply Order',
    customer: {
      name:     order.clientName || 'B2B Client',
      clientId: order.clientId   || ''
    },
    payment: {
      method:          'invoice',
      tendered:        total,
      change:          0,
      referenceNumber: receiptNumber
    },
    totals: { subtotal, discount, tax, total },
    items,
    sourceOrderId: order.id,
    // Legacy flat fields for analytics compatibility
    customerName:  order.clientName || 'B2B Client',
    paymentMethod: 'invoice',
    subtotal, discount, tax, total,
    tendered: total, change: 0,
    referenceNumber: receiptNumber,
    createdAt:  timestamp,
    completedAt: timestamp,
    audit: {
      createdAt:   timestamp,
      completedAt: timestamp,
      completedBy: APP_STATE.currentUserRole || 'ADMIN'
    }
  };

  // Seal BEFORE pushing to state — await guarantees hash is present
  if (typeof sealTransaction === 'function') {
    await sealTransaction(sale);
  }

  const sales = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  sales.push(sale);
  updateState('sales', () => sales);

  order.salesRecordId = saleId;

  // Audit trail
  if (typeof pushAuditEntry === 'function') {
    pushAuditEntry({
      action:        'SUPPLY_SALE_CREATED',
      saleId:        saleId,
      receiptNumber: receiptNumber,
      referenceId:   order.id,
      invoiceNumber: order.invoiceNumber,
      total,
      outcome:       'SUCCESS',
      note:          `B2B sale created from supply order ${order.invoiceNumber} · ${order.clientName || ''}`
    });
  }

  if (typeof refreshDashboard  === 'function') refreshDashboard();
  if (typeof renderSalesTable  === 'function') renderSalesTable();
  if (typeof renderAuditLog    === 'function') renderAuditLog();
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
      padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-lg);
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
      border:1px solid var(--border);border-radius:var(--radius-md);
      font-family:var(--font-main);font-size:12px;background:var(--white);">
      ${buildProductOptions(item?.productId || '')}
    </select>
    <input type="number" class="supply-item-qty" placeholder="Qty"
      value="${item?.qty || 1}" min="0.01" step="0.01"
      style="width:72px;padding:7px 10px;border:1px solid var(--border);
        border-radius:var(--radius-md);font-family:var(--font-main);font-size:12px;" />
    <input type="number" class="supply-item-price" placeholder="Unit Price"
      value="${item?.unitPrice || ''}" min="0" step="0.01"
      style="width:110px;padding:7px 10px;border:1px solid var(--border);
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
  let subtotal = 0;
  document.querySelectorAll('#supplyLineItems .supply-line-row').forEach(row => {
    subtotal += Number(row.querySelector('.supply-item-qty')?.value   || 0) *
                Number(row.querySelector('.supply-item-price')?.value || 0);
  });
  const discountValue = Number(document.getElementById('supplyDiscountValue')?.value || 0);
  const discountType  = document.getElementById('supplyDiscountType')?.value || 'percent';
  const discount      = discountType === 'percent'
    ? subtotal * (discountValue / 100)
    : Math.min(discountValue, subtotal);
  const grandTotal    = Math.max(0, subtotal - discount);

  const subEl  = document.getElementById('supplyOrderSubtotal');
  const discEl = document.getElementById('supplyOrderDiscount');
  const totEl  = document.getElementById('supplyOrderTotal');
  if (subEl)  subEl.textContent  = formatCurrency(subtotal);
  if (discEl) discEl.textContent = discount > 0 ? `-${formatCurrency(discount)}` : '—';
  if (totEl)  totEl.textContent  = formatCurrency(grandTotal);
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

  // Hydrate discount
  const discountPct = order.discount && order.subtotal
    ? ((order.discount / order.subtotal) * 100).toFixed(2) : '';
  const savedType = order.discountType || (discountPct ? 'percent' : 'amount');
  const savedVal  = savedType === 'percent' ? discountPct : (order.discount || '');
  setElementValue('supplyDiscountValue', savedVal);
  setElementValue('supplyDiscountType',  savedType);

  renderSupplyLineItems(order.items || []);
  // Recalculate totals after rows are populated
  if (typeof updateSupplyOrderTotal === 'function') updateSupplyOrderTotal();
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
  const subtotal       = items.reduce((s, i) => s + i.total, 0);
  const discountValue  = Number(document.getElementById('supplyDiscountValue')?.value || 0);
  const discountType   = document.getElementById('supplyDiscountType')?.value || 'percent';
  const discount       = discountType === 'percent'
    ? subtotal * (discountValue / 100)
    : discountValue;
  const grandTotal     = Math.max(0, subtotal - discount);
  const orders     = getSupplyOrders();
  const existing   = orders.find(o => String(o.id) === String(id));

  if (existing) {
    existing.invoiceNumber = invoiceNumber;
    existing.clientId      = clientId;
    existing.clientName    = client?.name || '';
    existing.orderDate     = orderDate;
    existing.notes         = notes;
    existing.items         = items;
    existing.subtotal      = subtotal;
    existing.discount      = discount;
    existing.subtotal      = subtotal;
    existing.discount      = discount;
    existing.grandTotal    = grandTotal;
    existing.updatedAt     = new Date().toISOString();
    updateState('supplyOrders', () => orders);
  } else {
    const timestamp = new Date().toISOString();
    orders.push({
      id, invoiceNumber, clientId,
      clientName: client?.name || '',
      orderDate, notes, items, subtotal, discount, grandTotal,
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
  // Release any reservation and restore stock before deleting
  if (order?.stockDeducted) {
    _restoreSupplyStock(order);
    order.stockDeducted = false;
  }
  _releaseSupplyReservation(order);
  // Also release FG reservations if applicable
  if (typeof releaseFGReserveForSupply === 'function') releaseFGReserveForSupply(order);
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

/* CANCELLED / VOIDED / REFUNDED — restore stock previously deducted */
function _restoreSupplyStock(order) {
  const cart = _supplyItemsToCart(order);
  if (!cart.length) return;

  const updatedProducts = (APP_STATE.products || []).map(product => {
    const units = cart.reduce((sum, line) => {
      if (String(line.productId) !== String(product.id)) return sum;
      return sum + Number(line.quantity || 0);
    }, 0);
    if (!units) return product;
    // FG-mode products restore via the FG reservation release only —
    // never touch product.stock for these, it isn't the source of truth.
    if (typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(product)) {
      return product;
    }
    return { ...product, stock: Number(product.stock || 0) + units };
  });
  updateState('products', () => updatedProducts);

  // Release FG reservations for any FG-mode products in this order
  if (typeof releaseFGReserveForSupply === 'function') releaseFGReserveForSupply(order);

  _logInventoryMovements(order, 'supply-stock-restored', 0,
    `Restored from supply order ${order.invoiceNumber}`);
}

function _deductSupplyStock(order) {
  const cart = _supplyItemsToCart(order);
  if (!cart.length) return;

  // Deduct product stock — DIRECT mode products only.
  // FG-mode products deduct via deductFGForSupply() further below.
  const updatedProducts = (APP_STATE.products || []).map(product => {
    if (typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(product)) {
      return product;
    }
    const units = cart.reduce((sum, line) => {
      if (String(line.productId) !== String(product.id)) return sum;
      return sum + Number(line.quantity || 0);
    }, 0);
    if (!units) return product;
    return { ...product, stock: Math.max(0, Number(product.stock || 0) - units) };
  });
  updateState('products', () => updatedProducts);

  // Deduct ingredient stock via recipe — DIRECT mode products only
  // Finished Goods mode products deduct from finishedGoods[], not ingredients
  const ingredientDeltas = new Map();
  cart.forEach(line => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(line.productId));
    if (!product || !Array.isArray(product.recipe)) return;
    // Skip FG-mode products — their ingredients were consumed at production, not supply
    // FG deduction handled separately below after the loop (not per-line to avoid duplicate calls)
    if (typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(product)) {
      return;
    }
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

  // Deduct from Finished Goods stock for FG-mode products (once per order, not per line)
  const hasFGItems = (order.items || []).some(item => {
    const prod = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
    return typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(prod);
  });
  if (hasFGItems && typeof deductFGForSupply === 'function') deductFGForSupply(order);

  // Release reservation now that stock is hard-deducted
  if (order.stockDeducted) { _restoreSupplyStock(order); order.stockDeducted = false; }
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

    let available;
    if (typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(product)) {
      // FG products — check finished goods available stock
      available = typeof getFGAvailable === 'function'
        ? getFGAvailable(product.id)
        : Number(product.stock || 0);
    } else {
      // Direct products — check ingredient-backed product stock minus reservations
      const alreadyReserved = reservations
        .filter(r => String(r.productId) === String(item.productId) &&
                     String(r.orderId) !== String(order.id))
        .reduce((s, r) => s + Number(r.qty || 0), 0);
      available = Number(product.stock || 0) - alreadyReserved;
    }

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

async function setSupplyStatus(orderId, newStatus) {
  if (!newStatus) return;
  const orders = getSupplyOrders();
  const order  = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const prevStatus = order.status;
  if (prevStatus === newStatus) return;
  const newLabel = SUPPLY_STATUS_LABELS[newStatus] || newStatus;

  // ── Stock logic on status change ──

  // Moving TO ORDERED from a non-ordered state — deduct stock
  if (newStatus === 'ORDERED' && !order.stockDeducted) {
    const errors = _checkSupplyStockAvailability(order);
    if (errors.length) {
      if (!confirm(`Stock warning:\n${errors.join('\n')}\n\nProceed anyway?`)) return;
    }
    _deductSupplyStock(order);
    order.stockDeducted = true;
    _auditSupplyEvent('SUPPLY_STOCK_DEDUCTED', order);
  }

  // Moving AWAY from ORDERED back to DRAFTED — restore stock
  if (prevStatus === 'ORDERED' && newStatus === 'DRAFTED' && order.stockDeducted) {
    if (!confirm('Moving back to Draft will restore stock. Continue?')) return;
    _restoreSupplyStock(order);
    order.stockDeducted = false;
    _auditSupplyEvent('SUPPLY_STOCK_RESTORED', order);
  }

  // Moving to CANCELLED or VOIDED — restore stock if deducted
  if (['CANCELLED','VOIDED'].includes(newStatus) && order.stockDeducted) {
    if (!confirm(`Cancelling will restore stock for all line items. Continue?`)) return;
    _restoreSupplyStock(order);
    order.stockDeducted = false;
    _auditSupplyEvent('SUPPLY_STOCK_RESTORED', order);
  }

  // Moving to PAID — create sales record if not already done
  if (newStatus === 'PAID' && !order.salesRecordId) {
    await _createSupplySalesRecord(order);
    _auditSupplyEvent('SUPPLY_ORDER_PAID', order);
  }

  // If un-paying (moving away from PAID) — warn, no automatic reversal
  if (prevStatus === 'PAID' && newStatus !== 'PAID') {
    if (!confirm('Moving away from Paid will not automatically reverse the sales record. Continue?')) return;
  }

  const note = window.prompt(`Note for status change to "${newLabel}" (optional):`) || '';
  const timestamp = new Date().toISOString();

  order.status    = newStatus;
  order.updatedAt = timestamp;
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: newStatus, changedAt: timestamp, note,
    changedFrom: prevStatus, changedBy: APP_STATE.currentUserRole || 'STAFF' });
  _auditSupplyEvent(`SUPPLY_STATUS_${newStatus}`, order,
    `Changed from ${prevStatus} → ${newStatus}${note ? ' · ' + note : ''}`);

  updateState('supplyOrders', () => orders);
  renderSupplyTable();
  renderSupplyKPIs();
  if (typeof refreshDashboard === 'function') refreshDashboard();
  showNotification(`Order status set to ${newLabel}`, 'success');
}

// Keep advanceSupplyStatus as alias for backward compat
async function advanceSupplyStatus(orderId) {
  const order = getSupplyOrders().find(o => String(o.id) === String(orderId));
  if (!order) return;
  openStatusPickerModal(orderId);
}

function openStatusPickerModal(orderId) {
  const order = getSupplyOrders().find(o => String(o.id) === String(orderId));
  if (!order) return;

  const el = id => document.getElementById(id);
  if (el('statusPickerOrderId'))   el('statusPickerOrderId').value      = orderId;
  if (el('statusPickerCurrent'))   el('statusPickerCurrent').textContent = SUPPLY_STATUS_LABELS[order.status] || order.status;
  if (el('statusPickerInvoice'))   el('statusPickerInvoice').textContent = order.invoiceNumber || '';
  if (el('statusPickerClient'))    el('statusPickerClient').textContent  = order.clientName    || '';

  // Render status options
  const container = el('statusPickerOptions');
  if (container) {
    const allStatuses = [...SUPPLY_STATUSES, 'CANCELLED', 'VOIDED'];
    container.innerHTML = allStatuses.map(s => `
      <button type="button" class="status-picker-btn${order.status === s ? ' active' : ''}"
        data-action="set-supply-status" data-order-id="${orderId}" data-status="${s}">
        ${SUPPLY_STATUS_LABELS[s] || s}
        ${order.status === s ? ' ✓' : ''}
      </button>`).join('');
  }
  openModal('statusPickerModal');
}

function cancelSupplyOrder(orderId) {
  if (!confirm('Cancel this supply order?')) return;
  const orders = getSupplyOrders();
  const order  = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  // Release reservation if exists
  if (order.stockDeducted) {
    _restoreSupplyStock(order);
    order.stockDeducted = false;
    order.reservedStock = false;
  }

  const timestamp = new Date().toISOString();
  order.status    = 'CANCELLED';
  order.updatedAt = timestamp;
  order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  order.statusHistory.push({ status: 'CANCELLED', changedAt: timestamp, note: 'Manually cancelled' });
  _auditSupplyEvent('SUPPLY_ORDER_CANCELLED', order);
  _auditSupplyEvent('SUPPLY_STOCK_RESTORED', order);

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


  let ctl=document.getElementById('supplyTableControls');
  if(!ctl){
    ctl=document.createElement('div');
    ctl.id='supplyTableControls';
    tbody.parentElement.appendChild(ctl);
  }
  const allOrders = orders.slice().reverse();
  const limit     = window.supplyTableLimit || 5;

  allOrders.slice(0, limit).forEach(order => {
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
        <td style="font-family:var(--font-mono);font-size:12px;font-weight:700;white-space:nowrap;">
          ${escapeHtml(order.invoiceNumber||'—')}</td>
        <td style="font-weight:700;font-size:13px;">${escapeHtml(order.clientName||'—')}</td>
        <td style="font-size:12px;color:var(--gray-500);max-width:160px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemSummary}">
          ${itemSummary||'—'}</td>
        <td style="font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap;">
          ${formatCurrency(order.grandTotal||0)}</td>
        <td>
          <div>${supplyStatusBadge(order.status)}</div>
          ${order.stockDeducted
            ? `<div style="font-size:9px;color:#1d4ed8;font-weight:700;letter-spacing:.5px;margin-top:4px;">STOCK DEDUCTED</div>` : ''}
          ${order.reservedStock && !order.stockDeducted
            ? `<div style="font-size:9px;color:#c2410c;font-weight:700;letter-spacing:.5px;margin-top:4px;">STOCK RESERVED</div>` : ''}
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-secondary" data-action="view-supply-order"
              data-id="${order.id}">View</button>
            <button class="btn btn-sm" data-action="open-status-picker"
              data-id="${order.id}">Set Status</button>
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

  // See more
  if (typeof _renderSeeMore === 'function') {
    _renderSeeMore(
      'supplySeeMore', allOrders.length, limit,
      () => { window.supplyTableLimit = (window.supplyTableLimit||5)+5; renderSupplyTable(); },
      () => { window.supplyTableLimit = 5; renderSupplyTable(); }
    );
  }
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
        padding:5px 0;border-bottom:1px solid var(--border);font-size:12px;">
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

  // Deduct stock immediately since status starts at ORDERED
  _auditSupplyEvent('SUPPLY_ORDER_CREATED', newOrder);
  _deductSupplyStock(newOrder);
  newOrder.stockDeducted = true;
  newOrder.reservedStock = false;
  _auditSupplyEvent('SUPPLY_ORDER_ORDERED', newOrder);
  _auditSupplyEvent('SUPPLY_STOCK_DEDUCTED', newOrder);

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
window.setSupplyStatus          = setSupplyStatus;
window.openStatusPickerModal    = openStatusPickerModal;
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

window.openSupplyOrderView = openSupplyOrderView;

function openSupplyOrderView(orderId) {
  const order = getSupplyOrderById(orderId);
  if (!order) return;

  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const items   = Array.isArray(order.items) ? order.items : [];

  const statusRows = SUPPLY_STATUSES.map(s => {
    const entry = history.find(h => h.status === s);
    if (!entry) return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:11px;font-weight:700;color:var(--gray-300);min-width:110px;">${SUPPLY_STATUS_LABELS[s]}</span>
        <span style="font-size:11px;color:var(--gray-300);">—</span>
      </div>`;
    const d = new Date(entry.changedAt);
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:11px;font-weight:800;color:var(--black);min-width:110px;">${SUPPLY_STATUS_LABELS[s]}</span>
        <div>
          <div style="font-size:11px;font-weight:700;">
            ${d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}
            ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
          </div>
          ${entry.note ? `<div style="font-size:11px;color:var(--gray-400);margin-top:2px;">${escapeHtml(entry.note)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:8px 10px;font-size:13px;font-weight:700;border-bottom:1px solid var(--border);
        max-width:180px;word-break:break-word;">
        ${escapeHtml(item.productName||item.description||'—')}</td>
      <td style="padding:8px 10px;font-size:13px;text-align:right;border-bottom:1px solid var(--border);
        font-variant-numeric:tabular-nums;white-space:nowrap;">${item.qty}</td>
      <td style="padding:8px 10px;font-size:13px;text-align:right;border-bottom:1px solid var(--border);
        font-variant-numeric:tabular-nums;white-space:nowrap;">${formatCurrency(item.unitPrice||0)}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:800;text-align:right;
        border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums;white-space:nowrap;">
        ${formatCurrency(item.total||0)}</td>
    </tr>`).join('');

  const container = document.getElementById('supplyOrderViewContent');
  if (!container) return;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gray-400);margin-bottom:3px;">Invoice #</div>
        <div style="font-size:15px;font-weight:900;font-family:var(--font-mono);">${escapeHtml(order.invoiceNumber||'—')}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gray-400);margin-bottom:3px;">Client</div>
        <div style="font-size:15px;font-weight:900;">${escapeHtml(order.clientName||'—')}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gray-400);margin-bottom:3px;">Order Date</div>
        <div style="font-size:13px;font-weight:700;">${order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gray-400);margin-bottom:3px;">Status</div>
        <div>${supplyStatusBadge(order.status)}</div>
      </div>
    </div>

    <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gray-400);margin-bottom:8px;">Order Items</div>
    <div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow-x:auto;overflow-y:hidden;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;min-width:420px;">
        <thead>
          <tr style="background:var(--gray-50);">
            <th style="padding:8px 10px;text-align:left;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-400);font-weight:800;">Product</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-400);font-weight:800;white-space:nowrap;">Qty</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-400);font-weight:800;white-space:nowrap;">Price</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-400);font-weight:800;white-space:nowrap;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div style="background:var(--gray-50);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:var(--gray-500);font-weight:600;">
        <span>Subtotal</span><span style="font-weight:700;color:var(--black);">${formatCurrency(order.subtotal||0)}</span>
      </div>
      ${(order.discount||0) > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:var(--gray-500);font-weight:600;">
        <span>Discount</span><span style="font-weight:700;color:#dc2626;">-${formatCurrency(order.discount||0)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:8px 0 4px;font-size:17px;font-weight:900;border-top:1.5px solid var(--border);margin-top:6px;">
        <span>Grand Total</span>
        <span style="font-variant-numeric:tabular-nums;">${formatCurrency(order.grandTotal||0)}</span>
      </div>
    </div>

    <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gray-400);margin-bottom:8px;">Status Timeline</div>
    <div style="margin-bottom:20px;">${statusRows}</div>

    ${order.notes ? `
    <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gray-400);margin-bottom:8px;">Notes</div>
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:var(--radius-md);
      padding:12px 14px;font-size:13px;font-weight:500;line-height:1.6;white-space:pre-wrap;">
      ${escapeHtml(order.notes)}</div>` : ''}
  `;

  openModal('supplyOrderViewModal');
}
