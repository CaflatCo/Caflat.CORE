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
  if (typeof bindProductionFilters   === 'function') bindProductionFilters();
  if (typeof bindRecipeCatalogFilters=== 'function') bindRecipeCatalogFilters();
  if (typeof applyEventPickerButton  === 'function') applyEventPickerButton();
  _bindLabInputs();
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
    ['saveFeaturesBtn',   () => saveFeatureSettings()],
    ['factoryResetBtn',   () => factoryReset()],
    ['resetDataBtn',      () => archiveAndReset()],
    ['logoutBtn',         () => logout()],
    ['loadDemoBtn',       () => loadDemoData()],
    ['loadDemoBtnProducts', () => loadDemoData()],
    ['exportSalesBtn',    () => exportSalesReport()],
    ['checkoutBtn',       () => openCheckoutModal()],
    ['clearCartBtn',      () => clearCart()],
    ['heldOrdersBtn',     () => openHeldOrdersModal()],
    ['holdOrderBtn',      () => holdOrder()],
    ['exportDataBtn',     () => exportAllData()],
    ['addSupplyOrderBtn',    () => openSupplyOrderModal()],
    ['supplierOrderBtn',     () => openSupplierOrderPrompt()],
    ['exportSupplyBtn',   () => exportSupplyCSV()],
    ['addClientBtn',      () => openClientModal()],
    ['saveSupplyOrderBtn',  () => saveSupplyOrder()],
    ['saveEventBtn',        () => saveEvent()],
    ['addEventBtn',         () => openEventModal()],
    ['labNewSessionBtn',       () => startNewLabSession()],
    ['addProdJobBtn',          () => openProductionJobModal()],
    ['endOfDayBtn',            () => openEndOfDaySummary()],
    ['shoppingListBtn',        () => openShoppingListModal()],
    ['openRecipesBtn',         () => { if(typeof switchPage==='function') switchPage('recipes'); }],
    ['rcNewRecipeBtn',         () => openRecipeForm()],
    ['rcSaveFormBtn',          () => saveRecipeForm()],
    ['rcCancelFormBtn',        () => closeRecipeForm()],
    ['rcCloseDetailBtn',       () => closeRecipeDetail()],
    ['slSaveBtn',              () => saveShoppingList()],
    ['slShareBtn',             () => shareShoppingList()],
    ['eodShareBtn',            () => shareEndOfDay()],
    ['saveProdJobBtn',         () => saveProductionJob()],
    ['saveBatchTrackingBtn',   () => saveBatchTracking()],
    ['addLaborPersonBtn',      () => openLaborPersonModal()],
    ['saveLaborPersonBtn',     () => saveLaborPersonFromForm()],
    ['labSaveDraftBtn',     () => saveLabDraft()],
    ['labConvertBtn',       () => openLabConvertModal()],
    ['labConfirmConvertBtn',() => confirmLabConvert()],
    ['labSavePresetBtn',    () => saveLabPresetFromForm()],
    ['labAddTempIngBtn',    () => addLabTempIngredient()],
    ['eventPickerBtn',      () => openEventPickerModal()],
    ['savePackageBtn',      () => savePackage()],
    ['addPackageBtn',       () => openPackageModal()],
    ['addPackageItemBtn',   () => addPackageItemRow()],
    ['saveLeadBtn',         () => saveLead()],
    ['addLeadBtn',          () => openLeadModal()],
    ['saveClientBtn',     () => saveSupplierClient()],
    ['exportDataBtn',     () => exportAllData()],
    ['exportDataBtnProducts', () => exportAllData()],
    ['addPaymentMethodBtn', () => openPaymentMethodModal(null)],
    ['archiveLocalBtn',   () => { closeModal('archiveResetChoiceModal'); archiveAndResetLocal(); }],
    ['archiveEmailBtn',   () => { closeModal('archiveResetChoiceModal'); archiveAndResetEmail(); }],
    ['archiveResetBtn',   () => openModal('archiveResetChoiceModal')],
    ['openReceiptUrlBtn', () => openReceiptUrlPopup()],
    ['saveReceiptUrlBtn', () => saveReceiptUrlFromPopup()],
    ['openVoidPinBtn',    () => openVoidPinPopup()],
    ['saveVoidPinBtn',    () => saveVoidPinFromPopup()],
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

function bindRecipeCatalogFilters() {
  const rs = document.getElementById('recipeSearch');
  const rc = document.getElementById('recipeCatFilter');
  if (rs) rs.addEventListener('input',  () => { if (typeof renderRecipeCatalog==='function') renderRecipeCatalog(); });
  if (rc) rc.addEventListener('change', () => { if (typeof renderRecipeCatalog==='function') renderRecipeCatalog(); });
}

function bindProductionFilters() {
  const sf = document.getElementById('prodStatusFilter');
  if (sf) sf.addEventListener('change', () => {
    if (typeof renderProductionBoard === 'function') renderProductionBoard();
  });
  const ls = document.getElementById('prodJobLaborSelect');
  if (ls) ls.addEventListener('change', e => {
    if (e.target.value && typeof addLaborToJob === 'function') {
      addLaborToJob(e.target.value);
    }
  });
}

function _bindLabInputs() {
  // Use event delegation on the lab view container for ALL lab inputs
  // This survives innerHTML replacements and works regardless of render order
  const labView = document.getElementById('view-lab');
  if (!labView || labView._labBound) return; // bind once only
  labView._labBound = true;

  // ── Delegated: change events ──
  labView.addEventListener('change', e => {
    if (!window.LAB_SESSION) return;
    const t = e.target;

    // Category select
    if (t.id === 'labCategorySelect') {
      window.LAB_SESSION.category = t.value;
      if (t.value && typeof applyLabPreset === 'function') applyLabPreset(t.value);
      return;
    }

    // Ingredient from catalog
    if (t.id === 'labIngFromCatalog') {
      if (!t.value) return;
      if (typeof addLabIngredientFromCatalog === 'function') {
        addLabIngredientFromCatalog(t.value);
      }
      t.value = '';
      return;
    }

    // Packaging toggle
    if (t.id === 'labPackagingToggle') {
      window.LAB_SESSION.packagingEnabled = t.checked;
      const sec = document.getElementById('labPackagingSection');
      if (sec) sec.style.display = t.checked ? 'block' : 'none';
      if (typeof renderLabPricing          === 'function') renderLabPricing();
      if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
      if (typeof renderLabCharts           === 'function') renderLabCharts();
      return;
    }

    // Strategic toggle
    if (t.id === 'labStrategicToggle') {
      window.LAB_SESSION.strategicEnabled = t.checked;
      const sec = document.getElementById('labStrategicSection');
      if (sec) sec.style.display = t.checked ? 'block' : 'none';
      return;
    }

    // Launch toggle
    if (t.id === 'labLaunchToggle') {
      window.LAB_SESSION.launchEnabled = t.checked;
      const sec = document.getElementById('labLaunchSection');
      if (sec) sec.style.display = t.checked ? 'block' : 'none';
      return;
    }

    // Ingredient scarcity dropdowns
    if (t.classList.contains('lab-ing-scarcity')) {
      const idx = Number(t.dataset.idx);
      if (window.LAB_SESSION.ingredients[idx]) {
        window.LAB_SESSION.ingredients[idx].scarcity = t.value;
        if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
        if (typeof renderLabCharts           === 'function') renderLabCharts();
      }
      return;
    }

    // Batch size — 'change' fires on iOS Safari when user taps away from number input
    if (t.id === 'labBatchSize') {
      const val = Number(t.value || 0);
      if (val > 0) {
        window.LAB_SESSION.batchSize = val;
        if (typeof _renderLabIngredientRows  === 'function') _renderLabIngredientRows();
        if (typeof renderLabPricing          === 'function') renderLabPricing();
        if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
        if (typeof renderLabCharts           === 'function') renderLabCharts();
      }
      return;
    }
  });

  // ── Delegated: input events ──
  labView.addEventListener('input', e => {
    if (!window.LAB_SESSION) return;
    const t = e.target;

    // Batch size — set editing flag so _syncBatchSizeInput won't overwrite
    if (t.id === 'labBatchSize') {
      t.dataset.userEditing = '1';
      const val = Number(t.value || 0);
      if (val > 0) {
        window.LAB_SESSION.batchSize = val;
        // Re-render ingredient rows so per-cookie costs update immediately
        if (typeof _renderLabIngredientRows  === 'function') _renderLabIngredientRows();
        if (typeof renderLabPricing          === 'function') renderLabPricing();
        if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
        if (typeof renderLabCharts           === 'function') renderLabCharts();
      }
      return;
    }

    // Waste slider
    if (t.id === 'labWasteSlider') {
      window.LAB_SESSION.wastePercent = Number(t.value || 0);
      const disp = document.getElementById('labWasteDisplay');
      if (disp) disp.textContent = t.value + '%';
      if (typeof renderLabPricing === 'function') renderLabPricing();
      if (typeof renderLabCharts  === 'function') renderLabCharts();
      return;
    }

    // Ingredient qty
    if (t.classList.contains('lab-ing-qty')) {
      const idx = Number(t.dataset.idx);
      if (window.LAB_SESSION.ingredients[idx]) {
        window.LAB_SESSION.ingredients[idx].qty = Number(t.value || 0);
        if (typeof _refreshLabCalcs === 'function') _refreshLabCalcs();
      }
      return;
    }

    // Ingredient cost
    if (t.classList.contains('lab-ing-cost')) {
      const idx = Number(t.dataset.idx);
      if (window.LAB_SESSION.ingredients[idx]) {
        window.LAB_SESSION.ingredients[idx].costPerUnit = Number(t.value || 0);
        if (typeof _refreshLabCalcs === 'function') _refreshLabCalcs();
      }
      return;
    }

    // Packaging name
    if (t.classList.contains('lab-pkg-name')) {
      const idx = Number(t.dataset.idx);
      if (window.LAB_SESSION.packaging[idx]) {
        window.LAB_SESSION.packaging[idx].name = t.value;
      }
      return;
    }

    // Packaging cost
    if (t.classList.contains('lab-pkg-cost')) {
      const idx = Number(t.dataset.idx);
      if (window.LAB_SESSION.packaging[idx]) {
        window.LAB_SESSION.packaging[idx].cost = Number(t.value || 0);
        if (typeof _refreshLabCalcs === 'function') _refreshLabCalcs();
      }
      return;
    }

    // Margin input
    if (t.classList.contains('lab-margin-input')) {
      const i = Number(t.dataset.scenario);
      window.LAB_SESSION.marginTargets[i] = Number(t.value || 0);
      if (typeof _refreshLabCalcs === 'function') _refreshLabCalcs();
      return;
    }

    // Price input (reverse: price → margin)
    if (t.classList.contains('lab-price-input')) {
      const i     = Number(t.dataset.scenario);
      const price = Number(t.value || 0);
      if (price > 0 && typeof labCalcCostPerUnit === 'function') {
        const cost   = labCalcCostPerUnit();
        const margin = cost > 0 ? ((price - cost) / price) * 100 : 0;
        window.LAB_SESSION.marginTargets[i] = Math.max(0, parseFloat(margin.toFixed(2)));
      }
      if (typeof _refreshLabCalcs === 'function') _refreshLabCalcs();
      return;
    }
  });

  // ── Delegated: click events ──
  labView.addEventListener('click', e => {
    if (!window.LAB_SESSION) return;
    const t = e.target.closest('button, [data-action]');
    if (!t) return;

    // Batch presets
    if (t.classList.contains('lab-batch-preset')) {
      window.LAB_SESSION.batchSize = Number(t.dataset.size);
      const inp = document.getElementById('labBatchSize');
      if (inp) { inp.value = window.LAB_SESSION.batchSize; inp.dataset.userEditing = '0'; }
      // Re-render rows so per-cookie costs update
      if (typeof _renderLabIngredientRows  === 'function') _renderLabIngredientRows();
      if (typeof renderLabPricing          === 'function') renderLabPricing();
      if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
      if (typeof renderLabCharts           === 'function') renderLabCharts();
      return;
    }

    // Remove ingredient
    if (t.classList.contains('lab-remove-ing')) {
      const idx = Number(t.dataset.idx);
      window.LAB_SESSION.ingredients.splice(idx, 1);
      if (typeof _renderLabIngredientRows === 'function') _renderLabIngredientRows();
      if (typeof _refreshLabCalcs         === 'function') _refreshLabCalcs();
      return;
    }

    // Remove packaging
    if (t.classList.contains('lab-remove-pkg')) {
      const idx = Number(t.dataset.idx);
      window.LAB_SESSION.packaging.splice(idx, 1);
      if (typeof _renderLabPackagingRows === 'function') _renderLabPackagingRows();
      if (typeof _refreshLabCalcs        === 'function') _refreshLabCalcs();
      return;
    }

    // Select scenario
    if (t.classList.contains('lab-select-scenario')) {
      window.LAB_SESSION.selectedScenario = Number(t.dataset.scenario);
      if (typeof renderLabPricing === 'function') renderLabPricing();
      if (typeof renderLabCharts  === 'function') renderLabCharts();
      return;
    }
  });

  // Clear editing flag on batch size blur — commit final value
  labView.addEventListener('blur', e => {
    if (e.target.id === 'labBatchSize') {
      e.target.dataset.userEditing = '0';
      const val = Number(e.target.value || 0);
      if (val > 0 && window.LAB_SESSION) {
        window.LAB_SESSION.batchSize = val;
        if (typeof _renderLabIngredientRows  === 'function') _renderLabIngredientRows();
        if (typeof renderLabPricing          === 'function') renderLabPricing();
        if (typeof renderLabSupplyAssessment === 'function') renderLabSupplyAssessment();
        if (typeof renderLabCharts           === 'function') renderLabCharts();
      }
    }
  }, true);

  // Waste slider also needs 'change' for iOS Safari (fires on release)
  labView.addEventListener('change', e => {
    if (e.target.id === 'labWasteSlider' && window.LAB_SESSION) {
      window.LAB_SESSION.wastePercent = Number(e.target.value || 0);
      const disp = document.getElementById('labWasteDisplay');
      if (disp) disp.textContent = e.target.value + '%';
      if (typeof renderLabPricing === 'function') renderLabPricing();
      if (typeof renderLabCharts  === 'function') renderLabCharts();
    }
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
  // Handle checkbox + input change events
  document.addEventListener('change', event => {
    const t = event.target;
    // Category mode toggle
    if (t.dataset && t.dataset.action === 'toggle-category-mode' && t.dataset.id) {
      if (typeof toggleCategoryMode === 'function') toggleCategoryMode(t.dataset.id);
    }
    // Category rename
    if (t.dataset && t.dataset.catRenameId) {
      if (typeof renameCategory === 'function') renameCategory(t.dataset.catRenameId, t.value);
    }
  });

  // Category rename on blur too
  document.addEventListener('blur', event => {
    const t = event.target;
    if (t.dataset && t.dataset.catRenameId) {
      if (typeof renameCategory === 'function') renameCategory(t.dataset.catRenameId, t.value);
    }
  }, true);

  // Category rename on Enter key
  document.addEventListener('keydown', event => {
    const t = event.target;
    if (event.key === 'Enter' && t.dataset && t.dataset.catRenameId) {
      t.blur();
    }
  });

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
      case 'confirm-standard-reset':
        if (typeof resetBusinessData === 'function') {
          closeModal('resetDataModal');
          resetBusinessData();
        }
        break;
      case 'confirm-factory-reset':
        if (typeof fullFactoryReset === 'function') {
          closeModal('resetDataModal');
          fullFactoryReset();
        }
        break;
      // Coffee Cart Mode actions
      case 'add-event':               openEventModal(); break;
      case 'edit-event':              openEventModal(actionEl.dataset.id || ''); break;
      case 'delete-event':            deleteEvent(actionEl.dataset.id || ''); break;
      case 'save-event':              saveEvent(); break;
      case 'activate-event':          activateEvent(actionEl.dataset.id || ''); break;
      case 'end-event-session':       endEventSession(); break;
      case 'open-event-picker':       openEventPickerModal(); break;
      // Production Mode
      case 'add-prod-job':              openProductionJobModal(); break;
      case 'edit-prod-job':             openProductionJobModal(actionEl.dataset.id||''); break;
      case 'delete-prod-job':           deleteProductionJob(actionEl.dataset.id||''); break;
      case 'save-prod-job':             saveProductionJob(); break;
      case 'open-prod-line-status':     openProductLineStatusModal(actionEl.dataset.jobId||'', actionEl.dataset.lineId||''); break;
      case 'set-product-line-status':   setProductLineStatus(actionEl.dataset.jobId||'', actionEl.dataset.lineId||'', actionEl.dataset.status||''); break;
      case 'open-batch-tracking':       openBatchTrackingModal(actionEl.dataset.jobId||'', actionEl.dataset.lineId||''); break;
      case 'save-batch-tracking':       saveBatchTracking(); break;
      // Labor Roster
      case 'add-labor-person':          openLaborPersonModal(); break;
      case 'edit-labor-person':         openLaborPersonModal(actionEl.dataset.id||''); break;
      case 'delete-labor-person':       deleteLaborPerson(actionEl.dataset.id||''); break;
      case 'save-labor-person':         saveLaborPersonFromForm(); break;
      // Product Lab
      case 'start-lab-session':        startNewLabSession(); break;
      case 'load-lab-draft':           loadLabDraft(actionEl.dataset.id||''); break;
      case 'delete-lab-draft':         deleteLabDraft(actionEl.dataset.id||''); break;
      case 'save-lab-draft':           saveLabDraft(); break;
      case 'open-lab-convert':         openLabConvertModal(); break;
      case 'confirm-lab-convert':      confirmLabConvert(); break;
      case 'edit-lab-preset':          openLabPresetModal(actionEl.dataset.id||''); break;
      case 'delete-lab-preset':        deleteLabCategoryPreset(actionEl.dataset.id||''); break;
      case 'save-lab-preset':          saveLabPresetFromForm(); break;
      case 'add-lab-preset':           openLabPresetModal(); break;
      case 'open-lab-temp-ing':        openModal('labTempIngModal'); break;
      case 'open-lab-ing-picker':       if(typeof openLabIngPickerModal==='function') openLabIngPickerModal(); break;
      case 'add-lab-temp-ing':         addLabTempIngredient(); break;
      case 'add-lab-packaging':        addLabPackagingItem(); break;
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
      case 'view-supply-order':      openSupplyOrderView(actionEl.dataset.id || ''); break;
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
      case 'delete-category':       deleteCategory(actionEl.dataset.id || actionEl.dataset.category || ''); break;
      case 'toggle-category-mode':   toggleCategoryMode(actionEl.dataset.id || ''); break;
      case 'open-recipe-detail':     openRecipeDetail(actionEl.dataset.id || ''); break;
      case 'edit-recipe':            openRecipeForm(actionEl.dataset.id || ''); break;
      case 'delete-recipe':          deleteRecipe(actionEl.dataset.id || ''); break;
      case 'open-change-pin':        if(typeof openChangePinModal==='function') openChangePinModal(); break;
      case 'save-new-pin':           if(typeof saveNewPin==='function') saveNewPin(); break;
      // Finished Goods
      case 'open-fg-adjustment':     if(typeof openFGAdjustmentModal==='function') openFGAdjustmentModal(actionEl.dataset.id||''); break;
      case 'save-fg-adjustment':     if(typeof saveFGAdjustment==='function') saveFGAdjustment(); break;
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
      : ['Dine In', 'Take Out', 'Delivery'];

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
    const catName = typeof cat === 'object' ? cat.name : cat;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = catName;
    btn.dataset.action = 'filter-category';
    btn.dataset.category = catName;
    if (String(active) === String(catName)) btn.classList.add('active');
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
/* ─────────────────────────────────────────────
   PRINT RECEIPT
   • Desktop/laptop: opens a clean print window (works with any wired printer)
   • Mobile/tablet:  uses window.print() on a hidden iframe (avoids popup blockers)
   • Bluetooth thermal: Web Bluetooth API → ESC/POS commands to paired printer
   ───────────────────────────────────────────── */
function printReceipt() {
  const receiptBody = document.getElementById('receiptBody');
  if (!receiptBody) { showNotification('Receipt not found', 'error'); return; }

  // Show print options modal
  _openPrintOptionsModal(receiptBody);
}

function _buildPrintHTML(receiptBody) {
  const brand = APP_STATE.settings?.brandName || 'Caflat.Co POS';
  // Clone so we can clean up SVG QR for print (SVG prints fine natively)
  const clone = receiptBody.cloneNode(true);
  return `<!DOCTYPE html><html><head>
    <title>Receipt — ${brand}</title>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; font-size: 12px; color: #000;
             background: #fff; padding: 12px; }
      .receipt { max-width: 300px; margin: 0 auto; }
      .receipt-header { text-align: center; border-bottom: 1px dashed #000;
                        padding-bottom: 8px; margin-bottom: 8px; }
      .receipt-brand  { font-weight: bold; letter-spacing: 2px;
                        font-size: 14px; margin-bottom: 4px; text-transform: uppercase; }
      .receipt-line   { display: flex; justify-content: space-between;
                        gap: 8px; padding: 2px 0; }
      .receipt-items  { margin: 6px 0; }
      .receipt-item   { display: flex; justify-content: space-between;
                        gap: 8px; padding: 1px 0; font-size: 11px; }
      .receipt-divider{ border-top: 1px dashed #000; margin: 6px 0; }
      .receipt-total  { font-weight: bold; font-size: 13px; }
      #receiptQRContainer { text-align: center; padding: 6px 0; }
      #receiptQRDiv   { display: inline-block; }
      svg             { display: block; margin: 0 auto; }
      @media print    { @page { margin: 4mm; } body { padding: 0; } }
    </style>
  </head><body>
    <div class="receipt">${clone.innerHTML}</div>
    <script>window.onload = function() { window.print(); window.onafterprint = function(){ window.close(); }; }<\/script>
  </body></html>`;
}

/* ── Standard print (desktop + wired printer) ── */
function _printStandard(receiptBody) {
  const html = _buildPrintHTML(receiptBody);
  // Use hidden iframe to avoid popup blockers (especially on iPad/mobile)
  let iframe = document.getElementById('_caflat_print_frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = '_caflat_print_frame';
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch(e) {
      // Fallback for browsers that block iframe.print()
      const pw = window.open('', '_blank', 'width=400,height=600');
      if (pw) {
        pw.document.write(html);
        pw.document.close();
      } else {
        showNotification('Please allow popups for printing', 'error');
      }
    }
  }, 400);
}

/* ── Bluetooth thermal printer (ESC/POS) ── */
async function _printBluetooth(receiptBody) {
  if (!navigator.bluetooth) {
    showNotification('Web Bluetooth not supported on this browser. Use Chrome or Edge.', 'error');
    return;
  }
  try {
    showNotification('Searching for Bluetooth printer…', 'info');

    // Request any Bluetooth device that exposes a serial-like GATT service
    // Most ESC/POS thermal printers use one of these service UUIDs
    const PRINT_SERVICES = [
      '000018f0-0000-1000-8000-00805f9b34fb', // Common BT thermal (e.g. GOOJPRT, MUNBYN)
      '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Bluetooth serial port emulation
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Another common thermal UUID
    ];

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PRINT_SERVICES[0]] }],
      optionalServices: PRINT_SERVICES
    });

    showNotification(`Connecting to ${device.name || 'printer'}…`, 'info');
    const server  = await device.gatt.connect();

    // Try each known service UUID until one works
    let characteristic = null;
    for (const svcUUID of PRINT_SERVICES) {
      try {
        const service = await server.getPrimaryService(svcUUID);
        const chars   = await service.getCharacteristics();
        // Find a writable characteristic
        characteristic = chars.find(c =>
          c.properties.write || c.properties.writeWithoutResponse
        );
        if (characteristic) break;
      } catch(e) { /* try next */ }
    }

    if (!characteristic) {
      showNotification('Printer found but no writable channel. Check printer compatibility.', 'error');
      return;
    }

    // Build ESC/POS byte commands from receipt data
    const commands = _buildESCPOS(receiptBody);

    // Write in chunks (BLE MTU is typically 512 bytes max)
    const CHUNK = 512;
    for (let i = 0; i < commands.length; i += CHUNK) {
      const chunk = commands.slice(i, i + CHUNK);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      // Small delay between chunks to avoid buffer overflow
      if (i + CHUNK < commands.length) await new Promise(r => setTimeout(r, 50));
    }

    showNotification('Sent to Bluetooth printer ✓', 'success');
    device.gatt.disconnect();

  } catch(err) {
    if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
      showNotification('Printer pairing cancelled', 'info');
    } else {
      console.error('Bluetooth print error:', err);
      showNotification(`Bluetooth error: ${err.message || err}`, 'error');
    }
  }
}

/* ── ESC/POS command builder ── */
function _buildESCPOS(receiptBody) {
  const ESC = 0x1B, GS = 0x1D;
  const bytes = [];
  const push  = (...b) => bytes.push(...b);
  const enc   = new TextEncoder();
  const text  = str => enc.encode(String(str || ''));

  const line  = str => { push(...text(str)); push(0x0A); };            // print + LF
  const dashes= ()  => line('--------------------------------');
  const center= str => {                                                 // 32-char center
    const s = String(str || '').slice(0, 32);
    const pad = Math.max(0, Math.floor((32 - s.length) / 2));
    line(' '.repeat(pad) + s);
  };
  const bold  = on  => push(ESC, 0x45, on ? 1 : 0);                   // ESC E
  const big   = on  => push(GS,  0x21, on ? 0x11 : 0x00);             // GS ! (2x)
  const cut   = ()  => push(GS,  0x56, 0x42, 0x00);                   // GS V — full cut

  // Init
  push(ESC, 0x40);  // ESC @ — initialize printer

  const brand    = APP_STATE.settings?.brandName || 'Caflat.Co';
  const footer   = APP_STATE.settings?.receiptFooter || '';

  // Extract receipt data from DOM
  const receiptLines = receiptBody.querySelectorAll('.receipt-line, .receipt-item');
  const brandEl      = receiptBody.querySelector('.receipt-brand');
  const totalEl      = Array.from(receiptLines).find(el =>
    el.classList.contains('receipt-total'));
  const items        = receiptBody.querySelector('.receipt-items');

  // Header
  bold(true); big(true);
  center(brandEl ? brandEl.textContent.trim() : brand);
  big(false); bold(false);
  dashes();

  // Receipt lines (date, receipt#, customer, payment, order type, reference)
  receiptLines.forEach(el => {
    if (el.classList.contains('receipt-total')) return; // printed separately
    if (el.classList.contains('receipt-item'))  return; // in items section
    const spans = el.querySelectorAll('span');
    if (spans.length >= 2) {
      const label = spans[0].textContent.trim().padEnd(16);
      const value = spans[1].textContent.trim();
      line(`${label}${value}`.slice(0, 48));
    }
  });

  dashes();

  // Items
  if (items) {
    items.querySelectorAll('.receipt-item').forEach(el => {
      const spans = el.querySelectorAll('span');
      if (spans.length >= 2) {
        const name  = spans[0].textContent.trim().slice(0, 24).padEnd(24);
        const price = spans[1].textContent.trim();
        line(`${name}${price}`);
      }
    });
  }

  dashes();

  // Totals
  receiptLines.forEach(el => {
    const spans = el.querySelectorAll('span');
    if (spans.length < 2) return;
    const label = spans[0].textContent.trim();
    const value = spans[1].textContent.trim();
    if (el.classList.contains('receipt-total')) {
      bold(true); big(true);
      line(`${'TOTAL'.padEnd(16)}${value}`);
      big(false); bold(false);
    } else if (['Subtotal','Discount','Tax','Tendered','Change'].includes(label)) {
      line(`${label.padEnd(16)}${value}`);
    }
  });

  dashes();

  // Footer
  if (footer) {
    center(footer);
    push(0x0A);
  }

  // Feed and cut
  push(0x0A, 0x0A, 0x0A, 0x0A); // feed 4 lines
  cut();

  return new Uint8Array(bytes);
}

/* ── Print options modal ── */
function _openPrintOptionsModal(receiptBody) {
  // Remove existing if present
  const existing = document.getElementById('_printOptionsModal');
  if (existing) existing.remove();

  const hasBluetooth = !!navigator.bluetooth;

  const overlay = document.createElement('div');
  overlay.id = '_printOptionsModal';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;z-index:9999;
    backdrop-filter:blur(2px);`;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px 24px;
      max-width:340px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);">
      <div style="font-weight:800;font-size:16px;margin-bottom:6px;">Print Receipt</div>
      <div style="font-size:13px;color:#888;margin-bottom:20px;">
        Choose how to print this receipt.
      </div>

      <button id="_printStandardBtn"
        style="width:100%;padding:14px 16px;border:1.5px solid #e8e8e8;border-radius:12px;
          background:#fff;text-align:left;cursor:pointer;margin-bottom:10px;
          font-family:inherit;display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">🖨️</span>
        <div>
          <div style="font-weight:700;font-size:14px;">Standard Print</div>
          <div style="font-size:11px;color:#888;">USB / wired / WiFi printer — opens print dialog</div>
        </div>
      </button>

      <button id="_printBluetoothBtn"
        style="width:100%;padding:14px 16px;border:1.5px solid #e8e8e8;border-radius:12px;
          background:#fff;text-align:left;cursor:pointer;margin-bottom:20px;
          font-family:inherit;display:flex;align-items:center;gap:12px;
          ${!hasBluetooth ? 'opacity:0.4;cursor:not-allowed;' : ''}">
        <span style="font-size:22px;">📡</span>
        <div>
          <div style="font-weight:700;font-size:14px;">Bluetooth Thermal Printer</div>
          <div style="font-size:11px;color:#888;">
            ${hasBluetooth
              ? 'ESC/POS thermal — pairs and prints wirelessly'
              : 'Not available — use Chrome or Edge on desktop/Android'}
          </div>
        </div>
      </button>

      <button id="_printCancelBtn"
        style="width:100%;padding:11px;border:1.5px solid #e8e8e8;border-radius:10px;
          background:#fff;cursor:pointer;font-family:inherit;font-size:13px;color:#666;">
        Cancel
      </button>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById('_printStandardBtn').onclick = () => {
    close();
    _printStandard(receiptBody);
  };

  document.getElementById('_printBluetoothBtn').onclick = () => {
    if (!hasBluetooth) return;
    close();
    _printBluetooth(receiptBody);
  };

  document.getElementById('_printCancelBtn').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
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
