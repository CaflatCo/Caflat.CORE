/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · ORIGIN   (real green-coffee lot tracking)
═══════════════════════════════════════════════════════════════ */
VIEWS.origin = function (root) {
  let lots = g2(() => (Array.isArray(APP_STATE.originLots) ? APP_STATE.originLots : []), []);
  let editingId = null;

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Origin · real green-coffee lots</span><h2 style="margin-top:4px">Origin</h2>
      <p class="muted" style="margin-top:6px">Track every purchased lot — origin, farmer, quantity, and remaining stock.</p></div>
      <button class="btn" id="lotAdd">New lot</button></div>

    <div class="card pad" id="lotForm" style="border-radius:var(--r-xl);margin-bottom:var(--s5);display:none">
      <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s3)">
        <input id="lotProductName" class="field" placeholder="Product name (e.g. Ethiopia Yirgacheffe)">
        <input id="lotOrigin" class="field" placeholder="Origin / region">
        <input id="lotFarmer" class="field" placeholder="Farmer / supplier">
      </div>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s3)">
        <input id="lotQty" type="number" min="0" step="0.01" class="field" placeholder="Qty purchased">
        <input id="lotUnit" class="field" placeholder="Unit (kg)" value="kg">
        <input id="lotCost" type="number" min="0" step="0.01" class="field" placeholder="Purchase cost">
        <input id="lotProcessing" class="field" placeholder="Processing method">
      </div>
      <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s3)">
        <input id="lotPurchaseDate" type="date" class="field">
        <input id="lotHarvestDate" type="date" class="field">
        <select id="lotStatus" class="field"><option>Active</option><option>Depleted</option><option>Archived</option></select>
      </div>
      <input id="lotNotes" class="field" style="width:100%;margin-bottom:var(--s3)" placeholder="Notes">
      <div class="row gap2"><button class="btn btn-sm" id="lotSave">Save</button><button class="btn btn-ghost btn-sm" id="lotCancel">Cancel</button></div>
    </div>

    <div class="stack gap2" id="lotsList"></div>`;

  const lotForm = root.querySelector('#lotForm');
  function openForm(l) {
    editingId = l?.id || null;
    root.querySelector('#lotProductName').value = l?.productName || '';
    root.querySelector('#lotOrigin').value = l?.origin || '';
    root.querySelector('#lotFarmer').value = l?.farmer || '';
    root.querySelector('#lotQty').value = l?.qtyPurchased ?? '';
    root.querySelector('#lotUnit').value = l?.unit || 'kg';
    root.querySelector('#lotCost').value = l?.purchaseCost ?? '';
    root.querySelector('#lotProcessing').value = l?.processingMethod || '';
    root.querySelector('#lotPurchaseDate').value = l?.purchaseDate || '';
    root.querySelector('#lotHarvestDate').value = l?.harvestDate || '';
    root.querySelector('#lotStatus').value = l?.status || 'Active';
    root.querySelector('#lotNotes').value = l?.notes || '';
    lotForm.style.display = 'block';
    root.querySelector('#lotProductName').focus();
  }
  root.querySelector('#lotAdd').addEventListener('click', () => openForm(null));
  root.querySelector('#lotCancel').addEventListener('click', () => { lotForm.style.display = 'none'; editingId = null; });
  root.querySelector('#lotSave').addEventListener('click', () => {
    const result = ENGINE.saveOriginLot({
      productName: sanitizeText(root.querySelector('#lotProductName').value),
      origin: sanitizeText(root.querySelector('#lotOrigin').value),
      farmer: sanitizeText(root.querySelector('#lotFarmer').value),
      qtyPurchased: root.querySelector('#lotQty').value,
      unit: sanitizeText(root.querySelector('#lotUnit').value),
      purchaseCost: root.querySelector('#lotCost').value,
      processingMethod: sanitizeText(root.querySelector('#lotProcessing').value),
      purchaseDate: root.querySelector('#lotPurchaseDate').value,
      harvestDate: root.querySelector('#lotHarvestDate').value,
      status: root.querySelector('#lotStatus').value,
      notes: sanitizeText(root.querySelector('#lotNotes').value),
    }, editingId);
    if (!result.ok) { M.toast('Could not save lot', result.error, 'crit'); return; }
    M.toast('Lot saved', result.lotNumber, 'success');
    lotForm.style.display = 'none'; editingId = null;
    lots = g2(() => APP_STATE.originLots || [], []);
    paintList();
  });

  function paintList() {
    const host = root.querySelector('#lotsList');
    host.innerHTML = lots.length ? lots.slice().reverse().map(l => {
      const pctRemaining = l.qtyPurchased > 0 ? Math.round((l.qtyRemaining / l.qtyPurchased) * 100) : 0;
      const low = pctRemaining <= 20;
      return `<div class="card pad" style="border-radius:var(--r-lg)">
        <div class="row between">
          <div><div class="name">${escapeHtml(l.productName)} <span class="muted" style="font-weight:400">· ${escapeHtml(l.lotNumber)}</span></div>
            <div class="sub">${escapeHtml(l.origin || 'Unknown origin')}${l.farmer ? ' · ' + escapeHtml(l.farmer) : ''}${l.processingMethod ? ' · ' + escapeHtml(l.processingMethod) : ''}</div></div>
          <div class="row gap3" style="align-items:center">
            <div style="text-align:right"><div class="num" style="font-weight:800">${round2(l.qtyRemaining)} / ${round2(l.qtyPurchased)} ${escapeHtml(l.unit)}</div>
              <div class="muted" style="font-size:var(--t-xs)">${formatCurrency(l.purchaseCost)} total</div></div>
            <span class="chip ${l.status === 'Depleted' ? 'crit' : low ? 'warn' : 'live'}"><span class="dot"></span>${escapeHtml(l.status)}</span>
            <button class="btn btn-ghost btn-sm" data-edit="${l.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-del="${l.id}" style="color:var(--crit)">Delete</button>
          </div>
        </div>
        <div class="meter ${l.status === 'Depleted' ? 'crit' : low ? 'warn' : 'live'}" style="margin-top:var(--s3)"><i style="width:${Math.min(100, pctRemaining)}%"></i></div>
      </div>`;
    }).join('') : `<div class="card pad" style="text-align:center;color:var(--ink-4);padding:var(--s7) 0">No lots yet — record your first green-coffee purchase above.</div>`;

    host.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(lots.find(l => l.id === b.dataset.edit))));
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      ENGINE.deleteOriginLot(b.dataset.del);
      lots = g2(() => APP_STATE.originLots || [], []);
      paintList();
    }));
  }

  paintList();
};
