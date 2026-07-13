#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const cleanupPath = 'src/styles/pages/release-cleanup.css';
const foundationPath = 'src/styles/final/release-foundation.css';
const indexPath = 'src/styles/index.css';
const cleanup = read(cleanupPath);
const foundation = read(foundationPath);
const indexCss = read(indexPath);

if (!cleanup.includes('D68_RELEASE_CLEANUP_STUB')) {
  failures.push('release-cleanup.css is not the deprecated stub');
}
const activeCleanup = cleanup
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s/g, '');
if (activeCleanup.length) failures.push('release-cleanup.css contains active CSS');
if (!foundation.includes('Deals68 Release Foundation')) {
  failures.push('release-foundation.css is missing');
}
const foundationImport = "@import './final/release-foundation.css' layer(d68-overrides);";
const cleanupImport = "@import './pages/release-cleanup.css' layer(d68-overrides);";
if (!indexCss.includes(foundationImport)) failures.push('index.css does not import release foundation');
if (!indexCss.includes(cleanupImport)) failures.push('index.css lost the temporary cleanup stub import');
if (indexCss.indexOf(foundationImport) > indexCss.indexOf(cleanupImport)) {
  failures.push('release foundation must be imported before cleanup stub');
}

const ownership = [
  ['src/styles/pages/home.css', '/* G9 — Homepage hero metric labels. */'],
  ['src/styles/pages/businesses.css', '/* G9 — Compact Business filter card. */'],
  ['src/styles/pages/business-detail.css', '/* G9 RC — Business detail full-frame ownership. */'],
  ['src/styles/pages/auth.css', '/* G10 — Registration primary CTA emphasis. */'],
  ['src/styles/pages/static.css', '/* G10 — About partnership statement. */'],
  ['src/styles/pages/business-dashboard.css', '/* G11 — Business overview metric-to-quota spacing. */'],
];
for (const [path, marker] of ownership) {
  if (!read(path).includes(marker)) failures.push(`${path} missing owner marker: ${marker}`);
}

if (failures.length) {
  console.error('✗ Deals68 CSS architecture check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}
console.log('✓ Deals68 CSS architecture check: PASS');
console.log('✓ release-cleanup.css is inactive; G9–G11 live in page-owned CSS.');
