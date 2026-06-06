/* ═══════════════════════════════════════════════════════
   REPORTS.JS — Dashboard + Reports rendering
   All metric calculations delegated to analytics.js
═══════════════════════════════════════════════════════ */

let reportChartInstance = null;
let dashboardChartInstance = null;

/* ── Dashboard ── */
function refreshDashboard() {
  const kpi = getKPISummary();

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dashboardTotalSales', formatCurrency(kpi.revenue));
  set('dashboardTotalOrders', kpi.orders);
  set('dashboardItemsSold', kpi.itemsSold);
  set('dashboardAverageOrder', formatCurrency(kpi.avgTicket));

  renderTopProducts();
  renderLowStockDashboard();
  renderDashboardChart();
}

function renderDashboardChart() {
  const canvas = document.getElementById('dashboardChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const trend = getDailySalesTrend();
  if (dashboardChartInstance) { dashboardChartInstance.destroy(); dashboardChartInstance = null; }

  if (!trend.labels.length) return;

  // Show last 14 days max
  const labels = trend.labels.slice(-14);
  const values = trend.values.slice(-14);
  const shortLabels = labels.map(l => {
    const d = new Date(l);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  });

  dashboardChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: shortLabels,
      datasets: [{
        label: 'Revenue',
        data: values,
        backgroundColor: '#000',
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => formatCurrency(ctx.parsed.y) }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#999' } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 }, color: '#999',
            callback: v => '₱' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) }}
      }
    }
  });
}

function renderTopProducts() {
  const container = document.getElementById('topProductsContainer');
  if (!container) return;
  const top = getTopProducts(5);
  if (!top.length) { container.innerHTML = `<div class="empty-state">No sales yet</div>`; return; }

  container.innerHTML = top.map((item, i) => `
    <div class="top-product-row">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:10px;font-weight:900;color:var(--gray-300);width:16px;">${i+1}</span>
        <div class="top-product-name">${escapeHtml(item.name)}</div>
      </div>
      <div class="top-product-qty">${item.qty} sold · ${formatCurrency(item.revenue)}</div>
    </div>`).join('');
}

function renderLowStockDashboard() {
  const container = document.getElementById('lowStockContainer');
  if (!container) return;

  const items = getLowStockItems();
  const products = getLowStockProducts();
  const all = [
    ...items.map(i => ({ name: i.name, stock: i.stock, unit: i.unit, type: 'Ingredient' })),
    ...products.map(p => ({ name: p.name, stock: p.stock, unit: 'units', type: 'Product' }))
  ];

  if (!all.length) { container.innerHTML = `<div class="empty-state">All stock levels OK ✓</div>`; return; }

  container.innerHTML = all.map(item => `
    <div class="low-stock-card">
      <div>
        <div class="low-stock-name">${escapeHtml(item.name)}</div>
        <div class="low-stock-meta" style="font-size:9px;letter-spacing:1px;text-transform:uppercase;">${item.type}</div>
      </div>
      <div class="low-stock-meta">${item.stock} ${escapeHtml(item.unit || '')} left</div>
    </div>`).join('');
}

/* ── Reports ── */
function getReportDateRange() {
  const fromVal = document.getElementById('reportFromDate')?.value;
  const toVal = document.getElementById('reportToDate')?.value;
  return {
    fromDate: fromVal ? new Date(`${fromVal}T00:00:00`) : null,
    toDate: toVal ? new Date(`${toVal}T23:59:59`) : null
  };
}

function renderReports() {
  const { fromDate, toDate } = getReportDateRange();

  const revenue = getRevenue(fromDate, toDate);
  const orders = getOrderCount(fromDate, toDate);
  const items = getItemsSold(fromDate, toDate);
  const avg = getAverageTicket(fromDate, toDate);

  const statsGrid = document.getElementById('reportStatsGrid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card dark">
        <div class="label">Total Revenue</div>
        <div class="value">${formatCurrency(revenue)}</div>
        <div class="sub">${orders} completed orders</div>
      </div>
      <div class="stat-card">
        <div class="label">Orders</div>
        <div class="value">${orders}</div>
        <div class="sub">Filtered period</div>
      </div>
      <div class="stat-card">
        <div class="label">Items Sold</div>
        <div class="value">${items}</div>
        <div class="sub">Units moved</div>
      </div>
      <div class="stat-card">
        <div class="label">Avg Order</div>
        <div class="value">${formatCurrency(avg)}</div>
        <div class="sub">Per transaction</div>
      </div>`;
  }

  renderRevenueChart(fromDate, toDate);
  renderReportProductsTable(fromDate, toDate);
  renderIngredientUsageTable(fromDate, toDate);
  renderReportInsightsTable(fromDate, toDate);
  renderHourlySalesChart(fromDate, toDate);
  renderPaymentBreakdown(fromDate, toDate);
}

function renderRevenueChart(fromDate, toDate) {
  const canvas = document.getElementById('reportRevenueChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const trend = getDailySalesTrend(fromDate, toDate);
  if (reportChartInstance) { reportChartInstance.destroy(); reportChartInstance = null; }

  const shortLabels = trend.labels.map(l => {
    const d = new Date(l);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  });

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
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatCurrency(ctx.parsed.y) }}
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#999' }},
        y: { grid: { color: '#f4f4f4' }, ticks: { font: { size: 11 }, color: '#999',
            callback: v => '₱' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) }}
      }
    }
  });
}

function renderHourlySalesChart(fromDate, toDate) {
  const canvas = document.getElementById('reportHourlyChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const hours = getHourlySales(fromDate, toDate);
  const labels = hours.map((_, i) => {
    const h = i % 12 || 12;
    const ampm = i < 12 ? 'am' : 'pm';
    return `${h}${ampm}`;
  });

  if (window._hourlyChartInstance) { window._hourlyChartInstance.destroy(); }
  window._hourlyChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: hours,
        backgroundColor: hours.map(v => v > 0 ? '#000' : '#f0f0f0'),
        borderRadius: 3, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatCurrency(ctx.parsed.y) }}},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#aaa' }},
        y: { grid: { color: '#f4f4f4' }, ticks: { font: { size: 10 }, color: '#999',
            callback: v => '₱' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) }}
      }
    }
  });
}

function renderPaymentBreakdown(fromDate, toDate) {
  const container = document.getElementById('paymentBreakdownContainer');
  if (!container) return;

  const breakdown = getPaymentBreakdown(fromDate, toDate);
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  if (!total) { container.innerHTML = `<div class="empty-state">No data</div>`; return; }

  container.innerHTML = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([method, amount]) => {
      const pct = ((amount / total) * 100).toFixed(1);
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;">${escapeHtml(method)}</span>
            <span style="font-size:11px;font-weight:700;">${formatCurrency(amount)} · ${pct}%</span>
          </div>
          <div style="height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:var(--black);border-radius:3px;transition:width .4s ease;"></div>
          </div>
        </div>`;
    }).join('');
}

function renderReportProductsTable(fromDate, toDate) {
  const tbody = document.querySelector('#reportProductsTable tbody');
  if (!tbody) return;

  const ranked = getProductProfitability(fromDate, toDate);
  tbody.innerHTML = '';

  if (!ranked.length) { tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No data</td></tr>`; return; }

  ranked.forEach(item => {
    const margin = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : '—';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(item.name)}</td>
      <td>${item.qty}</td>
      <td>${formatCurrency(item.revenue)}</td>
      <td>${formatCurrency(item.cost)}</td>
      <td style="font-weight:700;">${formatCurrency(item.profit)}${item.revenue > 0 ? ` <span style="font-size:10px;color:var(--gray-400);">(${margin}%)</span>` : ''}</td>`;
    tbody.appendChild(row);
  });
}

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
        const qty = Number(recipeItem.quantity || 0) * Number(item.quantity || 0);
        usage.set(ingredient.name + '|' + ingredient.unit + '|' + ingredient.id, (usage.get(ingredient.name + '|' + ingredient.unit + '|' + ingredient.id) || 0) + qty);
      });
    });
  });

  const ranked = Array.from(usage.entries()).sort((a, b) => b[1] - a[1]);
  tbody.innerHTML = '';
  if (!ranked.length) { tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No data</td></tr>`; return; }

  ranked.forEach(([key, qty]) => {
    const [name, unit, id] = key.split('|');
    const ingredient = (APP_STATE.ingredients || []).find(i => String(i.id) === String(id));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700;">${escapeHtml(name)}</td>
      <td>${Number(qty).toFixed(2)} ${escapeHtml(unit || '')}</td>
      <td>${ingredient ? `${ingredient.stock} ${escapeHtml(ingredient.unit || '')}` : '—'}</td>`;
    tbody.appendChild(row);
  });
}

function renderReportInsightsTable(fromDate, toDate) {
  const tbody = document.querySelector('#reportInsightsTable tbody');
  if (!tbody) return;

  const sales = getAnalyticsSales(fromDate, toDate);
  const completed = sales.filter(s => (s.status || '').toUpperCase() === 'COMPLETED');
  const pending = sales.filter(s => (s.status || '').toUpperCase() === 'PENDING');
  const uniqueProducts = new Set(sales.flatMap(s => Array.isArray(s.items) ? s.items.map(i => i.name) : [])).size;
  const uniqueCustomers = new Set(sales.map(s => s.customer?.name || s.customerName || '')).size;
  const discount = getTotalDiscount(fromDate, toDate);

  const rows = [
    ['Completed Sales', completed.length],
    ['Pending Orders', pending.length],
    ['Unique Products Sold', uniqueProducts],
    ['Unique Customers', uniqueCustomers],
    ['Total Discount Given', formatCurrency(discount)]
  ];

  tbody.innerHTML = '';
  rows.forEach(([metric, value]) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(metric)}</td><td style="font-weight:700;">${value}</td>`;
    tbody.appendChild(row);
  });
}

window.refreshDashboard = refreshDashboard;
window.renderTopProducts = renderTopProducts;
window.renderLowStockDashboard = renderLowStockDashboard;
window.renderReports = renderReports;
window.renderDashboardChart = renderDashboardChart;
