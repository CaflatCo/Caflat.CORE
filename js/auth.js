/* ═══════════════════════════════════════════════════════
   AUTH.JS — Authentication System
   • First-launch setup (owner sets own passwords)
   • SHA-256 hashed passwords (never stored plaintext)
   • Recovery code for forgotten passwords
   • Change password from Settings
   • Per-role login (Admin / Staff)
═══════════════════════════════════════════════════════ */

const AUTH_STORAGE_KEY  = 'caflat_auth';
const AUTH_CREDS_KEY    = 'caflat_credentials';
const AUTH_RECOVERY_KEY = 'caflat_recovery';

/* ── SHA-256 helper (kept only to verify legacy-format stored hashes) ── */
async function _sha256(str) {
  const buf  = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ═══════════════════════════════════════════════════════
   SECRET HASHING — salted PBKDF2-SHA256
   Login passwords and the void PIN used to be a single
   unsalted SHA-256 round, which is fast to brute-force
   offline if the stored hash is ever read (e.g. devtools
   access on a shared terminal). New/changed secrets use this
   scheme instead; verifySecret() still accepts the old bare-
   hash string format so existing installs keep working, and
   opportunistically upgrades to this scheme the moment a
   legacy secret is next verified successfully (the plaintext
   is only ever available right at that moment).
═══════════════════════════════════════════════════════ */
const PBKDF2_ITERATIONS = 210000; // OWASP-recommended floor for PBKDF2-SHA256 (2023)

function _randomSaltHex(bytes = 16) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _deriveHash(secret, saltHex, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash a new secret — always uses the strong scheme.
async function hashSecret(secret) {
  const salt = _randomSaltHex();
  const hash = await _deriveHash(secret, salt);
  return { salt, hash, iterations: PBKDF2_ITERATIONS, scheme: 'pbkdf2' };
}

// Verify a secret against a stored record. Accepts either the new
// { scheme:'pbkdf2', salt, hash, iterations } shape or a legacy bare
// hex-string SHA-256 hash.
async function verifySecret(secret, stored) {
  if (!stored) return false;
  if (typeof stored === 'string') {
    const legacyHash = await _sha256(secret);
    return legacyHash === stored;
  }
  if (stored.scheme === 'pbkdf2' && stored.salt && stored.hash) {
    const computed = await _deriveHash(secret, stored.salt, stored.iterations || PBKDF2_ITERATIONS);
    return computed === stored.hash;
  }
  return false;
}

// True only for the legacy bare-string format — used to decide whether
// to opportunistically re-hash after a successful verify.
function _isLegacySecret(stored) { return typeof stored === 'string'; }

/* ── Recovery code generator (12 alphanumeric chars) ── */
function _generateRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code; // format: XXXX-XXXX-XXXX
}

/* ── Credentials storage ── */
function getStoredCredentials() {
  try {
    const raw = localStorage.getItem(AUTH_CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCredentials(creds) {
  localStorage.setItem(AUTH_CREDS_KEY, JSON.stringify(creds));
}

function isFirstLaunch() {
  return !getStoredCredentials();
}

/* ── Session ── */
function getAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && parsed.role) ? parsed : null;
  } catch { return null; }
}

function saveAuthSession(username, role) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username, role }));
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/* ── Shell visibility ── */
function showAppShell() {
  const loginScreen = document.getElementById('loginScreen');
  const app = document.getElementById('app');
  document.body.classList.remove('login-active');
  document.body.style.overflow = 'auto';
  if (loginScreen) {
    loginScreen.style.display     = 'none';
    loginScreen.style.visibility  = 'hidden';
    loginScreen.style.opacity     = '0';
    loginScreen.style.pointerEvents = 'none';
  }
  if (app) {
    app.style.display       = 'flex';
    app.style.visibility    = 'visible';
    app.style.opacity       = '1';
    app.style.pointerEvents = 'auto';
    app.classList.add('authenticated');
  }
}

function showLoginShell() {
  const loginScreen = document.getElementById('loginScreen');
  const app = document.getElementById('app');
  document.body.classList.add('login-active');
  if (app) {
    app.classList.remove('authenticated');
    app.style.display = 'none';
  }
  if (loginScreen) {
    loginScreen.style.display      = 'flex';
    loginScreen.style.visibility   = 'visible';
    loginScreen.style.opacity      = '1';
    loginScreen.style.pointerEvents = 'auto';
  }
}


/* ═══════════════════════════════════════════════════════
   ROLE-BASED ACCESS CONTROL
   Called after every login. Hides/shows UI based on role.
═══════════════════════════════════════════════════════ */
function applyRoleAccess(role) {
  const isAdmin = role === 'ADMIN';

  /* ── Helper to show/hide elements by ID or selector ── */
  const show = id => { const el = typeof id === 'string' && id.startsWith('[')
    ? document.querySelector(id) : document.getElementById(id);
    if (el) el.style.display = ''; };
  const hide = id => { const el = typeof id === 'string' && id.startsWith('[')
    ? document.querySelector(id) : document.getElementById(id);
    if (el) el.style.display = 'none'; };
  const showEl = el => { if (el) el.style.display = ''; };
  const hideEl = el => { if (el) el.style.display = 'none'; };

  /* ── Nav tabs ── */
  // Staff sees: POS, Dashboard, Inventory, Sales, Production
  // Admin sees: everything (mode toggles control Supply/Events/Production)
  const staffHideNav = ['reports', 'ingredients', 'settings'];
  document.querySelectorAll('nav [data-view]').forEach(btn => {
    const view = btn.dataset.view;
    if (!isAdmin && staffHideNav.includes(view)) {
      btn.style.display = 'none';
    } else {
      // Don't override mode-toggle visibility (navSupply etc) — only reset staff-hidden ones
      if (staffHideNav.includes(view)) btn.style.display = '';
    }
  });

  /* ── Products page ── */
  // Staff can VIEW products but not add/edit/delete/export
  ['addProductBtn', 'exportDataBtnProducts', 'loadDemoBtnProducts'].forEach(
    id => isAdmin ? show(id) : hide(id)
  );
  // Edit/Delete buttons in product table — re-render handles this via renderProductsTable
  // We set a flag that renderProductsTable reads
  window._staffMode = !isAdmin;

  /* ── Ingredients page ── */
  // Staff has no access — nav hidden above, but guard the add button too
  if (!isAdmin) hide('addIngredientBtn');
  else show('addIngredientBtn');

  /* ── Settings page ── */
  // Staff can't reach settings (nav hidden), but guard reset button too
  ['resetDataBtn', 'loadDemoBtn', 'exportDataBtn', 'importDataBtn'].forEach(
    id => isAdmin ? show(id) : hide(id)
  );

  /* ── Reports nav already hidden for staff above ── */

  /* ── Supply/Events/Production nav ── */
  // These are controlled by mode toggles — only additionally restrict for staff
  // Staff CAN use Production (log batches) but not Supply
  if (!isAdmin) {
    const navSupply = document.getElementById('navSupply');
    if (navSupply && navSupply.style.display !== 'none') navSupply.style.display = 'none';
  }
}

function applyAuth(role) {
  showAppShell();
  const roleBadge = document.getElementById('roleBadge');
  if (roleBadge) roleBadge.textContent = String(role || 'STAFF').toUpperCase();
  if (typeof switchPage     === 'function') switchPage('pos');
  if (typeof renderBranding === 'function') renderBranding();
  // Apply role access after DOM is ready
  requestAnimationFrame(() => applyRoleAccess(role));
}

/* ── Login error helpers ── */
function _showLoginError(msg) {
  const errEl = document.getElementById('loginError');
  const card  = document.getElementById('loginCard');
  const passEl = document.getElementById('loginPassword');
  if (errEl) {
    errEl.textContent = msg || 'Incorrect username or password';
    errEl.style.display = 'block';
    clearTimeout(window._loginErrTimer);
    window._loginErrTimer = setTimeout(() => { errEl.style.display = 'none'; }, 4000);
  }
  if (card) {
    card.classList.remove('login-shake');
    void card.offsetWidth;
    card.classList.add('login-shake');
  }
  if (passEl) { passEl.value = ''; passEl.focus(); }
}

function _hideLoginError() {
  const e = document.getElementById('loginError');
  if (e) e.style.display = 'none';
}

/* ═══════════════════════════════════════════════════════
   FIRST LAUNCH SETUP
═══════════════════════════════════════════════════════ */
function showSetupScreen() {
  const loginCard = document.getElementById('loginCard');
  if (!loginCard) return;

  loginCard.innerHTML = `
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="text-align:center;">Caflat.CORE</h2>
      <div class="login-subtitle" style="margin-bottom:0;">First-time Setup</div>
    </div>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:20px;text-align:center;line-height:1.6;">
      Set your credentials before you start.<br>Keep these safe — you'll need them to log in.
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
      color:var(--gray-400);margin-bottom:8px;">Admin Account</div>
    <input id="setupAdminUser" type="text" placeholder="Admin username"
      autocomplete="username" style="margin-bottom:8px;" />
    <input id="setupAdminPass" type="password" placeholder="Admin password (min 6 chars)"
      autocomplete="new-password" style="margin-bottom:8px;" />
    <input id="setupAdminConfirm" type="password" placeholder="Confirm admin password"
      autocomplete="new-password" style="margin-bottom:16px;" />

    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
      color:var(--gray-400);margin-bottom:8px;">Staff Account</div>
    <input id="setupStaffUser" type="text" placeholder="Staff username"
      autocomplete="username" style="margin-bottom:8px;" />
    <input id="setupStaffPass" type="password" placeholder="Staff password (min 4 chars)"
      autocomplete="new-password" style="margin-bottom:8px;" />
    <input id="setupStaffConfirm" type="password" placeholder="Confirm staff password"
      autocomplete="new-password" style="margin-bottom:20px;" />

    <div id="setupError" style="display:none;background:#fef2f2;border:1.5px solid #fecaca;
      border-radius:8px;padding:10px 14px;margin-bottom:12px;
      font-size:12px;font-weight:600;color:#dc2626;text-align:center;"></div>

    <button id="setupSaveBtn" type="button">Complete Setup</button>
  `;

  document.getElementById('setupSaveBtn')
    .addEventListener('click', completeSetup);

  document.getElementById('setupStaffConfirm')
    .addEventListener('keydown', e => { if (e.key === 'Enter') completeSetup(); });
}

async function completeSetup() {
  const adminUser    = (document.getElementById('setupAdminUser')?.value || '').trim().toLowerCase();
  const adminPass    = document.getElementById('setupAdminPass')?.value || '';
  const adminConfirm = document.getElementById('setupAdminConfirm')?.value || '';
  const staffUser    = (document.getElementById('setupStaffUser')?.value || '').trim().toLowerCase();
  const staffPass    = document.getElementById('setupStaffPass')?.value || '';
  const staffConfirm = document.getElementById('setupStaffConfirm')?.value || '';
  const errEl        = document.getElementById('setupError');

  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };

  if (!adminUser) return showErr('Admin username is required.');
  if (adminUser.length < 3) return showErr('Admin username must be at least 3 characters.');
  if (!staffUser) return showErr('Staff username is required.');
  if (staffUser.length < 3) return showErr('Staff username must be at least 3 characters.');
  if (adminUser === staffUser) return showErr('Admin and staff usernames must be different.');
  if (adminPass.length < 6) return showErr('Admin password must be at least 6 characters.');
  if (adminPass !== adminConfirm) return showErr('Admin passwords do not match.');
  if (staffPass.length < 4) return showErr('Staff password must be at least 4 characters.');
  if (staffPass !== staffConfirm) return showErr('Staff passwords do not match.');
  if (adminPass === staffPass) return showErr('Admin and staff passwords must be different.');

  const adminHash = await hashSecret(adminPass);
  const staffHash = await hashSecret(staffPass);
  const recoveryCode = _generateRecoveryCode();
  const recoveryHash = await hashSecret(recoveryCode);

  saveCredentials({ adminUsername: adminUser, adminHash, staffUsername: staffUser, staffHash });
  localStorage.setItem(AUTH_RECOVERY_KEY, JSON.stringify(recoveryHash));

  showRecoveryCode(recoveryCode);
}

function showRecoveryCode(code) {
  const loginCard = document.getElementById('loginCard');
  if (!loginCard) return;

  loginCard.innerHTML = `
    <div style="text-align:center;margin-bottom:20px;">
      <h2 style="text-align:center;">Save Your Recovery Code</h2>
      <div class="login-subtitle" style="margin-bottom:0;">Write this down</div>
    </div>
    <div style="background:#f8f8f8;border:1.5px solid #e0e0e0;border-radius:10px;
      padding:20px;text-align:center;margin-bottom:16px;">
      <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:10px;">Your Recovery Code</div>
      <div style="font-size:22px;font-weight:900;letter-spacing:0.12em;
        font-family:monospace;color:#000;">${code}</div>
    </div>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:20px;
      line-height:1.6;text-align:center;">
      If you forget your password, this code lets you reset it.<br>
      <strong>Store it somewhere safe.</strong> It cannot be shown again.
    </div>
    <div id="recoveryConfirmError" style="display:none;background:#fef2f2;border:1.5px solid #fecaca;
      border-radius:8px;padding:10px 14px;margin-bottom:12px;
      font-size:12px;font-weight:600;color:#dc2626;text-align:center;">
      Please confirm you've saved the code first.
    </div>
    <button id="recoverySavedBtn" type="button">I've saved it — Continue</button>
  `;

  document.getElementById('recoverySavedBtn').addEventListener('click', () => {
    showLoginScreen();
    showNotification('Setup complete. Please log in.', 'success');
  });
}

function showLoginScreen() {
  const loginCard = document.getElementById('loginCard');
  if (!loginCard) return;

  loginCard.innerHTML = `
    <div style="text-align:center;margin-bottom:28px;">
      <h2 style="text-align:center;">Caflat.CORE</h2>
      <div class="login-subtitle" style="margin-bottom:0;">Operations Platform</div>
    </div>
    <input id="loginUsername" placeholder="Username" type="text" autocomplete="username" />
    <input id="loginPassword" placeholder="Password" type="password" autocomplete="current-password" />
    <div id="loginError" style="display:none;background:#fef2f2;border:1.5px solid #fecaca;
      border-radius:8px;padding:10px 14px;margin-bottom:12px;
      font-size:12px;font-weight:600;color:#dc2626;text-align:center;">
      Incorrect username or password
    </div>
    <button id="loginBtn" type="button">Sign In</button>
    <button id="forgotPassBtn" type="button"
      style="width:100%;background:transparent;color:var(--gray-400);border:none;
        padding:10px;font-size:11px;cursor:pointer;margin-top:4px;font-family:inherit;">
      Forgot password?
    </button>
  `;

  bindLoginEvents();
}

/* ═══════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════ */
/* ── Brute-force throttling ──
   Lives inside login() itself (not just the UI layer) so it still
   applies even if login() is invoked directly, e.g. from the console. */
const LOGIN_LOCKOUT_KEY   = 'caflat_login_lockout';
const LOGIN_FREE_ATTEMPTS = 4;                // no delay for the first few — typos happen
const LOGIN_MAX_LOCK_MS   = 10 * 60 * 1000;   // cap at 10 minutes

function _getLoginLockout() {
  try { return JSON.parse(localStorage.getItem(LOGIN_LOCKOUT_KEY)) || { count: 0, lockedUntil: 0 }; }
  catch { return { count: 0, lockedUntil: 0 }; }
}
function _recordFailedLogin() {
  const state = _getLoginLockout();
  state.count += 1;
  if (state.count > LOGIN_FREE_ATTEMPTS) {
    const overBy = state.count - LOGIN_FREE_ATTEMPTS;
    state.lockedUntil = Date.now() + Math.min(LOGIN_MAX_LOCK_MS, 1000 * Math.pow(2, overBy));
  }
  localStorage.setItem(LOGIN_LOCKOUT_KEY, JSON.stringify(state));
}
function _resetLoginLockout() { localStorage.removeItem(LOGIN_LOCKOUT_KEY); }
function _loginLockRemainingMs() { return Math.max(0, (_getLoginLockout().lockedUntil || 0) - Date.now()); }

async function login() {
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  if (!usernameInput || !passwordInput) return;

  const remainingMs = _loginLockRemainingMs();
  if (remainingMs > 0) {
    const secs = Math.ceil(remainingMs / 1000);
    _showLoginError(`Too many failed attempts. Try again in ${secs >= 60 ? Math.ceil(secs / 60) + ' min' : secs + 's'}.`);
    return;
  }

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!username || !password) {
    _showLoginError('Please enter your username and password.');
    return;
  }

  const creds = getStoredCredentials();

  // No credentials set yet — shouldn't happen but guard anyway
  if (!creds) { showSetupScreen(); return; }

  // Match against stored usernames; fall back to legacy hardcoded names for existing installs
  const adminUser = creds.adminUsername || 'admin';
  const staffUser = creds.staffUsername || 'staff';

  let role = null;
  let matchedField = null;
  if (username === adminUser && await verifySecret(password, creds.adminHash)) {
    role = 'ADMIN'; matchedField = 'adminHash';
  } else if (username === staffUser && await verifySecret(password, creds.staffHash)) {
    role = 'STAFF'; matchedField = 'staffHash';
  } else if (!creds.adminUsername && username === 'administrator' && await verifySecret(password, creds.adminHash)) {
    role = 'ADMIN'; matchedField = 'adminHash';
  } else if (!creds.staffUsername && username === 'cashier' && await verifySecret(password, creds.staffHash)) {
    role = 'STAFF'; matchedField = 'staffHash';
  }

  if (!role) {
    _recordFailedLogin();
    _showLoginError('Incorrect username or password.');
    return;
  }

  _resetLoginLockout();

  // Opportunistic upgrade: the matched credential was still the legacy
  // unsalted format — re-hash it now while we have the plaintext.
  if (matchedField && _isLegacySecret(creds[matchedField])) {
    creds[matchedField] = await hashSecret(password);
    saveCredentials(creds);
  }

  saveAuthSession(username, role);
  updateState('currentUserRole', () => role);
  applyAuth(role);
  showNotification('Login successful', 'success');
}

/* ═══════════════════════════════════════════════════════
   FORGOT PASSWORD
═══════════════════════════════════════════════════════ */
function showForgotPassword() {
  const loginCard = document.getElementById('loginCard');
  if (!loginCard) return;

  loginCard.innerHTML = `
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="text-align:center;">Reset Password</h2>
      <div class="login-subtitle" style="margin-bottom:0;">Enter your recovery code</div>
    </div>
    <input id="recoveryInput" placeholder="XXXX-XXXX-XXXX" type="text"
      style="letter-spacing:0.08em;text-transform:uppercase;text-align:center;font-weight:700;"
      autocomplete="off" maxlength="14" />
    <div id="forgotError" style="display:none;background:#fef2f2;border:1.5px solid #fecaca;
      border-radius:8px;padding:10px 14px;margin-bottom:12px;
      font-size:12px;font-weight:600;color:#dc2626;text-align:center;"></div>
    <button id="recoveryVerifyBtn" type="button">Verify Code</button>
    <button id="backToLoginBtn" type="button"
      style="width:100%;background:transparent;color:var(--gray-400);border:none;
        padding:10px;font-size:11px;cursor:pointer;margin-top:4px;font-family:inherit;">
      Back to login
    </button>
  `;

  // Auto-format XXXX-XXXX-XXXX as user types
  const inp = document.getElementById('recoveryInput');
  inp.addEventListener('input', () => {
    let v = inp.value.replace(/[^A-Z0-9a-z]/gi, '').toUpperCase().slice(0, 12);
    let fmt = '';
    for (let i = 0; i < v.length; i++) {
      if (i > 0 && i % 4 === 0) fmt += '-';
      fmt += v[i];
    }
    inp.value = fmt;
  });

  document.getElementById('recoveryVerifyBtn').addEventListener('click', verifyRecoveryCode);
  document.getElementById('backToLoginBtn').addEventListener('click', showLoginScreen);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') verifyRecoveryCode(); });
}

async function verifyRecoveryCode() {
  const inp = document.getElementById('recoveryInput');
  const errEl = document.getElementById('forgotError');
  const code = (inp?.value || '').replace(/-/g, '').toUpperCase();

  if (code.length !== 12) {
    if (errEl) { errEl.textContent = 'Enter the full 12-character recovery code.'; errEl.style.display = 'block'; }
    return;
  }

  const raw = localStorage.getItem(AUTH_RECOVERY_KEY);
  let storedHash = null;
  try { storedHash = raw ? JSON.parse(raw) : null; } catch { storedHash = raw; } // legacy: bare hex string, not JSON

  const valid = await verifySecret(inp.value.toUpperCase(), storedHash); // hash includes dashes

  if (!valid) {
    if (errEl) { errEl.textContent = 'Recovery code is incorrect.'; errEl.style.display = 'block'; }
    return;
  }

  showResetPasswordForm();
}

function showResetPasswordForm() {
  const loginCard = document.getElementById('loginCard');
  if (!loginCard) return;

  loginCard.innerHTML = `
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="text-align:center;">Set New Passwords</h2>
      <div class="login-subtitle" style="margin-bottom:0;">Recovery verified</div>
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
      color:var(--gray-400);margin-bottom:8px;">New Admin Password</div>
    <input id="resetAdminPass" type="password" placeholder="New admin password"
      autocomplete="new-password" style="margin-bottom:8px;" />
    <input id="resetAdminConfirm" type="password" placeholder="Confirm admin password"
      autocomplete="new-password" style="margin-bottom:16px;" />

    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
      color:var(--gray-400);margin-bottom:8px;">New Staff Password</div>
    <input id="resetStaffPass" type="password" placeholder="New staff password"
      autocomplete="new-password" style="margin-bottom:8px;" />
    <input id="resetStaffConfirm" type="password" placeholder="Confirm staff password"
      autocomplete="new-password" style="margin-bottom:20px;" />

    <div id="resetError" style="display:none;background:#fef2f2;border:1.5px solid #fecaca;
      border-radius:8px;padding:10px 14px;margin-bottom:12px;
      font-size:12px;font-weight:600;color:#dc2626;text-align:center;"></div>
    <button id="resetSaveBtn" type="button">Save New Passwords</button>
  `;

  document.getElementById('resetSaveBtn').addEventListener('click', saveResetPasswords);
}

async function saveResetPasswords() {
  const adminPass    = document.getElementById('resetAdminPass')?.value || '';
  const adminConfirm = document.getElementById('resetAdminConfirm')?.value || '';
  const staffPass    = document.getElementById('resetStaffPass')?.value || '';
  const staffConfirm = document.getElementById('resetStaffConfirm')?.value || '';
  const errEl        = document.getElementById('resetError');

  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };

  if (adminPass.length < 6) return showErr('Admin password must be at least 6 characters.');
  if (adminPass !== adminConfirm) return showErr('Admin passwords do not match.');
  if (staffPass.length < 4) return showErr('Staff password must be at least 4 characters.');
  if (staffPass !== staffConfirm) return showErr('Staff passwords do not match.');
  if (adminPass === staffPass) return showErr('Admin and staff passwords must be different.');

  const adminHash = await hashSecret(adminPass);
  const staffHash = await hashSecret(staffPass);
  const newRecovery = _generateRecoveryCode();
  const recoveryHash = await hashSecret(newRecovery);

  // Preserve any custom usernames — saveCredentials() overwrites the whole
  // record, so dropping them here would silently reset them to admin/staff.
  const existing = getStoredCredentials() || {};
  saveCredentials({ adminUsername: existing.adminUsername, adminHash, staffUsername: existing.staffUsername, staffHash });
  localStorage.setItem(AUTH_RECOVERY_KEY, JSON.stringify(recoveryHash));

  showRecoveryCode(newRecovery);
}

/* ═══════════════════════════════════════════════════════
   CHANGE PASSWORD (from Settings)
═══════════════════════════════════════════════════════ */
function openChangePasswordModal() {
  const existing = document.getElementById('changePasswordModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'changePasswordModal';
  overlay.className = 'modal-overlay';

  const existingCreds = getStoredCredentials() || {};
  const currentAdminUser = existingCreds.adminUsername || 'admin';
  const currentStaffUser = existingCreds.staffUsername || 'staff';

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h3>Change Credentials</h3>

      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;margin-top:16px;">Verify Current Admin Password</div>
      <input id="cpCurrentPass" type="password" placeholder="Enter current admin password"
        class="form-input" autocomplete="current-password" />

      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;margin-top:16px;">Admin Account</div>
      <input id="cpNewAdminUser" type="text" placeholder="Admin username (leave blank to keep)"
        class="form-input" autocomplete="off" value="" style="margin-bottom:8px;" />
      <input id="cpNewAdmin" type="password" placeholder="New admin password (leave blank to keep)"
        class="form-input" autocomplete="new-password" />
      <input id="cpNewAdminConfirm" type="password" placeholder="Confirm new admin password"
        class="form-input" style="margin-top:8px;" autocomplete="new-password" />

      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;margin-top:16px;">Staff Account</div>
      <input id="cpNewStaffUser" type="text" placeholder="Staff username (leave blank to keep)"
        class="form-input" autocomplete="off" value="" style="margin-bottom:8px;" />
      <input id="cpNewStaff" type="password" placeholder="New staff password (leave blank to keep)"
        class="form-input" autocomplete="new-password" />
      <input id="cpNewStaffConfirm" type="password" placeholder="Confirm new staff password"
        class="form-input" style="margin-top:8px;" autocomplete="new-password" />

      <div id="cpError" style="display:none;background:#fef2f2;border:1.5px solid #fecaca;
        border-radius:8px;padding:10px 14px;margin-top:14px;
        font-size:12px;font-weight:600;color:#dc2626;text-align:center;"></div>

      <div class="modal-actions" style="margin-top:20px;">
        <button class="btn btn-secondary" type="button"
          onclick="document.getElementById('changePasswordModal').remove()">Cancel</button>
        <button class="btn" type="button" id="cpSaveBtn">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.classList.add('active');
  document.getElementById('cpSaveBtn').addEventListener('click', saveChangedPassword);
}

async function saveChangedPassword() {
  const currentPass      = document.getElementById('cpCurrentPass')?.value || '';
  const newAdminUser     = (document.getElementById('cpNewAdminUser')?.value || '').trim().toLowerCase();
  const newAdmin         = document.getElementById('cpNewAdmin')?.value || '';
  const newAdminConfirm  = document.getElementById('cpNewAdminConfirm')?.value || '';
  const newStaffUser     = (document.getElementById('cpNewStaffUser')?.value || '').trim().toLowerCase();
  const newStaff         = document.getElementById('cpNewStaff')?.value || '';
  const newStaffConfirm  = document.getElementById('cpNewStaffConfirm')?.value || '';
  const errEl            = document.getElementById('cpError');

  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };

  const creds = getStoredCredentials();
  if (!creds) return showErr('No credentials found. Please set up again.');

  if (!(await verifySecret(currentPass, creds.adminHash))) {
    return showErr('Current admin password is incorrect.');
  }

  // Determine final usernames
  const finalAdminUser = newAdminUser || creds.adminUsername || 'admin';
  const finalStaffUser = newStaffUser || creds.staffUsername || 'staff';

  if (newAdminUser && newAdminUser.length < 3) return showErr('Admin username must be at least 3 characters.');
  if (newStaffUser && newStaffUser.length < 3) return showErr('Staff username must be at least 3 characters.');
  if (finalAdminUser === finalStaffUser) return showErr('Admin and staff usernames must be different.');

  if (newAdmin) {
    if (newAdmin.length < 6) return showErr('New admin password must be at least 6 characters.');
    if (newAdmin !== newAdminConfirm) return showErr('New admin passwords do not match.');
  }
  if (newStaff) {
    if (newStaff.length < 4) return showErr('New staff password must be at least 4 characters.');
    if (newStaff !== newStaffConfirm) return showErr('New staff passwords do not match.');
  }
  if (!newAdminUser && !newAdmin && !newStaffUser && !newStaff) {
    return showErr('Enter at least one field to change.');
  }
  // Only checkable when both are being changed together — a salted hash
  // can't be compared for equality against an unchanged counterpart.
  if (newAdmin && newStaff && newAdmin === newStaff) {
    return showErr('Admin and staff passwords must be different.');
  }

  const newAdminHash = newAdmin ? await hashSecret(newAdmin) : creds.adminHash;
  const newStaffHash = newStaff ? await hashSecret(newStaff) : creds.staffHash;

  saveCredentials({ adminUsername: finalAdminUser, adminHash: newAdminHash, staffUsername: finalStaffUser, staffHash: newStaffHash });
  document.getElementById('changePasswordModal')?.remove();
  showNotification('Credentials updated successfully', 'success');
}

/* ═══════════════════════════════════════════════════════
   LOGOUT
═══════════════════════════════════════════════════════ */
function logout() {
  clearAuthSession();
  showNotification('Logged out successfully', 'info');
  location.reload();
}

/* ═══════════════════════════════════════════════════════
   EVENT BINDING
═══════════════════════════════════════════════════════ */
function bindLoginEvents() {
  const loginBtn      = document.getElementById('loginBtn');
  const forgotBtn     = document.getElementById('forgotPassBtn');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');

  if (loginBtn) loginBtn.addEventListener('click', login);
  if (forgotBtn) forgotBtn.addEventListener('click', showForgotPassword);

  const handleEnter = e => { if (e.key === 'Enter') login(); };
  const hideErr = () => _hideLoginError();

  if (usernameInput) {
    usernameInput.addEventListener('input', hideErr);
    usernameInput.addEventListener('keydown', handleEnter);
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', hideErr);
    passwordInput.addEventListener('keydown', handleEnter);
  }
}

/* ═══════════════════════════════════════════════════════
   ACCESS GATE
   Validates an access code against Supabase before
   showing login/setup. Token stored in localStorage so
   the check only runs on first visit per browser.
═══════════════════════════════════════════════════════ */
const GATE_KEY = 'caflat_gate_v1';

function _isGateUnlocked() {
  try {
    const raw = localStorage.getItem(GATE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    return !!(d && d.code);
  } catch { return false; }
}

function showGatePanel(panel) {
  const signInPanel = document.getElementById('gateSignInPanel');
  const createPanel = document.getElementById('gateCreatePanel');
  const signInTab   = document.getElementById('gateTabSignIn');
  const createTab   = document.getElementById('gateTabCreate');

  const activeStyle   = { background: 'var(--black)', color: 'white' };
  const inactiveStyle = { background: 'transparent',  color: 'var(--gray-500)' };

  if (panel === 'create') {
    if (signInPanel) signInPanel.style.display = 'none';
    if (createPanel) createPanel.style.display = '';
    if (signInTab)   Object.assign(signInTab.style, inactiveStyle);
    if (createTab)   Object.assign(createTab.style,  activeStyle);
  } else {
    if (signInPanel) signInPanel.style.display = '';
    if (createPanel) createPanel.style.display = 'none';
    if (signInTab)   Object.assign(signInTab.style,  activeStyle);
    if (createTab)   Object.assign(createTab.style, inactiveStyle);
    const input = document.getElementById('gateCodeInput');
    if (input) setTimeout(() => input.focus(), 50);
  }
}

function _showGate() {
  const gate  = document.getElementById('gateScreen');
  const login = document.getElementById('loginScreen');
  document.body.classList.add('login-active');
  if (gate)  { gate.style.display = 'flex'; gate.style.visibility = 'visible';
               gate.style.opacity = '1'; gate.style.pointerEvents = 'auto'; }
  if (login) { login.style.display = 'none'; }

  const btn   = document.getElementById('gateBtn');
  const input = document.getElementById('gateCodeInput');
  if (btn)   btn.onclick   = submitGateCode;
  if (input) { input.onkeydown = e => { if (e.key === 'Enter') submitGateCode(); };
               input.focus(); }
}

async function submitGateCode() {
  const input = document.getElementById('gateCodeInput');
  const btn   = document.getElementById('gateBtn');
  const code  = String(input?.value || '').trim().toUpperCase();

  if (!code) { _showGateError('Please enter your access code.'); return; }

  if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }
  _hideGateError();

  try {
    const res = await fetch(
      `${CAFLAT_SB_URL}/rest/v1/licenses` +
      `?code=eq.${encodeURIComponent(code)}` +
      `&select=code,tier,client_name,tenant_id,expires_at,revoked`,
      { headers: { 'apikey': CAFLAT_SB_ANON, 'Authorization': `Bearer ${CAFLAT_SB_ANON}` } }
    );

    if (!res.ok) throw new Error('server');
    const rows = await res.json();

    if (!rows.length) {
      _showGateError('Invalid access code. Please check and try again.');
    } else if (rows[0].revoked) {
      _showGateError('This access code has been revoked. Contact support.');
    } else if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
      _showGateError('This access code has expired. Contact support.');
    } else {
      const lic = rows[0];

      // Store gate token
      localStorage.setItem(GATE_KEY, JSON.stringify({
        code: lic.code, validatedAt: new Date().toISOString()
      }));

      // Also activate the license locally so features unlock immediately
      if (typeof _saveLicenseToStorage === 'function') {
        _saveLicenseToStorage({
          code:           lic.code,
          tier:           lic.tier,
          client_name:    lic.client_name,
          tenant_id:      lic.tenant_id,
          expires_at:     lic.expires_at,
          last_validated: new Date().toISOString()
        });
      }

      const gate = document.getElementById('gateScreen');
      if (gate) gate.style.display = 'none';

      _proceedAfterGate();
    }
  } catch (e) {
    _showGateError('Could not connect. Check your internet and try again.');
  } finally {
    if (btn) { btn.textContent = 'Continue'; btn.disabled = false; }
  }
}

function _showGateError(msg) {
  const err  = document.getElementById('gateError');
  const card = document.getElementById('gateCard');
  if (err)  { err.textContent = msg; err.style.display = 'block'; }
  if (card) { card.classList.remove('login-shake'); void card.offsetWidth; card.classList.add('login-shake'); }
}

function _hideGateError() {
  const err = document.getElementById('gateError');
  if (err) err.style.display = 'none';
}

function _proceedAfterGate() {
  if (typeof initializeLicense === 'function') initializeLicense();
  if (typeof applyLicenseTier  === 'function') applyLicenseTier();
  showLoginShell();
  if (isFirstLaunch()) { showSetupScreen(); return; }
  const session = getAuthSession();
  const creds   = getStoredCredentials();
  if (session && creds && session.role) {
    updateState('currentUserRole', () => session.role);
    applyAuth(session.role);
    return;
  }
  showLoginScreen();
  bindLoginEvents();
}

/* ═══════════════════════════════════════════════════════
   INITIALIZE
═══════════════════════════════════════════════════════ */
function initializeAuth() {
  showLoginShell();

  // Gate — must pass before login or setup is shown
  if (!_isGateUnlocked()) {
    _showGate();
    return;
  }

  if (isFirstLaunch()) {
    showSetupScreen();
    return;
  }

  // Restore session if valid
  const session = getAuthSession();
  const creds   = getStoredCredentials();

  if (session && creds && session.role) {
    updateState('currentUserRole', () => session.role);
    applyAuth(session.role);
    return;
  }

  showLoginScreen();
  bindLoginEvents();
}

window.applyRoleAccess         = applyRoleAccess;
window.login                   = login;
window.logout                  = logout;
window.applyAuth               = applyAuth;
window.initializeAuth          = initializeAuth;
window.submitGateCode          = submitGateCode;
window.openChangePasswordModal = openChangePasswordModal;
window.showForgotPassword      = showForgotPassword;
window.showGatePanel           = showGatePanel;
window.hashSecret              = hashSecret;
window.verifySecret            = verifySecret;
