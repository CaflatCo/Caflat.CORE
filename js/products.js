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
  // Final dropdown sync before modal opens — ensures all selects have correct values
  if (typeof renderIngredientDropdowns === 'function') renderIngredientDropdowns();

  openModal('productModal');

  setTimeout(() => {
    if (typeof renderProductTemplates   === 'function') renderProductTemplates();
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  }, 80);
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
    if (soldOut) row.classList.add('sold-out-row');
    else if (lowStock) row.classList.add('low-stock-row');

    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${formatCurrency(product.price)}</td>
      <td style="font-variant-numeric:tabular-nums;">${product.stock}</td>
      <td>${product.reorderLevel}</td>
      <td>${soldOut ? `<span class="badge-sold-out">Sold Out</span>` : lowStock ? `<span class="badge-low-stock">Low Stock</span>` : `<span class="badge-ok">OK</span>`}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn btn-sm" data-action="edit-product" data-id="${product.id}">Edit</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="clone-product" data-id="${product.id}">Clone</button>
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
        <div class="pos-product-footer-left">
          <div class="pos-product-price">${formatCurrency(product.price)}</div>
          <div class="pos-product-stock${lowStock ? ' low' : ''}">${soldOut ? 'SOLD OUT' : `${stock} left`}</div>
        </div>
        ${hasVariants && !soldOut ? `<button class="pos-options-btn" type="button" title="Options">&#x22EF;</button>` : ''}
      </div>`;

    // Ellipsis button opens variant selector; stopPropagation keeps card tap clean
    if (hasVariants && !soldOut) {
      card.querySelector('.pos-options-btn').addEventListener('click', e => {
        e.stopPropagation();
        openVariantSelector(product.id);
      });
    }

    // Card tap always adds base product to cart (spammable)
    if (!soldOut) {
      card.addEventListener('click', () => addToCart(product.id));
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

/* ═══════════════════════════════════════════════════════
   PRODUCT COST PREVIEW
   Reads from DOM via analytics.js. Pure renderer.
═══════════════════════════════════════════════════════ */

function renderProductCostPreview() {
  const container = document.getElementById('productCostPreview');
  if (!container) return;

  const hasRows = document.querySelectorAll('.recipe-row').length > 0;
  const cost    = calculateProductCostFromForm(); // analytics.js
  const price   = Number(document.getElementById('productPrice')?.value || 0);
  const profit  = price - cost;
  const margin  = price > 0 ? (profit / price) * 100 : 0;

  if (!hasRows && cost === 0) {
    container.innerHTML = `
      <div class="cost-preview-empty">
        Add recipe ingredients to see cost breakdown
      </div>`;
    return;
  }

  const profitNeg = profit < 0;

  container.innerHTML = `
    <div class="cost-preview-grid">
      <div class="cost-preview-item">
        <div class="cost-preview-label">Cost</div>
        <div class="cost-preview-value">${formatCurrency(cost)}</div>
      </div>
      <div class="cost-preview-item">
        <div class="cost-preview-label">Price</div>
        <div class="cost-preview-value">${price > 0 ? formatCurrency(price) : '—'}</div>
      </div>
      <div class="cost-preview-item">
        <div class="cost-preview-label">Profit</div>
        <div class="cost-preview-value" style="${profitNeg ? 'color:#dc2626;' : ''}">
          ${price > 0 ? formatCurrency(profit) : '—'}
        </div>
      </div>
      <div class="cost-preview-item">
        <div class="cost-preview-label">Margin</div>
        <div class="cost-preview-value" style="${profitNeg ? 'color:#dc2626;' : ''}">
          ${price > 0 ? margin.toFixed(1) + '%' : '—'}
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════
   PRODUCT TEMPLATES
   Preset base configurations per category.
   Templates are starting points — all fields editable.
═══════════════════════════════════════════════════════ */

const PRODUCT_TEMPLATES = {
  'Cookies': [
    {
      label: 'Classic Cookie',
      icon: '🍪',
      data: { price: 65, stock: 24, reorderLevel: 6, recipeMode: 'batch', batchYield: 12,
              variantType: 'quantity',
              variants: [
                { name: 'Single',   price: 65,  multiplier: 1 },
                { name: 'Box of 4', price: 240, multiplier: 4 },
                { name: 'Box of 6', price: 350, multiplier: 6 }
              ]}
    },
    {
      label: 'Chewy Cookie',
      icon: '🍫',
      data: { price: 85, stock: 24, reorderLevel: 6, recipeMode: 'batch', batchYield: 12,
              variantType: 'quantity',
              variants: [
                { name: 'Single',    price: 85,  multiplier: 1  },
                { name: 'Box of 4',  price: 320, multiplier: 4  },
                { name: 'Box of 12', price: 900, multiplier: 12 }
              ]}
    }
  ],
  'Drinks': [
    {
      label: 'Iced Drink',
      icon: '🧋',
      data: { price: 120, stock: 30, reorderLevel: 5, recipeMode: 'unit', batchYield: 1,
              variantType: 'size',
              variants: [
                { name: 'Small',  price: 100, multiplier: 1 },
                { name: 'Medium', price: 120, multiplier: 1 },
                { name: 'Large',  price: 150, multiplier: 1 }
              ]}
    },
    {
      label: 'Hot Drink',
      icon: '☕',
      data: { price: 100, stock: 30, reorderLevel: 5, recipeMode: 'unit', batchYield: 1,
              variantType: 'size',
              variants: [
                { name: 'Regular', price: 100, multiplier: 1 },
                { name: 'Large',   price: 130, multiplier: 1 }
              ]}
    }
  ],
  'Pastries': [
    {
      label: 'Slice / Piece',
      icon: '🥐',
      data: { price: 95, stock: 12, reorderLevel: 3, recipeMode: 'unit', batchYield: 1,
              variants: [] }
    }
  ]
};

function getTemplatesForCategory(category) {
  if (!category) return [];
  // Exact match first, then partial
  const exact = PRODUCT_TEMPLATES[category];
  if (exact) return exact;
  const key = Object.keys(PRODUCT_TEMPLATES).find(k =>
    category.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(category.toLowerCase())
  );
  return key ? PRODUCT_TEMPLATES[key] : [];
}

function renderProductTemplates() {
  const container = document.getElementById('productTemplateRow');
  if (!container) return;

  const category  = document.getElementById('productCategory')?.value || '';
  const templates = getTemplatesForCategory(category);

  if (!templates.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const list = document.getElementById('productTemplateList');
  if (!list) return;

  list.innerHTML = templates.map((t, i) => `
    <button type="button" class="template-chip" data-template-index="${i}"
      title="Apply template: ${escapeHtml(t.label)}">
      ${t.icon} ${escapeHtml(t.label)}
    </button>`).join('');

  list.querySelectorAll('.template-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx      = Number(btn.dataset.templateIndex);
      const template = templates[idx];
      if (!template) return;
      applyProductTemplate(template.data, category);
    });
  });
}

function applyProductTemplate(templateData, category) {
  // Only fill fields that aren't already filled — don't overwrite name
  if (!document.getElementById('productPrice')?.value)
    setElementValue('productPrice', templateData.price);
  if (!document.getElementById('productStock')?.value)
    setElementValue('productStock', templateData.stock);
  if (!document.getElementById('productReorderLevel')?.value)
    setElementValue('productReorderLevel', templateData.reorderLevel);

  setElementValue('recipeMode',   templateData.recipeMode  || 'unit');
  setElementValue('batchYield',   templateData.batchYield  || 1);
  setElementValue('variantType',  templateData.variantType || 'custom');

  // Apply variants — clear existing first
  const vb = document.getElementById('variantBuilder');
  if (vb) vb.innerHTML = '';
  if (Array.isArray(templateData.variants)) {
    templateData.variants.forEach(v =>
      addVariantRow({ ...v, id: generateId() })
    );
  }

  renderProductCostPreview();
  showNotification('Template applied', 'success');
}

/* ═══════════════════════════════════════════════════════
   CLONE PRODUCT
   Copies all fields into a new product form.
   Prefixes name with "Copy of". New ID assigned.
═══════════════════════════════════════════════════════ */

function cloneProduct(productId) {
  const product = getProducts().find(p => String(p.id) === String(productId));
  if (!product) { showNotification('Product not found', 'error'); return; }

  clearProductForm();

  // Clear ID so it gets a new one on save
  setElementValue('productId', '');
  setElementValue('productName', `Copy of ${product.name}`);
  setElementValue('productPrice', product.price);
  setElementValue('productStock', product.stock);
  setElementValue('productReorderLevel', product.reorderLevel);
  setElementValue('recipeMode',  product.recipeMode  || 'unit');
  setElementValue('batchYield',  product.batchYield  || 1);
  setElementValue('variantType', product.variantType || 'custom');

  const catSelect = document.getElementById('productCategory');
  if (catSelect) catSelect.value = product.category;

  if (Array.isArray(product.variants))
    product.variants.forEach(v => addVariantRow({ ...v, id: generateId() }));

  // Add recipe rows with ingredient IDs pre-set BEFORE renderIngredientDropdowns
  if (Array.isArray(product.recipe)) {
    product.recipe.forEach(r => addRecipeRow(r));
  }

  // Final dropdown sync + cost preview after all rows are in DOM
  if (typeof renderIngredientDropdowns === 'function') renderIngredientDropdowns();

  openModal('productModal');

  // Give modal paint cycle time, then render cost + templates
  setTimeout(() => {
    if (typeof renderProductTemplates   === 'function') renderProductTemplates();
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  }, 80);

  showNotification(`Cloning "${product.name}" — edit and save`, 'info');
}

window.renderProductCostPreview = renderProductCostPreview;
window.renderProductTemplates   = renderProductTemplates;
window.applyProductTemplate     = applyProductTemplate;
window.cloneProduct             = cloneProduct;
