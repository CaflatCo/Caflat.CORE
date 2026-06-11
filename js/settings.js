/* ═══════════════════════════════════════════════════════
   SETTINGS.JS — Categories, branding, settings, demo data
═══════════════════════════════════════════════════════ */

/* ── Category helpers ── */
function getCategories() {
  return Array.isArray(APP_STATE.categories) ? APP_STATE.categories : [];
}

function getCategoryByName(name) {
  return getCategories().find(c => c.name === name) || null;
}

function getCategoryMode(productCategoryName) {
  const cat = getCategoryByName(productCategoryName);
  return cat?.inventoryMode || 'direct';
}

function isFinishedGoodsProduct(product) {
  return getCategoryMode(product?.category) === 'finished_goods';
}

function setCategories(categories) {
  updateState('categories', () => Array.isArray(categories) ? categories : []);
  renderCategories();
  renderCategoryOptions();
  if (typeof renderCategoryTabs === 'function') renderCategoryTabs();
}

function addCategory() {
  const input = document.getElementById('newCategoryInput');
  const mode  = document.getElementById('newCategoryMode')?.value || 'direct';
  if (!input) return;
  const value = sanitizeText(input.value);
  if (!value) { showNotification('Category name is required', 'error'); return; }
  const categories = getCategories();
  if (categories.some(c => c.name.toLowerCase() === value.toLowerCase())) {
    showNotification('Category already exists', 'error'); return;
  }
  categories.push({
    id: 'cat-' + Date.now(),
    name: value,
    inventoryMode: mode
  });
  setCategories(categories);
  input.value = '';
  showNotification('Category added', 'success');
}

function deleteCategory(categoryId) {
  const cat = getCategories().find(c => c.id === categoryId);
  if (!cat) return;
  if (!confirm('Delete "' + cat.name + '"?')) return;
  setCategories(getCategories().filter(c => c.id !== categoryId));
  showNotification('Category deleted', 'success');
}

function toggleCategoryMode(categoryId) {
  const cats = getCategories();
  const cat  = cats.find(c => c.id === categoryId);
  if (!cat) return;
  cat.inventoryMode = cat.inventoryMode === 'finished_goods' ? 'direct' : 'finished_goods';
  setCategories(cats);
}

function renderCategories() {
  const container = document.getElementById('categoryList');
  if (!container) return;
  container.innerHTML = '';
  getCategories().forEach(cat => {
    const isFG   = cat.inventoryMode === 'finished_goods';
    const item   = document.createElement('div');
    item.className = 'category-chip';
    item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;' +
      'padding:8px 12px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);' +
      'margin-bottom:6px;background:var(--white);gap:10px;';
    item.innerHTML =
      '<div style="flex:1;">' +
        '<div style="font-weight:700;font-size:13px;">' + escapeHtml(cat.name) + '</div>' +
        '<div style="font-size:10px;color:' + (isFG ? '#2563eb' : 'var(--gray-400)') + ';margin-top:1px;">' +
          (isFG ? '📦 Finished Goods — sells from produced stock' : '⚡ Direct — ingredients deduct at sale') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;align-items:center;">' +
        '<button type="button" class="btn btn-sm btn-secondary" ' +
          'data-action="toggle-category-mode" data-id="' + cat.id + '">' +
          (isFG ? 'Switch to Direct' : 'Switch to FG') +
        '</button>' +
        '<button type="button" class="btn btn-sm btn-secondary" ' +
          'data-action="delete-category" data-id="' + cat.id + '">Delete</button>' +
      '</div>';
    container.appendChild(item);
  });
}

function renderCategoryOptions() {
  const selects = document.querySelectorAll('#productCategory, #productCategoryFilter');
  const categories = getCategories();
  selects.forEach(select => {
    const current = select.value;
    const isFilter = select.id === 'productCategoryFilter';
    select.innerHTML = '';
    if (isFilter) {
      const opt = document.createElement('option');
      opt.value = 'All'; opt.textContent = 'All Categories';
      select.appendChild(opt);
    } else {
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = 'Select Category';
      select.appendChild(opt);
    }
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name; opt.textContent = cat.name +
        (cat.inventoryMode === 'finished_goods' ? ' 📦' : '');
      if (current === cat.name) opt.selected = true;
      select.appendChild(opt);
    });
  });
}

/* ── Settings ── */
function saveSettings() {
  const brandName    = sanitizeText(getElementValue('settingsBrandName'));
  const taxRate      = safeNumber(getElementValue('settingsTaxRate'));
  const receiptFooter = sanitizeText(getElementValue('settingsReceiptFooter'));

  const voidPin = String(getElementValue('settingsVoidPin') || '').trim();
  if (voidPin && (voidPin.length !== 6 || !/^\d{6}$/.test(voidPin))) {
    showNotification('Void PIN must be exactly 6 digits', 'error');
    return;
  }

  const supplierModeEnabled   = document.getElementById('settingsSupplierMode')?.checked   === true;
  const coffeeCartModeEnabled  = document.getElementById('settingsCoffeeCartMode')?.checked  === true;
  const productionModeEnabled  = document.getElementById('settingsProductionMode')?.checked  === true;

  updateState('settings', current => ({
    ...current,
    brandName: brandName || current.brandName,
    taxRate,
    receiptFooter,
    supplierModeEnabled,
    coffeeCartModeEnabled,
    productionModeEnabled,
    ...(voidPin ? { voidPin } : {})
  }));

  renderBranding();
  if (typeof applySupplierModeToggle    === 'function') applySupplierModeToggle();
  if (typeof applySupplierCartButton   === 'function') applySupplierCartButton();
  if (typeof applyCoffeeCartModeToggle  === 'function') applyCoffeeCartModeToggle();
  if (typeof applyProductionModeToggle  === 'function') applyProductionModeToggle();
  showNotification('Settings saved', 'success');
}

function renderBranding() {
  const brandName = APP_STATE.settings?.brandName || 'Caflat.Co POS';
  document.querySelectorAll('[data-brand-name]').forEach(el => { el.textContent = brandName; });
  const brandInput = document.getElementById('settingsBrandName');
  if (brandInput) brandInput.value = brandName;
  const taxInput = document.getElementById('settingsTaxRate');
  if (taxInput) taxInput.value = APP_STATE.settings?.taxRate ?? 0;
  const footerInput = document.getElementById('settingsReceiptFooter');
  if (footerInput) footerInput.value = APP_STATE.settings?.receiptFooter || '';

  // Void PIN — show placeholder only, never expose stored value
  const voidPinInput = document.getElementById('settingsVoidPin');
  if (voidPinInput) voidPinInput.value = '';
  voidPinInput && voidPinInput.setAttribute('placeholder', '••••••  (enter new PIN to change)');

  const supplierToggle = document.getElementById('settingsSupplierMode');
  if (supplierToggle) supplierToggle.checked = APP_STATE.settings?.supplierModeEnabled === true;

  const coffeeCartToggle = document.getElementById('settingsCoffeeCartMode');
  if (coffeeCartToggle) coffeeCartToggle.checked = APP_STATE.settings?.coffeeCartModeEnabled === true;

  const productionToggle = document.getElementById('settingsProductionMode');
  if (productionToggle) productionToggle.checked = APP_STATE.settings?.productionModeEnabled === true;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Demo data ── */
function loadDemoData() {
  if (!confirm('Load demo data? This will replace current products and ingredients.')) return;

  const cId = generateId(), dId = generateId(), bId = generateId(), fId = generateId();
  const btrId = generateId(), chocId = generateId(), floId = generateId(), milkId = generateId();

  APP_STATE.ingredients = [
    { id: btrId,  name: 'Butter',          unit: 'g',   stock: 5000, reorderLevel: 1000, packageQuantity: 5000, packageCost: 1200, costPerUnit: 0.24, createdAt: new Date().toISOString() },
    { id: chocId, name: 'Chocolate Chips', unit: 'g',   stock: 3000, reorderLevel: 500,  packageQuantity: 3000, packageCost: 850,  costPerUnit: 0.283, createdAt: new Date().toISOString() },
    { id: floId,  name: 'All-Purpose Flour', unit: 'g', stock: 8000, reorderLevel: 2000, packageQuantity: 1000, packageCost: 55,   costPerUnit: 0.055, createdAt: new Date().toISOString() },
    { id: milkId, name: 'Fresh Milk',      unit: 'ml',  stock: 2000, reorderLevel: 500,  packageQuantity: 1000, packageCost: 120,  costPerUnit: 0.12, createdAt: new Date().toISOString() },
  ];

  APP_STATE.products = [
    {
      id: cId, name: 'Classic Choco Chip', category: 'Cookies',
      price: 65, stock: 25, reorderLevel: 5,
      variants: [], recipeMode: 'unit', batchYield: 1,
      recipe: [
        { ingredientId: btrId,  quantity: 30 },
        { ingredientId: chocId, quantity: 20 },
        { ingredientId: floId,  quantity: 40 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: dId, name: 'Dubai Chewy Cookie', category: 'Chewy Cookies',
      price: 140, stock: 15, reorderLevel: 5,
      variants: [], recipeMode: 'unit', batchYield: 1,
      recipe: [
        { ingredientId: btrId,  quantity: 35 },
        { ingredientId: floId,  quantity: 50 }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: bId, name: 'Iced Latte', category: 'Drinks',
      price: 120, stock: 30, reorderLevel: 5,
      variants: [
        { id: generateId(), name: 'Small',  price: 100, multiplier: 1 },
        { id: generateId(), name: 'Medium', price: 120, multiplier: 1 },
        { id: generateId(), name: 'Large',  price: 150, multiplier: 1 },
      ],
      recipe: [{ ingredientId: milkId, quantity: 200 }],
      recipeMode: 'unit', batchYield: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: fId, name: 'Cold Brew', category: 'Drinks',
      price: 110, stock: 20, reorderLevel: 5,
      variants: [], recipe: [{ ingredientId: milkId, quantity: 100 }],
      recipeMode: 'unit', batchYield: 1,
      createdAt: new Date().toISOString()
    }
  ];

  if (!APP_STATE.categories.some(c => c.name === 'Drinks')) APP_STATE.categories.push({ id: 'cat-drinks', name: 'Drinks', inventoryMode: 'direct' });

  APP_STATE.sales = [];
  persistState();
  if (typeof renderEverything === 'function') renderEverything();
  showNotification('Demo data loaded', 'success');
}

window.getCategories       = getCategories;
window.setCategories       = setCategories;
window.addCategory         = addCategory;
window.deleteCategory      = deleteCategory;
window.renderCategories    = renderCategories;
window.renderCategoryOptions = renderCategoryOptions;
window.saveSettings        = saveSettings;
window.renderBranding      = renderBranding;
window.loadDemoData        = loadDemoData;
