// art_common.js — ドット絵の共通基盤（全 art 担当が使う）
//
// 方針（企画書§7）
// - 絵はすべて「パレット番号の2次元バッファ（0=透明）」で描き、最後に canvas へ変換する。
// - 色は AT.px.PAL（唯一の共通パレット）。名前→番号は AT.px.I。足りない色は AT.px.addColor で追加。
// - 輪郭色は藍黒 #05060f（AT.px.I.outline = 1）。
// - canvas 以外は純JSなので node でも寸法検証できる（document が無いと toCanvas は null を返す）。
//
// 主なAPI（詳細は draft/api_art_r1.md）
//   AT.px.make(rows, palette?)   … rows(文字列 or 数値配列の配列) → canvas
//   AT.px.grid(w, h)             … 描画用インデックスバッファ（rect/line/disc/poly/dither/outline…）
//   AT.px.rng(seed) / AT.px.hash(x, y, seed)
//   AT.px.dith(x, y, level0to16) … 4x4 Bayer ディザ判定
//   AT.px.drawWrap(ctx, img, scrollX, y) … 横に無限タイル描画（パララックス用）
//   AT.px.hero                   … 主人公（自転車）: walk[4] / run[4] 24×24、draw(ctx,x,groundY,mode,t,speed01)
window.AT = window.AT || {};
(function (AT) {
  'use strict';
  var px = AT.px = AT.px || {};

  // ---------------------------------------------------------------------------
  // 共通パレット（番号 = 配列の位置。0 は透明）
  // ---------------------------------------------------------------------------
  var COLORS = [
    ['outline',  '#05060f'], // 1 共通輪郭（ほぼ黒の藍）
    ['navy',     '#0a0b1e'], // 2 ベース濃紺
    ['indigo',   '#1b2350'], // 3 群青
    ['violet',   '#2c1f4a'], // 4 紫紺
    ['blueDk',   '#24306a'], // 5
    ['blue',     '#3a4f9a'], // 6
    ['skyLt',    '#6f8fd8'], // 7 テレビの光・反射
    ['pale',     '#a9c1f0'], // 8 白鳥の影・月の暈
    ['moon',     '#e8f0ff'], // 9 月白（文字色と同じ）
    ['white',    '#ffffff'], // 10
    ['lamp',     '#ffb347'], // 11 街灯ナトリウム橙
    ['lampDk',   '#b8682a'], // 12
    ['lampLt',   '#ffe2a6'], // 13
    ['magenta',  '#ff2e88'], // 14 悪態の差し色
    ['magentaDk','#9c1858'], // 15
    ['grayDk',   '#23253a'], // 16
    ['gray',     '#43465e'], // 17
    ['grayLt',   '#767a96'], // 18
    ['skin',     '#e3ab8c'], // 19
    ['skinDk',   '#a8695a'], // 20
    ['hair',     '#17121f'], // 21
    ['coat',     '#3f7a8c'], // 22 主人公の上着（夜に沈まない青緑）
    ['coatLt',   '#73b3c0'], // 23
    ['coatDk',   '#24485a'], // 24
    ['pants',    '#3b3658'], // 25
    ['gogh',     '#f5d33a'], // 26 R1 差し色 ゴッホ黄
    ['goghDk',   '#c4901e'], // 27
    ['goghLt',   '#fff3a0'], // 28
    ['cyp',      '#16301f'], // 29 糸杉（暗）
    ['cypMd',    '#2b5634'], // 30
    ['cypLt',    '#5a8f45'], // 31
    ['vgBlueDk', '#10215e'], // 32 ゴッホの夜空（暗→明）
    ['vgBlue',   '#1f45a3'], // 33
    ['vgBlueLt', '#3f76d4'], // 34
    ['vgCyan',   '#86c0e6'], // 35
    ['fire',     '#ff5a1f'], // 36 R2 差し色 篝火朱
    ['exit',     '#3dff8a'], // 37 R3 差し色 非常灯緑
    ['brown',    '#5a3a2a'], // 38
    ['brownLt',  '#8c5a38'], // 39
    ['red',      '#c8384a']  // 40
  ];
  px.PAL = [null];
  px.I = {};
  px.addColor = function (name, hex) {
    if (px.I[name] != null) return px.I[name];
    px.PAL.push(hex);
    px.I[name] = px.PAL.length - 1;
    return px.I[name];
  };
  COLORS.forEach(function (c) { px.addColor(c[0], c[1]); });

  var rgbCache = {};
  function hexRgb(hex) {
    var v = rgbCache[hex];
    if (v) return v;
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    rgbCache[hex] = v;
    return v;
  }
  px.hexRgb = hexRgb;

  // ---------------------------------------------------------------------------
  // 乱数・ハッシュ・ディザ
  // ---------------------------------------------------------------------------
  px.rng = function (seed) { // mulberry32。[0,1)
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  px.hash = function (x, y, seed) { // 座標→[0,1) 決定的
    var h = Math.imul((x | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((y | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((seed | 0) + 1, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  px.BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  // level 0〜16: 0=全く塗らない, 16=全部塗る
  px.dith = function (x, y, level) { return level > px.BAYER4[y & 3][x & 3]; };

  // ---------------------------------------------------------------------------
  // Grid（インデックスバッファ）
  // ---------------------------------------------------------------------------
  function Grid(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  var G = Grid.prototype;
  // c < 0 は何もしない。c = 0 は透明で消す
  G.set = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (c < 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  };
  // 横方向にラップする set（タイル背景用）
  G.setw = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (c < 0 || y < 0 || y >= this.h) return;
    x = ((x % this.w) + this.w) % this.w;
    this.d[y * this.w + x] = c;
  };
  G.get = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  };
  G.rect = function (x, y, w, h, c, wrap) {
    var f = wrap ? this.setw : this.set;
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) f.call(this, x + i, y + j, c);
  };
  G.line = function (x0, y0, x1, y1, c, th, wrap) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    th = th || 1;
    var f = wrap ? this.setw : this.set;
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    var o = -Math.floor((th - 1) / 2);
    for (;;) {
      if (th === 1) f.call(this, x0, y0, c);
      else for (var j = 0; j < th; j++) for (var i = 0; i < th; i++) f.call(this, x0 + o + i, y0 + o + j, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  // 折れ線（点列 [[x,y],...]）
  G.path = function (pts, c, th, wrap) {
    for (var i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, th, wrap);
  };
  G.ellipse = function (cx, cy, rx, ry, c, wrap) {
    var f = wrap ? this.setw : this.set;
    var rx2 = (rx + 0.35) * (rx + 0.35), ry2 = (ry + 0.35) * (ry + 0.35);
    for (var y = Math.floor(-ry - 1); y <= ry + 1; y++)
      for (var x = Math.floor(-rx - 1); x <= rx + 1; x++)
        if ((x * x) / rx2 + (y * y) / ry2 <= 1) f.call(this, Math.round(cx) + x, Math.round(cy) + y, c);
  };
  G.disc = function (cx, cy, r, c, wrap) { this.ellipse(cx, cy, r, r, c, wrap); };
  G.ring = function (cx, cy, r, c, wrap) {
    var f = wrap ? this.setw : this.set;
    var n = Math.max(8, Math.ceil(r * 7));
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      f.call(this, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
    }
  };
  // 多角形の塗り（偶奇規則）。pts = [[x,y],...]
  G.poly = function (pts, c, wrap) {
    var f = wrap ? this.setw : this.set;
    var minY = Infinity, maxY = -Infinity, i;
    for (i = 0; i < pts.length; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var sy = y + 0.5, xs = [];
      for (i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy))
          xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2)
        for (var x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) f.call(this, x, y, c);
    }
  };
  // ディザで半透明風に塗る（level 0〜16、座標は絶対位置で揃う）
  G.ditherRect = function (x, y, w, h, c, level, wrap) {
    var f = wrap ? this.setw : this.set;
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++)
      if (px.dith(x + i, y + j, level)) f.call(this, x + i, y + j, c);
  };
  // 楕円状に中心ほど濃いディザ（光だまり・暈）。maxLevel 0〜16
  G.glow = function (cx, cy, rx, ry, c, maxLevel, wrap) {
    var f = wrap ? this.setw : this.set;
    for (var y = Math.floor(-ry); y <= ry; y++)
      for (var x = Math.floor(-rx); x <= rx; x++) {
        var d = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry));
        if (d > 1) continue;
        var X = Math.round(cx) + x, Y = Math.round(cy) + y;
        if (px.dith(X, Y, (1 - d) * maxLevel)) f.call(this, X, Y, c);
      }
  };
  // 縦グラデ（色番号の配列を上→下に、境目はディザ）
  G.vgrad = function (x, y, w, h, colors) {
    var n = colors.length - 1;
    for (var j = 0; j < h; j++) {
      var t = n * j / Math.max(1, h - 1), k = Math.min(n - 1, Math.floor(t)), fr = t - k;
      if (n === 0) { k = 0; fr = 0; }
      for (var i = 0; i < w; i++) {
        var X = x + i, Y = y + j;
        this.set(X, Y, (n > 0 && px.dith(X, Y, fr * 16)) ? colors[k + 1] : colors[k]);
      }
    }
  };
  // 別の Grid を重ねる（0 は透過）
  G.blit = function (src, dx, dy, flipX, wrap) {
    var f = wrap ? this.setw : this.set;
    for (var y = 0; y < src.h; y++) for (var x = 0; x < src.w; x++) {
      var c = src.d[y * src.w + x];
      if (c) f.call(this, dx + (flipX ? src.w - 1 - x : x), dy + y, c);
    }
  };
  // 実体の外周に輪郭色を足す（diag=true で斜めも）
  G.outline = function (c, diag) {
    c = c == null ? 1 : c;
    var w = this.w, h = this.h, src = new Uint8Array(this.d);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (src[y * w + x]) continue;
      var hit = false;
      for (var j = -1; j <= 1 && !hit; j++) for (var i = -1; i <= 1; i++) {
        if (!diag && i && j) continue;
        var X = x + i, Y = y + j;
        if (X >= 0 && Y >= 0 && X < w && Y < h && src[Y * w + X] && src[Y * w + X] !== c) { hit = true; break; }
      }
      if (hit) this.d[y * w + x] = c;
    }
    return this;
  };
  G.replace = function (a, b) { for (var i = 0; i < this.d.length; i++) if (this.d[i] === a) this.d[i] = b; return this; };
  G.clone = function () { var g = new Grid(this.w, this.h); g.d.set(this.d); return g; };
  G.count = function () { var n = 0; for (var i = 0; i < this.d.length; i++) if (this.d[i]) n++; return n; };
  G.rows = function () { // デバッグ用: 0='.'、それ以外は36進1文字（36以上は'#'）
    var out = [];
    for (var y = 0; y < this.h; y++) {
      var s = '';
      for (var x = 0; x < this.w; x++) { var c = this.d[y * this.w + x]; s += c === 0 ? '.' : (c < 36 ? c.toString(36) : '#'); }
      out.push(s);
    }
    return out;
  };
  G.toCanvas = function (palette) { return px.toCanvas(this, palette); };
  px.Grid = Grid;
  px.grid = function (w, h) { return new Grid(w, h); };

  // ---------------------------------------------------------------------------
  // 変換
  // ---------------------------------------------------------------------------
  px.canvas = function (w, h) {
    if (typeof document === 'undefined') return null;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return c;
  };
  px.toCanvas = function (grid, palette) {
    palette = palette || px.PAL;
    var cv = px.canvas(grid.w, grid.h);
    if (!cv) return null;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(grid.w, grid.h), d = img.data;
    var lut = [];
    for (var i = 1; i < palette.length; i++) lut[i] = palette[i] ? hexRgb(palette[i]) : null;
    for (var p = 0; p < grid.d.length; p++) {
      var c = grid.d[p];
      if (!c || !lut[c]) continue;
      var rgb = lut[c], o = p * 4;
      d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    cv.grid = grid; // 元バッファ（マスク判定などに）
    return cv;
  };
  // rows: 文字列の配列（'.'や' '=0、それ以外は36進数1文字: '1'〜'9','a'〜'z'）か、数値配列の配列
  px.fromRows = function (rows) {
    var h = rows.length, w = 0, x, y;
    for (y = 0; y < h; y++) w = Math.max(w, rows[y].length);
    var g = new Grid(w, h);
    for (y = 0; y < h; y++) for (x = 0; x < rows[y].length; x++) {
      var v = rows[y][x];
      if (typeof v === 'string') v = (v === '.' || v === ' ') ? 0 : parseInt(v, 36);
      g.d[y * w + x] = v || 0;
    }
    return g;
  };
  px.make = function (rows, palette) { return px.toCanvas(px.fromRows(rows), palette); };
  px.scale = function (grid, k) {
    var g = new Grid(grid.w * k, grid.h * k);
    for (var y = 0; y < g.h; y++) for (var x = 0; x < g.w; x++) g.d[y * g.w + x] = grid.d[Math.floor(y / k) * grid.w + Math.floor(x / k)];
    return g;
  };
  px.flipX = function (grid) { var g = new Grid(grid.w, grid.h); g.blit(grid, 0, 0, true); return g; };

  // 横タイルを scrollX ぶんずらして画面幅 W に敷き詰める
  px.drawWrap = function (ctx, img, scrollX, y, W) {
    if (!img) return;
    W = W || AT.W || 320;
    var iw = img.width, x = -(((Math.floor(scrollX) % iw) + iw) % iw);
    for (; x < W; x += iw) ctx.drawImage(img, x, y || 0);
  };

  // ---------------------------------------------------------------------------
  // 主人公: 自転車に乗る人（右向き）24×24。groundY = 車輪の接地行(23)
  //   walk: ゆったり漕ぐ 4コマ / run: 前傾・マフラーがなびく 4コマ
  // ---------------------------------------------------------------------------
  var HW = 24, HH = 24;
  function heroGrid(mode, f) {
    var I = px.I, run = mode === 'run';
    var bike = new Grid(HW, HH), body = new Grid(HW, HH);
    var R = [5, 18], F = [18, 18], BB = [11, 19], seat = [8, 11], head = [16, 10];
    var crank = f * Math.PI / 2;
    var bob = run ? (f % 2) : 0;
    var hip = [8, 11 + bob];
    var shoulder = run ? [13, 6 + bob] : [10, 4];
    var hand = run ? [16, 9] : [16, 9];

    // --- 自転車（輪郭なし。線が細いので） ---
    [R, F].forEach(function (c) {
      bike.ring(c[0], c[1], 5, I.outline);
      bike.ring(c[0], c[1], 4, I.grayLt);
      var a0 = f * Math.PI / 4;
      for (var k = 0; k < 2; k++) {
        var a = a0 + k * Math.PI / 2;
        bike.line(c[0] - Math.cos(a) * 3, c[1] - Math.sin(a) * 3, c[0] + Math.cos(a) * 3, c[1] + Math.sin(a) * 3, I.gray);
      }
      bike.set(c[0], c[1], I.moon);
    });
    var fr = I.magenta;
    bike.line(R[0], R[1], BB[0], BB[1], fr);          // チェーンステー
    bike.line(R[0], R[1], seat[0] + 1, seat[1] + 1, fr); // シートステー
    bike.line(BB[0], BB[1], seat[0] + 1, seat[1] + 1, fr); // シートチューブ
    bike.line(seat[0] + 1, seat[1] + 1, head[0], head[1] + 1, fr); // トップチューブ
    bike.line(BB[0], BB[1], head[0], head[1] + 1, I.magentaDk); // ダウンチューブ
    bike.line(head[0], head[1], F[0], F[1], I.grayLt); // フォーク
    bike.line(head[0], head[1], head[0], 8, I.grayLt); // ステム
    bike.line(head[0] - 1, 8, head[0] + 1, 8, I.outline); // ハンドル
    bike.line(seat[0] - 1, seat[1], seat[0] + 2, seat[1], I.outline); // サドル
    bike.set(head[0] + 2, head[1], I.lampLt); // ライト

    // --- 脚（2リンクIK。膝は前へ） ---
    function leg(g, ang, cp, cs) {
      var P = [BB[0] + Math.cos(ang) * 3, BB[1] + Math.sin(ang) * 3];
      var L1 = 5.6, L2 = 5.6;
      var dx = P[0] - hip[0], dy = P[1] - hip[1], d = Math.min(Math.sqrt(dx * dx + dy * dy), L1 + L2 - 0.05);
      var th = Math.atan2(dy, dx), a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
      var K = [hip[0] + Math.cos(th - a) * L1, hip[1] + Math.sin(th - a) * L1];
      g.line(hip[0], hip[1], K[0], K[1], cp, 2);
      g.line(K[0], K[1], P[0], P[1], cp);
      g.line(P[0], P[1], P[0] + 1, P[1], cs); // 靴
      return P;
    }
    var far = new Grid(HW, HH);
    leg(far, crank + Math.PI, I.indigo, I.outline);
    // 奥の脚 → 自転車 → 手前の脚 → 胴
    var g = new Grid(HW, HH);
    g.blit(far, 0, 0);
    g.blit(bike, 0, 0);
    var P = leg(body, crank, I.pants, I.outline);
    body.line(BB[0], BB[1], P[0], P[1], I.grayLt); // クランク（手前）

    // 胴（上着）
    body.line(hip[0], hip[1], shoulder[0], shoulder[1], I.coat, 3);
    body.line(hip[0] + 1, hip[1] - 1, shoulder[0] + 1, shoulder[1], I.coatLt); // 背の月明かり側
    body.set(hip[0] - 1, hip[1] + 1, I.coatDk);
    // 腕
    body.line(shoulder[0] + 1, shoulder[1] + 1, hand[0], hand[1], I.coatDk, 1);
    body.set(hand[0], hand[1], I.skin);
    // 頭
    var hx = shoulder[0] + (run ? 2 : 1), hy = shoulder[1] - 3;
    body.disc(hx, hy, 2, I.skin);
    body.set(hx - 2, hy - 1, I.hair); body.line(hx - 2, hy - 2, hx + 1, hy - 2, I.hair); body.set(hx - 1, hy - 1, I.hair);
    body.set(hx - 2, hy, I.hair);
    body.set(hx + 1, hy - 1, I.outline); // 目
    body.set(hx + 2, hy + 1, I.skinDk);
    // マフラー（悪態のマゼンタ）。run ではなびく
    var nx = shoulder[0], ny = shoulder[1];
    body.line(nx - 1, ny, nx + 1, ny, I.magenta);
    if (run) {
      var w0 = [0, 1, 0, -1][f], w1 = [1, 0, -1, 0][f];
      body.path([[nx - 1, ny], [nx - 4, ny + w0], [nx - 7, ny - 1 + w1]], I.magenta);
      body.set(nx - 7, ny + w1, I.magentaDk);
      // 髪もなびく
      body.set(hx - 3, hy - 1 + (f % 2), I.hair);
    } else {
      body.line(nx - 1, ny + 1, nx - 2, ny + 3, I.magenta);
    }
    body.outline(I.outline);
    g.blit(body, 0, 0);
    return g;
  }

  px.hero = {
    w: HW, h: HH,
    grid: heroGrid, // (mode 'walk'|'run', frame 0..3) → Grid（node検証用）
    walk: null, run: null,
    build: function () {
      if (this.walk) return this;
      this.walk = []; this.run = [];
      for (var f = 0; f < 4; f++) {
        this.walk.push(px.toCanvas(heroGrid('walk', f)));
        this.run.push(px.toCanvas(heroGrid('run', f)));
      }
      return this;
    },
    // 漕ぐコマ番号。walk は一定、run は speed01 でケイデンスが上がる
    frame: function (mode, t, speed01) {
      var fps = mode === 'run' ? 10 + 22 * (speed01 || 0) : 7;
      return Math.floor(t * fps) % 4;
    },
    // x: 左端, groundY: 接地する y（車輪の下端の1行下）
    draw: function (ctx, x, groundY, mode, t, speed01) {
      this.build();
      var arr = mode === 'run' ? this.run : this.walk;
      var img = arr[this.frame(mode, t, speed01)];
      if (img) ctx.drawImage(img, Math.round(x), Math.round(groundY - HH));
    }
  };
})(window.AT);
