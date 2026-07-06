/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · LARDER   (real ingredients, real CRUD)
═══════════════════════════════════════════════════════════════ */
VIEWS.larder = function (root) {
  let ings = g2(() => getIngredients(), []);
  let editingId = null;

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Inventory · real stock</span><h2 style="margin-top:4px">Larder</h2>
      <p class="muted" style="margin-top:6px">Live stock against reorder level. Colour only where you need to act.</p></div>
      <button class="btn" id="larderAdd">Add ingredient</button></div>

    <div class="card pad" id="ingForm" style="border-radius:var(--r-xl);margin-bottom:var(--s6);display:none">
      <span class="eyebrow" id="ingFormTitle">New ingredient</span>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--s3);margin:var(--s3) 0">
        <input id="ingName" class="field" placeholder="Name">
        <input id="ingUnit" class="field" placeholder="Unit (kg, L, ea)">
        <select id="ingType" class="field">
          <option value="raw">Raw</option><option value="packaging">Packaging</option>
        </select>
        <input id="ingStock" type="number" step="any" min="0" class="field" placeholder="Stock">
        <input id="ingReorder" type="number" step="any" min="0" class="field" placeholder="Reorder level">
        <input id="ingPkgQty" type="number" step="any" min="0" class="field" placeholder="Package qty">
        <input id="ingPkgCost" type="number" step="any" min="0" class="field" placeholder="Package cost">
      </div>
      <div class="row gap2">
        <button class="btn" id="ingSave">Save</button>
        <button class="btn btn-ghost" id="ingCancel">Cancel</button>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))" id="larderGrid"></div>`;

  const globalThr = Number(APP_STATE.settings?.lowStockThreshold ?? 5);
  const form = root.querySelector('#ingForm');

  function openForm(ing) {
    editingId = ing ? ing.id : null;
    root.querySelector('#ingFormTitle').textContent = ing ? `Edit ${ing.name}` : 'New ingredient';
    root.querySelector('#ingName').value = ing?.name || '';
    root.querySelector('#ingUnit').value = ing?.unit || '';
    root.querySelector('#ingType').value = ing?.type || 'raw';
    root.querySelector('#ingStock').value = ing?.stock ?? '';
    root.querySelector('#ingReorder').value = ing?.reorderLevel ?? '';
    root.querySelector('#ingPkgQty').value = ing?.packageQuantity ?? '';
    root.querySelector('#ingPkgCost').value = ing?.packageCost ?? '';
    form.style.display = 'block';
    root.querySelector('#ingName').focus();
  }
  function closeForm() { form.style.display = 'none'; editingId = null; }

  root.querySelector('#larderAdd').addEventListener('click', () => openForm(null));
  root.querySelector('#ingCancel').addEventListener('click', closeForm);
  root.querySelector('#ingSave').addEventListener('click', () => {
    const result = ENGINE.saveIngredient({
      id: editingId, name: sanitizeText(root.querySelector('#ingName').value),
      unit: sanitizeText(root.querySelector('#ingUnit').value), type: root.querySelector('#ingType').value,
      stock: root.querySelector('#ingStock').value, reorderLevel: root.querySelector('#ingReorder').value,
      packageQuantity: root.querySelector('#ingPkgQty').value, packageCost: root.querySelector('#ingPkgCost').value,
    });
    if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
    M.toast(editingId ? 'Ingredient updated' : 'Ingredient added', result.ingredient.name, 'success');
    closeForm();
    ings = g2(() => getIngredients(), []);
    paint();
  });

  function paint() {
    const grid = root.querySelector('#larderGrid');
    if (!ings.length) {
      grid.innerHTML = `<div class="card pad" style="grid-column:1/-1;text-align:center;color:var(--ink-4);padding:var(--s7) 0">No ingredients yet — add one above.</div>`;
      return;
    }
    grid.innerHTML = ings.map((ing, i) => {
      const par = Number(ing.reorderLevel || 0) || globalThr;
      const stock = Number(ing.stock || 0);
      const ratio = par > 0 ? stock / par : (stock > 0 ? 2 : 0);
      const tone = ratio < .6 ? 'crit' : ratio < 1 ? 'warn' : 'live';
      return `<div class="card pad lift" style="border-radius:var(--r-lg);--i:${i}">
        <div class="row between"><span class="name" style="font-weight:640">${escapeHtml(ing.name)}</span>
          <span class="chip ${tone}" style="height:20px;font-size:9px"><span class="dot"></span>${tone === 'crit' ? 'Reorder' : tone === 'warn' ? 'Low' : 'Good'}</span></div>
        <div class="row" style="align-items:baseline;gap:6px;margin:var(--s3) 0 var(--s2)">
          <span class="num serif" style="font-size:1.8rem;font-weight:900;letter-spacing:-0.03em">${stock}</span>
          <span class="muted num" style="font-size:var(--t-sm)">/ ${par} ${escapeHtml(ing.unit || '')} reorder</span></div>
        <div class="meter ${tone}"><i style="width:${Math.min(100, ratio * 100)}%"></i></div>
        <div class="row gap2" style="margin-top:var(--s3)">
          <button class="btn btn-ghost btn-sm" data-edit="${ing.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del="${ing.id}" style="color:var(--crit)">Delete</button>
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(ings.find(i => i.id === b.dataset.edit))));
    grid.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteIngredient === 'function') deleteIngredient(b.dataset.del);
      ings = g2(() => getIngredients(), []);
      paint();
    }));
    requestAnimationFrame(() => M.stagger(grid, 40));
  }
  paint();
};
