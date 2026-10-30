// main: ループ(requestAnimationFrame)・dt・timeScale・起動
// ?debug          … 左上に状態表示。walk/attack/warp をタップで飛ばせる。疾走中は speed/dark/combo/判定を表示
// ?debug&scene=run&round=2 … 指定シーン・ラウンドから開始（確認用。音は最初のタップで有効になる）
// ?debug では AT.debug.step(秒) で偽の時計を進められる（描画が間引かれる環境での検証用。1/60 秒刻み）
(function (AT) {
  AT.timeScale = 1;   // 回顧のスロー(0.05)で使用
  var ctx, last = 0, paused = false;

  function tick(realDt) {
    try {
      AT.scenes.update(realDt * AT.timeScale, realDt);
      AT.scenes.draw(ctx);
    } catch (e) { console.error(e); }
    if (AT.DEBUG) AT.ui.debug(AT.scenes.debugText ? AT.scenes.debugText() : AT.scenes.current());
  }
  function frame(ms) {
    var realDt = Math.max(0, Math.min(0.1, (ms - last) / 1000)); last = ms;
    if (!paused) tick(realDt);
    requestAnimationFrame(frame);
  }

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function boot() {
    ctx = document.getElementById('screen').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    AT.ui.init();
    if (AT.audio && AT.audio.prefetch) AT.audio.prefetch();   // MP3 のバイト列だけ先に取る（decode は最初のタップ後）
    AT.input.onHit(function (src) { AT.scenes.hit(src); });
    var scene = AT.DEBUG && param('scene'), rnd = AT.DEBUG && param('round');
    AT.scenes.go('title');
    if (scene) {
      if (rnd) AT.state.round = AT.util.clamp(parseInt(rnd, 10) - 1, 0, AT.ROUNDS.length - 1);
      AT.scenes.go(scene);
    }
    if (AT.DEBUG) {
      AT.debug = {
        // 偽の時計で sec 秒進める（1/60 秒刻み、描画は最後に1回）。pause(true) で通常のループを止められる
        step: function (sec, fn) {
          var n = Math.round(sec * 60);
          for (var i = 0; i < n; i++) {
            if (fn) fn(i);
            try { AT.scenes.update(AT.timeScale / 60, 1 / 60); } catch (e) { console.error(e); }
          }
          tick(0);
          return AT.scenes.current();
        },
        pause: function (on) { paused = !!on; }
      };
    }
    requestAnimationFrame(function (ms) { last = ms; requestAnimationFrame(frame); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.AT);
