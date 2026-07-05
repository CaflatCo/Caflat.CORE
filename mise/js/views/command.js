/* ═══════════════════════════════════════════════════════════════
   MISE — VIEW · COMMAND   the morning briefing
═══════════════════════════════════════════════════════════════ */
VIEWS.command = function (root) {
  const f = DATA.foresight(STORE.state.asOfHour);
  const hist = DATA.history;
  const todayH = hist[hist.length - 1];
  const lastWeek = hist[hist.length - 8] || hist[0];
  const revDelta = ((f.projRevenue - lastWeek.revenue) / lastWeek.revenue) * 100;
  const mix = DATA.categoryMix();
  const avgTicket = f.projRevenue / todayH.orders;

  const firstSellout = f.prepList[0];
  const shortIng = f.ingRisk.find(i => i.short);

  // Briefing sentence — the app talking to the owner
  const briefing = [
    `${DATA.today.toLocaleDateString('en-US', { weekday: 'long' })} runs hot.`,
    `You're tracking <b>${DATA.fmt$(f.projRevenue)}</b>, ${revDelta >= 0 ? 'up' : 'down'} <b>${Math.abs(revDelta).toFixed(0)}%</b> on last ${todayH.short}.`,
    f.prepList.length
      ? `<b>${f.prepList.length} item${f.prepList.length > 1 ? 's' : ''}</b> need prep${firstSellout ? ` — ${firstSellout.name} is on track to sell out by <b>${DATA.hourLabel(firstSellout.selloutHour)}</b>` : ''}.`
      : `Prep is on track across the board.`,
    shortIng ? `You're light on <b>${shortIng.name}</b>.` : '',
  ].filter(Boolean).join(' ');

  root.innerHTML = `
    <!-- HERO -->
    <div class="grid" style="grid-template-columns: 1.55fr 1fr; align-items:stretch; margin-bottom:var(--s6)">
      <div class="card-ink card pad" style="display:flex;flex-direction:column;justify-content:space-between;gap:var(--s5);border-radius:var(--r-xl);overflow:hidden;position:relative">
        <div style="position:absolute;right:-24px;top:-24px;width:200px;height:200px;opacity:.07;color:var(--paper)">${UI_ICON.cup}</div>
        <div>
          <span class="eyebrow">Morning Briefing · ${DATA.today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          <h1 class="display" style="color:var(--paper);margin-top:var(--s3);font-size:var(--t-h1);max-width:22ch">Good morning, Camille.</h1>
        </div>
        <p class="serif" style="font-size:1.35rem;line-height:1.45;color:color-mix(in srgb,var(--paper) 92%,transparent);max-width:40ch">${briefing}</p>
        <div class="row gap3">
          <button class="btn" data-cmd-go="foresight" style="background:var(--paper);color:var(--ink)">Open Foresight ${ICON.arrow}</button>
          <button class="btn btn-ghost" data-cmd-go="service" style="border-color:color-mix(in srgb,var(--paper) 28%,transparent);color:var(--paper)">Start service</button>
        </div>
      </div>

      <div class="card pad lift" style="border-radius:var(--r-xl);display:flex;flex-direction:column;justify-content:space-between">
        <div class="between row">
          <span class="eyebrow">Projected today</span>
          <span class="chip live"><span class="dot"></span>Live</span>
        </div>
        <div class="metric" style="margin:var(--s4) 0">
          <div class="val num" id="heroRev">$0</div>
          <div class="cap"><span class="delta ${revDelta >= 0 ? 'up' : 'down'}">${revDelta >= 0 ? ICON.up : ICON.down}${Math.abs(revDelta).toFixed(1)}%</span><span class="muted">vs last ${todayH.short}</span></div>
        </div>
        <div id="heroSpark"></div>
        <div class="hr"></div>
        <div class="row between">
          <div class="metric"><div class="cap eyebrow">Orders</div><div class="num" style="font-size:1.4rem;font-weight:700" id="kOrders">0</div></div>
          <div class="metric"><div class="cap eyebrow">Avg ticket</div><div class="num" style="font-size:1.4rem;font-weight:700" id="kTicket">$0</div></div>
          <div class="metric"><div class="cap eyebrow">Covers</div><div class="num" style="font-size:1.4rem;font-weight:700" id="kCovers">0</div></div>
        </div>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="grid" style="grid-template-columns: 1.55fr 1fr">
      <div class="card pad" style="border-radius:var(--r-xl)">
        <div class="sec-head" style="margin-bottom:var(--s4)">
          <div><span class="eyebrow">Revenue</span><h3 style="margin-top:4px">Last 14 days</h3></div>
          <div class="seg" id="revSeg"><span class="thumb"></span>
            <button class="on" data-seg="rev">Revenue</button><button data-seg="ord">Orders</button></div>
        </div>
        <div id="revChart"></div>
      </div>

      <div class="stack gap5">
        <div class="card pad" style="border-radius:var(--r-xl)">
          <span class="eyebrow">Where the money comes from</span>
          <div style="margin:var(--s4) 0 var(--s3)"><div id="mixBar"></div></div>
          <div class="stack">
            ${mix.map((m, i) => `
              <div class="lrow" style="padding:8px 0">
                <span style="width:9px;height:9px;border-radius:3px;background:${['var(--ink)', 'var(--ink-2)', 'var(--ink-3)', 'var(--ink-4)'][i] || 'var(--line)'}"></span>
                <span class="grow name">${m.cat}</span>
                <span class="num muted" style="font-size:var(--t-sm)">${(m.pct * 100).toFixed(0)}%</span>
                <span class="num" style="font-weight:700;min-width:64px;text-align:right">${DATA.fmt$(m.value)}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="card pad" style="border-radius:var(--r-xl)">
          <div class="row between" style="margin-bottom:var(--s3)">
            <span class="eyebrow">Needs attention</span>
            <span class="chip ${f.prepList.length ? 'warn' : 'live'}"><span class="dot"></span>${f.prepList.length + (shortIng ? 1 : 0)} open</span>
          </div>
          <div class="stack gap2">
            ${f.prepList.slice(0, 3).map(p => `
              <div class="lrow" style="padding:10px 0">
                <span class="pico lg">${prodIcon(p.icon)}</span>
                <div class="grow"><div class="name">${p.name}</div>
                  <div class="sub">Sells out ~${DATA.hourLabel(p.selloutHour)} · prep <b>${p.recPrep}</b></div></div>
                <span class="chip ${p.status}"><span class="dot"></span>${p.status === 'crit' ? 'Urgent' : 'Prep'}</span>
              </div>`).join('')}
            ${shortIng ? `
              <div class="lrow" style="padding:10px 0">
                <span class="pico lg" style="color:var(--crit)">${UI_ICON.box}</span>
                <div class="grow"><div class="name">${shortIng.name} low</div>
                  <div class="sub">Need ${shortIng.need}${shortIng.unit} for today's prep · ${shortIng.stock}${shortIng.unit} on hand</div></div>
                <span class="chip crit"><span class="dot"></span>Order</span>
              </div>` : ''}
          </div>
        </div>
      </div>
    </div>`;

  // interactions
  root.querySelectorAll('[data-cmd-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.cmdGo)));

  // animate numbers
  M.countUp(root.querySelector('#heroRev'), f.projRevenue, { fmt: v => '$' + Math.round(v).toLocaleString(), dur: 1100 });
  M.countUp(root.querySelector('#kOrders'), todayH.orders, {});
  M.countUp(root.querySelector('#kTicket'), avgTicket, { fmt: v => '$' + v.toFixed(2) });
  M.countUp(root.querySelector('#kCovers'), todayH.covers, {});

  CHART.spark(root.querySelector('#heroSpark'), hist.map(h => h.revenue), { stroke: 'var(--live)', w: 320, h: 40 });
  const drawChart = (key) => CHART.area(root.querySelector('#revChart'),
    hist.map(h => ({ label: h.short, value: key === 'rev' ? h.revenue : h.orders })),
    { h: 260, stroke: 'var(--ink)', labels: true, labelEvery: 2 });
  drawChart('rev');
  CHART.proportion(root.querySelector('#mixBar'), mix);

  // segmented control
  const seg = root.querySelector('#revSeg');
  requestAnimationFrame(() => M.segThumb(seg));
  seg.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    seg.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    btn.classList.add('on'); M.segThumb(seg); drawChart(btn.dataset.seg);
  }));
};
