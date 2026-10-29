// 3ラウンドの組（企画書§4）。music は音源差し替え口（開発プラン§2）。
// 差し替え時: music: { type: 'file', src: 'audio/r1.mp3', bpm: 120, offset: 0.08 }
window.AT = window.AT || {};
AT.ROUNDS = [
  { id: 1, enemy: 'swan',    world: 'arles',       accent: '#f5d33a', bpm: [120, 150], music: { type: 'synth', song: 'tell' } },
  { id: 2, enemy: 'samurai', world: 'battlefield', accent: '#ff5a1f', bpm: [112, 144], music: { type: 'synth', song: 'pomp' } },
  { id: 3, enemy: 'planes',  world: 'corridor',    accent: '#3dff8a', bpm: [120, 168], music: { type: 'synth', song: 'ode' } }
];
