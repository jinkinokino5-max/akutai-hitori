# 音源クレジット・権利記録（2026-10-30 作成）

- すべて **未試聴**。区間は ffmpeg でラウドネスの時間推移を解析して決めた（根拠は下記）。
- 原本は `inbox/音源_原本/`（git 管理外）。加工後のみ本フォルダに置く。
- 形式: MP3 / 44.1kHz / ステレオ / 128kbps。ラウドネス: 疾走・タイトル -16 LUFS、回顧 -22 LUFS（静かな場面なので意図的に低く）。実測 -16.3〜-16.4 / -22.3〜-22.4 LUFS。
- 権利の確度: ◎ 確実 / ○ 高い / △ 根拠が弱い / CC BY は表示義務あり。

## 画面表示用クレジット文（タイトル画面の「クレジット」等に載せる）
```
Funeral March for Queen Mary (H. Purcell) – Bablung Music, CC BY 3.0
https://creativecommons.org/licenses/by/3.0/ （Wikimedia Commons より。トリミング・音量調整あり）
```
他の曲・効果音は表示義務のないライセンス（PD / 米国政府著作物 / CC0）。任意で「Music: US Marine Band, Pro Musica Symphony ほか / SFX: OpenGameArt (CC0)」を併記してよい。

## 音楽

### title.mp3（タイトル・結末）
- 曲名: Funeral March for Queen Mary（Music for the Funeral of Queen Mary より 行進曲）／ 作曲 Henry Purcell
- 演奏: Bablung Music（トランペット3・バルブトロンボーン→ユーフォニアム3・チューバ、タブラ等の編曲）
- 入手: https://commons.wikimedia.org/wiki/File:Funeral_March_for_Queen_Mary_-_H._Purcell.opus （出典 YouTube 9ZSBTWC8UgY）
- ライセンス: **CC BY 3.0**（YouTube CC-BY 表示。Commons で LicenseReview 付き）。クレジット表示必須。確度: ○（表示義務を守れば可）
- 切り出し: 4.9〜182.5秒（原本の頭に約5秒の無音があるため削除。2026-10-30 変更。旧版は archive/音源_旧版/）。加工: opus→MP3、loudnorm -16 LUFS、先頭0.3秒フェードイン・末尾1.0秒フェードアウト。改変の旨は上のクレジット文に記載。

### run_r1.mp3 / recall_r1.mp3（R1）
- 曲名: ウィリアム・テル序曲（ロッシーニ作曲、ヴェンツェル・ゼードラク編 吹奏楽版）
- 演奏: 米国海兵隊バンド（指揮 Timothy Foley、アルバム『Grand Scenes』2000、録音 2000年6月）
- 入手: https://commons.wikimedia.org/wiki/File:Gioachino_Rossini,_William_Tell_Overture_(military_band_version,_2000).ogg （原典 marineband.usmc.mil）
- ライセンス: PD（米国政府著作物 PD-USGov-Military-Marines ＋ 作曲者没後100年超）。確度: ◎
- 原本の長さ 662秒。Commons 説明では「Ranz des Vaches 5:14、フィナーレ 7:30」。
- **run_r1**: 切り出し **452.6〜492.6秒**（40.0秒）。フィナーレ（スイス軍の行進）の冒頭のトランペットのファンファーレから連続で40秒（2026-10-30 ユーザー指定で変更。開始点は1秒RMSの立ち上がり 453秒付近から推定、未試聴）。代案 `run_r1_alt.mp3`（452.6〜484.1秒＋終結部 646.4〜656.4秒を0.5秒クロスフェードでつないだ40.98秒）。旧版は archive/音源_旧版/ に退避。
  - 以下の「根拠」「開始点」の記述は旧版（616.8〜656.4秒）のもの。
  - 根拠: 1秒RMSで 585〜655秒が全曲で最もエネルギーが高い連続区間（約 -29〜-33 dB、平均 -30 dB。序盤〜中盤は -37〜-45 dB）。開始点は 616.8秒の局所的な谷（-36 dB、前後より低い=フレーズの切れ目と推定）を採用。
- **recall_r1**: 切り出し **283〜313秒**（30秒）。全曲で30秒窓の「ラウドネス平均＋ばらつき」が最小（平均 -42.3 dB、標準偏差 1.8 dB、先頭5秒と末尾5秒の差 0.2 dB=ループしやすい）。位置は Ranz des Vaches（5:14=314秒）の直前の静かな導入部のあたり。
- 加工: ogg→MP3、loudnorm（run=-16 / recall=-22 LUFS, TP -1.5）、run は先頭0.3秒フェードイン・末尾0.5秒フェードアウト、recall は先頭末尾0.3秒フェード。

### run_r2.mp3 / recall_r2.mp3（R2）
- 曲名: 行進曲『威風堂々』第1番 ニ長調 Op.39-1（エルガー）
- 演奏: 米国海兵隊バンド（1988年録音）
- 入手: https://commons.wikimedia.org/wiki/File:ELGAR_Pomp_and_Circumstance_in_D,_Opus_39,_No._1_-_United_States_Marine_Band.mp3 （原典 marineband.marines.mil）
- ライセンス: PD（演奏 PD-USGov-Marines、作曲は没後70年経過 pd-old-auto-expired 1934）。確度: ◎（作曲者没後70年は日本の著作権法でも満了）
- 注意: 原本MP3のヘッダ上の長さは約482秒だが、実際にデコードすると345.9秒（表示と実長が異なる）。区間は実デコード長で測った。
- **run_r2**: 切り出し **303.6〜345.9秒**（42.3秒）。曲の最後まで。
  - 根拠: 1秒RMSで 255〜345秒が連続して大きい（-24〜-29 dB）。40秒窓の平均が最大なのは終端より少し手前（-25.4 dB）だが、終端付近も -23〜-25 dB で同水準。曲の終わり（最終和音）で終わらせるため終端に合わせた。開始点は 303.6秒の局所的な谷（-31〜-32 dB）。主題の大きな再現部（Trio の再現）はこの終結部と推定（未試聴）。
- **recall_r2**: 切り出し **87〜117秒**（30秒）。30秒窓で最も静かで安定（平均 -37.7 dB、標準偏差 2.4 dB、端の差 0.6 dB）。中間部の穏やかな区間。
- 加工: run_r1 と同じ。

### run_r3.mp3 / recall_r3.mp3（R3）
- 曲名: 交響曲第9番 ニ短調 Op.125 第2楽章 Molto vivace（スケルツォ）（ベートーヴェン）
- 演奏: ヤッシャ・ホーレンシュタイン指揮 プロ・ムジカ交響楽団（Pantheon XP 2250、1956年録音）
- 入手: https://commons.wikimedia.org/wiki/File:02_Horenstein_9._Beethoven_Pantheon_XP_2250_-_2._Satz.flac （出典 https://archive.org/details/horenstein-pantheon-xp-2250/ ）
- ライセンス: Commons 表示は PD-EU-audio（録音から50年経過の EU 規定）。**確度: △**
  - 根拠が弱い理由: (1) PD-EU-audio は EU 圏の規定で、米国・日本など他国での保護期間は今回確認していない（未確認）。 (2) 出典は Internet Archive で、権利者の許諾の記載がない（permission 欄は空）。(3) 商業盤（Pantheon XP 2250）の可能性がある。
  - ユーザーは「第九らしさ優先で△は承知済み」と決定済み。公開時のリスクは残る。代替は海兵隊室内管弦楽団など◎の録音（第九ではない）。
- 原本の長さ 685.4秒。
- **run_r3**: 切り出し **640.7〜680.2秒**（39.5秒）。スケルツォ終結部、最終和音（約677〜679秒の強奏）で終わる。
  - 根拠: 1秒RMSでこの録音は全体に大きい（ピーク帯 -14〜-16 dB）。終盤 660〜679秒は -15〜-24 dB で盛り上がりと、最後の全奏（-16〜-20 dB）。全曲で最も大きい窓は 213〜253秒付近（平均 -18.8 dB）だが、「終わりがクライマックス」の条件を優先して終結部を採用。開始点は 640.7秒の谷（-27 dB）。**この録音は区間内に静かな谷を含むため（スケルツォの構造）、40秒を通して一定に盛り上がるとは限らない。**
- **recall_r3**: 切り出し **379〜409秒**（30秒）。30秒窓で最も静か（平均 -30.7 dB、標準偏差 2.5 dB、端の差 0.5 dB）。第九スケルツォは全体がうるさいので、他の曲より絶対値は大きい。
- 加工: flac→MP3、他は run_r1 と同じ。

## 効果音（すべて OpenGameArt、ライセンス CC0 1.0。表示義務なし。確度: ◎）
共通加工: MP3化(128kbps/44.1kHz/ステレオ)、トリミング、ピーク正規化、短いフェード。

| ファイル | 元ファイル / 作者 | 入手URL | 切り出し(秒) | 加工 |
|---|---|---|---|---|
| sfx_slash.mp3 | `RPG Sound Pack/battle/swing.wav` / HaelDB | https://opengameart.org/content/rpg-sound-pack | 0〜0.229（全体） | ピーク -3dBFS、末尾0.03秒フェード |
| sfx_hit.mp3 | `wood_impact/impactwood14` / independent.nu ljudbank（qubodup 投稿） | https://opengameart.org/content/35-wooden-crackshitsdestructions | 0〜0.6（元1.02秒） | ピーク -3dBFS、末尾0.2秒フェード |
| sfx_crash.mp3 | `qubodup-crash.ogg` / Luca Pixel（qubodup 投稿） | https://opengameart.org/content/crash-collision | 0〜0.58（全体） | ピーク -3dBFS、末尾0.1秒フェード |
| sfx_dark_loop.mp3 | `atmosmoody/atmoseerie01` / independent.nu ljudbank（NeoStrider 投稿） | https://opengameart.org/content/4-atmospheric-ghostly-loops | 元 0〜20秒 | 2〜20秒を本体、末尾2秒を元の0〜2秒とクロスフェードして継ぎ目を消した18秒。-26 LUFS |
| sfx_bike_coast.mp3 | `bicycle_spokes-1.wav` / Bicycle Sounds | https://opengameart.org/content/bicycle-sounds | 0〜1.158（全体） | ピーク -8dBFS、末尾0.1秒フェード |
| sfx_flash.mp3 | `flash_bang.wav` | https://opengameart.org/content/flash-bang-sound | 0〜3.0（元6.38秒） | ピーク -3dBFS、末尾1.0秒フェード |

- 作者名の取り違えに注意: ページ上の投稿者名（Submitted by）を記載した。CC0 なので表示は不要。
- すべて **未試聴**。「sfx_hit は木の衝撃音で、斬った手応えに合うかは耳で確認が必要」「sfx_flash は閃光弾（flash bang）の音で、白光に合うかは未確認」「sfx_bike_coast は『スポークの回転音』で惰性の音かは未確認」。
