function getInventoryMovements() {
  return Array.isArray(APP_STATE.inventoryMovements) ? APP_STATE.inventoryMovements : [];
}

function setInventoryMovements(movements) {
  updateState('inventoryMovements', () => Array.isArray(movements) ? movements : []);
}

function ensureRestockModal() {
  if (document.getElementById('restockModal')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'restockModal';
  modal.innerHTML = `
    <div class="modal">
      <h3>Restock Ingredient</h3>
      <input type="hidden" id="restockIngredientId" />

      <div class="form-group">
        <label>Ingredient</label>
        <input type="text" id="restockIngredientName" readonly />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Current Stock</label>
          <input type="text" id="restockCurrentStock" readonly />
        </div>

        <div class="form-group">
          <label>Quantity to Add</label>
          <input type="number" id="restockQuantity" min="0" step="0.01" />
        </div>
      </div>

      <div class="form-group">
        <label>Reason / Note</label>
        <input type="text" id="restockReason" placeholder="e.g. Supplier delivery, correction" />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel-restock">Cancel</button>
        <button type="button" class="btn" data-action="save-restock">Save Restock</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function initializeInventory() {
  ensureRestockModal();
  renderInventoryTable();
  renderLowStockAlerts();
}

function openRestockModal(ingredientId) {
  ensureRestockModal();

  const ingredient = getIngredients().find(item => String(item.id) === String(ingredientId));
  if (!ingredient) {
    showNotification('Ingredient not found', 'error');
    return;
  }

  setElementValue('restockIngredientId', ingredient.id);
  setElementValue('restockIngredientName', ingredient.name);
  setElementValue('restockCurrentStock', `${ingredient.stock ?? 0} ${ingredient.unit || ''}`.trim());
  setElementValue('restockQuantity', '');
  setElementValue('restockReason', '');

  openModal('restockModal');
}

function saveRestockMovement() {
  const ingredientId = getElementValue('restockIngredientId');
  const quantity = safeNumber(getElementValue('restockQuantity'));
  const reason = sanitizeText(getElementValue('restockReason')) || 'Restock';

  if (!ingredientId) {
    showNotification('Ingredient not selected', 'error');
    return;
  }

  if (quantity <= 0) {
    showNotification('Quantity must be greater than zero', 'error');
    return;
  }

  const ingredients = getIngredients();
  const ingredientIndex = ingredients.findIndex(item => String(item.id) === String(ingredientId));

  if (ingredientIndex < 0) {
    showNotification('Ingredient not found', 'error');
    return;
  }

  const current = ingredients[ingredientIndex];
  const previousStock = Number(current.stock || 0);
  const newStock = previousStock + quantity;

  ingredients[ingredientIndex] = {
    ...current,
    stock: newStock
  };

  setIngredients(ingredients);

  const movements = getInventoryMovements();
  movements.push({
    id: generateId(),
    ingredientId: current.id,
    ingredientName: current.name,
    type: 'restock',
    quantityAdded: quantity,
    reason,
    previousStock,
    newStock,
    createdAt: new Date().toISOString(),
    createdBy: APP_STATE.currentUserRole || 'STAFF'
  });

  setInventoryMovements(movements);

  closeModal('restockModal');
  showNotification('Ingredient restocked', 'success');
  renderInventoryTable();
  renderLowStockAlerts();
}

function renderInventoryTable() {
  const tableBody = document.querySelector('#inventoryTable tbody');
  if (!tableBody) return;

  const ingredients = getIngredients();
  tableBody.innerHTML = '';

  if (!ingredients.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">No inventory found</td>
      </tr>
    `;
    return;
  }

  ingredients.forEach(ingredient => {
    const stock = Number(ingredient.stock || 0);
    const reorderLevel = Number(ingredient.reorderLevel || 0);
    const lowStock = stock <= reorderLevel;

    const row = document.createElement('tr');
    if (lowStock) row.classList.add('low-stock-row');

    row.innerHTML = `
      <td>${escapeHtml(ingredient.name)}</td>
      <td>${escapeHtml(ingredient.unit || '')}</td>
      <td>${ingredient.packageQuantity ?? 0}</td>
      <td>${formatCurrency(ingredient.packageCost ?? 0)}</td>
      <td>${stock}</td>
      <td>${reorderLevel}</td>
      <td>
        ${lowStock
          ? `<span class="badge-low-stock">Low Stock</span>`
          : `<span class="badge dark">OK</span>`
        }
      </td>
      <td>
        <div class="table-actions">
          <button
            type="button"
            class="btn btn-sm"
            data-action="restock-ingredient"
            data-id="${ingredient.id}">
            Restock
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function renderLowStockAlerts() {
  const container = document.getElementById('lowStockContainer');
  if (!container) return;

  const lowStockItems = getIngredients().filter(
    ingredient => Number(ingredient.stock || 0) <= Number(ingredient.reorderLevel || 0)
  );

  container.innerHTML = '';

  if (!lowStockItems.length) {
    container.innerHTML = `
      <div class="empty-state">
        No low stock alerts
      </div>
    `;
    return;
  }

  lowStockItems.forEach(ingredient => {
    const card = document.createElement('div');
    card.className = 'low-stock-card';
    card.innerHTML = `
      <div class="low-stock-name">${escapeHtml(ingredient.name)}</div>
      <div class="low-stock-meta">${ingredient.stock} ${escapeHtml(ingredient.unit || '')} left</div>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', initializeInventory);

window.getInventoryMovements = getInventoryMovements;
window.setInventoryMovements = setInventoryMovements;
window.ensureRestockModal = ensureRestockModal;
window.initializeInventory = initializeInventory;
window.openRestockModal = openRestockModal;
window.saveRestockMovement = saveRestockMovement;
window.renderInventoryTable = renderInventoryTable;
window.renderLowStockAlerts = renderLowStockAlerts;
