// slash_sim: slash_engine の node シミュレーション。 node output/test/slash_sim.js [seeds]
// 偽の時計(固定 dt=1/60)でプレイヤーモデルを動かし、逃げ切り率などを表にする。
// 注意: プレイヤーモデルは人の実プレイとは未検証。目標値と実プレイが合うかは遊んで確かめること。
var path = require('path');
var S = require(path.join(__dirname, '..', 'src', 'slash_engine.js'));
var C = S.config;
var SEEDS = parseInt(process.argv[2], 10) || 300;
var DT = 1 / 60;
if (process.argv[3]) { var ov = JSON.parse(process.argv[3]); Object.keys(ov).forEach(function (k) { C[k] = (typeof ov[k] === 'object' && !Array.isArray(ov[k])) ? Object.assign({}, C[k], ov[k]) : ov[k]; }); }   // 調整用: 第3引数にJSONで定数を上書き

function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 意図: just/good = その精度で斬ろうとする / whiff = 早すぎて空振り(その障害物は諦める) / crash = 何もしない
function intentModel(pJust, pGood, pWhiffOfFail) {
  return function (rnd) {
    return {
      name: null,
      tick: function () {
        // 一番手前の未処理障害物を狙う
        var t = null, i, o;
        for (i = 0; i < S.obstacles.length; i++) {
          o = S.obstacles[i];
          if (o.slashed || o.crashed) continue;
          if (!t || o.x < t.x) t = o;
        }
        if (!t) return false;
        if (!t._intent) {
          var r = rnd();
          t._intent = r < pJust ? 'just' : r < pJust + pGood ? 'good' : (rnd() < pWhiffOfFail ? 'whiff' : 'crash');
          t._done = false;
        }
        if (t._done) return false;
        var d = t.x - C.bikeX;
        var thr = t._intent === 'just' ? S.reachNow() - 1
                : t._intent === 'good' ? S.reachNow() - S.justWidthNow() - 5
                : t._intent === 'whiff' ? S.reachNow() + 22 : -1e9;
        if (d <= thr) {
          var res = S.slash();
          if (res !== 'blocked') t._done = true;
          return true;
        }
        return false;
      }
    };
  };
}

var MODELS = [
  { name: '上手い(J70/G25/ミス5)', make: intentModel(0.70, 0.25, 0) },
  { name: '普通(J20/G50/失敗30)', make: intentModel(0.20, 0.50, 0.5) },
  { name: '下手(J5/G30/失敗65)', make: intentModel(0.05, 0.30, 0.5) },
  { name: '放置', make: function () { return { tick: function () { return false; } }; } },
  { name: '連打(1/12秒ごと)', make: function () {
      var acc = 0;
      return { tick: function () { acc += DT; if (acc >= 1 / 12) { acc = 0; S.slash(); return true; } return false; } };
    } }
];

function runOne(model, round, seed) {
  var rnd = rng(seed * 31 + round * 1009 + 17);
  var p = model.make(rnd);
  S.start(round, { seed: seed });
  var guard = 0;
  while (S.status === 'running' && guard++ < 60 * 90) {
    p.tick();
    S.update(DT);
  }
  return S.result();
}

function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : NaN; }
function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / (a.length || 1); }
function pad(s, n) { s = String(s); var w = 0, i; for (i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 2 : 1; return s + new Array(Math.max(0, n - w + 1)).join(' '); }

function report() {
  console.log('slash_sim: seeds=' + SEEDS + ', dt=1/60, 1ラウンド=' + C.duration + '秒 (各ラウンドは speed=' + C.speedStart + ', dark=' + C.darkStart + ' から開始)');
  console.log(pad('モデル', 24) + pad('R', 3) + pad('逃げ切り', 9) + pad('呑まれ秒(中央)', 15) + pad('終了速度', 9) + pad('平均コンボ', 11) + pad('最大コンボ', 11) + pad('斬率', 7) + '平均得点');
  var summary = {};
  MODELS.forEach(function (m) {
    for (var r = 0; r < 3; r++) {
      var esc = 0, dieT = [], spd = [], cmb = [], mx = [], sr = [], sc = [];
      for (var s = 1; s <= SEEDS; s++) {
        var res = runOne(m, r, s);
        if (res.escaped) esc++; else dieT.push(res.time);
        spd.push(res.speed); mx.push(res.maxCombo); sr.push(res.slashRate); sc.push(res.score);
        cmb.push(res.maxCombo);
      }
      summary[m.name + r] = esc / SEEDS;
      console.log(pad(m.name, 24) + pad('R' + (r + 1), 3) + pad((esc / SEEDS * 100).toFixed(0) + '%', 9) +
        pad(dieT.length ? median(dieT).toFixed(1) : '-', 15) + pad(mean(spd).toFixed(0), 9) +
        pad(mean(cmb).toFixed(1), 11) + pad(median(mx), 11) + pad((mean(sr) * 100).toFixed(0) + '%', 7) + mean(sc).toFixed(0));
    }
  });
  console.log('(平均コンボ列=ラウンド中の最大コンボの平均 / 最大コンボ列=その中央値 / 斬率=斬った数÷(斬った+衝突))');
  console.log('3ラウンド全部逃げ切り率(独立試行の積): ' + MODELS.map(function (m) {
    return m.name.split('(')[0] + ' ' + (summary[m.name + 0] * summary[m.name + 1] * summary[m.name + 2] * 100).toFixed(0) + '%';
  }).join(' / '));
}
module.exports = { MODELS: MODELS, runOne: runOne, median: median, mean: mean };
if (require.main === module) report();
