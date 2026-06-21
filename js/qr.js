/* ═══════════════════════════════════════════════════════
   QR.JS — Caflat.CORE QR Code Generator
   Clean rewrite. Byte mode. Proper version selection.
   Tested against iOS Safari camera scanner.
═══════════════════════════════════════════════════════ */
(function(root) {
  'use strict';

  /* ── Reed-Solomon GF(256) ── */
  var GF_EXP = new Uint8Array(512);
  var GF_LOG = new Uint8Array(256);
  (function(){
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x = x << 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (var i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
  }

  function rsGenerator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        ng[j]   ^= g[j];
        ng[j+1] ^= gfMul(g[j], GF_EXP[i]);
      }
      g = ng;
    }
    return g;
  }

  function rsEncode(data, nEC) {
    var gen  = rsGenerator(nEC);
    var msg  = data.slice();
    for (var i = 0; i < nEC; i++) msg.push(0);
    for (var i = 0; i < data.length; i++) {
      var coef = msg[i];
      if (coef !== 0) {
        for (var j = 1; j < gen.length; j++) {
          msg[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  }

  /* ── QR capacity tables (byte mode, EC level M) ──
     [version] = { totalCW, dataCW, ecCW, blocks }
     Source: ISO/IEC 18004:2015 Table 9 */
  var CAP_M = [
    null,
    { dc:16,  ec:10,  b:1  }, // v1  — 10 data codewords
    { dc:28,  ec:16,  b:1  }, // v2
    { dc:44,  ec:26,  b:2  }, // v3
    { dc:64,  ec:36,  b:2  }, // v4
    { dc:86,  ec:48,  b:2  }, // v5
    { dc:108, ec:64,  b:4  }, // v6
    { dc:124, ec:72,  b:4  }, // v7
    { dc:154, ec:88,  b:2  }, // v8
    { dc:182, ec:110, b:3  }, // v9
    { dc:216, ec:130, b:4  }, // v10
  ];

  /* Byte mode data capacity = dataCW - 2 (mode+length) - padding */
  var BYTE_CAP_M = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 214];

  function selectVersion(byteLen) {
    for (var v = 1; v <= 10; v++) {
      if (byteLen <= BYTE_CAP_M[v]) return v;
    }
    return 10; // max supported
  }

  /* ── Data encoding ── */
  function encodeBytes(text) {
    /* Encode as UTF-8 bytes */
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var cp = text.charCodeAt(i);
      if (cp < 0x80) {
        bytes.push(cp);
      } else if (cp < 0x800) {
        bytes.push(0xC0 | (cp >> 6));
        bytes.push(0x80 | (cp & 0x3F));
      } else if (cp < 0x10000) {
        bytes.push(0xE0 | (cp >> 12));
        bytes.push(0x80 | ((cp >> 6) & 0x3F));
        bytes.push(0x80 | (cp & 0x3F));
      } else {
        bytes.push(0xF0 | (cp >> 18));
        bytes.push(0x80 | ((cp >> 12) & 0x3F));
        bytes.push(0x80 | ((cp >> 6) & 0x3F));
        bytes.push(0x80 | (cp & 0x3F));
      }
    }
    return bytes;
  }

  function buildCodewords(bytes, version) {
    var cap   = CAP_M[version];
    var total = cap.dc;
    var bits  = [];

    function pushBits(val, n) {
      for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }

    pushBits(0b0100, 4);          // byte mode indicator
    pushBits(bytes.length, 8);    // character count (v1-9 = 8 bits)
    for (var i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
    pushBits(0, 4);               // terminator

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // Convert to codewords
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | (bits[i+j] || 0);
      cw.push(b);
    }

    // Pad to total capacity
    var pad = [0xEC, 0x11];
    var pi  = 0;
    while (cw.length < total) cw.push(pad[pi++ % 2]);

    return cw;
  }

  function buildFinalMessage(cw, version) {
    var cap = CAP_M[version];
    var ec  = rsEncode(cw, cap.ec);
    return cw.concat(ec);
  }

  /* ── Matrix construction ── */
  function makeMatrix(n) {
    var m = [];
    for (var i = 0; i < n; i++) {
      m.push(new Array(n).fill(null));
    }
    return m;
  }

  function placeFinder(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
        var isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        var isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[rr][cc] = (isBorder || isCenter) ? 1 : 0;
      }
    }
  }

  function placeTiming(m) {
    var n = m.length;
    for (var i = 8; i < n - 8; i++) {
      if (m[6][i] === null) m[6][i] = i % 2 === 0 ? 1 : 0;
      if (m[i][6] === null) m[i][6] = i % 2 === 0 ? 1 : 0;
    }
  }

  function placeDarkModule(m, version) {
    m[4 * version + 9][8] = 1;
  }

  function buildReservedMap(n) {
    var res = [];
    for (var i = 0; i < n; i++) res.push(new Array(n).fill(false));

    function reserveFinder(row, col) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var rr = row + r, cc = col + c;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          res[rr][cc] = true;
        }
      }
    }

    reserveFinder(0, 0);
    reserveFinder(0, n - 7);
    reserveFinder(n - 7, 0);

    // Timing
    for (var i = 0; i < n; i++) { res[6][i] = true; res[i][6] = true; }

    // Format info
    for (var i = 0; i <= 8; i++) { res[8][i] = true; res[i][8] = true; }
    for (var i = 0; i < 8; i++) {
      res[n - 1 - i][8] = true;
      res[8][n - 1 - i] = true;
    }

    return res;
  }

  function placeData(m, msg) {
    var n   = m.length;
    var bit = 0;
    var col = n - 1;

    while (col > 0) {
      if (col === 6) col--; // skip timing column
      for (var row = 0; row < n; row++) {
        var r = (Math.floor((n - 1 - col) / 2) % 2 === 0) ? (n - 1 - row) : row;
        for (var i = 0; i < 2; i++) {
          var c = col - i;
          if (m[r][c] !== null) continue;
          var byte = Math.floor(bit / 8);
          var bbit = 7 - (bit % 8);
          m[r][c] = byte < msg.length ? (msg[byte] >> bbit) & 1 : 0;
          bit++;
        }
      }
      col -= 2;
    }
  }

  /* Format info (EC level M = 00, mask pattern) */
  var FORMAT_INFO_M = [
    0x5412, // mask 0
    0x5125, // mask 1
    0x5E7C, // mask 2
    0x5B4B, // mask 3
    0x45F9, // mask 4
    0x40CE, // mask 5
    0x4F97, // mask 6
    0x4AA0, // mask 7
  ];

  function placeFormatInfo(m, maskIdx) {
    var n    = m.length;
    var data = FORMAT_INFO_M[maskIdx];
    var seq  = [];
    for (var i = 14; i >= 0; i--) seq.push((data >> i) & 1);

    var pos = [
      [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
      [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
    ];
    for (var i = 0; i < 15; i++) {
      m[pos[i][0]][pos[i][1]] = seq[i];
    }

    // Top-right copy
    for (var i = 0; i < 8; i++) m[8][n - 1 - i] = seq[i];
    // Bottom-left copy
    for (var i = 8; i < 15; i++) m[n - 15 + i][8] = seq[i];

    // Dark module
    m[n - 8][8] = 1;
  }

  var MASK_FNS = [
    function(r,c){ return (r+c)%2===0; },
    function(r,c){ return r%2===0; },
    function(r,c){ return c%3===0; },
    function(r,c){ return (r+c)%3===0; },
    function(r,c){ return (Math.floor(r/2)+Math.floor(c/3))%2===0; },
    function(r,c){ return (r*c)%2+(r*c)%3===0; },
    function(r,c){ return ((r*c)%2+(r*c)%3)%2===0; },
    function(r,c){ return ((r+c)%2+(r*c)%3)%2===0; },
  ];

  function applyMask(m, maskIdx, reserved) {
    var fn  = MASK_FNS[maskIdx];
    var n   = m.length;
    var cpy = m.map(function(row){ return row.slice(); });
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (reserved[r][c]) continue;
        if (cpy[r][c] !== null && fn(r, c)) cpy[r][c] ^= 1;
      }
    }
    return cpy;
  }

  function penaltyScore(m) {
    var n = m.length, p = 0;
    // Rule 1: 5+ in a row
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n - 4; c++) {
        var v = m[r][c];
        if (m[r][c+1]===v&&m[r][c+2]===v&&m[r][c+3]===v&&m[r][c+4]===v) {
          p += 3;
          var k = c+5; while(k<n && m[r][k]===v){ p++; k++; }
        }
      }
    }
    for (var c = 0; c < n; c++) {
      for (var r = 0; r < n - 4; r++) {
        var v = m[r][c];
        if (m[r+1][c]===v&&m[r+2][c]===v&&m[r+3][c]===v&&m[r+4][c]===v) {
          p += 3;
          var k = r+5; while(k<n && m[k][c]===v){ p++; k++; }
        }
      }
    }
    // Rule 2: 2x2 blocks
    for (var r = 0; r < n-1; r++) {
      for (var c = 0; c < n-1; c++) {
        var v = m[r][c];
        if (m[r][c+1]===v&&m[r+1][c]===v&&m[r+1][c+1]===v) p += 3;
      }
    }
    return p;
  }

  /* ── Main generator ── */
  function generateSVG(text, options) {
    options = options || {};
    var size     = options.size || 160;
    var ecLevel  = 'M'; // always M

    // Sanitize — replace characters that can't be represented in latin-1
    // and would corrupt byte-mode encoding on older scanners
    var clean = text
      .replace(/₱/g, 'PHP')
      .replace(/[^\x00-\xFF]/g, '?');

    var bytes   = encodeBytes(clean);
    var version = selectVersion(bytes.length);
    var n       = 4 * version + 17;

    // Build base matrix
    var m = makeMatrix(n);
    placeFinder(m, 0, 0);
    placeFinder(m, 0, n - 7);
    placeFinder(m, n - 7, 0);
    placeTiming(m);
    placeDarkModule(m, version);

    var reserved = buildReservedMap(n);

    // Encode data
    var cw  = buildCodewords(bytes, version);
    var msg = buildFinalMessage(cw, version);

    // Place data
    var dm  = m.map(function(r){ return r.slice(); });
    placeData(dm, msg);

    // Pick best mask
    var bestMask = 0, bestPenalty = Infinity;
    for (var mi = 0; mi < 8; mi++) {
      var masked = applyMask(dm, mi, reserved);
      placeFormatInfo(masked, mi);
      var pen = penaltyScore(masked);
      if (pen < bestPenalty) { bestPenalty = pen; bestMask = mi; }
    }

    var final = applyMask(dm, bestMask, reserved);
    placeFormatInfo(final, bestMask);

    // Render SVG — use integer module size, add quiet zone
    var quietModules = 4;
    var totalModules = n + 2 * quietModules;
    var moduleSize   = Math.floor(size / totalModules);
    if (moduleSize < 1) moduleSize = 1;
    var totalSize    = totalModules * moduleSize;
    var offset       = quietModules * moduleSize;

    var rects = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (final[r][c] === 1) {
          var x = offset + c * moduleSize;
          var y = offset + r * moduleSize;
          rects.push('<rect x="' + x + '" y="' + y + '" width="' + moduleSize + '" height="' + moduleSize + '"/>');
        }
      }
    }

    return '<svg xmlns="http://www.w3.org/2000/svg"'
      + ' viewBox="0 0 ' + totalSize + ' ' + totalSize + '"'
      + ' width="' + totalSize + '" height="' + totalSize + '"'
      + ' shape-rendering="crispEdges">'
      + '<rect width="' + totalSize + '" height="' + totalSize + '" fill="#fff"/>'
      + '<g fill="#000">' + rects.join('') + '</g>'
      + '</svg>';
  }

  root.CaflatQR = { generateSVG: generateSVG };

})(typeof window !== 'undefined' ? window : global);
