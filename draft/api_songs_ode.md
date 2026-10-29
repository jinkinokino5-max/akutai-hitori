# api_songs_ode（曲データ: 歓喜の歌 / パーセル風）

ファイル: `output/src/songs_ode.js`（クラシック script。依存なし。`AT.SONGS` に追加するだけ）

## 定義するもの
| キー | 用途 | BPM | 小節 | 調 |
|---|---|---|---|---|
| `AT.SONGS.ode` | R3 疾走（rounds.js の `song:'ode'`） | 120→168 | 32 | 1-16 ニ長調(4分の行進) / 17-32 ホ長調(8分の連打) |
| `AT.SONGS.purcell` | タイトル・結末 | 60→72 | 16 | ハ短調 |

## 形式
`{id, title, bpmBase, bpmMax, beatsPerBar:4, loop:true, bars:[{melody, chord, bass, drums}], unverified:[]}`
- `melody` / `bass` / `drums`: `"音名オクターブ:拍"` を空白区切り。`r` は休符。各小節の合計は必ず4拍。
- 音名は `#` のみ使用（フラットなし。Eb は D# で表記）。
- `chord`: その小節で鳴らす和音の音名配列（1小節1和音）。
- `drums`: `K`=キック `S`=スネア `H`=ハイハット `r`=休み（例 `"K:1 S:1 K:1 S:1"`）。全小節に入れてある。

## 統合時の注意
- 既存足場 `output/src/songs.js` は `AT.MUSIC` を差し替え口にしている。こちらは指示どおり `AT.SONGS`。統合担当がどちらかに寄せる（例: `AT.MUSIC.ode = AT.SONGS.ode`）。
- ode はループすると小節32(ホ長調)→小節1(ニ長調)に戻り、少し下がる。R3 は白光で終わるので、気になる場合は2周目以降を小節17から回すとよい。
- 長さ: ode 1周 = 64秒(120BPM)〜46秒(168BPM)。purcell 1周 = 64秒(60BPM)。

## 検証
- `node --check` OK。node でパース（全トークンが正規表現に一致）、各小節の拍数合計=4、和音の音名形式を確認、エラー0。
- 音としての聴き取り確認はブラウザ未確認。
- 旋律の正確さは楽譜と未照合（各曲の `unverified` 参照）。特に purcell は原曲旋律を確信をもって再現できておらず「風」の旋律。
