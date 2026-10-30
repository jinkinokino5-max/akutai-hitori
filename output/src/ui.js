// ui: #ui オーバーレイの文字表示。回顧文はタップ/キーで1行ずつ送る(自動送りなし)。
// #ui はキャンバスと同じ16:9の箱に重なっているので、% 指定はキャンバス座標(320×180)の割合に対応する。
(function (AT) {
  var el = {};
  var recall = null;   // {lines, idx, chars, timer, onDone}
  var CHAR_MS = 40;

  function init() {
    ['debug', 'scene-name', 'mono', 'recall', 'shout', 'combo', 'judge', 'meter', 'ending', 'end-rank', 'end-line', 'end-stats', 'end-again', 'hint', 'doom', 'credit']
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
    // タイトル等の大きな文字。sub は下に小さく
    sceneName: function (t, sub) {
      el['scene-name'].textContent = t || '';
      if (sub) { var s = document.createElement('span'); s.className = 'sub'; s.textContent = sub; el['scene-name'].appendChild(s); }
    },
    hint: function (t) { el.hint.textContent = t || ''; },
    debug: function (t) { el.debug.textContent = AT.DEBUG ? t : ''; },
    setAccent: function (c) { document.documentElement.style.setProperty('--accent', c || '#ff2e88'); },

    // 独り言（ふわっと出る）。x, y はキャンバス座標（省略時は前回の位置）
    mono: function (text, x, y) {
      if (x != null) { el.mono.style.left = (x / AT.W * 100) + '%'; el.mono.style.top = (y / AT.H * 100) + '%'; }
      el.mono.textContent = text; el.mono.style.opacity = 1;
    },
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
      el.recall.innerHTML = '';
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

    // 叫び（震える巨大文字）。長い叫びは少し小さく
    shout: function (text) {
      el.shout.textContent = text;
      el.shout.classList.toggle('long', text.length > 8);
      el.shout.classList.add('on');
    },
    shoutOff: function () { el.shout.classList.remove('on'); },

    // 呑まれたとき: 真っ黒な画面の大きな一言（mode 'big'）/ ゲームオーバーの結末文（mode 'end'。lines は配列）
    doom: function (head, lines, mode) {
      var d = el.doom;
      d.innerHTML = '';
      var h = document.createElement('div'); h.className = 'head'; h.textContent = head || ''; d.appendChild(h);
      (lines || []).forEach(function (t) { var l = document.createElement('div'); l.className = 'ln'; l.textContent = t; d.appendChild(l); });
      d.className = 'on ' + (mode || 'big');
    },
    doomOff: function () { el.doom.className = ''; el.doom.innerHTML = ''; },
    // タイトル画面下部の音源クレジット（CC BY の表示義務。audio/CREDITS.md の画面表示用文）
    credit: function (on) { el.credit.style.display = on ? 'block' : 'none'; },

    // 判定文字: result = 'just' | 'good' | 'miss' | 'crash'（旧 'perfect' も可）
    judge: function (result) {
      var j = el.judge;
      j.textContent = result.toUpperCase();
      j.className = result;
      void j.offsetWidth;   // アニメーションを毎回やり直す
      j.className = result + ' pop';
    },
    judgeOff: function () { el.judge.className = ''; el.judge.style.opacity = 0; el.combo.style.opacity = 0; },
    combo: function (n) {
      el.combo.textContent = n >= 5 ? n + ' COMBO' : '';
      el.combo.style.opacity = n >= 5 ? 1 : 0;
    },
    meter: function (v) {   // v: 0〜100, null で非表示
      el.meter.style.display = v == null ? 'none' : 'block';
      if (v != null) {
        el.meter.querySelector('i').style.width = AT.util.clamp(v, 0, 100) + '%';
        el.meter.classList.toggle('max', v >= 100);
      }
    },

    // 結末: {rank, line, stats, again} / null で非表示
    ending: function (info) {
      if (!info) { el.ending.style.display = 'none'; return; }
      el['end-rank'].textContent = info.rank || '';
      el['end-line'].textContent = info.line || '';
      el['end-stats'].textContent = info.stats || '';
      el['end-again'].textContent = info.again || '';
      el['end-again'].style.display = info.again ? '' : 'none';
      el.ending.style.display = 'flex';
    },

    // シーン切替時に全部リセット
    reset: function () {
      ui.sceneName(''); ui.hint(''); ui.monoOff(); ui.recallClear(); ui.shoutOff(); ui.judgeOff(); ui.meter(null); ui.ending(null); ui.doomOff(); ui.credit(false);
    }
  };
})(window.AT);
