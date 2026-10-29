# api_art_r2（R2: 騎馬武者 × 夜の合戦場 / 帰り道=川沿いの土手）

ファイル: `output/src/art_r2.js`。読み込み順: `core.js` → `art_common.js`(あれば) → `art_r2.js`。
`AT.px.make(rows, palette)` があればスプライト変換に使う。なければ自前で変換する。
単体確認: `output/test/art_r2_test.html`（world / road / approach / sprites の切り替えと speed スライダー）。

## 共通
- `AT.ART.r2.groundY = 150`: 車輪が地面に着く y 座標（異世界・帰り道で共通）。`AT.px.hero.draw(ctx, x, 150, ...)` で合う。
- `accent = '#ff5a1f'`（篝火朱）。`palette`（0=透明、1=輪郭 #05060f）。
- `preload()`: タイルとスプライトを先に全部作る（初回描画のカクつき防止）。省略しても初回の draw 時に作られる。

## 襲来物（騎馬武者・左向き・色のない灰色。目だけマゼンタ）
- `drawEnemy(ctx, x, y, t, {big, frame, scale, alpha})`: (x, y) は蹄が接地する点の中央。通常版は 60×50、`big:true` で拡大版 118×98。4コマの駆け足で、`frame` を省略すると t から 10fps でコマを決める。
- `drawApproach(ctx, p, t, tx=96, ty=150)`: 襲来シーン用。p=0 で画面右上の外、p=1 で主人公の目の前（拡大版を 0.4→1.6 倍に拡大）。動きは p² で加速し、残像が付く。p>0.8 で画面が揺れる。
- `enemyCanvas(scale 1|2, frame)` → canvas。回顧シーンで静止させるときなどに使う。

## 異世界（4層パララックス: 空と満月=静止 / 稜線と合戦城 0.08 / 陣幕・幟・篝火 0.35 / すすきの野原と道 1.0）
- `drawWorld(ctx, scroll, t, speed)`: scroll は走った距離(px)、speed は 0〜100。画面全体を塗る。speed>40 で地面に流線が出て、すすきが後ろへなびく。
- `drawWorldFront(ctx, scroll, t, speed)`: 前景の下端のすすき（1.5倍速）。**主人公を描いた後に呼ぶ**。

## 帰り道（R2 専用: 対岸の街と鉄橋 / 川面と月の映り込み / 土手道と街灯）
- `drawRoad(ctx, scroll, t)`: 三日月、14秒ごとに鉄橋を渡る電車、点滅する航空障害灯、窓明かりの映り込み、街灯の光だまり。
- `drawRoadFront(ctx, scroll, t)`: 下端の草むら（主人公の後に呼ぶ）。

## art_r3 と同じ形の入口（どちらで呼んでもよい）
- `attacker.draw(ctx, t, p, {tx, ty})` / `attacker.drawOne(ctx, x, y, {big, frame, t})`
- `world.draw(ctx, t, speed, {dist})`: 内部で距離を積算する（60〜360px/秒）。`world.drawFront(ctx, t, speed)` / `world.reset()` / `world.getDist()`
- `walk.draw(ctx, scroll, t)` / `walk.drawFront` / `walk.groundY`

## 注意
- すべて 320×180 前提。呼ぶ前に `ctx.imageSmoothingEnabled = false` を設定すること（drawApproach は小数倍率で拡大するため）。
- `_buildEnemyRows(scale, frame)` は node で寸法を検証するためのもの（canvas 不要）。
