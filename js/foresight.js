/* ═══════════════════════════════════════════════════════
   FORESIGHT.JS — Demand forecasting (PRO)
   Ported from the Caflat 2.0 prototype adapter: weekday-mean
   demand + historical hourly curves → smart prep list, demand
   radar, and waste guard. Reads the same live APP_STATE.
═══════════════════════════════════════════════════════ */

const FORESIGHT = (() => {
  const OPEN = 6, CLOSE = 22;
  const g = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };

  const allSales   = () => g(() => (typeof getSales === 'function' ? getSales() : APP_STATE.sales) || [], []);
  const allProds   = () => g(() => (typeof getProducts === 'function' ? getProducts() : APP_STATE.products) || [], []);
  const isDone     = s => String(s.status || '').toUpperCase() === 'COMPLETED';
  const saleTime   = s => new Date(s.audit?.completedAt || s.completedAt || s.createdAt || s.audit?.createdAt || Date.now());
  const dayKey     = d => d.toISOString().slice(0, 10);

  function coverage() {
    const done = allSales().filter(isDone);
    const days = new Set(done.map(s => dayKey(saleTime(s)))).size;
    return { orders: done.length, days, hasData: done.length > 0 };
  }

  function compute(asOfHour) {
    const now = new Date();
    const weekday = now.getDay();
    const hour = asOfHour == null ? now.getHours() : asOfHour;
    const done = allSales().filter(isDone);
    const cov = coverage();

    // Per-product history: units by (weekday|day) and by hour
    const hist = {};
    done.forEach(s => {
      const t = saleTime(s); const wd = t.getDay(); const h = t.getHours(); const dk = dayKey(t);
      (s.items || []).forEach(it => {
        const pid = String(it.productId); const q = Number(it.quantity || it.qty || 0);
        if (!pid || !q) return;
        const H = hist[pid] || (hist[pid] = { perDay: {}, byHour: {}, days: new Set() });
        const dayk = wd + '|' + dk;
        H.perDay[dayk] = (H.perDay[dayk] || 0) + q;
        H.byHour[h] = (H.byHour[h] || 0) + q;
        H.days.add(dk);
      });
    });

    const todayK = dayKey(now);
    const soldTodayByPid = {};
    done.filter(s => dayKey(saleTime(s)) === todayK).forEach(s =>
      (s.items || []).forEach(it => {
        const pid = String(it.productId);
        soldTodayByPid[pid] = (soldTodayByPid[pid] || 0) + Number(it.quantity || it.qty || 0);
      }));

    const items = allProds().map(prod => {
      const pid = String(prod.id);
      const H = hist[pid];
      if (!H || H.days.size === 0) return null;

      const rawStock = Number(prod.stock);
      const madeToOrder = Number(prod.batchSize ?? prod.batch) === 0 ||
                          (Number.isFinite(rawStock) && rawStock >= 900);
      const effStock = g(() => (typeof getEffectiveStock === 'function' ? getEffectiveStock(prod) : rawStock), rawStock);
      const onHand = madeToOrder ? null : (Number.isFinite(effStock) ? effStock : null);

      const wdDays = Object.entries(H.perDay).filter(([k]) => k.startsWith(weekday + '|')).map(([, v]) => v);
      const allDays = Object.values(H.perDay);
      const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const expectedToday = Math.round((wdDays.length >= 2 ? mean(wdDays) : mean(allDays)) * 10) / 10;
      if (expectedToday <= 0) return null;

      const hourTotal = Object.values(H.byHour).reduce((a, b) => a + b, 0) || 1;
      const cumFrac = uptoH => {
        let s = 0; for (let h = OPEN; h <= uptoH; h++) s += (H.byHour[h] || 0);
        return s / hourTotal;
      };
      const estByHour = Math.round(expectedToday * cumFrac(hour) * 10) / 10;
      const soldSoFar = (asOfHour == null && soldTodayByPid[pid] != null) ? soldTodayByPid[pid] : estByHour;
      const remainingDemand = Math.max(0, Math.round((expectedToday - soldSoFar) * 10) / 10);

      let selloutHour = null;
      if (onHand != null) {
        for (let h = hour; h <= CLOSE; h++) {
          const cum = Math.max(0, expectedToday * cumFrac(h) - soldSoFar);
          if (cum >= onHand) { selloutHour = h; break; }
        }
      }
      const shortfall = onHand == null ? 0 : Math.max(0, Math.round(remainingDemand - onHand));
      const daySurplus = onHand == null ? 0 : Math.max(0, Math.round(onHand - expectedToday));
      const batch = Number(prod.batchSize || prod.batch || 1) || 1;
      const recPrep = shortfall > 0 ? Math.ceil(shortfall / batch) * batch : 0;

      let status = 'ok';
      if (shortfall > 0 && selloutHour != null && selloutHour <= hour + 2) status = 'crit';
      else if (shortfall > 0) status = 'warn';
      else if (daySurplus > 0) status = 'waste';

      return {
        id: pid, name: prod.name, price: Number(prod.price || 0), cost: Number(prod.cost || 0),
        onHand, expectedToday, soldSoFar: Math.round(soldSoFar),
        remainingDemand, shortfall, daySurplus, selloutHour, recPrep, status,
        confident: wdDays.length >= 2,
      };
    }).filter(Boolean);

    // Demand radar — expected units by hour across all forecastable products
    const radar = [];
    for (let h = OPEN; h <= CLOSE; h++) {
      let units = 0;
      items.forEach(it => {
        const H = hist[it.id]; if (!H) return;
        const hourTotal = Object.values(H.byHour).reduce((a, b) => a + b, 0) || 1;
        units += it.expectedToday * ((H.byHour[h] || 0) / hourTotal);
      });
      radar.push({ hour: h, units: Math.round(units * 10) / 10, past: h <= hour });
    }
    const firstH = radar.findIndex(r => r.units > 0);
    const lastH = radar.length - 1 - [...radar].reverse().findIndex(r => r.units > 0);
    const radarTrim = firstH >= 0 ? radar.slice(firstH, lastH + 1) : radar;

    const prepList  = items.filter(i => i.recPrep > 0).sort((a, b) => (a.selloutHour ?? 99) - (b.selloutHour ?? 99));
    const wasteList = items.filter(i => i.status === 'waste').sort((a, b) => b.daySurplus - a.daySurplus);
    const projRevenue    = Math.round(items.reduce((a, i) => a + i.expectedToday * i.price, 0));
    const wastePrevented = Math.round(wasteList.reduce((a, i) => a + i.daySurplus * i.cost, 0));
    const lostSalesRisk  = Math.round(prepList.reduce((a, i) => a + i.shortfall * i.price, 0));

    return { hour, weekday, items, radar: radarTrim, prepList, wasteList,
             projRevenue, wastePrevented, lostSalesRisk, coverage: cov,
             forecastable: items.length, OPEN, CLOSE };
  }

  return { compute, coverage, OPEN, CLOSE };
})();

/* ── View ──────────────────────────────────────────── */
function _fsHourLabel(h) {
  if (h == null) return '—';
  return h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? (h - 12) + ' PM' : h + ' AM';
}
function _fsMoney(n) {
  return typeof formatCurrency === 'function' ? formatCurrency(n) : '₱' + Math.round(n).toLocaleString();
}
function _fsEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _fsDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
// Theme-aware palette (same pattern as the dashboard/reports chart re-render)
function _fsPalette() {
  const dark = _fsDark();
  return dark ? {
    critBg: 'rgba(220,38,38,.14)', critBorder: '#b91c1c', critText: '#f87171',
    amberBg: 'rgba(245,158,11,.12)', amberBorder: '#b45309', amberText: '#fbbf24',
    barFuture: 'linear-gradient(180deg,#f4f2ee,#a8a29e)',
    chipBg: '#f4f2ee', chipText: '#0c0b0a',
  } : {
    critBg: '#fef2f2', critBorder: '#fca5a5', critText: '#dc2626',
    amberBg: '#fffbeb', amberBorder: '#f59e0b', amberText: '#92400e',
    barFuture: 'linear-gradient(180deg,#0f0f0f,#3f3f3f)',
    chipBg: '#0f0f0f', chipText: '#fff',
  };
}

function renderForesight() {
  const box = document.getElementById('foresightBody');
  if (!box) return;

  const f = FORESIGHT.compute();
  const cov = f.coverage;
  const pal = _fsPalette();

  if (!cov.hasData || f.forecastable === 0) {
    box.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--gray-400);">
        <div style="font-size:14px;font-weight:800;color:var(--gray-600);margin-bottom:6px;">
          Foresight is watching your counter</div>
        <div style="font-size:12px;line-height:1.7;max-width:420px;margin:0 auto;">
          Every completed sale teaches it your café's rhythm. Once there's
          sales history, it forecasts today's demand per product, tells you
          what to prep before the rush, and flags overstock before it
          becomes waste.
        </div>
      </div>`;
    return;
  }

  const learning = cov.days < 14 ? `
    <div style="padding:10px 14px;border-radius:var(--radius-md);margin-bottom:16px;
      background:${pal.amberBg};border:1.5px solid ${pal.amberBorder};color:${pal.amberText};font-size:11.5px;font-weight:600;">
      Still learning — ${cov.days} day${cov.days === 1 ? '' : 's'} of history so far.
      Forecasts sharpen noticeably after two full weeks.
    </div>` : '';

  const statCards = `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
      <div class="stat-card dark">
        <div class="label">Projected Revenue Today</div>
        <div class="value">${_fsMoney(f.projRevenue)}</div>
        <div class="sub">${f.forecastable} forecastable products</div>
      </div>
      <div class="stat-card">
        <div class="label">Lost-Sales Risk</div>
        <div class="value" style="color:${f.lostSalesRisk > 0 ? pal.critText : 'inherit'};">${_fsMoney(f.lostSalesRisk)}</div>
        <div class="sub">${f.prepList.length} product${f.prepList.length === 1 ? '' : 's'} may sell out</div>
      </div>
      <div class="stat-card">
        <div class="label">Waste Risk</div>
        <div class="value" style="color:${f.wastePrevented > 0 ? pal.amberText : 'inherit'};">${_fsMoney(f.wastePrevented)}</div>
        <div class="sub">${f.wasteList.length} product${f.wasteList.length === 1 ? '' : 's'} overstocked</div>
      </div>
    </div>`;

  const maxUnits = Math.max(1, ...f.radar.map(r => r.units));
  const radarHtml = `
    <div style="border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px;margin-bottom:20px;background:var(--white);">
      <div style="font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:12px;">
        Demand Radar · expected units by hour (today)</div>
      <div style="display:flex;align-items:flex-end;justify-content:center;gap:6px;height:90px;">
        ${f.radar.map(r => `
          <div style="flex:1;max-width:72px;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end;" title="${r.units} units">
            <div style="width:100%;min-height:3px;height:${Math.max(3, Math.round(r.units / maxUnits * 100))}%;
              border-radius:5px 5px 2px 2px;
              background:${r.past ? 'var(--gray-200)' : pal.barFuture};"></div>
            <div style="font-size:9px;font-weight:700;color:var(--gray-400);white-space:nowrap;">${_fsHourLabel(r.hour).replace(' ', '')}</div>
          </div>`).join('')}
      </div>
    </div>`;

  const prepRows = f.prepList.length ? f.prepList.map(i => `
    <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border:1.5px solid ${i.status === 'crit' ? pal.critBorder : 'var(--border)'};
      border-radius:var(--radius-md);margin-bottom:8px;background:${i.status === 'crit' ? pal.critBg : 'var(--white)'};">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:800;">${_fsEsc(i.name)}</div>
        <div style="font-size:11px;color:var(--gray-500);margin-top:2px;">
          ${i.onHand} on hand · expects ${i.expectedToday} today${i.selloutHour != null ? ` · sells out ~${_fsHourLabel(i.selloutHour)}` : ''}</div>
      </div>
      <div style="font-size:13px;font-weight:900;white-space:nowrap;
        color:${i.status === 'crit' ? pal.critText : 'var(--black)'};">Prep +${i.recPrep}</div>
    </div>`).join('') : `
    <div style="font-size:12px;color:var(--gray-400);padding:14px;">Nothing needs prepping — stock covers today's expected demand.</div>`;

  const wasteRows = f.wasteList.length ? f.wasteList.map(i => `
    <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border:1.5px solid var(--border);
      border-radius:var(--radius-md);margin-bottom:8px;background:var(--white);">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:800;">${_fsEsc(i.name)}</div>
        <div style="font-size:11px;color:var(--gray-500);margin-top:2px;">
          ${i.onHand} on hand · expects only ${i.expectedToday} today</div>
      </div>
      <div style="font-size:13px;font-weight:900;color:${pal.amberText};white-space:nowrap;">+${i.daySurplus} extra</div>
    </div>`).join('') : `
    <div style="font-size:12px;color:var(--gray-400);padding:14px;">No overstock flagged for today.</div>`;

  box.innerHTML = `
    ${learning}
    ${statCards}
    ${radarHtml}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:10px;">
          Smart Prep · make these before the rush</div>
        ${prepRows}
      </div>
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:10px;">
          Waste Guard · overstocked today</div>
        ${wasteRows}
      </div>
    </div>`;
}

/* ── Dashboard teaser card ─────────────────────────── */
function renderForesightTeaser() {
  const box = document.getElementById('foresightTeaser');
  if (!box) return;

  const pro = typeof isProTier === 'function' ? isProTier() : false;
  const pal = _fsPalette();
  if (!pro) {
    box.innerHTML = `
      <div style="border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px;
        margin-top:16px;background:var(--gray-50);display:flex;align-items:center;gap:14px;cursor:pointer;"
        onclick="if(typeof requireTier==='function')requireTier('pro','Foresight forecasting')">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:800;">Foresight · Tomorrow's prep, computed
            <span style="font-size:9px;font-weight:900;padding:2px 7px;border-radius:999px;background:${pal.chipBg};color:${pal.chipText};letter-spacing:1px;margin-left:6px;">PRO</span>
          </div>
          <div style="font-size:11px;color:var(--gray-500);margin-top:3px;filter:blur(3px);user-select:none;">
            Bake 24 more croissants before 10 AM · Cold brew sells out by 2 PM</div>
        </div>
        <span style="font-size:18px;">🔒</span>
      </div>`;
    return;
  }

  const f = FORESIGHT.compute();
  const top = f.prepList[0];
  const line = top
    ? `Prep +${top.recPrep} ${_fsEsc(top.name)}${top.selloutHour != null ? ` — projected to sell out around ${_fsHourLabel(top.selloutHour)}` : ''}`
    : (f.forecastable > 0
        ? 'Stock covers today\'s expected demand. Nothing to prep.'
        : 'Learning your rhythm — forecasts appear as sales history builds.');

  box.innerHTML = `
    <div style="border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px;
      margin-top:16px;background:var(--gray-50);display:flex;align-items:center;gap:14px;cursor:pointer;"
      onclick="switchPage('foresight')">
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:800;">Foresight</div>
        <div style="font-size:12px;color:${top ? 'var(--black)' : 'var(--gray-500)'};margin-top:3px;font-weight:${top ? '700' : '400'};">
          ${line}</div>
      </div>
      <span style="font-size:11px;font-weight:800;color:var(--gray-400);white-space:nowrap;">Open →</span>
    </div>`;
}

/* ── Re-render on theme change (same pattern as dashboard/reports charts) ── */
new MutationObserver(() => {
  if (document.getElementById('view-foresight')?.classList.contains('active')) renderForesight();
  if (document.getElementById('foresightTeaser')?.innerHTML) renderForesightTeaser();
}).observe(document.documentElement, { attributeFilter: ['data-theme'] });

window.FORESIGHT             = FORESIGHT;
window.renderForesight       = renderForesight;
window.renderForesightTeaser = renderForesightTeaser;
