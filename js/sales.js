/* ═══════════════════════════════════════════════════════
   SALES.JS — Cart management, checkout, receipts
═══════════════════════════════════════════════════════ */

function initializeSales() {
  bindSalesLifecycle();
  renderCart();
  updateCartSummary();
  renderSalesTable();
  renderHeldOrdersBadge();
}

function bindSalesLifecycle() {
  const ids = ['discountValue', 'discountType', 'checkoutPayment',
               'checkoutTendered', 'salesFromDate', 'salesToDate', 'salesPaymentFilter'];
  const handlers = {
    'discountValue': ['input', updateCartSummary],
    'discountType': ['change', updateCartSummary],
    'checkoutPayment': ['change', togglePaymentFields],
    'checkoutTendered': ['input', calculateChange],
    'salesFromDate': ['change', renderSalesTable],
    'salesToDate': ['change', renderSalesTable],
    'salesPaymentFilter': ['change', renderSalesTable],
  };
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && handlers[id]) el.addEventListener(handlers[id][0], handlers[id][1]);
  });
}

/* ── Cart helpers ── */
function getCart() {
  return Array.isArray(APP_STATE.cart) ? APP_STATE.cart : [];
}

function setCart(cart) {
  updateState('cart', () => Array.isArray(cart) ? cart : []);
  renderCart();
  updateCartSummary();
  renderPOSProducts(); // refresh in-cart qty badges
}

function getProductById(productId) {
  return (APP_STATE.products || []).find(p => String(p.id) === String(productId));
}

function getIngredientById(ingredientId) {
  return (APP_STATE.ingredients || []).find(i => String(i.id) === String(ingredientId));
}

function getCartQuantityForProduct(productId) {
  return getCart()
    .filter(i => String(i.productId) === String(productId))
    .reduce((s, i) => s + Number(i.quantity || 0), 0);
}

function getCartUnitsForProduct(productId) {
  return getCart()
    .filter(i => String(i.productId) === String(productId))
    .reduce((s, i) => s + Number(i.quantity || 0) * Number(i.multiplier || 1), 0);
}

/* ── Cart render ── */
function renderCart() {
  const container = document.getElementById('cartItems');
  const itemCountEl = document.getElementById('cartItemCount');
  if (!container) return;

  const cart = getCart();
  const totalQty = cart.reduce((s, i) => s + Number(i.quantity || 0), 0);
  if (itemCountEl) itemCountEl.textContent = totalQty;

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <div class="empty-cart-icon">🛒</div>
        <div class="empty-cart-title">Cart is empty</div>
        <div class="empty-cart-subtitle">Tap a product to add it</div>
      </div>`;
    return;
  }

  container.innerHTML = '';
  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-line-item';
    row.innerHTML = `
      <div class="cart-line-info">
        <div class="cart-line-name">${escapeHtml(item.name)}</div>
        <div class="cart-line-price">${formatCurrency(item.price)} each</div>
      </div>
      <div class="cart-line-controls">
        <button type="button" data-action="decrease-qty" data-id="${item.id}">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-action="increase-qty" data-id="${item.id}">+</button>
        <button type="button" class="cart-remove-btn" data-action="remove-from-cart" data-id="${item.id}">×</button>
      </div>
      <div class="cart-line-total">${formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</div>`;
    container.appendChild(row);
  });
}

/* ── Money helpers ── */
function getElementByIds(ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function parseMoney(value) {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDiscountState() {
  const valEl = getElementByIds(['discountValue']);
  const typeEl = getElementByIds(['discountType']);
  return { value: Number(valEl?.value || 0), type: typeEl?.value || 'percent' };
}

function calculateCartSubtotal() {
  return getCart().reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);
}

function calculateCartDiscount() {
  const subtotal = calculateCartSubtotal();
  const { value, type } = getDiscountState();
  if (!value || value <= 0) return 0;
  const discount = type === 'percent' ? subtotal * (value / 100) : value;
  return Math.max(0, Math.min(discount, subtotal));
}

function calculateCartTax() {
  const taxRate = Number(APP_STATE.settings?.taxRate || 0);
  return Math.max(0, (calculateCartSubtotal() - calculateCartDiscount()) * (taxRate / 100));
}

function calculateCartTotal() {
  return Math.max(0, calculateCartSubtotal() - calculateCartDiscount() + calculateCartTax());
}

function updateCartSummary() {
  const subtotal = calculateCartSubtotal();
  const discount = calculateCartDiscount();
  const tax = calculateCartTax();
  const total = calculateCartTotal();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  set('cartSubtotal', formatCurrency(subtotal));
  set('cartDiscount', formatCurrency(discount));
  set('cartTax', formatCurrency(tax));
  set('cartTotal', formatCurrency(total));
  setVal('checkoutTotal', formatCurrency(total));

  calculateChange();
  return { subtotal, discount, tax, total };
}

function calculateChange() {
  const total = calculateCartTotal();
  const tenderedEl = getElementByIds(['checkoutTendered']);
  const changeEl = getElementByIds(['checkoutChange']);
  if (!tenderedEl || !changeEl) return 0;
  const tendered = parseMoney(tenderedEl.value);
  const change = Math.max(0, tendered - total);
  changeEl.value = formatCurrency(change);
  return change;
}

/* ── Add / remove / qty ── */
function addToCart(productId, variant = null) {
  const product = getProductById(productId);
  if (!product) { showNotification('Product not found', 'error'); return; }

  const stock = Number(product.stock || 0);
  if (stock <= 0) { showNotification('Out of stock', 'error'); return; }

  const cart = getCart();
  const variantId = variant?.id || '';
  const existing = cart.find(
    i => String(i.productId) === String(productId) && String(i.variantId || '') === String(variantId)
  );

  const unitsToAdd = Number(variant?.multiplier || 1);
  if ((getCartUnitsForProduct(productId) + unitsToAdd) > stock) {
    showNotification('Insufficient stock', 'error');
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    const lineName = variant?.name ? `${product.name} (${variant.name})` : product.name;
    const linePrice = Number(variant?.price ?? product.price ?? 0);
    cart.push({
      id: generateId(), productId, variantId, name: lineName, price: linePrice,
      quantity: 1, recipe: Array.isArray(product.recipe) ? product.recipe : [],
      recipeMode: product.recipeMode || 'unit', batchYield: Number(product.batchYield || 1),
      multiplier: Number(variant?.multiplier || 1)
    });
  }
  setCart(cart);
}

function removeFromCart(id) {
  setCart(getCart().filter(i => String(i.id) !== String(id)));
}

function increaseQty(id) {
  const cart = getCart();
  const item = cart.find(x => String(x.id) === String(id));
  if (!item) return;
  const product = getProductById(item.productId);
  if (!product) return;
  if ((getCartUnitsForProduct(item.productId) + Number(item.multiplier || 1)) > Number(product.stock || 0)) {
    showNotification('Insufficient stock', 'error');
    return;
  }
  item.quantity += 1;
  setCart(cart);
}

function decreaseQty(id) {
  const cart = getCart();
  const item = cart.find(x => String(x.id) === String(id));
  if (!item) return;
  item.quantity -= 1;
  if (item.quantity <= 0) { removeFromCart(id); return; }
  setCart(cart);
}

function clearCart(skipConfirm = false) {
  if (!skipConfirm && getCart().length) {
    if (!confirm('Clear current cart?')) return;
  }
  setCart([]);
  const dvEl = document.getElementById('discountValue');
  if (dvEl) dvEl.value = '';
  showNotification('Cart cleared', 'info');
}

/* ── Hold orders ── */
function holdOrder() {
  const cart = getCart();
  if (!cart.length) { showNotification('Cart is empty', 'error'); return; }

  const heldOrders = Array.isArray(APP_STATE.heldOrders) ? APP_STATE.heldOrders : [];
  const customerName = (() => {
    const existing = getCheckoutCustomerName();
    const entered = window.prompt('Customer name (optional):', existing || '');
    return String(entered || existing || 'Walk-in Customer').trim();
  })();

  const snapshot = buildTransactionSnapshot({
    status: 'HELD', paymentStatus: 'PENDING',
    paymentMethod: getSelectedPaymentMethod(),
    tendered: 0, change: 0, referenceNumber: '', customerName, cartOverride: cart
  });

  heldOrders.push(snapshot);
  updateState('heldOrders', () => heldOrders);
  clearCart(true);
  renderHeldOrdersBadge();
  showNotification(`Order held for ${customerName}`, 'success');
}

function renderHeldOrdersBadge() {
  const badge = document.getElementById('heldOrdersBadge');
  if (!badge) return;
  badge.textContent = String(Array.isArray(APP_STATE.heldOrders) ? APP_STATE.heldOrders.length : 0);
}

/* ── Payment helpers ── */
function getSelectedPaymentMethod() {
  const el = getElementByIds(['checkoutPayment']);
  return String(el?.value || 'cash').toLowerCase();
}

function getCheckoutCustomerName() {
  const el = getElementByIds(['checkoutCustomer']);
  return String(el?.value || '').trim();
}

function getPaymentReference() {
  const el = getElementByIds(['paymentReference']);
  return String(el?.value || '').trim();
}

/* ── Checkout modal ── */
function openCheckoutModal() {
  if (!getCart().length) { showNotification('Cart is empty', 'error'); return; }
  updateCartSummary();
  togglePaymentFields();
  calculateChange();
  openModal('checkoutModal');
}

function togglePaymentFields() {
  const method = getSelectedPaymentMethod();
  const qrphSection = document.getElementById('qrphSection');
  const referenceWrap = document.getElementById('referenceWrap');
  const tenderedWrap = document.getElementById('tenderedWrap');
  const quickAmounts = document.getElementById('quickAmounts');

  const isCash = method === 'cash';
  const isDigital = ['gcash', 'maya', 'bank', 'qrph'].includes(method);
  const isQR = method === 'qrph';

  if (tenderedWrap) tenderedWrap.style.display = isCash ? 'block' : 'none';
  if (quickAmounts) quickAmounts.style.display = isCash ? 'flex' : 'none';
  if (referenceWrap) referenceWrap.style.display = isDigital ? 'block' : 'none';
  if (qrphSection) qrphSection.style.display = isQR ? 'block' : 'none';

  calculateChange();
}

/* ── Transaction builder ── */
function buildTransactionSnapshot({ status, paymentStatus, paymentMethod, tendered, change,
    referenceNumber, customerName, cartOverride = null }) {
  const cart = Array.isArray(cartOverride) ? cartOverride : getCart();
  const items = cart.map(item => ({
    id: item.id, productId: item.productId, variantId: item.variantId || '',
    multiplier: Number(item.multiplier || 1), name: item.name,
    quantity: Number(item.quantity || 0), price: Number(item.price || 0),
    total: Number(item.price || 0) * Number(item.quantity || 0),
    recipe: Array.isArray(item.recipe) ? item.recipe : [],
    recipeMode: item.recipeMode || 'unit', batchYield: Number(item.batchYield || 1)
  }));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discount = calculateCartDiscount();
  const tax = calculateCartTax();
  const total = Math.max(0, subtotal - discount + tax);
  const timestamp = new Date().toISOString();
  const receiptNumber = generateReceiptNumber();
  const orderType = APP_STATE.ui?.orderType || 'Dine In';

  return {
    id: generateId(), receiptNumber, status, paymentStatus, orderType,
    customer: { name: customerName || 'Walk-in Customer' },
    payment: {
      method: paymentMethod, tendered: Number(tendered || 0),
      change: Number(change || 0), referenceNumber: referenceNumber || ''
    },
    totals: { subtotal, discount, tax, total },
    items,
    audit: {
      createdAt: timestamp,
      completedAt: status === 'COMPLETED' ? timestamp : null,
      completedBy: APP_STATE.currentUserRole || 'STAFF'
    },
    // Legacy flat fields for compatibility
    customerName: customerName || 'Walk-in Customer',
    paymentMethod, subtotal, discount, tax, total,
    tendered: Number(tendered || 0), change: Number(change || 0),
    referenceNumber: referenceNumber || '', createdAt: timestamp,
    completedAt: status === 'COMPLETED' ? timestamp : null
  };
}

/* ── Inventory deduction ── */
function deductInventoryForCart(cart) {
  const ingredientDeltas = new Map();
  cart.forEach(line => {
    const product = getProductById(line.productId);
    if (!product) return;
    const recipeItems = Array.isArray(product.recipe) ? product.recipe : [];
    const batchYield = Math.max(1, Number(product.batchYield || 1));
    const recipeMode = String(product.recipeMode || 'unit');
    recipeItems.forEach(recipeItem => {
      const ingredient = getIngredientById(recipeItem.ingredientId);
      if (!ingredient) return;
      const perProduct = Number(recipeItem.quantity || 0);
      const usagePerUnit = recipeMode === 'batch' ? perProduct / batchYield : perProduct;
      const totalUsage = usagePerUnit * Number(line.quantity || 0);
      ingredientDeltas.set(ingredient.id, (ingredientDeltas.get(ingredient.id) || 0) + totalUsage);
    });
  });

  if (!ingredientDeltas.size) return;

  const updatedIngredients = getIngredients().map(ingredient => {
    if (!ingredientDeltas.has(ingredient.id)) return ingredient;
    return { ...ingredient, stock: Math.max(0, Number(ingredient.stock || 0) - ingredientDeltas.get(ingredient.id)) };
  });
  if (typeof setIngredients === 'function') setIngredients(updatedIngredients);

  const movements = Array.isArray(APP_STATE.inventoryMovements) ? APP_STATE.inventoryMovements : [];
  ingredientDeltas.forEach((usedQty, ingredientId) => {
    const ingredient = getIngredientById(ingredientId);
    if (!ingredient) return;
    movements.push({
      id: generateId(), ingredientId, ingredientName: ingredient.name,
      type: 'sale-deduction', quantityAdded: 0, quantityUsed: usedQty,
      reason: 'Sale deduction', previousStock: Number(ingredient.stock || 0),
      newStock: Math.max(0, Number(ingredient.stock || 0) - usedQty),
      createdAt: new Date().toISOString(), createdBy: APP_STATE.currentUserRole || 'STAFF'
    });
  });
  if (typeof setInventoryMovements === 'function') setInventoryMovements(movements);
  else updateState('inventoryMovements', () => movements);
}

function deductProductStockForCart(cart) {
  const updatedProducts = getProducts().map(product => {
    const quantitySold = cart.reduce((sum, line) => {
      if (String(line.productId) !== String(product.id)) return sum;
      return sum + Number(line.quantity || 0) * Number(line.multiplier || 1);
    }, 0);
    if (!quantitySold) return product;
    return { ...product, stock: Math.max(0, Number(product.stock || 0) - quantitySold) };
  });
  if (typeof setProducts === 'function') setProducts(updatedProducts);
  else updateState('products', () => updatedProducts);
}

/* ── Complete sale ── */
function pushSale(transaction) {
  const sales = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  sales.push(transaction);
  updateState('sales', () => sales);
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function completeSale(forceStatus = 'COMPLETED') {
  const cart = getCart();
  if (!cart.length) { showNotification('Cart is empty', 'error'); return; }

  const method = getSelectedPaymentMethod();
  const customerName = getCheckoutCustomerName();
  const referenceNumber = getPaymentReference();
  const total = calculateCartTotal();
  const isPending = String(forceStatus).toUpperCase() === 'PENDING';
  const paymentStatus = isPending ? 'PENDING' : 'PAID';

  let tendered = 0, change = 0;

  if (!isPending && method === 'cash') {
    const tenderedEl = getElementByIds(['checkoutTendered']);
    tendered = parseMoney(tenderedEl?.value);
    if (tendered <= 0) tendered = total;
    if (tendered < total) { showNotification('Amount tendered is not enough', 'error'); return; }
    change = tendered - total;
  } else if (!isPending) {
    tendered = total;
  }

  if (!isPending && ['bank', 'qrph'].includes(method) && !referenceNumber) {
    showNotification('Reference number is required for this payment method', 'error');
    return;
  }

  // Stock validation
  for (const product of getProducts()) {
    const requiredUnits = cart.reduce((sum, line) => {
      if (String(line.productId) !== String(product.id)) return sum;
      return sum + Number(line.quantity || 0) * Number(line.multiplier || 1);
    }, 0);
    if (requiredUnits > Number(product.stock || 0)) {
      showNotification(`${product.name}: insufficient stock`, 'error');
      return;
    }
  }

  const transaction = buildTransactionSnapshot({
    status: isPending ? 'PENDING' : 'COMPLETED',
    paymentStatus, paymentMethod: method,
    tendered, change, referenceNumber, customerName, cartOverride: cart
  });

  pushSale(transaction);
  deductProductStockForCart(cart);
  deductInventoryForCart(cart);
  if (isPending) { transaction.audit = transaction.audit || {}; transaction.audit.inventoryDeducted = true; }

  clearCart(true);
  closeModal('checkoutModal');
  renderReceipt(transaction);
  openModal('receiptModal');
  showNotification(isPending ? 'Order marked pending' : 'Sale completed! 🎉', 'success');
  renderSalesTable();
  renderHeldOrdersBadge();
}

/* ── Receipt ── */
function escapeHtml(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderReceipt(transaction) {
  const body = document.getElementById('receiptBody');
  if (!body) return;

  const brand = APP_STATE.settings?.brandName || 'Caflat.Co POS';
  const footer = APP_STATE.settings?.receiptFooter || '';
  const dateText = new Date(transaction.audit?.completedAt || transaction.audit?.createdAt).toLocaleString();
  const orderType = transaction.orderType || '';

  const itemsHtml = transaction.items.map(item => `
    <div class="receipt-line">
      <span>${escapeHtml(item.name)} ×${item.quantity}</span>
      <span>${formatCurrency(item.total)}</span>
    </div>`).join('');

  const referenceLine = transaction.payment?.referenceNumber
    ? `<div class="receipt-line"><span>Reference</span><span>${escapeHtml(transaction.payment.referenceNumber)}</span></div>` : '';

  const orderTypeLine = orderType
    ? `<div class="receipt-line"><span>Order Type</span><span>${escapeHtml(orderType)}</span></div>` : '';

  body.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-brand">${escapeHtml(brand)}</div>
      <div>${dateText}</div>
      <div>${escapeHtml(transaction.receiptNumber)}</div>
      <div style="font-size:10px;opacity:.6;">${escapeHtml(transaction.status)}</div>
    </div>
    <div class="receipt-line"><span>Customer</span><span>${escapeHtml(transaction.customer?.name || 'Walk-in')}</span></div>
    ${orderTypeLine}
    <div class="receipt-line"><span>Payment</span><span>${escapeHtml(transaction.payment?.method || 'cash').toUpperCase()}</span></div>
    ${referenceLine}
    <div class="receipt-divider"></div>
    ${itemsHtml}
    <div class="receipt-divider"></div>
    <div class="receipt-line"><span>Subtotal</span><span>${formatCurrency(transaction.totals.subtotal)}</span></div>
    ${Number(transaction.totals.discount) > 0 ? `<div class="receipt-line"><span>Discount</span><span>-${formatCurrency(transaction.totals.discount)}</span></div>` : ''}
    ${Number(transaction.totals.tax) > 0 ? `<div class="receipt-line"><span>Tax</span><span>${formatCurrency(transaction.totals.tax)}</span></div>` : ''}
    <div class="receipt-line receipt-total"><span>TOTAL</span><span>${formatCurrency(transaction.totals.total)}</span></div>
    ${Number(transaction.payment?.tendered) > 0 ? `<div class="receipt-line"><span>Tendered</span><span>${formatCurrency(transaction.payment.tendered)}</span></div>` : ''}
    ${Number(transaction.payment?.change) > 0 ? `<div class="receipt-line"><span>Change</span><span>${formatCurrency(transaction.payment.change)}</span></div>` : ''}
    ${footer ? `<div class="receipt-divider"></div><div style="text-align:center;font-size:10px;padding:4px 0;">${escapeHtml(footer)}</div>` : ''}
  `;
}

function openSaleReceipt(saleId) {
  const sale = getSales().find(s => String(s.id) === String(saleId));
  if (!sale) return;
  renderReceipt(sale);
  openModal('receiptModal');
}

/* ── Sales table ── */
function getSales() {
  return Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
}

function renderSalesTable() {
  const tableBody = document.querySelector('#salesTable tbody');
  if (!tableBody) return;

  const fromDate = document.getElementById('salesFromDate')?.value ? new Date(`${document.getElementById('salesFromDate').value}T00:00:00`) : null;
  const toDate = document.getElementById('salesToDate')?.value ? new Date(`${document.getElementById('salesToDate').value}T23:59:59`) : null;
  const paymentFilter = String(document.getElementById('salesPaymentFilter')?.value || '').toLowerCase();

  const sales = getSales().filter(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    const matchesFrom = !fromDate || saleDate >= fromDate;
    const matchesTo = !toDate || saleDate <= toDate;
    const matchesPayment = !paymentFilter || paymentFilter === 'all' || String(sale.payment?.method || sale.paymentMethod || '').toLowerCase() === paymentFilter;
    return matchesFrom && matchesTo && matchesPayment;
  });

  tableBody.innerHTML = '';

  if (!sales.length) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No sales found</td></tr>`;
    return;
  }

  sales.slice().reverse().forEach(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    const itemSummary = Array.isArray(sale.items)
      ? sale.items.map(i => `${i.name} ×${i.quantity}`).join(', ') : '';
    const statusClass = (sale.status || '').toUpperCase() === 'PENDING' ? 'badge-low-stock' : 'badge-ok';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-family:var(--font-mono);font-size:11px;">${escapeHtml(sale.receiptNumber || sale.id || '')}</td>
      <td>${saleDate.toLocaleDateString()} ${saleDate.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(itemSummary)}">${escapeHtml(itemSummary)}</td>
      <td>${formatCurrency(sale.totals?.total ?? sale.total ?? 0)}</td>
      <td>${escapeHtml((sale.payment?.method || sale.paymentMethod || 'cash').toUpperCase())}</td>
      <td><span class="${(sale.status||'').toUpperCase()==='VOIDED' ? 'badge-voided' : statusClass}">${escapeHtml(sale.status || 'COMPLETED')}</span></td>
      <td>
        <div class="table-actions">
          ${(sale.status||'').toUpperCase()==='PENDING'
            ? `<button type="button" class="btn btn-sm" data-action="complete-pending-sale" data-id="${sale.id}">Complete</button>
               <button type="button" class="btn btn-sm btn-secondary" data-action="cancel-pending-sale" data-id="${sale.id}">Cancel</button>`
            : (sale.status||'').toUpperCase()==='VOIDED'
              ? `<button type="button" class="btn btn-sm btn-secondary" data-action="open-sale-receipt" data-id="${sale.id}">Receipt</button>`
              : `<button type="button" class="btn btn-sm btn-secondary" data-action="open-sale-receipt" data-id="${sale.id}">Receipt</button>
                 <button type="button" class="btn btn-sm btn-danger" data-action="open-void-modal" data-id="${sale.id}">Void</button>`}
        </div>
      </td>`;
    tableBody.appendChild(row);
  });
}

function exportSalesReport() {
  const sales = getSales();
  const lines = [['Receipt','Date','Payment','Order Type','Status','Subtotal','Discount','Tax','Total'].join(',')];
  sales.forEach(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    lines.push([
      `"${sale.receiptNumber || sale.id || ''}"`,
      saleDate.toISOString(),
      sale.payment?.method || sale.paymentMethod || '',
      sale.orderType || '',
      sale.status || '',
      Number(sale.totals?.subtotal ?? sale.subtotal ?? 0),
      Number(sale.totals?.discount ?? sale.discount ?? 0),
      Number(sale.totals?.tax ?? sale.tax ?? 0),
      Number(sale.totals?.total ?? sale.total ?? 0)
    ].join(','));
  });
  downloadTextFile(`sales-report-${Date.now()}.csv`, lines.join('\n'));
  showNotification('Sales report exported', 'success');
}

/* ── Pending sale management ── */
function completePendingSale(saleId) {
  const sales = getSales();
  const sale = sales.find(s => String(s.id) === String(saleId));
  if (!sale) return;
  sale.status = 'COMPLETED';
  sale.paymentStatus = 'PAID';
  sale.audit = sale.audit || {};
  sale.audit.completedAt = new Date().toISOString();
  sale.audit.inventoryDeducted = true;
  updateState('sales', () => sales);
  renderSalesTable();
  if (typeof refreshDashboard === 'function') refreshDashboard();
  showNotification('Pending sale completed', 'success');
}

function restoreInventoryForSale(sale) {
  const ingredientReturns = new Map();
  (sale.items || []).forEach(line => {
    const product = getProductById(line.productId);
    if (!product) return;
    const recipeItems = Array.isArray(product.recipe) ? product.recipe : [];
    const batchYield = Math.max(1, Number(product.batchYield || 1));
    const recipeMode = String(product.recipeMode || 'unit');
    recipeItems.forEach(recipeItem => {
      const perProduct = Number(recipeItem.quantity || 0);
      const usagePerUnit = recipeMode === 'batch' ? perProduct / batchYield : perProduct;
      const restoreQty = usagePerUnit * Number(line.quantity || 0);
      ingredientReturns.set(recipeItem.ingredientId, (ingredientReturns.get(recipeItem.ingredientId) || 0) + restoreQty);
    });
  });
  if (!ingredientReturns.size) return;
  const updatedIngredients = getIngredients().map(ingredient => {
    const restoreQty = ingredientReturns.get(ingredient.id);
    if (!restoreQty) return ingredient;
    return { ...ingredient, stock: Number(ingredient.stock || 0) + restoreQty };
  });
  if (typeof setIngredients === 'function') setIngredients(updatedIngredients);
  const movements = Array.isArray(APP_STATE.inventoryMovements) ? APP_STATE.inventoryMovements : [];
  ingredientReturns.forEach((qty, ingredientId) => {
    const ingredient = getIngredientById(ingredientId);
    if (!ingredient) return;
    movements.push({
      id: generateId(), ingredientId, ingredientName: ingredient.name,
      type: 'pending-cancel-restoration', quantityAdded: qty, quantityUsed: 0,
      reason: 'Pending sale cancelled', previousStock: Number(ingredient.stock || 0),
      newStock: Number(ingredient.stock || 0) + qty,
      createdAt: new Date().toISOString(), createdBy: APP_STATE.currentUserRole || 'STAFF'
    });
  });
  if (typeof setInventoryMovements === 'function') setInventoryMovements(movements);
  else updateState('inventoryMovements', () => movements);
}

function cancelPendingSale(saleId) {
  const sales = getSales();
  const sale = sales.find(s => String(s.id) === String(saleId));
  if (!sale) return;
  if (sale.audit?.inventoryDeducted) {
    const updatedProducts = getProducts().map(product => {
      const qty = (sale.items || []).reduce((sum, line) => {
        if (String(line.productId) !== String(product.id)) return sum;
        return sum + Number(line.quantity || 0) * Number(line.multiplier || 1);
      }, 0);
      if (!qty) return product;
      return { ...product, stock: Number(product.stock || 0) + qty };
    });
    if (typeof setProducts === 'function') setProducts(updatedProducts);
    else updateState('products', () => updatedProducts);
    restoreInventoryForSale(sale);
  }
  updateState('sales', () => sales.filter(s => String(s.id) !== String(saleId)));
  renderSalesTable();
  showNotification('Pending sale cancelled — stock restored', 'success');
}

/* ── Held orders modal ── */
function openHeldOrdersModal() {
  const modal = document.getElementById('heldOrdersModal');
  const list = document.getElementById('heldOrdersList');
  if (!modal || !list) return;

  const held = Array.isArray(APP_STATE.heldOrders) ? APP_STATE.heldOrders : [];
  list.innerHTML = held.map((o, i) => {
    const total = o.totals?.total || o.total || 0;
    const items = (o.items || []).length;
    const name = o.customer?.name || o.customerName || 'Walk-in Customer';
    const time = new Date(o.audit?.createdAt || o.createdAt || Date.now());
    const timeStr = time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    return `
      <div class="held-order-card" data-held-index="${i}">
        <div class="held-order-name">${escapeHtml(name)}</div>
        <div class="held-order-meta">${items} item(s) · ${formatCurrency(total)} · ${timeStr}</div>
      </div>`;
  }).join('') || '<div class="empty-state">No held orders</div>';

  modal.classList.remove('hidden');
}

function closeHeldOrdersModal() {
  const m = document.getElementById('heldOrdersModal');
  if (m) m.classList.add('hidden');
}

function resumeHeldOrder(index) {
  const held = Array.isArray(APP_STATE.heldOrders) ? APP_STATE.heldOrders : [];
  const order = held[index];
  if (!order) return;
  updateState('cart', () => Array.isArray(order.items) ? order.items : []);
  held.splice(index, 1);
  updateState('heldOrders', () => held);
  renderCart();
  updateCartSummary();
  renderHeldOrdersBadge();
  closeHeldOrdersModal();
  showNotification('Order resumed', 'success');
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('.held-order-card');
  if (card) resumeHeldOrder(Number(card.dataset.heldIndex));
  if (e.target && (e.target.id === 'closeHeldOrdersBtn' || e.target.closest('#closeHeldOrdersBtn')))
    closeHeldOrdersModal();
});

/* ── Quick cash amounts ── */
function setQuickAmount(amount) {
  const el = document.getElementById('checkoutTendered');
  if (el) { el.value = amount; calculateChange(); }
}

/* ── Exports ── */
function initializeSalesCompatibility() {
  window.completeSale = completeSale;
  window.togglePaymentFields = togglePaymentFields;
  window.clearCart = clearCart;
  window.holdOrder = holdOrder;
  window.openCheckoutModal = openCheckoutModal;
  window.renderSalesTable = renderSalesTable;
  window.renderCart = renderCart;
  window.exportSalesReport = exportSalesReport;
  window.calculateChange = calculateChange;
  window.calculateCartTotal = calculateCartTotal;
  window.calculateCartSubtotal = calculateCartSubtotal;
  window.calculateCartDiscount = calculateCartDiscount;
  window.calculateCartTax = calculateCartTax;
  window.updateCartSummary = updateCartSummary;
  window.removeFromCart = removeFromCart;
  window.increaseQty = increaseQty;
  window.decreaseQty = decreaseQty;
  window.openSaleReceipt = openSaleReceipt;
}

window.initializeSales = initializeSales;
window.getCart = getCart;
window.setCart = setCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.increaseQty = increaseQty;
window.decreaseQty = decreaseQty;
window.renderCart = renderCart;
window.completeSale = completeSale;
window.holdOrder = holdOrder;
window.openCheckoutModal = openCheckoutModal;
window.renderSalesTable = renderSalesTable;
window.exportSalesReport = exportSalesReport;
window.togglePaymentFields = togglePaymentFields;
window.calculateChange = calculateChange;
window.calculateCartTotal = calculateCartTotal;
window.calculateCartSubtotal = calculateCartSubtotal;
window.calculateCartDiscount = calculateCartDiscount;
window.calculateCartTax = calculateCartTax;
window.updateCartSummary = updateCartSummary;
window.renderHeldOrdersBadge = renderHeldOrdersBadge;
window.openSaleReceipt = openSaleReceipt;
window.completePendingSale = completePendingSale;
window.cancelPendingSale = cancelPendingSale;
window.getSales = getSales;
window.openHeldOrdersModal = openHeldOrdersModal;
window.closeHeldOrdersModal = closeHeldOrdersModal;
window.resumeHeldOrder = resumeHeldOrder;
window.setQuickAmount = setQuickAmount;
window.escapeHtml = escapeHtml;
