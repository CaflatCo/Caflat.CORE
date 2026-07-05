/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · LARDER   (real ingredients)
═══════════════════════════════════════════════════════════════ */
VIEWS.larder = function (root) {
  const ings = g2(() => getIngredients(), []);
  if (!ings.length) {
    emptyState(root, 'No ingredients yet',
      `Add ingredients in the classic app and their real stock levels will show up here, live.`, UI_ICON.box);
    return;
  }
  const globalThr = Number(APP_STATE.settings?.lowStockThreshold ?? 5);

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Inventory · real stock</span><h2 style="margin-top:4px">Larder</h2>
      <p class="muted" style="margin-top:6px">Live stock against reorder level. Colour only where you need to act.</p></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))" id="larderGrid"></div>`;

  function paint() {
    const grid = root.querySelector('#larderGrid');
    grid.innerHTML = ings.map((ing, i) => {
      const par = Number(ing.reorderLevel || 0) || globalThr;
      const stock = Number(ing.stock || 0);
      const ratio = par > 0 ? stock / par : (stock > 0 ? 2 : 0);
      const tone = ratio < .6 ? 'crit' : ratio < 1 ? 'warn' : 'live';
      return `<div class="card pad lift" style="border-radius:var(--r-lg);--i:${i}">
        <div class="row between"><span class="name" style="font-weight:640">${escapeHtml(ing.name)}</span>
          <span class="chip ${tone}" style="height:20px;font-size:9px"><span class="dot"></span>${tone === 'crit' ? 'Reorder' : tone === 'warn' ? 'Low' : 'Good'}</span></div>
        <div class="row" style="align-items:baseline;gap:6px;margin:var(--s3) 0 var(--s2)">
          <span class="num serif" style="font-size:1.8rem;font-weight:900;letter-spacing:-0.03em">${stock}</span>
          <span class="muted num" style="font-size:var(--t-sm)">/ ${par} ${escapeHtml(ing.unit || '')} reorder</span></div>
        <div class="meter ${tone}"><i style="width:${Math.min(100, ratio * 100)}%"></i></div>
      </div>`;
    }).join('');
    requestAnimationFrame(() => M.stagger(grid, 40));
  }
  paint();
};
