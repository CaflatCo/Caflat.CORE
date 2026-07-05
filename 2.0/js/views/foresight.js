/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · FORESIGHT   (forecasts from real sales history)
═══════════════════════════════════════════════════════════════ */
VIEWS.foresight = function (root) {
  const cov = ADAPT.coverage();
  const first = ADAPT.foresight(null);

  // Need a little history before forecasting is honest.
  if (cov.days < 3 || first.forecastable === 0) {
    emptyState(root, 'Foresight is learning your rhythm',
      `Foresight forecasts each day before it happens — what to prep, how much, and when you'll sell out — by reading your sales patterns. It needs a bit more history first ` +
      `(you have <b>${cov.orders}</b> sale${cov.orders === 1 ? '' : 's'} across <b>${cov.days}</b> day${cov.days === 1 ? '' : 's'}). ` +
      `Keep ringing sales in the classic app and this fills in within about two weeks.`,
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 3 3 7-8"/><path d="M14 4h6v6"/></svg>');
    return;
  }

  const prepped = new Set();

  root.innerHTML = `
    <div class="sec-head">
      <div>
        <span class="eyebrow"><span style="color:var(--data-2)">${UI_ICON.spark}</span> Predictive intelligence · from your sales</span>
        <h2 style="margin-top:6px">Foresight</h2>
        <p class="muted" style="max-width:54ch;margin-top:6px">Built from <b>${cov.orders}</b> real orders across <b>${cov.days}</b> days. It reads your rhythm and what's in stock, then tells you what to make and when you'll run out.</p>
      </div>
      <div class="card pad" style="border-radius:var(--r-lg);min-width:300px">
        <div class="row between" style="margin-bottom:10px"><span class="eyebrow">Planning as of</span><span class="chip live" id="asOfChip"><span class="dot"></span>—</span></div>
        <input type="range" id="asOf" min="${first.OPEN}" max="${first.CLOSE}" step="1" value="${first.hour}" style="width:100%;accent-color:var(--ink)">
        <div class="row between" style="margin-top:4px"><span class="faint" style="font-size:var(--t-2xs)">${ADAPT.hourLabel(first.OPEN)}</span><span class="faint" style="font-size:var(--t-2xs)">${ADAPT.hourLabel(first.CLOSE)}</span></div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--s6)">
      <div class="card pad lift" style="border-radius:var(--r-xl)"><span class="eyebrow">Projected close-of-day</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" id="pRev">${ADAPT.sym()}0</div><div class="cap muted">Revenue at your typical pace</div></div></div>
      <div class="card pad lift" style="border-radius:var(--r-xl);border-color:color-mix(in srgb,var(--live) 30%,var(--line))"><span class="eyebrow" style="color:var(--live)">Waste prevented</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" id="pWaste" style="color:var(--live)">${ADAPT.sym()}0</div><div class="cap muted">By right-sizing prep</div></div></div>
      <div class="card pad lift" style="border-radius:var(--r-xl);border-color:color-mix(in srgb,var(--crit) 30%,var(--line))"><span class="eyebrow" style="color:var(--crit)">Lost-sales risk</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" id="pLost" style="color:var(--crit)">${ADAPT.sym()}0</div><div class="cap muted">If you don't prep now</div></div></div>
    </div>

    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s6)">
      <div class="sec-head" style="margin-bottom:var(--s4)"><div><span class="eyebrow">Demand radar</span><h3 style="margin-top:4px">Orders by the hour</h3></div>
        <div class="row gap4"><span class="row gap2" style="font-size:var(--t-xs);color:var(--ink-3)"><span style="width:12px;height:12px;border-radius:3px;background:var(--ink)"></span>So far</span>
          <span class="row gap2" style="font-size:var(--t-xs);color:var(--ink-3)"><span style="width:12px;height:12px;border-radius:3px;background:var(--line)"></span>Expected</span></div></div>
      <div id="radar"></div>
    </div>

    <div class="grid" style="grid-template-columns:1.5fr 1fr;align-items:start">
      <div class="card pad" style="border-radius:var(--r-xl)">
        <div class="sec-head" style="margin-bottom:var(--s4)"><div><span class="eyebrow">Smart prep plan</span><h3 style="margin-top:4px">Make this, in this order</h3></div>
          <span class="chip warn" id="prepCount"><span class="dot"></span>—</span></div>
        <div id="prepList" class="stack"></div>
      </div>
      <div class="card pad" style="border-radius:var(--r-xl);border-color:color-mix(in srgb,var(--warn) 24%,var(--line))">
        <div class="row between"><span class="eyebrow" style="color:var(--warn)">Waste guard</span><span class="chip warn" id="wasteCount"><span class="dot"></span>—</span></div>
        <div id="wasteList" class="stack gap2" style="margin-top:var(--s3)"></div>
      </div>
    </div>`;

  const slider = root.querySelector('#asOf');

  function paint(asOf) {
    const f = ADAPT.foresight(asOf);
    root.querySelector('#asOfChip').innerHTML = `<span class="dot"></span>${ADAPT.hourLabel(asOf)}`;
    M.countUp(root.querySelector('#pRev'), f.projRevenue, { fmt: v => f.money(v), dur: 600 });
    M.countUp(root.querySelector('#pWaste'), f.wastePrevented, { fmt: v => f.money(v), dur: 600 });
    M.countUp(root.querySelector('#pLost'), f.lostSalesRisk, { fmt: v => f.money(v), dur: 600 });

    CHART.bars(root.querySelector('#radar'),
      f.radar.map(r => ({ label: ADAPT.hourLabel(r.hour), value: r.units, muted: !r.past, color: r.past ? 'var(--ink)' : 'var(--line)' })),
      { h: 190, fmt: v => v + ' orders' });

    const pl = root.querySelector('#prepList');
    root.querySelector('#prepCount').innerHTML = `<span class="dot"></span>${f.prepList.length} to make`;
    if (!f.prepList.length) {
      pl.innerHTML = `<div style="padding:var(--s6) 0;text-align:center;color:var(--ink-4)"><span class="pico" style="width:34px;height:34px;color:var(--live)">${UI_ICON.check}</span><div style="font-size:var(--t-sm);margin-top:10px">All caught up — prep is right-sized for the rest of the day.</div></div>`;
    } else {
      pl.innerHTML = f.prepList.map(p => {
        const done = prepped.has(p.id);
        return `<div class="lrow" style="padding:var(--s3) 0;${done ? 'opacity:.5' : ''}">
          <span class="pico xl">${prodIconFor(p.name, p.cat)}</span>
          <div class="grow"><div class="row gap2" style="align-items:baseline"><span class="name" style="font-size:var(--t-body)">${escapeHtml(p.name)}</span>
            <span class="chip ${p.status}" style="height:20px;font-size:9px"><span class="dot"></span>${p.status === 'crit' ? 'Urgent' : 'Soon'}</span>
            ${p.confident ? '' : '<span class="chip" style="height:20px;font-size:9px"><span class="dot"></span>Est</span>'}</div>
            <div class="sub">${p.selloutHour != null ? `Sells out ~<b>${ADAPT.hourLabel(p.selloutHour)}</b> · ` : ''}${p.onHand != null ? p.onHand + ' on hand · ' : ''}${p.remainingDemand} more expected</div></div>
          <div style="text-align:right;margin-right:var(--s3)"><div class="eyebrow">Make</div><div class="num serif" style="font-size:1.7rem;line-height:1;font-weight:900;letter-spacing:-0.03em">${p.recPrep}</div></div>
          <button class="btn btn-sm ${done ? 'btn-ghost' : ''}" data-prep="${p.id}">${done ? 'Queued' + UI_ICON.check : 'Prep'}</button>
        </div>`;
      }).join('');
      pl.querySelectorAll('[data-prep]').forEach(b => b.addEventListener('click', () => {
        prepped.add(b.dataset.prep);
        const it = f.prepList.find(x => x.id === b.dataset.prep);
        M.toast('Sent to kitchen', `${it.name} × ${it.recPrep} · queued for prep`, 'success');
        paint(+slider.value);
      }));
    }

    root.querySelector('#wasteCount').innerHTML = `<span class="dot"></span>${f.wasteList.length}`;
    root.querySelector('#wasteList').innerHTML = f.wasteList.length
      ? f.wasteList.map(w => `<div class="lrow" style="padding:8px 0"><span class="pico lg">${prodIconFor(w.name, w.cat)}</span>
          <div class="grow"><div class="name" style="font-size:var(--t-sm)">${escapeHtml(w.name)}</div>
            <div class="sub">${w.daySurplus} over demand${w.cost ? ' · ' + f.money(w.daySurplus * w.cost) + ' at risk' : ''}</div></div>
          <span class="chip warn" style="height:22px"><span class="dot"></span>Markdown</span></div>`).join('')
      : `<div class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">Nothing over-prepped. Clean board.</div>`;
  }

  slider.addEventListener('input', () => { S2.state.asOfHour = +slider.value; paint(+slider.value); });
  paint(+slider.value);
};
