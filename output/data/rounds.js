// 3ラウンドの組（企画書§4）。music は録音 MP3 の id（output/audio/<id>.mp3、一覧は audio/manifest.json）。
//   run    … 疾走の曲（山場の切り出し約40秒）。曲の終わりで白光（逃げ切り）
//   recall … 回顧の曲（静かな区間30秒）。ループしてローパスでこもらせる
//   endPad … 曲の終わりの何秒前に白光にするか（MP3 末尾 0.5 秒はフェードアウト済みなので、基本はその頭で白光）
//   runLen … 曲がまだ読めていない/音なしのときに使う長さ(秒)。manifest の duration と同じ値
//   2026-10-30 run_r1 はファンファーレ始まりの 40.0 秒版に差し替え（終わりは最終和音ではなくフェードアウト）
window.AT = window.AT || {};
AT.ROUNDS = [
  { id: 1, enemy: 'swan',    world: 'arles',       accent: '#f5d33a', music: { run: 'run_r1', recall: 'recall_r1', runLen: 40.0, endPad: 0.5 } },
  { id: 2, enemy: 'samurai', world: 'battlefield', accent: '#ff5a1f', music: { run: 'run_r2', recall: 'recall_r2', runLen: 42.3, endPad: 0.5 } },
  { id: 3, enemy: 'planes',  world: 'corridor',    accent: '#3dff8a', music: { run: 'run_r3', recall: 'recall_r3', runLen: 39.5, endPad: 1.0 } }   // R3 は最後の1秒が最終和音の減衰（実測 RMS: 38.5秒以降 -32→-45dB）なので、鳴り終わる所で白光
];
