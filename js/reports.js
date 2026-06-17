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
  renderChannelBreakdownReport(fromDate, toDate);
  renderReportProductsTable(fromDate, toDate);
  renderBreakEvenReport(fromDate, toDate);
  renderCategoryPerformance(fromDate, toDate);
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
/* ── Channel breakdown (reports) ── */
function renderChannelBreakdownReport(fromDate, toDate) {
  const container = document.getElementById('reportChannelContainer');
  if (!container) return;

  const revenue  = typeof getRevenueByChannel === 'function' ? getRevenueByChannel(fromDate, toDate) : {};
  const orders   = typeof getOrdersByChannel  === 'function' ? getOrdersByChannel(fromDate, toDate)  : {};
  const channels = Object.keys({ ...revenue, ...orders });

  if (!channels.length) {
    container.innerHTML = `<tr><td colspan="4" class="empty-state">No sales data for period</td></tr>`;
    return;
  }

  const totalRev = Object.values(revenue).reduce((s, v) => s + v, 0);
  const totalOrd = Object.values(orders).reduce((s, v) => s + v, 0);

  container.innerHTML = channels
    .sort((a, b) => (revenue[b] || 0) - (revenue[a] || 0))
    .map(ch => {
      const chRev = revenue[ch] || 0;
      const chOrd = orders[ch]  || 0;
      const revPct = totalRev > 0 ? ((chRev / totalRev) * 100).toFixed(1) : '0.0';
      const ordPct = totalOrd > 0 ? ((chOrd / totalOrd) * 100).toFixed(1) : '0.0';
      const avg    = chOrd > 0 ? chRev / chOrd : 0;
      return `
        <tr>
          <td style="font-weight:700;">${escapeHtml(ch)}</td>
          <td style="font-variant-numeric:tabular-nums;">${formatCurrency(chRev)}
            <span style="color:var(--gray-400);font-size:10px;margin-left:4px;">${revPct}%</span>
          </td>
          <td>${chOrd}
            <span style="color:var(--gray-400);font-size:10px;margin-left:4px;">${ordPct}%</span>
          </td>
          <td style="font-variant-numeric:tabular-nums;">${formatCurrency(avg)}</td>
        </tr>`;
    }).join('');
}

/* ── Category performance — auto-generates for every category ── */
let _categoryChartInstances = {};

function renderCategoryPerformance(fromDate, toDate) {
  const container = document.getElementById('categoryPerformanceContainer');
  if (!container) return;

  const categories = typeof getCategoryPerformance === 'function'
    ? getCategoryPerformance(fromDate, toDate) : [];

  if (!categories.length || categories.every(c => c.revenue === 0)) {
    container.innerHTML = `<div class="empty-state">No category sales data for selected period</div>`;
    return;
  }

  // Destroy old chart instances
  Object.values(_categoryChartInstances).forEach(c => { try { c.destroy(); } catch(e) {} });
  _categoryChartInstances = {};

  // Summary bar chart (all categories)
  const summaryId = 'categorySummaryChart';
  const topRow = `
    <div style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:12px;">Revenue by Category</div>
      <div class="chart-container" style="height:180px;">
        <canvas id="${summaryId}"></canvas>
      </div>
    </div>

    <div class="table-wrapper" style="margin-bottom:28px;">
      <table>
        <thead>
          <tr>
            <th>Category</th><th>Revenue</th><th>Units Sold</th>
            <th>Orders</th><th>Top Product</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map(cat => `
            <tr>
              <td style="font-weight:700;">${escapeHtml(cat.category)}</td>
              <td style="font-variant-numeric:tabular-nums;font-weight:700;">
                ${formatCurrency(cat.revenue)}</td>
              <td>${cat.qty}</td>
              <td>${cat.orders}</td>
              <td style="font-size:11px;color:var(--gray-500);">
                ${cat.topItems[0] ? escapeHtml(cat.topItems[0].name) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">`;

  // Per-category cards with mini charts
  const activeCats = categories.filter(c => c.revenue > 0);
  const catCards   = activeCats.map(cat => {
    const chartId = `catChart_${cat.category.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'')}`;
    return `
      <div style="border:1.5px solid var(--border);border-radius:var(--radius-lg);
        padding:16px;background:var(--white);">
        <div style="font-weight:800;font-size:13px;margin-bottom:4px;">
          ${escapeHtml(cat.category)}</div>
        <div style="font-size:20px;font-weight:900;margin-bottom:12px;">
          ${formatCurrency(cat.revenue)}</div>
        <div style="height:100px;margin-bottom:12px;">
          <canvas id="${chartId}"></canvas>
        </div>
        <div style="font-size:11px;color:var(--gray-500);margin-bottom:8px;">
          Top products:</div>
        ${cat.topItems.map(item => `
          <div style="display:flex;justify-content:space-between;font-size:12px;
            padding:3px 0;border-bottom:1px solid var(--border);">
            <span style="font-weight:700;">${escapeHtml(item.name)}</span>
            <span style="color:var(--gray-500);">${item.qty} · ${formatCurrency(item.revenue)}</span>
          </div>`).join('')}
      </div>`;
  }).join('');

  container.innerHTML = topRow + catCards + `</div>`;

  // Render summary chart
  requestAnimationFrame(() => {
    if (typeof Chart === 'undefined') return;

    const summaryCanvas = document.getElementById(summaryId);
    if (summaryCanvas) {
      _categoryChartInstances[summaryId] = new Chart(summaryCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: categories.map(c => c.category),
          datasets: [{
            data:            categories.map(c => c.revenue),
            backgroundColor: categories.map((_, i) =>
              i === 0 ? '#000' : `hsl(0,0%,${Math.min(75, 30 + i * 12)}%)`),
            borderRadius: 4,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => formatCurrency(ctx.parsed.y) } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#999' } },
            y: { grid: { color: '#f0f0f0' },
              ticks: { font: { size: 10 }, color: '#999',
                callback: v => '₱' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) }}
          }
        }
      });
    }

    // Per-category mini doughnut charts
    activeCats.forEach(cat => {
      const chartId = `catChart_${cat.category.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'')}`;
      const canvas  = document.getElementById(chartId);
      if (!canvas || !cat.topItems.length) return;

      const colors = ['#000','#555','#999','#ccc'];
      _categoryChartInstances[chartId] = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels:   cat.topItems.map(i => i.name),
          datasets: [{
            data:            cat.topItems.map(i => i.revenue),
            backgroundColor: cat.topItems.map((_, i) => colors[i] || '#eee'),
            borderWidth:     0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } }
          }
        }
      });
    });
  });
}

/* ── Break-even analysis report ── */
function renderBreakEvenReport(fromDate, toDate) {
  const container = document.getElementById('reportBreakEvenContainer');
  if (!container) return;

  const analysis = typeof getBreakEvenAnalysis === 'function'
    ? getBreakEvenAnalysis(fromDate, toDate) : [];

  if (!analysis.length) {
    container.innerHTML = `<div class="empty-state">
      No products with pricing and recipe data</div>`;
    return;
  }

  const totalPureProfit = analysis.reduce((s, p) => s + p.actualPureProfit, 0);
  const profitable      = analysis.filter(p => p.status === 'PROFITABLE').length;
  const inProgress      = analysis.filter(p => p.status === 'IN_PROGRESS').length;
  const noBatch         = analysis.filter(p => p.status === 'NO_BATCH').length;
  const withBatch       = analysis.filter(p => p.hasBatchContext).length;

  container.innerHTML = `
    <!-- Summary KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      ${[
        ['Products with Batch Data', withBatch,    ''],
        ['Above Break-Even',         profitable,   '#16a34a'],
        ['Working Towards It',       inProgress,   '#2563eb'],
        ['Pure Profit Earned',       formatCurrency(totalPureProfit), '#16a34a'],
      ].map(([label, val, color]) => `
        <div class="stat-card">
          <div class="label">${label}</div>
          <div class="value" style="font-size:20px;${color?'color:'+color+';':''}">
            ${val}</div>
        </div>`).join('')}
    </div>

    <!-- Per-product breakdown -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Cost/Unit</th>
            <th>Margin</th>
            <th>Break-Even</th>
            <th>Sold (period)</th>
            <th>Progress</th>
            <th>Pure Profit Units</th>
            <th>Pure Profit Earned</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.map(p => {
            const statusColor = p.status === 'PROFITABLE' ? '#16a34a'
                              : p.status === 'IN_PROGRESS' ? '#2563eb'
                              : p.status === 'NO_BATCH'    ? '#9ca3af'
                              : '#9ca3af';
            const statusLabel = p.status === 'PROFITABLE' ? '✓ Above break-even'
                              : p.status === 'IN_PROGRESS' ? 'In progress'
                              : p.status === 'NO_BATCH'    ? 'Set batch yield'
                              : 'No sales';
            return `
              <tr>
                <td style="font-weight:700;">${escapeHtml(p.name)}
                  <div style="font-size:10px;color:var(--gray-400);">${escapeHtml(p.category)}</div>
                </td>
                <td>${formatCurrency(p.price)}</td>
                <td>${formatCurrency(p.costPerUnit)}</td>
                <td style="color:${p.margin>=60?'#16a34a':p.margin>=40?'#ea580c':'#dc2626'};
                  font-weight:700;">${p.margin.toFixed(1)}%</td>
                <td>
                  ${p.hasBatchContext
                    ? `<span style="font-size:14px;font-weight:900;">${p.breakEvenUnits}</span>
                       <span style="font-size:10px;color:var(--gray-400);"> of ${p.batchYield}</span>`
                    : `<span style="font-size:10px;color:var(--gray-400);">
                         Set batch yield on product</span>`}
                </td>
                <td style="font-variant-numeric:tabular-nums;">
                  <span style="font-weight:700;">${p.soldQty}</span>
                  <span style="font-size:10px;color:var(--gray-400);"> units</span>
                </td>
                <td>
                  ${p.hasBatchContext && p.progressPct !== null ? `
                  <div style="display:flex;align-items:center;gap:6px;">
                    <div style="flex:1;height:8px;background:var(--gray-100);
                      border-radius:999px;overflow:hidden;min-width:60px;">
                      <div style="height:100%;width:${p.progressPct}%;
                        background:${statusColor};border-radius:999px;"></div>
                    </div>
                    <span style="font-size:10px;font-weight:800;color:${statusColor};
                      white-space:nowrap;">${p.progressPct}%</span>
                  </div>
                  <div style="font-size:10px;color:${statusColor};margin-top:2px;
                    font-weight:700;">${statusLabel}</div>` : `
                  <span style="font-size:10px;color:var(--gray-400);">—</span>`}
                </td>
                <td style="font-variant-numeric:tabular-nums;">
                  ${p.pureProfitQty > 0
                    ? `<span style="font-weight:800;color:#16a34a;">${p.pureProfitQty} units</span>
                       <div style="font-size:10px;color:var(--gray-400);">
                         +${formatCurrency(p.pureProfit)}/unit</div>`
                    : '<span style="color:var(--gray-400);">—</span>'}
                </td>
                <td style="font-variant-numeric:tabular-nums;">
                  ${p.actualPureProfit > 0
                    ? `<span style="font-weight:900;color:#16a34a;font-size:14px;">
                        ${formatCurrency(p.actualPureProfit)}</span>`
                    : '<span style="color:var(--gray-400);">—</span>'}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

window.renderReports              = renderReports;
window.renderReportKPIs           = renderReportKPIs;
window.renderRevenueChart         = renderRevenueChart;
window.renderHourlySalesChart     = renderHourlySalesChart;
window.renderPaymentBreakdown     = renderPaymentBreakdown;
window.renderReportProductsTable  = renderReportProductsTable;
window.renderIngredientUsageTable = renderIngredientUsageTable;
window.renderReportInsightsTable  = renderReportInsightsTable;
