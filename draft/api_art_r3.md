# api_art_r3（R3 の絵 ＋ 結末の玄関）

ファイル: `output/src/art_r3.js`（クラシック script。`core.js` の後、`art_common.js` があればその後に読む）
単体確認: `output/test/art_r3_test.html`（`#world` `#attack` `#plane` `#walk` `#door_S` 等で開始画面を指定）

すべて 320×180 の ctx にそのまま描く。座標は内部解像度。`imageSmoothingEnabled=false` は関数内で設定する。

## AT.ART.r3
| 呼び出し | 用途 |
|---|---|
| `walk.draw(ctx, scroll, t)` | 帰り道背景（暗い住宅街。空/家並み/ブロック塀・電柱・街灯1本）。`scroll`=カメラ進行px、`t`=秒（古い蛍光灯のまたたき）。全画面を塗る。地面 `walk.groundY = 150` |
| `attacker.draw(ctx, t, p, {tx, ty})` | 紙飛行機の大群。`p`: 0=右上の画面外 → 1=目標点(既定 90,128)に殺到。近い機ほど大きく、大きいものは拡大版スプライト（走り書き入り）に切替。背景は描かない（先に walk を描く） |
| `attacker.drawPlane(ctx, x, y, {big, scale, frame})` | 紙飛行機1機を中心座標に描く。回顧(スロー)で1機を大写しにする用。小=13×7、拡大版=44×24、frame 0/1 |
| `world.draw(ctx, t, speed, {dist})` | 異世界: 夜の高校の廊下（一点透視、ImageData で全画面）。`speed` 0〜100 で前進速度・広角・揺れ・疾走線(50以上)が増える。進行距離は t の差分から内部で積算（`{dist}` で上書き可） |
| `world.reset()` / `world.getDist()` | ラウンド開始時に呼ぶ／現在距離 |
| `accent` | `'#3dff8a'`（非常灯緑） |

廊下の中身: 左=窓（月と星は画面固定なので窓が月の前を流れる）、床に斜めの月明かり、右=教室の扉2枚・掲示板・欄間窓、突き出した教室札（1-1, 1-2 … と学年が際限なく増える）、天井から非常口サイン（真下の床が緑に照る）。

## AT.ART.ending.door
| 呼び出し | 用途 |
|---|---|
| `draw(ctx, rank, t)` | 家の玄関（全画面）。`rank`: `'S'`=窓に明かり＋玄関灯 / `'A'`=玄関灯 / `'B'`=玄関灯がときどき消える / `'C'`=真っ暗。不正値は A |
| `groundY = 156`, `playerArea = {x0:0, x1:130}` | 主人公＋自転車を置く地面と左の余白 |

## 補足
- スプライトは文字列行のパレット番号配列（`AT.ART.r3._data`）。`AT.px.make(grid, palette)` があれば使い、返り値の寸法が合わなければ自前で canvas 化（grid=番号の2次元配列、palette=色文字列配列で0番null）。
- 処理時間: world はブラウザで数ms/フレーム程度（テストページ右下に表示）。walk/door は初回にキャッシュ生成。
- スロー時の青黒オーバーレイ・色相回転・白光は呼び出し側（T7）。
