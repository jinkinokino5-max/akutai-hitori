// ui: #ui オーバーレイの文字表示。回顧文はタップ/キーで1行ずつ送る(自動送りなし)。
(function (AT) {
  var el = {};
  var recall = null;   // {lines, idx, chars, timer, onDone}
  var CHAR_MS = 40;

  function init() {
    ['debug', 'scene-name', 'mono', 'recall', 'shout', 'judge', 'meter', 'ending', 'end-line', 'end-stats', 'end-again', 'hint']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  function render() {
    var r = recall;
    if (!r) return;
    var html = '';
    for (var i = 0; i <= r.idx; i++) html += '<div class="ln"></div>';
    el.recall.innerHTML = html;
    var divs = el.recall.children;
    for (var j = 0; j <= r.idx; j++) divs[j].textContent = j < r.idx ? r.lines[j] : r.lines[j].slice(0, r.chars);
  }
  function nextLine() {
    recall.idx++; recall.chars = 0; recall.timer = 0; render();
  }

  var ui = AT.ui = {
    init: init,
    sceneName: function (t) { el['scene-name'].textContent = t || ''; },
    hint: function (t) { el.hint.textContent = t || ''; },
    debug: function (t) { el.debug.textContent = AT.DEBUG ? t : ''; },

    // 独り言（ふわっと出る）
    mono: function (text) { el.mono.textContent = text; el.mono.style.opacity = 1; },
    monoOff: function () { el.mono.style.opacity = 0; },

    // 回顧文: lines を1文字ずつ(40ms/字)表示。
    // recallAdvance(): 表示途中なら全文表示 / 完了済みなら次の行 / 最後の行のあとなら onDone を呼ぶ。
    recallStart: function (lines, onDone) {
      recall = { lines: lines, idx: -1, chars: 0, timer: 0, onDone: onDone };
      nextLine();
    },
    recallAdvance: function () {
      if (!recall) return false;
      var r = recall, full = r.lines[r.idx].length;
      if (r.chars < full) { r.chars = full; render(); return true; }
      if (r.idx + 1 < r.lines.length) { nextLine(); return true; }
      var cb = r.onDone; recall = null;
      if (cb) cb();
      return true;
    },
    recallUpdate: function (dtMs) {   // 実時間dtを渡す（スロー中も文字は進む）
      if (!recall) return;
      var r = recall, full = r.lines[r.idx].length;
      if (r.chars >= full) return;
      r.timer += dtMs;
      while (r.timer >= CHAR_MS && r.chars < full) { r.timer -= CHAR_MS; r.chars++; }
      render();
    },
    recallClear: function () { recall = null; el.recall.innerHTML = ''; },

    // 叫び（震える巨大文字）
    shout: function (text) { el.shout.textContent = text; el.shout.classList.add('on'); },
    shoutOff: function () { el.shout.classList.remove('on'); },

    // 判定文字・メーター（T2で使用）
    judge: function (text) { el.judge.textContent = text; el.judge.style.opacity = 1; },
    judgeOff: function () { el.judge.style.opacity = 0; },
    meter: function (v) {   // v: 0〜100, null で非表示
      el.meter.style.display = v == null ? 'none' : 'block';
      if (v != null) el.meter.firstElementChild.style.width = AT.util.clamp(v, 0, 100) + '%';
    },

    // 結末: {line, stats, again} / null で非表示
    ending: function (info) {
      if (!info) { el.ending.style.display = 'none'; return; }
      el['end-line'].textContent = info.line || '';
      el['end-stats'].textContent = info.stats || '';
      el['end-again'].textContent = info.again || '';
      el.ending.style.display = 'flex';
    },

    // シーン切替時に全部リセット
    reset: function () {
      ui.sceneName(''); ui.hint(''); ui.monoOff(); ui.recallClear(); ui.shoutOff(); ui.judgeOff(); ui.meter(null); ui.ending(null);
    }
  };
})(window.AT);
