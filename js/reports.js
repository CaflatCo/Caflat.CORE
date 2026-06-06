let reportRevenueChartInstance = null;

function getSales() {
  return Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
}

function getFilteredSales() {
  const fromDateEl = document.getElementById('reportFromDate');
  const toDateEl = document.getElementById('reportToDate');

  const fromDate = fromDateEl?.value ? new Date(`${fromDateEl.value}T00:00:00`) : null;
  const toDate = toDateEl?.value ? new Date(`${toDateEl.value}T23:59:59`) : null;

  return getSales().filter(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    const matchesFrom = !fromDate || saleDate >= fromDate;
    const matchesTo = !toDate || saleDate <= toDate;
    return matchesFrom && matchesTo;
  });
}

function calculateReportMetrics(sales = getFilteredSales()) {
  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total ?? sale.totals?.total ?? 0), 0);
  const totalOrders = sales.length;
  const totalItemsSold = sales.reduce(
    (sum, sale) =>
      sum + (Array.isArray(sale.items)
        ? sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0)
        : 0),
    0
  );
  const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  return { totalSales, totalOrders, totalItemsSold, averageOrderValue };
}

function refreshDashboard() {
  const metrics = calculateReportMetrics(getSales());

  const totalSalesEl = document.getElementById('dashboardTotalSales');
  const totalOrdersEl = document.getElementById('dashboardTotalOrders');
  const totalItemsEl = document.getElementById('dashboardItemsSold');
  const averageOrderEl = document.getElementById('dashboardAverageOrder');

  if (totalSalesEl) totalSalesEl.textContent = formatCurrency(metrics.totalSales);
  if (totalOrdersEl) totalOrdersEl.textContent = metrics.totalOrders;
  if (totalItemsEl) totalItemsEl.textContent = metrics.totalItemsSold;
  if (averageOrderEl) averageOrderEl.textContent = formatCurrency(metrics.averageOrderValue);

  renderTopProducts();
  renderLowStockDashboard();
}

function renderTopProducts() {
  const container = document.getElementById('topProductsContainer');
  if (!container) return;

  const sales = getSales();
  const totals = {};

  sales.forEach(sale => {
    if (!Array.isArray(sale.items)) return;

    sale.items.forEach(item => {
      if (!totals[item.name]) totals[item.name] = 0;
      totals[item.name] += Number(item.quantity || 0);
    });
  });

  const ranked = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  container.innerHTML = '';

  if (!ranked.length) {
    container.innerHTML = `<div class="empty-state">No sales data yet</div>`;
    return;
  }

  ranked.forEach(([name, qty]) => {
    const row = document.createElement('div');
    row.className = 'top-product-row';
    row.innerHTML = `
      <div class="top-product-name">${escapeHtml(name)}</div>
      <div class="top-product-qty">${qty} sold</div>
    `;
    container.appendChild(row);
  });
}

function renderLowStockDashboard() {
  const container = document.getElementById('lowStockContainer');
  if (!container) return;

  const lowStockItems = (APP_STATE.ingredients || []).filter(
    ingredient => Number(ingredient.stock || 0) <= Number(ingredient.reorderLevel || 0)
  );

  container.innerHTML = '';

  if (!lowStockItems.length) {
    container.innerHTML = `<div class="empty-state">No low stock alerts</div>`;
    return;
  }

  lowStockItems.forEach(ingredient => {
    const card = document.createElement('div');
    card.className = 'low-stock-card';
    card.innerHTML = `
      <div class="low-stock-name">${escapeHtml(ingredient.name)}</div>
      <div class="low-stock-meta">${ingredient.stock} ${escapeHtml(ingredient.unit)} left</div>
    `;
    container.appendChild(card);
  });
}

function renderReports() {
  const sales = getFilteredSales();
  const metrics = calculateReportMetrics(sales);

  const statsGrid = document.getElementById('reportStatsGrid');
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="label">Total Sales</div>
        <div class="value">${formatCurrency(metrics.totalSales)}</div>
        <div class="sub">${metrics.totalOrders} orders</div>
      </div>
      <div class="stat-card">
        <div class="label">Orders</div>
        <div class="value">${metrics.totalOrders}</div>
        <div class="sub">Filtered period</div>
      </div>
      <div class="stat-card">
        <div class="label">Items Sold</div>
        <div class="value">${metrics.totalItemsSold}</div>
        <div class="sub">Units moved</div>
      </div>
      <div class="stat-card">
        <div class="label">Avg Order</div>
        <div class="value">${formatCurrency(metrics.averageOrderValue)}</div>
        <div class="sub">Per order value</div>
      </div>
    `;
  }

  renderRevenueChart(sales);
  renderReportProductsTable(sales);
  renderIngredientUsageTable(sales);
  renderReportInsightsTable(sales);
}

function renderRevenueChart(sales) {
  const canvas = document.getElementById('reportRevenueChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const daily = new Map();

  sales.forEach(sale => {
    const date = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    const key = date.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) || 0) + Number(sale.total ?? sale.totals?.total ?? 0));
  });

  const labels = Array.from(daily.keys()).sort();
  const values = labels.map(label => daily.get(label));

  if (reportRevenueChartInstance) {
    reportRevenueChartInstance.destroy();
  }

  reportRevenueChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        tension: 0.35,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderReportProductsTable(sales) {
  const tbody = document.querySelector('#reportProductsTable tbody');
  if (!tbody) return;

  const totals = {};

  sales.forEach(sale => {
    if (!Array.isArray(sale.items)) return;
    sale.items.forEach(item => {
      if (!totals[item.name]) {
        totals[item.name] = { qty: 0, revenue: 0, cost: 0, profit: 0 };
      }
      totals[item.name].qty += Number(item.quantity || 0);
      totals[item.name].revenue += Number(item.total || (Number(item.price || 0) * Number(item.quantity || 0)));

      const product = (APP_STATE.products || []).find(
        p => String(p.id) === String(item.productId)
      );

      let lineCost = 0;

      if (product && Array.isArray(product.recipe)) {
        product.recipe.forEach(recipeItem => {
          const ingredient = (APP_STATE.ingredients || []).find(
            i => String(i.id) === String(recipeItem.ingredientId)
          );

          if (!ingredient) return;

          lineCost +=
            Number(recipeItem.quantity || 0) *
            Number(ingredient.costPerUnit || 0) *
            Number(item.quantity || 0);
        });
      }

      totals[item.name].cost += lineCost;
      totals[item.name].profit =
        totals[item.name].revenue - totals[item.name].cost;
    });
  });

  const ranked = Object.entries(totals)
    .sort((a, b) => b[1].revenue - a[1].revenue);

  tbody.innerHTML = '';

  if (!ranked.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No data</td></tr>`;
    return;
  }

  ranked.forEach(([name, info]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${info.qty}</td>
      <td>${formatCurrency(info.revenue)}</td>
      <td>${formatCurrency(info.profit || 0)}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderIngredientUsageTable(sales) {
  const tbody = document.querySelector('#ingredientUsageTable tbody');
  if (!tbody) return;

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
        usage.set(ingredient.name, (usage.get(ingredient.name) || 0) + qty);
      });
    });
  });

  const ranked = Array.from(usage.entries()).sort((a, b) => b[1] - a[1]);
  tbody.innerHTML = '';

  if (!ranked.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No data</td></tr>`;
    return;
  }

  ranked.forEach(([name, qty]) => {
    const ingredient = (APP_STATE.ingredients || []).find(i => i.name === name);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${qty}</td>
      <td>${ingredient ? ingredient.stock : '—'}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderReportInsightsTable(sales) {
  const tbody = document.querySelector('#reportInsightsTable tbody');
  if (!tbody) return;

  const completedSales = sales.filter(sale => (sale.status || '').toUpperCase() === 'COMPLETED');
  const pendingSales = sales.filter(sale => (sale.status || '').toUpperCase() === 'PENDING');

  const rows = [
    ['Completed Sales', completedSales.length],
    ['Pending Orders', pendingSales.length],
    ['Unique Products Sold', new Set(sales.flatMap(sale => Array.isArray(sale.items) ? sale.items.map(i => i.name) : [])).size],
    ['Unique Customers', new Set(sales.map(sale => sale.customer?.name || sale.customerName || '')).size]
  ];

  tbody.innerHTML = '';
  rows.forEach(([metric, value]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(metric)}</td>
      <td>${value}</td>
    `;
    tbody.appendChild(row);
  });
}

function exportSalesReport() {
  const sales = getSales();
  const lines = [
    ['Receipt', 'Date', 'Payment', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total'].join(',')
  ];

  sales.forEach(sale => {
    const saleDate = new Date(sale.audit?.completedAt || sale.completedAt || sale.createdAt || Date.now());
    lines.push([
      sale.receiptNumber || sale.id || '',
      saleDate.toISOString(),
      sale.paymentMethod || sale.payment?.method || '',
      sale.status || '',
      Number(sale.subtotal ?? sale.totals?.subtotal ?? 0),
      Number(sale.discount ?? sale.totals?.discount ?? 0),
      Number(sale.tax ?? sale.totals?.tax ?? 0),
      Number(sale.total ?? sale.totals?.total ?? 0)
    ].join(','));
  });

  downloadTextFile(`sales-report-${Date.now()}.csv`, lines.join('\n'));
  showNotification('Sales report exported', 'success');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.getSales = getSales;
window.calculateReportMetrics = calculateReportMetrics;
window.refreshDashboard = refreshDashboard;
window.renderTopProducts = renderTopProducts;
window.renderReports = renderReports;
window.exportSalesReport = exportSalesReport;
window.renderLowStockDashboard = renderLowStockDashboard;
