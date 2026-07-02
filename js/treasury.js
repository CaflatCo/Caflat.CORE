/* ═══════════════════════════════════════════════════════
   TREASURY.JS — Manual cash/bank tracker
   Fully disconnected from inventory/ingredients/COGS.
   Every entry is an Add (money in) or Deduct (money out)
   against an account. Balances are always computed live —
   never stored — so there is nothing to reconcile.
═══════════════════════════════════════════════════════ */

/* ── Icons — custom line-art, matches the app's monochrome nav-icon system ── */

function _treasuryVaultIcon(size = 56) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gray-300);">
    <rect x="8" y="6" width="48" height="52" rx="6"/>
    <circle cx="28" cy="32" r="11"/>
    <line x1="28" y1="24.5" x2="28" y2="27"/>
    <line x1="34.3" y1="28.3" x2="32.4" y2="29.6"/>
    <line x1="34.3" y1="35.7" x2="32.4" y2="34.4"/>
    <line x1="21.7" y1="28.3" x2="23.6" y2="29.6"/>
    <line x1="21.7" y1="35.7" x2="23.6" y2="34.4"/>
    <circle cx="28" cy="32" r="2" fill="currentColor" stroke="none"/>
    <path d="M43 27h5.5a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H43" stroke-linejoin="round"/>
    <circle cx="15" cy="14" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="49" cy="14" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="50" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="49" cy="50" r="1.6" fill="currentColor" stroke="none"/>
  </svg>`;
}

function _treasuryAccountIcon(type, size = 16) {
  const common = `width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"`;
  if (type === 'cash') {
    return `<svg ${common}>
      <rect x="1.5" y="4" width="13" height="8" rx="1.25"/>
      <circle cx="8" cy="8" r="2"/>
      <line x1="3.25" y1="6" x2="3.25" y2="6"/>
      <line x1="12.75" y1="10" x2="12.75" y2="10"/>
    </svg>`;
  }
  // bank / fallback — matches the Treasury nav icon glyph
  return `<svg ${common}>
    <rect x="1.5" y="4" width="13" height="9" rx="1.5"/>
    <circle cx="8" cy="8.5" r="2.25"/>
    <line x1="4" y1="4" x2="4" y2="1.75"/>
    <line x1="12" y1="4" x2="12" y2="1.75"/>
  </svg>`;
}

const TREASURY_REASON_PRESETS = ['Rent', 'Payroll', 'Supplies', 'Utilities', 'Owner Deposit', 'Sales Deposit', 'Bank Fee'];

/* ── Balance helpers ── */

function getTreasuryAccountBalance(accountId) {
  const account = (APP_STATE.treasuryAccounts || []).find(a => a.id === accountId);
  if (!account) return 0;
  const txns = (APP_STATE.treasuryTransactions || []).filter(t => t.accountId === accountId);
  const net = txns.reduce((sum, t) => sum + (t.kind === 'add' ? t.amount : -t.amount), 0);
  return safeNumber(account.openingBalance) + net;
}

function getTreasuryTotalBalance() {
  return (APP_STATE.treasuryAccounts || [])
    .reduce((sum, a) => sum + getTreasuryAccountBalance(a.id), 0);
}

/* ── Main view ── */

function renderTreasuryView() {
  const container = document.getElementById('treasuryContent');
  if (!container) return;

  const accounts = APP_STATE.treasuryAccounts || [];

  if (!accounts.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:64px 24px;">
        <div style="margin-bottom:16px;">${_treasuryVaultIcon(56)}</div>
        <div style="font-size:16px;font-weight:800;margin-bottom:6px;">Add your first account</div>
        <div style="font-size:13px;color:var(--gray-500);margin-bottom:20px;max-width:360px;margin-left:auto;margin-right:auto;">
          Track your cash on hand and bank balances here. Fully manual, fully disconnected from inventory.
        </div>
        <button class="btn" type="button" onclick="openTreasuryAccountsModal()">+ Add Account</button>
      </div>`;
    return;
  }

  const total = getTreasuryTotalBalance();
  const txns  = [...(APP_STATE.treasuryTransactions || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt||'').localeCompare(a.createdAt||''));

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card dark">
        <div class="label">Total Balance</div>
        <div class="value">${formatCurrency(total)}</div>
        <div class="sub">${accounts.length} account${accounts.length!==1?'s':''}</div>
      </div>
      ${accounts.map(a => `
        <div class="stat-card">
          <div class="label">${_treasuryAccountIcon(a.type, 14)} ${escapeHtml(a.name)}</div>
          <div class="value">${formatCurrency(getTreasuryAccountBalance(a.id))}</div>
          <div class="sub">${a.type === 'bank' ? 'Bank' : 'Cash'}</div>
        </div>`).join('')}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div style="font-size:12px;color:var(--gray-500);">${txns.length} transaction${txns.length!==1?'s':''}</div>
      <div class="flex-wrap-row">
        <button class="btn btn-secondary" type="button" onclick="openTreasuryAccountsModal()">Manage Accounts</button>
        <button class="btn" type="button" onclick="openTreasuryTxnModal(null)">+ New Transaction</button>
      </div>
    </div>

    <div class="table-wrapper">
      <table style="table-layout:fixed;">
        <thead>
          <tr>
            <th style="width:14%;">Date</th>
            <th style="width:22%;">Account</th>
            <th style="width:36%;">Reason</th>
            <th style="width:16%;text-align:right;">Amount</th>
            <th style="width:12%;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${txns.length ? txns.map(t => {
            const account = accounts.find(a => a.id === t.accountId);
            const isAdd = t.kind === 'add';
            return `<tr>
              <td style="font-size:12px;color:var(--gray-500);">${_treasuryFormatDate(t.date)}</td>
              <td style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(account ? account.name : '—')}</td>
              <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.reason || '—')}</td>
              <td style="text-align:right;font-weight:800;color:${isAdd ? 'var(--success)' : 'var(--danger)'};">
                ${isAdd ? '+' : '−'}${formatCurrency(t.amount)}
              </td>
              <td><button class="btn btn-sm" type="button" onclick="openTreasuryTxnModal('${t.id}')">Edit</button></td>
            </tr>`;
          }).join('') :
          `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--gray-400);">No transactions yet</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function _treasuryFormatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr || '—';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── New / Edit Transaction modal ── */

function openTreasuryTxnModal(id) {
  const accounts = APP_STATE.treasuryAccounts || [];
  if (!accounts.length) {
    showNotification('Add an account first', 'error');
    openTreasuryAccountsModal();
    return;
  }

  const t = id ? (APP_STATE.treasuryTransactions || []).find(x => x.id === id) : null;
  const isNew = !t;
  let m = document.getElementById('treasuryTxnModal');
  if (!m) { m = document.createElement('div'); m.id = 'treasuryTxnModal'; m.className = 'modal-overlay'; document.body.appendChild(m); }

  const kind = t?.kind || 'add';
  const today = new Date().toISOString().slice(0, 10);
  const selectedAccountId = t?.accountId || accounts[0].id;

  m.innerHTML = `
    <div class="modal ttx-modal is-${kind}" style="max-width:440px;">
      <h3>${isNew ? 'New Transaction' : 'Edit Transaction'}</h3>

      <div class="ttx-kind-toggle">
        <button type="button" id="ttxKindAdd" class="ttx-kind-btn is-add${kind==='add'?' active':''}"
          onclick="_treasurySetTxnKind('add')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="13" x2="8" y2="3"/><polyline points="3.5,7.5 8,3 12.5,7.5"/></svg>
          Add Money
        </button>
        <button type="button" id="ttxKindDeduct" class="ttx-kind-btn is-deduct${kind==='deduct'?' active':''}"
          onclick="_treasurySetTxnKind('deduct')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="3" x2="8" y2="13"/><polyline points="3.5,8.5 8,13 12.5,8.5"/></svg>
          Deduct Money
        </button>
      </div>
      <input type="hidden" id="ttxKind" value="${kind}" />

      <div class="ttx-amount-hero">
        <span class="ttx-amount-currency">₱</span>
        <input id="ttxAmount" type="number" min="0" step="0.01" value="${t?.amount ?? ''}" placeholder="0.00" inputmode="decimal" />
      </div>

      <div class="form-group">
        <label>Account</label>
        <div class="ttx-chip-row" id="ttxAccountChips">
          ${accounts.map(a => `
            <button type="button" class="ttx-chip${a.id===selectedAccountId?' active':''}"
              onclick="_treasurySetTxnAccount('${a.id}')">
              ${_treasuryAccountIcon(a.type, 14)} <span>${escapeHtml(a.name)}</span>
            </button>`).join('')}
        </div>
        <input type="hidden" id="ttxAccount" value="${selectedAccountId}" />
      </div>

      <div class="form-group">
        <label>What was it for?</label>
        <div class="ttx-chip-row ttx-chip-row-sm">
          ${TREASURY_REASON_PRESETS.map(r => `<button type="button" class="ttx-suggest-chip" onclick="_treasurySetReason('${r}')">${r}</button>`).join('')}
        </div>
        <input id="ttxReason" type="text" value="${escapeHtml(t?.reason||'')}" placeholder="e.g. Rent payment, Owner deposit" style="margin-top:8px;" />
      </div>

      <div class="form-group">
        <label>Date</label>
        <div style="display:flex;gap:8px;">
          <input id="ttxDate" type="date" value="${t?.date || today}" style="flex:1;" />
          <button type="button" class="btn btn-secondary btn-sm" onclick="_treasurySetToday()">Today</button>
        </div>
      </div>

      <div class="modal-actions">
        ${!isNew ? `<button class="btn btn-secondary" type="button" style="color:var(--danger);"
          onclick="deleteTreasuryTransaction('${id}')">Delete</button>` : ''}
        <button class="btn btn-secondary" type="button" onclick="closeModal('treasuryTxnModal')">Cancel</button>
        <button class="btn ttx-save-btn is-${kind}" id="ttxSaveBtn" type="button" onclick="saveTreasuryTransaction('${id||''}')">
          ${isNew ? 'Save Transaction' : 'Save'}</button>
      </div>
    </div>`;

  openModal('treasuryTxnModal');
}

function _treasurySetTxnKind(kind) {
  const hidden = document.getElementById('ttxKind');
  if (hidden) hidden.value = kind;
  const addBtn    = document.getElementById('ttxKindAdd');
  const deductBtn = document.getElementById('ttxKindDeduct');
  if (addBtn)    addBtn.classList.toggle('active', kind === 'add');
  if (deductBtn) deductBtn.classList.toggle('active', kind === 'deduct');

  const modalRoot = document.querySelector('#treasuryTxnModal .ttx-modal');
  if (modalRoot) { modalRoot.classList.remove('is-add', 'is-deduct'); modalRoot.classList.add('is-' + kind); }
  const saveBtn = document.getElementById('ttxSaveBtn');
  if (saveBtn) { saveBtn.classList.remove('is-add', 'is-deduct'); saveBtn.classList.add('is-' + kind); }
}

function _treasurySetTxnAccount(accountId) {
  const hidden = document.getElementById('ttxAccount');
  if (hidden) hidden.value = accountId;
  document.querySelectorAll('#ttxAccountChips .ttx-chip').forEach(chip => {
    chip.classList.toggle('active', chip.getAttribute('onclick') === `_treasurySetTxnAccount('${accountId}')`);
  });
}

function _treasurySetReason(reason) {
  const input = document.getElementById('ttxReason');
  if (input) input.value = reason;
}

function _treasurySetToday() {
  const input = document.getElementById('ttxDate');
  if (input) input.value = new Date().toISOString().slice(0, 10);
}

function saveTreasuryTransaction(id) {
  const kind      = document.getElementById('ttxKind')?.value === 'deduct' ? 'deduct' : 'add';
  const accountId = document.getElementById('ttxAccount')?.value || '';
  const amount    = safeNumber(document.getElementById('ttxAmount')?.value);
  const reason    = sanitizeText(document.getElementById('ttxReason')?.value || '');
  const date      = document.getElementById('ttxDate')?.value || new Date().toISOString().slice(0, 10);

  if (!accountId) { showNotification('Select an account', 'error'); return; }
  if (!amount || amount <= 0) { showNotification('Enter an amount greater than 0', 'error'); return; }
  if (!reason) { showNotification('Add a reason for this transaction', 'error'); return; }

  const existing = id ? (APP_STATE.treasuryTransactions || []).find(t => t.id === id) : null;
  const now = new Date().toISOString();
  const txn = {
    id: existing?.id || generateId(),
    accountId, kind, amount, reason, date,
    createdAt: existing?.createdAt || now
  };

  if (!APP_STATE.treasuryTransactions) APP_STATE.treasuryTransactions = [];
  if (existing) {
    const i = APP_STATE.treasuryTransactions.findIndex(t => t.id === id);
    APP_STATE.treasuryTransactions[i] = txn;
    showNotification('Transaction updated', 'success');
  } else {
    APP_STATE.treasuryTransactions.push(txn);
    showNotification(kind === 'add' ? 'Money added' : 'Money deducted', 'success');
  }

  persistState();
  closeModal('treasuryTxnModal');
  renderTreasuryView();
}

function deleteTreasuryTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  APP_STATE.treasuryTransactions = (APP_STATE.treasuryTransactions || []).filter(t => t.id !== id);
  persistState();
  closeModal('treasuryTxnModal');
  showNotification('Transaction deleted', 'success');
  renderTreasuryView();
}

/* ── Manage Accounts modal ── */

function openTreasuryAccountsModal() {
  let m = document.getElementById('treasuryAccountsModal');
  if (!m) { m = document.createElement('div'); m.id = 'treasuryAccountsModal'; m.className = 'modal-overlay'; document.body.appendChild(m); }
  _renderTreasuryAccountsModal();
  openModal('treasuryAccountsModal');
}

function _renderTreasuryAccountsModal() {
  const m = document.getElementById('treasuryAccountsModal');
  if (!m) return;
  const accounts = APP_STATE.treasuryAccounts || [];

  m.innerHTML = `
    <div class="modal" style="max-width:460px;">
      <h3>Manage Accounts</h3>

      ${accounts.length ? `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
          ${accounts.map(a => `
            <div style="display:flex;align-items:center;justify-content:space-between;
              padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-lg);">
              <div>
                <div style="font-size:13px;font-weight:700;">${_treasuryAccountIcon(a.type, 14)} ${escapeHtml(a.name)}</div>
                <div style="font-size:11px;color:var(--gray-400);">${formatCurrency(getTreasuryAccountBalance(a.id))} · ${a.type === 'bank' ? 'Bank' : 'Cash'}</div>
              </div>
              <button class="btn btn-sm btn-secondary" type="button" style="color:var(--danger);"
                onclick="deleteTreasuryAccount('${a.id}')">Delete</button>
            </div>`).join('')}
        </div>` : `<div style="font-size:12px;color:var(--gray-400);margin-bottom:16px;">No accounts yet.</div>`}

      <div style="padding-top:16px;border-top:1px solid var(--border);">
        <div style="font-size:12px;font-weight:800;margin-bottom:10px;">Add Account</div>
        <div class="form-group"><label>Name</label>
          <input id="tacName" type="text" placeholder="e.g. Cash Till, BDO Checking" /></div>
        <div class="form-group"><label>Type</label>
          <select id="tacType">
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <div class="form-group"><label>Opening Balance</label>
          <input id="tacOpeningBalance" type="number" min="0" step="0.01" placeholder="0.00" /></div>
        <button class="btn" type="button" style="width:100%;" onclick="saveTreasuryAccount()">+ Add Account</button>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" onclick="closeModal('treasuryAccountsModal')">Close</button>
      </div>
    </div>`;
}

function saveTreasuryAccount() {
  const name = sanitizeText(document.getElementById('tacName')?.value || '');
  const type = document.getElementById('tacType')?.value === 'bank' ? 'bank' : 'cash';
  const openingBalance = safeNumber(document.getElementById('tacOpeningBalance')?.value);

  if (!name) { showNotification('Account name required', 'error'); return; }

  if (!APP_STATE.treasuryAccounts) APP_STATE.treasuryAccounts = [];
  APP_STATE.treasuryAccounts.push({
    id: generateId(), name, type, openingBalance,
    createdAt: new Date().toISOString()
  });

  persistState();
  showNotification('Account added', 'success');
  _renderTreasuryAccountsModal();
  renderTreasuryView();
}

function deleteTreasuryAccount(id) {
  const txnCount = (APP_STATE.treasuryTransactions || []).filter(t => t.accountId === id).length;
  const msg = txnCount
    ? `Delete this account and its ${txnCount} transaction${txnCount!==1?'s':''}? This cannot be undone.`
    : 'Delete this account?';
  if (!confirm(msg)) return;

  APP_STATE.treasuryAccounts = (APP_STATE.treasuryAccounts || []).filter(a => a.id !== id);
  APP_STATE.treasuryTransactions = (APP_STATE.treasuryTransactions || []).filter(t => t.accountId !== id);

  persistState();
  showNotification('Account deleted', 'success');
  _renderTreasuryAccountsModal();
  renderTreasuryView();
}

/* ── Mode toggle ── */

function applyTreasuryModeToggle() {
  const enabled = APP_STATE.settings?.treasuryModeEnabled === true;
  const navBtn  = document.getElementById('navTreasury');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';
  if (typeof updateOpsNavGroup === 'function') updateOpsNavGroup();
  if (!enabled && APP_STATE.ui?.currentView === 'treasury') {
    if (typeof switchPage === 'function') switchPage('pos');
  }
}

/* ── Exports ── */

window.getTreasuryAccountBalance   = getTreasuryAccountBalance;
window.getTreasuryTotalBalance     = getTreasuryTotalBalance;
window.renderTreasuryView          = renderTreasuryView;
window.openTreasuryTxnModal        = openTreasuryTxnModal;
window.saveTreasuryTransaction     = saveTreasuryTransaction;
window.deleteTreasuryTransaction   = deleteTreasuryTransaction;
window.openTreasuryAccountsModal   = openTreasuryAccountsModal;
window.saveTreasuryAccount         = saveTreasuryAccount;
window.deleteTreasuryAccount       = deleteTreasuryAccount;
window._treasurySetTxnKind         = _treasurySetTxnKind;
window._treasurySetTxnAccount      = _treasurySetTxnAccount;
window._treasurySetReason          = _treasurySetReason;
window._treasurySetToday           = _treasurySetToday;
window.applyTreasuryModeToggle     = applyTreasuryModeToggle;
