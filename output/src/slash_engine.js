// slash_engine: 疾走パートの判定ロジック（自転車で走りながら刀で障害物を斬り、背後の闇から逃げる）
// 仕様: draft/疾走パート刷新プラン.md §2。描画・音は持たない（イベントで通知）。
// - 時計は外から渡す: AT.slash.update(dt) と AT.slash.slash()。実時間・DOM に依存しないので node で動く。
// - 障害物は x（画面座標・前縁）で持ち、右(W+margin)で生まれて左へ流れる。自転車は x=bikeX 固定。
// - 数値は全部 AT.slash.config にまとめてある（調整はここだけ）。
(function (root) {
  'use strict';
  var AT = root.AT = root.AT || {};

  var C = {
    // --- 時間・配置 ---
    duration: 40,                 // 1ラウンドの長さ(秒)。経過で逃げ切り
    W: 320,                       // 画面幅(px)。スポーン位置の基準
    bikeX: 110,                   // 自転車の x
    spawnMargin: 12,              // 画面右端のこれだけ外で生まれる
    // --- 刀の間合い（自転車の x からの距離 d = obstacle.x - bikeX） ---
    reach: 24,                    // 先端（速度0のとき）。d <= reachNow() で斬れる
    reachPerSpeed: 0.14,          // 速いほど間合いが伸びる（速度100で+14px）。流れが速くなっても斬れる猶予が極端に縮まらないように
    justWidth: 6,                 // 先端からこの幅が JUST
    bodyX: 6,                     // d <= bodyX で衝突
    // --- 判定表（プラン§2-2） ---
    just:  { speed: 5,  dark: -0.06, hitstop: 0.05 },
    good:  { speed: 3,  dark: -0.02, hitstop: 0.03 },
    whiffCooldown: 0.25,          // 空振りの硬直(秒)。この間は斬れない
    whiff: { speed: -1.5, dark: 0.01 },   // 空振りの追加ペナルティ（プラン表は0だが、連打が上手い人と並ぶため小さく足した。0にすれば表どおり）
    crash: { speed: -6.5, dark: 0.04, stun: 0.45 },   // stun: よろけ(秒)。この間も斬れない
    // --- 速度（0〜100） ---
    speedStart: 40,
    speedDecay: 0.6,              // 毎秒の自然低下
    speedDecayPerSpeed: 0.015,    // 速いほど減りやすい（速度100で毎秒+1.5）。加速が青天井にならず、上手く斬り続けた人だけがトップへ届く
    topSpeed: 97,                 // 速度がここに届いたら「トップスピード」: 主人公が画面右へ消え去り、白い光が飛んで逃げ切り
    speedDecayPerRound: 0.2,      // ラウンドごとの上乗せ
    comboStep: 5,                 // コンボ何ごとに加速量が増えるか
    comboMulStep: 0.25,           // 1段あたりの倍率増（×1.25, ×1.5 ...×2.0で頭打ち）
    comboMulMax: 2.0,              // 倍率の上限
    // --- 闇（幅 0〜1。darkLimit を超えたら呑まれる） ---
    darkLimit: 1 / 3,
    darkStart: 0.075,
    darkRate: 0.03,               // 速度 0 のとき毎秒増える幅
    darkSafeSpeed: 31,            // この速度以上では増えない
    darkRetreat: 0.0,             // 速度が safe を超えたとき毎秒減る幅の上限(0=減らない)
    darkRatePerRound: 0.0025,      // ラウンドごとの上乗せ
    // --- 流れる速さ（px/秒）= (scrollBase + speed*scrollPerSpeed) * (1 + scrollPerRound*round) ---
    scrollBase: 70, scrollPerSpeed: 1.3, scrollPerRound: 0.08,
    // --- 出現表 ---
    kinds: ['a', 'b', 'c'],
    gapBase: [165, 145, 118],     // ラウンドごとの基準間隔(px)
    gapJitter: 0.3,               // ±割合
    gapSpeedShrink: 0.25,         // 速度100で間隔がこの割合だけ詰まる
    gapTimeShrink: 0.3,           // 時間が経つにつれ間隔が詰まる（ラウンド終盤でこの割合）。障害物がだんだん多量に来る
    gapMin: 64,
    pairChance: [0.16, 0.21, 0.33],   // 2連続の確率（ラウンドごとの基準）
    pairTimeBonus: 0.22,          // 終盤で2連続・3連続の確率に足される量
    tripleChance: 0.35,           // 2連続になったとき、さらに3つ目が続く確率の最大値（終盤にかけて 0→この値）
    pairGap: 44,                  // 2連続の2つ目までの間隔(px)
    pairGapJitter: 8,             // 連続の間隔のばらつき(±px)。リズムが単調にならないように
    rampTime: 40,                 // 難易度が「終盤」に達するまでの秒数（duration は scenes が曲の長さで差し替えるので別に持つ）
    planLength: 120               // 出現表の長さ（spawnPlan の確認用。実プレイの出現は update 中に乱数で決める）
  };

  var EVENTS = ['just', 'good', 'miss', 'crash', 'swallow', 'comboUp', 'spawn', 'end'];

  // ラウンドごとの出現表（決定論的）: [{gap, kind, pair}]
  //   gap: 直前の障害物からの基準間隔(px)。実際の間隔は速度で詰まる。pair=true は2連続の2つ目（gap=pairGap固定）
  function spawnPlan(roundIndex, seed) {
    var r = Math.max(0, Math.min(C.gapBase.length - 1, roundIndex | 0));
    var rnd = rng((seed >>> 0) + r * 7919);
    var plan = [], i = 0;
    while (plan.length < C.planLength) {
      var gap = C.gapBase[r] * (1 + (rnd() * 2 - 1) * C.gapJitter);
      plan.push({ gap: gap, kind: C.kinds[Math.floor(rnd() * C.kinds.length)], pair: false });
      if (rnd() < C.pairChance[r]) {
        plan.push({ gap: C.pairGap, kind: C.kinds[Math.floor(rnd() * C.kinds.length)], pair: true });
      }
      i++;
    }
    return plan;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var cbs = {};
  EVENTS.forEach(function (e) { cbs[e] = []; });

  var S = {
    config: C,
    spawnPlan: spawnPlan,
    EVENTS: EVENTS,
    // 公開状態（読み取り専用のつもりで使う）
    round: 0, seed: 1,
    speed: 0, dark: 0, combo: 0, maxCombo: 0,
    obstacles: [],          // {id, x, kind, slashed, hit('just'|'good'|null), crashed}
    cooldown: 0, stunned: 0, hitstop: 0,
    time: 0,
    status: 'idle',         // 'idle' | 'running' | 'escaped' | 'topspeed'(トップスピード到達=逃げ切りの一種) | 'swallowed'
    stats: null,
    // 描画側の補助（読み取り用）
    scroll: 0,              // 現在の流れる速さ(px/秒)
    distance: 0             // 走った距離(px)。背景スクロール用
  };
  var rnd = rng(1), queue = [], sinceSpawn = 0, nextGap = 0, nextId = 1, darkSum = 0, darkT = 0;

  function emit(name, arg) {
    var l = cbs[name];
    for (var i = 0; i < l.length; i++) { try { l[i](arg); } catch (e) { if (root.console) console.error(e); } }
  }

  S.on = function (name, fn) {
    if (!cbs[name]) throw new Error('unknown event: ' + name);
    cbs[name].push(fn);
    return S;
  };
  S.off = function (name, fn) {
    if (!cbs[name]) return S;
    if (!fn) cbs[name].length = 0; else cbs[name] = cbs[name].filter(function (f) { return f !== fn; });
    return S;
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function comboMul() {
    return Math.min(C.comboMulMax, 1 + C.comboMulStep * Math.floor(S.combo / C.comboStep));
  }
  // 時間がたつほど 0→1（障害物の密度・連続の確率を上げる）
  function progress() { return clamp(S.time / C.rampTime, 0, 1); }
  // 刀の間合い。速いほど少し伸びる（流れが速くなっても斬れる時間をほぼ保つ）
  function reachNow() { return C.reach + C.reachPerSpeed * S.speed; }
  function justWidthNow() { return C.justWidth * reachNow() / C.reach; }
  function scrollSpeed() {
    return (C.scrollBase + S.speed * C.scrollPerSpeed) * (1 + C.scrollPerRound * S.round);
  }

  // roundIndex: 0〜2, opts: {seed, speedStart, darkStart}
  S.start = function (roundIndex, opts) {
    opts = opts || {};
    S.round = Math.max(0, roundIndex | 0);
    S.seed = opts.seed == null ? 1 : opts.seed;
    S.speed = opts.speedStart == null ? C.speedStart : opts.speedStart;
    S.dark = opts.darkStart == null ? C.darkStart : opts.darkStart;
    S.combo = 0; S.maxCombo = 0; S.obstacles = [];
    S.cooldown = 0; S.stunned = 0; S.hitstop = 0; S.time = 0; S.distance = 0;
    S.status = 'running';
    S.stats = { slashed: 0, just: 0, good: 0, whiff: 0, crash: 0, spawned: 0, closest: 1 };
    rnd = rng((S.seed >>> 0) + S.round * 7919); queue = []; nextId = 1;
    sinceSpawn = 0; nextGap = 150;      // 最初の1つは自転車から十分離れて出る
    darkSum = 0; darkT = 0;
    S.scroll = scrollSpeed();
    return S;
  };

  // 次の障害物までの間隔を決める。時間・速度で詰まり、ばらつきは毎回の乱数（プレイごとに違う並びになる）
  function pickGap() {
    var r = Math.max(0, Math.min(C.gapBase.length - 1, S.round));
    var base = C.gapBase[r] * (1 + (rnd() * 2 - 1) * C.gapJitter);
    var shrink = 1 - C.gapSpeedShrink * S.speed / 100 - C.gapTimeShrink * progress();
    return Math.max(C.gapMin, base * Math.max(0.35, shrink));
  }

  function spawnOne() {
    var kind;
    if (queue.length) {                 // 連続の続き（kind を連続で同じにしすぎない）
      kind = queue.shift();
    } else {
      kind = C.kinds[Math.floor(rnd() * C.kinds.length)];
      var r = Math.max(0, Math.min(C.pairChance.length - 1, S.round)), pg = progress();
      if (rnd() < C.pairChance[r] + C.pairTimeBonus * pg) {
        queue.push(C.kinds[Math.floor(rnd() * C.kinds.length)]);
        if (rnd() < C.tripleChance * pg) queue.push(C.kinds[Math.floor(rnd() * C.kinds.length)]);
      }
    }
    var o = { id: nextId++, x: C.W + C.spawnMargin, kind: kind, slashed: false, hit: null, crashed: false };
    S.obstacles.push(o);
    S.stats.spawned++;
    nextGap = queue.length ? Math.max(C.gapMin * 0.6, C.pairGap + (rnd() * 2 - 1) * C.pairGapJitter) : pickGap();
    sinceSpawn = 0;
    emit('spawn', o);
  }

  function addSpeed(d) { S.speed = clamp(S.speed + d, 0, 100); }
  function addDark(d) { S.dark = clamp(S.dark + d, 0, 1); }

  function finish(status) {
    if (S.status !== 'running') return;
    S.status = status;
    if (status === 'topspeed') S.stats.topSpeed = true;
    if (status === 'swallowed') emit('swallow', { time: S.time, dark: S.dark });
    emit('end', { status: status, result: S.result() });
  }

  // 1フレーム進める。dt は秒（上限は呼び出し側で丸める。ここでは 0.1 で丸める）
  S.update = function (dt) {
    if (S.status !== 'running') return S;
    dt = clamp(dt, 0, 0.1);
    if (S.hitstop > 0) {                 // ヒットストップ中は世界が止まる
      S.hitstop = Math.max(0, S.hitstop - dt);
      return S;
    }
    S.time += dt;
    S.cooldown = Math.max(0, S.cooldown - dt);
    S.stunned = Math.max(0, S.stunned - dt);

    // 速度の自然低下
    addSpeed(-(C.speedDecay + C.speedDecayPerRound * S.round + C.speedDecayPerSpeed * S.speed) * dt);
    // 闇の幅: 速度が低いほど増える
    var rate = (C.darkRate + C.darkRatePerRound * S.round) * (1 - S.speed / C.darkSafeSpeed);
    if (rate < -C.darkRetreat) rate = -C.darkRetreat;
    addDark(rate * dt);

    // 流れる
    S.scroll = scrollSpeed();
    var dx = S.scroll * dt;
    S.distance += dx;
    var i, o;
    for (i = 0; i < S.obstacles.length; i++) S.obstacles[i].x -= dx;

    // 衝突
    var bodyLine = C.bikeX + C.bodyX;
    for (i = 0; i < S.obstacles.length; i++) {
      o = S.obstacles[i];
      if (!o.slashed && !o.crashed && o.x <= bodyLine) {
        o.crashed = true;
        S.stats.crash++;
        S.combo = 0;
        addSpeed(C.crash.speed); addDark(C.crash.dark);
        S.stunned = C.crash.stun;
        emit('crash', { obstacle: o, speed: S.speed, dark: S.dark });
      }
    }
    // 画面外・処理済みを掃除（斬った/ぶつかったものは描画側が破片を出すので即削除してよい）
    S.obstacles = S.obstacles.filter(function (q) { return !q.slashed && !q.crashed && q.x > C.bikeX - 40; });

    // 出現（走った距離ベース）
    sinceSpawn += dx;
    if (sinceSpawn >= nextGap) spawnOne();

    // 闇の統計・判定
    var dist = clamp((C.darkLimit - S.dark) / C.darkLimit, 0, 1);   // 1=遠い 0=呑まれる
    if (dist < S.stats.closest) S.stats.closest = dist;
    darkSum += dist * dt; darkT += dt;
    if (S.dark > C.darkLimit) { finish('swallowed'); return S; }
    if (S.speed >= C.topSpeed) { finish('topspeed'); return S; }
    if (S.time >= C.duration) finish('escaped');
    return S;
  };

  // 刀で一閃。戻り値: 'just' | 'good' | 'miss'(空振り) | 'blocked'(硬直・よろけ中) | 'idle'(走っていない)
  S.slash = function () {
    if (S.status !== 'running') return 'idle';
    if (S.cooldown > 0 || S.stunned > 0 || S.hitstop > 0) return 'blocked';
    var target = null, i, o;
    for (i = 0; i < S.obstacles.length; i++) {
      o = S.obstacles[i];
      if (o.slashed || o.crashed) continue;
      var d = o.x - C.bikeX;
      if (d <= reachNow() && d > C.bodyX && (!target || o.x < target.x)) target = o;
    }
    if (!target) {
      S.cooldown = C.whiffCooldown;
      S.stats.whiff++;
      S.combo = 0;                       // 空振りでコンボは切れる
      addSpeed(C.whiff.speed); addDark(C.whiff.dark);
      emit('miss', { speed: S.speed });
      return 'miss';
    }
    var isJust = (target.x - C.bikeX) >= reachNow() - justWidthNow();
    var tbl = isJust ? C.just : C.good;
    target.slashed = true; target.hit = isJust ? 'just' : 'good';
    S.stats.slashed++;
    if (isJust) S.stats.just++; else S.stats.good++;
    S.combo++;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    addSpeed(tbl.speed * comboMul());
    addDark(tbl.dark);
    S.hitstop = tbl.hitstop;
    var info = { obstacle: target, x: target.x, combo: S.combo, speed: S.speed, dark: S.dark, mul: comboMul() };
    emit(isJust ? 'just' : 'good', info);
    if (S.combo % C.comboStep === 0) emit('comboUp', info);
    return target.hit;
  };

  // ランク用の成績。ラウンド途中でも呼べる。
  S.result = function () {
    var st = S.stats || { slashed: 0, just: 0, good: 0, whiff: 0, crash: 0, spawned: 0, closest: 1 };
    var resolved = st.slashed + st.crash;
    var slashRate = resolved ? st.slashed / resolved : 0;
    var justRate = st.slashed ? st.just / st.slashed : 0;
    var avgDist = darkT > 0 ? darkSum / darkT : 1;
    return {
      status: S.status, escaped: S.status === 'escaped' || S.status === 'topspeed', topSpeed: S.status === 'topspeed', swallowed: S.status === 'swallowed',
      time: S.time, speed: S.speed,
      slashRate: slashRate, justRate: justRate, crashes: st.crash,
      slashed: st.slashed, just: st.just, good: st.good, whiffs: st.whiff,
      maxCombo: S.maxCombo, avgDist: avgDist, minDist: st.closest,
      score: slashRate * 50 + justRate * 30 + avgDist * 20     // プラン§2-6 の初期式
    };
  };

  S.reachNow = reachNow;
  S.justWidthNow = justWidthNow;
  AT.slash = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : global);
