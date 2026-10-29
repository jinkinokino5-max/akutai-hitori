// songs_pomp: エルガー「威風堂々 第1番」トリオ主題（R2 夜の合戦場の疾走用）
// エルガー 1857-1934 没。没後70年以上でパブリックドメインの前提。旋律は記憶からの自前書き起こし（楽譜とは未照合）。
// 原曲のトリオは Largamente（ゆったり）だが、ここでは疾走用に 4つ打ち＋8分のオクターブベースで押し進む行進曲アレンジ。
// 調: ト長調（トリオ初出の調）。1拍=4分音符、4/4、16小節ループ。
// 書式: melody/bass は "音名オクターブ:拍" の空白区切り、r は休符。各小節の拍数合計は 4。
//   drums（省略可）は {kick, snare, hat} の各文字列。同じ書式で "x:拍" が打音、"r:拍" が休み。
window.AT = window.AT || {};
AT.SONGS = AT.SONGS || {};

(function () {
  // 基本の太鼓: 4つ打ちキック、2・4拍スネア、裏拍ハイハット
  var BEAT = { kick: 'x:1 x:1 x:1 x:1', snare: 'r:1 x:1 r:1 x:1', hat: 'r:0.5 x:0.5 r:0.5 x:0.5 r:0.5 x:0.5 r:0.5 x:0.5' };
  // 4小節ごとの締め（スネアを8分で詰める）
  var PUSH = { kick: 'x:1 x:1 x:1 x:1', snare: 'r:1 x:1 x:0.5 x:0.5 x:0.5 x:0.5', hat: 'r:0.5 x:0.5 r:0.5 x:0.5 r:0.5 x:0.5 r:0.5 x:0.5' };
  // ループ末尾のフィル（16分ロール）
  var FILL = { kick: 'x:1 x:1 x:1 x:1', snare: 'x:0.5 x:0.5 x:0.5 x:0.5 x:0.25 x:0.25 x:0.25 x:0.25 x:0.25 x:0.25 x:0.25 x:0.25', hat: 'x:1 r:3' };

  // 8分刻みのオクターブベース（root を低・高で交互に）
  function oct(lo, hi) { return [lo, hi, lo, hi].map(function (n) { return n + ':0.5'; }).join(' ') + ' ' + [lo, hi, lo, hi].map(function (n) { return n + ':0.5'; }).join(' '); }
  function oct2(a, a2, b, b2) { return a + ':0.5 ' + a2 + ':0.5 ' + a + ':0.5 ' + a2 + ':0.5 ' + b + ':0.5 ' + b2 + ':0.5 ' + b + ':0.5 ' + b2 + ':0.5'; }

  var G = ['G3', 'B3', 'D4'], D7 = ['F#3', 'A3', 'C4'], D = ['F#3', 'A3', 'D4'],
      C = ['G3', 'C4', 'E4'], Am = ['A3', 'C4', 'E4'], Em = ['G3', 'B3', 'E4'];

  AT.SONGS.pomp = {
    id: 'pomp',
    title: '威風堂々 第1番（エルガー）',
    bpmBase: 112,
    bpmMax: 144,
    beatsPerBar: 4,
    loop: true,
    bars: [
      // A: 「Land of Hope and Glory」の頭（ミ レ ド | シ ド レ ミ | ラ ソ）
      { melody: 'B4:2 A4:1 G4:1',           chord: G,  bass: oct('G1', 'G2'),            drums: BEAT },
      { melody: 'F#4:1 G4:1 A4:1 B4:1',     chord: D,  bass: oct('D2', 'D3'),            drums: BEAT },
      { melody: 'E4:2 D4:2',                chord: C,  bass: oct2('C2', 'C3', 'G1', 'G2'), drums: BEAT },
      { melody: 'E4:1 F#4:1 G4:1 A4:1',     chord: Am, bass: oct2('A1', 'A2', 'D2', 'D3'), drums: PUSH },
      // A': 応答して属調側で半終止
      { melody: 'B4:1 C5:1 B4:1 A4:1',      chord: Em, bass: oct('E2', 'E3'),            drums: BEAT },
      { melody: 'A4:3 r:1',                 chord: D,  bass: oct('D2', 'D3'),            drums: BEAT },
      // A再現
      { melody: 'B4:2 A4:1 G4:1',           chord: G,  bass: oct('G1', 'G2'),            drums: BEAT },
      { melody: 'F#4:1 G4:1 A4:1 B4:1',     chord: D,  bass: oct('D2', 'D3'),            drums: PUSH },
      { melody: 'E4:2 D4:2',                chord: C,  bass: oct2('C2', 'C3', 'G1', 'G2'), drums: BEAT },
      // 主調で全終止
      { melody: 'C5:1 B4:1 A4:1 G4:1',      chord: Am, bass: oct('A1', 'A2'),            drums: BEAT },
      { melody: 'A4:2 F#4:2',               chord: D7, bass: oct('D2', 'D3'),            drums: BEAT },
      { melody: 'G4:3 r:1',                 chord: G,  bass: oct('G1', 'G2'),            drums: PUSH },
      // B: 高い音域で盛り上げ、属七でループ頭へ戻す
      { melody: 'D5:2 C5:1 B4:1',           chord: G,  bass: oct('G1', 'G2'),            drums: BEAT },
      { melody: 'C5:1 B4:1 A4:1 G4:1',      chord: C,  bass: oct('C2', 'C3'),            drums: BEAT },
      { melody: 'F#4:1 G4:1 A4:1 B4:1',     chord: D,  bass: oct('D2', 'D3'),            drums: BEAT },
      { melody: 'A4:2 D4:2',                chord: D7, bass: oct2('D2', 'D3', 'A1', 'A2'), drums: FILL }
    ],
    unverified: [
      '小節1-3: 冒頭「ミ レ ド | シ ド レ ミ | ラ ソ」の音の並びは記憶による。リズム（長短の配分）は疾走用に4分基調へ単純化しており原曲と異なる',
      '小節4-6: 第2フレーズの音高・終止の位置は未照合（記憶が曖昧）',
      '小節7-9: 第1フレーズの再現として書いたが、原曲の繰り返し方とは未照合',
      '小節10-12: 終止形は和声に合わせた補作の可能性が高い（未照合）',
      '小節13-16: 後半（Wider still and wider 付近）の高い音域の部分は大まかな輪郭のみの補作。原曲とは別物の可能性あり',
      '全体: 和音・ベース・ドラムは自作の編曲。調はト長調としたが原曲トリオの調は未照合'
    ]
  };
})();
