# API: 音の時計とリズム判定（T2 + T3シンセ）

ファイル: `output/src/audio_engine.js`（AT.audio） / `output/src/rhythm_engine.js`（AT.rhythm） / 動作確認 `output/test/rhythm_test.html`

## 統合のしかた
- index.html で **足場の audio.js / rhythm.js より後** に読む（`AT.audio = ...` / `AT.rhythm = ...` で上書きする）。順番: `audio_engine.js` → `songs.js`(曲データ) → `rhythm_engine.js`。曲データは再生時に引くので songs と前後してもよい。
- input.js は毎打 `AT.audio.resume()` を呼ぶ → そのまま使える（何度呼んでも安全）。
- run シーン: 入場で `AT.rhythm.start(AT.ROUNDS[i])`、毎フレーム `AT.rhythm.update()`、入力で `AT.rhythm.hit()`、`AT.rhythm.onReach(fn)` で flash へ。
- recall シーン: `AT.audio.setMuffled(true)`、抜けるとき `setMuffled(false)`。白光: `AT.audio.stop(0.3)`。

## AT.audio
| API | 説明 |
|---|---|
| `init()` / `resume()` | AudioContext 生成 / 再開（最初のユーザー操作で） |
| `now()` | `ctx.currentTime`（唯一の時計） |
| `play(music, {bpm, delay=0.1, metronome})` | `music` = `{type:'synth', song:'tell'}` / `{type:'click'}` / `{type:'file', src, bpm, offset, beatsPerBar, loop}`。曲頭(=拍0)は now+delay |
| `stop(fadeSec=0.05)` | フェードして停止 |
| `setBpm(bpm)` | **次の小節頭で反映**（何度呼んでもよい。最後の値） |
| `getBpm()` | 今鳴っている小節のBPM |
| `getBeat(heard)` / `getBar(heard)` | 現在拍位置（曲頭0、開始前は負）。`heard=true` で出力遅延ぶん戻す |
| `timeToBeat(t)` / `beatToTime(b)` | テンポ区間による変換 |
| `getBeatsPerBar()` | |
| `onBar(fn)` | 小節を予約するたび `fn({barNo, songBar, time, beat, bpm})`（100ms先行で呼ばれる） |
| `setMuffled(on, sec=0.4, freq=400)` | スロー用 lowpass |
| `setVolume(v, sec)` | マスター |
| `sfx(name)` | `'perfect'|'good'|'miss'|'tap'|'click'|'accent'`（スロー lowpass を通らない） |
| `voices.lead/bass/kick/snare/hat` | 単発で鳴らす |
| `latency` / `getLatency()` | 判定で引く出力遅延(秒)。`null` なら `ctx.outputLatency||baseLatency`。キャリブレーション画面はここに代入 |
| `noteFreq, parseSeq, parseDrums, buildBarEvents, validateSong(song)` | 純関数。**曲担当は `validateSong` で拍数合計を検査できる**（node でも可） |

- スケジューラ: 25ms ごと、100ms 先まで予約。小節単位でテンポ固定。
- 音色: リード=ノコギリ2本(±7cent)→lowpass Q8(カットオフのエンベロープ)、パッド=和音を小節長で、ベース=矩形→lowpass、キック(サイン160→45Hz)、スネア(ノイズ+bandpass+三角波)、ハット(ノイズ+highpass)、オープンハット。
- 曲データ: `AT.SONGS[id]`（無ければ `AT.MUSIC[id]`、オブジェクト直渡しも可）。ドラム文字: `K S H O(オープンハット) X(K+H) Y(S+H) .`、文字数で小節を等分。省略時 `KHKHKHKH`（4つ打ち+裏ハット）。`loop:false` なら最後の小節以降は無音で時計だけ進む。`unverified` は再生時に console.info。
- type:'file': HTMLAudioElement で再生（file:// 可）、`playbackRate = bpm/music.bpm`（`preservesPitch=false`＝早回し）を小節頭で変更。拍 = `(ループ回数×曲長 + メディア時刻 − offset) × bpm/60`。30ms以上ずれたら時計を補正。**実音源での確認は未確認**。ループ素材は小節の整数倍の長さにすること。

## AT.rhythm
| API | 説明 |
|---|---|
| `start(cfg)` | `cfg` = `{bpmStart, bpmMax, music?}` または ラウンド定義 `{bpm:[start,max], music}`。music があれば `AT.audio.play` も行う。開始後1小節はノーツなし |
| `update()` | 毎フレーム。通過MISS、自然減衰、救済、`audio.setBpm(目標)` |
| `hit(t?)` | 1打。戻り値 `{result:'perfect'|'good'|'miss', empty, diffMs(負=早い), speed, combo, note}` |
| `onJudge(fn)` / `onReach(fn)` / `offAll()` | 判定ごと / 100到達時(fn(stats)) |
| `speed` `combo` `maxCombo` `bpmTarget` `running` `done` | プロパティ |
| `stats()` | `{accuracy, reachTime, assisted, maxCombo, perfect, good, miss, empty, totalNotes}` |
| `getNotes(ahead=8, behind=1)` | 描画用 `[{beat, dBeat, state, eighth, diff}]`。`x = 判定線x + dBeat × pxPerBeat` |
| `getBeat()` / `elapsed()` | 聞こえている拍 / 開始からの秒 |
| `config` | 判定窓・増減値など（企画書§5の初期値）。実行中に書き換え可 |

- ノーツ: speed<60 は4分、60以上で小節後半2拍が8分、90以上で全部8分（最低2小節）。パターンは1小節前の時点の speed で決まる。
- 判定窓 ±50ms / ±110ms、+4 / +2 / 通過MISS −3 / 空打ち −1、最後の入力から1秒で毎秒−1、10コンボごと+5。
- 救済: 60秒時点の speed から 75秒で100 になる直線を下限にする。`assisted` = 60秒を過ぎてから到達。
- accuracy の分母 = 判定済みノーツ（到達時に未判定のものは除外、空打ちは含めない）。

## 確認状況
- node: パース・拍数検査・小節頭のBPM反映・判定窓(−80ms→GOOD, +30ms→PERFECT)・空打ち・通過MISS・救済(75秒で到達)を偽 AudioContext で検証済み。
- ブラウザ(Chrome, localhost): デモ曲が鳴る状態で判定・BPM上昇・エラーなしを確認。**耳での音色・聴感ずれの確認は未実施**。

## 注意（designer へ）
- 企画書§5の数値のままだと、全PERFECT で **約12秒** で100に到達する（120BPM・4分で毎秒+8＋コンボ）。E パート45〜75秒の想定より大幅に短い。`config.dPerfect` 等の調整が必要。
