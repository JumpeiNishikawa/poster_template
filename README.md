# poster_template — 学術ポスター制作テンプレート

**A0/A1 の学術ポスター**を HTML + CSS + JS の**単一ファイル**で作るためのテンプレート原本と制作ツール一式。
PowerPoint のようなバイナリを正本にせず、本文・レイアウト・図の調整履歴を**テキストで Git 追跡**できる。
**AI エージェントとの協業**を前提に設計されている（案件フォルダには、エージェント向け指示書 `AGENTS.md` と
仕様書 `poster_spec.md` が同梱され、人が方針を出し、エージェントが局所修正する足場になる）。

> このリポジトリは **原本＋ツール置き場**。ここで個別のポスターは作らない。
> 案件ごとに `new-poster.ps1` で**別フォルダに自己完結プロジェクトを生成**して制作する。

## 何が作れる

- **学術ポスター（主用途）** — A0縦が既定。A0横・A1縦にも切替可（`poster_spec.md §2-1`）。
- **A版の印刷物への流用（チラシ等）** — 同じ HTML/CSS＋ツールの作法を、A4チラシなど他の A 版資料にも転用できる。
  実例として **2026年オープンキャンパスの A4 両面チラシ**が本テンプレから派生して作られた。
  ただしチラシ特有の紙面構造（両面・台紙など）は案件側で個別に作り込む（自動生成はしない）。
  → 流用の具体手順は後述の「[A版資料への流用](#a版資料への流用)」。

---

## クイックスタート

```powershell
# 新しいポスター案件を生成（$HOME\dev\posters\symposium2026\ に自己完結プロジェクト＋git初期化）
pwsh tools/new-poster.ps1 -Name symposium2026

cd $HOME\dev\posters\symposium2026
#  → content.md に素材を記入 → poster.html に流し込み
node tools/lint.mjs        # 仕様チェック
node tools/render.mjs      # out/poster.pdf + out/poster.png 生成＆1枚に収まるか判定
```

生成フォルダは `poster.html` / `poster_spec.md` / `content.md` / `AGENTS.md` / `docs/` / `tools/` /
`figures/` / `fonts/` / `out/` を含み、**テンプレリポに依存せず単体で lint・render が動く**。
以後の制作はそのフォルダ内の `AGENTS.md` に従う。

---

## リポジトリ構成

| パス | 役割 |
|---|---|
| `poster_template.html` | ポスター本体の原本（HTML+CSS+JS 単一ファイル） |
| `poster_spec.md` | 制作仕様書（可変4項目と固定項目のルール） |
| `ai_poster_workflow.md` | AI協業ワークフロー案（図の扱い・調整の考え方） |
| `tools/new-poster.ps1` | 別フォルダに案件一式を生成（来歴スタンプ込み） |
| `tools/lint.mjs` | spec 違反の静的チェッカー（依存なし・Node） |
| `tools/render.mjs` | Chrome/Edge headless で PDF/PNG 出力＋溢れ検出 |
| `tools/view_pdf.ps1` | 参照PDF（お手本・前年版）を画像化して見比べる |
| `tools/scaffold/` | 案件にコピーされる雛形（AGENTS.md / content.md / docs/） |
| `docs/BACKPORT.md` | 案件の知見をテンプレに戻す（harvest）手順 |
| `docs/DECISIONS.md` | テンプレ仕様・運用の判断記録 |

---

## スクリプトの使い方

### `new-poster.ps1` — 案件生成 / ツール更新

```powershell
pwsh tools/new-poster.ps1 -Name <案件名>                 # 既定: $HOME\dev\posters\<案件名>
pwsh tools/new-poster.ps1 -Name <案件名> -Dest D:\work    # 生成先を変える
pwsh tools/new-poster.ps1 -Name <案件名> -NoGit           # git 初期化しない
pwsh tools/new-poster.ps1 -Name <案件名> -RefreshTools    # 既存案件にツール(tools/+spec)だけ入れ直す
```

`-RefreshTools` は `tools/lint.mjs`・`render.mjs`・`view_pdf.ps1`・`poster_spec.md` のみ上書きし、
`poster.html`・`content.md`・`docs` には触れない（差分は手動で確認・commit）。
生成時は派生元テンプレの commit を案件の `docs/PROJECT_LOG.md` に刻む（知見還元の差分基準）。

### `lint.mjs` — 仕様チェック（依存なし）

```powershell
node tools/lint.mjs [path/to/poster.html]    # 省略時は poster.html → poster_template.html を自動検出
```

`font-size`/`color`/`border-radius`/`font-family` の直書き、inline の中央揃え、`:root` ↔ `@page` の寸法不一致、
フォントサイズ範囲違反を検出。エラー0で exit 0。

### `render.mjs` — PDF/PNG 出力＋溢れ検出

```powershell
node tools/render.mjs [path/to/poster.html] [--out out]
```

`out/poster.pdf`（実寸）と `out/poster.png`（見た目確認）を生成。**PDF が2ページ以上なら「1枚に収まっていない」**
と警告し exit 1。実測高さ（余裕/超過 mm）も表示する。Chrome または Edge を自動検出。

### `view_pdf.ps1` — 参照PDFの画像化

```powershell
pwsh tools/view_pdf.ps1 -Pdf <参照PDF> [-Dpi 200] [-Prefix ref]   # poppler(pdftoppm) が必要
```

お手本・前年版・入稿前確認の PDF を PNG 群（`out/<Prefix>-*.png`）にして、人やエージェントが見比べられるようにする。

---

## 制作の流れ（人 × AI エージェント）

1. `new-poster.ps1` で案件を生成する。
2. エージェントが案件の `AGENTS.md` と `poster_spec.md` を読み、`content.md` の素材を `poster.html` に流し込む。
3. `node tools/lint.mjs` と `node tools/render.mjs` が**両方通るまで**を1サイクルとして調整する
   （溢れたら本文量・図サイズ・カード数を見直す）。
4. **印刷前にフォントを埋め込む**（`docs/FONT_EMBEDDING.md`）。未読込なら画面に赤帯警告（`#font-warning`）が出る。
5. 「これで確定」になったら `out/poster.pdf` / `out/poster.png` を `git add` して commit
   （中間レンダーは追跡しない。安定版だけ GitHub 公開・配布用に残す）。
6. 完成後、案件の `docs/HARVEST.md` に従い、得た**汎用的な学び**をテンプレへ戻す（下記）。

各案件は git 初期化済みなので、`git remote add` → push で**独立した GitHub リポ**にできる。

### 印刷設定（Chrome 推奨）

`Ctrl+P` → 送信先=PDFに保存／用紙=A0（または該当サイズ）／**余白=なし**／**背景のグラフィック=オン**。
Firefox/Safari は `@page size` の対応が不完全なため非推奨。画面で1枚に見えても、必ず `render.mjs` で
PDF のページ数を実測する（`poster_spec.md §6-1` の落とし穴）。

---

## A版資料への流用

学術ポスター以外（チラシ等）に転用するときの勘所：

- **サイズ** — `:root` の `--poster-w` / `--poster-h` と `@media print` の `@page size` を同時に書き換える
  （`lint.mjs` が一致を検証）。A4なら `210mm × 297mm`。
- **フォントサイズ** — テンプレ既定は A0・1–2m 閲覧前提（大きめ）。手配り A4 等では用途に合わせて作り直す
  （`poster_spec.md §3-2` の範囲思想は流用しつつ、実寸はソースを実測して決める）。
- **構造** — 表裏・台紙のような紙面固有の構造は案件側で実装する。テンプレの単一ページ構造に縛られない。
- **作法は流用** — 変数化・oklch 新規色・フォント埋め込み・参照PDF比較・PDF実測は、A版資料でもそのまま有効。

実績：`オープンキャンパス向け A4チラシ`（派生案件）。そこで得た汎用知見は本テンプレに還元済み（`docs/DECISIONS.md` 2026-06-17）。

---

## 知見の還元（harvest）

案件は**コピー由来の自己完結プロジェクト**（フォークでもパス参照でもない）。テンプレ更新は自動伝播しない代わりに、
制作で得た汎用的な学びは一方向にテンプレへ集約する。

- **案件側**：完成時に `docs/HARVEST.md` の雛形で `_backport-inbox-from-<案件>.md` を作る（汎用↔固有を仕分け）。
- **テンプレ側**：`docs/BACKPORT.md` の手順で適用（独立裏取り → spec-first → lint/render → `DECISIONS.md` 記録 → 消化）。

---

## 必要環境

| 用途 | 必要なもの |
|---|---|
| 生成・ツール（`new-poster`/`view_pdf`） | PowerShell 7（`pwsh`）、git |
| lint・render | Node.js、Google Chrome または Microsoft Edge |
| 参照PDFの画像化（`view_pdf`） | poppler（`pdftoppm`） |
| フォント埋め込み（任意・印刷用） | Python ＋ `fonttools`・`brotli` |

埋め込みフォント（Noto 等）は OFL。再配布時は `OFL-*.txt` を `fonts/` に同梱すること（`docs/FONT_EMBEDDING.md`）。

---

## もっと詳しく

- `poster_spec.md` — 可変4項目（サイズ・段組み・2色・本文構造）と固定項目（フォント・余白・角丸・配置・罫線）の規則。
- `ai_poster_workflow.md` — 図の扱い・SVG/Matplotlib・AI への指示の出し方・微調整手順。
- `AGENTS.md` — テンプレ原本を保守・編集するときのルール（保守者／エージェント向け）。
- `docs/DECISIONS.md` — なぜその仕様・運用にしたかの判断記録。
