/* ═══════════════════════════════════════════════════════════════
   MISE — DATA  ·  Maison Levain (living demo) + forecast intelligence
   Deterministic seeded model → numbers are stable yet believable.
═══════════════════════════════════════════════════════════════ */
const DATA = (() => {

  /* seeded PRNG so the "living" business is stable across reloads */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260705);

  const OPEN = 7, CLOSE = 19;                 // operating window (7am–7pm)
  const HOURS = Array.from({ length: CLOSE - OPEN }, (_, i) => OPEN + i);

  /* ── Menu ── prepared units sit in `stock`; kitchen replenishes via prep */
  const products = [
    // Viennoiserie
    { id: 'p_croissant', name: 'Butter Croissant',   cat: 'Viennoiserie', price: 4.50, cost: 1.35, base: 120, curve: 'am', batch: 12, stock: 46, emoji: '🥐' },
    { id: 'p_pdc',       name: 'Pain au Chocolat',   cat: 'Viennoiserie', price: 4.75, cost: 1.55, base: 95,  curve: 'am', batch: 12, stock: 38, emoji: '🍫' },
    { id: 'p_almond',    name: 'Almond Croissant',   cat: 'Viennoiserie', price: 5.50, cost: 1.90, base: 60,  curve: 'am', batch: 8,  stock: 12, emoji: '🌰' },
    { id: 'p_kouign',    name: 'Kouign-Amann',       cat: 'Viennoiserie', price: 5.75, cost: 1.80, base: 40,  curve: 'am', batch: 8,  stock: 58, emoji: '🧈' },
    // Bread
    { id: 'p_sourdough', name: 'Sourdough Loaf',     cat: 'Bread',        price: 9.00, cost: 2.10, base: 45,  curve: 'flat', batch: 6, stock: 22, emoji: '🍞' },
    { id: 'p_baguette',  name: 'Baguette Tradition', cat: 'Bread',        price: 4.00, cost: 0.95, base: 80,  curve: 'twin', batch: 10, stock: 34, emoji: '🥖' },
    { id: 'p_miche',     name: 'Country Miche',      cat: 'Bread',        price: 12.00, cost: 2.80, base: 20, curve: 'flat', batch: 4, stock: 33, emoji: '🌾' },
    // Patisserie
    { id: 'p_canele',    name: 'Canelé',             cat: 'Patisserie',   price: 3.50, cost: 0.90, base: 70,  curve: 'pm', batch: 12, stock: 41, emoji: '🍮' },
    { id: 'p_eclair',    name: 'Chocolate Éclair',   cat: 'Patisserie',   price: 6.50, cost: 1.75, base: 38,  curve: 'pm', batch: 6,  stock: 19, emoji: '🍫' },
    { id: 'p_tart',      name: 'Lemon Tart',         cat: 'Patisserie',   price: 7.00, cost: 2.00, base: 30,  curve: 'pm', batch: 6,  stock: 46, emoji: '🍋' },
    { id: 'p_macaron',   name: 'Macaron',            cat: 'Patisserie',   price: 2.75, cost: 0.70, base: 140, curve: 'flat', batch: 24, stock: 205, emoji: '🌈' },
    // Café
    { id: 'p_espresso',  name: 'Espresso',           cat: 'Café',         price: 3.25, cost: 0.55, base: 90,  curve: 'am', batch: 0, stock: 999, emoji: '☕' },
    { id: 'p_cortado',   name: 'Cortado',            cat: 'Café',         price: 4.25, cost: 0.75, base: 75,  curve: 'am', batch: 0, stock: 999, emoji: '☕' },
    { id: 'p_capp',      name: 'Cappuccino',         cat: 'Café',         price: 4.75, cost: 0.85, base: 110, curve: 'am', batch: 0, stock: 999, emoji: '☕' },
    { id: 'p_filter',    name: 'Filter Coffee',      cat: 'Café',         price: 3.75, cost: 0.45, base: 65,  curve: 'flat', batch: 0, stock: 999, emoji: '☕' },
    { id: 'p_matcha',    name: 'Matcha Latte',       cat: 'Café',         price: 5.50, cost: 1.20, base: 45,  curve: 'pm', batch: 0, stock: 999, emoji: '🍵' },
  ];

  /* ── Ingredients (larder) ── */
  const ingredients = [
    { id: 'i_flourt65', name: 'T65 Flour',        unit: 'kg', stock: 42,  par: 30, cost: 1.40 },
    { id: 'i_flourt45', name: 'T45 Flour',        unit: 'kg', stock: 18,  par: 20, cost: 1.65 },
    { id: 'i_butter',   name: 'AOP Butter',       unit: 'kg', stock: 9.5, par: 14, cost: 9.20 },
    { id: 'i_sugar',    name: 'Cane Sugar',       unit: 'kg', stock: 26,  par: 15, cost: 1.10 },
    { id: 'i_eggs',     name: 'Eggs',             unit: 'ea', stock: 210, par: 240, cost: 0.28 },
    { id: 'i_almond',   name: 'Almond Flour',     unit: 'kg', stock: 3.1, par: 6,  cost: 12.5 },
    { id: 'i_choc',     name: 'Dark Chocolate 70%', unit: 'kg', stock: 7.4, par: 8, cost: 11.0 },
    { id: 'i_milk',     name: 'Whole Milk',       unit: 'L',  stock: 34,  par: 40, cost: 1.05 },
    { id: 'i_lemon',    name: 'Lemons',           unit: 'ea', stock: 44,  par: 30, cost: 0.40 },
    { id: 'i_matcha',   name: 'Ceremonial Matcha', unit: 'g', stock: 320, par: 250, cost: 0.22 },
    { id: 'i_beans',    name: 'Espresso Beans',   unit: 'kg', stock: 6.2, par: 8,  cost: 24.0 },
    { id: 'i_levain',   name: 'Levain Starter',   unit: 'kg', stock: 5.0, par: 3,  cost: 0.0 },
  ];

  /* ── Recipes (per prepared unit) — used by prep planner ── */
  const recipes = {
    p_croissant: [['i_flourt45', .055], ['i_butter', .030], ['i_sugar', .006], ['i_eggs', .05]],
    p_pdc:       [['i_flourt45', .055], ['i_butter', .030], ['i_choc', .015], ['i_eggs', .05]],
    p_almond:    [['i_flourt45', .055], ['i_butter', .032], ['i_almond', .040], ['i_sugar', .012], ['i_eggs', .08]],
    p_kouign:    [['i_flourt45', .060], ['i_butter', .040], ['i_sugar', .022]],
    p_sourdough: [['i_flourt65', .480], ['i_levain', .090], ['i_sugar', .002]],
    p_baguette:  [['i_flourt65', .250], ['i_levain', .040]],
    p_miche:     [['i_flourt65', .620], ['i_levain', .120]],
    p_canele:    [['i_flourt45', .020], ['i_milk', .06], ['i_sugar', .020], ['i_eggs', .5]],
    p_eclair:    [['i_flourt45', .030], ['i_butter', .018], ['i_choc', .022], ['i_eggs', 1], ['i_milk', .08]],
    p_tart:      [['i_flourt45', .045], ['i_butter', .028], ['i_lemon', 1.2], ['i_sugar', .030], ['i_eggs', 1.2]],
    p_macaron:   [['i_almond', .010], ['i_sugar', .012], ['i_eggs', .18]],
  };

  /* ── Hourly demand curves (relative weights across operating hours) ── */
  const CURVES = {
    am:   [.03, .14, .16, .12, .08, .09, .08, .07, .06, .05, .03, .02],
    pm:   [.02, .04, .06, .07, .08, .11, .12, .12, .13, .12, .08, .05],
    flat: [.05, .09, .10, .09, .08, .10, .10, .09, .08, .08, .07, .06],
    twin: [.04, .13, .11, .07, .06, .12, .11, .07, .07, .09, .07, .06],
  };
  const norm = (a) => { const s = a.reduce((x, y) => x + y, 0); return a.map(v => v / s); };
  Object.keys(CURVES).forEach(k => CURVES[k] = norm(CURVES[k]));

  const WEEKDAY = [1.24, .82, .90, .94, 1.00, 1.16, 1.34]; // Sun..Sat

  /* jitter that's stable per (product, day) */
  function jitter(seed) { const r = mulberry32(seed)(); return 0.9 + r * 0.2; }
  function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }

  /* Expected units of a product on a given weekday */
  function expectedToday(p, weekday) {
    return p.base * WEEKDAY[weekday] * jitter(hash(p.id) ^ weekday);
  }
  /* Hourly expected array for a product today */
  function hourlyToday(p, weekday) {
    const total = expectedToday(p, weekday);
    return CURVES[p.curve].map(w => total * w);
  }
  /* Cumulative expected sold by end of hour index h (0-based within HOURS) */
  function cumulativeBy(p, weekday, hIdx) {
    const hr = hourlyToday(p, weekday);
    let s = 0; for (let i = 0; i <= hIdx && i < hr.length; i++) s += hr[i];
    return s;
  }

  /* ── 14-day sales history (for trend charts) ── */
  const today = new Date('2026-07-05T09:40:00'); // Sunday — a busy day
  const history = [];
  for (let d = 13; d >= 0; d--) {
    const date = new Date(today); date.setDate(today.getDate() - d);
    const wd = date.getDay();
    let revenue = 0, orders = 0, covers = 0;
    const growth = Math.pow(1.021, -(d / 7));   // ~2%/week upward trend — a business on the rise
    products.forEach(p => {
      const units = expectedToday(p, wd) * growth * (0.92 + mulberry32(hash(p.id) ^ (wd * 7) ^ d)() * 0.16);
      revenue += units * p.price; orders += units;
    });
    covers = Math.round(orders * 0.42);
    history.push({
      date: date.toISOString().slice(0, 10),
      weekday: wd,
      label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      short: date.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: Math.round(revenue),
      orders: Math.round(orders),
      covers,
    });
  }

  /* ── FORESIGHT ENGINE ── */
  /* Given an "as of" hour, produce demand radar + prep plan + waste guard */
  function foresight(asOfHour = today.getHours(), weekday = today.getDay()) {
    const hIdx = Math.max(0, Math.min(HOURS.length - 1, asOfHour - OPEN));
    const perishable = products.filter(p => p.batch > 0); // café items don't perish

    // Demand radar — total hourly expected orders across all products
    const radar = HOURS.map((hr, i) => {
      let sold = 0, forecast = 0;
      products.forEach(p => { const h = hourlyToday(p, weekday); forecast += h[i]; });
      // "sold so far" = actual up to asOf (we treat expected as actual for demo realism)
      sold = i <= hIdx ? forecast : 0;
      return { hour: hr, forecast: Math.round(forecast), sold: Math.round(sold), past: i <= hIdx };
    });

    // Per-item projection
    const items = perishable.map(p => {
      const totalToday = expectedToday(p, weekday);
      const soldSoFar = cumulativeBy(p, weekday, hIdx);
      const remainingDemand = Math.max(0, totalToday - soldSoFar);
      const onHand = Math.max(0, p.stock);              // prepared remaining
      const shortfall = Math.max(0, remainingDemand - onHand);
      // day-level over-prep: prepared more than the whole day will sell (scrub-stable)
      const surplus = Math.max(0, Math.round(onHand - totalToday));

      // projected sellout hour: when cumulative demand passes prepared stock
      let selloutHour = null;
      for (let i = hIdx; i < HOURS.length; i++) {
        const cum = cumulativeBy(p, weekday, i) - soldSoFar;
        if (cum >= onHand) { selloutHour = HOURS[i]; break; }
      }
      const recPrep = shortfall > 0 ? Math.ceil(shortfall / p.batch) * p.batch : 0;
      let status = 'ok';
      if (shortfall > 0 && selloutHour && selloutHour <= asOfHour + 2) status = 'crit';
      else if (shortfall > 0) status = 'warn';
      else if (surplus > 0) status = 'waste';
      return {
        ...p, totalToday: Math.round(totalToday), soldSoFar: Math.round(soldSoFar),
        remainingDemand: Math.round(remainingDemand), onHand, shortfall: Math.round(shortfall),
        surplus, selloutHour, recPrep, status,
      };
    });

    const prepList = items.filter(i => i.recPrep > 0)
      .sort((a, b) => (a.selloutHour ?? 99) - (b.selloutHour ?? 99));
    const wasteList = items.filter(i => i.status === 'waste')
      .sort((a, b) => b.surplus - a.surplus);

    // Ingredient demand for the recommended prep
    const ingNeed = {};
    prepList.forEach(it => (recipes[it.id] || []).forEach(([ing, qty]) => {
      ingNeed[ing] = (ingNeed[ing] || 0) + qty * it.recPrep;
    }));
    const ingRisk = Object.entries(ingNeed).map(([id, need]) => {
      const ing = ingredients.find(x => x.id === id);
      return { ...ing, need: Math.round(need * 100) / 100, short: need > ing.stock };
    }).sort((a, b) => (b.short - a.short) || (b.need - a.need));

    // Projected close-of-day
    const projRevenue = Math.round(products.reduce((s, p) => s + expectedToday(p, weekday) * p.price, 0));
    const wastePrevented = Math.round(wasteList.reduce((s, i) => s + i.surplus * i.cost, 0));
    const lostSalesRisk = Math.round(prepList.reduce((s, i) => s + i.shortfall * i.price, 0));

    return { asOfHour, radar, items, prepList, wasteList, ingRisk, projRevenue, wastePrevented, lostSalesRisk, hIdx };
  }

  /* Category rollup for Command */
  function categoryMix(weekday = today.getDay()) {
    const map = {};
    products.forEach(p => {
      map[p.cat] = (map[p.cat] || 0) + expectedToday(p, weekday) * p.price;
    });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map).map(([cat, v]) => ({ cat, value: Math.round(v), pct: v / total }))
      .sort((a, b) => b.value - a.value);
  }

  return {
    OPEN, CLOSE, HOURS, products, ingredients, recipes, history, today,
    foresight, categoryMix, expectedToday, hourlyToday,
    fmt$: (n) => '$' + Math.round(n).toLocaleString(),
    fmt$c: (n) => '$' + n.toFixed(2),
    hourLabel: (h) => (h === 12 ? '12p' : h > 12 ? (h - 12) + 'p' : h + 'a'),
  };
})();
