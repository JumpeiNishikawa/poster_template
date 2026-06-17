# 印刷用フォントのローカル埋め込み手順

`poster_spec.md §3-1` の方針：**編集・プレビューはオンライン読込でよいが，印刷用の最終成果物は
フォントをローカル woff2 に埋め込む**．印刷PC・印刷所・オフライン環境ではオンライン読込が効かず，
無言で別フォントに化けるため．本書はそのサブセット化と差し替えの手順．

> ポスターは見出し **Noto Serif JP**・本文 **Noto Sans JP** の全字種を使う（本文に何が入るか事前に
> 確定しないので，広い Unicode 範囲をまとめて取り込む）．装飾用に1〜2語だけ使うフォントと違い，
> サブセット後でも数MB規模になる点は許容する．

---

## 1. 前提ツール

```bash
python -m pip install --quiet fonttools brotli   # pyftsubset と woff2 圧縮
```

`pyftsubset`（fonttools 同梱）と brotli（woff2 出力に必要）が入ればよい．

## 2. 元TTFとライセンスを取得（OFLは必ず同梱する）

```bash
mkdir -p fonts
# 本文：Noto Sans JP（可変ウェイト）
curl -sL "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"  -o /tmp/NotoSansJP.ttf
# 見出し：Noto Serif JP（可変ウェイト）
curl -sL "https://github.com/google/fonts/raw/main/ofl/notoserifjp/NotoSerifJP%5Bwght%5D.ttf" -o /tmp/NotoSerifJP.ttf
# OFL ライセンス（再配布に必須・fonts/ に置く）
curl -sL "https://github.com/google/fonts/raw/main/ofl/notosansjp/OFL.txt"  -o fonts/OFL-NotoSansJP.txt
curl -sL "https://github.com/google/fonts/raw/main/ofl/notoserifjp/OFL.txt" -o fonts/OFL-NotoSerifJP.txt
```

## 3. サブセット化（可変ウェイト軸 `wght` は残す）

ウェイトで強弱を出すテンプレートなので，`--instance` せず可変軸を保持する．Unicode 範囲は
日本語ポスターで実用上必要な範囲（ASCII・約物・かな・カタカナ・CJK統合漢字・互換漢字・全角形など）を広く取る．

```bash
COMMON_UNICODES="U+0020-007E,U+00A0-00FF,U+2000-206F,U+2460-24FF,U+25A0-25FF,U+3000-303F,U+3040-309F,U+30A0-30FF,U+31F0-31FF,U+3200-32FF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF"

pyftsubset /tmp/NotoSansJP.ttf \
  --output-file=fonts/NotoSansJP-subset.woff2 --flavor=woff2 \
  --unicodes="$COMMON_UNICODES" --no-hinting --desubroutinize

pyftsubset /tmp/NotoSerifJP.ttf \
  --output-file=fonts/NotoSerifJP-subset.woff2 --flavor=woff2 \
  --unicodes="$COMMON_UNICODES" --no-hinting --desubroutinize
```

含めている Unicode 範囲の意味：ASCII / Latin-1補助 / 一般句読点 / 囲み英数（①②…）/ 幾何学模様 /
CJK記号・約物 / ひらがな / カタカナ / カタカナ拡張 / 囲みCJK / **CJK統合漢字 (U+4E00–9FFF)** /
CJK互換漢字 / 半角・全角形．

## 4. poster.html を差し替える

ヘッド先頭の Google Fonts の `@import` を**削除**し，コメントで用意してある `@font-face` ブロックを有効化する
（本体HTMLの該当コメントに同じ定義がある）：

```css
@font-face {
  font-family: 'Noto Sans JP'; font-style: normal; font-weight: 400 900;
  font-display: block; src: url('fonts/NotoSansJP-subset.woff2') format('woff2');
}
@font-face {
  font-family: 'Noto Serif JP'; font-style: normal; font-weight: 400 900;
  font-display: block; src: url('fonts/NotoSerifJP-subset.woff2') format('woff2');
}
```

## 5. 検証

- ブラウザで開く：未読込なら本体同梱の **`#font-warning` 検知バナー**が画面最上部に赤帯で出る．
  出なければ適用OK（バナーはレイアウトに影響せず PDF/PNG にも写らない）．
- `node tools/render.mjs` で PDF/PNG を出し，見出しが明朝（Serif）・本文がゴシック（Sans）で，
  ウェイトの強弱が効いているかを目視確認する．

## 6. 落とし穴

- **豆腐化：** サブセット範囲外の文字（記号・外字・追加した漢字）は □ になる．本文に新しい字を足したら
  サブセットを作り直す．迷ったら §3 の範囲を広めに取り直す．
- **ウェイト：** `--instance` で単一ウェイトに固定するとファイルは小さくなるが，テンプレが使う
  400/700/900 の強弱が出せなくなる．可変軸を残すこと．
- **ライセンス：** OFL の `OFL-*.txt` を `fonts/` に必ず同梱して再配布する．
