// rhythm_engine: ノーツ生成・判定・speed・成績（開発プラン T2 / 企画書§5）
// API仕様: draft/api_audio_rhythm.md
// - ノーツは「拍位置(beat)」で持ち、時刻は毎回 AT.audio.beatToTime() で求める（音楽の拍グリッドに対して判定）。
// - 判定時刻は AudioContext.currentTime − 出力遅延。performance.now() は使わない。
// - BPM は毎フレーム AT.audio.setBpm() に目標値を渡し、音側が小節頭でだけ反映する。
window.AT = window.AT || {};
(function (AT) {
  'use strict';

  var R = {
    // 企画書§5の初期値（調整可）
    config: {
      perfect: 0.050, good: 0.110,          // 判定窓(秒, ±)
      dPerfect: 4, dGood: 2, dMiss: -3, dEmpty: -1,
      decayPerSec: 1, idleSec: 1.0,         // 最後の入力から idleSec 秒たつと毎秒 decayPerSec 減る
      comboEvery: 10, comboBonus: 5,
      eighthAt: 60,                         // 以上で小節後半2拍が8分
      rushAt: 90, rushBars: 2,              // 以上で全部8分（最低 rushBars 小節続く）
      rescueAt: 60, rescueEnd: 75,          // 救済開始/必ず100に届く秒
      leadInBars: 1,                        // 開始から何小節ノーツなし
      aheadBars: 1                          // 何小節先までノーツを作っておくか（小さいほど speed への追従が速い）
    },
    speed: 0, combo: 0, maxCombo: 0, bpmTarget: 0,
    running: false, done: false
  };

  var S = null;            // 1ラウンドの状態
  var judgeCbs = [], reachCbs = [];

  function clock() { return (S && S.clock) || AT.audio; }
  function latency() {
    var c = clock();
    return c.getLatency ? c.getLatency() : (c.latency || 0);
  }

  // cfg: {bpmStart, bpmMax, music?, beatsPerBar?, clock?}
  //   または ラウンド定義 {bpm:[start,max], music}
  //   music を渡すと AT.audio.play(music, {bpm: bpmStart}) も行う
  R.start = function (cfg) {
    cfg = cfg || {};
    var bpmStart = cfg.bpmStart || (cfg.bpm && cfg.bpm[0]) || 120;
    var bpmMax = cfg.bpmMax || (cfg.bpm && cfg.bpm[1]) || bpmStart;
    S = {
      clock: cfg.clock || null,
      bpmStart: bpmStart, bpmMax: bpmMax,
      notes: [], perfect: 0, good: 0, miss: 0, empty: 0,
      rescueBase: null, reachTime: null, assisted: false
    };
    var c = clock();
    if (cfg.music && c.play) c.play(cfg.music, { bpm: bpmStart });
    S.bpb = cfg.beatsPerBar || (c.getBeatsPerBar ? c.getBeatsPerBar() : 4);
    var now = c.now();
    S.startTime = now; S.lastUpdate = now; S.lastHit = now;
    S.genBar = Math.ceil(c.timeToBeat(now) / S.bpb - 1e-9) + R.config.leadInBars;
    S.firstBar = S.genBar;
    S.rushUntil = -1;
    R.speed = 0; R.combo = 0; R.maxCombo = 0;
    R.bpmTarget = bpmStart; R.running = true; R.done = false;
    if (c.setBpm) c.setBpm(bpmStart);
    generate();
    return R;
  };

  R.stop = function () { R.running = false; };

  function bpmFor(speed) { return S.bpmStart + (S.bpmMax - S.bpmStart) * speed / 100; }

  function genBarNotes(bar) {
    var cf = R.config, bpb = S.bpb, beats = [], b, base = bar * bpb;
    var rush = bar < S.rushUntil;
    if (!rush && R.speed >= cf.rushAt) { S.rushUntil = bar + cf.rushBars; rush = true; }
    if (rush) {
      for (b = 0; b < bpb; b += 0.5) beats.push(b);
    } else if (R.speed >= cf.eighthAt) {
      var half = Math.ceil(bpb / 2);
      for (b = 0; b < half; b++) beats.push(b);
      for (b = half; b < bpb; b += 0.5) beats.push(b);
    } else {
      for (b = 0; b < bpb; b++) beats.push(b);
    }
    for (var i = 0; i < beats.length; i++) {
      S.notes.push({ beat: base + beats[i], bar: bar, eighth: beats[i] % 1 !== 0 || rush, state: 'pending', diff: null });
    }
  }

  function generate() {
    var c = clock();
    var cur = c.timeToBeat(c.now() - latency());
    while (S.genBar * S.bpb < cur + R.config.aheadBars * S.bpb) genBarNotes(S.genBar++);
    // 古いノーツを捨てる（判定済み & 2小節以上前）
    while (S.notes.length && S.notes[0].state !== 'pending' && S.notes[0].beat < cur - 2 * S.bpb) S.notes.shift();
  }

  function addSpeed(d) { R.speed = Math.max(0, Math.min(100, R.speed + d)); }

  function emit(cbs, arg) {
    for (var i = 0; i < cbs.length; i++) { try { cbs[i](arg); } catch (e) { console.error(e); } }
  }

  function judgeNote(n, result, diff) {
    var cf = R.config;
    n.state = result; n.diff = diff;
    if (result === 'miss') {
      S.miss++; R.combo = 0; addSpeed(cf.dMiss);
    } else {
      if (result === 'perfect') { S.perfect++; addSpeed(cf.dPerfect); } else { S.good++; addSpeed(cf.dGood); }
      R.combo++;
      if (R.combo > R.maxCombo) R.maxCombo = R.combo;
      if (R.combo % cf.comboEvery === 0) addSpeed(cf.comboBonus);
    }
    var info = { result: result, empty: false, diffMs: diff == null ? null : Math.round(diff * 1000), speed: R.speed, combo: R.combo, note: n };
    emit(judgeCbs, info);
    return info;
  }

  // 1打。t は AudioContext 時刻（省略時は現在）。戻り値: 判定情報 or null（走っていない）
  R.hit = function (t) {
    if (!R.running || !S) return null;
    var c = clock(), cf = R.config;
    var now = c.now();
    var tj = (t == null ? now : t) - latency();
    S.lastHit = now;
    var best = null, bestAbs = Infinity;
    for (var i = 0; i < S.notes.length; i++) {
      var n = S.notes[i];
      if (n.state !== 'pending') continue;
      var d = tj - c.beatToTime(n.beat);
      if (Math.abs(d) < bestAbs) { best = n; bestAbs = Math.abs(d); best._d = d; }
      if (d < -cf.good) break;   // 以降はもっと先
    }
    var info;
    if (best && bestAbs <= cf.good) {
      info = judgeNote(best, bestAbs <= cf.perfect ? 'perfect' : 'good', best._d);
    } else {   // 空打ち
      S.empty++; R.combo = 0; addSpeed(cf.dEmpty);
      info = { result: 'miss', empty: true, diffMs: best ? Math.round(best._d * 1000) : null, speed: R.speed, combo: 0, note: null };
      emit(judgeCbs, info);
    }
    checkReach(now);
    return info;
  };

  // 毎フレーム呼ぶ（引数不要。時刻は音の時計から取る）
  R.update = function () {
    if (!R.running || !S) return;
    var c = clock(), cf = R.config;
    var now = c.now(), dt = Math.max(0, now - S.lastUpdate);
    S.lastUpdate = now;
    generate();
    // 叩かれずに通過したノーツ → MISS
    var tj = now - latency();
    for (var i = 0; i < S.notes.length; i++) {
      var n = S.notes[i];
      if (n.state !== 'pending') continue;
      if (c.beatToTime(n.beat) + cf.good < tj) judgeNote(n, 'miss', null); else break;
    }
    // 自然減衰
    if (now - S.lastHit > cf.idleSec) addSpeed(-cf.decayPerSec * dt);
    // 救済: 60秒で届いていなければ 75秒までに必ず100へ（下限を直線で引き上げる）
    var el = now - S.startTime;
    if (el >= cf.rescueAt) {
      if (S.rescueBase == null) S.rescueBase = R.speed;
      var k = Math.min(1, (el - cf.rescueAt) / (cf.rescueEnd - cf.rescueAt));
      var floor = S.rescueBase + (100 - S.rescueBase) * k;
      if (R.speed < floor) R.speed = Math.min(100, floor);
    }
    checkReach(now);
    if (R.running) {
      R.bpmTarget = bpmFor(R.speed);
      if (c.setBpm) c.setBpm(R.bpmTarget);
    }
  };

  function checkReach(now) {
    if (!R.running || R.speed < 100) return;
    R.speed = 100;
    S.reachTime = now - S.startTime;
    S.assisted = S.rescueBase != null;   // 救済区間(60秒以降)に入ってから到達したら assisted
    // 未判定のノーツは成績に入れない
    S.notes = S.notes.filter(function (n) { return n.state !== 'pending'; });
    R.running = false; R.done = true;
    R.bpmTarget = S.bpmMax;
    var st = R.stats();
    console.log('[rhythm] 成績', st);
    emit(reachCbs, st);
  }

  // 成績（企画書§5）。accuracy = (PERFECT + GOOD×0.5) / 全ノーツ数（判定済みノーツ。空打ちは含めない）
  R.stats = function () {
    if (!S) return null;
    var total = S.perfect + S.good + S.miss;
    return {
      accuracy: total ? (S.perfect + S.good * 0.5) / total : 0,
      reachTime: S.reachTime,
      assisted: S.assisted,
      maxCombo: R.maxCombo,
      perfect: S.perfect, good: S.good, miss: S.miss, empty: S.empty, totalNotes: total
    };
  };

  // 描画用: 判定線からの位置つきノーツ。dBeat>0 はこれから来る（拍単位）。x = 判定線x + dBeat×pxPerBeat
  R.getNotes = function (aheadBeats, behindBeats) {
    if (!S) return [];
    var c = clock();
    var cur = c.timeToBeat(c.now() - latency());
    var ah = aheadBeats == null ? 8 : aheadBeats, bh = behindBeats == null ? 1 : behindBeats;
    var out = [];
    for (var i = 0; i < S.notes.length; i++) {
      var n = S.notes[i], db = n.beat - cur;
      if (db < -bh || db > ah) continue;
      out.push({ beat: n.beat, dBeat: db, state: n.state, eighth: n.eighth, diff: n.diff });
    }
    return out;
  };
  // 聞こえている拍位置（レーン・足の回転などの同期用）
  R.getBeat = function () { var c = clock(); return c.timeToBeat(c.now() - latency()); };
  R.elapsed = function () { return S ? clock().now() - S.startTime : 0; };

  R.onJudge = function (fn) { judgeCbs.push(fn); };   // fn({result, empty, diffMs, speed, combo, note})
  R.onReach = function (fn) { reachCbs.push(fn); };   // fn(stats)
  R.offAll = function () { judgeCbs = []; reachCbs = []; };

  AT.rhythm = R;   // 足場 rhythm.js の AT.rhythm を置き換える（rhythm.js より後に読むこと）
})(window.AT);
