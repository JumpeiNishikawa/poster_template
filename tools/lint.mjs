#!/usr/bin/env node
/*
  lint.mjs — ポスターHTMLが poster_spec.md の固定ルールに違反していないか静的検査する．
  依存なし（Node標準のみ）．

  使い方:
    node tools/lint.mjs [path/to/poster.html]
    （省略時は poster.html → poster_template.html の順に自動検出）

  検査内容（spec §3 / §4-5 準拠）:
    1. HTML本文の style 属性で，値が変数経由でない直書きを禁止
         - font-size  は var(--fs-*) 以外を禁止
         - color      は var(--col-*) 以外を禁止
         - border-radius は var(--r-*) または 0 以外を禁止
         - font-family は var(--font-*) 以外を禁止
    2. inline の text-align:center を禁止（中央揃えは CSS で定義済みの5箇所のみ）
    3. ポスター寸法の一致（:root の --poster-w/h と @page size，@media print 内の mm）
    4. --fs-* が 24pt 未満でないか（--fs-refs の 22pt のみ例外）

  終了コード: 違反0なら0，1件以上なら1．
*/

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '..');

function resolveTarget() {
  const arg = process.argv[2];
  if (arg) return resolve(process.cwd(), arg);
  for (const name of ['poster.html', 'poster_template.html']) {
    const p = resolve(process.cwd(), name);
    if (existsSync(p)) return p;
    const p2 = resolve(repoRoot, name);
    if (existsSync(p2)) return p2;
  }
  return null;
}

const target = resolveTarget();
if (!target || !existsSync(target)) {
  console.error('✗ 対象HTMLが見つかりません． 例: node tools/lint.mjs poster.html');
  process.exit(2);
}

const src = readFileSync(target, 'utf8');
const lines = src.split(/\r?\n/);
const errors = [];
const warnings = [];

function lineOf(index) {
  // 文字オフセット index が何行目かを返す（1始まり）
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

// ---- <body> 以降だけを対象にする（CSS定義部の固定値は検査しない）----
const bodyStart = src.search(/<body[\s>]/i);
const htmlBody = bodyStart >= 0 ? src.slice(bodyStart) : src;
const bodyOffset = bodyStart >= 0 ? bodyStart : 0;

// ---- 1 & 2. style 属性内の直書き検査 ----
const styleAttrRe = /style\s*=\s*"([^"]*)"/gi;
let m;
while ((m = styleAttrRe.exec(htmlBody)) !== null) {
  const decls = m[1];
  const at = bodyOffset + m.index;
  const ln = lineOf(at);

  for (const part of decls.split(';')) {
    const seg = part.trim();
    if (!seg) continue;
    const ci = seg.indexOf(':');
    if (ci < 0) continue;
    const prop = seg.slice(0, ci).trim().toLowerCase();
    const val = seg.slice(ci + 1).trim();

    if (prop === 'font-size' && !/var\(--fs-/.test(val)) {
      errors.push([ln, `font-size の直書き禁止（var(--fs-*) 経由のみ）: "${seg}"`]);
    }
    if (prop === 'color' && !/var\(--col-/.test(val)) {
      errors.push([ln, `color の直書き禁止（var(--col-*) 経由のみ）: "${seg}"`]);
    }
    if (prop === 'border-radius' && !/var\(--r-/.test(val) && !/^0(mm|px)?$/.test(val)) {
      errors.push([ln, `border-radius の直書き禁止（var(--r-*) か 0 のみ）: "${seg}"`]);
    }
    if (prop === 'font-family' && !/var\(--font-/.test(val)) {
      errors.push([ln, `font-family の直書き禁止（var(--font-*) 経由のみ）: "${seg}"`]);
    }
    if (prop === 'text-align' && /center/i.test(val)) {
      errors.push([ln, `inline の text-align:center 禁止（中央揃えは .n/.mv/.ml/.fc/.pf-fund のみ，CSSで定義済み）: "${seg}"`]);
    }
  }
}

// ---- 3. 寸法の一致 ----
const rootW = src.match(/--poster-w:\s*([\d.]+)mm/);
const rootH = src.match(/--poster-h:\s*([\d.]+)mm/);
const page  = src.match(/@page[^{]*{[^}]*size:\s*([\d.]+)mm\s+([\d.]+)mm/);

if (!rootW || !rootH) {
  errors.push([0, ':root の --poster-w / --poster-h が見つからない']);
} else if (!page) {
  errors.push([0, '@page { size: Wmm Hmm } が見つからない']);
} else {
  const w = rootW[1], h = rootH[1];
  if (page[1] !== w || page[2] !== h) {
    errors.push([lineOf(page.index), `@page size (${page[1]}mm ${page[2]}mm) が :root (${w}mm ${h}mm) と不一致`]);
  }
  // @media print ブロック内の mm 値が w/h 以外を含んでいないか
  const printBlock = src.match(/@media\s+print\s*{([\s\S]*?)\n\s*}\s*<\/style>/);
  if (printBlock) {
    const allowed = new Set([w, h]);
    const mmRe = /([\d.]+)mm/g;
    let mm2;
    while ((mm2 = mmRe.exec(printBlock[1])) !== null) {
      // ポスター寸法は数百mm．100mm以上で許容値以外なら寸法ハードコードの疑い．
      // （calc() 内の微調整 1mm 等は対象外）
      if (parseFloat(mm2[1]) >= 100 && !allowed.has(mm2[1])) {
        warnings.push([lineOf(printBlock.index + 12 + mm2.index), `@media print 内の ${mm2[1]}mm が :root 寸法 (${w}/${h}mm) と一致しない可能性`]);
      }
    }
  }
}

// ---- 4. フォントサイズ最小値（CSS定義部）----
const fsRe = /--fs-([a-z-]+):\s*([\d.]+)pt/g;
let fm;
while ((fm = fsRe.exec(src)) !== null) {
  const name = fm[1], pt = parseFloat(fm[2]);
  if (pt < 24 && name !== 'refs') {
    errors.push([lineOf(fm.index), `--fs-${name} が 24pt 未満（${pt}pt）．24pt未満は --fs-refs のみ許容`]);
  }
}

// ---- 出力 ----
const rel = target.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
errors.sort((a, b) => a[0] - b[0]);
warnings.sort((a, b) => a[0] - b[0]);

for (const [ln, msg] of warnings) console.log(`  ⚠ ${rel}:${ln}  ${msg}`);
for (const [ln, msg] of errors)   console.log(`  ✗ ${rel}:${ln}  ${msg}`);

if (errors.length === 0) {
  console.log(`✓ lint OK  (${rel})${warnings.length ? `  — 警告 ${warnings.length} 件` : ''}`);
  process.exit(0);
} else {
  console.log(`\n✗ lint NG  — エラー ${errors.length} 件 / 警告 ${warnings.length} 件  (${rel})`);
  process.exit(1);
}
