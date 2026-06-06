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
  return {
    revenue: getRevenue(),
    orders: getOrderCount(),
    avgTicket: getAverageTicket(),
    itemsSold: getItemsSold(),
    totalDiscount: getTotalDiscount(),
    pendingOrders: (APP_STATE.sales || []).filter(s => (s.status || '').toUpperCase() === 'PENDING').length,
    lowStockCount: getLowStockItems().length
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
