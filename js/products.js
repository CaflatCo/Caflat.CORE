function getProducts() {
  return Array.isArray(APP_STATE.products) ? APP_STATE.products : [];
}

function setProducts(products) {
  updateState('products', () => Array.isArray(products) ? products : []);
  renderProductsTable();
  renderPOSProducts();
  refreshDashboard();
}

function getProductFormData() {
  return {
    id: getElementValue('productId') || generateId(),
    name: sanitizeText(getElementValue('productName')),
    category: sanitizeText(getElementValue('productCategory')),
    description: sanitizeText(getElementValue('productDescription')),
    price: safeNumber(getElementValue('productPrice')),
    stock: safeNumber(getElementValue('productStock')),
    reorderLevel: safeNumber(getElementValue('productReorderLevel')),
    variantType: getElementValue('variantType') || 'custom',
    variants: collectVariants(),
    recipe: collectRecipeRows(),
    createdAt: new Date().toISOString()
  };
}

function collectVariants() {
  const rows = document.querySelectorAll('.variant-row');
  return Array.from(rows)
    .map(row => {
      const name = sanitizeText(row.querySelector('.variant-name')?.value);
      const price = safeNumber(row.querySelector('.variant-price')?.value);
      if (!name) return null;
      const multiplier = safeNumber(row.querySelector('.variant-multiplier')?.value)||1;
      return { id: row.dataset.variantId || generateId(), name, price, multiplier };
    })
    .filter(Boolean);
}

function collectRecipeRows() {
  const rows = document.querySelectorAll('.recipe-row');
  return Array.from(rows)
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

  if (!data.name) {
    showNotification('Product name is required', 'error');
    return;
  }

  if (!data.category) {
    showNotification('Category is required', 'error');
    return;
  }

  const products = getProducts();
  const existingIndex = products.findIndex(product => String(product.id) === String(data.id));

  if (existingIndex >= 0) {
    products[existingIndex] = data;
  } else {
    products.push(data);
  }

  setProducts(products);
  closeModal('productModal');
  clearProductForm();
  showNotification('Product saved successfully', 'success');
}

function clearProductForm() {
  setElementValue('productId', '');
  setElementValue('productName', '');
  setElementValue('productCategory', '');
  setElementValue('productDescription', '');
  setElementValue('productPrice', '');
  setElementValue('productStock', '');
  setElementValue('productReorderLevel', '');

  const variantContainer = document.getElementById('variantBuilder');
  if (variantContainer) variantContainer.innerHTML = '';

  const recipeContainer = document.getElementById('recipeBuilder');
  if (recipeContainer) recipeContainer.innerHTML = '';
}

function openProductModal(productId = null) {
  clearProductForm();

  if (productId) {
    const product = getProducts().find(item => String(item.id) === String(productId));
    if (product) {
      hydrateProductForm(product);
      // Trigger after DOM settles so dropdowns are populated
      setTimeout(() => {
        if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
      }, 50);
    }
  } else {
    // Reset preview for new product
    const container = document.getElementById('productCostPreview');
    if (container) container.innerHTML = '';
  }

  openModal('productModal');
}

function hydrateProductForm(product) {
  setElementValue('productId', product.id);
  setElementValue('productName', product.name);
  setElementValue('productCategory', product.category);
  setElementValue('productDescription', product.description);
  setElementValue('productPrice', product.price);
  setElementValue('productStock', product.stock);
  setElementValue('productReorderLevel', product.reorderLevel);
  setElementValue('variantType', product.variantType || 'custom');

  if (Array.isArray(product.variants)) {
    product.variants.forEach(variant => addVariantRow(variant));
  }

  if (Array.isArray(product.recipe)) {
    product.recipe.forEach(recipeItem => addRecipeRow(recipeItem));
  }
}

function deleteProduct(productId) {
  const confirmed = confirm('Delete this product?');
  if (!confirmed) return;

  const filtered = getProducts().filter(product => String(product.id) !== String(productId));
  setProducts(filtered);
  showNotification('Product deleted', 'success');
}

function renderProductsTable() {
  const tableBody = document.querySelector('#productsTable tbody');
  if (!tableBody) return;

  const search = sanitizeText(getElementValue('productSearch')).toLowerCase();
  const category = getElementValue('productCategoryFilter');

  const products = getProducts().filter(product => {
    const matchesSearch = !search || product.name.toLowerCase().includes(search);
    const matchesCategory = !category || category === 'All' || product.category === category;
    return matchesSearch && matchesCategory;
  });

  tableBody.innerHTML = '';

  if (!products.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">No products found</td>
      </tr>
    `;
    return;
  }

  products.forEach(product => {
    const soldOut = Number(product.stock || 0) <= 0;
    const lowStock = !soldOut && Number(product.stock || 0) <= Number(product.reorderLevel || 0);
    const row = document.createElement('tr');
    if (lowStock || soldOut) row.classList.add('low-stock-row');

    row.innerHTML = `
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${formatCurrency(product.price)}</td>
      <td>${product.stock}</td>
      <td>${product.reorderLevel}</td>
      <td>
        ${soldOut
          ? `<span class="badge-low-stock">SOLD OUT</span>`
          : lowStock
            ? `<span class="badge-low-stock">Low Stock</span>`
            : `<span class="badge dark">OK</span>`
        }
      </td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn btn-sm" data-action="edit-product" data-id="${product.id}">Edit</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="delete-product" data-id="${product.id}">Delete</button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function renderPOSProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const activeCategory = APP_STATE.ui?.activeCategory || 'All';
  const products = getProducts().filter(product => activeCategory === 'All' || product.category === activeCategory);

  grid.innerHTML = '';

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state">No products found</div>`;
    return;
  }

  products.forEach(product => {
    const soldOut = Number(product.stock || 0) <= 0;
    const lowStock = !soldOut && Number(product.stock || 0) <= Number(product.reorderLevel || 0);
    const card = document.createElement('div');
    card.className = `pos-product-card ${lowStock ? 'low-stock' : ''} ${soldOut ? 'out-of-stock' : ''}`;

    card.innerHTML = `
      <div class="pos-card-top">
        <div class="pos-category-badge">${escapeHtml(product.category)}</div>
        
      </div>

      <div class="pos-product-body">
        <div class="pos-product-name">${escapeHtml(product.name)}</div>
        
      </div>

      <div class="pos-product-footer">
        <div class="pos-product-price">${formatCurrency(product.price)}</div>
        <div class="pos-product-stock">${soldOut ? 'SOLD OUT' : lowStock ? `${product.stock} LEFT • LOW` : `${product.stock} LEFT`}</div>
      </div>
    `;

    if (Array.isArray(product.variants) && product.variants.length) {
      const optionsBtn = document.createElement('button');
      optionsBtn.className = 'pos-options-btn';
      optionsBtn.textContent = 'Options';
      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openVariantSelector(product.id);
      });
      const category = card.querySelector('.product-category');
      if (category && category.parentNode) {
        category.parentNode.appendChild(optionsBtn);
      } else {
        const top=card.querySelector('.pos-card-top'); if(top) top.appendChild(optionsBtn); else card.appendChild(optionsBtn);
      }
    }

    if (!soldOut) {
  card.addEventListener('click', () => {
    addToCart(product.id);
  });
}

    grid.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ── Product cost preview ── */
function renderProductCostPreview() {
  const container = document.getElementById('productCostPreview');
  if (!container) return;

  const cost  = calculateProductCostFromForm();    // analytics.js — single source
  const price = Number(document.getElementById('productPrice')?.value || 0);
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  const hasRecipe = document.querySelectorAll('.recipe-row').length > 0;

  if (!hasRecipe) {
    container.innerHTML = `
      <div class="cost-preview-empty">
        Add recipe ingredients to see cost breakdown
      </div>`;
    return;
  }

  const profitColor = profit >= 0 ? 'var(--black)' : '#dc2626';
  const marginColor = margin >= 0 ? 'var(--black)' : '#dc2626';

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
        <div class="cost-preview-value" style="color:${profitColor};">
          ${price > 0 ? formatCurrency(profit) : '—'}
        </div>
      </div>
      <div class="cost-preview-item">
        <div class="cost-preview-label">Margin</div>
        <div class="cost-preview-value" style="color:${marginColor};">
          ${price > 0 ? margin.toFixed(1) + '%' : '—'}
        </div>
      </div>
    </div>`;
}

window.renderProductCostPreview = renderProductCostPreview;

window.getProducts = getProducts;
window.setProducts = setProducts;
window.saveProduct = saveProduct;
window.openProductModal = openProductModal;
window.deleteProduct = deleteProduct;
window.renderProductsTable = renderProductsTable;
window.renderPOSProducts = renderPOSProducts;
window.clearProductForm = clearProductForm;
