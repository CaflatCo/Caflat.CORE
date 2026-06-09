/* ═══════════════════════════════════════════════════════
   STORAGE.JS — Persistence, import/export
═══════════════════════════════════════════════════════ */

const STORAGE_KEY = 'caflat_pos_v1';

function getPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load persisted state', error);
    return null;
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      settings:           APP_STATE.settings,
      receiptCounter:     APP_STATE.receiptCounter,
      products:           APP_STATE.products,
      ingredients:        APP_STATE.ingredients,
      sales:              APP_STATE.sales,
      categories:         APP_STATE.categories,
      heldOrders:         APP_STATE.heldOrders,
      inventoryMovements: APP_STATE.inventoryMovements,
      auditLog:           APP_STATE.auditLog,
      supplyOrders:        APP_STATE.supplyOrders,
      supplierClients:     APP_STATE.supplierClients,
      supplyInvoiceCounter:APP_STATE.supplyInvoiceCounter,
      stockReservations:   APP_STATE.stockReservations,
      events:              APP_STATE.events,
      activeEvent:         APP_STATE.activeEvent,
      eventPackages:       APP_STATE.eventPackages,
      leads:               APP_STATE.leads,
      labDrafts:           APP_STATE.labDrafts,
      labCategoryPresets:  APP_STATE.labCategoryPresets
    }));
  } catch (error) {
    console.error('Failed to persist state', error);
  }
}

function restorePersistedState() {
  const persisted = getPersistedState();
  if (!persisted) return;

  // Merge settings carefully so new keys (voidPin) get defaults if missing
  APP_STATE.settings = Object.assign({
    brandName: 'Caflat.Co POS',
    taxRate: 0,
    receiptFooter: 'Thank you for choosing Caflat.Co',
    currency: 'PHP',
    orderTypes: ['Dine In', 'Take Out', 'Delivery'],
    lowStockThreshold: 5,
    voidPin: '000000',
    supplierModeEnabled:   false,
    coffeeCartModeEnabled: false
  }, persisted.settings || {});

  APP_STATE.receiptCounter     = Number(persisted.receiptCounter || 0);
  APP_STATE.products           = Array.isArray(persisted.products)           ? persisted.products           : [];
  APP_STATE.ingredients        = Array.isArray(persisted.ingredients)        ? persisted.ingredients        : [];
  APP_STATE.sales              = Array.isArray(persisted.sales)              ? persisted.sales              : [];
  APP_STATE.categories         = Array.isArray(persisted.categories)         ? persisted.categories         : APP_STATE.categories;
  APP_STATE.heldOrders         = Array.isArray(persisted.heldOrders)        ? persisted.heldOrders         : [];
  APP_STATE.inventoryMovements = Array.isArray(persisted.inventoryMovements) ? persisted.inventoryMovements : [];
  APP_STATE.auditLog             = Array.isArray(persisted.auditLog)           ? persisted.auditLog           : [];
  APP_STATE.supplyOrders         = Array.isArray(persisted.supplyOrders)       ? persisted.supplyOrders       : [];
  APP_STATE.supplierClients      = Array.isArray(persisted.supplierClients)    ? persisted.supplierClients    : [];
  APP_STATE.supplyInvoiceCounter = Number(persisted.supplyInvoiceCounter || 0);
  APP_STATE.stockReservations    = Array.isArray(persisted.stockReservations)
    ? persisted.stockReservations : [];
  APP_STATE.events               = Array.isArray(persisted.events)        ? persisted.events        : [];
  APP_STATE.activeEvent          = persisted.activeEvent || null;
  APP_STATE.eventPackages        = Array.isArray(persisted.eventPackages) ? persisted.eventPackages : [];
  APP_STATE.leads                = Array.isArray(persisted.leads)         ? persisted.leads         : [];
  APP_STATE.labDrafts            = Array.isArray(persisted.labDrafts)            ? persisted.labDrafts            : [];
  APP_STATE.labCategoryPresets   = Array.isArray(persisted.labCategoryPresets)   ? persisted.labCategoryPresets   : [];
}

/* ── Export full backup ── */
function exportAllData() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: 'v1B',
    settings: APP_STATE.settings,
    receiptCounter: APP_STATE.receiptCounter,
    products: APP_STATE.products,
    ingredients: APP_STATE.ingredients,
    sales: APP_STATE.sales,
    categories: APP_STATE.categories,
    heldOrders: APP_STATE.heldOrders,
    inventoryMovements: APP_STATE.inventoryMovements,
    auditLog: APP_STATE.auditLog,
    supplyOrders: APP_STATE.supplyOrders,
    supplierClients: APP_STATE.supplierClients,
    supplyInvoiceCounter: APP_STATE.supplyInvoiceCounter,
    stockReservations: APP_STATE.stockReservations,
    events:            APP_STATE.events,
    activeEvent:       APP_STATE.activeEvent,
    eventPackages:     APP_STATE.eventPackages,
    leads:             APP_STATE.leads,
    labDrafts:         APP_STATE.labDrafts,
    labCategoryPresets:APP_STATE.labCategoryPresets
  };
  downloadTextFile(`caflat-backup-${Date.now()}.json`, JSON.stringify(data, null, 2));
  showNotification('Backup exported', 'success');
}

/* ── Import backup ── */
function importAllData(file) {
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.products && !data.sales) {
        showNotification('Invalid backup file', 'error');
        return;
      }
      if (!confirm('This will replace all current data. Continue?')) return;

      APP_STATE.settings           = Object.assign({
        brandName: 'Caflat.Co POS', taxRate: 0,
        receiptFooter: 'Thank you for choosing Caflat.Co',
        currency: 'PHP', orderTypes: ['Dine In', 'Take Out', 'Delivery'],
        lowStockThreshold: 5, voidPin: '000000', supplierModeEnabled: false
      }, data.settings || {});
      APP_STATE.receiptCounter     = Number(data.receiptCounter || 0);
      APP_STATE.products           = Array.isArray(data.products)           ? data.products           : [];
      APP_STATE.ingredients        = Array.isArray(data.ingredients)        ? data.ingredients        : [];
      APP_STATE.sales              = Array.isArray(data.sales)              ? data.sales              : [];
      APP_STATE.categories         = Array.isArray(data.categories)         ? data.categories         : [];
      APP_STATE.heldOrders         = Array.isArray(data.heldOrders)         ? data.heldOrders         : [];
      APP_STATE.inventoryMovements = Array.isArray(data.inventoryMovements) ? data.inventoryMovements : [];
      APP_STATE.auditLog             = Array.isArray(data.auditLog)           ? data.auditLog           : [];
      APP_STATE.supplyOrders         = Array.isArray(data.supplyOrders)       ? data.supplyOrders       : [];
      APP_STATE.supplierClients      = Array.isArray(data.supplierClients)    ? data.supplierClients    : [];
      APP_STATE.supplyInvoiceCounter = Number(data.supplyInvoiceCounter || 0);
      APP_STATE.stockReservations    = Array.isArray(data.stockReservations)
        ? data.stockReservations : [];
      APP_STATE.events               = Array.isArray(data.events)              ? data.events              : [];
      APP_STATE.activeEvent          = data.activeEvent || null;
      APP_STATE.eventPackages        = Array.isArray(data.eventPackages)       ? data.eventPackages       : [];
      APP_STATE.leads                = Array.isArray(data.leads)               ? data.leads               : [];
      APP_STATE.labDrafts            = Array.isArray(data.labDrafts)           ? data.labDrafts           : [];
      APP_STATE.labCategoryPresets   = Array.isArray(data.labCategoryPresets)  ? data.labCategoryPresets  : [];

      persistState();
      if (typeof renderEverything === 'function') renderEverything();
      showNotification('Backup imported successfully', 'success');
    } catch (err) {
      showNotification('Failed to import — invalid file', 'error');
    }
  };
  reader.readAsText(file);
}

/* ── Reset business data ── */

// Standard reset — wipes business data, keeps Lab presets + settings
function resetBusinessData() {
  if (typeof resetState === 'function') resetState();
  // Restore lab presets and settings after wipe (they survive standard reset)
  const preserved = {
    settings:           APP_STATE.settings,
    labCategoryPresets: APP_STATE.labCategoryPresets
  };
  localStorage.removeItem(STORAGE_KEY);
  // Re-apply preserved fields
  APP_STATE.settings           = preserved.settings;
  APP_STATE.labCategoryPresets = preserved.labCategoryPresets;
  if (typeof persistState === 'function') persistState();
  if (typeof renderEverything === 'function') renderEverything();
  showNotification('Business data reset — Lab presets and settings preserved', 'info');
}

// Full factory reset — wipes absolutely everything
function fullFactoryReset() {
  if (typeof resetState === 'function') resetState();
  APP_STATE.labCategoryPresets = [];
  APP_STATE.settings = {
    brandName:            'Caflat.Co POS',
    taxRate:              0,
    receiptFooter:        'Thank you for choosing Caflat.Co',
    currency:             'PHP',
    orderTypes:           ['Dine In', 'Take Out', 'Delivery'],
    lowStockThreshold:    5,
    voidPin:              '000000',
    supplierModeEnabled:  false,
    coffeeCartModeEnabled:false
  };
  localStorage.removeItem(STORAGE_KEY);
  if (typeof renderEverything === 'function') renderEverything();
  showNotification('Full factory reset complete', 'info');
}

window.getPersistedState    = getPersistedState;
window.persistState         = persistState;
window.restorePersistedState= restorePersistedState;
window.exportAllData        = exportAllData;
window.importAllData        = importAllData;
window.resetBusinessData    = resetBusinessData;
window.fullFactoryReset     = fullFactoryReset;
