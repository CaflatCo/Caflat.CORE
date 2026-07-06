/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · CATALOG   (real products, real CRUD + recipes)
═══════════════════════════════════════════════════════════════ */
VIEWS.catalog = function (root) {
  let products = g2(() => getProducts(), []);
  const realIngredients = g2(() => getIngredients(), []);
  const cats = g2(() => getCategories(), []);
  let editingId = null;
  let recipeDraft = []; // [{ingredientId, name, quantity}]

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Catalog · real products</span><h2 style="margin-top:4px">Catalog</h2>
      <p class="muted" style="margin-top:6px">What you sell, what it costs to make, and what's in it — feeds Service, Foresight and Production.</p></div>
      <button class="btn" id="catAdd">Add product</button></div>

    <datalist id="catList">${cats.map(c => `<option value="${escapeHtml(c.name)}">`).join('')}</datalist>

    <div class="card pad" id="prodForm" style="border-radius:var(--r-xl);margin-bottom:var(--s6);display:none">
      <span class="eyebrow" id="prodFormTitle">New product</span>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--s3);margin:var(--s3) 0">
        <input id="pName" class="field" placeholder="Name">
        <input id="pCategory" class="field" list="catList" placeholder="Category">
        <input id="pPrice" type="number" step="0.01" min="0" class="field" placeholder="Price">
        <input id="pCost" type="number" step="0.01" min="0" class="field" placeholder="Cost">
        <input id="pStock" type="number" step="any" min="0" class="field" placeholder="Stock">
        <input id="pReorder" type="number" step="any" min="0" class="field" placeholder="Reorder level">
        <select id="pRecipeMode" class="field"><option value="unit">Per unit</option><option value="batch">Per batch</option></select>
        <input id="pBatchYield" type="number" min="1" class="field" placeholder="Batch yield" value="1">
      </div>
      <div style="margin-bottom:var(--s3)">
        <span class="eyebrow">Recipe</span>
        <div class="row gap2 wrap" style="margin:var(--s2) 0">
          <select id="pRecIng" class="field" style="max-width:220px">
            ${realIngredients.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('')}
          </select>
          <input id="pRecQty" type="number" step="any" min="0" class="field" style="width:110px" placeholder="Qty">
          <button class="btn btn-ghost btn-sm" id="pRecAdd">Add ingredient</button>
        </div>
        <div id="pRecipeList" class="stack gap2"></div>
      </div>
      <div class="row gap2">
        <button class="btn" id="pSave">Save</button>
        <button class="btn btn-ghost" id="pCancel">Cancel</button>
      </div>
    </div>

    <div class="stack gap2" id="catalogList"></div>`;

  const form = root.querySelector('#prodForm');

  function renderRecipeDraft() {
    const host = root.querySelector('#pRecipeList');
    host.innerHTML = recipeDraft.length ? recipeDraft.map((r, i) => `
      <div class="lrow" style="padding:6px 0">
        <div class="grow name" style="font-size:var(--t-sm)">${escapeHtml(r.name)}</div>
        <span class="num" style="font-weight:700">${r.quantity}</span>
        <button class="icon-btn" style="width:28px;height:28px" data-rmrec="${i}">×</button>
      </div>`).join('') : `<p class="muted" style="font-size:var(--t-xs);margin-top:4px">No ingredients — this product won't deduct stock on sale.</p>`;
    host.querySelectorAll('[data-rmrec]').forEach(b => b.addEventListener('click', () => { recipeDraft.splice(+b.dataset.rmrec, 1); renderRecipeDraft(); }));
  }

  function openForm(p) {
    editingId = p ? p.id : null;
    recipeDraft = p ? (p.recipe || []).map(r => ({ ingredientId: r.ingredientId, quantity: r.quantity, name: realIngredients.find(i => i.id === r.ingredientId)?.name || '?' })) : [];
    root.querySelector('#prodFormTitle').textContent = p ? `Edit ${p.name}` : 'New product';
    root.querySelector('#pName').value = p?.name || '';
    root.querySelector('#pCategory').value = p?.category || '';
    root.querySelector('#pPrice').value = p?.price ?? '';
    root.querySelector('#pCost').value = p?.cost ?? '';
    root.querySelector('#pStock').value = p?.stock ?? '';
    root.querySelector('#pReorder').value = p?.reorderLevel ?? '';
    root.querySelector('#pRecipeMode').value = p?.recipeMode || 'unit';
    root.querySelector('#pBatchYield').value = p?.batchYield || 1;
    renderRecipeDraft();
    form.style.display = 'block';
    root.querySelector('#pName').focus();
  }
  function closeForm() { form.style.display = 'none'; editingId = null; recipeDraft = []; }

  root.querySelector('#catAdd').addEventListener('click', () => openForm(null));
  root.querySelector('#pCancel').addEventListener('click', closeForm);
  root.querySelector('#pRecAdd').addEventListener('click', () => {
    const sel = root.querySelector('#pRecIng'), qty = Number(root.querySelector('#pRecQty').value || 0);
    if (!qty || qty <= 0 || !sel.value) return;
    const ing = realIngredients.find(i => i.id === sel.value);
    recipeDraft.push({ ingredientId: ing.id, quantity: qty, name: ing.name });
    root.querySelector('#pRecQty').value = '';
    renderRecipeDraft();
  });
  root.querySelector('#pSave').addEventListener('click', () => {
    const result = ENGINE.saveProduct({
      id: editingId, name: sanitizeText(root.querySelector('#pName').value), category: sanitizeText(root.querySelector('#pCategory').value),
      price: root.querySelector('#pPrice').value, cost: root.querySelector('#pCost').value,
      stock: root.querySelector('#pStock').value, reorderLevel: root.querySelector('#pReorder').value,
      recipeMode: root.querySelector('#pRecipeMode').value, batchYield: root.querySelector('#pBatchYield').value,
      recipe: recipeDraft.map(r => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
    });
    if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
    M.toast(editingId ? 'Product updated' : 'Product added', result.product.name, 'success');
    closeForm();
    products = g2(() => getProducts(), []);
    paint();
  });

  function paint() {
    const host = root.querySelector('#catalogList');
    if (!products.length) {
      host.innerHTML = `<div class="card pad" style="text-align:center;color:var(--ink-4);padding:var(--s7) 0">No products yet — add one above.</div>`;
      return;
    }
    host.innerHTML = products.map(p => {
      const stock = g2(() => (typeof getEffectiveStock === 'function' ? getEffectiveStock(p) : Number(p.stock || 0)), Number(p.stock || 0));
      return `<div class="card pad" style="border-radius:var(--r-lg);display:flex;align-items:center;gap:var(--s3)">
        <span class="pico xl">${prodIconFor(p.name, p.category)}</span>
        <div class="grow"><div class="name">${escapeHtml(p.name)}</div>
          <div class="sub">${escapeHtml(p.category)} · ${formatCurrency(p.price)} · ${(p.recipe || []).length} ingredient${(p.recipe || []).length === 1 ? '' : 's'}${p.stock < 900 ? ` · ${stock} in stock` : ''}</div></div>
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-del="${p.id}" style="color:var(--crit)">Delete</button>
      </div>`;
    }).join('');
    host.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(products.find(p => p.id === b.dataset.edit))));
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteProduct === 'function') deleteProduct(b.dataset.del);
      products = g2(() => getProducts(), []);
      paint();
    }));
  }
  paint();
};
