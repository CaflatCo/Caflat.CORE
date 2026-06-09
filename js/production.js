/* ═══════════════════════════════════════════════════════
   PRODUCTION.JS — Production Mode
   Manages everything that happens before a sale.
   Feature-toggled via settings.productionModeEnabled.

   Sections:
   1. Labor Roster (People management)
   2. Production Board (Jobs)
   3. Ingredient Forecasting
   4. Batch Tracking
   5. Payment / Funding Tracking
   6. Production Analytics
═══════════════════════════════════════════════════════ */

/* ── Constants ── */
const PRODUCTION_STATUSES = ['PLANNED','IN_PROGRESS','DONE','QC','PACKED','CANCELLED'];
const PRODUCTION_STATUS_LABELS = {
  PLANNED:     'Planned',
  IN_PROGRESS: 'In Progress',
  DONE:        'Done',
  QC:          'Quality Check',
  PACKED:      'Packed',
  CANCELLED:   'Cancelled'
};
const PRODUCTION_STATUS_COLORS = {
  PLANNED:     '#6b7280',
  IN_PROGRESS: '#2563eb',
  DONE:        '#16a34a',
  QC:          '#ea580c',
  PACKED:      '#000000',
  CANCELLED:   '#dc2626'
};

const FUNDING_TYPES = {
  RETAIL:  { label: 'Retail / Restock',  desc: 'Regular production for shelf stock' },
  CLIENT:  { label: 'Client Order',       desc: 'Someone ordered and paid (or partially paid)' },
  PENDING: { label: 'Pending Funding',    desc: 'Planned but no payment yet' }
};

const WASTE_TYPES = ['Burnt','Damaged','Wrong Texture','Expired Ingredient','Packaging Defect','Other'];

/* ════════════════════════════════════════════════════════
   SECTION 1 — LABOR ROSTER
════════════════════════════════════════════════════════ */

function getLaborPeople() {
  const people = Array.isArray(APP_STATE.laborPeople) ? APP_STATE.laborPeople : [];
  // Seed Owner on first use
  if (!people.length) {
    const owner = _createOwnerPerson();
    updateState('laborPeople', () => [owner]);
    return [owner];
  }
  return people;
}

function _createOwnerPerson() {
  return {
    id:        'owner-default',
    name:      APP_STATE.settings?.brandName || 'Owner',
    role:      'Owner',
    rate:      0,
    type:      'owner',   // owner | hired
    createdAt: new Date().toISOString()
  };
}

function saveLaborPerson(personData) {
  const people   = getLaborPeople();
  const existing = people.find(p => p.id === personData.id);
  if (existing) {
    Object.assign(existing, personData, { updatedAt: new Date().toISOString() });
  } else {
    people.push({ ...personData, createdAt: new Date().toISOString() });
  }
  updateState('laborPeople', () => people);
  renderLaborRoster();
  showNotification('Person saved', 'success');
}

function deleteLaborPerson(personId) {
  if (personId === 'owner-default') {
    showNotification('Cannot delete the Owner person', 'error');
    return;
  }
  if (!confirm('Delete this person from the roster?')) return;
  updateState('laborPeople', () =>
    getLaborPeople().filter(p => p.id !== personId));
  renderLaborRoster();
  showNotification('Person removed', 'success');
}

function openLaborPersonModal(personId = null) {
  setElementValue('laborPersonId',   '');
  setElementValue('laborPersonName', '');
  setElementValue('laborPersonRole', '');
  setElementValue('laborPersonRate', '');
  setElementValue('laborPersonType', 'hired');

  if (personId) {
    const person = getLaborPeople().find(p => p.id === personId);
    if (person) {
      setElementValue('laborPersonId',   person.id);
      setElementValue('laborPersonName', person.name);
      setElementValue('laborPersonRole', person.role || '');
      setElementValue('laborPersonRate', person.rate || 0);
      setElementValue('laborPersonType', person.type || 'hired');
    }
  }
  openModal('laborPersonModal');
}

function saveLaborPersonFromForm() {
  const id   = getElementValue('laborPersonId') || generateId();
  const name = sanitizeText(getElementValue('laborPersonName'));
  const role = sanitizeText(getElementValue('laborPersonRole'));
  const rate = Number(getElementValue('laborPersonRate') || 0);
  const type = getElementValue('laborPersonType') || 'hired';

  if (!name) { showNotification('Name is required', 'error'); return; }

  saveLaborPerson({ id, name, role, rate, type });
  closeModal('laborPersonModal');
}

function renderLaborRoster() {
  const container = document.getElementById('laborRosterContainer');
  if (!container) return;

  const people = getLaborPeople();

  container.innerHTML = people.map(p => {
    const isOwner   = p.id === 'owner-default';
    const typeColor = p.type === 'owner' ? '#6b7280' : '#16a34a';
    const typeLabel = p.type === 'owner' ? 'Owner' : 'Hired';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 16px;border:1.5px solid var(--gray-200);
        border-radius:var(--radius-lg);margin-bottom:8px;background:var(--white);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:50%;
            background:var(--black);display:flex;align-items:center;
            justify-content:center;color:white;font-size:13px;font-weight:800;">
            ${escapeHtml(p.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <div style="font-weight:800;font-size:13px;">${escapeHtml(p.name)}
              ${isOwner ? '<span style="font-size:9px;color:var(--gray-400);margin-left:4px;">DEFAULT</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--gray-400);">
              ${p.role ? escapeHtml(p.role) + ' · ' : ''}
              <span style="color:${typeColor};font-weight:700;">${typeLabel}</span>
              ${p.type === 'hired' ? ` · ${formatCurrency(p.rate)}/hr` : ' · No cost'}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary"
            data-action="edit-labor-person" data-id="${p.id}">Edit</button>
          ${!isOwner ? `<button class="btn btn-sm btn-secondary"
            data-action="delete-labor-person" data-id="${p.id}">Delete</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════
   SECTION 2 — PRODUCTION JOBS
════════════════════════════════════════════════════════ */

function getProductionJobs() {
  return Array.isArray(APP_STATE.productionJobs) ? APP_STATE.productionJobs : [];
}

function getProductionJobById(id) {
  return getProductionJobs().find(j => String(j.id) === String(id));
}

function openProductionJobModal(jobId = null) {
  _clearProductionJobForm();
  _populateProductionJobDropdowns();

  if (jobId) {
    const job = getProductionJobById(jobId);
    if (job) _hydrateProductionJobForm(job);
  } else {
    setElementValue('prodJobFundingType', 'RETAIL');
    setElementValue('prodJobScheduledDate',
      new Date().toISOString().slice(0, 10));
    _toggleFundingFields('RETAIL');
  }
  openModal('productionJobModal');
}

function _clearProductionJobForm() {
  ['prodJobId','prodJobName','prodJobProductId','prodJobTargetQty',
   'prodJobBatchSize','prodJobScheduledDate','prodJobFundingType',
   'prodJobClientName','prodJobTotalValue','prodJobNotes',
   'prodJobEventId','prodJobDownPayment','prodJobFullPayment']
    .forEach(id => setElementValue(id, ''));
  // Clear labor assignments
  const laborList = document.getElementById('prodJobLaborList');
  if (laborList) laborList.innerHTML = '';
  window._prodJobLaborAssignments = [];
}

function _populateProductionJobDropdowns() {
  // Products dropdown
  const prodSel = document.getElementById('prodJobProductId');
  if (prodSel) {
    prodSel.innerHTML = `<option value="">Select product…</option>` +
      (APP_STATE.products || []).map(p =>
        `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }

  // Labor select
  const laborSel = document.getElementById('prodJobLaborSelect');
  if (laborSel) {
    laborSel.innerHTML = `<option value="">+ Assign person…</option>` +
      getLaborPeople().map(p =>
        `<option value="${p.id}">${escapeHtml(p.name)}
          ${p.type==='owner' ? '(Owner)' : '· ₱'+Number(p.rate||0).toFixed(0)+'/hr'}
        </option>`).join('');
    laborSel.onchange = e => {
      if (e.target.value) addLaborToJob(e.target.value);
    };
  }

  // Event dropdown (Coffee Cart events if mode is on)
  const eventSel = document.getElementById('prodJobEventId');
  const eventRow = document.getElementById('prodJobEventRow');
  if (eventSel && eventRow) {
    const events = APP_STATE.events || [];
    const ccEnabled = APP_STATE.settings?.coffeeCartModeEnabled;
    eventRow.style.display = ccEnabled && events.length ? 'block' : 'none';
    eventSel.innerHTML = `<option value="">No event link</option>` +
      events.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  }
}

function _hydrateProductionJobForm(job) {
  setElementValue('prodJobId',            job.id);
  setElementValue('prodJobName',          job.name || '');
  setElementValue('prodJobProductId',     job.productId || '');
  setElementValue('prodJobTargetQty',     job.targetQty || '');
  setElementValue('prodJobBatchSize',     job.batchSize || '');
  setElementValue('prodJobScheduledDate', job.scheduledDate || '');
  setElementValue('prodJobFundingType',   job.fundingType || 'RETAIL');
  setElementValue('prodJobClientName',    job.clientName || '');
  setElementValue('prodJobTotalValue',    job.totalValue || '');
  setElementValue('prodJobNotes',         job.notes || '');
  setElementValue('prodJobEventId',       job.eventId || '');
  setElementValue('prodJobDownPayment',   job.downPayment || '');
  setElementValue('prodJobFullPayment',   job.fullPayment || '');
  _toggleFundingFields(job.fundingType || 'RETAIL');

  // Hydrate labor assignments
  window._prodJobLaborAssignments = Array.isArray(job.laborAssignments)
    ? [...job.laborAssignments] : [];
  _renderProdJobLaborList();
}

function _toggleFundingFields(fundingType) {
  const clientFields = document.getElementById('prodJobClientFields');
  const paymentFields = document.getElementById('prodJobPaymentFields');
  if (clientFields)  clientFields.style.display  =
    ['CLIENT','PENDING'].includes(fundingType) ? 'block' : 'none';
  if (paymentFields) paymentFields.style.display  =
    fundingType === 'CLIENT' ? 'block' : 'none';
}

function saveProductionJob() {
  const id            = getElementValue('prodJobId') || generateId();
  const name          = sanitizeText(getElementValue('prodJobName'));
  const productId     = getElementValue('prodJobProductId');
  const targetQty     = Number(getElementValue('prodJobTargetQty') || 0);
  const batchSize     = Number(getElementValue('prodJobBatchSize') || 1);
  const scheduledDate = getElementValue('prodJobScheduledDate');
  const fundingType   = getElementValue('prodJobFundingType') || 'RETAIL';
  const clientName    = sanitizeText(getElementValue('prodJobClientName'));
  const totalValue    = Number(getElementValue('prodJobTotalValue') || 0);
  const notes         = sanitizeText(getElementValue('prodJobNotes'));
  const eventId       = getElementValue('prodJobEventId') || null;
  const downPayment   = Number(getElementValue('prodJobDownPayment') || 0);
  const fullPayment   = Number(getElementValue('prodJobFullPayment') || 0);

  if (!productId) { showNotification('Select a product', 'error'); return; }
  if (!targetQty) { showNotification('Target quantity required', 'error'); return; }

  const product = (APP_STATE.products || []).find(p => p.id === productId);
  const batches = batchSize > 0 ? Math.ceil(targetQty / batchSize) : 1;

  // Determine payment status
  let paymentStatus = 'UNPAID';
  if (fullPayment >= totalValue && totalValue > 0) paymentStatus = 'PAID';
  else if (downPayment > 0 || fullPayment > 0)     paymentStatus = 'PARTIAL';

  // Balance
  const balance = Math.max(0, totalValue - downPayment - fullPayment);

  const jobs     = getProductionJobs();
  const existing = jobs.find(j => j.id === id);
  const now      = new Date().toISOString();

  const jobData = {
    id, name: name || (product?.name || 'Production Job'),
    productId, productName: product?.name || '',
    targetQty, batchSize, batches, scheduledDate,
    fundingType, clientName, totalValue, balance,
    downPayment, fullPayment, paymentStatus,
    notes, eventId,
    laborAssignments: window._prodJobLaborAssignments || [],
    status: existing?.status || 'PLANNED',
    statusHistory: existing?.statusHistory || [{ status:'PLANNED', changedAt: now }],
    ingredientsDeducted: existing?.ingredientsDeducted || false,
    actualYield: existing?.actualYield || null,
    wasteLog: existing?.wasteLog || [],
    updatedAt: now,
    createdAt: existing?.createdAt || now
  };

  if (existing) {
    Object.assign(existing, jobData);
  } else {
    jobs.push(jobData);
  }

  updateState('productionJobs', () => jobs);
  closeModal('productionJobModal');
  renderProductionBoard();
  showNotification('Production job saved', 'success');
}

function deleteProductionJob(jobId) {
  if (!confirm('Delete this production job?')) return;
  updateState('productionJobs', () =>
    getProductionJobs().filter(j => j.id !== jobId));
  renderProductionBoard();
  showNotification('Job deleted', 'success');
}

/* ── Status management ── */
function openProductionStatusModal(jobId) {
  const job = getProductionJobById(jobId);
  if (!job) return;

  const container = document.getElementById('prodStatusOptions');
  const infoEl    = document.getElementById('prodStatusJobInfo');

  if (infoEl) infoEl.textContent =
    `${job.name} · ${job.productName} · ${job.targetQty} units`;

  if (container) {
    container.innerHTML = PRODUCTION_STATUSES.map(s => {
      const color = PRODUCTION_STATUS_COLORS[s];
      const isActive = job.status === s;
      return `
        <button type="button"
          data-action="set-production-status"
          data-job-id="${jobId}" data-status="${s}"
          style="padding:10px 14px;border:1.5px solid ${isActive ? color : 'var(--gray-200)'};
            border-radius:var(--radius-lg);background:${isActive ? color : 'var(--white)'};
            color:${isActive ? 'white' : 'var(--gray-700)'};font-size:11px;font-weight:800;
            cursor:pointer;font-family:var(--font-main);text-align:left;">
          ${PRODUCTION_STATUS_LABELS[s]}
          ${isActive ? ' ✓' : ''}
        </button>`;
    }).join('');
  }

  setElementValue('prodStatusJobId', jobId);
  openModal('productionStatusModal');
}

function setProductionStatus(jobId, newStatus) {
  const jobs = getProductionJobs();
  const job  = jobs.find(j => j.id === jobId);
  if (!job || job.status === newStatus) return;

  const now = new Date().toISOString();
  job.status = newStatus;
  job.updatedAt = now;
  job.statusHistory = Array.isArray(job.statusHistory) ? job.statusHistory : [];
  job.statusHistory.push({ status: newStatus, changedAt: now });

  // Deduct ingredients at DONE using actual yield if available
  if (newStatus === 'DONE' && !job.ingredientsDeducted) {
    _deductProductionIngredients(job);
    job.ingredientsDeducted = true;
  }

  // Restore ingredients if cancelled after deduction
  if (newStatus === 'CANCELLED' && job.ingredientsDeducted) {
    if (confirm('Restore ingredients to stock?')) {
      _restoreProductionIngredients(job);
      job.ingredientsDeducted = false;
    }
  }

  updateState('productionJobs', () => jobs);
  closeModal('productionStatusModal');
  renderProductionBoard();
  showNotification(
    `Job status set to ${PRODUCTION_STATUS_LABELS[newStatus]}`, 'success');
}

/* ── Ingredient deduction ── */
function _deductProductionIngredients(job) {
  const product = (APP_STATE.products||[]).find(p => p.id === job.productId);
  if (!product || !Array.isArray(product.recipe)) return;

  const unitsProduced = job.actualYield ?? job.targetQty;
  const batchYield    = Math.max(1, Number(product.batchYield || 1));
  const recipeMode    = String(product.recipeMode || 'unit');

  const ings = [...(APP_STATE.ingredients||[])];
  product.recipe.forEach(ri => {
    const idx = ings.findIndex(i => String(i.id) === String(ri.ingredientId));
    if (idx < 0) return;
    const perUnit = recipeMode === 'batch'
      ? Number(ri.quantity||0) / batchYield
      : Number(ri.quantity||0);
    const totalUsed = perUnit * unitsProduced;
    ings[idx] = { ...ings[idx],
      stock: Math.max(0, Number(ings[idx].stock||0) - totalUsed) };

    if (typeof logInventoryAdjustment === 'function') {
      logInventoryAdjustment(ings[idx].id,
        Number(ings[idx].stock||0) + totalUsed,
        ings[idx].stock,
        `Production: ${job.name || job.productName}`);
    }
  });
  updateState('ingredients', () => ings);
  if (typeof renderInventoryTable === 'function') renderInventoryTable();
  if (typeof renderLowStockAlerts === 'function') renderLowStockAlerts();
}

function _restoreProductionIngredients(job) {
  const product = (APP_STATE.products||[]).find(p => p.id === job.productId);
  if (!product || !Array.isArray(product.recipe)) return;

  const unitsProduced = job.actualYield ?? job.targetQty;
  const batchYield    = Math.max(1, Number(product.batchYield||1));
  const recipeMode    = String(product.recipeMode||'unit');

  const ings = [...(APP_STATE.ingredients||[])];
  product.recipe.forEach(ri => {
    const idx = ings.findIndex(i => String(i.id) === String(ri.ingredientId));
    if (idx < 0) return;
    const perUnit   = recipeMode === 'batch'
      ? Number(ri.quantity||0) / batchYield
      : Number(ri.quantity||0);
    const totalUsed = perUnit * unitsProduced;
    ings[idx] = { ...ings[idx],
      stock: Number(ings[idx].stock||0) + totalUsed };
  });
  updateState('ingredients', () => ings);
}

/* ════════════════════════════════════════════════════════
   SECTION 3 — INGREDIENT FORECASTING
════════════════════════════════════════════════════════ */

function getIngredientForecast(jobs) {
  const targetJobs = (jobs || getProductionJobs())
    .filter(j => !['DONE','PACKED','CANCELLED'].includes(j.status));

  const needed = {};   // ingredientId → { name, unit, total, onHand }

  targetJobs.forEach(job => {
    const product = (APP_STATE.products||[]).find(p => p.id === job.productId);
    if (!product || !Array.isArray(product.recipe)) return;

    const qty       = job.targetQty || 0;
    const batchYield= Math.max(1, Number(product.batchYield||1));
    const mode      = String(product.recipeMode||'unit');

    product.recipe.forEach(ri => {
      const ing = (APP_STATE.ingredients||[]).find(i => i.id === ri.ingredientId);
      if (!ing) return;
      const perUnit  = mode === 'batch'
        ? Number(ri.quantity||0) / batchYield
        : Number(ri.quantity||0);
      const total = perUnit * qty;

      if (!needed[ing.id]) {
        needed[ing.id] = {
          id: ing.id, name: ing.name, unit: ing.unit||'',
          total: 0, onHand: Number(ing.stock||0)
        };
      }
      needed[ing.id].total += total;
    });
  });

  return Object.values(needed).map(item => ({
    ...item,
    shortfall: Math.max(0, item.total - item.onHand),
    sufficient: item.onHand >= item.total
  })).sort((a,b) => (a.sufficient?1:-1) - (b.sufficient?0:-1));
}

function renderIngredientForecast() {
  const container = document.getElementById('prodForecastContainer');
  if (!container) return;

  const forecast = getIngredientForecast();
  if (!forecast.length) {
    container.innerHTML = `<div class="empty-state">
      No active production jobs to forecast</div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1.5fr;
      gap:8px;padding:8px 12px;background:var(--black);
      border-radius:var(--radius-md) var(--radius-md) 0 0;">
      ${['Ingredient','Needed','On Hand','Shortfall','Status'].map(h =>
        `<div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
          text-transform:uppercase;color:rgba(255,255,255,.7);">${h}</div>`
      ).join('')}
    </div>
    <div style="border:1.5px solid var(--gray-200);border-top:none;
      border-radius:0 0 var(--radius-md) var(--radius-md);">
      ${forecast.map(item => `
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1.5fr;
          gap:8px;padding:10px 12px;border-bottom:1px solid var(--gray-100);
          font-size:12px;">
          <div style="font-weight:700;">${escapeHtml(item.name)}</div>
          <div style="font-variant-numeric:tabular-nums;">
            ${item.total.toFixed(2)} ${item.unit}</div>
          <div style="font-variant-numeric:tabular-nums;">
            ${item.onHand.toFixed(2)} ${item.unit}</div>
          <div style="font-variant-numeric:tabular-nums;
            color:${item.shortfall>0?'#dc2626':'var(--gray-400)'};">
            ${item.shortfall > 0 ? item.shortfall.toFixed(2) + ' ' + item.unit : '—'}
          </div>
          <div>
            ${item.sufficient
              ? '<span style="color:#16a34a;font-weight:700;">✓ Sufficient</span>'
              : `<span style="color:#dc2626;font-weight:700;">⚠ Short</span>`}
          </div>
        </div>`).join('')}
    </div>`;
}

/* ════════════════════════════════════════════════════════
   SECTION 4 — BATCH TRACKING
════════════════════════════════════════════════════════ */

function openBatchTrackingModal(jobId) {
  const job = getProductionJobById(jobId);
  if (!job) return;

  setElementValue('batchJobId',       jobId);
  setElementValue('batchActualYield', job.actualYield || job.targetQty || '');
  setElementValue('batchNotes',       '');

  // Render waste log
  _renderWasteLog(job);

  const infoEl = document.getElementById('batchJobInfo');
  if (infoEl) infoEl.textContent =
    `${job.name} · Target: ${job.targetQty} units`;

  openModal('batchTrackingModal');
}

function _renderWasteLog(job) {
  const container = document.getElementById('batchWasteLog');
  if (!container) return;

  const wasteLog = job.wasteLog || [];
  const total    = wasteLog.reduce((s, w) => s + Number(w.qty||0), 0);

  container.innerHTML = `
    <div style="margin-bottom:10px;">
      ${wasteLog.map((w, i) => `
        <div style="display:flex;align-items:center;gap:8px;
          padding:6px 10px;background:var(--gray-50);border-radius:var(--radius-md);
          margin-bottom:6px;font-size:12px;">
          <span style="font-weight:700;">${escapeHtml(w.type)}</span>
          <span style="color:var(--gray-500);">${w.qty} units</span>
          ${w.note ? `<span style="color:var(--gray-400);font-size:11px;">— ${escapeHtml(w.note)}</span>` : ''}
          <button type="button" style="margin-left:auto;background:none;border:none;
            cursor:pointer;color:var(--gray-400);font-size:12px;"
            onclick="_removeWasteEntry(${i});">✕</button>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px;">
      <select id="wasteType"
        style="flex:1;padding:6px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);">
        ${WASTE_TYPES.map(t =>
          `<option value="${t}">${t}</option>`).join('')}
      </select>
      <input type="number" id="wasteQty" placeholder="Qty" min="0"
        style="width:80px;padding:6px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      <input type="text" id="wasteNote" placeholder="Note (optional)"
        style="flex:1;padding:6px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      <button class="btn btn-secondary" type="button"
        onclick="_addWasteEntry();">+ Add</button>
    </div>
    ${total > 0 ? `<div style="font-size:11px;color:#dc2626;font-weight:700;">
      Total waste: ${total} units</div>` : ''}`;
}

window._addWasteEntry = function() {
  const jobId = getElementValue('batchJobId');
  const job   = getProductionJobById(jobId);
  if (!job) return;

  const type = getElementValue('wasteType') || 'Other';
  const qty  = Number(document.getElementById('wasteQty')?.value || 0);
  const note = sanitizeText(document.getElementById('wasteNote')?.value || '');
  if (!qty)  { showNotification('Enter waste quantity', 'error'); return; }

  job.wasteLog = Array.isArray(job.wasteLog) ? job.wasteLog : [];
  job.wasteLog.push({ type, qty, note, loggedAt: new Date().toISOString() });

  const jobs = getProductionJobs();
  const idx  = jobs.findIndex(j => j.id === jobId);
  if (idx >= 0) jobs[idx] = job;
  updateState('productionJobs', () => jobs);

  setElementValue('wasteQty',  '');
  setElementValue('wasteNote', '');
  _renderWasteLog(job);
};

window._removeWasteEntry = function(wasteIdx) {
  const jobId = getElementValue('batchJobId');
  const jobs  = getProductionJobs();
  const job   = jobs.find(j => j.id === jobId);
  if (!job) return;
  job.wasteLog = (job.wasteLog||[]).filter((_,i) => i !== wasteIdx);
  updateState('productionJobs', () => jobs);
  _renderWasteLog(job);
};

function saveBatchTracking() {
  const jobId       = getElementValue('batchJobId');
  const actualYield = Number(getElementValue('batchActualYield') || 0);
  const jobs        = getProductionJobs();
  const job         = jobs.find(j => j.id === jobId);
  if (!job) return;

  job.actualYield = actualYield;
  job.updatedAt   = new Date().toISOString();

  // Efficiency %
  job.efficiency = job.targetQty > 0
    ? Math.round((actualYield / job.targetQty) * 100) : 100;

  updateState('productionJobs', () => jobs);
  closeModal('batchTrackingModal');
  renderProductionBoard();
  showNotification('Batch tracking saved', 'success');
}

/* ════════════════════════════════════════════════════════
   SECTION 5 — LABOR ASSIGNMENTS (on jobs)
════════════════════════════════════════════════════════ */

window._prodJobLaborAssignments = [];

function _renderProdJobLaborList() {
  const container = document.getElementById('prodJobLaborList');
  if (!container) return;

  const assignments = window._prodJobLaborAssignments || [];
  const people      = getLaborPeople();

  if (!assignments.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--gray-400);
      padding:8px 0;">No labor assigned yet</div>`;
  } else {
    container.innerHTML = assignments.map((a, i) => {
      const person = people.find(p => p.id === a.personId);
      const cost   = person?.type === 'hired'
        ? Number(person.rate||0) * Number(a.hours||0) : 0;
      return `
        <div style="display:flex;align-items:center;gap:8px;
          padding:8px 10px;background:var(--gray-50);border-radius:var(--radius-md);
          margin-bottom:6px;font-size:12px;">
          <span style="font-weight:700;flex:1;">${escapeHtml(person?.name||'Unknown')}</span>
          <span style="color:var(--gray-500);">${person?.role||''}</span>
          <input type="number" value="${a.hours||0}" min="0" step="0.5" placeholder="hrs"
            style="width:70px;padding:4px 8px;border:1px solid var(--gray-200);
              border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
            oninput="_updateLaborHours(${i}, Number(this.value||0));" />
          <span style="font-size:11px;min-width:60px;text-align:right;
            color:${person?.type==='owner'?'var(--gray-400)':'var(--black)'};">
            ${person?.type==='owner' ? 'Owner' : formatCurrency(cost)}</span>
          <button type="button" style="background:none;border:none;cursor:pointer;
            color:var(--gray-400);"
            onclick="_removeLaborAssignment(${i});">✕</button>
        </div>`;
    }).join('');
  }

  // Total labor cost
  const totalCost = _calcJobLaborCost(assignments, people);
  const totalEl   = document.getElementById('prodJobLaborTotal');
  if (totalEl) totalEl.textContent = formatCurrency(totalCost);
}

window._updateLaborHours = function(idx, hours) {
  if (window._prodJobLaborAssignments[idx]) {
    window._prodJobLaborAssignments[idx].hours = hours;
    _renderProdJobLaborList();
  }
};

window._removeLaborAssignment = function(idx) {
  window._prodJobLaborAssignments.splice(idx, 1);
  _renderProdJobLaborList();
};

function addLaborToJob(personId) {
  if (!personId) return;
  const already = (window._prodJobLaborAssignments||[]).find(a => a.personId === personId);
  if (already) { showNotification('Person already assigned', 'info'); return; }
  window._prodJobLaborAssignments = window._prodJobLaborAssignments || [];
  window._prodJobLaborAssignments.push({ personId, hours: 0 });
  _renderProdJobLaborList();
  setElementValue('prodJobLaborSelect', '');
}

function _calcJobLaborCost(assignments, people) {
  return (assignments||[]).reduce((sum, a) => {
    const person = (people||getLaborPeople()).find(p => p.id === a.personId);
    if (!person || person.type === 'owner') return sum;
    return sum + Number(person.rate||0) * Number(a.hours||0);
  }, 0);
}

function getJobLaborCost(job) {
  return _calcJobLaborCost(job.laborAssignments, getLaborPeople());
}

/* ════════════════════════════════════════════════════════
   SECTION 6 — PRODUCTION BOARD RENDER
════════════════════════════════════════════════════════ */

function renderProductionBoard() {
  _renderProductionJobsTable();
  renderIngredientForecast();
  renderProductionAnalytics();
}

function _renderProductionJobsTable() {
  const tbody = document.querySelector('#productionJobsTable tbody');
  if (!tbody) return;

  const statusFilter = document.getElementById('prodStatusFilter')?.value || '';
  let jobs = getProductionJobs();
  if (statusFilter) jobs = jobs.filter(j => j.status === statusFilter);
  jobs = jobs.slice().sort((a,b) =>
    new Date(a.scheduledDate||0) - new Date(b.scheduledDate||0));

  tbody.innerHTML = '';
  if (!jobs.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">
      No production jobs yet</td></tr>`;
    return;
  }

  jobs.forEach(job => {
    const color      = PRODUCTION_STATUS_COLORS[job.status] || '#888';
    const label      = PRODUCTION_STATUS_LABELS[job.status] || job.status;
    const laborCost  = getJobLaborCost(job);
    const wasteTotal = (job.wasteLog||[]).reduce((s,w) => s + Number(w.qty||0), 0);
    const efficiency = job.efficiency != null ? job.efficiency + '%' : '—';
    const fundLabel  = FUNDING_TYPES[job.fundingType]?.label || job.fundingType || '—';
    const event      = job.eventId
      ? (APP_STATE.events||[]).find(e => e.id === job.eventId)
      : null;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="font-weight:800;">${escapeHtml(job.name)}</div>
        <div style="font-size:10px;color:var(--gray-400);">
          ${escapeHtml(job.productName)}
          ${event ? `· <span style="color:#2563eb;">${escapeHtml(event.name)}</span>` : ''}
        </div>
      </td>
      <td>${job.scheduledDate
        ? new Date(job.scheduledDate+'T00:00:00')
            .toLocaleDateString('en-PH',{month:'short',day:'numeric'})
        : '—'}</td>
      <td style="font-variant-numeric:tabular-nums;">
        ${job.targetQty}
        ${job.actualYield != null
          ? `<span style="color:var(--gray-400);"> → ${job.actualYield} actual</span>`
          : ''}
      </td>
      <td>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;
          border-radius:999px;background:${color}20;color:${color};
          border:1px solid ${color}40;">${label}</span>
      </td>
      <td style="font-size:11px;">
        ${job.fundingType === 'CLIENT'
          ? `<div>${formatCurrency(job.totalValue||0)}</div>
             <div style="color:${job.paymentStatus==='PAID'?'#16a34a':
               job.paymentStatus==='PARTIAL'?'#ea580c':'#dc2626'};">
               ${job.paymentStatus}</div>`
          : `<span style="color:var(--gray-400);">${fundLabel}</span>`}
      </td>
      <td>${efficiency}</td>
      <td>${wasteTotal > 0
        ? `<span style="color:#dc2626;">${wasteTotal} units</span>` : '—'}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm" data-action="open-prod-status"
            data-id="${job.id}">Status</button>
          <button class="btn btn-sm btn-secondary" data-action="open-batch-tracking"
            data-id="${job.id}">Batch</button>
          <button class="btn btn-sm btn-secondary" data-action="edit-prod-job"
            data-id="${job.id}">Edit</button>
          <button class="btn btn-sm btn-secondary" data-action="delete-prod-job"
            data-id="${job.id}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

/* ════════════════════════════════════════════════════════
   SECTION 7 — PRODUCTION ANALYTICS
════════════════════════════════════════════════════════ */

function renderProductionAnalytics() {
  const container = document.getElementById('prodAnalyticsContainer');
  if (!container) return;

  const jobs = getProductionJobs().filter(j =>
    ['DONE','PACKED'].includes(j.status));

  if (!jobs.length) {
    container.innerHTML = `<div class="empty-state">
      Complete production jobs to see analytics</div>`;
    return;
  }

  const totalJobs    = jobs.length;
  const avgEfficiency= jobs.filter(j => j.efficiency != null)
    .reduce((s,j,_,a) => s + j.efficiency / a.length, 0);
  const totalWaste   = jobs.reduce((s,j) =>
    s + (j.wasteLog||[]).reduce((ws,w) => ws + Number(w.qty||0), 0), 0);
  const totalLabor   = jobs.reduce((s,j) => s + getJobLaborCost(j), 0);
  const totalUnits   = jobs.reduce((s,j) => s + (j.actualYield ?? j.targetQty), 0);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
      margin-bottom:20px;">
      ${[
        ['Completed Jobs', totalJobs],
        ['Avg Efficiency', avgEfficiency ? avgEfficiency.toFixed(0) + '%' : '—'],
        ['Total Waste', totalWaste + ' units'],
        ['Total Labor Cost', formatCurrency(totalLabor)],
      ].map(([label, val]) => `
        <div class="stat-card">
          <div class="label">${label}</div>
          <div class="value" style="font-size:20px;">${val}</div>
        </div>`).join('')}
    </div>

    <div class="section-title">Completed Jobs</div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Job</th><th>Product</th><th>Target</th>
            <th>Actual</th><th>Efficiency</th><th>Waste</th><th>Labor Cost</th>
          </tr>
        </thead>
        <tbody>
          ${jobs.map(job => {
            const waste = (job.wasteLog||[]).reduce((s,w) => s+Number(w.qty||0),0);
            const labor = getJobLaborCost(job);
            return `
              <tr>
                <td style="font-weight:700;">${escapeHtml(job.name)}</td>
                <td>${escapeHtml(job.productName)}</td>
                <td>${job.targetQty}</td>
                <td>${job.actualYield ?? job.targetQty}</td>
                <td>${job.efficiency != null
                  ? `<span style="color:${job.efficiency>=90?'#16a34a':
                      job.efficiency>=70?'#ea580c':'#dc2626'};">
                      ${job.efficiency}%</span>` : '—'}</td>
                <td>${waste > 0
                  ? `<span style="color:#dc2626;">${waste}</span>` : '—'}</td>
                <td>${labor > 0 ? formatCurrency(labor) : '—'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Feature toggle ── */
function applyProductionModeToggle() {
  const enabled = APP_STATE.settings?.productionModeEnabled === true;
  const navBtn  = document.getElementById('navProduction');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';

  if (!enabled && APP_STATE.ui?.currentView === 'production') {
    if (typeof switchPage === 'function') switchPage('pos');
  }
}

function renderProductionView() {
  renderProductionBoard();
  renderLaborRoster();
}

/* ── Exports ── */
window.getLaborPeople             = getLaborPeople;
window.saveLaborPerson            = saveLaborPerson;
window.deleteLaborPerson          = deleteLaborPerson;
window.openLaborPersonModal       = openLaborPersonModal;
window.saveLaborPersonFromForm    = saveLaborPersonFromForm;
window.renderLaborRoster          = renderLaborRoster;
window.getProductionJobs          = getProductionJobs;
window.openProductionJobModal     = openProductionJobModal;
window.saveProductionJob          = saveProductionJob;
window.deleteProductionJob        = deleteProductionJob;
window.openProductionStatusModal  = openProductionStatusModal;
window.setProductionStatus        = setProductionStatus;
window.openBatchTrackingModal     = openBatchTrackingModal;
window.saveBatchTracking          = saveBatchTracking;
window.addLaborToJob              = addLaborToJob;
window.getJobLaborCost            = getJobLaborCost;
window.getIngredientForecast      = getIngredientForecast;
window.renderIngredientForecast   = renderIngredientForecast;
window.renderProductionAnalytics  = renderProductionAnalytics;
window.renderProductionBoard      = renderProductionBoard;
window.renderProductionView       = renderProductionView;
window.applyProductionModeToggle  = applyProductionModeToggle;
window._toggleFundingFields       = _toggleFundingFields;
