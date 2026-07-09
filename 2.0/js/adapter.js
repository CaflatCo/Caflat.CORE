/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — ADAPTER
   Reads the REAL app state (same localStorage: caflat_pos_v1) and
   derives Command + Foresight metrics. No demo data — this is your
   actual sales, products and inventory, seen through Mise.
═══════════════════════════════════════════════════════════════ */
const ADAPT = (() => {
  const OPEN = 6, CLOSE = 22;                 // widest plausible service window
  const g = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };

  const sales       = () => g(() => (typeof getSales === 'function' ? getSales() : APP_STATE.sales) || [], []);
  const products    = () => g(() => (typeof getProducts === 'function' ? getProducts() : APP_STATE.products) || [], []);
  const ingredients = () => g(() => (typeof getIngredients === 'function' ? getIngredients() : APP_STATE.ingredients) || [], []);
  const categories  = () => g(() => (typeof getCategories === 'function' ? getCategories() : []), []);

  const isDone = s => String(s.status || '').toUpperCase() === 'COMPLETED';
  const saleTime = s => new Date(s.audit?.completedAt || s.completedAt || s.createdAt || s.audit?.createdAt || Date.now());
  const saleTotal = s => Number(s.totals?.total ?? s.total ?? 0);
  const dayKey = d => d.toISOString().slice(0, 10);
  const money = n => (typeof formatCurrency === 'function' ? formatCurrency(n) : '$' + Math.round(n).toLocaleString());
  const sym = () => g(() => (typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$'), '$');

  const productById = id => products().find(p => String(p.id) === String(id));
  const catOf = p => (p ? p.category : null) || 'Uncategorised';

  /* ── Whether we have enough to be useful ── */
  function coverage() {
    const done = sales().filter(isDone);
    const days = new Set(done.map(s => dayKey(saleTime(s)))).size;
    return { orders: done.length, days, hasData: done.length > 0 };
  }

  /* ── COMMAND ──────────────────────────────────────────────── */
  function command() {
    const done = sales().filter(isDone);
    const now = new Date();
    const todayK = dayKey(now);

    const todays = done.filter(s => dayKey(saleTime(s)) === todayK);
    const revenueToday = todays.reduce((a, s) => a + saleTotal(s), 0);
    const ordersToday = todays.length;
    const unitsToday = todays.reduce((a, s) => a + (s.items || []).reduce((x, i) => x + Number(i.quantity || i.qty || 0), 0), 0);
    const avgTicket = ordersToday ? revenueToday / ordersToday : 0;

    // last-14-day revenue series
    const series = [];
    for (let d = 13; d >= 0; d--) {
      const day = new Date(now); day.setDate(now.getDate() - d);
      const k = dayKey(day);
      const rev = done.filter(s => dayKey(saleTime(s)) === k).reduce((a, s) => a + saleTotal(s), 0);
      series.push({ key: k, short: day.toLocaleDateString('en-US', { weekday: 'short' }),
        label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: Math.round(rev),
        orders: done.filter(s => dayKey(saleTime(s)) === k).length });
    }
    // same weekday last week for delta
    const lwIdx = series.length - 8;
    const lastWeek = series[lwIdx] || { revenue: 0, short: series[0]?.short };
    const revDelta = lastWeek.revenue > 0 ? ((series[series.length - 1].revenue - lastWeek.revenue) / lastWeek.revenue) * 100 : null;

    // category mix (by revenue) from today, else all-time
    const mixSrc = todays.length ? todays : done;
    const mixMap = {};
    mixSrc.forEach(s => (s.items || []).forEach(it => {
      const p = productById(it.productId);
      const cat = catOf(p);
      mixMap[cat] = (mixMap[cat] || 0) + Number(it.total ?? (Number(it.price || 0) * Number(it.quantity || 0)));
    }));
    const mixTotal = Object.values(mixMap).reduce((a, b) => a + b, 0) || 1;
    const mix = Object.entries(mixMap).map(([cat, v]) => ({ cat, value: Math.round(v), pct: v / mixTotal }))
      .sort((a, b) => b.value - a.value).slice(0, 6);

    // low-stock attention (FG-aware: routes to the finished-goods ledger for
    // finished_goods-category products, same as the classic POS's stock checks)
    const thr = Number(APP_STATE.settings?.lowStockThreshold ?? 5);
    const stockOf = p => g(() => (typeof getEffectiveStock === 'function' ? getEffectiveStock(p) : Number(p.stock)), Number(p.stock));
    const lowProducts = products().filter(p => p.trackStock !== false && Number(p.stock) < 900 && Number.isFinite(stockOf(p)) && stockOf(p) <= thr)
      .map(p => ({ name: p.name, stock: stockOf(p), kind: 'product' }));
    const lowIng = ingredients().filter(i => Number.isFinite(Number(i.stock)) && Number(i.stock) <= thr)
      .map(i => ({ name: i.name, stock: Number(i.stock), unit: i.unit, kind: 'ingredient' }));
    const attention = [...lowProducts, ...lowIng].slice(0, 6);

    return {
      revenueToday, ordersToday, unitsToday, avgTicket, series, revDelta, lastWeekShort: lastWeek.short,
      mix, attention, brand: APP_STATE.settings?.brandName || 'Caflat.CORE', money, sym: sym(),
      coverage: coverage(),
    };
  }

  /* ── FORESIGHT (real history) ─────────────────────────────── */
  /* Derive per-product demand from actual sales grouped by weekday + hour. */
  function foresight(asOfHour) {
    const now = new Date();
    const weekday = now.getDay();
    const hour = asOfHour == null ? now.getHours() : asOfHour;
    const done = sales().filter(isDone);
    const cov = coverage();

    // Build per-product history: units by (weekday, hour)
    const hist = {};   // pid -> { byWeekday:{wd:[unitsPerOccurrence...]}, byHour:{h:units}, days:Set }
    done.forEach(s => {
      const t = saleTime(s); const wd = t.getDay(); const h = t.getHours(); const dk = dayKey(t);
      (s.items || []).forEach(it => {
        const pid = String(it.productId); const q = Number(it.quantity || it.qty || 0);
        if (!pid || !q) return;
        const H = hist[pid] || (hist[pid] = { perDay: {}, byHour: {}, days: new Set() });
        const dayk = wd + '|' + dk;
        H.perDay[dayk] = (H.perDay[dayk] || 0) + q;   // units that product sold that specific day
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

    const items = products().map(prod => {
      const pid = String(prod.id);
      const H = hist[pid];
      if (!H || H.days.size === 0) return null; // no history → can't forecast this product
      // Made-to-order (no meaningful prepared stock): unlimited/sentinel stock or
      // an explicit batch size of 0 → forecast revenue but never flag prep/waste.
      const rawStock = Number(prod.stock);
      const madeToOrder = Number(prod.batchSize ?? prod.batch) === 0 || (Number.isFinite(rawStock) && rawStock >= 900);
      // FG-aware: finished_goods-category products keep their real stock in the
      // separate FG ledger, not product.stock — same accessor the classic POS uses.
      const effStock = g(() => (typeof getEffectiveStock === 'function' ? getEffectiveStock(prod) : rawStock), rawStock);
      const onHand = madeToOrder ? null : (Number.isFinite(effStock) ? effStock : null);

      // expected units for today's weekday = mean of that weekday's daily totals (fallback: overall daily mean)
      const wdDays = Object.entries(H.perDay).filter(([k]) => k.startsWith(weekday + '|')).map(([, v]) => v);
      const allDays = Object.values(H.perDay);
      const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const expectedToday = Math.round((wdDays.length >= 2 ? mean(wdDays) : mean(allDays)) * 10) / 10;
      if (expectedToday <= 0) return null;

      // hourly curve from history
      const hourTotal = Object.values(H.byHour).reduce((a, b) => a + b, 0) || 1;
      const cumFrac = (uptoH) => {
        let s = 0; for (let h = OPEN; h <= uptoH; h++) s += (H.byHour[h] || 0);
        return s / hourTotal;
      };
      // sold-by-the-scrubbed-hour, from the real historical hour curve (so the
      // slider drives the projection consistently). soldTodayByPid holds ACTUAL
      // today's sales, used only when planning "as of now" at the live hour.
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
        cat: catOf(prod), onHand, expectedToday, soldSoFar: Math.round(soldSoFar),
        remainingDemand, shortfall, daySurplus, selloutHour, recPrep, status,
        confident: wdDays.length >= 2,
      };
    }).filter(Boolean);

    // demand radar — total expected orders by hour (from all products' hour curves, scaled)
    const radar = [];
    for (let h = OPEN; h <= CLOSE; h++) {
      let units = 0;
      items.forEach(it => {
        const H = hist[it.id]; if (!H) return;
        const hourTotal = Object.values(H.byHour).reduce((a, b) => a + b, 0) || 1;
        units += it.expectedToday * ((H.byHour[h] || 0) / hourTotal);
      });
      radar.push({ hour: h, units: Math.round(units), past: h <= hour });
    }
    // trim radar to hours that actually have demand
    const firstH = radar.findIndex(r => r.units > 0);
    const lastH = radar.length - 1 - [...radar].reverse().findIndex(r => r.units > 0);
    const radarTrim = firstH >= 0 ? radar.slice(firstH, lastH + 1) : radar;

    const prepList = items.filter(i => i.recPrep > 0).sort((a, b) => (a.selloutHour ?? 99) - (b.selloutHour ?? 99));
    const wasteList = items.filter(i => i.status === 'waste').sort((a, b) => b.daySurplus - a.daySurplus);
    const projRevenue = Math.round(items.reduce((a, i) => a + i.expectedToday * i.price, 0));
    const wastePrevented = Math.round(wasteList.reduce((a, i) => a + i.daySurplus * i.cost, 0));
    const lostSalesRisk = Math.round(prepList.reduce((a, i) => a + i.shortfall * i.price, 0));

    return {
      hour, weekday, items, radar: radarTrim, prepList, wasteList,
      projRevenue, wastePrevented, lostSalesRisk, money, coverage: cov,
      forecastable: items.length, OPEN, CLOSE,
    };
  }

  const hourLabel = h => (h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? (h - 12) + 'p' : h + 'a');

  /* ── REPORTS (real sales history, any date range) ─────────── */
  function reports(days = 30) {
    const all = sales();
    const now = new Date();
    const since = days === 'all' ? null : (() => { const d = new Date(now); d.setDate(d.getDate() - (Number(days) - 1)); d.setHours(0, 0, 0, 0); return d; })();
    const inRange = s => !since || saleTime(s) >= since;

    const ranged = all.filter(inRange);
    const done = ranged.filter(isDone);
    const voided = ranged.filter(s => String(s.status || '').toUpperCase() === 'VOIDED');
    const refunded = ranged.filter(s => String(s.status || '').toUpperCase() === 'REFUNDED');

    const revenue = done.reduce((a, s) => a + saleTotal(s), 0);
    const orders = done.length;
    const avgTicket = orders ? revenue / orders : 0;
    const voidRefundRate = ranged.length ? ((voided.length + refunded.length) / ranged.length) * 100 : 0;

    // daily revenue series across the range (capped at 60 points for very wide ranges)
    const dayCount = since ? Math.min(60, Math.ceil((now - since) / 86400000) + 1) : Math.min(60, coverage().days || 1);
    const series = [];
    for (let d = dayCount - 1; d >= 0; d--) {
      const day = new Date(now); day.setDate(now.getDate() - d);
      const k = dayKey(day);
      const dayDone = done.filter(s => dayKey(saleTime(s)) === k);
      series.push({ key: k, label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.round(dayDone.reduce((a, s) => a + saleTotal(s), 0)), orders: dayDone.length });
    }

    // category mix (by revenue)
    const mixMap = {};
    done.forEach(s => (s.items || []).forEach(it => {
      const p = productById(it.productId);
      const cat = catOf(p);
      mixMap[cat] = (mixMap[cat] || 0) + Number(it.total ?? (Number(it.price || 0) * Number(it.quantity || it.qty || 0)));
    }));
    const mixTotal = Object.values(mixMap).reduce((a, b) => a + b, 0) || 1;
    const mix = Object.entries(mixMap).map(([cat, v]) => ({ cat, value: Math.round(v), pct: v / mixTotal }))
      .sort((a, b) => b.value - a.value);

    // top products (by revenue)
    const prodMap = {};
    done.forEach(s => (s.items || []).forEach(it => {
      const pid = String(it.productId); const name = it.name || productById(pid)?.name || 'Unknown';
      const qty = Number(it.quantity || it.qty || 0);
      const rev = Number(it.total ?? (Number(it.price || 0) * qty));
      const e = prodMap[pid] || (prodMap[pid] = { id: pid, name, qty: 0, revenue: 0 });
      e.qty += qty; e.revenue += rev;
    }));
    const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // payment method breakdown
    const pmMap = {};
    done.forEach(s => {
      const m = String(s.payment?.method || s.paymentMethod || 'cash').toUpperCase();
      pmMap[m] = (pmMap[m] || 0) + saleTotal(s);
    });
    const paymentMix = Object.entries(pmMap).map(([method, value]) => ({ method, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    // channel breakdown (POS vs SUPPLY etc.)
    const chMap = {};
    done.forEach(s => {
      const c = String(s.channel || 'POS').toUpperCase();
      const e = chMap[c] || (chMap[c] = { channel: c, revenue: 0, orders: 0 });
      e.revenue += saleTotal(s); e.orders += 1;
    });
    const channelMix = Object.values(chMap).map(c => ({ ...c, revenue: Math.round(c.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      days, revenue, orders, avgTicket, voidCount: voided.length, refundCount: refunded.length,
      voidRefundRate, series, mix, topProducts, paymentMix, channelMix, money, sym: sym(),
      coverage: coverage(),
    };
  }

  return { command, foresight, reports, coverage, hourLabel, money, sym };
})();
