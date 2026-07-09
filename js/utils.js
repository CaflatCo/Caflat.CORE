/* ═══════════════════════════════════════════════════════
   UTILS.JS — Shared utilities
═══════════════════════════════════════════════════════ */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatCurrency(amount) {
  const code = (typeof getActiveCurrencyCode === 'function') ? getActiveCurrencyCode() : 'PHP';
  const locale = (typeof CURRENCY_REGISTRY !== 'undefined' && CURRENCY_REGISTRY[code]?.locale) || 'en-PH';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code })
    .format(Number(amount || 0));
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Caps any decimal quantity (stock, weight, cost-per-unit, %, etc.) to at
// most 2 decimal places, absorbing floating-point drift (e.g. 4.999999999999998).
function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showNotification(message, type = 'info') {
  let container = document.getElementById('notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    document.body.appendChild(container);
  }

  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.innerHTML = `<div class="notification-content">${escapeHtml(message)}</div>`;
  container.appendChild(n);

  requestAnimationFrame(() => n.classList.add('show'));
  setTimeout(() => {
    n.classList.remove('show');
    setTimeout(() => n.remove(), 200);
  }, 3000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('active');
  if (!document.querySelector('.modal-overlay.active')) {
    document.body.style.overflow = '';
  }
}

function setElementValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getElementValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  localStorage.setItem('caflat-theme', next);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.querySelector('.toggle-icon').textContent = next === 'dark' ? '☀' : '☽';
    btn.querySelector('.toggle-label').textContent = next === 'dark' ? 'Light' : 'Dark';
  }
}

window.generateId        = generateId;
window.formatCurrency    = formatCurrency;
window.safeNumber        = safeNumber;
window.sanitizeText      = sanitizeText;
window.escapeHtml        = escapeHtml;
window.showNotification  = showNotification;
window.openModal         = openModal;
window.closeModal        = closeModal;
window.setElementValue   = setElementValue;
window.getElementValue   = getElementValue;
window.downloadTextFile  = downloadTextFile;
window.toggleTheme       = toggleTheme;
