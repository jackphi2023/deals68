#!/usr/bin/env node
/**
 * Deals68 — extract-reference-css.mjs
 * ---------------------------------------------------------------
 * Trích xuất TOÀN BỘ visual spec từ ui-reference/*.dc.html thành CSS
 * tái sử dụng được, để React app dùng chung 1 nguồn style duy nhất.
 *
 * Input : ui-reference/*.dc.html
 * Output: src/styles/reference/d68-components.css   (class có sẵn trong reference)
 *         src/styles/reference/d68-utilities.css    (inline style vô danh → utility class)
 *         src/styles/reference/d68-page-styles.css  (các <style> block, dedupe)
 *         src/styles/reference/extraction-report.md (bảng map để dev port markup)
 *
 * Cách chạy:  node scripts/extract-reference-css.mjs
 * Yêu cầu :  npm i -D node-html-parser
 *
 * Nguyên tắc:
 *  - Element có class + inline style: nếu MỌI lần xuất hiện của class đó
 *    đều mang cùng declaration set → gán thẳng vào class (an toàn).
 *    Nếu không nhất quán → tách thành biến thể `.class--v2`, `.class--v3`.
 *  - Element KHÔNG có class nhưng có inline style: dedupe theo declaration
 *    set → sinh utility `d68-u-<n>` kèm comment nguồn (file + tag + text hint).
 *  - Mọi giá trị màu/shadow trùng design-tokens được thay bằng var(--d68-*).
 *  - Tất cả rule được bọc trong `@layer d68-components` / `@layer d68-utilities`
 *    để KHÔNG cần !important và không xung đột với legacy CSS.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'node-html-parser';

const REF_DIR = 'ui-reference';
const OUT_DIR = 'src/styles/reference';
const TOKENS_FILE = 'styles/design-tokens.css';

/* ---------- 1. Load token map: value -> var(--d68-*) ---------- */
function loadTokenMap() {
  const css = readFileSync(TOKENS_FILE, 'utf8');
  const map = new Map();
  for (const m of css.matchAll(/(--d68-[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = m[1];
    const value = m[2].trim().toLowerCase();
    // ưu tiên token đầu tiên khai báo cho mỗi value
    if (!map.has(value)) map.set(value, `var(${name})`);
  }
  return map;
}
const tokenMap = loadTokenMap();

function tokenize(value) {
  let v = value;
  // thay hex/rgba khớp token (so khớp không phân biệt hoa thường)
  for (const [raw, tok] of tokenMap) {
    if (!raw.startsWith('#') && !raw.startsWith('rgb')) continue;
    const re = new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    v = v.replace(re, tok);
  }
  return v;
}

/* ---------- 2. Normalize a style="" attribute ---------- */
const PROP_RE = /^(--)?[a-z][a-z0-9-]*$/; // CSS property hoặc custom property hợp lệ
let droppedDecls = 0;

/** Reference pages định nghĩa style dùng chung trong <script>:
 *  const inputStyle = 'border:...; padding:...';
 *  rồi dùng lại qua style="{{ inputStyle }}". Ta resolve trước khi parse. */
function collectStyleVars(html) {
  const vars = new Map();
  for (const m of html.matchAll(/const\s+(\w+)\s*=\s*'([^']+)'/g)) {
    if (/^[a-z-]+\s*:/.test(m[2])) vars.set(m[1].toLowerCase(), m[2]);
  }
  return vars;
}
function resolveStyleVars(styleAttr, vars) {
  return styleAttr.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, name) => vars.get(name.toLowerCase()) ?? all);
}

function normalizeDecls(styleAttr) {
  return styleAttr
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      if (i < 0) return null;
      const prop = d.slice(0, i).trim().toLowerCase();
      let val = tokenize(d.slice(i + 1).trim().replace(/\s+/g, ' '));
      // Giá trị động từ mock template ({{ d.tint }}...) → chuyển thành CSS var hook,
      // JSX sẽ set giá trị qua style={{ ['--d68-dyn']: value }}.
      if (val.includes('{{')) val = val.replace(/\{\{[^}]*\}\}/g, 'var(--d68-dyn, transparent)');
      if (!PROP_RE.test(prop)) { droppedDecls++; return null; }
      return `${prop}:${val}`;
    })
    .filter(Boolean)
    .sort() // thứ tự ổn định để dedupe
    .join(';');
}

/* ---------- 3. Walk all pages ---------- */
const pages = readdirSync(REF_DIR).filter((f) => f.endsWith('.dc.html'));
if (!pages.length) { console.error('No .dc.html found in', REF_DIR); process.exit(1); }

// classDecls: className -> Map(declSet -> {count, pages:Set, sample})
const classDecls = new Map();
// anonDecls: declSet -> {count, pages:Set, samples:[]}
const anonDecls = new Map();
// styleBlocks: cssText -> Set(pages)
const styleBlocks = new Map();
let totalInline = 0;

for (const file of pages) {
  const html = readFileSync(join(REF_DIR, file), 'utf8');
  const root = parse(html, { style: true });
  const pageName = basename(file, '.dc.html').replace(/^Deals68 /, '');
  const styleVars = collectStyleVars(html);

  // 3a. <style> blocks
  for (const st of root.querySelectorAll('style')) {
    const css = st.text.trim();
    if (!css) continue;
    if (!styleBlocks.has(css)) styleBlocks.set(css, new Set());
    styleBlocks.get(css).add(pageName);
  }

  // 3b. inline styles
  for (const el of root.querySelectorAll('[style]')) {
    let raw = el.getAttribute('style');
    if (!raw) continue;
    totalInline++;
    raw = resolveStyleVars(raw, styleVars);
    const decls = normalizeDecls(raw);
    if (!decls) continue;
    const classes = (el.classList?.value || []).filter((c) => !/^l-(vi|en)$/.test(c));
    const textHint = el.text.trim().replace(/\s+/g, ' ').slice(0, 40);
    const sample = `${pageName} <${el.tagName?.toLowerCase() || '?'}> "${textHint}"`;

    if (classes.length) {
      const key = classes[0]; // class đầu tiên làm anchor
      if (!classDecls.has(key)) classDecls.set(key, new Map());
      const variants = classDecls.get(key);
      if (!variants.has(decls)) variants.set(decls, { count: 0, pages: new Set(), sample });
      const v = variants.get(decls);
      v.count++; v.pages.add(pageName);
    } else {
      if (!anonDecls.has(decls)) anonDecls.set(decls, { count: 0, pages: new Set(), samples: [] });
      const a = anonDecls.get(decls);
      a.count++; a.pages.add(pageName);
      if (a.samples.length < 3) a.samples.push(sample);
    }
  }
}

/* ---------- 4. Emit d68-components.css ---------- */
mkdirSync(OUT_DIR, { recursive: true });
const compLines = [
  '/* AUTO-GENERATED by scripts/extract-reference-css.mjs — DO NOT EDIT BY HAND.',
  ' * Nguồn: ui-reference/*.dc.html (inline style của element CÓ class).',
  ' * Sửa design trên ui-reference rồi chạy lại script. */',
  '@layer d68-components {',
];
const report = [
  '# Deals68 Reference CSS — Extraction Report',
  '',
  `- Pages scanned: **${pages.length}**`,
  `- Inline style attributes found: **${totalInline}**`,
  `- Classes with consistent inline style: (see below)`,
  '',
  '## A. Class rules (dùng lại y nguyên class trong JSX)',
  '',
  '| Class | Variants | Pages | Ghi chú |',
  '|---|---|---|---|',
];

const sortedClasses = [...classDecls.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [cls, variants] of sortedClasses) {
  const sorted = [...variants.entries()].sort((a, b) => b[1].count - a[1].count);
  sorted.forEach(([decls, meta], i) => {
    const selector = i === 0 ? `.${cls}` : `.${cls}--v${i + 1}`;
    const pretty = decls.split(';').join('; ');
    compLines.push(`  ${selector} { ${pretty}; } /* ${meta.count}x · ${[...meta.pages].slice(0, 4).join(', ')} */`);
  });
  const note = sorted.length > 1
    ? `⚠ ${sorted.length} biến thể — trong JSX dùng \`.${cls}--v2\`... cho biến thể phụ`
    : 'nhất quán';
  report.push(`| \`.${cls}\` | ${sorted.length} | ${[...new Set(sorted.flatMap(([, m]) => [...m.pages]))].length} | ${note} |`);
}
compLines.push('}');
writeFileSync(join(OUT_DIR, 'd68-components.css'), compLines.join('\n'));

/* ---------- 5. Emit d68-utilities.css (anonymous inline styles) ---------- */
const utilLines = [
  '/* AUTO-GENERATED — inline style của element KHÔNG có class.',
  ' * Khi port sang JSX: thay style="..." bằng className tương ứng dưới đây. */',
  '@layer d68-utilities {',
];
report.push('', '## B. Utility classes (thay cho inline style vô danh)', '',
  '| Utility | Dùng ở | Ví dụ nguồn |', '|---|---|---|');
const sortedAnon = [...anonDecls.entries()].sort((a, b) => b[1].count - a[1].count);
sortedAnon.forEach(([decls, meta], i) => {
  const name = `d68-u-${String(i + 1).padStart(3, '0')}`;
  const pretty = decls.split(';').join('; ');
  utilLines.push(`  .${name} { ${pretty}; } /* ${meta.count}x */`);
  report.push(`| \`.${name}\` | ${meta.count}x · ${[...meta.pages].slice(0, 3).join(', ')} | ${meta.samples[0] || ''} |`);
});
utilLines.push('}');
writeFileSync(join(OUT_DIR, 'd68-utilities.css'), utilLines.join('\n'));

/* ---------- 6. Emit d68-page-styles.css (<style> blocks, dedupe) ---------- */
const pageCss = ['/* AUTO-GENERATED — gộp & dedupe các <style> block trong reference pages. */',
  '@layer d68-components {'];
for (const [css, pgs] of styleBlocks) {
  pageCss.push(`/* from: ${[...pgs].join(', ')} */`);
  pageCss.push(css);
}
pageCss.push('}');
writeFileSync(join(OUT_DIR, 'd68-page-styles.css'), pageCss.join('\n\n'));

/* ---------- 7. Report ---------- */
report.push('', '## C. Quy trình port 1 trang',
  '',
  '1. Mở `ui-reference/Deals68 <Page>.dc.html`, copy cấu trúc markup vào JSX, **giữ nguyên class**.',
  '2. Element có `style="..."` + class → xóa style attr (rule đã nằm trong `d68-components.css`; nếu report đánh dấu ⚠ nhiều biến thể, chọn `--vN` đúng theo context).',
  '3. Element có `style="..."` không class → tra bảng B, thay bằng `d68-u-xxx`.',
  '4. Thay `{{ ... }}` bằng props/data Supabase. Không đổi logic ở `lib/`.',
  '5. Chạy screenshot diff 1440/768/375 so với reference trước khi merge.');
writeFileSync(join(OUT_DIR, 'extraction-report.md'), report.join('\n'));

console.log(`✓ Pages scanned        : ${pages.length}`);
console.log(`✓ Inline style attrs   : ${totalInline}`);
console.log(`✓ Class rules emitted  : ${sortedClasses.length} classes`);
console.log(`✓ Utility classes      : ${sortedAnon.length}`);
console.log(`✓ <style> blocks merged: ${styleBlocks.size}`);
if (droppedDecls) console.warn(`! Dropped invalid declarations: ${droppedDecls} (template/edge cases)`) ;
console.log(`→ Output in ${OUT_DIR}/`);
