// scenes: シーン状態機械（統合版）。
// 流れ: title → walk → attack → recall → warp → run → flash → (次ラウンド walk / ending) → title
// 絵は AT.ART.r1/r2/r3（art_r*.js）と AT.px.hero（art_common.js）、音は AT.audio、判定は AT.rhythm。
// 各シーン: enter() / exit() / update(dt, realDt) / draw(ctx) / hit()
//   dt は timeScale 適用後（回顧のスロー中は 0.05 倍）、realDt は実時間。
(function (AT) {
  var W = AT.W, H = AT.H;
  var cur = null, curName = '', t = 0;
  var T = 0;            // 起動からの実時間(秒)。星の瞬き等
  var guard = 0;        // 入力誤爆防止(秒)
  var lastCtx = null;
  var HERO_X = 64;      // 主人公(24×24)の左端
  var scroll = 0;       // 前景の進んだ距離(px)
  var walkT = 0;        // 帰り道〜回顧で使う絵の時刻（回顧ではスローで進む）
  var audioUnlocked = false;

  function round() { return AT.ROUNDS[AT.state.round]; }
  function rid(i) { return AT.ROUNDS[i == null ? AT.state.round : i].id; }
  function audio() { return AT.audio || {}; }
  function sfx(name) { try { if (AT.audio && AT.audio.sfx) AT.audio.sfx(name); } catch (e) {} }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(p) { return p * p * (3 - 2 * p); }
  function setFilter(f) { if (lastCtx) lastCtx.canvas.style.filter = f || ''; }

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
      world: function (c, s, tt, sp) { AT.ART.r3.world.draw(c, tt, sp, { dist: s }); },
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

  // ---------- 疾走: リズムレーン ----------
  var LANE_Y = 162, LANE_H = 18, JUDGE_X = HERO_X + 34, PX_PER_BEAT = 28;
  function drawLane(c, accent) {
    var R = AT.rhythm;
    c.fillStyle = 'rgba(5,6,15,0.62)';
    c.fillRect(0, LANE_Y, W, LANE_H);
    c.fillStyle = 'rgba(232,240,255,0.25)';
    c.fillRect(0, LANE_Y, W, 1); c.fillRect(0, LANE_Y + LANE_H - 1, W, 1);
    var beat = R.getBeat ? R.getBeat() : 0, frac = beat - Math.floor(beat);
    var cy = LANE_Y + LANE_H / 2;
    // 拍の目盛り
    c.fillStyle = 'rgba(232,240,255,0.18)';
    for (var b = Math.ceil(beat - 1); b < beat + 12; b++) {
      var gx = Math.round(JUDGE_X + (b - beat) * PX_PER_BEAT);
      if (gx > -2 && gx < W) c.fillRect(gx, LANE_Y + 2, 1, LANE_H - 4);
    }
    // 判定線（拍頭で光る）
    var pulse = beat >= 0 ? Math.max(0, 1 - frac * 4) : 0;
    c.fillStyle = 'rgba(255,46,136,' + (0.55 + 0.45 * pulse).toFixed(3) + ')';
    c.fillRect(JUDGE_X - 1, LANE_Y - 3, 3, LANE_H + 6);
    c.strokeStyle = '#e8f0ff'; c.lineWidth = 1;
    c.strokeRect(JUDGE_X - 6.5, cy - 6.5, 13, 13);
    // ノーツ
    var notes = R.getNotes ? R.getNotes(10, 1) : [];
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i], x = JUDGE_X + n.dBeat * PX_PER_BEAT;
      if (x < -8 || x > W + 8) continue;
      if (n.state === 'perfect' || n.state === 'good') {
        var age = -n.dBeat;   // 叩いた後は判定線で弾けて消える
        if (age > 0.5) continue;
        var rr = 5 + age * 18;
        c.strokeStyle = n.state === 'perfect' ? 'rgba(255,255,255,' + (1 - age * 2) + ')' : accent;
        c.globalAlpha = Math.max(0, 1 - age * 2);
        c.strokeRect(JUDGE_X - rr, cy - rr, rr * 2, rr * 2);
        c.globalAlpha = 1;
        continue;
      }
      var s = n.eighth ? 3 : 5;
      var col = n.state === 'miss' ? '#4a5070' : (n.eighth ? '#e8f0ff' : accent);
      diamond(c, Math.round(x), cy, s + 1, '#05060f');
      diamond(c, Math.round(x), cy, s, col);
    }
  }
  function diamond(c, x, y, s, col) {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x, y + s); c.lineTo(x - s, y); c.closePath(); c.fill();
  }

  // 残像（speed 70% 以上）: 前フレームを少しずらして半透明で重ねる
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

  // ---------- 成績 → 結末（企画書§6） ----------
  function grade() {
    var res = AT.state.results, n = AT.ROUNDS.length, accSum = 0, self = 0;
    for (var i = 0; i < n; i++) {
      var r = res[i];
      if (!r) continue;
      accSum += r.accuracy || 0;
      if (!r.assisted && r.reachTime != null) self++;
    }
    var acc = accSum / n;
    var score = Math.round(acc * 70 + self * 10);
    var rank = score >= 85 ? 'S' : score >= 65 ? 'A' : score >= 40 ? 'B' : 'C';
    return { acc: acc, self: self, score: score, rank: rank };
  }
  function statsText(g) {
    var res = AT.state.results, accs = [], times = [], maxCombo = 0;
    for (var i = 0; i < AT.ROUNDS.length; i++) {
      var r = res[i];
      accs.push('R' + (i + 1) + ' ' + (r ? Math.round(r.accuracy * 100) + '%' : '-'));
      times.push('R' + (i + 1) + ' ' + (r && r.reachTime != null ? r.reachTime.toFixed(1) + '秒' + (r.assisted ? '(救済)' : '') : '-'));
      if (r && r.maxCombo > maxCombo) maxCombo = r.maxCombo;
    }
    return '精度 ' + Math.round(g.acc * 100) + '%（' + accs.join(' / ') + '）\n' +
      '最高速度到達 ' + times.join(' / ') + '\n' +
      '最大コンボ ' + maxCombo + '　スコア ' + g.score;
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
        if (audioUnlocked && audio().isPlaying && !audio().isPlaying()) playTitleMusic();
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
        if (audio().stop) audio().stop(1.5);
        art().preload();
        AT.ui.setAccent(round().accent);
        var pool = AT.TEXTS.mono.slice(), picks = [];
        for (var i = 0; i < 3 && pool.length; i++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
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

    // B 襲来: 右上から急接近。画面端に赤い走査線、心拍音
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

    // C 回顧（スロー）: 時間0.05倍、青黒、こもった静かな曲。タップで1行ずつ → 叫び → タップで突入
    recall: {
      enter: function () {
        var self = this;
        AT.timeScale = 0.05;
        this.shouted = false; this.shoutT = 0;
        setFilter('saturate(0.35)');
        var a = audio();
        if (a.setMuffled) a.setMuffled(true, 0.3);
        if (a.play) a.play({ type: 'synth', song: 'tell_slow' }, { bpm: 66, delay: 0.3 });
        var cands = AT.TEXTS.recall[rid()], i = Math.floor(Math.random() * cands.length);
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

    // E 異世界疾走: リズム入力で加速。100で白光へ
    run: {
      enter: function () {
        var self = this, r = round(), idx = AT.state.round;
        scroll = 0; this.lastJudge = null; this.reached = false;
        art().reset(); art().preload();
        AT.ui.setAccent(r.accent);
        AT.ui.meter(0);
        AT.ui.hint('リズムに合わせて タップ / キー');
        var R = AT.rhythm;
        R.offAll();
        R.onJudge(function (info) {
          self.lastJudge = info;
          if (info.empty && !info.note) { AT.ui.judge('miss'); }
          else AT.ui.judge(info.result);
          AT.ui.combo(info.combo);
          if (!info.empty) sfx(info.result === 'miss' ? 'miss' : info.result);
        });
        R.onReach(function (stats) {
          AT.state.results[idx] = stats;
          self.reached = true;
        });
        R.start(r);
      },
      exit: function () { AT.rhythm.stop(); AT.rhythm.offAll(); setFilter(''); },
      update: function (dt) {
        var R = AT.rhythm;
        R.update();
        var sp = R.speed;
        scroll += dt * (60 + 340 * sp / 100);
        AT.ui.meter(sp);
        if (t > 5) AT.ui.hint('');
        // 色相回転（speed 90% 以上）
        setFilter(sp >= 90 ? 'hue-rotate(' + Math.round((T * 300) % 360) + 'deg) saturate(1.3)' : '');
        if (this.reached) go('flash');
      },
      draw: function (c) {
        var a = art(), sp = AT.rhythm.speed, r = round();
        // 画面揺れ（高速時）
        var shake = sp > 80 ? (sp - 80) / 20 * 1.5 : 0;
        c.save();
        if (shake) c.translate(Math.round((Math.random() - 0.5) * 2 * shake), Math.round((Math.random() - 0.5) * 2 * shake));
        a.world(c, scroll, T, sp);
        hero(c, a.runGround, 'run', T, sp / 100);
        if (a.worldFront) a.worldFront(c, scroll, T, sp);
        c.restore();
        ghost(c, sp >= 70 ? (sp - 70) / 30 : 0);
        drawLane(c, r.accent);
      },
      hit: function () { AT.rhythm.hit(); }
    },

    // F 白光: 0.3秒で白 → 1秒保持（無音）→ 1.5秒で夜道（次ラウンド）/ 玄関（結末）へフェード
    flash: {
      enter: function () {
        setFilter('');
        if (audio().stop) audio().stop(0.3);
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
        if (audio().play) audio().play({ type: 'synth', song: 'purcell' }, { bpm: 60, delay: 0.5 });
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
          if (rank === 'B' && k >= 1) x += Math.round(Math.sin(T * 7)) ;
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

  function playTitleMusic() {
    if (audio().play) audio().play({ type: 'synth', song: 'purcell' }, { bpm: 60, delay: 0.2 });
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
      if (curName === 'run' && AT.rhythm) {
        var R = AT.rhythm, j = scenes.run.lastJudge;
        s += '\nspeed: ' + R.speed.toFixed(1) + '  bpm: ' + (AT.audio.getBpm ? AT.audio.getBpm().toFixed(1) : '-') +
          '  elapsed: ' + R.elapsed().toFixed(1) + 's  combo: ' + R.combo +
          (j ? '\nlast: ' + j.result + (j.diffMs != null ? ' ' + j.diffMs + 'ms' : '') + (j.empty ? ' (空打ち)' : '') : '');
      }
      return s;
    },
    _grade: grade
  };
})(window.AT);
