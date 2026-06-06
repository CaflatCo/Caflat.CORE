function initializeApp() {
  try {
    if (typeof restorePersistedState === 'function') {
      restorePersistedState();
    }

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

    console.log('Caflat.Co POS initialized');
  } catch (error) {
    console.error('Initialization failed', error);
    showNotification('App initialization failed', 'error');
  }
}

function renderEverything() {
  const renderCalls = [
    'renderCategoryTabs',
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

  renderCalls.forEach(fnName => {
    if (typeof window[fnName] === 'function') {
      try {
        window[fnName]();
      } catch (error) {
        console.error(`Failed to run ${fnName}`, error);
      }
    }
  });
}

function bindGlobalEvents() {
  const productSearch = document.getElementById('productSearch');
  const categoryFilter = document.getElementById('productCategoryFilter');

  if (productSearch) {
    productSearch.addEventListener('input', () => {
      if (typeof renderProductsTable === 'function') renderProductsTable();
      if (typeof renderPOSProducts === 'function') renderPOSProducts();
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      if (typeof renderProductsTable === 'function') renderProductsTable();
      if (typeof renderPOSProducts === 'function') renderPOSProducts();
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
      if (typeof renderPOSProducts === 'function') renderPOSProducts();
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

function getCheckoutFieldIds() {
  return {
    tendered: ['checkoutTendered', 'amountTendered'],
    change: ['checkoutChange', 'changeAmount'],
    total: ['checkoutTotal'],
    payment: ['checkoutPayment'],
    reference: ['paymentReference'],
    customer: ['checkoutCustomer']
  };
}

function bindCheckoutInputs() {
  const ids = getCheckoutFieldIds();

  [...ids.tendered, ...ids.change, ...ids.total].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (typeof calculateChange === 'function') calculateChange();
      });
    }
  });

  ids.payment.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        if (typeof togglePaymentFields === 'function') togglePaymentFields();
      });
    }
  });
}

function bindNavigation() {
  const navButtons = document.querySelectorAll('[data-view], [data-page]');

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.view || button.dataset.page || '';
      if (!target) return;
      switchPage(target);
    });
  });
}

function normalizeTarget(target) {
  return String(target || '').trim().replace(/^view-/, '');
}

function switchPage(target) {
  const cleanTarget = normalizeTarget(target);
  if (!cleanTarget) return;

  updateState('ui', current => ({
    ...current,
    currentView: cleanTarget
  }));

  const sections = document.querySelectorAll('.view, .page');
  sections.forEach(section => section.classList.remove('active'));

  const navButtons = document.querySelectorAll('[data-view], [data-page]');
  navButtons.forEach(button => button.classList.remove('active'));

  const targetSection =
    document.getElementById(`view-${cleanTarget}`) ||
    document.getElementById(cleanTarget);

  if (targetSection) targetSection.classList.add('active');

  const activeButton =
    document.querySelector(`[data-view="${cleanTarget}"]`) ||
    document.querySelector(`[data-page="${cleanTarget}"]`);

  if (activeButton) activeButton.classList.add('active');
}

function setDefaultView() {
  const currentView = APP_STATE.ui?.currentView || 'pos';
  switchPage(currentView);
}

document.addEventListener('DOMContentLoaded', initializeApp);

window.initializeApp = initializeApp;
window.renderEverything = renderEverything;
window.bindGlobalEvents = bindGlobalEvents;
window.bindSearchFilters = bindSearchFilters;
window.bindModalClose = bindModalClose;
window.bindCheckoutInputs = bindCheckoutInputs;
window.bindNavigation = bindNavigation;
window.switchPage = switchPage;
window.switchView = switchPage;
