// main: ループ(requestAnimationFrame)・dt・timeScale・起動
// ?debug          … 左上に状態表示。walk/attack/warp をタップで飛ばせる
// ?debug&scene=run&round=2 … 指定シーン・ラウンドから開始（確認用。音は最初のタップで有効になる）
(function (AT) {
  AT.timeScale = 1;   // 回顧のスロー(0.05)で使用
  var ctx, last = 0;

  function frame(ms) {
    var realDt = Math.max(0, Math.min(0.1, (ms - last) / 1000)); last = ms;
    try {
      AT.scenes.update(realDt * AT.timeScale, realDt);
      AT.scenes.draw(ctx);
    } catch (e) { console.error(e); }
    if (AT.DEBUG) AT.ui.debug(AT.scenes.debugText ? AT.scenes.debugText() : AT.scenes.current());
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
    AT.input.onHit(function (src) { AT.scenes.hit(src); });
    var scene = AT.DEBUG && param('scene'), rnd = AT.DEBUG && param('round');
    AT.scenes.go('title');
    if (scene) {
      if (rnd) AT.state.round = AT.util.clamp(parseInt(rnd, 10) - 1, 0, AT.ROUNDS.length - 1);
      AT.scenes.go(scene);
    }
    requestAnimationFrame(function (ms) { last = ms; requestAnimationFrame(frame); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.AT);
