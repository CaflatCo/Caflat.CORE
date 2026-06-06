const APP_STATE = {
  currentUserRole: 'STAFF',

  settings: {
    brandName: 'Caflat.Co POS',
    taxRate: 0,
    receiptFooter: 'Thank you for choosing Caflat.Co',
    currency: 'PHP',
    orderTypes: ['Dine In', 'Take Out', 'Delivery'],
    lowStockThreshold: 5
  },

  products: [],
  ingredients: [],
  sales: [],
  cart: [],
  heldOrders: [],
  inventoryMovements: [],
  categories: ['Cookies', 'Chewy Cookies', 'Drinks'],

  ui: {
    currentView: 'pos',
    activeCategory: 'All',
    orderType: 'Dine In',
    posSearch: ''
  }
};

function updateState(key, updater) {
  const current = APP_STATE[key];
  APP_STATE[key] = typeof updater === 'function' ? updater(current) : updater;
  persistState();
  return APP_STATE[key];
}

function resetState() {
  APP_STATE.products = [];
  APP_STATE.ingredients = [];
  APP_STATE.sales = [];
  APP_STATE.cart = [];
  APP_STATE.heldOrders = [];
  APP_STATE.inventoryMovements = [];
  APP_STATE.categories = ['Cookies', 'Chewy Cookies', 'Drinks'];
  persistState();
}

window.APP_STATE = APP_STATE;
window.updateState = updateState;
window.resetState = resetState;
