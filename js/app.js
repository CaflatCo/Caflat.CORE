/* ═══════════════════════════════════════════════════════
   APP.JS — Bootstrap, render lifecycle, navigation
═══════════════════════════════════════════════════════ */

function initializeApp() {
  try {
    if (typeof restorePersistedState === 'function') restorePersistedState();
    if (typeof initializeLicense === 'function') initializeLicense();
    if (typeof initializeAuth === 'function') initializeAuth();
    if (typeof initializeUIActions === 'function') initializeUIActions();
    if (typeof initializeSales === 'function') initializeSales();
    if (typeof initializeSalesCompatibility === 'function') initializeSalesCompatibility();

    renderEverything();
    bindGlobalEvents();
    bindNavigation();
    bindCheckoutInputs();
    bindModalClose();
    bindSearchFilters();
    setDefaultView();

    console.log('Caflat.Co POS v1 initialized');
  } catch (error) {
    console.error('Initialization failed', error);
    showNotification('App initialization failed', 'error');
  }
}

function renderEverything() {
  const renderCalls = [
    'renderCategoryTabs',
    'renderOrderTypeTabs',
    'renderProductsTable',
    'renderPOSProducts',
    'renderIngredientsTable',
    'renderInventoryTable',
    'renderFinishedGoodsTable',
    'renderInventoryMovementLog',
    'applyRecipeCatalogToggle',
    'applyShoppingListToggle',
    'applyLicenseTier',
    'renderSalesTable',
    'renderCategories',
    'renderCategoryOptions',
    'renderIngredientDropdowns',
    'renderLowStockAlerts',
    'renderBranding',
    'renderAuditLog',
    'renderIntegrityReport',
    'renderSupplyView',
    'renderClientsList',
    'renderPaymentMethodsList',
    'renderCheckoutPaymentOptions',
    'renderStorageUsage',
    'applySupplierModeToggle',
    'applyCoffeeCartModeToggle',
    'applyEventPickerButton',
    'renderCoffeeCartView',
    'applyProductionModeToggle',
    'renderProductionView',
    'applyProductLabModeToggle',
    'applyRecipeCatalogToggle',
    'applyShoppingListToggle',
    'applyLicenseTier',
    'renderLabDraftsList',
    'renderLabPresetsList',
    'applySupplierCartButton',
    'renderCart',
    'refreshDashboard',
    'updateNavBadges',
  ];

  renderCalls.forEach(fn => {
    if (typeof window[fn] === 'function') {
      try { window[fn](); }
      catch (e) { console.error(`Failed: ${fn}`, e); }
    }
  });
}

function bindGlobalEvents() {
  const productSearch = document.getElementById('productSearch');
  if (productSearch) {
    productSearch.addEventListener('input', () => {
      if (typeof renderProductsTable === 'function') renderProductsTable();
    });
  }

  const ingredientSearch = document.getElementById('ingredientSearch');
  if (ingredientSearch) {
    ingredientSearch.addEventListener('input', () => {
      if (typeof renderIngredientsTable === 'function') renderIngredientsTable();
    });
  }

  const inventorySearch = document.getElementById('inventorySearch');
  if (inventorySearch) {
    inventorySearch.addEventListener('input', () => {
      if (typeof renderInventoryTable === 'function') renderInventoryTable();
    });
  }

  const receiptUrlInput = document.getElementById('settingsReceiptUrl');
  if (receiptUrlInput) {
    receiptUrlInput.addEventListener('input', () => {
      if (typeof _updateReceiptUrlPreview === 'function') _updateReceiptUrlPreview();
    });
  }

  // Void PIN live dot feedback
  const voidPinInput = document.getElementById('voidPin');
  if (voidPinInput) {
    voidPinInput.addEventListener('input', () => {
      if (typeof renderPinDots === 'function') renderPinDots(voidPinInput.value);
    });
    voidPinInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (typeof confirmVoid === 'function') confirmVoid(); }
    });
  }

  const categoryFilter = document.getElementById('productCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      if (typeof renderProductsTable === 'function') renderProductsTable();
    });
  }
}

function bindSearchFilters() {
  const filters = [
    ['productSearch', 'input'],
    ['productCategoryFilter', 'change']
  ];
  filters.forEach(([id, evt]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(evt, () => {
      if (typeof renderProductsTable === 'function') renderProductsTable();
    });
  });
}

function bindModalClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target !== overlay) return;
      closeModal(overlay.id);
    });
  });
}

function bindCheckoutInputs() {
  const tenderedEl = document.getElementById('checkoutTendered');
  if (tenderedEl) tenderedEl.addEventListener('input', calculateChange);

  const paymentEl = document.getElementById('checkoutPayment');
  if (paymentEl) paymentEl.addEventListener('change', togglePaymentFields);
}

function bindNavigation() {
  document.querySelectorAll('[data-view], [data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view || btn.dataset.page || '';
      if (target) switchPage(target);
    });
  });
}

function normalizeTarget(target) {
  return String(target || '').trim().replace(/^view-/, '');
}

function switchPage(target) {
  const cleanTarget = normalizeTarget(target);
  if (!cleanTarget) return;

  updateState('ui', current => ({ ...current, currentView: cleanTarget }));

  document.querySelectorAll('.view, .page').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('[data-view], [data-page]').forEach(b => b.classList.remove('active'));

  const targetSection =
    document.getElementById(`view-${cleanTarget}`) ||
    document.getElementById(cleanTarget);
  if (targetSection) targetSection.classList.add('active');

  const activeButton =
    document.querySelector(`[data-view="${cleanTarget}"]`) ||
    document.querySelector(`[data-page="${cleanTarget}"]`);
  if (activeButton) activeButton.classList.add('active');

  // Trigger chart re-render on dashboard/reports switch
  if (cleanTarget === 'dashboard' && typeof refreshDashboard  === 'function') refreshDashboard();
  if (cleanTarget === 'reports'   && typeof renderReports      === 'function') renderReports();
  if (cleanTarget === 'supply'    && typeof renderSupplyView      === 'function') renderSupplyView();
  if (cleanTarget === 'coffeecart' && typeof renderCoffeeCartView === 'function') renderCoffeeCartView();
  if (cleanTarget === 'lab') {
    if (typeof renderLabView === 'function') renderLabView();
    const openLabBtn = document.getElementById('openLabBtn');
    if (openLabBtn) openLabBtn.textContent = '← Back to Products';
  }
  if (cleanTarget === 'recipes') {
    if (typeof renderRecipeCatalog === 'function') renderRecipeCatalog();
    const openRecipesBtn = document.getElementById('openRecipesBtn');
    if (openRecipesBtn) openRecipesBtn.textContent = '← Back to Products';
    // Show list view by default
    const listView = document.getElementById('recipeCatalogListView');
    const detailView = document.getElementById('recipeDetailView');
    const formView = document.getElementById('recipeFormView');
    if (listView)  listView.style.display  = 'block';
    if (detailView) detailView.style.display = 'none';
    if (formView)  formView.style.display  = 'none';
  }
  if (cleanTarget === 'products') {
    const openLabBtn = document.getElementById('openLabBtn');
    if (openLabBtn) openLabBtn.textContent = 'Open Lab ↗';
    const openRecipesBtn = document.getElementById('openRecipesBtn');
    if (openRecipesBtn) openRecipesBtn.textContent = 'Recipes ↗';
  }
  if (cleanTarget === 'production' && typeof renderProductionView === 'function') renderProductionView();
  if (cleanTarget === 'settings'   && typeof renderCloudBackupList === 'function') renderCloudBackupList();
  if (cleanTarget === 'inventory') {
    if (typeof renderInventoryTable      === 'function') renderInventoryTable();
    if (typeof renderFinishedGoodsTable  === 'function') renderFinishedGoodsTable();
    if (typeof renderInventoryMovementLog=== 'function') renderInventoryMovementLog();
    if (typeof renderLowStockAlerts      === 'function') renderLowStockAlerts();
  }
}

function setDefaultView() {
  const currentView = APP_STATE.ui?.currentView || 'pos';
  switchPage(currentView);
}

document.addEventListener('DOMContentLoaded', initializeApp);

window.initializeApp   = initializeApp;
window.renderEverything= renderEverything;
window.bindGlobalEvents= bindGlobalEvents;
window.bindSearchFilters=bindSearchFilters;
window.bindModalClose  = bindModalClose;
window.bindCheckoutInputs=bindCheckoutInputs;
window.bindNavigation  = bindNavigation;
window.switchPage      = switchPage;
window.switchView      = switchPage;

/* ═══════════════════════════════════════════════════════
   OFFLINE INDICATOR
═══════════════════════════════════════════════════════ */
function _updateOfflineIndicator() {
  const indicator = document.getElementById('offlineIndicator');
  if (!indicator) return;
  indicator.style.display = navigator.onLine ? 'none' : 'flex';
}

window.addEventListener('online',  _updateOfflineIndicator);
window.addEventListener('offline', _updateOfflineIndicator);

// Also check on init
document.addEventListener('DOMContentLoaded', () => {
  _updateOfflineIndicator();
});

/* ── Sidebar ops group visibility ── */
function updateOpsNavGroup() {
  const group = document.getElementById('navOpsGroup');
  if (!group) return;
  const ids = ['navSupply', 'navProduction', 'navCoffeeCart'];
  const anyVisible = ids.some(id => {
    const el = document.getElementById(id);
    return el && el.style.display !== 'none';
  });
  group.style.display = anyVisible ? '' : 'none';
}
window.updateOpsNavGroup = updateOpsNavGroup;

/* ═══════════════════════════════════════════════════════
   SIDEBAR COLLAPSE
═══════════════════════════════════════════════════════ */
const SIDEBAR_KEY = 'caflat_sidebar_collapsed';

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  try { localStorage.setItem(SIDEBAR_KEY, isCollapsed ? '1' : '0'); } catch(e) {}
}

function initSidebarState() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  // On mobile/portrait default to collapsed
  const isMobile = window.innerWidth <= 768;
  const stored   = localStorage.getItem(SIDEBAR_KEY);
  const shouldCollapse = stored !== null ? stored === '1' : isMobile;
  if (shouldCollapse) sidebar.classList.add('collapsed');
}

window.toggleSidebar    = toggleSidebar;
window.initSidebarState = initSidebarState;

// Init on load
document.addEventListener('DOMContentLoaded', initSidebarState);
