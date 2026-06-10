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

/* ── SHA-256 helper ── */
async function _sha256(str) {
  const buf  = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

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

function applyAuth(role) {
  showAppShell();
  const roleBadge = document.getElementById('roleBadge');
  if (roleBadge) roleBadge.textContent = String(role || 'STAFF').toUpperCase();
  if (typeof switchPage   === 'function') switchPage('pos');
  if (typeof renderBranding === 'function') renderBranding();
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
      Set your passwords before you start.<br>Keep these safe — you'll need them to log in.
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
      color:var(--gray-400);margin-bottom:8px;">Admin Password</div>
    <input id="setupAdminPass" type="password" placeholder="Set admin password"
      autocomplete="new-password" style="margin-bottom:8px;" />
    <input id="setupAdminConfirm" type="password" placeholder="Confirm admin password"
      autocomplete="new-password" style="margin-bottom:16px;" />

    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
      color:var(--gray-400);margin-bottom:8px;">Staff Password</div>
    <input id="setupStaffPass" type="password" placeholder="Set staff password"
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

  // Allow Enter key on last field
  document.getElementById('setupStaffConfirm')
    .addEventListener('keydown', e => { if (e.key === 'Enter') completeSetup(); });
}

async function completeSetup() {
  const adminPass    = document.getElementById('setupAdminPass')?.value || '';
  const adminConfirm = document.getElementById('setupAdminConfirm')?.value || '';
  const staffPass    = document.getElementById('setupStaffPass')?.value || '';
  const staffConfirm = document.getElementById('setupStaffConfirm')?.value || '';
  const errEl        = document.getElementById('setupError');

  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };

  if (adminPass.length < 6) return showErr('Admin password must be at least 6 characters.');
  if (adminPass !== adminConfirm) return showErr('Admin passwords do not match.');
  if (staffPass.length < 4) return showErr('Staff password must be at least 4 characters.');
  if (staffPass !== staffConfirm) return showErr('Staff passwords do not match.');
  if (adminPass === staffPass) return showErr('Admin and staff passwords must be different.');

  const adminHash = await _sha256(adminPass);
  const staffHash = await _sha256(staffPass);
  const recoveryCode = _generateRecoveryCode();
  const recoveryHash = await _sha256(recoveryCode);

  saveCredentials({ adminHash, staffHash });
  localStorage.setItem(AUTH_RECOVERY_KEY, recoveryHash);

  // Show recovery code before proceeding
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
async function login() {
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!username || !password) {
    _showLoginError('Please enter your username and password.');
    return;
  }

  const creds = getStoredCredentials();

  // No credentials set yet — shouldn't happen but guard anyway
  if (!creds) { showSetupScreen(); return; }

  const inputHash = await _sha256(password);

  let role = null;
  if ((username === 'admin' || username === 'administrator') && inputHash === creds.adminHash) {
    role = 'ADMIN';
  } else if ((username === 'staff' || username === 'cashier') && inputHash === creds.staffHash) {
    role = 'STAFF';
  }

  if (!role) {
    _showLoginError('Incorrect username or password.');
    return;
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

  const inputHash = await _sha256(inp.value.toUpperCase()); // hash includes dashes
  const storedHash = localStorage.getItem(AUTH_RECOVERY_KEY);

  if (!storedHash || inputHash !== storedHash) {
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

  const adminHash = await _sha256(adminPass);
  const staffHash = await _sha256(staffPass);
  const newRecovery = _generateRecoveryCode();
  const recoveryHash = await _sha256(newRecovery);

  saveCredentials({ adminHash, staffHash });
  localStorage.setItem(AUTH_RECOVERY_KEY, recoveryHash);

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

  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h3>Change Password</h3>

      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;margin-top:16px;">Current Admin Password</div>
      <input id="cpCurrentPass" type="password" placeholder="Enter current admin password"
        class="form-input" autocomplete="current-password" />

      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;margin-top:16px;">Change Admin Password</div>
      <input id="cpNewAdmin" type="password" placeholder="New admin password (min 6 chars)"
        class="form-input" autocomplete="new-password" />
      <input id="cpNewAdminConfirm" type="password" placeholder="Confirm new admin password"
        class="form-input" style="margin-top:8px;" autocomplete="new-password" />

      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
        color:var(--gray-400);margin-bottom:8px;margin-top:16px;">Change Staff Password</div>
      <input id="cpNewStaff" type="password" placeholder="New staff password (min 4 chars)"
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
  const newAdmin         = document.getElementById('cpNewAdmin')?.value || '';
  const newAdminConfirm  = document.getElementById('cpNewAdminConfirm')?.value || '';
  const newStaff         = document.getElementById('cpNewStaff')?.value || '';
  const newStaffConfirm  = document.getElementById('cpNewStaffConfirm')?.value || '';
  const errEl            = document.getElementById('cpError');

  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };

  const creds = getStoredCredentials();
  if (!creds) return showErr('No credentials found. Please set up again.');

  // Verify current admin password first
  const currentHash = await _sha256(currentPass);
  if (currentHash !== creds.adminHash) {
    return showErr('Current admin password is incorrect.');
  }

  // Validate new passwords (allow keeping same if fields left blank)
  let newAdminHash = creds.adminHash;
  let newStaffHash = creds.staffHash;

  if (newAdmin) {
    if (newAdmin.length < 6) return showErr('New admin password must be at least 6 characters.');
    if (newAdmin !== newAdminConfirm) return showErr('New admin passwords do not match.');
    newAdminHash = await _sha256(newAdmin);
  }

  if (newStaff) {
    if (newStaff.length < 4) return showErr('New staff password must be at least 4 characters.');
    if (newStaff !== newStaffConfirm) return showErr('New staff passwords do not match.');
    newStaffHash = await _sha256(newStaff);
  }

  if (!newAdmin && !newStaff) {
    return showErr('Enter at least one new password to change.');
  }

  if (newAdminHash === newStaffHash) {
    return showErr('Admin and staff passwords must be different.');
  }

  saveCredentials({ adminHash: newAdminHash, staffHash: newStaffHash });
  document.getElementById('changePasswordModal')?.remove();
  showNotification('Password updated successfully', 'success');
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
   INITIALIZE
═══════════════════════════════════════════════════════ */
function initializeAuth() {
  showLoginShell();

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

window.login                   = login;
window.logout                  = logout;
window.applyAuth               = applyAuth;
window.initializeAuth          = initializeAuth;
window.openChangePasswordModal = openChangePasswordModal;
window.showForgotPassword      = showForgotPassword;
