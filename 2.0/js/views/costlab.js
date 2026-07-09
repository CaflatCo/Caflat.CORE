/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · COST LAB   (real per-product cost + margin)
═══════════════════════════════════════════════════════════════ */
VIEWS.costlab = function (root) {
  const products = g2(() => getProducts(), []).filter(p => (p.recipe?.length > 0) || (p.packagingItems?.length > 0));
  let openId = null;

  if (!products.length) {
    emptyState(root, 'No costed products yet',
      `Cost Lab breaks down ingredient, packaging, labor, and overhead cost per unit against your real recipes. Add ingredients to a product's recipe in Catalog to see it here.`,
      UI_ICON.box);
    return;
  }

  const settings = () => APP_STATE.costLabSettings || {};

  function marginTone(margin) {
    const target = Number(settings().targetMargin ?? 60);
    if (margin < 0) return { label: 'LOSS', tone: 'crit' };
    if (margin >= target) return { label: 'Healthy', tone: 'live' };
    if (margin >= target - 10) return { label: 'Low', tone: 'warn' };
    return { label: 'Critical', tone: 'crit' };
  }

  function paint() {
    const costs = products.map(p => ({ p, c: calcProductCost(p) }));
    const target = Number(settings().targetMargin ?? 60);
    const avgMargin = costs.reduce((s, x) => s + x.c.margin, 0) / costs.length;
    const losers = costs.filter(x => x.c.margin < 0).length;

    root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Cost Lab · real recipe economics</span><h2 style="margin-top:4px">Cost Lab</h2>
      <p class="muted" style="margin-top:6px">Ingredient, packaging, labor, and overhead cost per unit — computed from real recipes and ingredient costs.</p></div>
      <button class="btn btn-ghost" id="clSettingsBtn">Settings</button></div>

    <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-bottom:var(--s6)">
      <div class="card pad" style="border-radius:var(--r-xl)"><span class="eyebrow">Avg margin</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" style="font-size:1.7rem">${avgMargin.toFixed(1)}%</div></div></div>
      <div class="card pad" style="border-radius:var(--r-xl)"><span class="eyebrow">Target margin</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" style="font-size:1.7rem">${target}%</div></div></div>
      <div class="card pad" style="border-radius:var(--r-xl)"><span class="eyebrow">Selling at a loss</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" style="font-size:1.7rem;color:${losers ? 'var(--crit)' : 'inherit'}">${losers}</div></div></div>
    </div>

    <div class="card pad" style="border-radius:var(--r-xl)">
      <span class="eyebrow">Products</span>
      <div class="stack gap2" id="clList" style="margin-top:var(--s3)"></div>
    </div>

    <div class="card pad" id="clSettingsForm" style="border-radius:var(--r-xl);margin-top:var(--s5);display:none">
      <span class="eyebrow">Cost Lab settings</span>
      <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:var(--s3);margin:var(--s3) 0">
        <input id="clTargetMargin" type="number" min="0" max="100" class="field" placeholder="Target margin %" value="${settings().targetMargin ?? 60}">
        <input id="clDefaultLabor" type="number" min="0" step="0.01" class="field" placeholder="Default labor/unit" value="${settings().laborCostPerUnit ?? 0}">
        <input id="clDefaultOverhead" type="number" min="0" step="0.01" class="field" placeholder="Default overhead/unit" value="${settings().overheadCostPerUnit ?? 0}">
      </div>
      <button class="btn btn-sm" id="clSettingsSave">Save settings</button>
    </div>`;

    paintList(costs);

    root.querySelector('#clSettingsBtn').addEventListener('click', () => {
      const f = root.querySelector('#clSettingsForm');
      f.style.display = f.style.display === 'none' ? '' : 'none';
    });
    root.querySelector('#clSettingsSave').addEventListener('click', () => {
      ENGINE.saveCostLabSettings({
        targetMargin: root.querySelector('#clTargetMargin').value,
        laborCostPerUnit: root.querySelector('#clDefaultLabor').value,
        overheadCostPerUnit: root.querySelector('#clDefaultOverhead').value,
      });
      M.toast('Cost Lab settings saved', '', 'success');
      paint();
    });
  }

  function paintList(costs) {
    const host = root.querySelector('#clList');
    host.innerHTML = costs.map(({ p, c }) => {
      const mt = marginTone(c.margin);
      const override = APP_STATE.costLabOverrides?.[p.id];
      return `
      <div class="card pad" style="border-radius:var(--r-lg);background:var(--paper-2)">
        <div class="row between" style="cursor:pointer" data-toggle="${p.id}">
          <div class="grow"><div class="name" style="font-weight:700">${escapeHtml(p.name)}</div>
            <div class="sub">Cost ${formatCurrency(c.totalCost)} · Price ${formatCurrency(c.price)}${override ? ' · override active' : ''}</div></div>
          <span class="chip ${mt.tone}"><span class="dot"></span>${c.margin.toFixed(1)}%</span>
        </div>
        <div id="cl-detail-${p.id}" style="display:${openId === p.id ? 'block' : 'none'};margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--line)">
          <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:var(--s2);margin-bottom:var(--s3);font-size:var(--t-sm)">
            <div><div class="muted">Ingredients</div><div class="num" style="font-weight:700">${formatCurrency(c.ingCost)}</div></div>
            <div><div class="muted">Packaging</div><div class="num" style="font-weight:700">${formatCurrency(c.packCost)}</div></div>
            <div><div class="muted">Labor</div><div class="num" style="font-weight:700">${formatCurrency(c.laborCost)}</div></div>
            <div><div class="muted">Overhead</div><div class="num" style="font-weight:700">${formatCurrency(c.overheadCost)}</div></div>
          </div>
          <div class="row gap2" style="margin-bottom:var(--s2)">
            <input class="field" data-ovr-labor="${p.id}" placeholder="Labor override/unit" value="${override?.laborCostPerUnit ?? ''}" style="flex:1">
            <input class="field" data-ovr-overhead="${p.id}" placeholder="Overhead override/unit" value="${override?.overheadCostPerUnit ?? ''}" style="flex:1">
          </div>
          <div class="row gap2">
            <button class="btn btn-sm" data-save-ovr="${p.id}">Save override</button>
            ${override ? `<button class="btn btn-ghost btn-sm" data-clear-ovr="${p.id}">Clear override</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    host.querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('click', () => {
      openId = openId === el.dataset.toggle ? null : el.dataset.toggle;
      paintList(costs);
    }));
    host.querySelectorAll('[data-save-ovr]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.saveOvr;
      const result = ENGINE.saveCostLabOverrides(id, {
        laborCostPerUnit: root.querySelector(`[data-ovr-labor="${id}"]`).value,
        overheadCostPerUnit: root.querySelector(`[data-ovr-overhead="${id}"]`).value,
      });
      if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
      M.toast('Override saved', '', 'success');
      openId = id;
      paint();
    }));
    host.querySelectorAll('[data-clear-ovr]').forEach(b => b.addEventListener('click', () => {
      ENGINE.clearCostLabOverrides(b.dataset.clearOvr);
      M.toast('Override cleared', '', 'success');
      openId = b.dataset.clearOvr;
      paint();
    }));
  }

  paint();
};
