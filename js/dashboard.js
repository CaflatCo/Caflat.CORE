/* ═══════════════════════════════════════════════════════
   DASHBOARD.JS — Dashboard view rendering
   Pure renderer. All data from analytics.js.
   No calculations here.
═══════════════════════════════════════════════════════ */

let dashboardChartInstance = null;

/* ── Entry point ── */
function refreshDashboard() {
  const kpi = getKPISummary();

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dashboardTotalSales',  formatCurrency(kpi.totalRevenue || kpi.revenue));
  set('dashboardTotalOrders', kpi.totalOrders || kpi.orders);
  set('dashboardItemsSold',   kpi.itemsSold);
  set('dashboardAverageOrder',formatCurrency(kpi.avgTicket));

  // Revenue + orders breakdown sub-labels
  const rb = document.getElementById('dashboardRevenueBreakdown');
  if (rb) rb.textContent = `POS: ${formatCurrency(kpi.posRevenue)} (${kpi.posRevenuePercent}%) · Supply: ${formatCurrency(kpi.supplyRevenue)} (${kpi.supplyRevenuePercent}%)`;
  const ob = document.getElementById('dashboardOrdersBreakdown');
  if (ob) ob.textContent = `POS: ${kpi.posOrders} (${kpi.posOrderPercent}%) · Supply: ${kpi.supplyOrders} (${kpi.supplyOrderPercent}%)`;

  renderDashboardKPIAlerts(kpi);
  renderTopProducts();
  renderLowStockDashboard();
  renderDashboardChart();
  renderChannelBreakdownDashboard();
}

/* ── KPI alert badges ── */
function renderDashboardKPIAlerts(kpi) {
  const pendingEl = document.getElementById('dashboardPendingOrders');
  if (pendingEl) pendingEl.textContent = kpi.pendingOrders;

  const lowStockEl = document.getElementById('dashboardLowStockCount');
  if (lowStockEl) lowStockEl.textContent = kpi.lowStockCount;

  // Highlight alert cards
  const pendingCard = document.getElementById('dashboardPendingCard');
  if (pendingCard) {
    pendingCard.classList.toggle('dashboard-alert', kpi.pendingOrders > 0);
  }
  const stockCard = document.getElementById('dashboardStockCard');
  if (stockCard) {
    stockCard.classList.toggle('dashboard-alert', kpi.lowStockCount > 0);
  }
}

/* ── Sales trend chart ── */
function renderDashboardChart() {
  const canvas = document.getElementById('dashboardChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const trend = getDailySalesTrend();

  if (dashboardChartInstance) {
    dashboardChartInstance.destroy();
    dashboardChartInstance = null;
  }

  if (!trend.labels.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px Nunito, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('No sales data yet', canvas.width / 2, canvas.height / 2);
    return;
  }

  const labels = trend.labels.slice(-14);
  const values = trend.values.slice(-14);
  const shortLabels = labels.map(l =>
    new Date(l).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  );

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
          grid: { color: '#f0f0f0' },
          ticks: {
            font: { size: 11 }, color: '#999',
            callback: v => '₱' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
          }
        }
      }
    }
  });
}

/* ── Top products widget ── */
function renderTopProducts() {
  const container = document.getElementById('topProductsContainer');
  if (!container) return;

  const top = getTopProducts(5);

  if (!top.length) {
    container.innerHTML = `<div class="empty-state">No sales yet — complete a sale to see rankings</div>`;
    return;
  }

  container.innerHTML = top.map((item, i) => `
    <div class="top-product-row">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:10px;font-weight:900;color:var(--gray-300);width:16px;text-align:right;">${i + 1}</span>
        <div class="top-product-name">${escapeHtml(item.name)}</div>
      </div>
      <div class="top-product-qty">${item.qty} sold &middot; ${formatCurrency(item.revenue)}</div>
    </div>`).join('');
}

/* ── Low stock widget ── */
function renderLowStockDashboard() {
  const container = document.getElementById('lowStockContainer');
  if (!container) return;

  const ingredientAlerts = getLowStockItems();
  const productAlerts    = getLowStockProducts();

  const all = [
    ...ingredientAlerts.map(i => ({
      name: i.name, stock: Number(i.stock || 0), unit: i.unit || '',
      type: 'Ingredient', soldOut: Number(i.stock || 0) <= 0
    })),
    ...productAlerts.map(p => ({
      name: p.name, stock: Number(p.stock || 0), unit: 'units',
      type: 'Product', soldOut: Number(p.stock || 0) <= 0
    }))
  ];

  if (!all.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:20px 0;">
        All stock levels OK ✓
      </div>`;
    return;
  }

  // Sort: sold out first, then low stock
  all.sort((a, b) => Number(b.soldOut) - Number(a.soldOut));

  container.innerHTML = all.map(item => `
    <div class="low-stock-card${item.soldOut ? ' sold-out' : ''}">
      <div>
        <div class="low-stock-name">${escapeHtml(item.name)}</div>
        <div class="low-stock-meta" style="font-size:9px;letter-spacing:1px;text-transform:uppercase;">
          ${escapeHtml(item.type)} · ${item.soldOut ? 'OUT OF STOCK' : 'LOW STOCK'}
        </div>
      </div>
      <div class="low-stock-meta">
        ${item.soldOut ? '0' : item.stock} ${escapeHtml(item.unit)} left
      </div>
    </div>`).join('');
}


/* ── Channel breakdown (dashboard) ── */
function renderChannelBreakdownDashboard() {
  const container = document.getElementById('dashboardChannelBreakdown');
  if (!container) return;

  const revenue  = typeof getRevenueByChannel === 'function' ? getRevenueByChannel() : {};
  const orders   = typeof getOrdersByChannel  === 'function' ? getOrdersByChannel()  : {};
  const channels = Object.keys({ ...revenue, ...orders });

  if (!channels.length) {
    container.innerHTML = `<div class="empty-state">No sales data yet</div>`;
    return;
  }

  const totalRev = Object.values(revenue).reduce((s, v) => s + v, 0);

  container.innerHTML = channels.map(ch => {
    const chRev = revenue[ch] || 0;
    const chOrd = orders[ch]  || 0;
    const pct   = totalRev > 0 ? ((chRev / totalRev) * 100).toFixed(1) : '0.0';
    const barW  = totalRev > 0 ? Math.round((chRev / totalRev) * 100) : 0;

    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;
          align-items:baseline;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:700;">${escapeHtml(ch)}</span>
          <span style="font-size:12px;font-variant-numeric:tabular-nums;">
            ${formatCurrency(chRev)}
            <span style="color:var(--gray-400);font-size:10px;margin-left:4px;">
              ${chOrd} order${chOrd !== 1 ? 's' : ''} · ${pct}%
            </span>
          </span>
        </div>
        <div style="height:6px;background:var(--gray-100);border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${barW}%;background:var(--black);
            border-radius:999px;transition:width .3s ease;"></div>
        </div>
      </div>`;
  }).join('');
}

/* ── Exports ── */
window.refreshDashboard       = refreshDashboard;
window.renderChannelBreakdownDashboard = renderChannelBreakdownDashboard;
window.renderDashboardChart   = renderDashboardChart;
window.renderTopProducts      = renderTopProducts;
window.renderLowStockDashboard= renderLowStockDashboard;

