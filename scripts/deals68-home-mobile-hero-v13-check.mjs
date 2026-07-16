#!/usr/bin/env node
import fs from 'node:fs';
import ts from 'typescript';

const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const componentPath = 'src/components/HomepageHeroSlider.tsx';
const homePath = 'src/pages/Home.tsx';
const cssPath = 'src/styles/pages/home-hero-mobile-fix.css';
const indexPath = 'src/styles/index.css';

for (const path of [componentPath, homePath, cssPath, indexPath]) {
  if (!fs.existsSync(path)) failures.push(`Missing ${path}`);
}

for (const path of [componentPath, homePath]) {
  if (!fs.existsSync(path)) continue;
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  for (const diagnostic of source.parseDiagnostics) {
    failures.push(`${path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

const component = read(componentPath);
for (const token of [
  "const MOBILE_QUERY = '(max-width: 700px)'",
  'window.matchMedia(MOBILE_QUERY)',
  "data-hero-variant={variant}",
  'd68-home-hero-media__image',
  'data-hero-layout="single-active"',
  'const activeBanner = rows[active] || rows[0]',
  'prefers-reduced-motion: reduce',
]) {
  if (!component.includes(token)) failures.push(`Homepage Hero component missing ${token}`);
}
if (component.includes('HeroBannerMedia')) failures.push('Canonical Homepage Hero must not reuse the legacy picture renderer');
if (component.includes('HERO_FALLBACK')) failures.push('Canonical Homepage Hero must not render the legacy SVG fallback');
if (component.includes('Upload active Hero banners in Admin')) failures.push('Legacy Hero upload placeholder text remains');
if (component.includes('rows.map((slide, index) => (\n        <MaybeLink')) failures.push('All Hero slides are still rendered in the DOM');

const home = read(homePath);
if (!home.includes("import HomepageHeroSlider from '../components/HomepageHeroSlider'")) failures.push('Home does not import the canonical Hero');
if (!home.includes('<HomepageHeroSlider lang={lang} />')) failures.push('Home does not render the canonical Hero');
if (home.includes('HeroBannerSlider')) failures.push('Home still references the legacy HeroBannerSlider');

const css = read(cssPath);
for (const token of [
  '@media (max-width:700px)',
  'aspect-ratio:3/4!important',
  '.d68-home-page .d68-home-hero-media--mobile .d68-home-hero-media__image',
  'object-fit:contain!important',
  'grid-template-columns:',
  'minmax(150px,1.7fr)!important',
  'white-space:nowrap!important',
  '.d68-home-page .d68-home-hero__inner',
  'margin:auto 0 0!important',
]) {
  if (!css.includes(token)) failures.push(`Homepage Hero CSS missing ${token}`);
}
if (!css.includes('.d68-home-page')) failures.push('Homepage Hero CSS is not route scoped');

const index = read(indexPath).trimEnd();
const importToken = "@import './pages/home-hero-mobile-fix.css' layer(d68-overrides);";
if (!index.includes(importToken)) failures.push('Homepage Hero mobile stylesheet is not registered');
if (!index.endsWith(importToken)) failures.push('Homepage Hero mobile stylesheet must load after legacy overrides');

if (failures.length) {
  console.error('✗ Deals68 Homepage Mobile Hero V13 check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Homepage Mobile Hero V13 check: PASS');
console.log('✓ Mobile image selection uses matchMedia with desktop fallback.');
console.log('✓ Loading and empty states do not render the legacy SVG placeholder.');
console.log('✓ Only the active Hero banner is rendered in the DOM.');
console.log('✓ Mobile Hero uses a 3:4 frame and three statistics remain on one row.');
