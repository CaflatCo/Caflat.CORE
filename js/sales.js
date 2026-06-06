function initializeSales() {
  bindSalesLifecycle();
  renderCart();
  updateCartSummary();
  renderSalesTable();
  renderHeldOrdersBadge();
}

function bindSalesLifecycle() {
  const discountValue = document.getElementById('discountValue');
  const discountType = document.getElementById('discountType');
  const checkoutPayment = document.getElementById('checkoutPayment');
  const checkoutTendered = document.getElementById('checkoutTendered');
  const salesFromDate = document.getElementById('salesFromDate');
  const salesToDate = document.getElementById('salesToDate');
  const salesPaymentFilter = document.getElementById('salesPaymentFilter');

  if (discountValue) {
    discountValue.addEventListener('input', updateCartSummary);
  }

  if (discountType) {
    discountType.addEventListener('change', updateCartSummary);
  }

  if (checkoutPayment) {
    checkoutPayment.addEventListener('change', togglePaymentFields);
  }

  if (checkoutTendered) {
    checkoutTendered.addEventListener('input', calculateChange);
  }

  if (salesFromDate) salesFromDate.addEventListener('change', renderSalesTable);
  if (salesToDate) salesToDate.addEventListener('change', renderSalesTable);
  if (salesPaymentFilter) salesPaymentFilter.addEventListener('change', renderSalesTable);
}

function getCart() {
  return Array.isArray(APP_STATE.cart) ? APP_STATE.cart : [];
}

function setCart(cart) {
  updateState('cart', () => Array.isArray(cart) ? cart : []);
  renderCart();
  updateCartSummary();
}

function getProductById(productId) {
  return (APP_STATE.products || []).find(product => String(product.id) === String(productId));
}

function getIngredientById(ingredientId) {
  return (APP_STATE.ingredients || []).find(item => String(item.id) === String(ingredientId));
}

function getCartQuantityForProduct(productId) {
  return getCart()
    .filter(item => String(item.productId) === String(productId))
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getCartUnitsForProduct(productId) {
  return getCart()
    .filter(item => String(item.productId) === String(productId))
    .reduce((sum, item) => {
      return sum + (
        Number(item.quantity || 0) *
        Number(item.multiplier || 1)
      );
    }, 0);
}

function renderCart() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  const cart = getCart();

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <div class="empty-cart-icon">🛒</div>
        <div class="empty-cart-title">No items added</div>
        <div class="empty-cart-subtitle">Add a product to start the order</div>
      </div>
    `;
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

      <div class="cart-line-total">${formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</div>
    `;

    container.appendChild(row);
  });
}

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
  const discountValueEl = getElementByIds(['discountValue']);
  const discountTypeEl = getElementByIds(['discountType']);

  return {
    value: Number(discountValueEl?.value || 0),
    type: discountTypeEl?.value || 'percent'
  };
}

function calculateCartSubtotal() {
  return getCart().reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
}

function calculateCartDiscount() {
  const subtotal = calculateCartSubtotal();
  const { value, type } = getDiscountState();

  if (!value || value <= 0) return 0;

  const discount = type === 'percent' ? subtotal * (value / 100) : value;
  return Math.max(0, Math.min(discount, subtotal));
}

function calculateCartTax() {
  const subtotal = calculateCartSubtotal();
  const discount = calculateCartDiscount();
  const taxRate = Number(APP_STATE.settings?.taxRate || 0);
  return Math.max(0, (subtotal - discount) * (taxRate / 100));
}

function calculateCartTotal() {
  const subtotal = calculateCartSubtotal();
  const discount = calculateCartDiscount();
  const tax = calculateCartTax();
  return Math.max(0, subtotal - discount + tax);
}

function updateCartSummary() {
  const subtotal = calculateCartSubtotal();
  const discount = calculateCartDiscount();
  const tax = calculateCartTax();
  const total = calculateCartTotal();

  const subtotalEl = document.getElementById('cartSubtotal');
  const discountEl = document.getElementById('cartDiscount');
  const taxEl = document.getElementById('cartTax');
  const totalEl = document.getElementById('cartTotal');
  const checkoutTotal = getElementByIds(['checkoutTotal']);

  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (discountEl) discountEl.textContent = formatCurrency(discount);
  if (taxEl) taxEl.textContent = formatCurrency(tax);
  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (checkoutTotal) checkoutTotal.value = formatCurrency(total);

  calculateChange();
  return { subtotal, discount, tax, total };
}

function calculateChange() {
  const total = calculateCartTotal();
  const tenderedEl = getElementByIds(['checkoutTendered', 'amountTendered']);
  const changeEl = getElementByIds(['checkoutChange', 'changeAmount']);

  if (!tenderedEl || !changeEl) return 0;

  const tendered = parseMoney(tenderedEl.value);
  const change = Math.max(0, tendered - total);

  changeEl.value = formatCurrency(change);
  return change;
}

function addToCart(productId, variant = null) {
  const product = getProductById(productId);

  if (!product) {
    showNotification('Product not found', 'error');
    return;
  }

  const stock = Number(product.stock || 0);
  if (stock <= 0) {
    showNotification('Out of stock', 'error');
    return;
  }

  const cart = getCart();
  const variantId = variant?.id || '';
  const existing = cart.find(
    item =>
      String(item.productId) === String(productId) &&
      String(item.variantId || '') === String(variantId)
  );

  const currentUnits = getCartUnitsForProduct(productId);
  const unitsToAdd = Number(variant?.multiplier || 1);
  if ((currentUnits + unitsToAdd) > stock) {
    showNotification('Insufficient stock', 'error');
    return;
  }

  const lineName = variant?.name ? `${product.name} (${variant.name})` : product.name;
  const linePrice = Number(variant?.price ?? product.price ?? 0);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: generateId(),
      productId,
      variantId,
      name: lineName,
      price: linePrice,
      quantity: 1,
      recipe: Array.isArray(product.recipe) ? product.recipe : [],
      recipeMode: product.recipeMode || 'unit',
      batchYield: Number(product.batchYield || 1),
      multiplier: Number(variant?.multiplier || 1)
    });
  }

  setCart(cart);
}

function removeFromCart(id) {
  setCart(getCart().filter(item => String(item.id) !== String(id)));
}

function increaseQty(id) {
  const cart = getCart();
  const item = cart.find(x => String(x.id) === String(id));
  if (!item) return;

  const product = getProductById(item.productId);
  if (!product) return;

  const currentUnits = getCartUnitsForProduct(item.productId);
  const unitsToAdd = Number(item.multiplier || 1);
  if ((currentUnits + unitsToAdd) > Number(product.stock || 0)) {
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
  if (item.quantity <= 0) {
    removeFromCart(id);
    return;
  }

  setCart(cart);
}

function clearCart(skipConfirm = false) {
  if (!skipConfirm && getCart().length) {
    const confirmed = confirm('Clear current cart?');
    if (!confirmed) return;
  }

  setCart([]);
  showNotification('Cart cleared', 'success');
}

function holdOrder() {
  const cart = getCart();
  if (!cart.length) {
    showNotification('Cart is empty', 'error');
    return;
  }

  const heldOrders = Array.isArray(APP_STATE.heldOrders) ? APP_STATE.heldOrders : [];
  const snapshot = buildTransactionSnapshot({
    status: 'HELD',
    paymentStatus: 'PENDING',
    paymentMethod: getSelectedPaymentMethod(),
    tendered: 0,
    change: 0,
    referenceNumber: '',
    customerName: (function(){
    const existing=getCheckoutCustomerName();
    const entered=window.prompt('Customer name (optional):', existing || '');
    return String(entered || existing || 'Walk-in Customer').trim();
  })(),
    cartOverride: cart
  });

  heldOrders.push(snapshot);
  updateState('heldOrders', () => heldOrders);
  clearCart(true);
  renderHeldOrdersBadge();
  showNotification('Order held', 'success');
}

function renderHeldOrdersBadge() {
  const badge = document.getElementById('heldOrdersBadge');
  if (!badge) return;
  badge.textContent = String(Array.isArray(APP_STATE.heldOrders) ? APP_STATE.heldOrders.length : 0);
}

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

function openCheckoutModal() {
  if (!getCart().length) {
    showNotification('Cart is empty', 'error');
    return;
  }

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

  const isCash = method === 'cash';
  const isDigital = ['gcash', 'maya', 'bank', 'qrph'].includes(method);
  const isQR = method === 'qrph';

  if (tenderedWrap) tenderedWrap.style.display = isCash ? 'block' : 'none';
  if (referenceWrap) referenceWrap.style.display = isDigital ? 'block' : 'none';
  if (qrphSection) qrphSection.style.display = isQR ? 'block' : 'none';

  calculateChange();
}

function buildTransactionSnapshot({
  status,
  paymentStatus,
  paymentMethod,
  tendered,
  change,
  referenceNumber,
  customerName,
  cartOverride = null
}) {
  const cart = Array.isArray(cartOverride) ? cartOverride : getCart();
  const items = cart.map(item => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId || '',
    multiplier: Number(item.multiplier || 1),
    name: item.name,
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    total: Number(item.price || 0) * Number(item.quantity || 0),
    recipe: Array.isArray(item.recipe) ? item.recipe : [],
    recipeMode: item.recipeMode || 'unit',
    batchYield: Number(item.batchYield || 1)
  }));

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = calculateCartDiscount();
  const tax = calculateCartTax();
  const total = Math.max(0, subtotal - discount + tax);
  const timestamp = new Date().toISOString();
  const receiptNumber = `RCPT-${Date.now()}`;

  return {
    id: generateId(),
    receiptNumber,
    status,
    paymentStatus,
    customer: {
      name: customerName || 'Walk-in Customer'
    },
    payment: {
      method: paymentMethod,
      tendered: Number(tendered || 0),
      change: Number(change || 0),
      referenceNumber: referenceNumber || ''
    },
    totals: {
      subtotal,
      discount,
      tax,
      total
    },
    items,
    audit: {
      createdAt: timestamp,
      completedAt: status === 'COMPLETED' ? timestamp : null,
      completedBy: APP_STATE.currentUserRole || 'STAFF'
    },

    customerName: customerName || 'Walk-in Customer',
    paymentMethod,
    subtotal,
    discount,
    tax,
    total,
    tendered: Number(tendered || 0),
    change: Number(change || 0),
    referenceNumber: referenceNumber || '',
    createdAt: timestamp,
    completedAt: status === 'COMPLETED' ? timestamp : null
  };
}

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
      const currentDelta = ingredientDeltas.get(ingredient.id) || 0;
      ingredientDeltas.set(ingredient.id, currentDelta + totalUsage);
    });
  });

  if (!ingredientDeltas.size) return;

  const updatedIngredients = getIngredients().map(ingredient => {
    if (!ingredientDeltas.has(ingredient.id)) return ingredient;
    const nextStock = Math.max(0, Number(ingredient.stock || 0) - ingredientDeltas.get(ingredient.id));
    return {
      ...ingredient,
      stock: nextStock
    };
  });

  if (typeof setIngredients === 'function') {
    setIngredients(updatedIngredients);
  }

  const movements = Array.isArray(APP_STATE.inventoryMovements) ? APP_STATE.inventoryMovements : [];
  ingredientDeltas.forEach((usedQty, ingredientId) => {
    const ingredient = getIngredientById(ingredientId);
    if (!ingredient) return;

    movements.push({
      id: generateId(),
      ingredientId,
      ingredientName: ingredient.name,
      type: 'sale-deduction',
      quantityAdded: 0,
      quantityUsed: usedQty,
      reason: 'Sale deduction',
      previousStock: Number(ingredient.stock || 0),
      newStock: Math.max(0, Number(ingredient.stock || 0) - usedQty),
      createdAt: new Date().toISOString(),
      createdBy: APP_STATE.currentUserRole || 'STAFF'
    });
  });

  if (typeof setInventoryMovements === 'function') {
    setInventoryMovements(movements);
  } else {
    updateState('inventoryMovements', () => movements);
  }
}


function deductProductStockForCart(cart) {
  const updatedProducts = getProducts().map(product => {
    const quantitySold = cart.reduce((sum, line) => {
      if (String(line.productId) !== String(product.id)) return sum;
      return sum + (
        Number(line.quantity || 0) *
        Number(line.multiplier || 1)
      );
    }, 0);

    if (!quantitySold) return product;

    return {
      ...product,
      stock: Math.max(0, Number(product.stock || 0) - quantitySold)
    };
  });

  if (typeof setProducts === 'function') {
    setProducts(updatedProducts);
  } else {
    updateState('products', () => updatedProducts);
  }
}

function pushSale(transaction) {
  const sales = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  sales.push(transaction);
  updateState('sales', () => sales);
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function completeSale(forceStatus = 'COMPLETED') {
  const cart = getCart();
  if (!cart.length) {
    showNotification('Cart is empty', 'error');
    return;
  }

  const method = getSelectedPaymentMethod();
  const customerName = getCheckoutCustomerName();
  const referenceNumber = getPaymentReference();
  const subtotal = calculateCartSubtotal();
  const discount = calculateCartDiscount();
  const tax = calculateCartTax();
  const total = Math.max(0, subtotal - discount + tax);
  const isPending = String(forceStatus).toUpperCase() === 'PENDING';
  const paymentStatus = isPending ? 'PENDING' : 'PAID';

  let tendered = 0;
  let change = 0;

  if (!isPending && method === 'cash') {
    const tenderedEl = getElementByIds(['checkoutTendered', 'amountTendered']);
    tendered = parseMoney(tenderedEl?.value);
    if (tendered <= 0) tendered = total;
    if (tendered < total) {
      showNotification('Amount tendered is not enough', 'error');
      return;
    }
    change = tendered - total;
  } else if (!isPending) {
    tendered = total;
    change = 0;
  }

  if (!isPending && ['bank', 'qrph'].includes(method) && !referenceNumber) {
    showNotification('Reference number is required for this payment method', 'error');
    return;
  }

  const transaction = buildTransactionSnapshot({
    status: isPending ? 'PENDING' : 'COMPLETED',
    paymentStatus,
    paymentMethod: method,
    tendered,
    change,
    referenceNumber,
    customerName,
    cartOverride: cart
  });

  for (const product of getProducts()) {
    const requiredUnits = cart.reduce((sum, line) => {
      if (String(line.productId) !== String(product.id)) return sum;
      return sum + (
        Number(line.quantity || 0) *
        Number(line.multiplier || 1)
      );
    }, 0);

    if (requiredUnits > Number(product.stock || 0)) {
      showNotification(`${product.name}: insufficient stock`, 'error');
      return;
    }
  }

  pushSale(transaction);

  deductProductStockForCart(cart);
  deductInventoryForCart(cart);

  if (isPending) {
    transaction.audit = transaction.audit || {};
    transaction.audit.inventoryDeducted = true;
  }

  clearCart(true);
  closeModal('checkoutModal');
  renderReceipt(transaction);
  openModal('receiptModal');
  showNotification(isPending ? 'Order marked pending' : 'Sale completed', 'success');
  renderSalesTable();
  renderHeldOrdersBadge();
}

function renderReceipt(transaction) {
  const body = document.getElementById('receiptBody');
  if (!body) return;

  const brand = APP_STATE.settings?.brandName || 'Caflat.CoPOS v1';
  const footer = APP_STATE.settings?.receiptFooter || '';
  const dateText = new Date(transaction.audit.completedAt || transaction.audit.createdAt).toLocaleString();

  const itemsHtml = transaction.items.map(item => `
    <div class="receipt-line">
      <span>${escapeHtml(item.name)} x${item.quantity}</span>
      <span>${formatCurrency(item.total)}</span>
    </div>
  `).join('');

  const referenceLine = transaction.payment.referenceNumber
    ? `<div class="receipt-line"><span>Reference</span><span>${escapeHtml(transaction.payment.referenceNumber)}</span></div>`
    : '';

  body.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-brand">${escapeHtml(brand)}</div>
      <div>${dateText}</div>
      <div>${escapeHtml(transaction.receiptNumber)}</div>
      <div>${escapeHtml(transaction.status)}</div>
    </div>

    <div class="receipt-line"><span>Customer</span><span>${escapeHtml(transaction.customer.name || 'Walk-in Customer')}</span></div>
    <div class="receipt-line"><span>Payment</span><span>${escapeHtml(transaction.payment.method || 'cash')}</span></div>
    ${referenceLine}
    <div class="receipt-divider"></div>

    ${itemsHtml}

    <div class="receipt-divider"></div>
    <div class="receipt-line"><span>Subtotal</span><span>${formatCurrency(transaction.totals.subtotal)}</span></div>
    <div class="receipt-line"><span>Discount</span><span>${formatCurrency(transaction.totals.discount)}</span></div>
    <div class="receipt-line"><span>Tax</span><span>${formatCurrency(transaction.totals.tax)}</span></div>
    <div class="receipt-line receipt-total"><span>Total</span><span>${formatCurrency(transaction.totals.total)}</span></div>
    <div class="receipt-line"><span>Tendered</span><span>${formatCurrency(transaction.payment.tendered)}</span></div>
    <div class="receipt-line"><span>Change</span><span>${formatCurrency(transaction.payment.change)}</span></div>
    ${footer ? `<div class="receipt-divider"></div><div class="receipt-line"><span>${escapeHtml(footer)}</span><span></span></div>` : ''}
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openSaleReceipt(saleId) {
  const sale = getSales().find(item => String(item.id) === String(saleId));
  if (!sale) return;
  renderReceipt(sale);
  openModal('receiptModal');
}

function getSales() {
  return Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
}

function renderSalesTable() {
  const tableBody = document.querySelector('#salesTable tbody');
  if (!tableBody) return;

  const fromDateEl = document.getElementById('salesFromDate');
  const toDateEl = document.getElementById('salesToDate');
  const paymentFilterEl = document.getElementById('salesPaymentFilter');

  const fromDate = fromDateEl?.value ? new Date(`${fromDateEl.value}T00:00:00`) : null;
  const toDate = toDateEl?.value ? new Date(`${toDateEl.value}T23:59:59`) : null;
  const paymentFilter = String(paymentFilterEl?.value || '').toLowerCase();

  const sales = getSales().filter(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    const matchesFrom = !fromDate || saleDate >= fromDate;
    const matchesTo = !toDate || saleDate <= toDate;
    const matchesPayment = !paymentFilter || paymentFilter === 'all' || String(sale.paymentMethod || sale.payment?.method || '').toLowerCase() === paymentFilter;
    return matchesFrom && matchesTo && matchesPayment;
  });

  tableBody.innerHTML = '';

  if (!sales.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">No sales found</td>
      </tr>
    `;
    return;
  }

  sales.slice().reverse().forEach(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    const itemSummary = Array.isArray(sale.items)
      ? sale.items.map(item => `${item.name} x${item.quantity}`).join(', ')
      : '';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(sale.receiptNumber || sale.id || '')}</td>
      <td>${saleDate.toLocaleString()}</td>
      <td>${escapeHtml(itemSummary)}</td>
      <td>${formatCurrency(sale.subtotal ?? sale.totals?.subtotal ?? 0)}</td>
      <td>${formatCurrency(sale.total ?? sale.totals?.total ?? 0)}</td>
      <td>${(() => {
        const s = String(sale.status||'COMPLETED').toUpperCase();
        if (s === 'REFUNDED') return '<span class="badge-refunded">REFUNDED</span>';
        if (s === 'PENDING')  return '<span class="badge-pending">PENDING</span>';
        return '<span class="badge-completed">COMPLETED</span>';
      })()}</td>
      <td>
        <div class="table-actions">
          ${(() => {
            const s = String(sale.status||'').toUpperCase();
            if (s === 'PENDING') return `
              <button type="button" class="btn btn-sm" data-action="complete-pending-sale" data-id="${sale.id}">Complete</button>
              <button type="button" class="btn btn-sm btn-secondary" data-action="cancel-pending-sale" data-id="${sale.id}">Cancel</button>`;
            if (s === 'REFUNDED') return `
              <button type="button" class="btn btn-sm btn-secondary" data-action="open-sale-receipt" data-id="${sale.id}">Receipt</button>`;
            return `
              <button type="button" class="btn btn-sm btn-secondary" data-action="open-sale-receipt" data-id="${sale.id}">Receipt</button>
              <button type="button" class="btn btn-sm refund-btn" data-action="open-refund-modal" data-id="${sale.id}">Refund</button>`;
          })()}
        </div>
      </td>
    `;
    row.querySelector('[data-action="open-sale-receipt"]')?.addEventListener('click', () => openSaleReceipt(sale.id));
    tableBody.appendChild(row);
  });
}

function exportSalesReport() {
  const sales = getSales();
  const lines = [
    ['Receipt', 'Date', 'Payment', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total'].join(',')
  ];

  sales.forEach(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    lines.push([
      sale.receiptNumber || sale.id || '',
      saleDate.toISOString(),
      sale.paymentMethod || sale.payment?.method || '',
      sale.status || '',
      Number(sale.subtotal ?? sale.totals?.subtotal ?? 0),
      Number(sale.discount ?? sale.totals?.discount ?? 0),
      Number(sale.tax ?? sale.totals?.tax ?? 0),
      Number(sale.total ?? sale.totals?.total ?? 0)
    ].join(','));
  });

  downloadTextFile(`sales-report-${Date.now()}.csv`, lines.join('\n'));
  showNotification('Sales report exported', 'success');
}

function renderHeldOrdersBadge() {
  const badge = document.getElementById('heldOrdersBadge');
  if (!badge) return;
  badge.textContent = String(Array.isArray(APP_STATE.heldOrders) ? APP_STATE.heldOrders.length : 0);
}

function initializeSalesCompatibility() {
  window.openRefundModal = openRefundModal;
window.confirmRefund   = confirmRefund;
window.completeSale = completeSale;
  window.togglePaymentFields = togglePaymentFields;
  window.clearCart = clearCart;
  window.holdOrder = holdOrder;
  window.openCheckoutModal = openCheckoutModal;
  window.renderSalesTable = renderSalesTable;
  window.renderCart = renderCart;
  window.exportSalesReport = exportSalesReport;
  window.exportSalesCSV = exportSalesReport;
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

function completePendingSale(saleId){
 const sales=getSales();
 const sale=sales.find(s=>String(s.id)===String(saleId));
 if(!sale)return;
 sale.status='COMPLETED';
 sale.paymentStatus='PAID';
 sale.audit=sale.audit||{};
 sale.audit.completedAt=new Date().toISOString();

 sale.audit = sale.audit || {};
 sale.audit.inventoryDeducted = true;

 updateState('sales',()=>sales);
 renderSalesTable();
 showNotification('Pending sale completed','success');
}



function restoreInventoryForSale(sale){
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
      ingredientReturns.set(
        recipeItem.ingredientId,
        (ingredientReturns.get(recipeItem.ingredientId) || 0) + restoreQty
      );
    });
  });

  if (!ingredientReturns.size) return;

  const updatedIngredients = getIngredients().map(ingredient => {
    const restoreQty = ingredientReturns.get(ingredient.id);
    if (!restoreQty) return ingredient;
    return {
      ...ingredient,
      stock: Number(ingredient.stock || 0) + restoreQty
    };
  });

  if (typeof setIngredients === 'function') {
    setIngredients(updatedIngredients);
  }

  const movements = Array.isArray(APP_STATE.inventoryMovements) ? APP_STATE.inventoryMovements : [];
  ingredientReturns.forEach((qty, ingredientId) => {
    const ingredient = getIngredientById(ingredientId);
    if (!ingredient) return;

    movements.push({
      id: generateId(),
      ingredientId,
      ingredientName: ingredient.name,
      type: 'pending-cancel-restoration',
      quantityAdded: qty,
      quantityUsed: 0,
      reason: 'Pending sale cancelled',
      previousStock: Number(ingredient.stock || 0),
      newStock: Number(ingredient.stock || 0) + qty,
      createdAt: new Date().toISOString(),
      createdBy: APP_STATE.currentUserRole || 'STAFF'
    });
  });

  if (typeof setInventoryMovements === 'function') {
    setInventoryMovements(movements);
  } else {
    updateState('inventoryMovements', () => movements);
  }
}


function cancelPendingSale(saleId){

 const sales = getSales();

 const sale =
   sales.find(s => String(s.id) === String(saleId));

 if(!sale) return;

 if(sale.audit?.inventoryDeducted){

   const updatedProducts = getProducts().map(product => {

     const quantityToReturn = (sale.items || []).reduce((sum, line) => {
       if(String(line.productId) !== String(product.id)) return sum;
       return sum + (Number(line.quantity || 0) * Number(line.multiplier || 1));
     }, 0);

     if(!quantityToReturn) return product;

     return {
       ...product,
       stock: Number(product.stock || 0) + quantityToReturn
     };
   });

   if(typeof setProducts === 'function'){
     setProducts(updatedProducts);
   } else {
     updateState('products', () => updatedProducts);
   }
   restoreInventoryForSale(sale);
 }

 const filteredSales =
   sales.filter(s => String(s.id) !== String(saleId));

 updateState('sales', () => filteredSales);

 renderSalesTable();

 showNotification('Pending sale cancelled and stock restored','success');
}

window.completePendingSale=completePendingSale;
window.cancelPendingSale=cancelPendingSale;


function openHeldOrdersModal() {
  const modal=document.getElementById('heldOrdersModal');
  const list=document.getElementById('heldOrdersList');
  if(!modal||!list)return;
  const held=Array.isArray(APP_STATE.heldOrders)?APP_STATE.heldOrders:[];
  list.innerHTML=held.map((o,i)=>{
    const total=(o.total||o.grandTotal||0);
    const items=(o.items||[]).length;
    const name=o.customerName||'Walk-in Customer';
    return `<div class="held-order-card" data-held-index="${i}" style="border:1px solid #000;padding:16px;cursor:pointer;border-radius:12px;">
      <div style="font-weight:700;font-size:18px;">${name}</div>
      <div style="margin-top:6px;">${items} item(s) • ₱${Number(total).toFixed(2)}</div>
    </div>`;
  }).join('') || '<p>No held orders</p>';
  modal.classList.remove('hidden');
}
function closeHeldOrdersModal(){const m=document.getElementById('heldOrdersModal'); if(m)m.classList.add('hidden');}
function resumeHeldOrder(index){
 const held=Array.isArray(APP_STATE.heldOrders)?APP_STATE.heldOrders:[];
 const order=held[index];
 if(!order)return;
 updateState('cart',()=>Array.isArray(order.items)?order.items:[]);
 held.splice(index,1);
 updateState('heldOrders',()=>held);
 renderCart(); updateCartSummary(); renderHeldOrdersBadge(); closeHeldOrdersModal();
}

document.addEventListener('click',(e)=>{
 const card=e.target.closest('.held-order-card');
 if(card){
   resumeHeldOrder(Number(card.dataset.heldIndex));
 }
});

/* ═══════════════════════════════════════════════════════
   REFUND SYSTEM
   Admin only. Requires reason. Restores stock.
   Marks sale as REFUNDED — never deleted.
═══════════════════════════════════════════════════════ */

function openRefundModal(saleId) {
  // Role guard
  if ((APP_STATE.currentUserRole || '').toUpperCase() !== 'ADMIN') {
    showNotification('Refund requires Admin access', 'error');
    return;
  }

  const sale = getSales().find(s => String(s.id) === String(saleId));
  if (!sale) { showNotification('Sale not found', 'error'); return; }

  const status = (sale.status || '').toUpperCase();
  if (status === 'REFUNDED') {
    showNotification('Sale has already been refunded', 'error');
    return;
  }
  if (status === 'PENDING') {
    showNotification('Cancel pending orders from the actions menu instead', 'error');
    return;
  }

  // Populate modal fields
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

  set('refundReceiptNum', sale.receiptNumber || sale.id || '');
  set('refundSaleTotal',  formatCurrency(sale.total ?? sale.totals?.total ?? 0));
  const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt);
  set('refundSaleDate', saleDate.toLocaleString());

  // Items summary
  const itemsContainer = document.getElementById('refundItemsSummary');
  if (itemsContainer && Array.isArray(sale.items)) {
    itemsContainer.innerHTML = sale.items.map(item => `
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;
        border-bottom:1px solid var(--gray-100);">
        <span style="font-weight:700;">${escapeHtml(item.name)}
          <span style="color:var(--gray-400);font-weight:400;"> ×${item.quantity}</span>
        </span>
        <span>${formatCurrency(item.total ?? (item.price * item.quantity))}</span>
      </div>`).join('');
  }

  setVal('refundSaleId', saleId);
  setVal('refundReason', '');

  openModal('refundModal');
  setTimeout(() => document.getElementById('refundReason')?.focus(), 100);
}

function confirmRefund() {
  const saleId = document.getElementById('refundSaleId')?.value || '';
  const reason = String(document.getElementById('refundReason')?.value || '').trim();

  if (!reason) {
    showNotification('Refund reason is required', 'error');
    document.getElementById('refundReason')?.focus();
    return;
  }

  const sales = getSales();
  const sale  = sales.find(s => String(s.id) === String(saleId));
  if (!sale) { showNotification('Sale not found', 'error'); return; }

  const timestamp = new Date().toISOString();

  // Mark as REFUNDED
  sale.status        = 'REFUNDED';
  sale.paymentStatus = 'REFUNDED';
  sale.refund = {
    reason,
    refundedAt: timestamp,
    refundedBy: APP_STATE.currentUserRole || 'ADMIN'
  };
  sale.audit         = sale.audit || {};
  sale.audit.refundedAt = timestamp;
  sale.audit.refundedBy = APP_STATE.currentUserRole || 'ADMIN';

  updateState('sales', () => sales);

  // Restore product stock
  _restoreProductStock(sale);

  // Restore ingredient stock
  _restoreIngredientStock(sale);

  closeModal('refundModal');
  renderSalesTable();
  if (typeof refreshDashboard === 'function') refreshDashboard();
  showNotification(`Refund processed — stock restored`, 'success');
}

function _restoreProductStock(sale) {
  const products = Array.isArray(APP_STATE.products) ? [...APP_STATE.products] : [];
  (sale.items || []).forEach(line => {
    const idx = products.findIndex(p => String(p.id) === String(line.productId));
    if (idx < 0) return;
    const restoreUnits = Number(line.quantity || 0) * Number(line.multiplier || 1);
    products[idx] = { ...products[idx], stock: Number(products[idx].stock || 0) + restoreUnits };
  });
  updateState('products', () => products);
}

function _restoreIngredientStock(sale) {
  const ingredientDeltas = new Map();
  (sale.items || []).forEach(line => {
    const product = (APP_STATE.products || []).find(p => String(p.id) === String(line.productId));
    if (!product || !Array.isArray(product.recipe)) return;
    const batchYield = Math.max(1, Number(product.batchYield || 1));
    const recipeMode = String(product.recipeMode || 'unit');
    const lineUnits  = Number(line.quantity || 0) * Number(line.multiplier || 1);
    product.recipe.forEach(ri => {
      const perRecipe  = Number(ri.quantity || 0);
      const perUnit    = recipeMode === 'batch' ? perRecipe / batchYield : perRecipe;
      ingredientDeltas.set(ri.ingredientId,
        (ingredientDeltas.get(ri.ingredientId) || 0) + perUnit * lineUnits);
    });
  });
  if (!ingredientDeltas.size) return;

  const ingredients = (APP_STATE.ingredients || []).map(ing => {
    const restore = ingredientDeltas.get(ing.id);
    if (!restore) return ing;
    return { ...ing, stock: Number(ing.stock || 0) + restore };
  });
  updateState('ingredients', () => ingredients);
}

window.openRefundModal = openRefundModal;
window.confirmRefund   = confirmRefund;
