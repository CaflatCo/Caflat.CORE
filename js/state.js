/* ═══════════════════════════════════════════════════════
   STATE.JS — Central application state
═══════════════════════════════════════════════════════ */

const APP_STATE = {
  currentUserRole: 'STAFF',

  settings: {
    brandName: 'Caflat.Co POS',
    taxRate: 0,
    receiptFooter: 'Thank you for choosing Caflat.Co',
    currency: 'PHP',
    orderTypes: ['Dine In', 'Take Out', 'Delivery'],
    lowStockThreshold: 5,
    voidPin: '000000'           // Admin void PIN — changeable in Settings
  },

  receiptCounter: 0,            // Sequential permanent counter, never resets

  products: [],
  ingredients: [],
  sales: [],
  cart: [],
  heldOrders: [],
  inventoryMovements: [],
  auditLog: [],                 // Immutable audit trail
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
  APP_STATE.auditLog = [];
  APP_STATE.receiptCounter = 0;
  APP_STATE.categories = ['Cookies', 'Chewy Cookies', 'Drinks'];
  persistState();
}

/* ── Receipt number generator ── */
function generateReceiptNumber() {
  APP_STATE.receiptCounter = Number(APP_STATE.receiptCounter || 0) + 1;
  const year = String(new Date().getFullYear()).slice(-2);  // "25"
  const seq  = String(APP_STATE.receiptCounter).padStart(6, '0'); // "000001"
  persistState();
  return `CF-${year}-${seq}`;  // e.g. CF-25-000001
}

window.APP_STATE          = APP_STATE;
window.updateState        = updateState;
window.resetState         = resetState;
window.generateReceiptNumber = generateReceiptNumber;
