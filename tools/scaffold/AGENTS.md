# ポスター制作ガイド

このフォルダは **1件のポスター制作プロジェクト**です。`poster_template` から生成されました。

## 最初に読む

- `poster_spec.md` — 制作仕様書。固定項目と禁止事項を確認する。
- `content.md` — 論文要点・実験数値・図リストの素材シート。
- `docs/PROJECT_LOG.md` — 現在の状態、最新変更、未解決点。
- `docs/TASKS.md` — 作業チェックリスト。
- `docs/DECISIONS.md` — 仕様や表現の判断理由。
- `docs/REFERENCES.md` — 参照資料と実装に効いた観察。

## 変更してよい範囲

通常変更してよいのは以下です。

| 項目 | 変更箇所 |
|---|---|
| サイズ・向き | `:root` の `--poster-w` / `--poster-h` と `@page size` |
| 段組み | カード内の `.cols-*` と、必要な場合の局所的な `grid-template-columns` |
| カラー | `--col-primary` / `--col-secondary` |
| 本文の中身 | `poster.html` の `<body>` 内テキスト・図・数値 |

フォント、余白、角丸、配置、罫線はテンプレート既定を基準にする。変更が必要な場合は `docs/DECISIONS.md` に理由を残す。

カラーを**新しく足す**ときは hex/rgba ではなく `oklch(L C H)` で書く（明度 L を揃えると輝度が揃い、印刷調整が楽）。既存プリセットの hex はそのままでよい。色分け用の薄色は半透明（rgba/アルファ）ではなく不透明色で持つ（印刷で色が転ぶのを防ぐ）。詳細は `poster_spec.md §2-3`。

## HTMLでやってはいけないこと

- `font-size` の数値直書き。`var(--fs-*)` 経由にする。
- `color` の直書き。`var(--col-*)` 経由にする。
- `border-radius` の直書き。`var(--r-*)` または `0` にする。
- `font-family` の直書き。`var(--font-*)` 経由にする。
- 本文・補足・見出しへの `text-align:center` 追加。

これらは `node tools/lint.mjs` が検出する。

## 制作ワークフロー

```powershell
node tools/lint.mjs
node tools/render.mjs
git status --short
```

`lint` と `render` の両方が通るまでを1サイクルとする。`render` が2ページ以上を検出した場合は、文章量、図サイズ、カード数を見直す。

## 作業規範

- **数値はソースを実測してから入れる。** フォントサイズ・余白・配色などを参照資料（PPTX/PDF/画像）から起こすときは、目視の推定ではなく `python-pptx` / `pdftoppm` 等で実測してから適用する。推定値を使うときは「推定」と明示する。
- **論理単位ごとに git コミットする。** 意味のある変更（1リファクタ・1バグ修正・1セクション調整）が終わるたびにコミットし、未コミットの差分を溜めない。`lint` と `render` を通してからコミットする。
- **印刷前にフォントを埋め込む。** 画面プレビューはオンライン読込でよいが、印刷・入稿用の最終成果物はフォントをローカル woff2 に埋め込む（手順 `docs/FONT_EMBEDDING.md`）。未読込なら画面に `#font-warning` の赤帯が出る。外部JS（アイコンライブラリ等）を使う場合も同様に CDN ではなくローカルに同梱し、オフライン・印刷PCで壊れないようにする。
- **画面を信用せず PDF を実測する。** ページ数や溢れは画面表示ではなく `node tools/render.mjs` の出力で確認する（`poster_spec.md §6-1`）。
- **参照PDF（お手本・前年版）は画像で見比べる。** `pwsh tools/view_pdf.ps1 -Pdf <参照PDF>` で PNG 化して `out/` に出す。

## 図とレイアウトの方針

- 図は `figures/` に置く。ファイル名は内容がわかる英小文字にする。
- 結果グラフは可能なら再生成可能な正本を残す。
- 最終組版で頻繁に調整する概念図は、HTML/CSSまたはSVGとして編集可能に保つ。
- 条件比較は縦にカードを積まず、まず `.cond-table` を検討する。
- 観測指標や停止条件の補足は、カード化せず `p.sub` で足りるならそのままにする。

## プロジェクトメモ

まとまった変更後は以下を更新する。

- `docs/PROJECT_LOG.md`
- `docs/DECISIONS.md`
- `docs/REFERENCES.md`
- `docs/TASKS.md`

秘密情報、個人情報、絶対パス、生成物、キャッシュ、大きなバイナリはプロジェクトメモに保存しない。
