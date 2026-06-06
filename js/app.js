/* ═══════════════════════════════════════════════════════
   APP.JS — Bootstrap, render lifecycle, navigation
═══════════════════════════════════════════════════════ */

function initializeApp() {
  try {
    if (typeof restorePersistedState === 'function') restorePersistedState();
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
    'renderSalesTable',
    'renderCategories',
    'renderCategoryOptions',
    'renderIngredientDropdowns',
    'renderLowStockAlerts',
    'renderBranding',
    'renderCart',
    'refreshDashboard',
    'renderReports'
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
  if (cleanTarget === 'dashboard' && typeof refreshDashboard === 'function') refreshDashboard();
  if (cleanTarget === 'reports'   && typeof renderReports     === 'function') renderReports();
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
