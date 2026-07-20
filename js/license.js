/* ═══════════════════════════════════════════════════════
   LICENSE.JS — Caflat.CORE License & Tier Management
   Supabase-backed validation. Single-use keys.
═══════════════════════════════════════════════════════ */

const CAFLAT_SB_URL  = 'https://tkrsebalgonimmozbgqc.supabase.co';
const CAFLAT_SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcnNlYmFsZ29uaW1tb3piZ3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjc5NzEsImV4cCI6MjA5NzYwMzk3MX0.OKp5NCLYnL-5CFWnvXpA2E78jNi5r63Jzs2zABAkzsw';

const LICENSE_STORAGE_KEY    = 'caflat_license_v1';
const INTEGRITY_STORAGE_KEY  = '_cflx3';              // intentionally obscured
const FREE_PRODUCT_LIMIT     = 50;
const REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24 hours (was 7 days)

/* ── 90-day PRO trial ──────────────────────────────── */
const TRIAL_DAYS       = 90;
const TRIAL_ANCHOR_KEY = 'caflat_trial_anchor_v1';
let _trialJustStarted  = false;

// Views that need a paid tier; switchPage consults this so locked nav
// buttons open the upgrade prompt instead of the screen.
const TIER_GATED_VIEWS = {
  supply:     ['pro', 'The Supply hub'],
  production: ['pro', 'Production'],
  coffeecart: ['pro', 'Events & Coffee Cart'],
  foresight:  ['pro', 'Foresight forecasting'],
};

/* ── Tier definitions ──────────────────────────────── */
const TIER_FREE       = 'free';
const TIER_PRO        = 'pro';
const TIER_CLOUD      = 'cloud';
const TIER_ENTERPRISE = 'enterprise';
const TIER_GOD        = 'god';

const TIER_RANK = {
  [TIER_FREE]:       0,
  [TIER_PRO]:        1,
  [TIER_CLOUD]:      2,
  [TIER_ENTERPRISE]: 3,
  [TIER_GOD]:        99,
};

const CORE_FEATURES = [
  'pos', 'products', 'inventory', 'dashboard', 'sales', 'reports'
];

const PRO_FEATURES = [
  ...CORE_FEATURES,
  'supplier', 'production', 'coffeecart', 'productlab',
  'recipecatalog', 'shoppinglist', 'finishedgoods'
];

const CLOUD_FEATURES = [
  ...PRO_FEATURES,
  'cloudsync', 'cloudbackup'
];

const ENTERPRISE_FEATURES = [
  ...CLOUD_FEATURES,
  'enterprise'
];

const GOD_FEATURES = [
  ...ENTERPRISE_FEATURES,
  'god', 'origin', 'events', 'leads', 'labdrafts'
];

const TIER_FEATURES = {
  [TIER_FREE]:       CORE_FEATURES,
  [TIER_PRO]:        PRO_FEATURES,
  [TIER_CLOUD]:      CLOUD_FEATURES,
  [TIER_ENTERPRISE]: ENTERPRISE_FEATURES,
  [TIER_GOD]:        GOD_FEATURES,
};

/* ── Local license state ───────────────────────────── */
let _licenseState = null;

async function _loadLicenseFromStorage() {
  try {
    const raw  = localStorage.getItem(LICENSE_STORAGE_KEY);
    const hash = localStorage.getItem(INTEGRITY_STORAGE_KEY);
    if (!raw) return null;

    const license = JSON.parse(raw);

    // Trial grants are minted locally, so they ALWAYS carry a hash —
    // a trial record with a missing or wrong hash is a forgery.
    // (Non-trial records without a hash are legacy activations from
    // before hashing existed; keep them rather than strand real keys.)
    if (license.trial && !hash) {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
      localStorage.removeItem(INTEGRITY_STORAGE_KEY);
      return null;
    }

    if (hash) {
      const expected = await _computeIntegrityHash(license);
      if (expected !== hash) {
        // Tamper detected — wipe and fall back to free tier
        localStorage.removeItem(LICENSE_STORAGE_KEY);
        localStorage.removeItem(INTEGRITY_STORAGE_KEY);
        return null;
      }
    }

    return license;
  } catch { return null; }
}

async function _saveLicenseToStorage(data) {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(data));
  localStorage.setItem(INTEGRITY_STORAGE_KEY, await _computeIntegrityHash(data));
}

function _clearLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
  localStorage.removeItem(INTEGRITY_STORAGE_KEY);
  _licenseState = null;
}

// Binds tier + expiry + device to a hash — changing any field without
// recomputing the hash (key is in source, so this deters casual tampering)
async function _computeIntegrityHash(license) {
  const canonical = [
    license.code         || '',
    license.tier         || '',
    license.expires_at   || 'lifetime',
    license.device_id    || '',
    license.activated_at || '',
    LICENSE_STORAGE_KEY,
  ].join('');
  const buf = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(canonical)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ── Public API ────────────────────────────────────── */
function getLicenseTier() {
  if (!_licenseState) return TIER_FREE;
  const t = String(_licenseState.tier || '').toLowerCase();
  if (![TIER_PRO, TIER_CLOUD, TIER_ENTERPRISE, TIER_GOD].includes(t)) return TIER_FREE;
  // GOD tier never expires
  if (t === TIER_GOD) return TIER_GOD;
  // Check expiry
  if (_licenseState.expires_at && new Date(_licenseState.expires_at) < new Date()) {
    return TIER_FREE;
  }
  return t;
}

function isGodTier() { return getLicenseTier() === TIER_GOD; }

function isProTier()        { return TIER_RANK[getLicenseTier()] >= TIER_RANK[TIER_PRO]; }
function isCloudTier()      { return TIER_RANK[getLicenseTier()] >= TIER_RANK[TIER_CLOUD]; }
function isEnterpriseTier() { return TIER_RANK[getLicenseTier()] >= TIER_RANK[TIER_ENTERPRISE]; }

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

function getTenantId() {
  return _licenseState?.tenant_id || null;
}

function getTierLabel() {
  const t = getLicenseTier();
  return { free:'FREE', pro:'PRO', cloud:'CLOUD', enterprise:'ENTERPRISE', god:'GOD' }[t] || 'FREE';
}

/* ── Trial helpers ─────────────────────────────────── */
function isTrialRecord()  { return !!_licenseState?.trial; }
function isTrialActive()  { return isTrialRecord() && getLicenseTier() !== TIER_FREE; }
function isTrialExpired() { return isTrialRecord() && getLicenseTier() === TIER_FREE; }

function getTrialDaysLeft() {
  if (!isTrialRecord() || !_licenseState.expires_at) return null;
  const ms = new Date(_licenseState.expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

// Every fresh install gets 90 days of PRO. The start date is anchored in
// BOTH a dedicated localStorage key and APP_STATE.settings, and the expiry
// is bound into the integrity hash — deleting just the license record
// recreates the same trial window, not a new one.
async function _ensureTrial() {
  if (_licenseState) return;

  const anchors = [
    localStorage.getItem(TRIAL_ANCHOR_KEY),
    (typeof APP_STATE !== 'undefined' ? APP_STATE?.settings?.trialStartedAt : null),
  ].filter(a => a && !isNaN(new Date(a).getTime()));

  let anchor;
  if (anchors.length) {
    anchor = anchors.sort()[0]; // oldest known start wins
  } else {
    anchor = new Date().toISOString();
    _trialJustStarted = true;
  }

  localStorage.setItem(TRIAL_ANCHOR_KEY, anchor);
  if (typeof APP_STATE !== 'undefined' && APP_STATE?.settings &&
      APP_STATE.settings.trialStartedAt !== anchor) {
    APP_STATE.settings.trialStartedAt = anchor;
    if (typeof persistState === 'function') persistState();
  }

  const expires  = new Date(new Date(anchor).getTime() + TRIAL_DAYS * 86400000).toISOString();
  const deviceId = await _generateDeviceId();
  // Trials get a real tenant id so cloud backup and the remote dashboard
  // work during the trial — tasting them is the whole point.
  const trialTenant =
    localStorage.getItem('caflat_trial_tenant_v1') ||
    (crypto.randomUUID ? crypto.randomUUID() : null);
  if (trialTenant) localStorage.setItem('caflat_trial_tenant_v1', trialTenant);

  const record = {
    code:           'TRIAL',
    tier:           TIER_PRO,
    trial:          true,
    client_name:    'PRO Trial',
    tenant_id:      trialTenant,
    expires_at:     expires,
    activated_at:   anchor,
    device_id:      deviceId,
    last_validated: new Date().toISOString(),
    nudges:         {},
  };
  await _saveLicenseToStorage(record);
  _licenseState = record;
}

/* ── Tier gate with upgrade prompt ─────────────────── */
function requireTier(tierNeeded, featureLabel) {
  if (TIER_RANK[getLicenseTier()] >= (TIER_RANK[tierNeeded] ?? 99)) return true;
  const tail = isTrialExpired()
    ? 'Your PRO trial has ended, but everything you built is safe and waiting. Upgrade to pick up right where you left off.'
    : 'Upgrade to unlock it. Anything you create is yours and stays saved.';
  openLicenseModal(`${featureLabel} is a ${String(tierNeeded).toUpperCase()} feature. ${tail}`);
  return false;
}

/* ── Trial nudges (once per threshold) ─────────────── */
async function _maybeShowTrialNudge() {
  if (!isTrialRecord()) return;
  const nudges = _licenseState.nudges || (_licenseState.nudges = {});

  if (isTrialExpired()) {
    if (nudges.ended) return;
    nudges.ended = true;
    await _saveLicenseToStorage(_licenseState);
    openLicenseModal('Your 90-day PRO trial has ended. Everything you built — products, sales, clients — is safe and waiting. Upgrade to keep the full system, or continue on the Free plan.');
    return;
  }

  const days = getTrialDaysLeft();
  const thresholds = [14, 7, 1].filter(t => days <= t);
  if (!thresholds.length) return;
  const smallest = Math.min(...thresholds);
  const flag = 'd' + smallest;
  if (nudges[flag]) return;
  thresholds.forEach(t => { nudges['d' + t] = true; });
  await _saveLicenseToStorage(_licenseState);
  openLicenseModal(days <= 1
    ? 'Your PRO trial ends today. Upgrade now so the counter never skips a beat — your data carries over exactly as it is.'
    : `Your PRO trial ends in ${days} days. Upgrade anytime — your data carries over exactly as it is.`);
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

  // Multi-device tiers: CLOUD, ENTERPRISE, GOD — no single-device restriction
  const isMultiDeviceTier = [TIER_CLOUD, TIER_ENTERPRISE, TIER_GOD].includes(license.tier);
  if (license.activated && !isMultiDeviceTier) {
    return { success: false, error: 'This key has already been used on another device. Upgrade to CLOUD for multi-device.' };
  }

  // Check expiry at activation time
  const expiresAt = license.expires_at ? new Date(license.expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return { success: false, error: 'This license key has expired.' };
  }

  // 2. Generate a device fingerprint
  const deviceId = await _generateDeviceId();

  // 3. Mark as activated in Supabase (skip if already activated on another device — don't overwrite)
  if (!license.activated) {
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

  await _saveLicenseToStorage(stored);
  _licenseState = stored;

  return { success: true, license: stored };
}

/* ── Periodic revalidation ─────────────────────────── */
async function revalidateLicense(force = false) {
  if (!_licenseState) return;
  if (_licenseState.trial) return; // trials are local grants — no server record

  const lastCheck = new Date(_licenseState.last_validated || 0);
  if (!force && Date.now() - lastCheck.getTime() < REVALIDATE_INTERVAL_MS) return;

  const result = await _sbFetch(
    `licenses?code=eq.${encodeURIComponent(_licenseState.code)}&select=revoked,activated,expires_at,tier`
  );

  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return;

  const remote = result.data[0];

  if (remote.revoked) {
    _clearLicense();
    showNotification('Your license has been revoked. Reverted to free plan.', 'error');
    applyLicenseTier();
    return;
  }

  // Sync tier from server in case it was changed (e.g. downgrade)
  if (remote.tier && remote.tier !== _licenseState.tier) {
    _licenseState.tier = remote.tier;
  }

  _licenseState.last_validated = new Date().toISOString();
  await _saveLicenseToStorage(_licenseState);
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
  const tier    = getLicenseTier();
  const isPaid  = isProTier(); // true for pro/cloud/enterprise
  const isCloud = isCloudTier();

  // Update Settings license section
  const statusLabel = document.getElementById('licenseStatusLabel');
  const statusSub   = document.getElementById('licenseStatusSub');
  const openBtn     = document.getElementById('openLicenseBtn');

  const TIER_DISPLAY = {
    free:       { label: 'Free Plan',       color: '' },
    pro:        { label: '✓ PRO',           color: '#15803d' },
    cloud:      { label: '✓ CLOUD',         color: '#2563eb' },
    enterprise: { label: '✓ ENTERPRISE',    color: '#7e22ce' },
    god:        { label: 'GOD MODE',         color: 'var(--black)' },
  };
  const display = TIER_DISPLAY[tier] || TIER_DISPLAY.free;

  if (statusLabel) {
    if (isTrialActive()) {
      statusLabel.textContent = '✓ PRO TRIAL';
      statusLabel.style.color = getTrialDaysLeft() <= 14 ? '#b45309' : '#15803d';
    } else {
      statusLabel.textContent = display.label;
      statusLabel.style.color = display.color;
    }
  }
  if (statusSub) {
    if (isTrialActive()) {
      statusSub.textContent = `PRO trial · ${getTrialDaysLeft()} days left · then Free plan (your data stays)`;
    } else if (isPaid) {
      const expiry = _licenseState?.expires_at
        ? new Date(_licenseState.expires_at).toLocaleDateString('en-PH', {year:'numeric',month:'long',day:'numeric'})
        : 'Lifetime';
      const featureNote = isCloud ? 'Auto cloud sync enabled' : 'All features unlocked';
      statusSub.textContent = `${_licenseState?.client_name || ''} · ${featureNote} · Expires ${expiry}`;
    } else {
      statusSub.textContent = `Up to ${FREE_PRODUCT_LIMIT} products · Core features only`;
    }
  }
  if (openBtn) openBtn.textContent = isPaid ? (isTrialActive() ? 'Upgrade Now' : 'Manage License') : 'Enter License Key';

  // Update nav badge
  _renderLicenseBadge();

  // Gate optional modes — only available on PRO+
  const proOnlyToggles = [
    'settingsSupplierMode', 'settingsProductionMode', 'settingsCoffeeCartMode',
    'settingsProductLabMode', 'settingsRecipeCatalogMode', 'settingsShoppingList',
    'settingsOriginMode',
  ];

  proOnlyToggles.forEach(id => {
    const row = document.getElementById(id)?.closest('.settings-toggle-row');
    if (row) {
      if (!isPaid) {
        row.style.opacity = '0.4';
        row.style.pointerEvents = 'none';
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

  if (!isPaid) {
    // Keep the PRO nav buttons VISIBLE but locked — the click opens the
    // upgrade prompt via the switchPage gate (see TIER_GATED_VIEWS), which
    // sells better than features silently vanishing. Do NOT mutate
    // APP_STATE.settings so the user's toggle choices survive reload.
    ['navSupply','navProduction','navCoffeeCart','navForesight'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = '';
      el.style.opacity = '.45';
      if (!el.querySelector('.pro-lock-badge')) {
        const chip = document.createElement('span');
        chip.className = 'pro-lock-badge';
        chip.textContent = 'PRO';
        chip.style.cssText = 'font-size:8px;font-weight:900;padding:1px 6px;border-radius:999px;background:#0f0f0f;color:#fff;letter-spacing:1px;margin-left:auto;';
        el.appendChild(chip);
      }
    });
    if (typeof updateOpsNavGroup === 'function') updateOpsNavGroup();
  } else {
    ['navSupply','navProduction','navCoffeeCart','navForesight'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.opacity = '';
      el.querySelector('.pro-lock-badge')?.remove();
    });
    // One-time migration: old code used to write false into APP_STATE.settings for all
    // pro features whenever the free tier ran before the license loaded. Reset them once.
    const MIG_KEY = 'caflat_pro_features_restored_v1';
    if (!localStorage.getItem(MIG_KEY) && APP_STATE.settings) {
      ['supplierModeEnabled','productionModeEnabled','coffeeCartModeEnabled',
       'productLabModeEnabled','recipeCatalogEnabled','shoppingListEnabled','originModeEnabled']
        .forEach(k => { APP_STATE.settings[k] = true; });
      if (typeof persistState === 'function') persistState();
      localStorage.setItem(MIG_KEY, '1');
    }
    // Paid tier — apply each toggle so the nav/UI reflects what settings say
    if (typeof applySupplierModeToggle    === 'function') applySupplierModeToggle();
    if (typeof applyProductionModeToggle  === 'function') applyProductionModeToggle();
    if (typeof applyCoffeeCartModeToggle  === 'function') applyCoffeeCartModeToggle();
    if (typeof applyShoppingListToggle    === 'function') applyShoppingListToggle();
    if (typeof applyOriginModeToggle      === 'function') applyOriginModeToggle();
    if (typeof applyProductLabModeToggle  === 'function') applyProductLabModeToggle();
    if (typeof applyRecipeCatalogToggle   === 'function') applyRecipeCatalogToggle();
    if (typeof applyTreasuryModeToggle    === 'function') applyTreasuryModeToggle();
    if (typeof applyDailyCloseToggle      === 'function') applyDailyCloseToggle();
    if (typeof updateOpsNavGroup          === 'function') updateOpsNavGroup();
  }

  // Caflat 2.0 launcher — visible only on GOD tier while 2.0 is in active development
  const miseNav = document.getElementById('navMise');
  if (miseNav) miseNav.style.display = isGodTier() ? '' : 'none';

  // Hide cloud upsell if already on CLOUD+
  const upsellBanner = document.getElementById('cloudSyncUpsellBanner');
  if (upsellBanner) upsellBanner.style.display = isCloud ? 'none' : 'block';

  // Start sync engine if CLOUD/ENTERPRISE
  if (isCloud && typeof initSyncEngine === 'function') {
    initSyncEngine();
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

  const BADGE_STYLES = {
    free:       { text: 'FREE',       bg: '#f0f0f0', color: '#555' },
    pro:        { text: 'PRO',        bg: '#0f0f0f', color: '#fff' },
    cloud:      { text: 'CLOUD',      bg: '#2563eb', color: '#fff' },
    enterprise: { text: 'ENTERPRISE', bg: '#7e22ce', color: '#fff' },
    god:        { text: 'GOD',        bg: '#fff',    color: '#0a0a0b' },
  };
  let style = BADGE_STYLES[getLicenseTier()] || BADGE_STYLES.free;
  if (isTrialActive()) {
    const days = getTrialDaysLeft();
    style = days <= 14
      ? { text: `TRIAL · ${days}d`, bg: '#b45309', color: '#fff' }
      : { text: `TRIAL · ${days}d`, bg: '#0f0f0f', color: '#c8a96e' };
  }
  badge.textContent        = style.text;
  badge.style.background   = style.bg;
  badge.style.color        = style.color;
}

/* ── License modal ─────────────────────────────────── */
function openLicenseModal(contextMessage) {
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

  const info    = getLicenseInfo();
  const tier    = getLicenseTier();
  const isPaid  = isProTier();
  const isCloud_ = isCloudTier();
  const expiry  = info?.expires_at
    ? new Date(info.expires_at).toLocaleDateString('en-PH', {year:'numeric',month:'long',day:'numeric'})
    : null;

  const TIER_COLORS = {
    free:       { bg:'#f4f4f4', color:'#555',    border:'#e0e0e0' },
    pro:        { bg:'#0f0f0f', color:'#fff',    border:'#0f0f0f' },
    cloud:      { bg:'#1d4ed8', color:'#fff',    border:'#1d4ed8' },
    enterprise: { bg:'#7e22ce', color:'#fff',    border:'#7e22ce' },
    god:        { bg:'#0a0a0b', color:'#fff',    border:'#0a0a0b' },
  };
  const tc = TIER_COLORS[tier] || TIER_COLORS.free;

  const plans = [
    {
      tier:'FREE', price:'₱0', color:'#555', bg:'#f4f4f4', border:'#e0e0e0',
      features:['Core POS, inventory & sales','Up to 50 products','Local storage only','—','—'],
    },
    {
      tier:'PRO', price:'₱499/mo', color:'#fff', bg:'#0f0f0f', border:'#0f0f0f',
      features:['Unlimited products','All optional modes','Supplier, Production, Events','Product Lab & Recipe Catalog','Manual cloud backup'],
    },
    {
      tier:'CLOUD', price:'₱899/mo', color:'#fff', bg:'#2563eb', border:'#2563eb',
      features:['Everything in PRO','Auto sync after every sale','Multi-device (up to 2)','10 cloud backup snapshots','Restore from cloud anytime'],
    },
    {
      tier:'ENTERPRISE', price:'Custom', color:'#fff', bg:'#7e22ce', border:'#7e22ce',
      features:['Everything in CLOUD','Unlimited devices','Priority support','Custom onboarding','More features coming'],
    },
  ];

  const plansHtml = `
    <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;
      color:var(--gray-400);font-weight:800;margin-bottom:12px;">Plans</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px;">
      ${plans.map(p => {
        const isCurrent = p.tier.toLowerCase() === tier;
        return `
          <div style="border:2px solid ${isCurrent ? p.border : 'var(--border)'};
            border-radius:var(--radius-lg);overflow:hidden;
            display:flex;flex-direction:column;">
            <div style="background:${isCurrent ? p.bg : 'var(--gray-50)'};
              padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:900;letter-spacing:1px;
                color:${isCurrent ? p.color : 'var(--black)'};">${p.tier}</span>
              <span style="font-size:11px;font-weight:800;
                color:${isCurrent ? p.color : 'var(--gray-500)'};">${p.price}</span>
            </div>
            <div style="padding:10px 12px;flex:1;">
              ${p.features.map(f => `
                <div style="font-size:11px;margin-bottom:4px;display:flex;gap:5px;
                  color:${f==='—'?'var(--gray-200)':'var(--gray-700)'};">
                  <span style="flex-shrink:0;color:${f==='—'?'var(--gray-200)':'#16a34a'};">${f==='—'?'—':'✓'}</span>
                  ${f==='—'?'':f}
                </div>`).join('')}
            </div>
            <div style="padding:6px 12px;text-align:center;font-size:9px;font-weight:900;
              letter-spacing:1px;background:${isCurrent ? p.bg : 'var(--gray-50)'};
              color:${isCurrent ? p.color : 'var(--gray-200)'};">
              ${isCurrent ? 'CURRENT PLAN' : '&nbsp;'}
            </div>
          </div>`;
      }).join('')}
    </div>`;


  const contextHtml = (typeof contextMessage === 'string' && contextMessage) ? `
    <div style="padding:12px 14px;border-radius:var(--radius-md);margin-bottom:16px;
      background:#fffbeb;border:1.5px solid #f59e0b;color:#92400e;
      font-size:12.5px;line-height:1.55;font-weight:600;">
      ${contextMessage}
    </div>` : '';

  const trialCardHtml = isTrialActive() ? `
    <div style="padding:16px;border-radius:var(--radius-lg);background:#0f0f0f;
      border:1.5px solid #0f0f0f;margin-bottom:16px;text-align:center;">
      <div style="font-size:20px;font-weight:900;letter-spacing:2px;color:#c8a96e;">PRO TRIAL</div>
      <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:4px;">
        ${getTrialDaysLeft()} days left · all PRO features unlocked · then Free plan</div>
      <div style="margin-top:6px;font-size:10px;font-weight:700;color:rgba(255,255,255,.45);letter-spacing:.5px;">
        YOUR DATA STAYS EITHER WAY</div>
    </div>` : '';

  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <h3>License</h3>
      ${contextHtml}
      ${trialCardHtml}
      ${(isPaid && !isTrialActive()) ? `
        <div style="padding:16px;border-radius:var(--radius-lg);background:${tc.bg};
          border:1.5px solid ${tc.border};margin-bottom:20px;text-align:center;">
          <div style="font-size:24px;font-weight:900;letter-spacing:2px;color:${tc.color};">
            ${tier.toUpperCase()}</div>
          <div style="font-size:12px;color:${tc.color==='#fff'?'rgba(255,255,255,.6)':'#555'};margin-top:4px;">
            ${info?.client_name || ''}${expiry ? ' · Expires '+expiry : ' · Lifetime'}</div>
          ${isCloud_ ? '<div style="margin-top:6px;font-size:10px;font-weight:800;color:rgba(255,255,255,.8);letter-spacing:1px;">AUTO SYNC ACTIVE</div>' : ''}
        </div>
        <div style="text-align:center;margin-bottom:16px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="_deactivateLicense()">
            Remove License</button>
        </div>
      ` : `
        <div style="margin-bottom:20px;">
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
      `}
      ${plansHtml}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary"
          onclick="document.getElementById('licenseModal').classList.remove('active')">
          Close</button>
      </div>
    </div>`;

  modal.classList.add('active');

  if (!isPaid || isTrialActive()) {
    document.getElementById('licenseActivateBtn')?.addEventListener('click', _handleActivateClick);
    document.getElementById('licenseKeyInput')?.addEventListener('keydown', e => {
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
  updateSyncStatus('syncing', 'Connecting…');
  const checkBtn = document.getElementById('checkLicenseBtn');
  if (checkBtn) { checkBtn.textContent = 'Checking…'; checkBtn.disabled = true; }

  try {
    // 1. Test basic connectivity via licenses table
    const res = await fetch(`${CAFLAT_SB_URL}/rest/v1/licenses?limit=1`, {
      headers: { 'apikey': CAFLAT_SB_ANON, 'Authorization': `Bearer ${CAFLAT_SB_ANON}` }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = `HTTP ${res.status}${body ? ' — ' + body.slice(0, 80) : ''}`;
      updateSyncStatus('error', detail);
      showNotification('Supabase error: ' + detail, 'error');
      if (checkBtn) { checkBtn.textContent = 'Check License'; checkBtn.disabled = false; }
      return;
    }

    // 2. Revalidate license
    if (_licenseState) await revalidateLicense(true);

    // 3. If on cloud tier, test sync_log INSERT permission (the actual failing operation)
    if (typeof isCloudTier === 'function' && isCloudTier()) {
      const syncRes = await fetch(`${CAFLAT_SB_URL}/rest/v1/sync_log`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        CAFLAT_SB_ANON,
          'Authorization': `Bearer ${CAFLAT_SB_ANON}`,
          'Prefer':        'return=minimal'
        },
        body: JSON.stringify({ _test: true }) // intentionally invalid — 400 = allowed, 403 = blocked
      });
      if (syncRes.status === 403 || syncRes.status === 401) {
        const body = await syncRes.text().catch(() => '');
        const detail = `sync_log INSERT blocked (HTTP ${syncRes.status}) — run the RLS policy SQL in Supabase`;
        updateSyncStatus('error', detail);
        showNotification('Sync blocked: RLS policy missing on sync_log. Check Settings for fix.', 'error');
        if (checkBtn) { checkBtn.textContent = 'Check License'; checkBtn.disabled = false; }
        return;
      }
      // 400 = permission ok, just bad data (expected) — that's fine
    }

    // 4. If on cloud tier, do a real sync push now to clear any stale error indicator
    if (typeof isCloudTier === 'function' && isCloudTier() &&
        typeof syncNow === 'function') {
      if (checkBtn) checkBtn.textContent = 'Syncing…';
      const result = await syncNow();
      // syncNow already shows a notification; just update the sub-label
      if (checkBtn) { checkBtn.textContent = 'Check License'; checkBtn.disabled = false; }
      return;
    }

    const now = new Date().toLocaleString('en-PH', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    updateSyncStatus('connected', `Last checked ${now}`);
    showNotification('Connected to Supabase — all good', 'success');

  } catch (e) {
    updateSyncStatus('offline', 'No internet — ' + e.message.slice(0, 60));
    showNotification('Cannot reach Supabase: ' + e.message.slice(0, 80), 'error');
  }

  if (checkBtn) { checkBtn.textContent = 'Check License'; checkBtn.disabled = false; }
}

/* ── Initialize ────────────────────────────────────── */
function _showFirstRunOnboarding() {
  let overlay = document.getElementById('firstRunOverlay');
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'firstRunOverlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9000',
    'background:rgba(0,0,0,.82);backdrop-filter:blur(6px)',
    'display:flex;align-items:center;justify-content:center;padding:24px',
  ].join(';');
  overlay.innerHTML = `
    <div style="background:#111;border:1.5px solid rgba(255,255,255,.12);border-radius:18px;
      padding:40px 36px;max-width:440px;width:100%;text-align:center;">
      <div style="font-size:2rem;margin-bottom:4px;">☕</div>
      <h2 style="color:#fff;font-size:1.35rem;font-weight:800;margin-bottom:6px;letter-spacing:-.02em;">
        Your ${TRIAL_DAYS}-day PRO trial has started
      </h2>
      <div style="display:inline-block;background:rgba(200,169,110,.14);border:1px solid rgba(200,169,110,.4);
        color:#c8a96e;font-size:.68rem;font-weight:800;letter-spacing:1.5px;border-radius:999px;
        padding:5px 14px;margin-bottom:14px;">EVERYTHING UNLOCKED</div>
      <p style="color:rgba(255,255,255,.55);font-size:.88rem;line-height:1.65;margin-bottom:26px;">
        POS, inventory, production, the B2B supply hub — the full system is yours
        for ${TRIAL_DAYS} days. No credit card. When the trial ends, your data stays
        and you can keep going on the Free plan or upgrade.
      </p>
      <button onclick="document.getElementById('firstRunOverlay').remove()"
        style="width:100%;background:#fff;color:#000;border:none;border-radius:10px;
          padding:14px;font-size:.95rem;font-weight:800;cursor:pointer;margin-bottom:12px;">
        Start Brewing
      </button>
      <button onclick="document.getElementById('firstRunOverlay').remove();openLicenseModal();"
        style="background:none;border:none;color:rgba(255,255,255,.35);font-size:.82rem;
          cursor:pointer;padding:4px;">
        I already have a license key
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

// Fast path: load from local storage only (no network). Called by initializeApp
// so renderEverything() runs with the correct tier, not null.
async function initializeLicenseFast() {
  if (!_licenseState) {
    _licenseState = await _loadLicenseFromStorage();
  }
  // Fresh installs (and tampered/self-deleted records) get the local PRO
  // trial grant here so the very first render runs at the right tier.
  await _ensureTrial();
}

async function initializeLicense() {
  // Skip storage re-load if initializeLicenseFast already ran
  if (!_licenseState) {
    _licenseState = await _loadLicenseFromStorage();
  }
  await _ensureTrial();

  // Apply tier immediately with what local storage gives us
  applyLicenseTier();

  // First-time users: welcome them into the trial that just started.
  // Returning trial users: nudge as the clock runs down / runs out.
  if (_trialJustStarted) {
    setTimeout(_showFirstRunOnboarding, 800);
  } else {
    setTimeout(() => { _maybeShowTrialNudge(); }, 1200);
  }

  // Always validate against Supabase on every startup (not just every 24h)
  updateSyncStatus('syncing', 'Connecting…');
  try {
    const res = await fetch(`${CAFLAT_SB_URL}/rest/v1/licenses?limit=1`, {
      headers: { 'apikey': CAFLAT_SB_ANON, 'Authorization': `Bearer ${CAFLAT_SB_ANON}` }
    });
    if (res.ok) {
      await revalidateLicense(true); // force=true — always re-check on startup
      applyLicenseTier();            // re-apply in case tier/revoke changed server-side
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
}

/* ── Exports ───────────────────────────────────────── */
window.initializeLicenseFast      = initializeLicenseFast;
window.initializeLicense          = initializeLicense;
window.applyLicenseTier           = applyLicenseTier;
window.openLicenseModal           = openLicenseModal;
window.getLicenseTier             = getLicenseTier;
window.isProTier                  = isProTier;
window.isCloudTier                = isCloudTier;
window.isEnterpriseTier           = isEnterpriseTier;
window.isGodTier                  = isGodTier;
window.getTierLabel               = getTierLabel;
window.isFeatureAllowed           = isFeatureAllowed;
window.getProductLimit            = getProductLimit;
window.isAtProductLimit           = isAtProductLimit;
window.activateLicenseKey         = activateLicenseKey;
window._deactivateLicense         = _deactivateLicense;
window.updateSyncStatus           = updateSyncStatus;
window.triggerLicenseRevalidation = triggerLicenseRevalidation;
window.getTenantId                = getTenantId;
window._sbFetch                   = _sbFetch;
window.requireTier                = requireTier;
window.isTrialActive              = isTrialActive;
window.isTrialExpired             = isTrialExpired;
window.getTrialDaysLeft           = getTrialDaysLeft;
window.TIER_GATED_VIEWS           = TIER_GATED_VIEWS;
window.CAFLAT_SB_URL_PUBLIC       = CAFLAT_SB_URL;
window.CAFLAT_SB_ANON_PUBLIC      = CAFLAT_SB_ANON;
