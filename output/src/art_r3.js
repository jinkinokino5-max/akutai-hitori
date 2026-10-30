// art_r3: R3 の絵（紙飛行機の大群 / 夜の高校の廊下 / 暗い住宅街）と結末の玄関。
// クラシック <script>。API は draft/api_art_r3.md。
// 絵はパレット番号配列（文字列行 → 番号の2次元配列）で持ち、AT.px.make があればそれで canvas 化、
// なければ自前の最小ヘルパーで canvas 化する。背景は整数座標の fillRect / ImageData で描くドット絵。
window.AT = window.AT || {};
(function (AT) {
  'use strict';
  var W = 320, H = 180;

  // ---------- 共通の小道具 ----------
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rng(seed) {
    if (AT.util && AT.util.rng) return AT.util.rng(seed);
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function newCanvas(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function crisp(ctx) { ctx.imageSmoothingEnabled = false; }

  // スプライト用パレット（0=透明）。文字→番号の対応は CH。
  var SPAL = [null,
    '#05060f', // 1 o 輪郭（藍黒）
    '#f4f6ff', // 2 w 紙の白
    '#c3cae6', // 3 s 紙の影
    '#7d86ad', // 4 d 紙の濃い影
    '#3a3f6a', // 5 k 鉛筆の走り書き
    '#ff2e88', // 6 m マゼンタ（悪態の差し色）
    '#3dff8a', // 7 g 非常灯緑
    '#e8f0ff', // 8 M 月白
    '#0a0b1e'  // 9 n 濃紺
  ];
  var CH = { '.': 0, 'o': 1, 'w': 2, 's': 3, 'd': 4, 'k': 5, 'm': 6, 'g': 7, 'M': 8, 'n': 9 };
  function toGrid(rows) {
    return rows.map(function (r) {
      var a = []; for (var i = 0; i < r.length; i++) a.push(CH[r[i]] || 0); return a;
    });
  }
  // 番号配列 → canvas。art_common の AT.px.make(rows, palette) を優先（寸法が合わなければ自前）。
  function make(grid, pal) {
    var h = grid.length, w = grid[0].length;
    if (AT.px && typeof AT.px.make === 'function') {
      try {
        var c0 = AT.px.make(grid, pal);
        if (c0 && c0.width === w && c0.height === h) return c0;
      } catch (e) { /* 自前にフォールバック */ }
    }
    var c = newCanvas(w, h), x = c.getContext('2d');
    for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) {
      var p = grid[y][i]; if (!p || !pal[p]) continue;
      x.fillStyle = pal[p]; x.fillRect(i, y, 1, 1);
    }
    return c;
  }
  function lazy(fn) { var v = null; return function () { return v || (v = fn()); }; }

  // ---------- スプライトデータ ----------
  // 紙飛行機（小）13×7、機首が左。2コマ（はためき）。
  var PLANE_S = [
    [
      '..........ooo',
      '........oowwo',
      '......oowwwwo',
      '....oowwwwwso',
      '..oowwwwwwsso',
      'oowwwwssssddo',
      '..oooooooooo.'
    ], [
      '.............',
      '.........oooo',
      '......oowwwwo',
      '...oowwwwwsso',
      'oowwwwwwssddo',
      '.ooosssdddoo.',
      '....ooooooo..'
    ]
  ];

  // 紙飛行機（拡大版）44×24。三角形から生成し、翼に読めない走り書き（誰も覚えていない一言）を入れる。
  function inTri(px, py, a, b, c) {
    function s(p1, p2, p3) { return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]); }
    var p = [px, py], d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
    var neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  }
  function genBigPlane(lift, seed) {
    var w = 44, h = 24, g = [], y, x;
    var N = [1, 17], A = [43, 2 - lift], B = [40, 17], C = [35, 23];
    for (y = 0; y < h; y++) { g.push([]); for (x = 0; x < w; x++) {
      var cx = x + 0.5, cy = y + 0.5, v = 0;
      if (inTri(cx, cy, N, A, B)) v = (cy > 14.5 && cx > 6) ? 3 : 2;  // 翼（折り目付近は影）
      else if (inTri(cx, cy, N, B, C)) v = 4;                           // 竜骨
      g[y].push(v);
    } }
    // 走り書き: 前縁 N→A に平行な線を数本、ところどころ途切れさせる
    var r = rng(seed);
    for (var k = 0; k < 4; k++) {
      var off = 3 + k * 2.6, x0 = 8 + Math.floor(r() * 4) + k * 2, x1 = 38 - Math.floor(r() * 5);
      for (x = x0; x < x1; x++) {
        if (r() < 0.18) { x += 1; continue; }
        var ty = Math.round(N[1] + (A[1] - N[1]) * (x - N[0]) / (A[0] - N[0]) + off + (r() < 0.25 ? 1 : 0));
        if (ty >= 0 && ty < h && g[ty][x] === 2) g[ty][x] = 5;
      }
    }
    // 1か所だけマゼンタの取り消し線（悪態の差し色）
    for (x = 22; x < 29; x++) {
      var my = Math.round(N[1] + (A[1] - N[1]) * (x - N[0]) / (A[0] - N[0]) + 5.6);
      if (my >= 0 && my < h && g[my][x] >= 2 && g[my][x] <= 5) g[my][x] = 6;
    }
    // 輪郭: 図形の4近傍に外側があれば輪郭色
    var out = g.map(function (row) { return row.slice(); });
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!g[y][x]) continue;
      if (y === 0 || x === 0 || y === h - 1 || x === w - 1 ||
          !g[y - 1][x] || !g[y + 1][x] || !g[y][x - 1] || !g[y][x + 1]) out[y][x] = 1;
    }
    // 折り目（翼と竜骨の境）を濃い影の線に
    for (x = 6; x < 39; x++) { if (out[17][x] && out[17][x] !== 1) out[17][x] = 4; }
    return out;
  }
  function gridToRows(g) {
    var inv = '.owsdkmgMn';
    return g.map(function (r) { return r.map(function (v) { return inv[v]; }).join(''); });
  }
  var PLANE_L = [gridToRows(genBigPlane(0, 31)), gridToRows(genBigPlane(2, 31))];

  // 非常口サイン 15×8（緑地に白い走る人と扉）
  var EXIT_SIGN = [
    'ooooooooooooooo',
    'oggggggggwwwwgo',
    'ogggwggggwggwgo',
    'oggwwwgggwggwgo',
    'ogwgwgwggwggwgo',
    'ogggwgggwwggwgo',
    'oggwgwggggggggo',
    'ooooooooooooooo'
  ];

  // 3×5 数字グリフ（教室札用）
  var GLYPH = {
    '0': ['www', 'w.w', 'w.w', 'w.w', 'www'], '1': ['.w.', 'ww.', '.w.', '.w.', 'www'],
    '2': ['ww.', '..w', '.w.', 'w..', 'www'], '3': ['ww.', '..w', '.w.', '..w', 'ww.'],
    '4': ['w.w', 'w.w', 'www', '..w', '..w'], '5': ['www', 'w..', 'ww.', '..w', 'ww.'],
    '6': ['.ww', 'w..', 'www', 'w.w', 'www'], '7': ['www', '..w', '.w.', '.w.', '.w.'],
    '8': ['www', 'w.w', 'www', 'w.w', 'www'], '9': ['www', 'w.w', 'www', '..w', 'ww.'],
    '-': ['...', '...', 'www', '...', '...']
  };
  // 教室札の行データ（白地・藍黒輪郭・走り書き色の文字）
  function plateRows(label) {
    var tw = label.length * 4 - 1, w = tw + 4, rows = [], y, x;
    for (y = 0; y < 9; y++) {
      var r = '';
      for (x = 0; x < w; x++) {
        if (y === 0 || y === 8 || x === 0 || x === w - 1) { r += 'o'; continue; }
        var gx = x - 2, gy = y - 2, ch = 'w';
        if (gy >= 0 && gy < 5 && gx >= 0 && gx < tw && gx % 4 !== 3) {
          var gl = GLYPH[label[Math.floor(gx / 4)]];
          if (gl && gl[gy][gx % 4] === 'w') ch = 'k';
        }
        r += ch;
      }
      rows.push(r);
    }
    return rows;
  }
  // 札の番号: 1-1, 1-2 … 1-7, 2-1 … と学年が際限なく増える（永遠の廊下）
  function plateLabel(k) {
    if (k < 0) k = -k;
    return (1 + Math.floor(k / 7)) + '-' + (k % 7 + 1);
  }

  // canvas 化（遅延。node でも読み込めるよう document は描画時まで触らない）
  var SPR = {
    planeS: lazy(function () { return PLANE_S.map(function (r) { return make(toGrid(r), SPAL); }); }),
    planeL: lazy(function () { return PLANE_L.map(function (r) { return make(toGrid(r), SPAL); }); }),
    exit: lazy(function () { return make(toGrid(EXIT_SIGN), SPAL); })
  };
  var plateCache = {}, plateCount = 0;
  function plateSprite(label) {
    if (plateCache[label]) return plateCache[label];
    if (plateCount > 200) { plateCache = {}; plateCount = 0; }
    plateCount++;
    return (plateCache[label] = make(toGrid(plateRows(label)), SPAL));
  }

  // =====================================================================
  // 襲来物: 紙飛行機の大群
  // =====================================================================
  var SWARM_N = 42;
  var swarm = (function () {
    var r = rng(3301), a = [];
    for (var i = 0; i < SWARM_N; i++) {
      // 雲状の分布（2つの乱数の平均でやや中央寄せ）
      a.push({
        ox: (r() + r() - 1), oy: (r() + r() - 1),
        d: r(), lag: r(), ph: r() * 6.283
      });
    }
    return a;
  })();

  // 紙飛行機1機。opts: {big:bool, scale:int, frame:int}
  function drawPlane(ctx, x, y, opts) {
    opts = opts || {};
    crisp(ctx);
    var set = opts.big ? SPR.planeL() : SPR.planeS();
    var img = set[(opts.frame | 0) & 1], s = Math.max(1, opts.scale | 0);
    var w = img.width * s, h = img.height * s;
    ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  }

  // 大群。p=0（画面右上の外）→1（目標点に殺到）。opts: {tx, ty}
  function drawSwarm(ctx, t, p, opts) {
    opts = opts || {};
    var tx = opts.tx != null ? opts.tx : 90, ty = opts.ty != null ? opts.ty : 128;
    var sx = 352, sy = -24;
    p = clamp(p, 0, 1);
    var list = [];
    for (var i = 0; i < SWARM_N; i++) {
      var q = swarm[i];
      var pi = clamp(p * 1.35 - q.lag * 0.35, 0, 1);   // 先頭の機から順に到達
      var e = Math.pow(pi, 1.6);
      var cx = sx + (tx - sx) * e, cy = sy + (ty - sy) * e;
      var spread = 22 + 95 * pi * (0.45 + q.d);
      var x = cx + q.ox * spread * 1.4 + Math.sin(t * 4.7 + q.ph) * 2;
      var y = cy + q.oy * spread * 0.8 + Math.sin(t * 6.1 + q.ph * 1.3) * 1.5;
      var size = 1 + pi * (1 + 3 * q.d);                // 近い機ほど大きく
      list.push({ x: x, y: y, size: size, fr: Math.floor(t * 8 + q.ph) & 1 });
    }
    list.sort(function (a, b) { return a.size - b.size; });
    for (var j = 0; j < list.length; j++) {
      var o = list[j], si = Math.max(1, Math.round(o.size));
      if (si <= 2) drawPlane(ctx, o.x, o.y, { big: false, scale: si, frame: o.fr });
      else drawPlane(ctx, o.x, o.y, { big: true, scale: si >= 5 ? 2 : 1, frame: o.fr });
    }
  }

  // =====================================================================
  // 異世界: 永遠に続く夜の高校の廊下（一点透視の擬似3D、ImageData で1画素ずつ）
  // 左壁=窓（月が見える）、右壁=教室の扉・掲示板・突き出した教室札、天井から非常口サイン。
  // =====================================================================
  var C = {
    fog: hex('#0a0b1e'),
    floor: hex('#1c2148'), floorLine: hex('#0e1130'), moonPatch: hex('#56659f'), greenFloor: hex('#1f4a44'),
    ceil: hex('#0d1029'), ceilLamp: hex('#262c58'),
    wallL: hex('#241b40'), wainL: hex('#1b1535'), base: hex('#0b0a1c'),
    glass: hex('#162050'), frame: hex('#05060f'), moon: hex('#e8f0ff'), star: hex('#9fb0e8'),
    wallR: hex('#211c3e'), door: hex('#2e2238'), doorFrame: hex('#120e1e'), doorGlass: hex('#0f1430'),
    board: hex('#3a2e2a'), paper: hex('#c3cae6'), classWin: hex('#121838')
  };
  var G = { halfW: 1.2, eyeH: 0.85, ceilH: 1.7, P: 4, vx: 160, vy: 80 };
  var MOON = { x: 44, y: 36, r: 9 };
  var STARS = [[18, 20], [70, 14], [96, 40], [30, 58], [8, 44], [84, 62], [120, 22], [58, 28]];
  var world = { pos: 0, lastT: null, img: null, imgCtx: null };

  function frac(v) { return v - Math.floor(v); }
  function mod(v, m) { return ((v % m) + m) % m; }
  // 1画素以上の太さを保つ境界判定（遠くでも線が消えすぎない・近くで太りすぎない）
  function near(v, edge, thr) { return Math.abs(v - edge) < thr; }

  function corridorPixels(data, pos, f, vy) {
    var halfW = G.halfW, eyeH = G.eyeH, ceilH = G.ceilH, P = G.P, vx = G.vx;
    var i = 0, c, x, y;
    for (y = 0; y < H; y++) {
      var dy = y + 0.5 - vy;
      var zf = dy > 0 ? f * eyeH / dy : 1e9, zc = dy < 0 ? f * ceilH / -dy : 1e9;
      for (x = 0; x < W; x++, i += 4) {
        var dx = x + 0.5 - vx, adx = dx < 0 ? -dx : dx;
        var zw = adx > 0.01 ? f * halfW / adx : 1e9;
        var z, surf;
        if (zw < zf && zw < zc) { z = zw; surf = dx < 0 ? 2 : 3; }
        else if (zf < zc) { z = zf; surf = 0; } else { z = zc; surf = 1; }
        var u = z + pos, px1 = z / f;           // px1 = 1画素の世界幅
        var thr = Math.max(0.035, px1 * 0.75);
        if (surf === 0) {                       // 床
          var lat = dx * z / f;
          c = C.floor;
          var um = mod(u, P);
          // 窓から斜めに差す月明かり（左寄り）
          var mu = mod(u + (lat + halfW) * 0.55, P);
          if (lat < 0.25 && mu > 0.5 && mu < 2.4 && !near(mu, 1.45, thr)) c = C.moonPatch;
          // 非常口サインの真下に緑の照り返し
          var gu = mod(u - 2, P * 3);
          if ((gu < 0.7 || gu > P * 3 - 0.7) && lat > -0.45 && lat < 0.45) c = C.greenFloor;
          if (near(frac(u * 2), 0, thr * 2) || near(frac(u * 2), 1, thr * 2)) c = C.floorLine;
          if (near(lat, -0.6, thr) || near(lat, 0.6, thr)) c = C.floorLine;
        } else if (surf === 1) {                // 天井（消えた蛍光灯）
          var latc = dx * z / f;
          c = C.ceil;
          var cu = mod(u, P);
          if (cu > 1.6 && cu < 2.4 && latc > -0.12 && latc < 0.12) c = C.ceilLamp;
        } else {
          var hgt = -dy * z / f;                // 目の高さからの高さ（上が正）
          var wu = mod(u, P);
          if (surf === 2) {                     // 左壁: 窓
            c = hgt < -eyeH + 0.1 ? C.base : hgt < -0.15 ? C.wainL : C.wallL;
            if (wu > 0.35 && wu < 3.65 && hgt > -0.15 && hgt < 1.25) {
              c = C.glass;
              // 月と星は無限遠なので画面に固定（窓が月の前を流れていく）
              var mdx = x - MOON.x, mdy = y - MOON.y;
              if (mdx * mdx + mdy * mdy <= MOON.r * MOON.r) c = C.moon;
              else for (var s = 0; s < STARS.length; s++) if (STARS[s][0] === x && STARS[s][1] === y) { c = C.star; break; }
              if (near(wu, 2.0, thr) || near(hgt, 0.55, thr * 0.8)) c = C.frame;
            }
            if (near(wu, 0.35, thr) || near(wu, 3.65, thr)) { if (hgt > -0.15 && hgt < 1.25) c = C.frame; }
            if ((near(hgt, -0.15, thr * 0.8) || near(hgt, 1.25, thr * 0.8)) && wu > 0.35 && wu < 3.65) c = C.frame;
          } else {                              // 右壁: 扉×2・掲示板・欄間窓
            c = hgt < -eyeH + 0.1 ? C.base : C.wallR;
            var inD1 = wu > 0.3 && wu < 1.1, inD2 = wu > 2.9 && wu < 3.7;
            if ((inD1 || inD2) && hgt < 1.0) {
              c = C.door;
              var dl = inD1 ? wu - 0.3 : wu - 2.9;
              if (dl > 0.2 && dl < 0.6 && hgt > 0.15 && hgt < 0.7) c = C.doorGlass;
              if (near(dl, 0, thr) || near(dl, 0.8, thr) || near(hgt, 1.0, thr * 0.8)) c = C.doorFrame;
            } else if (wu > 1.45 && wu < 2.55 && hgt > -0.15 && hgt < 0.75) {
              c = C.board;
              // 掲示板の紙（紙飛行機の元）
              var bu = (wu - 1.45) * 6, bh = (hgt + 0.15) * 6;
              if (frac(bu) > 0.25 && frac(bu) < 0.8 && frac(bh) > 0.2 && frac(bh) < 0.85 &&
                  ((Math.floor(bu) + Math.floor(bh) * 3) % 4) !== 1) c = C.paper;
            } else if (hgt > 1.12 && hgt < 1.5 && wu > 1.2 && wu < 2.8) {
              c = near(wu, 2.0, thr) ? C.frame : C.classWin;
            }
          }
        }
        // 奥ほど濃紺に沈む（ベイヤーで4段階ディザ）
        var b = clamp(1.12 - z / 15, 0, 1);
        var lvl = Math.floor(b * 4 + bayer(x, y)); if (lvl > 4) lvl = 4;
        var m = lvl / 4, fg = C.fog;
        data[i] = fg[0] + (c[0] - fg[0]) * m;
        data[i + 1] = fg[1] + (c[1] - fg[1]) * m;
        data[i + 2] = fg[2] + (c[2] - fg[2]) * m;
        data[i + 3] = 255;
      }
    }
  }

  // 正面を向いた板（教室札・非常口）を奥行き z に投影して描く
  function drawFacing(ctx, img, z, latA, latB, hA, hB, f, vy) {
    var x1 = Math.round(G.vx + f * latA / z), x2 = Math.round(G.vx + f * latB / z);
    var y1 = Math.round(vy - f * hB / z), y2 = Math.round(vy - f * hA / z);
    if (x2 - x1 < 1 || y2 - y1 < 1 || x2 < 0 || x1 > W || y2 < 0 || y1 > H) return;
    var b = clamp(1.12 - z / 15, 0, 1); if (b <= 0.1) return;
    ctx.globalAlpha = Math.ceil(b * 4) / 4;
    ctx.drawImage(img, x1, y1, x2 - x1, y2 - y1);
    ctx.globalAlpha = 1;
  }

  // speed: 0〜100。opts: {dist}（指定時は内部の進行距離を上書き）
  function drawWorld(ctx, t, speed, opts) {
    opts = opts || {};
    speed = clamp(speed || 0, 0, 100);
    if (world.lastT == null) world.lastT = t;
    var dt = clamp(t - world.lastT, 0, 0.1); world.lastT = t;
    world.pos += dt * (1.6 + speed * 0.12);            // 速度で前進が速くなる（=拡大率が上がる）
    if (opts.dist != null) world.pos = opts.dist;
    var pos = world.pos;
    var f = 112 - speed * 0.3;                          // 速いほど広角（周辺が強く流れる）
    var vy = G.vy + Math.round(Math.sin(t * (7 + speed * 0.1)) * (0.4 + speed / 60));

    crisp(ctx);
    if (!world.img) world.img = ctx.createImageData(W, H);
    corridorPixels(world.img.data, pos, f, vy);
    ctx.putImageData(world.img, 0, 0);

    // 札・非常口を奥から手前へ
    var items = [], P = G.P, k, z;
    for (k = Math.floor(pos / P); k < Math.floor(pos / P) + 12; k++) {
      z = k * P + 0.7 - pos;
      if (z > 0.7) items.push({ z: z, kind: 0, k: k });
    }
    for (k = Math.floor((pos - 2) / (P * 3)); k < Math.floor((pos - 2) / (P * 3)) + 4; k++) {
      z = k * P * 3 + 2 - pos;
      if (z > 0.7) items.push({ z: z, kind: 1 });
    }
    items.sort(function (a, b) { return b.z - a.z; });
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (it.kind === 0) drawFacing(ctx, plateSprite(plateLabel(it.k)), it.z, G.halfW - 0.5, G.halfW, 1.1, 1.36, f, vy);
      else drawFacing(ctx, SPR.exit(), it.z, -0.32, 0.32, G.ceilH - 0.36, G.ceilH - 0.03, f, vy);
    }

    // 疾走線（速度50%以上）: 中心から外へ流れる月白の点線
    if (speed >= 50) {
      var n = Math.floor((speed - 40) / 3), r = rng(Math.floor(t * 24) * 7919 + 13);
      ctx.fillStyle = '#e8f0ff'; ctx.globalAlpha = 0.55;
      for (var q = 0; q < n; q++) {
        var ang = r() * 6.283, r0 = 50 + r() * 90, len = 8 + r() * (speed - 30) * 0.5;
        var ca = Math.cos(ang), sa = Math.sin(ang) * 0.62;
        for (var d = 0; d < len; d += 2) {
          ctx.fillRect(Math.round(G.vx + ca * (r0 + d)), Math.round(vy + sa * (r0 + d)), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // =====================================================================
  // 疾走用の横スクロール廊下（側面図）。背景は画面の左へ流れる（自転車は右向きに走る）。
  // 構図: 奥の壁（教室側）は床 y=132 で終わり、乗り手と障害物は手前の床の上 (地面 y=160) を走る。
  //  - 壁と天井は奥にあるので 0.75 倍の速さで流れる（視差）。床の目地は奥 0.75 倍〜手前 1.15 倍で、
  //    地面 y=160 の行がちょうど 1 倍（障害物と同じ速さ）になるように斜めに描く。
  //  - 障害物（灰・銀色）が埋もれないよう、背景は暗く低コントラストに抑える。扉は乗り手の約 2.3 倍の高さ。
  // =====================================================================
  var SIDE_GROUND = 160, SIDE_FLOOR = 132, SIDE_PERIOD = 320, SIDE_PAR = 0.75;
  var SIDE_WALL = lazy(function () {
    var c = newCanvas(SIDE_PERIOD, SIDE_FLOOR), x = c.getContext('2d'), i, k;
    x.fillStyle = '#06071a'; x.fillRect(0, 0, SIDE_PERIOD, 30);                     // 天井
    x.fillStyle = '#0c0f2c'; x.fillRect(0, 30, SIDE_PERIOD, 2);                     // 廻り縁
    x.fillStyle = '#111536'; x.fillRect(0, 32, SIDE_PERIOD, SIDE_FLOOR - 32);        // 壁
    x.fillStyle = '#0d1030'; x.fillRect(0, 60, SIDE_PERIOD, 1);                     // 欄間の下の見切り
    // 欄間（扉・窓の上に続く細長いガラス）x=10..196
    x.fillStyle = '#070818'; x.fillRect(10, 38, 186, 20);
    x.fillStyle = '#0d1534'; x.fillRect(11, 39, 184, 18);
    x.fillStyle = '#070818'; for (i = 11; i < 196; i += 23) x.fillRect(i, 39, 1, 18);
    x.fillStyle = '#18224a'; x.fillRect(11, 39, 184, 1);
    // 教室の引き戸（窓つき）x=16, 158  幅34 高さ50
    [16, 158].forEach(function (dx) {
      x.fillStyle = '#070818'; x.fillRect(dx - 1, 81, 36, SIDE_FLOOR - 81);
      x.fillStyle = '#1b2046'; x.fillRect(dx, 82, 34, SIDE_FLOOR - 82);
      x.fillStyle = '#141838'; x.fillRect(dx + 17, 82, 1, SIDE_FLOOR - 82);          // 戸の合わせ目
      x.fillStyle = '#0c1330'; x.fillRect(dx + 4, 88, 10, 16); x.fillRect(dx + 21, 88, 10, 16);
      x.fillStyle = '#2c3a66'; x.fillRect(dx + 4, 88, 10, 1); x.fillRect(dx + 21, 88, 10, 1);
      x.fillStyle = '#4a4434'; x.fillRect(dx + 14, 108, 1, 4);                       // 取っ手
      x.fillStyle = '#5c5a4a'; x.fillRect(dx + 9, 66, 16, 5);                        // 組札
      x.fillStyle = '#34342c'; x.fillRect(dx + 11, 68, 12, 1);
    });
    // 教室の腰窓（廊下側）x=62..146
    x.fillStyle = '#070818'; x.fillRect(61, 71, 86, 34);
    x.fillStyle = '#0b1230'; x.fillRect(62, 72, 84, 32);
    x.fillStyle = '#070818'; x.fillRect(103, 72, 2, 32); x.fillRect(62, 87, 84, 1);
    x.fillStyle = '#080c22';                                                         // ガラス越しの机と椅子の影
    for (i = 0; i < 5; i++) { x.fillRect(66 + i * 16, 96, 10, 2); x.fillRect(68 + i * 16, 98, 1, 6); x.fillRect(74 + i * 16, 98, 1, 6); }
    x.fillStyle = '#1e2a58'; x.fillRect(62, 72, 84, 1); x.fillRect(64, 74, 1, 10); x.fillRect(107, 74, 1, 10);   // 月明かりの反射（ごく弱く）
    x.fillStyle = '#161b40'; x.fillRect(60, 105, 88, 2);                            // 窓台
    // 掃除当番表と掲示板 x=214..272
    x.fillStyle = '#2a2420'; x.fillRect(214, 70, 34, 24);
    x.fillStyle = '#5e5a48'; x.fillRect(216, 72, 12, 9); x.fillRect(230, 73, 15, 7); x.fillRect(218, 83, 20, 8);
    x.fillStyle = '#3e3c32'; x.fillRect(218, 75, 8, 1); x.fillRect(232, 75, 10, 1); x.fillRect(220, 86, 14, 1);
    x.fillStyle = '#4a4636'; x.fillRect(256, 76, 14, 18);
    x.fillStyle = '#2e2c24'; for (k = 0; k < 4; k++) x.fillRect(258, 79 + k * 4, 10, 1);
    // 消火栓の箱（赤は暗く。障害物と見間違えないよう壁の高い位置）x=284
    x.fillStyle = '#3a1418'; x.fillRect(284, 84, 18, 24);
    x.fillStyle = '#5a1e22'; x.fillRect(284, 84, 18, 1);
    x.fillStyle = '#7a3a2a'; x.fillRect(291, 88, 4, 4);
    // 非常口の緑の灯 x=230
    x.fillStyle = '#0a2a1e'; x.fillRect(228, 42, 18, 8);
    x.fillStyle = '#3ec88a'; x.fillRect(230, 44, 14, 4);
    x.fillStyle = '#0a2a1e'; x.fillRect(232, 45, 3, 2);
    // 幅木
    x.fillStyle = '#0a0b20'; x.fillRect(0, SIDE_FLOOR - 6, SIDE_PERIOD, 6);
    x.fillStyle = '#1c2150'; x.fillRect(0, SIDE_FLOOR - 6, SIDE_PERIOD, 1);
    return c;
  });
  // 床の各行の流れる倍率（奥 y=132 で 0.75、地面 y=160 で 1、手前 y=180 で約 1.18）
  function sideFloorK(y) { return SIDE_PAR + (1 - SIDE_PAR) * (y - SIDE_FLOOR) / (SIDE_GROUND - SIDE_FLOOR); }
  function drawSideWorld(ctx, dist, t, speed) {
    crisp(ctx);
    var wd = dist * SIDE_PAR, off = Math.round(mod(wd, SIDE_PERIOD)), x, y, i;
    for (x = -off; x < W; x += SIDE_PERIOD) ctx.drawImage(SIDE_WALL(), x, 0);     // 背景は左へ流れる
    // 蛍光灯（天井、80px おき。ときどきまたたく）
    var lo = Math.round(mod(wd, 80)), lit = [];
    for (x = -lo - 80; x < W + 80; x += 80) {
      var id = Math.round((x + wd) / 80), ph = mod(t * 3 + id * 1.7, 9);
      var on = !(ph > 8.2 && ph < 8.5);
      ctx.fillStyle = '#05060f'; ctx.fillRect(x + 18, 24, 44, 4);
      ctx.fillStyle = on ? '#cfd8f4' : '#3a4060'; ctx.fillRect(x + 20, 25, 40, 2);
      if (on) {   // 下へ広がりながら薄れる光
        for (y = 0; y < 14; y++) { ctx.fillStyle = 'rgba(170,190,255,' + (0.09 * (1 - y / 14)).toFixed(3) + ')'; ctx.fillRect(x + 18 - y, 28 + y, 44 + y * 2, 1); }
        lit.push(x);
      }
    }
    // 床（リノリウム）。奥ほど暗い
    ctx.fillStyle = '#0a0c21'; ctx.fillRect(0, SIDE_FLOOR, W, H - SIDE_FLOOR);
    ctx.fillStyle = '#0d1027'; ctx.fillRect(0, SIDE_FLOOR + 8, W, H - SIDE_FLOOR - 8);
    ctx.fillStyle = '#10132d'; ctx.fillRect(0, SIDE_FLOOR + 20, W, H - SIDE_FLOOR - 20);
    // 床に映る蛍光灯（奥の床にぼんやり。速いほど横に伸びる）
    var str = speed > 40 ? Math.min(28, Math.round((speed - 40) * 0.6)) : 0;
    ctx.fillStyle = 'rgba(190,205,255,0.10)';
    for (i = 0; i < lit.length; i++) ctx.fillRect(lit[i] + 20 - str, SIDE_FLOOR + 3, 40 + str, 2);
    // 向かい側の窓から差す月明かり（手前の床。平行四辺形を行ごとに描く）
    ctx.fillStyle = 'rgba(120,150,230,0.07)';
    for (y = 164; y < H; y++) {
      var kk = sideFloorK(y), mo = mod(kk * dist - 160 * (1 - kk), 160 * kk);
      for (x = -mo - 160 * kk; x < W + 160; x += 160 * kk) ctx.fillRect(Math.round(x + 40 * kk), y, Math.round(64 * kk), 1);
    }
    // タイルの目地（奥は遅く、手前は速く。地面の行は障害物と同じ速さ）
    ctx.fillStyle = '#1a1f44';
    for (y = SIDE_FLOOR; y < H; y++) {
      var k2 = sideFloorK(y), step = 40 * k2, so = mod(k2 * dist - 160 * (1 - k2), step);   // 消失点は画面中央 x=160
      for (x = -so; x < W; x += step) ctx.fillRect(Math.round(x), y, 1, 1);
    }
    ctx.fillStyle = '#151a3a'; ctx.fillRect(0, 140, W, 1); ctx.fillRect(0, 151, W, 1); ctx.fillRect(0, 170, W, 1);
    // 走る線（地面 y=160）をごく薄く
    ctx.fillStyle = '#181d40'; ctx.fillRect(0, SIDE_GROUND, W, 1);
    // 速いほど手前の床に光の筋
    if (speed > 40) {
      ctx.fillStyle = 'rgba(232,240,255,0.14)';
      var ln = Math.min(36, Math.round((speed - 40) * 0.9)), to = mod(dist * 1.1, 40);
      for (x = -to; x < W; x += 40) ctx.fillRect(Math.round(x + 6), 174, ln, 1);
    }
  }

  // =====================================================================
  // 帰り道（R3）: 街灯の少ない暗い住宅街。3層パララックス＋道路。地面 y=150。
  // =====================================================================
  var GROUND_Y = 150;
  var WALK = {
    sky: lazy(function () {
      var c = newCanvas(W, H), x = c.getContext('2d'), y, i;
      var top = hex('#05060f'), bot = hex('#141a3c');
      for (y = 0; y < 150; y++) for (i = 0; i < W; i++) {
        var tt = y / 150, lv = Math.floor(tt * 4 + bayer(i, y)) / 4;
        var col = [top[0] + (bot[0] - top[0]) * lv, top[1] + (bot[1] - top[1]) * lv, top[2] + (bot[2] - top[2]) * lv];
        x.fillStyle = 'rgb(' + col.map(Math.round).join(',') + ')';
        x.fillRect(i, y, 1, 1);
      }
      // 星（まばら）と細い月
      var r = rng(77);
      x.fillStyle = '#7f8fc8';
      for (i = 0; i < 26; i++) x.fillRect(Math.floor(r() * W), Math.floor(r() * 80), 1, 1);
      x.fillStyle = '#e8f0ff';
      for (y = -6; y <= 6; y++) for (i = -6; i <= 6; i++) {
        var inA = i * i + y * y <= 36, inB = (i - 3) * (i - 3) + (y + 1) * (y + 1) <= 30;
        if (inA && !inB) x.fillRect(262 + i, 26 + y, 1, 1);
      }
      return c;
    }),
    // 遠景: 家並みのシルエット（灯りのついた窓はわずか）
    far: lazy(function () {
      var w = 512, c = newCanvas(w, H), x = c.getContext('2d'), r = rng(901), px = 0;
      while (px < w) {
        var hw = 34 + Math.floor(r() * 30), top = 96 + Math.floor(r() * 26), base = 142;
        x.fillStyle = '#121633';
        x.fillRect(px, top, hw, base - top);
        // 切妻屋根（階段状）
        var peak = 8 + Math.floor(r() * 8);
        for (var s = 0; s < peak; s++) x.fillRect(px + s * hw / (2 * peak) | 0, top - s, Math.max(1, hw - (s * hw / peak | 0)), 1);
        var lr = r();
        if (lr < 0.22) { x.fillStyle = '#8a6a3a'; x.fillRect(px + 8 + Math.floor(r() * (hw - 20)), top + 10, 4, 4); }
        else if (lr < 0.3) { x.fillStyle = '#34478a'; x.fillRect(px + 8 + Math.floor(r() * (hw - 20)), top + 12, 5, 3); }
        px += hw + 2 + Math.floor(r() * 10);
      }
      return c;
    }),
    // 近景: ブロック塀・電柱・電線・街灯1本（640pxに1本だけ）
    near: lazy(function () {
      var w = 640, c = newCanvas(w, H), x = c.getContext('2d'), r = rng(4242), i, y;
      // ブロック塀（門の切れ目あり）
      for (i = 0; i < w; i += 2) {
        var gate = (i % 200) > 168;
        if (gate) continue;
        x.fillStyle = '#1b1f3e'; x.fillRect(i, 118, 2, GROUND_Y - 118);
      }
      x.fillStyle = '#12152e';
      for (y = 118; y < GROUND_Y; y += 8) for (i = 0; i < w; i++) {
        if ((i % 200) > 168) continue;
        x.fillRect(i, y, 1, 1);
        if (((i + (y / 8 % 2) * 8) % 16) === 0) x.fillRect(i, y, 1, 8);
      }
      x.fillStyle = '#262b52';
      for (i = 0; i < w; i++) if ((i % 200) <= 168) x.fillRect(i, 117, 1, 1);  // 笠木
      // 塀の向こうの植木
      x.fillStyle = '#0f1a2a';
      for (i = 0; i < w; i += 1) {
        if ((i % 200) > 168) continue;
        var hh = 6 + Math.round(4 * Math.sin(i * 0.11) + 3 * Math.sin(i * 0.37 + 1));
        if (((i / 70) | 0) % 3 !== 1) x.fillRect(i, 117 - hh, 1, hh);
      }
      // 電柱と電線
      var poles = [40, 200, 360, 520];
      x.fillStyle = '#0c0e22';
      poles.forEach(function (p) { x.fillRect(p, 22, 5, GROUND_Y - 22); x.fillRect(p - 7, 30, 19, 2); });
      x.fillStyle = '#05060f';
      for (var pi = 0; pi < poles.length; pi++) {
        var a = poles[pi] + 2, b = (pi + 1 < poles.length ? poles[pi + 1] : poles[0] + w) + 2;
        for (i = a; i < b; i++) {
          var tt = (i - a) / (b - a), sag = Math.round(10 * 4 * tt * (1 - tt));
          x.fillRect(i % w, 31 + sag, 1, 1); x.fillRect(i % w, 34 + sag + 1, 1, 1);
        }
      }
      // 街灯の腕と灯具（電柱 200 に1本だけ）
      x.fillStyle = '#0c0e22'; x.fillRect(205, 46, 12, 2);
      x.fillStyle = '#3a4060'; x.fillRect(214, 48, 6, 2);
      return c;
    }),
    // 街灯の光（蛍光灯の青白、ちらつき用に別キャンバス）
    glow: lazy(function () {
      var w = 640, c = newCanvas(w, H), x = c.getContext('2d'), y, i;
      x.fillStyle = '#e8f0ff'; x.fillRect(214, 50, 6, 1);
      for (y = 51; y < 172; y++) {
        var half = 3 + (y - 51) * 0.42;
        for (i = Math.floor(217 - half); i <= 217 + half; i++) {
          var edge = 1 - Math.abs(i - 217) / half, dist = 1 - (y - 51) / 140;
          var inten = edge * 0.55 + dist * 0.25;
          if (y < GROUND_Y && (y < 118 || ((i % 200) > 168))) inten *= 0.35; // 空中は薄く
          if (inten > bayer(i, y) * 1.1) {
            x.fillStyle = inten > 0.62 ? '#5a6890' : '#2e3866';
            x.fillRect(i, y, 1, 1);
          }
        }
      }
      return c;
    })
  };
  function strip(ctx, img, off) {
    var w = img.width, x0 = -Math.round(mod(off, w));
    for (var x = x0; x < W; x += w) ctx.drawImage(img, x, 0);
  }
  // scroll: カメラの進んだ距離(px)。t: 秒（街灯のちらつき用）
  function drawWalk(ctx, scroll, t) {
    crisp(ctx);
    ctx.drawImage(WALK.sky(), 0, 0);
    strip(ctx, WALK.far(), scroll * 0.15);
    // 道路
    ctx.fillStyle = '#0f1124'; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#262b52'; ctx.fillRect(0, GROUND_Y, W, 2);
    ctx.fillStyle = '#3a4068';
    var o = Math.round(mod(scroll, 24));
    for (var x = -o; x < W; x += 24) ctx.fillRect(x, 172, 12, 1);   // 路側の破線
    strip(ctx, WALK.near(), scroll);
    // 古い蛍光灯がときどきまたたく
    var tt = t || 0, ph = mod(tt, 4.3);
    var on = !(ph > 3.1 && ph < 3.18) && !(ph > 3.26 && ph < 3.3);
    if (on) strip(ctx, WALK.glow(), scroll);
  }

  // =====================================================================
  // 結末: 家の玄関（rank 'S'|'A'|'B'|'C'）
  // S=窓に明かり＋玄関灯 / A=玄関灯 / B=玄関灯がちらつく / C=真っ暗。
  // 左側 x<130 は主人公と自転車を置く余白。地面 y=156。
  // =====================================================================
  var doorCache = {};
  function ditherGlow(x, cx, cy, rad, inner, outer, sx, minY) {
    sx = sx || 1;
    for (var y = Math.max(minY || 0, Math.floor(cy - rad)); y <= cy + rad; y++) for (var i = Math.floor(cx - rad * sx); i <= cx + rad * sx; i++) {
      var dx = (i - cx) / sx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) / rad;
      if (d >= 1) continue;
      var it = 1 - d;
      if (it * 1.4 > bayer(i, y) + 0.15) { x.fillStyle = it > 0.55 ? inner : outer; x.fillRect(i, y, 1, 1); }
    }
  }
  function buildDoor(rank, porchOn) {
    var c = newCanvas(W, H), x = c.getContext('2d'), i, y;
    var winLit = rank === 'S';
    // 空と星・月
    x.fillStyle = '#0a0b1e'; x.fillRect(0, 0, W, H);
    var r = rng(2026); x.fillStyle = '#7f8fc8';
    for (i = 0; i < 30; i++) x.fillRect(Math.floor(r() * W), Math.floor(r() * 40), 1, 1);
    x.fillStyle = '#e8f0ff';
    for (y = -7; y <= 7; y++) for (i = -7; i <= 7; i++) {
      if (i * i + y * y <= 49 && !((i + 3) * (i + 3) + (y - 1) * (y - 1) <= 40)) x.fillRect(46 + i, 22 + y, 1, 1);
    }
    // 外壁（横張りサイディング）
    x.fillStyle = '#1d2246'; x.fillRect(120, 42, 200, 114);
    x.fillStyle = '#181c3c'; for (y = 46; y < 156; y += 4) x.fillRect(120, y, 200, 1);
    // 軒と屋根
    x.fillStyle = '#0e1028'; x.fillRect(112, 34, 208, 8);
    x.fillStyle = '#05060f'; x.fillRect(112, 42, 208, 1); x.fillRect(112, 34, 208, 1);
    // 玄関ポーチの灯り（壁に落ちる光）
    if (porchOn) ditherGlow(x, 158, 92, 30, '#6b4a38', '#3a2c3a', 1.1);
    // 扉枠と扉
    x.fillStyle = '#0c0a18'; x.fillRect(166, 78, 48, 74);
    x.fillStyle = '#3b2433'; x.fillRect(170, 82, 40, 68);
    x.fillStyle = '#2a1a26';
    x.fillRect(184, 88, 22, 24); x.fillRect(184, 118, 22, 26);         // 鏡板
    x.fillStyle = '#4a3040'; x.fillRect(184, 88, 22, 1); x.fillRect(184, 118, 22, 1);
    // 縦長の採光ガラス
    x.fillStyle = winLit ? '#ffcf7a' : '#141a3a'; x.fillRect(174, 88, 5, 56);
    x.fillStyle = '#05060f'; x.fillRect(174, 115, 5, 1);
    // ドアノブ
    x.fillStyle = porchOn ? '#ffb347' : '#6a5a40'; x.fillRect(205, 116, 2, 3);
    // 玄関灯
    x.fillStyle = '#05060f'; x.fillRect(155, 86, 7, 9);
    x.fillStyle = porchOn ? '#ffb347' : '#2a2f55'; x.fillRect(156, 88, 5, 6);
    if (porchOn) { x.fillStyle = '#fff1c8'; x.fillRect(157, 89, 3, 3); }
    // 表札
    x.fillStyle = '#05060f'; x.fillRect(219, 95, 13, 8);
    x.fillStyle = '#c3cae6'; x.fillRect(220, 96, 11, 6);
    x.fillStyle = '#3a3f6a'; x.fillRect(222, 98, 3, 1); x.fillRect(226, 98, 3, 1); x.fillRect(222, 100, 7, 1);
    // 窓
    x.fillStyle = '#05060f'; x.fillRect(240, 66, 58, 46);
    if (winLit) {
      x.fillStyle = '#ffcf7a'; x.fillRect(242, 68, 54, 42);
      x.fillStyle = '#e09a40';                                         // カーテンのひだ
      for (i = 242; i < 296; i += 6) x.fillRect(i, 68, 2, 42);
    } else {
      x.fillStyle = '#121638'; x.fillRect(242, 68, 54, 42);
      x.fillStyle = '#2a3366'; x.fillRect(248, 72, 2, 2); x.fillRect(251, 75, 1, 1);  // 月の映り込み
    }
    x.fillStyle = '#05060f'; x.fillRect(268, 68, 2, 42); x.fillRect(242, 88, 54, 2);
    x.fillStyle = '#2a2f55'; x.fillRect(238, 112, 62, 3);              // 窓台
    // 鉢植えとポスト
    x.fillStyle = '#05060f'; x.fillRect(139, 136, 14, 16);
    x.fillStyle = '#3a2a2e'; x.fillRect(140, 140, 12, 12);
    x.fillStyle = '#16302a';
    for (i = 0; i < 9; i++) x.fillRect(141 + i, 128 + Math.abs(4 - i) , 2, 12 - Math.abs(4 - i));
    x.fillStyle = '#05060f'; x.fillRect(222, 120, 12, 14);
    x.fillStyle = '#2c3360'; x.fillRect(223, 121, 10, 12);
    x.fillStyle = '#05060f'; x.fillRect(225, 124, 6, 1);
    // 段差と地面
    x.fillStyle = '#2a2f55'; x.fillRect(160, 150, 60, 3);
    x.fillStyle = '#20244a'; x.fillRect(154, 153, 72, 3);
    x.fillStyle = '#14172e'; x.fillRect(0, 156, W, H - 156);
    x.fillStyle = '#1b1f3e'; for (i = 0; i < W; i += 16) x.fillRect(i + ((i / 16) % 2) * 4, 162, 8, 1);
    if (porchOn) ditherGlow(x, 190, 158, 26, '#3a3046', '#252642', 2.0, 156);
    if (winLit) ditherGlow(x, 269, 160, 18, '#5a4436', '#2e2a3e', 2.2, 156);  // 窓明かりが地面へ
    // 門柱（左の余白との境）
    x.fillStyle = '#05060f'; x.fillRect(110, 112, 10, 44);
    x.fillStyle = '#262b52'; x.fillRect(111, 113, 8, 43);
    x.fillStyle = '#323867'; x.fillRect(111, 113, 8, 1);
    return c;
  }
  // rank: 'S'|'A'|'B'|'C'、t: 秒（B のちらつき用）
  function drawDoor(ctx, rank, t) {
    rank = ({ S: 1, A: 1, B: 1, C: 1 })[rank] ? rank : 'A';
    var porch = rank !== 'C';
    if (rank === 'B') { var ph = mod(t || 0, 2.7); porch = !(ph > 1.9 && ph < 2.05) && !(ph > 2.2 && ph < 2.5); }
    var key = rank + (porch ? 1 : 0);
    if (!doorCache[key]) doorCache[key] = buildDoor(rank, porch);
    crisp(ctx);
    ctx.drawImage(doorCache[key], 0, 0);
  }

  // ---------- 公開 ----------
  AT.ART = AT.ART || {};
  AT.ART.r3 = {
    attacker: {
      name: 'paperPlanes',
      draw: drawSwarm,          // (ctx, t, p, {tx,ty})
      drawPlane: drawPlane,     // (ctx, x, y, {big, scale, frame})
      count: SWARM_N
    },
    world: {
      name: 'schoolCorridor',
      draw: drawWorld,          // (ctx, t, speed, {dist})
      drawSide: drawSideWorld,  // 疾走用の横スクロール廊下 (ctx, dist(px), t, speed)
      reset: function () { world.pos = 0; world.lastT = null; },
      getDist: function () { return world.pos; }
    },
    walk: {
      name: 'darkResidential',
      draw: drawWalk,           // (ctx, scroll, t)
      groundY: GROUND_Y
    },
    accent: '#3dff8a',
    // 検証・統合用の生データ
    _data: { PLANE_S: PLANE_S, PLANE_L: PLANE_L, EXIT_SIGN: EXIT_SIGN, plateRows: plateRows, plateLabel: plateLabel, SPAL: SPAL, CH: CH }
  };
  AT.ART.ending = AT.ART.ending || {};
  AT.ART.ending.door = {
    draw: drawDoor,             // (ctx, rank, t)
    groundY: 156,
    playerArea: { x0: 0, x1: 130 }
  };
})(window.AT);
