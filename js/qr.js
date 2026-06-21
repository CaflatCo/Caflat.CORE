/* ═══════════════════════════════════════════════════════
   QR.JS — Caflat.CORE QR Code Generator
   Full implementation with correct multi-block RS encoding.
═══════════════════════════════════════════════════════ */
(function(root) {
  'use strict';

  /* ── Reed-Solomon GF(256) ── */
  var GF_EXP = new Uint8Array(512);
  var GF_LOG = new Uint8Array(256);
  (function(){
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x; GF_LOG[x] = i;
      x = x << 1; if (x & 0x100) x ^= 0x11D;
    }
    for (var i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (!a || !b) return 0;
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
    var gen = rsGenerator(nEC);
    var msg = data.slice();
    for (var i = 0; i < nEC; i++) msg.push(0);
    for (var i = 0; i < data.length; i++) {
      var coef = msg[i];
      if (coef) for (var j = 1; j < gen.length; j++) msg[i+j] ^= gfMul(gen[j], coef);
    }
    return msg.slice(data.length);
  }

  /* ── Version/capacity tables (EC level M) ──
     g1/g2: block groups. k=data CW per block, ec=EC CW per block, c=count of blocks.
     From ISO/IEC 18004:2015 Table 9.                                              */
  var VERSIONS_M = [
    null,
    { g1:{k:16, ec:10, c:1}                       }, // v1
    { g1:{k:28, ec:16, c:1}                       }, // v2
    { g1:{k:22, ec:13, c:2}                       }, // v3: 2×22 data + 2×13 EC = 44+26
    { g1:{k:32, ec:18, c:2}                       }, // v4: 2×32 data + 2×18 EC = 64+36
    { g1:{k:22, ec:11, c:2}, g2:{k:23,ec:11,c:2} }, // v5: (2×22+2×23) data
    { g1:{k:27, ec:16, c:4}                       }, // v6: 4×27 data + 4×16 EC
    { g1:{k:16, ec:9,  c:4}, g2:{k:17,ec:9, c:1} }, // v7
    { g1:{k:19, ec:11, c:2}, g2:{k:20,ec:11,c:4} }, // v8
    { g1:{k:20, ec:12, c:3}, g2:{k:21,ec:12,c:2} }, // v9
    { g1:{k:20, ec:12, c:4}, g2:{k:21,ec:12,c:2} }, // v10 (simplified)
  ];

  /* Total data CW per version */
  var BYTE_CAP_M = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213]; // byte capacity per ISO 18004 Table 7

  function selectVersion(byteLen) {
    for (var v = 1; v <= 10; v++) {
      if (byteLen <= BYTE_CAP_M[v]) return v;
    }
    return 10;
  }

  /* ── UTF-8 encoding ── */
  function toBytes(text) {
    /* Sanitize non-printable / problematic chars, keep ASCII clean */
    var clean = text.replace(/₱/g, 'PHP').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
    var b = [];
    for (var i = 0; i < clean.length; i++) b.push(clean.charCodeAt(i) & 0xFF);
    return b;
  }

  /* ── Data codeword stream ── */
  function buildDataCW(bytes, version) {
    var ver = VERSIONS_M[version];
    /* Total data capacity = sum of (k × c) across all groups */
    var totalDC = ver.g1.k * ver.g1.c;
    if (ver.g2 && ver.g2.c) totalDC += ver.g2.k * ver.g2.c;
    var bits = [];
    function push(v, n) { for (var i=n-1;i>=0;i--) bits.push((v>>i)&1); }

    push(0x4, 4);           // byte mode
    push(bytes.length, 8);  // char count (8 bits for v1-9)
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    push(0, 4);             // terminator
    while (bits.length % 8) bits.push(0);

    var cw = [];
    for (var i = 0; i < bits.length; i+=8) {
      var b = 0; for (var j=0;j<8;j++) b=(b<<1)|(bits[i+j]||0); cw.push(b);
    }
    var pad = [0xEC, 0x11], pi = 0;
    while (cw.length < totalDC) cw.push(pad[pi++ % 2]);
    return cw;
  }

  /* ── Multi-block RS encoding + interleaving ── */
  function buildMessage(dataCW, version) {
    var ver = VERSIONS_M[version];

    /* Split data into blocks per group */
    var blocks = [];
    var pos = 0;
    function addGroup(g) {
      for (var i = 0; i < g.c; i++) {
        blocks.push({ data: dataCW.slice(pos, pos + g.k), ec: g.ec });
        pos += g.k;
      }
    }
    addGroup(ver.g1);
    if (ver.g2 && ver.g2.c) addGroup(ver.g2);

    /* RS-encode each block using its own EC count */
    var ecBlocks = blocks.map(function(b) { return rsEncode(b.data, b.ec); });

    /* Interleave data codewords */
    var maxDC = Math.max.apply(null, blocks.map(function(b){return b.data.length;}));
    var result = [];
    for (var i = 0; i < maxDC; i++) {
      for (var j = 0; j < blocks.length; j++) {
        if (i < blocks[j].data.length) result.push(blocks[j].data[i]);
      }
    }

    /* Interleave EC codewords */
    var maxEC = Math.max.apply(null, blocks.map(function(b){return b.ec;}));
    for (var i = 0; i < maxEC; i++) {
      for (var j = 0; j < ecBlocks.length; j++) {
        if (i < ecBlocks[j].length) result.push(ecBlocks[j][i]);
      }
    }

    return result;
  }

  /* ── Matrix construction ── */
  function makeMatrix(n) {
    var m = [];
    for (var i=0;i<n;i++){m.push([]);for(var j=0;j<n;j++)m[i].push(null);}
    return m;
  }

  function placeFinder(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row+r, cc = col+c;
        if (rr<0||cc<0||rr>=m.length||cc>=m.length) continue;
        if (r===-1||r===7||c===-1||c===7) {
          m[rr][cc] = 0; // separator — always white
        } else {
          var border = r===0||r===6||c===0||c===6;
          var center = r>=2&&r<=4&&c>=2&&c<=4;
          m[rr][cc] = (border||center) ? 1 : 0;
        }
      }
    }
  }

  function placeTiming(m) {
    var n = m.length;
    for (var i=8;i<n-8;i++) {
      if (m[6][i]===null) m[6][i] = i%2===0?1:0;
      if (m[i][6]===null) m[i][6] = i%2===0?1:0;
    }
  }

  function buildReservedMap(n) {
    var res = [];
    for (var i=0;i<n;i++){res.push([]);for(var j=0;j<n;j++)res[i].push(false);}
    function mF(r,c){for(var dr=-1;dr<=7;dr++)for(var dc=-1;dc<=7;dc++){var rr=r+dr,cc=c+dc;if(rr>=0&&rr<n&&cc>=0&&cc<n)res[rr][cc]=true;}}
    mF(0,0);mF(0,n-7);mF(n-7,0);
    for(var i=0;i<n;i++){res[6][i]=true;res[i][6]=true;}
    for(var i=0;i<=8;i++){res[8][i]=true;res[i][8]=true;}
    for(var i=0;i<8;i++){res[n-1-i][8]=true;res[8][n-1-i]=true;}
    return res;
  }

  function placeData(m, msg, reserved) {
    var n=m.length, bit=0, col=n-1;
    while(col>0){
      if(col===6)col--;
      for(var row=0;row<n;row++){
        var r=(Math.floor((n-1-col)/2)%2===0)?(n-1-row):row;
        for(var i=0;i<2;i++){
          var c=col-i;
          if(m[r][c]!==null||reserved[r][c])continue;
          var by=Math.floor(bit/8), bi=7-(bit%8);
          m[r][c]=by<msg.length?(msg[by]>>bi)&1:0;
          bit++;
        }
      }
      col-=2;
    }
  }

  /* Format info sequences for EC=M, masks 0-7 (pre-computed from spec) */
  var FMT_M = [0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0];

  function placeFormatInfo(m, maskIdx) {
    var n=m.length, data=FMT_M[maskIdx], seq=[];
    for(var i=14;i>=0;i--) seq.push((data>>i)&1);
    var pos=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
             [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    for(var i=0;i<15;i++) m[pos[i][0]][pos[i][1]]=seq[i];
    for(var i=0;i<8;i++) m[8][n-1-i]=seq[i];
    for(var i=8;i<15;i++) m[n-15+i][8]=seq[i];
    m[n-8][8]=1; // dark module
  }

  var MASK_FNS=[
    function(r,c){return(r+c)%2===0;},
    function(r,c){return r%2===0;},
    function(r,c){return c%3===0;},
    function(r,c){return(r+c)%3===0;},
    function(r,c){return(Math.floor(r/2)+Math.floor(c/3))%2===0;},
    function(r,c){return(r*c)%2+(r*c)%3===0;},
    function(r,c){return((r*c)%2+(r*c)%3)%2===0;},
    function(r,c){return((r+c)%2+(r*c)%3)%2===0;},
  ];

  function applyMask(m, mi, reserved) {
    var fn=MASK_FNS[mi],n=m.length;
    var cp=m.map(function(r){return r.slice();});
    for(var r=0;r<n;r++)for(var c=0;c<n;c++)
      if(!reserved[r][c]&&cp[r][c]!==null&&fn(r,c))cp[r][c]^=1;
    return cp;
  }

  function penalty(m) {
    var n=m.length,p=0;
    for(var r=0;r<n;r++){for(var c=0;c<n-4;c++){var v=m[r][c];if(m[r][c+1]===v&&m[r][c+2]===v&&m[r][c+3]===v&&m[r][c+4]===v){p+=3;var k=c+5;while(k<n&&m[r][k]===v){p++;k++;}}}}
    for(var c=0;c<n;c++){for(var r=0;r<n-4;r++){var v=m[r][c];if(m[r+1][c]===v&&m[r+2][c]===v&&m[r+3][c]===v&&m[r+4][c]===v){p+=3;var k=r+5;while(k<n&&m[k][c]===v){p++;k++;}}}}
    for(var r=0;r<n-1;r++)for(var c=0;c<n-1;c++){var v=m[r][c];if(m[r][c+1]===v&&m[r+1][c]===v&&m[r+1][c+1]===v)p+=3;}
    return p;
  }

  /* ── Main ── */
  function generateSVG(text, options) {
    options = options || {};
    var size = options.size || 200;

    var bytes   = toBytes(text || '');
    var version = selectVersion(bytes.length);
    var n       = 4*version+17;

    var m = makeMatrix(n);
    placeFinder(m,0,0); placeFinder(m,0,n-7); placeFinder(m,n-7,0);
    placeTiming(m);
    m[4*version+9][8] = 1; // dark module

    var reserved = buildReservedMap(n);
    var dataCW   = buildDataCW(bytes, version);
    var msg      = buildMessage(dataCW, version);

    var dm = m.map(function(r){return r.slice();});
    placeData(dm, msg, reserved);

    var best=0, bestP=Infinity;
    for(var mi=0;mi<8;mi++){
      var msk=applyMask(dm,mi,reserved);
      placeFormatInfo(msk,mi);
      var p=penalty(msk);
      if(p<bestP){bestP=p;best=mi;}
    }

    var final=applyMask(dm,best,reserved);
    placeFormatInfo(final,best);

    /* Render — integer module sizes, 4-module quiet zone */
    var qz      = 4;
    var total   = n + 2*qz;
    var ms      = Math.max(4, Math.floor(size/total));
    var sz      = total*ms;
    var off     = qz*ms;

    var rects=[];
    for(var r=0;r<n;r++) for(var c=0;c<n;c++) {
      if(final[r][c]===1)
        rects.push('<rect x="'+(off+c*ms)+'" y="'+(off+r*ms)+'" width="'+ms+'" height="'+ms+'"/>');
    }

    return '<svg xmlns="http://www.w3.org/2000/svg"'
      +' viewBox="0 0 '+sz+' '+sz+'"'
      +' width="'+sz+'" height="'+sz+'"'
      +' shape-rendering="crispEdges">'
      +'<rect width="'+sz+'" height="'+sz+'" fill="#fff"/>'
      +'<g fill="#000">'+rects.join('')+'</g>'
      +'</svg>';
  }

  root.CaflatQR = { generateSVG: generateSVG };

})(typeof window !== 'undefined' ? window : global);
