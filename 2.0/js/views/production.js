/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · PRODUCTION   (real jobs, real state machine)
   Uses the classic app's own status machine (setProductLineStatus,
   transferLineToPos) via ENGINE — never a parallel one.
═══════════════════════════════════════════════════════════════ */
const PROD_SEQ = ['PLANNED', 'IN_PROGRESS', 'DONE', 'QC', 'PACKED'];
const nextProdStatus = (s) => { const i = PROD_SEQ.indexOf(s); return i >= 0 && i < PROD_SEQ.length - 1 ? PROD_SEQ[i + 1] : null; };

VIEWS.production = function (root) {
  const realProducts = g2(() => getProducts(), []);
  if (!realProducts.length) {
    emptyState(root, 'No products yet',
      `Add products in the classic app first — production jobs are built from your real product catalog and recipes.`, UI_ICON.box);
    return;
  }

  let draft = []; // [{productId, name, qty}]

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Production · real jobs</span><h2 style="margin-top:4px">Production</h2>
      <p class="muted" style="margin-top:6px">Create a job, move it through the same stages the kitchen actually works in — ingredients and finished-goods stock update for real at every step.</p></div></div>

    <div class="card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s6)">
      <span class="eyebrow">New job</span>
      <div class="row gap3 wrap" style="margin:var(--s3) 0">
        <select id="pjProduct" class="field" style="max-width:260px;flex:1">
          ${realProducts.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
        <input type="number" id="pjQty" class="field" min="1" value="12" style="width:100px">
        <button class="btn btn-ghost btn-sm" id="pjAddLine">Add line</button>
      </div>
      <div id="pjDraftLines" class="stack gap2" style="margin-bottom:var(--s3)"></div>
      <button class="btn" id="pjCreate" disabled>Create job</button>
    </div>

    <div class="stack gap5" id="jobsList"></div>`;

  function renderDraft() {
    const host = root.querySelector('#pjDraftLines');
    host.innerHTML = draft.length ? draft.map((l, i) => `
      <div class="lrow" style="padding:8px 0">
        <span class="pico">${prodIconFor(l.name)}</span>
        <div class="grow name" style="font-size:var(--t-sm)">${escapeHtml(l.name)}</div>
        <span class="num" style="font-weight:700">${round2(l.qty)}</span>
        <button class="icon-btn" style="width:28px;height:28px" data-rm="${i}">×</button>
      </div>`).join('') : '';
    host.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      draft.splice(+b.dataset.rm, 1); renderDraft();
    }));
    root.querySelector('#pjCreate').disabled = !draft.length;
  }

  root.querySelector('#pjAddLine').addEventListener('click', () => {
    const sel = root.querySelector('#pjProduct'), qty = Number(root.querySelector('#pjQty').value || 0);
    if (!qty || qty <= 0) return;
    const p = realProducts.find(x => String(x.id) === sel.value);
    draft.push({ productId: p.id, name: p.name, qty });
    renderDraft();
  });

  root.querySelector('#pjCreate').addEventListener('click', () => {
    const result = ENGINE.createJob({ products: draft.map(l => ({ productId: l.productId, targetQty: l.qty })) });
    if (!result.ok) { M.toast('Could not create job', result.error || '', 'crit'); return; }
    M.toast('Job created', result.job.name, 'success');
    draft = []; renderDraft();
    renderJobs();
  });

  function renderJobs() {
    const jobs = g2(() => getProductionJobs(), []).slice().reverse();
    const host = root.querySelector('#jobsList');
    if (!jobs.length) {
      host.innerHTML = `<div class="card pad" style="border-radius:var(--r-xl);text-align:center;color:var(--ink-4);padding:var(--s7) 0">No production jobs yet — create one above.</div>`;
      return;
    }
    host.innerHTML = jobs.map(job => {
      const color = PRODUCTION_STATUS_COLORS[job.status] || 'var(--ink-3)';
      return `<div class="card pad" style="border-radius:var(--r-xl)">
        <div class="row between" style="margin-bottom:var(--s3)">
          <div><span class="eyebrow">${escapeHtml(job.scheduledDate || '')} · ${escapeHtml(FUNDING_TYPES[job.fundingType]?.label || job.fundingType || '')}</span>
            <h3 style="margin-top:4px">${escapeHtml(job.name)}</h3></div>
          <span class="chip" style="background:color-mix(in srgb,${color} 14%,transparent);color:${color};border-color:color-mix(in srgb,${color} 40%,var(--line))"><span class="dot"></span>${PRODUCTION_STATUS_LABELS[job.status] || job.status}</span>
        </div>
        <div class="stack">${(job.products || []).map(line => renderLine(job, line)).join('')}</div>
      </div>`;
    }).join('');

    host.querySelectorAll('[data-advance]').forEach(b => b.addEventListener('click', () => {
      ENGINE.advance(b.dataset.job, b.dataset.line, b.dataset.next);
      M.toast('Status updated', `${b.dataset.name} → ${PRODUCTION_STATUS_LABELS[b.dataset.next]}`, 'success');
      renderJobs();
    }));
    host.querySelectorAll('[data-transfer]').forEach(b => b.addEventListener('click', () => {
      ENGINE.transfer(b.dataset.job, b.dataset.line);
      M.toast('Transferred to POS', b.dataset.name, 'success');
      renderJobs();
    }));
  }

  function renderLine(job, line) {
    const product = realProducts.find(p => String(p.id) === String(line.productId));
    const color = PRODUCTION_STATUS_COLORS[line.status] || 'var(--ink-3)';
    const next = nextProdStatus(line.status);
    const canTransfer = line.readyForTransfer && !line.transferredToPos;
    // The classic app's `ingredientsDeducted` flag gets set true for FG-mode
    // lines too (it just means "the create/DONE deduction step ran", not that
    // ingredients were actually consumed — FG lines credit finished-goods stock
    // instead). Only claim "ingredients deducted" where that's actually true.
    const isFG = typeof isFinishedGoodsProduct === 'function' && isFinishedGoodsProduct(product);
    const deductedLabel = line.ingredientsDeducted && !isFG ? ' · ingredients deducted' : '';
    return `<div class="lrow" style="padding:10px 0">
      <span class="pico lg">${prodIconFor(line.productName, product?.category)}</span>
      <div class="grow"><div class="name">${escapeHtml(line.productName)}</div>
        <div class="sub">${round2(line.targetQty)} units${line.actualYield != null ? ` · actual ${round2(line.actualYield)}` : ''}${deductedLabel}</div></div>
      <span class="chip" style="height:22px;background:color-mix(in srgb,${color} 14%,transparent);color:${color};border-color:color-mix(in srgb,${color} 40%,var(--line));margin-right:var(--s2)">
        <span class="dot"></span>${PRODUCTION_STATUS_LABELS[line.status] || line.status}</span>
      ${canTransfer ? `<button class="btn btn-sm" data-transfer data-job="${job.id}" data-line="${line.id}" data-name="${escapeHtml(line.productName)}">Transfer to POS</button>` : ''}
      ${next ? `<button class="btn btn-sm ${canTransfer ? 'btn-ghost' : ''}" data-advance data-job="${job.id}" data-line="${line.id}" data-next="${next}" data-name="${escapeHtml(line.productName)}">Mark ${PRODUCTION_STATUS_LABELS[next]}</button>` : ''}
    </div>`;
  }

  renderDraft();
  renderJobs();
};
