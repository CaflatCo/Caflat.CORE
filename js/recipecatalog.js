/* ═══════════════════════════════════════════════════════
   RECIPECATALOG.JS — Recipe Catalog
   Standalone reference cookbook. No system connections
   (ingredients are free text, not linked to inventory).
   Fields: name, category, yield, tags, ingredients,
   steps (optional per recipe), notes.
   Included in backup. Survives reset.

   UI: an always-visible category-grouped card grid
   (#recipeCatalogList). Viewing and add/edit happen in
   modal overlays (#recipeDetailModal / #recipeFormModal),
   consistent with the Products / Ingredients CRUD.
═══════════════════════════════════════════════════════ */

const RC_CATEGORIES = ['Cookies', 'Filling', 'Coating', 'Dough', 'Sauce', 'Drink', 'Other'];
// Tags removed per user request

const _RC_EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const _RC_TRASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';

function getRecipeCatalog() {
  return Array.isArray(APP_STATE.recipeCatalog) ? APP_STATE.recipeCatalog : [];
}

function getRecipeById(id) {
  return getRecipeCatalog().find(r => String(r.id) === String(id)) || null;
}

/* ════════════════════════════════════════════════════════
   CATALOG VIEW — category-grouped card grid
════════════════════════════════════════════════════════ */

function _rcCardHtml(r) {
  const ingCount  = (r.ingredients || []).length;
  const stepCount = (r.steps || []).length;
  const meta = [];
  if (r.yieldAmt) meta.push(escapeHtml(r.yieldAmt));
  meta.push(`${ingCount} ingredient${ingCount !== 1 ? 's' : ''}`);
  if (r.showSteps && stepCount > 0) meta.push(`${stepCount} step${stepCount !== 1 ? 's' : ''}`);

  const id = escapeHtml(r.id);
  return `
    <div class="rc-card" data-action="open-recipe-detail" data-id="${id}">
      ${r.category ? `<span class="rc-chip">${escapeHtml(r.category)}</span>` : ''}
      <div class="rc-card-title">${escapeHtml(r.name)}</div>
      <div class="rc-card-meta">${meta.join(' · ')}</div>
      <div class="rc-card-actions">
        <button type="button" class="rc-icon-btn rc-edit" data-action="edit-recipe" data-id="${id}">${_RC_EDIT_ICON} Edit</button>
        <button type="button" class="rc-icon-btn rc-delete" data-action="delete-recipe" data-id="${id}">${_RC_TRASH_ICON} Delete</button>
      </div>
    </div>`;
}

function renderRecipeCatalog() {
  const container = document.getElementById('recipeCatalogList');
  if (!container) return;

  const search    = document.getElementById('recipeSearch')?.value?.toLowerCase() || '';
  const catFilter = document.getElementById('recipeCatFilter')?.value || 'All';
  let   recipes   = getRecipeCatalog();

  if (search)              recipes = recipes.filter(r => (r.name || '').toLowerCase().includes(search));
  if (catFilter !== 'All') recipes = recipes.filter(r => r.category === catFilter);

  if (!recipes.length) {
    container.innerHTML = `<div class="empty-state">
      ${getRecipeCatalog().length === 0
        ? 'No recipes yet — tap + New Recipe to add your first'
        : 'No recipes match your search'}
    </div>`;
    return;
  }

  // Group by category. Known categories keep RC_CATEGORIES order; any
  // other/blank category is bucketed under "Uncategorized" and sorted last.
  const byCat = {};
  recipes.forEach(r => {
    const key = RC_CATEGORIES.includes(r.category) ? r.category : (r.category || 'Uncategorized');
    (byCat[key] = byCat[key] || []).push(r);
  });

  const known   = RC_CATEGORIES.filter(c => byCat[c]);
  const extra   = Object.keys(byCat)
    .filter(c => !RC_CATEGORIES.includes(c) && c !== 'Uncategorized')
    .sort((a, b) => a.localeCompare(b));
  const ordered = known.concat(extra, byCat['Uncategorized'] ? ['Uncategorized'] : []);

  container.innerHTML = ordered.map(cat => {
    const list = byCat[cat].slice().sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="rc-cat-group">
        <div class="rc-cat-head">${escapeHtml(cat)}<span class="rc-cat-count">${list.length}</span></div>
        <div class="rc-grid">${list.map(_rcCardHtml).join('')}</div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════
   RECIPE DETAIL — modal overlay
════════════════════════════════════════════════════════ */

let _rcDetailId = '';

function openRecipeDetail(recipeId) {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return;
  _rcDetailId = String(recipe.id);

  const titleEl = document.getElementById('recipeDetailTitle');
  if (titleEl) titleEl.textContent = recipe.name;

  const container = document.getElementById('recipeDetailContent');
  if (container) {
    const pills = [];
    if (recipe.category)  pills.push(`<span class="rc-meta-pill">${escapeHtml(recipe.category)}</span>`);
    if (recipe.yieldAmt)  pills.push(`<span class="rc-meta-pill">Yield: ${escapeHtml(recipe.yieldAmt)}</span>`);
    if (recipe.updatedAt) pills.push(`<span class="rc-meta-pill">Updated ${new Date(recipe.updatedAt).toLocaleDateString()}</span>`);

    const ings  = recipe.ingredients || [];
    const steps = recipe.steps || [];
    const hasSteps = recipe.showSteps && steps.length > 0;

    container.innerHTML = `
      ${pills.length ? `<div class="rc-detail-meta">${pills.join('')}</div>` : ''}

      ${ings.length ? `
      <div class="rc-block">
        <div class="rc-block-label">Ingredients</div>
        <div class="rc-ing-list">
          ${ings.map(ing => `
            <div class="rc-ing-row">
              <span class="rc-ing-name">${escapeHtml(ing.name)}</span>
              <span class="rc-ing-amt">${escapeHtml(ing.qty || '')} ${escapeHtml(ing.unit || '')}${
                ing.note ? ` — ${escapeHtml(ing.note)}` : ''}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      ${hasSteps ? `
      <div class="rc-block">
        <div class="rc-block-label">Steps</div>
        ${steps.map((step, i) => `
          <div class="rc-step-row">
            <div class="rc-step-num">${i + 1}</div>
            <div class="rc-step-text">${escapeHtml(step.text || step)}</div>
          </div>`).join('')}
      </div>` : ''}

      ${recipe.notes ? `
      <div class="rc-block">
        <div class="rc-block-label">Notes</div>
        <div class="rc-notes">${escapeHtml(recipe.notes)}</div>
      </div>` : ''}

      ${(!ings.length && !hasSteps && !recipe.notes)
        ? `<div class="rc-empty-hint">No details yet — tap Edit Recipe to add ingredients, steps, or notes.</div>`
        : ''}`;
  }

  openModal('recipeDetailModal');
}

function closeRecipeDetail() {
  closeModal('recipeDetailModal');
}

function editCurrentRecipe() {
  if (_rcDetailId) openRecipeForm(_rcDetailId);
}

function deleteCurrentRecipe() {
  if (_rcDetailId) deleteRecipe(_rcDetailId);
}

/* ════════════════════════════════════════════════════════
   RECIPE FORM — add / edit (modal overlay)
════════════════════════════════════════════════════════ */

let _rcEditIngredients = [];
let _rcEditSteps       = [];

function openRecipeForm(recipeId = null) {
  const recipe = recipeId ? getRecipeById(recipeId) : null;

  const titleEl = document.getElementById('recipeFormTitle');
  if (titleEl) titleEl.textContent = recipe ? 'Edit Recipe' : 'New Recipe';

  setElementValue('rcFormId',       recipe?.id       || '');
  setElementValue('rcFormName',     recipe?.name     || '');
  setElementValue('rcFormCategory', recipe?.category || '');
  setElementValue('rcFormYield',    recipe?.yieldAmt || '');
  setElementValue('rcFormNotes',    recipe?.notes    || '');

  const stepsToggle = document.getElementById('rcFormShowSteps');
  if (stepsToggle) stepsToggle.checked = recipe?.showSteps !== false;

  _rcEditIngredients = (recipe?.ingredients || []).map(i => ({ ...i }));
  _rcEditSteps       = (recipe?.steps || []).map(s => ({ ...s }));

  _renderRCIngredients();
  _renderRCSteps();

  closeModal('recipeDetailModal');
  openModal('recipeFormModal');
}

function _renderRCIngredients() {
  const container = document.getElementById('rcIngredientRows');
  if (!container) return;

  if (!_rcEditIngredients.length) {
    container.innerHTML = `<div class="rc-empty-hint">No ingredients yet</div>`;
    return;
  }

  container.innerHTML = _rcEditIngredients.map((ing, i) => `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:6px;
      margin-bottom:6px;align-items:center;">
      <input type="text" value="${escapeHtml(ing.name || '')}" placeholder="Ingredient"
        style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);"
        oninput="_rcEditIngredients[${i}].name=this.value;" />
      <input type="text" value="${escapeHtml(ing.qty || '')}" placeholder="Qty"
        style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);"
        oninput="_rcEditIngredients[${i}].qty=this.value;" />
      <input type="text" value="${escapeHtml(ing.unit || '')}" placeholder="Unit"
        style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);"
        oninput="_rcEditIngredients[${i}].unit=this.value;" />
      <button type="button" style="background:none;border:none;cursor:pointer;
        color:var(--gray-400);font-size:14px;padding:4px;"
        onclick="_rcEditIngredients.splice(${i},1);_renderRCIngredients();">✕</button>
    </div>`).join('');
}

function _renderRCSteps() {
  const container = document.getElementById('rcStepRows');
  if (!container) return;

  const showSteps = document.getElementById('rcFormShowSteps')?.checked !== false;
  const wrapper   = document.getElementById('rcStepsSection');
  if (wrapper) wrapper.style.display = showSteps ? 'block' : 'none';

  if (!_rcEditSteps.length) {
    container.innerHTML = `<div class="rc-empty-hint">No steps yet</div>`;
    return;
  }

  container.innerHTML = _rcEditSteps.map((step, i) => `
    <div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--gray-200);
        font-size:10px;font-weight:900;display:flex;align-items:center;
        justify-content:center;flex-shrink:0;margin-top:5px;">${i + 1}</div>
      <textarea rows="2"
        style="flex:1;padding:6px 10px;border:1px solid var(--border);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);resize:vertical;"
        oninput="_rcEditSteps[${i}].text=this.value;">${escapeHtml(step.text || step)}</textarea>
      <button type="button" style="background:none;border:none;cursor:pointer;
        color:var(--gray-400);font-size:14px;padding:4px;margin-top:2px;"
        onclick="_rcEditSteps.splice(${i},1);_renderRCSteps();">✕</button>
    </div>`).join('');
}

function saveRecipeForm() {
  const id       = getElementValue('rcFormId') || generateId();
  const name     = sanitizeText(getElementValue('rcFormName'));
  const category = getElementValue('rcFormCategory');
  const yieldAmt = sanitizeText(getElementValue('rcFormYield'));
  const notes    = sanitizeText(getElementValue('rcFormNotes'));
  const showSteps= document.getElementById('rcFormShowSteps')?.checked !== false;
  const tags     = [];

  if (!name) { showNotification('Recipe name required', 'error'); return; }

  const catalog  = getRecipeCatalog();
  const existing = catalog.find(r => String(r.id) === String(id));
  const now      = new Date().toISOString();

  const recipe = {
    id, name, category, yieldAmt, notes, showSteps, tags,
    ingredients: _rcEditIngredients.filter(i => i.name),
    steps:       _rcEditSteps.filter(s => (s.text || s)),
    createdAt:   existing?.createdAt || now,
    updatedAt:   now
  };

  if (existing) Object.assign(existing, recipe);
  else catalog.push(recipe);

  updateState('recipeCatalog', () => catalog);
  closeModal('recipeFormModal');
  renderRecipeCatalog();
  showNotification(`Recipe "${name}" saved`, 'success');
}

function closeRecipeForm() {
  closeModal('recipeFormModal');
}

function deleteRecipe(recipeId) {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return;
  if (!confirm(`Delete "${recipe.name}"?`)) return;
  updateState('recipeCatalog', () => getRecipeCatalog().filter(r => String(r.id) !== String(recipeId)));
  closeModal('recipeFormModal');
  closeModal('recipeDetailModal');
  renderRecipeCatalog();
  showNotification('Recipe deleted', 'success');
}

function applyRecipeCatalogToggle() {
  // navRecipes is always visible in the sidebar; nothing to toggle
}

/* ── Exports ── */
window.getRecipeCatalog          = getRecipeCatalog;
window.getRecipeById             = getRecipeById;
window.renderRecipeCatalog       = renderRecipeCatalog;
window.openRecipeDetail          = openRecipeDetail;
window.closeRecipeDetail         = closeRecipeDetail;
window.editCurrentRecipe         = editCurrentRecipe;
window.deleteCurrentRecipe       = deleteCurrentRecipe;
window.openRecipeForm            = openRecipeForm;
window._renderRCIngredients      = _renderRCIngredients;
window._renderRCSteps            = _renderRCSteps;
window.saveRecipeForm            = saveRecipeForm;
window.closeRecipeForm           = closeRecipeForm;
window.deleteRecipe              = deleteRecipe;
window.applyRecipeCatalogToggle  = applyRecipeCatalogToggle;
window.RC_CATEGORIES             = RC_CATEGORIES;

window._rcEditIngredients        = _rcEditIngredients;
window._rcEditSteps              = _rcEditSteps;
