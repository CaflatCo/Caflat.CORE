/* ═══════════════════════════════════════════════════════════════
   CAFLAT 2.0 — APP  ·  shell · router · boot (hydrates REAL state)
═══════════════════════════════════════════════════════════════ */
const ICON = {
  command:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 8h6V4h-6zM4 20h6v-4H4z"/></svg>',
  service:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12.5a1.5 1.5 0 0 0 1.5 1.2h8.5a1.5 1.5 0 0 0 1.5-1.2L22 7H6"/></svg>',
  foresight:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 3 3 7-8"/><path d="M14 4h6v6"/><circle cx="8" cy="12" r="1.2" fill="currentColor"/><circle cx="11" cy="15" r="1.2" fill="currentColor"/></svg>',
  larder:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  production:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16M6 21V9a2 2 0 0 1 2-2h1V4h6v3h1a2 2 0 0 1 2 2v12"/><path d="M9 13h6M9 17h6"/></svg>',
  catalog:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3h8v8l-9.5 9.5a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8z"/><circle cx="15.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/></svg>',
  sales:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v17l-2.5-1.4-2.5 1.4-2.5-1.4L8 20l-2-1.1z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/></svg>',
  treasury: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M7 6V4M17 6V4"/></svg>',
  supply:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M3 9v6l9 5 9-5V9M12 14v5"/></svg>',
  classic:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M21 12H4"/></svg>',
  sun:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>',
  moon:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  bell:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  search:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
  up:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14l5-5 5 5"/></svg>',
  down:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>',
  arrow:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

const NAV = [
  { id: 'command', label: 'Command' },
  { id: 'service', label: 'Service' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'foresight', label: 'Foresight' },
  { id: 'production', label: 'Production' },
  { id: 'larder', label: 'Larder' },
  { id: 'sales', label: 'Sales' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'supply', label: 'Supply' },
];

const VIEWS = {};

/* tiny store (view/theme/asOf) with safe storage */
const S2 = (() => {
  const safe = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
                 set(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };
  const prefersDark = (() => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch(e){ return false; } })();
  const state = { view: 'command', theme: safe.get('caflat2-theme') || (prefersDark ? 'dark' : 'light'), asOfHour: null };
  function applyTheme(){ document.documentElement.setAttribute('data-theme', state.theme); }
  function toggleTheme(){ state.theme = state.theme === 'dark' ? 'light' : 'dark'; safe.set('caflat2-theme', state.theme); applyTheme(); }
  return { state, applyTheme, toggleTheme };
})();

function renderShell() {
  const now = new Date();
  const wd = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dstr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const brand = (APP_STATE.settings?.brandName) || 'Caflat.CORE';
  document.getElementById('root').innerHTML = `
    <div class="app">
      <aside class="rail">
        <div class="rail-brand" title="Caflat 2.0">C</div>
        <nav class="rail-nav">
          ${NAV.map(n => `<button class="rail-btn" data-nav="${n.id}">${ICON[n.id]}<span class="tip">${n.label}</span></button>`).join('')}
          <a class="rail-btn" href="../index.html" title="Classic app" style="margin-top:auto">${ICON.classic}<span class="tip">Classic app</span></a>
        </nav>
        <button class="rail-btn" id="themeBtn" title="Theme"></button>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-title">
            <span class="eyebrow" id="crumb">Command</span>
            <span class="now">${wd}, ${dstr}</span>
          </div>
          <div class="topbar-spacer"></div>
          <div class="live-clock"><span class="pulse"></span><span id="clock">—</span> · ${escapeHtml(brand)}</div>
          <span class="chip" style="height:32px"><span class="dot" style="background:var(--gold)"></span>2.0 Preview</span>
        </header>
        <main class="stage" id="stage"></main>
      </div>
    </div>`;

  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
  const tb = document.getElementById('themeBtn');
  tb.innerHTML = S2.state.theme === 'dark' ? ICON.sun : ICON.moon;
  tb.addEventListener('click', () => { S2.toggleTheme(); tb.innerHTML = S2.state.theme === 'dark' ? ICON.sun : ICON.moon; });
  startClock();
}

function go(view) {
  S2.state.view = view;
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  document.getElementById('crumb').textContent = NAV.find(n => n.id === view)?.label || '';
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'view'; stage.appendChild(wrap);
  (VIEWS[view] || VIEWS.command)(wrap);
}

function startClock() {
  const c = document.getElementById('clock'); if (!c) return;
  function tick(){ c.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); }
  tick(); setInterval(tick, 1000);
}

/* Bridge the classic app's showNotification() — fired internally by reused
   real functions like deleteIngredient, executeVoid, transferLineToPos,
   setProductLineStatus — into Mise's own toast system. Without this override
   those calls create the classic app's raw `.notification` markup, which has
   no CSS in 2.0 and renders as an unstyled bar at the bottom of the page. */
function showNotification(message, type = 'info') {
  const tone = { success: 'success', error: 'crit', warning: 'warn' }[type] || 'default';
  M.toast(message, '', tone);
}

/* Empty-state helper (shared) */
function emptyState(root, title, body, icon) {
  root.innerHTML = `<div class="card pad" style="border-radius:var(--r-xl);text-align:center;padding:var(--s9) var(--s6);max-width:560px;margin:var(--s8) auto">
    <div style="width:52px;height:52px;margin:0 auto var(--s4);color:var(--ink-4)">${icon || UI_ICON.spark}</div>
    <h2 style="margin-bottom:var(--s3)">${title}</h2>
    <p class="muted" style="max-width:42ch;margin:0 auto">${body}</p>
  </div>`;
}

function boot() {
  S2.applyTheme();
  // Hydrate the REAL app state from the shared localStorage key.
  try {
    const persisted = (typeof getPersistedState === 'function') ? getPersistedState() : null;
    if (persisted && typeof persisted === 'object') Object.keys(persisted).forEach(k => { APP_STATE[k] = persisted[k]; });
  } catch (e) { console.warn('2.0 hydrate failed', e); }
  renderShell();
  go('command');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
