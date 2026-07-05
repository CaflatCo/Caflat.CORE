/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · COMMAND   (real data)
═══════════════════════════════════════════════════════════════ */
VIEWS.command = function (root) {
  const c = ADAPT.command();

  if (!c.coverage.hasData) {
    emptyState(root, 'No sales yet',
      `Command lights up the moment you ring your first sale in the classic app. It reads your real transactions — revenue, order mix, and low-stock alerts — and shows them here, live.`,
      UI_ICON.receipt);
    return;
  }

  const now = new Date();
  const deltaKnown = c.revDelta != null;
  const briefing = [
    `${now.toLocaleDateString('en-US', { weekday: 'long' })} at ${c.brand}.`,
    c.ordersToday
      ? `You've taken <b>${c.ordersToday}</b> order${c.ordersToday === 1 ? '' : 's'} for <b>${c.money(c.revenueToday)}</b> so far today${deltaKnown ? `, ${c.revDelta >= 0 ? 'up' : 'down'} <b>${Math.abs(c.revDelta).toFixed(0)}%</b> on last ${c.lastWeekShort}` : ''}.`
      : `No sales rung yet today — the day's still ahead of you.`,
    c.attention.length ? `<b>${c.attention.length}</b> item${c.attention.length === 1 ? '' : 's'} running low on stock.` : `Stock levels look healthy.`,
  ].join(' ');

  root.innerHTML = `
    <div class="grid" style="grid-template-columns: 1.55fr 1fr; align-items:stretch; margin-bottom:var(--s6)">
      <div class="card-ink card pad" style="display:flex;flex-direction:column;justify-content:space-between;gap:var(--s5);border-radius:var(--r-xl);overflow:hidden;position:relative">
        <div style="position:absolute;right:-24px;top:-24px;width:200px;height:200px;opacity:.07;color:var(--paper)">${UI_ICON.cup}</div>
        <div>
          <span class="eyebrow">Today · ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          <h1 class="display" style="color:var(--paper);margin-top:var(--s3);font-size:var(--t-h1)">Good day.</h1>
        </div>
        <p class="serif" style="font-size:1.3rem;line-height:1.45;color:color-mix(in srgb,var(--paper) 92%,transparent);max-width:42ch">${briefing}</p>
        <div class="row gap3">
          <button class="btn" data-go="foresight" style="background:var(--paper);color:var(--ink)">Open Foresight ${ICON.arrow}</button>
        </div>
      </div>

      <div class="card pad lift" style="border-radius:var(--r-xl);display:flex;flex-direction:column;justify-content:space-between">
        <div class="between row">
          <span class="eyebrow">Revenue today</span>
          <span class="chip live"><span class="dot"></span>Live</span>
        </div>
        <div class="metric" style="margin:var(--s4) 0">
          <div class="val num" id="heroRev">${c.sym}0</div>
          <div class="cap">${deltaKnown
            ? `<span class="delta ${c.revDelta >= 0 ? 'up' : 'down'}">${c.revDelta >= 0 ? ICON.up : ICON.down}${Math.abs(c.revDelta).toFixed(1)}%</span><span class="muted">vs last ${c.lastWeekShort}</span>`
            : `<span class="muted">building history…</span>`}</div>
        </div>
        <div id="heroSpark"></div>
        <div class="hr"></div>
        <div class="row between">
          <div class="metric"><div class="cap eyebrow">Orders</div><div class="num" style="font-size:1.4rem;font-weight:800" id="kOrders">0</div></div>
          <div class="metric"><div class="cap eyebrow">Avg ticket</div><div class="num" style="font-size:1.4rem;font-weight:800" id="kTicket">${c.sym}0</div></div>
          <div class="metric"><div class="cap eyebrow">Items</div><div class="num" style="font-size:1.4rem;font-weight:800" id="kUnits">0</div></div>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1.55fr 1fr; align-items:start">
      <div class="card pad" style="border-radius:var(--r-xl)">
        <div class="sec-head" style="margin-bottom:var(--s4)">
          <div><span class="eyebrow">Revenue</span><h3 style="margin-top:4px">Last 14 days</h3></div>
        </div>
        <div id="revChart"></div>
      </div>

      <div class="stack gap5">
        <div class="card pad" style="border-radius:var(--r-xl)">
          <span class="eyebrow">Where the money comes from</span>
          ${c.mix.length ? `<div style="margin:var(--s4) 0 var(--s3)"><div id="mixBar"></div></div>
          <div class="stack">
            ${c.mix.map((m, i) => `
              <div class="lrow" style="padding:8px 0">
                <span style="width:9px;height:9px;border-radius:3px;background:${['var(--ink)','var(--ink-2)','var(--ink-3)','var(--ink-4)'][i] || 'var(--line)'}"></span>
                <span class="grow name">${escapeHtml(m.cat)}</span>
                <span class="num muted" style="font-size:var(--t-sm)">${(m.pct * 100).toFixed(0)}%</span>
                <span class="num" style="font-weight:800;min-width:64px;text-align:right">${c.money(m.value)}</span>
              </div>`).join('')}
          </div>` : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s4) 0">No category breakdown yet.</p>`}
        </div>

        <div class="card pad" style="border-radius:var(--r-xl)">
          <div class="row between" style="margin-bottom:var(--s3)">
            <span class="eyebrow">Needs attention</span>
            <span class="chip ${c.attention.length ? 'warn' : 'live'}"><span class="dot"></span>${c.attention.length}</span>
          </div>
          <div class="stack gap2">
            ${c.attention.length ? c.attention.map(a => `
              <div class="lrow" style="padding:10px 0">
                <span class="pico lg" style="color:var(--warn)">${UI_ICON.box}</span>
                <div class="grow"><div class="name">${escapeHtml(a.name)}</div>
                  <div class="sub">${a.kind === 'ingredient' ? 'Ingredient' : 'Product'} · ${a.stock}${a.unit ? ' ' + escapeHtml(a.unit) : ''} left</div></div>
                <span class="chip ${a.stock <= 0 ? 'crit' : 'warn'}"><span class="dot"></span>${a.stock <= 0 ? 'Out' : 'Low'}</span>
              </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">Everything's well stocked.</p>`}
          </div>
        </div>
      </div>
    </div>`;

  root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

  M.countUp(root.querySelector('#heroRev'), c.revenueToday, { fmt: v => c.money(v), dur: 1000 });
  M.countUp(root.querySelector('#kOrders'), c.ordersToday, {});
  M.countUp(root.querySelector('#kTicket'), c.avgTicket, { fmt: v => c.money(v) });
  M.countUp(root.querySelector('#kUnits'), c.unitsToday, {});

  const sparkVals = c.series.map(s => s.revenue);
  if (sparkVals.some(v => v > 0)) CHART.spark(root.querySelector('#heroSpark'), sparkVals, { stroke: 'var(--live)', w: 320, h: 40 });
  CHART.area(root.querySelector('#revChart'), c.series.map(s => ({ label: s.short, value: s.revenue })),
    { h: 260, stroke: 'var(--ink)', labels: true, labelEvery: 2 });
  if (c.mix.length) CHART.proportion(root.querySelector('#mixBar'), c.mix);
};
