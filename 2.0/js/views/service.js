/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · SERVICE   (real POS — real products, real charge)
═══════════════════════════════════════════════════════════════ */
VIEWS.service = function (root) {
  const realProducts = g2(() => getProducts(), []);
  if (!realProducts.length) {
    emptyState(root, 'No products yet',
      `Add products in the classic app's Products screen and they'll show up here, ready to sell — with real stock, real prices, real everything.`,
      UI_ICON.box);
    return;
  }

  const stockOf = p => { try { return typeof getEffectiveStock === 'function' ? getEffectiveStock(p) : Number(p.stock || 0); } catch (e) { return Number(p.stock || 0); } };
  const cats = ['All', ...new Set(realProducts.map(p => p.category).filter(Boolean))];
  let activeCat = 'All';
  let cart = [];   // 2.0's own cart — independent of the classic app's transient APP_STATE.cart
  const realMethods = g2(() => (APP_STATE.settings?.paymentMethods || []), []);
  const methods = realMethods.length ? realMethods : [{ name: 'Cash', type: 'cash' }];
  let method = methods[0];
  let splitOn = false;
  let splitMethod = methods.find(m => m.type !== 'cash') || methods[0];
  let splitAmount = 0;

  root.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 380px; gap:var(--s5); align-items:start">
      <div>
        <div class="sec-head" style="margin-bottom:var(--s4)">
          <div><span class="eyebrow">Point of sale · real inventory</span><h2 style="margin-top:4px">Service</h2></div>
          <div class="row gap2 wrap" id="catRow">
            ${cats.map((c, i) => `<button class="chip ${i === 0 ? 'sel' : ''}" data-cat="${escapeHtml(c)}"
              style="height:32px;${i === 0 ? 'background:var(--ink);color:var(--paper);border-color:var(--ink)' : ''}">${escapeHtml(c)}</button>`).join('')}
          </div>
        </div>
        <div class="grid stagger" id="menuGrid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--s3)"></div>
      </div>

      <div class="card" style="border-radius:var(--r-xl);position:sticky;top:96px;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 128px)">
        <div class="pad" style="padding-bottom:var(--s3);border-bottom:1px solid var(--line)">
          <div class="row between">
            <div><span class="eyebrow" style="display:block;margin-bottom:5px">Current order</span><h3>New sale</h3></div>
            <span class="chip" id="cartCount"><span class="dot"></span>0 items</span>
          </div>
        </div>
        <div id="ticketLines" class="pad" style="flex:1;overflow-y:auto;padding-top:var(--s3);padding-bottom:var(--s3)"></div>
        <div class="pad" style="border-top:1px solid var(--line);background:var(--paper-2)">
          <div class="row between" style="margin-bottom:var(--s2)">
            <span class="eyebrow">Payment</span>
            <button class="btn btn-ghost btn-sm" id="splitToggle" style="height:26px">${splitOn ? 'Split: on' : 'Split payment'}</button>
          </div>
          <div class="row gap2 wrap" id="methodRow" style="margin-bottom:var(--s3)"></div>
          <div id="splitRow" style="display:${splitOn ? 'block' : 'none'};margin-bottom:var(--s3)">
            <div class="row gap2 wrap" id="splitMethodRow" style="margin-bottom:var(--s2)"></div>
            <div class="row gap2" style="align-items:center">
              <input id="splitAmountInput" type="number" min="0" step="0.01" class="field" placeholder="Split amount" style="flex:1">
              <span class="muted" style="font-size:var(--t-xs)" id="splitRemainLabel"></span>
            </div>
          </div>
          <div class="stack gap2" style="margin-bottom:var(--s4)">
            <div class="row between" style="align-items:baseline">
              <span style="font-weight:700">Total</span>
              <span class="num serif" id="total" style="font-size:1.9rem;letter-spacing:-0.03em;font-weight:900">${ADAPT.sym()}0.00</span>
            </div>
          </div>
          <button class="btn btn-block" id="charge" style="height:52px;font-size:var(--t-body)" disabled>Charge</button>
        </div>
      </div>
    </div>`;

  function paintMethodRow() {
    const host = root.querySelector('#methodRow');
    host.innerHTML = methods.map((m, i) => `<button class="chip ${m === method ? 'sel' : ''}" data-method-idx="${i}"
      style="height:28px;${m === method ? 'background:var(--ink);color:var(--paper);border-color:var(--ink)' : ''}">${escapeHtml(m.name)}</button>`).join('')
      + (method.type === 'qr' && method.qrImage ? `<button class="btn btn-ghost btn-sm" id="viewQrMain" style="height:28px">View QR</button>` : '');
    host.querySelectorAll('[data-method-idx]').forEach(c => c.addEventListener('click', () => {
      method = methods[Number(c.dataset.methodIdx)];
      paintMethodRow();
    }));
    const qrBtn = host.querySelector('#viewQrMain');
    if (qrBtn) qrBtn.addEventListener('click', () => showQr(method));
  }

  function paintSplitMethodRow() {
    const host = root.querySelector('#splitMethodRow');
    const options = methods.filter(m => m !== method);
    host.innerHTML = options.map(m => `<button class="chip ${m === splitMethod ? 'sel' : ''}" data-split-name="${escapeHtml(m.name)}"
      style="height:26px;${m === splitMethod ? 'background:var(--ink);color:var(--paper);border-color:var(--ink)' : ''}">${escapeHtml(m.name)}</button>`).join('')
      + (splitMethod?.type === 'qr' && splitMethod.qrImage ? `<button class="btn btn-ghost btn-sm" id="viewQrSplit" style="height:26px">View QR</button>` : '');
    host.querySelectorAll('[data-split-name]').forEach(c => c.addEventListener('click', () => {
      splitMethod = methods.find(m => m.name === c.dataset.splitName);
      paintSplitMethodRow();
    }));
    const qrBtn = host.querySelector('#viewQrSplit');
    if (qrBtn) qrBtn.addEventListener('click', () => showQr(splitMethod));
  }

  function showQr(m) {
    if (!m?.qrImage) return;
    M.sheet(`<div style="text-align:center">
      <span class="eyebrow">${escapeHtml(m.name)}</span>
      <img src="${m.qrImage}" style="width:100%;max-width:280px;border-radius:var(--r-lg);margin-top:var(--s3)">
    </div>`);
  }

  root.querySelector('#splitToggle').addEventListener('click', () => {
    splitOn = !splitOn;
    root.querySelector('#splitToggle').textContent = splitOn ? 'Split: on' : 'Split payment';
    root.querySelector('#splitRow').style.display = splitOn ? 'block' : 'none';
    if (splitOn) { paintSplitMethodRow(); }
    updateTotals();
  });
  root.querySelector('#splitAmountInput').addEventListener('input', (e) => {
    splitAmount = Number(e.target.value || 0);
    updateTotals();
  });

  paintMethodRow();

  const grid = root.querySelector('#menuGrid');
  function renderMenu() {
    const items = realProducts.filter(p => activeCat === 'All' || p.category === activeCat);
    grid.innerHTML = items.map((p, i) => {
      const stock = stockOf(p);
      const tracked = p.trackStock !== false && stock < 900;
      const low = tracked && stock <= Number(APP_STATE.settings?.lowStockThreshold ?? 5);
      const out = tracked && stock <= 0;
      const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
      return `<button class="card lift pad prod" data-prod="${p.id}" ${out ? 'disabled' : ''}
        style="--i:${i};text-align:left;display:flex;flex-direction:column;gap:6px;padding:var(--s4);border-radius:var(--r-lg);${out ? 'opacity:.45' : ''}">
        <div class="row between">
          ${out ? '<span class="chip crit" style="height:20px;font-size:9px"><span class="dot"></span>Out</span>'
            : low ? '<span class="chip warn" style="height:20px;font-size:9px"><span class="dot"></span>Low</span>' : '<span></span>'}
          ${hasVariants && !out ? '<span class="chip" data-variants="' + p.id + '" style="height:20px;font-size:9px">Options ' + ICON.down + '</span>' : ''}
        </div>
        <div style="font-weight:640;line-height:1.2;margin-top:2px">${escapeHtml(p.name)}</div>
        <div class="row between" style="margin-top:auto;padding-top:6px">
          <span class="num" style="font-weight:700">${formatCurrency(p.price)}</span>
          <span class="muted" style="font-size:var(--t-2xs)">${escapeHtml(p.category || '')}</span>
        </div></button>`;
    }).join('');
    grid.querySelectorAll('.prod:not([disabled])').forEach(b => b.addEventListener('click', (e) => {
      const p = realProducts.find(x => String(x.id) === b.dataset.prod);
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        openVariantPicker(p);
      } else {
        addLine(p, null);
      }
      b.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }));
    M.stagger(grid, 30);
  }

  function addLine(p, variant) {
    const variantId = variant?.id || '';
    const line = cart.find(l => l.productId === p.id && (l.variantId || '') === variantId);
    if (line) { line.quantity++; renderTicket(); return; }
    cart.push({
      id: generateId(), productId: p.id, variantId, multiplier: Number(variant?.multiplier || 1),
      name: variant?.name ? `${p.name} (${variant.name})` : p.name,
      price: Number(variant?.price ?? p.price ?? 0), quantity: 1,
      recipe: Array.isArray(p.recipe) ? p.recipe : [], recipeMode: p.recipeMode || 'unit', batchYield: p.batchYield || 1,
      category: p.category,
    });
    renderTicket();
  }

  function openVariantPicker(p) {
    const s = M.sheet(`
      <span class="eyebrow">${escapeHtml(p.name)}</span>
      <h3 style="margin:6px 0 var(--s4)">Choose an option</h3>
      <div class="stack gap2" id="variantList">
        ${p.variants.map(v => `<button class="card lift pad" data-vid="${v.id}" style="border-radius:var(--r-lg);text-align:left;display:flex;justify-content:space-between;align-items:center;width:100%">
          <span class="name" style="font-weight:640">${escapeHtml(v.name)}</span>
          <span class="num" style="font-weight:700">${formatCurrency(v.price)}</span>
        </button>`).join('')}
      </div>`);
    s.el.querySelectorAll('[data-vid]').forEach(b => b.addEventListener('click', () => {
      const v = p.variants.find(x => x.id === b.dataset.vid);
      addLine(p, v);
      s.close();
    }));
  }

  root.querySelectorAll('[data-cat]').forEach(c => c.addEventListener('click', () => {
    activeCat = c.dataset.cat;
    root.querySelectorAll('[data-cat]').forEach(x => {
      const on = x.dataset.cat === activeCat;
      x.style.background = on ? 'var(--ink)' : ''; x.style.color = on ? 'var(--paper)' : ''; x.style.borderColor = on ? 'var(--ink)' : '';
    });
    renderMenu();
  }));

  function renderTicket() {
    const host = root.querySelector('#ticketLines');
    if (!cart.length) {
      host.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--s3);color:var(--ink-4);text-align:center;padding:var(--s7) 0">
        <span class="pico" style="width:40px;height:40px;opacity:.5;color:var(--ink-4)">${UI_ICON.receipt}</span><span style="font-size:var(--t-sm)">Tap items to build the order</span></div>`;
    } else {
      host.innerHTML = cart.map(l => `
        <div class="lrow" style="padding:10px 0;animation:fadeUp .25s var(--ease-out) both">
          <div class="grow"><div class="name" style="font-size:var(--t-sm)">${escapeHtml(l.name)}</div>
            <div class="sub num">${formatCurrency(l.price)}</div></div>
          <div class="row gap2" style="align-items:center">
            <button class="icon-btn" style="width:30px;height:30px" data-dec="${l.id}">–</button>
            <span class="num" style="min-width:20px;text-align:center;font-weight:700">${l.quantity}</span>
            <button class="icon-btn" style="width:30px;height:30px" data-inc="${l.id}">+</button>
          </div>
          <span class="num" style="min-width:64px;text-align:right;font-weight:700">${formatCurrency(l.price * l.quantity)}</span>
        </div>`).join('');
      host.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => {
        const l = cart.find(x => x.id === b.dataset.inc); if (l) l.quantity++; renderTicket();
      }));
      host.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => {
        const l = cart.find(x => x.id === b.dataset.dec); if (!l) return;
        l.quantity--; if (l.quantity <= 0) cart = cart.filter(x => x.id !== l.id);
        renderTicket();
      }));
    }
    updateTotals();
  }

  function updateTotals() {
    const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);
    const n = cart.reduce((s, l) => s + l.quantity, 0);
    root.querySelector('#total').textContent = formatCurrency(total);
    root.querySelector('#cartCount').innerHTML = `<span class="dot"></span>${n} item${n === 1 ? '' : 's'}`;
    let ok = !!n;
    if (splitOn) {
      const remain = total - splitAmount;
      root.querySelector('#splitRemainLabel').textContent = `${formatCurrency(Math.max(0, remain))} on ${method.name}`;
      if (!(splitAmount > 0) || splitAmount >= total) ok = false;
    }
    const btn = root.querySelector('#charge');
    btn.disabled = !ok; btn.textContent = n ? `Charge ${formatCurrency(total)}` : 'Charge';
  }

  root.querySelector('#charge').addEventListener('click', async () => {
    const btn = root.querySelector('#charge');
    btn.disabled = true; const prevText = btn.textContent; btn.textContent = 'Charging…';
    const split = splitOn ? { method: splitMethod.name, amount: splitAmount } : null;
    const result = await ENGINE.charge(cart, { paymentMethod: method.name, split });
    if (!result.ok) {
      M.toast('Could not complete sale', result.error || 'Please try again', 'crit');
      btn.disabled = false; btn.textContent = prevText;
      return;
    }
    const t = result.transaction;
    M.toast('Sale completed', `${t.receiptNumber} · ${formatCurrency(t.totals.total)}`, 'success');
    cart = [];
    splitOn = false; splitAmount = 0;
    root.querySelector('#splitToggle').textContent = 'Split payment';
    root.querySelector('#splitRow').style.display = 'none';
    root.querySelector('#splitAmountInput').value = '';
    renderTicket();
    renderMenu(); // stock just changed — refresh badges
    // NB: Element.animate()'s easing option does not resolve CSS custom
    // properties (unlike normal CSS) — must pass the literal cubic-bezier.
    btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });

  renderMenu(); renderTicket();
};

/* tiny guarded-getter helper local to this view */
function g2(fn, fb) { try { return fn(); } catch (e) { return fb; } }
