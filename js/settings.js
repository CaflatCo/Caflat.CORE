/* ═══════════════════════════════════════════════════════
   SETTINGS.JS — Categories, branding, settings, demo data
═══════════════════════════════════════════════════════ */

function getCategories() {
  const raw = Array.isArray(APP_STATE.categories) ? APP_STATE.categories : [];
  // Migrate legacy string categories to objects
  return raw.map(c => {
    if (typeof c === 'string') {
      return { id: 'cat-' + c.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: c, inventoryMode: 'direct' };
    }
    return c;
  });
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

function toggleCategoryMode(catId) {
  const cats = getCategories().map(c =>
    c.id !== catId ? c
      : { ...c, inventoryMode: c.inventoryMode === 'finished_goods' ? 'direct' : 'finished_goods' }
  );
  updateState('categories', () => cats);
  renderCategories();
  if (typeof renderCategoryOptions === 'function') renderCategoryOptions();
}

function renameCategory(catId, newName) {
  const trimmed = (newName || '').trim();
  if (!trimmed) { renderCategories(); return; }
  const cats    = getCategories();
  const existing = cats.find(c => c.id === catId);
  if (!existing) return;
  if (existing.name === trimmed) return;
  if (cats.some(c => c.id !== catId && c.name.toLowerCase() === trimmed.toLowerCase())) {
    showNotification('Category name already exists', 'error');
    renderCategories(); return;
  }
  // Update products that used the old name
  const updatedProducts = (APP_STATE.products || []).map(p =>
    p.category === existing.name ? { ...p, category: trimmed } : p
  );
  updateState('products', () => updatedProducts);
  updateState('categories', () => cats.map(c =>
    c.id !== catId ? c : { ...c, name: trimmed }
  ));
  renderCategories();
  if (typeof renderCategoryOptions === 'function') renderCategoryOptions();
  showNotification('Category renamed', 'success');
}

function setCategories(categories) {
  updateState('categories', () => Array.isArray(categories) ? categories : []);
  renderCategories();
  renderCategoryOptions();
  if (typeof renderCategoryTabs === 'function') renderCategoryTabs();
}

function addCategory() {
  const input   = document.getElementById('newCategoryInput');
  const modeEl  = document.getElementById('newCategoryMode');
  if (!input) return;
  const value   = sanitizeText(input.value);
  const mode    = modeEl?.value || 'direct';
  if (!value) { showNotification('Category name is required', 'error'); return; }
  const cats = getCategories();
  if (cats.some(c => c.name.toLowerCase() === value.toLowerCase())) {
    showNotification('Category already exists', 'error'); return;
  }
  cats.push({ id: generateId(), name: value, inventoryMode: mode });
  updateState('categories', () => cats);
  input.value = '';
  renderCategories();
  if (typeof renderCategoryOptions === 'function') renderCategoryOptions();
  showNotification('Category added', 'success');
}

function deleteCategory(catId) {
  const cats = getCategories();
  // Support both id-based and name-based deletion for backward compat
  const cat  = cats.find(c => c.id === catId) || cats.find(c => c.name === catId);
  if (!cat) return;
  if (!confirm(`Delete "${cat.name}"?`)) return;
  updateState('categories', () => cats.filter(c => c.id !== cat.id));
  renderCategories();
  if (typeof renderCategoryOptions === 'function') renderCategoryOptions();
  showNotification('Category deleted', 'success');
}

function renderCategories() {
  const container = document.getElementById('categoryList');
  if (!container) return;
  container.innerHTML = '';
  const cats = getCategories();
  if (!cats.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--gray-400);padding:8px 0;">No categories yet</div>';
    return;
  }
  cats.forEach(cat => {
    const isFG  = cat.inventoryMode === 'finished_goods';
    const card  = document.createElement('div');
    card.style.cssText = 'border:1.5px solid var(--gray-200);border-radius:12px;' +
      'padding:12px 16px;margin-bottom:8px;background:var(--white);';

    // Editable name + delete
    const topRow = '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'margin-bottom:10px;gap:8px;">' +
      '<input type="text" value="' + escapeHtml(cat.name) + '" ' +
        'data-cat-rename-id="' + cat.id + '" ' +
        'style="font-size:14px;font-weight:800;border:none;outline:none;' +
          'background:transparent;font-family:var(--font-main);flex:1;padding:0;min-width:0;" ' +
        'placeholder="Category name" />' +
      '<button type="button" data-action="delete-category" data-id="' + cat.id + '" ' +
        'style="background:none;border:none;cursor:pointer;font-size:16px;' +
          'color:var(--gray-300);padding:2px 6px;font-family:var(--font-main);flex-shrink:0;">✕</button>' +
    '</div>';

    // Toggle row
    const toggleRow =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
        '<div>' +
          '<div style="font-size:12px;font-weight:700;">' + (isFG ? 'Finished Goods' : 'Direct') + '</div>' +
          '<div style="font-size:11px;color:var(--gray-400);margin-top:1px;">' +
            (isFG ? 'Sells from produced stock' : 'Ingredients deduct at sale') +
          '</div>' +
        '</div>' +
        '<label style="position:relative;display:inline-block;width:44px;height:24px;' +
          'flex-shrink:0;cursor:pointer;">' +
          '<input type="checkbox" ' + (isFG ? 'checked' : '') + ' ' +
            'data-action="toggle-category-mode" data-id="' + cat.id + '" ' +
            'style="opacity:0;width:0;height:0;position:absolute;" />' +
          '<div style="position:absolute;top:0;left:0;right:0;bottom:0;' +
            'background:' + (isFG ? 'var(--black)' : 'var(--gray-200)') + ';' +
            'border-radius:999px;transition:background .2s;"></div>' +
          '<div style="position:absolute;top:3px;left:' + (isFG ? '23px' : '3px') + ';' +
            'width:18px;height:18px;background:white;border-radius:50%;' +
            'transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);"></div>' +
        '</label>' +
      '</div>';

    card.innerHTML = topRow + toggleRow;
    container.appendChild(card);
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
      const opt  = document.createElement('option');
      const name = typeof cat === 'object' ? cat.name : cat;
      const isFG = typeof cat === 'object' && cat.inventoryMode === 'finished_goods';
      opt.value       = name;
      opt.textContent = name + (isFG ? ' · FG' : '');
      if (current === name) opt.selected = true;
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

  const supplierModeEnabled = document.getElementById('settingsSupplierMode')?.checked === true;

  updateState('settings', current => ({
    ...current,
    brandName: brandName || current.brandName,
    taxRate,
    receiptFooter,
    supplierModeEnabled,
    ...(voidPin ? { voidPin } : {})
  }));

  renderBranding();
  if (typeof applySupplierModeToggle  === 'function') applySupplierModeToggle();
  if (typeof applySupplierCartButton === 'function') applySupplierCartButton();
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
  _renderPaymentQRBoxes();
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

  if (!APP_STATE.categories.includes('Drinks')) APP_STATE.categories.push('Drinks');

  APP_STATE.sales = [];
  persistState();
  if (typeof renderEverything === 'function') renderEverything();
  showNotification('Demo data loaded', 'success');
}

window.getCategories         = getCategories;
window.getCategoryByName     = getCategoryByName;
window.getCategoryMode       = getCategoryMode;
window.isFinishedGoodsProduct= isFinishedGoodsProduct;
window.setCategories         = setCategories;
window.addCategory           = addCategory;
window.deleteCategory        = deleteCategory;
window.toggleCategoryMode    = toggleCategoryMode;
window.renameCategory        = renameCategory;
window.renderCategories      = renderCategories;
window.renderCategoryOptions = renderCategoryOptions;
/* ── Payment QR Codes ── */

function uploadPaymentQR(method, input) {
  const file = input?.files?.[0];
  if (!file) return;

  // Compress to max 400×400 before storing as base64
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const MAX = 400;
      const scale  = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.82);

      // Save to settings
      updateState('settings', s => ({
        ...s,
        paymentQRImages: { ...(s.paymentQRImages || {}), [method]: b64 }
      }));

      _renderPaymentQRBoxes();
      showNotification('QR saved', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  // Reset input so same file can be re-uploaded
  input.value = '';
}

function removePaymentQR(method) {
  updateState('settings', s => {
    const imgs = { ...(s.paymentQRImages || {}) };
    delete imgs[method];
    return { ...s, paymentQRImages: imgs };
  });
  _renderPaymentQRBoxes();
  showNotification('QR removed', 'success');
}

function _renderPaymentQRBoxes() {
  const images = APP_STATE.settings?.paymentQRImages || {};
  ['gcash', 'maya', 'qrph'].forEach(method => {
    const capMethod = method.charAt(0).toUpperCase() + method.slice(1);
    const b64       = images[method];
    const box       = document.getElementById('qrBox'   + capMethod);
    const img       = document.getElementById('qrImg'   + capMethod);
    const removeBtn = document.getElementById('qrRemove'+ capMethod);
    const placeholder = box?.querySelector('.qr-placeholder');

    if (!box || !img) return;

    if (b64) {
      // Show image, hide placeholder, show remove button
      img.src          = b64;
      img.style.display = 'block';
      if (placeholder)  placeholder.style.display = 'none';
      if (removeBtn)    removeBtn.style.display    = 'flex';
      box.style.border  = '2px solid var(--gray-300)';
    } else {
      // Show placeholder, hide image, hide remove button
      img.src           = '';
      img.style.display = 'none';
      if (placeholder)  placeholder.style.display = 'flex';
      if (removeBtn)    removeBtn.style.display    = 'none';
      box.style.border  = '2px dashed var(--gray-200)';
    }
  });
}

window.uploadPaymentQR      = uploadPaymentQR;
window.removePaymentQR      = removePaymentQR;
window._renderPaymentQRBoxes= _renderPaymentQRBoxes;

/* ── Danger Zone ── */

function archiveAndReset() {
  if (!confirm('This will export a backup first, then wipe all business data.\n\nSettings and categories will be kept.\n\nContinue?')) return;
  // Export first
  if (typeof exportAllData === 'function') {
    exportAllData();
  } else if (typeof exportData === 'function') {
    exportData();
  }
  // Reset after short delay to let download trigger
  setTimeout(() => {
    if (typeof resetBusinessData === 'function') {
      resetBusinessData();
      showNotification('Data archived and reset', 'success');
      if (typeof renderEverything === 'function') renderEverything();
    }
  }, 800);
}

function factoryReset() {
  if (!confirm('Factory Reset will wipe EVERYTHING including settings and passwords.\n\nThis cannot be undone. Are you sure?')) return;
  if (!confirm('Final confirmation — delete everything and restart?')) return;
  localStorage.clear();
  window.location.reload();
}

window.archiveAndReset = archiveAndReset;
window.factoryReset    = factoryReset;

window.saveSettings        = saveSettings;
window.renderBranding      = renderBranding;
window.loadDemoData        = loadDemoData;
