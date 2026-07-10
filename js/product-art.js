/* ─────────────────────────────────────────────────────────────
   Caflat.CORE — Product illustrations (vibrant flat SVG)
   Hand-drawn per-product cookie art for the client order form.
   Full-colour (unlike the monochrome mise/js/icons.js set).
   Exposed as window.getProductArt(name) → SVG string | ''.
   Art strings are trusted, bundled constants (safe to inject).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* wrap inner markup in a 48-grid svg that fills its tile */
  function svg(inner) {
    return '<svg class="p-art" viewBox="0 0 48 48" width="100%" height="100%" ' +
      'fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      inner + '</svg>';
  }

  /* soft contact shadow under every item */
  var GROUND = '<ellipse cx="24" cy="42.5" rx="15" ry="2.6" fill="#241708" opacity=".13"/>';

  /* dark-chocolate chip nib (classic teardrop), c = center, s = scale, r = rotation */
  function chip(cx, cy, s, r) {
    s = s || 1; r = r || 0;
    return '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + r + ') scale(' + s + ')">' +
      '<path d="M-3 2.1 Q-3.4 -1.4 -.1 -2.3 Q3.2 -2.5 3.2 .9 Q3.2 2.4 .2 2.5 Q-2.4 2.6 -3 2.1Z" fill="#3a2214"/>' +
      '<path d="M-1.6 -1 Q-.3 -1.7 1 -1" stroke="#714c2f" stroke-width=".8" stroke-linecap="round"/>' +
      '</g>';
  }

  /* white-chocolate chip (cream), same nib */
  function wchip(cx, cy, s, r) {
    s = s || 1; r = r || 0;
    return '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + r + ') scale(' + s + ')">' +
      '<path d="M-3 2.1 Q-3.4 -1.4 -.1 -2.3 Q3.2 -2.5 3.2 .9 Q3.2 2.4 .2 2.5 Q-2.4 2.6 -3 2.1Z" fill="#f7efdf"/>' +
      '<path d="M-1.6 -1 Q-.3 -1.7 1 -1" stroke="#fffdf6" stroke-width=".9" stroke-linecap="round"/>' +
      '<path d="M-2.6 1.6 Q0 2.6 2.6 1.4" stroke="#e2d6bd" stroke-width=".7" stroke-linecap="round"/>' +
      '</g>';
  }

  /* a chunky organic cookie disc, given palette; returns markup centred ~ (24,24) */
  function disc(base, edge, hi) {
    return (
      /* body — slightly irregular round for an organic baked look */
      '<path d="M24 8.2 C31.5 8 39.6 12.4 39.8 21.8 C40 30.6 33.4 39.6 24 39.8 ' +
        'C14.8 40 8.2 33.2 8.2 23.6 C8.2 13.6 16.6 8.4 24 8.2 Z" fill="' + base + '"/>' +
      /* baked lower-right shading */
      '<path d="M37.6 16 C40.4 21.6 39.4 31.4 31.8 37.4 C27.8 40.2 20 40.6 15.4 37.8 ' +
        'C22 41 32.4 38.6 37 30.4 C40 25 39.6 19.4 37.6 16 Z" fill="' + edge + '" opacity=".55"/>' +
      /* top-left glaze highlight */
      '<path d="M15 12.6 C19 10 26 9.6 30 11.4 C24.6 10.8 18.8 12.4 15 16.4 ' +
        'C12.6 18.8 11.8 21.6 12.2 24.4 C10.8 20 12 15.4 15 12.6 Z" fill="' + hi + '" opacity=".8"/>'
    );
  }

  /* cocoa-dusted ball shell, colour palette configurable */
  function ball(base, dark, hi, speckA, speckB) {
    return (
      '<circle cx="24" cy="24.5" r="16" fill="' + base + '"/>' +
      /* lower-right sphere shadow (kept inside the ball) */
      '<ellipse cx="28.5" cy="30" rx="10" ry="8.4" fill="' + dark + '" opacity=".5"/>' +
      '<ellipse cx="30" cy="32.5" rx="6.4" ry="4.6" fill="' + dark + '" opacity=".45"/>' +
      /* top-left soft highlight + specular */
      '<ellipse cx="18.5" cy="18" rx="7.5" ry="6" fill="' + hi + '" opacity=".55"/>' +
      '<ellipse cx="17.6" cy="16.8" rx="2.4" ry="1.7" fill="#fff" opacity=".35"/>' +
      /* dusting speckles */
      '<circle cx="20" cy="27" r="1" fill="' + speckA + '" opacity=".7"/>' +
      '<circle cx="27" cy="21" r=".8" fill="' + speckB + '" opacity=".6"/>' +
      '<circle cx="30" cy="26" r=".9" fill="' + speckA + '" opacity=".6"/>' +
      '<circle cx="22.5" cy="32" r=".8" fill="' + speckB + '" opacity=".55"/>' +
      '<circle cx="15" cy="24" r=".8" fill="' + speckA + '" opacity=".5"/>' +
      '<circle cx="25" cy="34" r=".7" fill="' + speckB + '" opacity=".5"/>'
    );
  }

  /* pistachio + kunafa filling patch (green), centred at (cx,cy), radius rr */
  function pistachio(cx, cy, rr) {
    var r = rr || 7.5;
    return (
      /* shell rim (thickness) */
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 1.4) + '" fill="#3c2415"/>' +
      /* green cream */
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#8cc63f"/>' +
      '<path d="M' + (cx - r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 0 0 ' + (cx + r) + ' ' + cy +
        ' Q' + cx + ' ' + (cy + r * 0.5) + ' ' + (cx - r) + ' ' + cy + 'Z" fill="#6ba32c" opacity=".55"/>' +
      /* kunafa golden strands */
      '<path d="M' + (cx - 4) + ' ' + (cy - 2.5) + ' Q' + cx + ' ' + (cy - 4.5) + ' ' + (cx + 4) + ' ' + (cy - 2) +
        '" stroke="#e0a63c" stroke-width="1.1" stroke-linecap="round"/>' +
      '<path d="M' + (cx - 4.5) + ' ' + (cy + 0.5) + ' Q' + cx + ' ' + (cy - 1) + ' ' + (cx + 4.5) + ' ' + (cy + 1) +
        '" stroke="#efc161" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M' + (cx - 3.5) + ' ' + (cy + 3) + ' Q' + cx + ' ' + (cy + 2) + ' ' + (cx + 3.8) + ' ' + (cy + 3.4) +
        '" stroke="#e0a63c" stroke-width="1" stroke-linecap="round"/>' +
      /* pistachio nibs */
      '<ellipse cx="' + (cx - 2.6) + '" cy="' + (cy + 1.6) + '" rx="1.5" ry="1" fill="#4f7d1f" transform="rotate(-20 ' + (cx - 2.6) + ' ' + (cy + 1.6) + ')"/>' +
      '<ellipse cx="' + (cx + 3) + '" cy="' + (cy - 1) + '" rx="1.4" ry="1" fill="#5c8f27" transform="rotate(25 ' + (cx + 3) + ' ' + (cy - 1) + ')"/>' +
      /* highlight */
      '<ellipse cx="' + (cx - 2.5) + '" cy="' + (cy - 3) + '" rx="2.2" ry="1.3" fill="#c3e88a" opacity=".7"/>'
    );
  }

  var ART = {

    /* 1 — Dubai chewy: cocoa ball, green pistachio-kunafa filling revealed */
    'dubai-chewy': svg(
      GROUND +
      ball('#5a3a24', '#3c2716', '#7a5236', '#3f2717', '#6e4a30') +
      pistachio(27, 20, 7.2)
    ),

    /* 2 — Biscoff chewy: crushed-biscoff coated ball, amber filling */
    'biscoff-chewy': svg(
      GROUND +
      ball('#c07a3c', '#9a5c28', '#e0a25c', '#a4652c', '#e6b070') +
      /* crumb speckles */
      '<circle cx="19" cy="22" r="1.1" fill="#89511f" opacity=".8"/>' +
      '<circle cx="30" cy="30" r="1.2" fill="#89511f" opacity=".75"/>' +
      '<circle cx="16.5" cy="28" r=".9" fill="#f0c98d" opacity=".8"/>' +
      '<circle cx="32" cy="20.5" r=".9" fill="#89511f" opacity=".7"/>' +
      /* molten biscoff filling — darker than the tan shell so it reads */
      '<circle cx="27" cy="20" r="8.4" fill="#794516"/>' +
      '<circle cx="27" cy="20" r="7" fill="#a8631f"/>' +
      '<path d="M20 20 A7 7 0 0 0 34 20 Q27 23.4 20 20Z" fill="#7d4514" opacity=".55"/>' +
      '<path d="M22.6 17.6 Q27 15.9 31.4 17.9" stroke="#e6ad63" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M22.4 21 Q27 19.6 31.6 21.4" stroke="#8a531f" stroke-width="1" stroke-linecap="round"/>' +
      '<ellipse cx="24.4" cy="17.2" rx="2.2" ry="1.2" fill="#eac488" opacity=".75"/>'
    ),

    /* 3 — Nutella chewy: cocoa ball, glossy dark-chocolate filling */
    'nutella-chewy': svg(
      GROUND +
      ball('#523421', '#38230f', '#6f4a2f', '#3a2411', '#674630') +
      '<circle cx="27" cy="20" r="8.6" fill="#2f1c0e"/>' +
      '<circle cx="27" cy="20" r="7.2" fill="#48291a"/>' +
      '<path d="M19.8 20 A7.2 7.2 0 0 0 34.2 20 Q27 23.4 19.8 20Z" fill="#2c180c" opacity=".6"/>' +
      /* glossy sheen */
      '<path d="M22 17 Q26 14.4 31 16.6 Q27 16 22 17Z" fill="#8a5a37" opacity=".55"/>' +
      '<ellipse cx="24.4" cy="17.4" rx="2.6" ry="1.4" fill="#b9855c" opacity=".55"/>' +
      '<ellipse cx="30" cy="22" rx="1.3" ry=".8" fill="#6d4327" opacity=".6"/>'
    ),

    /* 4 — Classic chocolate chip */
    'choco-chip': svg(
      GROUND +
      disc('#e0a758', '#bd7f34', '#f3d094') +
      chip(18, 20, 1, -14) + chip(29, 18, 1.05, 20) + chip(24, 27, 1.1, 8) +
      chip(32, 27, .95, -22) + chip(16, 29, .95, 30) + chip(27, 33, .9, -10) +
      /* crumb flecks */
      '<circle cx="21" cy="30" r=".8" fill="#b06f2c" opacity=".7"/>' +
      '<circle cx="33" cy="21" r=".7" fill="#b06f2c" opacity=".6"/>'
    ),

    /* 5 — Matcha: green cookie, white chips, 3 matcha bars on top */
    'matcha': svg(
      GROUND +
      disc('#a6cd6a', '#7fa844', '#c8e59a') +
      wchip(18.5, 22, 1, -12) + wchip(28, 26, 1.05, 18) + wchip(21, 31, .95, 26) +
      wchip(31, 20, .9, -20) +
      /* three standing matcha bars */
      '<g transform="translate(24 18)">' +
        '<g transform="translate(-6.5 0) rotate(-8)">' +
          '<rect x="-2.6" y="-5.6" width="5.2" height="9.4" rx="1.4" fill="#6f9e34"/>' +
          '<rect x="-2.6" y="-5.6" width="2.1" height="9.4" rx="1" fill="#8cbb4d"/>' +
          '<rect x="-2.6" y="-5.6" width="5.2" height="2.3" rx="1.1" fill="#a9d072"/>' +
        '</g>' +
        '<g transform="translate(0 -1.5) rotate(4)">' +
          '<rect x="-2.6" y="-5.6" width="5.2" height="9.4" rx="1.4" fill="#6f9e34"/>' +
          '<rect x="-2.6" y="-5.6" width="2.1" height="9.4" rx="1" fill="#8cbb4d"/>' +
          '<rect x="-2.6" y="-5.6" width="5.2" height="2.3" rx="1.1" fill="#a9d072"/>' +
        '</g>' +
        '<g transform="translate(6.5 0.4) rotate(14)">' +
          '<rect x="-2.6" y="-5.6" width="5.2" height="9.4" rx="1.4" fill="#638f2d"/>' +
          '<rect x="-2.6" y="-5.6" width="2.1" height="9.4" rx="1" fill="#83b345"/>' +
          '<rect x="-2.6" y="-5.6" width="5.2" height="2.3" rx="1.1" fill="#a1c968"/>' +
        '</g>' +
      '</g>'
    ),

    /* 6 — Dubai pistachio crunch: dark cookie, dark chips, green crown */
    'dubai-pistachio-crunch': svg(
      GROUND +
      disc('#5b3a22', '#3f2714', '#7c5333') +
      chip(17, 28, .95, 18) + chip(31, 29, 1, -16) + chip(15.5, 21, .9, -8) +
      chip(33, 21, .9, 24) +
      pistachio(24, 21, 8)
    ),

    /* 7 — Scoopable classic: purple foil cup, domed golden cookie, chip on top */
    'scoopable-classic': (function () {
      return svg(
        GROUND +
        cup() +
        /* domed cookie above the rim */
        '<path d="M13.5 27 C13 18 18 12.4 24 12.4 C30 12.4 35 18 34.5 27 Z" fill="#e0a758"/>' +
        '<path d="M34.5 27 C35 19.6 31.6 14.8 27 13 C33 14 36.4 20 35.4 27 Z" fill="#bd7f34" opacity=".5"/>' +
        '<path d="M15.5 20 C17.6 15.6 21.4 13.4 25 13.6 C20.8 13.8 17.4 16.6 15.9 21 Z" fill="#f3d094" opacity=".8"/>' +
        /* surface cracks */
        '<path d="M20 18 Q22 20 21 22.5" stroke="#a86f2c" stroke-width=".8" stroke-linecap="round" opacity=".6"/>' +
        '<path d="M27 17 Q28.4 19.5 27.4 22" stroke="#a86f2c" stroke-width=".8" stroke-linecap="round" opacity=".55"/>' +
        chip(24, 18, 1.15, 6) +
        chip(19.5, 23.5, .8, -18) + chip(29, 24, .85, 16)
      );
    })(),

    /* 8 — Scoopable dubai: purple foil cup, green-topped dome, pistachio nut */
    'scoopable-dubai': (function () {
      return svg(
        GROUND +
        cup() +
        /* dome baked golden-brown, same dough as the classic */
        '<path d="M13.5 27 C13 18 18 12.4 24 12.4 C30 12.4 35 18 34.5 27 Z" fill="#e0a758"/>' +
        '<path d="M34.5 27 C35 19.6 31.6 14.8 27 13 C33 14 36.4 20 35.4 27 Z" fill="#bd7f34" opacity=".5"/>' +
        '<path d="M15.5 20 C17.6 15.6 21.4 13.4 25 13.6 C20.8 13.8 17.4 16.6 15.9 21 Z" fill="#f3d094" opacity=".8"/>' +
        /* green pistachio-kunafa pooled on the dome */
        '<path d="M15.5 22 C17.5 17 20.6 14 24 14 C27.4 14 30.5 17 32.5 22 ' +
          'C28 25.6 20 25.6 15.5 22 Z" fill="#8cc63f"/>' +
        '<path d="M16.4 22.4 C20.5 25 27.5 25 31.6 22.4 Q24 24.6 16.4 22.4Z" fill="#6ba32c" opacity=".5"/>' +
        '<path d="M19 19 Q24 16.8 29 19" stroke="#e0a63c" stroke-width="1.1" stroke-linecap="round"/>' +
        '<path d="M18.5 21.4 Q24 19.8 29.5 21.6" stroke="#efc161" stroke-width="1" stroke-linecap="round"/>' +
        '<ellipse cx="20.5" cy="18.6" rx="2.2" ry="1.2" fill="#bfe685" opacity=".7"/>' +
        /* pistachio nut on top */
        '<g transform="translate(24 14.4) rotate(-6)">' +
          '<ellipse cx="0" cy="0" rx="2.9" ry="4" fill="#6ea22c"/>' +
          '<ellipse cx="-.7" cy="-.4" rx="1.7" ry="2.8" fill="#8fc248"/>' +
          '<path d="M0 -3.4 L0 3.4" stroke="#557c1f" stroke-width=".7"/>' +
        '</g>'
      );
    })(),

    /* 9 — Red velvet: deep red cookie, white chips, cream-cheese swirl */
    'red-velvet': svg(
      GROUND +
      disc('#c23350', '#9c2540', '#d95e77') +
      wchip(17.5, 27, 1, -14) + wchip(30, 28, 1, 18) + wchip(19, 20, .9, 22) +
      wchip(32, 20, .85, -18) + wchip(24, 33, .9, 4) +
      /* clean piped cream-cheese rosette (stacked tiers) */
      '<ellipse cx="24" cy="23.4" rx="8.2" ry="4.2" fill="#efe0c4"/>' +
      '<ellipse cx="24" cy="22.5" rx="8.2" ry="4.2" fill="#faf3e2"/>' +
      '<ellipse cx="24" cy="20.5" rx="5.6" ry="3.1" fill="#e9d8ba" opacity=".9"/>' +
      '<ellipse cx="24" cy="19.8" rx="5.6" ry="3.1" fill="#fdf7ea"/>' +
      '<ellipse cx="24" cy="17.7" rx="3.1" ry="2" fill="#faf3e2"/>' +
      '<ellipse cx="24" cy="16.5" rx="1.6" ry="1.4" fill="#fffdf7"/>' +
      '<path d="M24 15.3 Q25.1 13.9 24.4 12.9" stroke="#fdf7ea" stroke-width="1.7" stroke-linecap="round"/>' +
      '<ellipse cx="21.6" cy="19.3" rx="1.4" ry=".9" fill="#fff" opacity=".7"/>'
    ),

    /* generic fallback cookie */
    'cookie': svg(
      GROUND +
      disc('#e0a758', '#bd7f34', '#f3d094') +
      chip(19, 21, 1, -12) + chip(29, 23, 1.05, 16) + chip(23, 30, 1, 6) +
      chip(32, 30, .9, -20)
    )
  };

  /* fluted purple/lilac foil baking cup (silver rim), shared by scoopables */
  function cup() {
    return (
      /* cup body — trapezoid, wider at top */
      '<path d="M11.8 26 L36.2 26 L33.4 41 Q33 42.4 31.4 42.4 L16.6 42.4 Q15 42.4 14.6 41 Z" fill="#b57edc"/>' +
      /* fluted shadow ribs */
      '<path d="M17 26.5 L15.6 41" stroke="#9a61c6" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M21.5 26.5 L21 41.6" stroke="#9a61c6" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M26.5 26.5 L27 41.6" stroke="#9a61c6" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M31 26.5 L32.4 41" stroke="#9a61c6" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>' +
      /* light flute highlights */
      '<path d="M19.3 26.5 L18.4 41" stroke="#c79ae6" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M24 26.5 L24 41.8" stroke="#cfa6ea" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M28.8 26.5 L29.6 41" stroke="#c79ae6" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
      /* silver rim */
      '<ellipse cx="24" cy="26" rx="12.4" ry="2.9" fill="#d7d7e2"/>' +
      '<ellipse cx="24" cy="25.4" rx="12.4" ry="2.4" fill="#eef0f6"/>' +
      '<ellipse cx="24" cy="26" rx="10.2" ry="1.7" fill="#c1c1d0"/>' +
      '<path d="M14 24.6 Q19 22.6 24 22.9" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity=".7"/>'
    );
  }

  /* ── matcher ─────────────────────────────────────────────── */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function slugFor(name) {
    var n = norm(name);
    if (!n) return '';
    var has = function (w) { return n.indexOf(w) !== -1; };

    /* specific before generic so overlaps resolve correctly */
    if (has('scoopable') && has('dubai')) return 'scoopable-dubai';
    if (has('scoopable')) return 'scoopable-classic';
    if (has('pistachio crunch') || (has('dubai') && has('crunch'))) return 'dubai-pistachio-crunch';
    if (has('biscoff') || has('lotus')) return 'biscoff-chewy';
    if (has('nutella')) return 'nutella-chewy';
    if (has('red velvet') || has('velvet')) return 'red-velvet';
    if (has('matcha')) return 'matcha';
    if (has('dubai') || has('pistachio') || has('kunafa') || has('knafeh')) return 'dubai-chewy';
    if (has('choco chip') || has('chocolate chip') || has('choc chip') || has('classic')) return 'choco-chip';
    if (has('cookie') || has('chewy')) return 'cookie';
    return '';
  }

  function getProductArt(name) {
    var slug = slugFor(name);
    return (slug && ART[slug]) || '';
  }

  window.getProductArt = getProductArt;
  /* expose the raw map for reuse in other sections later */
  window.CAFLAT_PRODUCT_ART = ART;
})();
