// art_obstacles.js — 疾走（刀で斬る逃走ランナー）の絵: 障害物 / 闇のさざ波 / 刀を持つ乗り手 / 無人の自転車 / 破片
// 依存: art_common.js（AT.px）を先に読み込むこと。判定ロジックは持たない（slash_engine.js 側）。
// 方針は art_r*.js と同じ: パレット番号の Grid に描き、初回 build() で canvas に焼き、以後は drawImage。
// 画面は 320×180 前提。x はすべて画面座標(px)、groundY は「接地する y（物体の最下行の1つ下）」= AT.px.hero.draw と同じ意味。
//
// ===== 公開 API（AT.ART.obstacles）=====
//   build()                                   … 全スプライトを焼く（初回の draw でも自動で呼ばれる）
//   KINDS                                     … ['a','b','c']
//   info(round, kind) → {name, w, h, hit:{x, y, w, h}}
//        w,h = スプライト寸法。hit = 当たり判定に使う矩形（スプライト左上からの相対。輪郭込みの実体の外接矩形）
//   drawObstacle(ctx, round, kind, x, groundY, opts)
//        x = スプライト左端。opts = { t: 秒(縁の光の明滅用), glow: 0〜1(間合いに入った強調), cut: null|0〜1(斬られてからの進行度) }
//        cut の推奨尺 0.6 秒（p = 経過/0.6）。p=1 で完全に消える。
//   drawDark(ctx, w, t, opts)                 … 闇のさざ波。w = 画面幅に対する割合 0〜1。0.33 に近づくほど濃く・縁が荒く。
//        opts = { danger: 0〜1 を直接指定したいとき（省略時 w/0.33） }
//   drawEngulf(ctx, p, t, w0)                 … 呑まれる①: 幅 w0 から急速に全面を覆う（p 0→1、推奨 0.6 秒）。p=1 で真っ黒。
//   drawRecede(ctx, p, t)                     … 呑まれる③: 全面の闇が左へサーっと引く（p 0→1、推奨 0.8 秒）。行ごとに遅れて筋状に引く。
//   drawRider(ctx, x, groundY, state, t, speed01, p, opts)
//        乗り手（自転車＋刀）。x は AT.px.hero.draw と同じ左端（24×24 の箱）。
//        state = 'run'(刀を後ろに流して走る) | 'ready'(構え) | 'slash'(一閃。p 0→1、推奨 0.25 秒) | 'stagger'(よろけ。p 0→1、推奨 0.5 秒)
//        speed01 = 0〜1（ペダルの速さ）。opts = { round:1〜3 または accent:'#hex', just:true(JUST の一閃は軌跡を大きく) }
//        'slash' のときは三日月の軌跡も一緒に描く（drawSlashTrail を内部で呼ぶ）。
//   drawSlashTrail(ctx, cx, cy, p, opts)      … 刀の軌跡（白〜アクセント色の三日月）。cx,cy = 弧の中心。opts = {accent, just, r}
//   drawEmptyBike(ctx, x, groundY, p, opts) → 現在の左端 x
//        誰も乗っていない自転車。p 0→1（推奨 3.5 秒）: 惰性で進む → 止まる → 傾いて倒れる。opts = { dist: 進む距離px(既定 64) }
//   burst(list, round, kind, x, groundY, grade, opts)  … 斬った物体の破片を list（呼び出し側が持つ配列）に追加。grade = 'JUST'|'GOOD'
//   updateParticles(list, dt, scrollV)        … 破片を進める（dt 秒、scrollV = 背景が左へ流れる速さ px/秒。破片も一緒に流れる）
//   drawParticles(ctx, list)                  … 破片を描く
//   drawFlash(ctx, k, color)                  … ヒットストップ時の白フラッシュ。k 0〜1（1 で最も白い）
//   HIT_REACH                                 … 参考値: 刀の軌跡が届く範囲（乗り手の左端 x からの相対 px）
window.AT = window.AT || {};
AT.ART = AT.ART || {};
(function (AT) {
  'use strict';
  var px = AT.px, I = px.I;
  var W = 320, H = 180;
  var PI = Math.PI;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(p) { return 1 - (1 - p) * (1 - p); }
  function easeIn(p) { return p * p; }
  function smooth(p) { return p * p * (3 - 2 * p); }
  var ACCENT_I = { 1: I.gogh, 2: I.fire, 3: I.exit };
  function accentHex(opts) {
    if (opts && opts.accent) return opts.accent;
    return px.PAL[ACCENT_I[(opts && opts.round) || 1] || I.magenta];
  }

  // =========================================================================
  // 1. 障害物（各世界 a/b/c）
  // =========================================================================
  var DEF = {
    1: {
      a: { name: '糸杉の若木', fn: cypress },
      b: { name: 'カフェの椅子', fn: chair },
      c: { name: '絵の具の缶', fn: paintCan }
    },
    2: {
      a: { name: '竹の柵', fn: bambooFence },
      b: { name: '倒れかけた旗指物', fn: banner },
      c: { name: '樽', fn: barrel }
    },
    3: {
      a: { name: '机', fn: desk },
      b: { name: '掃除用具入れ', fn: cleaningLocker },
      c: { name: '紙飛行機の束', fn: planePile }
    }
  };

  // --- R1 アルルの夜道（ゴッホ） ---
  function cypress() { // 炎のような糸杉の若木（地面に刺さっている）
    var g = px.grid(16, 26);
    g.rect(7, 21, 2, 5, I.brown);
    g.set(7, 25, I.brownLt);
    g.poly([[8, 0], [11, 5], [13, 11], [14, 16], [12, 22], [4, 22], [2, 16], [3, 11], [5, 5]], I.cyp);
    // うねる筆致（ゴッホの糸杉）
    var strokes = [
      [[6, 4], [8, 2], [9, 4]], [[4, 9], [6, 7], [8, 8], [10, 6]], [[5, 13], [7, 11], [9, 12], [11, 10]],
      [[4, 17], [6, 15], [8, 16], [11, 14]], [[5, 20], [7, 18], [9, 19], [12, 17]]
    ];
    strokes.forEach(function (s) { g.path(s, I.cypMd); });
    // 月明かり側（右）の明るい筆
    g.path([[10, 5], [11, 8]], I.cypLt); g.path([[12, 11], [12, 14]], I.cypLt);
    g.path([[12, 17], [11, 20]], I.cypLt); g.set(9, 1, I.cypLt);
    g.set(5, 11, I.cypMd); g.set(3, 15, I.cypMd);
    g.outline(I.outline);
    return g;
  }
  function chair() { // ゴッホ『椅子』風の黄色い椅子（い草の座面）
    var g = px.grid(14, 21);
    var Y = I.gogh, YD = I.goghDk, YL = I.goghLt;
    g.line(2, 1, 2, 20, YD); g.line(6, 1, 6, 11, YD);   // 背もたれの柱（奥→手前）
    g.line(1, 0, 7, 0, Y);                              // 笠木
    g.line(2, 4, 6, 4, Y); g.line(2, 7, 6, 7, Y);        // 背の横木
    g.rect(1, 11, 12, 2, YL);                            // 座面（い草）
    for (var x = 1; x < 13; x += 2) g.set(x, 12, Y);
    g.line(1, 13, 12, 13, YD);
    g.line(12, 13, 12, 20, Y); g.line(9, 13, 9, 20, YD); // 前脚
    g.line(4, 13, 4, 20, YD);
    g.line(2, 17, 12, 17, YD);                           // 貫
    g.set(1, 0, YL); g.set(2, 1, Y);
    g.outline(I.outline);
    return g;
  }
  function paintCan() { // 倒れて黄色をこぼす絵の具の缶＋刷毛
    var g = px.grid(17, 15);
    g.rect(2, 5, 9, 9, I.grayLt);
    g.line(2, 5, 2, 13, I.gray); g.line(10, 5, 10, 13, I.gray);
    g.rect(3, 8, 7, 3, I.vgBlue);                // ラベル（夜空の青）
    g.set(5, 9, I.goghLt); g.set(7, 9, I.gogh); g.set(6, 8, I.vgCyan);
    g.ellipse(6, 5, 4, 1, I.gray);
    g.line(4, 5, 8, 5, I.gogh);                  // 中の黄色
    g.line(9, 5, 11, 6, I.gogh); g.line(11, 6, 11, 11, I.gogh); g.set(12, 9, I.goghDk);
    g.rect(9, 13, 7, 1, I.gogh); g.set(16, 13, I.goghDk); g.set(12, 12, I.goghLt); // 地面の水たまり
    g.line(1, 0, 4, 4, I.brownLt);               // 刷毛の柄
    g.rect(4, 3, 2, 2, I.goghDk); g.set(5, 4, I.gogh);
    g.outline(I.outline);
    return g;
  }

  // --- R2 夜の合戦場 ---
  function bambooFence() {
    var g = px.grid(21, 23);
    var poles = [[1, 4], [6, 0], [11, 3], [16, 1]];
    poles.forEach(function (p, i) {
      var x = p[0], top = p[1];
      g.rect(x, top + 2, 3, 22 - top, I.cypMd);
      g.poly([[x, top + 3], [x + 3, top], [x + 3, top + 3]], I.cypMd); // 斜めに切った先端
      g.line(x, top + 3, x, 22, I.cypLt);                              // 左の照り
      g.set(x + 1, top + 2, I.cypLt);
      for (var y = top + 7 + i; y < 22; y += 6) g.line(x, y, x + 2, y, I.cyp); // 節
    });
    g.line(0, 9, 20, 10, I.brownLt); g.line(0, 16, 20, 16, I.brownLt);          // 縄
    g.set(4, 9, I.brown); g.set(9, 9, I.brown); g.set(14, 10, I.brown);
    g.set(9, 16, I.brown); g.set(14, 16, I.brown);
    g.outline(I.outline);
    return g;
  }
  function banner() { // 斜めに倒れかけた旗指物（朱地に白い紋）
    var g = px.grid(22, 25);
    var B = [3, 24], T = [16, 1];
    function at(u) { return [B[0] + (T[0] - B[0]) * u, B[1] + (T[1] - B[1]) * u]; }
    var a = at(0.62), b = at(0.96);
    var cloth = [[a[0], a[1]], [b[0], b[1]], [b[0] + 5, b[1] + 3], [a[0] + 5, a[1] + 3]];
    g.poly(cloth, I.red);
    // 裾のほつれ
    g.set(a[0] + 1, a[1] + 1, I.red); g.set(a[0] + 3, a[1] + 3, I.magentaDk); g.set(a[0] + 5, a[1] + 2, I.red);
    g.line(b[0] + 5, b[1] + 3, a[0] + 5, a[1] + 3, I.fire); // 篝火に照らされた縁
    var m = at(0.79);
    g.disc(m[0] + 3, m[1] + 1, 1, I.moon);                  // 紋
    g.line(B[0], B[1], T[0], T[1], I.brown, 2);              // 竿
    g.line(B[0] + 1, B[1], T[0] + 1, T[1], I.brownLt);
    g.line(T[0], T[1], T[0] + 4, T[1] + 2, I.brownLt);       // 上の横木
    g.outline(I.outline);
    return g;
  }
  function barrel() {
    var g = px.grid(16, 17);
    for (var y = 1; y < 17; y++) {
      var hw = 5 + Math.round(1.5 * Math.sin(PI * (y - 1) / 15));
      g.rect(8 - hw, y, hw * 2, 1, I.brown);
      g.set(8 - hw + 2, y, I.brownLt);
      g.set(8 + hw - 1, y, I.fire);                           // 篝火の照り返し（右）
      g.set(8 + hw - 2, y, I.lampDk);
    }
    g.ellipse(8, 1, 5, 1, I.brownLt);
    g.line(5, 1, 11, 1, I.brown);
    [4, 9, 14].forEach(function (y) {
      var hw = 5 + Math.round(1.5 * Math.sin(PI * (y - 1) / 15));
      g.line(8 - hw, y, 8 + hw - 1, y, I.gray);
      g.set(8 - hw + 2, y, I.grayLt);
    });
    g.outline(I.outline);
    return g;
  }

  // --- R3 夜の高校の廊下 ---
  function desk() { // 学校の机（天板・物入れ・鉄の脚）
    var g = px.grid(22, 19);
    g.rect(1, 4, 20, 2, I.brownLt);
    g.line(1, 4, 20, 4, I.lampLt);                // 天板の照り
    g.line(1, 5, 20, 5, I.brown);
    g.rect(3, 6, 16, 3, I.grayDk);                // 物入れ
    g.rect(5, 7, 4, 2, I.pale); g.set(6, 7, I.skyLt); // 置き忘れた教科書
    g.line(3, 6, 3, 18, I.grayLt); g.line(18, 6, 18, 18, I.gray);   // 脚
    g.line(4, 9, 4, 18, I.gray);
    g.line(3, 15, 18, 15, I.gray);                // 足掛け
    g.set(1, 4, I.exit); g.set(2, 4, I.exit);     // 非常灯の緑の照り
    g.outline(I.outline);
    return g;
  }
  function cleaningLocker() { // スチールの掃除用具入れ（モップの柄が飛び出す）
    var g = px.grid(14, 29);
    g.line(9, 0, 10, 5, I.brownLt); g.line(10, 0, 11, 5, I.brown);   // モップの柄
    g.rect(1, 4, 11, 25, I.gray);
    g.line(1, 4, 1, 28, I.grayLt);
    g.line(1, 4, 11, 4, I.grayLt);
    g.line(6, 5, 6, 28, I.grayDk);                 // 扉の合わせ目
    for (var y = 7; y <= 11; y += 2) { g.line(2, y, 4, y, I.grayDk); g.line(8, y, 10, y, I.grayDk); } // 通気口
    g.set(5, 16, I.moon); g.set(7, 16, I.grayLt);  // 取っ手
    g.line(2, 26, 11, 26, I.grayDk);
    g.set(2, 14, I.exit); g.set(2, 15, I.exit); g.set(2, 20, I.exit); // 非常灯の映り込み
    g.outline(I.outline);
    return g;
  }
  function planePile() { // 紙飛行機の束（積み重なった山）
    var g = px.grid(20, 13);
    function plane(x, y, dir, c) {
      if (dir > 0) { g.poly([[x, y], [x + 9, y + 2], [x, y + 4]], c); g.line(x, y + 2, x + 8, y + 2, I.grayLt); }
      else { g.poly([[x + 9, y], [x, y + 2], [x + 9, y + 4]], c); g.line(x + 1, y + 2, x + 9, y + 2, I.grayLt); }
    }
    plane(1, 8, 1, I.pale);
    plane(9, 8, -1, I.moon);
    plane(4, 5, 1, I.moon);
    plane(10, 4, -1, I.pale);
    plane(6, 1, 1, I.white);
    g.set(15, 3, I.exit);
    g.outline(I.outline);
    return g;
  }

  // ---- 斬れる状態 → 斬られた2分割、縁の光 ----
  var CUT_SLOPE = 0.38; // 切り口: 右下がり（刀は上→前下へ振り下ろす）
  var CUT_COS = Math.cos(Math.atan(CUT_SLOPE)), CUT_SIN = Math.sin(Math.atan(CUT_SLOPE));
  function prepare(def) {
    var g = def.fn(), w = g.w, h = g.h;
    var top = px.grid(w, h), bot = px.grid(w, h), eT = px.grid(w, h), eB = px.grid(w, h);
    var cx = w / 2, cy = h * 0.5;
    function isTop(x, y) { return y + 0.5 < cy + (x + 0.5 - cx) * CUT_SLOPE; }
    var minX = w, minY = h, maxX = -1, maxY = -1, topMaxY = 0, cols = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c = g.get(x, y);
      if (!c) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (c !== I.outline) cols.push(c);
      if (isTop(x, y)) {
        top.set(x, y, c); topMaxY = Math.max(topMaxY, y);
        if (g.get(x, y + 1) && !isTop(x, y + 1)) eT.set(x, y, I.moon);
      } else {
        bot.set(x, y, c);
        if (g.get(x, y - 1) && isTop(x, y - 1)) eB.set(x, y, I.moon);
      }
    }
    // 縁の光: 内側1px=月白、外側=アクセントのディザ（ラウンドごとに色を変える）
    var M = 3, rimIn = px.grid(w + M * 2, h + M * 2);
    rimIn.blit(g, M, M);
    var ring1 = rimIn.clone().outline(255, true);
    var rim = px.grid(w + M * 2, h + M * 2), rim2 = ring1.clone().outline(254, true);
    for (var i = 0; i < rim.d.length; i++) {
      var X = i % rim.w, Y = (i / rim.w) | 0;
      if (ring1.d[i] === 255 && !rimIn.d[i]) rim.d[i] = I.moon;
      else if (rim2.d[i] === 254 && px.dith(X, Y, 9)) rim.d[i] = 250; // 後でアクセントに置換
    }
    return {
      name: def.name, w: w, h: h, grid: g, top: top, bot: bot, eT: eT, eB: eB, rim: rim, M: M,
      topMaxY: topMaxY, colors: cols.length ? cols : [I.gray],
      hit: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    };
  }

  var OB = AT.ART.obstacles = {
    KINDS: ['a', 'b', 'c'],
    HIT_REACH: { from: 20, to: 48, just: [40, 46] }, // 乗り手左端からの相対px（三日月の軌跡が覆う範囲。判定値は slash_engine 側が正）
    data: null,
    build: function () {
      if (this.data) return this;
      var data = {};
      for (var r = 1; r <= 3; r++) {
        data[r] = {};
        for (var k in DEF[r]) {
          var o = prepare(DEF[r][k]);
          var rim = o.rim.clone().replace(250, ACCENT_I[r]);
          o.img = px.toCanvas(o.grid); o.imgTop = px.toCanvas(o.top); o.imgBot = px.toCanvas(o.bot);
          o.imgET = px.toCanvas(o.eT); o.imgEB = px.toCanvas(o.eB); o.imgRim = px.toCanvas(rim);
          data[r][k] = o;
        }
      }
      this.data = data;
      return this;
    },
    get: function (round, kind) { this.build(); return (this.data[round] || this.data[1])[kind] || this.data[1].a; },
    info: function (round, kind) {
      var o = this.get(round, kind);
      return { name: o.name, w: o.w, h: o.h, hit: { x: o.hit.x, y: o.hit.y, w: o.hit.w, h: o.hit.h } };
    },
    drawObstacle: function (ctx, round, kind, x, groundY, opts) {
      opts = opts || {};
      var o = this.get(round, kind), X = Math.round(x), Y = Math.round(groundY - o.h), t = opts.t || 0;
      var cut = opts.cut;
      if (cut == null) {
        if (opts.glow > 0 && o.imgRim) {
          ctx.globalAlpha = clamp(opts.glow, 0, 1) * (0.6 + 0.4 * Math.sin(t * 14));
          ctx.drawImage(o.imgRim, X - o.M, Y - o.M);
          ctx.globalAlpha = 1;
        }
        if (o.img) ctx.drawImage(o.img, X, Y);
        return;
      }
      var p = clamp(cut, 0, 1), e = easeOut(p);
      // 上半分: 切り口に沿って前下へ滑り、落ちる（地面より下には行かない）
      var slide = 10 * e;
      var dx = Math.round(slide * CUT_COS + 3 * p);
      var dy = slide * CUT_SIN - 1 + 18 * p * p;
      dy = Math.round(Math.min(dy, o.h - 1 - o.topMaxY));
      var bdx = -Math.round(2 * e); // 下半分は少し後ろへ
      var a = p < 0.65 ? 1 : Math.max(0, Math.ceil((1 - (p - 0.65) / 0.35) * 4) / 4); // 段階的に消える
      if (a <= 0) return;
      ctx.globalAlpha = a;
      if (o.imgBot) ctx.drawImage(o.imgBot, X + bdx, Y);
      if (o.imgTop) ctx.drawImage(o.imgTop, X + dx, Y + dy);
      var ea = clamp(1 - p / 0.45, 0, 1);
      if (ea > 0 && o.imgET) {
        ctx.globalAlpha = ea * a;
        ctx.drawImage(o.imgET, X + dx, Y + dy);
        ctx.drawImage(o.imgEB, X + bdx, Y);
      }
      ctx.globalAlpha = 1;
    }
  };

  // =========================================================================
  // 2. 闇のさざ波
  // =========================================================================
  var dark = null;
  function darkBuf() {
    if (dark) return dark;
    var c = px.canvas(W, H);
    if (!c) return null;
    var x = c.getContext('2d'), img = x.createImageData(W, H);
    dark = { c: c, ctx: x, img: img, u32: new Uint32Array(img.data.buffer) };
    return dark;
  }
  function u32(hex) { var v = px.hexRgb(hex); return ((255 << 24) | (v[2] << 16) | (v[1] << 8) | v[0]) >>> 0; }
  var DC = null;
  function darkColors() {
    if (DC) return DC;
    DC = {
      deep: u32('#020207'), out: u32(px.PAL[I.outline]), navy: u32(px.PAL[I.navy]),
      vio: u32(px.PAL[I.violet]), ind: u32(px.PAL[I.indigo]), mag: u32(px.PAL[I.magentaDk])
    };
    return DC;
  }
  function wave(y, t) {
    return 0.5 * Math.sin(y * 0.105 + t * 2.6) + 0.3 * Math.sin(y * 0.29 - t * 4.3) +
      0.35 * (Math.abs(Math.sin(y * 0.16 - t * 2.1)) - 0.5);
  }
  // edgeOf(y) → その行の闇の右端 x。k = 危険度 0〜1
  function paintDark(ctx, edgeOf, t, k) {
    var B = darkBuf();
    if (!B) return;
    var C = darkColors(), buf = B.u32;
    buf.fill(0);
    var tq = Math.floor(t * 14);
    var band = 3 + 5 * k, fr = 3 + 9 * k, any = false;
    for (var y = 0; y < H; y++) {
      var ex = edgeOf(y);
      if (ex <= 0) continue;
      any = true;
      var xmax = Math.min(W - 1, Math.floor(ex + fr)), row = y * W;
      for (var x = 0; x <= xmax; x++) {
        var d = ex - x, c;
        if (d > band) {
          // 内側: 深いほど不透明（危険度が低いときは背景がディザ越しに透ける）
          var lvl = 8 + 8 * k + (d - band) * 0.3;
          if (lvl < 16 && !px.dith(x, y, lvl)) continue;
          c = d > 40 ? C.deep : C.out;
          // 左から右へ寄せてくる波頭（さざ波）
          var ph = d * 0.2 + t * 3.0 + Math.sin(y * 0.13 + t) * 1.3;
          ph -= Math.floor(ph);
          if (ph < 0.11 && px.hash(x, y, 5) < 0.6 - d * 0.005) c = px.hash(x >> 1, y, 9) < 0.45 ? C.vio : C.navy;
          else if (px.hash(x, y, tq) < 0.025) c = C.navy;
        } else {
          // 縁: ざらついた粒（毎フレーム揺らぐ）
          var q = (d + fr) / (band + fr), r = px.hash(x, y, tq);
          if (r > q * q) continue;
          c = r < q * q * 0.55 ? C.out : r < q * q * 0.85 ? C.navy : C.vio;
          if (k > 0.75 && px.hash(x, y, tq + 77) < 0.06 * (k - 0.75) / 0.25) c = C.mag; // 危険時だけ、悪態の色が混じる
        }
        buf[row + x] = c;
      }
    }
    if (!any) return;
    B.ctx.putImageData(B.img, 0, 0);
    ctx.drawImage(B.c, 0, 0);
  }
  OB.drawDark = function (ctx, w, t, opts) {
    w = clamp(w || 0, 0, 1.3);
    if (w <= 0.001) return;
    var k = opts && opts.danger != null ? clamp(opts.danger, 0, 1) : clamp(w / 0.33, 0, 1);
    var base = w * W, fade = Math.min(1, w * 12);
    var amp = (2 + 5 * k) * fade, rough = (1 + 8 * k) * fade, tq = Math.floor(t * 14);
    paintDark(ctx, function (y) {
      return base + amp * wave(y, t) + rough * (px.hash(y, tq, 3) - 0.5);
    }, t, k);
  };
  OB.drawEngulf = function (ctx, p, t, w0) {
    p = clamp(p, 0, 1);
    var from = clamp(w0 == null ? 0.33 : w0, 0, 1) * W, to = W + 48;
    var base = from + (to - from) * easeIn(p), tq = Math.floor(t * 14);
    paintDark(ctx, function (y) {
      return base + 9 * wave(y, t * 1.6) + 12 * (px.hash(y, tq, 3) - 0.5) + 10 * p * Math.sin(y * 0.05 + t * 8);
    }, t, 1);
  };
  OB.drawRecede = function (ctx, p, t) {
    p = clamp(p, 0, 1);
    var full = W + 48, tq = Math.floor(t * 14);
    paintDark(ctx, function (y) {
      var ry = px.hash(y >> 1, 0, 41);                     // 2行ごとに遅れが違う → 筋状に引く
      var rp = clamp(p * 1.55 - ry * 0.55, 0, 1);
      var e = full * (1 - smooth(rp));
      if (e <= 0) return 0;
      return e + 4 * wave(y, t) * (1 - rp) + 6 * (px.hash(y, tq, 3) - 0.5) * (1 - rp);
    }, t, 1 - p * 0.6);
  };

  // =========================================================================
  // 3. 刀を持つ乗り手（AT.px.hero の run を土台に刀と腕を足す）
  // =========================================================================
  var RW = 52, RH = 42, OX = 14, OY = 16; // 合成用の大きめの箱。hero(24×24)を (OX,OY) に置く
  function sword(g, hx, hy, ang, len) {
    var dx = Math.cos(ang), dy = Math.sin(ang);
    g.line(hx - dx * 2, hy - dy * 2, hx, hy, I.hair);                   // 柄
    g.set(Math.round(hx + dx), Math.round(hy + dy), I.lamp);            // 鍔
    g.line(hx + dx * 2, hy + dy * 2, hx + dx * (len - 1), hy + dy * (len - 1), I.pale); // 刀身
    g.line(hx + dx * 3, hy + dy * 3, hx + dx * (len - 3), hy + dy * (len - 3), I.moon); // 刃の照り
    g.set(Math.round(hx + dx * len), Math.round(hy + dy * len), I.white); // 切っ先
  }
  function riderGrid(state, f, p) {
    var hero = px.hero.grid('run', f), g = px.grid(RW, RH);
    g.blit(hero, OX, OY);
    var bob = f % 2, S = [OX + 13, OY + 6 + bob], hand, ang, len = 12;
    if (state === 'ready') { hand = [OX + 14, OY + 3 + bob]; ang = -PI * 0.78; }
    else if (state === 'slash') {
      var s = smooth(clamp(p / 0.32, 0, 1));
      ang = -PI * 0.62 + (PI * 0.62 + 0.5) * s;
      hand = [OX + 15 + 5 * s, OY + 4 + bob + 6 * s];
      len = 13;
    } else if (state === 'stagger') {
      hand = [OX + 11, OY + 6 + bob];
      ang = -PI * 0.55 + Math.sin(p * 18) * 0.7 * (1 - p);
    } else { hand = [OX + 11, OY + 10 + bob]; ang = PI + 0.12; }
    var arm = px.grid(RW, RH);
    arm.line(S[0], S[1], hand[0], hand[1], I.coatDk);
    arm.set(hand[0], hand[1], I.skin);
    g.blit(arm, 0, 0);
    sword(g, hand[0], hand[1], ang, len);
    if (state === 'ready') { g.set(Math.round(hand[0] + Math.cos(ang) * 7), Math.round(hand[1] + Math.sin(ang) * 7), I.white); }
    if (state === 'stagger') {
      // 後ろへのけぞる（行ごとに左へずらす。回転しないので画素が崩れない）
      var lean = Math.sin(PI * clamp(p, 0, 1)) * 5, axle = OY + 18, out = px.grid(RW, RH);
      for (var y = 0; y < RH; y++) {
        var sh = y < axle ? Math.round(lean * (axle - y) / 18) : 0;
        for (var x = 0; x < RW; x++) { var c = g.d[y * RW + x]; if (c) out.set(x - sh, y, c); }
      }
      // 頭のまわりの星（衝突のくらくら）
      var hx = OX + 15 - Math.round(lean * 15 / 18), hy = OY + 2;
      for (var i = 0; i < 3; i++) {
        var a = p * 9 + i * 2.1;
        out.set(hx + Math.round(Math.cos(a) * 5), hy - 2 + Math.round(Math.sin(a) * 2), i === 0 ? I.goghLt : I.moon);
      }
      // 後輪の土ぼこり
      for (var j = 0; j < 6; j++) out.set(OX + 1 - j - Math.round(p * 6), OY + 22 - (j % 3), j % 2 ? I.grayLt : I.gray);
      g = out;
    }
    return g;
  }
  var riderCache = {};
  OB.riderGrid = riderGrid; // node 検証用
  OB.drawRider = function (ctx, x, groundY, state, t, speed01, p, opts) {
    opts = opts || {};
    state = state || 'run';
    p = clamp(p || 0, 0, 1);
    var f = px.hero.frame('run', t || 0, speed01 || 0);
    var steps = state === 'slash' ? 12 : state === 'stagger' ? 16 : 1;
    var q = steps > 1 ? Math.round(p * steps) : 0;
    var key = state + f + '_' + q, img = riderCache[key];
    if (img === undefined) img = riderCache[key] = px.toCanvas(riderGrid(state, f, q / steps));
    var X = Math.round(x), Y = Math.round(groundY - 24);
    if (state === 'stagger') { X -= Math.round(Math.sin(PI * p) * 4); Y += (Math.floor(p * 14) % 2) ? -1 : 0; }
    if (img) ctx.drawImage(img, X - OX, Y - OY);
    if (state === 'slash') OB.drawSlashTrail(ctx, X + 22, groundY - 15, p, { accent: accentHex(opts), just: opts.just });
  };

  // 三日月の軌跡: 上（やや後ろ）から前下へ。p 0→0.3 で伸び、その後は根元から消えて細る
  OB.drawSlashTrail = function (ctx, cx, cy, p, opts) {
    opts = opts || {};
    p = clamp(p, 0, 1);
    var just = !!opts.just, R = opts.r || (just ? 24 : 20), T = just ? 7 : 5;
    var a0 = -PI * 0.62, a1 = 0.62;
    var head = clamp(p / 0.3, 0, 1), tail = clamp((p - 0.22) / 0.78, 0, 1);
    if (head <= tail) return;
    var thick = T * Math.pow(1 - tail, 0.6);
    var acc = opts.accent || '#ff2e88', CX = Math.round(cx), CY = Math.round(cy);
    var cols = ['#ffffff', px.PAL[I.moon], px.PAL[I.pale], acc];
    for (var y = -R - 1; y <= R + 1; y++) for (var x = -R - 1; x <= R + 1; x++) {
      var r = Math.sqrt(x * x + y * y);
      if (r > R + 0.5 || r < R - thick - 1) continue;
      var a = Math.atan2(y, x), u = (a - a0) / (a1 - a0);
      if (u < tail || u > head) continue;
      var th = thick * Math.sin(PI * clamp((u - tail) / Math.max(0.001, head - tail) * 0.85 + 0.15, 0, 1)); // 三日月の太さ
      var inner = R - th;
      if (r < inner) continue;
      var depth = (R + 0.5 - r) / Math.max(1, th);              // 0=外縁 1=内縁
      var ci = depth < 0.3 ? 0 : depth < 0.55 ? 1 : depth < 0.8 ? 2 : 3;
      if (ci === 3 && px.dith(CX + x, CY + y, 6)) continue;     // 内側のアクセントは粗く
      ctx.fillStyle = cols[ci];
      ctx.fillRect(CX + x, CY + y, 1, 1);
    }
  };

  // =========================================================================
  // 4. 誰も乗っていない自転車（惰性 → 停止 → 倒れる）
  // =========================================================================
  // sy = 縦のつぶれ（1=直立、小さいほど手前に倒れて地面に寝る）, spinR/spinF = 車輪の回転角
  function emptyBikeGrid(sy, spinR, spinF) {
    var g = px.grid(24, 24);
    function P(x, y) { return [x, 23 - (23 - y) * sy]; }
    var R = P(5, 18), F = P(18, 18), BB = P(11, 19), seat = P(8, 11), head = P(16, 10), stem = P(16, 8);
    function wheel(c, spin) {
      for (var i = 0; i < 64; i++) {
        var a = i / 64 * PI * 2;
        g.set(Math.round(c[0] + Math.cos(a) * 5), Math.round(c[1] + Math.sin(a) * 5 * sy), I.outline);
      }
      for (i = 0; i < 48; i++) {
        a = i / 48 * PI * 2;
        g.set(Math.round(c[0] + Math.cos(a) * 4), Math.round(c[1] + Math.sin(a) * 4 * sy), I.grayLt);
      }
      for (var k = 0; k < 2; k++) {
        var b = spin + k * PI / 2;
        g.line(c[0] - Math.cos(b) * 3, c[1] - Math.sin(b) * 3 * sy, c[0] + Math.cos(b) * 3, c[1] + Math.sin(b) * 3 * sy, I.gray);
      }
      g.set(Math.round(c[0]), Math.round(c[1]), I.moon);
    }
    wheel(R, spinR); wheel(F, spinF);
    var fr = I.magenta;
    g.line(R[0], R[1], BB[0], BB[1], fr);
    g.line(R[0], R[1], seat[0] + 1, seat[1] + sy, fr);
    g.line(BB[0], BB[1], seat[0] + 1, seat[1] + sy, fr);
    g.line(seat[0] + 1, seat[1] + sy, head[0], head[1] + sy, fr);
    g.line(BB[0], BB[1], head[0], head[1] + sy, I.magentaDk);
    g.line(head[0], head[1], F[0], F[1], I.grayLt);
    g.line(head[0], head[1], stem[0], stem[1], I.grayLt);
    g.line(stem[0] - 1, stem[1], stem[0] + 1, stem[1], I.outline);
    g.line(seat[0] - 1, seat[1], seat[0] + 2, seat[1], I.outline);
    // ペダル（止まったまま）
    g.line(BB[0], BB[1], BB[0] + 2, BB[1] + Math.round(2 * sy), I.grayLt);
    if (sy > 0.5) g.set(head[0] + 2, head[1], I.lampLt); // ライト（倒れると消える）
    return g;
  }
  OB.emptyBikeGrid = emptyBikeGrid;
  OB.drawEmptyBike = function (ctx, x, groundY, p, opts) {
    p = clamp(p || 0, 0, 1);
    var dist = (opts && opts.dist) || 64;
    var STOP = 0.55, FALL = 0.85;
    // 惰性: 速度が線形に落ちる → 位置は easeOut
    var pos = dist * easeOut(clamp(p / STOP, 0, 1));
    var wob = 0, sy = 1;
    if (p > STOP * 0.6 && p < FALL) wob = Math.round(Math.sin(p * 60) * clamp((p - STOP * 0.6) / 0.25, 0, 1)); // ハンドルがふらつく
    if (p > STOP) {
      var fp = clamp((p - STOP) / (FALL - STOP), 0, 1);
      sy = Math.cos(easeIn(fp) * PI * 0.38);
      if (p > FALL) sy = 0.36 + 0.1 * Math.abs(Math.sin((p - FALL) / (1 - FALL) * PI * 2)) * (1 - (p - FALL) / (1 - FALL)); // 小さく跳ねる
      sy = Math.max(0.36, sy);
    }
    var spinR = pos / 5, spinF = pos / 5 + (p > STOP ? (p - STOP) * 14 * (1 - p) : 0); // 倒れても前輪だけ空回り
    var g = emptyBikeGrid(sy, spinR, spinF), img = px.toCanvas(g);
    var X = Math.round(x + pos), Y = Math.round(groundY - 24);
    if (img) ctx.drawImage(img, X + (sy > 0.6 ? wob : 0), Y);
    return X;
  };

  // =========================================================================
  // 5. 斬撃の破片・白フラッシュ
  // =========================================================================
  OB.burst = function (list, round, kind, x, groundY, grade, opts) {
    var o = OB.get(round, kind), just = grade === 'JUST';
    var rnd = px.rng(((opts && opts.seed) || (Math.random() * 1e9)) | 0);
    var n = just ? 26 : 11, cx = x + o.w / 2, cy = groundY - o.h / 2;
    for (var i = 0; i < n; i++) {
      var ang = -PI * 0.15 - rnd() * PI * 0.75 + (rnd() < 0.25 ? PI * 0.4 : 0); // 主に前上へ
      var sp = (just ? 70 : 40) + rnd() * (just ? 110 : 60);
      list.push({
        x: cx + (rnd() - 0.5) * o.w * 0.8, y: cy + (rnd() - 0.5) * o.h * 0.8,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        s: just ? 2 + (rnd() < 0.35 ? 1 : 0) : 1 + (rnd() < 0.3 ? 1 : 0),
        c: px.PAL[o.colors[Math.floor(rnd() * o.colors.length)]],
        life: 0.6 + rnd() * (just ? 0.7 : 0.4), gy: groundY, spark: false
      });
    }
    var ns = just ? 10 : 4; // 火花（白〜アクセント）
    for (i = 0; i < ns; i++) {
      ang = -PI * 0.5 + (rnd() - 0.5) * PI * 1.4; sp = 90 + rnd() * 120;
      list.push({ x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, s: 1,
        c: rnd() < 0.6 ? '#ffffff' : px.PAL[ACCENT_I[round] || I.magenta], life: 0.15 + rnd() * 0.2, gy: groundY, spark: true });
    }
    return list;
  };
  OB.updateParticles = function (list, dt, scrollV) {
    scrollV = scrollV || 0;
    for (var i = list.length - 1; i >= 0; i--) {
      var q = list[i];
      q.life -= dt;
      if (q.life <= 0) { list.splice(i, 1); continue; }
      if (!q.spark) q.vy += 300 * dt; else { q.vx *= 0.9; q.vy *= 0.9; }
      q.x += (q.vx - scrollV) * dt;
      q.y += q.vy * dt;
      if (q.y + q.s > q.gy) { q.y = q.gy - q.s; q.vy *= -0.3; q.vx *= 0.55; }
    }
  };
  OB.drawParticles = function (ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (q.life < 0.25 && (Math.floor(q.life * 30) % 2)) continue; // 消える直前は点滅
      ctx.fillStyle = q.c;
      if (q.spark) ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1), ctx.fillRect(Math.round(q.x - q.vx * 0.02), Math.round(q.y - q.vy * 0.02), 1, 1);
      else ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
  };
  OB.drawFlash = function (ctx, k, color) {
    k = clamp(k || 0, 0, 1);
    if (k <= 0) return;
    ctx.globalAlpha = 0.85 * k;
    ctx.fillStyle = color || '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  };
})(window.AT);
