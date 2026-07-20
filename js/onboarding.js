/* ═══════════════════════════════════════════════════════
   ONBOARDING.JS — First-run wizard
   3 skippable steps after "Start Brewing": brand + currency,
   starter categories, first products (with template quick-fills).
   Sets settings.onboarded = true so it never re-fires.
═══════════════════════════════════════════════════════ */

const ONBOARDING_STARTER_CATEGORIES = ['Cookies', 'Drinks', 'Pastries'];

let _ob = null;

function startOnboardingWizard() {
  if (APP_STATE.settings?.onboarded) return;
  if (document.getElementById('onboardingWizard')) return;
  _ob = {
    step: 1,
    brandName: APP_STATE.settings?.brandName || '',
    currency: APP_STATE.settings?.currency || 'PHP',
    categories: [],
    customCategory: '',
    products: [{ name: '', price: '', stock: '' }, { name: '', price: '', stock: '' }, { name: '', price: '', stock: '' }],
  };
  _renderOnboardingWizard();
}

function _obOverlay() {
  let overlay = document.getElementById('onboardingWizard');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'onboardingWizard';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9000',
      'background:rgba(0,0,0,.82);backdrop-filter:blur(6px)',
      'display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto',
    ].join(';');
    document.body.appendChild(overlay);
  }
  return overlay;
}

function _obInputStyle() {
  return 'width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;' +
    'background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.15);' +
    'color:#fff;font-size:14px;font-family:inherit;';
}

function _obCaptureStep() {
  if (!_ob) return;
  if (_ob.step === 1) {
    _ob.brandName = document.getElementById('obBrandName')?.value.trim() || '';
    _ob.currency = document.getElementById('obCurrency')?.value || 'PHP';
  } else if (_ob.step === 3) {
    _ob.products = [0, 1, 2].map(i => ({
      name: document.getElementById(`obProductName${i}`)?.value.trim() || '',
      price: document.getElementById(`obProductPrice${i}`)?.value || '',
      stock: document.getElementById(`obProductStock${i}`)?.value || '',
    }));
  }
}

function _obGoto(step) {
  _obCaptureStep();
  _ob.step = step;
  _renderOnboardingWizard();
}

function _obNext() { _obGoto(Math.min(3, _ob.step + 1)); }
function _obBack() { _obGoto(Math.max(1, _ob.step - 1)); }

function _obToggleCategory(name) {
  const i = _ob.categories.indexOf(name);
  if (i >= 0) _ob.categories.splice(i, 1);
  else _ob.categories.push(name);
  _renderOnboardingWizard();
}

function _obAddCustomCategory() {
  const input = document.getElementById('obCustomCategory');
  const name = sanitizeText(input?.value.trim() || '');
  if (name && !_ob.categories.includes(name)) _ob.categories.push(name);
  if (input) input.value = '';
  _renderOnboardingWizard();
}

function _obApplyTemplate(label, price, stock) {
  _obCaptureStep();
  const emptyIdx = _ob.products.findIndex(p => !p.name);
  const target = emptyIdx >= 0 ? emptyIdx : _ob.products.length - 1;
  _ob.products[target] = { name: label, price: String(price), stock: String(stock) };
  _renderOnboardingWizard();
}

function _obSkip() {
  updateState('settings', current => ({ ...current, onboarded: true }));
  document.getElementById('onboardingWizard')?.remove();
}

function _obFinish() {
  _obCaptureStep();

  updateState('settings', current => ({
    ...current,
    brandName: _ob.brandName || current.brandName,
    currency: CURRENCY_REGISTRY[_ob.currency] ? _ob.currency : (current.currency || 'PHP'),
    onboarded: true,
  }));

  if (_ob.categories.length) {
    updateState('categories', current => {
      const existing = Array.isArray(current) ? current : [];
      const merged = [...existing];
      _ob.categories.forEach(c => { if (!merged.includes(c)) merged.push(c); });
      return merged;
    });
  }

  const newProducts = _ob.products
    .filter(p => p.name)
    .map(p => ({
      id: generateId(),
      name: sanitizeText(p.name),
      category: _ob.categories[0] || '',
      price: safeNumber(p.price),
      stock: safeNumber(p.stock),
      reorderLevel: 0,
      shelfLifeDays: 0,
      variantType: 'custom',
      variants: [],
      recipe: [],
      packagingItems: [],
      recipeMode: 'unit',
      batchYield: 1,
      createdAt: new Date().toISOString(),
    }));

  if (newProducts.length) {
    updateState('products', current => [...(Array.isArray(current) ? current : []), ...newProducts]);
  }

  document.getElementById('onboardingWizard')?.remove();
  if (typeof renderEverything === 'function') renderEverything();
  if (typeof showNotification === 'function') {
    showNotification(newProducts.length ? `Welcome aboard! ${newProducts.length} product${newProducts.length === 1 ? '' : 's'} added.` : 'Welcome aboard!', 'success');
  }
}

function _renderOnboardingWizard() {
  const overlay = _obOverlay();
  const stepHtml = _ob.step === 1 ? _obStep1Html() : _ob.step === 2 ? _obStep2Html() : _obStep3Html();
  overlay.innerHTML = `
    <div style="background:#111;border:1.5px solid rgba(255,255,255,.12);border-radius:18px;
      padding:36px 32px;max-width:480px;width:100%;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div style="font-size:.62rem;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
          color:rgba(255,255,255,.4);">Step ${_ob.step} of 3</div>
        <button onclick="_obSkip()" style="background:none;border:none;color:rgba(255,255,255,.35);
          font-size:.78rem;cursor:pointer;padding:2px;">Skip for now</button>
      </div>
      ${stepHtml}
    </div>`;
}

function _obStep1Html() {
  const currencyOptions = Object.entries(CURRENCY_REGISTRY)
    .map(([code, c]) => `<option value="${code}" ${code === _ob.currency ? 'selected' : ''}>${code} — ${c.name}</option>`)
    .join('');
  return `
    <h2 style="color:#fff;font-size:1.25rem;font-weight:800;margin-bottom:6px;letter-spacing:-.02em;">
      Tell us about your cafe
    </h2>
    <p style="color:rgba(255,255,255,.5);font-size:.85rem;line-height:1.5;margin-bottom:22px;">
      This shows up on receipts, statements, and the dashboard.
    </p>
    <label style="display:block;font-size:.72rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
      color:rgba(255,255,255,.45);margin-bottom:6px;">Brand name</label>
    <input id="obBrandName" type="text" value="${escapeHtml(_ob.brandName)}" placeholder="e.g. Maison Levain"
      style="${_obInputStyle()}margin-bottom:16px;" />
    <label style="display:block;font-size:.72rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
      color:rgba(255,255,255,.45);margin-bottom:6px;">Currency</label>
    <select id="obCurrency" style="${_obInputStyle()}margin-bottom:24px;">${currencyOptions}</select>
    <button onclick="_obNext()" style="width:100%;background:#fff;color:#000;border:none;border-radius:10px;
      padding:14px;font-size:.95rem;font-weight:800;cursor:pointer;">Continue</button>`;
}

function _obStep2Html() {
  const chips = ONBOARDING_STARTER_CATEGORIES.map(name => {
    const selected = _ob.categories.includes(name);
    return `<button onclick="_obToggleCategory('${name}')" class="ob-chip"
      style="padding:10px 16px;border-radius:999px;font-size:.85rem;font-weight:700;cursor:pointer;
        border:1.5px solid ${selected ? '#c8a96e' : 'rgba(255,255,255,.18)'};
        background:${selected ? 'rgba(200,169,110,.14)' : 'transparent'};
        color:${selected ? '#c8a96e' : 'rgba(255,255,255,.75)'};margin:0 8px 8px 0;">${name}</button>`;
  }).join('');
  const customChips = _ob.categories.filter(c => !ONBOARDING_STARTER_CATEGORIES.includes(c)).map(name => `
    <button onclick="_obToggleCategory('${escapeHtml(name)}')" class="ob-chip"
      style="padding:10px 16px;border-radius:999px;font-size:.85rem;font-weight:700;cursor:pointer;
        border:1.5px solid #c8a96e;background:rgba(200,169,110,.14);color:#c8a96e;margin:0 8px 8px 0;">
      ${escapeHtml(name)}</button>`).join('');
  return `
    <h2 style="color:#fff;font-size:1.25rem;font-weight:800;margin-bottom:6px;letter-spacing:-.02em;">
      What do you sell?
    </h2>
    <p style="color:rgba(255,255,255,.5);font-size:.85rem;line-height:1.5;margin-bottom:18px;">
      Pick a few starter categories — you can add more anytime in Settings.
    </p>
    <div style="display:flex;flex-wrap:wrap;margin-bottom:12px;">${chips}${customChips}</div>
    <div style="display:flex;gap:8px;margin-bottom:24px;">
      <input id="obCustomCategory" type="text" placeholder="Add your own…"
        style="${_obInputStyle()}" onkeydown="if(event.key==='Enter'){event.preventDefault();_obAddCustomCategory();}" />
      <button onclick="_obAddCustomCategory()" style="background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.18);
        color:#fff;border-radius:10px;padding:0 16px;font-size:.85rem;font-weight:700;cursor:pointer;white-space:nowrap;">Add</button>
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="_obBack()" style="flex:1;background:none;color:rgba(255,255,255,.6);
        border:1.5px solid rgba(255,255,255,.18);border-radius:10px;padding:14px;font-size:.95rem;
        font-weight:800;cursor:pointer;">Back</button>
      <button onclick="_obNext()" style="flex:2;background:#fff;color:#000;border:none;border-radius:10px;
        padding:14px;font-size:.95rem;font-weight:800;cursor:pointer;">Continue</button>
    </div>`;
}

function _obStep3Html() {
  const templates = [];
  _ob.categories.forEach(c => {
    (typeof getTemplatesForCategory === 'function' ? getTemplatesForCategory(c) : []).forEach(t => templates.push(t));
  });
  const templateChips = templates.slice(0, 6).map(t => `
    <button onclick="_obApplyTemplate('${escapeHtml(t.label)}', ${Number(t.data?.price || 0)}, ${Number(t.data?.stock || 0)})"
      style="padding:8px 14px;border-radius:999px;font-size:.78rem;font-weight:700;cursor:pointer;
        border:1.5px solid rgba(255,255,255,.18);background:transparent;color:rgba(255,255,255,.75);
        margin:0 8px 8px 0;">+ ${escapeHtml(t.label)}</button>`).join('');

  const rows = _ob.products.map((p, i) => `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px;">
      <input id="obProductName${i}" type="text" value="${escapeHtml(p.name)}" placeholder="Product name"
        style="${_obInputStyle()}" />
      <input id="obProductPrice${i}" type="number" min="0" step="0.01" value="${escapeHtml(p.price)}" placeholder="Price"
        style="${_obInputStyle()}" />
      <input id="obProductStock${i}" type="number" min="0" step="1" value="${escapeHtml(p.stock)}" placeholder="Stock"
        style="${_obInputStyle()}" />
    </div>`).join('');

  return `
    <h2 style="color:#fff;font-size:1.25rem;font-weight:800;margin-bottom:6px;letter-spacing:-.02em;">
      Add your first products
    </h2>
    <p style="color:rgba(255,255,255,.5);font-size:.85rem;line-height:1.5;margin-bottom:14px;">
      Just enough to start selling — you can add more, plus recipes and variants, anytime.
    </p>
    ${templateChips ? `<div style="display:flex;flex-wrap:wrap;margin-bottom:14px;">${templateChips}</div>` : ''}
    ${rows}
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button onclick="_obBack()" style="flex:1;background:none;color:rgba(255,255,255,.6);
        border:1.5px solid rgba(255,255,255,.18);border-radius:10px;padding:14px;font-size:.95rem;
        font-weight:800;cursor:pointer;">Back</button>
      <button onclick="_obFinish()" style="flex:2;background:#fff;color:#000;border:none;border-radius:10px;
        padding:14px;font-size:.95rem;font-weight:800;cursor:pointer;">Finish</button>
    </div>`;
}

window.startOnboardingWizard = startOnboardingWizard;
