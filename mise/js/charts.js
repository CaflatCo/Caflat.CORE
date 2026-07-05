/* ═══════════════════════════════════════════════════════════════
   MISE — CHARTS  ·  crisp animated SVG, zero dependencies
   Charts are one of the few places colour is permitted.
═══════════════════════════════════════════════════════════════ */
const CHART = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };

  /* Smooth area+line chart with animated draw-on. data: [{label, value}] */
  function area(host, data, opts = {}) {
    const { h = 220, stroke = 'var(--data-1)', fill = true, pad = 8, showAxis = true, valueFmt = (v) => v } = opts;
    host.innerHTML = '';
    const w = host.clientWidth || 640;
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h, preserveAspectRatio: 'none' });
    const vals = data.map(d => d.value);
    const max = Math.max(...vals) * 1.12, min = Math.min(...vals) * 0.85;
    const X = (i) => pad + (i / (data.length - 1)) * (w - pad * 2);
    const Y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2 - 14);

    // gridlines (faint, monochrome)
    if (showAxis) for (let g = 0; g <= 3; g++) {
      const yy = pad + (g / 3) * (h - pad * 2 - 14);
      svg.appendChild(el('line', { x1: pad, x2: w - pad, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-width': 1 }));
    }

    // smooth path (Catmull-Rom → bezier)
    const pts = data.map((d, i) => [X(i), Y(d.value)]);
    let dPath = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      dPath += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
    }

    if (fill) {
      const gid = 'g' + Math.random().toString(36).slice(2, 7);
      const grad = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.appendChild(el('stop', { offset: '0%', 'stop-color': stroke, 'stop-opacity': .18 }));
      grad.appendChild(el('stop', { offset: '100%', 'stop-color': stroke, 'stop-opacity': 0 }));
      svg.appendChild(grad);
      const areaP = el('path', { d: `${dPath} L ${X(data.length - 1)} ${h - pad} L ${X(0)} ${h - pad} Z`, fill: `url(#${gid})` });
      areaP.style.opacity = 0; areaP.style.transition = 'opacity .8s ease .3s';
      svg.appendChild(areaP); requestAnimationFrame(() => areaP.style.opacity = 1);
    }

    const line = el('path', { d: dPath, fill: 'none', stroke, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(line);
    const len = line.getTotalLength ? line.getTotalLength() : 1000;
    if (!M.reduce && line.getTotalLength) {
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
      line.style.transition = 'stroke-dashoffset 1.1s var(--ease-out)';
      requestAnimationFrame(() => line.style.strokeDashoffset = 0);
    }

    // endpoint dot
    const last = pts[pts.length - 1];
    const dot = el('circle', { cx: last[0], cy: last[1], r: 4.5, fill: stroke, stroke: 'var(--card)', 'stroke-width': 2 });
    dot.style.opacity = 0; dot.style.transition = 'opacity .3s ease 1s';
    svg.appendChild(dot); requestAnimationFrame(() => dot.style.opacity = 1);

    host.appendChild(svg);

    // x labels
    if (opts.labels) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;margin-top:6px';
      data.forEach((d, i) => { if (i % (opts.labelEvery || 2) === 0 || i === data.length - 1) {
        const s = document.createElement('span'); s.textContent = d.label;
        s.style.cssText = 'font-size:var(--t-2xs);color:var(--ink-4);font-weight:600'; row.appendChild(s);
      }});
      host.appendChild(row);
    }
  }

  /* Vertical bars with grow animation. data:[{label,value,color?,muted?}] */
  function bars(host, data, opts = {}) {
    const { h = 200, gap = 6, radius = 6, fmt = (v) => v } = opts;
    host.innerHTML = '';
    const max = Math.max(...data.map(d => d.value)) * 1.1 || 1;
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;align-items:flex-end;gap:${gap}px;height:${h}px`;
    data.forEach((d, i) => {
      const col = document.createElement('div');
      col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end';
      const bar = document.createElement('div');
      const pct = (d.value / max) * 100;
      bar.style.cssText = `width:100%;border-radius:${radius}px ${radius}px 3px 3px;
        background:${d.color || (d.muted ? 'var(--line)' : 'var(--ink)')};
        height:0%;transform-origin:bottom;transition:height .7s var(--ease-out) ${i * 45}ms`;
      bar.title = `${d.label}: ${fmt(d.value)}`;
      const lab = document.createElement('span');
      lab.textContent = d.label;
      lab.style.cssText = 'font-size:var(--t-2xs);color:var(--ink-4);font-weight:700';
      col.appendChild(bar); col.appendChild(lab); wrap.appendChild(col);
      requestAnimationFrame(() => setTimeout(() => bar.style.height = pct + '%', 20));
    });
    host.appendChild(wrap);
  }

  /* Horizontal proportion bar (category mix) — monochrome with one accent */
  function proportion(host, data, opts = {}) {
    host.innerHTML = '';
    const track = document.createElement('div');
    track.style.cssText = 'display:flex;height:14px;border-radius:99px;overflow:hidden;background:var(--line)';
    const shades = ['var(--ink)', 'var(--ink-2)', 'var(--ink-3)', 'var(--ink-4)', 'var(--line)'];
    data.forEach((d, i) => {
      const seg = document.createElement('div');
      seg.style.cssText = `width:0%;background:${shades[i % shades.length]};transition:width .8s var(--ease-out) ${i * 80}ms`;
      seg.title = `${d.cat}: ${DATA.fmt$(d.value)}`;
      track.appendChild(seg);
      requestAnimationFrame(() => setTimeout(() => seg.style.width = (d.pct * 100) + '%', 20));
    });
    host.appendChild(track);
  }

  /* Radial gauge 0..1 with animated sweep. Colour by tone. */
  function gauge(host, value, opts = {}) {
    const { size = 128, stroke = 12, tone = 'var(--ink)', label = '' } = opts;
    host.innerHTML = '';
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const svg = el('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` });
    svg.appendChild(el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--line)', 'stroke-width': stroke }));
    const arc = el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: tone, 'stroke-width': stroke,
      'stroke-linecap': 'round', transform: `rotate(-90 ${size / 2} ${size / 2})` });
    arc.style.strokeDasharray = c; arc.style.strokeDashoffset = c;
    arc.style.transition = 'stroke-dashoffset 1s var(--ease-out)';
    svg.appendChild(arc);
    host.appendChild(svg);
    requestAnimationFrame(() => arc.style.strokeDashoffset = c * (1 - Math.min(1, value)));
  }

  /* Mini sparkline (inline) */
  function spark(host, vals, opts = {}) {
    const { h = 34, w = 88, stroke = 'var(--ink-3)' } = opts;
    host.innerHTML = '';
    const svg = el('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
    const max = Math.max(...vals), min = Math.min(...vals);
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`).join(' ');
    const pl = el('polyline', { points: pts, fill: 'none', stroke, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(pl); host.appendChild(svg);
  }

  return { area, bars, proportion, gauge, spark };
})();
