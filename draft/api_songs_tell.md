# api_songs_tell（R1曲データ）

- ファイル: `output/src/songs_tell.js`（クラシック script。`window.AT = window.AT || {}` → `AT.SONGS = AT.SONGS || {}`）
- 読み込み順: 曲を使う側（audio/rhythm）より前ならどこでもよい。依存なし。
- 注意: 既存足場 `songs.js` は `AT.MUSIC` を用意しているが、本ファイルは指示どおり `AT.SONGS` に登録。統合時に `AT.MUSIC.tell = AT.SONGS.tell` 等で橋渡しするか、どちらかに統一すること。

## 登録される曲
| id | 用途 | 小節 | BPM | 備考 |
|---|---|---|---|---|
| `tell` | Eパート異世界疾走（ループ） | 8 | 120→150 | 原曲2/4の4分=1拍、1小節=原曲2小節。ハ長調に移調（原曲ホ長調） |
| `tell_slow` | Cパート回顧など静かな場面（ループ） | 6 | 66固定 | tell の骨格だけの自作変奏 |

## 形式
`{id, title, bpmBase, bpmMax, beatsPerBar:4, loop:true, bars:[{melody, chord, bass}], unverified:[]}`
- melody/bass: `"音名オクターブ:拍"` 空白区切り、`r` は休符。各小節の拍数合計 = 4（検証済み）。
- chord: 小節中ずっと鳴らす構成音の配列（例 `["C3","E3","G3"]`）。
- drums は省略（4つ打ちキックは rhythm/audio 側で拍頭に鳴らす想定）。ギャロップ（16分16分8分）は拍頭が揃うのでキックと合う。
- 旋律音域: G4〜G5。

## 正確性
- 記憶からの書き起こしで楽譜とは未照合。不確かな箇所は各曲の `unverified` に列挙（小節2・3・4・7・8 が特に不確か）。
