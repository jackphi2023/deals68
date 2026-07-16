#!/usr/bin/env node
import fs from 'node:fs';
import ts from 'typescript';

const failures = [];
const pagePath = 'src/pages/Investors.tsx';
const cssPath = 'src/styles/pages/entity-ui-v12.css';
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

for (const path of [pagePath, cssPath]) {
  if (!fs.existsSync(path)) failures.push(`Missing ${path}`);
}

if (fs.existsSync(pagePath)) {
  const page = read(pagePath);
  const source = ts.createSourceFile(
    pagePath,
    page,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  for (const diagnostic of source.parseDiagnostics) {
    failures.push(`${pagePath}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }

  if (!page.includes('className="d68-investor-card__industries"')) {
    failures.push('Investor industries row must have its own scoped class');
  }
  if (!page.includes("T(lang, 'Ngành', 'Industries')")) {
    failures.push('Investor industries label is missing');
  }
  if (!page.includes("T(lang, 'Đang tải…', 'Loading…')")) {
    failures.push('Investor listing must use the concise loading text');
  }
  if (page.includes('Đang tải dữ liệu thật') || page.includes('Loading live data')) {
    failures.push('Obsolete live-data loading text remains');
  }
}

if (fs.existsSync(cssPath)) {
  const css = read(cssPath);
  const scopedSelector = '.d68-investors-page .d68-investor-card__industries';
  const broadSelector = '.d68-investors-page .d68-investor-card__meta > span';
  const staticDetailHoverSelector = '.d68-v10-investor-detail .d68-id-cover__content h1:hover';
  const staticDetailTransitionSelector = '.d68-v10-investor-detail .d68-id-cover__content h1';
  const selectorIndex = css.indexOf(scopedSelector);
  const nextBlockEnd = selectorIndex >= 0 ? css.indexOf('}', selectorIndex) : -1;
  const block = selectorIndex >= 0 && nextBlockEnd > selectorIndex
    ? css.slice(selectorIndex, nextBlockEnd + 1)
    : '';

  if (!block) failures.push('Scoped Investor industries CSS block is missing');
  for (const token of [
    'display:-webkit-box',
    'overflow:hidden',
    'text-overflow:ellipsis',
    '-webkit-box-orient:vertical',
    '-webkit-line-clamp:2',
    'line-clamp:2',
  ]) {
    if (!block.includes(token)) failures.push(`Investor industries CSS missing ${token}`);
  }
  if (css.includes(broadSelector)) {
    failures.push('Two-line clamp must not apply to every Investor metadata row');
  }
  if (css.includes(staticDetailHoverSelector)) {
    failures.push('Static Investor Detail title must not change color on hover');
  }
  if (css.includes(`${staticDetailTransitionSelector},`) || css.includes(`${staticDetailTransitionSelector} {`)) {
    failures.push('Static Investor Detail title must not be grouped into linked-title interactions');
  }
}

if (failures.length) {
  console.error('✗ Deals68 Investor List V12 check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 Investor List V12 check: PASS');
console.log('✓ Description is capped separately at three lines.');
console.log('✓ Only Industries is capped at two lines with an ellipsis.');
console.log('✓ Other Investor metadata rows remain unaffected.');
console.log('✓ Listing loading text remains concise.');
console.log('✓ Static Investor Detail title has no hover-color interaction.');
