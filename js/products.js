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
    packagingItems: collectPackagingRows(),
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

function collectPackagingRows() {
  return Array.from(document.querySelectorAll('.packaging-row'))
    .map(row => {
      const name = sanitizeText(row.querySelector('.packaging-name')?.value);
      const cost = safeNumber(row.querySelector('.packaging-cost')?.value);
      if (!name) return null;
      return { id: row.dataset.pkgId || generateId(), name, cost };
    })
    .filter(Boolean);
}

window.collectPackagingRows = collectPackagingRows;

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
  const pb = document.getElementById('packagingBuilder'); if (pb) pb.innerHTML = '';
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
  if (Array.isArray(product.packagingItems)) product.packagingItems.forEach(p => addPackagingRow(p));
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

    const be = typeof calculateBreakEven === 'function' ? calculateBreakEven(product) : null;
    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${formatCurrency(product.price)}</td>
      <td style="font-variant-numeric:tabular-nums;">${product.stock}</td>
      <td>${product.reorderLevel}</td>
      <td style="font-variant-numeric:tabular-nums;">
        ${be ? `<span style="font-weight:800;">${be.breakEvenUnits}</span>
          <span style="font-size:10px;color:var(--gray-400);"> units</span>` : '—'}
      </td>
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

  const recipeRows    = document.querySelectorAll('.recipe-row');
  const packagingRows = document.querySelectorAll('.packaging-row');
  const hasContent    = recipeRows.length > 0 || packagingRows.length > 0;

  // Ingredient cost
  const ingredients = APP_STATE.ingredients || [];
  const recipeMode  = document.getElementById('recipeMode')?.value || 'unit';
  const batchYield  = Math.max(1, Number(document.getElementById('batchYield')?.value || 1));
  let ingredientCost = 0;
  recipeRows.forEach(row => {
    const ingredientId = row.querySelector('.recipe-ingredient')?.value;
    const qty          = Number(row.querySelector('.recipe-qty')?.value || 0);
    if (!ingredientId || !qty) return;
    const ing = ingredients.find(i => String(i.id) === String(ingredientId));
    if (!ing) return;
    const perUnit = recipeMode === 'batch' ? qty / batchYield : qty;
    ingredientCost += perUnit * Number(ing.costPerUnit || 0);
  });

  // Packaging cost
  let packagingCost = 0;
  packagingRows.forEach(row => {
    packagingCost += Number(row.querySelector('.packaging-cost')?.value || 0);
  });

  const totalCost = ingredientCost + packagingCost;
  const price     = Number(document.getElementById('productPrice')?.value || 0);
  const profit    = price - totalCost;
  const margin    = price > 0 ? (profit / price) * 100 : 0;
  const profitNeg = profit < 0;

  if (!hasContent && totalCost === 0) {
    container.innerHTML = `
      <div class="cost-preview-empty">Add recipe ingredients or packaging to see cost breakdown</div>`;
    return;
  }

  // Break-even calculation
  const be = typeof calculateBreakEvenFromForm === 'function'
    ? calculateBreakEvenFromForm() : null;

  container.innerHTML = `
    <div class="cost-preview-grid" style="margin-bottom:12px;">
      <div class="cost-preview-item">
        <div class="cost-preview-label">Total Cost</div>
        <div class="cost-preview-value">${formatCurrency(totalCost)}</div>
      </div>
      <div class="cost-preview-item">
        <div class="cost-preview-label">Price</div>
        <div class="cost-preview-value">${price > 0 ? formatCurrency(price) : '—'}</div>
      </div>
      <div class="cost-preview-item">
        <div class="cost-preview-label">Profit</div>
        <div class="cost-preview-value" style="${profitNeg ? 'color:#dc2626;' : 'color:#16a34a;'}">
          ${price > 0 ? formatCurrency(profit) : '—'}
        </div>
      </div>
      <div class="cost-preview-item">
        <div class="cost-preview-label">Margin</div>
        <div class="cost-preview-value" style="${profitNeg ? 'color:#dc2626;' : 'color:#16a34a;'}">
          ${price > 0 ? margin.toFixed(1) + '%' : '—'}
        </div>
      </div>
    </div>
    ${(ingredientCost > 0 || packagingCost > 0) ? `
    <div style="display:flex;gap:16px;padding-top:10px;border-top:1px solid var(--gray-100);">
      <div style="font-size:11px;color:var(--gray-500);">
        Ingredients: <span style="font-weight:700;">${formatCurrency(ingredientCost)}</span>
      </div>
      <div style="font-size:11px;color:var(--gray-500);">
        Packaging: <span style="font-weight:700;">${formatCurrency(packagingCost)}</span>
      </div>

    ${(() => {
      const be = typeof calculateBreakEvenFromForm === 'function' ? calculateBreakEvenFromForm() : null;
      if (!be || !be.breakEvenUnits) return '';
      const batchYield = be.batchYield || 1;
      const barPct = batchYield > 1 ? Math.min(100, Math.round((be.breakEvenUnits / batchYield) * 100)) : 0;
      const pureProfitUnits = Math.max(0, batchYield - be.breakEvenUnits);
      return '<div style=\"margin-top:12px;padding-top:10px;border-top:1px solid var(--gray-100);\">'
        + '<div style=\"font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:800;color:var(--gray-400);margin-bottom:6px;\">Break-Even</div>'
        + '<div style=\"display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px;\">'
        + '<div><span style=\"font-size:20px;font-weight:900;\">' + be.breakEvenUnits + '</span>'
        + '<span style=\"font-size:11px;color:var(--gray-500);margin-left:4px;\"> units to break even</span></div>'
        + (be.pureProfit > 0 ? '<div><span style=\"font-size:13px;font-weight:800;color:#16a34a;\">+' + formatCurrency(be.pureProfit) + '</span>'
        + '<span style=\"font-size:11px;color:var(--gray-500);margin-left:4px;\"> pure profit per unit after</span></div>' : '')
        + '</div>'
        + (batchYield > 1 ? '<div style=\"height:8px;background:var(--gray-100);border-radius:999px;overflow:hidden;\">'
        + '<div style=\"height:100%;width:' + barPct + '%;background:#2563eb;border-radius:999px;\"></div></div>'
        + '<div style=\"font-size:10px;color:var(--gray-400);margin-top:3px;\">'
        + be.breakEvenUnits + ' of ' + batchYield + ' per batch to break even · ' + pureProfitUnits + ' pure profit units per batch</div>' : '')
        + '</div>';
    })()}
    </div>` : ''}`;
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
      icon: '',
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
      icon: '',
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
      icon: '',
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
      icon: '',
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
      icon: '',
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
      ${escapeHtml(t.label)}
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
