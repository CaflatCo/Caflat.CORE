/* ═══════════════════════════════════════════════════════
   INTEGRITY.JS — Transaction Immutability Layer
   Injectable. Self-contained. No external dependencies.

   Every completed transaction gets a SHA-256-based
   fingerprint. Any tampering makes verification fail.
   Audit log records every check.

   Usage:
     sealTransaction(transaction)   → adds .integrity field
     verifyTransaction(transaction) → returns { valid, reason }
     verifyAllTransactions()        → full sweep report
═══════════════════════════════════════════════════════ */

/* ── Canonical string — deterministic field order ── */
function _buildCanonicalString(transaction) {
  return JSON.stringify({
    id:            transaction.id,
    receiptNumber: transaction.receiptNumber,
    orderType:     transaction.orderType || '',
    items: (transaction.items || []).map(i => ({
      productId: i.productId,
      name:      i.name,
      quantity:  i.quantity,
      price:     i.price,
      total:     i.total
    })),
    totals: {
      subtotal: transaction.totals?.subtotal ?? transaction.subtotal ?? 0,
      discount: transaction.totals?.discount ?? transaction.discount ?? 0,
      tax:      transaction.totals?.tax      ?? transaction.tax      ?? 0,
      total:    transaction.totals?.total    ?? transaction.total    ?? 0
    },
    createdAt: transaction.audit?.createdAt ?? transaction.createdAt ?? ''
  });
}

/* ── SHA-256 via Web Crypto (async) ── */
async function _sha256(message) {
  const msgBuffer  = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Seal a transaction ── */
async function sealTransaction(transaction) {
  const canonical = _buildCanonicalString(transaction);
  const hash      = await _sha256(canonical);
  transaction.integrity = {
    hash,
    algorithm: 'SHA-256',
    sealedAt:  new Date().toISOString(),
    version:   1
  };
  return transaction;
}

/* ── Verify a single transaction ── */
async function verifyTransaction(transaction) {
  if (!transaction.integrity?.hash) {
    return { valid: false, reason: 'NO_SEAL — transaction was not sealed' };
  }
  const canonical  = _buildCanonicalString(transaction);
  const recomputed = await _sha256(canonical);
  const valid      = recomputed === transaction.integrity.hash;
  return {
    valid,
    reason:   valid ? 'OK' : 'HASH_MISMATCH — transaction data was modified',
    expected: transaction.integrity.hash,
    computed: recomputed,
    receiptNumber: transaction.receiptNumber,
    id: transaction.id
  };
}

/* ── Verify all transactions — full sweep ── */
async function verifyAllTransactions() {
  const sales   = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  const results = await Promise.all(sales.map(verifyTransaction));

  const passed  = results.filter(r => r.valid).length;
  const failed  = results.filter(r => !r.valid);
  const noSeal  = results.filter(r => r.reason?.startsWith('NO_SEAL')).length;
  const tampered= results.filter(r => r.reason?.startsWith('HASH_MISMATCH')).length;

  const report = {
    total:    sales.length,
    passed,
    failed:   failed.length,
    noSeal,
    tampered,
    checkedAt: new Date().toISOString(),
    failures:  failed
  };

  // Push to audit log
  if (typeof pushAuditEntry === 'function') {
    pushAuditEntry({
      action:   'INTEGRITY_CHECK',
      outcome:  tampered > 0 ? 'TAMPERED' : 'CLEAN',
      note:     `${passed}/${sales.length} passed. Tampered: ${tampered}. No seal: ${noSeal}.`,
      report
    });
  }

  return report;
}

/* ── Render integrity report in UI ── */
async function renderIntegrityReport() {
  const container = document.getElementById('integrityReportContainer');
  if (!container) return;

  container.innerHTML = `<div style="color:var(--gray-400);font-size:12px;padding:12px 0;">
    Running integrity check…</div>`;

  const report = await verifyAllTransactions();
  const clean  = report.tampered === 0 && report.noSeal === 0;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
      <div class="stat-card${clean ? '' : ' dark'}">
        <div class="label">Total</div>
        <div class="value" style="font-size:22px;">${report.total}</div>
        <div class="sub">Transactions</div>
      </div>
      <div class="stat-card">
        <div class="label">Passed</div>
        <div class="value" style="font-size:22px;color:#16a34a;">${report.passed}</div>
        <div class="sub">Verified clean</div>
      </div>
      <div class="stat-card">
        <div class="label">No Seal</div>
        <div class="value" style="font-size:22px;${report.noSeal>0?'color:#ea580c;':''}">${report.noSeal}</div>
        <div class="sub">Pre-integrity</div>
      </div>
      <div class="stat-card">
        <div class="label">Tampered</div>
        <div class="value" style="font-size:22px;${report.tampered>0?'color:#dc2626;':''}">${report.tampered}</div>
        <div class="sub">Hash mismatch</div>
      </div>
    </div>
    <div style="padding:12px 14px;border-radius:var(--radius-md);font-size:12px;font-weight:700;
      ${clean
        ? 'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;'
        : 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca;'}">
      ${clean
        ? '✓ All transactions verified — no tampering detected'
        : `⚠ ${report.tampered} tampered transaction(s) detected — see audit log`}
    </div>
    ${report.failures.length ? `
      <div class="section-title" style="margin-top:16px;">Failed Transactions</div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Receipt #</th><th>Reason</th></tr></thead>
          <tbody>
            ${report.failures.map(f => `
              <tr>
                <td style="font-family:var(--font-mono);font-size:11px;">${escapeHtml(f.receiptNumber||f.id||'—')}</td>
                <td style="color:#dc2626;font-size:11px;">${escapeHtml(f.reason)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    <div style="font-size:10px;color:var(--gray-400);margin-top:12px;text-align:right;">
      Checked: ${new Date(report.checkedAt).toLocaleString()}
    </div>`;
}

window.sealTransaction        = sealTransaction;
window.verifyTransaction      = verifyTransaction;
window.verifyAllTransactions  = verifyAllTransactions;
window.renderIntegrityReport  = renderIntegrityReport;
