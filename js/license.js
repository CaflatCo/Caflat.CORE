/* ═══════════════════════════════════════════════════════
   LICENSE.JS — Caflat.CORE License & Tier Management
   Supabase-backed validation. Single-use keys.
═══════════════════════════════════════════════════════ */

const CAFLAT_SB_URL  = 'https://tkrsebalgonimmozbgqc.supabase.co';
const CAFLAT_SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcnNlYmFsZ29uaW1tb3piZ3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjc5NzEsImV4cCI6MjA5NzYwMzk3MX0.OKp5NCLYnL-5CFWnvXpA2E78jNi5r63Jzs2zABAkzsw';

const LICENSE_STORAGE_KEY   = 'caflat_license_v1';
const FREE_PRODUCT_LIMIT    = 50;
const REVALIDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ── Tier definitions ──────────────────────────────── */
const TIER_FREE = 'free';
const TIER_PRO  = 'pro';

const TIER_FEATURES = {
  [TIER_FREE]: [
    'pos', 'products', 'inventory', 'dashboard', 'sales', 'reports'
  ],
  [TIER_PRO]: [
    'pos', 'products', 'inventory', 'dashboard', 'sales', 'reports',
    'supplier', 'production', 'coffeecart', 'productlab',
    'recipecatalog', 'shoppinglist', 'finishedgoods'
  ]
};

/* ── Local license state ───────────────────────────── */
let _licenseState = null;

function _loadLicenseFromStorage() {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _saveLicenseToStorage(data) {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(data));
}

function _clearLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  _licenseState = null;
}

/* ── Public API ────────────────────────────────────── */
function getLicenseTier() {
  if (!_licenseState) return TIER_FREE;
  if (_licenseState.tier === TIER_PRO) {
    // Check expiry
    if (_licenseState.expires_at && new Date(_licenseState.expires_at) < new Date()) {
      return TIER_FREE; // expired
    }
    return TIER_PRO;
  }
  return TIER_FREE;
}

function isProTier() {
  return getLicenseTier() === TIER_PRO;
}

function getLicenseInfo() {
  return _licenseState;
}

function isFeatureAllowed(featureKey) {
  const tier = getLicenseTier();
  return (TIER_FEATURES[tier] || TIER_FEATURES[TIER_FREE]).includes(featureKey);
}

function getProductLimit() {
  return isProTier() ? Infinity : FREE_PRODUCT_LIMIT;
}

function isAtProductLimit() {
  if (isProTier()) return false;
  return (getProducts?.() || []).length >= FREE_PRODUCT_LIMIT;
}

/* Returns the tenant_id for this activated license, or null if free/unactivated */
function getTenantId() {
  return _licenseState?.tenant_id || null;
}

/* ── Supabase helpers ──────────────────────────────── */
async function _sbFetch(path, options = {}) {
  const res = await fetch(`${CAFLAT_SB_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': CAFLAT_SB_ANON,
      'Authorization': `Bearer ${CAFLAT_SB_ANON}`,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

/* ── Key validation & activation ───────────────────── */
async function activateLicenseKey(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { success: false, error: 'Please enter a license key.' };

  // 1. Fetch the key from Supabase
  const fetch1 = await _sbFetch(
    `licenses?code=eq.${encodeURIComponent(clean)}&select=*`
  );

  if (!fetch1.ok || !Array.isArray(fetch1.data) || fetch1.data.length === 0) {
    return { success: false, error: 'Invalid license key.' };
  }

  const license = fetch1.data[0];

  if (license.revoked) {
    return { success: false, error: 'This license has been revoked.' };
  }

  if (license.activated) {
    return { success: false, error: 'This key has already been used on another device.' };
  }

  // Check expiry at activation time
  const expiresAt = license.expires_at ? new Date(license.expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return { success: false, error: 'This license key has expired.' };
  }

  // 2. Generate a device fingerprint (best effort, not perfect but good deterrent)
  const deviceId = await _generateDeviceId();

  // 3. Mark as activated in Supabase
  const patch = await _sbFetch(
    `licenses?code=eq.${encodeURIComponent(clean)}`,
    {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        activated:        true,
        activated_at:     new Date().toISOString(),
        activated_device: deviceId
      })
    }
  );

  if (!patch.ok) {
    return { success: false, error: 'Activation failed. Please try again.' };
  }

  // 4. Store locally — include tenant_id from the license record
  const stored = {
    code:          clean,
    tier:          license.tier,
    client_name:   license.client_name,
    tenant_id:     license.tenant_id || null,
    expires_at:    license.expires_at,
    activated_at:  new Date().toISOString(),
    device_id:     deviceId,
    last_validated: new Date().toISOString()
  };

  _saveLicenseToStorage(stored);
  _licenseState = stored;

  return { success: true, license: stored };
}

/* ── Periodic revalidation ─────────────────────────── */
async function revalidateLicense() {
  if (!_licenseState) return;

  const lastCheck = new Date(_licenseState.last_validated || 0);
  if (Date.now() - lastCheck.getTime() < REVALIDATE_INTERVAL_MS) return;

  const result = await _sbFetch(
    `licenses?code=eq.${encodeURIComponent(_licenseState.code)}&select=revoked,activated,expires_at`
  );

  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return;

  const remote = result.data[0];

  if (remote.revoked) {
    _clearLicense();
    showNotification('Your license has been revoked. Reverted to free plan.', 'error');
    applyLicenseTier();
    return;
  }

  // Update last_validated timestamp locally
  _licenseState.last_validated = new Date().toISOString();
  _saveLicenseToStorage(_licenseState);
}

/* ── Device fingerprint ────────────────────────────── */
async function _generateDeviceId() {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || '',
  ].join('|');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(components));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,32);
}

/* ── Apply tier to app features ────────────────────── */
function applyLicenseTier() {
  const tier = getLicenseTier();
  const isPro = tier === TIER_PRO;

  // Update Settings license section
  const statusLabel = document.getElementById('licenseStatusLabel');
  const statusSub   = document.getElementById('licenseStatusSub');
  const openBtn     = document.getElementById('openLicenseBtn');
  if (statusLabel) {
    if (isPro) {
      statusLabel.textContent = '✓ PRO Plan';
      statusLabel.style.color = '#15803d';
      if (statusSub) {
        const expiry = _licenseState?.expires_at
          ? new Date(_licenseState.expires_at).toLocaleDateString('en-PH', {year:'numeric',month:'long',day:'numeric'})
          : 'Lifetime';
        statusSub.textContent = `${_licenseState?.client_name || ''} · All features unlocked · Expires ${expiry}`;
      }
      if (openBtn) { openBtn.textContent = 'Manage License'; }
    } else {
      statusLabel.textContent = 'Free Plan';
      statusLabel.style.color = '';
      if (statusSub) statusSub.textContent = 'Up to 50 products · Core features only';
      if (openBtn) { openBtn.textContent = 'Enter License Key'; }
    }
  }

  // Update nav badge
  _renderLicenseBadge();

  // Gate optional modes — only show in settings if Pro
  // The actual feature toggles in settings also need to be gated
  const proOnlyToggles = [
    'settingsSupplierMode',
    'settingsProductionMode',
    'settingsCoffeeCartMode',
    'settingsProductLabMode',
    'settingsRecipeCatalogMode',
    'settingsShoppingList',
  ];

  proOnlyToggles.forEach(id => {
    const row = document.getElementById(id)?.closest('.settings-toggle-row');
    if (row) {
      if (!isPro) {
        row.style.opacity = '0.4';
        row.style.pointerEvents = 'none';
        // Add lock badge if not already there
        if (!row.querySelector('.pro-lock-badge')) {
          const badge = document.createElement('span');
          badge.className = 'pro-lock-badge';
          badge.textContent = 'PRO';
          badge.style.cssText = 'font-size:9px;font-weight:900;padding:2px 7px;border-radius:999px;background:#0f0f0f;color:#fff;letter-spacing:1px;margin-left:8px;';
          const label = row.querySelector('.settings-toggle-label');
          if (label) label.appendChild(badge);
        }
      } else {
        row.style.opacity = '';
        row.style.pointerEvents = '';
        row.querySelector('.pro-lock-badge')?.remove();
      }
    }
  });

  // If free tier, force-disable pro features in settings
  if (!isPro && APP_STATE.settings) {
    APP_STATE.settings.supplierModeEnabled   = false;
    APP_STATE.settings.productionModeEnabled = false;
    APP_STATE.settings.coffeeCartModeEnabled = false;
    APP_STATE.settings.productLabModeEnabled = false;
    APP_STATE.settings.recipeCatalogEnabled  = false;
    APP_STATE.settings.shoppingListEnabled   = false;

    // Hide any nav tabs that were enabled
    ['navSupply','navProduction','navCoffeeCart'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    ['openLabBtn','openRecipesBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Apply toggles
    if (typeof applySupplierModeToggle    === 'function') applySupplierModeToggle();
    if (typeof applyProductionModeToggle  === 'function') applyProductionModeToggle();
    if (typeof applyCoffeeCartModeToggle  === 'function') applyCoffeeCartModeToggle();
    if (typeof applyProductLabModeToggle  === 'function') applyProductLabModeToggle();
    if (typeof applyRecipeCatalogToggle   === 'function') applyRecipeCatalogToggle();
    if (typeof applyShoppingListToggle    === 'function') applyShoppingListToggle();
  }
}

/* ── License badge in nav ──────────────────────────── */
function _renderLicenseBadge() {
  let badge = document.getElementById('licenseTierBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'licenseTierBadge';
    badge.style.cssText = `font-size:9px;font-weight:900;padding:2px 8px;border-radius:999px;
      letter-spacing:1px;cursor:pointer;margin-left:4px;`;
    badge.title = 'License info';
    badge.addEventListener('click', openLicenseModal);
    const brandName = document.getElementById('brandName');
    if (brandName) brandName.insertAdjacentElement('afterend', badge);
  }

  const tier = getLicenseTier();
  if (tier === TIER_PRO) {
    badge.textContent = 'PRO';
    badge.style.background = '#0f0f0f';
    badge.style.color = '#fff';
  } else {
    badge.textContent = 'FREE';
    badge.style.background = '#f0f0f0';
    badge.style.color = '#555';
  }
}

/* ── License modal ─────────────────────────────────── */
function openLicenseModal() {
  let modal = document.getElementById('licenseModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'licenseModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  const info = getLicenseInfo();
  const tier = getLicenseTier();
  const isPro = tier === TIER_PRO;
  const expiry = info?.expires_at
    ? new Date(info.expires_at).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })
    : null;

  modal.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h3>License</h3>

      <div style="padding:16px;border-radius:var(--radius-lg);
        background:${isPro ? '#0f0f0f' : 'var(--gray-50)'};
        border:1.5px solid ${isPro ? '#0f0f0f' : 'var(--border)'};
        margin-bottom:20px;text-align:center;">
        <div style="font-size:28px;font-weight:900;letter-spacing:1px;
          color:${isPro ? '#fff' : 'var(--gray-400)'};">${isPro ? 'PRO' : 'FREE'}</div>
        ${isPro ? `
          <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:4px;">
            ${info.client_name || ''}
          </div>
          ${expiry ? `<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;">Expires ${expiry}</div>` : ''}
        ` : `
          <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">
            Up to ${FREE_PRODUCT_LIMIT} products · Core features only
          </div>
        `}
      </div>

      ${!isPro ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
            color:var(--gray-400);margin-bottom:8px;">Have a license key?</div>
          <div style="display:flex;gap:8px;">
            <input id="licenseKeyInput" type="text" placeholder="CAFLAT-XXXX-XXXX-XXXX"
              style="flex:1;padding:10px 12px;border:1.5px solid var(--border);
                border-radius:var(--radius-md);font-size:13px;font-family:var(--font-main);
                text-transform:uppercase;letter-spacing:1px;" />
            <button type="button" id="licenseActivateBtn" class="btn"
              style="white-space:nowrap;">Activate</button>
          </div>
          <div id="licenseActivateError"
            style="display:none;font-size:12px;color:var(--danger);margin-top:8px;font-weight:600;"></div>
        </div>
      ` : `
        <div style="text-align:center;margin-bottom:16px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="_deactivateLicense()">
            Remove License
          </button>
        </div>
      `}

      ${!isPro ? `
        <div style="background:#f8f9ff;border:1.5px solid #e0e7ff;border-radius:var(--radius-lg);
          padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;
            color:#4f46e5;margin-bottom:8px;">Upgrade to PRO — ₱499</div>
          <div style="font-size:12px;color:#555;line-height:1.6;">
            ✓ Supplier Mode &nbsp; ✓ Production Mode<br>
            ✓ Product Lab &nbsp; ✓ Events Mode<br>
            ✓ Recipe Catalog &nbsp; ✓ Shopping List<br>
            ✓ Unlimited products
          </div>
        </div>
      ` : ''}

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary"
          onclick="document.getElementById('licenseModal').classList.remove('active')">
          Close
        </button>
      </div>
    </div>`;

  modal.classList.add('active');

  if (!isPro) {
    document.getElementById('licenseActivateBtn').addEventListener('click', _handleActivateClick);
    document.getElementById('licenseKeyInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') _handleActivateClick();
    });
  }
}

async function _handleActivateClick() {
  const input  = document.getElementById('licenseKeyInput');
  const errEl  = document.getElementById('licenseActivateError');
  const btn    = document.getElementById('licenseActivateBtn');
  if (!input || !btn) return;

  const code = input.value.trim();
  btn.textContent = 'Activating…';
  btn.disabled = true;
  if (errEl) errEl.style.display = 'none';

  const result = await activateLicenseKey(code);

  btn.textContent = 'Activate';
  btn.disabled = false;

  if (!result.success) {
    if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
    return;
  }

  // Success
  document.getElementById('licenseModal').classList.remove('active');
  applyLicenseTier();
  showNotification('License activated! PRO features unlocked.', 'success');

  // Re-render settings toggles
  if (typeof renderBranding === 'function') renderBranding();
}

function _deactivateLicense() {
  if (!confirm('Remove this license? The app will revert to the free plan.')) return;
  _clearLicense();
  applyLicenseTier();
  document.getElementById('licenseModal')?.classList.remove('active');
  showNotification('License removed. Now on free plan.', 'success');
}

/* ── Sync status UI ────────────────────────────────── */
function updateSyncStatus(state, detail) {
  const dot   = document.getElementById('syncStatusDot');
  const label = document.getElementById('syncStatusLabel');
  const sub   = document.getElementById('syncStatusSub');
  const btn   = document.getElementById('syncNowBtn');
  if (!dot || !label) return;

  const states = {
    connected:  { color: '#16a34a', text: 'Connected to Supabase' },
    syncing:    { color: '#f59e0b', text: 'Checking…' },
    error:      { color: '#dc2626', text: 'Connection error' },
    idle:       { color: '#16a34a', text: 'Connected to Supabase' },
    offline:    { color: '#9ca3af', text: 'Offline — using local data' },
  };

  const s = states[state] || states.idle;
  dot.style.background    = s.color;
  label.textContent       = s.text;
  if (sub && detail) sub.textContent = detail;
  if (btn) btn.disabled = state === 'syncing';
}

async function triggerLicenseRevalidation() {
  updateSyncStatus('syncing', 'Connecting to Supabase…');
  const btn = document.getElementById('syncNowBtn');
  if (btn) btn.textContent = 'Checking…';

  try {
    // Ping Supabase with a simple request
    const res = await fetch(`${CAFLAT_SB_URL}/rest/v1/licenses?limit=1`, {
      headers: {
        'apikey': CAFLAT_SB_ANON,
        'Authorization': `Bearer ${CAFLAT_SB_ANON}`
      }
    });

    if (res.ok) {
      const now = new Date().toLocaleString('en-PH', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });

      // Also revalidate current license
      if (_licenseState) {
        await revalidateLicense();
        _licenseState.last_validated = new Date().toISOString();
        _saveLicenseToStorage(_licenseState);
      }

      updateSyncStatus('connected', `Last checked ${now} · License data only`);
      showNotification('Connected to Supabase', 'success');
    } else {
      updateSyncStatus('error', 'Could not reach Supabase');
    }
  } catch (e) {
    updateSyncStatus('offline', 'No internet connection');
  }

  if (btn) btn.textContent = 'Check Now';
}

/* ── Initialize ────────────────────────────────────── */
function initializeLicense() {
  _licenseState = _loadLicenseFromStorage();

  // Revalidate in background and update sync status
  (async () => {
    updateSyncStatus('syncing', 'Connecting…');
    try {
      const res = await fetch(`${CAFLAT_SB_URL}/rest/v1/licenses?limit=1`, {
        headers: { 'apikey': CAFLAT_SB_ANON, 'Authorization': `Bearer ${CAFLAT_SB_ANON}` }
      });
      if (res.ok) {
        await revalidateLicense();
        const now = new Date().toLocaleString('en-PH', {
          month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true
        });
        updateSyncStatus('connected', `Last checked ${now} · License data only`);
      } else {
        updateSyncStatus('error', 'Could not reach Supabase');
      }
    } catch (e) {
      updateSyncStatus('offline', 'No internet — using local data');
    }
  })();

  // Apply tier on init
  requestAnimationFrame(() => {
    applyLicenseTier();
  });
}

/* ── Exports ───────────────────────────────────────── */
window.initializeLicense          = initializeLicense;
window.applyLicenseTier           = applyLicenseTier;
window.openLicenseModal           = openLicenseModal;
window.getLicenseTier             = getLicenseTier;
window.isProTier                  = isProTier;
window.isFeatureAllowed           = isFeatureAllowed;
window.getProductLimit            = getProductLimit;
window.isAtProductLimit           = isAtProductLimit;
window.activateLicenseKey         = activateLicenseKey;
window._deactivateLicense         = _deactivateLicense;
window.updateSyncStatus           = updateSyncStatus;
window.triggerLicenseRevalidation = triggerLicenseRevalidation;
window.getTenantId                = getTenantId;
