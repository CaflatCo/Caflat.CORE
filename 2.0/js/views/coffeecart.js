/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · COFFEE CART   (real pop-up events + profitability)
═══════════════════════════════════════════════════════════════ */
VIEWS.coffeecart = function (root) {
  let events = g2(() => getEvents(), []);
  let openId = null;
  let editingId = null;

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Coffee Cart · real pop-up events</span><h2 style="margin-top:4px">Coffee Cart</h2>
      <p class="muted" style="margin-top:6px">Track pop-ups and off-site events — revenue and ingredient cost pull from real sales tagged to each event.</p></div>
      <button class="btn" id="evAdd">New event</button></div>

    <div class="card pad" id="evForm" style="border-radius:var(--r-xl);margin-bottom:var(--s5);display:none">
      <div class="grid" style="grid-template-columns:2fr 1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
        <input id="evName" class="field" placeholder="Event name">
        <input id="evLocation" class="field" placeholder="Location">
        <input id="evDate" type="date" class="field">
      </div>
      <input id="evNotes" class="field" style="width:100%;margin-bottom:var(--s3)" placeholder="Notes">
      <div class="row gap2"><button class="btn btn-sm" id="evSave">Save</button><button class="btn btn-ghost btn-sm" id="evCancel">Cancel</button></div>
    </div>

    <div class="stack gap3" id="evList"></div>`;

  const evForm = root.querySelector('#evForm');
  function openForm(ev) {
    editingId = ev?.id || null;
    root.querySelector('#evName').value = ev?.name || '';
    root.querySelector('#evLocation').value = ev?.location || '';
    root.querySelector('#evDate').value = ev?.date || '';
    root.querySelector('#evNotes').value = ev?.notes || '';
    evForm.style.display = 'block';
    root.querySelector('#evName').focus();
  }
  root.querySelector('#evAdd').addEventListener('click', () => openForm(null));
  root.querySelector('#evCancel').addEventListener('click', () => { evForm.style.display = 'none'; editingId = null; });
  root.querySelector('#evSave').addEventListener('click', () => {
    const result = ENGINE.saveEvent({
      name: sanitizeText(root.querySelector('#evName').value), location: sanitizeText(root.querySelector('#evLocation').value),
      date: root.querySelector('#evDate').value, notes: sanitizeText(root.querySelector('#evNotes').value),
    }, editingId);
    if (!result.ok) { M.toast('Could not save event', result.error, 'crit'); return; }
    M.toast('Event saved', '', 'success');
    evForm.style.display = 'none'; editingId = null;
    events = g2(() => getEvents(), []);
    paintList();
  });

  function expenseRows(ev) {
    const expenses = g2(() => getEventExpenses(ev.id), []);
    return expenses.map(ex => `<div class="lrow" style="padding:4px 0"><span class="grow">${escapeHtml(ex.label)}</span>
      <span class="num">${formatCurrency(ex.amount)}</span>
      <button class="icon-btn" style="width:24px;height:24px" data-rmexp="${ev.id}|${ex.id}">×</button></div>`).join('');
  }

  function paintList() {
    const host = root.querySelector('#evList');
    host.innerHTML = events.length ? events.slice().reverse().map(ev => {
      const p = g2(() => getEventProfitability(ev.id), { revenue: 0, expenses: 0, ingredientCost: 0, totalCost: 0, profit: 0, margin: 0, orders: 0 });
      const active = g2(() => getActiveEvent()?.id, null) === ev.id;
      return `<div class="card pad" style="border-radius:var(--r-lg)">
        <div class="row between">
          <div><div class="name">${escapeHtml(ev.name)} ${active ? '<span class="chip live" style="height:20px;font-size:9px;margin-left:6px"><span class="dot"></span>Live</span>' : ''}</div>
            <div class="sub">${escapeHtml(ev.location || 'No location')}${ev.date ? ' · ' + escapeHtml(ev.date) : ''} · ${p.orders} order${p.orders === 1 ? '' : 's'}</div></div>
          <div class="row gap2" style="align-items:center">
            <span class="num" style="font-weight:800">${formatCurrency(p.revenue)}</span>
            <button class="btn btn-ghost btn-sm" data-toggle="${ev.id}">${openId === ev.id ? 'Hide' : 'Details'}</button>
            <button class="btn btn-ghost btn-sm" data-edit="${ev.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-del="${ev.id}" style="color:var(--crit)">Delete</button>
          </div>
        </div>
        <div style="display:${openId === ev.id ? 'block' : 'none'};margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--line)">
          <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:var(--s2);margin-bottom:var(--s3);font-size:var(--t-sm)">
            <div><div class="muted">Revenue</div><div class="num" style="font-weight:700">${formatCurrency(p.revenue)}</div></div>
            <div><div class="muted">Ingredient cost</div><div class="num" style="font-weight:700">${formatCurrency(p.ingredientCost)}</div></div>
            <div><div class="muted">Expenses</div><div class="num" style="font-weight:700">${formatCurrency(p.expenses)}</div></div>
            <div><div class="muted">Profit</div><div class="num" style="font-weight:700;color:${p.profit >= 0 ? 'var(--live)' : 'var(--crit)'}">${formatCurrency(p.profit)} (${p.margin.toFixed(1)}%)</div></div>
          </div>
          <span class="eyebrow">Expenses</span>
          <div class="stack" style="margin:var(--s2) 0 var(--s2)">${expenseRows(ev)}</div>
          <div class="row gap2">
            <input class="field" data-explabel="${ev.id}" placeholder="Expense label" style="flex:1">
            <input class="field" data-expamt="${ev.id}" type="number" min="0" step="0.01" placeholder="Amount" style="width:120px">
            <button class="btn btn-ghost btn-sm" data-addexp="${ev.id}">Add expense</button>
          </div>
          <div class="row gap2" style="margin-top:var(--s3)">
            ${active ? `<button class="btn btn-ghost btn-sm" data-end="${ev.id}">End session</button>` : `<button class="btn btn-ghost btn-sm" data-start="${ev.id}">Start live session</button>`}
          </div>
        </div>
      </div>`;
    }).join('') : `<div class="card pad" style="text-align:center;color:var(--ink-4);padding:var(--s7) 0">No events yet — create one above to start tracking pop-up profitability.</div>`;

    host.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => { openId = openId === b.dataset.toggle ? null : b.dataset.toggle; paintList(); }));
    host.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(events.find(e => e.id === b.dataset.edit))));
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteEvent === 'function') deleteEvent(b.dataset.del);
      events = g2(() => getEvents(), []);
      paintList();
    }));
    host.querySelectorAll('[data-addexp]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.addexp;
      const label = root.querySelector(`[data-explabel="${id}"]`).value;
      const amount = root.querySelector(`[data-expamt="${id}"]`).value;
      if (!sanitizeText(label) || !(Number(amount) > 0)) { M.toast('Enter a label and amount', '', 'crit'); return; }
      if (typeof addEventExpense === 'function') addEventExpense(id, { label, amount });
      openId = id;
      paintList();
    }));
    host.querySelectorAll('[data-rmexp]').forEach(b => b.addEventListener('click', () => {
      const [eventId, expenseId] = b.dataset.rmexp.split('|');
      if (typeof deleteEventExpense === 'function') deleteEventExpense(eventId, expenseId);
      openId = eventId;
      paintList();
    }));
    host.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
      const ev = events.find(e => e.id === b.dataset.start);
      if (ev && typeof startEventSession === 'function') startEventSession(ev);
      paintList();
    }));
    host.querySelectorAll('[data-end]').forEach(b => b.addEventListener('click', () => {
      if (typeof endEventSession === 'function') endEventSession();
      paintList();
    }));
  }

  paintList();
};
