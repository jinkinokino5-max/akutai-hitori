// audio_engine: 音の時計 + モーグ風シンセ + 曲再生（開発プラン T2 / T3シンセ部分）
// API仕様: draft/api_audio_rhythm.md
// - 時計は AudioContext.currentTime のみ。拍位置は「テンポ区間(segment)」の列で管理し、
//   BPM変更は必ず小節頭で反映する（判定グリッドがずれないように）。
// - スケジューラ: 25msごとに起きて100ms先までの音を予約する。
// - クラシック<script>で読める形。読み込み時には AudioContext を作らない（init/resume/play で作る）。
window.AT = window.AT || {};
(function (AT) {
  'use strict';

  var LOOKAHEAD = 0.100;   // 秒: これだけ先まで予約
  var TICK_MS = 25;        // スケジューラ間隔

  // ---------- 純粋関数（node でもテスト可能） ----------
  var NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // "C#4" / "Bb3" / "E5" → 周波数(Hz)。休符 "r" は null
  function noteFreq(name) {
    if (!name || name === 'r' || name === 'R') return null;
    var m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(name).trim());
    if (!m) throw new Error('音名が読めない: ' + name);
    var idx = NOTE_IDX[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    var midi = (parseInt(m[3], 10) + 1) * 12 + idx;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // "E5:0.5 r:0.5 G5:1" → [{beat, dur, note, freq}]（休符は含めない） + total(拍)
  function parseSeq(str) {
    var out = [], pos = 0;
    var toks = String(str || '').trim().split(/\s+/).filter(Boolean);
    for (var i = 0; i < toks.length; i++) {
      var p = toks[i].split(':');
      if (p.length !== 2) throw new Error('書式は 音名:拍 : ' + toks[i]);
      var dur = parseFloat(p[1]);
      if (!(dur > 0)) throw new Error('拍数が不正: ' + toks[i]);
      var f = noteFreq(p[0]);
      if (f !== null) out.push({ beat: pos, dur: dur, note: p[0], freq: f });
      pos += dur;
    }
    out.total = pos;
    return out;
  }

  // ドラム文字列 → [{beat, kind}]。文字数で小節を等分。
  // K=キック S=スネア H=ハット O=オープンハット X=キック+ハット Y=スネア+ハット Z=キック+スネア W=キック+スネア+ハット .=休み
  // （Z/W は統合時に追加: songs_pomp の4つ打ち+2・4拍スネアの同時打ちを表すため）
  var DRUM_MAP = { K: ['kick'], S: ['snare'], H: ['hat'], O: ['ohat'], X: ['kick', 'hat'], Y: ['snare', 'hat'], Z: ['kick', 'snare'], W: ['kick', 'snare', 'hat'] };
  function parseDrums(str, beatsPerBar) {
    var s = String(str).replace(/\s+/g, '');
    var out = [], step = beatsPerBar / s.length;
    for (var i = 0; i < s.length; i++) {
      var kinds = DRUM_MAP[s[i].toUpperCase()];
      if (!kinds) continue;
      for (var k = 0; k < kinds.length; k++) out.push({ beat: i * step, kind: kinds[k] });
    }
    return out;
  }
  function defaultDrums(beatsPerBar) {   // 4つ打ちキック + 裏ハット
    var s = ''; for (var i = 0; i < beatsPerBar; i++) s += 'KH';
    return s;
  }

  // 曲データの1小節 → 発音イベント列（beat は小節内の拍位置）
  function buildBarEvents(bar, beatsPerBar) {
    var ev = [], i, seq;
    if (bar.melody) {
      seq = parseSeq(bar.melody);
      for (i = 0; i < seq.length; i++) if (seq[i].beat < beatsPerBar)
        ev.push({ beat: seq[i].beat, kind: 'lead', freq: seq[i].freq, dur: Math.min(seq[i].dur, beatsPerBar - seq[i].beat) });
    }
    if (bar.bass) {
      seq = parseSeq(bar.bass);
      for (i = 0; i < seq.length; i++) if (seq[i].beat < beatsPerBar)
        ev.push({ beat: seq[i].beat, kind: 'bass', freq: seq[i].freq, dur: Math.min(seq[i].dur, beatsPerBar - seq[i].beat) });
    }
    if (bar.chord && bar.chord.length) {
      ev.push({ beat: 0, kind: 'pad', freqs: bar.chord.map(noteFreq).filter(function (f) { return f; }), dur: beatsPerBar });
    }
    var dr = parseDrums(bar.drums != null && bar.drums !== '' ? bar.drums : defaultDrums(beatsPerBar), beatsPerBar);
    for (i = 0; i < dr.length; i++) ev.push(dr[i]);
    ev.sort(function (a, b) { return a.beat - b.beat; });
    return ev;
  }

  // 曲データの検査。問題を文字列配列で返す（空なら OK）
  function validateSong(song) {
    var errs = [];
    if (!song || !song.bars || !song.bars.length) return ['bars がない'];
    var bpb = song.beatsPerBar || 4;
    if (!(song.bpmBase > 0)) errs.push('bpmBase が不正');
    if (song.bpmMax != null && !(song.bpmMax >= song.bpmBase)) errs.push('bpmMax < bpmBase');
    song.bars.forEach(function (bar, n) {
      ['melody', 'bass'].forEach(function (key) {
        if (!bar[key]) return;
        try {
          var t = parseSeq(bar[key]).total;
          if (Math.abs(t - bpb) > 1e-6) errs.push('小節' + (n + 1) + ' ' + key + ': 合計' + t + '拍（' + bpb + '拍のはず）');
        } catch (e) { errs.push('小節' + (n + 1) + ' ' + key + ': ' + e.message); }
      });
      (bar.chord || []).forEach(function (c) {
        try { noteFreq(c); } catch (e) { errs.push('小節' + (n + 1) + ' chord: ' + e.message); }
      });
    });
    return errs;
  }

  // テンポ区間: [{beat, time, bpm}]（beat 昇順）。拍⇔時刻の変換
  function segFor(segs, key, v) {
    var s = segs[0];
    for (var i = 1; i < segs.length; i++) { if (segs[i][key] <= v) s = segs[i]; else break; }
    return s;
  }
  function timeToBeatSegs(segs, t) {
    if (!segs.length) return 0;
    var s = segFor(segs, 'time', t);
    return s.beat + (t - s.time) * s.bpm / 60;
  }
  function beatToTimeSegs(segs, b) {
    if (!segs.length) return 0;
    var s = segFor(segs, 'beat', b);
    return s.time + (b - s.beat) * 60 / s.bpm;
  }

  // ---------- 状態 ----------
  var ctx = null, master = null, musicBus = null, sfxBus = null, slowFilter = null, noiseBuf = null;
  var session = null;      // 再生中の曲: {bus, mode, ...}
  var timer = null;
  var segs = [];           // テンポ区間
  var pendingBpm = null;   // 次の小節頭で反映する BPM
  var barListeners = [];
  var parsedCache = {};

  var A = {
    LOOKAHEAD: LOOKAHEAD,
    latency: null,         // 入力判定で引く出力遅延(秒)。null なら ctx.outputLatency||baseLatency を使う
    // 純粋関数（テスト・曲担当の検証用）
    noteFreq: noteFreq, parseSeq: parseSeq, parseDrums: parseDrums, buildBarEvents: buildBarEvents,
    validateSong: validateSong, _timeToBeatSegs: timeToBeatSegs, _beatToTimeSegs: beatToTimeSegs
  };

  // ---------- 初期化 ----------
  A.init = function () {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    // 叩きすぎで割れないよう軽いコンプ
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    slowFilter = ctx.createBiquadFilter(); slowFilter.type = 'lowpass';
    slowFilter.frequency.value = 20000; slowFilter.Q.value = 0.7;
    musicBus = ctx.createGain(); musicBus.connect(slowFilter); slowFilter.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  };
  A.resume = function () {   // 最初のユーザー操作で呼ぶ（何度呼んでもよい）
    if (!A.init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  };
  A.ctx = function () { return ctx; };
  A.now = function () { return ctx ? ctx.currentTime : 0; };
  A.getLatency = function () {
    if (A.latency != null) return A.latency;
    if (!ctx) return 0;
    return ctx.outputLatency || ctx.baseLatency || 0;
  };

  // ---------- マスター / スロー ----------
  A.setVolume = function (v, sec) {
    if (!A.init()) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(v, t + (sec || 0.02));
  };
  // 回顧(スロー)中のこもった音。on=true で lowpass 400Hz（企画書§7）
  A.setMuffled = function (on, sec, freq) {
    if (!A.init()) return;
    var t = ctx.currentTime, target = on ? (freq || 400) : 20000;
    slowFilter.frequency.cancelScheduledValues(t);
    slowFilter.frequency.setValueAtTime(slowFilter.frequency.value, t);
    slowFilter.frequency.exponentialRampToValueAtTime(target, t + (sec == null ? 0.4 : Math.max(0.01, sec)));
  };

  // ---------- 音色 ----------
  function env(g, t, peak, a, d, sus, end, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, d);
    g.gain.setTargetAtTime(0.0001, end, rel);
  }
  // モーグ風リード: ノコギリ2本 ±7cent → lowpass(Q≈8, カットオフのエンベロープ) → ゲイン
  function vLead(bus, t, f, dur, vel) {
    var end = t + dur * 0.92;
    var g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 8;
    var base = Math.min(Math.max(f * 1.5, 300), 6000), peak = Math.min(Math.max(f * 8, 1500), 12000);
    lp.frequency.setValueAtTime(base, t);
    lp.frequency.linearRampToValueAtTime(peak, t + 0.012);
    lp.frequency.setTargetAtTime(base * 1.6, t + 0.012, 0.09);
    env(g, t, 0.16 * (vel || 1), 0.006, 0.12, 0.65, end, 0.035);
    [-7, 7].forEach(function (cent) {
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f; o.detune.value = cent;
      o.connect(lp); o.start(t); o.stop(end + 0.3);
    });
    lp.connect(g); g.connect(bus);
  }
  // 矩形ベース（lowpassで丸める）
  function vBass(bus, t, f, dur) {
    var end = t + dur * 0.85;
    var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.setTargetAtTime(350, t, 0.08);
    env(g, t, 0.15, 0.005, 0.15, 0.7, end, 0.03);
    o.connect(lp); lp.connect(g); g.connect(bus);
    o.start(t); o.stop(end + 0.3);
  }
  // 和音パッド（控えめ、小節ぶん伸ばす）
  function vPad(bus, t, freqs, dur) {
    if (!freqs.length) return;
    var end = t + dur * 0.97;
    var lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1400, t + dur * 0.5);
    env(g, t, 0.05, 0.04, 0.4, 0.8, end, 0.06);
    freqs.forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f; o.detune.value = (i % 2 ? 5 : -5);
      o.connect(lp); o.start(t); o.stop(end + 0.4);
    });
    lp.connect(g); g.connect(bus);
  }
  function vKick(bus, t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.35);
  }
  function noise(bus, t, len, type, freq, q, peak) {
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + len + 0.02);
  }
  function vSnare(bus, t) {
    noise(bus, t, 0.18, 'bandpass', 1800, 0.8, 0.45);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.1);
  }
  function vHat(bus, t, open) { noise(bus, t, open ? 0.25 : 0.045, 'highpass', 7000, 0.7, open ? 0.12 : 0.14); }
  // 判定確認用のクリック（accent=小節頭）
  function vClick(bus, t, accent) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1760 : 1100;
    g.gain.setValueAtTime(accent ? 0.25 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.05);
  }

  function playEvent(bus, ev, t, spb) {
    switch (ev.kind) {
      case 'lead': vLead(bus, t, ev.freq, ev.dur * spb, ev.vel); break;
      case 'bass': vBass(bus, t, ev.freq, ev.dur * spb); break;
      case 'pad': vPad(bus, t, ev.freqs, ev.dur * spb); break;
      case 'kick': vKick(bus, t); break;
      case 'snare': vSnare(bus, t); break;
      case 'hat': vHat(bus, t, false); break;
      case 'ohat': vHat(bus, t, true); break;
      case 'click': vClick(bus, t, ev.accent); break;
    }
  }

  // 効果音（判定のフィードバック等）。name: 'tap' | 'perfect' | 'good' | 'miss' | 'click' | 'accent'
  A.sfx = function (name, when) {
    if (!A.init()) return;
    var t = when || ctx.currentTime;
    if (name === 'click' || name === 'accent') return vClick(sfxBus, t, name === 'accent');
    if (name === 'miss') return noise(sfxBus, t, 0.08, 'lowpass', 600, 1, 0.25);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = name === 'perfect' ? 2093 : name === 'good' ? 1568 : 880;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.08);
  };
  A.voices = {   // 直接鳴らしたいとき用（bus 省略で musicBus）
    lead: function (f, dur, t) { A.init(); vLead(musicBus, t || ctx.currentTime, f, dur || 0.3, 1); },
    bass: function (f, dur, t) { A.init(); vBass(musicBus, t || ctx.currentTime, f, dur || 0.3); },
    kick: function (t) { A.init(); vKick(musicBus, t || ctx.currentTime); },
    snare: function (t) { A.init(); vSnare(musicBus, t || ctx.currentTime); },
    hat: function (t) { A.init(); vHat(musicBus, t || ctx.currentTime, false); }
  };

  // ---------- 曲データ ----------
  function findSong(id) {
    if (id && typeof id === 'object') return id;
    return (AT.SONGS && AT.SONGS[id]) || (AT.MUSIC && AT.MUSIC[id]) || null;
  }
  function parsedBars(song) {
    var key = song.id || song.title;
    if (key && parsedCache[key] && parsedCache[key].src === song) return parsedCache[key].bars;
    var bpb = song.beatsPerBar || 4;
    var bars = song.bars.map(function (b) { return buildBarEvents(b, bpb); });
    if (key) parsedCache[key] = { src: song, bars: bars };
    return bars;
  }

  // ---------- 再生 ----------
  // music: {type:'synth', song:'tell'} | {type:'click'} | {type:'file', src, bpm, offset, beatsPerBar}
  // opts: {bpm: 開始BPM, delay: 開始までの秒(既定0.1), metronome: true でクリックを重ねる}
  A.play = function (music, opts) {
    opts = opts || {};
    if (!A.init()) return null;
    A.resume();
    A.stop(0.03);
    var start = ctx.currentTime + (opts.delay == null ? 0.1 : opts.delay);
    var bus = ctx.createGain(); bus.connect(musicBus);
    session = { bus: bus, mode: music.type || 'synth', music: music, barNo: 0, metronome: !!opts.metronome, cur: null };
    segs = []; pendingBpm = null;

    if (session.mode === 'synth') {
      var song = findSong(music.song);
      if (!song) { console.warn('[audio] 曲が見つからない: ' + music.song + '（クリックで代用）'); session.mode = 'click'; }
      else {
        session.song = song;
        session.bars = parsedBars(song);
        session.bpb = song.beatsPerBar || 4;
        session.bpm = opts.bpm || song.bpmBase || 120;
        if (song.unverified && song.unverified.length) console.info('[audio] ' + (song.title || song.id) + ' 未照合:', song.unverified);
      }
    }
    if (session.mode === 'click') { session.bpb = music.beatsPerBar || 4; session.bpm = opts.bpm || music.bpm || 120; }
    if (session.mode === 'file') return startFile(music, opts, start);

    startBar(start, 0);
    tick();
    if (!timer) timer = setInterval(tick, TICK_MS);
    return session;
  };

  A.stop = function (fadeSec) {
    if (!session) return;
    var s = session; session = null;
    if (ctx) {
      var t = ctx.currentTime, f = fadeSec == null ? 0.05 : fadeSec;
      s.bus.gain.cancelScheduledValues(t);
      s.bus.gain.setValueAtTime(s.bus.gain.value, t);
      s.bus.gain.linearRampToValueAtTime(0, t + Math.max(0.005, f));
      setTimeout(function () { try { s.bus.disconnect(); } catch (e) {} }, (f + 0.5) * 1000);
    }
    if (s.el) { var el = s.el; setTimeout(function () { el.pause(); }, (fadeSec || 0) * 1000); }
    if (s.rateTimers) s.rateTimers.forEach(clearTimeout);
  };
  A.isPlaying = function () { return !!session; };

  // 次の小節頭で反映するBPM（何度呼んでもよい。最後の値が使われる）
  A.setBpm = function (bpm) { if (bpm > 0) pendingBpm = bpm; };
  A.getBpm = function () {   // いま鳴っている小節のBPM
    if (!segs.length) return session ? session.bpm : 0;
    return segFor(segs, 'time', A.now()).bpm;
  };
  A.getBeatsPerBar = function () { return session ? session.bpb : 4; };
  A.timeToBeat = function (t) { return timeToBeatSegs(segs, t); };
  A.beatToTime = function (b) { return beatToTimeSegs(segs, b); };
  // 現在の拍位置（曲頭=0。開始前は負）。latency=true で出力遅延ぶん戻した「聞こえている拍」
  A.getBeat = function (heard) { return A.timeToBeat(A.now() - (heard ? A.getLatency() : 0)); };
  A.getBar = function (heard) { return Math.floor(A.getBeat(heard) / A.getBeatsPerBar()); };
  // 小節が予約されるたびに呼ばれる: fn({barNo, songBar, time, beat, bpm})
  A.onBar = function (fn) { barListeners.push(fn); };

  function pushSeg(seg) {
    segs.push(seg);
    if (segs.length > 16) segs.splice(0, segs.length - 16);
  }

  function startBar(time, beat) {
    var s = session;
    if (pendingBpm) { s.bpm = pendingBpm; pendingBpm = null; }
    pushSeg({ beat: beat, time: time, bpm: s.bpm });
    var events = [], songBar = -1;
    if (s.mode === 'synth') {
      var n = s.bars.length;
      songBar = s.song.loop === false ? (s.barNo < n ? s.barNo : -1) : s.barNo % n;
      if (songBar >= 0) events = s.bars[songBar].slice();
    }
    if (s.mode === 'click' || s.metronome) {
      for (var i = 0; i < s.bpb; i++) events.push({ beat: i, kind: 'click', accent: i === 0 });
      events.sort(function (a, b) { return a.beat - b.beat; });
    }
    s.cur = { time: time, beat: beat, bpm: s.bpm, events: events, idx: 0, barNo: s.barNo, songBar: songBar };
    var info = { barNo: s.barNo, songBar: songBar, time: time, beat: beat, bpm: s.bpm };
    s.barNo++;
    for (var k = 0; k < barListeners.length; k++) { try { barListeners[k](info); } catch (e) { console.error(e); } }
  }

  function tick() {
    var s = session;
    if (!s || !ctx) return;
    if (s.mode === 'file') return tickFile(s);
    var horizon = ctx.currentTime + LOOKAHEAD;
    var guard = 0;
    while (guard++ < 512) {
      var c = s.cur, spb = 60 / c.bpm;
      if (c.idx < c.events.length) {
        var ev = c.events[c.idx], t = c.time + ev.beat * spb;
        if (t >= horizon) break;
        if (t >= ctx.currentTime - 0.02) playEvent(s.bus, ev, Math.max(t, ctx.currentTime), spb);
        c.idx++;
      } else {
        var endT = c.time + s.bpb * spb;
        if (endT >= horizon) break;
        startBar(endT, c.beat + s.bpb);
        if (session !== s) return;
      }
    }
  }
  A._tick = tick;   // テスト用

  // ---------- type:'file'（差し替え音源） ----------
  // HTMLAudioElement で再生（file:// でも fetch 不要）。テンポ上昇は playbackRate（ピッチも上がる＝早回し）。
  // 判定グリッドは offset + 拍数×60/bpm（メディア時間）。ループ時は曲長ぶん拍を足して連続させる。
  // ※ブラウザでの実音確認は未確認。ループ素材は小節の整数倍の長さにすること。
  function startFile(music, opts, start) {
    var s = session;
    s.fileBpm = music.bpm || 120;
    s.offset = music.offset || 0;
    s.bpb = music.beatsPerBar || 4;
    s.bpm = opts.bpm || s.fileBpm;
    s.rate = s.bpm / s.fileBpm;
    s.loops = 0; s.lastMedia = 0; s.rateTimers = [];
    s.nextBar = 0;
    var el = new Audio(music.src);
    el.loop = music.loop !== false;
    el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false;
    el.playbackRate = s.rate;
    s.el = el;
    // 仮の区間（実再生が始まったら tickFile で補正）
    pushSeg({ beat: -s.offset * s.fileBpm / 60, time: start, bpm: s.bpm });
    var p = el.play();
    if (p && p.catch) p.catch(function (e) { console.warn('[audio] file 再生失敗', e); });
    if (!timer) timer = setInterval(tick, TICK_MS);
    return s;
  }
  function tickFile(s) {
    var el = s.el, now = ctx.currentTime;
    if (!el.paused && el.readyState >= 2) {
      var m = el.currentTime;
      if (m + 1 < s.lastMedia) s.loops++;   // ループで巻き戻った
      s.lastMedia = m;
      var dur = isFinite(el.duration) ? el.duration : 0;
      var measured = (s.loops * dur + m - s.offset) * s.fileBpm / 60;
      var predicted = timeToBeatSegs(segs, now);
      var errSec = (measured - predicted) * 60 / (s.fileBpm * s.rate);
      var lastSeg = segs[segs.length - 1];
      // 30ms以上ずれたら補正（未来の区間が予約済みのとき・1秒以上の飛び＝シーク等は無視）
      if (lastSeg.time <= now) {
        if (Math.abs(errSec) > 0.03 && (!s.synced || Math.abs(errSec) < 1)) {
          pushSeg({ beat: measured, time: now, bpm: s.fileBpm * s.rate });
        }
        s.synced = true;
      }
    }
    // 小節頭でテンポ（playbackRate）を変える
    var bpb = s.bpb;
    var curBeat = timeToBeatSegs(segs, now);
    if (s.nextBar * bpb <= curBeat) s.nextBar = Math.floor(curBeat / bpb) + 1;
    var nb = s.nextBar * bpb, tb = beatToTimeSegs(segs, nb);
    if (tb < now + LOOKAHEAD) {
      var info = { barNo: s.nextBar, songBar: -1, time: tb, beat: nb, bpm: s.bpm };
      if (pendingBpm) {
        s.bpm = pendingBpm; pendingBpm = null;
        var rate = s.bpm / s.fileBpm;
        s.rate = rate; info.bpm = s.bpm;
        pushSeg({ beat: nb, time: tb, bpm: s.bpm });
        s.rateTimers.push(setTimeout(function () { el.playbackRate = rate; }, Math.max(0, (tb - now) * 1000)));
      }
      s.nextBar++;
      for (var k = 0; k < barListeners.length; k++) { try { barListeners[k](info); } catch (e) { console.error(e); } }
    }
  }

  AT.audio = A;   // 足場 audio.js の AT.audio を置き換える（audio.js より後に読むこと）
})(window.AT);
