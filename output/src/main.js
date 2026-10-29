// main: ループ(requestAnimationFrame)・dt・timeScale・起動
(function (AT) {
  AT.timeScale = 1;   // 回顧のスロー(0.05)などで使用。T7
  var ctx, last = 0;

  function frame(ms) {
    var realDt = Math.max(0, Math.min(0.1, (ms - last) / 1000)); last = ms;
    AT.scenes.update(realDt * AT.timeScale, realDt);
    AT.scenes.draw(ctx);
    AT.ui.debug('scene: ' + AT.scenes.current() + '  round: ' + (AT.state.round + 1));
    requestAnimationFrame(frame);
  }

  function boot() {
    ctx = document.getElementById('screen').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    AT.ui.init();
    AT.input.onHit(function (src) { AT.scenes.hit(src); });
    AT.scenes.go('title');
    requestAnimationFrame(function (ms) { last = ms; requestAnimationFrame(frame); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.AT);
