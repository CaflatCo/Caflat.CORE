function getIngredients() {
  return Array.isArray(APP_STATE.ingredients) ? APP_STATE.ingredients : [];
}

function setIngredients(ingredients) {
  updateState('ingredients', () => Array.isArray(ingredients) ? ingredients : []);
  if (typeof renderIngredientsTable === 'function') renderIngredientsTable();
  if (typeof renderIngredientDropdowns === 'function') renderIngredientDropdowns();
  if (typeof renderInventoryTable === 'function') renderInventoryTable();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

function getIngredientFormData() {
  return {
    id: getElementValue('ingredientId') || generateId(),
    name: sanitizeText(getElementValue('ingredientName')),
    unit: sanitizeText(getElementValue('ingredientUnit')),
    type: getElementValue('ingredientType') || 'raw',
    stock: safeNumber(getElementValue('ingredientStock')),
    reorderLevel: safeNumber(getElementValue('ingredientReorderLevel')),
    packageQuantity: safeNumber(getElementValue('ingredientPackageQty')),
    packageCost: safeNumber(getElementValue('ingredientPackageCost')),
    costPerUnit: calculateIngredientUnitCost(),
    createdAt: new Date().toISOString()
  };
}

function calculateIngredientUnitCost() {
  const packageQty = safeNumber(getElementValue('ingredientPackageQty'));
  const packageCost = safeNumber(getElementValue('ingredientPackageCost'));
  if (packageQty <= 0) return 0;
  return packageCost / packageQty;
}

function saveIngredient() {
  const data = getIngredientFormData();

  if (!data.name) {
    showNotification('Ingredient name is required', 'error');
    return;
  }

  const ingredients = getIngredients();
  const existingIndex = ingredients.findIndex(ingredient => String(ingredient.id) === String(data.id));

  if (existingIndex >= 0) {
    const prev = ingredients[existingIndex];
    // Log a movement if the stock value changed on edit
    if (typeof logInventoryAdjustment === 'function' &&
        Number(prev.stock || 0) !== Number(data.stock || 0)) {
      logInventoryAdjustment(data.id, Number(prev.stock || 0), Number(data.stock || 0),
        'Manual stock edit', 'manual-adjustment');
    }
    ingredients[existingIndex] = data;
  } else {
    // Log initial stock for new ingredient if non-zero
    if (Number(data.stock || 0) > 0) {
      if (typeof logInventoryAdjustment === 'function') {
        logInventoryAdjustment(data.id, 0, Number(data.stock || 0), 'Initial stock', 'manual-adjustment');
      }
    }
    ingredients.push(data);
  }

  setIngredients(ingredients);
  closeModal('ingredientModal');
  clearIngredientForm();
  showNotification('Ingredient saved successfully', 'success');

  // Refresh all product cost previews and tables since costPerUnit changed
  if (typeof renderProductsTable      === 'function') renderProductsTable();
  if (typeof renderProductCostPreview === 'function') renderProductCostPreview();
  if (typeof renderPOSProducts        === 'function') renderPOSProducts();
}

function clearIngredientForm() {
  setElementValue('ingredientId', '');
  setElementValue('ingredientName', '');
  setElementValue('ingredientType', 'raw');
  setElementValue('ingredientUnit', '');
  setElementValue('ingredientStock', '');
  setElementValue('ingredientReorderLevel', '');
  setElementValue('ingredientPackageQty', '');
  setElementValue('ingredientPackageCost', '');
}

function openIngredientModal(ingredientId = null) {
  clearIngredientForm();

  if (ingredientId) {
    const ingredient = getIngredients().find(item => String(item.id) === String(ingredientId));
    if (ingredient) hydrateIngredientForm(ingredient);
  }

  openModal('ingredientModal');
}

function hydrateIngredientForm(ingredient) {
  setElementValue('ingredientId', ingredient.id);
  setElementValue('ingredientName', ingredient.name);
  setElementValue('ingredientUnit', ingredient.unit);
  setElementValue('ingredientType', ingredient.type || 'raw');
  setElementValue('ingredientStock', ingredient.stock);
  setElementValue('ingredientReorderLevel', ingredient.reorderLevel);
  setElementValue('ingredientPackageQty', ingredient.packageQuantity);
  setElementValue('ingredientPackageCost', ingredient.packageCost);
}

function deleteIngredient(ingredientId) {
  const confirmed = confirm('Delete this ingredient?');
  if (!confirmed) return;

  const filtered = getIngredients().filter(ingredient => String(ingredient.id) !== String(ingredientId));
  setIngredients(filtered);
  showNotification('Ingredient deleted', 'success');
}

function renderIngredientsTable() {
  const tableBody = document.querySelector('#ingredientsTable tbody');
  if (!tableBody) return;

  const search   = String(document.getElementById('ingredientSearch')?.value || '').toLowerCase().trim();
  const typeFilter = String(document.getElementById('ingredientTypeFilter')?.value || 'all');
  let ingredients = getIngredients();

  if (typeFilter !== 'all') {
    ingredients = ingredients.filter(i => (i.type || 'raw') === typeFilter);
  }

  if (search) {
    ingredients = ingredients.filter(i =>
      (i.name || '').toLowerCase().includes(search) ||
      (i.unit || '').toLowerCase().includes(search) ||
      (i.category || '').toLowerCase().includes(search)
    );
  }

  tableBody.innerHTML = '';

  if (!ingredients.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">${search ? 'No ingredients match "' + escapeHtml(search) + '"' : 'No ingredients found'}</td>
      </tr>
    `;
    return;
  }

  ingredients.forEach(ingredient => {
    const lowStock = Number(ingredient.stock || 0) <= Number(ingredient.reorderLevel || 0);
    const row = document.createElement('tr');
    if (lowStock) row.classList.add('low-stock-row');

    row.innerHTML = `
      <td>${escapeHtml(ingredient.name)}</td>
      <td>${escapeHtml(ingredient.unit)}</td>
      <td style="font-size:11px;">
        <span style="padding:2px 8px;border-radius:var(--radius-full);font-weight:800;letter-spacing:.5px;
          background:${(ingredient.type||'raw')==='packaging'?'#f0f7ff':'#f5f5f5'};
          color:${(ingredient.type||'raw')==='packaging'?'#1d4ed8':'var(--gray-600)'};">
          ${(ingredient.type||'raw')==='packaging'?'Packaging':'Raw'}
        </span>
      </td>
      <td>${round2(ingredient.packageQuantity)}</td>
      <td>${formatCurrency(ingredient.packageCost)}</td>
      <td>${formatCurrency(ingredient.costPerUnit)}</td>
      <td>${round2(ingredient.stock)}</td>
      <td>${round2(ingredient.reorderLevel)}</td>
      <td>
        <div class="table-actions">
          ${!window._staffMode ? `<button type="button" class="btn btn-sm" data-action="edit-ingredient" data-id="${ingredient.id}">Edit</button>` : ''}
          ${!window._staffMode ? `<button type="button" class="btn btn-sm btn-secondary" data-action="delete-ingredient" data-id="${ingredient.id}">Delete</button>` : ''}
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function renderIngredientDropdowns() {
  const selects = document.querySelectorAll('.recipe-ingredient');
  const ingredients = getIngredients();

  selects.forEach(select => {
    const currentValue = select.value;
    select.innerHTML = `
      <option value="">Select Ingredient</option>
    `;

    ingredients.forEach(ingredient => {
      const option = document.createElement('option');
      option.value = ingredient.id;
      option.textContent = `${ingredient.name} (${ingredient.unit})`;
      if (String(currentValue) === String(ingredient.id)) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  });
}


window.getIngredients = getIngredients;
window.setIngredients = setIngredients;
window.saveIngredient = saveIngredient;
window.openIngredientModal = openIngredientModal;
window.deleteIngredient = deleteIngredient;
window.renderIngredientsTable = renderIngredientsTable;
window.renderIngredientDropdowns = renderIngredientDropdowns;
window.clearIngredientForm = clearIngredientForm;
