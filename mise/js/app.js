/* ═══════════════════════════════════════════════════════════════
   MISE — APP  ·  shell · icons · router · bootstrap
═══════════════════════════════════════════════════════════════ */
const ICON = {
  command:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 8h6V4h-6zM4 20h6v-4H4z"/></svg>',
  service:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12.5a1.5 1.5 0 0 0 1.5 1.2h8.5a1.5 1.5 0 0 0 1.5-1.2L22 7H6"/></svg>',
  foresight:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 3 3 7-8"/><path d="M14 4h6v6"/><circle cx="8" cy="12" r="1.2" fill="currentColor"/><circle cx="11" cy="15" r="1.2" fill="currentColor"/></svg>',
  larder:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  bell:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  sun:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>',
  moon:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  search:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
  up:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14l5-5 5 5"/></svg>',
  down:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>',
  plus:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  arrow:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  spark:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
};

const NAV = [
  { id: 'command', label: 'Command' },
  { id: 'service', label: 'Service' },
  { id: 'foresight', label: 'Foresight' },
  { id: 'larder', label: 'Larder' },
];

const VIEWS = {}; // populated by view modules

function renderShell() {
  const wd = DATA.today.toLocaleDateString('en-US', { weekday: 'long' });
  const dstr = DATA.today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  document.getElementById('root').innerHTML = `
    <div class="app">
      <aside class="rail">
        <div class="rail-brand" title="Mise">M</div>
        <nav class="rail-nav">
          ${NAV.map(n => `<button class="rail-btn" data-nav="${n.id}">${ICON[n.id]}<span class="tip">${n.label}</span></button>`).join('')}
        </nav>
        <button class="rail-btn" id="themeBtn" title="Theme">${ICON.moon}</button>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="topbar-title">
            <span class="eyebrow" id="crumb">Command</span>
            <span class="now">${wd}, ${dstr}</span>
          </div>
          <div class="topbar-spacer"></div>
          <div class="live-clock"><span class="pulse"></span><span id="clock">—</span> · Maison Levain</div>
          <button class="icon-btn" title="Search">${ICON.search}</button>
          <button class="icon-btn" title="Alerts">${ICON.bell}</button>
          <div class="avatar" title="Camille — Owner">CL</div>
        </header>
        <main class="stage" id="stage"></main>
      </div>
    </div>`;

  // nav wiring
  document.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => go(b.dataset.nav)));
  document.getElementById('themeBtn').addEventListener('click', () => {
    STORE.toggleTheme();
    document.getElementById('themeBtn').innerHTML =
      STORE.state.theme === 'dark' ? ICON.sun : ICON.moon;
  });
  document.getElementById('themeBtn').innerHTML = STORE.state.theme === 'dark' ? ICON.sun : ICON.moon;

  startClock();
}

function go(view) {
  STORE.set({ view });
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  document.getElementById('crumb').textContent = NAV.find(n => n.id === view)?.label || '';
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'view';
  stage.appendChild(wrap);
  (VIEWS[view] || VIEWS.command)(wrap);
}

function startClock() {
  const c = document.getElementById('clock');
  // clock ticks from the demo "now" so it always reads a lively service time
  let base = new Date(DATA.today);
  function tick() {
    base = new Date(base.getTime() + 1000);
    c.textContent = base.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  tick(); setInterval(tick, 1000);
}

function boot() {
  STORE.applyTheme();
  renderShell();
  go('command');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
