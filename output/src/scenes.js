// scenes: シーン状態機械（統合版。2026-10-30 疾走パート刷新）。
// 流れ: title → walk → attack → recall → warp → run → flash → (次ラウンド walk / ending) → title
//                                                  run → swallow（呑まれる）→ gameover（専用結末）→ title
// 絵は AT.ART.r1/r2/r3（art_r*.js）・AT.ART.obstacles（art_obstacles.js）・AT.px.hero（art_common.js）、
// 音は AT.audio（録音MP3。audio_engine.js）、疾走の判定は AT.slash（slash_engine.js）。
// 各シーン: enter() / exit() / update(dt, realDt) / draw(ctx) / hit()
//   dt は timeScale 適用後（回顧のスロー中は 0.05 倍）、realDt は実時間。
(function (AT) {
  var W = AT.W, H = AT.H;
  var cur = null, curName = '', t = 0;
  var T = 0;            // 起動からの実時間(秒)。星の瞬き等
  var guard = 0;        // 入力誤爆防止(秒)
  var lastCtx = null;
  var HERO_X = 64;      // 帰り道の主人公(24×24)の左端
  var scroll = 0;       // 前景の進んだ距離(px)
  var walkT = 0;        // 帰り道〜回顧で使う絵の時刻（回顧ではスローで進む）
  var audioUnlocked = false;

  var S = AT.slash, SC = AT.slash.config, OB = AT.ART.obstacles;
  var DEFAULT_DURATION = SC.duration;   // 逃げ切りは曲の時間で決めるので、疾走中だけ engine の duration を外す
  var RIDER_X = SC.bikeX - 17;          // 疾走の乗り手(24×24)の左端。前輪の先(左端+23)が engine の衝突線 bikeX+bodyX(=116) と重なる
  var CUT_DUR = 0.6;                    // 斬られた障害物が崩れる尺（art_obstacles 推奨）

  function round() { return AT.ROUNDS[AT.state.round]; }
  function rid(i) { return AT.ROUNDS[i == null ? AT.state.round : i].id; }
  function audio() { return AT.audio || {}; }
  function sfx(name, opts) { try { if (AT.audio && AT.audio.sfx) AT.audio.sfx(name, opts); } catch (e) {} }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(p) { return p * p * (3 - 2 * p); }
  function setFilter(f) { if (lastCtx) lastCtx.canvas.style.filter = f || ''; }
  function preloadMusic(i) {   // 曲の decode を先に始めておく（失敗しても無音で進む）
    var a = audio(), m = AT.ROUNDS[i] && AT.ROUNDS[i].music;
    if (!m || !a.load || !(a.unlocked && a.unlocked())) return;
    a.load(m.run).catch(function () {}); a.load(m.recall).catch(function () {});
  }

  // ---------- ラウンド別の絵（API の差を吸収するアダプタ） ----------
  var ART = {
    1: {
      walkGround: 168, runGround: 160,
      preload: function () { AT.ART.r1.build(); },
      walk: function (c, s, tt) { AT.ART.r1.drawNight(c, s, tt); },
      attack: function (c, p, tt, tx, ty) { AT.ART.r1.drawSwanAttack(c, p, tt, tx, ty); },
      world: function (c, s, tt, sp) { AT.ART.r1.drawArles(c, s, tt, sp / 100); },
      reset: function () {}
    },
    2: {
      walkGround: 150, runGround: 150,
      preload: function () { if (AT.ART.r2.preload) AT.ART.r2.preload(); },
      walk: function (c, s, tt) { AT.ART.r2.drawRoad(c, s, tt); },
      walkFront: function (c, s, tt) { AT.ART.r2.drawRoadFront(c, s, tt); },
      attack: function (c, p, tt, tx, ty) { AT.ART.r2.drawApproach(c, p, tt, tx, ty); },
      world: function (c, s, tt, sp) { AT.ART.r2.drawWorld(c, s, tt, sp); },
      worldFront: function (c, s, tt, sp) { AT.ART.r2.drawWorldFront(c, s, tt, sp); },
      reset: function () {}
    },
    3: {
      walkGround: 150, runGround: 160,
      preload: function () {},
      walk: function (c, s, tt) { AT.ART.r3.walk.draw(c, s, tt); },
      attack: function (c, p, tt, tx, ty) { AT.ART.r3.attacker.draw(c, tt, p, { tx: tx, ty: ty }); },
      // 一点透視の廊下は距離の単位が「奥行き」。疾走の流れ(px)を 1/16 にして渡す（速度50で絵本来の前進速度とほぼ同じ）
      world: function (c, s, tt, sp) { AT.ART.r3.world.draw(c, tt, sp, { dist: s / 16 }); },
      reset: function () { AT.ART.r3.world.reset(); }
    }
  };
  function art(i) { return ART[rid(i)]; }
  function hero(c, ground, mode, tt, sp01) { if (AT.px && AT.px.hero) AT.px.hero.draw(c, HERO_X, ground, mode, tt, sp01 || 0); }
  function attackTarget(a) { return { x: HERO_X + 14, y: a.walkGround - 16 }; }

  // 帰り道の一場面（背景＋主人公＋手前）。walk / attack / recall / flash で共通
  function drawWalkScene(c, i, s, tt, heroT) {
    var a = art(i);
    a.walk(c, s, tt);
    hero(c, a.walkGround, 'walk', heroT == null ? tt : heroT, 0);
    if (a.walkFront) a.walkFront(c, s, tt);
  }

  // 画面端の赤い走査線（襲来）
  function drawAlarm(c, k) {
    var band = 10 + 26 * k;
    for (var y = 0; y < H; y += 3) {
      var d = Math.min(y, H - 1 - y);
      if (d > band) continue;
      var a = (1 - d / band) * (0.25 + 0.45 * k) * (0.6 + 0.4 * Math.sin(T * 30 + y));
      c.fillStyle = 'rgba(255,30,70,' + a.toFixed(3) + ')';
      c.fillRect(0, y, W, 1);
    }
    var g = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, 'rgba(255,0,60,0)');
    g.addColorStop(1, 'rgba(255,0,60,' + (0.35 * k * (0.7 + 0.3 * Math.sin(T * 9))).toFixed(3) + ')');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  // ---------- 渦（突入）: 直前の画面を極座標でねじる ----------
  var warpSrc = null, warpOut = null;
  function drawSwirl(c, k) {
    if (!warpSrc) return;
    var src = warpSrc.data, out = warpOut.data, cx = HERO_X + 12, cy = 120;
    var twist = k * k * 10, zoom = 1 + k * k * 3, R = 260;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy);
        var ang = Math.atan2(dy, dx) + twist * Math.max(0, 1 - r / R) + k * 2;
        var sr = r / zoom;
        var sx = Math.round(cx + Math.cos(ang) * sr), sy = Math.round(cy + Math.sin(ang) * sr);
        sx = ((sx % W) + W) % W; sy = ((sy % H) + H) % H;
        var si = (sy * W + sx) * 4, oi = (y * W + x) * 4;
        out[oi] = src[si]; out[oi + 1] = src[si + 1]; out[oi + 2] = src[si + 2]; out[oi + 3] = 255;
      }
    }
    c.putImageData(warpOut, 0, 0);
  }

  // 残像: 前フレームを少しずらして半透明で重ねる（コンボが続くほど強く）
  var trail = null, trailCtx = null;
  function ghost(c, k) {
    if (typeof document === 'undefined') return;
    if (!trail) {
      trail = document.createElement('canvas'); trail.width = W; trail.height = H;
      trailCtx = trail.getContext('2d'); trailCtx.imageSmoothingEnabled = false;
    }
    if (k > 0) {
      c.globalAlpha = 0.18 + 0.22 * k;
      c.globalCompositeOperation = 'lighter';
      c.drawImage(trail, -3 - 3 * k, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    trailCtx.drawImage(c.canvas, 0, 0);
  }

  // ---------- 疾走の絵（run / swallow で共通） ----------
  // 重ね順: 背景 → 障害物 → 乗り手 → (R2 の手前のすすき) → 破片 → 闇 → フラッシュ（闇とフラッシュは呼び出し側）
  var R = { parts: [], cuts: [], rider: null, flashK: 0, flashCol: '#ffffff', shakeT: 0, lastJudge: null, runT: 0, escapeAt: 40 };
  function obstacleSpriteX(o) { return o.x - OB.info(rid(), o.kind).hit.x; }   // engine の x は実体の前縁
  function drawRunWorld(c, opts) {
    opts = opts || {};
    var a = art(), sp = S.speed, gy = a.runGround, rd = rid();
    a.world(c, S.distance, T, sp);
    if (!opts.noObstacles) {
      for (var i = 0; i < S.obstacles.length; i++) {
        var o = S.obstacles[i], d = o.x - SC.bikeX;
        OB.drawObstacle(c, rd, o.kind, obstacleSpriteX(o), gy, { t: T, glow: (d > SC.bodyX && d <= SC.reach) ? 1 : 0 });
      }
      for (var j = 0; j < R.cuts.length; j++) OB.drawObstacle(c, rd, R.cuts[j].kind, R.cuts[j].x, gy, { t: T, cut: R.cuts[j].p });
    }
    if (opts.rider !== false) {
      var rr = R.rider || { st: 'run', p: 0 };
      OB.drawRider(c, RIDER_X, gy, rr.st, T, sp / 100, rr.p, { round: rd, just: rr.just });
    }
    if (opts.bike != null) OB.drawEmptyBike(c, RIDER_X, gy, opts.bike);
    if (a.worldFront) a.worldFront(c, S.distance, T, sp);
  }

  // ---------- 成績 → 結末（疾走パート刷新プラン §2-6） ----------
  // ラウンドの点数 = 斬った率×50 + JUST率×30 + 闇との平均距離×20（AT.slash.result().score）。3ラウンド平均。
  // しきい値は初期値 85/65/40 から 85/72/60 に変更: 曲の長さで逃げ切る条件のシミュレーションでは
  // 逃げ切れた人の平均点が最低でも約54点になり、40 だと C（家を通り過ぎる）が出ない。
  // 上手い→S / 上手め→A / 中くらい・GOODばかり→B / ぎりぎり→C に分かれるよう 72 と 60 にした（draft/統合メモ.md）。
  var RANK = { S: 85, A: 72, B: 60 };
  function grade() {
    var res = AT.state.results, n = AT.ROUNDS.length, sum = 0;
    for (var i = 0; i < n; i++) if (res[i]) sum += res[i].score || 0;
    var score = Math.round(sum / n);
    var rank = score >= RANK.S ? 'S' : score >= RANK.A ? 'A' : score >= RANK.B ? 'B' : 'C';
    return { score: score, rank: rank };
  }
  function statsText(g) {
    var res = AT.state.results, cut = [], just = [], crash = [], near = [], maxCombo = 0;
    for (var i = 0; i < AT.ROUNDS.length; i++) {
      var r = res[i];
      cut.push(r ? Math.round(r.slashRate * 100) + '%' : '-');
      just.push(r ? Math.round(r.justRate * 100) + '%' : '-');
      crash.push(r ? r.crashes : '-');
      near.push(r ? Math.round(r.minDist * 100) + '%' : '-');
      if (r && r.maxCombo > maxCombo) maxCombo = r.maxCombo;
    }
    return '斬った率 ' + cut.join(' / ') + '\nJUST率 ' + just.join(' / ') + '\n' +
      '衝突 ' + crash.join(' / ') + '　闇との最接近 ' + near.join(' / ') + '\n' +
      '最大コンボ ' + maxCombo + '　スコア ' + g.score;
  }
  // 呑まれたときの一言: そのラウンドの回顧で読んだ文の最後の行（回顧を通っていなければ候補からランダム）
  function swallowLine() {
    if (AT.state.recallLine && AT.state.recallLineRound === AT.state.round) return AT.state.recallLine;
    var c = AT.util.pick(AT.TEXTS.recall[rid()]);
    return c[c.length - 1];
  }

  function go(name) {
    if (cur && cur.exit) cur.exit();
    cur = scenes[name]; curName = name; t = 0; guard = 0.25;
    AT.ui.reset();
    if (cur.enter) cur.enter();
  }

  // ---------- シーン ----------
  var scenes = {
    // タイトル: 最初の操作で音を解禁してパーセルを鳴らし、次の操作で開始
    title: {
      enter: function () {
        AT.state.round = 0; AT.state.results = []; AT.timeScale = 1; scroll = 0;
        setFilter('');
        AT.ui.sceneName('悪態独り', '人と会った帰りの夜道');
        AT.ui.hint(audioUnlocked ? 'タップ / キーではじめる' : 'タップ / キーで音が出ます');
        AT.ui.credit(true);
        if (audio().loopStop) audio().loopStop('dark_loop', 0.3);
        if (audioUnlocked) playTitleMusic();
        ART[1].preload(); ART[2].preload();
      },
      update: function (dt) { scroll += dt * 14; },
      draw: function (c) {
        ART[1].walk(c, scroll, T);
        hero(c, ART[1].walkGround, 'walk', T * 0.5, 0);
        c.fillStyle = 'rgba(5,6,15,0.35)'; c.fillRect(0, 0, W, H);
      },
      hit: function () {
        if (!audioUnlocked) {
          audioUnlocked = true;
          playTitleMusic();
          preloadMusic(0);
          AT.ui.hint('タップ / キーではじめる');
          guard = 0.5;
          return;
        }
        go('walk');
      }
    },

    // A 帰り道（現実）: 自転車で右へ。独り言がポツポツ。BGMなし。15秒で自動
    walk: {
      dur: 15,
      enter: function () {
        AT.timeScale = 1; setFilter('');
        var a = audio(), i = AT.state.round;
        if (a.stop) a.stop(1.5);
        if (a.loopStop) a.loopStop('dark_loop', 0.3);
        // 使い終わった曲の decode 結果を捨てる（メモリ節約。バイト列は残るので結末で再 decode できる）
        if (a.release) {
          a.release('title');
          if (i > 0) { a.release(AT.ROUNDS[i - 1].music.run); a.release(AT.ROUNDS[i - 1].music.recall); }
        }
        preloadMusic(i);
        art().preload();
        AT.ui.setAccent(round().accent);
        var pool = AT.TEXTS.mono.slice(), picks = [];
        for (var k = 0; k < 3 && pool.length; k++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        this.monos = picks; this.monoIdx = -1;
        if (AT.DEBUG) AT.ui.hint('(debug) タップで飛ばす');
      },
      update: function (dt) {
        scroll += dt * 40; walkT += dt;
        var slot = Math.floor((t - 1) / 4.6), inSlot = (t - 1) - slot * 4.6;
        if (t >= 1 && slot < this.monos.length) {
          if (inSlot < 3.4) {
            if (slot !== this.monoIdx) { this.monoIdx = slot; AT.ui.mono(this.monos[slot], HERO_X + 4, art().walkGround - 30); }
          } else AT.ui.monoOff();
        } else AT.ui.monoOff();
        if (t > this.dur) go('attack');
      },
      draw: function (c) { drawWalkScene(c, null, scroll, walkT); },
      hit: function () { if (AT.DEBUG) go('attack'); }
    },

    // B 襲来: 右上から急接近。画面端に赤い走査線、心拍音（合成のキック）
    attack: {
      dur: 4, P_END: 0.92,
      enter: function () { this.beats = 0; },
      update: function (dt) {
        scroll += dt * 30; walkT += dt;
        // 心拍（ドクン、ドクン）。だんだん速く
        var period = 0.9 - 0.5 * clamp(t / this.dur, 0, 1);
        if (t >= this.beats * period) {
          this.beats++;
          try { audio().voices.kick(); setTimeout(function () { try { audio().voices.kick(); } catch (e) {} }, 140); } catch (e) {}
        }
        if (t > this.dur) go('recall');
      },
      draw: function (c) {
        var a = art(), p = ease(clamp(t / (this.dur - 0.4), 0, 1)) * this.P_END, tg = attackTarget(a);
        drawWalkScene(c, null, scroll, walkT);
        c.save(); c.imageSmoothingEnabled = false;
        a.attack(c, p, walkT, tg.x, tg.y);
        c.restore();
        drawAlarm(c, clamp(t / this.dur, 0, 1));
      },
      hit: function () { if (AT.DEBUG) go('recall'); }
    },

    // C 回顧（スロー）: 時間0.05倍、青黒、その回の曲の静かな区間をループしてこもらせる。
    // タップで1行ずつ → 叫び → タップで突入
    recall: {
      enter: function () {
        var self = this;
        AT.timeScale = 0.05;
        this.shouted = false;
        setFilter('saturate(0.35)');
        var a = audio();
        if (a.setMuffled) a.setMuffled(true, 0.3);
        if (a.playMusic) a.playMusic(round().music.recall, { loop: true, fadeIn: 1.2, xfade: 0.3 });
        var cands = AT.TEXTS.recall[rid()], i = Math.floor(Math.random() * cands.length);
        AT.state.recallLine = cands[i][cands[i].length - 1]; AT.state.recallLineRound = AT.state.round;
        var shouts = AT.TEXTS.recallShout && AT.TEXTS.recallShout[rid()];
        var shout = (shouts && shouts[i]) || AT.util.pick(AT.TEXTS.shout);
        AT.ui.hint('タップ / キーで次の行');
        AT.ui.recallStart(cands[i], function () {
          AT.ui.shout(shout);
          AT.ui.hint('タップ / キーで突入');
          self.shouted = true;
          sfx('miss');
          try { audio().voices.kick(); audio().voices.snare(); } catch (e) {}
          guard = 0.5;
        });
      },
      exit: function () {
        AT.timeScale = 1;
        var a = audio();
        if (a.setMuffled) a.setMuffled(false, 0.2);
        if (a.stop) a.stop(0.3);
      },
      update: function (dt, realDt) {
        scroll += dt * 30; walkT += dt;
        AT.ui.recallUpdate(realDt * 1000);
      },
      draw: function (c) {
        var a = art(), tg = attackTarget(a);
        drawWalkScene(c, null, scroll, walkT);
        c.save(); c.imageSmoothingEnabled = false;
        a.attack(c, scenes.attack.P_END, walkT, tg.x, tg.y);
        c.restore();
        c.fillStyle = 'rgba(6,12,38,0.62)'; c.fillRect(0, 0, W, H);
        if (this.shouted) {   // 叫びの瞬間はマゼンタがにじむ
          c.fillStyle = 'rgba(255,46,136,' + (0.12 + 0.08 * Math.sin(T * 25)).toFixed(3) + ')';
          c.fillRect(0, 0, W, H);
        }
      },
      hit: function () { if (this.shouted) go('warp'); else AT.ui.recallAdvance(); }
    },

    // D 突入: 渦状にねじれて異世界へ
    warp: {
      dur: 2,
      enter: function () {
        setFilter('');
        warpSrc = lastCtx ? lastCtx.getImageData(0, 0, W, H) : null;
        warpOut = lastCtx ? lastCtx.createImageData(W, H) : null;
        try { audio().voices.kick(); audio().voices.snare(); } catch (e) {}
        sfx('miss');
      },
      update: function () { if (t > this.dur) go('run'); },
      draw: function (c) {
        var k = clamp(t / this.dur, 0, 1);
        drawSwirl(c, k);
        c.fillStyle = 'rgba(255,46,136,' + (k * 0.5).toFixed(3) + ')'; c.fillRect(0, 0, W, H);
        if (k > 0.8) { c.fillStyle = 'rgba(255,255,255,' + ((k - 0.8) * 5).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
      },
      hit: function () { if (AT.DEBUG) go('run'); }
    },

    // E 異世界疾走: 自転車で走りながら刀で障害物を斬り、背後の闇から逃げる（AT.slash）。
    // 逃げ切り = 疾走曲の終わり（曲の長さ − endPad）で白光。曲が鳴っていなければ同じ秒数の経過で白光。
    run: {
      enter: function () {
        var r = round(), idx = AT.state.round, a = audio();
        scroll = 0;
        R.parts = []; R.cuts = []; R.rider = { st: 'run', p: 0, dur: 0 }; R.flashK = 0; R.shakeT = 0; R.lastJudge = null; R.runT = 0;
        art().reset(); art().preload(); OB.build();
        AT.ui.setAccent(r.accent);
        AT.ui.meter(SC.speedStart);
        AT.ui.hint('タップ / キーで斬る');
        // engine の 40 秒固定は使わず、曲の時間で逃げ切りを決める（hitstop 中は engine の時間が止まり、曲は止まらないため）
        SC.duration = 1e9;
        S.EVENTS.forEach(function (e) { S.off(e); });
        S.on('just', function (e) { onCut(e, true); });
        S.on('good', function (e) { onCut(e, false); });
        S.on('miss', function () {
          R.rider = { st: 'slash', p: 0, dur: 0.25, just: false };
          R.lastJudge = 'miss(空振り)';
          sfx('slash', { vol: 0.7 });
          AT.ui.judge('miss'); AT.ui.combo(0);
        });
        S.on('crash', function (e) {
          var o = e.obstacle;
          OB.burst(R.parts, rid(), o.kind, obstacleSpriteX(o), art().runGround, 'GOOD');
          R.rider = { st: 'stagger', p: 0, dur: 0.5 };
          R.shakeT = 0.25; R.flashK = 0.55; R.flashCol = '#ff2e88';
          R.lastJudge = 'crash';
          sfx('crash');
          AT.ui.judge('crash'); AT.ui.combo(0);
        });
        S.on('end', function (e) {
          if (e.status === 'escaped') AT.state.results[idx] = e.result;
        });
        S.start(idx, { seed: (Math.random() * 1e9) >>> 0 });
        if (a.playMusic) a.playMusic(r.music.run, { xfade: 0.05, fadeIn: 0.05 });
        if (a.loop) a.loop('dark_loop', 0.1, 0.5);
      },
      exit: function () {
        SC.duration = DEFAULT_DURATION;
        S.EVENTS.forEach(function (e) { S.off(e); });
        setFilter('');
      },
      update: function (dt) {
        var a = audio(), m = round().music;
        R.runT += dt;
        // 曲の時計（読み込み待ち・音なしのときは経過時間）で逃げ切りを決める
        var len = (a.duration && a.duration(m.run)) || m.runLen;
        R.escapeAt = len - m.endPad;
        var el = a.musicId && a.musicId() === m.run && a.musicElapsed ? a.musicElapsed() : null;
        R.clock = el != null ? el : R.runT;
        if (R.clock >= R.escapeAt) SC.duration = Math.min(SC.duration, S.time);   // 次の update で 'escaped'
        var d0 = S.distance;
        S.update(dt);
        var dx = S.distance - d0, frozen = dx === 0 && S.hitstop > 0;
        scroll = S.distance;
        // 斬られた障害物の崩れ・破片は世界と一緒に流れる（ヒットストップ中は止まる）
        if (!frozen) {
          for (var i = R.cuts.length - 1; i >= 0; i--) {
            var cc = R.cuts[i]; cc.x -= dx; cc.p += dt / CUT_DUR;
            if (cc.p >= 1) R.cuts.splice(i, 1);
          }
          OB.updateParticles(R.parts, dt, S.scroll);
          var rr = R.rider;
          if (rr.st === 'slash' || rr.st === 'stagger') { rr.p += dt / rr.dur; if (rr.p >= 1) R.rider = { st: 'run', p: 0, dur: 0 }; }
        }
        // 構え: 次の障害物が間合いの少し手前まで来たら
        if (R.rider.st === 'run' || R.rider.st === 'ready') {
          var near = false;
          for (var j = 0; j < S.obstacles.length; j++) { var dd = S.obstacles[j].x - SC.bikeX; if (dd > SC.bodyX && dd <= SC.reach + 20) near = true; }
          R.rider = { st: near ? 'ready' : 'run', p: 0, dur: 0 };
        }
        R.flashK = Math.max(0, R.flashK - dt / 0.08);
        R.shakeT = Math.max(0, R.shakeT - dt);
        // 闇のざわめき: 遠いと小さく、1/3 に近づくと大きく
        var k = clamp(S.dark / SC.darkLimit, 0, 1);
        if (a.loopVolume) a.loopVolume('dark_loop', 0.08 + 0.92 * k * k);
        AT.ui.meter(S.speed);
        if (t > 4) AT.ui.hint('');
        // 色相回転（コンボ20以上）
        setFilter(S.combo >= 20 ? 'hue-rotate(' + Math.round((T * 300) % 360) + 'deg) saturate(1.3)' : '');
        if (S.status === 'escaped') go('flash');
        else if (S.status === 'swallowed') go('swallow');
      },
      draw: function (c) {
        var sp = S.speed;
        var shake = (sp > 80 ? (sp - 80) / 20 * 1.5 : 0) + (R.shakeT > 0 ? 3 * R.shakeT / 0.25 : 0);
        c.save();
        if (shake) c.translate(Math.round((Math.random() - 0.5) * 2 * shake), Math.round((Math.random() - 0.5) * 2 * shake));
        drawRunWorld(c);
        c.restore();
        ghost(c, S.combo >= 5 ? clamp((S.combo - 5) / 15, 0, 1) : 0);
        OB.drawParticles(c, R.parts);
        OB.drawDark(c, S.dark, T);
        OB.drawFlash(c, R.flashK, R.flashCol);
      },
      hit: function () { S.slash(); }
    },

    // E' 呑まれる（プラン §2-5）: 闇が全面を覆う(0.6秒) → 真っ黒に一言 → 闇が引く(0.8秒) → 無人の自転車が惰性で止まる(3.5秒)
    swallow: {
      ENGULF: 0.6, HOLD: 2.6, RECEDE: 0.8, BIKE: 3.5,
      enter: function () {
        var a = audio();
        this.w0 = S.dark; this.said = false; this.coastN = 0;
        this.line = swallowLine();
        setFilter('');
        if (a.stop) a.stop(0.5);                                   // BGM は止まる
        if (a.loopVolume) a.loopVolume('dark_loop', 1, 0.3);       // 呑まれる瞬間にざわめきが最大
        R.rider = { st: 'stagger', p: 0.5, dur: 1 };
      },
      update: function () {
        var E = this.ENGULF, Hd = E + this.HOLD, Rc = Hd + this.RECEDE, B = Rc + this.BIKE;
        if (!this.said && t >= E) {
          this.said = true;
          AT.ui.doom(this.line, null, 'big');
          if (audio().loopStop) audio().loopStop('dark_loop', 0.15);
        }
        if (this.said && t >= Hd) AT.ui.doomOff();
        // 惰性の回転音（小さく。動いている間だけ 1.1 秒ごとに重ねる）
        if (t >= Rc) {
          var bp = (t - Rc) / this.BIKE;
          if (bp < 0.55 && t - Rc >= this.coastN * 1.1) { this.coastN++; sfx('bike_coast', { vol: Math.max(0.3, 1 - bp * 1.4) }); }
        }
        if (t >= B + 0.5) go('gameover');
      },
      draw: function (c) {
        var E = this.ENGULF, Hd = E + this.HOLD, Rc = Hd + this.RECEDE;
        if (t < E) {
          drawRunWorld(c);
          OB.drawParticles(c, R.parts);
          OB.drawEngulf(c, t / E, T, this.w0);
        } else if (t < Hd) {
          c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        } else if (t < Rc) {
          drawRunWorld(c, { noObstacles: true, rider: false, bike: 0 });
          OB.drawRecede(c, (t - Hd) / this.RECEDE, T);
        } else {
          drawRunWorld(c, { noObstacles: true, rider: false, bike: clamp((t - Rc) / this.BIKE, 0, 1) });
        }
      },
      hit: function () {   // 一言は少し読んだらタップで先へ
        var E = this.ENGULF;
        if (t > E + 1.0 && t < E + this.HOLD) t = E + this.HOLD;
      }
    },

    // E'' ゲームオーバーの専用結末（文は AT.TEXTS.gameover。ユーザー確認待ちの下書き）→ タップでタイトルへ
    gameover: {
      enter: function () {
        this.shown = false; this.canLeave = false;
        if (audio().stop) audio().stop(0.3);
      },
      update: function () {
        if (!this.shown && t > 0.8) { this.shown = true; AT.ui.doom(AT.TEXTS.gameover.head, AT.TEXTS.gameover.lines, 'end'); }
        if (!this.canLeave && t > 2.5) { this.canLeave = true; AT.ui.hint('タップ / キーでタイトルへ'); }
      },
      draw: function (c) {
        drawRunWorld(c, { noObstacles: true, rider: false, bike: 1 });
        c.fillStyle = 'rgba(5,6,15,' + (0.25 + 0.4 * clamp(t / 0.8, 0, 1)).toFixed(3) + ')';
        c.fillRect(0, 0, W, H);
      },
      hit: function () {
        if (!this.canLeave) return;
        go('title');
        guard = 0.8;
      }
    },

    // F 白光: 0.3秒で白 → 1秒保持 → 1.5秒で夜道（次ラウンド）/ 玄関（結末）へフェード。白光の効果音（大）
    flash: {
      enter: function () {
        var a = audio();
        setFilter('');
        if (a.stop) a.stop(0.3);
        if (a.loopStop) a.loopStop('dark_loop', 0.2);
        sfx('flash');
        this.frozenScroll = scroll; this.frozenT = T;
        this.next = AT.state.round + 1;
        if (this.next < AT.ROUNDS.length) art(this.next).preload();
        else this.grade = grade();
      },
      update: function () {
        if (t > 2.8) {
          AT.state.round++;
          scroll = 0; walkT = 0;
          go(AT.state.round < AT.ROUNDS.length ? 'walk' : 'ending');
        }
      },
      draw: function (c) {
        var white;
        if (t < 0.3) {
          art().world(c, this.frozenScroll, this.frozenT, 100);
          white = t / 0.3;
        } else if (t < 1.3) {
          white = 1;
        } else {
          if (this.next < AT.ROUNDS.length) drawWalkScene(c, this.next, 0, 0);
          else AT.ART.ending.door.draw(c, this.grade.rank, T);
          white = 1 - clamp((t - 1.3) / 1.5, 0, 1);
        }
        c.fillStyle = 'rgba(255,255,255,' + white.toFixed(3) + ')';
        c.fillRect(0, 0, W, H);
      }
    },

    // 結末: 玄関の絵＋一言＋成績＋もういちど（企画書§6）
    ending: {
      enter: function () {
        AT.timeScale = 1; setFilter('');
        this.g = grade();
        this.shown = false; this.again = false;
        console.log('[ending] スコア', this.g, AT.state.results);
        if (audio().playMusic) audio().playMusic('title', { loop: true, fadeIn: 2, xfade: 0.3 });
      },
      update: function () {
        if (!this.shown && t > 2.8) {
          this.shown = true;
          AT.ui.ending({ rank: this.g.rank, line: AT.TEXTS.ending[this.g.rank], stats: statsText(this.g), again: '' });
        }
        if (this.shown && t > 4.5 && !this.again) {
          this.again = true;
          AT.ui.ending({ rank: this.g.rank, line: AT.TEXTS.ending[this.g.rank], stats: statsText(this.g), again: 'もういちど（タップ / キー）' });
        }
      },
      exit: function () { this.again = false; },
      draw: function (c) {
        var door = AT.ART.ending.door, rank = this.g.rank, gy = door.groundY;
        door.draw(c, rank, T);
        // 主人公: 左から来て止まる。C は家の前を通り過ぎる。B は鍵を探してもぞもぞ
        var x, mode = 'walk', ht;
        if (rank === 'C') {
          x = -24 + t * 38;
          if (x > W + 30) x = W + 30;
          ht = T;
        } else {
          var k = clamp(t / 2.5, 0, 1);
          x = -24 + (100 + 24) * (1 - (1 - k) * (1 - k));
          ht = k < 1 ? T : 0;
          if (rank === 'B' && k >= 1) x += Math.round(Math.sin(T * 7));
        }
        if (AT.px && AT.px.hero) AT.px.hero.draw(c, Math.round(x), gy, mode, ht, 0);
      },
      hit: function () {
        if (!this.again) return;
        go('title');
        guard = 0.8;
      }
    }
  };

  // 斬った（JUST / GOOD）: 崩れる障害物・破片・刀の軌跡・ヒットストップのフラッシュ・効果音
  function onCut(e, just) {
    var o = e.obstacle, sx = obstacleSpriteX(o), gy = art().runGround;
    R.cuts.push({ kind: o.kind, x: sx, p: 0 });
    OB.burst(R.parts, rid(), o.kind, sx, gy, just ? 'JUST' : 'GOOD');
    R.rider = { st: 'slash', p: 0, dur: 0.25, just: just };
    R.flashK = just ? 1 : 0.55; R.flashCol = '#ffffff';
    R.lastJudge = just ? 'JUST' : 'GOOD';
    sfx('slash');
    sfx('hit', { vol: just ? 1 : 0.7, rate: just ? 1 : 1.12 });
    AT.ui.judge(just ? 'just' : 'good');
    AT.ui.combo(e.combo);
  }

  function playTitleMusic() {
    var a = audio();
    if (a.playMusic && a.musicId && a.musicId() !== 'title') a.playMusic('title', { loop: true, fadeIn: 1, xfade: 0.5 });
  }

  AT.scenes = {
    go: go,
    current: function () { return curName; },
    update: function (dt, realDt) {
      T += realDt;
      t += dt;
      if (guard > 0) guard -= realDt;
      if (cur.update) cur.update(dt, realDt);
    },
    draw: function (ctx) {
      lastCtx = ctx;
      if (cur.draw) cur.draw(ctx);
    },
    hit: function (src) {
      if (guard > 0) return;
      if (cur.hit) cur.hit(src);
    },
    // ?debug 用の表示
    debugText: function () {
      var s = 'scene: ' + curName + '  round: ' + (AT.state.round + 1) + '  t: ' + t.toFixed(1);
      if (curName === 'run') {
        s += '\nspeed: ' + S.speed.toFixed(1) + '  dark: ' + S.dark.toFixed(3) + ' / ' + SC.darkLimit.toFixed(3) +
          '  combo: ' + S.combo + '  status: ' + S.status +
          '\nclock: ' + (R.clock || 0).toFixed(1) + ' / ' + R.escapeAt.toFixed(1) + 's' +
          (audio().musicElapsed && audio().musicElapsed() != null ? ' (曲)' : ' (経過時間)') + '  engine t: ' + S.time.toFixed(1) +
          '\nlast: ' + (R.lastJudge || '-') + '  斬' + S.stats.slashed + ' (JUST ' + S.stats.just + ') 衝突' + S.stats.crash + ' 空振り' + S.stats.whiff;
      }
      return s;
    },
    _grade: grade,
    _run: R
  };
})(window.AT);
