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
  const brandName     = sanitizeText(getElementValue('settingsBrandName'));
  const taxRate       = safeNumber(getElementValue('settingsTaxRate'));
  const receiptFooter = sanitizeText(getElementValue('settingsReceiptFooter'));
  const receiptBaseUrl = String(getElementValue('settingsReceiptUrl') || '').trim();

  const voidPin = String(getElementValue('settingsVoidPin') || '').trim();
  if (voidPin && (voidPin.length !== 6 || !/^\d{6}$/.test(voidPin))) {
    showNotification('Void PIN must be exactly 6 digits', 'error');
    return;
  }

  const supplierModeEnabled    = document.getElementById('settingsSupplierMode')?.checked    === true;
  const productionModeEnabled  = document.getElementById('settingsProductionMode')?.checked  === true;
  const coffeeCartModeEnabled  = document.getElementById('settingsCoffeeCartMode')?.checked  === true;
  const productLabModeEnabled  = document.getElementById('settingsProductLabMode')?.checked  === true;

  updateState('settings', current => ({
    ...current,
    brandName: brandName || current.brandName,
    taxRate,
    receiptFooter,
    receiptBaseUrl,
    supplierModeEnabled,
    productionModeEnabled,
    coffeeCartModeEnabled,
    productLabModeEnabled,
    ...(voidPin ? { voidPin } : {})
  }));

  renderBranding();
  renderCheckoutPaymentOptions();
  if (typeof applySupplierModeToggle    === 'function') applySupplierModeToggle();
  if (typeof applySupplierCartButton    === 'function') applySupplierCartButton();
  if (typeof applyProductionModeToggle  === 'function') applyProductionModeToggle();
  if (typeof applyCoffeeCartModeToggle  === 'function') applyCoffeeCartModeToggle();
  applyProductLabModeToggle();
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

  const urlInput = document.getElementById('settingsReceiptUrl');
  if (urlInput) urlInput.value = APP_STATE.settings?.receiptBaseUrl || '';
  _updateReceiptUrlPreview();

  // Void PIN — show placeholder only, never expose stored value
  const voidPinInput = document.getElementById('settingsVoidPin');
  if (voidPinInput) voidPinInput.value = '';
  voidPinInput && voidPinInput.setAttribute('placeholder', '••••••  (enter new PIN to change)');

  const supplierToggle = document.getElementById('settingsSupplierMode');
  if (supplierToggle) supplierToggle.checked = APP_STATE.settings?.supplierModeEnabled === true;

  const productionToggle = document.getElementById('settingsProductionMode');
  if (productionToggle) productionToggle.checked = APP_STATE.settings?.productionModeEnabled === true;

  const coffeeCartToggle = document.getElementById('settingsCoffeeCartMode');
  if (coffeeCartToggle) coffeeCartToggle.checked = APP_STATE.settings?.coffeeCartModeEnabled === true;

  const productLabToggle = document.getElementById('settingsProductLabMode');
  if (productLabToggle) productLabToggle.checked = APP_STATE.settings?.productLabModeEnabled === true;

  _renderPaymentQRBoxes();
  renderPaymentMethodsList();
  renderCheckoutPaymentOptions();
}

function renderCheckoutPaymentOptions() {
  const select = document.getElementById('checkoutPayment');
  if (!select) return;
  const current = select.value;
  const methods = APP_STATE.settings?.paymentMethods || [];
  select.innerHTML = '<option value="cash">Cash</option>';
  methods.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.name.toLowerCase().replace(/\s+/g, '_');
    opt.textContent = m.name;
    select.appendChild(opt);
  });
  // Restore selection if still valid
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function _updateReceiptUrlPreview() {
  const preview = document.getElementById('receiptUrlPreview');
  if (!preview) return;
  const url = String(document.getElementById('settingsReceiptUrl')?.value || '').trim();
  preview.textContent = url ? `${url}?r=0001` : 'https://your-url?r=0001';
}

function applyProductLabModeToggle() {
  const enabled = APP_STATE.settings?.productLabModeEnabled === true;
  const navBtn  = document.getElementById('navLab');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';
  const labBtn  = document.getElementById('openLabBtn');
  if (labBtn) labBtn.style.display = enabled ? '' : 'none';
  if (!enabled && APP_STATE.ui?.currentView === 'lab') {
    if (typeof switchPage === 'function') switchPage('products');
  }
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

function archiveAndResetLocal() {
  if (!confirm('This will download a backup file, then wipe all business data.\n\nSettings and categories will be kept.\n\nContinue?')) return;
  if (typeof exportAllData === 'function') exportAllData();
  setTimeout(() => {
    if (typeof resetBusinessData === 'function') {
      resetBusinessData();
      showNotification('Data archived locally and reset', 'success');
    }
  }, 800);
}

function archiveAndResetEmail() {
  const email = prompt('Enter email address to send backup to:');
  if (!email || !email.includes('@')) {
    if (email !== null) showNotification('Invalid email address', 'error');
    return;
  }
  if (!confirm(`This will:\n1. Download a full backup file\n2. Open your mail app to send it to ${email}\n3. Wipe all business data\n\nSettings and categories will be kept.\n\nContinue?`)) return;

  // Always trigger download first — email body can't hold the full JSON
  if (typeof exportAllData === 'function') exportAllData();

  const brand   = APP_STATE.settings?.brandName || 'Caflat';
  const date    = new Date().toISOString().slice(0, 10);
  const subject = encodeURIComponent(`${brand} Backup — ${date}`);
  const body    = encodeURIComponent(
    `Caflat.Co End-of-Day Backup\n` +
    `Brand: ${brand}\nDate: ${date}\n\n` +
    `The full backup JSON file has been downloaded to your device.\n` +
    `Please attach it to this email and send it to yourself for safekeeping.\n\n` +
    `Generated by Caflat.CORE`
  );

  // Use an <a> element click — the only method that reliably opens
  // the native mail app on iOS Safari, iPadOS, macOS, Android, and Windows
  const a = document.createElement('a');
  a.href = `mailto:${email}?subject=${subject}&body=${body}`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 500);

  // Reset after a short delay to let the download trigger first
  setTimeout(() => {
    if (typeof resetBusinessData === 'function') {
      resetBusinessData();
      if (typeof renderEverything === 'function') renderEverything();
      showNotification('Backup downloaded — attach it to the email that just opened', 'success');
    }
  }, 1500);
}

// Legacy alias
function archiveAndReset() { archiveAndResetLocal(); }

function factoryReset() {
  if (!confirm('Factory Reset will wipe EVERYTHING including settings and passwords.\n\nThis cannot be undone. Are you sure?')) return;
  if (!confirm('Final confirmation — delete everything and restart?')) return;
  localStorage.clear();
  window.location.reload();
}

window.archiveAndReset      = archiveAndReset;
window.archiveAndResetLocal = archiveAndResetLocal;
window.archiveAndResetEmail = archiveAndResetEmail;
window.factoryReset         = factoryReset;
window.applyProductLabModeToggle = applyProductLabModeToggle;

window.saveSettings        = saveSettings;
window.renderBranding      = renderBranding;
window.loadDemoData        = loadDemoData;

/* ─────────────────────────────────────────────
   PAYMENT METHODS
───────────────────────────────────────────── */

function _getPaymentMethods() {
  return APP_STATE.settings?.paymentMethods || [];
}

function renderPaymentMethodsList() {
  const container = document.getElementById('paymentMethodsList');
  if (!container) return;
  const methods = _getPaymentMethods();

  if (!methods.length) {
    container.innerHTML = `<div style="font-size:13px;color:var(--gray-400);
      padding:12px 0;">No payment methods yet. Add one below.</div>`;
    return;
  }

  container.innerHTML = methods.map((m, i) => {
    const typeLabel = { cash:'Cash', qr:'QR Code', bank:'Bank Transfer', card:'Card', other:'Other' }[m.type] || m.type;
    const detail = m.type === 'bank'
      ? `<div style="font-size:11px;color:var(--gray-400);margin-top:2px;">${m.bankName || ''} · ${m.accountNumber || ''}</div>`
      : m.type === 'qr' && m.qrImage
        ? `<img src="${m.qrImage}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;margin-top:4px;" />`
        : '';

    return `<div style="display:flex;align-items:center;justify-content:space-between;
      padding:12px 14px;border:1.5px solid var(--gray-200);border-radius:var(--radius-md);
      margin-bottom:8px;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${sanitizeText(m.name)}</div>
        <div style="font-size:11px;color:var(--gray-400);margin-top:1px;">${typeLabel}</div>
        ${detail}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-secondary" type="button"
          onclick="openPaymentMethodModal(${i});"
          style="padding:6px 12px;font-size:12px;">Edit</button>
        <button class="btn btn-secondary" type="button"
          onclick="deletePaymentMethod(${i});"
          style="padding:6px 12px;font-size:12px;color:#dc2626;border-color:#fca5a5;">✕</button>
      </div>
    </div>`;
  }).join('');
}

function openPaymentMethodModal(editIndex) {
  const modal = document.getElementById('paymentMethodModal');
  if (!modal) return;

  // Reset form
  document.getElementById('pmEditId').value = editIndex ?? '';
  document.getElementById('pmName').value = '';
  document.getElementById('pmType').value = 'cash';
  document.getElementById('pmQrSection').style.display = 'none';
  document.getElementById('pmBankSection').style.display = 'none';
  document.getElementById('pmBankName').value = '';
  document.getElementById('pmAccountName').value = '';
  document.getElementById('pmAccountNumber').value = '';
  clearPmQr();

  const title = document.getElementById('paymentMethodModalTitle');

  if (editIndex !== null && editIndex !== undefined) {
    const m = _getPaymentMethods()[editIndex];
    if (!m) return;
    if (title) title.textContent = 'Edit Payment Method';
    document.getElementById('pmName').value = m.name || '';
    document.getElementById('pmType').value = m.type || 'cash';

    if (m.type === 'qr') {
      document.getElementById('pmQrSection').style.display = 'block';
      if (m.qrImage) {
        document.getElementById('pmQrPreviewImg').src = m.qrImage;
        document.getElementById('pmQrPreviewImg').style.display = 'block';
        document.getElementById('pmQrPreviewPlaceholder').style.display = 'none';
        document.getElementById('pmQrClearBtn').style.display = 'block';
      }
    } else if (m.type === 'bank') {
      document.getElementById('pmBankSection').style.display = 'block';
      document.getElementById('pmBankName').value = m.bankName || '';
      document.getElementById('pmAccountName').value = m.accountName || '';
      document.getElementById('pmAccountNumber').value = m.accountNumber || '';
    }
  } else {
    if (title) title.textContent = 'Add Payment Method';
  }

  if (typeof openModal === 'function') openModal('paymentMethodModal');
}

function previewPmQr(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('pmQrPreviewImg');
    const placeholder = document.getElementById('pmQrPreviewPlaceholder');
    const clearBtn = document.getElementById('pmQrClearBtn');
    img.src = e.target.result;
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}

function clearPmQr() {
  const img = document.getElementById('pmQrPreviewImg');
  const placeholder = document.getElementById('pmQrPreviewPlaceholder');
  const clearBtn = document.getElementById('pmQrClearBtn');
  const upload = document.getElementById('pmQrUpload');
  if (img) { img.src = ''; img.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'block';
  if (clearBtn) clearBtn.style.display = 'none';
  if (upload) upload.value = '';
}

function savePaymentMethod() {
  const name = sanitizeText(getElementValue('pmName'));
  if (!name) { showNotification('Method name is required', 'error'); return; }

  const type = getElementValue('pmType') || 'cash';
  const editId = document.getElementById('pmEditId').value;

  const method = { name, type };

  if (type === 'qr') {
    const img = document.getElementById('pmQrPreviewImg');
    method.qrImage = img && img.style.display !== 'none' ? img.src : '';
  }
  if (type === 'bank') {
    method.bankName      = sanitizeText(getElementValue('pmBankName'));
    method.accountName   = sanitizeText(getElementValue('pmAccountName'));
    method.accountNumber = sanitizeText(getElementValue('pmAccountNumber'));
  }

  updateState('settings', current => {
    const methods = [...(current.paymentMethods || [])];
    if (editId !== '') {
      methods[parseInt(editId)] = method;
    } else {
      methods.push(method);
    }
    return { ...current, paymentMethods: methods };
  });

  renderPaymentMethodsList();
  if (typeof closeModal === 'function') closeModal('paymentMethodModal');
  showNotification('Payment method saved', 'success');
}

function deletePaymentMethod(index) {
  if (!confirm('Remove this payment method?')) return;
  updateState('settings', current => {
    const methods = [...(current.paymentMethods || [])];
    methods.splice(index, 1);
    return { ...current, paymentMethods: methods };
  });
  renderPaymentMethodsList();
  showNotification('Payment method removed', 'success');
}

window.renderCheckoutPaymentOptions = renderCheckoutPaymentOptions;
window.renderPaymentMethodsList = renderPaymentMethodsList;
window.openPaymentMethodModal   = openPaymentMethodModal;
window.savePaymentMethod        = savePaymentMethod;
window.deletePaymentMethod      = deletePaymentMethod;
window.previewPmQr              = previewPmQr;
window.clearPmQr                = clearPmQr;

