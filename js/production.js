/* ═══════════════════════════════════════════════════════
   PRODUCTION.JS — Production Mode v2
   Multi-product jobs, per-product status + batch tracking,
   progress %, ingredient forecast with cost-to-buy,
   labor roster, funding/payment tracking.
═══════════════════════════════════════════════════════ */

const PRODUCTION_STATUSES = ['PLANNED','IN_PROGRESS','DONE','QC','PACKED','CANCELLED'];
const PRODUCTION_STATUS_LABELS = {
  PLANNED:'Planned', IN_PROGRESS:'In Progress', DONE:'Done',
  QC:'Quality Check', PACKED:'Packed', CANCELLED:'Cancelled'
};
const PRODUCTION_STATUS_COLORS = {
  PLANNED:'#6b7280', IN_PROGRESS:'#2563eb', DONE:'#16a34a',
  QC:'#ea580c', PACKED:'#000000', CANCELLED:'#dc2626'
};
const FUNDING_TYPES = {
  RETAIL: { label:'Retail / Restock',  desc:'Regular production for shelf stock' },
  CLIENT: { label:'Client Order',       desc:'Someone ordered and paid (or partially paid)' },
  PENDING:{ label:'Pending Funding',    desc:'Planned but no payment yet' }
};
const WASTE_TYPES = ['Burnt','Damaged','Wrong Texture',
  'Expired Ingredient','Packaging Defect','Other'];

/* ════════════════════════════════════════════════════════
   LABOR ROSTER
════════════════════════════════════════════════════════ */

function getLaborPeople() {
  const people = Array.isArray(APP_STATE.laborPeople) ? APP_STATE.laborPeople : [];
  if (!people.length) {
    const owner = _createOwnerPerson();
    updateState('laborPeople', () => [owner]);
    return [owner];
  }
  return people;
}

function _createOwnerPerson() {
  return {
    id:'owner-default',
    name: APP_STATE.settings?.brandName || 'Owner',
    role:'Owner', rate:0, type:'owner',
    createdAt: new Date().toISOString()
  };
}

function openLaborPersonModal(personId = null) {
  ['laborPersonId','laborPersonName','laborPersonRole','laborPersonRate']
    .forEach(id => setElementValue(id,''));
  setElementValue('laborPersonType','hired');
  if (personId) {
    const p = getLaborPeople().find(p => p.id === personId);
    if (p) {
      setElementValue('laborPersonId',   p.id);
      setElementValue('laborPersonName', p.name);
      setElementValue('laborPersonRole', p.role||'');
      setElementValue('laborPersonRate', p.rate||0);
      setElementValue('laborPersonType', p.type||'hired');
    }
  }
  openModal('laborPersonModal');
}

function saveLaborPersonFromForm() {
  const id   = getElementValue('laborPersonId') || generateId();
  const name = sanitizeText(getElementValue('laborPersonName'));
  const role = sanitizeText(getElementValue('laborPersonRole'));
  const rate = Number(getElementValue('laborPersonRate')||0);
  const type = getElementValue('laborPersonType')||'hired';
  if (!name) { showNotification('Name required','error'); return; }
  const people   = getLaborPeople();
  const existing = people.find(p => p.id === id);
  if (existing) Object.assign(existing,{name,role,rate,type,updatedAt:new Date().toISOString()});
  else people.push({id,name,role,rate,type,createdAt:new Date().toISOString()});
  updateState('laborPeople',()=>people);
  closeModal('laborPersonModal');
  renderLaborRoster();
  showNotification('Person saved','success');
}

function deleteLaborPerson(personId) {
  if (personId==='owner-default') {
    showNotification('Cannot delete the Owner person','error'); return;
  }
  if (!confirm('Delete this person?')) return;
  updateState('laborPeople',()=>getLaborPeople().filter(p=>p.id!==personId));
  renderLaborRoster();
  showNotification('Person removed','success');
}

function renderLaborRoster() {
  const container = document.getElementById('laborRosterContainer');
  if (!container) return;
  const people = getLaborPeople();
  container.innerHTML = people.map(p => {
    const isOwner = p.id==='owner-default';
    const c = p.type==='owner'?'#6b7280':'#16a34a';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 16px;border:1.5px solid var(--gray-200);
        border-radius:var(--radius-lg);margin-bottom:8px;background:var(--white);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--black);
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:13px;font-weight:800;">
            ${escapeHtml(p.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <div style="font-weight:800;font-size:13px;">${escapeHtml(p.name)}
              ${isOwner?'<span style="font-size:9px;color:var(--gray-400);margin-left:4px;">DEFAULT</span>':''}
            </div>
            <div style="font-size:11px;color:var(--gray-400);">
              ${p.role?escapeHtml(p.role)+' · ':''}
              <span style="color:${c};font-weight:700;">
                ${p.type==='owner'?'Owner — no cost':'Hired · '+formatCurrency(p.rate)+'/hr'}
              </span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary"
            data-action="edit-labor-person" data-id="${p.id}">Edit</button>
          ${!isOwner?`<button class="btn btn-sm btn-secondary"
            data-action="delete-labor-person" data-id="${p.id}">Delete</button>`:''}
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════
   PRODUCTION JOBS — Multi-product
════════════════════════════════════════════════════════ */

function getProductionJobs() {
  return Array.isArray(APP_STATE.productionJobs) ? APP_STATE.productionJobs : [];
}

function getProductionJobById(id) {
  return getProductionJobs().find(j=>String(j.id)===String(id));
}

/* ── In-memory job being edited ── */
let _editingJob = null;

function openProductionJobModal(jobId = null) {
  _editingJob = jobId ? { ...getProductionJobById(jobId) } : _blankJob();
  if (!_editingJob) return;
  _renderJobModal();
  openModal('productionJobModal');
}

function _blankJob() {
  return {
    id: generateId(),
    name: '', fundingType: 'RETAIL',
    scheduledDate: new Date().toISOString().slice(0,10),
    clientName:'', totalValue:0, downPayment:0, fullPayment:0,
    eventId: null, notes:'',
    products: [],       // { id, productId, productName, targetQty, batchSize,
                        //   status, actualYield, wasteLog, efficiency }
    laborAssignments:[], // { personId, hours }
    status:'PLANNED',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}

function _renderJobModal() {
  if (!_editingJob) return;
  const job = _editingJob;

  setElementValue('prodJobId',            job.id);
  setElementValue('prodJobName',          job.name||'');
  setElementValue('prodJobScheduledDate', job.scheduledDate||'');
  setElementValue('prodJobFundingType',   job.fundingType||'RETAIL');
  setElementValue('prodJobClientName',    job.clientName||'');
  setElementValue('prodJobTotalValue',    job.totalValue||'');
  setElementValue('prodJobDownPayment',   job.downPayment||'');
  setElementValue('prodJobFullPayment',   job.fullPayment||'');
  setElementValue('prodJobNotes',         job.notes||'');

  _toggleFundingFields(job.fundingType||'RETAIL');
  _renderJobProductLines();
  _renderJobLaborList();
  _populateJobDropdowns();
}

function _populateJobDropdowns() {
  // Event dropdown
  const eventSel = document.getElementById('prodJobEventId');
  const eventRow = document.getElementById('prodJobEventRow');
  if (eventSel && eventRow) {
    const events    = APP_STATE.events||[];
    const ccEnabled = APP_STATE.settings?.coffeeCartModeEnabled;
    eventRow.style.display = (ccEnabled && events.length) ? 'block' : 'none';
    eventSel.innerHTML = `<option value="">No event link</option>` +
      events.map(e=>`<option value="${e.id}"
        ${_editingJob?.eventId===e.id?'selected':''}>${escapeHtml(e.name)}</option>`).join('');
  }

  // Labor select
  const laborSel = document.getElementById('prodJobLaborSelect');
  if (laborSel) {
    laborSel.innerHTML = `<option value="">+ Assign person…</option>` +
      getLaborPeople().map(p=>`<option value="${p.id}">
        ${escapeHtml(p.name)} ${p.type==='owner'?'(Owner)':'· ₱'+Number(p.rate||0).toFixed(0)+'/hr'}
      </option>`).join('');
    laborSel.onchange = e => {
      if (e.target.value) { _addLaborToEditingJob(e.target.value); e.target.value=''; }
    };
  }

  // Product picker dropdown
  const prodPicker = document.getElementById('prodJobProductPicker');
  if (prodPicker) {
    const usedIds = (_editingJob?.products||[]).map(p=>p.productId);
    prodPicker.innerHTML = `<option value="">+ Add product to this job…</option>` +
      (APP_STATE.products||[]).map(p=>`<option value="${p.id}">
        ${escapeHtml(p.name)}</option>`).join('');
    prodPicker.onchange = e => {
      if (e.target.value) { _addProductToEditingJob(e.target.value); e.target.value=''; }
    };
  }
}

/* ── Product lines ── */
function _addProductToEditingJob(productId) {
  if (!_editingJob) return;
  const product = (APP_STATE.products||[]).find(p=>p.id===productId);
  if (!product) return;
  _editingJob.products = _editingJob.products||[];
  _editingJob.products.push({
    id: generateId(), productId, productName: product.name,
    targetQty:0, batchSize: Number(product.batchYield||1),
    status:'PLANNED', actualYield:null, wasteLog:[], efficiency:null
  });
  _renderJobProductLines();
}

function _renderJobProductLines() {
  const container = document.getElementById('prodJobProductLines');
  if (!container || !_editingJob) return;

  const products = _editingJob.products||[];
  if (!products.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--gray-400);
      padding:10px 0;">No products added yet — select from the dropdown above</div>`;
    return;
  }

  container.innerHTML = products.map((line, idx) => `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;
      gap:8px;align-items:center;padding:10px 12px;
      border:1px solid var(--gray-100);border-radius:var(--radius-md);
      margin-bottom:6px;background:var(--gray-50);">
      <div style="font-weight:700;font-size:12px;">${escapeHtml(line.productName)}</div>
      <div>
        <label style="font-size:9px;color:var(--gray-400);display:block;
          letter-spacing:1px;text-transform:uppercase;">Target Qty</label>
        <input type="number" min="0" value="${line.targetQty||''}"
          placeholder="0"
          style="width:100%;padding:5px 8px;border:1px solid var(--gray-200);
            border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
          oninput="_editingJob.products[${idx}].targetQty=Number(this.value||0);"/>
      </div>
      <div>
        <label style="font-size:9px;color:var(--gray-400);display:block;
          letter-spacing:1px;text-transform:uppercase;">Batch Size</label>
        <input type="number" min="1" value="${line.batchSize||1}"
          placeholder="1"
          style="width:100%;padding:5px 8px;border:1px solid var(--gray-200);
            border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
          oninput="_editingJob.products[${idx}].batchSize=Number(this.value||1);"/>
      </div>
      <button type="button" class="btn btn-sm btn-secondary"
        onclick="_editingJob.products.splice(${idx},1);_renderJobProductLines();">✕</button>
    </div>`).join('');
}

/* ── Labor ── */
function _addLaborToEditingJob(personId) {
  if (!_editingJob) return;
  const already = (_editingJob.laborAssignments||[]).find(a=>a.personId===personId);
  if (already) { showNotification('Person already assigned','info'); return; }
  _editingJob.laborAssignments = _editingJob.laborAssignments||[];
  _editingJob.laborAssignments.push({personId, hours:0});
  _renderJobLaborList();
}

function _renderJobLaborList() {
  const container = document.getElementById('prodJobLaborList');
  if (!container || !_editingJob) return;
  const assignments = _editingJob.laborAssignments||[];
  const people      = getLaborPeople();

  if (!assignments.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--gray-400);
      padding:6px 0;">No labor assigned</div>`;
  } else {
    container.innerHTML = assignments.map((a,i)=>{
      const person = people.find(p=>p.id===a.personId);
      const cost   = person?.type==='hired'
        ? Number(person.rate||0)*Number(a.hours||0) : 0;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;
          background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:5px;
          font-size:12px;">
          <span style="font-weight:700;flex:1;">${escapeHtml(person?.name||'Unknown')}</span>
          <span style="color:var(--gray-400);font-size:11px;">${person?.role||''}</span>
          <input type="number" value="${a.hours||0}" min="0" step="0.5"
            placeholder="hrs"
            style="width:65px;padding:4px 8px;border:1px solid var(--gray-200);
              border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);"
            oninput="_editingJob.laborAssignments[${i}].hours=Number(this.value||0);
              _renderJobLaborList();" />
          <span style="font-size:11px;min-width:55px;text-align:right;
            color:${person?.type==='owner'?'var(--gray-400)':'var(--black)'};">
            ${person?.type==='owner'?'Owner':formatCurrency(cost)}</span>
          <button type="button" style="background:none;border:none;cursor:pointer;
            color:var(--gray-400);font-size:14px;"
            onclick="_editingJob.laborAssignments.splice(${i},1);_renderJobLaborList();">✕</button>
        </div>`;
    }).join('');
  }

  const total = _calcLaborCost(_editingJob.laborAssignments, people);
  const el    = document.getElementById('prodJobLaborTotal');
  if (el) el.textContent = formatCurrency(total);
}

function _calcLaborCost(assignments, people) {
  return (assignments||[]).reduce((sum,a)=>{
    const p = (people||getLaborPeople()).find(x=>x.id===a.personId);
    if (!p||p.type==='owner') return sum;
    return sum + Number(p.rate||0)*Number(a.hours||0);
  },0);
}

function _toggleFundingFields(type) {
  const cf = document.getElementById('prodJobClientFields');
  const pf = document.getElementById('prodJobPaymentFields');
  if (cf) cf.style.display = ['CLIENT','PENDING'].includes(type)?'block':'none';
  if (pf) pf.style.display = type==='CLIENT'?'block':'none';
  if (_editingJob) _editingJob.fundingType = type;
}

/* ── Save job ── */
function saveProductionJob() {
  if (!_editingJob) return;

  const name          = sanitizeText(getElementValue('prodJobName'));
  const scheduledDate = getElementValue('prodJobScheduledDate');
  const fundingType   = getElementValue('prodJobFundingType')||'RETAIL';
  const clientName    = sanitizeText(getElementValue('prodJobClientName'));
  const totalValue    = Number(getElementValue('prodJobTotalValue')||0);
  const downPayment   = Number(getElementValue('prodJobDownPayment')||0);
  const fullPayment   = Number(getElementValue('prodJobFullPayment')||0);
  const eventId       = getElementValue('prodJobEventId')||null;
  const notes         = sanitizeText(getElementValue('prodJobNotes'));

  if (!_editingJob.products?.length) {
    showNotification('Add at least one product','error'); return;
  }

  // Derive job-level status from product statuses
  const statuses   = _editingJob.products.map(p=>p.status);
  const jobStatus  = _deriveJobStatus(statuses);
  const balance    = Math.max(0, totalValue - downPayment - fullPayment);
  let paymentStatus= 'UNPAID';
  if (fullPayment>=totalValue&&totalValue>0) paymentStatus='PAID';
  else if (downPayment>0||fullPayment>0)     paymentStatus='PARTIAL';

  Object.assign(_editingJob, {
    name: name || _editingJob.products.map(p=>p.productName).join(', '),
    scheduledDate, fundingType, clientName, totalValue, downPayment,
    fullPayment, balance, paymentStatus, eventId, notes,
    status: jobStatus, updatedAt: new Date().toISOString()
  });

  const jobs     = getProductionJobs();
  const existing = jobs.findIndex(j=>j.id===_editingJob.id);
  if (existing>=0) jobs[existing] = _editingJob;
  else jobs.push(_editingJob);

  updateState('productionJobs',()=>jobs);
  closeModal('productionJobModal');
  _editingJob = null;
  renderProductionBoard();
  showNotification('Production job saved','success');
}

function deleteProductionJob(jobId) {
  if (!confirm('Delete this production job?')) return;
  updateState('productionJobs',()=>getProductionJobs().filter(j=>j.id!==jobId));
  renderProductionBoard();
  showNotification('Job deleted','success');
}

function _deriveJobStatus(statuses) {
  if (!statuses.length) return 'PLANNED';
  if (statuses.every(s=>s==='PACKED'))     return 'PACKED';
  if (statuses.every(s=>s==='CANCELLED'))  return 'CANCELLED';
  if (statuses.some(s=>s==='IN_PROGRESS')) return 'IN_PROGRESS';
  if (statuses.some(s=>s==='QC'))          return 'QC';
  if (statuses.some(s=>s==='DONE'))        return 'DONE';
  return 'PLANNED';
}

/* ── Per-product status picker ── */
function openProductLineStatusModal(jobId, lineId) {
  const job  = getProductionJobById(jobId);
  const line = job?.products?.find(p=>p.id===lineId);
  if (!job||!line) return;

  setElementValue('prodLineStatusJobId',  jobId);
  setElementValue('prodLineStatusLineId', lineId);

  const infoEl = document.getElementById('prodLineStatusInfo');
  if (infoEl) infoEl.textContent = `${line.productName} — ${line.targetQty} units`;

  const container = document.getElementById('prodLineStatusOptions');
  if (container) {
    container.innerHTML = PRODUCTION_STATUSES.map(s=>{
      const color    = PRODUCTION_STATUS_COLORS[s];
      const isActive = line.status===s;
      return `
        <button type="button"
          data-action="set-product-line-status"
          data-job-id="${jobId}" data-line-id="${lineId}" data-status="${s}"
          style="padding:10px 14px;border:1.5px solid ${isActive?color:'var(--gray-200)'};
            border-radius:var(--radius-lg);background:${isActive?color:'var(--white)'};
            color:${isActive?'white':'var(--gray-700)'};font-size:11px;font-weight:800;
            cursor:pointer;font-family:var(--font-main);">
          ${PRODUCTION_STATUS_LABELS[s]} ${isActive?'✓':''}
        </button>`;
    }).join('');
  }
  openModal('prodLineStatusModal');
}

function setProductLineStatus(jobId, lineId, newStatus) {
  const jobs = getProductionJobs();
  const job  = jobs.find(j=>j.id===jobId);
  const line = job?.products?.find(p=>p.id===lineId);
  if (!job||!line) return;

  line.status = newStatus;
  line.statusHistory = [...(line.statusHistory||[]),
    {status:newStatus, changedAt:new Date().toISOString()}];

  // Deduct ingredients at DONE
  if (newStatus==='DONE' && !line.ingredientsDeducted) {
    _deductLineIngredients(job, line);
    line.ingredientsDeducted = true;
  }
  if (newStatus==='CANCELLED' && line.ingredientsDeducted) {
    if (confirm('Restore ingredients to stock?')) {
      _restoreLineIngredients(job, line);
      line.ingredientsDeducted = false;
    }
  }

  // Auto-update job status
  job.status = _deriveJobStatus(job.products.map(p=>p.status));
  job.updatedAt = new Date().toISOString();

  updateState('productionJobs',()=>jobs);
  closeModal('prodLineStatusModal');
  renderProductionBoard();
  showNotification(`${line.productName} → ${PRODUCTION_STATUS_LABELS[newStatus]}`,'success');
}

function _deductLineIngredients(job, line) {
  const product = (APP_STATE.products||[]).find(p=>p.id===line.productId);
  if (!product||!Array.isArray(product.recipe)) return;
  const units     = line.actualYield??line.targetQty;
  const batchYield= Math.max(1, Number(product.batchYield||1));
  const mode      = String(product.recipeMode||'unit');
  const ings      = [...(APP_STATE.ingredients||[])];
  product.recipe.forEach(ri=>{
    const idx = ings.findIndex(i=>String(i.id)===String(ri.ingredientId));
    if (idx<0) return;
    const perUnit = mode==='batch' ? Number(ri.quantity||0)/batchYield : Number(ri.quantity||0);
    const used    = perUnit * units;
    ings[idx] = {...ings[idx], stock:Math.max(0,Number(ings[idx].stock||0)-used)};
    if (typeof logInventoryAdjustment==='function') {
      logInventoryAdjustment(ings[idx].id,
        Number(ings[idx].stock)+used, ings[idx].stock,
        `Production: ${job.name||''} — ${line.productName}`);
    }
  });
  updateState('ingredients',()=>ings);
}

function _restoreLineIngredients(job, line) {
  const product = (APP_STATE.products||[]).find(p=>p.id===line.productId);
  if (!product||!Array.isArray(product.recipe)) return;
  const units     = line.actualYield??line.targetQty;
  const batchYield= Math.max(1, Number(product.batchYield||1));
  const mode      = String(product.recipeMode||'unit');
  const ings      = [...(APP_STATE.ingredients||[])];
  product.recipe.forEach(ri=>{
    const idx = ings.findIndex(i=>String(i.id)===String(ri.ingredientId));
    if (idx<0) return;
    const perUnit = mode==='batch' ? Number(ri.quantity||0)/batchYield : Number(ri.quantity||0);
    ings[idx] = {...ings[idx], stock:Number(ings[idx].stock||0)+perUnit*units};
  });
  updateState('ingredients',()=>ings);
}

/* ── Batch tracking per product line ── */
function openBatchTrackingModal(jobId, lineId) {
  const job  = getProductionJobById(jobId);
  const line = job?.products?.find(p=>p.id===lineId);
  if (!job||!line) return;

  setElementValue('batchJobId',       jobId);
  setElementValue('batchLineId',      lineId);
  setElementValue('batchActualYield', line.actualYield??line.targetQty??'');

  const infoEl = document.getElementById('batchJobInfo');
  if (infoEl) infoEl.textContent =
    `${line.productName} · Target: ${line.targetQty} units`;

  _renderWasteLogUI(line.wasteLog||[], jobId, lineId);
  openModal('batchTrackingModal');
}

function _renderWasteLogUI(wasteLog, jobId, lineId) {
  const container = document.getElementById('batchWasteLog');
  if (!container) return;
  const total = wasteLog.reduce((s,w)=>s+Number(w.qty||0),0);
  container.innerHTML = `
    <div style="margin-bottom:8px;">
      ${wasteLog.map((w,i)=>`
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;
          background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:5px;
          font-size:12px;">
          <span style="font-weight:700;">${escapeHtml(w.type)}</span>
          <span style="color:var(--gray-500);">${w.qty} units</span>
          ${w.note?`<span style="color:var(--gray-400);">— ${escapeHtml(w.note)}</span>`:''}
          <button type="button" style="margin-left:auto;background:none;border:none;
            cursor:pointer;color:var(--gray-400);"
            onclick="_removeWasteEntry('${jobId}','${lineId}',${i});">✕</button>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
      <select id="wasteType"
        style="flex:1;min-width:140px;padding:6px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);">
        ${WASTE_TYPES.map(t=>`<option>${t}</option>`).join('')}
      </select>
      <input type="number" id="wasteQty" placeholder="Qty" min="0"
        style="width:80px;padding:6px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      <input type="text" id="wasteNote" placeholder="Note (optional)"
        style="flex:1;padding:6px 10px;border:1px solid var(--gray-200);
          border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);" />
      <button class="btn btn-secondary" type="button"
        onclick="_addWasteEntry('${jobId}','${lineId}');">+ Add</button>
    </div>
    ${total>0?`<div style="font-size:11px;color:#dc2626;font-weight:700;">
      Total waste: ${total} units</div>`:''}`;
}

window._addWasteEntry = function(jobId, lineId) {
  const jobs = getProductionJobs();
  const job  = jobs.find(j=>j.id===jobId);
  const line = job?.products?.find(p=>p.id===lineId);
  if (!line) return;
  const type = getElementValue('wasteType')||'Other';
  const qty  = Number(document.getElementById('wasteQty')?.value||0);
  const note = sanitizeText(document.getElementById('wasteNote')?.value||'');
  if (!qty) { showNotification('Enter waste quantity','error'); return; }
  line.wasteLog = [...(line.wasteLog||[]),{type,qty,note,loggedAt:new Date().toISOString()}];
  updateState('productionJobs',()=>jobs);
  setElementValue('wasteQty',''); setElementValue('wasteNote','');
  _renderWasteLogUI(line.wasteLog, jobId, lineId);
};

window._removeWasteEntry = function(jobId, lineId, idx) {
  const jobs = getProductionJobs();
  const job  = jobs.find(j=>j.id===jobId);
  const line = job?.products?.find(p=>p.id===lineId);
  if (!line) return;
  line.wasteLog = (line.wasteLog||[]).filter((_,i)=>i!==idx);
  updateState('productionJobs',()=>jobs);
  _renderWasteLogUI(line.wasteLog, jobId, lineId);
};

function saveBatchTracking() {
  const jobId  = getElementValue('batchJobId');
  const lineId = getElementValue('batchLineId');
  const actual = Number(getElementValue('batchActualYield')||0);
  const jobs   = getProductionJobs();
  const job    = jobs.find(j=>j.id===jobId);
  const line   = job?.products?.find(p=>p.id===lineId);
  if (!line) return;
  line.actualYield = actual;
  line.efficiency  = line.targetQty>0
    ? Math.round((actual/line.targetQty)*100) : 100;
  job.updatedAt = new Date().toISOString();
  updateState('productionJobs',()=>jobs);
  closeModal('batchTrackingModal');
  renderProductionBoard();
  showNotification('Batch saved','success');
}

/* ── Progress % ── */
function _calcJobProgress(job) {
  const lines = job.products||[];
  if (!lines.length) return 0;
  const totalTarget = lines.reduce((s,l)=>s+Number(l.targetQty||0),0);
  if (!totalTarget) return 0;
  const totalActual = lines.reduce((s,l)=>
    s+Number(l.actualYield??(['DONE','QC','PACKED'].includes(l.status)?l.targetQty:0)),0);
  return Math.min(100, Math.round((totalActual/totalTarget)*100));
}

/* ════════════════════════════════════════════════════════
   INGREDIENT FORECAST + COST TO BUY
════════════════════════════════════════════════════════ */

function getIngredientForecast(jobs) {
  const activeJobs = (jobs||getProductionJobs())
    .filter(j=>!['PACKED','CANCELLED'].includes(j.status));

  const needed = {};
  activeJobs.forEach(job=>{
    (job.products||[]).filter(l=>!['DONE','PACKED','CANCELLED'].includes(l.status))
    .forEach(line=>{
      const product = (APP_STATE.products||[]).find(p=>p.id===line.productId);
      if (!product||!Array.isArray(product.recipe)) return;
      const qty       = line.targetQty||0;
      const batchYield= Math.max(1,Number(product.batchYield||1));
      const mode      = String(product.recipeMode||'unit');
      product.recipe.forEach(ri=>{
        const ing = (APP_STATE.ingredients||[]).find(i=>i.id===ri.ingredientId);
        if (!ing) return;
        const perUnit = mode==='batch'
          ? Number(ri.quantity||0)/batchYield : Number(ri.quantity||0);
        if (!needed[ing.id]) {
          needed[ing.id] = {
            id:ing.id, name:ing.name, unit:ing.unit||'',
            total:0, onHand:Number(ing.stock||0),
            costPerUnit:Number(ing.costPerUnit||0)
          };
        }
        needed[ing.id].total += perUnit*qty;
      });
    });
  });

  return Object.values(needed).map(item=>({
    ...item,
    shortfall:    Math.max(0,item.total-item.onHand),
    sufficient:   item.onHand>=item.total,
    costToBuy:    Math.max(0,item.total-item.onHand)*item.costPerUnit
  })).sort((a,b)=>(a.sufficient?1:-1)-(b.sufficient?1:-1));
}

function renderIngredientForecast() {
  const container = document.getElementById('prodForecastContainer');
  if (!container) return;
  const forecast = getIngredientForecast();
  if (!forecast.length) {
    container.innerHTML = `<div class="empty-state">No active production jobs to forecast</div>`;
    return;
  }

  const totalCostToBuy = forecast.reduce((s,f)=>s+f.costToBuy,0);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1.5fr;
      gap:8px;padding:8px 12px;background:var(--black);
      border-radius:var(--radius-md) var(--radius-md) 0 0;">
      ${['Ingredient','Needed','On Hand','Shortfall','Cost to Buy','Status'].map(h=>
        `<div style="font-size:9px;font-weight:800;letter-spacing:1.5px;
          text-transform:uppercase;color:rgba(255,255,255,.7);">${h}</div>`
      ).join('')}
    </div>
    <div style="border:1.5px solid var(--gray-200);border-top:none;
      border-radius:0 0 var(--radius-md) var(--radius-md);">
      ${forecast.map(item=>`
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1.5fr;
          gap:8px;padding:10px 12px;border-bottom:1px solid var(--gray-100);
          font-size:12px;">
          <div style="font-weight:700;">${escapeHtml(item.name)}</div>
          <div>${item.total.toFixed(2)} ${item.unit}</div>
          <div>${item.onHand.toFixed(2)} ${item.unit}</div>
          <div style="color:${item.shortfall>0?'#dc2626':'var(--gray-400)'};">
            ${item.shortfall>0?item.shortfall.toFixed(2)+' '+item.unit:'—'}</div>
          <div style="font-weight:${item.costToBuy>0?'700':'400'};
            color:${item.costToBuy>0?'#dc2626':'var(--gray-400)'};">
            ${item.costToBuy>0?formatCurrency(item.costToBuy):'—'}</div>
          <div>${item.sufficient
            ?'<span style="color:#16a34a;font-weight:700;">✓ Sufficient</span>'
            :'<span style="color:#dc2626;font-weight:700;">⚠ Short</span>'}</div>
        </div>`).join('')}
      ${totalCostToBuy>0?`
        <div style="display:flex;justify-content:space-between;padding:10px 12px;
          background:var(--gray-50);font-size:12px;font-weight:800;">
          <span>Total cost to acquire missing ingredients</span>
          <span style="color:#dc2626;">${formatCurrency(totalCostToBuy)}</span>
        </div>`:''}
    </div>`;
}

/* ════════════════════════════════════════════════════════
   PRODUCTION BOARD RENDER
════════════════════════════════════════════════════════ */

function renderProductionBoard() {
  _renderProductionJobsTable();
  renderIngredientForecast();
  renderProductionAnalytics();
}

function _renderProductionJobsTable() {
  const tbody = document.querySelector('#productionJobsTable tbody');
  if (!tbody) return;

  const statusFilter = document.getElementById('prodStatusFilter')?.value||'';
  let jobs = getProductionJobs();
  if (statusFilter) jobs = jobs.filter(j=>j.status===statusFilter);
  jobs = jobs.slice().sort((a,b)=>
    new Date(a.scheduledDate||0)-new Date(b.scheduledDate||0));

  tbody.innerHTML='';
  if (!jobs.length) {
    tbody.innerHTML=`<tr><td colspan="7" class="empty-state">
      No production jobs yet</td></tr>`;
    return;
  }

  jobs.forEach(job=>{
    const progress   = _calcJobProgress(job);
    const statusColor= PRODUCTION_STATUS_COLORS[job.status]||'#888';
    const statusLabel= PRODUCTION_STATUS_LABELS[job.status]||job.status;
    const laborCost  = _calcLaborCost(job.laborAssignments, getLaborPeople());
    const event      = job.eventId
      ? (APP_STATE.events||[]).find(e=>e.id===job.eventId) : null;
    const progressColor = progress>=100?'#16a34a':progress>=50?'#2563eb':'#ea580c';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="font-weight:800;">${escapeHtml(job.name||'Unnamed Job')}</div>
        ${event?`<div style="font-size:10px;color:#2563eb;">${escapeHtml(event.name)}</div>`:''}
        <div style="margin-top:6px;">
          ${(job.products||[]).map(line=>{
            const c = PRODUCTION_STATUS_COLORS[line.status]||'#888';
            const l = PRODUCTION_STATUS_LABELS[line.status]||line.status;
            return `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                <span style="font-size:11px;">${escapeHtml(line.productName)}</span>
                <span style="font-size:10px;color:var(--gray-400);">×${line.targetQty}</span>
                <button type="button"
                  data-action="open-prod-line-status"
                  data-job-id="${job.id}" data-line-id="${line.id}"
                  style="font-size:9px;font-weight:800;padding:1px 7px;
                    border-radius:999px;border:1px solid ${c}40;
                    background:${c}15;color:${c};cursor:pointer;
                    font-family:var(--font-main);">${l}</button>
                <button type="button"
                  data-action="open-batch-tracking"
                  data-job-id="${job.id}" data-line-id="${line.id}"
                  style="font-size:9px;padding:1px 7px;border-radius:999px;
                    border:1px solid var(--gray-200);background:var(--white);
                    cursor:pointer;font-family:var(--font-main);
                    color:var(--gray-500);">Batch</button>
              </div>`;
          }).join('')}
        </div>
      </td>
      <td>${job.scheduledDate
        ?new Date(job.scheduledDate+'T00:00:00')
          .toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'—'}</td>
      <td>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;
          border-radius:999px;background:${statusColor}20;color:${statusColor};
          border:1px solid ${statusColor}40;">${statusLabel}</span>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:8px;background:var(--gray-100);
            border-radius:999px;overflow:hidden;min-width:60px;">
            <div style="height:100%;width:${progress}%;background:${progressColor};
              border-radius:999px;transition:width .3s ease;"></div>
          </div>
          <span style="font-size:11px;font-weight:800;color:${progressColor};
            white-space:nowrap;">${progress}%</span>
        </div>
      </td>
      <td style="font-size:11px;">
        ${job.fundingType==='CLIENT'
          ?`<div>${formatCurrency(job.totalValue||0)}</div>
            <div style="color:${job.paymentStatus==='PAID'?'#16a34a':
              job.paymentStatus==='PARTIAL'?'#ea580c':'#dc2626'};font-size:10px;
              font-weight:700;">${job.paymentStatus||'UNPAID'}</div>`
          :`<span style="color:var(--gray-400);">
            ${FUNDING_TYPES[job.fundingType]?.label||job.fundingType}</span>`}
      </td>
      <td>${laborCost>0?formatCurrency(laborCost):'—'}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-secondary"
            data-action="edit-prod-job" data-id="${job.id}">Edit</button>
          <button class="btn btn-sm btn-secondary"
            data-action="delete-prod-job" data-id="${job.id}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });
}

/* ════════════════════════════════════════════════════════
   PRODUCTION ANALYTICS
════════════════════════════════════════════════════════ */

function renderProductionAnalytics() {
  const container = document.getElementById('prodAnalyticsContainer');
  if (!container) return;

  const jobs = getProductionJobs();
  const completedLines = jobs.flatMap(j=>
    (j.products||[]).filter(l=>['DONE','PACKED'].includes(l.status))
    .map(l=>({...l, jobName:j.name})));

  if (!completedLines.length) {
    container.innerHTML=`<div class="empty-state">
      Complete production jobs to see analytics</div>`;
    return;
  }

  const totalUnits = completedLines.reduce((s,l)=>s+(l.actualYield??l.targetQty),0);
  const totalWaste = completedLines.reduce((s,l)=>
    s+(l.wasteLog||[]).reduce((ws,w)=>ws+Number(w.qty||0),0),0);
  const avgEff     = completedLines.filter(l=>l.efficiency!=null)
    .reduce((s,l,_,a)=>s+l.efficiency/a.length,0);
  const totalLabor = jobs.reduce((s,j)=>
    s+_calcLaborCost(j.laborAssignments,getLaborPeople()),0);

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
      margin-bottom:20px;">
      ${[
        ['Completed Lines', completedLines.length],
        ['Units Produced',  totalUnits],
        ['Avg Efficiency',  avgEff?avgEff.toFixed(0)+'%':'—'],
        ['Total Labor',     totalLabor>0?formatCurrency(totalLabor):'—'],
      ].map(([label,val])=>`
        <div class="stat-card">
          <div class="label">${label}</div>
          <div class="value" style="font-size:20px;">${val}</div>
        </div>`).join('')}
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Job</th><th>Product</th><th>Target</th>
            <th>Actual</th><th>Efficiency</th><th>Waste</th>
          </tr>
        </thead>
        <tbody>
          ${completedLines.map(line=>{
            const waste=(line.wasteLog||[]).reduce((s,w)=>s+Number(w.qty||0),0);
            return `
              <tr>
                <td style="font-size:11px;color:var(--gray-500);">
                  ${escapeHtml(line.jobName)}</td>
                <td style="font-weight:700;">${escapeHtml(line.productName)}</td>
                <td>${line.targetQty}</td>
                <td>${line.actualYield??line.targetQty}</td>
                <td>${line.efficiency!=null
                  ?`<span style="color:${line.efficiency>=90?'#16a34a':
                    line.efficiency>=70?'#ea580c':'#dc2626'};">
                    ${line.efficiency}%</span>`:'—'}</td>
                <td>${waste>0
                  ?`<span style="color:#dc2626;">${waste}</span>`:'—'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Toggle + View ── */
function applyProductionModeToggle() {
  const enabled = APP_STATE.settings?.productionModeEnabled===true;
  const navBtn  = document.getElementById('navProduction');
  if (navBtn) navBtn.style.display = enabled?'':'none';
  if (!enabled && APP_STATE.ui?.currentView==='production') {
    if (typeof switchPage==='function') switchPage('pos');
  }
}

function renderProductionView() {
  renderProductionBoard();
  renderLaborRoster();
}

/* ── Exports ── */
window.getLaborPeople              = getLaborPeople;
window.openLaborPersonModal        = openLaborPersonModal;
window.saveLaborPersonFromForm     = saveLaborPersonFromForm;
window.deleteLaborPerson           = deleteLaborPerson;
window.renderLaborRoster           = renderLaborRoster;
window.getProductionJobs           = getProductionJobs;
window.openProductionJobModal      = openProductionJobModal;
window.saveProductionJob           = saveProductionJob;
window.deleteProductionJob         = deleteProductionJob;
window.openProductLineStatusModal  = openProductLineStatusModal;
window.setProductLineStatus        = setProductLineStatus;
window.openBatchTrackingModal      = openBatchTrackingModal;
window.saveBatchTracking           = saveBatchTracking;
window.getIngredientForecast       = getIngredientForecast;
window.renderIngredientForecast    = renderIngredientForecast;
window.renderProductionAnalytics   = renderProductionAnalytics;
window.renderProductionBoard       = renderProductionBoard;
window.renderProductionView        = renderProductionView;
window.applyProductionModeToggle   = applyProductionModeToggle;
window._toggleFundingFields        = _toggleFundingFields;
window._renderJobProductLines      = _renderJobProductLines;
window._editingJob                 = null;
