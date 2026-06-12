/* ═══════════════════════════════════════════════════════
   RECIPECATALOG.JS — Recipe Catalog
   Standalone reference. No system connections.
   Fields: name, category, yield, tags, ingredients,
   steps (optional per recipe), notes.
   Included in backup. Survives reset.
═══════════════════════════════════════════════════════ */

const RC_CATEGORIES = ['Cookies', 'Filling', 'Coating', 'Dough', 'Sauce', 'Drink', 'Other'];
const RC_TAGS       = ['Signature', 'Seasonal', 'In Progress', 'Retired', 'Bestseller', 'New'];

function getRecipeCatalog() {
  return Array.isArray(APP_STATE.recipeCatalog) ? APP_STATE.recipeCatalog : [];
}

function getRecipeById(id) {
  return getRecipeCatalog().find(r => r.id === id) || null;
}

/* ════════════════════════════════════════════════════════
   CATALOG VIEW — list of all recipes
════════════════════════════════════════════════════════ */

function renderRecipeCatalog() {
  const container = document.getElementById('recipeCatalogList');
  if (!container) return;

  const search   = document.getElementById('recipeSearch')?.value?.toLowerCase() || '';
  const catFilter= document.getElementById('recipeCatFilter')?.value || 'All';
  let   recipes  = getRecipeCatalog();

  if (search)           recipes = recipes.filter(r => r.name.toLowerCase().includes(search));
  if (catFilter !== 'All') recipes = recipes.filter(r => r.category === catFilter);
  recipes = recipes.slice().sort((a, b) => a.name.localeCompare(b.name));

  if (!recipes.length) {
    container.innerHTML = `<div class="empty-state" style="padding:32px 0;">
      ${getRecipeCatalog().length === 0
        ? 'No recipes yet — tap + New Recipe to add your first'
        : 'No recipes match your search'}
    </div>`;
    return;
  }

  container.innerHTML = recipes.map(r => {
    const tags = (r.tags || []).map(t =>
      `<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:999px;
        background:var(--gray-100);color:var(--gray-600);">${escapeHtml(t)}</span>`
    ).join(' ');
    const ingCount  = (r.ingredients || []).length;
    const stepCount = (r.steps || []).length;

    return `
      <div style="border:1.5px solid var(--gray-200);border-radius:14px;padding:14px 16px;
        margin-bottom:10px;background:var(--white);cursor:pointer;"
        onclick="openRecipeDetail('${r.id}')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:900;">${escapeHtml(r.name)}</div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:3px;">
              ${escapeHtml(r.category || '—')}
              ${r.yieldAmt ? ` · ${escapeHtml(r.yieldAmt)}` : ''}
              · ${ingCount} ingredient${ingCount !== 1 ? 's' : ''}
              ${r.showSteps && stepCount > 0 ? ` · ${stepCount} step${stepCount !== 1 ? 's' : ''}` : ''}
            </div>
            ${tags ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${tags}</div>` : ''}
          </div>
          <div style="font-size:18px;color:var(--gray-200);">›</div>
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════
   RECIPE DETAIL VIEW
════════════════════════════════════════════════════════ */

function openRecipeDetail(recipeId) {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return;

  const container = document.getElementById('recipeDetailContent');
  const titleEl   = document.getElementById('recipeDetailTitle');
  if (titleEl) titleEl.textContent = recipe.name;

  if (container) {
    const tags = (recipe.tags || []).map(t =>
      `<span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;
        background:var(--gray-100);color:var(--gray-600);">${escapeHtml(t)}</span>`
    ).join(' ');

    container.innerHTML = `
      <!-- Meta -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;
        font-size:12px;color:var(--gray-500);">
        ${recipe.category ? `<span><strong>Category:</strong> ${escapeHtml(recipe.category)}</span>` : ''}
        ${recipe.yieldAmt ? `<span><strong>Yield:</strong> ${escapeHtml(recipe.yieldAmt)}</span>` : ''}
        ${recipe.updatedAt ? `<span>Updated ${new Date(recipe.updatedAt).toLocaleDateString()}</span>` : ''}
      </div>
      ${tags ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px;">${tags}</div>` : ''}

      <!-- Ingredients -->
      ${(recipe.ingredients || []).length > 0 ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
          color:var(--gray-400);margin-bottom:8px;">Ingredients</div>
        <div style="border:1.5px solid var(--gray-200);border-radius:10px;overflow:hidden;">
          ${(recipe.ingredients || []).map((ing, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:9px 12px;${i > 0 ? 'border-top:1px solid var(--gray-100);' : ''}">
              <span style="font-size:12px;font-weight:700;">${escapeHtml(ing.name)}</span>
              <span style="font-size:12px;color:var(--gray-500);">
                ${escapeHtml(ing.qty || '')} ${escapeHtml(ing.unit || '')}
                ${ing.note ? `<span style="color:var(--gray-400);"> — ${escapeHtml(ing.note)}</span>` : ''}
              </span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Steps -->
      ${recipe.showSteps && (recipe.steps || []).length > 0 ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
          color:var(--gray-400);margin-bottom:8px;">Steps</div>
        ${(recipe.steps || []).map((step, i) => `
          <div style="display:flex;gap:12px;padding:10px 0;
            border-bottom:1px solid var(--gray-100);">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--black);
              color:white;font-size:10px;font-weight:900;display:flex;align-items:center;
              justify-content:center;flex-shrink:0;margin-top:1px;">${i + 1}</div>
            <div style="font-size:12px;line-height:1.5;">${escapeHtml(step.text || step)}</div>
          </div>`).join('')}
      </div>` : ''}

      <!-- Notes -->
      ${recipe.notes ? `
      <div style="background:var(--gray-50);border-radius:10px;padding:12px 14px;">
        <div style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
          color:var(--gray-400);margin-bottom:6px;">Notes</div>
        <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;">
          ${escapeHtml(recipe.notes)}</div>
      </div>` : ''}`;
  }

  // Switch to detail view
  document.getElementById('recipeCatalogListView').style.display = 'none';
  document.getElementById('recipeDetailView').style.display      = 'block';
  // Store current recipe id for edit/delete buttons
  const idInput = document.getElementById('rcCurrentRecipeId');
  if (idInput) idInput.value = recipeId;
}

function closeRecipeDetail() {
  document.getElementById('recipeCatalogListView').style.display = 'block';
  document.getElementById('recipeDetailView').style.display      = 'none';
}

/* ════════════════════════════════════════════════════════
   RECIPE FORM — add / edit
════════════════════════════════════════════════════════ */

let _rcEditIngredients = [];
let _rcEditSteps       = [];

function openRecipeForm(recipeId = null) {
  const recipe = recipeId ? getRecipeById(recipeId) : null;

  setElementValue('rcFormId',       recipe?.id       || '');
  setElementValue('rcFormName',     recipe?.name     || '');
  setElementValue('rcFormCategory', recipe?.category || '');
  setElementValue('rcFormYield',    recipe?.yieldAmt || '');
  setElementValue('rcFormNotes',    recipe?.notes    || '');

  // Tags
  document.querySelectorAll('.rc-tag-check').forEach(cb => {
    cb.checked = (recipe?.tags || []).includes(cb.value);
  });

  // Steps toggle
  const stepsToggle = document.getElementById('rcFormShowSteps');
  if (stepsToggle) stepsToggle.checked = recipe?.showSteps !== false;

  _rcEditIngredients = (recipe?.ingredients || []).map(i => ({ ...i }));
  _rcEditSteps       = (recipe?.steps || []).map(s => ({ ...s }));

  _renderRCIngredients();
  _renderRCSteps();

  document.getElementById('recipeCatalogListView').style.display = 'none';
  document.getElementById('recipeDetailView').style.display      = 'none';
  document.getElementById('recipeFormView').style.display        = 'block';
}

function _renderRCIngredients() {
  const container = document.getElementById('rcIngredientRows');
  if (!container) return;

  if (!_rcEditIngredients.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--gray-400);padding:8px 0;">
      No ingredients yet</div>`;
    return;
  }

  container.innerHTML = _rcEditIngredients.map((ing, i) => `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:6px;
      margin-bottom:6px;align-items:center;">
      <input type="text" value="${escapeHtml(ing.name || '')}" placeholder="Ingredient"
        style="padding:6px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);"
        oninput="_rcEditIngredients[${i}].name=this.value;" />
      <input type="text" value="${escapeHtml(ing.qty || '')}" placeholder="Qty"
        style="padding:6px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-md);
          font-size:12px;font-family:var(--font-main);"
        oninput="_rcEditIngredients[${i}].qty=this.value;" />
      <input type="text" value="${escapeHtml(ing.unit || '')}" placeholder="Unit/note"
        style="padding:6px 10px;border:1px solid var(--gray-200);border-radius:var(--radius-md);
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
    container.innerHTML = `<div style="font-size:12px;color:var(--gray-400);padding:4px 0;">
      No steps yet</div>`;
    return;
  }

  container.innerHTML = _rcEditSteps.map((step, i) => `
    <div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--gray-200);
        font-size:10px;font-weight:900;display:flex;align-items:center;
        justify-content:center;flex-shrink:0;margin-top:5px;">${i + 1}</div>
      <textarea rows="2"
        style="flex:1;padding:6px 10px;border:1px solid var(--gray-200);
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
  const tags     = [...document.querySelectorAll('.rc-tag-check:checked')].map(cb => cb.value);

  if (!name) { showNotification('Recipe name required', 'error'); return; }

  const catalog  = getRecipeCatalog();
  const existing = catalog.find(r => r.id === id);
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
  closeRecipeForm();
  renderRecipeCatalog();
  showNotification(`Recipe "${name}" saved`, 'success');
}

function closeRecipeForm() {
  document.getElementById('recipeFormView').style.display        = 'none';
  document.getElementById('recipeCatalogListView').style.display = 'block';
}

function deleteRecipe(recipeId) {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return;
  if (!confirm(`Delete "${recipe.name}"?`)) return;
  updateState('recipeCatalog', () => getRecipeCatalog().filter(r => r.id !== recipeId));
  closeRecipeDetail();
  renderRecipeCatalog();
  showNotification('Recipe deleted', 'success');
}

function applyRecipeCatalogToggle() {
  const enabled = APP_STATE.settings?.recipeCatalogEnabled === true;
  const btn     = document.getElementById('openRecipesBtn');
  if (btn) btn.style.display = enabled ? '' : 'none';
  if (!enabled && APP_STATE.ui?.currentView === 'recipes') {
    if (typeof switchPage === 'function') switchPage('products');
  }
}

/* ── Exports ── */
window.getRecipeCatalog          = getRecipeCatalog;
window.getRecipeById             = getRecipeById;
window.renderRecipeCatalog       = renderRecipeCatalog;
window.openRecipeDetail          = openRecipeDetail;
window.closeRecipeDetail         = closeRecipeDetail;
window.openRecipeForm            = openRecipeForm;
window._renderRCIngredients      = _renderRCIngredients;
window._renderRCSteps            = _renderRCSteps;
window.saveRecipeForm            = saveRecipeForm;
window.closeRecipeForm           = closeRecipeForm;
window.deleteRecipe              = deleteRecipe;
window.applyRecipeCatalogToggle  = applyRecipeCatalogToggle;
window.RC_CATEGORIES             = RC_CATEGORIES;
window.RC_TAGS                   = RC_TAGS;
window._rcEditIngredients        = _rcEditIngredients;
window._rcEditSteps              = _rcEditSteps;
