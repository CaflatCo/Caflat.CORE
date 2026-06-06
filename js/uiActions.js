/* ═══════════════════════════════════════════════════════
   UIACTIONS.JS — Single event system, all UI actions
═══════════════════════════════════════════════════════ */

function initializeUIActions() {
  bindPrimaryButtons();
  bindModalButtons();
  bindImportExport();
  bindVariantBuilder();
  bindRecipeBuilder();
  bindDelegatedActions();
  bindPOSSearch();
  renderCategoryTabs();
}

function bindPrimaryButtons() {
  const bindings = [
    ['addProductBtn',     () => openProductModal()],
    ['addIngredientBtn',  () => openIngredientModal()],
    ['addCategoryBtn',    () => addCategory()],
    ['saveProductBtn',    () => saveProduct()],
    ['saveIngredientBtn', () => saveIngredient()],
    ['saveSettingsBtn',   () => saveSettings()],
    ['resetDataBtn',      () => { if (prompt('Type RESET to clear all data') === 'RESET') resetBusinessData(); }],
    ['logoutBtn',         () => logout()],
    ['loadDemoBtn',       () => loadDemoData()],
    ['loadDemoBtnProducts', () => loadDemoData()],
    ['exportSalesBtn',    () => exportSalesReport()],
    ['checkoutBtn',       () => openCheckoutModal()],
    ['clearCartBtn',      () => clearCart()],
    ['heldOrdersBtn',     () => openHeldOrdersModal()],
    ['holdOrderBtn',      () => holdOrder()],
    ['importDataBtn',     () => document.getElementById('importDataInput')?.click()],
    ['exportDataBtn',     () => exportAllData()],
    ['exportDataBtnProducts', () => exportAllData()],
  ];

  bindings.forEach(([id, handler]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  });
}

function bindModalButtons() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.closeModal;
      if (target) closeModal(target);
    });
  });
}

function bindImportExport() {
  const importInput = document.getElementById('importDataInput');
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
  const btn = document.getElementById('addVariantBtn');
  if (btn) btn.addEventListener('click', () => addVariantRow());
}

function bindRecipeBuilder() {
  const btn = document.getElementById('addRecipeBtn');
  if (btn) btn.addEventListener('click', () => addRecipeRow());
}

function bindPOSSearch() {
  const input = document.getElementById('posSearch');
  if (input) {
    input.addEventListener('input', () => {
      updateState('ui', current => ({ ...current, posSearch: input.value || '' }));
      renderPOSProducts();
    });
  }
}

function bindDelegatedActions() {
  document.addEventListener('click', event => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case 'export-data':           exportAllData(); break;
      case 'edit-product':          openProductModal(actionEl.dataset.id || ''); break;
      case 'delete-product':        deleteProduct(actionEl.dataset.id || ''); break;
      case 'edit-ingredient':       openIngredientModal(actionEl.dataset.id || ''); break;
      case 'delete-ingredient':     deleteIngredient(actionEl.dataset.id || ''); break;
      case 'add-to-cart':           addToCart(actionEl.dataset.id || ''); break;
      case 'increase-qty':          increaseQty(actionEl.dataset.id || ''); break;
      case 'decrease-qty':          decreaseQty(actionEl.dataset.id || ''); break;
      case 'remove-from-cart':      removeFromCart(actionEl.dataset.id || ''); break;
      case 'add-to-cart-variant': {
        const productId  = actionEl.dataset.productId || '';
        const variantId  = actionEl.dataset.variantId || '';
        const product    = getProducts().find(p => String(p.id) === String(productId));
        const variant    = product?.variants?.find(v => String(v.id) === String(variantId)) || null;
        if (product) addToCart(productId, variant);
        closeModal('variantModal');
        break;
      }
      case 'filter-category':       setActiveCategory(actionEl.dataset.category || 'All'); break;
      case 'set-order-type':        setOrderType(actionEl.dataset.type || 'Dine In'); break;
      case 'complete-sale':         completeSale(); break;
      case 'complete-sale-pending': completeSale('pending'); break;
      case 'clear-cart':            clearCart(); break;
      case 'hold-order':            holdOrder(); break;
      case 'open-checkout':         openCheckoutModal(); break;
      case 'export-sales':          exportSalesReport(); break;
      case 'load-demo':             loadDemoData(); break;
      case 'save-settings':         saveSettings(); break;
      case 'add-category':          addCategory(); break;
      case 'restock-ingredient':    openRestockModal(actionEl.dataset.id || ''); break;
      case 'save-restock':          saveRestockMovement(); break;
      case 'cancel-restock':        closeModal('restockModal'); break;
      case 'refresh-reports':       if (typeof renderReports === 'function') renderReports(); break;
      case 'print-receipt':         printReceipt(); break;
      case 'complete-pending-sale': completePendingSale(actionEl.dataset.id || ''); break;
      case 'cancel-pending-sale':   cancelPendingSale(actionEl.dataset.id || ''); break;
      case 'open-sale-receipt':     openSaleReceipt(actionEl.dataset.id || ''); break;
      case 'open-void-modal':       openVoidModal(actionEl.dataset.id || ''); break;
      case 'confirm-void':          confirmVoid(); break;
      case 'delete-category':       deleteCategory(actionEl.dataset.category || ''); break;
      case 'quick-amount':          setQuickAmount(Number(actionEl.dataset.amount)); break;
      default: break;
    }
  });
}

/* ── Category / order type ── */
function setActiveCategory(category = 'All') {
  updateState('ui', current => ({ ...current, activeCategory: category }));
  renderCategoryTabs();
  renderPOSProducts();
}

function setOrderType(type) {
  updateState('ui', current => ({ ...current, orderType: type }));
  renderOrderTypeTabs();
}

function renderOrderTypeTabs() {
  const container = document.getElementById('orderTypeTabs');
  if (!container) return;
  const types = APP_STATE.settings?.orderTypes || ['Dine In', 'Take Out', 'Delivery'];
  const current = APP_STATE.ui?.orderType || 'Dine In';
  container.innerHTML = types.map(t => `
    <button type="button" class="order-type-btn${current === t ? ' active' : ''}"
      data-action="set-order-type" data-type="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
}

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;
  const categories = Array.isArray(APP_STATE.categories) ? APP_STATE.categories : [];
  const active = APP_STATE.ui?.activeCategory || 'All';
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.textContent = 'All';
  allBtn.dataset.action = 'filter-category';
  allBtn.dataset.category = 'All';
  if (active === 'All') allBtn.classList.add('active');
  container.appendChild(allBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = cat;
    btn.dataset.action = 'filter-category';
    btn.dataset.category = cat;
    if (String(active) === String(cat)) btn.classList.add('active');
    container.appendChild(btn);
  });
}

/* ── Variant / Recipe builders ── */
function addVariantRow(variant = null) {
  const container = document.getElementById('variantBuilder');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'variant-row';
  row.dataset.variantId = variant?.id || generateId();
  row.innerHTML = `
    <input type="text"   class="variant-name"       placeholder="Name"       value="${escapeHtml(variant?.name || '')}">
    <input type="number" class="variant-price"      placeholder="Price"      value="${variant?.price || ''}">
    <input type="number" class="variant-multiplier" placeholder="Multiplier" value="${variant?.multiplier || 1}">
    <button type="button" class="btn btn-sm btn-secondary remove-variant-btn">✕</button>`;
  row.querySelector('.remove-variant-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function addRecipeRow(recipe = null) {
  const container = document.getElementById('recipeBuilder');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'recipe-row';
  row.innerHTML = `
    <select class="recipe-ingredient"></select>
    <input type="number" class="recipe-qty" placeholder="Qty" value="${recipe?.quantity || ''}">
    <button type="button" class="btn btn-sm btn-secondary remove-recipe-btn">✕</button>`;
  row.querySelector('.remove-recipe-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
  renderIngredientDropdowns();
  if (recipe?.ingredientId) row.querySelector('.recipe-ingredient').value = recipe.ingredientId;
}

/* ── Variant selector modal ── */
function openVariantSelector(productId) {
  const product = getProducts().find(p => String(p.id) === String(productId));
  if (!product || !Array.isArray(product.variants) || !product.variants.length) return;

  const container = document.getElementById('variantOptions');
  if (!container) return;

  const title = document.getElementById('variantModalTitle');
  if (title) title.textContent = product.name;

  container.innerHTML = '';
  product.variants.forEach(variant => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'variant-option';
    option.dataset.action = 'add-to-cart-variant';
    option.dataset.productId = product.id;
    option.dataset.variantId = variant.id;
    option.innerHTML = `
      <div class="variant-option-name">${escapeHtml(variant.name)}</div>
      <div class="variant-option-price">${formatCurrency(variant.price)}</div>`;
    container.appendChild(option);
  });
  openModal('variantModal');
}

/* ── Print receipt ── */
function printReceipt() {
  const receiptBody = document.getElementById('receiptBody');
  if (!receiptBody) { showNotification('Receipt not found', 'error'); return; }

  const brand = APP_STATE.settings?.brandName || 'Caflat.Co POS';
  const pw = window.open('', '_blank');
  pw.document.write(`<!DOCTYPE html><html><head><title>Receipt — ${brand}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; color: #000; }
      .receipt { max-width: 320px; margin: 0 auto; }
      .receipt-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
      .receipt-brand { font-weight: bold; letter-spacing: 2px; font-size: 14px; margin-bottom: 4px; }
      .receipt-line { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; }
      .receipt-divider { border-top: 1px dashed #000; margin: 8px 0; }
      .receipt-total { font-weight: bold; font-size: 14px; }
      @media print { body { padding: 0; } }
    </style>
  </head><body><div class="receipt">${receiptBody.innerHTML}</div></body></html>`);
  pw.document.close();
  pw.focus();
  setTimeout(() => pw.print(), 300);
}

window.initializeUIActions  = initializeUIActions;
window.addVariantRow        = addVariantRow;
window.addRecipeRow         = addRecipeRow;
window.openVariantSelector  = openVariantSelector;
window.renderCategoryTabs   = renderCategoryTabs;
window.renderOrderTypeTabs  = renderOrderTypeTabs;
window.setActiveCategory    = setActiveCategory;
window.setOrderType         = setOrderType;
window.printReceipt         = printReceipt;
