/* ═══════════════════════════════════════════════════════
   ORIGIN.JS — Origin Mode
   Full lifecycle: raw material lots → batch processing
   → finished stock → B2B wholesale orders + traceability
   Categories: Coffee, Cacao, Tea
═══════════════════════════════════════════════════════ */

/* ── Sub-view state ── */
let _originView = 'dashboard'; // dashboard|lots|batches|profiles|orders|clients|trace

const ORIGIN_CATEGORIES = ['Coffee', 'Cacao', 'Tea'];

const ORIGIN_BATCH_TYPES = {
  Coffee: ['Roast', 'Blend', 'Grind', 'Custom'],
  Cacao:  ['Fermentation', 'Drying', 'Roast', 'Mill', 'Custom'],
  Tea:    ['Withering', 'Rolling', 'Oxidation', 'Firing', 'Custom'],
};

const ORIGIN_LOT_STATUSES   = ['Active', 'Processing', 'Depleted', 'Archived'];
const ORIGIN_BATCH_STATUSES  = ['Planned', 'In Progress', 'Done', 'Cancelled'];
const ORIGIN_ORDER_STATUSES  = ['Draft', 'Confirmed', 'Processing', 'Ready', 'Delivered', 'Completed'];
const ORIGIN_ROAST_LEVELS    = ['Light', 'Light-Medium', 'Medium', 'Medium-Dark', 'Dark', 'Extra Dark'];

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
function _originFmt(n) { return typeof formatCurrency === 'function' ? formatCurrency(n) : '₱' + Number(n||0).toFixed(2); }
function _originDate(d) { return d ? new Date(d).toLocaleDateString('en-PH', {year:'numeric',month:'short',day:'numeric'}) : '—'; }
function _originPct(val) { return isFinite(val) ? Number(val).toFixed(1) + '%' : '—'; }

function _statusPill(status, map) {
  const s = String(status||'').toLowerCase();
  const colors = map || {
    active:      ['#f0fdf4','#16a34a','#bbf7d0'],
    processing:  ['#eff6ff','#2563eb','#bfdbfe'],
    depleted:    ['#fef9c3','#854d0e','#fef08a'],
    archived:    ['#f4f4f4','#6b7280','#e5e7eb'],
    planned:     ['#f4f4f4','#374151','#e5e7eb'],
    'in progress':['#eff6ff','#2563eb','#bfdbfe'],
    done:        ['#f0fdf4','#16a34a','#bbf7d0'],
    cancelled:   ['#fef2f2','#dc2626','#fecaca'],
    draft:       ['#f4f4f4','#374151','#e5e7eb'],
    confirmed:   ['#eff6ff','#2563eb','#bfdbfe'],
    ready:       ['#fefce8','#854d0e','#fef08a'],
    delivered:   ['#f0fdf4','#16a34a','#bbf7d0'],
    completed:   ['#0f0f0f','#ffffff','#0f0f0f'],
  };
  const [bg, text, border] = colors[s] || ['#f4f4f4','#374151','#e5e7eb'];
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
    border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.5px;
    background:${bg};color:${text};border:1px solid ${border};">
    ${status}
  </span>`;
}

/* ══════════════════════════════════════════════════════
   MAIN VIEW RENDERER
══════════════════════════════════════════════════════ */
function renderOriginView() {
  const container = document.getElementById('originSubContent');
  if (!container) return;

  // Activate the correct sub-tab button
  document.querySelectorAll('.origin-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === _originView);
  });

  switch (_originView) {
    case 'dashboard': renderOriginDashboard(); break;
    case 'lots':      renderOriginLots();      break;
    case 'batches':   renderOriginBatches();   break;
    case 'profiles':  renderOriginProfiles();  break;
    case 'orders':    renderOriginOrders();    break;
    case 'clients':   renderOriginClients();   break;
    case 'trace':     renderOriginTrace();     break;
  }
}

function switchOriginTab(tab) {
  _originView = tab;
  renderOriginView();
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */
function renderOriginDashboard() {
  const container = document.getElementById('originSubContent');
  if (!container) return;

  const lots    = APP_STATE.originLots    || [];
  const batches = APP_STATE.originBatches || [];
  const orders  = APP_STATE.originOrders  || [];

  const activeLots     = lots.filter(l => l.status === 'Active').length;
  const activeBatches  = batches.filter(b => b.status === 'In Progress').length;
  const doneBatches    = batches.filter(b => b.status === 'Done' && b.inputQty > 0);
  const avgYield       = doneBatches.length
    ? doneBatches.reduce((s,b) => s + (b.outputQty/b.inputQty)*100, 0) / doneBatches.length
    : null;
  const pendingOrders  = orders.filter(o => !['Completed','Cancelled'].includes(o.status)).length;

  // Recent activity — last 8 events across lots + batches + orders
  const events = [
    ...lots.map(l => ({ ts: l.createdAt, label: `Lot ${l.lotNumber} received — ${l.productName}`, type: 'lot' })),
    ...batches.map(b => ({ ts: b.createdAt, label: `Batch ${b.batchNumber} — ${b.type}`, type: 'batch' })),
    ...orders.map(o => ({ ts: o.createdAt, label: `Order ${o.orderNumber} — ${o.clientName}`, type: 'order' })),
  ].sort((a,b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8);

  container.innerHTML = `
    <!-- KPI row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${_originKpi('Active Lots', activeLots, 'Raw materials available')}
      ${_originKpi('Batches In Progress', activeBatches, 'Currently processing')}
      ${_originKpi('Avg Yield', avgYield !== null ? _originPct(avgYield) : '—', 'Across completed batches')}
      ${_originKpi('Pending Orders', pendingOrders, 'Awaiting fulfilment')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Recent activity -->
      <div>
        <div class="section-title">Recent Activity</div>
        <div style="background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
          ${events.length ? events.map(e => `
            <div style="padding:11px 16px;border-bottom:1px solid var(--border);
              display:flex;align-items:center;gap:10px;">
              <div style="width:7px;height:7px;border-radius:50%;flex-shrink:0;
                background:${e.type==='lot'?'#16a34a':e.type==='batch'?'#2563eb':'#7c3aed'};"></div>
              <div style="flex:1;font-size:12px;font-weight:600;">${escapeHtml(e.label)}</div>
              <div style="font-size:11px;color:var(--gray-400);">${_originDate(e.ts)}</div>
            </div>`).join('') :
            `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:12px;">No activity yet</div>`
          }
        </div>
      </div>

      <!-- Lot stock snapshot -->
      <div>
        <div class="section-title">Active Lots — Stock</div>
        <div style="background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
          ${lots.filter(l=>l.status==='Active').length ? `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr>
                  <th style="padding:9px 14px;text-align:left;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;background:var(--gray-900);color:rgba(255,255,255,.85);">Lot</th>
                  <th style="padding:9px 14px;text-align:left;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;background:var(--gray-900);color:rgba(255,255,255,.85);">Product</th>
                  <th style="padding:9px 14px;text-align:right;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;background:var(--gray-900);color:rgba(255,255,255,.85);">Remaining</th>
                </tr>
              </thead>
              <tbody>
                ${lots.filter(l=>l.status==='Active').slice(0,8).map(l=>`
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:10px 14px;font-family:var(--font-mono,monospace);font-size:11px;color:var(--gray-500);">${escapeHtml(l.lotNumber)}</td>
                    <td style="padding:10px 14px;font-weight:700;">${escapeHtml(l.productName)}</td>
                    <td style="padding:10px 14px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;">${Number(l.qtyRemaining||0).toFixed(2)} ${escapeHtml(l.unit||'kg')}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` :
            `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:12px;">No active lots</div>`
          }
        </div>
      </div>
    </div>`;
}

function _originKpi(label, value, sub) {
  return `<div class="stat-card">
    <div class="label">${escapeHtml(label)}</div>
    <div class="value" style="font-size:24px;">${escapeHtml(String(value))}</div>
    <div class="sub">${escapeHtml(sub)}</div>
  </div>`;
}

/* ══════════════════════════════════════════════════════
   LOTS
══════════════════════════════════════════════════════ */
function renderOriginLots() {
  const container = document.getElementById('originSubContent');
  if (!container) return;
  const lots = (APP_STATE.originLots || []).slice().reverse();

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input id="originLotSearch" type="text" placeholder="Search lots…"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);
            font-size:12px;font-family:var(--font-main);width:220px;outline:none;"
          oninput="renderOriginLots()" />
        <select id="originLotStatusFilter"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);
            font-size:12px;font-family:var(--font-main);outline:none;"
          onchange="renderOriginLots()">
          <option value="">All Status</option>
          ${ORIGIN_LOT_STATUSES.map(s=>`<option>${s}</option>`).join('')}
        </select>
        <select id="originLotCatFilter"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);
            font-size:12px;font-family:var(--font-main);outline:none;"
          onchange="renderOriginLots()">
          <option value="">All Categories</option>
          ${ORIGIN_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
        </select>
      </div>
      <button class="btn" type="button" onclick="openOriginLotModal(null)">+ New Lot</button>
    </div>

    <div class="table-wrapper">
      <table id="originLotsTable">
        <thead>
          <tr>
            <th>Lot #</th><th>Product</th><th>Category</th>
            <th>Origin / Farmer</th><th>Purchased</th>
            <th>Remaining</th><th>Cost/kg</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="originLotsBody"></tbody>
      </table>
    </div>`;

  _renderOriginLotsBody();
}

function _renderOriginLotsBody() {
  const tbody  = document.getElementById('originLotsBody');
  if (!tbody) return;
  const search = (document.getElementById('originLotSearch')?.value||'').toLowerCase();
  const status = document.getElementById('originLotStatusFilter')?.value||'';
  const cat    = document.getElementById('originLotCatFilter')?.value||'';

  let lots = (APP_STATE.originLots||[]).slice().reverse()
    .filter(l => {
      const matchSearch = !search || l.productName?.toLowerCase().includes(search)
        || l.lotNumber?.toLowerCase().includes(search)
        || l.farmer?.toLowerCase().includes(search)
        || l.origin?.toLowerCase().includes(search);
      const matchStatus = !status || l.status === status;
      const matchCat    = !cat    || l.category === cat;
      return matchSearch && matchStatus && matchCat;
    });

  if (!lots.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--gray-400);">No lots found</td></tr>`;
    return;
  }

  tbody.innerHTML = lots.map(l => {
    const costPerKg = l.qtyPurchased > 0 ? l.purchaseCost / l.qtyPurchased : 0;
    const pctRemaining = l.qtyPurchased > 0
      ? Math.round((l.qtyRemaining / l.qtyPurchased) * 100) : 0;
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--gray-500);">${escapeHtml(l.lotNumber)}</td>
      <td style="font-weight:700;">${escapeHtml(l.productName)}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;
        background:var(--gray-100);color:var(--gray-600);">${escapeHtml(l.category||'')}</span></td>
      <td>
        <div style="font-weight:600;">${escapeHtml(l.origin||'—')}</div>
        <div style="font-size:11px;color:var(--gray-400);">${escapeHtml(l.farmer||'')}</div>
      </td>
      <td>
        <div style="font-weight:700;">${Number(l.qtyPurchased||0).toFixed(2)} ${escapeHtml(l.unit||'kg')}</div>
        <div style="font-size:11px;color:var(--gray-400);">${_originDate(l.purchaseDate)}</div>
      </td>
      <td>
        <div style="font-weight:800;font-variant-numeric:tabular-nums;">${Number(l.qtyRemaining||0).toFixed(2)} ${escapeHtml(l.unit||'kg')}</div>
        <div style="height:4px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:4px;width:80px;">
          <div style="height:100%;border-radius:999px;width:${Math.min(100,pctRemaining)}%;
            background:${pctRemaining>50?'#16a34a':pctRemaining>20?'#ca8a04':'#dc2626'};"></div>
        </div>
      </td>
      <td style="font-variant-numeric:tabular-nums;">${_originFmt(costPerKg)}/kg</td>
      <td>${_statusPill(l.status)}</td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-sm" type="button" onclick="openOriginLotModal('${l.id}')">Edit</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="viewOriginLotTrace('${l.id}')">Trace</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Lot modal ── */
function openOriginLotModal(id) {
  const lot = id ? (APP_STATE.originLots||[]).find(l=>l.id===id) : null;
  const isNew = !lot;

  let m = document.getElementById('originLotModal');
  if (!m) { m = document.createElement('div'); m.id='originLotModal'; m.className='modal-overlay'; document.body.appendChild(m); }

  m.innerHTML = `
    <div class="modal" style="max-width:560px;">
      <h3>${isNew ? 'New Lot' : 'Edit Lot'}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Lot Number</label>
          <input id="olmLotNumber" type="text" value="${escapeHtml(lot?.lotNumber||generateLotNumber())}" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="olmCategory">
            ${ORIGIN_CATEGORIES.map(c=>`<option value="${c}" ${(lot?.category||'Coffee')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label>Product Name</label>
          <input id="olmProductName" type="text" placeholder="e.g. Benguet Arabica Green Beans" value="${escapeHtml(lot?.productName||'')}" />
        </div>
        <div class="form-group">
          <label>Origin / Region</label>
          <input id="olmOrigin" type="text" placeholder="e.g. Benguet, Sagada" value="${escapeHtml(lot?.origin||'')}" />
        </div>
        <div class="form-group">
          <label>Farmer / Supplier</label>
          <input id="olmFarmer" type="text" placeholder="Farmer or supplier name" value="${escapeHtml(lot?.farmer||'')}" />
        </div>
        <div class="form-group">
          <label>Purchase Date</label>
          <input id="olmPurchaseDate" type="date" value="${lot?.purchaseDate||''}" />
        </div>
        <div class="form-group">
          <label>Harvest Date</label>
          <input id="olmHarvestDate" type="date" value="${lot?.harvestDate||''}" />
        </div>
        <div class="form-group">
          <label>Qty Purchased</label>
          <input id="olmQtyPurchased" type="number" min="0" step="0.01" placeholder="0.00" value="${lot?.qtyPurchased||''}" />
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select id="olmUnit">
            ${['kg','g','lb','bag','sack'].map(u=>`<option ${(lot?.unit||'kg')===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Purchase Cost (₱ total)</label>
          <input id="olmPurchaseCost" type="number" min="0" step="0.01" placeholder="0.00" value="${lot?.purchaseCost||''}" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="olmStatus">
            ${ORIGIN_LOT_STATUSES.map(s=>`<option ${(lot?.status||'Active')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label>Processing Method</label>
          <input id="olmProcessingMethod" type="text" placeholder="e.g. Washed, Natural, Honey" value="${escapeHtml(lot?.processingMethod||'')}" />
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label>Notes</label>
          <textarea id="olmNotes" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);font-family:var(--font-main);font-size:13px;resize:vertical;">${escapeHtml(lot?.notes||'')}</textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" onclick="closeModal('originLotModal')">Cancel</button>
        <button class="btn" type="button" onclick="saveOriginLot('${id||''}')">
          ${isNew ? 'Create Lot' : 'Save Changes'}
        </button>
      </div>
    </div>`;

  openModal('originLotModal');
}

function saveOriginLot(id) {
  const qtyPurchased = Number(document.getElementById('olmQtyPurchased')?.value||0);
  const productName  = sanitizeText(document.getElementById('olmProductName')?.value||'');
  if (!productName) { showNotification('Product name is required','error'); return; }
  if (!qtyPurchased) { showNotification('Quantity purchased is required','error'); return; }

  const existing = id ? (APP_STATE.originLots||[]).find(l=>l.id===id) : null;
  const now = new Date().toISOString();

  const lot = {
    id:               existing?.id || generateId(),
    lotNumber:        sanitizeText(document.getElementById('olmLotNumber')?.value||generateLotNumber()),
    category:         document.getElementById('olmCategory')?.value||'Coffee',
    productName,
    origin:           sanitizeText(document.getElementById('olmOrigin')?.value||''),
    farmer:           sanitizeText(document.getElementById('olmFarmer')?.value||''),
    purchaseDate:     document.getElementById('olmPurchaseDate')?.value||'',
    harvestDate:      document.getElementById('olmHarvestDate')?.value||'',
    qtyPurchased,
    qtyRemaining:     existing ? Number(existing.qtyRemaining) : qtyPurchased,
    unit:             document.getElementById('olmUnit')?.value||'kg',
    purchaseCost:     Number(document.getElementById('olmPurchaseCost')?.value||0),
    processingMethod: sanitizeText(document.getElementById('olmProcessingMethod')?.value||''),
    status:           document.getElementById('olmStatus')?.value||'Active',
    notes:            document.getElementById('olmNotes')?.value||'',
    createdAt:        existing?.createdAt || now,
    updatedAt:        now,
  };

  if (!APP_STATE.originLots) APP_STATE.originLots = [];
  if (existing) {
    const idx = APP_STATE.originLots.findIndex(l=>l.id===id);
    APP_STATE.originLots[idx] = lot;
    showNotification('Lot updated','success');
  } else {
    APP_STATE.originLots.push(lot);
    showNotification(`Lot ${lot.lotNumber} created`,'success');
  }

  persistState();
  closeModal('originLotModal');
  renderOriginLots();
}

/* ══════════════════════════════════════════════════════
   BATCHES
══════════════════════════════════════════════════════ */
function renderOriginBatches() {
  const container = document.getElementById('originSubContent');
  if (!container) return;
  const batches = (APP_STATE.originBatches||[]).slice().reverse();

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select id="originBatchStatusFilter"
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);
            font-size:12px;font-family:var(--font-main);outline:none;"
          onchange="_renderOriginBatchesBody()">
          <option value="">All Status</option>
          ${ORIGIN_BATCH_STATUSES.map(s=>`<option>${s}</option>`).join('')}
        </select>
      </div>
      <button class="btn" type="button" onclick="openOriginBatchModal(null)">+ New Batch</button>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Batch #</th><th>Type</th><th>Source Lots</th>
            <th>Input</th><th>Output</th><th>Yield</th>
            <th>Cost / Unit Out</th><th>Operator</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="originBatchesBody"></tbody>
      </table>
    </div>`;

  _renderOriginBatchesBody();
}

function _renderOriginBatchesBody() {
  const tbody = document.getElementById('originBatchesBody');
  if (!tbody) return;
  const statusFilter = document.getElementById('originBatchStatusFilter')?.value||'';

  let batches = (APP_STATE.originBatches||[]).slice().reverse()
    .filter(b => !statusFilter || b.status===statusFilter);

  if (!batches.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--gray-400);">No batches yet</td></tr>`;
    return;
  }

  tbody.innerHTML = batches.map(b => {
    const yieldPct = b.inputQty > 0 ? (b.outputQty / b.inputQty) * 100 : 0;
    const totalCost = _batchTotalCost(b);
    const costPerOut = b.outputQty > 0 ? totalCost / b.outputQty : 0;
    const sourceLotLabels = (b.sourceLots||[]).map(sl=>sl.lotNumber).join(', ') || '—';

    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--gray-500);">${escapeHtml(b.batchNumber)}</td>
      <td style="font-weight:700;">${escapeHtml(b.type||'')}</td>
      <td style="font-size:11px;color:var(--gray-500);max-width:140px;">${escapeHtml(sourceLotLabels)}</td>
      <td style="font-variant-numeric:tabular-nums;">${Number(b.inputQty||0).toFixed(2)} ${escapeHtml(b.unit||'kg')}</td>
      <td style="font-variant-numeric:tabular-nums;">${Number(b.outputQty||0).toFixed(2)} ${escapeHtml(b.outputUnit||b.unit||'kg')}</td>
      <td>
        <div style="font-weight:800;color:${yieldPct>=80?'#16a34a':yieldPct>=60?'#ca8a04':'#dc2626'};">
          ${b.outputQty > 0 ? _originPct(yieldPct) : '—'}
        </div>
      </td>
      <td style="font-variant-numeric:tabular-nums;">${costPerOut > 0 ? _originFmt(costPerOut) + '/'+escapeHtml(b.outputUnit||b.unit||'kg') : '—'}</td>
      <td style="font-size:12px;">${escapeHtml(b.operator||'—')}</td>
      <td>${_statusPill(b.status)}</td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-sm" type="button" onclick="openOriginBatchModal('${b.id}')">Edit</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="viewOriginBatchTrace('${b.id}')">Trace</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function _batchTotalCost(batch) {
  // Raw material cost from source lots
  const rawCost = (batch.sourceLots||[]).reduce((s, sl) => {
    const lot = (APP_STATE.originLots||[]).find(l=>l.id===sl.lotId);
    if (!lot || !lot.qtyPurchased) return s;
    const costPerUnit = lot.purchaseCost / lot.qtyPurchased;
    return s + costPerUnit * Number(sl.qtyUsed||0);
  }, 0);
  const costs = batch.costBreakdown || {};
  return rawCost
    + Number(costs.processing||0)
    + Number(costs.packaging||0)
    + Number(costs.labor||0)
    + Number(costs.delivery||0);
}

/* ── Batch modal ── */
function openOriginBatchModal(id) {
  const batch = id ? (APP_STATE.originBatches||[]).find(b=>b.id===id) : null;
  const isNew = !batch;
  const activeLots = (APP_STATE.originLots||[]).filter(l=>l.status==='Active'||l.status==='Processing');

  let m = document.getElementById('originBatchModal');
  if (!m) { m=document.createElement('div'); m.id='originBatchModal'; m.className='modal-overlay'; document.body.appendChild(m); }

  m.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <h3>${isNew?'New Batch':'Edit Batch'}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Batch Number</label>
          <input id="obmBatchNumber" type="text" value="${escapeHtml(batch?.batchNumber||generateBatchNumber())}" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="obmCategory" onchange="_updateBatchTypeOptions()">
            ${ORIGIN_CATEGORIES.map(c=>`<option value="${c}" ${(batch?.category||'Coffee')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Batch Type</label>
          <select id="obmType">
            ${(ORIGIN_BATCH_TYPES[batch?.category||'Coffee']||[]).map(t=>`<option ${batch?.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="obmStatus">
            ${ORIGIN_BATCH_STATUSES.map(s=>`<option ${(batch?.status||'Planned')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input id="obmDate" type="date" value="${batch?.date||new Date().toISOString().slice(0,10)}" />
        </div>
        <div class="form-group">
          <label>Operator</label>
          <input id="obmOperator" type="text" value="${escapeHtml(batch?.operator||'')}" placeholder="Name of operator" />
        </div>

        <!-- Source lots -->
        <div class="form-group" style="grid-column:1/-1;">
          <label>Source Lots</label>
          <div id="obmLotRows" style="margin-bottom:8px;"></div>
          <button class="btn btn-sm btn-secondary" type="button" onclick="_addBatchLotRow()">+ Add Lot</button>
        </div>

        <!-- Qty -->
        <div class="form-group">
          <label>Input Qty</label>
          <div style="display:flex;gap:6px;">
            <input id="obmInputQty" type="number" min="0" step="0.01" value="${batch?.inputQty||''}"
              oninput="_updateBatchYieldCalc()" style="flex:1;" />
            <select id="obmUnit" style="width:70px;">
              ${['kg','g','lb','bag','sack'].map(u=>`<option ${(batch?.unit||'kg')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Output Qty</label>
          <div style="display:flex;gap:6px;">
            <input id="obmOutputQty" type="number" min="0" step="0.01" value="${batch?.outputQty||''}"
              oninput="_updateBatchYieldCalc()" style="flex:1;" />
            <select id="obmOutputUnit" style="width:70px;">
              ${['kg','g','lb','bag','sack'].map(u=>`<option ${(batch?.outputUnit||batch?.unit||'kg')===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Yield display -->
        <div class="form-group" style="grid-column:1/-1;">
          <div style="display:flex;gap:24px;padding:12px 14px;background:var(--gray-50);
            border-radius:var(--radius-md);border:1.5px solid var(--border);">
            <div>
              <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:4px;">Yield</div>
              <div id="obmYieldDisplay" style="font-size:20px;font-weight:900;">—</div>
            </div>
            <div>
              <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:4px;">Shrinkage</div>
              <div id="obmShrinkDisplay" style="font-size:20px;font-weight:900;">—</div>
            </div>
          </div>
        </div>

        <!-- Processing profile -->
        <div class="form-group" style="grid-column:1/-1;">
          <label>Processing Profile (optional)</label>
          <select id="obmProfile">
            <option value="">— None —</option>
            ${(APP_STATE.originProcessingProfiles||[])
              .filter(p=>!batch?.category||p.category===batch?.category||p.category===document.getElementById('obmCategory')?.value)
              .map(p=>`<option value="${p.id}" ${batch?.profileId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>

        <!-- Cost breakdown -->
        <div class="form-group" style="grid-column:1/-1;">
          <label>Additional Costs (₱)</label>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            ${[['processing','Processing'],['packaging','Packaging'],['labor','Labor'],['delivery','Delivery']].map(([k,lbl])=>`
              <div>
                <div style="font-size:10px;font-weight:700;color:var(--gray-500);margin-bottom:4px;">${lbl}</div>
                <input id="obmCost_${k}" type="number" min="0" step="0.01" value="${batch?.costBreakdown?.[k]||''}"
                  placeholder="0.00" style="width:100%;padding:7px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:var(--font-main);" />
              </div>`).join('')}
          </div>
        </div>

        <div class="form-group" style="grid-column:1/-1;">
          <label>Notes</label>
          <textarea id="obmNotes" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);font-family:var(--font-main);font-size:13px;resize:vertical;">${escapeHtml(batch?.notes||'')}</textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" onclick="closeModal('originBatchModal')">Cancel</button>
        <button class="btn" type="button" onclick="saveOriginBatch('${id||''}')">
          ${isNew?'Create Batch':'Save Changes'}
        </button>
      </div>
    </div>`;

  openModal('originBatchModal');

  // Populate existing source lots
  const sourceLots = batch?.sourceLots || [];
  if (sourceLots.length) {
    sourceLots.forEach(sl => _addBatchLotRow(sl));
  } else {
    _addBatchLotRow();
  }
  _updateBatchYieldCalc();
}

function _updateBatchTypeOptions() {
  const cat = document.getElementById('obmCategory')?.value || 'Coffee';
  const typeSelect = document.getElementById('obmType');
  if (!typeSelect) return;
  typeSelect.innerHTML = (ORIGIN_BATCH_TYPES[cat]||[]).map(t=>`<option>${t}</option>`).join('');
}

function _addBatchLotRow(existing) {
  const container = document.getElementById('obmLotRows');
  if (!container) return;
  const activeLots = (APP_STATE.originLots||[]).filter(l=>l.status==='Active'||l.status==='Processing');
  const rowId = 'batchLotRow_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);

  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
  row.innerHTML = `
    <select style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:var(--font-main);">
      <option value="">— Select Lot —</option>
      ${activeLots.map(l=>`<option value="${l.id}" ${existing?.lotId===l.id?'selected':''}>${escapeHtml(l.lotNumber)} — ${escapeHtml(l.productName)} (${Number(l.qtyRemaining||0).toFixed(2)} ${l.unit||'kg'} left)</option>`).join('')}
    </select>
    <input type="number" min="0" step="0.01" placeholder="Qty used" value="${existing?.qtyUsed||''}"
      style="width:110px;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:var(--font-main);" />
    <button type="button" onclick="document.getElementById('${rowId}').remove()"
      style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:var(--gray-400);font-size:16px;flex-shrink:0;">✕</button>`;
  container.appendChild(row);
}

function _updateBatchYieldCalc() {
  const input  = Number(document.getElementById('obmInputQty')?.value||0);
  const output = Number(document.getElementById('obmOutputQty')?.value||0);
  const yieldEl   = document.getElementById('obmYieldDisplay');
  const shrinkEl  = document.getElementById('obmShrinkDisplay');
  if (!yieldEl || !shrinkEl) return;
  if (input > 0 && output > 0) {
    const y = (output/input)*100;
    const s = 100 - y;
    yieldEl.textContent  = _originPct(y);
    shrinkEl.textContent = _originPct(s);
    yieldEl.style.color  = y>=80?'#16a34a':y>=60?'#ca8a04':'#dc2626';
  } else {
    yieldEl.textContent  = '—';
    shrinkEl.textContent = '—';
    yieldEl.style.color  = '';
  }
}

function saveOriginBatch(id) {
  const inputQty  = Number(document.getElementById('obmInputQty')?.value||0);
  const outputQty = Number(document.getElementById('obmOutputQty')?.value||0);
  const type      = document.getElementById('obmType')?.value||'';
  if (!type) { showNotification('Batch type is required','error'); return; }

  // Collect source lot rows
  const lotRows = document.querySelectorAll('#obmLotRows > div');
  const sourceLots = [];
  lotRows.forEach(row => {
    const sel = row.querySelector('select');
    const inp = row.querySelector('input[type="number"]');
    const lotId   = sel?.value||'';
    const qtyUsed = Number(inp?.value||0);
    if (lotId && qtyUsed > 0) {
      const lot = (APP_STATE.originLots||[]).find(l=>l.id===lotId);
      if (lot) sourceLots.push({ lotId, lotNumber: lot.lotNumber, qtyUsed });
    }
  });

  const existing = id ? (APP_STATE.originBatches||[]).find(b=>b.id===id) : null;
  const now = new Date().toISOString();

  const batch = {
    id:          existing?.id || generateId(),
    batchNumber: sanitizeText(document.getElementById('obmBatchNumber')?.value||generateBatchNumber()),
    category:    document.getElementById('obmCategory')?.value||'Coffee',
    type,
    status:      document.getElementById('obmStatus')?.value||'Planned',
    date:        document.getElementById('obmDate')?.value||now.slice(0,10),
    operator:    sanitizeText(document.getElementById('obmOperator')?.value||''),
    sourceLots,
    inputQty,
    outputQty,
    unit:        document.getElementById('obmUnit')?.value||'kg',
    outputUnit:  document.getElementById('obmOutputUnit')?.value||'kg',
    profileId:   document.getElementById('obmProfile')?.value||null,
    costBreakdown: {
      processing: Number(document.getElementById('obmCost_processing')?.value||0),
      packaging:  Number(document.getElementById('obmCost_packaging')?.value||0),
      labor:      Number(document.getElementById('obmCost_labor')?.value||0),
      delivery:   Number(document.getElementById('obmCost_delivery')?.value||0),
    },
    notes:       document.getElementById('obmNotes')?.value||'',
    createdAt:   existing?.createdAt || now,
    updatedAt:   now,
  };

  // Deduct lot quantities when batch is newly set to In Progress or Done
  const prevStatus = existing?.status || 'Planned';
  const newStatus  = batch.status;
  if (['In Progress','Done'].includes(newStatus) && prevStatus === 'Planned') {
    sourceLots.forEach(sl => {
      const lot = (APP_STATE.originLots||[]).find(l=>l.id===sl.lotId);
      if (lot) {
        lot.qtyRemaining = Math.max(0, Number(lot.qtyRemaining||0) - Number(sl.qtyUsed||0));
        if (lot.qtyRemaining === 0) lot.status = 'Depleted';
        else if (lot.status === 'Active') lot.status = 'Processing';
      }
    });
  }
  // Restore if cancelled
  if (newStatus === 'Cancelled' && ['In Progress','Done'].includes(prevStatus)) {
    (existing.sourceLots||[]).forEach(sl => {
      const lot = (APP_STATE.originLots||[]).find(l=>l.id===sl.lotId);
      if (lot) {
        lot.qtyRemaining = Number(lot.qtyRemaining||0) + Number(sl.qtyUsed||0);
        if (lot.status === 'Depleted' || lot.status === 'Processing') lot.status = 'Active';
      }
    });
  }

  if (!APP_STATE.originBatches) APP_STATE.originBatches = [];
  if (existing) {
    const idx = APP_STATE.originBatches.findIndex(b=>b.id===id);
    APP_STATE.originBatches[idx] = batch;
    showNotification('Batch updated','success');
  } else {
    APP_STATE.originBatches.push(batch);
    showNotification(`Batch ${batch.batchNumber} created`,'success');
  }

  persistState();
  closeModal('originBatchModal');
  renderOriginBatches();
}

/* ══════════════════════════════════════════════════════
   PROCESSING PROFILES
══════════════════════════════════════════════════════ */
function renderOriginProfiles() {
  const container = document.getElementById('originSubContent');
  if (!container) return;
  const profiles = APP_STATE.originProcessingProfiles || [];

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="font-size:12px;color:var(--gray-500);">${profiles.length} profile${profiles.length!==1?'s':''}</div>
      <button class="btn" type="button" onclick="openOriginProfileModal(null)">+ New Profile</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
      ${profiles.length ? profiles.map(p => `
        <div style="background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:18px;position:relative;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
            <div>
              <span style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
                color:var(--gray-400);">${escapeHtml(p.category)}</span>
              <div style="font-size:15px;font-weight:800;margin-top:4px;">${escapeHtml(p.name)}</div>
              ${p.level?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;
                background:var(--gray-900);color:var(--white);margin-top:6px;display:inline-block;">
                ${escapeHtml(p.level)}</span>`:''}
            </div>
            <button class="btn btn-sm btn-secondary" type="button" onclick="openOriginProfileModal('${p.id}')">Edit</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${p.chargeTemp?`<div><div style="font-size:9px;font-weight:700;color:var(--gray-400);letter-spacing:1px;text-transform:uppercase;">Charge Temp</div><div style="font-size:13px;font-weight:700;">${escapeHtml(String(p.chargeTemp))}°C</div></div>`:''}
            ${p.endTemp?`<div><div style="font-size:9px;font-weight:700;color:var(--gray-400);letter-spacing:1px;text-transform:uppercase;">End Temp</div><div style="font-size:13px;font-weight:700;">${escapeHtml(String(p.endTemp))}°C</div></div>`:''}
            ${p.firstCrackTime?`<div><div style="font-size:9px;font-weight:700;color:var(--gray-400);letter-spacing:1px;text-transform:uppercase;">1st Crack</div><div style="font-size:13px;font-weight:700;">${escapeHtml(String(p.firstCrackTime))} min</div></div>`:''}
            ${p.totalTime?`<div><div style="font-size:9px;font-weight:700;color:var(--gray-400);letter-spacing:1px;text-transform:uppercase;">Total Time</div><div style="font-size:13px;font-weight:700;">${escapeHtml(String(p.totalTime))} min</div></div>`:''}
            ${p.devTime?`<div><div style="font-size:9px;font-weight:700;color:var(--gray-400);letter-spacing:1px;text-transform:uppercase;">Dev Time</div><div style="font-size:13px;font-weight:700;">${escapeHtml(String(p.devTime))} min</div></div>`:''}
            ${p.duration?`<div><div style="font-size:9px;font-weight:700;color:var(--gray-400);letter-spacing:1px;text-transform:uppercase;">Duration</div><div style="font-size:13px;font-weight:700;">${escapeHtml(String(p.duration))} hrs</div></div>`:''}
            ${p.tempRange?`<div><div style="font-size:9px;font-weight:700;color:var(--gray-400);letter-spacing:1px;text-transform:uppercase;">Temp Range</div><div style="font-size:13px;font-weight:700;">${escapeHtml(String(p.tempRange))}</div></div>`:''}
          </div>
          ${p.notes?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--gray-500);">${escapeHtml(p.notes)}</div>`:''}
        </div>`).join('') :
        `<div style="grid-column:1/-1;padding:40px;text-align:center;border:1.5px dashed var(--border);border-radius:var(--radius-lg);color:var(--gray-400);">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;">No profiles yet</div>
          <div style="font-size:12px;">Create profiles to attach to batches for consistency tracking.</div>
        </div>`
      }
    </div>`;
}

function openOriginProfileModal(id) {
  const p = id ? (APP_STATE.originProcessingProfiles||[]).find(x=>x.id===id) : null;
  const isNew = !p;
  const cat = p?.category || 'Coffee';

  let m = document.getElementById('originProfileModal');
  if (!m) { m=document.createElement('div'); m.id='originProfileModal'; m.className='modal-overlay'; document.body.appendChild(m); }

  // Coffee gets roast fields; Cacao gets fermentation/drying fields; Tea gets custom
  const coffeeFields = `
    <div class="form-group"><label>Roast Level</label>
      <select id="opfLevel">${ORIGIN_ROAST_LEVELS.map(l=>`<option ${(p?.level||'Medium')===l?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="form-group"><label>Charge Temp (°C)</label>
      <input id="opfChargeTemp" type="number" value="${p?.chargeTemp||''}" placeholder="200" /></div>
    <div class="form-group"><label>1st Crack Time (min)</label>
      <input id="opfFirstCrack" type="number" step="0.1" value="${p?.firstCrackTime||''}" placeholder="8.5" /></div>
    <div class="form-group"><label>Dev Time (min)</label>
      <input id="opfDevTime" type="number" step="0.1" value="${p?.devTime||''}" placeholder="2.5" /></div>
    <div class="form-group"><label>End Temp (°C)</label>
      <input id="opfEndTemp" type="number" value="${p?.endTemp||''}" placeholder="210" /></div>
    <div class="form-group"><label>Total Roast Time (min)</label>
      <input id="opfTotalTime" type="number" step="0.1" value="${p?.totalTime||''}" placeholder="11" /></div>`;

  const cacaoFields = `
    <div class="form-group"><label>Duration (hrs)</label>
      <input id="opfDuration" type="number" step="0.5" value="${p?.duration||''}" placeholder="72" /></div>
    <div class="form-group"><label>Temp Range (°C)</label>
      <input id="opfTempRange" type="text" value="${escapeHtml(p?.tempRange||'')}" placeholder="45-50°C" /></div>`;

  const teaFields = `
    <div class="form-group"><label>Duration (hrs)</label>
      <input id="opfDuration" type="number" step="0.5" value="${p?.duration||''}" placeholder="4" /></div>
    <div class="form-group"><label>Temp Range (°C)</label>
      <input id="opfTempRange" type="text" value="${escapeHtml(p?.tempRange||'')}" placeholder="20-25°C" /></div>`;

  m.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <h3>${isNew?'New Processing Profile':'Edit Profile'}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group" style="grid-column:1/-1;">
          <label>Profile Name</label>
          <input id="opfName" type="text" value="${escapeHtml(p?.name||'')}" placeholder="e.g. Classic Medium Roast" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="opfCategory">
            ${ORIGIN_CATEGORIES.map(c=>`<option ${cat===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        ${cat==='Coffee'?coffeeFields:cat==='Cacao'?cacaoFields:teaFields}
        <div class="form-group" style="grid-column:1/-1;">
          <label>Notes</label>
          <textarea id="opfNotes" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);font-family:var(--font-main);font-size:13px;resize:vertical;">${escapeHtml(p?.notes||'')}</textarea>
        </div>
      </div>
      <div class="modal-actions">
        ${!isNew?`<button class="btn btn-secondary" type="button" style="color:var(--danger);"
          onclick="deleteOriginProfile('${id}')">Delete</button>`:''}
        <button class="btn btn-secondary" type="button" onclick="closeModal('originProfileModal')">Cancel</button>
        <button class="btn" type="button" onclick="saveOriginProfile('${id||''}')">
          ${isNew?'Create Profile':'Save Changes'}
        </button>
      </div>
    </div>`;

  openModal('originProfileModal');
}

function saveOriginProfile(id) {
  const name = sanitizeText(document.getElementById('opfName')?.value||'');
  if (!name) { showNotification('Profile name required','error'); return; }
  const cat = document.getElementById('opfCategory')?.value||'Coffee';
  const existing = id ? (APP_STATE.originProcessingProfiles||[]).find(p=>p.id===id) : null;
  const now = new Date().toISOString();

  const profile = {
    id:        existing?.id || generateId(),
    name, category: cat,
    level:     document.getElementById('opfLevel')?.value||'',
    chargeTemp:Number(document.getElementById('opfChargeTemp')?.value||0)||null,
    firstCrackTime:Number(document.getElementById('opfFirstCrack')?.value||0)||null,
    devTime:   Number(document.getElementById('opfDevTime')?.value||0)||null,
    endTemp:   Number(document.getElementById('opfEndTemp')?.value||0)||null,
    totalTime: Number(document.getElementById('opfTotalTime')?.value||0)||null,
    duration:  Number(document.getElementById('opfDuration')?.value||0)||null,
    tempRange: document.getElementById('opfTempRange')?.value||'',
    notes:     document.getElementById('opfNotes')?.value||'',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (!APP_STATE.originProcessingProfiles) APP_STATE.originProcessingProfiles = [];
  if (existing) {
    const idx = APP_STATE.originProcessingProfiles.findIndex(p=>p.id===id);
    APP_STATE.originProcessingProfiles[idx] = profile;
    showNotification('Profile updated','success');
  } else {
    APP_STATE.originProcessingProfiles.push(profile);
    showNotification('Profile created','success');
  }
  persistState();
  closeModal('originProfileModal');
  renderOriginProfiles();
}

function deleteOriginProfile(id) {
  if (!confirm('Delete this profile?')) return;
  APP_STATE.originProcessingProfiles = (APP_STATE.originProcessingProfiles||[]).filter(p=>p.id!==id);
  persistState();
  closeModal('originProfileModal');
  showNotification('Profile deleted','success');
  renderOriginProfiles();
}

/* ══════════════════════════════════════════════════════
   CLIENTS
══════════════════════════════════════════════════════ */
function renderOriginClients() {
  const container = document.getElementById('originSubContent');
  if (!container) return;
  const clients = APP_STATE.originClients || [];

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:12px;color:var(--gray-500);">${clients.length} client${clients.length!==1?'s':''}</div>
      <button class="btn" type="button" onclick="openOriginClientModal(null)">+ New Client</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Client Name</th><th>Contact</th><th>Email</th><th>Address</th><th>Orders</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${clients.length ? clients.map(c => {
            const orderCount = (APP_STATE.originOrders||[]).filter(o=>o.clientId===c.id).length;
            return `<tr>
              <td style="font-weight:700;">${escapeHtml(c.name)}</td>
              <td>${escapeHtml(c.contact||'—')}</td>
              <td style="font-size:12px;">${escapeHtml(c.email||'—')}</td>
              <td style="font-size:12px;color:var(--gray-500);">${escapeHtml(c.address||'—')}</td>
              <td>${orderCount}</td>
              <td><button class="btn btn-sm" type="button" onclick="openOriginClientModal('${c.id}')">Edit</button></td>
            </tr>`;
          }).join('') :
          `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--gray-400);">No clients yet</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function openOriginClientModal(id) {
  const c = id ? (APP_STATE.originClients||[]).find(x=>x.id===id) : null;
  const isNew = !c;
  let m = document.getElementById('originClientModal');
  if (!m) { m=document.createElement('div'); m.id='originClientModal'; m.className='modal-overlay'; document.body.appendChild(m); }

  m.innerHTML = `
    <div class="modal" style="max-width:440px;">
      <h3>${isNew?'New Client':'Edit Client'}</h3>
      <div class="form-group"><label>Business / Client Name</label>
        <input id="oclName" type="text" value="${escapeHtml(c?.name||'')}" placeholder="e.g. Cafe ABC" /></div>
      <div class="form-group"><label>Contact Person</label>
        <input id="oclContact" type="text" value="${escapeHtml(c?.contact||'')}" /></div>
      <div class="form-group"><label>Email</label>
        <input id="oclEmail" type="email" value="${escapeHtml(c?.email||'')}" /></div>
      <div class="form-group"><label>Phone</label>
        <input id="oclPhone" type="text" value="${escapeHtml(c?.phone||'')}" /></div>
      <div class="form-group"><label>Address</label>
        <input id="oclAddress" type="text" value="${escapeHtml(c?.address||'')}" /></div>
      <div class="form-group"><label>Notes</label>
        <textarea id="oclNotes" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);font-family:var(--font-main);font-size:13px;resize:vertical;">${escapeHtml(c?.notes||'')}</textarea></div>
      <div class="modal-actions">
        ${!isNew?`<button class="btn btn-secondary" type="button" style="color:var(--danger);"
          onclick="deleteOriginClient('${id}')">Delete</button>`:''}
        <button class="btn btn-secondary" type="button" onclick="closeModal('originClientModal')">Cancel</button>
        <button class="btn" type="button" onclick="saveOriginClient('${id||''}')">
          ${isNew?'Add Client':'Save'}</button>
      </div>
    </div>`;

  openModal('originClientModal');
}

function saveOriginClient(id) {
  const name = sanitizeText(document.getElementById('oclName')?.value||'');
  if (!name) { showNotification('Client name required','error'); return; }
  const existing = id ? (APP_STATE.originClients||[]).find(c=>c.id===id) : null;
  const now = new Date().toISOString();
  const client = {
    id: existing?.id||generateId(), name,
    contact: sanitizeText(document.getElementById('oclContact')?.value||''),
    email:   sanitizeText(document.getElementById('oclEmail')?.value||''),
    phone:   sanitizeText(document.getElementById('oclPhone')?.value||''),
    address: sanitizeText(document.getElementById('oclAddress')?.value||''),
    notes:   document.getElementById('oclNotes')?.value||'',
    createdAt: existing?.createdAt||now, updatedAt: now,
  };
  if (!APP_STATE.originClients) APP_STATE.originClients = [];
  if (existing) { const i=APP_STATE.originClients.findIndex(c=>c.id===id); APP_STATE.originClients[i]=client; showNotification('Client updated','success'); }
  else { APP_STATE.originClients.push(client); showNotification('Client added','success'); }
  persistState(); closeModal('originClientModal'); renderOriginClients();
}

function deleteOriginClient(id) {
  if (!confirm('Delete this client?')) return;
  APP_STATE.originClients = (APP_STATE.originClients||[]).filter(c=>c.id!==id);
  persistState(); closeModal('originClientModal'); showNotification('Client deleted','success'); renderOriginClients();
}

/* ══════════════════════════════════════════════════════
   ORDERS
══════════════════════════════════════════════════════ */
function renderOriginOrders() {
  const container = document.getElementById('originSubContent');
  if (!container) return;
  const orders = (APP_STATE.originOrders||[]).slice().reverse();

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <select id="originOrderStatusFilter"
        style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);font-size:12px;font-family:var(--font-main);outline:none;"
        onchange="_renderOriginOrdersBody()">
        <option value="">All Status</option>
        ${ORIGIN_ORDER_STATUSES.map(s=>`<option>${s}</option>`).join('')}
      </select>
      <button class="btn" type="button" onclick="openOriginOrderModal(null)">+ New Order</button>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Order #</th><th>Client</th><th>Items</th><th>Total</th><th>Delivery</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody id="originOrdersBody"></tbody>
      </table>
    </div>`;

  _renderOriginOrdersBody();
}

function _renderOriginOrdersBody() {
  const tbody = document.getElementById('originOrdersBody');
  if (!tbody) return;
  const statusFilter = document.getElementById('originOrderStatusFilter')?.value||'';
  let orders = (APP_STATE.originOrders||[]).slice().reverse()
    .filter(o=>!statusFilter||o.status===statusFilter);

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gray-400);">No orders yet</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const total = (o.items||[]).reduce((s,i)=>s+Number(i.total||0),0);
    return `<tr>
      <td style="font-family:monospace;font-size:11px;color:var(--gray-500);">${escapeHtml(o.orderNumber)}</td>
      <td style="font-weight:700;">${escapeHtml(o.clientName||'—')}</td>
      <td style="color:var(--gray-500);">${(o.items||[]).length} item${(o.items||[]).length!==1?'s':''}</td>
      <td style="font-weight:800;font-variant-numeric:tabular-nums;">${_originFmt(total)}</td>
      <td style="font-size:12px;">${_originDate(o.deliveryDate)}</td>
      <td>${_statusPill(o.status)}</td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-sm" type="button" onclick="openOriginOrderModal('${o.id}')">Edit</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="viewOriginOrderTrace('${o.id}')">Trace</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openOriginOrderModal(id) {
  const order = id ? (APP_STATE.originOrders||[]).find(o=>o.id===id) : null;
  const isNew = !order;
  const clients = APP_STATE.originClients || [];
  const batches = (APP_STATE.originBatches||[]).filter(b=>b.status==='Done');

  let m = document.getElementById('originOrderModal');
  if (!m) { m=document.createElement('div'); m.id='originOrderModal'; m.className='modal-overlay'; document.body.appendChild(m); }

  m.innerHTML = `
    <div class="modal" style="max-width:580px;">
      <h3>${isNew?'New Order':'Edit Order'}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Order Number</label>
          <input id="oorOrderNum" type="text" value="${escapeHtml(order?.orderNumber||generateOriginOrderNumber())}" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="oorStatus">
            ${ORIGIN_ORDER_STATUSES.map(s=>`<option ${(order?.status||'Draft')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label>Client</label>
          <select id="oorClient">
            <option value="">— Select client —</option>
            ${clients.map(c=>`<option value="${c.id}" ${order?.clientId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Delivery Date</label>
          <input id="oorDeliveryDate" type="date" value="${order?.deliveryDate||''}" />
        </div>
        <div class="form-group">
          <label>Payment Status</label>
          <select id="oorPaymentStatus">
            ${['Unpaid','Partial','Paid'].map(s=>`<option ${(order?.paymentStatus||'Unpaid')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>

        <!-- Order items -->
        <div class="form-group" style="grid-column:1/-1;">
          <label>Order Items</label>
          <div id="oorItemRows"></div>
          <button class="btn btn-sm btn-secondary" type="button" style="margin-top:6px;"
            onclick="_addOrderItemRow(null)">+ Add Item</button>
          <div style="display:flex;justify-content:flex-end;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
            <span style="font-size:12px;font-weight:700;color:var(--gray-500);margin-right:8px;">Total:</span>
            <span id="oorTotalDisplay" style="font-size:14px;font-weight:900;">₱0.00</span>
          </div>
        </div>

        <div class="form-group" style="grid-column:1/-1;">
          <label>Notes</label>
          <textarea id="oorNotes" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);font-family:var(--font-main);font-size:13px;resize:vertical;">${escapeHtml(order?.notes||'')}</textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" onclick="closeModal('originOrderModal')">Cancel</button>
        <button class="btn" type="button" onclick="saveOriginOrder('${id||''}')">
          ${isNew?'Create Order':'Save Changes'}</button>
      </div>
    </div>`;

  openModal('originOrderModal');

  const items = order?.items || [];
  if (items.length) items.forEach(item => _addOrderItemRow(item));
  else _addOrderItemRow(null);
  _recalcOrderTotal();
}

function _addOrderItemRow(existing) {
  const container = document.getElementById('oorItemRows');
  if (!container) return;
  const batches = (APP_STATE.originBatches||[]).filter(b=>b.status==='Done');
  const rowId = 'oorRow_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);

  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 100px auto;gap:6px;margin-bottom:6px;align-items:center;';
  row.innerHTML = `
    <input type="text" placeholder="Product / description" value="${escapeHtml(existing?.productName||'')}"
      style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:var(--font-main);"
      oninput="_recalcOrderTotal()" />
    <input type="number" min="0" step="0.01" placeholder="Qty" value="${existing?.qty||''}"
      style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:var(--font-main);"
      oninput="_recalcOrderTotal()" />
    <input type="number" min="0" step="0.01" placeholder="₱/unit" value="${existing?.pricePerUnit||''}"
      style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:var(--font-main);"
      oninput="_recalcOrderTotal()" />
    <button type="button" onclick="document.getElementById('${rowId}').remove();_recalcOrderTotal();"
      style="width:28px;height:28px;border:none;background:none;cursor:pointer;color:var(--gray-400);font-size:16px;flex-shrink:0;">✕</button>`;
  container.appendChild(row);
}

function _recalcOrderTotal() {
  const rows = document.querySelectorAll('#oorItemRows > div');
  let total = 0;
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input[type="number"]');
    const qty   = Number(inputs[0]?.value||0);
    const price = Number(inputs[1]?.value||0);
    total += qty * price;
  });
  const el = document.getElementById('oorTotalDisplay');
  if (el) el.textContent = _originFmt(total);
}

function saveOriginOrder(id) {
  const clientSelect = document.getElementById('oorClient');
  const clientId     = clientSelect?.value||'';
  const clientName   = clientSelect?.options[clientSelect.selectedIndex]?.text||'';
  if (!clientId) { showNotification('Select a client','error'); return; }

  // Collect items
  const rows = document.querySelectorAll('#oorItemRows > div');
  const items = [];
  rows.forEach(row => {
    const textInput = row.querySelector('input[type="text"]');
    const numInputs = row.querySelectorAll('input[type="number"]');
    const productName = textInput?.value.trim()||'';
    const qty   = Number(numInputs[0]?.value||0);
    const price = Number(numInputs[1]?.value||0);
    if (productName && qty > 0) items.push({ productName, qty, pricePerUnit:price, total:qty*price });
  });
  if (!items.length) { showNotification('Add at least one item','error'); return; }

  const existing = id ? (APP_STATE.originOrders||[]).find(o=>o.id===id) : null;
  const now = new Date().toISOString();

  const order = {
    id:           existing?.id||generateId(),
    orderNumber:  sanitizeText(document.getElementById('oorOrderNum')?.value||generateOriginOrderNumber()),
    clientId, clientName,
    status:         document.getElementById('oorStatus')?.value||'Draft',
    deliveryDate:   document.getElementById('oorDeliveryDate')?.value||'',
    paymentStatus:  document.getElementById('oorPaymentStatus')?.value||'Unpaid',
    items,
    notes:          document.getElementById('oorNotes')?.value||'',
    createdAt:      existing?.createdAt||now,
    updatedAt:      now,
  };

  if (!APP_STATE.originOrders) APP_STATE.originOrders = [];
  if (existing) {
    const idx = APP_STATE.originOrders.findIndex(o=>o.id===id);
    APP_STATE.originOrders[idx] = order;
    showNotification('Order updated','success');
  } else {
    APP_STATE.originOrders.push(order);
    showNotification(`Order ${order.orderNumber} created`,'success');
  }
  persistState(); closeModal('originOrderModal'); renderOriginOrders();
}

/* ══════════════════════════════════════════════════════
   TRACEABILITY
══════════════════════════════════════════════════════ */
function renderOriginTrace() {
  const container = document.getElementById('originSubContent');
  if (!container) return;

  container.innerHTML = `
    <div style="max-width:640px;margin:0 auto;">
      <div style="margin-bottom:24px;">
        <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px;line-height:1.6;">
          Search by lot number, batch number, or order number to view the full traceability chain.
        </div>
        <div style="display:flex;gap:8px;">
          <input id="originTraceSearch" type="text"
            placeholder="LOT-2026-001 · BATCH-2026-001 · ORG-26-0001"
            style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-md);
              font-size:13px;font-family:var(--font-main);outline:none;" />
          <button class="btn" type="button" onclick="runOriginTrace()">Trace</button>
        </div>
      </div>
      <div id="originTraceResult"></div>
    </div>`;
}

function runOriginTrace() {
  const query  = (document.getElementById('originTraceSearch')?.value||'').trim().toUpperCase();
  const result = document.getElementById('originTraceResult');
  if (!result || !query) return;

  const lots    = APP_STATE.originLots    || [];
  const batches = APP_STATE.originBatches || [];
  const orders  = APP_STATE.originOrders  || [];

  // Find matching entity
  const lot    = lots.find(l => l.lotNumber?.toUpperCase()===query || l.id===query);
  const batch  = batches.find(b => b.batchNumber?.toUpperCase()===query || b.id===query);
  const order  = orders.find(o => o.orderNumber?.toUpperCase()===query || o.id===query);

  if (!lot && !batch && !order) {
    result.innerHTML = `<div style="padding:24px;border:1.5px dashed var(--border);border-radius:var(--radius-lg);text-align:center;color:var(--gray-400);">No records found for "${escapeHtml(query)}"</div>`;
    return;
  }

  let html = '';

  // If lot found — show lot + all batches using it + all orders from those batches
  if (lot) {
    const relatedBatches = batches.filter(b=>(b.sourceLots||[]).some(sl=>sl.lotId===lot.id));
    const relatedOrderIds = new Set();
    relatedBatches.forEach(b => {
      orders.forEach(o => {
        if ((o.items||[]).some(i=>i.batchId===b.id)) relatedOrderIds.add(o.id);
      });
    });

    html = `
      ${_traceBlock('Lot', `${lot.lotNumber} — ${lot.productName}`, [
        ['Origin', lot.origin||'—'],
        ['Farmer / Supplier', lot.farmer||'—'],
        ['Purchase Date', _originDate(lot.purchaseDate)],
        ['Harvest Date', _originDate(lot.harvestDate)],
        ['Qty Purchased', `${lot.qtyPurchased} ${lot.unit||'kg'}`],
        ['Remaining', `${lot.qtyRemaining} ${lot.unit||'kg'}`],
        ['Processing Method', lot.processingMethod||'—'],
        ['Status', lot.status],
      ])}
      ${relatedBatches.length ? relatedBatches.map(b => `
        ${_traceBlock('Batch', `${b.batchNumber} — ${b.type}`, [
          ['Date', _originDate(b.date)],
          ['Input', `${b.inputQty} ${b.unit||'kg'}`],
          ['Output', `${b.outputQty} ${b.outputUnit||b.unit||'kg'}`],
          ['Yield', b.inputQty>0?_originPct((b.outputQty/b.inputQty)*100):'—'],
          ['Operator', b.operator||'—'],
          ['Status', b.status],
        ])}`).join('') : ''}`;
  }

  // If batch found — show source lots + batch + orders
  if (batch) {
    const sourceLotDetails = (batch.sourceLots||[]).map(sl => {
      const l = lots.find(x=>x.id===sl.lotId);
      return l ? `${l.lotNumber} (${sl.qtyUsed} ${l.unit||'kg'} — ${l.origin||'Unknown'}, ${l.farmer||'Unknown'})` : sl.lotNumber;
    });
    html += `
      ${_traceBlock('Batch', `${batch.batchNumber} — ${batch.type}`, [
        ['Source Lots', sourceLotDetails.join(' · ')||'—'],
        ['Input', `${batch.inputQty} ${batch.unit||'kg'}`],
        ['Output', `${batch.outputQty} ${batch.outputUnit||batch.unit||'kg'}`],
        ['Yield', batch.inputQty>0?_originPct((batch.outputQty/batch.inputQty)*100):'—'],
        ['Date', _originDate(batch.date)],
        ['Operator', batch.operator||'—'],
        ['Status', batch.status],
      ])}`;
  }

  // If order found — show order + batch + lot chain
  if (order) {
    html += `
      ${_traceBlock('Order', `${order.orderNumber} — ${order.clientName}`, [
        ['Delivery Date', _originDate(order.deliveryDate)],
        ['Status', order.status],
        ['Payment', order.paymentStatus||'—'],
        ['Items', (order.items||[]).map(i=>`${i.productName} × ${i.qty}`).join(', ')||'—'],
        ['Total', _originFmt((order.items||[]).reduce((s,i)=>s+Number(i.total||0),0))],
      ])}`;
  }

  result.innerHTML = html || `<div style="color:var(--gray-400);">No trace data available.</div>`;
}

function _traceBlock(type, title, fields) {
  const colors = { Lot:'#16a34a', Batch:'#2563eb', Order:'#7c3aed' };
  return `
    <div style="border:1.5px solid var(--border);border-radius:var(--radius-lg);
      overflow:hidden;margin-bottom:12px;">
      <div style="padding:12px 16px;background:var(--gray-900);display:flex;align-items:center;gap:10px;">
        <span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
          padding:2px 8px;border-radius:999px;background:${colors[type]||'#374151'};color:#fff;">${type}</span>
        <span style="font-size:13px;font-weight:700;color:var(--white);">${escapeHtml(title)}</span>
      </div>
      <div style="padding:14px 16px;display:grid;grid-template-columns:160px 1fr;gap:8px;">
        ${fields.map(([k,v])=>`
          <div style="font-size:11px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(k)}</div>
          <div style="font-size:12px;font-weight:600;">${escapeHtml(String(v||'—'))}</div>`).join('')}
      </div>
    </div>`;
}

// Quick trace helpers called from lots/batches tables
function viewOriginLotTrace(id) {
  const lot = (APP_STATE.originLots||[]).find(l=>l.id===id);
  if (!lot) return;
  switchOriginTab('trace');
  setTimeout(() => {
    const input = document.getElementById('originTraceSearch');
    if (input) { input.value = lot.lotNumber; runOriginTrace(); }
  }, 50);
}

function viewOriginBatchTrace(id) {
  const batch = (APP_STATE.originBatches||[]).find(b=>b.id===id);
  if (!batch) return;
  switchOriginTab('trace');
  setTimeout(() => {
    const input = document.getElementById('originTraceSearch');
    if (input) { input.value = batch.batchNumber; runOriginTrace(); }
  }, 50);
}

function viewOriginOrderTrace(id) {
  const order = (APP_STATE.originOrders||[]).find(o=>o.id===id);
  if (!order) return;
  switchOriginTab('trace');
  setTimeout(() => {
    const input = document.getElementById('originTraceSearch');
    if (input) { input.value = order.orderNumber; runOriginTrace(); }
  }, 50);
}

/* ══════════════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════════════ */
window.renderOriginView          = renderOriginView;
window.renderOriginDashboard     = renderOriginDashboard;
window.switchOriginTab           = switchOriginTab;
window.renderOriginLots          = renderOriginLots;
window._renderOriginLotsBody     = _renderOriginLotsBody;
window.openOriginLotModal        = openOriginLotModal;
window.saveOriginLot             = saveOriginLot;
window.renderOriginBatches       = renderOriginBatches;
window._renderOriginBatchesBody  = _renderOriginBatchesBody;
window.openOriginBatchModal      = openOriginBatchModal;
window.saveOriginBatch           = saveOriginBatch;
window._addBatchLotRow           = _addBatchLotRow;
window._updateBatchTypeOptions   = _updateBatchTypeOptions;
window._updateBatchYieldCalc     = _updateBatchYieldCalc;
window.renderOriginProfiles      = renderOriginProfiles;
window.openOriginProfileModal    = openOriginProfileModal;
window.saveOriginProfile         = saveOriginProfile;
window.deleteOriginProfile       = deleteOriginProfile;
window.renderOriginClients       = renderOriginClients;
window.openOriginClientModal     = openOriginClientModal;
window.saveOriginClient          = saveOriginClient;
window.deleteOriginClient        = deleteOriginClient;
window.renderOriginOrders        = renderOriginOrders;
window._renderOriginOrdersBody   = _renderOriginOrdersBody;
window.openOriginOrderModal      = openOriginOrderModal;
window.saveOriginOrder           = saveOriginOrder;
window._addOrderItemRow          = _addOrderItemRow;
window._recalcOrderTotal         = _recalcOrderTotal;
window.renderOriginTrace         = renderOriginTrace;
window.runOriginTrace            = runOriginTrace;
window.viewOriginLotTrace        = viewOriginLotTrace;
window.viewOriginBatchTrace      = viewOriginBatchTrace;
window.viewOriginOrderTrace      = viewOriginOrderTrace;
