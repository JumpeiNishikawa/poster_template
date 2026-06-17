# Project Log

## 2026-06-07

### Completed

- 過去のポスター案件で有効だったテンプレート改善点を汎用化して取り込み。
- 案件生成時に `AGENTS.md` と `docs/` のプロジェクトメモ雛形を配布する方針へ変更。
- 条件比較表、キー・バリュー行、セクション内小見出し、結果図下揃え、teal 強調ボックス、概念チェイン図の汎用CSSを追加。
- `poster_spec.md` の本文フォントサイズ記述を現行テンプレート実装に合わせて更新。
- `tools/lint.mjs` にフォントサイズ範囲チェックを追加。
- `tools/render.mjs` にポスター実測高さと残り/超過mmの表示を追加。

### Verification

- `node tools/lint.mjs`: OK。
- `node tools/render.mjs`: OK。PDF 1ページ、高さ `1132.5 / 1189.0 mm`（余裕 56.5mm）。
- `tools/new-poster.ps1 -Name scaffold_check -Dest .\out -NoGit`: OK。生成先に `AGENTS.md` と `docs/` 雛形が入ることを確認。
