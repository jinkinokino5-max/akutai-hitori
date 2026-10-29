// core: AT名前空間・定数・パレット・ユーティリティ
window.AT = window.AT || {};
(function (AT) {
  AT.W = 320; AT.H = 180;
  AT.DEBUG = /[?&]debug\b/.test(location.search);
  // 企画書§7 夜色。差し色はラウンドごとに rounds.js の accent
  AT.PALETTE = {
    navy: '#0a0b1e', indigo: '#1b2350', violet: '#2c1f4a',
    lamp: '#ffb347', moon: '#e8f0ff', magenta: '#ff2e88', outline: '#05060f'
  };
  AT.state = { round: 0, results: [] };   // round: 0〜2
  AT.util = {
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    // シード付き乱数 (mulberry32)
    rng: function (seed) {
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  };
})(window.AT);
