// art_r1.js — ラウンド1の絵: 夜道(3層) / ハクチョウ / アルルの夜道異世界(4層)
// 依存: art_common.js（AT.px）を先に読み込むこと。
// すべて初回 build() でパレット番号バッファ→canvas に焼き、以後は drawImage のみ。
// API は draft/api_art_r1.md
window.AT = window.AT || {};
AT.ART = AT.ART || {};
(function (AT) {
  'use strict';
  var px = AT.px, I = px.I;
  var W = 320;
  var TAU = Math.PI * 2;
  var r1 = AT.ART.r1 = {
    GROUND_Y: 168,     // 主人公の接地 y（夜道もアルルも共通）
    NIGHT_FACTORS: [0, 0.35, 1],          // 空, 家並み, 道と街灯
    ARLES_FACTORS: [0.04, 0.15, 0.45, 1], // 星空, 村と丘, カフェ通りと糸杉, 石畳と糸杉
    cache: null
  };

  // =========================================================================
  // 夜道
  // =========================================================================
  function nightSky(frame) {
    var g = px.grid(W, 150), r = px.rng(11);
    g.vgrad(0, 0, W, 150, [I.navy, I.navy, I.indigo, I.violet]);
    // 月と暈
    var mx = 252, my = 34;
    g.glow(mx, my, 30, 30, I.blueDk, 9);
    g.glow(mx, my, 18, 18, I.blue, 7);
    g.disc(mx, my, 9, I.moon);
    g.set(mx - 3, my - 2, I.pale); g.set(mx - 2, my - 2, I.pale); g.set(mx + 2, my + 3, I.pale);
    g.set(mx + 3, my + 3, I.pale); g.set(mx + 4, my - 4, I.pale); g.set(mx - 4, my + 4, I.pale);
    // 薄雲（月にかかる）
    g.ditherRect(200, 40, 110, 2, I.indigo, 7);
    g.ditherRect(215, 44, 80, 1, I.indigo, 5);
    // 星（frame で一部が瞬く）
    for (var i = 0; i < 80; i++) {
      var x = Math.floor(r() * W), y = Math.floor(r() * 115), q = r(), tw = r();
      if (Math.abs(x - mx) < 22 && Math.abs(y - my) < 22) continue;
      if (frame === 1 && tw < 0.3) continue;
      var c = q < 0.15 ? I.moon : q < 0.55 ? I.pale : I.skyLt;
      g.set(x, y, c);
      if (q < 0.06 && !(frame === 1 && tw < 0.6)) { // 大きい星は十字
        g.set(x - 1, y, I.skyLt); g.set(x + 1, y, I.skyLt); g.set(x, y - 1, I.skyLt); g.set(x, y + 1, I.skyLt);
      }
    }
    return g;
  }

  function nightHouses() {
    var TW = 640, g = px.grid(TW, 150), r = px.rng(23), base = 148, x = 0;
    while (x < TW) {
      var w = 26 + Math.floor(r() * 34);
      if (TW - (x + w) < 26) w = TW - x;
      var kind = r(), j, k;
      if (kind < 0.18 && w > 40) {
        // 集合住宅
        var top = base - 58 - Math.floor(r() * 22);
        g.rect(x, top, w, base - top, I.navy);
        g.line(x, top, x + w - 1, top, I.indigo);
        g.line(x, top, x, base, I.grayDk);
        for (j = top + 5; j < base - 8; j += 9) {
          g.line(x + 1, j + 6, x + w - 2, j + 6, I.grayDk); // 外廊下
          for (k = x + 4; k + 4 < x + w - 2; k += 8) {
            var q = r();
            var wc = q < 0.25 ? I.lamp : q < 0.32 ? I.skyLt : q < 0.4 ? I.lampLt : I.grayDk;
            g.rect(k, j, 4, 4, wc);
            if (wc === I.lamp) g.set(k + 1, j + 1, I.lampLt);
          }
        }
      } else {
        // 一軒家
        var wallH = 18 + Math.floor(r() * 14), wt = base - wallH, roofH = 7 + Math.floor(r() * 9);
        var wall = r() < 0.5 ? I.grayDk : I.navy;
        g.rect(x + 1, wt, w - 2, wallH, wall);
        var peak = x + Math.floor(w / 2) + Math.floor((r() - 0.5) * 8);
        g.poly([[x - 1, wt + 1], [peak, wt - roofH], [x + w + 1, wt + 1]], I.outline);
        g.line(x - 1, wt, peak, wt - roofH, I.indigo); // 月明かりの稜線
        g.line(peak, wt - roofH, x + w, wt, I.violet);
        var nwin = 1 + Math.floor(r() * Math.min(3, w / 14));
        for (k = 0; k < nwin; k++) {
          var wx = x + 4 + Math.floor((w - 12) * (nwin === 1 ? 0.5 : k / (nwin - 1))), wy = wt + 4 + Math.floor(r() * 4);
          var lit = r();
          if (lit < 0.35) { g.rect(wx, wy, 5, 4, I.lamp); g.rect(wx + 1, wy + 1, 2, 2, I.lampLt); g.line(wx + 2, wy, wx + 2, wy + 3, I.lampDk); }
          else if (lit < 0.42) { g.rect(wx, wy, 5, 4, I.skyLt); g.set(wx + 1, wy + 1, I.moon); }
          else { g.rect(wx, wy, 5, 4, I.outline); g.line(wx, wy, wx + 4, wy, I.indigo); }
        }
        if (r() < 0.6) { // ブロック塀
          g.rect(x, base - 7, w, 7, I.gray);
          g.line(x, base - 7, x + w - 1, base - 7, I.grayLt);
          for (k = x; k < x + w; k += 6) g.line(k, base - 6, k, base - 1, I.grayDk);
          g.line(x, base - 4, x + w - 1, base - 4, I.grayDk);
        }
      }
      if (r() < 0.15 && w > 30) { // 自販機
        var vx = x + w - 13;
        g.glow(vx + 5, base - 6, 15, 9, I.blue, 7);
        g.rect(vx, base - 16, 10, 16, I.skyLt);
        g.rect(vx + 1, base - 15, 8, 6, I.moon);
        g.set(vx + 2, base - 13, I.lamp); g.set(vx + 4, base - 13, I.magenta); g.set(vx + 6, base - 13, I.coat);
        g.set(vx + 2, base - 11, I.red); g.set(vx + 4, base - 11, I.gogh); g.set(vx + 6, base - 11, I.coatLt);
        g.rect(vx + 3, base - 5, 4, 2, I.outline);
        g.line(vx, base - 16, vx + 9, base - 16, I.white);
      }
      x += w;
    }
    // 電柱と電線
    var poles = [100, 420];
    poles.forEach(function (p) {
      g.rect(p, 36, 2, base - 36, I.outline);
      g.line(p - 5, 44, p + 6, 44, I.outline);
      g.line(p - 3, 49, p + 4, 49, I.outline);
    });
    for (var pi = 0; pi < poles.length; pi++) {
      var a = poles[pi], b = poles[(pi + 1) % poles.length] + (pi + 1 === poles.length ? TW : 0);
      [[44, 9], [49, 12]].forEach(function (wv) {
        for (var xx = a; xx <= b; xx++) {
          var t = (xx - a) / (b - a);
          g.setw(xx, wv[0] + 1 + wv[1] * 4 * t * (1 - t), I.outline);
        }
      });
    }
    return g;
  }

  function nightRoad() {
    var TW = 640, g = px.grid(TW, 180), x, y, k;
    // 歩道
    for (y = 148; y < 160; y++) for (x = 0; x < TW; x++) {
      var h = px.hash(x, y, 5);
      g.set(x, y, h < 0.12 ? I.grayDk : h > 0.97 ? I.grayLt : I.gray);
    }
    for (x = 0; x < TW; x += 16) g.line(x, 149, x - 3, 159, I.grayDk);
    g.line(0, 148, TW - 1, 148, I.grayDk);
    g.line(0, 154, TW - 1, 154, I.grayDk);
    // 縁石
    g.line(0, 160, TW - 1, 160, I.grayLt);
    g.line(0, 161, TW - 1, 161, I.grayDk);
    // 車道
    for (y = 162; y < 180; y++) for (x = 0; x < TW; x++) {
      var h2 = px.hash(x, y, 9);
      g.set(x, y, h2 < 0.25 ? I.navy : h2 > 0.985 ? I.gray : I.grayDk);
    }
    for (x = 8; x < TW; x += 48) g.rect(x, 173, 22, 1, I.grayLt);
    // 街灯（160px おき）
    for (k = 0; k < 4; k++) {
      var p = 40 + k * 160, lx = p + 10;
      // 光だまり
      g.glow(lx, 156, 34, 10, I.lampDk, 10);
      g.glow(lx, 156, 20, 6, I.lamp, 8);
      g.glow(lx, 168, 36, 8, I.lampDk, 6);
      // 光の円錐（まばらなディザ）
      for (y = 64; y < 148; y++) {
        var tt = (y - 62) / 86, half = 3 + tt * 24, lvl = 2.5 * (1 - tt) + 0.6;
        for (x = Math.floor(lx - half); x <= lx + half; x++) if (px.dith(x, y, lvl) && px.hash(x, y, 3) < 0.6) g.set(x, y, I.lamp);
      }
      // 暈
      g.glow(lx, 62, 13, 11, I.lamp, 6);
      g.glow(lx, 62, 6, 5, I.lampLt, 9);
      // 柱
      g.rect(p, 62, 2, 87, I.outline);
      g.line(p + 1, 66, p + 1, 147, I.gray);
      g.path([[p, 62], [p + 2, 59], [p + 7, 58]], I.outline);
      g.rect(p + 6, 58, 8, 2, I.outline);
      g.rect(p + 7, 60, 6, 1, I.lampLt);
      g.rect(p - 1, 146, 4, 2, I.outline);
    }
    return g;
  }

  // =========================================================================
  // ハクチョウ（左向き。右上から主人公へ襲来）
  //   s=1: 32×24 / s=2: 64×48（羽の描き込みを増やした拡大版）
  //   f=0: 翼を上げる / f=1: 翼を下ろす（滑空2コマ）
  // =========================================================================
  function swanGrid(s, f) {
    var g = px.grid(32 * s, 24 * s);
    function P(arr) { return arr.map(function (p) { return [p[0] * s, p[1] * s]; }); }
    function L(x0, y0, x1, y1, c, th) { g.line(x0 * s, y0 * s, x1 * s, y1 * s, c, th || 1); }
    var up = f === 0;
    // 奥の翼
    g.poly(P(up ? [[17, 11], [23, 11], [30.5, 1.5], [26, 2]] : [[17, 12], [23, 12], [30.5, 20], [26, 21]]), I.pale);
    // 胴
    g.ellipse(18 * s, 13 * s, 8 * s, 4 * s, I.white);
    for (var y = Math.floor(15.2 * s); y < g.h; y++) for (var x = 0; x < g.w; x++) if (g.get(x, y) === I.white) g.set(x, y, I.pale);
    g.poly(P([[24, 11], [30, 12.5], [24, 15.5]]), I.white); // 尾
    // 首（S字）と頭
    L(11, 12, 8, 9, I.white, 2 * s);
    L(8, 9, 5, 8, I.white, 2 * s);
    g.ellipse(4 * s, 7.5 * s, 2.5 * s, 2 * s, I.white);
    if (s >= 2) L(10, 13, 7, 10.5, I.pale, 1); // 首の下側の影
    // くちばし（橙＋黒いこぶ）と目（悪態のマゼンタ）
    g.poly(P([[2.6, 6.6], [1, 9.2], [3.4, 9]]), I.lamp);
    g.rect(2.6 * s, 6.6 * s, s, s, I.outline);
    g.rect(4 * s, 6.8 * s, s, s, I.magenta);
    // 手前の翼
    var base = up ? [[13, 12], [22, 12]] : [[13, 12.5], [22, 12.5]];
    var tip = up ? [[19, 2], [28.5, 1]] : [[18, 21.5], [27.5, 22.5]];
    g.poly(P([base[0], base[1], tip[1], tip[0]]), I.white);
    var nf = s >= 2 ? 6 : 3;
    for (var k = 1; k <= nf; k++) {
      var t = k / (nf + 1);
      var bx = base[0][0] + (base[1][0] - base[0][0]) * t, by = base[0][1] + (base[1][1] - base[0][1]) * t;
      var tx = tip[0][0] + (tip[1][0] - tip[0][0]) * t, ty = tip[0][1] + (tip[1][1] - tip[0][1]) * t;
      var mx = bx + (tx - bx) * 0.35, my = by + (ty - by) * 0.35;
      L(mx, my, tx, ty, I.pale);
    }
    // 風切羽の先をギザギザに
    for (k = 0; k <= nf + 1; k++) {
      var tt = k / (nf + 1);
      var ex = tip[0][0] + (tip[1][0] - tip[0][0]) * tt, ey = tip[0][1] + (tip[1][1] - tip[0][1]) * tt;
      g.rect(ex * s, (ey + (up ? 1 : -1)) * s, s, s, I.pale);
    }
    g.outline(I.outline);
    if (s >= 2) g.outline(I.outline); // 拡大版は輪郭を太く
    return g;
  }
  r1.swanGrid = swanGrid;

  // =========================================================================
  // アルルの夜道（ゴッホ風: 渦巻く星空・糸杉・黄色いカフェ）
  // =========================================================================
  var SKY_H = 130, SKY_FRAMES = 8;
  var VORT = [{ x: 70, y: 50, r: 34, s: 1 }, { x: 168, y: 36, r: 26, s: -1 }, { x: 232, y: 74, r: 20, s: 1 }];
  var STARS = [{ x: 28, y: 18, r: 3 }, { x: 118, y: 14, r: 2 }, { x: 205, y: 22, r: 3 }, { x: 112, y: 86, r: 2 },
    { x: 300, y: 76, r: 2 }, { x: 18, y: 98, r: 2 }, { x: 160, y: 100, r: 2 }, { x: 262, y: 112, r: 1 }, { x: 70, y: 110, r: 1 }];
  var MOON = { x: 284, y: 26, r: 8 };
  var RAMP_BASE = [I.vgBlueDk, I.vgBlueDk, I.vgBlue, I.vgBlue, I.vgBlueLt, I.vgBlue, I.vgBlue, I.vgBlueDk];
  var RAMP_LOW = [I.vgBlue, I.vgBlueLt, I.vgBlueLt, I.vgCyan, I.vgBlueLt, I.vgBlue, I.vgBlueLt, I.vgBlue];
  var RAMP_VORT = [I.vgBlue, I.vgBlueLt, I.vgCyan, I.pale, I.vgCyan, I.vgBlueLt, I.vgBlue, I.vgBlueLt];
  var RAMP_STAR = [I.goghDk, I.gogh, I.goghLt, I.gogh, I.goghDk, I.vgCyan, I.goghLt, I.gogh];

  function wrapDx(dx) { if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; return dx; }
  function frac(v) { return ((v % 1) + 1) % 1; }

  var skyStrokes = null;
  function buildSkyStrokes() {
    var r = px.rng(1889), out = [];
    for (var gy = 0; gy < SKY_H; gy += 3) for (var gx = 0; gx < W; gx += 3) {
      var x = gx + r() * 3, y = gy + r() * 3;
      var vx = 1, vy = 0.35 * Math.sin(TAU * x / W * 3 + y / 14), dom = null, bw = 0, ddx = 0, ddy = 0, dd = 0;
      for (var i = 0; i < VORT.length; i++) {
        var v = VORT[i], dx = wrapDx(x - v.x), dy = y - v.y, d = Math.sqrt(dx * dx + dy * dy), R = v.r * 1.7;
        if (d < R && d > 0.01) {
          var w = (1 - d / R) * 3.2;
          vx += -dy / d * v.s * w; vy += dx / d * v.s * w;
          if (w > bw) { bw = w; dom = v; ddx = dx; ddy = dy; dd = d; }
        }
      }
      var a = Math.atan2(vy, vx), ramp, ph;
      if (dom && bw > 0.5) {
        ramp = RAMP_VORT;
        ph = frac(-dom.s * Math.atan2(ddy, ddx) / TAU * 2 + dd / 11);
        if (dd > dom.r * 1.1 && r() < 0.5) ramp = RAMP_BASE;
      } else {
        ramp = y > 92 ? RAMP_LOW : RAMP_BASE;
        ph = frac(x / W * 6 - y / 30);
      }
      out.push({ x: x, y: y, dx: Math.cos(a), dy: Math.sin(a), len: 3 + (r() < 0.5 ? 1 : 0), ramp: ramp, ph: ph });
    }
    return out;
  }

  function arlesSky(k) {
    if (!skyStrokes) skyStrokes = buildSkyStrokes();
    var g = px.grid(W, SKY_H), i, j;
    g.vgrad(0, 0, W, SKY_H, [I.vgBlueDk, I.vgBlueDk, I.vgBlue, I.vgBlueLt]);
    for (i = 0; i < skyStrokes.length; i++) {
      var s = skyStrokes[i], c = s.ramp[(Math.floor(s.ph * 8) + k) % 8];
      for (j = 0; j < s.len; j++) g.setw(s.x + s.dx * j, s.y + s.dy * j, c);
    }
    // 星: 同心円の筆致（色がめぐって瞬く）
    function halo(cx, cy, r0, n, shift) {
      for (var ri = 0; ri < n; ri++) {
        var rr = r0 + ri, m = Math.ceil(rr * 6.5), col = RAMP_STAR[(ri + k + shift) % 8];
        for (var q = 0; q < m; q++) {
          if ((q + ri * 2) % 3 === 0) continue;
          var a = q / m * TAU;
          g.setw(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, col);
        }
      }
    }
    STARS.forEach(function (st, si) {
      halo(st.x, st.y, st.r + 1, st.r + 2, si);
      g.disc(st.x, st.y, st.r, I.gogh, true);
      g.setw(st.x, st.y, I.goghLt);
      if (st.r >= 2) { g.setw(st.x - 1, st.y, I.goghLt); g.setw(st.x, st.y - 1, I.white); }
    });
    // 三日月
    halo(MOON.x, MOON.y, MOON.r + 2, 6, 3);
    for (var yy = -MOON.r; yy <= MOON.r; yy++) for (var xx = -MOON.r; xx <= MOON.r; xx++) {
      var inA = xx * xx + yy * yy <= (MOON.r + 0.4) * (MOON.r + 0.4);
      var bx = xx + 4, by = yy + 3, inB = bx * bx + by * by <= (MOON.r - 0.5) * (MOON.r - 0.5);
      if (inA && !inB) g.setw(MOON.x + xx, MOON.y + yy, (xx + yy < -6) ? I.goghLt : I.gogh);
      else if (inA) g.setw(MOON.x + xx, MOON.y + yy, I.goghDk);
    }
    return g;
  }

  // 糸杉: 炎のようにねじれる縦長のシルエット＋上向きの筆致
  function cypressGrid(h, hw, seed) {
    var r = px.rng(seed), gw = hw * 2 + 10, g = px.grid(gw, h + 2), cx = gw / 2, y, x, i;
    var widths = [];
    for (y = 0; y < h; y++) {
      var t = y / h;
      var w = hw * Math.pow(Math.sin(Math.min(1, t * 1.25) * Math.PI / 2), 1.1) + Math.sin(y * 0.45 + seed) * 0.9;
      var sway = Math.sin(t * 5 + seed) * 1.6 * (1 - t);
      widths.push([cx + sway, Math.max(0.5, w)]);
      for (x = Math.floor(-w); x <= w; x++) g.set(cx + sway + x, y, I.cyp);
    }
    var n = Math.floor(h * hw * 0.7);
    for (i = 0; i < n; i++) {
      var yy = 2 + Math.floor(r() * (h - 3)), wc = widths[yy], ox = (r() * 2 - 1) * wc[1] * 0.9;
      var tilt = (ox > 0 ? -0.45 : 0.45) + (r() - 0.5) * 0.4, q = r();
      var col = (ox > wc[1] * 0.25 && q < 0.55) ? I.cypLt : q < 0.6 ? I.cypMd : q < 0.85 ? I.cyp : I.vgBlueDk;
      var len = 3 + Math.floor(r() * 3);
      for (var j = 0; j < len; j++) {
        var X = wc[0] + ox + tilt * j, Y = yy - j;
        if (g.get(X, Y)) g.set(X, Y, col);
      }
    }
    g.outline(I.outline);
    return g;
  }

  function arlesVillage() {
    var TW = 640, g = px.grid(TW, 150), r = px.rng(53), x, y;
    function top(x) { return 112 + 5 * Math.sin(TAU * x / TW * 3) + 4 * Math.sin(TAU * x / TW * 7 + 1); }
    for (x = 0; x < TW; x++) {
      var t0 = Math.round(top(x));
      for (y = t0; y < 150; y++) g.set(x, y, y < t0 + 2 ? I.vgBlue : I.vgBlueDk);
    }
    for (var i = 0; i < 700; i++) { // 丘の筆致
      var sx = r() * TW, sy = top(sx) + 3 + r() * 30;
      var c = r() < 0.5 ? I.vgBlue : r() < 0.5 ? I.blueDk : I.cypMd;
      for (var j = 0; j < 4; j++) g.setw(sx + j, sy + Math.sin((sx + j) / 9), c);
    }
    // 小さな家々（丘の上）
    for (x = 10; x < TW - 10; x += 14 + Math.floor(r() * 18)) {
      var hw = 6 + Math.floor(r() * 6), hh = 4 + Math.floor(r() * 5), b = Math.round(top(x)) + 3 + Math.floor(r() * 6);
      g.rect(x, b - hh, hw, hh + 2, r() < 0.5 ? I.blueDk : I.violet);
      g.poly([[x - 1, b - hh], [x + hw / 2, b - hh - 3], [x + hw + 1, b - hh]], I.outline);
      if (r() < 0.6) g.set(x + 2, b - hh + 2, I.gogh);
      if (r() < 0.4) g.set(x + hw - 2, b - hh + 2, I.goghDk);
    }
    // 教会の尖塔
    var cx = 430, cb = Math.round(top(cx)) + 4;
    g.rect(cx - 6, cb - 18, 12, 20, I.blueDk);
    g.rect(cx - 3, cb - 34, 6, 18, I.blueDk);
    g.poly([[cx - 4, cb - 34], [cx, cb - 56], [cx + 4, cb - 34]], I.outline);
    g.line(cx, cb - 56, cx + 3, cb - 36, I.vgBlue);
    g.set(cx, cb - 28, I.gogh); g.set(cx - 3, cb - 10, I.goghDk); g.set(cx + 2, cb - 10, I.goghDk);
    return g;
  }

  function arlesStreet() {
    var TW = 640, g = px.grid(TW, 150), r = px.rng(77), base = 147, x, y, i;
    function house(x0, w, top, wallC, strokeC, seed) {
      var rr = px.rng(seed);
      g.rect(x0, top, w, base - top + 1, wallC);
      for (i = 0; i < w * (base - top) / 10; i++) { // 壁の筆致（縦）
        var sx = x0 + rr() * w, sy = top + rr() * (base - top);
        g.line(sx, sy, sx, sy + 2, strokeC);
      }
      g.rect(x0 - 2, top - 3, w + 4, 3, I.outline);
      g.line(x0 - 2, top - 3, x0 + w + 1, top - 3, I.brownLt); // 瓦の縁
      for (var wy = top + 6; wy < base - 12; wy += 14) for (var wx = x0 + 4; wx + 6 < x0 + w; wx += 12) {
        var lit = rr() < 0.55;
        g.rect(wx, wy, 6, 8, lit ? I.gogh : I.outline);
        if (lit) { g.rect(wx + 1, wy + 1, 2, 3, I.goghLt); g.line(wx + 3, wy, wx + 3, wy + 7, I.goghDk); }
        g.rect(wx - 2, wy, 2, 8, I.cypMd); g.rect(wx + 6, wy, 2, 8, I.cypMd); // 緑の鎧戸
      }
      g.rect(x0 + Math.floor(w / 2) - 3, base - 12, 7, 13, I.brown); // 戸口
      g.line(x0 + Math.floor(w / 2) - 3, base - 12, x0 + Math.floor(w / 2) + 3, base - 12, I.outline);
    }
    house(0, 48, 72, I.violet, I.vgBlue, 1);
    // --- 黄色いカフェ（夜のカフェテラス風） ---
    var c0 = 62, c1 = 212, ct = 56;
    g.rect(c0, ct, c1 - c0, base - ct + 1, I.goghDk);
    for (i = 0; i < 520; i++) {
      var sx = c0 + r() * (c1 - c0), sy = ct + r() * (base - ct);
      g.line(sx, sy, sx + (r() - 0.5) * 2, sy + 2, r() < 0.6 ? I.gogh : I.lampDk);
    }
    g.rect(c0 - 2, ct - 3, c1 - c0 + 4, 3, I.outline);
    for (x = c0 + 6; x + 8 < c1; x += 16) { // 2階の窓
      g.rect(x, ct + 7, 7, 9, I.outline); g.rect(x + 1, ct + 8, 2, 3, I.lampDk);
      g.rect(x, ct + 22, 7, 9, I.lamp); g.rect(x + 1, ct + 23, 2, 3, I.goghLt);
    }
    // 光の店内（ひさしの下）
    g.rect(c0, 104, c1 - c0, base - 104 + 1, I.goghLt);
    for (i = 0; i < 260; i++) { var ix = c0 + r() * (c1 - c0), iy = 105 + r() * 40; g.line(ix, iy, ix, iy + 2, r() < 0.5 ? I.gogh : I.lampLt); }
    for (x = c0 + 10; x < c1 - 10; x += 24) { g.rect(x, 110, 3, 26, I.lampDk); } // 柱と窓枠
    g.rect(c0 + 70, 112, 10, 35, I.brown); g.rect(c0 + 71, 113, 8, 12, I.lamp); // 入口
    // ひさし（大きな黄色の日よけ）
    g.poly([[c0 - 4, 90], [c1 + 4, 90], [c1 + 12, 104], [c0 - 10, 104]], I.gogh);
    for (x = c0 - 8; x < c1 + 10; x += 5) g.line(x, 92, x - 2, 103, I.goghLt);
    for (x = c0 - 10; x < c1 + 12; x += 4) { g.set(x, 104, I.goghDk); g.set(x + 1, 105, I.goghDk); g.set(x + 2, 104, I.goghDk); }
    g.line(c0 - 4, 90, c1 + 4, 90, I.goghDk);
    g.glow(140, 108, 70, 16, I.goghLt, 7); // ひさし下の光
    // テラスの床（黄色い光だまり）
    g.poly([[c0 - 14, 136], [c1 + 16, 136], [c1 + 30, 148], [c0 - 26, 148]], I.gogh);
    for (i = 0; i < 300; i++) { var fx = c0 - 20 + r() * (c1 - c0 + 46), fy = 137 + r() * 11; g.line(fx, fy, fx + 3, fy, r() < 0.5 ? I.goghDk : I.goghLt); }
    // テーブルと椅子
    for (x = c0 + 4; x < c1 + 10; x += 28) {
      g.ellipse(x + 6, 131, 4, 1, I.white); g.line(x + 6, 132, x + 6, 139, I.outline); g.line(x + 4, 140, x + 8, 140, I.outline);
      g.line(x - 1, 133, x - 1, 141, I.brownLt); g.line(x - 1, 133, x + 1, 133, I.brownLt); g.line(x + 1, 137, x + 1, 141, I.brownLt);
      g.line(x + 13, 133, x + 13, 141, I.brownLt); g.line(x + 11, 133, x + 13, 133, I.brownLt); g.line(x + 11, 137, x + 11, 141, I.brownLt);
    }
    // 壁のガス灯
    g.glow(222, 82, 14, 12, I.goghLt, 7);
    g.line(214, 84, 220, 84, I.outline); g.rect(219, 78, 5, 6, I.outline); g.rect(220, 79, 3, 4, I.goghLt);
    // 他の家と糸杉
    house(262, 70, 66, I.vgBlue, I.vgBlueLt, 2);
    house(344, 64, 78, I.violet, I.blueDk, 3);
    house(470, 92, 50, I.vgBlueDk, I.vgBlue, 4);
    g.blit(cypressGrid(96, 9, 7), 236, base - 96);
    g.blit(cypressGrid(72, 7, 11), 420, base - 72);
    g.blit(cypressGrid(108, 10, 13), 572, base - 108);
    return g;
  }

  function arlesRoad() {
    var TW = 640, g = px.grid(TW, 180), r = px.rng(91), x, y;
    g.rect(0, 148, TW, 32, I.violet);
    // 石畳: 奥ほど詰まった行
    var rows = [148, 151, 154, 158, 162, 167, 173, 180];
    for (var ri = 0; ri + 1 < rows.length; ri++) {
      var y0 = rows[ri], hgt = rows[ri + 1] - rows[ri], sw = 4 + ri * 1.6, off = (ri % 2) * sw / 2;
      for (x = -off; x < TW; x += sw) {
        var cxs = x + sw / 2, warm = Math.abs(wrapDx640(cxs - 140)) < 70 + ri * 6 || Math.abs(wrapDx640(cxs - 460)) < 40;
        var q = r();
        var c = warm ? (q < 0.45 ? I.goghDk : q < 0.7 ? I.gogh : I.lampDk) : (q < 0.35 ? I.vgBlueDk : q < 0.6 ? I.blueDk : q < 0.85 ? I.vgBlue : I.violet);
        var rx = Math.max(1, sw / 2 - 1), ry = Math.max(0.6, hgt / 2 - 0.6);
        g.ellipse(cxs, y0 + hgt / 2, rx, ry, c, true);
        g.setw(cxs - 1, y0 + 1, warm ? I.goghLt : I.vgBlueLt);
      }
    }
    g.line(0, 148, TW - 1, 148, I.outline);
    // 道端の糸杉（主人公の背後）
    var cyp = cypressGrid(118, 11, 21);
    g.blit(cyp, 300, 150 - 118, false, true);
    var cyp2 = cypressGrid(84, 8, 29);
    g.blit(cyp2, 40, 150 - 84, false, true);
    return g;
  }
  function wrapDx640(dx) { if (dx > 320) dx -= 640; if (dx < -320) dx += 640; return dx; }

  // =========================================================================
  // build / draw
  // =========================================================================
  // 全バッファを生成（canvas なしでも動く。node 検証用）
  r1.grids = function () {
    var o = { nightSky: [nightSky(0), nightSky(1)], nightHouses: nightHouses(), nightRoad: nightRoad(),
      swan: [swanGrid(1, 0), swanGrid(1, 1)], swanBig: [swanGrid(2, 0), swanGrid(2, 1)],
      arlesSky: [], arlesVillage: arlesVillage(), arlesStreet: arlesStreet(), arlesRoad: arlesRoad() };
    for (var k = 0; k < SKY_FRAMES; k++) o.arlesSky.push(arlesSky(k));
    return o;
  };
  r1.build = function () {
    if (r1.cache) return r1.cache;
    var g = r1.grids(), c = {};
    Object.keys(g).forEach(function (k) {
      c[k] = Array.isArray(g[k]) ? g[k].map(function (x) { return px.toCanvas(x); }) : px.toCanvas(g[k]);
    });
    px.hero.build();
    r1.cache = c;
    return c;
  };

  // 夜道。scrollX = 進んだ距離(px、前景基準)。t = 秒
  r1.drawNight = function (ctx, scrollX, t) {
    var c = r1.build(), f = r1.NIGHT_FACTORS;
    ctx.drawImage(c.nightSky[Math.floor((t || 0) * 1.5) % 2], 0, 0);
    px.drawWrap(ctx, c.nightHouses, scrollX * f[1], 0);
    px.drawWrap(ctx, c.nightRoad, scrollX * f[2], 0);
  };

  // アルル。speed01 で星空の渦が速く回る
  r1.drawArles = function (ctx, scrollX, t, speed01) {
    var c = r1.build(), f = r1.ARLES_FACTORS, sp = speed01 || 0;
    t = t || 0;
    var k = Math.floor(t * (4 + 14 * sp)) % SKY_FRAMES;
    px.drawWrap(ctx, c.arlesSky[k], scrollX * f[0] + t * 3, 0);
    px.drawWrap(ctx, c.arlesVillage, scrollX * f[1], 0);
    px.drawWrap(ctx, c.arlesStreet, scrollX * f[2], 0);
    px.drawWrap(ctx, c.arlesRoad, scrollX * f[3], 0);
  };

  // ハクチョウ単体（x,y = 左上）。big=true で 64×48
  r1.drawSwan = function (ctx, x, y, t, big) {
    var c = r1.build(), arr = big ? c.swanBig : c.swan, img = arr[Math.floor((t || 0) * 5) % 2];
    if (img) ctx.drawImage(img, Math.round(x), Math.round(y));
  };

  // 襲来: p=0 で画面右上の外、p=1 で (tx,ty) に中心が来る。後半は拡大版に切替
  r1.drawSwanAttack = function (ctx, p, t, tx, ty) {
    var c = r1.build();
    p = Math.max(0, Math.min(1, p));
    var e = p * p * (3 - 2 * p) * 0.4 + p * p * 0.6;
    var sx = W + 24, sy = -28;
    var X = sx + (tx - sx) * e, Y = sy + (ty - sy) * e + Math.sin((t || 0) * 9) * 2 * (1 - p);
    var big = p > 0.5, f = Math.floor((t || 0) * (big ? 10 : 6)) % 2;
    var img = (big ? c.swanBig : c.swan)[f];
    if (img) ctx.drawImage(img, Math.round(X - img.width / 2), Math.round(Y - img.height / 2));
    return { x: X, y: Y, big: big };
  };
})(window.AT);
