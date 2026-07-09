/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · SHOPPING LIST   (real reorder shortfalls)
═══════════════════════════════════════════════════════════════ */
VIEWS.shoppinglist = function (root) {
  let items = computeLowStock();
  let customName = '';
  let savedLists = g2(() => (typeof _getShoppingLists === 'function' ? _getShoppingLists() : (APP_STATE.shoppingLists || [])), []);

  function computeLowStock() {
    const ings = g2(() => getIngredients(), []);
    return ings.filter(ing => Number(ing.stock || 0) <= Number(ing.reorderLevel || 0)).map(ing => {
      const stock = Number(ing.stock || 0), reorder = Number(ing.reorderLevel || 0);
      const pkgQty = Number(ing.packageQuantity || 0), pkgCost = Number(ing.packageCost || 0);
      const hasPkgData = pkgQty > 1 && pkgCost > 0;
      const shortfall = Math.max(reorder - stock, 0);
      const packs = hasPkgData ? Math.max(1, Math.ceil(shortfall / pkgQty)) : null;
      return { id: ing.id, name: ing.name, unit: ing.unit || '', shortfall, onHand: stock,
        pkgQty, pkgCost, hasPkgData, packs, totalCost: hasPkgData ? packs * pkgCost : 0, checked: true };
    });
  }

  function paint() {
    const total = items.filter(i => i.checked).reduce((s, i) => s + Number(i.totalCost || 0), 0);
    root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Shopping List · real reorder shortfalls</span><h2 style="margin-top:4px">Shopping List</h2>
      <p class="muted" style="margin-top:6px">Ingredients at or below their reorder level, computed from real stock — check what you're buying and save the list.</p></div>
      <button class="btn btn-ghost" id="slRefresh">Refresh</button></div>

    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s5)">
      <div class="row between" style="margin-bottom:var(--s3)">
        <span class="eyebrow">Needs reorder</span>
        <span class="chip ${items.length ? 'warn' : 'live'}"><span class="dot"></span>${items.length}</span>
      </div>
      <div class="stack gap2" id="slList"></div>
      <div class="row between" style="margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--line)">
        <span class="eyebrow">Estimated total</span>
        <span class="num" style="font-weight:900;font-size:1.2rem" id="slTotal">${formatCurrency(total)}</span>
      </div>
      <div class="row gap2" style="margin-top:var(--s4)">
        <button class="btn" id="slSave" ${items.length ? '' : 'disabled'}>Save list</button>
      </div>
    </div>

    <div class="card pad" style="border-radius:var(--r-xl)">
      <span class="eyebrow">Saved lists</span>
      <div class="stack gap2" style="margin-top:var(--s3)" id="slSaved"></div>
    </div>`;

    paintItems();
    paintSaved();

    root.querySelector('#slRefresh').addEventListener('click', () => { items = computeLowStock(); paint(); });
    root.querySelector('#slSave').addEventListener('click', () => {
      const checkedItems = items.filter(i => i.checked);
      const result = ENGINE.saveShoppingList(checkedItems, 'lowstock');
      if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
      M.toast('Shopping list saved', '', 'success');
      savedLists = g2(() => (typeof _getShoppingLists === 'function' ? _getShoppingLists() : (APP_STATE.shoppingLists || [])), []);
      paintSaved();
    });
  }

  function paintItems() {
    const host = root.querySelector('#slList');
    host.innerHTML = items.length ? items.map((it, i) => `
      <div class="lrow" style="padding:8px 0">
        <input type="checkbox" data-chk="${i}" ${it.checked ? 'checked' : ''} style="width:18px;height:18px">
        <div class="grow"><div class="name">${escapeHtml(it.name)}</div>
          <div class="sub">${round2(it.onHand)} ${escapeHtml(it.unit)} on hand · need ${round2(it.shortfall)} ${escapeHtml(it.unit)}${it.hasPkgData ? ` · ${it.packs} pack${it.packs === 1 ? '' : 's'}` : ''}</div></div>
        <span class="num" style="font-weight:700">${it.hasPkgData ? formatCurrency(it.totalCost) : '—'}</span>
      </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">Everything's stocked above reorder level.</p>`;
    host.querySelectorAll('[data-chk]').forEach(cb => cb.addEventListener('change', () => {
      items[+cb.dataset.chk].checked = cb.checked;
      const total = items.filter(i => i.checked).reduce((s, i) => s + Number(i.totalCost || 0), 0);
      root.querySelector('#slTotal').textContent = formatCurrency(total);
    }));
  }

  function paintSaved() {
    const host = root.querySelector('#slSaved');
    const lists = [...savedLists].reverse();
    host.innerHTML = lists.length ? lists.map(l => `
      <div class="lrow" style="padding:8px 0">
        <div class="grow"><div class="name">${escapeHtml(l.name)}</div><div class="sub">${(l.items || []).length} item${(l.items || []).length === 1 ? '' : 's'}</div></div>
        <span class="num" style="font-weight:700">${formatCurrency(l.total)}</span>
      </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">No saved lists yet.</p>`;
  }

  paint();
};
