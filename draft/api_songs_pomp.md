# api: songs_pomp（威風堂々 第1番 トリオ主題）

- ファイル: `output/src/songs_pomp.js`（クラシック script。`window.AT.SONGS.pomp` を定義。依存なし）
- 読み込み: `songs.js` の後でも前でもよい（`AT.SONGS = AT.SONGS || {}` で合流）
- 形式: `{id:'pomp', title, bpmBase:112, bpmMax:144, beatsPerBar:4, loop:true, bars:[16小節], unverified:[...]}`
  - `bars[i].melody` / `bass`: `"音名オクターブ:拍"` 空白区切り、`r` は休符。各小節合計 4 拍
  - `bars[i].chord`: 音名配列（3音）
  - `bars[i].drums`: `{kick, snare, hat}` 各文字列。`x:拍`=打つ / `r:拍`=休み。各合計 4 拍
- アレンジ: ト長調、4つ打ちキック＋2・4拍スネア＋裏拍ハット、8分オクターブベース。4小節ごとにスネアを詰め、16小節目は16分ロールでループ頭へ
- 注意: `songs.js` の足場は `AT.MUSIC` だが、本ファイルは指示どおり `AT.SONGS` に置いた。統合時に `AT.MUSIC.pomp = AT.SONGS.pomp` などで橋渡しが必要
- 旋律は記憶からの書き起こしで楽譜とは未照合（詳細は `unverified`）
