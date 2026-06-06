function initializeUIActions() {
  bindPrimaryButtons();
  bindModalButtons();
  bindImportExport();
  bindVariantBuilder();
  bindRecipeBuilder();
  bindDelegatedActions();
  renderCategoryTabs();
}

function bindPrimaryButtons() {
  const bindings = [
    ['addProductBtn', () => openProductModal()],
    ['addIngredientBtn', () => openIngredientModal()],
    ['addCategoryBtn', () => addCategory()],
    ['saveProductBtn', () => saveProduct()],
    ['saveIngredientBtn', () => saveIngredient()],
    ['saveSettingsBtn', () => saveSettings()],
    ['resetDataBtn', () => {
      const confirmText = prompt('Type RESET to clear all business data');
      if (confirmText === 'RESET') resetBusinessData();
    }],
    ['logoutBtn', () => logout()],
    ['loadDemoBtn', () => loadDemoData()],
    ['exportSalesBtn', () => exportSalesReport()],
    ['checkoutBtn', () => openCheckoutModal()],
    ['clearCartBtn', () => clearCart()],
    ['heldOrdersBtn', () => openHeldOrdersModal()],
    ['holdOrderBtn', () => holdOrder()],
    ['applyDiscountBtn', () => updateCartSummary()],
    ['importDataBtn', () => document.getElementById('importDataInput')?.click()]
  ];

  bindings.forEach(([id, handler]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  });
}

function bindModalButtons() {
  document.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.closeModal;
      if (!target) return;
      closeModal(target);
    });
  });
}

function bindImportExport() {
  const exportBtn = document.getElementById('exportDataBtn');
  const importInput = document.getElementById('importDataInput');

  if (exportBtn) {
    exportBtn.addEventListener('click', exportAllData);
  }

  if (importInput) {
    importInput.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      importAllData(file);
      event.target.value = '';
    });
  }
}

function bindVariantBuilder() {
  const addVariantBtn = document.getElementById('addVariantBtn');
  if (!addVariantBtn) return;
  addVariantBtn.addEventListener('click', () => addVariantRow());
}

function bindRecipeBuilder() {
  const addRecipeBtn = document.getElementById('addRecipeBtn');
  if (!addRecipeBtn) return;
  addRecipeBtn.addEventListener('click', () => addRecipeRow());

  // Live cost preview when price changes
  const priceInput = document.getElementById('productPrice');
  if (priceInput) {
    priceInput.addEventListener('input', () => {
      if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
    });
  }
}

function bindDelegatedActions() {
  document.addEventListener('click', event => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;

    switch (action) {
      case 'export-data':
        exportAllData();
        break;

      case 'edit-product':
        openProductModal(actionEl.dataset.id || '');
        break;
      case 'delete-product':
        deleteProduct(actionEl.dataset.id || '');
        break;
      case 'edit-ingredient':
        openIngredientModal(actionEl.dataset.id || '');
        break;
      case 'delete-ingredient':
        deleteIngredient(actionEl.dataset.id || '');
        break;
      case 'add-to-cart':
        addToCart(actionEl.dataset.id || '');
        break;
      case 'increase-qty':
        increaseQty(actionEl.dataset.id || '');
        break;
      case 'decrease-qty':
        decreaseQty(actionEl.dataset.id || '');
        break;
      case 'remove-from-cart':
        removeFromCart(actionEl.dataset.id || '');
        break;
      case 'add-to-cart-variant': {
        const productId = actionEl.dataset.productId || '';
        const variantId = actionEl.dataset.variantId || '';
        const product = getProducts().find(item => String(item.id) === String(productId));
        const variant = product?.variants?.find(v => String(v.id) === String(variantId)) || null;
        if (product) addToCart(productId, variant);
        break;
      }
      case 'filter-category':
        setActiveCategory(actionEl.dataset.category || 'All');
        break;
      case 'complete-sale':
        completeSale();
        break;
      case 'complete-sale-pending':
        completeSale('pending');
        break;
      case 'clear-cart':
        clearCart();
        break;
      case 'hold-order':
        holdOrder();
        break;
      case 'open-checkout':
        openCheckoutModal();
        break;
      case 'export-sales':
        exportSalesReport();
        break;
      case 'load-demo':
        loadDemoData();
        break;
      case 'save-settings':
        saveSettings();
        break;
      case 'add-category':
        addCategory();
        break;
      case 'restock-ingredient':
        openRestockModal(actionEl.dataset.id || '');
        break;
      case 'save-restock':
        saveRestockMovement();
        break;
      case 'cancel-restock':
        closeModal('restockModal');
        break;
      case 'refresh-reports':
        if (typeof renderReports === 'function') renderReports();
        break;
      case 'print-receipt':
        printReceipt();
        break;
      case 'open-refund-modal':
        if (typeof openRefundModal === 'function') openRefundModal(actionEl.dataset.id || '');
        break;
      case 'confirm-refund':
        if (typeof confirmRefund === 'function') confirmRefund();
        break;
      case 'complete-pending-sale':
        completePendingSale(actionEl.dataset.id || '');
        break;
      case 'cancel-pending-sale':
        cancelPendingSale(actionEl.dataset.id || '');
        break;
      default:
        break;
    }
  });
}

function setActiveCategory(category = 'All') {
  updateState('ui', current => ({
    ...current,
    activeCategory: category
  }));

  renderCategoryTabs();
  renderPOSProducts();
}

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;

  const categories = Array.isArray(APP_STATE.categories) ? APP_STATE.categories : [];
  const activeCategory = APP_STATE.ui?.activeCategory || 'All';

  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.textContent = 'All';
  allBtn.dataset.action = 'filter-category';
  allBtn.dataset.category = 'All';
  if (activeCategory === 'All') allBtn.classList.add('active');
  container.appendChild(allBtn);

  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = category;
    button.dataset.action = 'filter-category';
    button.dataset.category = category;
    if (String(activeCategory) === String(category)) button.classList.add('active');
    container.appendChild(button);
  });
}

function addVariantRow(variant = null) {
  const container = document.getElementById('variantBuilder');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'variant-row';
  row.dataset.variantId = variant?.id || generateId();
  row.innerHTML = `
    <input type="text" class="variant-name" placeholder="Variant Name" value="${variant?.name || ''}">
    <input type="number" class="variant-price" placeholder="Price" value="${variant?.price || ''}"><input type="number" class="variant-multiplier" placeholder="Multiplier" value="${variant?.multiplier || 1}">
    <button type="button" class="btn btn-secondary remove-variant-btn" data-action="remove-variant">Remove</button>
  `;

  row.querySelector('.remove-variant-btn')?.addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function addRecipeRow(recipe = null) {
  const container = document.getElementById('recipeBuilder');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'recipe-row';
  row.innerHTML = `
    <select class="recipe-ingredient"></select>
    <input type="number" class="recipe-qty" placeholder="Quantity" value="${recipe?.quantity || ''}">
    <button type="button" class="btn btn-secondary remove-recipe-btn" data-action="remove-recipe">Remove</button>
  `;

  row.querySelector('.remove-recipe-btn')?.addEventListener('click', () => {
    row.remove();
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });

  // Live update on ingredient select or qty change
  row.querySelector('.recipe-ingredient')?.addEventListener('change', () => {
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });
  row.querySelector('.recipe-qty')?.addEventListener('input', () => {
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });

  container.appendChild(row);
  renderIngredientDropdowns();

  if (recipe?.ingredientId) {
    row.querySelector('.recipe-ingredient').value = recipe.ingredientId;
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  }
}

function openVariantSelector(productId) {
  const product = getProducts().find(item => String(item.id) === String(productId));
  if (!product || !Array.isArray(product.variants) || !product.variants.length) return;

  const container = document.getElementById('variantOptions');
  if (!container) return;

  container.innerHTML = '';
  product.variants.forEach(variant => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'variant-option';
    option.dataset.action = 'add-to-cart-variant';
    option.dataset.productId = product.id;
    option.dataset.variantId = variant.id;
    option.innerHTML = `
      <div class="variant-option-name">${variant.name}</div>
      <div class="variant-option-price">${formatCurrency(variant.price)}</div>
    `;
    container.appendChild(option);
  });

  openModal('variantModal');
}


window.initializeUIActions = initializeUIActions;
window.addVariantRow = addVariantRow;
window.addRecipeRow = addRecipeRow;
window.openVariantSelector = openVariantSelector;
window.renderCategoryTabs = renderCategoryTabs;
window.setActiveCategory = setActiveCategory;


function printReceipt() {
  const receiptBody = document.getElementById('receiptBody');

  if (!receiptBody) {
    showNotification('Receipt not found', 'error');
    return;
  }

  const printWindow = window.open('', '_blank');

  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #000;
          }

          .receipt {
            max-width: 320px;
            margin: 0 auto;
          }

          .receipt-line {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
          }

          .receipt-divider {
            border-top: 1px dashed #000;
            margin: 10px 0;
          }

          .receipt-total {
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        ${receiptBody.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

window.printReceipt = printReceipt;

document.addEventListener('click',(e)=>{
 if(e.target && e.target.classList.contains('resume-held-btn')) resumeHeldOrder(Number(e.target.dataset.heldIndex));
 if(e.target && e.target.id==='closeHeldOrdersBtn') closeHeldOrdersModal();
});
