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
  if (typeof renderInventoryMovementLog === 'function') renderInventoryMovementLog();
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
  if (typeof renderInventoryMovementLog === 'function') renderInventoryMovementLog();
}

function renderInventoryTable() {
  const tableBody = document.querySelector('#inventoryTable tbody');
  if (!tableBody) return;

  const search     = String(document.getElementById('inventorySearch')?.value || '').toLowerCase().trim();
  const typeFilter = String(document.getElementById('inventoryTypeFilter')?.value || 'all');
  let ingredients  = getIngredients();

  if (typeFilter !== 'all') {
    ingredients = ingredients.filter(i => (i.type || 'raw') === typeFilter);
  }

  if (search) {
    ingredients = ingredients.filter(i =>
      (i.name || '').toLowerCase().includes(search) ||
      (i.unit || '').toLowerCase().includes(search)
    );
  }

  tableBody.innerHTML = '';

  if (!ingredients.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">${search ? 'No items match "' + escapeHtml(search) + '"' : 'No inventory found'}</td>
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
      <td style="font-size:11px;">
        <span style="padding:2px 8px;border-radius:var(--radius-full);font-weight:800;letter-spacing:.5px;
          background:${(ingredient.type||'raw')==='packaging'?'#f0f7ff':'#f5f5f5'};
          color:${(ingredient.type||'raw')==='packaging'?'#1d4ed8':'var(--gray-600)'};">
          ${(ingredient.type||'raw')==='packaging'?'Packaging':'Raw'}
        </span>
      </td>
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


document.addEventListener('DOMContentLoaded', initializeInventory);

window.getInventoryMovements = getInventoryMovements;
window.setInventoryMovements = setInventoryMovements;
window.ensureRestockModal = ensureRestockModal;
window.initializeInventory = initializeInventory;
window.openRestockModal = openRestockModal;
window.saveRestockMovement = saveRestockMovement;
window.renderInventoryTable = renderInventoryTable;
window.renderLowStockAlerts = renderLowStockAlerts;

/* ─────────────────────────────────────────────
   INVENTORY MOVEMENT LOG
   Renders the audit trail on the Inventory page
───────────────────────────────────────────── */

const MOVEMENT_TYPE_LABELS = {
  'restock':                    'Restock',
  'sale-deduction':             'Sale Deduction',
  'production':                 'Production',
  'production-cancel':          'Production Cancelled',
  'manual-adjustment':          'Manual Adjustment',
  'pending-cancel-restoration': 'Pending Cancel',
  'pending-cancel-restore':     'Pending Cancel',
  'supply-reservation':         'Reserved',
  'supply-delivery-deduction':  'Supply Delivered',
  'supply-stock-restored':      'Supply Restored',
  'supply-reservation-released':'Reservation Released',
  'void-restoration':           'Void Restored',
};

function _populateMovementLogIngredientFilter() {
  const sel = document.getElementById('movementLogIngredientFilter');
  if (!sel) return;
  const current = sel.value;
  const ingredients = getIngredients();
  sel.innerHTML = '<option value="">All Ingredients</option>';
  ingredients.sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(ing => {
    const opt = document.createElement('option');
    opt.value = ing.id;
    opt.textContent = ing.name;
    if (ing.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderInventoryMovementLog(limit) {
  _populateMovementLogIngredientFilter();

  const container = document.getElementById('inventoryMovementLog');
  if (!container) return;

  const ingFilter  = document.getElementById('movementLogIngredientFilter')?.value || '';
  const typeFilter = document.getElementById('movementLogTypeFilter')?.value || '';

  let movements = getInventoryMovements().slice().reverse();

  if (ingFilter) movements = movements.filter(m => String(m.ingredientId) === String(ingFilter));
  if (typeFilter) movements = movements.filter(m => m.type === typeFilter);

  if (!movements.length) {
    container.innerHTML = '<div class="empty-state" style="padding:24px 0;">No movements recorded yet.</div>';
    return;
  }

  const SHOW    = typeof limit === 'number' ? limit : 10;
  const total   = movements.length;
  const shown   = movements.slice(0, SHOW);
  const hasMore = total > SHOW;

  const rows = shown.map(m => {
    const qty      = Number(m.quantityAdded || 0) - Number(m.quantityUsed || 0);
    const isPos    = qty > 0;
    const isNeg    = qty < 0;
    const qtyLabel = isPos ? `+${qty.toFixed(2)}` : qty.toFixed(2);
    const qtyColor = isPos ? 'color:#15803d;' : isNeg ? 'color:var(--danger);' : 'color:var(--gray-400);';
    const typeLabel = MOVEMENT_TYPE_LABELS[m.type] || m.type || '—';
    const itemName  = (m.ingredientName || m.productName || m.description || '—').replace(/</g,'&lt;');

    let badgeBg, badgeColor;
    if (m.type === 'restock') {
      badgeBg = '#dcfce7'; badgeColor = '#15803d';
    } else if (m.type === 'sale-deduction') {
      badgeBg = '#fef3c7'; badgeColor = '#92400e';
    } else if (m.type && m.type.startsWith('supply-delivery')) {
      badgeBg = '#eff6ff'; badgeColor = '#1d4ed8';
    } else if (m.type && m.type.startsWith('supply-reservation')) {
      badgeBg = '#f0f9ff'; badgeColor = '#0369a1';
    } else if (m.type && m.type.startsWith('supply')) {
      badgeBg = '#eff6ff'; badgeColor = '#1d4ed8';
    } else if (m.type && m.type.startsWith('production')) {
      badgeBg = '#faf5ff'; badgeColor = '#7e22ce';
    } else if (m.type && (m.type.includes('void') || m.type.includes('cancel') || m.type.includes('restored') || m.type.includes('restoration'))) {
      badgeBg = '#fef2f2'; badgeColor = '#dc2626';
    } else {
      badgeBg = 'var(--gray-50)'; badgeColor = 'var(--gray-600)';
    }

    const date = m.createdAt ? new Date(m.createdAt).toLocaleString('en-PH', {
      month:'short', day:'numeric',
      hour:'numeric', minute:'2-digit', hour12:true
    }) : '—';

    return `
      <tr>
        <td style="font-size:11px;color:var(--gray-400);white-space:nowrap;">${date}</td>
        <td><span style="padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;
          white-space:nowrap;display:inline-block;
          background:${badgeBg};color:${badgeColor};">${typeLabel}</span></td>
        <td style="font-weight:700;">${itemName}</td>
        <td style="font-variant-numeric:tabular-nums;font-weight:800;${qtyColor}">${qty === 0 ? '—' : qtyLabel}</td>
        <td style="font-variant-numeric:tabular-nums;color:var(--gray-500);">${m.previousStock ?? '—'} → ${m.newStock ?? '—'}</td>
        <td style="color:var(--gray-400);font-size:11px;">${escapeHtml(m.reason || '—')}</td>
      </tr>`;
  }).join('');

  const btnStyle = `padding:7px 20px;border:1.5px solid var(--border);border-radius:var(--radius-full);
    background:var(--white);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-main);`;

  const footer = hasMore
    ? `<div style="text-align:center;padding:12px 0;">
        <button type="button" onclick="renderInventoryMovementLog(${SHOW + 20})" style="${btnStyle}">
          Show more <span style="color:var(--gray-400);font-weight:600;">(${total - SHOW} remaining)</span>
        </button>
       </div>`
    : SHOW > 10
      ? `<div style="text-align:center;padding:12px 0;">
          <button type="button" onclick="renderInventoryMovementLog(10)" style="${btnStyle}">
            Show less
          </button>
         </div>`
      : '';

  container.innerHTML = `
    <div class="table-wrapper">
      <table style="min-width:700px;">
        <thead><tr>
          <th>Date</th><th>Type</th><th>Item</th><th>Change</th>
          <th>Before → After</th><th>Reason</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${footer}
  `;
}
window.renderInventoryMovementLog = renderInventoryMovementLog;
