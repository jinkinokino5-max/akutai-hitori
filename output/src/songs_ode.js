// songs_ode: R3「歓喜の歌」(行進曲風) と タイトル/結末用「メアリー女王の葬送音楽」風。
// 書式: melody/bass = "音名オクターブ:拍" を空白区切り(r は休符)。各小節の拍数合計 = beatsPerBar(4)。
//   chord = その小節で鳴らす和音(1小節1和音)。drums = "K"(キック) "S"(スネア) "H"(ハイハット) "r"(休み) + ":拍"。省略可。
// 出典: どちらも作曲家の没後70年以上(ベートーヴェン没1827 / パーセル没1695)のPD作品。
//   旋律は記憶からの書き起こしで、楽譜とは未照合。既存の電子編曲・録音(W.カーロス等)は参照していない。
//   和音・低音・ドラム・後半の転調と8分化は自作編曲。
window.AT = window.AT || {};
AT.SONGS = AT.SONGS || {};

(function () {
  // 和音
  var D = ['D3', 'F#3', 'A3'], A = ['A2', 'C#3', 'E3'], A7 = ['A2', 'C#3', 'E3', 'G3'];
  var E = ['E3', 'G#3', 'B3'], B = ['B2', 'D#3', 'F#3'], B7 = ['B2', 'D#3', 'F#3', 'A3'];
  // 低音
  var bD = 'D2:1 A1:1 D2:1 A1:1', bA = 'A1:1 E2:1 A1:1 E2:1', bCadD = 'A1:1 A1:1 D2:2';
  var bE = 'E2:0.5 E3:0.5 E2:0.5 E3:0.5 B1:0.5 B2:0.5 B1:0.5 B2:0.5';
  var bB = 'B1:0.5 B2:0.5 B1:0.5 B2:0.5 F#2:0.5 F#1:0.5 F#2:0.5 F#1:0.5';
  var bCadE = 'B1:0.5 B2:0.5 B1:0.5 B2:0.5 E2:0.5 E3:0.5 E2:0.5 E3:0.5';
  // ドラム
  var dM = 'K:1 S:1 K:1 S:1';                                   // 前半: 行進
  var dR = 'K:0.5 H:0.5 S:0.5 H:0.5 K:0.5 K:0.5 S:0.5 H:0.5';    // 後半: 疾走
  var dF = 'S:0.5 S:0.5 S:0.5 S:0.5 S:0.25 S:0.25 S:0.25 S:0.25 S:0.5 S:0.5'; // フィル

  // ---- 前半: ニ長調、4分音符の行進 (小節1-16) ----
  var m1 = 'F#5:1 F#5:1 G5:1 A5:1', m2 = 'A5:1 G5:1 F#5:1 E5:1', m3 = 'D5:1 D5:1 E5:1 F#5:1';
  // ---- 後半: 全音上げてホ長調、各音を8分の連打に (小節17-32) ----
  var n1 = 'G#5:0.5 G#5:0.5 G#5:0.5 G#5:0.5 A5:0.5 A5:0.5 B5:0.5 B5:0.5';
  var n2 = 'B5:0.5 B5:0.5 A5:0.5 A5:0.5 G#5:0.5 G#5:0.5 F#5:0.5 F#5:0.5';
  var n3 = 'E5:0.5 E5:0.5 E5:0.5 E5:0.5 F#5:0.5 F#5:0.5 G#5:0.5 G#5:0.5';

  AT.SONGS.ode = {
    id: 'ode',
    title: '歓喜の歌(ベートーヴェン 交響曲第9番より・行進曲風)',
    bpmBase: 120, bpmMax: 168, beatsPerBar: 4, loop: true,
    bars: [
      { melody: m1, chord: D, bass: bD, drums: dM },                       // 1
      { melody: m2, chord: A, bass: bA, drums: dM },                       // 2
      { melody: m3, chord: D, bass: bD, drums: dM },                       // 3
      { melody: 'F#5:1.5 E5:0.5 E5:2', chord: A, bass: bA, drums: dM },    // 4
      { melody: m1, chord: D, bass: bD, drums: dM },                       // 5
      { melody: m2, chord: A, bass: bA, drums: dM },                       // 6
      { melody: m3, chord: D, bass: bD, drums: dM },                       // 7
      { melody: 'E5:1.5 D5:0.5 D5:2', chord: D, bass: bCadD, drums: dM },  // 8
      { melody: 'E5:1 E5:1 F#5:1 D5:1', chord: A, bass: bA, drums: dM },   // 9
      { melody: 'E5:1 F#5:0.5 G5:0.5 F#5:1 D5:1', chord: A7, bass: bA, drums: dM }, // 10
      { melody: 'E5:1 F#5:0.5 G5:0.5 F#5:1 E5:1', chord: A, bass: bA, drums: dM },  // 11
      { melody: 'D5:1 E5:1 A4:2', chord: A7, bass: bA, drums: dM },        // 12
      { melody: m1, chord: D, bass: bD, drums: dM },                       // 13
      { melody: m2, chord: A, bass: bA, drums: dM },                       // 14
      { melody: m3, chord: D, bass: bD, drums: dM },                       // 15
      { melody: 'E5:1.5 D5:0.5 D5:2', chord: D, bass: bCadD, drums: dF },  // 16 (転調前のフィル)
      { melody: n1, chord: E, bass: bE, drums: dR },                       // 17
      { melody: n2, chord: B, bass: bB, drums: dR },                       // 18
      { melody: n3, chord: E, bass: bE, drums: dR },                       // 19
      { melody: 'G#5:0.5 G#5:0.5 G#5:0.5 F#5:0.5 F#5:0.5 F#5:0.5 F#5:1', chord: B, bass: bB, drums: dR }, // 20
      { melody: n1, chord: E, bass: bE, drums: dR },                       // 21
      { melody: n2, chord: B, bass: bB, drums: dR },                       // 22
      { melody: n3, chord: E, bass: bE, drums: dR },                       // 23
      { melody: 'F#5:0.5 F#5:0.5 F#5:0.5 E5:0.5 E5:0.5 E5:0.5 E5:1', chord: E, bass: bCadE, drums: dR }, // 24
      { melody: 'F#5:0.5 F#5:0.5 F#5:0.5 F#5:0.5 G#5:0.5 G#5:0.5 E5:0.5 E5:0.5', chord: B, bass: bB, drums: dR }, // 25
      { melody: 'F#5:0.5 F#5:0.5 G#5:0.5 A5:0.5 G#5:0.5 G#5:0.5 E5:0.5 E5:0.5', chord: B7, bass: bB, drums: dR }, // 26
      { melody: 'F#5:0.5 F#5:0.5 G#5:0.5 A5:0.5 G#5:0.5 G#5:0.5 F#5:0.5 F#5:0.5', chord: B, bass: bB, drums: dR }, // 27
      { melody: 'E5:0.5 E5:0.5 F#5:0.5 F#5:0.5 B4:0.5 B4:0.5 B4:0.5 B4:0.5', chord: B7, bass: bB, drums: dF }, // 28
      { melody: n1, chord: E, bass: bE, drums: dR },                       // 29
      { melody: n2, chord: B, bass: bB, drums: dR },                       // 30
      { melody: n3, chord: E, bass: bE, drums: dR },                       // 31
      { melody: 'F#5:0.5 F#5:0.5 F#5:0.5 E5:0.5 E5:0.5 G#5:0.5 B5:0.5 E6:0.5', chord: E, bass: bCadE, drums: dF } // 32
    ],
    unverified: [
      '全体: 記憶からの書き起こしで、交響曲第9番第4楽章の楽譜とは未照合',
      '小節12: 原曲は4拍目のF#が次小節へタイでつながるシンコペーションだが、記憶が曖昧なので「D E A(2拍)」に単純化した',
      '小節17-32: 原曲にはない自作編曲(全音上の転調と8分の連打化)。小節32末尾の上行(G# B E)も自作'
    ]
  };

  // ---- パーセル「メアリー女王の葬送音楽」行進曲 風 (ハ短調) ----
  var Cm = ['C3', 'D#3', 'G3'], G = ['G2', 'B2', 'D3'], G7 = ['G2', 'B2', 'D3', 'F3'];
  var Ab = ['G#2', 'C3', 'D#3'], Eb = ['D#3', 'G3', 'A#3'], Fm = ['F2', 'G#2', 'C3'], Bb = ['A#2', 'D3', 'F3'];
  var dP = 'K:1 r:1 K:0.5 K:0.5 r:1'; // くぐもった太鼓
  // 異名同音: Eb=D#, Ab=G#, Bb=A# で表記(シャープのみのパーサーでも読めるように)
  AT.SONGS.purcell = {
    id: 'purcell',
    title: 'メアリー女王の葬送音楽 風(パーセル)',
    bpmBase: 60, bpmMax: 72, beatsPerBar: 4, loop: true,
    bars: [
      { melody: 'C5:2 D#5:1 D5:1', chord: Cm, bass: 'C2:2 C2:2', drums: dP },        // 1
      { melody: 'C5:2 B4:2', chord: G, bass: 'G1:2 G1:2', drums: dP },               // 2
      { melody: 'C5:1 D5:1 D#5:1 F5:1', chord: Ab, bass: 'G#1:2 F1:2', drums: dP },  // 3
      { melody: 'G5:3 r:1', chord: Cm, bass: 'C2:4', drums: dP },                    // 4
      { melody: 'G#5:2 G5:1 F5:1', chord: Fm, bass: 'F1:2 F1:2', drums: dP },        // 5
      { melody: 'D#5:2 D5:2', chord: G, bass: 'G1:4', drums: dP },                   // 6
      { melody: 'D#5:1 D5:1 C5:1 B4:1', chord: G7, bass: 'G1:2 G1:2', drums: dP },   // 7
      { melody: 'C5:4', chord: Cm, bass: 'C2:4', drums: dP },                        // 8
      { melody: 'D#5:2 F5:1 G5:1', chord: Eb, bass: 'D#2:2 D#2:2', drums: dP },      // 9
      { melody: 'G#5:2 G5:2', chord: Ab, bass: 'G#1:4', drums: dP },                 // 10
      { melody: 'F5:2 D#5:1 D5:1', chord: Bb, bass: 'A#1:4', drums: dP },            // 11
      { melody: 'D#5:4', chord: Eb, bass: 'D#2:4', drums: dP },                      // 12
      { melody: 'C5:2 D5:1 D#5:1', chord: Fm, bass: 'F1:2 F1:2', drums: dP },        // 13
      { melody: 'D5:2 G4:2', chord: G, bass: 'G1:4', drums: dP },                    // 14
      { melody: 'C5:1 D#5:1 D5:1 B4:1', chord: G7, bass: 'G1:2 G1:2', drums: dP },   // 15
      { melody: 'C5:4', chord: Cm, bass: 'C2:4', drums: 'K:1 r:3' }                  // 16
    ],
    unverified: [
      '小節1-16(全体): 原曲(行進曲 Z.860)の旋律を確信をもって再現できていない。ハ短調・遅い4拍子・ホモフォニーという特徴に合わせた「風」の旋律で、原曲どおりではない可能性が高い',
      '和音・低音・太鼓: 自作。原曲の和声とは未照合'
    ]
  };
})();
