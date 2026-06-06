function getCategories() {
  return Array.isArray(APP_STATE.categories) ? APP_STATE.categories : [];
}

function setCategories(categories) {
  updateState('categories', () => Array.isArray(categories) ? categories : []);
  renderCategories();
  renderCategoryOptions();
  if (typeof renderCategoryTabs === 'function') renderCategoryTabs();
}

function addCategory() {
  const input = document.getElementById('newCategoryInput');
  if (!input) return;

  const value = sanitizeText(input.value);
  if (!value) {
    showNotification('Category name is required', 'error');
    return;
  }

  const categories = getCategories();
  const exists = categories.some(category => category.toLowerCase() === value.toLowerCase());

  if (exists) {
    showNotification('Category already exists', 'error');
    return;
  }

  categories.push(value);
  setCategories(categories);
  input.value = '';
  showNotification('Category added', 'success');
}

function deleteCategory(categoryName) {
  const confirmed = confirm(`Delete ${categoryName}?`);
  if (!confirmed) return;

  const filtered = getCategories().filter(category => category !== categoryName);
  setCategories(filtered);
  showNotification('Category deleted', 'success');
}

function renderCategories() {
  const container = document.getElementById('categoryList');
  if (!container) return;

  const categories = getCategories();
  container.innerHTML = '';

  categories.forEach(category => {
    const item = document.createElement('div');
    item.className = 'category-chip';
    item.innerHTML = `
      <span>${escapeHtml(category)}</span>
      <button type="button" data-action="delete-category" data-category="${escapeHtml(category)}">×</button>
    `;
    item.querySelector('button')?.addEventListener('click', () => deleteCategory(category));
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
      const allOption = document.createElement('option');
      allOption.value = 'All';
      allOption.textContent = 'All Categories';
      select.appendChild(allOption);
    } else {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select Category';
      select.appendChild(placeholder);
    }

    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      if (current === category) option.selected = true;
      select.appendChild(option);
    });
  });
}

function saveSettings() {
  const brandName = sanitizeText(getElementValue('settingsBrandName'));
  const taxRate = safeNumber(getElementValue('settingsTaxRate'));
  const receiptFooter = sanitizeText(getElementValue('settingsReceiptFooter'));

  updateState('settings', current => ({
    ...current,
    brandName: brandName || current.brandName,
    taxRate,
    receiptFooter
  }));

  renderBranding();
  showNotification('Settings saved', 'success');
}

function renderBranding() {
  const brandTargets = document.querySelectorAll('[data-brand-name]');
  const brandName = APP_STATE.settings?.brandName || 'Caflat.CoPOS v1';

  brandTargets.forEach(target => {
    target.textContent = brandName;
  });

  const brandInput = document.getElementById('settingsBrandName');
  if (brandInput) brandInput.value = brandName;

  const taxInput = document.getElementById('settingsTaxRate');
  if (taxInput) taxInput.value = APP_STATE.settings?.taxRate || 0;

  const footerInput = document.getElementById('settingsReceiptFooter');
  if (footerInput) footerInput.value = APP_STATE.settings?.receiptFooter || '';
}

function loadDemoData() {
  const confirmed = confirm('Load demo data?');
  if (!confirmed) return;

  APP_STATE.products = [
    {
      id: generateId(),
      name: 'Classic Choco Chip',
      category: 'Cookies',
      description: 'Premium chocolate chip cookie',
      price: 65,
      stock: 25,
      reorderLevel: 5,
      variants: [],
      recipe: []
    },
    {
      id: generateId(),
      name: 'Dubai Chewy Cookie',
      category: 'Chewy Cookies',
      description: 'Premium pistachio chewy cookie',
      price: 140,
      stock: 15,
      reorderLevel: 5,
      variants: []
    }
  ];

  APP_STATE.ingredients = [
    {
      id: generateId(),
      name: 'Butter',
      unit: 'g',
      stock: 5000,
      reorderLevel: 1000,
      packageQuantity: 5000,
      packageCost: 1200,
      costPerUnit: 0.24
    },
    {
      id: generateId(),
      name: 'Chocolate Chips',
      unit: 'g',
      stock: 3000,
      reorderLevel: 500,
      packageQuantity: 3000,
      packageCost: 850,
      costPerUnit: 0.28
    }
  ];

  APP_STATE.sales = [];
  persistState();
  renderEverything();
  showNotification('Demo data loaded', 'success');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.getCategories = getCategories;
window.setCategories = setCategories;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.renderCategories = renderCategories;
window.renderCategoryOptions = renderCategoryOptions;
window.saveSettings = saveSettings;
window.renderBranding = renderBranding;
window.loadDemoData = loadDemoData;
