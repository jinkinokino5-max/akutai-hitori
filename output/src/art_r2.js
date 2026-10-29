// art_r2: R2 の絵（襲来物=騎馬武者 / 異世界=夜の合戦場 / 帰り道=川沿いの土手）
// 使い方は draft/api_art_r2.md。クラシック <script> で読む（ES modules 不使用）。
// 差し色: 篝火朱 #ff5a1f（R1 ゴッホ黄 / R3 非常灯緑 は使わない）。輪郭色: 藍黒 #05060f。
// 騎馬武者は企画書§4どおり「色のない灰色」。色が付くのは目（マゼンタ）と槍の穂先（月白）だけ。
window.AT = window.AT || {};
AT.ART = AT.ART || {};
(function (AT) {
  var W = 320, H = 180;
  var GROUND_Y = 150;          // 自転車の車輪の接地ライン（異世界・帰り道とも共通）

  // ---- パレット（0=透明）。絵はすべてこの番号で描く ----
  var PAL = [
    null,       // 0 透明
    '#05060f',  // 1 輪郭（藍黒）
    '#262a38',  // 2 灰・暗
    '#454a5c',  // 3 灰・中
    '#6e7488',  // 4 灰・明
    '#a4aabd',  // 5 灰・淡
    '#e8f0ff',  // 6 月白
    '#ff2e88',  // 7 マゼンタ（悪態の差し色。武者の目）
    '#ff5a1f',  // 8 篝火朱（R2 差し色）
    '#0a0b1e',  // 9 濃紺
    '#1b2350',  // 10 群青
    '#2c1f4a',  // 11 紫紺
    '#ffb347',  // 12 ナトリウム橙
    '#ffe7a0',  // 13 炎の芯
    '#141836',  // 14 遠景の稜線
    '#0f1230',  // 15 城・遠いビル
    '#3a4470',  // 16 月明かりの縁
    '#121a2c',  // 17 野原
    '#0d1020',  // 18 土
    '#1e2840',  // 19 土の縁
    '#8e86a6',  // 20 すすきの穂
    '#3a1a2e',  // 21 篝火で焼けた地平の空
    '#8a2a1a',  // 22 幟の暗い朱
    '#c5cfe8',  // 23 月の影
    '#0c1230',  // 24 川面
    '#2a3870',  // 25 さざ波
    '#22243a',  // 26 土手道
    '#3a3e5a',  // 27 土手道の縁
    '#9fb0e0',  // 28 白い窓明かり
    '#121c2c',  // 29 土手の草
    '#5e5a7a'   // 30 陣幕
  ];
  var ACCENT = PAL[8];

  // ---- 乱数（core の AT.util.rng があれば使う） ----
  function rng(seed) {
    if (AT.util && AT.util.rng) return AT.util.rng(seed);
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // =====================================================================
  // 1. スプライト: パレット番号の2次元配列を手続きで描く小さなラスタライザ
  //    基準座標×scale で描くので、通常版(1)と拡大版(2)が同じ設計図から作れる
  // =====================================================================
  function Raster(bw, bh, s, top) {
    this.s = s; this.top = top || 0;     // top: 上に足す余白（基準単位）
    this.w = bw * s + 2; this.h = (bh + this.top) * s + 2;   // 輪郭用に1pxの余白
    this.d = new Uint8Array(this.w * this.h);
  }
  Raster.prototype.X = function (v) { return v * this.s + 1; };
  Raster.prototype.Y = function (v) { return (v + this.top) * this.s + 1; };
  Raster.prototype.set = function (x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  };
  Raster.prototype.ellipse = function (cx, cy, rx, ry, c) {
    var s = this.s, X = this.X(cx), Y = this.Y(cy), RX = rx * s, RY = ry * s;
    for (var y = Math.floor(Y - RY); y <= Math.ceil(Y + RY); y++) {
      for (var x = Math.floor(X - RX); x <= Math.ceil(X + RX); x++) {
        var dx = (x + 0.5 - X) / RX, dy = (y + 0.5 - Y) / RY;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  };
  Raster.prototype.poly = function (pts, c) {
    var self = this, P = pts.map(function (p) { return [self.X(p[0]), self.Y(p[1])]; });
    var y0 = Infinity, y1 = -Infinity, i;
    for (i = 0; i < P.length; i++) { y0 = Math.min(y0, P[i][1]); y1 = Math.max(y1, P[i][1]); }
    for (var y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      var yc = y + 0.5, xs = [];
      for (i = 0; i < P.length; i++) {
        var a = P[i], b = P[(i + 1) % P.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      xs.sort(function (m, n) { return m - n; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        for (var x = Math.ceil(xs[i] - 0.5); x + 0.5 < xs[i + 1]; x++) this.set(x, y, c);
      }
    }
  };
  Raster.prototype.line = function (x0, y0, x1, y1, c, th) {
    var X0 = this.X(x0), Y0 = this.Y(y0), X1 = this.X(x1), Y1 = this.Y(y1);
    var T = Math.max(1, Math.round((th || 1) * this.s));
    var n = Math.ceil(Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0))) + 1;
    for (var i = 0; i <= n; i++) {
      var f = i / n, cx = X0 + (X1 - X0) * f, cy = Y0 + (Y1 - Y0) * f;
      var bx = Math.round(cx - T / 2), by = Math.round(cy - T / 2);
      for (var yy = 0; yy < T; yy++) for (var xx = 0; xx < T; xx++) this.set(bx + xx, by + yy, c);
    }
  };
  Raster.prototype.rect = function (x0, y0, x1, y1, c) {
    for (var y = this.Y(y0); y < this.Y(y1); y++) for (var x = this.X(x0); x < this.X(x1); x++) this.set(x, y, c);
  };
  Raster.prototype.pt = function (x, y, c) {
    var X = Math.round(this.X(x)), Y = Math.round(this.Y(y));
    for (var yy = 0; yy < this.s; yy++) for (var xx = 0; xx < this.s; xx++) this.set(X + xx, Y + yy, c);
  };
  Raster.prototype.outline = function (c) {
    var src = this.d.slice(), w = this.w, h = this.h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (src[y * w + x]) continue;
      if ((x > 0 && src[y * w + x - 1]) || (x < w - 1 && src[y * w + x + 1]) ||
          (y > 0 && src[(y - 1) * w + x]) || (y < h - 1 && src[(y + 1) * w + x])) this.d[y * w + x] = c;
    }
  };
  Raster.prototype.rows = function () {
    var out = [];
    for (var y = 0; y < this.h; y++) out.push(Array.prototype.slice.call(this.d, y * this.w, (y + 1) * this.w));
    return out;
  };

  // ---- 騎馬武者の設計図（左向き＝主人公へ向かって突進。基準 58×46＋上余白2、地面 y≈44） ----
  var BOB = [0, 1, 0, -1];
  // 脚: [付け根x, 付け根y, 膝x, 膝y, 蹄x, 蹄y]  順に 奥前脚・奥後脚・手前前脚・手前後脚
  var LEGS = [
    [[22, 31, 19, 37, 16, 43], [40, 30, 42, 37, 46, 43], [20, 31, 15, 35, 11, 40], [38, 30, 44, 36, 50, 41]], // 伸び
    [[22, 31, 23, 36, 27, 40], [40, 30, 38, 37, 35, 43], [20, 31, 20, 37, 24, 42], [38, 30, 35, 36, 31, 42]], // 集め
    [[22, 31, 24, 37, 27, 43], [40, 30, 43, 35, 48, 39], [20, 31, 17, 37, 18, 44], [38, 30, 40, 37, 41, 44]], // 蹴り
    [[22, 31, 19, 35, 21, 39], [40, 30, 44, 33, 50, 35], [20, 31, 16, 34, 18, 38], [38, 30, 42, 34, 47, 37]]  // 宙
  ];
  var FRAMES = LEGS.length;
  var BASE_W = 58, BASE_H = 48, TOP = 2;   // TOP: 揺れ・旗のはためき用の上余白

  function buildSamuraiRows(s, f) {
    var r = new Raster(BASE_W, BASE_H - TOP, s, TOP), o = BOB[f], L = LEGS[f], w = [0, 1, 0, -1][f];
    function sh(pts) { return pts.map(function (p) { return [p[0], p[1] + o]; }); }
    function leg(l, c) {
      r.line(l[0], l[1] + o, l[2], l[3] + o * 0.5, c, 3);
      r.line(l[2], l[3] + o * 0.5, l[4], l[5], c, 2);
      r.rect(l[4] - 1, l[5], l[4] + 1, l[5] + 1, 1);   // 蹄
    }
    // 奥の脚と尾
    leg(L[0], 2); leg(L[1], 2);
    r.line(45, 24 + o, 51, 27 + o + w, 2, 2);
    r.line(51, 27 + o + w, 54, 34 + o - w, 2, 2);
    // 馬体
    r.ellipse(40, 27 + o, 6.5, 6, 3);
    r.ellipse(30, 29 + o, 12, 6, 3);
    r.ellipse(21, 28 + o, 6, 6, 3);
    r.ellipse(30, 33 + o, 9, 2, 2);
    r.poly(sh([[16, 28], [23, 23], [17, 12], [11, 15]]), 3);              // 首
    r.poly(sh([[12, 10], [18, 13], [11, 21], [6, 23], [3, 21], [7, 14]]), 3); // 頭
    r.poly(sh([[13, 7], [15, 10], [12, 10]]), 3);                         // 耳
    r.line(16, 10 + o, 19, 16 + o, 2, 2); r.line(19, 16 + o, 22, 22 + o, 2, 2); // たてがみ
    r.line(24, 24 + o, 36, 23 + o, 4, 1);                                 // 背の照り
    r.line(13, 15 + o, 16, 12 + o, 4, 1);
    r.pt(11, 15 + o, 7);                                                  // 馬の目
    r.pt(4, 21 + o, 1);                                                   // 鼻孔
    if (s >= 2) r.line(6, 21 + o, 24, 19 + o, 1, 0.5);                    // 手綱（拡大版のみ）
    // 手前の脚
    leg(L[2], 3); leg(L[3], 3);
    // 鞍と武者
    r.poly(sh([[26, 23], [37, 23], [36, 28], [27, 28]]), 2);
    r.line(27, 28 + o, 36, 28 + o, 5, 1);
    r.line(31, 23 + o, 26, 27 + o, 3, 3);                                 // 腿
    r.line(26, 27 + o, 27, 32 + o, 4, 2);                                 // 脛当
    r.rect(26, 33 + o, 29, 34 + o, 1);                                    // 鐙
    r.rect(25, 20 + o, 38, 24 + o, 2);                                    // 草摺
    r.line(25.5, 21 + o, 37.5, 21 + o, 4, 1); r.line(25.5, 23 + o, 37.5, 23 + o, 4, 1);
    r.poly(sh([[27, 11], [35, 11], [37, 21], [26, 21]]), 3);              // 胴
    for (var y = 13; y <= 19; y += 2) r.line(27, y + o, 36, y + o, 4, 1);   // 小札の段
    if (s >= 2) for (var x = 28; x <= 35; x += 2) r.line(x, 12 + o, x + 0.5, 20 + o, 5, 0.5); // 威毛
    r.poly(sh([[26, 11], [31, 11], [31, 17], [25, 16]]), 4);              // 袖
    r.line(25.5, 13 + o, 31, 13 + o, 2, 1); r.line(25.5, 15 + o, 31, 15 + o, 2, 1);
    r.line(29, 13 + o, 25, 18 + o, 4, 2);                                 // 腕
    r.poly(sh([[28, 8], [35, 8], [37, 11], [27, 11]]), 3);                // しころ
    r.line(28, 9.5 + o, 36, 9.5 + o, 4, 1);
    r.ellipse(31.5, 7 + o, 3.5, 3, 2);                                    // 兜鉢
    r.rect(28, 7 + o, 31, 10 + o, 1);                                     // 面頬
    r.pt(29, 8 + o, 7);                                                   // 武者の目
    r.line(31, 5 + o, 29, 1 + o, 5, 1); r.line(32, 5 + o, 34, 1 + o, 5, 1); // 鍬形
    // 指物（背の旗）
    r.line(36, 12 + o, 38, 1 + o, 2, 1);
    r.poly(sh([[38, 1], [45, 1 + w], [45, 10 + w], [38, 10]]), 4);
    r.ellipse(41.5, 5.5 + o + w * 0.5, 1.5, 1.5, 2);
    // 槍（手前）と穂先
    r.line(46, 12 + o, 1, 25 + o, 2, 1);
    r.pt(24, 18 + o, 5);                                                  // 手
    r.line(1, 25 + o, 5, 24 + o, 6, 1);
    r.outline(1);
    return r.rows();
  }

  // ---- パレット変換: art_common の AT.px.make があれば使い、無ければ自前 ----
  function rowsToCanvas(rows) {
    if (AT.px && typeof AT.px.make === 'function') {
      try { var c = AT.px.make(rows, PAL); if (c && c.width) return c; } catch (e) { /* 自前にフォールバック */ }
    }
    var h = rows.length, w = rows[0].length;
    var cv = makeCanvas(w, h), g = cv.getContext('2d');
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = rows[y][x];
      if (i) { g.fillStyle = PAL[i]; g.fillRect(x, y, 1, 1); }
    }
    return cv;
  }
  function makeCanvas(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    return c;
  }

  var spr = { 1: [], 2: [] };
  function samurai(scale, f) {
    var set = spr[scale] || (spr[scale] = []);
    if (!set[f]) set[f] = rowsToCanvas(buildSamuraiRows(scale, f));
    return set[f];
  }
  function frameAt(t, fps) { return Math.floor((t || 0) * (fps || 10)) % FRAMES; }

  // x, y = 足元（蹄の接地点）の中央。opts: {big, frame, scale, alpha}
  function drawEnemy(ctx, x, y, t, opts) {
    opts = opts || {};
    var big = !!opts.big, f = opts.frame != null ? (opts.frame % FRAMES) : frameAt(t, 10);
    var s = big ? 2 : 1, img = samurai(s, f), k = opts.scale || 1;
    var w = img.width * k, h = img.height * k;
    var a0 = ctx.globalAlpha;
    if (opts.alpha != null) ctx.globalAlpha = a0 * opts.alpha;
    // 蹄の下端は画像の下から (s+1)px 上にある
    ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h + (s + 1) * k), Math.round(w), Math.round(h));
    ctx.globalAlpha = a0;
  }

  // 襲来: p=0 で右上の闇の外、p=1 で主人公(tx,ty)の目前。拡大版が加速しながら迫る
  function drawApproach(ctx, p, t, tx, ty) {
    p = Math.max(0, Math.min(1, p));
    tx = tx == null ? 96 : tx; ty = ty == null ? GROUND_Y : ty;
    var e = p * p;
    var x0 = W + 50, y0 = -10, x1 = tx + 70, y1 = ty + 20;
    var f = frameAt(t, 12);
    // 闇から伸びる残像
    for (var i = 3; i >= 1; i--) {
      var q = Math.max(0, e - i * 0.06);
      drawEnemy(ctx, x0 + (x1 - x0) * q, y0 + (y1 - y0) * q, t, { big: true, frame: (f + i) % FRAMES, scale: 0.4 + 1.2 * q, alpha: 0.18 * (4 - i) * Math.min(1, p * 3) });
    }
    var shake = p > 0.8 ? Math.round((Math.random() - 0.5) * 4 * p) : 0;
    drawEnemy(ctx, x0 + (x1 - x0) * e + shake, y0 + (y1 - y0) * e, t, { big: true, frame: f, scale: 0.4 + 1.2 * e });
  }

  // =====================================================================
  // 2. 背景の描画ヘルパー（パレット番号で fillRect。ドット感を保つため整数座標）
  // =====================================================================
  function R(g, ci, x, y, w, h) { g.fillStyle = PAL[ci]; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function E(g, ci, cx, cy, rx, ry) {
    g.fillStyle = PAL[ci];
    for (var y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      var v = (y + 0.5 - cy) / ry; if (v * v > 1) continue;
      var dx = rx * Math.sqrt(1 - v * v), a = Math.round(cx - dx), b = Math.round(cx + dx);
      if (b > a) g.fillRect(a, y, b - a, 1);
    }
  }
  function Ln(g, ci, x0, y0, x1, y1) {
    g.fillStyle = PAL[ci];
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    for (var i = 0; i <= n; i++) {
      var f = n ? i / n : 0;
      g.fillRect(Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f), 1, 1);
    }
  }
  var BAYER = [0, 2, 3, 1];
  // 縦グラデーションを2×2ディザで（stops: [[y, 色番号], ...]）
  function vgrad(g, w, stops) {
    for (var s = 0; s + 1 < stops.length; s++) {
      var ya = stops[s][0], yb = stops[s + 1][0], ca = stops[s][1], cb = stops[s + 1][1];
      for (var y = ya; y < yb; y++) {
        var f = (y - ya) / (yb - ya);
        for (var x = 0; x < w; x++) {
          var th = (BAYER[(x & 1) + (y & 1) * 2] + 0.5) / 4;
          g.fillStyle = PAL[f > th ? cb : ca]; g.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  function moonHalo(g, cx, cy, r0, r1, ci) {
    g.fillStyle = PAL[ci];
    for (var y = Math.floor(cy - r1); y <= cy + r1; y++) for (var x = Math.floor(cx - r1); x <= cx + r1; x++) {
      var d = Math.sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy));
      if (d < r0 || d > r1) continue;
      var f = 1 - (d - r0) / (r1 - r0), th = (BAYER[(x & 1) + (y & 1) * 2] + 0.5) / 4;
      if (f * 0.75 > th) g.fillRect(x, y, 1, 1);
    }
  }
  function stars(g, rnd, n, yMax) {
    for (var i = 0; i < n; i++) {
      var x = Math.floor(rnd() * W), y = Math.floor(rnd() * yMax), c = rnd() < 0.25 ? 6 : (rnd() < 0.5 ? 23 : 5);
      R(g, c, x, y, 1, 1);
      if (rnd() < 0.08) { R(g, 16, x - 1, y, 1, 1); R(g, 16, x + 1, y, 1, 1); R(g, 16, x, y - 1, 1, 1); R(g, 16, x, y + 1, 1, 1); }
    }
  }
  // 横に周期 tw でつながる起伏（整数周期の sin の和なので継ぎ目なし）
  function ridge(x, tw, base, amps, seed) {
    var v = base;
    for (var i = 0; i < amps.length; i++) v += amps[i][1] * Math.sin(2 * Math.PI * amps[i][0] * x / tw + seed * (i + 1));
    return Math.round(v);
  }
  // タイルを横にループ描画
  function blit(g, tile, off, y) {
    var tw = tile.width, x = -(((Math.floor(off) % tw) + tw) % tw);
    for (; x < W; x += tw) g.drawImage(tile, x, y || 0);
  }
  // タイル座標 ix の物を画面に（ループ考慮）
  function eachWrap(ix, off, tw, m, fn) {
    var sx = (((ix - Math.floor(off)) % tw) + tw) % tw;
    if (sx < W + m) fn(sx);
    if (sx - tw > -m) fn(sx - tw);
  }

  // 篝火の炎（動的）。x,y = 炎の根元
  function fire(g, x, y, t, seed, size) {
    var k = 0.85 + 0.25 * Math.sin(t * 13 + seed) + 0.12 * Math.sin(t * 31 + seed * 2.3);
    var h = Math.max(3, Math.round(size * 1.6 * k));
    var a0 = g.globalAlpha;
    g.globalAlpha = a0 * (0.16 + 0.04 * Math.sin(t * 9 + seed));
    E(g, 8, x, y - h * 0.4, size * 3.2, size * 2.6);
    g.globalAlpha = a0 * 0.22;
    E(g, 12, x, y - h * 0.4, size * 1.8, size * 1.5);
    g.globalAlpha = a0;
    for (var i = 0; i < h; i++) {
      var f = i / h, wv = Math.sin(t * 17 + i * 0.9 + seed) * f * 1.2;
      var ww = Math.max(1, Math.round(size * (1 - f * f) + 0.5));
      R(g, 8, x - ww + wv, y - i, ww * 2, 1);
      if (ww > 1 && f < 0.75) R(g, 12, x - ww + 1 + wv, y - i, ww * 2 - 2, 1);
      if (ww > 2 && f < 0.45) R(g, 13, x - ww + 2 + wv, y - i, ww * 2 - 4, 1);
    }
    for (var j = 0; j < 3; j++) {   // 火の粉
      var life = ((t * (14 + j * 5) + seed * 7 + j * 11) % 26);
      R(g, life < 13 ? 12 : 8, x + Math.round(Math.sin(t * 3 + j * 2 + seed) * (2 + life * 0.2)), y - h - life, 1, 1);
    }
  }
  // すすき1本（動的）
  function susuki(g, x, base, h, sway, stem, plume) {
    var tx = 0;
    for (var i = 0; i < h; i++) {
      var f = i / h; tx = Math.round(sway * f * f);
      R(g, i > h - 8 ? plume : stem, x + tx, base - i, 1, 1);
    }
    var top = base - h;
    for (var j = 0; j < 7; j++) {
      var dx = Math.round(sway * 1.1) - (j >> 1);
      R(g, plume, x + dx + (j % 2 ? -1 : 1), top + j + 1, 1, 1);
    }
    R(g, plume, x + Math.round(sway * 1.25), top - 1, 1, 1);
  }

  // =====================================================================
  // 3. 異世界: 夜の合戦場（空・遠景の城と稜線・中景の陣と幟と篝火・近景の野原）
  // =====================================================================
  var world = null;
  var WF = { sky: 0, far: 0.08, mid: 0.35, near: 1, front: 1.5 };

  function buildWorld() {
    var rnd = rng(2002), o = { farFires: [], midFires: [], grass: [], blades: [] };
    // --- 空（静止） ---
    var sky = makeCanvas(W, GROUND_Y), g = sky.getContext('2d');
    vgrad(g, W, [[0, 9], [46, 9], [80, 10], [104, 11], [124, 21], [GROUND_Y, 21]]);
    stars(g, rnd, 80, 100);
    moonHalo(g, 252, 36, 14, 26, 10);
    moonHalo(g, 252, 36, 14, 19, 16);
    E(g, 6, 252, 36, 13, 13);                                   // 満月
    E(g, 23, 247, 31, 3, 2.5); E(g, 23, 257, 40, 4, 3); E(g, 23, 250, 43, 2, 1.5); E(g, 23, 259, 30, 1.5, 1.5);
    R(g, 10, 222, 44, 30, 2); R(g, 10, 236, 47, 44, 1); R(g, 10, 214, 52, 26, 1);   // 薄雲
    o.sky = sky;

    // --- 遠景: 稜線と合戦城（640幅ループ） ---
    var FW = 640, far = makeCanvas(FW, GROUND_Y); g = far.getContext('2d');
    var AMP = [[2, 6], [5, 4], [11, 2]];
    for (var x = 0; x < FW; x++) {
      var top = ridge(x, FW, 104, AMP, 0.7);
      R(g, 14, x, top, 1, GROUND_Y - top);
      if (rnd() < 0.05) R(g, 22, x, top - 3, 1, 3);               // 遠い旗
      if (x % 37 === 11) o.farFires.push([x, top - 1, rnd() * 10]);
    }
    var cx = 430;
    E(g, 14, cx, 104, 70, 16);                                  // 城山
    // 石垣
    for (var y = 86; y < 98; y++) { var hw = 17 + (y - 86) * 0.5; R(g, 15, cx - hw, y, hw * 2, 1); }
    function roof(y, hw, hgt) {
      for (var i = 0; i < hgt; i++) { var ww = hw - i * 1.6; R(g, 15, cx - ww, y - i, ww * 2, 1); }
      R(g, 16, cx - hw, y, hw * 2, 1);
      R(g, 15, cx - hw - 1, y - 1, 1, 1); R(g, 15, cx + hw, y - 1, 1, 1);  // 反り
    }
    R(g, 15, cx - 16, 79, 32, 8); roof(79, 22, 4);
    R(g, 15, cx - 11, 69, 22, 7); roof(69, 16, 4);
    R(g, 15, cx - 7, 60, 14, 6); roof(60, 11, 5);
    R(g, 16, cx - 6, 54, 1, 2); R(g, 16, cx + 5, 54, 1, 2);       // 鯱
    [[-12, 82], [-6, 82], [4, 82], [10, 82], [-7, 72], [0, 72], [6, 72], [-3, 63], [2, 63]].forEach(function (p) {
      if (rnd() < 0.7) R(g, 12, cx + p[0], p[1], 2, 2);
    });
    o.far = far;

    // --- 中景: 陣幕・幟・篝火の台（480幅ループ） ---
    var MW = 480, mid = makeCanvas(MW, GROUND_Y); g = mid.getContext('2d');
    var MA = [[1, 2], [3, 1.5]];
    function mtop(x) { return ridge(x, MW, 124, MA, 2.1); }
    [[30, 150], [290, 380]].forEach(function (seg) {          // 陣幕
      for (var x = seg[0]; x < seg[1]; x++) {
        var t0 = mtop(x) - 11;
        R(g, 30, x, t0, 1, 9);
        R(g, 11, x, t0 + 3, 1, 2);
        if ((x - seg[0]) % 18 === 9) { R(g, 6, x - 1, t0 + 5, 3, 3); R(g, 30, x, t0 + 6, 1, 1); }
        if ((x - seg[0]) % 12 === 0) R(g, 2, x, t0 - 2, 1, 12);
      }
    });
    for (var x = 0; x < MW; x++) R(g, 17, x, mtop(x), 1, GROUND_Y - mtop(x));
    var cols = [22, 10, 30, 22];
    for (var n = 0, bx = 8; bx < MW - 8; n++, bx += 26 + Math.floor(rnd() * 22)) {   // 幟
      var gy = mtop(bx) + 1, ht = 30 + Math.floor(rnd() * 10), tp = gy - ht, c = cols[n % cols.length];
      R(g, 2, bx, tp, 1, ht);
      R(g, 2, bx - 6, tp, 7, 1);
      R(g, c, bx - 6, tp + 1, 6, 20);
      R(g, 6, bx - 4, tp + 3, 2, 2);                              // 紋
      R(g, 16, bx - 6, tp + 1, 1, 20);
      for (var k = 0; k < 20; k += 4) R(g, 1, bx - 1, tp + 1 + k, 1, 1);  // 乳（環）
    }
    [70, 230, 410].forEach(function (fx, i) {                  // 篝火の台
      var gy = mtop(fx) + 1;
      Ln(g, 1, fx, gy - 12, fx - 4, gy); Ln(g, 1, fx, gy - 12, fx + 4, gy); Ln(g, 1, fx, gy - 12, fx, gy);
      R(g, 1, fx - 3, gy - 14, 7, 3); R(g, 2, fx - 2, gy - 13, 5, 1);
      o.midFires.push([fx, gy - 14, i * 3.7]);
    });
    o.mid = mid;

    // --- 近景: 野原と道（320幅ループ。道は y=150 前後） ---
    var nr = makeCanvas(W, H - 136); g = nr.getContext('2d');   // y=136 から下
    for (var x = 0; x < W; x++) {
      R(g, 17, x, 0, 1, 12);
      R(g, 19, x, 12, 1, 1);                                   // 道の縁 y=148
      R(g, 18, x, 13, 1, H - 136 - 13);
      if (rnd() < 0.3) R(g, 19, x, 1 + Math.floor(rnd() * 10), 1, 2);
      if (rnd() < 0.06) R(g, 27, x, 14 + Math.floor(rnd() * 8), 1, 1);   // 小石
      if (rnd() < 0.15) R(g, 17, x, 24 + Math.floor(rnd() * 18), 1, 2);
    }
    o.near = nr; o.nearY = 136;
    for (var i = 0; i < 26; i++) o.grass.push([Math.floor(rnd() * W), 147 + Math.floor(rnd() * 2), 16 + Math.floor(rnd() * 20), rnd() * 6]);
    for (var j = 0; j < 9; j++) o.blades.push([Math.floor(rnd() * 400), 183, 12 + Math.floor(rnd() * 12), rnd() * 6]);
    return o;
  }

  // scroll: 走った距離(px, 近景基準)。t: 秒。speed: 0〜100
  function drawWorld(ctx, scroll, t, speed) {
    if (!world) world = buildWorld();
    var o = world, sp = (speed || 0) / 100;
    ctx.drawImage(o.sky, 0, 0);
    var offF = scroll * WF.far, offM = scroll * WF.mid, offN = scroll * WF.near;
    blit(ctx, o.far, offF, 0);
    o.farFires.forEach(function (f) {
      eachWrap(f[0], offF, o.far.width, 2, function (sx) {
        R(ctx, Math.sin(t * 7 + f[2]) > 0 ? 8 : 12, sx, f[1], 1, 1);
      });
    });
    blit(ctx, o.mid, offM, 0);
    o.midFires.forEach(function (f) {
      eachWrap(f[0], offM, o.mid.width, 30, function (sx) { fire(ctx, sx, f[1], t, f[2], 3); });
    });
    ctx.fillStyle = PAL[17]; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);   // タイル下端の隙間埋め
    blit(ctx, o.near, offN, o.nearY);
    var lean = -sp * 4;
    o.grass.forEach(function (s) {
      eachWrap(s[0], offN, W, 6, function (sx) {
        susuki(ctx, sx, s[1], s[2], Math.sin(t * 1.7 + s[3]) * 1.5 + lean, 2, 20);
      });
    });
    if (sp > 0.4) {                                             // 地面の流線
      var n = Math.round((sp - 0.4) * 14);
      for (var i = 0; i < n; i++) {
        var y = 158 + ((i * 7) % 20), len = 8 + sp * 20;
        var x = W - (((offN * 1.6 + i * 53) % (W + len)));
        R(ctx, 19, x, y, len, 1);
      }
    }
  }
  // 主人公より手前に描く前景（下端のすすき）。主人公の後に呼ぶ
  function drawWorldFront(ctx, scroll, t, speed) {
    if (!world) world = buildWorld();
    var off = scroll * WF.front, lean = -(speed || 0) / 100 * 5;
    world.blades.forEach(function (s) {
      eachWrap(s[0], off, 400, 6, function (sx) {
        susuki(ctx, sx, s[1], s[2], Math.sin(t * 2.1 + s[3]) * 2 + lean, 1, 4);
      });
    });
  }

  // =====================================================================
  // 4. 帰り道（R2）: 川沿いの土手。対岸の街と鉄橋・川面・土手道と街灯
  // =====================================================================
  var road = null;
  var RF = { sky: 0, far: 0.06, mid: 0.3, near: 1, front: 1.4 };

  function buildRoad() {
    var rnd = rng(2202), o = { windows: [], lamps: [], tufts: [] };
    var sky = makeCanvas(W, GROUND_Y), g = sky.getContext('2d');
    vgrad(g, W, [[0, 9], [50, 9], [90, 10], [112, 11], [GROUND_Y, 11]]);
    stars(g, rnd, 34, 80);
    moonHalo(g, 64, 30, 9, 18, 10);
    E(g, 6, 64, 30, 9, 9); E(g, 9, 68, 27, 8, 8);               // 三日月（濃紺で欠く）
    o.sky = sky;

    // 遠景: 対岸の街・鉄橋・電波塔（640幅）
    var FW = 640, far = makeCanvas(FW, GROUND_Y); g = far.getContext('2d');
    R(g, 14, 0, 104, FW, 8);
    for (var x = 0; x < FW;) {
      var bw = 6 + Math.floor(rnd() * 14), bh = 6 + Math.floor(rnd() * 22);
      if (x > 50 && x < 310) bh = Math.min(bh, 8);              // 橋の背後は低く
      R(g, 15, x, 104 - bh, bw, bh);
      for (var wy = 104 - bh + 2; wy < 102; wy += 3) for (var wx = x + 1; wx < x + bw - 1; wx += 2) {
        if (rnd() < 0.22) { var c = rnd() < 0.6 ? 12 : 28; R(g, c, wx, wy, 1, 1); if (rnd() < 0.5) o.windows.push([wx, c]); }
      }
      x += bw + Math.floor(rnd() * 3);
    }
    R(g, 15, 498, 58, 3, 46); R(g, 15, 496, 70, 7, 2); R(g, 15, 495, 84, 9, 2);   // 電波塔
    o.tower = [499, 57];
    // 鉄橋（トラス）
    R(g, 14, 60, 100, 250, 2); R(g, 14, 60, 92, 250, 1);
    for (var bx = 60; bx < 310; bx += 10) { Ln(g, 14, bx, 100, bx + 5, 92); Ln(g, 14, bx + 5, 92, bx + 10, 100); }
    for (var px = 60; px <= 310; px += 50) R(g, 14, px - 1, 102, 3, 10);
    o.far = far; o.bridge = [62, 306];

    // 中景: 川面（480幅）
    var MW = 480, mid = makeCanvas(MW, GROUND_Y); g = mid.getContext('2d');
    R(g, 24, 0, 112, MW, 24);
    for (var i = 0; i < 160; i++) R(g, rnd() < 0.7 ? 25 : 10, Math.floor(rnd() * MW), 113 + Math.floor(rnd() * 21), 2 + Math.floor(rnd() * 6), 1);
    for (var x = 0; x < MW; x++) {                             // 手前の岸と葦
      R(g, 29, x, 133, 1, GROUND_Y - 133);
      if (rnd() < 0.35) R(g, 29, x, 129 + Math.floor(rnd() * 4), 1, 4);
    }
    o.mid = mid;

    // 近景: 土手の斜面・土手道・下り斜面（320幅、y=134から下）
    var NY = 134, nr = makeCanvas(W, H - NY); g = nr.getContext('2d');
    for (var x = 0; x < W; x++) {
      R(g, 29, x, 0, 1, 12);                                   // 川側の斜面 134-146
      if (rnd() < 0.35) R(g, 17, x, Math.floor(rnd() * 11), 1, 2);
      R(g, 27, x, 12, 1, 1);                                   // 道の縁 146
      R(g, 26, x, 13, 1, 9);                                   // 土手道 147-155
      if (rnd() < 0.08) R(g, 27, x, 14 + Math.floor(rnd() * 7), 1, 1);
      R(g, 27, x, 22, 1, 1);                                   // 道の縁 156
      R(g, 18, x, 23, 1, H - NY - 23);                         // 町側の斜面
      if (rnd() < 0.25) R(g, 29, x, 24 + Math.floor(rnd() * 20), 1, 2);
    }
    for (var bx = 20; bx < W; bx += 40) { R(g, 5, bx, 23, 1, 4); R(g, 1, bx, 27, 1, 1); }   // 低い杭
    // 看板（文字なし。「川で遊ばない」的なもの）
    R(g, 2, 60, 6, 1, 7); R(g, 1, 55, 0, 11, 7); R(g, 5, 56, 1, 9, 5); R(g, 26, 58, 2, 5, 1); R(g, 26, 58, 4, 3, 1);
    // 街灯（柱と光は drawRoad で動的に描く）
    var LX = 200;
    o.near = nr; o.nearY = NY;
    o.lamps.push([LX, 146]);
    for (var j = 0; j < 8; j++) o.tufts.push([Math.floor(rnd() * 360), 181, 4 + Math.floor(rnd() * 5), rnd() * 6]);
    return o;
  }

  function drawRoad(ctx, scroll, t) {
    if (!road) road = buildRoad();
    var o = road;
    ctx.drawImage(o.sky, 0, 0);
    var offF = scroll * RF.far, offM = scroll * RF.mid, offN = scroll * RF.near;
    blit(ctx, o.far, offF, 0);
    eachWrap(o.tower[0], offF, o.far.width, 2, function (sx) {   // 航空障害灯
      if ((t % 1.6) < 0.8) R(ctx, 7, sx, o.tower[1], 1, 1);
    });
    var per = 14, ph = (t % per) / per;                          // 鉄橋を渡る電車
    if (ph < 0.5) {
      var b0 = o.bridge[0], b1 = o.bridge[1], tx0 = b0 + (b1 - b0 + 40) * (ph / 0.5) - 40;
      for (var c = 0; c < 4; c++) {
        var cxs = tx0 + c * 10;
        if (cxs < b0 || cxs + 8 > b1) continue;
        eachWrap(cxs, offF, o.far.width, 10, function (sx) { R(ctx, 15, sx, 96, 9, 4); R(ctx, 12, sx + 1, 97, 7, 1); });
      }
    }
    blit(ctx, o.mid, offM, 0);
    // 窓明かりの映り込み（遠景と同じ速さで流す）
    o.windows.forEach(function (w, i) {
      eachWrap(w[0], offF, o.far.width, 1, function (sx) {
        for (var k = 0; k < 3; k++) {
          if (Math.sin(t * 5 + i * 1.7 + k * 2.1) > 0.2) R(ctx, w[1] === 12 ? 12 : 25, sx + Math.round(Math.sin(t * 3 + k + i) ), 114 + k * 4 + (i % 3), 1, 1);
        }
      });
    });
    for (var k = 0; k < 9; k++) {                                // 月の映り込み（画面に固定）
      var wv = Math.round(Math.sin(t * 2.3 + k * 1.3) * 2), ww = 2 + ((k * 3) % 5);
      if (Math.sin(t * 4 + k) > -0.3) R(ctx, k % 3 ? 23 : 6, 64 - ww / 2 + wv, 114 + k * 2, ww, 1);
    }
    ctx.fillStyle = PAL[18]; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    blit(ctx, o.near, offN, o.nearY);
    o.lamps.forEach(function (l) {
      eachWrap(l[0], offN, W, 40, function (sx) {
        R(ctx, 2, sx, 98, 1, l[1] - 98);
        R(ctx, 2, sx - 6, 98, 7, 1);
        R(ctx, 1, sx - 8, 98, 4, 2);
        var a0 = ctx.globalAlpha, fl = 0.97 + 0.03 * Math.sin(t * 40);
        ctx.globalAlpha = a0 * 0.07 * fl;
        for (var y = 100; y < 152; y++) { var hw = 1 + (y - 100) * 0.45; R(ctx, 12, sx - 6 - hw, y, hw * 2, 1); }
        ctx.globalAlpha = a0 * 0.16 * fl;
        E(ctx, 12, sx - 6, 151, 26, 5);
        ctx.globalAlpha = a0;
        R(ctx, 12, sx - 8, 100, 4, 1); R(ctx, 13, sx - 7, 100, 2, 1);
      });
    });
  }
  function drawRoadFront(ctx, scroll, t) {
    if (!road) road = buildRoad();
    var off = scroll * RF.front;
    road.tufts.forEach(function (s) {
      eachWrap(s[0], off, 360, 4, function (sx) {
        for (var k = -1; k <= 1; k++) susuki(ctx, sx + k * 2, s[1], s[2] - Math.abs(k) * 2, Math.sin(t * 1.5 + s[3] + k) * 1, 29, 29);
      });
    });
  }

  // 先に全部作っておく（初回描画のカクつき防止）
  function preload() {
    if (!world) world = buildWorld();
    if (!road) road = buildRoad();
    for (var f = 0; f < FRAMES; f++) { samurai(1, f); samurai(2, f); }
  }

  // art_r3 と同じ形の入口（attacker / world / walk）。統合側はどちらの呼び方でもよい
  var wst = { pos: 0, lastT: null };
  function worldDrawAuto(ctx, t, speed, opts) {
    opts = opts || {};
    speed = Math.max(0, Math.min(100, speed || 0));
    if (wst.lastT == null) wst.lastT = t;
    var dt = Math.max(0, Math.min(0.1, t - wst.lastT)); wst.lastT = t;
    wst.pos += dt * (60 + speed * 3);                    // 60〜360 px/秒
    if (opts.dist != null) wst.pos = opts.dist;
    drawWorld(ctx, wst.pos, t, speed);
  }

  AT.ART.r2 = {
    attacker: {
      name: 'samurai',
      draw: function (ctx, t, p, opts) { opts = opts || {}; drawApproach(ctx, p, t, opts.tx, opts.ty); },
      drawOne: function (ctx, x, y, opts) { drawEnemy(ctx, x, y, (opts && opts.t) || 0, opts); }
    },
    world: {
      name: 'battlefield',
      draw: worldDrawAuto,                                // (ctx, t, speed, {dist})
      drawFront: function (ctx, t, speed) { drawWorldFront(ctx, wst.pos, t, speed); },
      reset: function () { wst.pos = 0; wst.lastT = null; },
      getDist: function () { return wst.pos; },
      groundY: GROUND_Y
    },
    walk: {
      name: 'riverbank',
      draw: drawRoad,                                     // (ctx, scroll, t)
      drawFront: drawRoadFront,
      groundY: GROUND_Y
    },
    id: 2,
    accent: ACCENT,
    palette: PAL,
    groundY: GROUND_Y,
    frames: FRAMES,
    enemySize: { w: BASE_W + 2, h: BASE_H + 2, bigW: BASE_W * 2 + 2, bigH: BASE_H * 2 + 2 },
    preload: preload,
    drawEnemy: drawEnemy,
    drawApproach: drawApproach,
    drawWorld: drawWorld,
    drawWorldFront: drawWorldFront,
    drawRoad: drawRoad,
    drawRoadFront: drawRoadFront,
    enemyCanvas: samurai,                 // (scale 1|2, frame) -> canvas
    _buildEnemyRows: buildSamuraiRows     // テスト用: (scale, frame) -> 2次元配列
  };
})(window.AT);
