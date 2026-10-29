// songs: 曲データの橋渡し（統合）。songs_tell / songs_pomp / songs_ode の「後」に読むこと。
// - 曲は AT.SONGS に統一。旧足場の差し替え口 AT.MUSIC は AT.SONGS と同じオブジェクトを指す（どちらで引いても同じ）。
// - ドラムの書式を audio_engine の文字列ステップ形式（文字数で小節を等分）にそろえる:
//     songs_ode  … "K:1 S:1 K:1 S:1"（打楽器名:拍）
//     songs_pomp … {kick:'x:1 ...', snare:'r:1 x:1 ...', hat:'...'}
//   どちらも 16分(0.25拍)グリッドの文字列（例 "K...S...K...S..."）に変換する。
//   ※ そのまま渡すと audio_engine は ':' や数字を1ステップとして数えるため、拍がずれる（pomp は "[object Object]" の O をオープンハットと解釈する）。
// 旧足場の内容は archive/統合前の足場/songs.js。
window.AT = window.AT || {};
(function (AT) {
  AT.SONGS = AT.SONGS || {};
  AT.MUSIC = AT.SONGS;

  var RES = 4;   // 1拍 = 4ステップ（16分）
  var KIND = { K: 'K', S: 'S', H: 'H', O: 'O', X: 'X', Y: 'Y', Z: 'Z', W: 'W' };

  // 1ステップに重なった打楽器を1文字にまとめる（audio_engine: X=K+H, Y=S+H, Z=K+S, W=K+S+H）
  function merge(a, b) {
    if (!a || a === '.') return b;
    var set = a + b;
    var k = /[KXZW]/.test(set), s = /[SYZW]/.test(set), h = /[HXYW]/.test(set), o = /O/.test(set);
    if (k && s && h) return 'W';
    if (k && s) return 'Z';
    if (k && h) return 'X';
    if (s && h) return 'Y';
    if (k) return 'K';
    if (s) return 'S';
    if (o) return 'O';
    return h ? 'H' : '.';
  }

  // "K:1 S:0.5 r:0.5 ..." → ステップ配列に letter を置く（letterOverride があれば x をそれに置換）
  function place(steps, seq, letterOverride) {
    var pos = 0, toks = String(seq).trim().split(/\s+/).filter(Boolean);
    for (var i = 0; i < toks.length; i++) {
      var p = toks[i].split(':'), name = p[0], dur = parseFloat(p[1]);
      if (!(dur > 0)) return false;
      var idx = Math.round(pos * RES);
      if (name !== 'r' && name !== 'R' && idx < steps.length) {
        var L = letterOverride && name === 'x' ? letterOverride : name.toUpperCase();
        for (var c = 0; c < L.length; c++) if (KIND[L[c]]) steps[idx] = merge(steps[idx], L[c]);
      }
      pos += dur;
    }
    return true;
  }

  function normalizeDrums(drums, bpb) {
    if (drums == null || drums === '') return drums;
    var steps = [], i;
    for (i = 0; i < bpb * RES; i++) steps.push('.');
    if (typeof drums === 'object') {
      if (drums.kick) place(steps, drums.kick, 'K');
      if (drums.snare) place(steps, drums.snare, 'S');
      if (drums.hat) place(steps, drums.hat, 'H');
      if (drums.ohat) place(steps, drums.ohat, 'O');
      return steps.join('');
    }
    if (String(drums).indexOf(':') < 0) return drums;   // すでに文字列ステップ形式
    return place(steps, drums) ? steps.join('') : drums;
  }

  AT.normalizeSong = function (song) {
    if (!song || !song.bars || song._normalized) return song;
    var bpb = song.beatsPerBar || 4;
    song.bars.forEach(function (bar) { if (bar.drums != null) bar.drums = normalizeDrums(bar.drums, bpb); });
    song._normalized = true;
    return song;
  };
  AT._normalizeDrums = normalizeDrums;   // node 検証用
  Object.keys(AT.SONGS).forEach(function (id) { AT.normalizeSong(AT.SONGS[id]); });
})(window.AT);
