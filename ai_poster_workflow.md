# AI共同ポスター制作ワークフロー案

## 1．基本方針

ポスター本体はHTML/CSSで作成し，Gitで管理する．PowerPointのようなバイナリファイルを正本にせず，ポスターの構造，本文，レイアウト，図の調整履歴をテキストとして追跡可能にする．

ポスター制作では，内容とレイアウトが強く相互依存する．そのため，本文をMarkdown，見た目を別テンプレート，という完全分離にはこだわらない．最終段階では，HTML/CSSを見ながら本文表現，ブロックサイズ，図の占有面積，余白，改行位置を同時に調整する．

Markdownは初期本文，構成案，作業ログ，AIへの指示ログに使う．最終正本はHTML/CSSとする．

## 2．推奨ディレクトリ構成

```text
poster/
  poster.html              # 最終正本
  css/
    base.css               # 研究室共通スタイル
    layout.css             # 今回ポスター固有の配置
    figures.css            # 図・SVG用スタイル
  js/
    figures.js             # 図の共通描画関数
    figure-data.js         # 図ごとのノード・線・座標データ
  figures/
    src/
      result_plot.py       # Matplotlib等の図生成スクリプト
    dist/
      result_plot.svg      # 必要に応じて生成された図
  assets/
    logos/
    photos/
  drafts/
    content.md             # 初期本文・構成案
    compression-notes.md   # 短縮表現・代替見出し案
  notes/
    worklog.md             # 作業判断・変更理由
    prompts.md             # 有効だったAI指示
```

小規模なポスターでは，`poster.html`，`poster.css`，`figures.js` 程度にまとめてもよい．ただし，研究室テンプレートとして育てる場合は，本文，スタイル，図生成，作業ログを分ける．

## 3．ポスター本体の作り方

HTMLは，AIが局所修正しやすいように，セクションごとに明確なIDとクラスを付ける．

```html
<section id="method" class="poster-block">
  <h2>Method</h2>
  <p class="lead">...</p>
  <p class="body">...</p>
</section>
```

AIへの指示は，編集対象を明示する．

```text
#method の .lead だけを，意味を変えずに15％短くしてください．
h2 と図は変更しないでください．
```

CSSでは，フォントサイズ，余白，線幅，図中ラベルサイズなどを変数化する．

```css
:root {
  --font-main: "Noto Sans JP", "Inter", sans-serif;

  --body-size: 24px;
  --caption-size: 18px;

  --figure-label-size: var(--body-size);
  --figure-small-label-size: 20px;
  --figure-line-width: 2.4px;
  --figure-node-stroke: 2.2px;

  --block-gap: 24px;
  --block-padding: 20px;
}
```

最終調整では，個別要素に直接 `style` を書き足すより，できるだけCSS変数やセクション単位のクラスで調整する．

## 4．図の基本方針

図は次の3種類に分けて扱う．

```text
A．概念図・模式図・処理フロー図
  → HTML/CSS，インラインSVG，小さなJS生成SVGで作る

B．結果グラフ・統計図
  → Python/Matplotlib等を正本にしてSVG出力する

C．写真・スクリーンショット・ロゴ
  → 外部画像として扱う
```

最終組版段階で頻繁にサイズや配置を調整する図は，外部画像として貼らない．可能な限り，HTML内のインラインSVGまたはJS生成SVGとして持つ．

## 5．インラインSVG／JS生成SVGの方針

図の縦横比，線幅，フォントサイズを独立して調整できるようにする．完成したSVGやPNGを単純に縮小・拡大するのではなく，座標やレイアウトパラメータを変更する．

基本構成は次のようにする．

```html
<figure class="poster-figure model-flow">
  <svg
    id="model-flow"
    class="diagram-svg"
    viewBox="0 0 1000 420"
    role="img"
    aria-label="Model flow diagram"
  ></svg>
  <figcaption>Overview of the model.</figcaption>
</figure>
```

```css
.diagram-svg {
  width: 100%;
  height: auto;
}

.diagram-svg text {
  font-family: var(--font-main);
  fill: var(--text-color);
}

.diagram-label {
  font-size: var(--figure-label-size);
  font-weight: 600;
}

.diagram-edge {
  stroke: var(--text-color);
  stroke-width: var(--figure-line-width);
  fill: none;
}
```

図データは，人間とAIが読みやすい形にする．

```js
const modelFlow = {
  scaleX: 0.94,
  scaleY: 1.00,
  nodes: [
    { id: "input", label: "Input", x: 80, y: 140, w: 160, h: 72 },
    { id: "retrieval", label: "Retrieval", x: 360, y: 140, w: 190, h: 72 },
    { id: "response", label: "Response", x: 680, y: 140, w: 190, h: 72 }
  ],
  edges: [
    ["input", "retrieval"],
    ["retrieval", "response"]
  ]
};
```

最終調整では，次のように操作する．

```text
横に詰める：
  scaleX を 0.94 から 0.90 にする

縦方向を少し広げる：
  scaleY を 1.00 から 1.05 にする

線を少し太くする：
  --figure-line-width を 2.4px から 2.7px にする

図中ラベルを本文と揃える：
  --figure-label-size: var(--body-size)

小ラベルだけ小さくする：
  --figure-small-label-size を調整する
```

重要なのは，図全体に `transform: scale()` をかけて潰さないこと．座標，線幅，文字サイズを分離して調整する．

## 6．Matplotlibとの使い分け

結果グラフや統計図は，Matplotlibを使ってよい．Pythonスクリプトを正本にし，データから再生成できるようにする．

SVG出力時には，文字をアウトライン化しない設定を入れる．

```python
import matplotlib as mpl
mpl.rcParams["svg.fonttype"] = "none"
```

これにより，SVG内の文字が `<text>` として残り，後処理やCSS調整がしやすくなる．

Matplotlib SVGは，次のどちらかで使う．

```text
1．結果グラフとしてそのまま使う
  Python正本を維持し，必要なら再生成する

2．概念図の初版として使う
  SVGをAIに解読させ，HTML/SVG/JSコンポーネントへ再構成する
```

ただし，Matplotlib SVGは冗長になりやすい．そのまま最終正本にするより，必要に応じてAIに以下を依頼する．

```text
このMatplotlib SVGを，編集しやすいインラインSVGまたはJS図コンポーネントに再構成してください．
完全再現より，構造化，CSS変数化，可読性を優先してください．
```

## 7．AIに修正させるときのルール

AIに自由に全体を書き換えさせない．編集可能領域を明示する．

AIに触らせてよいもの：

```text
本文
見出し
CSS変数
図データの x, y, w, h
scaleX, scaleY
label文言
node / edge 定義
```

AIに原則触らせないもの：

```text
共通描画関数
低レベルSVG生成処理
フォント指定の個別直書き
外部ライブラリ導入
viewBoxの場当たり的変更
style属性の乱用
```

コード内にコメントを入れる．

```js
// AI EDITABLE:
// You may change scaleX, scaleY, node positions, node sizes, labels, and edges.
// Do not modify drawFlowDiagram() unless explicitly requested.
```

AIへの指示例：

```text
modelFlow の図だけ横方向に8％詰めてください．
ただし，図中ラベルのフォントサイズ，線幅，ノードの角丸は変えないでください．
変更してよいのは scaleX と各ノードの x 座標だけです．
```

## 8．手作業微調整の手順

最終盤では，ブラウザでプレビューしながら，次の順で調整する．

1．全体グリッドとブロックサイズを調整する  
2．本文量を短縮する  
3．図の占有面積を決める  
4．図の座標スケールを調整する  
5．線幅・ラベルサイズ・凡例位置を調整する  
6．見出しやリード文の改行位置を整える  
7．PDF出力して印刷寸法とフォント埋め込みを確認する  

図のサイズが合わない場合，まず外部画像を縮小するのではなく，以下を検討する．

```text
概念図：
  scaleX / scaleY / node gap / label position を調整

結果グラフ：
  Python側でfigsize，余白，凡例位置を調整して再生成

本文と密接な図：
  HTML/CSS/SVGコンポーネント化する
```

## 9．PDF出力

まずはブラウザまたはPlaywrightでPDF出力する．出力ズレが大きい場合は，VivliostyleやPaged.jsを検討する．

PDFはGit履歴を太らせやすいため，運用を決める．

```text
Git管理する：
  HTML，CSS，JS，Python，CSV/JSON，SVGソース，小さいロゴ

Git管理しない：
  node_modules，中間PDF，大きなPNG，スクリーンショット，生成済みの一時SVG

最終PDF：
  必要に応じてrelease，Git LFS，または成果物フォルダで管理
```

## 10．研究室テンプレート化

研究室テンプレートとして育てる場合，抽象化しすぎない．最初から独自DSLや複雑なMarkdown変換規則を作らない．

まず整備するもの：

```text
A0/A1サイズ用CSS
2カラム・3カラムのサンプル
poster.htmlの最小例
CSS変数一覧
図コンポーネントのサンプル
Matplotlib SVG出力テンプレート
AI修正指示テンプレート
PDF出力手順
```

テンプレートの目的は，自動で完璧なポスターを作ることではない．  
AIと人間が壊さずに局所修正できる編集足場を作ることである．

## 11．最終的な運用思想

このワークフローでは，PowerPointのように図や本文を視覚的に直接触るのではなく，調整可能なパラメータをテキストとして管理する．

特に重要なのは，図を単なる貼り付け画像にしないこと．  
図中ラベル，線幅，凡例，座標，余白を，本文の組版と同じCSS変数・HTML構造の中で扱えるようにする．

これにより，次を同時に満たすことを狙う．

```text
Git差分で追える
AIが局所修正しやすい
人間が読める
最終盤の微調整ができる
図と本文のフォント体系を揃えられる
リポジトリを軽量に保てる
研究室テンプレートとして再利用できる
```
