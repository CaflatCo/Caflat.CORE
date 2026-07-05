/* ═══════════════════════════════════════════════════════════════
   MISE — VIEW · SERVICE   point of sale
═══════════════════════════════════════════════════════════════ */
VIEWS.service = function (root) {
  const cats = ['All', ...new Set(DATA.products.map(p => p.cat))];
  let activeCat = 'All';

  root.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 380px; gap:var(--s5); align-items:start">
      <!-- MENU -->
      <div>
        <div class="sec-head" style="margin-bottom:var(--s4)">
          <div><span class="eyebrow">Point of sale</span><h2 style="margin-top:4px">Service</h2></div>
          <div class="row gap2 wrap" id="catRow">
            ${cats.map((c, i) => `<button class="chip ${i === 0 ? 'sel' : ''}" data-cat="${c}"
              style="height:32px;${i === 0 ? 'background:var(--ink);color:var(--paper);border-color:var(--ink)' : ''}">${c}</button>`).join('')}
          </div>
        </div>
        <div class="grid stagger" id="menuGrid"
          style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--s3)"></div>
      </div>

      <!-- TICKET -->
      <div class="card" style="border-radius:var(--r-xl);position:sticky;top:96px;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 128px)">
        <div class="pad" style="padding-bottom:var(--s3);border-bottom:1px solid var(--line)">
          <div class="row between">
            <div><span class="eyebrow" style="display:block;margin-bottom:5px">Current order</span><h3>Ticket #${1040 + STORE.state.completedToday}</h3></div>
            <span class="chip" id="cartCount"><span class="dot"></span>0 items</span>
          </div>
        </div>
        <div id="ticketLines" class="pad" style="flex:1;overflow-y:auto;padding-top:var(--s3);padding-bottom:var(--s3)"></div>
        <div class="pad" style="border-top:1px solid var(--line);background:var(--paper-2)">
          <div class="stack gap2" style="margin-bottom:var(--s4)">
            <div class="row between"><span class="muted" style="font-size:var(--t-sm)">Subtotal</span><span class="num" id="sub">$0.00</span></div>
            <div class="row between"><span class="muted" style="font-size:var(--t-sm)">Tax (8%)</span><span class="num" id="tax">$0.00</span></div>
            <div class="row between" style="align-items:baseline">
              <span style="font-weight:700">Total</span>
              <span class="num serif" id="total" style="font-size:1.9rem;letter-spacing:-0.03em;font-weight:900">$0.00</span>
            </div>
          </div>
          <button class="btn btn-block" id="charge" style="height:52px;font-size:var(--t-body)" disabled>Charge $0.00</button>
        </div>
      </div>
    </div>`;

  const grid = root.querySelector('#menuGrid');
  function renderMenu() {
    const items = DATA.products.filter(p => activeCat === 'All' || p.cat === activeCat);
    grid.innerHTML = items.map(p => {
      const low = p.batch > 0 && p.stock <= p.batch;
      return `<button class="card lift pad prod" data-prod="${p.id}"
        style="--i:${items.indexOf(p)};text-align:left;display:flex;flex-direction:column;gap:6px;padding:var(--s4);border-radius:var(--r-lg)">
        <div class="row between"><span class="pico xl">${prodIcon(p.icon)}</span>
          ${low ? '<span class="chip crit" style="height:20px;font-size:9px"><span class="dot"></span>Low</span>' : ''}</div>
        <div style="font-weight:640;line-height:1.2;margin-top:2px">${p.name}</div>
        <div class="row between" style="margin-top:auto;padding-top:6px">
          <span class="num" style="font-weight:700">${DATA.fmt$c(p.price)}</span>
          <span class="muted" style="font-size:var(--t-2xs)">${p.cat}</span>
        </div></button>`;
    }).join('');
    grid.querySelectorAll('.prod').forEach(b => b.addEventListener('click', () => {
      const p = DATA.products.find(x => x.id === b.dataset.prod);
      STORE.addToCart(p);
      b.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }));
    M.stagger(grid, 30);
  }

  // category filter
  root.querySelectorAll('[data-cat]').forEach(c => c.addEventListener('click', () => {
    activeCat = c.dataset.cat;
    root.querySelectorAll('[data-cat]').forEach(x => {
      const on = x.dataset.cat === activeCat;
      x.style.background = on ? 'var(--ink)' : ''; x.style.color = on ? 'var(--paper)' : '';
      x.style.borderColor = on ? 'var(--ink)' : '';
    });
    renderMenu();
  }));

  function renderTicket() {
    const c = STORE.state.cart, host = root.querySelector('#ticketLines');
    if (!c.length) {
      host.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--s3);color:var(--ink-4);text-align:center;padding:var(--s7) 0">
        <span class="pico" style="width:40px;height:40px;opacity:.5;color:var(--ink-4)">${UI_ICON.receipt}</span><span style="font-size:var(--t-sm)">Tap items to build the order</span></div>`;
    } else {
      host.innerHTML = c.map(l => `
        <div class="lrow" data-line="${l.id}" style="padding:10px 0;animation:fadeUp .25s var(--ease-out) both">
          <span class="pico">${prodIcon(l.icon)}</span>
          <div class="grow"><div class="name" style="font-size:var(--t-sm)">${l.name}</div>
            <div class="sub num">${DATA.fmt$c(l.price)}</div></div>
          <div class="row gap2" style="align-items:center">
            <button class="icon-btn dec" style="width:30px;height:30px" data-dec="${l.id}">–</button>
            <span class="num" style="min-width:20px;text-align:center;font-weight:700">${l.qty}</span>
            <button class="icon-btn inc" style="width:30px;height:30px" data-inc="${l.id}">+</button>
          </div>
          <span class="num" style="min-width:56px;text-align:right;font-weight:700">${DATA.fmt$c(l.price * l.qty)}</span>
        </div>`).join('');
      host.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => { STORE.addToCart(DATA.products.find(p => p.id === b.dataset.inc)); }));
      host.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => { STORE.decCart(b.dataset.dec); }));
    }
    const sub = STORE.cartTotal(), tax = sub * 0.08, total = sub + tax, n = STORE.cartCount();
    root.querySelector('#sub').textContent = DATA.fmt$c(sub);
    root.querySelector('#tax').textContent = DATA.fmt$c(tax);
    root.querySelector('#total').textContent = DATA.fmt$c(total);
    root.querySelector('#cartCount').innerHTML = `<span class="dot"></span>${n} item${n === 1 ? '' : 's'}`;
    const chg = root.querySelector('#charge');
    chg.disabled = !n; chg.textContent = n ? `Charge ${DATA.fmt$c(total)}` : 'Charge $0.00';
  }

  root.querySelector('#charge').addEventListener('click', () => {
    const total = STORE.cartTotal() * 1.08, n = STORE.cartCount();
    STORE.set({ completedToday: STORE.state.completedToday + 1, revenueToday: STORE.state.revenueToday + total });
    M.toast('Payment complete', `${n} items · ${DATA.fmt$c(total)} · Ticket #${1040 + STORE.state.completedToday - 1}`, 'success');
    STORE.clearCart();
    root.querySelector('#charge').animate([{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'var(--ease-spring)' });
  });

  const unsub = STORE.sub(renderTicket);
  // clean up subscription when leaving the view
  const obs = new MutationObserver(() => { if (!document.body.contains(root)) { unsub(); obs.disconnect(); } });
  obs.observe(document.getElementById('stage'), { childList: true });

  renderMenu(); renderTicket();
};
