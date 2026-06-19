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
    4. --fs-* が spec の許容範囲内か（--fs-body は 28–36pt を許容）
    5. コントラスト（WCAG 2.1）：可変2色に依存する「文字×地」ペアのコントラスト比を検査
         - <4.5:1 を warning（AA通常テキスト基準），<3.0:1 を error（AA大文字でも不可）
         - 半透明地は背景へ合成してから判定．hex/rgb(a)/oklch（相対色 from 含む）を解決．
         - 意図的に淡いテキスト（muted/sub）は情報表示のみで exit に影響しない．
         - グラデーション地・.sc--tint 等の階調面は静的判定せず，docs のAI視覚チェックに回す．

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
      errors.push([ln, `inline の text-align:center 禁止（中央揃えはCSS定義済みの部品のみ）: "${seg}"`]);
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

// ---- 4. フォントサイズ範囲（CSS定義部）----
const fsRules = new Map([
  ['title',   { min: 85, max: 100 }],
  ['authors', { min: 40, max: 56 }],
  ['affil',   { min: 30, max: 42 }],
  ['tag',     { min: 24, max: 32 }],
  ['heading', { min: 36, max: 52 }],
  ['body',    { min: 28, max: 36 }],
  ['sub',     { min: 24, max: 30 }],
  ['caption', { min: 24, max: 28 }],
  ['refs',    { min: 20, max: 24 }],
]);
const fsRe = /--fs-([a-z-]+):\s*([\d.]+)pt/g;
let fm;
while ((fm = fsRe.exec(src)) !== null) {
  const name = fm[1], pt = parseFloat(fm[2]);
  const rule = fsRules.get(name);
  if (rule && (pt < rule.min || pt > rule.max)) {
    errors.push([lineOf(fm.index), `--fs-${name} が許容範囲外（${pt}pt）．許容: ${rule.min}–${rule.max}pt`]);
  } else if (!rule && pt < 24 && name !== 'refs') {
    errors.push([lineOf(fm.index), `--fs-${name} が 24pt 未満（${pt}pt）．24pt未満は --fs-refs のみ許容`]);
  }
}

// ---- 5. コントラスト（WCAG 2.1）----
// 色解決：:root の var 定義を集め，hex/rgb(a)/oklch（相対色 from 含む）を sRGB に解決する．
const contrastInfo = [];  // 情報表示のみ（exit に影響しない）

(function checkContrast() {
  // --- :root と @supports 内の :root から var 定義を収集 ---
  // コメント（/* */ と <!-- -->）を除去してから走査（コメント内の擬似定義を拾わないため）
  const cssSrc = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  const vars = new Map();
  const declRe = /(--[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/gi;
  let d;
  while ((d = declRe.exec(cssSrc)) !== null) {
    const name = d[1].toLowerCase();
    // 既存定義を上書きしない（最初の :root 定義を優先．@supports 派生は別名なので衝突しない）
    if (!vars.has(name)) vars.set(name, d[2].trim());
  }

  // --- sRGB 変換ユーティリティ ---
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const lin2srgb = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  function oklabToSrgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    return [clamp01(lin2srgb(r)), clamp01(lin2srgb(g)), clamp01(lin2srgb(bl))];
  }
  function srgbToOklch([r, g, b]) {
    const s2l = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    const lr = s2l(r), lg = s2l(g), lb = s2l(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    const C = Math.hypot(A, B);
    let H = Math.atan2(B, A) * 180 / Math.PI; if (H < 0) H += 360;
    return { L, C, H };
  }

  // 相対色の式（l/c/h・calc(l+n)・calc(c*n)）を base の OKLCH 値で評価
  function evalExpr(expr, base) {
    expr = expr.trim();
    const cm = expr.match(/^calc\(\s*([lch])\s*([+\-*])\s*([\d.]+)\s*\)$/i);
    if (cm) {
      const v = base[cm[1].toUpperCase()];
      const n = parseFloat(cm[3]);
      return cm[2] === '+' ? v + n : cm[2] === '-' ? v - n : v * n;
    }
    if (/^[lch]$/i.test(expr)) return base[expr.toUpperCase()];
    return parseFloat(expr);
  }

  // 色文字列 → {r,g,b,a}（0..1）．解決不能なら null．
  function parse(value, depth = 0) {
    if (depth > 8 || value == null) return null;
    let v = value.trim();
    const vm = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i);
    if (vm) {
      const ref = vars.get(vm[1].toLowerCase());
      return parse(ref != null ? ref : (vm[2] || ''), depth + 1);
    }
    let m2 = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m2) {
      let h = m2[1];
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 };
    }
    m2 = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/i);
    if (m2) {
      return { r: +m2[1] / 255, g: +m2[2] / 255, b: +m2[3] / 255, a: m2[4] != null ? +m2[4] : 1 };
    }
    // oklch(from <ref> L C H [/ a]) | oklch(L C H [/ a])
    m2 = v.match(/^oklch\(\s*(.+?)\s*\)$/i);
    if (m2) {
      let body = m2[1], base = null, alpha = 1;
      const fromM = body.match(/^from\s+(var\([^)]*\)|#[0-9a-f]+|rgba?\([^)]*\)|oklch\([^)]*\)|[a-z]+)\s+(.*)$/i);
      if (fromM) {
        const b = parse(fromM[1], depth + 1);
        if (!b) return null;
        base = srgbToOklch([b.r, b.g, b.b]);
        body = fromM[2];
      }
      const slash = body.split('/');
      if (slash[1] != null) alpha = parseFloat(slash[1]);
      const parts = slash[0].trim().split(/\s+/);
      if (parts.length < 3) return null;
      const L = base ? evalExpr(parts[0], base) : parseFloat(parts[0]);
      const C = base ? evalExpr(parts[1], base) : parseFloat(parts[1]);
      const H = base ? evalExpr(parts[2], base) : parseFloat(parts[2]);
      const a = C * Math.cos(H * Math.PI / 180), bb = C * Math.sin(H * Math.PI / 180);
      const [r, g, bl] = oklabToSrgb(L, a, bb);
      return { r, g, b: bl, a: alpha };
    }
    if (/^white$/i.test(v)) return { r: 1, g: 1, b: 1, a: 1 };
    if (/^black$/i.test(v)) return { r: 0, g: 0, b: 0, a: 1 };
    return null;
  }

  // 半透明 fg を bg の上に合成
  function over(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function luminance({ r, g, b }) {
    const f = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function ratio(fg, bg) {
    const o = fg.a < 1 ? over(fg, bg) : fg;
    const L1 = luminance(o), L2 = luminance(bg);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }

  // 検査ペア定義（テンプレが実際に描画する「文字×地」の組）．
  // fg/bg は色文字列または var()．bg に半透明があれば baseBg に合成して地を作る．
  // level: 'enforce'（warning/error 対象）/ 'info'（意図的に淡い色・情報表示のみ）
  // 注: 罫線・list-marker・blob・グラデ地は「図形/装飾」であり文字ペアでないため対象外（spec §3-7）．
  const pairs = [
    { label: '白文字 × primary地（ヘッダー/見出し帯/フッター/.badge--on-primary/QR）', fg: 'var(--col-on-primary)', bg: 'var(--col-primary)', level: 'enforce' },
    { label: '本文色 × secondary地（番号丸 .n / .badge / feature ラベル）',            fg: 'var(--col-text)', bg: 'var(--col-secondary)', level: 'enforce' },
    { label: 'primary文字 × surface（.badge--soft / cond-table 値）',                  fg: 'var(--col-primary)', bg: 'var(--col-surface)', level: 'enforce' },
    { label: 'primary文字 × bg（見出し / cond-table 条件名）',                         fg: 'var(--col-primary)', bg: 'var(--col-bg)', level: 'enforce' },
    { label: '本文 × マーカー .mk（secondary 45% を bg に合成）',                       fg: 'var(--col-text)', bg: 'rgba(249,114,19,0.45)', baseBg: 'var(--col-bg)', level: 'enforce' },
    { label: '本文 × .hbox 淡色地（secondary 6% を surface に合成）',                   fg: 'var(--col-text)', bg: 'rgba(249,114,19,0.06)', baseBg: 'var(--col-surface)', level: 'enforce' },
    { label: '本文 × bg',                                                              fg: 'var(--col-text)', bg: 'var(--col-bg)', level: 'info' },
    { label: '補足 .sub × surface',                                                   fg: 'var(--col-text-sub)', bg: 'var(--col-surface)', level: 'info' },
    { label: 'muted（参考文献/キャプション） × bg',                                    fg: 'var(--col-muted)', bg: 'var(--col-bg)', level: 'info' },
  ];

  for (const p of pairs) {
    const fg = parse(p.fg);
    let bg = parse(p.bg);
    if (!fg || !bg) {
      warnings.push([0, `コントラスト: 色を解決できず判定スキップ（${p.label}）`]);
      continue;
    }
    if (bg.a < 1 && p.baseBg) {
      const base = parse(p.baseBg);
      if (base) bg = over(bg, base);
    }
    const cr = ratio(fg, bg);
    const r = cr.toFixed(2);
    const advice = '（地と文字色の組を見直す：別の背景色/文字色を推奨）';
    if (p.level === 'info') {
      contrastInfo.push(`${r}:1  ${p.label}`);
    } else if (cr < 3.0) {
      errors.push([0, `コントラスト ${r}:1（< 3.0:1，大文字でも不可）: ${p.label}${advice}`]);
    } else if (cr < 4.5) {
      warnings.push([0, `コントラスト ${r}:1（< 4.5:1，AA通常テキスト未満）: ${p.label}${advice}`]);
    } else {
      contrastInfo.push(`${r}:1  ${p.label}`);
    }
  }
})();

// ---- 出力 ----
const rel = target.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
errors.sort((a, b) => a[0] - b[0]);
warnings.sort((a, b) => a[0] - b[0]);

for (const [ln, msg] of warnings) console.log(`  ⚠ ${rel}:${ln}  ${msg}`);
for (const [ln, msg] of errors)   console.log(`  ✗ ${rel}:${ln}  ${msg}`);

if (contrastInfo.length) {
  console.log('  ─ コントラスト比（参考・WCAG2.1: AA通常4.5 / 大文字3.0）:');
  for (const s of contrastInfo) console.log(`    · ${s}`);
}

if (errors.length === 0) {
  console.log(`✓ lint OK  (${rel})${warnings.length ? `  — 警告 ${warnings.length} 件` : ''}`);
  process.exit(0);
} else {
  console.log(`\n✗ lint NG  — エラー ${errors.length} 件 / 警告 ${warnings.length} 件  (${rel})`);
  process.exit(1);
}
