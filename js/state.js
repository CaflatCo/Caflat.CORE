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
    voidPin: '000000',          // Admin void PIN — changeable in Settings
    supplierModeEnabled: false, // Supplier Mode feature toggle
    coffeeCartModeEnabled: false, // Coffee Cart Mode feature toggle
    productionModeEnabled: false  // Production Mode feature toggle
  },

  receiptCounter: 0,            // Sequential permanent counter, never resets

  products: [],
  ingredients: [],
  sales: [],
  cart: [],
  heldOrders: [],
  inventoryMovements: [],
  auditLog: [],                 // Immutable audit trail
  supplyOrders: [],             // Supplier order records
  supplierClients: [],          // B2B client list
  supplyInvoiceCounter: 0,      // Sequential invoice counter
  stockReservations: [],        // Soft stock holds for ORDERED supply orders
  events: [],                   // Coffee Cart events
  activeEvent: null,            // Currently active event session
  eventPackages: [],            // Event Package Builder
  leads: [],                    // Lead Tracker / CRM
  labDrafts: [],                // Product Lab draft analyses
  labCategoryPresets: [],
  finishedGoods: [],            // { productId, productName, stock, reserved }
  fgMovements: [],              // Finished goods movement log       // Product Lab category presets
  productionJobs: [],           // Production Mode jobs
  laborPeople: [],              // Labor roster (survives reset)
  categories: [
    { id: 'cat-cookies',  name: 'Cookies',       inventoryMode: 'finished_goods' },
    { id: 'cat-chewy',   name: 'Chewy Cookies',  inventoryMode: 'finished_goods' },
    { id: 'cat-drinks',  name: 'Drinks',          inventoryMode: 'direct' }
  ],

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
  APP_STATE.categories = [
    { id: 'cat-cookies',  name: 'Cookies',       inventoryMode: 'finished_goods' },
    { id: 'cat-chewy',   name: 'Chewy Cookies',  inventoryMode: 'finished_goods' },
    { id: 'cat-drinks',  name: 'Drinks',          inventoryMode: 'direct' }
  ];
  APP_STATE.supplyOrders = [];
  APP_STATE.supplierClients = [];
  APP_STATE.supplyInvoiceCounter = 0;
  APP_STATE.stockReservations = [];
  APP_STATE.events = [];
  APP_STATE.activeEvent = null;
  APP_STATE.eventPackages = [];
  APP_STATE.leads = [];
  APP_STATE.labDrafts     = [];
  APP_STATE.productionJobs = [];
  APP_STATE.finishedGoods = [];
  APP_STATE.fgMovements   = [];
  // Note: labCategoryPresets + laborPeople intentionally NOT reset — user config
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

/* ── Supply invoice number generator ── */
function generateInvoiceNumber() {
  APP_STATE.supplyInvoiceCounter = Number(APP_STATE.supplyInvoiceCounter || 0) + 1;
  const year = String(new Date().getFullYear()).slice(-2);
  const seq  = String(APP_STATE.supplyInvoiceCounter).padStart(5, '0');
  persistState();
  return `INV-${year}-${seq}`;  // e.g. INV-25-00001
}

window.APP_STATE             = APP_STATE;
window.updateState           = updateState;
window.resetState            = resetState;
window.generateReceiptNumber = generateReceiptNumber;
window.generateInvoiceNumber = generateInvoiceNumber;
