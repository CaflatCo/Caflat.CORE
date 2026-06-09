/* ═══════════════════════════════════════════════════════
   ANALYTICS.JS — Single Source of Truth for Metrics
   All KPIs, revenue, and trend data flows from here.
═══════════════════════════════════════════════════════ */

function getAnalyticsSales(fromDate, toDate) {
  const sales = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  if (!fromDate && !toDate) return sales;
  return sales.filter(sale => {
    const d = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || 0);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });
}

function getCompletedSales(fromDate, toDate) {
  return getAnalyticsSales(fromDate, toDate).filter(
    s => (s.status || '').toUpperCase() === 'COMPLETED'
  );
}

/* ── Revenue & Orders ── */
function getRevenue(fromDate, toDate) {
  return getCompletedSales(fromDate, toDate)
    .reduce((s, sale) => s + Number(sale.total ?? sale.totals?.total ?? 0), 0);
}

function getOrderCount(fromDate, toDate) {
  return getCompletedSales(fromDate, toDate).length;
}

function getAverageTicket(fromDate, toDate) {
  const count = getOrderCount(fromDate, toDate);
  return count ? getRevenue(fromDate, toDate) / count : 0;
}

function getItemsSold(fromDate, toDate) {
  // multiply by item.multiplier so a "Box of 4" sold once = 4 units
  return getCompletedSales(fromDate, toDate).reduce((sum, sale) =>
    sum + (Array.isArray(sale.items)
      ? sale.items.reduce((s, i) =>
          s + Number(i.quantity || 0) * Number(i.multiplier || 1), 0)
      : 0), 0);
}

function getTotalDiscount(fromDate, toDate) {
  return getCompletedSales(fromDate, toDate)
    .reduce((s, sale) => s + Number(sale.discount ?? sale.totals?.discount ?? 0), 0);
}

/* ── Product & Profitability ── */
function getTopProducts(limit = 5, fromDate, toDate) {
  const totals = {};
  getCompletedSales(fromDate, toDate).forEach(sale => {
    (sale.items || []).forEach(item => {
      if (!totals[item.name]) totals[item.name] = { qty: 0, revenue: 0 };
      // qty = how many actual units sold (boxes × units-per-box)
      totals[item.name].qty += Number(item.quantity || 0) * Number(item.multiplier || 1);
      totals[item.name].revenue += Number(item.total || (Number(item.price || 0) * Number(item.quantity || 0)));
    });
  });
  return Object.entries(totals)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, limit)
    .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }));
}

function getProductProfitability(fromDate, toDate) {
  const totals = {};
  getCompletedSales(fromDate, toDate).forEach(sale => {
    (sale.items || []).forEach(item => {
      if (!totals[item.name]) {
        totals[item.name] = { qty: 0, revenue: 0, cost: 0 };
      }

      const lineQty   = Number(item.quantity   || 0);
      const multiplier = Number(item.multiplier || 1);
      // Qty sold = physical units (e.g. Box of 4 sold twice = 8 units)
      totals[item.name].qty     += lineQty * multiplier;
      totals[item.name].revenue += Number(item.total || (Number(item.price || 0) * lineQty));

      // Cost: look up the product to get recipe + recipeMode + batchYield
      const product = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
      if (product && Array.isArray(product.recipe)) {
        const recipeMode = String(product.recipeMode || 'unit');
        const batchYield = Math.max(1, Number(product.batchYield || 1));

        product.recipe.forEach(recipeItem => {
          const ing = (APP_STATE.ingredients || []).find(i => String(i.id) === String(recipeItem.ingredientId));
          if (!ing) return;

          const ingredientQtyPerRecipe = Number(recipeItem.quantity || 0);
          // Per-unit ingredient usage (batch mode: divide by yield)
          const ingredientPerUnit = recipeMode === 'batch'
            ? ingredientQtyPerRecipe / batchYield
            : ingredientQtyPerRecipe;

          // Total usage = ingredient-per-unit × physical units sold
          totals[item.name].cost +=
            ingredientPerUnit *
            Number(ing.costPerUnit || 0) *
            (lineQty * multiplier);
        });
      }
    });
  });
  return Object.entries(totals)
    .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue, cost: d.cost, profit: d.revenue - d.cost }))
    .sort((a, b) => b.revenue - a.revenue);
}

/* ── Sales Trend (daily) ── */
function getDailySalesTrend(fromDate, toDate) {
  const daily = new Map();
  getCompletedSales(fromDate, toDate).forEach(sale => {
    const date = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    const key = date.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) || 0) + Number(sale.total ?? sale.totals?.total ?? 0));
  });
  const labels = Array.from(daily.keys()).sort();
  return { labels, values: labels.map(k => daily.get(k)) };
}

/* ── Hourly Distribution ── */
function getHourlySales(fromDate, toDate) {
  const hours = Array(24).fill(0);
  getCompletedSales(fromDate, toDate).forEach(sale => {
    const d = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    hours[d.getHours()] += Number(sale.total ?? sale.totals?.total ?? 0);
  });
  return hours;
}

/* ── Payment Methods ── */
function getPaymentBreakdown(fromDate, toDate) {
  const map = {};
  getCompletedSales(fromDate, toDate).forEach(sale => {
    const method = (sale.payment?.method || sale.paymentMethod || 'cash').toLowerCase();
    map[method] = (map[method] || 0) + Number(sale.total ?? sale.totals?.total ?? 0);
  });
  return map;
}

/* ── Inventory ── */
function getLowStockItems() {
  return (APP_STATE.ingredients || []).filter(
    i => Number(i.stock || 0) <= Number(i.reorderLevel || 0)
  );
}

function getLowStockProducts() {
  return (APP_STATE.products || []).filter(
    p => Number(p.stock || 0) <= Number(p.reorderLevel || 0)
  );
}

/* ── KPI Summary (all-time) ── */
function getKPISummary() {
  const posRevenue   = getRevenue();
  const posOrders    = getOrderCount();
  const supplyRevenue  = (APP_STATE.supplyOrders || [])
    .filter(o => String(o.status||'').toUpperCase() === 'PAID')
    .reduce((s, o) => s + Number(o.grandTotal || o.total || 0), 0);
  const supplyOrders   = (APP_STATE.supplyOrders || [])
    .filter(o => String(o.status||'').toUpperCase() === 'PAID').length;
  const totalRevenue = posRevenue + supplyRevenue;
  const totalOrders  = posOrders  + supplyOrders;

  return {
    revenue:      posRevenue,
    orders:       posOrders,
    avgTicket:    getAverageTicket(),
    itemsSold:    getItemsSold(),
    totalDiscount: getTotalDiscount(),
    pendingOrders: (APP_STATE.sales || []).filter(s => (s.status || '').toUpperCase() === 'PENDING').length,
    lowStockCount: getLowStockItems().length,
    posRevenue, supplyRevenue, totalRevenue,
    posOrders,  supplyOrders,  totalOrders,
    posRevenuePercent:    totalRevenue ? Math.round(posRevenue    / totalRevenue * 100) : 0,
    supplyRevenuePercent: totalRevenue ? Math.round(supplyRevenue / totalRevenue * 100) : 0,
    posOrderPercent:      totalOrders  ? Math.round(posOrders     / totalOrders  * 100) : 0,
    supplyOrderPercent:   totalOrders  ? Math.round(supplyOrders  / totalOrders  * 100) : 0
  };
}

window.getAnalyticsSales = getAnalyticsSales;
window.getCompletedSales = getCompletedSales;
window.getRevenue = getRevenue;
window.getOrderCount = getOrderCount;
window.getAverageTicket = getAverageTicket;
window.getItemsSold = getItemsSold;
window.getTotalDiscount = getTotalDiscount;
window.getTopProducts = getTopProducts;
window.getProductProfitability = getProductProfitability;
window.getDailySalesTrend = getDailySalesTrend;
window.getHourlySales = getHourlySales;
window.getPaymentBreakdown = getPaymentBreakdown;
window.getLowStockItems = getLowStockItems;
window.getLowStockProducts = getLowStockProducts;
window.getKPISummary = getKPISummary;

/* ── Channel revenue breakdown ── */
function getRevenueByChannel(fromDate, toDate) {
  const map = {};
  getCompletedSales(fromDate, toDate).forEach(sale => {
    const ch = sale.channel || sale.orderType || 'Dine In';
    map[ch] = (map[ch] || 0) + Number(sale.totals?.total ?? sale.total ?? 0);
  });
  // Add Supply as a channel from supply orders
  const supplyRev = (APP_STATE.supplyOrders || [])
    .filter(o => String(o.status||'').toUpperCase() === 'PAID')
    .reduce((s, o) => s + Number(o.grandTotal || 0), 0);
  if (supplyRev > 0) map['Supply'] = (map['Supply'] || 0) + supplyRev;
  return map;
}

function getOrdersByChannel(fromDate, toDate) {
  const map = {};
  getCompletedSales(fromDate, toDate).forEach(sale => {
    const ch = sale.channel || sale.orderType || 'Dine In';
    map[ch] = (map[ch] || 0) + 1;
  });
  const supplyOrders = (APP_STATE.supplyOrders || [])
    .filter(o => String(o.status||'').toUpperCase() === 'PAID').length;
  if (supplyOrders > 0) map['Supply'] = (map['Supply'] || 0) + supplyOrders;
  return map;
}

/* ── Category performance — auto-generates for all categories ── */
function getCategoryPerformance(fromDate, toDate) {
  const categories = Array.isArray(APP_STATE.categories) ? APP_STATE.categories : [];
  const sales      = getCompletedSales(fromDate, toDate);

  // Build product → category map
  const productCategory = {};
  (APP_STATE.products || []).forEach(p => {
    productCategory[String(p.id)] = p.category || 'Uncategorised';
  });

  // Aggregate per category
  const catMap = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const cat    = productCategory[String(item.productId)] || 'Uncategorised';
      const qty    = Number(item.quantity || 0) * Number(item.multiplier || 1);
      const rev    = Number(item.total || (Number(item.price||0) * Number(item.quantity||0)));
      if (!catMap[cat]) catMap[cat] = { revenue: 0, qty: 0, orders: new Set(), products: {} };
      catMap[cat].revenue += rev;
      catMap[cat].qty     += qty;
      catMap[cat].orders.add(sale.id);
      if (!catMap[cat].products[item.name]) catMap[cat].products[item.name] = { qty: 0, revenue: 0 };
      catMap[cat].products[item.name].qty     += qty;
      catMap[cat].products[item.name].revenue += rev;
    });
  });

  // Ensure ALL current categories appear (even with zero sales)
  const allCats = new Set([...categories, ...Object.keys(catMap)]);

  return Array.from(allCats).map(cat => {
    const data     = catMap[cat] || { revenue: 0, qty: 0, orders: new Set(), products: {} };
    const topItems = Object.entries(data.products)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 3)
      .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }));
    return {
      category:  cat,
      revenue:   data.revenue,
      qty:       data.qty,
      orders:    data.orders instanceof Set ? data.orders.size : data.orders,
      topItems
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

window.getRevenueByChannel   = getRevenueByChannel;
window.getOrdersByChannel    = getOrdersByChannel;
window.getCategoryPerformance= getCategoryPerformance;



/* ── Product cost calculation — single source of truth ── */
function calculateProductCost(recipe, recipeMode, batchYield, packagingItems) {
  const ingredients = APP_STATE.ingredients || [];
  if (!Array.isArray(recipe)) return 0;
  const yield_ = Math.max(1, Number(batchYield || 1));
  const mode   = String(recipeMode || 'unit');

  const ingredientCost = recipe.reduce((total, ri) => {
    const ing = ingredients.find(i => String(i.id) === String(ri.ingredientId));
    if (!ing) return total;
    const perUnit = mode === 'batch'
      ? Number(ri.quantity || 0) / yield_
      : Number(ri.quantity || 0);
    return total + perUnit * Number(ing.costPerUnit || 0);
  }, 0);

  const packagingCost = Array.isArray(packagingItems)
    ? packagingItems.reduce((s, p) => s + Number(p.cost || 0), 0)
    : 0;

  return ingredientCost + packagingCost;
}

/* ── Live cost from form DOM ── */
function calculateProductCostFromForm() {
  const rows       = document.querySelectorAll('.recipe-row');
  const ingredients= APP_STATE.ingredients || [];
  const recipeMode = document.getElementById('recipeMode')?.value || 'unit';
  const batchYield = Math.max(1, Number(document.getElementById('batchYield')?.value || 1));
  let ingredientCost = 0;

  rows.forEach(row => {
    const ingredientId = row.querySelector('.recipe-ingredient')?.value;
    const qty          = Number(row.querySelector('.recipe-qty')?.value || 0);
    if (!ingredientId || !qty) return;
    const ing = ingredients.find(i => String(i.id) === String(ingredientId));
    if (!ing) return;
    const perUnit = recipeMode === 'batch' ? qty / batchYield : qty;
    ingredientCost += perUnit * Number(ing.costPerUnit || 0);
  });

  // Add packaging costs from packaging rows
  const packagingRows = document.querySelectorAll('.packaging-row');
  let packagingCost = 0;
  packagingRows.forEach(row => {
    packagingCost += Number(row.querySelector('.packaging-cost')?.value || 0);
  });

  return ingredientCost + packagingCost;
}

/* ── Supply analytics ── */
function getSupplyOrders_() {
  return Array.isArray(APP_STATE.supplyOrders) ? APP_STATE.supplyOrders : [];
}

function getSupplyRevenue_() {
  return getSupplyOrders_()
    .filter(o => String(o.status||'').toUpperCase() === 'PAID')
    .reduce((s, o) => s + Number(o.grandTotal || 0), 0);
}

function getSupplyOrderCount_() {
  return getSupplyOrders_()
    .filter(o => String(o.status||'').toUpperCase() === 'PAID').length;
}

function getOutstandingReceivables() {
  return getSupplyOrders_()
    .filter(o => ['DELIVERED','INVOICED'].includes(String(o.status||'').toUpperCase()))
    .reduce((s, o) => s + Number(o.grandTotal || 0), 0);
}

function getCollectionRate() {
  const total = getSupplyOrders_()
    .filter(o => !['DRAFTED','CANCELLED','VOIDED'].includes(String(o.status||'').toUpperCase()))
    .reduce((s, o) => s + Number(o.grandTotal || 0), 0);
  if (!total) return 0;
  return (getSupplyRevenue_() / total) * 100;
}

/* ── Inventory discrepancy detection ── */
function getDailyDiscrepancies() {
  const movements = Array.isArray(APP_STATE.inventoryMovements)
    ? APP_STATE.inventoryMovements : [];

  const byDay = new Map();
  movements.forEach(m => {
    const day = new Date(m.createdAt || Date.now()).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { added: 0, used: 0, adjustments: 0 });
    const entry = byDay.get(day);
    entry.added       += Number(m.quantityAdded || 0);
    entry.used        += Number(m.quantityUsed  || 0);
    if (m.type === 'manual-adjustment') entry.adjustments++;
  });

  return Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, data]) => ({ date, ...data }));
}

window.calculateProductCost         = calculateProductCost;
window.calculateProductCostFromForm = calculateProductCostFromForm;

/* ── Break-even calculation ── */
function calculateBreakEven(product) {
  if (!product) return null;

  const cost  = calculateProductCost(
    product.recipe      || [],
    product.recipeMode  || 'unit',
    product.batchYield  || 1,
    product.packagingItems || []
  );
  const price = Number(product.price || 0);
  if (!price || !cost) return null;

  const profit      = price - cost;
  const batchYield  = Math.max(1, Number(product.batchYield || 1));
  const totalCost   = cost * batchYield;   // cost to produce one full batch
  const breakEven   = Math.ceil(totalCost / price);
  const pureProfit  = price - cost;        // per unit after break-even
  const margin      = price > 0 ? (profit / price) * 100 : 0;

  return {
    costPerUnit:   cost,
    price,
    profit,
    margin,
    batchYield,
    totalBatchCost: totalCost,
    breakEvenUnits: breakEven,
    pureProfit,                            // per unit after break-even
    pureProfitBatch: Math.max(0, batchYield - breakEven) * pureProfit
  };
}

/* ── Break-even from form (live in product modal) ── */
function calculateBreakEvenFromForm() {
  const recipeMode  = document.getElementById('recipeMode')?.value || 'unit';
  const batchYield  = Math.max(1, Number(document.getElementById('batchYield')?.value || 1));
  const price       = Number(document.getElementById('productPrice')?.value || 0);
  const cost        = calculateProductCostFromForm();
  if (!price || !cost) return null;

  const totalBatchCost = cost * batchYield;
  const breakEven      = Math.ceil(totalBatchCost / price);
  const pureProfit     = price - cost;

  return {
    costPerUnit: cost, price, batchYield,
    totalBatchCost,
    breakEvenUnits: breakEven,
    pureProfit,
    pureProfitBatch: Math.max(0, batchYield - breakEven) * pureProfit
  };
}

/* ── Break-even analysis for all products (Reports) ── */
function getBreakEvenAnalysis(fromDate, toDate) {
  const products = APP_STATE.products || [];
  const sales    = typeof getCompletedSales === 'function'
    ? getCompletedSales(fromDate, toDate) : [];

  // Units sold per product in period
  const soldMap = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
      soldMap[item.productId] = (soldMap[item.productId] || 0) + qty;
    });
  });

  return products
    .map(product => {
      const be = calculateBreakEven(product);
      if (!be) return null;
      const soldQty       = soldMap[product.id] || 0;
      const hitBreakEven  = soldQty >= be.breakEvenUnits;
      const pureProfitQty = Math.max(0, soldQty - be.breakEvenUnits);
      const actualPureProfit = pureProfitQty * be.pureProfit;
      const progressPct   = be.breakEvenUnits > 0
        ? Math.min(100, Math.round((soldQty / be.breakEvenUnits) * 100)) : 100;

      return {
        id:             product.id,
        name:           product.name,
        category:       product.category || '',
        price:          be.price,
        costPerUnit:    be.costPerUnit,
        margin:         be.margin,
        batchYield:     be.batchYield,
        breakEvenUnits: be.breakEvenUnits,
        pureProfit:     be.pureProfit,
        soldQty,
        hitBreakEven,
        pureProfitQty,
        actualPureProfit,
        progressPct,
        status: soldQty === 0       ? 'NO_SALES'
              : hitBreakEven        ? 'PROFITABLE'
              : soldQty > 0         ? 'IN_PROGRESS'
              : 'NO_SALES'
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.actualPureProfit - a.actualPureProfit);
}

window.calculateBreakEven          = calculateBreakEven;
window.calculateBreakEvenFromForm  = calculateBreakEvenFromForm;
window.getBreakEvenAnalysis        = getBreakEvenAnalysis;
window.getSupplyRevenue_            = getSupplyRevenue_;
window.getSupplyOrderCount_         = getSupplyOrderCount_;
window.getOutstandingReceivables    = getOutstandingReceivables;
window.getCollectionRate            = getCollectionRate;
window.getDailyDiscrepancies        = getDailyDiscrepancies;
