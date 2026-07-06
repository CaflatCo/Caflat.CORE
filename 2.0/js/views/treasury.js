/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — VIEW · TREASURY   (real cash/bank accounts, real ledger)
═══════════════════════════════════════════════════════════════ */
VIEWS.treasury = function (root) {
  let accounts = g2(() => APP_STATE.treasuryAccounts || [], []);
  let editingAccountId = null;
  let showAccountForm = false;
  let showTxnForm = false;

  root.innerHTML = `
    <div class="sec-head"><div><span class="eyebrow">Treasury · real ledger</span><h2 style="margin-top:4px">Treasury</h2>
      <p class="muted" style="margin-top:6px">Cash and bank, tracked by hand — separate from inventory. Balances are always computed live.</p></div>
      <div class="row gap2"><button class="btn btn-ghost" id="txAddAccount">Add account</button><button class="btn" id="txAddTxn">Add transaction</button></div></div>

    <div class="card-ink card pad" style="border-radius:var(--r-xl);margin-bottom:var(--s6)">
      <span class="eyebrow">Total balance</span>
      <div class="val num" style="font-family:var(--serif);font-weight:900;font-size:2.4rem;margin-top:var(--s2)" id="txTotal">${formatCurrency(0)}</div>
    </div>

    <div class="card pad" id="accForm" style="border-radius:var(--r-xl);margin-bottom:var(--s5);display:none">
      <span class="eyebrow" id="accFormTitle">New account</span>
      <div class="row gap3 wrap" style="margin:var(--s3) 0">
        <input id="accName" class="field" placeholder="e.g. Cash Till, BDO Checking" style="flex:1;min-width:180px">
        <select id="accType" class="field"><option value="cash">Cash</option><option value="bank">Bank</option></select>
        <input id="accOpening" type="number" step="0.01" min="0" class="field" placeholder="Opening balance" style="width:160px">
      </div>
      <div class="row gap2"><button class="btn btn-sm" id="accSave">Save</button><button class="btn btn-ghost btn-sm" id="accCancel">Cancel</button></div>
    </div>

    <div class="card pad" id="txnForm" style="border-radius:var(--r-xl);margin-bottom:var(--s6);display:none">
      <span class="eyebrow">New transaction</span>
      <div class="row gap3 wrap" style="margin:var(--s3) 0">
        <select id="txnAccount" class="field" style="min-width:160px">${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}</select>
        <select id="txnKind" class="field"><option value="add">Add money</option><option value="deduct">Deduct money</option></select>
        <input id="txnAmount" type="number" step="0.01" min="0" class="field" placeholder="Amount" style="width:140px">
        <input id="txnReason" class="field" placeholder="Reason" style="flex:1;min-width:160px">
        <input id="txnDate" type="date" class="field" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="row gap2"><button class="btn btn-sm" id="txnSave">Save</button><button class="btn btn-ghost btn-sm" id="txnCancel">Cancel</button></div>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));margin-bottom:var(--s6)" id="acctGrid"></div>

    <span class="eyebrow">Recent transactions</span>
    <div class="stack gap2" id="txnList" style="margin-top:var(--s3)"></div>`;

  const accForm = root.querySelector('#accForm'), txnForm = root.querySelector('#txnForm');

  function openAccForm(acc) {
    editingAccountId = acc ? acc.id : null;
    root.querySelector('#accFormTitle').textContent = acc ? `Edit ${acc.name}` : 'New account';
    root.querySelector('#accName').value = acc?.name || '';
    root.querySelector('#accType').value = acc?.type || 'cash';
    root.querySelector('#accOpening').value = acc?.openingBalance ?? '';
    showAccountForm = true; accForm.style.display = 'block'; root.querySelector('#accName').focus();
  }
  function closeAccForm() { showAccountForm = false; accForm.style.display = 'none'; editingAccountId = null; }

  root.querySelector('#txAddAccount').addEventListener('click', () => openAccForm(null));
  root.querySelector('#accCancel').addEventListener('click', closeAccForm);
  root.querySelector('#accSave').addEventListener('click', () => {
    const result = ENGINE.saveTreasuryAccount({
      id: editingAccountId, name: sanitizeText(root.querySelector('#accName').value),
      type: root.querySelector('#accType').value, openingBalance: root.querySelector('#accOpening').value,
    });
    if (!result.ok) { M.toast('Could not save account', result.error, 'crit'); return; }
    M.toast('Account saved', '', 'success');
    closeAccForm();
    accounts = g2(() => APP_STATE.treasuryAccounts || [], []);
    paint();
  });

  root.querySelector('#txAddTxn').addEventListener('click', () => {
    if (!accounts.length) { M.toast('Add an account first', '', 'warn'); return; }
    showTxnForm = true; txnForm.style.display = 'block';
  });
  root.querySelector('#txnCancel').addEventListener('click', () => { showTxnForm = false; txnForm.style.display = 'none'; });
  root.querySelector('#txnSave').addEventListener('click', () => {
    const result = ENGINE.saveTreasuryTransaction({
      accountId: root.querySelector('#txnAccount').value, kind: root.querySelector('#txnKind').value,
      amount: root.querySelector('#txnAmount').value, reason: sanitizeText(root.querySelector('#txnReason').value),
      date: root.querySelector('#txnDate').value,
    });
    if (!result.ok) { M.toast('Could not save', result.error, 'crit'); return; }
    M.toast(result.txn.kind === 'add' ? 'Money added' : 'Money deducted', formatCurrency(result.txn.amount), 'success');
    showTxnForm = false; txnForm.style.display = 'none';
    paint();
  });

  function paint() {
    const total = g2(() => getTreasuryTotalBalance(), 0);
    root.querySelector('#txTotal').textContent = formatCurrency(total);
    root.querySelector('#txnAccount').innerHTML = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');

    const acctGrid = root.querySelector('#acctGrid');
    acctGrid.innerHTML = accounts.length ? accounts.map((a, i) => {
      const bal = g2(() => getTreasuryAccountBalance(a.id), Number(a.openingBalance || 0));
      return `<div class="card pad lift" style="border-radius:var(--r-lg);--i:${i}">
        <div class="row between"><span class="name" style="font-weight:640">${escapeHtml(a.name)}</span>
          <span class="chip" style="height:20px;font-size:9px"><span class="dot"></span>${a.type === 'bank' ? 'Bank' : 'Cash'}</span></div>
        <div class="num serif" style="font-size:1.7rem;font-weight:900;letter-spacing:-0.03em;margin:var(--s3) 0">${formatCurrency(bal)}</div>
        <div class="row gap2"><button class="btn btn-ghost btn-sm" data-edit-acc="${a.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-del-acc="${a.id}" style="color:var(--crit)">Delete</button></div>
      </div>`;
    }).join('') : `<div class="card pad" style="grid-column:1/-1;text-align:center;color:var(--ink-4);padding:var(--s6) 0">No accounts yet.</div>`;
    acctGrid.querySelectorAll('[data-edit-acc]').forEach(b => b.addEventListener('click', () => openAccForm(accounts.find(a => a.id === b.dataset.editAcc))));
    acctGrid.querySelectorAll('[data-del-acc]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteTreasuryAccount === 'function') deleteTreasuryAccount(b.dataset.delAcc);
      accounts = g2(() => APP_STATE.treasuryAccounts || [], []);
      paint();
    }));

    const txns = g2(() => (APP_STATE.treasuryTransactions || []).slice().reverse(), []);
    const txnList = root.querySelector('#txnList');
    txnList.innerHTML = txns.length ? txns.slice(0, 50).map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      return `<div class="lrow" style="padding:10px 0">
        <span class="pico">${t.kind === 'add' ? ICON.up : ICON.down}</span>
        <div class="grow"><div class="name">${escapeHtml(t.reason)}</div>
          <div class="sub">${escapeHtml(acc?.name || 'Unknown account')} · ${t.date}</div></div>
        <span class="num" style="font-weight:700;color:${t.kind === 'add' ? 'var(--live)' : 'var(--crit)'}">${t.kind === 'add' ? '+' : '−'}${formatCurrency(t.amount)}</span>
        <button class="icon-btn" style="width:30px;height:30px;margin-left:var(--s2)" data-del-txn="${t.id}">×</button>
      </div>`;
    }).join('') : `<div class="card pad" style="text-align:center;color:var(--ink-4);padding:var(--s6) 0">No transactions yet.</div>`;
    txnList.querySelectorAll('[data-del-txn]').forEach(b => b.addEventListener('click', () => {
      if (typeof deleteTreasuryTransaction === 'function') deleteTreasuryTransaction(b.dataset.delTxn);
      paint();
    }));
  }
  paint();
};
