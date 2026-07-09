/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · RECIPES   (standalone recipe reference book)
═══════════════════════════════════════════════════════════════ */
VIEWS.recipes = function (root) {
  let catalog = g2(() => getRecipeCatalog(), []);
  let search = '';
  let catFilter = 'All';
  let openId = null;
  let draft = null; // { id, name, category, yieldAmt, notes, ingredients:[], steps:[] }

  function list() {
    let items = catalog.slice();
    if (search) items = items.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    if (catFilter !== 'All') items = items.filter(r => r.category === catFilter);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  function paint() {
    const items = list();
    root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Recipes · reference book</span><h2 style="margin-top:4px">Recipes</h2>
      <p class="muted" style="margin-top:6px">A standalone recipe reference — not tied to stock or products. Write it down once, keep it forever.</p></div>
      <button class="btn" id="rcNewBtn">New recipe</button></div>

    <div class="row gap2 wrap" style="margin-bottom:var(--s5)">
      <input id="rcSearch" class="field" placeholder="Search recipes…" style="flex:1;min-width:200px" value="${escapeHtml(search)}">
      <select id="rcCatFilter" class="field" style="width:160px">
        <option ${catFilter === 'All' ? 'selected' : ''}>All</option>
        ${RC_CATEGORIES.map(c => `<option ${catFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>

    <div id="rcGrid" class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--s4)"></div>

    <div id="rcDetailWrap"></div>
    <div id="rcFormWrap"></div>`;

    paintGrid();

    root.querySelector('#rcNewBtn').addEventListener('click', () => { openForm(null); });
    root.querySelector('#rcSearch').addEventListener('input', e => { search = e.target.value; paintGrid(); });
    root.querySelector('#rcCatFilter').addEventListener('change', e => { catFilter = e.target.value; paintGrid(); });
  }

  function paintGrid() {
    const items = list();
    const grid = root.querySelector('#rcGrid');
    grid.innerHTML = items.length ? items.map(r => `
      <div class="card pad lift" style="border-radius:var(--r-lg);cursor:pointer" data-open="${r.id}">
        <div class="name" style="font-weight:700">${escapeHtml(r.name)}</div>
        <div class="sub" style="margin-top:4px">${escapeHtml(r.category || '—')}${r.yieldAmt ? ` · ${escapeHtml(r.yieldAmt)}` : ''} · ${(r.ingredients || []).length} ingredient${(r.ingredients || []).length === 1 ? '' : 's'}</div>
      </div>`).join('') : `<div class="card pad" style="text-align:center;color:var(--ink-4);grid-column:1/-1">${catalog.length ? 'No recipes match your search.' : 'No recipes yet — add your first.'}</div>`;
    grid.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openDetail(el.dataset.open)));
  }

  function openDetail(id) {
    const r = catalog.find(x => x.id === id);
    if (!r) return;
    root.querySelector('#rcGrid').style.display = 'none';
    root.querySelector('#rcDetailWrap').innerHTML = `
      <div class="card pad" style="border-radius:var(--r-xl)">
        <div class="row between" style="margin-bottom:var(--s4)">
          <div><h3>${escapeHtml(r.name)}</h3>
            <p class="muted" style="font-size:var(--t-sm);margin-top:4px">${escapeHtml(r.category || '—')}${r.yieldAmt ? ` · Yield: ${escapeHtml(r.yieldAmt)}` : ''}</p></div>
          <div class="row gap2">
            <button class="btn btn-ghost btn-sm" id="rcEditBtn">Edit</button>
            <button class="btn btn-ghost btn-sm" id="rcDelBtn" style="color:var(--crit)">Delete</button>
            <button class="btn btn-ghost btn-sm" id="rcBackBtn">Close</button>
          </div>
        </div>
        ${(r.ingredients || []).length ? `
        <span class="eyebrow">Ingredients</span>
        <div class="stack" style="margin:var(--s2) 0 var(--s4)">
          ${r.ingredients.map(i => `<div class="lrow" style="padding:6px 0"><span class="grow name">${escapeHtml(i.name)}</span><span class="muted num">${escapeHtml(i.qty || '')} ${escapeHtml(i.unit || '')}</span></div>`).join('')}
        </div>` : ''}
        ${r.showSteps && (r.steps || []).length ? `
        <span class="eyebrow">Steps</span>
        <div class="stack" style="margin:var(--s2) 0 var(--s4)">
          ${r.steps.map((s, i) => `<div class="row gap2" style="padding:6px 0;align-items:flex-start"><span class="chip" style="height:22px;flex-shrink:0">${i + 1}</span><span>${escapeHtml(s.text || s)}</span></div>`).join('')}
        </div>` : ''}
        ${r.notes ? `<span class="eyebrow">Notes</span><p style="margin-top:var(--s2);white-space:pre-wrap">${escapeHtml(r.notes)}</p>` : ''}
      </div>`;
    root.querySelector('#rcBackBtn').addEventListener('click', () => { root.querySelector('#rcGrid').style.display = ''; root.querySelector('#rcDetailWrap').innerHTML = ''; });
    root.querySelector('#rcEditBtn').addEventListener('click', () => { root.querySelector('#rcDetailWrap').innerHTML = ''; root.querySelector('#rcGrid').style.display = ''; openForm(r.id); });
    root.querySelector('#rcDelBtn').addEventListener('click', () => {
      ENGINE.deleteRecipe(r.id);
      catalog = g2(() => getRecipeCatalog(), []);
      root.querySelector('#rcDetailWrap').innerHTML = '';
      root.querySelector('#rcGrid').style.display = '';
      paintGrid();
    });
  }

  function openForm(id) {
    const r = id ? catalog.find(x => x.id === id) : null;
    draft = { id: r?.id || null, name: r?.name || '', category: r?.category || '', yieldAmt: r?.yieldAmt || '',
      notes: r?.notes || '', showSteps: r?.showSteps !== false,
      ingredients: (r?.ingredients || []).map(i => ({ ...i })), steps: (r?.steps || []).map(s => ({ text: s.text || s })) };

    root.querySelector('#rcGrid').style.display = 'none';
    root.querySelector('#rcFormWrap').innerHTML = `
      <div class="card pad" style="border-radius:var(--r-xl)">
        <h3 style="margin-bottom:var(--s4)">${id ? 'Edit recipe' : 'New recipe'}</h3>
        <div class="grid" style="grid-template-columns:2fr 1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
          <input id="rfName" class="field" placeholder="Recipe name" value="${escapeHtml(draft.name)}">
          <select id="rfCategory" class="field"><option value="">Category</option>${RC_CATEGORIES.map(c => `<option ${draft.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <input id="rfYield" class="field" placeholder="Yield (e.g. 12 pcs)" value="${escapeHtml(draft.yieldAmt)}">
        </div>

        <span class="eyebrow">Ingredients</span>
        <div id="rfIngList" class="stack" style="margin:var(--s2) 0 var(--s2)"></div>
        <div class="row gap2" style="margin-bottom:var(--s4)">
          <input id="rfIngName" class="field" placeholder="Ingredient" style="flex:2">
          <input id="rfIngQty" class="field" placeholder="Qty" style="flex:1">
          <input id="rfIngUnit" class="field" placeholder="Unit" style="flex:1">
          <button class="btn btn-ghost btn-sm" id="rfIngAdd">Add</button>
        </div>

        <span class="eyebrow">Steps</span>
        <div id="rfStepList" class="stack" style="margin:var(--s2) 0 var(--s2)"></div>
        <div class="row gap2" style="margin-bottom:var(--s4)">
          <input id="rfStepText" class="field" placeholder="Step description" style="flex:1">
          <button class="btn btn-ghost btn-sm" id="rfStepAdd">Add</button>
        </div>

        <textarea id="rfNotes" class="field" style="width:100%;min-height:80px;margin-bottom:var(--s4)" placeholder="Notes">${escapeHtml(draft.notes)}</textarea>

        <div class="row gap2">
          <button class="btn" id="rfSave">${id ? 'Save changes' : 'Create recipe'}</button>
          <button class="btn btn-ghost" id="rfCancel">Cancel</button>
        </div>
      </div>`;

    function paintIng() {
      const host = root.querySelector('#rfIngList');
      host.innerHTML = draft.ingredients.length ? draft.ingredients.map((i, idx) => `
        <div class="lrow" style="padding:4px 0"><span class="grow">${escapeHtml(i.name)}</span><span class="muted num">${escapeHtml(i.qty || '')} ${escapeHtml(i.unit || '')}</span>
          <button class="icon-btn" style="width:24px;height:24px" data-rmi="${idx}">×</button></div>`).join('') : `<p class="muted" style="font-size:var(--t-xs)">No ingredients yet.</p>`;
      host.querySelectorAll('[data-rmi]').forEach(b => b.addEventListener('click', () => { draft.ingredients.splice(+b.dataset.rmi, 1); paintIng(); }));
    }
    function paintSteps() {
      const host = root.querySelector('#rfStepList');
      host.innerHTML = draft.steps.length ? draft.steps.map((s, idx) => `
        <div class="row gap2" style="padding:4px 0;align-items:flex-start"><span class="chip" style="height:22px;flex-shrink:0">${idx + 1}</span><span class="grow">${escapeHtml(s.text)}</span>
          <button class="icon-btn" style="width:24px;height:24px" data-rms="${idx}">×</button></div>`).join('') : `<p class="muted" style="font-size:var(--t-xs)">No steps yet.</p>`;
      host.querySelectorAll('[data-rms]').forEach(b => b.addEventListener('click', () => { draft.steps.splice(+b.dataset.rms, 1); paintSteps(); }));
    }
    paintIng(); paintSteps();

    root.querySelector('#rfIngAdd').addEventListener('click', () => {
      const name = sanitizeText(root.querySelector('#rfIngName').value);
      if (!name) return;
      draft.ingredients.push({ name, qty: root.querySelector('#rfIngQty').value, unit: sanitizeText(root.querySelector('#rfIngUnit').value) });
      root.querySelector('#rfIngName').value = ''; root.querySelector('#rfIngQty').value = ''; root.querySelector('#rfIngUnit').value = '';
      paintIng();
    });
    root.querySelector('#rfStepAdd').addEventListener('click', () => {
      const text = sanitizeText(root.querySelector('#rfStepText').value);
      if (!text) return;
      draft.steps.push({ text });
      root.querySelector('#rfStepText').value = '';
      paintSteps();
    });
    root.querySelector('#rfCancel').addEventListener('click', () => { root.querySelector('#rcFormWrap').innerHTML = ''; root.querySelector('#rcGrid').style.display = ''; });
    root.querySelector('#rfSave').addEventListener('click', () => {
      const result = ENGINE.saveRecipe({
        name: sanitizeText(root.querySelector('#rfName').value), category: root.querySelector('#rfCategory').value,
        yieldAmt: sanitizeText(root.querySelector('#rfYield').value), notes: sanitizeText(root.querySelector('#rfNotes').value),
        showSteps: true, ingredients: draft.ingredients, steps: draft.steps,
      }, draft.id);
      if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
      M.toast('Recipe saved', '', 'success');
      catalog = g2(() => getRecipeCatalog(), []);
      root.querySelector('#rcFormWrap').innerHTML = '';
      root.querySelector('#rcGrid').style.display = '';
      paintGrid();
    });
  }

  paint();
};
