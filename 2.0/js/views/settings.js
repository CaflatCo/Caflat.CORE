/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · SETTINGS   (real business info, categories, payment methods)
═══════════════════════════════════════════════════════════════ */
VIEWS.settings = function (root) {
  const s = APP_STATE.settings || {};
  let cats = g2(() => getCategories(), []);
  let methods = g2(() => (APP_STATE.settings?.paymentMethods || []), []);
  let editingPmIndex = null;

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Settings · real business info</span><h2 style="margin-top:4px">Settings</h2>
      <p class="muted" style="margin-top:6px">The basics that shape every screen — brand, currency, tax, categories, and how customers pay.</p></div></div>

    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s6)">
      <span class="eyebrow">Business</span>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--s3);margin:var(--s3) 0">
        <input id="setBrand" class="field" placeholder="Business name" value="${escapeHtml(s.brandName || '')}">
        <select id="setCurrency" class="field">${Object.keys(CURRENCY_REGISTRY).map(code => `<option value="${code}" ${getActiveCurrencyCode() === code ? 'selected' : ''}>${code} — ${CURRENCY_REGISTRY[code].name}</option>`).join('')}</select>
        <input id="setTax" type="number" step="0.01" min="0" class="field" placeholder="Tax rate %" value="${s.taxRate ?? 0}">
        <input id="setLowStock" type="number" min="0" class="field" placeholder="Low-stock threshold" value="${s.lowStockThreshold ?? 5}">
      </div>
      <input id="setFooter" class="field" style="width:100%;margin-bottom:var(--s3)" placeholder="Receipt footer message" value="${escapeHtml(s.receiptFooter || '')}">
      <button class="btn" id="setSave">Save business info</button>
    </div>

    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s6)">
      <span class="eyebrow">Categories</span>
      <p class="muted" style="font-size:var(--t-xs);margin:4px 0 var(--s3)">Finished-goods categories track stock through Production instead of deducting ingredients at sale time.</p>
      <div class="row gap2 wrap" style="margin-bottom:var(--s3)">
        <input id="catName" class="field" placeholder="New category name" style="flex:1;min-width:160px">
        <select id="catMode" class="field"><option value="direct">Direct</option><option value="finished_goods">Finished Goods</option></select>
        <button class="btn btn-ghost btn-sm" id="catAddBtn">Add category</button>
      </div>
      <div class="stack gap2" id="catList"></div>
    </div>

    <div class="card pad" style="border-radius:var(--r-xl)">
      <div class="row between" style="margin-bottom:var(--s3)"><span class="eyebrow">Payment methods</span>
        <button class="btn btn-ghost btn-sm" id="pmAdd">Add method</button></div>
      <div class="card pad" id="pmForm" style="border-radius:var(--r-lg);background:var(--paper-2);margin-bottom:var(--s3);display:none">
        <div class="row gap2 wrap">
          <input id="pmName" class="field" placeholder="Method name (e.g. GCash)" style="flex:1;min-width:160px">
          <select id="pmType" class="field"><option value="cash">Cash</option><option value="qr">QR Code</option><option value="bank">Bank Transfer</option><option value="card">Card</option><option value="other">Other</option></select>
        </div>
        <div class="row gap2 wrap" id="pmBankFields" style="margin-top:var(--s2);display:none">
          <input id="pmBankName" class="field" placeholder="Bank name" style="flex:1;min-width:140px">
          <input id="pmAccountNumber" class="field" placeholder="Account number" style="width:160px">
        </div>
        <div class="row gap2" style="margin-top:var(--s3)"><button class="btn btn-sm" id="pmSave">Save</button><button class="btn btn-ghost btn-sm" id="pmCancel">Cancel</button></div>
      </div>
      <div class="stack gap2" id="pmList"></div>
    </div>`;

  root.querySelector('#setSave').addEventListener('click', () => {
    const result = ENGINE.saveSettings({
      brandName: sanitizeText(root.querySelector('#setBrand').value), currency: root.querySelector('#setCurrency').value,
      taxRate: root.querySelector('#setTax').value, lowStockThreshold: root.querySelector('#setLowStock').value,
      receiptFooter: sanitizeText(root.querySelector('#setFooter').value),
    });
    if (result.ok) M.toast('Settings saved', '', 'success');
  });

  function paintCategories() {
    const host = root.querySelector('#catList');
    host.innerHTML = cats.length ? cats.map(c => `
      <div class="lrow" style="padding:8px 0">
        <input class="field" data-rename="${c.id}" value="${escapeHtml(c.name)}" style="max-width:220px;height:34px">
        <span class="chip ${c.inventoryMode === 'finished_goods' ? 'warn' : ''}" style="height:26px;cursor:pointer" data-toggle-mode="${c.id}">
          <span class="dot"></span>${c.inventoryMode === 'finished_goods' ? 'Finished Goods' : 'Direct'}</span>
        <div class="grow"></div>
        <button class="btn btn-ghost btn-sm" data-del-cat="${c.id}" style="color:var(--crit)">Delete</button>
      </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm)">No categories yet.</p>`;
    host.querySelectorAll('[data-rename]').forEach(inp => inp.addEventListener('change', () => {
      if (typeof renameCategory === 'function') renameCategory(inp.dataset.rename, inp.value);
      cats = g2(() => getCategories(), []);
    }));
    host.querySelectorAll('[data-toggle-mode]').forEach(el => el.addEventListener('click', () => {
      if (typeof toggleCategoryMode === 'function') toggleCategoryMode(el.dataset.toggleMode);
      cats = g2(() => getCategories(), []);
      paintCategories();
    }));
    host.querySelectorAll('[data-del-cat]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteCategory === 'function') deleteCategory(b.dataset.delCat);
      cats = g2(() => getCategories(), []);
      paintCategories();
    }));
  }
  root.querySelector('#catAddBtn').addEventListener('click', () => {
    const result = ENGINE.addCategory(root.querySelector('#catName').value, root.querySelector('#catMode').value);
    if (!result.ok) { M.toast('Could not add category', result.error, 'crit'); return; }
    M.toast('Category added', '', 'success');
    root.querySelector('#catName').value = '';
    cats = g2(() => getCategories(), []);
    paintCategories();
  });

  const pmForm = root.querySelector('#pmForm');
  function openPmForm(idx) {
    editingPmIndex = idx != null ? idx : null;
    const m = idx != null ? methods[idx] : null;
    root.querySelector('#pmName').value = m?.name || '';
    root.querySelector('#pmType').value = m?.type || 'cash';
    root.querySelector('#pmBankName').value = m?.bankName || '';
    root.querySelector('#pmAccountNumber').value = m?.accountNumber || '';
    root.querySelector('#pmBankFields').style.display = (m?.type === 'bank') ? 'flex' : 'none';
    pmForm.style.display = 'block';
    root.querySelector('#pmName').focus();
  }
  root.querySelector('#pmAdd').addEventListener('click', () => openPmForm(null));
  root.querySelector('#pmCancel').addEventListener('click', () => { pmForm.style.display = 'none'; editingPmIndex = null; });
  root.querySelector('#pmType').addEventListener('change', (e) => { root.querySelector('#pmBankFields').style.display = e.target.value === 'bank' ? 'flex' : 'none'; });
  root.querySelector('#pmSave').addEventListener('click', () => {
    const result = ENGINE.savePaymentMethod({
      name: sanitizeText(root.querySelector('#pmName').value), type: root.querySelector('#pmType').value,
      bankName: sanitizeText(root.querySelector('#pmBankName').value), accountNumber: sanitizeText(root.querySelector('#pmAccountNumber').value),
    }, editingPmIndex);
    if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
    M.toast('Payment method saved', '', 'success');
    pmForm.style.display = 'none'; editingPmIndex = null;
    methods = g2(() => (APP_STATE.settings?.paymentMethods || []), []);
    paintMethods();
  });

  function paintMethods() {
    const host = root.querySelector('#pmList');
    const typeLabel = { cash: 'Cash', qr: 'QR Code', bank: 'Bank Transfer', card: 'Card', other: 'Other' };
    host.innerHTML = methods.length ? methods.map((m, i) => `
      <div class="lrow" style="padding:8px 0">
        <div class="grow"><div class="name" style="font-size:var(--t-sm)">${escapeHtml(m.name)}</div>
          <div class="sub">${typeLabel[m.type] || m.type}${m.type === 'bank' ? ` · ${escapeHtml(m.bankName || '')} ${escapeHtml(m.accountNumber || '')}` : ''}</div></div>
        <button class="btn btn-ghost btn-sm" data-edit-pm="${i}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-del-pm="${i}" style="color:var(--crit)">Delete</button>
      </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm)">No payment methods yet.</p>`;
    host.querySelectorAll('[data-edit-pm]').forEach(b => b.addEventListener('click', () => openPmForm(Number(b.dataset.editPm))));
    host.querySelectorAll('[data-del-pm]').forEach(b => b.addEventListener('click', () => {
      if (typeof deletePaymentMethod === 'function') deletePaymentMethod(Number(b.dataset.delPm));
      methods = g2(() => (APP_STATE.settings?.paymentMethods || []), []);
      paintMethods();
    }));
  }

  paintCategories(); paintMethods();
};
