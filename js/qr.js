/* ═══════════════════════════════════════════════════════
   CAFLAT QR — Pure SVG QR code generator
   No canvas. No toDataURL. No images. Works on iOS Safari.
   Self-contained — no external dependencies.
═══════════════════════════════════════════════════════ */
(function(root) {

  /* ── Reed-Solomon GF(256) ── */
  var GF = (function() {
    var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x = x << 1; if (x & 0x100) x ^= 0x11D;
    }
    for (var i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    return {
      mul: function(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; },
      poly: function(degree) {
        var p = [1];
        for (var i = 0; i < degree; i++) {
          var q = [1, EXP[i]];
          var r = new Array(p.length + 1).fill(0);
          for (var j = 0; j < p.length; j++)
            for (var k = 0; k < q.length; k++)
              r[j+k] ^= GF.mul(p[j], q[k]);
          p = r;
        }
        return p;
      },
      remainder: function(data, gen) {
        var r = data.slice();
        for (var i = 0; i < data.length; i++) {
          var c = r[i];
          if (c) for (var j = 1; j < gen.length; j++)
            r[i+j] ^= GF.mul(gen[j], c);
        }
        return r.slice(data.length);
      }
    };
  })();

  /* ── QR data encoding (byte mode only) ── */
  var EC_CODEWORDS = {
    // [version][level L/M/Q/H] = [total, dataCodewords, ecCodewords, blocks]
    1:  { L:[26,19,7,1],  M:[26,16,10,1], Q:[26,13,13,1], H:[26,9,17,1]  },
    2:  { L:[44,34,10,1], M:[44,28,16,1], Q:[44,22,22,1], H:[44,16,28,1] },
    3:  { L:[70,55,15,1], M:[70,44,26,1], Q:[70,34,36,2], H:[70,26,44,2] },
    4:  { L:[100,80,20,1],M:[100,64,36,2],Q:[100,48,52,2],H:[100,36,64,4]},
    5:  { L:[134,108,26,1],M:[134,86,48,2],Q:[134,62,72,2],H:[134,46,88,4]},
    6:  { L:[172,136,36,2],M:[172,108,64,4],Q:[172,76,96,4],H:[172,60,112,4]},
    7:  { L:[196,156,40,2],M:[196,124,72,4],Q:[196,88,108,2],H:[196,66,130,4]},
  };

  function encodeData(text, version, ecLevel) {
    var info = EC_CODEWORDS[version][ecLevel];
    var totalDC = info[1], ecPerBlock = info[2], numBlocks = info[3];
    var dcPerBlock = Math.floor(totalDC / numBlocks);

    // Build bit stream: mode indicator (0100) + char count + data + terminator
    var bytes = [];
    for (var i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0xFF);

    var bits = [];
    var push = function(val, len) {
      for (var i = len-1; i >= 0; i--) bits.push((val >> i) & 1);
    };
    push(4, 4);           // byte mode
    push(bytes.length, 8);// char count
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    push(0, 4);           // terminator

    // Pad to byte boundary
    while (bits.length % 8) bits.push(0);

    // Convert to codeword array
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | (bits[i+j] || 0);
      cw.push(b);
    }

    // Pad to capacity with alternating 0xEC / 0x11
    var pad = [0xEC, 0x11];
    while (cw.length < totalDC) cw.push(pad[(cw.length - bytes.length - 2) % 2]);

    // Split into blocks and generate EC codewords
    var dcBlocks = [], ecBlocks = [];
    for (var b = 0; b < numBlocks; b++) {
      var block = cw.slice(b * dcPerBlock, (b+1) * dcPerBlock);
      dcBlocks.push(block);
      ecBlocks.push(GF.remainder(block, GF.poly(ecPerBlock)));
    }

    // Interleave
    var result = [];
    var maxDC = Math.max.apply(null, dcBlocks.map(function(b){return b.length;}));
    for (var i = 0; i < maxDC; i++)
      for (var b = 0; b < dcBlocks.length; b++)
        if (i < dcBlocks[b].length) result.push(dcBlocks[b][i]);
    for (var i = 0; i < ecPerBlock; i++)
      for (var b = 0; b < ecBlocks.length; b++)
        result.push(ecBlocks[b][i]);

    return result;
  }

  /* ── QR matrix placement ── */
  function makeMatrix(version) {
    var size = 4 * version + 17;
    var m = [];
    for (var i = 0; i < size; i++) { m.push([]); for (var j = 0; j < size; j++) m[i].push(null); }
    return m;
  }

  function setFinder(m, row, col) {
    for (var r = -1; r <= 7; r++)
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
        m[rr][cc] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                    (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                    (r >= 2 && r <= 4 && c >= 2 && c <= 4) ? 1 : 0;
      }
  }

  function setTiming(m) {
    var size = m.length;
    for (var i = 8; i < size - 8; i++) {
      if (m[6][i] === null) m[6][i] = i % 2 === 0 ? 1 : 0;
      if (m[i][6] === null) m[i][6] = i % 2 === 0 ? 1 : 0;
    }
  }

  function setFormatInfo(m, mask, ecLevel) {
    var EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };
    var fmt = (EC_BITS[ecLevel] << 3) | mask;
    var d = fmt;
    for (var i = 0; i < 10; i++) d = (d << 1) ^ ((d >> 9) ? 0x537 : 0);
    var bits = (((fmt << 10) | d) ^ 0x5412);

    var coords = [
      [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],
      [8,5],[8,4],[8,3],[8,2],[8,1],[8,0]
    ];
    var size = m.length;
    for (var i = 0; i < 15; i++) {
      var bit = (bits >> (14 - i)) & 1;
      m[coords[i][0]][coords[i][1]] = bit;
      if (i < 7) m[size - 1 - i][8] = bit;
      else       m[8][size - 15 + i] = bit;
    }
    m[size - 8][8] = 1; // dark module
  }

  var MASK_FNS = [
    function(r,c){return (r+c)%2===0;},
    function(r,c){return r%2===0;},
    function(r,c){return c%3===0;},
    function(r,c){return (r+c)%3===0;},
    function(r,c){return (Math.floor(r/2)+Math.floor(c/3))%2===0;},
    function(r,c){return (r*c)%2+(r*c)%3===0;},
    function(r,c){return ((r*c)%2+(r*c)%3)%2===0;},
    function(r,c){return ((r+c)%2+(r*c)%3)%2===0;}
  ];

  function placeData(m, codewords) {
    var size = m.length, bit = 0, dir = -1;
    var row = size - 1, col = size - 1;
    while (col > 0) {
      if (col === 6) col--;
      for (var steps = 0; steps < size; steps++) {
        for (var dc = 0; dc < 2; dc++) {
          var c = col - dc, r = row;
          if (m[r][c] === null) {
            var cwIdx = Math.floor(bit / 8);
            var bitIdx = 7 - (bit % 8);
            m[r][c] = cwIdx < codewords.length ? (codewords[cwIdx] >> bitIdx) & 1 : 0;
            bit++;
          }
        }
        row += dir;
        if (row < 0 || row >= size) { dir = -dir; row += dir; col -= 2; break; }
      }
    }
  }

  function applyMask(m, maskIdx) {
    var fn = MASK_FNS[maskIdx], size = m.length;
    var copy = m.map(function(row) { return row.slice(); });
    for (var r = 0; r < size; r++)
      for (var c = 0; c < size; c++)
        if (copy[r][c] !== null && typeof copy[r][c] === 'number')
          if (fn(r, c)) copy[r][c] ^= 1;
    return copy;
  }

  function penalty(m) {
    var size = m.length, score = 0;
    // Rule 1: 5+ in a row
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size - 4; c++) {
        var run = 1;
        while (c + run < size && m[r][c+run] === m[r][c]) run++;
        if (run >= 5) score += 3 + (run - 5);
        c += run - 1;
      }
    }
    return score;
  }

  /* ── Main: generate SVG string ── */
  function generateSVG(text, options) {
    options = options || {};
    var ecLevel = options.ecLevel || 'M';
    var size    = options.size    || 160;
    var quiet   = options.quiet   || 4;

    // Pick smallest version that fits
    var version = 1;
    var maxBytes = { 1:17, 2:32, 3:53, 4:78, 5:106, 6:134, 7:154 };
    while (version <= 7 && text.length > maxBytes[version]) version++;
    if (version > 7) {
      // Text too long — truncate gracefully
      version = 7;
      text = text.slice(0, maxBytes[7]);
    }

    var codewords = encodeData(text, version, ecLevel);
    var matSize   = 4 * version + 17;

    // Build base matrix
    var m = makeMatrix(version);
    setFinder(m, 0, 0);
    setFinder(m, 0, matSize - 7);
    setFinder(m, matSize - 7, 0);
    setTiming(m);

    // Place data
    var dataCopy = m.map(function(r){return r.slice();});
    placeData(dataCopy, codewords);

    // Pick best mask (evaluate penalty on all 8)
    var bestMask = 0, bestPenalty = Infinity;
    for (var i = 0; i < 8; i++) {
      var masked = applyMask(dataCopy, i);
      setFormatInfo(masked, i, ecLevel);
      var p = penalty(masked);
      if (p < bestPenalty) { bestPenalty = p; bestMask = i; }
    }

    var final = applyMask(dataCopy, bestMask);
    setFormatInfo(final, bestMask, ecLevel);

    // Render to SVG
    var cellSize = size / (matSize + 2 * quiet);
    var offset   = quiet * cellSize;
    var rects    = [];

    for (var r = 0; r < matSize; r++)
      for (var c = 0; c < matSize; c++)
        if (final[r][c]) {
          var x = (offset + c * cellSize).toFixed(2);
          var y = (offset + r * cellSize).toFixed(2);
          var s = cellSize.toFixed(2);
          rects.push('<rect x="'+x+'" y="'+y+'" width="'+s+'" height="'+s+'"/>');
        }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" '
      + 'width="'+size+'" height="'+size+'" shape-rendering="crispEdges">'
      + '<rect width="'+size+'" height="'+size+'" fill="#fff"/>'
      + '<g fill="#000">' + rects.join('') + '</g>'
      + '</svg>';
  }

  root.CaflatQR = { generateSVG: generateSVG };

})(window);
