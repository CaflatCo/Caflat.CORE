/* ═══════════════════════════════════════════════════════════════
   MISE — MOTION  ·  hand-built, GPU-cheap, framework-free
═══════════════════════════════════════════════════════════════ */
const M = (() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Count a number up with an ease-out curve. Formats via `fmt`. */
  function countUp(el, to, { from = 0, dur = 900, fmt = (n) => Math.round(n), prefix = '', suffix = '' } = {}) {
    if (!el) return;
    if (reduce) { el.textContent = prefix + fmt(to) + suffix; return; }
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const v = from + (to - from) * ease(p);
      el.textContent = prefix + fmt(v) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* Reveal children in sequence. Elements should have .count; we add .in. */
  function stagger(container, step = 55) {
    if (!container) return;
    [...container.children].forEach((c, i) => {
      c.style.animationDelay = (i * step) + 'ms';
      c.classList.add('in');
    });
  }

  /* Animate the thumb of a segmented control to the active button. */
  function segThumb(seg) {
    const thumb = seg.querySelector('.thumb');
    const on = seg.querySelector('button.on');
    if (!thumb || !on) return;
    const sr = seg.getBoundingClientRect(), br = on.getBoundingClientRect();
    thumb.style.width = br.width + 'px';
    thumb.style.transform = `translateX(${br.left - sr.left - 3}px)`;
  }

  /* Toast notification — colour is allowed here. */
  function toast(title, sub = '', type = 'default', ms = 3400) {
    let host = document.getElementById('toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `<div class="bar"></div><div class="grow" style="flex:1">
      <div class="t-title">${title}</div>${sub ? `<div class="t-sub">${sub}</div>` : ''}</div>`;
    host.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 340); }, ms);
  }

  /* IntersectionObserver reveal for on-scroll elements. */
  const io = new IntersectionObserver((ents) => {
    ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .15 });
  function reveal(el) { if (reduce) { el.classList.add('in'); return; } io.observe(el); }

  /* Tiny spring tween for arbitrary numeric props (used by charts on hover). */
  function tween(from, to, dur, cb, ease = (t) => 1 - Math.pow(1 - t, 3)) {
    if (reduce) { cb(to); return; }
    const t0 = performance.now();
    (function f(now) {
      const p = Math.min(1, (now - t0) / dur);
      cb(from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }

  return { countUp, stagger, segThumb, toast, reveal, tween, reduce };
})();
