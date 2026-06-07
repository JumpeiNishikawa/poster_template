#!/usr/bin/env node
/*
  render.mjs — Chrome / Edge の headless でポスターを PDF と PNG に出力する．
  さらに PDF のページ数を数え，2ページ以上なら「内容が1枚に収まっていない」と警告する．
  依存なし（Node標準＋ローカルの Chrome/Edge を利用）．

  使い方:
    node tools/render.mjs [path/to/poster.html] [--out out]

  出力:
    <out>/poster.pdf   印刷確認用（@page size の実寸）
    <out>/poster.png   見た目確認用（ヘッダーが切れない縦長スクショ）

  終了コード: 正常出力かつ1ページなら0，溢れ検出なら1，失敗なら2．
*/

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '..');

// ---- 引数 ----
const args = process.argv.slice(2);
let target = null;
let outDir = 'out';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') { outDir = args[++i]; continue; }
  if (!target) target = args[i];
}
if (!target) {
  for (const name of ['poster.html', 'poster_template.html']) {
    if (existsSync(resolve(process.cwd(), name))) { target = name; break; }
    if (existsSync(resolve(repoRoot, name)))      { target = resolve(repoRoot, name); break; }
  }
}
const targetPath = target ? resolve(process.cwd(), target) : null;
if (!targetPath || !existsSync(targetPath)) {
  console.error('✗ 対象HTMLが見つかりません． 例: node tools/render.mjs poster.html');
  process.exit(2);
}
const outAbs = resolve(process.cwd(), outDir);
mkdirSync(outAbs, { recursive: true });

// ---- ブラウザ検出 ----
const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const browser = candidates.find(existsSync);
if (!browser) {
  console.error('✗ Chrome / Edge が見つかりません． 既知のパスを確認してください．');
  process.exit(2);
}

const fileUrl = pathToFileURL(targetPath).href;
const pdfPath = resolve(outAbs, 'poster.pdf');
const pngPath = resolve(outAbs, 'poster.png');
const src = readFileSync(targetPath, 'utf8');

// プレビューJSはウィンドウ幅で縮小表示する．スクショは縦長窓で撮ってヘッダーを確実に含める．
const commonFlags = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars'];

function run(extra, label) {
  const r = spawnSync(browser, [...commonFlags, ...extra, fileUrl], {
    encoding: 'utf8', timeout: 120000,
  });
  if (r.status !== 0 && !existsSync(extra._artifact)) {
    console.error(`✗ ${label} 失敗: ${(r.stderr || r.error || '').toString().slice(0, 400)}`);
    return false;
  }
  return true;
}

// PDF（実寸はHTMLの @page size に従う）
const pdfArgs = ['--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`];
pdfArgs._artifact = pdfPath;
const pdfOk = run(pdfArgs, 'PDF出力');

// PNG（A0比率の縦長窓）
const pngArgs = ['--screenshot=' + pngPath, '--window-size=1190,1684'];
pngArgs._artifact = pngPath;
const pngOk = run(pngArgs, 'PNG出力');

// ---- レイアウト高さの実測（screen側のtransformを避け，offset/scroll寸法からmm換算）----
function measureLayout() {
  const probePath = resolve(outAbs, '__layout_probe__.html');
  const probeScript = `
<script>
(() => {
  const poster = document.querySelector('#poster');
  const pb = document.querySelector('.pb');
  const ph = document.querySelector('.ph');
  const pf = document.querySelector('.pf');
  const readMM = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  const pageWmm = readMM('--poster-w');
  const pageHmm = readMM('--poster-h');
  const pxPerMm = poster && pageWmm ? poster.offsetWidth / pageWmm : null;
  const flowPx =
    (ph ? ph.offsetHeight : 0) +
    (pb ? pb.scrollHeight : 0) +
    (pf ? pf.offsetHeight : 0);
  const contentHmm = pxPerMm ? flowPx / pxPerMm : null;
  const result = {
    pageWmm,
    pageHmm,
    contentHmm,
    remainingMm: contentHmm == null ? null : pageHmm - contentHmm
  };
  document.body.innerHTML = '<pre id="__poster_layout__">' + JSON.stringify(result) + '</pre>';
})();
</script>`;
  const html = src.replace(/<\/body>/i, `${probeScript}\n</body>`);
  writeFileSync(probePath, html, 'utf8');
  try {
    const r = spawnSync(browser, [...commonFlags, '--dump-dom', pathToFileURL(probePath).href], {
      encoding: 'utf8', timeout: 120000,
    });
    const m = (r.stdout || '').match(/<pre id="__poster_layout__">([^<]+)<\/pre>/);
    if (!m) return null;
    return JSON.parse(m[1]);
  } catch {
    return null;
  } finally {
    try { unlinkSync(probePath); } catch {}
  }
}

const layout = measureLayout();

// ---- PDFページ数の判定 ----
let pages = null;
if (pdfOk && existsSync(pdfPath)) {
  const buf = readFileSync(pdfPath, 'latin1');
  const m = buf.match(/\/Type\s*\/Page[^s]/g);
  pages = m ? m.length : null;
}

// ---- 出力サマリ ----
const kb = (p) => existsSync(p) ? Math.round(statSync(p).size / 1024) : 0;
console.log(`  ブラウザ : ${browser.includes('msedge') ? 'Edge' : 'Chrome'}`);
if (pdfOk) console.log(`  PDF      : ${pdfPath}  (${kb(pdfPath)} KB)`);
if (pngOk) console.log(`  PNG      : ${pngPath}  (${kb(pngPath)} KB)`);
if (layout && layout.contentHmm != null) {
  const remaining = layout.remainingMm;
  const fit = remaining >= 0
    ? `余裕 ${remaining.toFixed(1)} mm`
    : `超過 ${Math.abs(remaining).toFixed(1)} mm`;
  console.log(`  高さ    : ${layout.contentHmm.toFixed(1)} / ${layout.pageHmm.toFixed(1)} mm  (${fit})`);
}

if (pages != null) {
  if (pages <= 1) {
    console.log(`✓ レンダリングOK — PDF ${pages} ページ（1枚に収まっています）`);
    process.exit(0);
  } else {
    console.log(`✗ オーバーフロー — PDF ${pages} ページ．内容が1枚に収まっていません．分量を減らすか図を縮小してください．`);
    process.exit(1);
  }
} else {
  console.log('⚠ ページ数を判定できませんでした（PDFを目視確認してください）');
  process.exit(pdfOk ? 0 : 2);
}
