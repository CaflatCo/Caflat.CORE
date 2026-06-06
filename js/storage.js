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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: APP_STATE.settings,
        products: APP_STATE.products,
        ingredients: APP_STATE.ingredients,
        sales: APP_STATE.sales,
        categories: APP_STATE.categories,
        heldOrders: APP_STATE.heldOrders,
        inventoryMovements: APP_STATE.inventoryMovements
      })
    );
  } catch (error) {
    console.error('Failed to persist state', error);
  }
}

function restorePersistedState() {
  const persisted = getPersistedState();
  if (!persisted) return;

  APP_STATE.settings = persisted.settings || APP_STATE.settings;
  APP_STATE.products = Array.isArray(persisted.products) ? persisted.products : [];
  APP_STATE.ingredients = Array.isArray(persisted.ingredients) ? persisted.ingredients : [];
  APP_STATE.sales = Array.isArray(persisted.sales) ? persisted.sales : [];
  APP_STATE.categories = Array.isArray(persisted.categories) ? persisted.categories : APP_STATE.categories;
  APP_STATE.heldOrders = Array.isArray(persisted.heldOrders) ? persisted.heldOrders : [];
  APP_STATE.inventoryMovements = Array.isArray(persisted.inventoryMovements) ? persisted.inventoryMovements : [];
}

function exportAllData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    data: {
      settings: APP_STATE.settings,
      products: APP_STATE.products,
      ingredients: APP_STATE.ingredients,
      sales: APP_STATE.sales,
      categories: APP_STATE.categories,
      heldOrders: APP_STATE.heldOrders,
      inventoryMovements: APP_STATE.inventoryMovements
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `caflat-backup-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importAllData(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = event => {
    try {
      const parsed = JSON.parse(event.target.result);
      const data = parsed.data || {};

      APP_STATE.settings = data.settings || APP_STATE.settings;
      APP_STATE.products = Array.isArray(data.products) ? data.products : [];
      APP_STATE.ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
      APP_STATE.sales = Array.isArray(data.sales) ? data.sales : [];
      APP_STATE.categories = Array.isArray(data.categories) ? data.categories : APP_STATE.categories;
      APP_STATE.heldOrders = Array.isArray(data.heldOrders) ? data.heldOrders : [];
      APP_STATE.inventoryMovements = Array.isArray(data.inventoryMovements) ? data.inventoryMovements : [];

      persistState();

      if (typeof renderEverything === 'function') {
        renderEverything();
      }

      showNotification('Backup imported successfully', 'success');
    } catch (error) {
      console.error('Import failed', error);
      showNotification('Invalid backup file', 'error');
    }
  };

  reader.readAsText(file);
}

window.persistState = persistState;
window.restorePersistedState = restorePersistedState;
window.exportAllData = exportAllData;
window.importAllData = importAllData;


function resetBusinessData() {
  const settings = APP_STATE.settings;
  localStorage.removeItem(STORAGE_KEY);
  APP_STATE.settings = settings;
  APP_STATE.products = [];
  APP_STATE.ingredients = [];
  APP_STATE.sales = [];
  APP_STATE.categories = [];
  APP_STATE.heldOrders = [];
  APP_STATE.inventoryMovements = [];
  persistState();
  location.reload();
}

window.resetBusinessData = resetBusinessData;
