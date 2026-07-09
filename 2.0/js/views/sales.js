/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · SALES   (real transaction history + real void/refund)
═══════════════════════════════════════════════════════════════ */
VIEWS.sales = function (root) {
  let openAction = null; // { saleId, kind: 'void'|'refund' }

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Sales · real transactions</span><h2 style="margin-top:4px">Sales</h2>
      <p class="muted" style="margin-top:6px">Every real transaction, sealed and audited. Void undoes a mistaken sale; Refund returns money for a completed one.</p></div></div>
    <div class="stack gap2" id="salesList"></div>`;

  function statusTone(s) {
    s = (s || '').toUpperCase();
    if (s === 'COMPLETED') return 'live'; if (s === 'PENDING') return 'warn';
    if (s === 'VOIDED' || s === 'REFUNDED') return 'crit'; return '';
  }

  function actionRow(sale) {
    if (!openAction || openAction.saleId !== sale.id) return '';
    if (openAction.kind === 'void') {
      return `<div class="row gap2 wrap" style="padding:var(--s3) 0;border-top:1px solid var(--line);margin-top:var(--s2)">
        <input class="field" id="voidReason-${sale.id}" placeholder="Reason (required)" style="flex:1;min-width:160px">
        <input class="field" id="voidPin-${sale.id}" placeholder="Admin PIN" maxlength="6" style="width:120px">
        <button class="btn btn-sm" data-confirm-void="${sale.id}">Confirm void</button>
        <button class="btn btn-ghost btn-sm" data-cancel-action>Cancel</button>
      </div>`;
    }
    return `<div class="row gap2 wrap" style="padding:var(--s3) 0;border-top:1px solid var(--line);margin-top:var(--s2)">
      <input class="field" id="refundReason-${sale.id}" placeholder="Reason (required)" style="flex:1;min-width:160px">
      <button class="btn btn-sm" data-confirm-refund="${sale.id}">Confirm refund</button>
      <button class="btn btn-ghost btn-sm" data-cancel-action>Cancel</button>
    </div>`;
  }

  function openReceipt(t) {
    const brand = APP_STATE.settings?.brandName || 'Caflat.CORE';
    const footer = APP_STATE.settings?.receiptFooter || '';
    const dateText = new Date(t.audit?.completedAt || t.audit?.createdAt || t.createdAt).toLocaleString();
    const rline = (l, r) => `<div class="row between" style="padding:3px 0;font-size:var(--t-xs)"><span class="muted">${l}</span><span>${r}</span></div>`;
    const itemsHtml = (t.items || []).map(i => rline(`${escapeHtml(i.name)} ×${round2(i.quantity)}`, formatCurrency(i.total))).join('');
    M.sheet(`
      <div style="text-align:center;margin-bottom:var(--s3)">
        <div style="font-weight:900;font-size:1.1rem">${escapeHtml(brand)}</div>
        <div class="muted" style="font-size:var(--t-xs);margin-top:2px">${dateText}</div>
        <div class="muted" style="font-size:var(--t-xs)">${escapeHtml(t.receiptNumber || t.id)}</div>
        <span class="chip ${statusTone(t.status)}" style="height:20px;font-size:9px;margin-top:6px"><span class="dot"></span>${escapeHtml(t.status || 'COMPLETED')}</span>
      </div>
      ${rline('Customer', escapeHtml(t.customer?.name || t.customerName || 'Walk-in'))}
      ${t.notes ? rline('Notes', escapeHtml(t.notes)) : ''}
      ${rline('Payment', escapeHtml((t.payment?.method || t.paymentMethod || 'cash')))}
      ${t.payment?.splitMethod ? rline(`— split on ${escapeHtml(t.payment.splitMethod)}`, formatCurrency(t.payment.splitAmount)) : ''}
      <div class="hr" style="margin:var(--s3) 0"></div>
      ${itemsHtml}
      <div class="hr" style="margin:var(--s3) 0"></div>
      ${rline('Subtotal', formatCurrency(t.totals?.subtotal ?? t.subtotal ?? 0))}
      ${Number(t.totals?.discount ?? t.discount ?? 0) > 0 ? rline('Discount', '-' + formatCurrency(t.totals?.discount ?? t.discount)) : ''}
      ${Number(t.totals?.tax ?? t.tax ?? 0) > 0 ? rline('Tax', formatCurrency(t.totals?.tax ?? t.tax)) : ''}
      <div class="row between" style="padding:var(--s2) 0;font-weight:900;font-size:var(--t-body)"><span>Total</span><span class="num">${formatCurrency(t.totals?.total ?? t.total ?? 0)}</span></div>
      ${footer ? `<div class="hr" style="margin:var(--s3) 0"></div><p class="muted" style="text-align:center;font-size:var(--t-xs)">${escapeHtml(footer)}</p>` : ''}
    `);
  }

  function paint() {
    const sales = g2(() => getSales(), []).slice().reverse();
    const host = root.querySelector('#salesList');
    if (!sales.length) {
      host.innerHTML = `<div class="card pad" style="text-align:center;color:var(--ink-4);padding:var(--s7) 0">No sales yet — they'll show up here the moment you charge one in Service.</div>`;
      return;
    }
    host.innerHTML = sales.slice(0, 100).map(sale => {
      const status = sale.status || 'COMPLETED';
      const canAct = status === 'COMPLETED';
      const total = sale.totals?.total ?? sale.total ?? 0;
      const when = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
      return `<div class="card pad" style="border-radius:var(--r-lg)">
        <div class="row between">
          <div class="row gap3">
            <span class="pico lg">${UI_ICON.receipt}</span>
            <div><div class="name">${escapeHtml(sale.receiptNumber || sale.id)}</div>
              <div class="sub">${when.toLocaleString()} · ${escapeHtml(sale.payment?.method || sale.paymentMethod || '')} · ${(sale.items || []).length} item${(sale.items || []).length === 1 ? '' : 's'}</div></div>
          </div>
          <div class="row gap3" style="align-items:center">
            <span class="num" style="font-weight:800;font-size:1.1rem">${formatCurrency(total)}</span>
            <span class="chip ${statusTone(status)}"><span class="dot"></span>${escapeHtml(status)}</span>
            <button class="btn btn-ghost btn-sm" data-receipt="${sale.id}">Receipt</button>
            ${canAct ? `<button class="btn btn-ghost btn-sm" data-void="${sale.id}">Void</button>
              <button class="btn btn-ghost btn-sm" data-refund="${sale.id}">Refund</button>` : ''}
          </div>
        </div>
        ${actionRow(sale)}
      </div>`;
    }).join('');

    host.querySelectorAll('[data-receipt]').forEach(b => b.addEventListener('click', () => {
      const sale = sales.find(s => String(s.id) === b.dataset.receipt);
      if (sale) openReceipt(sale);
    }));
    host.querySelectorAll('[data-void]').forEach(b => b.addEventListener('click', () => { openAction = { saleId: b.dataset.void, kind: 'void' }; paint(); }));
    host.querySelectorAll('[data-refund]').forEach(b => b.addEventListener('click', () => { openAction = { saleId: b.dataset.refund, kind: 'refund' }; paint(); }));
    host.querySelectorAll('[data-cancel-action]').forEach(b => b.addEventListener('click', () => { openAction = null; paint(); }));
    host.querySelectorAll('[data-confirm-void]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.confirmVoid;
      const reason = root.querySelector(`#voidReason-${id}`).value.trim();
      const pin = root.querySelector(`#voidPin-${id}`).value.trim();
      const result = ENGINE.voidSale(id, reason, pin);
      if (!result.ok) { M.toast('Could not void', result.error, 'crit'); return; }
      M.toast('Sale voided', 'Stock restored', 'success');
      openAction = null; paint();
    }));
    host.querySelectorAll('[data-confirm-refund]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.confirmRefund;
      const reason = root.querySelector(`#refundReason-${id}`).value.trim();
      const result = await ENGINE.refundSale(id, reason);
      if (!result.ok) { M.toast('Could not refund', result.error, 'crit'); return; }
      M.toast('Refund processed', 'Stock restored', 'success');
      openAction = null; paint();
    }));
  }
  paint();
};
