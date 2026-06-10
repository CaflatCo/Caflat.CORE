/* ═══════════════════════════════════════════════════════
   STORAGE.JS — Persistence, import/export
═══════════════════════════════════════════════════════ */

const STORAGE_KEY = 'caflat_pos_v1';

/* ── Storage caps — prevents localStorage overflow ── */
const CAP_SALES      = 500;   // Keep most recent 500 sales in localStorage
const CAP_AUDIT      = 1000;  // Keep most recent 1000 audit log entries
const CAP_MOVEMENTS  = 1000;  // Keep most recent 1000 inventory movements

/* ── Tail helper — returns the last N items of an array ── */
const _tail = (arr, n) => Array.isArray(arr) && arr.length > n ? arr.slice(-n) : (arr || []);

function getPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load persisted state', error);
    return null;
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      settings:           APP_STATE.settings,
      receiptCounter:     APP_STATE.receiptCounter,
      products:           APP_STATE.products,
      ingredients:        APP_STATE.ingredients,
      sales:              _tail(APP_STATE.sales,              CAP_SALES),
      categories:         APP_STATE.categories,
      heldOrders:         APP_STATE.heldOrders,
      inventoryMovements: _tail(APP_STATE.inventoryMovements, CAP_MOVEMENTS),
      auditLog:           _tail(APP_STATE.auditLog,           CAP_AUDIT),
      supplyOrders:        APP_STATE.supplyOrders,
      supplierClients:     APP_STATE.supplierClients,
      supplyInvoiceCounter:APP_STATE.supplyInvoiceCounter,
      stockReservations:   APP_STATE.stockReservations,
      events:              APP_STATE.events,
      activeEvent:         APP_STATE.activeEvent,
      eventPackages:       APP_STATE.eventPackages,
      leads:               APP_STATE.leads,
      labDrafts:           APP_STATE.labDrafts,
      labCategoryPresets:  APP_STATE.labCategoryPresets,
      productionJobs:      APP_STATE.productionJobs,
      laborPeople:         APP_STATE.laborPeople
    }));
  } catch (error) {
    console.error('Failed to persist state', error);
  }
}

function restorePersistedState() {
  const persisted = getPersistedState();
  if (!persisted) return;

  // Merge settings carefully so new keys get defaults if missing from older backups
  APP_STATE.settings = Object.assign({
    brandName: 'Caflat.Co POS',
    taxRate: 0,
    receiptFooter: 'Thank you for choosing Caflat.Co',
    currency: 'PHP',
    orderTypes: ['Dine In', 'Take Out', 'Delivery'],
    lowStockThreshold: 5,
    voidPin: '000000',
    supplierModeEnabled:   false,
    coffeeCartModeEnabled: false,
    productionModeEnabled: false,
    receiptBaseUrl: '',
    backupEmail:    ''
  }, persisted.settings || {});

  APP_STATE.receiptCounter     = Number(persisted.receiptCounter || 0);
  APP_STATE.products           = Array.isArray(persisted.products)           ? persisted.products           : [];
  APP_STATE.ingredients        = Array.isArray(persisted.ingredients)        ? persisted.ingredients        : [];
  APP_STATE.sales              = Array.isArray(persisted.sales)              ? persisted.sales              : [];
  APP_STATE.categories         = Array.isArray(persisted.categories)         ? persisted.categories         : APP_STATE.categories;
  APP_STATE.heldOrders         = Array.isArray(persisted.heldOrders)        ? persisted.heldOrders         : [];
  APP_STATE.inventoryMovements = Array.isArray(persisted.inventoryMovements) ? persisted.inventoryMovements : [];
  APP_STATE.auditLog             = Array.isArray(persisted.auditLog)           ? persisted.auditLog           : [];
  APP_STATE.supplyOrders         = Array.isArray(persisted.supplyOrders)       ? persisted.supplyOrders       : [];
  APP_STATE.supplierClients      = Array.isArray(persisted.supplierClients)    ? persisted.supplierClients    : [];
  APP_STATE.supplyInvoiceCounter = Number(persisted.supplyInvoiceCounter || 0);
  APP_STATE.stockReservations    = Array.isArray(persisted.stockReservations)
    ? persisted.stockReservations : [];
  APP_STATE.events               = Array.isArray(persisted.events)        ? persisted.events        : [];
  APP_STATE.activeEvent          = persisted.activeEvent || null;
  APP_STATE.eventPackages        = Array.isArray(persisted.eventPackages) ? persisted.eventPackages : [];
  APP_STATE.leads                = Array.isArray(persisted.leads)         ? persisted.leads         : [];
  APP_STATE.labDrafts            = Array.isArray(persisted.labDrafts)            ? persisted.labDrafts            : [];
  APP_STATE.labCategoryPresets   = Array.isArray(persisted.labCategoryPresets)   ? persisted.labCategoryPresets   : [];
  APP_STATE.productionJobs       = Array.isArray(persisted.productionJobs)       ? persisted.productionJobs       : [];
  APP_STATE.laborPeople          = Array.isArray(persisted.laborPeople)          ? persisted.laborPeople          : [];
}

/* ── Export full backup ── */
function exportAllData() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: 'v1B',
    settings: APP_STATE.settings,
    receiptCounter: APP_STATE.receiptCounter,
    products: APP_STATE.products,
    ingredients: APP_STATE.ingredients,
    sales: APP_STATE.sales,
    categories: APP_STATE.categories,
    heldOrders: APP_STATE.heldOrders,
    inventoryMovements: APP_STATE.inventoryMovements,
    auditLog: APP_STATE.auditLog,
    supplyOrders: APP_STATE.supplyOrders,
    supplierClients: APP_STATE.supplierClients,
    supplyInvoiceCounter: APP_STATE.supplyInvoiceCounter,
    stockReservations: APP_STATE.stockReservations,
    events:            APP_STATE.events,
    activeEvent:       APP_STATE.activeEvent,
    eventPackages:     APP_STATE.eventPackages,
    leads:             APP_STATE.leads,
    labDrafts:         APP_STATE.labDrafts,
    labCategoryPresets:APP_STATE.labCategoryPresets,
    productionJobs:    APP_STATE.productionJobs,
    laborPeople:       APP_STATE.laborPeople
  };
  downloadTextFile(`caflat-backup-${Date.now()}.json`, JSON.stringify(data, null, 2));
  localStorage.setItem(BACKUP_REMINDER_KEY, Date.now().toString());
  showNotification('Backup exported', 'success');
}

/* ── Import backup ── */
function importAllData(file) {
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const data = JSON.parse(event.target.result);
      if (typeof data !== 'object' || data === null) {
        showNotification('Invalid backup file — not a Caflat backup', 'error');
        return;
      }
      // Accept if it has ANY recognisable Caflat field
      const hasRecognisedField = data.products !== undefined
        || data.ingredients !== undefined
        || data.sales !== undefined
        || data.settings !== undefined
        || data.categories !== undefined;
      if (!hasRecognisedField) {
        showNotification('Invalid backup file — not a Caflat backup', 'error');
        return;
      }
      if (!confirm('This will replace all current data. Continue?')) return;

      APP_STATE.settings           = Object.assign({
        brandName: 'Caflat.Co POS', taxRate: 0,
        receiptFooter: 'Thank you for choosing Caflat.Co',
        currency: 'PHP', orderTypes: ['Dine In', 'Take Out', 'Delivery'],
        lowStockThreshold: 5, voidPin: '000000',
        supplierModeEnabled:   false,
        coffeeCartModeEnabled: false,
        productionModeEnabled: false,
    receiptBaseUrl: '',
    backupEmail:    ''
      }, data.settings || {});
      APP_STATE.receiptCounter     = Number(data.receiptCounter || 0);
      APP_STATE.products           = Array.isArray(data.products)           ? data.products           : [];
      APP_STATE.ingredients        = Array.isArray(data.ingredients)        ? data.ingredients        : [];
      APP_STATE.sales              = Array.isArray(data.sales)              ? data.sales              : [];
      APP_STATE.categories         = Array.isArray(data.categories)         ? data.categories         : [];
      APP_STATE.heldOrders         = Array.isArray(data.heldOrders)         ? data.heldOrders         : [];
      APP_STATE.inventoryMovements = Array.isArray(data.inventoryMovements) ? data.inventoryMovements : [];
      APP_STATE.auditLog             = Array.isArray(data.auditLog)           ? data.auditLog           : [];
      APP_STATE.supplyOrders         = Array.isArray(data.supplyOrders)       ? data.supplyOrders       : [];
      APP_STATE.supplierClients      = Array.isArray(data.supplierClients)    ? data.supplierClients    : [];
      APP_STATE.supplyInvoiceCounter = Number(data.supplyInvoiceCounter || 0);
      APP_STATE.stockReservations    = Array.isArray(data.stockReservations)
        ? data.stockReservations : [];
      APP_STATE.events               = Array.isArray(data.events)              ? data.events              : [];
      APP_STATE.activeEvent          = data.activeEvent || null;
      APP_STATE.eventPackages        = Array.isArray(data.eventPackages)       ? data.eventPackages       : [];
      APP_STATE.leads                = Array.isArray(data.leads)               ? data.leads               : [];
      APP_STATE.labDrafts            = Array.isArray(data.labDrafts)           ? data.labDrafts           : [];
      APP_STATE.labCategoryPresets   = Array.isArray(data.labCategoryPresets)  ? data.labCategoryPresets  : [];
      APP_STATE.productionJobs       = Array.isArray(data.productionJobs)      ? data.productionJobs      : [];
      APP_STATE.laborPeople          = Array.isArray(data.laborPeople)         ? data.laborPeople         : [];

      persistState();
      if (typeof renderEverything === 'function') renderEverything();
      showNotification('Backup imported successfully', 'success');
    } catch (err) {
      showNotification('Failed to import — invalid file', 'error');
    }
  };
  reader.readAsText(file);
}

/* ── Reset business data ── */

// Standard reset — wipes business data, keeps Lab presets + settings
function resetBusinessData() {
  if (typeof resetState === 'function') resetState();
  // Restore lab presets and settings after wipe (they survive standard reset)
  const preserved = {
    settings:           APP_STATE.settings,
    labCategoryPresets: APP_STATE.labCategoryPresets,
    laborPeople:        APP_STATE.laborPeople
  };
  localStorage.removeItem(STORAGE_KEY);
  // Re-apply preserved fields
  APP_STATE.settings           = preserved.settings;
  APP_STATE.labCategoryPresets = preserved.labCategoryPresets;
  APP_STATE.laborPeople        = preserved.laborPeople;
  if (typeof persistState === 'function') persistState();
  if (typeof renderEverything === 'function') renderEverything();
  showNotification('Business data reset — Lab presets and settings preserved', 'info');
}

// Full factory reset — wipes absolutely everything
function fullFactoryReset() {
  if (typeof resetState === 'function') resetState();
  APP_STATE.labCategoryPresets = [];
  APP_STATE.settings = {
    brandName:            'Caflat.Co POS',
    taxRate:              0,
    receiptFooter:        'Thank you for choosing Caflat.Co',
    currency:             'PHP',
    orderTypes:           ['Dine In', 'Take Out', 'Delivery'],
    lowStockThreshold:    5,
    voidPin:              '000000',
    supplierModeEnabled:  false,
    coffeeCartModeEnabled: false,
    productionModeEnabled: false,
    receiptBaseUrl: '',
    backupEmail:    ''
  };
  localStorage.removeItem(STORAGE_KEY);
  if (typeof renderEverything === 'function') renderEverything();
  showNotification('Full factory reset complete', 'info');
}

/* ── Storage usage ── */
function getStorageUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    const bytes = new Blob([raw]).size;
    const limitBytes = 5 * 1024 * 1024; // 5MB
    const pct = Math.min(100, Math.round((bytes / limitBytes) * 100));
    return {
      usedBytes:  bytes,
      limitBytes: limitBytes,
      usedMB:     (bytes / (1024 * 1024)).toFixed(2),
      limitMB:    '5.00',
      pct:        pct,
      // Counts for info display
      salesCount:     (APP_STATE.sales || []).length,
      auditCount:     (APP_STATE.auditLog || []).length,
      movementCount:  (APP_STATE.inventoryMovements || []).length,
      salesCapped:    (APP_STATE.sales || []).length >= CAP_SALES,
      auditCapped:    (APP_STATE.auditLog || []).length >= CAP_AUDIT,
      movementCapped: (APP_STATE.inventoryMovements || []).length >= CAP_MOVEMENTS,
    };
  } catch {
    return { usedBytes: 0, limitBytes: 5242880, usedMB: '0.00', limitMB: '5.00', pct: 0 };
  }
}

function renderStorageUsage() {
  const container = document.getElementById('storageUsageContainer');
  if (!container) return;

  const u = getStorageUsage();
  const barColor = u.pct >= 80 ? '#dc2626' : u.pct >= 60 ? '#f59e0b' : '#16a34a';

  container.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;">Local Storage</span>
        <span style="font-size:12px;font-variant-numeric:tabular-nums;">
          ${u.usedMB} MB <span style="color:var(--gray-400);">/ ${u.limitMB} MB</span>
        </span>
      </div>
      <div style="height:6px;background:var(--gray-100);border-radius:999px;overflow:hidden;">
        <div style="width:${u.pct}%;height:100%;background:${barColor};
          border-radius:999px;transition:width 0.3s;"></div>
      </div>
      ${u.pct >= 70 ? `
        <div style="margin-top:8px;font-size:11px;color:${barColor};font-weight:600;">
          ${u.pct >= 80
            ? '⚠️ Storage is getting full — export a backup soon.'
            : 'Storage is filling up — consider exporting a backup.'}
        </div>` : ''}
      <div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;">
        <span style="font-size:11px;color:var(--gray-400);">
          ${u.salesCount} sales${u.salesCapped ? ` <span style="color:#f59e0b;">(capped at ${CAP_SALES})</span>` : ''}
        </span>
        <span style="font-size:11px;color:var(--gray-400);">
          ${u.auditCount} audit entries${u.auditCapped ? ` <span style="color:#f59e0b;">(capped at ${CAP_AUDIT})</span>` : ''}
        </span>
        <span style="font-size:11px;color:var(--gray-400);">
          ${u.movementCount} stock movements${u.movementCapped ? ` <span style="color:#f59e0b;">(capped at ${CAP_MOVEMENTS})</span>` : ''}
        </span>
      </div>
    </div>
  `;
}


/* ═══════════════════════════════════════════════════════
   BACKUP EMAIL + REMINDER
   Opens mail app with backup JSON attached (base64).
   Reminder fires every 7 days if email is set.
═══════════════════════════════════════════════════════ */

const BACKUP_REMINDER_KEY = 'caflat_last_backup';

function _getBackupData() {
  return {
    exportedAt:           new Date().toISOString(),
    version:              'v1B',
    settings:             APP_STATE.settings,
    receiptCounter:       APP_STATE.receiptCounter,
    products:             APP_STATE.products,
    ingredients:          APP_STATE.ingredients,
    sales:                APP_STATE.sales,
    categories:           APP_STATE.categories,
    heldOrders:           APP_STATE.heldOrders,
    inventoryMovements:   APP_STATE.inventoryMovements,
    auditLog:             APP_STATE.auditLog,
    supplyOrders:         APP_STATE.supplyOrders,
    supplierClients:      APP_STATE.supplierClients,
    supplyInvoiceCounter: APP_STATE.supplyInvoiceCounter,
    stockReservations:    APP_STATE.stockReservations,
    events:               APP_STATE.events,
    activeEvent:          APP_STATE.activeEvent,
    eventPackages:        APP_STATE.eventPackages,
    leads:                APP_STATE.leads,
    labDrafts:            APP_STATE.labDrafts,
    labCategoryPresets:   APP_STATE.labCategoryPresets,
    productionJobs:       APP_STATE.productionJobs,
    laborPeople:          APP_STATE.laborPeople
  };
}

/* ── Export modal — Save to Device or Send via Email ── */
function exportAndEmail() {
  openExportModal();
}

function openExportModal() {
  const existing = document.getElementById('exportBackupModal');
  if (existing) existing.remove();

  const email    = APP_STATE.settings?.backupEmail || '';
  const hasEmail = email.length > 0;

  const overlay = document.createElement('div');
  overlay.id = 'exportBackupModal';
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.innerHTML = `
    <div class="modal" style="max-width:360px;">
      <h3>Export Backup</h3>
      <p style="font-size:12px;color:var(--gray-400);margin:10px 0 20px;">
        Choose how to save your backup file.
      </p>

      <button id="_exportSaveDeviceBtn"
        style="width:100%;padding:14px 16px;border:1.5px solid var(--gray-200);
          border-radius:12px;background:#fff;text-align:left;cursor:pointer;
          margin-bottom:10px;font-family:inherit;display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">📥</span>
        <div>
          <div style="font-size:13px;font-weight:700;">Save to Device</div>
          <div style="font-size:11px;color:var(--gray-400);margin-top:2px;">
            Downloads to your Files app or Downloads folder
          </div>
        </div>
      </button>

      <button id="_exportEmailBtn"
        style="width:100%;padding:14px 16px;border:1.5px solid var(--gray-200);
          border-radius:12px;background:#fff;text-align:left;cursor:pointer;
          margin-bottom:20px;font-family:inherit;display:flex;align-items:center;gap:12px;
          ${!hasEmail ? 'opacity:0.45;cursor:not-allowed;' : ''}">
        <span style="font-size:22px;">📧</span>
        <div>
          <div style="font-size:13px;font-weight:700;">Send via Email</div>
          <div style="font-size:11px;color:var(--gray-400);margin-top:2px;">
            ${hasEmail
              ? `Opens mail app to ${email}`
              : 'Set a backup email in Settings first'}
          </div>
        </div>
      </button>

      <button id="_exportCancelBtn"
        style="width:100%;padding:10px;border:1.5px solid var(--gray-200);
          border-radius:10px;background:#fff;cursor:pointer;
          font-family:inherit;font-size:12px;color:var(--gray-500);">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.classList.add('active');

  const close = () => overlay.remove();

  document.getElementById('_exportSaveDeviceBtn').onclick = () => {
    close();
    _doSaveToDevice();
  };

  document.getElementById('_exportEmailBtn').onclick = () => {
    if (!hasEmail) return;
    close();
    _doSendEmail();
  };

  document.getElementById('_exportCancelBtn').onclick = close;
}

function _doSaveToDevice() {
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `caflat-backup-${date}.json`;
  const json     = JSON.stringify(_getBackupData(), null, 2);
  downloadTextFile(filename, json);
  localStorage.setItem(BACKUP_REMINDER_KEY, Date.now().toString());
  showNotification('Backup saved to device', 'success');
}

function _doSendEmail() {
  const email    = APP_STATE.settings?.backupEmail || '';
  const brand    = APP_STATE.settings?.brandName   || 'Caflat.CORE';
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `caflat-backup-${date}.json`;

  // Download file first so it exists on device to attach
  downloadTextFile(filename, JSON.stringify(_getBackupData(), null, 2));
  localStorage.setItem(BACKUP_REMINDER_KEY, Date.now().toString());

  const subject = encodeURIComponent(`${brand} — Backup ${date}`);
  const body    = encodeURIComponent(
    `Your Caflat.CORE backup from ${date} has been downloaded to your device.

` +
    `File name: ${filename}

` +
    `Attach the downloaded file to this email and send it to yourself for safekeeping.

` +
    `— Caflat.CORE`
  );

  setTimeout(() => {
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }, 600);

  showNotification('Backup downloaded — opening mail app', 'success');
}
function checkBackupReminder() {
  const email = APP_STATE.settings?.backupEmail || '';
  if (!email) return; // No reminder without an email set

  const lastBackup = parseInt(localStorage.getItem(BACKUP_REMINDER_KEY) || '0', 10);
  const sevenDays  = 7 * 24 * 60 * 60 * 1000;
  const now        = Date.now();

  if (now - lastBackup < sevenDays) return; // Not due yet

  // Don't show on first launch (no data yet)
  const salesCount = (APP_STATE.sales || []).length;
  if (salesCount === 0) return;

  // Show reminder banner
  const existing = document.getElementById('backupReminderBanner');
  if (existing) return; // Already showing

  const daysSince = lastBackup === 0 ? null : Math.floor((now - lastBackup) / (24 * 60 * 60 * 1000));
  const msg = lastBackup === 0
    ? "You haven't backed up yet."
    : `Last backup was ${daysSince} day${daysSince !== 1 ? 's' : ''} ago.`;

  const banner = document.createElement('div');
  banner.id = 'backupReminderBanner';
  banner.style.cssText = `
    position: fixed;
    bottom: 20px; right: 20px;
    z-index: 99997;
    background: #000;
    color: #fff;
    padding: 14px 18px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;
  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <span>💾 ${msg} Back up your data to keep it safe.</span>
      <button onclick="this.closest('#backupReminderBanner').remove()"
        style="background:transparent;color:rgba(255,255,255,0.6);border:none;
          font-size:16px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;">✕</button>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="document.getElementById('backupReminderBanner')?.remove();openExportModal();"
        style="flex:1;background:#fff;color:#000;border:none;padding:8px 12px;
          border-radius:7px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;">
        Export Backup
      </button>
      <button onclick="localStorage.setItem('caflat_last_backup', Date.now());document.getElementById('backupReminderBanner')?.remove();"
        style="background:transparent;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.2);
          padding:8px 12px;border-radius:7px;font-size:11px;cursor:pointer;font-family:inherit;">
        Remind later
      </button>
    </div>
  `;
  document.body.appendChild(banner);
}



/* ── Storage warning banner ── */
function checkStorageWarning() {
  const u = getStorageUsage();
  const existing = document.getElementById('storageWarningBanner');

  if (u.pct < 80) {
    if (existing) existing.remove();
    return;
  }

  if (existing) {
    const pctEl = existing.querySelector('#storageWarningPct');
    if (pctEl) pctEl.textContent = u.pct + '%';
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'storageWarningBanner';
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:99998;
    background:${u.pct >= 95 ? '#dc2626' : '#f59e0b'};
    color:#fff;padding:10px 20px;display:flex;align-items:center;
    justify-content:space-between;font-size:12px;font-weight:700;
    gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);
  `;
  banner.innerHTML = `
    <span>
      ${u.pct >= 95
        ? '🔴 Storage almost full (' + u.pct + '%) — archive and clear history now to prevent data loss.'
        : '⚠️ Storage is ' + u.pct + '% full — export a backup soon.'}
      <span id="storageWarningPct" style="display:none;">${u.pct}</span>
    </span>
    <div style="display:flex;gap:8px;flex-shrink:0;">
      <button onclick="openExportModal()"
        style="background:rgba(255,255,255,0.25);color:#fff;border:1.5px solid rgba(255,255,255,0.5);
          padding:5px 12px;border-radius:6px;font-size:11px;font-weight:800;
          cursor:pointer;font-family:inherit;">
        Export Backup
      </button>
      ${u.pct >= 90 ? `
      <button onclick="openArchiveConfirmModal()"
        style="background:#fff;color:#000;border:none;padding:5px 12px;
          border-radius:6px;font-size:11px;font-weight:800;
          cursor:pointer;font-family:inherit;">
        Archive &amp; Clear
      </button>` : ''}
      <button onclick="this.closest('#storageWarningBanner').remove()"
        style="background:transparent;color:rgba(255,255,255,0.8);border:none;
          font-size:16px;cursor:pointer;padding:0 4px;line-height:1;">✕</button>
    </div>
  `;
  document.body.prepend(banner);
}

/* ═══════════════════════════════════════════════════════
   ARCHIVE & CLEAR HISTORY
   Exports full backup first, then wipes only the
   three arrays that cause storage bloat.
   Products, ingredients, settings — all preserved.
═══════════════════════════════════════════════════════ */
function openArchiveConfirmModal() {
  const existing = document.getElementById('archiveConfirmModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'archiveConfirmModal';
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '100000';

  const u = getStorageUsage();

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h3>Archive &amp; Clear History</h3>
      <p style="font-size:13px;color:var(--gray-500);margin:14px 0;line-height:1.6;">
        Your storage is <strong>${u.pct}% full</strong> (${u.usedMB} MB of ${u.limitMB} MB).
      </p>
      <div style="background:var(--gray-50);border:1.5px solid var(--gray-200);
        border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:12px;line-height:1.7;">
        <div style="font-weight:800;margin-bottom:6px;">This will:</div>
        <div>✅ Export a full backup file automatically</div>
        <div>✅ Clear ${u.salesCount} sales records</div>
        <div>✅ Clear ${u.auditCount} audit log entries</div>
        <div>✅ Clear ${u.movementCount} stock movement records</div>
        <div style="margin-top:6px;">🔒 Keep all products, ingredients, settings, and configuration</div>
      </div>
      <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:10px;
        padding:12px 16px;margin-bottom:20px;font-size:12px;color:#dc2626;font-weight:600;">
        Save the exported backup file. Once cleared, old history cannot be recovered without it.
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button"
          onclick="document.getElementById('archiveConfirmModal').remove()">
          Cancel
        </button>
        <button class="btn" type="button"
          onclick="archiveAndClearHistory();document.getElementById('archiveConfirmModal').remove();">
          Export &amp; Clear History
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.classList.add('active');
}

function archiveAndClearHistory() {
  // Step 1: Always export a full backup first
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `caflat-archive-${date}.json`;
  const data = {
    exportedAt:           new Date().toISOString(),
    version:              'v1B',
    archiveNote:          'Auto-archived before history clear',
    settings:             APP_STATE.settings,
    receiptCounter:       APP_STATE.receiptCounter,
    products:             APP_STATE.products,
    ingredients:          APP_STATE.ingredients,
    sales:                APP_STATE.sales,
    categories:           APP_STATE.categories,
    heldOrders:           APP_STATE.heldOrders,
    inventoryMovements:   APP_STATE.inventoryMovements,
    auditLog:             APP_STATE.auditLog,
    supplyOrders:         APP_STATE.supplyOrders,
    supplierClients:      APP_STATE.supplierClients,
    supplyInvoiceCounter: APP_STATE.supplyInvoiceCounter,
    stockReservations:    APP_STATE.stockReservations,
    events:               APP_STATE.events,
    activeEvent:          APP_STATE.activeEvent,
    eventPackages:        APP_STATE.eventPackages,
    leads:                APP_STATE.leads,
    labDrafts:            APP_STATE.labDrafts,
    labCategoryPresets:   APP_STATE.labCategoryPresets,
    productionJobs:       APP_STATE.productionJobs,
    laborPeople:          APP_STATE.laborPeople
  };

  downloadTextFile(filename, JSON.stringify(data, null, 2));
  localStorage.setItem(BACKUP_REMINDER_KEY, Date.now().toString());

  // Step 2: Clear only history arrays — keep everything else
  APP_STATE.sales              = [];
  APP_STATE.auditLog           = [];
  APP_STATE.inventoryMovements = [];
  APP_STATE.receiptCounter     = 0;

  // Step 3: Persist and re-render
  persistState();
  if (typeof renderEverything === 'function') renderEverything();

  showNotification(
    'Archive exported and history cleared. Products and settings unchanged.',
    'success'
  );
}

window.getPersistedState    = getPersistedState;
window.persistState         = persistState;
window.restorePersistedState= restorePersistedState;
window.exportAllData        = exportAllData;
window.importAllData        = importAllData;
window.resetBusinessData    = resetBusinessData;
window.fullFactoryReset     = fullFactoryReset;
window.getStorageUsage       = getStorageUsage;
window.renderStorageUsage    = renderStorageUsage;
window.exportAndEmail         = exportAndEmail;
window.openExportModal        = openExportModal;
window.checkBackupReminder    = checkBackupReminder;
window.checkStorageWarning     = checkStorageWarning;
window.openArchiveConfirmModal = openArchiveConfirmModal;
window.archiveAndClearHistory  = archiveAndClearHistory;
