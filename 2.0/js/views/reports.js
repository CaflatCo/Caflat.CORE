/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · REPORTS   (deeper analytics on real sales)
═══════════════════════════════════════════════════════════════ */
VIEWS.reports = function (root) {
  let range = 30;
  let r = ADAPT.reports(range);

  if (!r.coverage.hasData) {
    emptyState(root, 'No sales yet',
      `Reports breaks down your real transaction history — revenue trends, category mix, top products, and payment methods. Ring your first sale in the classic app and it'll show up here.`,
      UI_ICON.receipt);
    return;
  }

  const RANGES = [{ v: 7, l: '7D' }, { v: 30, l: '30D' }, { v: 90, l: '90D' }, { v: 'all', l: 'All' }];

  function paint() {
    root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Reports · real sales history</span><h2 style="margin-top:4px">Reports</h2>
      <p class="muted" style="margin-top:6px">Revenue trends, category mix, top products, and how customers pay — computed from your real transactions.</p></div>
      <div class="row gap2">${RANGES.map(x => `<button class="btn btn-sm ${String(range) === String(x.v) ? '' : 'btn-ghost'}" data-range="${x.v}">${x.l}</button>`).join('')}</div>
    </div>

    <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:var(--s4);margin-bottom:var(--s6)">
      <div class="card pad" style="border-radius:var(--r-xl)"><span class="eyebrow">Revenue</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" style="font-size:1.7rem">${r.money(r.revenue)}</div></div></div>
      <div class="card pad" style="border-radius:var(--r-xl)"><span class="eyebrow">Orders</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" style="font-size:1.7rem">${r.orders}</div></div></div>
      <div class="card pad" style="border-radius:var(--r-xl)"><span class="eyebrow">Avg ticket</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" style="font-size:1.7rem">${r.money(r.avgTicket)}</div></div></div>
      <div class="card pad" style="border-radius:var(--r-xl)"><span class="eyebrow">Void / refund rate</span>
        <div class="metric" style="margin-top:var(--s3)"><div class="val num" style="font-size:1.7rem">${r.voidRefundRate.toFixed(1)}%</div></div>
        <p class="muted" style="font-size:var(--t-xs);margin-top:4px">${r.voidCount} void${r.voidCount === 1 ? '' : 's'} · ${r.refundCount} refund${r.refundCount === 1 ? '' : 's'}</p></div>
    </div>

    <div class="grid" style="grid-template-columns:1.55fr 1fr;align-items:start;margin-bottom:var(--s6)">
      <div class="card pad" style="border-radius:var(--r-xl)">
        <div class="sec-head" style="margin-bottom:var(--s4)"><div><span class="eyebrow">Revenue</span><h3 style="margin-top:4px">Over time</h3></div></div>
        <div id="repRevChart"></div>
      </div>
      <div class="card pad" style="border-radius:var(--r-xl)">
        <span class="eyebrow">Category mix</span>
        ${r.mix.length ? `<div style="margin:var(--s4) 0 var(--s3)"><div id="repMixBar"></div></div>
        <div class="stack">
          ${r.mix.map((m, i) => `
            <div class="lrow" style="padding:8px 0">
              <span style="width:9px;height:9px;border-radius:3px;background:${['var(--ink)','var(--ink-2)','var(--ink-3)','var(--ink-4)'][i] || 'var(--line)'}"></span>
              <span class="grow name">${escapeHtml(m.cat)}</span>
              <span class="num muted" style="font-size:var(--t-sm)">${(m.pct * 100).toFixed(0)}%</span>
              <span class="num" style="font-weight:800;min-width:64px;text-align:right">${r.money(m.value)}</span>
            </div>`).join('')}
        </div>` : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s4) 0">No category data yet.</p>`}
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr;align-items:start;margin-bottom:var(--s6)">
      <div class="card pad" style="border-radius:var(--r-xl)">
        <span class="eyebrow">Top products</span>
        <div class="stack" style="margin-top:var(--s3)">
          ${r.topProducts.length ? r.topProducts.map((p, i) => `
            <div class="lrow" style="padding:8px 0">
              <span class="muted num" style="width:20px">${i + 1}</span>
              <div class="grow"><div class="name">${escapeHtml(p.name)}</div><div class="sub">${round2(p.qty)} sold</div></div>
              <span class="num" style="font-weight:800">${r.money(p.revenue)}</span>
            </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">No product sales yet.</p>`}
        </div>
      </div>
      <div class="card pad" style="border-radius:var(--r-xl)">
        <span class="eyebrow">Payment methods</span>
        <div class="stack" style="margin-top:var(--s3)">
          ${r.paymentMix.length ? r.paymentMix.map(p => `
            <div class="lrow" style="padding:8px 0">
              <div class="grow name">${escapeHtml(p.method)}</div>
              <span class="num" style="font-weight:800">${r.money(p.value)}</span>
            </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">No payment data yet.</p>`}
        </div>
      </div>
    </div>

    <div class="card pad" style="border-radius:var(--r-xl)">
      <span class="eyebrow">Channels</span>
      <div class="stack" style="margin-top:var(--s3)">
        ${r.channelMix.length ? r.channelMix.map(c => `
          <div class="lrow" style="padding:8px 0">
            <span class="chip"><span class="dot"></span>${escapeHtml(c.channel)}</span>
            <span class="grow muted" style="font-size:var(--t-sm)">${c.orders} order${c.orders === 1 ? '' : 's'}</span>
            <span class="num" style="font-weight:800">${r.money(c.revenue)}</span>
          </div>`).join('') : `<p class="muted" style="font-size:var(--t-sm);padding:var(--s3) 0">No channel data yet.</p>`}
      </div>
    </div>`;

    root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => {
      range = b.dataset.range === 'all' ? 'all' : Number(b.dataset.range);
      r = ADAPT.reports(range);
      paint();
    }));

    CHART.area(root.querySelector('#repRevChart'), r.series.map(s => ({ label: s.label, value: s.revenue })),
      { h: 260, stroke: 'var(--ink)', labels: true, labelEvery: Math.max(1, Math.ceil(r.series.length / 10)) });
    if (r.mix.length) CHART.proportion(root.querySelector('#repMixBar'), r.mix);
  }

  paint();
};
