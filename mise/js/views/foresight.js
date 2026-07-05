/* ═══════════════════════════════════════════════════════════════
   MISE — VIEW · FORESIGHT   demand radar · smart prep · waste guard
   The feature that turns "hope" into "know".
═══════════════════════════════════════════════════════════════ */
VIEWS.foresight = function (root) {
  const prepped = new Set();

  root.innerHTML = `
    <div class="sec-head">
      <div>
        <span class="eyebrow"><span style="color:var(--data-2)">${ICON.spark}</span> Predictive intelligence</span>
        <h2 style="margin-top:6px">Foresight</h2>
        <p class="muted" style="max-width:52ch;margin-top:6px">Your day, before it happens. Mise reads 14 days of rhythm, today's pace, and what's in the larder — then tells you exactly what to make, and when you'll run out.</p>
      </div>
      <div class="card pad" style="border-radius:var(--r-lg);min-width:300px">
        <div class="row between" style="margin-bottom:10px">
          <span class="eyebrow">Planning as of</span>
          <span class="chip live" id="asOfChip"><span class="dot"></span>—</span>
        </div>
        <input type="range" id="asOf" min="${DATA.OPEN}" max="${DATA.CLOSE - 1}" step="1"
          value="${STORE.state.asOfHour}" style="width:100%;accent-color:var(--ink)">
        <div class="row between" style="margin-top:4px">
          <span class="faint" style="font-size:var(--t-2xs)">${DATA.hourLabel(DATA.OPEN)}</span>
          <span class="faint" style="font-size:var(--t-2xs)">${DATA.hourLabel(DATA.CLOSE - 1)}</span>
        </div>
      </div>
    </div>

    <!-- PROJECTION STRIP -->
    <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--s6)">
      <div class="card pad lift" style="border-radius:var(--r-xl)">
        <span class="eyebrow">Projected close-of-day</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" id="pRev">$0</div>
          <div class="cap muted">Revenue at current pace</div></div>
      </div>
      <div class="card pad lift" style="border-radius:var(--r-xl);border-color:color-mix(in srgb,var(--live) 30%,var(--line))">
        <span class="eyebrow" style="color:var(--live)">Waste prevented</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" id="pWaste" style="color:var(--live)">$0</div>
          <div class="cap muted">By right-sizing prep</div></div>
      </div>
      <div class="card pad lift" style="border-radius:var(--r-xl);border-color:color-mix(in srgb,var(--crit) 30%,var(--line))">
        <span class="eyebrow" style="color:var(--crit)">Lost-sales risk</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" id="pLost" style="color:var(--crit)">$0</div>
          <div class="cap muted">If you don't prep now</div></div>
      </div>
    </div>

    <!-- RADAR -->
    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s6)">
      <div class="sec-head" style="margin-bottom:var(--s4)">
        <div><span class="eyebrow">Demand radar</span><h3 style="margin-top:4px">Orders by the hour</h3></div>
        <div class="row gap4">
          <span class="row gap2" style="font-size:var(--t-xs);color:var(--ink-3)"><span style="width:12px;height:12px;border-radius:3px;background:var(--ink)"></span>Sold</span>
          <span class="row gap2" style="font-size:var(--t-xs);color:var(--ink-3)"><span style="width:12px;height:12px;border-radius:3px;background:var(--line)"></span>Forecast</span>
        </div>
      </div>
      <div id="radar"></div>
    </div>

    <!-- PREP + IMPACT -->
    <div class="grid" style="grid-template-columns:1.5fr 1fr;align-items:start">
      <div class="card pad" style="border-radius:var(--r-xl)">
        <div class="sec-head" style="margin-bottom:var(--s4)">
          <div><span class="eyebrow">Smart prep plan</span><h3 style="margin-top:4px">Make this, in this order</h3></div>
          <span class="chip warn" id="prepCount"><span class="dot"></span>—</span>
        </div>
        <div id="prepList" class="stack"></div>
      </div>

      <div class="stack gap5">
        <div class="card pad" style="border-radius:var(--r-xl)">
          <span class="eyebrow">Larder impact</span>
          <p class="muted" style="font-size:var(--t-xs);margin:4px 0 var(--s3)">What today's prep will draw</p>
          <div id="ingList" class="stack gap2"></div>
        </div>
        <div class="card pad" style="border-radius:var(--r-xl);border-color:color-mix(in srgb,var(--warn) 24%,var(--line))">
          <div class="row between"><span class="eyebrow" style="color:var(--warn)">Waste guard</span>
            <span class="chip warn" id="wasteCount"><span class="dot"></span>—</span></div>
          <div id="wasteList" class="stack gap2" style="margin-top:var(--s3)"></div>
        </div>
      </div>
    </div>`;

  const slider = root.querySelector('#asOf');

  function paint(asOf) {
    const f = DATA.foresight(asOf);
    root.querySelector('#asOfChip').innerHTML = `<span class="dot"></span>${DATA.hourLabel(asOf)}`;

    M.countUp(root.querySelector('#pRev'), f.projRevenue, { fmt: v => '$' + Math.round(v).toLocaleString(), dur: 700 });
    M.countUp(root.querySelector('#pWaste'), f.wastePrevented, { fmt: v => '$' + Math.round(v).toLocaleString(), dur: 700 });
    M.countUp(root.querySelector('#pLost'), f.lostSalesRisk, { fmt: v => '$' + Math.round(v).toLocaleString(), dur: 700 });

    // radar bars — sold (ink) vs forecast (line), with a "now" cue
    CHART.bars(root.querySelector('#radar'),
      f.radar.map(r => ({ label: DATA.hourLabel(r.hour), value: r.forecast, muted: !r.past, color: r.past ? 'var(--ink)' : 'var(--line)' })),
      { h: 190, fmt: v => v + ' orders' });

    // prep list
    const pl = root.querySelector('#prepList');
    root.querySelector('#prepCount').innerHTML = `<span class="dot"></span>${f.prepList.length} to make`;
    if (!f.prepList.length) {
      pl.innerHTML = `<div style="padding:var(--s6) 0;text-align:center;color:var(--ink-4)">
        <span class="pico" style="width:34px;height:34px;color:var(--live)">${UI_ICON.check}</span><div style="font-size:var(--t-sm);margin-top:10px">All caught up — prep is right-sized for the rest of the day.</div></div>`;
    } else {
      pl.innerHTML = f.prepList.map(p => {
        const done = prepped.has(p.id);
        return `<div class="lrow" style="padding:var(--s3) 0;${done ? 'opacity:.5' : ''}">
          <span class="pico xl">${prodIcon(p.icon)}</span>
          <div class="grow">
            <div class="row gap2" style="align-items:baseline"><span class="name" style="font-size:var(--t-body)">${p.name}</span>
              <span class="chip ${p.status}" style="height:20px;font-size:9px"><span class="dot"></span>${p.status === 'crit' ? 'Urgent' : 'Soon'}</span></div>
            <div class="sub">Sells out ~<b>${DATA.hourLabel(p.selloutHour)}</b> · ${p.onHand} on hand · ${p.remainingDemand} more expected</div>
          </div>
          <div style="text-align:right;margin-right:var(--s3)">
            <div class="eyebrow">Make</div>
            <div class="num serif" style="font-size:1.7rem;line-height:1;font-weight:900;letter-spacing:-0.03em">${p.recPrep}</div>
          </div>
          <button class="btn btn-sm ${done ? 'btn-ghost' : ''}" data-prep="${p.id}">${done ? 'Queued' + UI_ICON.check : 'Prep'}</button>
        </div>`;
      }).join('');
      pl.querySelectorAll('[data-prep]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.prep, item = f.prepList.find(x => x.id === id);
        prepped.add(id);
        M.toast('Sent to kitchen', `${item.name} × ${item.recPrep} · queued for prep`, 'success');
        paint(+slider.value);
      }));
    }

    // ingredient impact
    root.querySelector('#ingList').innerHTML = f.ingRisk.length
      ? f.ingRisk.map(i => `
        <div class="lrow" style="padding:8px 0">
          <div class="grow"><div class="name" style="font-size:var(--t-sm)">${i.name}</div>
            <div class="sub">${i.stock}${i.unit} on hand</div></div>
          <span class="num" style="font-weight:700;${i.short ? 'color:var(--crit)' : ''}">${i.need}${i.unit}</span>
          ${i.short ? '<span class="chip crit" style="height:20px;font-size:9px"><span class="dot"></span>Short</span>' : '<span class="chip live" style="height:20px;font-size:9px"><span class="dot"></span>OK</span>'}
        </div>`).join('')
      : `<div class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">No prep needed — larder untouched.</div>`;

    // waste guard
    root.querySelector('#wasteCount').innerHTML = `<span class="dot"></span>${f.wasteList.length}`;
    root.querySelector('#wasteList').innerHTML = f.wasteList.length
      ? f.wasteList.map(w => `
        <div class="lrow" style="padding:8px 0">
          <span class="pico lg">${prodIcon(w.icon)}</span>
          <div class="grow"><div class="name" style="font-size:var(--t-sm)">${w.name}</div>
            <div class="sub">${w.surplus} over demand · ${DATA.fmt$(w.surplus * w.cost)} at risk</div></div>
          <span class="chip warn" style="height:22px"><span class="dot"></span>Markdown</span>
        </div>`).join('')
      : `<div class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">Nothing over-prepped. Clean board.</div>`;
  }

  slider.addEventListener('input', () => { STORE.state.asOfHour = +slider.value; paint(+slider.value); });
  paint(+slider.value);
};

/* ── LARDER (light companion view) ── */
VIEWS.larder = function (root) {
  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Inventory</span><h2 style="margin-top:4px">Larder</h2>
      <p class="muted" style="margin-top:6px">Live stock against par. Colour only where you need to act.</p></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
      ${DATA.ingredients.map((ing, i) => {
        const ratio = ing.stock / ing.par;
        const tone = ratio < .6 ? 'crit' : ratio < 1 ? 'warn' : 'live';
        return `<div class="card pad lift" style="border-radius:var(--r-lg);--i:${i}">
          <div class="row between"><span class="name" style="font-weight:640">${ing.name}</span>
            <span class="chip ${tone}" style="height:20px;font-size:9px"><span class="dot"></span>${tone === 'crit' ? 'Reorder' : tone === 'warn' ? 'Low' : 'Good'}</span></div>
          <div class="row" style="align-items:baseline;gap:6px;margin:var(--s3) 0 var(--s2)">
            <span class="num serif" style="font-size:1.8rem;font-weight:900;letter-spacing:-0.03em">${ing.stock}</span>
            <span class="muted num" style="font-size:var(--t-sm)">/ ${ing.par} ${ing.unit} par</span></div>
          <div class="meter ${tone}"><i style="width:${Math.min(100, ratio * 100)}%"></i></div>
        </div>`;
      }).join('')}
    </div>`;
  requestAnimationFrame(() => M.stagger(root.querySelector('.grid'), 40));
};
