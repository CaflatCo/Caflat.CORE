/* ═══════════════════════════════════════════════════════════════
   MISE — ICONS  ·  hand-drawn line glyphs, monochrome, currentColor
   No emoji anywhere. Every product + UI mark is a bespoke SVG.
   Stroke-based, 24px grid, rounded joins to sit with Nunito.
═══════════════════════════════════════════════════════════════ */
const SVG = (inner, sw = 1.6) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/* ── Product glyphs (keyed to product.icon) ── */
const PROD_ICON = {
  // Butter croissant — the classic crescent with segment scoring
  croissant: SVG('<path d="M3 15c2.5 3 7 4 10.5 2.2C18 15 20 11 20 8c-2 1.4-3.6 1.7-5.2 1.3M3 15c-.6-2.4.3-4.6 2-5.7M3 15l2-1.2M8.4 10.7l1.6 2.4M11.8 9.6l1.4 2.6M15.2 9.4c1.3-.2 2.6-1 3.6-2.2"/>'),
  // Pain au chocolat — pillow bun with two chocolate batons peeking
  pdc: SVG('<rect x="3.5" y="7.5" width="17" height="9" rx="3"/><path d="M9 7.6V16.4M15 7.6V16.4"/>'),
  // Almond croissant — crescent dusted with almond flakes
  almond: SVG('<path d="M3.5 14.5c2.4 2.8 6.6 3.7 10 2 4.2-2 6-6 6-8.8-1.8 1.3-3.3 1.6-4.8 1.2"/><path d="M8 11.8l.9 1.6M11.4 10.8l.9 1.6M14.6 10.4l.9 1.6"/>'),
  // Kouign-amann — laminated square pastry seen top-down (nested folds)
  kouign: SVG('<rect x="4.5" y="4.5" width="15" height="15" rx="3.4"/><rect x="8.2" y="8.2" width="7.6" height="7.6" rx="2"/><path d="M4.8 4.8l3.4 3.4M19.2 4.8l-3.4 3.4M4.8 19.2l3.4-3.4M19.2 19.2l-3.4-3.4" stroke-width="1.1"/>'),
  // Sourdough loaf — round boule with a scored ear
  sourdough: SVG('<path d="M3.5 13.5c0-4 3.8-7 8.5-7s8.5 3 8.5 7c0 1.8-1.4 3-3.2 3H6.7c-1.8 0-3.2-1.2-3.2-3z"/><path d="M9 8.6l2.4 4.8M12.6 8.2l2.2 4.6"/>'),
  // Baguette — long scored loaf
  baguette: SVG('<path d="M4.2 16.8c-1.2-1.2-1-3.2.4-4.6l7.6-7.6c1.4-1.4 3.4-1.6 4.6-.4s1 3.2-.4 4.6l-7.6 7.6c-1.4 1.4-3.4 1.6-4.6.4z"/><path d="M9 9.4l1.6 1.6M11.6 6.8l1.6 1.6M6.4 12l1.6 1.6"/>'),
  // Country miche — large boule with curved ear scoring
  miche: SVG('<circle cx="12" cy="12" r="8"/><path d="M7.2 10.2c1.6-1.1 3.2-1.1 4.8 0M9 13.6c1.6-1.1 3.2-1.1 4.8 0M14.6 9.4c.9-.6 1.9-.7 2.8-.2" stroke-width="1.3"/>'),
  // Canelé — fluted cake with a domed top (not a bin!)
  canele: SVG('<path d="M7.6 10.2C7.6 7.6 9.6 5.5 12 5.5s4.4 2.1 4.4 4.7v5.5c0 1.8-2 3.3-4.4 3.3s-4.4-1.5-4.4-3.3z"/><path d="M12 5.6v13.4M9.6 6.6v11.9M14.4 6.6v11.9" stroke-width="1.2"/>'),
  // Chocolate éclair — oblong choux with iced top
  eclair: SVG('<rect x="3.5" y="8.5" width="17" height="7" rx="3.5"/><path d="M4.6 10.4c1.8 1 4.6 1.6 7.4 1.6s5.6-.6 7.4-1.6"/>'),
  // Lemon tart — shell with a citrus swirl
  tart: SVG('<path d="M4 14h16l-.6 1.8c-.3 1-1.2 1.7-2.3 1.7H6.9c-1.1 0-2-.7-2.3-1.7z"/><path d="M5.6 14c0-2.4 2.9-4.3 6.4-4.3s6.4 1.9 6.4 4.3"/><path d="M12 11.4a2.4 2.4 0 1 0 0 4.8" stroke-width="1.3"/>'),
  // Macaron — two shells with a filling band
  macaron: SVG('<path d="M4.5 9.5c0-1.7 3.4-3 7.5-3s7.5 1.3 7.5 3c0 1-1.2 1.9-3 2.4M4.5 14.5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3c0-1-1.2-1.9-3-2.4"/><path d="M4.5 9.5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5M4.5 14.5C4.5 13.1 7.9 12 12 12s7.5 1.1 7.5 2.5"/>'),
  // Coffee cup — for all espresso-based drinks
  coffee: SVG('<path d="M5 9h11v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h1.8a2.2 2.2 0 0 1 0 4.4H16"/><path d="M8 3.6c-.7.8-.7 1.7 0 2.5M11.5 3.6c-.7.8-.7 1.7 0 2.5"/>'),
  // Matcha latte — cup with a leaf
  matcha: SVG('<path d="M5 10h12v3.8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M17 11h1.6a2 2 0 0 1 0 4H17"/><path d="M11 8c-1.6-.2-3-1.4-3.2-3 1.6.2 3 1.4 3.2 3zm0 0c.2-1.6 1.6-2.8 3.2-3-.2 1.6-1.6 2.8-3.2 3z" stroke-width="1.3"/>'),
};

/* ── UI glyphs ── */
const UI_ICON = {
  cup: SVG('<path d="M5 9h11v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h1.8a2.2 2.2 0 0 1 0 4.4H16"/><path d="M8 3.6c-.7.8-.7 1.7 0 2.5M11.5 3.6c-.7.8-.7 1.7 0 2.5"/>', 1.4),
  receipt: SVG('<path d="M6 3.5h12v17l-2.4-1.4-2.4 1.4-2.4-1.4-2.4 1.4L6 20.5z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>', 1.4),
  box: SVG('<path d="M12 3.2l8 4v9.6l-8 4-8-4V7.2z"/><path d="M4.3 7.4L12 11.2l7.7-3.8M12 11.2V20"/>', 1.5),
  check: SVG('<path d="M4.5 12.5l5 5 10-11"/>', 2),
  spark: SVG('<path d="M12 3l1.7 5.1L19 9.8l-5.3 1.7L12 17l-1.7-5.5L5 9.8l5.3-1.7z"/>', 1.5),
};

/* helper: product → svg (falls back to a cup) */
function prodIcon(key) { return PROD_ICON[key] || UI_ICON.cup; }

/* Real Caflat products have no icon key — infer one from the name, then the
   category, so 2.0 shows a sensible glyph for whatever the user actually sells. */
function prodIconFor(name, cat) {
  const n = String(name || '').toLowerCase();
  const test = [
    [/almond/, 'almond'], [/pain au|au chocolat|chocolate croissant/, 'pdc'],
    [/kouign/, 'kouign'], [/croissant/, 'croissant'],
    [/sourdough/, 'sourdough'], [/baguette/, 'baguette'], [/miche|country loaf|boule/, 'miche'],
    [/canel/, 'canele'], [/éclair|eclair/, 'eclair'], [/tart|pie/, 'tart'], [/macaron/, 'macaron'],
    [/matcha/, 'matcha'], [/espresso|coffee|cortado|cappucc|latte|americano|mocha|brew|drip|tea/, 'coffee'],
  ];
  for (const [re, key] of test) if (re.test(n)) return PROD_ICON[key];
  const c = String(cat || '').toLowerCase();
  if (/bread|loaf/.test(c)) return PROD_ICON.sourdough;
  if (/vienno|pastr/.test(c)) return PROD_ICON.croissant;
  if (/patiss|dessert|cake/.test(c)) return PROD_ICON.macaron;
  if (/caf|coffee|drink|bever/.test(c)) return PROD_ICON.coffee;
  return UI_ICON.cup;
}
