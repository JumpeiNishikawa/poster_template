# poster_template — リポジトリ運用ガイド

このリポジトリは **学術ポスターのテンプレート原本＋制作ツール**です．
**ここで個別のポスターは作りません．** 案件ごとに別フォルダを生成して制作します．

## 構成

| パス | 役割 |
|---|---|
| `poster_template.html` | ポスター本体の原本（HTML+CSS+JS 単一ファイル） |
| `poster_spec.md` | 制作仕様書（可変4項目と固定項目のルール） |
| `tools/lint.mjs` | spec違反の静的チェッカー（依存なし・Node） |
| `tools/render.mjs` | Chrome/Edge headless で PDF/PNG 出力＋溢れ検出 |
| `tools/new-poster.ps1` | 別フォルダに案件一式を生成 |
| `tools/scaffold/` | 案件にコピーされる雛形（AGENTS.md / content.md / docs/） |

## 新しいポスターを作る（標準フロー）

```powershell
pwsh tools/new-poster.ps1 -Name his2026
# → $HOME\dev\posters\his2026\ に自己完結プロジェクトを生成（git初期化込み）
```

生成フォルダには `poster.html` / `poster_spec.md` / `content.md` / `AGENTS.md` /
`docs/` / `tools/`（lint・render）/ `figures/` / `out/` が入り，**単体で lint・render が動く**．
以後の制作はそのフォルダ内の `AGENTS.md` に従う（テンプレリポは触らない）．

オプション:
- `-Dest <親ディレクトリ>` 生成先を変更（既定 `$HOME\dev\posters`）
- `-NoGit` git初期化をしない

## ツールの使い方（このリポで原本を検証するとき）

```powershell
node tools/lint.mjs                 # poster_template.html を検査
node tools/render.mjs               # out/poster.pdf, out/poster.png を生成
```

- `lint`：font-size/color/border-radius/font-family の直書き，inline center，
  寸法の不一致（:root ↔ @page），フォントサイズ範囲違反を検出．エラー0で exit 0．
- `render`：PDF のページ数が2以上なら「1枚に収まっていない」と警告し exit 1．

## 原本（テンプレ）を編集するときのルール

テンプレ自体を直すのは**仕様の変更時のみ**．その際も spec §2 の可変4項目
（サイズ・向き／段組み／カラー2色／本文構造）の範囲を超える変更は，
`poster_spec.md` を先に更新してから行うこと．固定項目（フォント・サイズ・余白・
角丸・配置・罫線）の既定値は安易に変えない．

変更後は必ず `node tools/lint.mjs` が通ることを確認する．
見た目や収まりに関わる変更では `node tools/render.mjs` も実行し，PDFページ数と実測高さを確認する．
