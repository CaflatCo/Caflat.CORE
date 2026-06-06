/* ═══════════════════════════════════════════════════════
   PRODUCTS.JS — Product management + POS product grid
═══════════════════════════════════════════════════════ */

function getProducts() {
  return Array.isArray(APP_STATE.products) ? APP_STATE.products : [];
}

function setProducts(products) {
  updateState('products', () => Array.isArray(products) ? products : []);
  renderProductsTable();
  renderPOSProducts();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function getProductFormData() {
  return {
    id: getElementValue('productId') || generateId(),
    name: sanitizeText(getElementValue('productName')),
    category: sanitizeText(getElementValue('productCategory')),
    price: safeNumber(getElementValue('productPrice')),
    stock: safeNumber(getElementValue('productStock')),
    reorderLevel: safeNumber(getElementValue('productReorderLevel')),
    variantType: getElementValue('variantType') || 'custom',
    variants: collectVariants(),
    recipe: collectRecipeRows(),
    recipeMode: getElementValue('recipeMode') || 'unit',
    batchYield: safeNumber(getElementValue('batchYield')) || 1,
    createdAt: new Date().toISOString()
  };
}

function collectVariants() {
  return Array.from(document.querySelectorAll('.variant-row'))
    .map(row => {
      const name = sanitizeText(row.querySelector('.variant-name')?.value);
      const price = safeNumber(row.querySelector('.variant-price')?.value);
      if (!name) return null;
      const multiplier = safeNumber(row.querySelector('.variant-multiplier')?.value) || 1;
      return { id: row.dataset.variantId || generateId(), name, price, multiplier };
    })
    .filter(Boolean);
}

function collectRecipeRows() {
  return Array.from(document.querySelectorAll('.recipe-row'))
    .map(row => {
      const ingredientId = row.querySelector('.recipe-ingredient')?.value;
      const quantity = safeNumber(row.querySelector('.recipe-qty')?.value);
      if (!ingredientId) return null;
      return { ingredientId, quantity };
    })
    .filter(Boolean);
}

function saveProduct() {
  const data = getProductFormData();
  if (!data.name) { showNotification('Product name is required', 'error'); return; }
  if (!data.category) { showNotification('Category is required', 'error'); return; }

  const products = getProducts();
  const idx = products.findIndex(p => String(p.id) === String(data.id));
  if (idx >= 0) products[idx] = data;
  else products.push(data);

  setProducts(products);
  closeModal('productModal');
  clearProductForm();
  showNotification('Product saved', 'success');
}

function clearProductForm() {
  ['productId','productName','productCategory','productPrice','productStock','productReorderLevel','batchYield'].forEach(id => setElementValue(id, ''));
  const vb = document.getElementById('variantBuilder'); if (vb) vb.innerHTML = '';
  const rb = document.getElementById('recipeBuilder'); if (rb) rb.innerHTML = '';
}

function openProductModal(productId = null) {
  clearProductForm();
  if (productId) {
    const product = getProducts().find(p => String(p.id) === String(productId));
    if (product) hydrateProductForm(product);
  }
  openModal('productModal');
}

function hydrateProductForm(product) {
  setElementValue('productId', product.id);
  setElementValue('productName', product.name);
  setElementValue('productPrice', product.price);
  setElementValue('productStock', product.stock);
  setElementValue('productReorderLevel', product.reorderLevel);
  setElementValue('variantType', product.variantType || 'custom');
  setElementValue('recipeMode', product.recipeMode || 'unit');
  setElementValue('batchYield', product.batchYield || 1);

  // category
  const catSelect = document.getElementById('productCategory');
  if (catSelect) catSelect.value = product.category;

  if (Array.isArray(product.variants)) product.variants.forEach(v => addVariantRow(v));
  if (Array.isArray(product.recipe)) product.recipe.forEach(r => addRecipeRow(r));
}

function deleteProduct(productId) {
  if (!confirm('Delete this product?')) return;
  setProducts(getProducts().filter(p => String(p.id) !== String(productId)));
  showNotification('Product deleted', 'success');
}

function renderProductsTable() {
  const tableBody = document.querySelector('#productsTable tbody');
  if (!tableBody) return;

  const search = sanitizeText(getElementValue('productSearch')).toLowerCase();
  const category = getElementValue('productCategoryFilter');

  const products = getProducts().filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search);
    const matchesCategory = !category || category === 'All' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  tableBody.innerHTML = '';

  if (!products.length) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No products found</td></tr>`;
    return;
  }

  products.forEach(product => {
    const stock = Number(product.stock || 0);
    const soldOut = stock <= 0;
    const lowStock = !soldOut && stock <= Number(product.reorderLevel || 0);
    const row = document.createElement('tr');
    if (lowStock || soldOut) row.classList.add('low-stock-row');

    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${formatCurrency(product.price)}</td>
      <td style="font-variant-numeric:tabular-nums;">${product.stock}</td>
      <td>${product.reorderLevel}</td>
      <td>${soldOut ? `<span class="badge-low-stock">Sold Out</span>` : lowStock ? `<span class="badge-low-stock">Low Stock</span>` : `<span class="badge-ok">OK</span>`}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn btn-sm" data-action="edit-product" data-id="${product.id}">Edit</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="delete-product" data-id="${product.id}">Delete</button>
        </div>
      </td>`;
    tableBody.appendChild(row);
  });
}

function renderPOSProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const activeCategory = APP_STATE.ui?.activeCategory || 'All';
  const searchQuery = (APP_STATE.ui?.posSearch || '').toLowerCase();

  let products = getProducts().filter(p => activeCategory === 'All' || p.category === activeCategory);
  if (searchQuery) products = products.filter(p => p.name.toLowerCase().includes(searchQuery));

  grid.innerHTML = '';

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state">No products found</div>`;
    return;
  }

  const cart = getCart();

  products.forEach(product => {
    const stock = Number(product.stock || 0);
    const soldOut = stock <= 0;
    const lowStock = !soldOut && stock <= Number(product.reorderLevel || 0);
    const cartQty = cart.filter(i => String(i.productId) === String(product.id)).reduce((s, i) => s + i.quantity, 0);
    const hasVariants = Array.isArray(product.variants) && product.variants.length;

    const card = document.createElement('div');
    card.className = `pos-product-card${lowStock ? ' low-stock' : ''}${soldOut ? ' out-of-stock' : ''}`;

    card.innerHTML = `
      ${cartQty > 0 ? `<div class="pos-card-cart-qty">${cartQty}</div>` : ''}
      <div class="pos-card-top">
        <div class="pos-category-badge">${escapeHtml(product.category)}</div>
        ${lowStock && !soldOut ? `<div class="pos-low-stock-pill">Low</div>` : ''}
      </div>
      <div class="pos-product-body">
        <div class="pos-product-name">${escapeHtml(product.name)}</div>
      </div>
      <div class="pos-product-footer">
        <div class="pos-product-price">${formatCurrency(product.price)}</div>
        <div class="pos-product-stock${lowStock ? ' low' : ''}">${soldOut ? 'SOLD OUT' : `${stock} left`}</div>
      </div>`;

    if (hasVariants && !soldOut) {
      const optBtn = document.createElement('button');
      optBtn.className = 'pos-options-btn';
      optBtn.textContent = 'Options ›';
      optBtn.addEventListener('click', e => {
        e.stopPropagation();
        openVariantSelector(product.id);
      });
      card.querySelector('.pos-product-footer').appendChild(optBtn);
    }

    if (!soldOut) {
      card.addEventListener('click', () => {
        if (hasVariants) { openVariantSelector(product.id); return; }
        addToCart(product.id);
      });
    }

    grid.appendChild(card);
  });
}

window.getProducts = getProducts;
window.setProducts = setProducts;
window.saveProduct = saveProduct;
window.openProductModal = openProductModal;
window.deleteProduct = deleteProduct;
window.renderProductsTable = renderProductsTable;
window.renderPOSProducts = renderPOSProducts;
window.clearProductForm = clearProductForm;
