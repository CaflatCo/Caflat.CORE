const AUTH_USERS = {

  admin: {
    password: 'Y4qara630b5',
    role: 'ADMIN'
  },

  staff: {
    password: 'staff123',
    role: 'STAFF'
  }

};

const AUTH_STORAGE_KEY =
  'caflat_auth';

function getAuthSession() {

  try {

    const raw =
      localStorage.getItem(
        AUTH_STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      !parsed.role
    ) {
      return null;
    }

    return parsed;

  } catch (error) {

    console.error(
      'Failed to read auth session',
      error
    );

    return null;

  }

}

function saveAuthSession(
  username,
  role
) {

  localStorage.setItem(

    AUTH_STORAGE_KEY,

    JSON.stringify({
      username,
      role
    })

  );

}

function clearAuthSession() {

  localStorage.removeItem(
    AUTH_STORAGE_KEY
  );

}

function showAppShell() {

  const loginScreen =
    document.getElementById(
      'loginScreen'
    );

  const app =
    document.getElementById(
      'app'
    );

  document.body.classList.remove(
    'login-active'
  );

  document.body.style.overflow =
    'auto';

  if (loginScreen) {

    loginScreen.style.display =
      'none';

    loginScreen.style.visibility =
      'hidden';

    loginScreen.style.opacity =
      '0';

    loginScreen.style.pointerEvents =
      'none';

  }

  if (app) {

    app.style.display =
      'flex';

    app.style.visibility =
      'visible';

    app.style.opacity =
      '1';

    app.style.pointerEvents =
      'auto';

    app.classList.add(
      'authenticated'
    );

  }

}

function showLoginShell() {

  const loginScreen =
    document.getElementById(
      'loginScreen'
    );

  const app =
    document.getElementById(
      'app'
    );

  document.body.classList.add(
    'login-active'
  );

  if (app) {

    app.classList.remove(
      'authenticated'
    );

    app.style.display =
      'none';

  }

  if (loginScreen) {

    loginScreen.style.display =
      'flex';

    loginScreen.style.visibility =
      'visible';

    loginScreen.style.opacity =
      '1';

    loginScreen.style.pointerEvents =
      'auto';

  }

}

function applyAuth(
  role
) {

  showAppShell();

  const roleBadge =
    document.getElementById(
      'roleBadge'
    );

  if (roleBadge) {

    roleBadge.textContent =
      String(
        role || 'STAFF'
      ).toUpperCase();

  }

  if (
    typeof switchPage ===
    'function'
  ) {

    switchPage('pos');

  }

  if (
    typeof renderBranding ===
    'function'
  ) {

    renderBranding();

  }

}

function login() {

  const usernameInput =
    document.getElementById(
      'loginUsername'
    );

  const passwordInput =
    document.getElementById(
      'loginPassword'
    );

  if (
    !usernameInput ||
    !passwordInput
  ) {
    return;
  }

  const username =
    usernameInput.value.trim();

  const password =
    passwordInput.value;

  const user =
    AUTH_USERS[username];

  if (
    !user ||
    user.password !== password
  ) {

    // Show inline error with shake animation
    const errEl = document.getElementById('loginError');
    const card  = document.getElementById('loginCard');
    const passEl = document.getElementById('loginPassword');

    if (errEl) {
      errEl.style.display = 'block';
      // Auto-hide after 4 seconds
      clearTimeout(window._loginErrTimer);
      window._loginErrTimer = setTimeout(() => {
        errEl.style.display = 'none';
      }, 4000);
    }

    // Shake the card
    if (card) {
      card.classList.remove('login-shake');
      void card.offsetWidth; // force reflow to restart animation
      card.classList.add('login-shake');
    }

    // Clear password field and re-focus
    if (passEl) {
      passEl.value = '';
      passEl.focus();
    }

    return;

  }

  saveAuthSession(
    username,
    user.role
  );

  updateState(
    'currentUserRole',
    () => user.role
  );

  applyAuth(
    user.role
  );

  showNotification(
    'Login successful',
    'success'
  );

}

function logout() {

  clearAuthSession();

  showNotification(
    'Logged out successfully',
    'info'
  );

  location.reload();

}

function initializeAuth() {

  showLoginShell();

  const loginBtn =
    document.getElementById(
      'loginBtn'
    );

  const loginUsername =
    document.getElementById(
      'loginUsername'
    );

  const loginPassword =
    document.getElementById(
      'loginPassword'
    );

  if (loginBtn) {

    loginBtn.addEventListener(
      'click',
      login
    );

  }

  const handleEnter =
    event => {

      if (
        event.key === 'Enter'
      ) {

        login();

      }

    };

  // Hide error on any keystroke
  const _hideLoginErr = () => {
    const e = document.getElementById('loginError');
    if (e) e.style.display = 'none';
  };
  if (loginUsername) {
    loginUsername.addEventListener('input', _hideLoginErr);
    loginUsername.addEventListener(
      'keydown',
      handleEnter
    );

  }

  if (loginPassword) {
    loginPassword.addEventListener('input', _hideLoginErr);
    loginPassword.addEventListener(
      'keydown',
      handleEnter
    );

  }

  const session =
    getAuthSession();

  if (
    session &&
    AUTH_USERS[
      session.username
    ] &&
    AUTH_USERS[
      session.username
    ].role === session.role
  ) {

    updateState(
      'currentUserRole',
      () => session.role
    );

    applyAuth(
      session.role
    );

  }

}

window.login =
  login;

window.logout =
  logout;

window.applyAuth =
  applyAuth;

window.initializeAuth =
  initializeAuth;
