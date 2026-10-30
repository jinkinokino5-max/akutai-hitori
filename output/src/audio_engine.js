// audio_engine: 録音 MP3 の再生（BGM・回顧・効果音・ループ環境音）＋ 合成の打楽器（心拍など）
// 2026-10-30 疾走パート刷新で作り直し（旧: 合成曲の拍スケジューラ。archive/リズム版/ 参照）。
//
// 方式: WebAudio（fetch → decodeAudioData → AudioBufferSourceNode）。
//   - HTMLAudio ではなくこちらを選んだ理由: iOS Safari は HTMLAudio の音量(volume)を無視し、
//     複数同時再生・ローパスへの接続(MediaElementSource)にも癖がある。WebAudio なら
//     効果音の同時発音・クロスフェード・ローパス・ループ点指定が一つの仕組みで済む。
//   - 読み込み時には AudioContext を作らない（Chrome が「ユーザー操作前の AudioContext」を警告するため）。
//     起動時は prefetch() で MP3 のバイト列だけ取っておき、最初のタップ(resume)で decode する。
//   - 相対パス（audio/xxx.mp3）。file:// で開いたときは audio/audio_data.js（base64、tools/make_audio_data.py で生成）から読む。
//   - 長い曲は decode 後に 1 秒あたり約 0.35MB（44.1kHz ステレオ float32）を使うので、
//     使い終わった曲は release(id) で捨てる（バイト列は残すので再 decode できる）。
//
// API（AT.audio）
//   prefetch(ids?)                 … MP3 のバイト列を先に取る（ユーザー操作前でよい）。ids 省略で全部
//   init() / resume()              … AudioContext を作る / 再開（input.js が最初の操作で呼ぶ）
//   load(id) → Promise<AudioBuffer> / ready(id) / release(id) / duration(id)（未 decode なら null）
//   playMusic(id, {loop, fadeIn, xfade, volume, offset}) … BGM。今の曲は xfade 秒でフェードアウトし、新しい曲を重ねる
//   stop(fadeSec)                  … BGM をフェードアウトして止める
//   isPlaying() / musicId() / musicElapsed()（曲頭からの秒。未開始なら null）
//   setMuffled(on, sec, freq)      … 回顧のこもり（lowpass 400Hz）。BGM にだけ掛かる
//   sfx(name, {vol, rate})         … 効果音。録音: slash / hit / crash / flash / bike_coast。合成: miss / click / tap
//   loop(name, vol, fadeSec) / loopVolume(name, vol, sec) / loopStop(name, fadeSec) … ループ環境音（dark_loop）
//   voices.kick() / snare() / hat()… 合成の打楽器（襲来の心拍・回顧の叫び）
//   setVolume(v, sec)
window.AT = window.AT || {};
(function (AT) {
  'use strict';

  var BASE = 'audio/';
  var FILES = ['title', 'run_r1', 'run_r2', 'run_r3', 'recall_r1', 'recall_r2', 'recall_r3',
    'sfx_slash', 'sfx_hit', 'sfx_crash', 'sfx_flash', 'sfx_bike_coast', 'sfx_dark_loop'];
  // 効果音の音量（MP3 はピーク -3dBFS にそろえてある。曲は -16 LUFS）。聴感は未確認 → 遊んで調整
  var SFX_VOL = { slash: 0.35, hit: 0.5, crash: 0.85, flash: 1.0, bike_coast: 0.35, dark_loop: 1.0 };

  var ctx = null, master = null, musicBus = null, sfxBus = null, slowFilter = null, noiseBuf = null;
  var bytes = {};      // id → Promise<ArrayBuffer>
  var buffers = {};    // id → AudioBuffer
  var decoding = {};   // id → Promise<AudioBuffer>
  var music = null;    // {id, src, gain, startAt, token}
  var token = 0;       // playMusic/stop のたびに増える（読み込み待ちの古い要求を捨てる）
  var loops = {};      // name → {src, gain}

  var A = { FILES: FILES, SFX_VOL: SFX_VOL };

  // ---------- 読み込み ----------
  // file:// では fetch できないので、予備の audio/audio_data.js（base64）を読み込んでそこから取る
  var dataLoad = null;
  function loadEmbedded() {
    if (!dataLoad) dataLoad = new Promise(function (res, rej) {
      if (AT.AUDIO_DATA) return res(AT.AUDIO_DATA);
      var sc = document.createElement('script');
      sc.src = BASE + 'audio_data.js';
      sc.onload = function () { AT.AUDIO_DATA ? res(AT.AUDIO_DATA) : rej(new Error('audio_data.js が空')); };
      sc.onerror = function () { rej(new Error('audio_data.js を読めない')); };
      document.head.appendChild(sc);
    });
    return dataLoad;
  }
  function embeddedBytes(id) {
    return loadEmbedded().then(function (d) {
      if (!d[id]) throw new Error('埋め込みに無い ' + id);
      var bin = atob(d[id]), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8.buffer;
    });
  }
  function fetchBytes(id) {
    if (!bytes[id]) {
      var viaFetch = location.protocol === 'file:' ? Promise.reject(new Error('file://')) :
        fetch(BASE + id + '.mp3').then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + id);
          return r.arrayBuffer();
        });
      bytes[id] = viaFetch.catch(function () { return embeddedBytes(id); });
      bytes[id].catch(function (e) { console.warn('[audio] 読み込み失敗', id, e); delete bytes[id]; });
    }
    return bytes[id];
  }
  A.prefetch = function (ids) {
    if (typeof fetch === 'undefined') return;
    (ids || FILES).forEach(function (id) { fetchBytes(id).catch(function () {}); });
  };
  function decode(ab) {   // Safari の古い版はコールバック形式しかない
    return new Promise(function (res, rej) {
      var p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }
  A.load = function (id) {
    if (buffers[id]) return Promise.resolve(buffers[id]);
    if (!on()) return Promise.reject(new Error('音はまだ解禁されていない / WebAudio なし'));
    if (!decoding[id]) {
      decoding[id] = fetchBytes(id).then(function (ab) {
        return decode(ab.slice(0));   // decode はバッファを手放す実装があるので複製を渡す（バイト列は再 decode 用に残す）
      }).then(function (buf) {
        buffers[id] = buf; delete decoding[id]; return buf;
      }, function (e) { delete decoding[id]; console.warn('[audio] decode 失敗', id, e); throw e; });
    }
    return decoding[id];
  };
  A.ready = function (id) { return !!buffers[id]; };
  A.duration = function (id) { return buffers[id] ? buffers[id].duration : null; };
  A.release = function (id) { if (!music || music.id !== id) delete buffers[id]; };

  // ---------- 初期化 ----------
  A.init = function () {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // iOS 17+: 消音スイッチ中でも鳴らす（WebAudio は既定で「環境音」扱いのため）
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor();   // 効果音の重なりで割れないよう軽く
    comp.threshold.value = -8; comp.ratio.value = 3;
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
  // ユーザー操作の前は AudioContext を作らない（作ると Chrome が警告する）。
  // resume() が呼ばれるまで、再生系の関数は何もしない
  var unlocked = false;
  function on() { return unlocked && A.init(); }
  A.unlocked = function () { return unlocked; };
  A.resume = function () {   // 最初のユーザー操作で呼ぶ（何度呼んでもよい）
    unlocked = true;
    if (!A.init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  };
  A.ctx = function () { return ctx; };
  A.now = function () { return ctx ? ctx.currentTime : 0; };
  A.setVolume = function (v, sec) {
    if (!on()) return;
    ramp(master.gain, v, sec || 0.02);
  };
  function ramp(param, v, sec) {
    var t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(v, t + Math.max(0.005, sec));
  }

  // 回顧(スロー)中のこもった音。on=true で lowpass 400Hz（企画書§7）。BGM にだけ掛かる
  A.setMuffled = function (muffle, sec, freq) {
    if (!on()) return;
    var t = ctx.currentTime, target = muffle ? (freq || 400) : 20000;
    slowFilter.frequency.cancelScheduledValues(t);
    slowFilter.frequency.setValueAtTime(slowFilter.frequency.value, t);
    slowFilter.frequency.exponentialRampToValueAtTime(target, t + (sec == null ? 0.4 : Math.max(0.01, sec)));
  };

  // ---------- BGM ----------
  function fadeOutMusic(m, sec) {
    if (!m || !ctx) return;
    ramp(m.gain.gain, 0, sec);
    var src = m.src;
    setTimeout(function () { try { if (src) src.stop(); } catch (e) {} try { m.gain.disconnect(); } catch (e) {} }, (sec + 0.1) * 1000);
  }
  A.playMusic = function (id, opts) {
    opts = opts || {};
    if (!on()) return null;
    var my = ++token, xfade = opts.xfade == null ? 0.5 : opts.xfade;
    var old = music; music = null;
    if (old) fadeOutMusic(old, xfade);
    var m = { id: id, src: null, gain: ctx.createGain(), startAt: null, token: my, loop: !!opts.loop };
    m.gain.gain.value = 0;
    m.gain.connect(musicBus);
    music = m;
    A.load(id).then(function (buf) {
      if (token !== my) { try { m.gain.disconnect(); } catch (e) {} return; }
      var src = ctx.createBufferSource();
      src.buffer = buf; src.loop = !!opts.loop;
      src.connect(m.gain);
      var at = ctx.currentTime + 0.03, off = opts.offset || 0;
      src.start(at, off);
      m.src = src; m.startAt = at - off; m.duration = buf.duration;
      var v = opts.volume == null ? 1 : opts.volume, fi = opts.fadeIn || 0.02;
      m.gain.gain.setValueAtTime(0, at);
      m.gain.gain.linearRampToValueAtTime(v, at + fi);
      src.onended = function () { if (music === m && !m.loop) music = null; };
    }).catch(function () {});
    return m;
  };
  A.stop = function (fadeSec) {
    token++;
    var m = music; music = null;
    if (m) fadeOutMusic(m, fadeSec == null ? 0.05 : fadeSec);
  };
  A.isPlaying = function () { return !!music; };
  A.musicId = function () { return music ? music.id : null; };
  // 曲頭からの経過秒（ループ時は通算）。読み込み待ち・未再生なら null
  A.musicElapsed = function () {
    if (!music || music.startAt == null || !ctx) return null;
    return Math.max(0, ctx.currentTime - music.startAt);
  };

  // ---------- 効果音 ----------
  A.sfx = function (name, opts) {
    if (!on()) return;
    opts = opts || {};
    var id = 'sfx_' + name, buf = buffers[id];
    if (!buf && FILES.indexOf(id) >= 0) { A.load(id).catch(function () {}); return synthSfx(name); }
    if (!buf) return synthSfx(name);
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    if (opts.rate) src.playbackRate.value = opts.rate;
    g.gain.value = (opts.vol == null ? 1 : opts.vol) * (SFX_VOL[name] == null ? 0.6 : SFX_VOL[name]);
    src.connect(g); g.connect(sfxBus);
    src.start();
    src.onended = function () { try { g.disconnect(); } catch (e) {} };
    return src;
  };
  // 録音がまだ無いとき・合成の効果音
  function synthSfx(name) {
    var t = ctx.currentTime;
    if (name === 'click' || name === 'accent') return vClick(sfxBus, t, name === 'accent');
    if (name === 'miss' || name === 'slash') return noise(sfxBus, t, 0.08, 'lowpass', name === 'slash' ? 2400 : 600, 1, 0.25);
    if (name === 'crash') { vKick(sfxBus, t); return noise(sfxBus, t, 0.2, 'lowpass', 900, 1, 0.5); }
    if (name === 'bike_coast' || name === 'dark_loop') return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = name === 'hit' ? 1568 : name === 'flash' ? 2093 : 880;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.08);
  }

  // ---------- ループ環境音（闇のざわめき） ----------
  // MP3 の先頭/末尾には約25msの無音が入る（manifest の注記）ので loopStart/loopEnd でそこを飛ばす
  A.loop = function (name, vol, fadeSec) {
    if (!on()) return;
    var id = 'sfx_' + name;
    if (loops[name]) { A.loopVolume(name, vol, fadeSec); return; }
    var L = loops[name] = { src: null, gain: ctx.createGain(), vol: vol || 0 };
    L.gain.gain.value = 0;
    L.gain.connect(sfxBus);
    A.load(id).then(function (buf) {
      if (loops[name] !== L) return;
      var src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      src.loopStart = Math.min(0.05, buf.duration / 4); src.loopEnd = Math.max(src.loopStart + 0.1, buf.duration - 0.05);
      src.connect(L.gain); src.start(ctx.currentTime + 0.02, src.loopStart);
      L.src = src;
      A.loopVolume(name, L.vol, fadeSec || 0.3);
    }).catch(function () {});
  };
  A.loopVolume = function (name, vol, sec) {
    var L = loops[name];
    if (!L || !ctx) return;
    L.vol = vol;
    var v = vol * (SFX_VOL[name] == null ? 1 : SFX_VOL[name]);
    if (sec) ramp(L.gain.gain, v, sec);
    else L.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);   // 毎フレーム呼んでもなめらかに
  };
  A.loopStop = function (name, fadeSec) {
    var L = loops[name];
    if (!L) return;
    delete loops[name];
    if (!ctx) return;
    var f = fadeSec == null ? 0.2 : fadeSec;
    ramp(L.gain.gain, 0, f);
    setTimeout(function () { try { if (L.src) L.src.stop(); } catch (e) {} try { L.gain.disconnect(); } catch (e) {} }, (f + 0.1) * 1000);
  };

  // ---------- 合成の音色（心拍・叫びの打楽器、効果音の予備） ----------
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
  function vHat(bus, t) { noise(bus, t, 0.045, 'highpass', 7000, 0.7, 0.14); }
  function vClick(bus, t, accent) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1760 : 1100;
    g.gain.setValueAtTime(accent ? 0.25 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.05);
  }
  // 合成の打楽器は sfxBus に出す（BGM のこもりの影響を受けない）
  A.voices = {
    kick: function (t) { if (on()) vKick(sfxBus, t || ctx.currentTime); },
    snare: function (t) { if (on()) vSnare(sfxBus, t || ctx.currentTime); },
    hat: function (t) { if (on()) vHat(sfxBus, t || ctx.currentTime); }
  };

  AT.audio = A;
})(window.AT);
