/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · SUPPLY   (real B2B orders, real clients, real state machine)
═══════════════════════════════════════════════════════════════ */
const SUPPLY_SEQ = ['DRAFTED', 'ORDERED', 'DELIVERED', 'INVOICED', 'PAID'];
const nextSupplyStatus = (s) => { const i = SUPPLY_SEQ.indexOf(s); return i >= 0 && i < SUPPLY_SEQ.length - 1 ? SUPPLY_SEQ[i + 1] : null; };
const SUPPLY_TONE = { DRAFTED: '', ORDERED: 'warn', DELIVERED: 'warn', INVOICED: 'warn', PAID: 'live', CANCELLED: 'crit', VOIDED: 'crit' };

VIEWS.supply = function (root) {
  const realProducts = g2(() => getProducts(), []);
  let clients = g2(() => getSupplierClients(), []);
  let draft = []; // order line draft: [{productId, name, qty, unitPrice}]
  let editingClientId = null;

  if (!realProducts.length) {
    emptyState(root, 'No products yet', `Supply orders are built from your real product catalog — add products first.`, UI_ICON.box);
    return;
  }

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Supply · real B2B orders</span><h2 style="margin-top:4px">Supply</h2>
      <p class="muted" style="margin-top:6px">Wholesale orders for your clients — reserving and deducting the exact same real stock as everything else.</p></div></div>

    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s5)">
      <div class="row between" style="margin-bottom:var(--s3)"><span class="eyebrow">Clients</span>
        <button class="btn btn-ghost btn-sm" id="clAdd">Add client</button></div>
      <div class="card pad" id="clForm" style="border-radius:var(--r-lg);background:var(--paper-2);margin-bottom:var(--s3);display:none">
        <div class="row gap2 wrap">
          <input id="clName" class="field" placeholder="Client name" style="flex:1;min-width:160px">
          <input id="clContact" class="field" placeholder="Contact" style="width:160px">
          <input id="clEmail" class="field" placeholder="Email" style="width:180px">
        </div>
        <div class="row gap2" style="margin-top:var(--s2)"><button class="btn btn-sm" id="clSave">Save</button><button class="btn btn-ghost btn-sm" id="clCancel">Cancel</button></div>
      </div>
      <div class="stack gap2" id="clientsList"></div>
    </div>

    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s6)">
      <span class="eyebrow">New order</span>
      <div class="row gap3 wrap" style="margin:var(--s3) 0">
        <select id="ordClient" class="field" style="min-width:180px">${clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        <input id="ordDate" type="date" class="field" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="row gap2 wrap" style="margin-bottom:var(--s2)">
        <select id="ordProduct" class="field" style="min-width:200px">${realProducts.map(p => `<option value="${p.id}" data-price="${p.price}">${escapeHtml(p.name)}</option>`).join('')}</select>
        <input id="ordQty" type="number" min="1" value="1" class="field" style="width:90px">
        <input id="ordPrice" type="number" step="0.01" min="0" class="field" placeholder="Unit price" style="width:120px">
        <button class="btn btn-ghost btn-sm" id="ordAddLine">Add line</button>
      </div>
      <div id="ordLines" class="stack gap2" style="margin-bottom:var(--s3)"></div>
      <button class="btn" id="ordCreate" disabled>Create order</button>
    </div>

    <span class="eyebrow">Orders</span>
    <div class="stack gap2" id="ordersList" style="margin-top:var(--s3)"></div>`;

  const clForm = root.querySelector('#clForm');
  function openClForm(c) {
    editingClientId = c ? c.id : null;
    root.querySelector('#clName').value = c?.name || ''; root.querySelector('#clContact').value = c?.contact || ''; root.querySelector('#clEmail').value = c?.email || '';
    clForm.style.display = 'block'; root.querySelector('#clName').focus();
  }
  root.querySelector('#clAdd').addEventListener('click', () => openClForm(null));
  root.querySelector('#clCancel').addEventListener('click', () => { clForm.style.display = 'none'; editingClientId = null; });
  root.querySelector('#clSave').addEventListener('click', () => {
    const result = ENGINE.saveSupplierClient({
      id: editingClientId, name: sanitizeText(root.querySelector('#clName').value),
      contact: sanitizeText(root.querySelector('#clContact').value), email: sanitizeText(root.querySelector('#clEmail').value),
    });
    if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
    M.toast('Client saved', '', 'success');
    clForm.style.display = 'none'; editingClientId = null;
    clients = g2(() => getSupplierClients(), []);
    paintClients(); paintClientSelect();
  });

  function paintClients() {
    const host = root.querySelector('#clientsList');
    host.innerHTML = clients.length ? clients.map(c => `
      <div class="lrow" style="padding:8px 0">
        <div class="grow"><div class="name" style="font-size:var(--t-sm)">${escapeHtml(c.name)}</div>
          <div class="sub">${[c.contact, c.email].filter(Boolean).map(escapeHtml).join(' · ') || 'No contact info'}</div></div>
        <button class="btn btn-ghost btn-sm" data-edit-cl="${c.id}">Edit</button>
        <button class="btn btn-ghost btn-sm" data-del-cl="${c.id}" style="color:var(--crit)">Delete</button>
      </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm)">No clients yet — add one to create orders.</p>`;
    host.querySelectorAll('[data-edit-cl]').forEach(b => b.addEventListener('click', () => openClForm(clients.find(c => c.id === b.dataset.editCl))));
    host.querySelectorAll('[data-del-cl]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteSupplierClient === 'function') deleteSupplierClient(b.dataset.delCl);
      clients = g2(() => getSupplierClients(), []);
      paintClients(); paintClientSelect();
    }));
  }
  function paintClientSelect() { root.querySelector('#ordClient').innerHTML = clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join(''); }

  root.querySelector('#ordProduct').addEventListener('change', (e) => {
    const price = e.target.options[e.target.selectedIndex]?.dataset.price;
    if (price) root.querySelector('#ordPrice').value = price;
  });
  function renderDraft() {
    const host = root.querySelector('#ordLines');
    host.innerHTML = draft.map((l, i) => `
      <div class="lrow" style="padding:6px 0"><span class="pico">${prodIconFor(l.name)}</span>
        <div class="grow name" style="font-size:var(--t-sm)">${escapeHtml(l.name)}</div>
        <span class="num muted">${l.qty} × ${formatCurrency(l.unitPrice)}</span>
        <span class="num" style="font-weight:700;min-width:70px;text-align:right">${formatCurrency(l.qty * l.unitPrice)}</span>
        <button class="icon-btn" style="width:28px;height:28px" data-rmline="${i}">×</button></div>`).join('');
    host.querySelectorAll('[data-rmline]').forEach(b => b.addEventListener('click', () => { draft.splice(+b.dataset.rmline, 1); renderDraft(); }));
    root.querySelector('#ordCreate').disabled = !draft.length;
  }
  root.querySelector('#ordAddLine').addEventListener('click', () => {
    const sel = root.querySelector('#ordProduct'), qty = Number(root.querySelector('#ordQty').value || 0), price = Number(root.querySelector('#ordPrice').value || 0);
    if (!qty || qty <= 0) return;
    const p = realProducts.find(x => x.id === sel.value);
    draft.push({ productId: p.id, name: p.name, qty, unitPrice: price || p.price });
    renderDraft();
  });
  root.querySelector('#ordCreate').addEventListener('click', () => {
    const result = ENGINE.createSupplyOrder({
      clientId: root.querySelector('#ordClient').value, orderDate: root.querySelector('#ordDate').value,
      items: draft.map(l => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
    });
    if (!result.ok) { M.toast('Could not create order', result.error, 'crit'); return; }
    M.toast('Order created', result.order.invoiceNumber, 'success');
    draft = []; renderDraft();
    paintOrders();
  });

  function openSupplyCheckout(o) {
    const realMethods = g2(() => (APP_STATE.settings?.paymentMethods || []), []);
    const methods = realMethods.length ? realMethods : [{ name: 'Cash', type: 'cash' }];
    let method = methods[0];

    const s = M.sheet(`
      <span class="eyebrow">Checkout · ${escapeHtml(o.invoiceNumber)}</span>
      <h3 style="margin:6px 0 var(--s4)">${escapeHtml(o.clientName)}</h3>
      <div class="stack gap2" style="margin-bottom:var(--s4)">
        ${(o.items || []).map(l => `<div class="row between" style="padding:4px 0;font-size:var(--t-sm)">
          <span class="grow">${escapeHtml(l.productName || l.description || '')} × ${round2(l.qty)}</span>
          <span class="num" style="font-weight:700">${formatCurrency(l.qty * l.unitPrice)}</span>
        </div>`).join('')}
      </div>
      <div class="row between" style="font-weight:900;font-size:var(--t-body);padding-top:var(--s3);border-top:1px solid var(--line);margin-bottom:var(--s4)">
        <span>Total</span><span class="num">${formatCurrency(o.grandTotal)}</span>
      </div>
      <span class="eyebrow">Payment method</span>
      <div class="row gap2 wrap" id="scMethodRow" style="margin:var(--s2) 0 var(--s4)"></div>
      <button class="btn btn-block" id="scConfirm" style="height:48px">Confirm payment</button>`, { wide: false });

    function paintMethodRow() {
      const host = s.el.querySelector('#scMethodRow');
      host.innerHTML = methods.map((m, i) => `<button class="chip ${m === method ? 'sel' : ''}" data-sc-method-idx="${i}"
        style="height:30px;${m === method ? 'background:var(--ink);color:var(--paper);border-color:var(--ink)' : ''}">${escapeHtml(m.name)}</button>`).join('')
        + (method.type === 'qr' && method.qrImage ? `<button class="btn btn-ghost btn-sm" id="scViewQr">View QR</button>` : '');
      host.querySelectorAll('[data-sc-method-idx]').forEach(c => c.addEventListener('click', () => {
        method = methods[Number(c.dataset.scMethodIdx)];
        paintMethodRow();
      }));
      const qrBtn = host.querySelector('#scViewQr');
      if (qrBtn) qrBtn.addEventListener('click', () => M.sheet(`<div style="text-align:center">
        <span class="eyebrow">${escapeHtml(method.name)}</span>
        <img src="${method.qrImage}" style="width:100%;max-width:280px;border-radius:var(--r-lg);margin-top:var(--s3)"></div>`));
    }
    paintMethodRow();

    s.el.querySelector('#scConfirm').addEventListener('click', async () => {
      const btn = s.el.querySelector('#scConfirm');
      btn.disabled = true; btn.textContent = 'Processing…';
      await ENGINE.advanceSupply(o.id, 'PAID', { method: method.name, reference: '' });
      M.toast('Order paid', 'Sales record created', 'success');
      s.close();
      paintOrders();
    });
  }

  function paintOrders() {
    const orders = g2(() => getSupplyOrders(), []).slice().reverse();
    const host = root.querySelector('#ordersList');
    if (!orders.length) { host.innerHTML = `<div class="card pad" style="text-align:center;color:var(--ink-4);padding:var(--s7) 0">No supply orders yet — create one above.</div>`; return; }
    host.innerHTML = orders.map(o => {
      const next = nextSupplyStatus(o.status);
      const terminal = ['CANCELLED', 'VOIDED'].includes(o.status);
      return `<div class="card pad" style="border-radius:var(--r-lg)">
        <div class="row between">
          <div><div class="name">${escapeHtml(o.clientName)} <span class="muted" style="font-weight:400">· ${escapeHtml(o.invoiceNumber)}</span></div>
            <div class="sub">${o.orderDate} · ${(o.items || []).length} line${(o.items || []).length === 1 ? '' : 's'} · ${formatCurrency(o.grandTotal)}</div></div>
          <div class="row gap2" style="align-items:center">
            <span class="chip ${SUPPLY_TONE[o.status] || ''}"><span class="dot"></span>${SUPPLY_STATUS_LABELS[o.status] || o.status}</span>
            ${!terminal && next ? `<button class="btn btn-sm" data-advance="${o.id}" data-next="${next}">${next === 'PAID' ? 'Checkout' : `Mark ${SUPPLY_STATUS_LABELS[next]}`}</button>` : ''}
            ${!terminal ? `<button class="btn btn-ghost btn-sm" data-cancel-ord="${o.id}" style="color:var(--crit)">Cancel</button>` : ''}
            ${o.status === 'DRAFTED' ? `<button class="btn btn-ghost btn-sm" data-del-ord="${o.id}" style="color:var(--crit)">Delete</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    host.querySelectorAll('[data-advance]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.advance, next = b.dataset.next;
      if (next === 'PAID') {
        const order = orders.find(o => o.id === id);
        if (order) openSupplyCheckout(order);
        return;
      }
      await ENGINE.advanceSupply(id, next);
      M.toast('Status updated', SUPPLY_STATUS_LABELS[next], 'success');
      paintOrders();
    }));
    host.querySelectorAll('[data-cancel-ord]').forEach(b => b.addEventListener('click', () => {
      if (typeof cancelSupplyOrder === 'function') cancelSupplyOrder(b.dataset.cancelOrd);
      paintOrders();
    }));
    host.querySelectorAll('[data-del-ord]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteSupplyOrder === 'function') deleteSupplyOrder(b.dataset.delOrd);
      paintOrders();
    }));
  }

  paintClients(); renderDraft(); paintOrders();
};
