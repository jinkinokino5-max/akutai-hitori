// input: キー/ポインタ → AT.input.onHit(cb)。e.repeat無視。最初の操作でAudioContext resume。
(function (AT) {
  var cbs = [];
  function hit(src) {
    if (AT.audio && AT.audio.resume) AT.audio.resume();   // T2以降で実体化
    for (var i = 0; i < cbs.length; i++) cbs[i](src);
  }
  AT.input = {
    onHit: function (cb) { cbs.push(cb); },
    hit: hit   // テスト・擬似入力用
  };
  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^F\d+$/.test(e.key)) return;   // F5/F12等はブラウザに任せる
    e.preventDefault();
    hit('key');
  });
  window.addEventListener('pointerdown', function (e) { e.preventDefault(); hit('pointer'); }, { passive: false });
})(window.AT);
