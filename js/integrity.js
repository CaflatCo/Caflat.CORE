/* ═══════════════════════════════════════════════════════
   INTEGRITY.JS — Complete Transaction Integrity System
   ✓ SHA-256 immutability sealing
   ✓ Transaction timeline (who created/voided/edited)
   ✓ Inventory movement history
   ✓ Daily discrepancy detection
   ✓ Inventory adjustment log
   ✓ Tamper verification with visual report
═══════════════════════════════════════════════════════ */

/* ── Canonical string for hashing ── */
function _buildCanonicalString(transaction) {
  return JSON.stringify({
    id:            transaction.id,
    receiptNumber: transaction.receiptNumber || transaction.orderNumber || '',
    status:        transaction.status,
    orderType:     transaction.orderType || '',
    channel:       transaction.channel   || 'POS',
    items: (transaction.items || []).map(i => ({
      productId: i.productId,
      name:      i.name || i.productName || i.description || '',
      quantity:  i.quantity || i.qty || 0,
      price:     i.price    || i.unitPrice || 0,
      total:     i.total    || 0
    })),
    totals: {
      subtotal: transaction.totals?.subtotal ?? transaction.subtotal ?? 0,
      discount: transaction.totals?.discount ?? transaction.discount ?? 0,
      tax:      transaction.totals?.tax      ?? transaction.tax      ?? 0,
      total:    transaction.totals?.total    ?? transaction.total    ?? 0
    },
    payment: {
      method:   transaction.payment?.method   ?? transaction.paymentMethod ?? '',
      tendered: transaction.payment?.tendered ?? transaction.tendered      ?? 0
    },
    createdAt: transaction.audit?.createdAt ?? transaction.createdAt ?? ''
  });
}

async function _sha256(message) {
  const buf  = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ── Seal ── */
async function sealTransaction(transaction) {
  const canonical = _buildCanonicalString(transaction);
  const hash      = await _sha256(canonical);
  transaction.integrity = {
    hash, algorithm: 'SHA-256',
    sealedAt: new Date().toISOString(), version: 2
  };
  return transaction;
}

/* ── Verify single ── */
async function verifyTransaction(transaction) {
  if (!transaction.integrity?.hash) {
    return { valid: false, reason: 'NO_SEAL', receiptNumber: transaction.receiptNumber, id: transaction.id };
  }
  const canonical  = _buildCanonicalString(transaction);
  const recomputed = await _sha256(canonical);
  const valid      = recomputed === transaction.integrity.hash;
  return {
    valid,
    reason:        valid ? 'OK' : 'HASH_MISMATCH',
    expected:      transaction.integrity.hash,
    computed:      recomputed,
    receiptNumber: transaction.receiptNumber || transaction.orderNumber,
    id:            transaction.id,
    sealedAt:      transaction.integrity.sealedAt
  };
}

/* ── Verify all ── */
async function verifyAllTransactions() {
  const sales   = Array.isArray(APP_STATE.sales) ? APP_STATE.sales : [];
  const results = await Promise.all(sales.map(verifyTransaction));

  const passed  = results.filter(r => r.valid).length;
  const noSeal  = results.filter(r => r.reason === 'NO_SEAL').length;
  const tampered= results.filter(r => r.reason === 'HASH_MISMATCH').length;
  const failed  = results.filter(r => !r.valid);

  const report = {
    total: sales.length, passed, failed: failed.length,
    noSeal, tampered, checkedAt: new Date().toISOString(), failures: failed
  };

  if (typeof pushAuditEntry === 'function') {
    pushAuditEntry({
      action:  'INTEGRITY_CHECK',
      outcome: tampered > 0 ? 'TAMPERED' : 'CLEAN',
      note:    `${passed}/${sales.length} passed. Tampered: ${tampered}. No seal: ${noSeal}.`
    });
  }
  return report;
}

/* ── Transaction Timeline ── */
function buildTransactionTimeline(transaction) {
  const events = [];
  const audit  = transaction.audit || {};

  const createdAt   = audit.createdAt   || transaction.createdAt   || null;
  const completedAt = audit.completedAt || transaction.completedAt || null;

  if (createdAt) {
    events.push({
      timestamp: createdAt,
      action:    'CREATED',
      by:        audit.completedBy || transaction.channel || 'STAFF',
      note:      `${transaction.channel === 'SUPPLY' ? 'Supply order' : 'Sale'} created · ${transaction.orderType || ''}`
    });
  }

  // Only add COMPLETED if it's a different timestamp from CREATED
  if (completedAt && completedAt !== createdAt) {
    events.push({
      timestamp: completedAt,
      action:    'COMPLETED',
      by:        audit.completedBy || 'STAFF',
      note:      `Payment: ${transaction.payment?.method || transaction.paymentMethod || 'cash'} · ${formatCurrency(transaction.totals?.total ?? transaction.total ?? 0)}`
    });
  } else if (completedAt && completedAt === createdAt && (transaction.status||'').toUpperCase() === 'COMPLETED') {
    // Same timestamp — merge into CREATED note
    events[events.length - 1].note += ` · Completed immediately`;
  }
  if (audit.voidedAt) {
    events.push({
      timestamp: audit.voidedAt, action: 'VOIDED',
      by:        audit.voidedBy || 'ADMIN',
      note:      transaction.void?.reason || 'No reason given'
    });
  }
  if (audit.refundedAt) {
    events.push({
      timestamp: audit.refundedAt, action: 'REFUNDED',
      by:        audit.refundedBy || 'ADMIN',
      note:      transaction.refund?.reason || 'No reason given'
    });
  }

  // Add any audit log entries for this transaction
  const auditEntries = (APP_STATE.auditLog || [])
    .filter(e => e.saleId === transaction.id || e.receiptNumber === transaction.receiptNumber);
  auditEntries.forEach(e => {
    events.push({ timestamp: e.timestamp, action: e.action, by: e.role || 'SYSTEM', note: e.note || '' });
  });

  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function renderTransactionTimeline(transactionId) {
  const transaction = (APP_STATE.sales || []).find(s => String(s.id) === String(transactionId));
  if (!transaction) return;

  const timeline  = buildTransactionTimeline(transaction);
  const container = document.getElementById('transactionTimelineContent');
  if (!container) return;

  container.innerHTML = `
    <div style="font-size:12px;font-weight:700;margin-bottom:14px;">
      ${escapeHtml(transaction.receiptNumber || transaction.id)}
      — ${formatCurrency(transaction.totals?.total ?? transaction.total ?? 0)}
    </div>
    <div style="position:relative;padding-left:20px;border-left:2px solid var(--gray-200);">
      ${timeline.map(event => `
        <div style="position:relative;margin-bottom:14px;padding-left:12px;">
          <div style="position:absolute;left:-19px;top:4px;width:8px;height:8px;
            border-radius:50%;background:${
              event.action === 'VOIDED' || event.action === 'REFUNDED' ? '#dc2626'
              : event.action === 'COMPLETED' ? '#16a34a' : '#000'
            };"></div>
          <div style="font-size:10px;font-weight:800;letter-spacing:1px;
            text-transform:uppercase;color:${
              event.action === 'VOIDED' || event.action === 'REFUNDED' ? '#dc2626'
              : event.action === 'COMPLETED' ? '#16a34a' : 'var(--gray-700)'
            };">${escapeHtml(event.action)}</div>
          <div style="font-size:11px;color:var(--gray-500);margin-top:2px;">
            ${new Date(event.timestamp).toLocaleString()} · ${escapeHtml(event.by)}
          </div>
          ${event.note ? `<div style="font-size:11px;color:var(--gray-400);margin-top:2px;">
            ${escapeHtml(event.note)}</div>` : ''}
        </div>`).join('')}
    </div>`;

  openModal('transactionTimelineModal');
}

/* ── Inventory Movement History ── */
function renderInventoryMovementHistory() {
  const container = document.getElementById('inventoryMovementContainer');
  if (!container) return;

  const movements = (APP_STATE.inventoryMovements || [])
    .slice().reverse().slice(0, window.inventoryMovementLimit || 20);

  if (!movements.length) {
    container.innerHTML = `<div class="empty-state">No inventory movements recorded</div>`;
    return;
  }

  const typeColors = {
    'sale-deduction':           '#dc2626',
    'supply-order-deduction':   '#1d4ed8',
    'supply-stock-restored':    '#16a34a',
    'refund-restoration':       '#16a34a',
    'void-restoration':         '#16a34a',
    'manual-adjustment':        '#7e22ce',
    'restock':                  '#16a34a',
    'pending-cancel-restoration':'#16a34a'
  };

  container.innerHTML = movements.map(m => {
    const color = typeColors[m.type] || '#555';
    const date  = new Date(m.createdAt || Date.now());
    return `
      <div style="display:grid;grid-template-columns:auto 1fr auto auto;
        gap:10px;align-items:center;padding:8px 0;
        border-bottom:1px solid var(--gray-100);font-size:12px;">
        <span style="width:10px;height:10px;border-radius:50%;
          background:${color};flex-shrink:0;display:block;"></span>
        <div>
          <div style="font-weight:700;">${escapeHtml(m.ingredientName || m.productName || '—')}</div>
          <div style="font-size:10px;color:var(--gray-400);">
            ${escapeHtml(m.type)} · ${escapeHtml(m.reason || '')}
          </div>
        </div>
        <div style="text-align:right;font-variant-numeric:tabular-nums;">
          ${m.quantityUsed > 0
            ? `<span style="color:#dc2626;">-${Number(m.quantityUsed).toFixed(2)}</span>`
            : `<span style="color:#16a34a;">+${Number(m.quantityAdded).toFixed(2)}</span>`}
        </div>
        <div style="font-size:10px;color:var(--gray-400);white-space:nowrap;">
          ${date.toLocaleDateString()} ${date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>`;
  }).join('');

  // See more
  const total = (APP_STATE.inventoryMovements || []).length;
  const limit = window.inventoryMovementLimit || 20;
  _renderSeeMore(
    'inventoryMovementSeeMore', total, limit,
    () => { window.inventoryMovementLimit = (window.inventoryMovementLimit||20) + 20; renderInventoryMovementHistory(); },
    () => { window.inventoryMovementLimit = 20; renderInventoryMovementHistory(); }
  );
}

/* ── Daily Discrepancy Report ── */
function renderDailyDiscrepancies() {
  const container = document.getElementById('discrepancyContainer');
  if (!container) return;

  const discrepancies = typeof getDailyDiscrepancies === 'function'
    ? getDailyDiscrepancies() : [];

  if (!discrepancies.length) {
    container.innerHTML = `<div class="empty-state">No discrepancy data available</div>`;
    return;
  }

  container.innerHTML = discrepancies.slice(0, 14).map(d => `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:8px 12px;border-radius:var(--radius-md);margin-bottom:6px;
      background:${d.adjustments > 0 ? '#fdf4ff' : 'var(--gray-50)'};
      border:1px solid ${d.adjustments > 0 ? '#e9d5ff' : 'var(--gray-100)'};">
      <div>
        <div style="font-size:12px;font-weight:700;">${d.date}</div>
        <div style="font-size:10px;color:var(--gray-400);">
          In: +${d.added.toFixed(2)} · Used: -${d.used.toFixed(2)}
          ${d.adjustments > 0 ? ` · <span style="color:#7e22ce;font-weight:700;">${d.adjustments} manual adj.</span>` : ''}
        </div>
      </div>
      ${d.adjustments > 0
        ? `<span style="font-size:9px;font-weight:800;letter-spacing:1px;
            text-transform:uppercase;background:#f3e8ff;color:#7e22ce;
            padding:3px 8px;border-radius:999px;border:1px solid #e9d5ff;">
            Review</span>` : ''}
    </div>`).join('');
}

/* ── Inventory Adjustment Log ── */
function logInventoryAdjustment(ingredientId, previousStock, newStock, reason) {
  const ingredient = (APP_STATE.ingredients || []).find(i => String(i.id) === String(ingredientId));
  const movements  = Array.isArray(APP_STATE.inventoryMovements) ? APP_STATE.inventoryMovements : [];
  const diff       = newStock - previousStock;

  movements.push({
    id:             generateId(),
    ingredientId,
    ingredientName: ingredient?.name || '—',
    type:           'manual-adjustment',
    quantityAdded:  diff > 0 ? diff : 0,
    quantityUsed:   diff < 0 ? Math.abs(diff) : 0,
    reason:         reason || 'Manual stock adjustment',
    previousStock,
    newStock,
    createdAt:      new Date().toISOString(),
    createdBy:      APP_STATE.currentUserRole || 'STAFF'
  });

  updateState('inventoryMovements', () => movements);

  if (typeof pushAuditEntry === 'function') {
    pushAuditEntry({
      action:  'INVENTORY_ADJUSTMENT',
      outcome: 'SUCCESS',
      note:    `${ingredient?.name||ingredientId}: ${previousStock} → ${newStock} (${diff > 0 ? '+' : ''}${diff}). Reason: ${reason}`
    });
  }
}

/* ── Unified See More helper ── */
function _renderSeeMore(containerId, total, currentLimit, onMore, onLess) {
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'see-more-container';
    const parent = document.getElementById(containerId.replace('SeeMore','Container'))
      || document.getElementById(containerId.replace('SeeMore',''));
    if (parent) parent.after(container);
  }

  container.innerHTML = '';

  if (total === 0) return;

  if (total <= currentLimit) {
    if (total > 5) {
      const btn = document.createElement('button');
      btn.className = 'see-more-btn';
      btn.innerHTML = `↑ Show Less <span class="see-more-count">Showing all ${total}</span>`;
      btn.addEventListener('click', onLess);
      container.appendChild(btn);
    }
    return;
  }

  const btn = document.createElement('button');
  btn.className = 'see-more-btn';
  btn.innerHTML = `Show More <span class="see-more-count">${currentLimit} of ${total}</span>`;
  btn.addEventListener('click', onMore);
  container.appendChild(btn);
}

/* ── Main integrity report render ── */
async function renderIntegrityReport() {
  const container = document.getElementById('integrityReportContainer');
  if (!container) return;

  container.innerHTML = `<div style="color:var(--gray-400);font-size:12px;padding:12px 0;">
    Running integrity check…</div>`;

  const report = await verifyAllTransactions();
  const clean  = report.tampered === 0;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;">
      <div class="stat-card">
        <div class="label">Total</div>
        <div class="value" style="font-size:20px;">${report.total}</div>
        <div class="sub">Transactions</div>
      </div>
      <div class="stat-card">
        <div class="label">Verified</div>
        <div class="value" style="font-size:20px;color:#16a34a;">${report.passed}</div>
        <div class="sub">Clean</div>
      </div>
      <div class="stat-card">
        <div class="label">Pre-seal</div>
        <div class="value" style="font-size:20px;${report.noSeal>0?'color:#ea580c;':''}">${report.noSeal}</div>
        <div class="sub">No hash yet</div>
      </div>
      <div class="stat-card">
        <div class="label">Tampered</div>
        <div class="value" style="font-size:20px;${report.tampered>0?'color:#dc2626;':''}">${report.tampered}</div>
        <div class="sub">Hash mismatch</div>
      </div>
    </div>
    <div style="padding:10px 14px;border-radius:var(--radius-md);font-size:12px;
      font-weight:700;margin-bottom:${report.failures.length?'14px':'0'};
      ${clean
        ? 'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;'
        : 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca;'}">
      ${clean ? '✓ All transactions verified clean' : `⚠ ${report.tampered} tampered transaction(s) detected`}
    </div>
    ${report.failures.filter(f=>f.reason==='HASH_MISMATCH').length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Receipt #</th><th>Sealed At</th><th>Status</th></tr></thead>
          <tbody>
            ${report.failures.filter(f=>f.reason==='HASH_MISMATCH').map(f => `
              <tr>
                <td style="font-family:var(--font-mono);font-size:11px;">${escapeHtml(f.receiptNumber||f.id||'—')}</td>
                <td style="font-size:11px;">${f.sealedAt ? new Date(f.sealedAt).toLocaleString() : '—'}</td>
                <td style="color:#dc2626;font-size:11px;font-weight:700;">TAMPERED</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    <div style="font-size:10px;color:var(--gray-400);margin-top:10px;text-align:right;">
      Checked: ${new Date(report.checkedAt).toLocaleString()}
    </div>`;
}

/* ── Exports ── */
window.sealTransaction               = sealTransaction;
window.verifyTransaction             = verifyTransaction;
window.verifyAllTransactions         = verifyAllTransactions;
window.renderIntegrityReport         = renderIntegrityReport;
window.renderTransactionTimeline     = renderTransactionTimeline;
window.buildTransactionTimeline      = buildTransactionTimeline;
window.renderInventoryMovementHistory= renderInventoryMovementHistory;
window.renderDailyDiscrepancies      = renderDailyDiscrepancies;
window.logInventoryAdjustment        = logInventoryAdjustment;
window._renderSeeMore                = _renderSeeMore;
