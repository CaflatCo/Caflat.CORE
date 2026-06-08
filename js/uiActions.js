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
  bindSupplyFilters();
  if (typeof bindLeadFilters         === 'function') bindLeadFilters();
  if (typeof applyEventPickerButton  === 'function') applyEventPickerButton();
  bindSupplyDiscountInputs();
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
    ['addSupplyOrderBtn',    () => openSupplyOrderModal()],
    ['supplierOrderBtn',     () => openSupplierOrderPrompt()],
    ['exportSupplyBtn',   () => exportSupplyCSV()],
    ['addClientBtn',      () => openClientModal()],
    ['saveSupplyOrderBtn',  () => saveSupplyOrder()],
    ['saveEventBtn',        () => saveEvent()],
    ['addEventBtn',         () => openEventModal()],
    ['eventPickerBtn',      () => openEventPickerModal()],
    ['savePackageBtn',      () => savePackage()],
    ['addPackageBtn',       () => openPackageModal()],
    ['addPackageItemBtn',   () => addPackageItemRow()],
    ['saveLeadBtn',         () => saveLead()],
    ['addLeadBtn',          () => openLeadModal()],
    ['saveClientBtn',     () => saveSupplierClient()],
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

  const pkgBtn = document.getElementById('addPackagingBtn');
  if (pkgBtn) pkgBtn.addEventListener('click', () => addPackagingRow());

  // Live cost preview on price / recipe mode / yield change
  ['productPrice','recipeMode','batchYield'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
    });
    document.getElementById(id)?.addEventListener('change', () => {
      if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
    });
  });

  // Template hints when category changes
  document.getElementById('productCategory')?.addEventListener('change', () => {
    if (typeof renderProductTemplates === 'function') renderProductTemplates();
  });
}

function bindSupplyDiscountInputs() {
  ['supplyDiscountValue','supplyDiscountType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input',  () => { if(typeof updateSupplyOrderTotal==='function') updateSupplyOrderTotal(); });
      el.addEventListener('change', () => { if(typeof updateSupplyOrderTotal==='function') updateSupplyOrderTotal(); });
    }
  });
}

function bindLeadFilters() {
  const f = document.getElementById('leadStatusFilter');
  if (f) f.addEventListener('change', () => {
    if (typeof renderLeadsTable === 'function') renderLeadsTable();
  });
}

function bindSupplyFilters() {
  ['supplyStatusFilter','supplyClientFilter','supplyFromDate','supplyToDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      if (typeof renderSupplyTable === 'function') renderSupplyTable();
    });
  });
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
      case 'clone-product':         cloneProduct(actionEl.dataset.id || ''); break;
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
      case 'open-void-modal':         openVoidModal(actionEl.dataset.id || ''); break;
      // Coffee Cart Mode actions
      case 'add-event':               openEventModal(); break;
      case 'edit-event':              openEventModal(actionEl.dataset.id || ''); break;
      case 'delete-event':            deleteEvent(actionEl.dataset.id || ''); break;
      case 'save-event':              saveEvent(); break;
      case 'activate-event':          activateEvent(actionEl.dataset.id || ''); break;
      case 'end-event-session':       endEventSession(); break;
      case 'open-event-picker':       openEventPickerModal(); break;
      case 'set-channel':             setActiveChannel(actionEl.dataset.channel || 'Dine In'); break;
      // Phase 2 — Event Profitability
      case 'open-event-profitability': openEventProfitabilityModal(actionEl.dataset.id || ''); break;
      case 'add-event-expense':        addExpenseFromForm(actionEl.dataset.eventId || ''); break;
      case 'delete-event-expense':     deleteEventExpense(actionEl.dataset.eventId || '', actionEl.dataset.expenseId || ''); break;
      // Phase 2 — Package Builder
      case 'add-package':              openPackageModal(); break;
      case 'edit-package':             openPackageModal(actionEl.dataset.id || ''); break;
      case 'delete-package':           deletePackage(actionEl.dataset.id || ''); break;
      case 'save-package':             savePackage(); break;
      case 'add-package-item':         addPackageItemRow(); break;
      // Phase 2 — Lead Tracker
      case 'add-lead':                 openLeadModal(); break;
      case 'edit-lead':                openLeadModal(actionEl.dataset.id || ''); break;
      case 'delete-lead':              deleteLead(actionEl.dataset.id || ''); break;
      case 'save-lead':                saveLead(); break;
      case 'open-refund-modal':     if(typeof openRefundModal==='function') openRefundModal(actionEl.dataset.id||''); break;
      case 'confirm-refund':        if(typeof confirmRefund==='function') confirmRefund(); break;
      case 'clone-product':         if(typeof cloneProduct==='function') cloneProduct(actionEl.dataset.id||''); break;
      case 'run-integrity-check':      if(typeof renderIntegrityReport==='function') renderIntegrityReport(); break;
      case 'refresh-inventory-movements': if(typeof renderInventoryMovementHistory==='function') renderInventoryMovementHistory(); break;
      case 'view-transaction-timeline': if(typeof renderTransactionTimeline==='function') renderTransactionTimeline(actionEl.dataset.id||''); break;
      case 'add-packaging-row':     addPackagingRow(); break;
      case 'open-refund-modal':     openRefundModal(actionEl.dataset.id || ''); break;
      case 'confirm-refund':        confirmRefund(); break;
      case 'clone-product':         cloneProduct(actionEl.dataset.id || ''); break;
      case 'run-integrity-check':   renderIntegrityReport(); break;
      case 'confirm-void':          confirmVoid(); break;

      // Supply actions
      case 'open-supplier-order-prompt': openSupplierOrderPrompt(); break;
      case 'confirm-supplier-order':     confirmSupplierOrder(); break;
      case 'add-supply-order':           openSupplyOrderModal(); break;
      case 'edit-supply-order':      openSupplyOrderModal(actionEl.dataset.id || ''); break;
      case 'delete-supply-order':    deleteSupplyOrder(actionEl.dataset.id || ''); break;
      case 'advance-supply-status':    advanceSupplyStatus(actionEl.dataset.id || ''); break;
      case 'open-status-picker':       openStatusPickerModal(actionEl.dataset.id || ''); break;
      case 'set-supply-status':        setSupplyStatus(actionEl.dataset.orderId || '', actionEl.dataset.status || ''); break;
      case 'cancel-supply-order':    cancelSupplyOrder(actionEl.dataset.id || ''); break;
      case 'save-supply-order':      saveSupplyOrder(); break;
      case 'export-supply-csv':      exportSupplyCSV(); break;
      case 'add-supply-line':        addSupplyLineItemRow(); break;
      case 'add-client':             openClientModal(); break;
      case 'edit-client':            openClientModal(actionEl.dataset.id || ''); break;
      case 'delete-client':          deleteSupplierClient(actionEl.dataset.id || ''); break;
      case 'save-client':            saveSupplierClient(); break;
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

  const coffeeCartOn = APP_STATE.settings?.coffeeCartModeEnabled === true;

  if (coffeeCartOn) {
    // Coffee Cart Mode: show channels instead of order types
    // Hide the old separate channel container
    const chanSel = document.getElementById('channelSelectorContainer');
    if (chanSel) chanSel.style.display = 'none';

    const current = APP_STATE.ui?.activeChannel || APP_STATE.ui?.orderType || 'Dine In';
    const channels = Object.keys(typeof CART_CHANNELS !== 'undefined' ? CART_CHANNELS : {});
    const available = channels.length
      ? channels
      : ['Dine In', 'Take Out', 'Delivery', 'Event', 'Corporate', 'Wholesale', 'Partner Cafe'];

    container.innerHTML = available.map(ch => `
      <button type="button" class="order-type-btn${current === ch ? ' active' : ''}"
        data-action="set-channel" data-channel="${escapeHtml(ch)}">${escapeHtml(ch)}</button>`
    ).join('');
  } else {
    // Normal mode: show order types
    const chanSel = document.getElementById('channelSelectorContainer');
    if (chanSel) chanSel.style.display = 'none';

    const types   = APP_STATE.settings?.orderTypes || ['Dine In', 'Take Out', 'Delivery'];
    const current = APP_STATE.ui?.orderType || 'Dine In';
    container.innerHTML = types.map(t => `
      <button type="button" class="order-type-btn${current === t ? ' active' : ''}"
        data-action="set-order-type" data-type="${escapeHtml(t)}">${escapeHtml(t)}</button>`
    ).join('');
  }
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

function addPackagingRow(pkg = null) {
  const container = document.getElementById('packagingBuilder');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'packaging-row';
  row.dataset.pkgId = pkg?.id || generateId();
  row.innerHTML = `
    <input type="text"   class="packaging-name" placeholder="e.g. Cookie Box, Sticker, Paper Bag"
      value="${escapeHtml(pkg?.name || '')}"
      style="flex:2;padding:7px 10px;border:1px solid var(--gray-200);
        border-radius:var(--radius-md);font-family:var(--font-main);font-size:12px;" />
    <input type="number" class="packaging-cost" placeholder="Cost (₱)"
      value="${pkg?.cost || ''}" min="0" step="0.01"
      style="width:110px;padding:7px 10px;border:1px solid var(--gray-200);
        border-radius:var(--radius-md);font-family:var(--font-main);font-size:12px;" />
    <button type="button" class="btn btn-sm btn-secondary remove-packaging-btn">✕</button>`;
  row.querySelector('.remove-packaging-btn').addEventListener('click', () => {
    row.remove();
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });
  row.querySelector('.packaging-name')?.addEventListener('input', () => {
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });
  row.querySelector('.packaging-cost')?.addEventListener('input', () => {
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });
  container.appendChild(row);
  if (typeof renderProductCostPreview === 'function') {
    requestAnimationFrame(() => renderProductCostPreview());
  }
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
  row.querySelector('.remove-recipe-btn').addEventListener('click', () => {
    row.remove();
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });
  row.querySelector('.recipe-ingredient')?.addEventListener('change', () => {
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });
  row.querySelector('.recipe-qty')?.addEventListener('input', () => {
    if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  });
  // Set ingredientId BEFORE appending so currentValue is captured correctly
  if (recipe?.ingredientId) {
    row.querySelector('.recipe-ingredient').value = recipe.ingredientId;
  }

  container.appendChild(row);

  // Populate all dropdowns (preserving currentValue for each)
  renderIngredientDropdowns();

  // Reapply value after dropdown rebuild (renderIngredientDropdowns rebuilds innerHTML)
  if (recipe?.ingredientId) {
    row.querySelector('.recipe-ingredient').value = recipe.ingredientId;
  }

  // Trigger cost preview after value is confirmed set
  if (typeof renderProductCostPreview === 'function') {
    requestAnimationFrame(() => renderProductCostPreview());
  }
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
window.addPackagingRow      = addPackagingRow;
window.openVariantSelector  = openVariantSelector;
window.renderCategoryTabs   = renderCategoryTabs;
window.renderOrderTypeTabs  = renderOrderTypeTabs;
window.setActiveCategory    = setActiveCategory;
window.setOrderType         = setOrderType;
window.printReceipt         = printReceipt;
window.bindSupplyFilters     = bindSupplyFilters;
