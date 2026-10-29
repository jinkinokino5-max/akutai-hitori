# API: art_common.js / art_r1.js（R1 の絵）

読み込み順: `art_common.js` → `art_r1.js`（どちらも core.js に依存しない。`AT.W` が無ければ 320 を使う）。
単体確認: `output/test/art_r1_test.html`（file:// で開ける）。

## art_common.js（全 art 担当の共通基盤）`AT.px`
| API | 説明 |
|---|---|
| `AT.px.PAL` / `AT.px.I` | 共通パレット（番号→色、0=透明）/ 名前→番号。輪郭 `I.outline`=1 `#05060f`。夜色・街灯・マゼンタ・各ラウンド差し色(`gogh`/`fire`/`exit`)入り |
| `AT.px.addColor(name, hex)` | 色を追加して番号を返す（既存名ならその番号） |
| `AT.px.make(rows, palette?)` | rows（文字列配列: `.`=0, `1`〜`9`,`a`〜`z`=36進 / または数値配列の配列）→ canvas |
| `AT.px.grid(w,h)` | 描画バッファ。`set/setw(横ラップ)/get/rect/line(th)/path/ellipse/disc/ring/poly/ditherRect/glow/vgrad/blit/outline/replace/clone/count/rows/toCanvas` |
| `AT.px.toCanvas(grid, palette?)` | バッファ→canvas（`canvas.grid` に元バッファ）。document 無しなら null |
| `AT.px.rng(seed)` / `AT.px.hash(x,y,seed)` | 擬似乱数 mulberry32 / 座標ハッシュ（いずれも [0,1)） |
| `AT.px.dith(x,y,level)` | 4×4 Bayer。level 0〜16 |
| `AT.px.scale(grid,k)` / `AT.px.flipX(grid)` | 整数拡大 / 左右反転 |
| `AT.px.drawWrap(ctx, img, scrollX, y)` | 横タイルを画面幅に敷き詰める（パララックス用） |
| `AT.px.hero` | 主人公（自転車・右向き）**24×24**（自転車の幅のため16より広い）。`walk[4]`/`run[4]`（`build()`後に canvas）。`draw(ctx, x, groundY, mode, t, speed01)`: x=左端、groundY=接地y、mode=`'walk'`\|`'run'`。run は speed01 でペダルが速くなる（10→32fps）。`grid(mode,f)` は node 検証用 |

## art_r1.js `AT.ART.r1`
| API | 説明 |
|---|---|
| `r1.build()` | 全画像を生成してキャッシュ（初回約60ms・node計測）。draw 系が自動で呼ぶ。シーン開始時に呼んでおくと初回のカクつき防止 |
| `r1.GROUND_Y` | =168。主人公の接地 y（夜道・アルル共通）→ `AT.px.hero.draw(ctx, x, r1.GROUND_Y, ...)` |
| `r1.drawNight(ctx, scrollX, t)` | 夜道（A/B/C/F）。全画面を塗る。scrollX=前景の進んだ距離px、t=秒（星の瞬き）。層: 空と月(固定) / 家並み・電柱・自販機(×0.35) / 歩道・車道・街灯と光の円錐(×1.0) |
| `r1.drawArles(ctx, scrollX, t, speed01)` | アルル（E）。全画面を塗る。層: 渦巻く星空(×0.04+ゆっくり漂流、色循環8コマで渦が回る。speed01 で回転が速く) / 丘の村と尖塔(×0.15) / 黄色いカフェ通り・糸杉(×0.45) / 石畳・道端の糸杉(×1.0) |
| `r1.drawSwan(ctx, x, y, t, big)` | ハクチョウ（左向き、目はマゼンタ）。x,y=左上。big=false 32×24 / true 64×48。羽ばたき2コマは t で切替 |
| `r1.drawSwanAttack(ctx, p, t, tx, ty)` | 襲来（B）。p=0 画面右上の外 → p=1 で中心が (tx,ty)。p>0.5 で拡大版に切替。戻り値 `{x,y,big}`。C（スロー）では p=1 固定で t を遅らせて描けば宙で静止する |
| `r1.cache` | build 後の canvas 群（`swan[2]`, `swanBig[2]`, `nightSky[2]`, `arlesSky[8]` など） |
| `r1.grids()` / `r1.swanGrid(s,f)` | canvas を使わない生成（node 検証用） |

## 統合時の注意
- スクロール量は呼び出し側で積算する（例: `dist += dt * (60 + 340*speed01)`）。
- 「家並みと街灯」の層分けは、光の円錐を道に合わせるため街灯を前景(道)の層に置いた。
- 既存 `art.js`（足場）の予定API `AT.art.make(palette, rows)` とは引数順が逆（`AT.px.make(rows, palette)`）。統合時に別名を張るなら注意。
