function getIngredients() {
  return Array.isArray(APP_STATE.ingredients) ? APP_STATE.ingredients : [];
}

function setIngredients(ingredients) {
  updateState('ingredients', () => Array.isArray(ingredients) ? ingredients : []);
  renderIngredientsTable();
  renderIngredientDropdowns();
  renderInventoryTable();
  refreshDashboard();
}

function getIngredientFormData() {
  return {
    id: getElementValue('ingredientId') || generateId(),
    name: sanitizeText(getElementValue('ingredientName')),
    unit: sanitizeText(getElementValue('ingredientUnit')),
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
    ingredients[existingIndex] = data;
  } else {
    ingredients.push(data);
  }

  setIngredients(ingredients);
  closeModal('ingredientModal');
  clearIngredientForm();
  showNotification('Ingredient saved successfully', 'success');
}

function clearIngredientForm() {
  setElementValue('ingredientId', '');
  setElementValue('ingredientName', '');
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

  const ingredients = getIngredients();
  tableBody.innerHTML = '';

  if (!ingredients.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">No ingredients found</td>
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
      <td>${ingredient.packageQuantity}</td>
      <td>${formatCurrency(ingredient.packageCost)}</td>
      <td>${formatCurrency(ingredient.costPerUnit)}</td>
      <td>${ingredient.stock}</td>
      <td>${ingredient.reorderLevel}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn btn-sm" data-action="edit-ingredient" data-id="${ingredient.id}">Edit</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="delete-ingredient" data-id="${ingredient.id}">Delete</button>
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
