/* ═══════════════════════════════════════════════════════
   REPORTS.JS — Reports view rendering only
   Pure renderer. All data from analytics.js.
   Dashboard rendering lives in dashboard.js.
   No calculations here.
═══════════════════════════════════════════════════════ */

let reportChartInstance    = null;
let hourlyChartInstance    = null;

/* ── Date range helper ── */
function getReportDateRange() {
  const fromVal = document.getElementById('reportFromDate')?.value;
  const toVal   = document.getElementById('reportToDate')?.value;
  return {
    fromDate: fromVal ? new Date(`${fromVal}T00:00:00`) : null,
    toDate:   toVal   ? new Date(`${toVal}T23:59:59`)   : null
  };
}

/* ── Entry point ── */
function renderReports() {
  const { fromDate, toDate } = getReportDateRange();

  renderReportKPIs(fromDate, toDate);
  renderRevenueChart(fromDate, toDate);
  renderHourlySalesChart(fromDate, toDate);
  renderPaymentBreakdown(fromDate, toDate);
  renderReportProductsTable(fromDate, toDate);
  renderIngredientUsageTable(fromDate, toDate);
  renderReportInsightsTable(fromDate, toDate);
}

/* ── KPI cards ── */
function renderReportKPIs(fromDate, toDate) {
  const statsGrid = document.getElementById('reportStatsGrid');
  if (!statsGrid) return;

  const posRevenue   = getRevenue(fromDate, toDate);
  const orders       = getOrderCount(fromDate, toDate);
  const items        = getItemsSold(fromDate, toDate);
  const avg          = getAverageTicket(fromDate, toDate);
  const discount     = getTotalDiscount(fromDate, toDate);

  // Supply revenue from analytics
  const supplyRevenue      = typeof getSupplyRevenue_      === 'function' ? getSupplyRevenue_()      : 0;
  const supplyOrders       = typeof getSupplyOrderCount_   === 'function' ? getSupplyOrderCount_()   : 0;
  const outstanding        = typeof getOutstandingReceivables === 'function' ? getOutstandingReceivables() : 0;
  const collectionRate     = typeof getCollectionRate      === 'function' ? getCollectionRate()      : 0;
  const totalRevenue       = posRevenue + supplyRevenue;

  statsGrid.innerHTML = `
    <div class="stat-card dark">
      <div class="label">Total Revenue</div>
      <div class="value">${formatCurrency(totalRevenue)}</div>
      <div class="sub">POS: ${formatCurrency(posRevenue)} · Supply: ${formatCurrency(supplyRevenue)}</div>
    </div>
    <div class="stat-card">
      <div class="label">POS Orders</div>
      <div class="value">${orders}</div>
      <div class="sub">Avg ${formatCurrency(avg)} · Disc. ${formatCurrency(discount)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Supply Orders</div>
      <div class="value">${supplyOrders}</div>
      <div class="sub">Paid supply orders</div>
    </div>
    <div class="stat-card">
      <div class="label">Receivables</div>
      <div class="value" style="font-size:20px;">${formatCurrency(outstanding)}</div>
      <div class="sub">Collection rate: ${collectionRate.toFixed(1)}%</div>
    </div>
    <div class="stat-card">
      <div class="label">Items Sold</div>
      <div class="value">${items}</div>
      <div class="sub">Units moved (POS)</div>
    </div>`;
}

/* ── Revenue trend chart ── */
function renderRevenueChart(fromDate, toDate) {
  const canvas = document.getElementById('reportRevenueChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const trend = getDailySalesTrend(fromDate, toDate);

  if (reportChartInstance) { reportChartInstance.destroy(); reportChartInstance = null; }

  if (!trend.labels.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px Nunito, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No sales data for selected period', canvas.width / 2, canvas.height / 2);
    return;
  }

  const shortLabels = trend.labels.map(l =>
    new Date(l).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  );

  reportChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: shortLabels,
      datasets: [{
        label: 'Revenue',
        data: trend.values,
        borderColor: '#000',
        backgroundColor: 'rgba(0,0,0,.04)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#000',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatCurrency(ctx.parsed.y) } }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#999' }
        },
        y: {
          grid: { color: '#f4f4f4' },
          ticks: {
            font: { size: 11 }, color: '#999',
            callback: v => '₱' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
          }
        }
      }
    }
  });
}

/* ── Hourly sales chart ── */
function renderHourlySalesChart(fromDate, toDate) {
  const canvas = document.getElementById('reportHourlyChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const hours = getHourlySales(fromDate, toDate);
  const labels = hours.map((_, i) => {
    const h = i % 12 || 12;
    return `${h}${i < 12 ? 'am' : 'pm'}`;
  });

  if (hourlyChartInstance) { hourlyChartInstance.destroy(); hourlyChartInstance = null; }

  hourlyChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: hours,
        backgroundColor: hours.map(v => v > 0 ? '#000' : '#f0f0f0'),
        borderRadius: 3,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatCurrency(ctx.parsed.y) } }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, color: '#aaa' }
        },
        y: {
          grid: { color: '#f4f4f4' },
          ticks: {
            font: { size: 10 }, color: '#999',
            callback: v => '₱' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
          }
        }
      }
    }
  });
}

/* ── Payment breakdown ── */
function renderPaymentBreakdown(fromDate, toDate) {
  const container = document.getElementById('paymentBreakdownContainer');
  if (!container) return;

  const breakdown = getPaymentBreakdown(fromDate, toDate);
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  if (!total) {
    container.innerHTML = `<div class="empty-state">No payment data</div>`;
    return;
  }

  container.innerHTML = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([method, amount]) => {
      const pct = ((amount / total) * 100).toFixed(1);
      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">
              ${escapeHtml(method)}
            </span>
            <span style="font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;">
              ${formatCurrency(amount)} &middot; ${pct}%
            </span>
          </div>
          <div style="height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:var(--black);border-radius:3px;transition:width .5s ease;"></div>
          </div>
        </div>`;
    }).join('');
}

/* ── Product profitability table ── */
function renderReportProductsTable(fromDate, toDate) {
  const tbody = document.querySelector('#reportProductsTable tbody');
  if (!tbody) return;

  const ranked = getProductProfitability(fromDate, toDate);
  tbody.innerHTML = '';

  if (!ranked.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No sales data for selected period</td></tr>`;
    return;
  }

  ranked.forEach(item => {
    const margin = item.revenue > 0
      ? ((item.profit / item.revenue) * 100).toFixed(1)
      : null;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(item.name)}</td>
      <td>${item.qty}</td>
      <td>${formatCurrency(item.revenue)}</td>
      <td>${formatCurrency(item.cost)}</td>
      <td style="font-weight:700;">
        ${formatCurrency(item.profit)}
        ${margin !== null
          ? `<span style="font-size:10px;color:var(--gray-400);margin-left:4px;">(${margin}%)</span>`
          : ''}
      </td>`;
    tbody.appendChild(row);
  });
}

/* ── Ingredient usage table ── */
function renderIngredientUsageTable(fromDate, toDate) {
  const tbody = document.querySelector('#ingredientUsageTable tbody');
  if (!tbody) return;

  const sales = getCompletedSales(fromDate, toDate);
  const usage = new Map();

  sales.forEach(sale => {
    if (!Array.isArray(sale.items)) return;
    sale.items.forEach(item => {
      const product = (APP_STATE.products || []).find(p => String(p.id) === String(item.productId));
      if (!product || !Array.isArray(product.recipe)) return;

      product.recipe.forEach(recipeItem => {
        const ingredient = (APP_STATE.ingredients || []).find(i => String(i.id) === String(recipeItem.ingredientId));
        if (!ingredient) return;

        const key = `${ingredient.name}|${ingredient.unit}|${ingredient.id}`;
        const qty = Number(recipeItem.quantity || 0) * Number(item.quantity || 0);
        usage.set(key, (usage.get(key) || 0) + qty);
      });
    });
  });

  const ranked = Array.from(usage.entries()).sort((a, b) => b[1] - a[1]);
  tbody.innerHTML = '';

  if (!ranked.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No ingredient usage data</td></tr>`;
    return;
  }

  ranked.forEach(([key, qty]) => {
    const [name, unit, id] = key.split('|');
    const ingredient = (APP_STATE.ingredients || []).find(i => String(i.id) === String(id));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(name)}</td>
      <td>${Number(qty).toFixed(2)} ${escapeHtml(unit || '')}</td>
      <td>${ingredient
        ? `${Number(ingredient.stock).toFixed(2)} ${escapeHtml(ingredient.unit || '')}`
        : '—'}</td>`;
    tbody.appendChild(row);
  });
}

/* ── Operational insights table ── */
function renderReportInsightsTable(fromDate, toDate) {
  const tbody = document.querySelector('#reportInsightsTable tbody');
  if (!tbody) return;

  const sales     = getAnalyticsSales(fromDate, toDate);
  const completed = sales.filter(s => (s.status || '').toUpperCase() === 'COMPLETED');
  const pending   = sales.filter(s => (s.status || '').toUpperCase() === 'PENDING');
  const discount  = getTotalDiscount(fromDate, toDate);

  const uniqueProducts = new Set(
    sales.flatMap(s => Array.isArray(s.items) ? s.items.map(i => i.name) : [])
  ).size;

  const uniqueCustomers = new Set(
    sales.map(s => s.customer?.name || s.customerName || 'Walk-in Customer')
  ).size;

  const rows = [
    ['Completed Sales',      completed.length],
    ['Pending Orders',       pending.length],
    ['Unique Products Sold', uniqueProducts],
    ['Unique Customers',     uniqueCustomers],
    ['Total Discount Given', formatCurrency(discount)]
  ];

  tbody.innerHTML = '';
  rows.forEach(([metric, value]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(metric)}</td>
      <td style="font-weight:700;">${value}</td>`;
    tbody.appendChild(row);
  });
}

/* ── Exports ── */
window.renderReports              = renderReports;
window.renderReportKPIs           = renderReportKPIs;
window.renderRevenueChart         = renderRevenueChart;
window.renderHourlySalesChart     = renderHourlySalesChart;
window.renderPaymentBreakdown     = renderPaymentBreakdown;
window.renderReportProductsTable  = renderReportProductsTable;
window.renderIngredientUsageTable = renderIngredientUsageTable;
window.renderReportInsightsTable  = renderReportInsightsTable;
