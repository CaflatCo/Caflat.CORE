/* ═══════════════════════════════════════════════════════
   CURRENCY.JS — Currency registry + active-currency helpers
═══════════════════════════════════════════════════════ */

const CURRENCY_REGISTRY = {
  PHP: { symbol: '₱', locale: 'en-PH', name: 'Philippine Peso' },
  USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { symbol: '€', locale: 'en-IE', name: 'Euro' },
  GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound' },
  AUD: { symbol: '$', locale: 'en-AU', name: 'Australian Dollar' },
  CAD: { symbol: '$', locale: 'en-CA', name: 'Canadian Dollar' },
  SGD: { symbol: '$', locale: 'en-SG', name: 'Singapore Dollar' },
  JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
  INR: { symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
};

function getActiveCurrencyCode() {
  const code = APP_STATE.settings?.currency;
  return CURRENCY_REGISTRY[code] ? code : 'PHP';
}

function getCurrencySymbol() {
  return CURRENCY_REGISTRY[getActiveCurrencyCode()].symbol;
}

function applyCurrencyToUI() {
  const sym = getCurrencySymbol();
  document.querySelectorAll('[data-curr-sym]').forEach(el => { el.textContent = sym; });
  document.querySelectorAll('[data-curr-opt]').forEach(el => { el.textContent = `${sym} ${el.getAttribute('data-curr-opt')}`; });
}

window.CURRENCY_REGISTRY = CURRENCY_REGISTRY;
window.getActiveCurrencyCode = getActiveCurrencyCode;
window.getCurrencySymbol = getCurrencySymbol;
window.applyCurrencyToUI = applyCurrencyToUI;
