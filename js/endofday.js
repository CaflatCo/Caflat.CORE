/* ═══════════════════════════════════════════════════════
   ENDOFDAY.JS — End of Day Summary
   Shows today's revenue, top sellers, production,
   FG remaining, low stock, and suggestions.
   Accessible from Dashboard.
═══════════════════════════════════════════════════════ */

function openEndOfDaySummary() {
  _renderEndOfDayContent();
  openModal('endOfDayModal');
}

function _renderEndOfDayContent() {
  const container = document.getElementById('endOfDayContent');
  if (!container) return;

  const now      = new Date();
  const todayStr = now.toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  // Today's date boundaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  // Get today's completed sales
  const allSales    = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  const todaySales  = allSales.filter(s => {
    const d = s.audit?.completedAt || s.completedAt || s.createdAt || '';
    return d >= todayStart && d <= todayEnd &&
      ['COMPLETED','PAID'].includes(s.status || s.paymentStatus || '');
  });

  // Revenue
  const totalRevenue = todaySales.reduce((s, sale) =>
    s + Number(sale.totals?.total ?? sale.total ?? 0), 0);
  const orderCount   = todaySales.length;
  const avgOrder     = orderCount > 0 ? totalRevenue / orderCount : 0;

  // Units sold map
  const soldMap = {};
  todaySales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const qty = Number(item.quantity || 0) * Number(item.multiplier || 1);
      soldMap[item.productId] = (soldMap[item.productId] || 0) + qty;
    });
  });

  // Top sellers
  const topSellers = Object.entries(soldMap)
    .map(([productId, qty]) => {
      const product = (APP_STATE.products || []).find(p => String(p.id) === String(productId));
      const revenue = todaySales.reduce((s, sale) =>
        s + (sale.items || []).filter(i => String(i.productId) === String(productId))
          .reduce((ss, i) => ss + Number(i.lineTotal || 0), 0), 0);
      return { name: product?.name || 'Unknown', qty, revenue };
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Payment breakdown
  const paymentBreakdown = {};
  todaySales.forEach(s => {
    const method = s.payment?.method || s.paymentMethod || 'cash';
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) +
      Number(s.totals?.total ?? s.total ?? 0);
  });

  // Production today
  const todayJobs = (APP_STATE.productionJobs || []).filter(job => {
    const d = job.updatedAt || job.createdAt || '';
    return d >= todayStart && d <= todayEnd &&
      ['DONE','PACKED'].includes(job.status);
  });
  const totalProduced = todayJobs.reduce((s, job) =>
    s + (job.products || []).reduce((ss, l) => ss + Number(l.actualYield ?? l.targetQty ?? 0), 0), 0);
  const efficiencies  = todayJobs.flatMap(j => (j.products || [])
    .filter(l => l.efficiency != null).map(l => l.efficiency));
  const avgEfficiency = efficiencies.length
    ? Math.round(efficiencies.reduce((s, e) => s + e, 0) / efficiencies.length) : null;

  // Finished goods remaining (FG-mode products)
  const fgProducts = (APP_STATE.products || []).filter(p =>
    typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(p));
  const fgRemaining = fgProducts.map(p => ({
    name:      p.name,
    available: typeof getFGAvailable === 'function' ? getFGAvailable(p.id) : Number(p.stock || 0)
  })).filter(p => p.available > 0);

  // Low stock ingredients
  const lowIngredients = (APP_STATE.ingredients || []).filter(ing =>
    Number(ing.stock || 0) <= Number(ing.reorderLevel || 0));

  // Suggestions
  const suggestions = [];
  if (lowIngredients.length > 0)
    suggestions.push(`Restock ${lowIngredients.slice(0, 3).map(i => i.name).join(', ')}${lowIngredients.length > 3 ? ` +${lowIngredients.length - 3} more` : ''}`);
  const lowFG = fgProducts.filter(p => {
    const avail = typeof getFGAvailable === 'function' ? getFGAvailable(p.id) : Number(p.stock || 0);
    return avail <= Number(p.reorderLevel || 0);
  });
  if (lowFG.length > 0)
    suggestions.push(`Consider production run for: ${lowFG.slice(0, 2).map(p => p.name).join(', ')}`);
  if (totalRevenue > 0 && avgOrder > 0)
    suggestions.push(`Strong day — ${orderCount} orders averaging ${formatCurrency(avgOrder)}`);

  const pmLabels = { cash: 'Cash', gcash: 'GCash', maya: 'Maya', bank: 'Bank Transfer', qrph: 'QR Ph' };

  container.innerHTML = `
    <div style="font-size:11px;color:var(--gray-400);margin-bottom:16px;">${todayStr}</div>

    <!-- Revenue -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
      ${[
        ['Revenue', formatCurrency(totalRevenue), '#16a34a'],
        ['Orders',  orderCount,                   ''],
        ['Avg Order', formatCurrency(avgOrder),   ''],
      ].map(([label, val, color]) => `
        <div style="border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;">
          <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
            text-transform:uppercase;color:var(--gray-400);margin-bottom:4px;">${label}</div>
          <div style="font-size:20px;font-weight:900;${color?'color:'+color+';':''}">
            ${val || '—'}
          </div>
        </div>`).join('')}
    </div>

    ${todaySales.length === 0 ? `
    <div class="empty-state" style="padding:16px 0;margin-bottom:16px;">
      No completed sales today yet
    </div>` : ''}

    ${topSellers.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;">Top Sellers</div>
      ${topSellers.map((p, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:7px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:10px;font-weight:900;color:var(--gray-300);
              width:14px;">${i + 1}</span>
            <span style="font-size:12px;font-weight:700;">${escapeHtml(p.name)}</span>
          </div>
          <div style="text-align:right;">
            <span style="font-size:12px;font-weight:800;">×${p.qty}</span>
            <span style="font-size:11px;color:var(--gray-400);margin-left:6px;">
              ${formatCurrency(p.revenue)}</span>
          </div>
        </div>`).join('')}
    </div>` : ''}

    ${Object.keys(paymentBreakdown).length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;">Payment Methods</div>
      ${Object.entries(paymentBreakdown).map(([method, amt]) => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;
          border-bottom:1px solid var(--border);font-size:12px;">
          <span>${pmLabels[method] || method}</span>
          <span style="font-weight:700;">${formatCurrency(amt)}</span>
        </div>`).join('')}
    </div>` : ''}

    ${APP_STATE.settings?.productionModeEnabled && todayJobs.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;">Production Today</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;">
          <div style="font-size:9px;color:var(--gray-400);margin-bottom:2px;">Jobs Completed</div>
          <div style="font-size:18px;font-weight:900;">${todayJobs.length}</div>
        </div>
        <div style="border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;">
          <div style="font-size:9px;color:var(--gray-400);margin-bottom:2px;">Units Produced</div>
          <div style="font-size:18px;font-weight:900;">${totalProduced}</div>
        </div>
        ${avgEfficiency !== null ? `
        <div style="border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;">
          <div style="font-size:9px;color:var(--gray-400);margin-bottom:2px;">Avg Efficiency</div>
          <div style="font-size:18px;font-weight:900;
            color:${avgEfficiency>=90?'#16a34a':avgEfficiency>=70?'#ea580c':'#dc2626'};">
            ${avgEfficiency}%</div>
        </div>` : ''}
      </div>
    </div>` : ''}

    ${fgRemaining.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;">Finished Goods Remaining</div>
      ${fgRemaining.map(p => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;
          border-bottom:1px solid var(--border);font-size:12px;">
          <span>${escapeHtml(p.name)}</span>
          <span style="font-weight:800;">${p.available} units</span>
        </div>`).join('')}
    </div>` : ''}

    ${lowIngredients.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:#dc2626;margin-bottom:8px;">⚠ Low Ingredients</div>
      ${lowIngredients.map(ing => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;
          border-bottom:1px solid #fee2e2;font-size:12px;">
          <span style="font-weight:700;">${escapeHtml(ing.name)}</span>
          <span style="color:#dc2626;">${ing.stock} ${ing.unit} remaining</span>
        </div>`).join('')}
    </div>` : ''}

    ${suggestions.length > 0 ? `
    <div style="background:var(--gray-50);border-radius:12px;padding:14px 16px;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;">Suggestions for Tomorrow</div>
      ${suggestions.map(s => `
        <div style="font-size:12px;color:var(--gray-700);padding:3px 0;">
          → ${escapeHtml(s)}
        </div>`).join('')}
    </div>` : ''}`;
}

function shareEndOfDay() {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const el      = document.getElementById('endOfDayContent');
  if (!el) return;

  // Build plain text from rendered data
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const todaySales = (APP_STATE.sales || []).filter(s => {
    const d = s.audit?.completedAt || s.completedAt || s.createdAt || '';
    return d >= todayStart && d <= todayEnd &&
      ['COMPLETED','PAID'].includes(s.status || s.paymentStatus || '');
  });
  const revenue = todaySales.reduce((s, sale) => s + Number(sale.totals?.total ?? sale.total ?? 0), 0);

  let text = `END OF DAY — ${dateStr}\n`;
  text += `─────────────────────────\n`;
  text += `Revenue: ${formatCurrency(revenue)}\n`;
  text += `Orders: ${todaySales.length}\n`;
  text += `\nGenerated by Caflat.CORE`;

  if (navigator.share) {
    navigator.share({ title: 'End of Day Summary', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() =>
      showNotification('Copied to clipboard', 'success'));
  }
}

window.openEndOfDaySummary = openEndOfDaySummary;
window.shareEndOfDay       = shareEndOfDay;
window.shareEndOfDay       = shareEndOfDay;
