// scenes: シーン状態機械。T1は色付き矩形＋シーン名の仮表示。
// 流れ: title → walk → attack → recall → warp → run → flash → (次ラウンド walk / ending) → title
// walk は主人公が自転車で帰る夜道（シーン名は据え置き）。
(function (AT) {
  var cur = null, curName = '', t = 0;
  var guard = 0;   // 入力誤爆防止(秒)
  var recallShouted = false;

  function round() { return AT.ROUNDS[AT.state.round]; }
  function go(name) {
    cur = scenes[name]; curName = name; t = 0; guard = 0.25;
    AT.ui.reset();
    if (cur.enter) cur.enter();
  }
  function label(name, hint) {
    var named = (name === 'title' || name === 'ending') ? name : name + '  R' + (AT.state.round + 1);
    AT.ui.sceneName(name === '悪態独り' ? name : named);
    AT.ui.hint(hint || '');
  }

  var scenes = {
    title: {
      color: AT.PALETTE.navy,
      enter: function () { AT.state.round = 0; AT.state.results = []; label('悪態独り', 'タップ / キーではじめる'); },
      hit: function () { go('walk'); }
    },
    walk: {   // 自転車で帰る夜道（現実）。仮：4秒で自動、タップで飛ばせる
      color: AT.PALETTE.indigo,
      enter: function () { label('walk（自転車で帰り道）', ''); AT.ui.mono(AT.util.pick(AT.TEXTS.mono)); },
      update: function () { if (t > 4) go('attack'); },
      hit: function () { go('attack'); }
    },
    attack: {   // 襲来
      color: AT.PALETTE.violet,
      enter: function () { label('attack（襲来）', ''); },
      update: function () { if (t > 2) go('recall'); },
      hit: function () { go('recall'); }
    },
    recall: {   // スロー回顧。タップ/キーで1行ずつ送る（自動送りなし）
      color: '#101a38',
      enter: function () {
        recallShouted = false;
        label('recall（回顧）', 'タップ / キーで次の行');
        var lines = AT.util.pick(AT.TEXTS.recall[round().id]);
        AT.ui.recallStart(lines, function () {
          AT.ui.shout(AT.util.pick(AT.TEXTS.shout));
          AT.ui.hint('タップ / キーで突入');
          recallShouted = true;
        });
      },
      update: function (dt, realDt) { AT.ui.recallUpdate(realDt * 1000); },
      hit: function () { if (recallShouted) go('warp'); else AT.ui.recallAdvance(); }
    },
    warp: {   // 突入
      color: AT.PALETTE.magenta,
      enter: function () { label('warp（突入）', ''); },
      update: function () { if (t > 1.5) go('run'); },
      hit: function () { go('run'); }
    },
    run: {   // 異世界疾走。T2でリズム入力に置換。仮：4秒で自動遷移
      color: function () { return round().accent; },
      enter: function () { label('run（異世界疾走）', '(仮) 自動で進みます'); AT.ui.meter(0); },
      update: function () { AT.ui.meter(t / 4 * 100); if (t > 4) go('flash'); }
    },
    flash: {   // 白光
      color: '#ffffff',
      update: function () {
        if (t > 1.5) {
          AT.state.round++;
          go(AT.state.round < AT.ROUNDS.length ? 'walk' : 'ending');
        }
      }
    },
    ending: {
      color: AT.PALETTE.navy,
      enter: function () {
        label('ending', '');
        AT.ui.ending({ line: AT.TEXTS.ending.A, stats: '(仮) 成績はT6で表示', again: 'もういちど（タップ / キー）' });
      },
      hit: function () { if (t > 0.8) go('title'); }
    }
  };

  AT.scenes = {
    go: go,
    current: function () { return curName; },
    update: function (dt, realDt) {
      t += dt;
      if (guard > 0) guard -= realDt;
      if (cur.update) cur.update(dt, realDt);
    },
    draw: function (ctx) {
      var c = typeof cur.color === 'function' ? cur.color() : cur.color;
      ctx.fillStyle = c; ctx.fillRect(0, 0, AT.W, AT.H);
      // 仮表示の目印（地面と動く矩形）
      ctx.fillStyle = AT.PALETTE.outline; ctx.fillRect(20, 120, AT.W - 40, 40);
      ctx.fillStyle = AT.PALETTE.moon;
      ctx.fillRect(20 + (t * 40) % (AT.W - 60), 130, 20, 20);
    },
    hit: function (src) {
      if (guard > 0) return;
      if (cur.hit) cur.hit(src);
    }
  };
})(window.AT);
