#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const failures = [];
const requireToken = (text, token, message) => {
  if (!text.includes(token)) failures.push(message);
};
const requireOrder = (text, tokens, message) => {
  let cursor = -1;
  for (const token of tokens) {
    const next = text.indexOf(token, cursor + 1);
    if (next < 0 || next < cursor) {
      failures.push(`${message}: ${token}`);
      return;
    }
    cursor = next;
  }
};

const home = read('src/pages/Home.tsx');
const indexCss = read('src/styles/index.css');
const homeCss = read('src/styles/pages/home.css');
const heroCss = read('src/styles/pages/home-hero.css');
const heroMediaCss = read('src/styles/pages/home-hero-media.css');
const investorCss = read('src/styles/pages/home-featured-investors.css');
const layoutCss = read('src/styles/pages/home-layout.css');
const uiFixesCss = read('src/styles/pages/ui-fixes.css');
const releaseFoundationCss = read('src/styles/final/release-foundation.css');
const releaseCleanupCss = read('src/styles/pages/release-cleanup.css');

for (const token of [
  '<main className="d68-home-page">',
  '<section className="d68-home-hero">',
  'd68-home-section--roles',
  '{featuredInvestorSection}',
  'placement="home_promotion"',
  'd68-home-deals-section',
  'd68-home-industries',
  'd68-home-valuation',
  'd68-home-how',
]) {
  requireToken(home, token, `Homepage baseline markup missing ${token}`);
}

requireOrder(
  home,
  [
    '<section className="d68-home-hero">',
    'd68-home-section--roles',
    '{featuredInvestorSection}',
    'placement="home_promotion"',
    'd68-home-deals-section',
    'd68-home-industries',
    'd68-home-valuation',
    'd68-home-how',
  ],
  'Homepage section order changed',
);

for (const token of [
  '--d68-home-section-gap: 80px',
  'row-gap: var(--d68-home-section-gap)',
  'background: #F7FAFC',
  '--d68-home-section-gap: 50px',
  '.d68-home-page > .d68-home-block',
  'padding-block: 0',
]) {
  requireToken(layoutCss, token, `Homepage layout contract missing ${token}`);
}

requireOrder(
  indexCss,
  [
    "@import './pages/home.css'",
    "@import './pages/ui-fixes.css'",
    "@import './final/release-foundation.css'",
    "@import './pages/release-cleanup.css'",
    "@import './pages/home-hero.css'",
    "@import './pages/home-featured-investors.css'",
    "@import './pages/home-layout.css'",
    "@import './pages/home-hero-media.css'",
  ],
  'Homepage CSS import baseline changed',
);

for (const [text, token, message] of [
  [homeCss, 'Deals68 canonical Homepage Hero', 'Canonical Hero marker is missing from home.css'],
  [heroCss, 'Homepage Hero — Session 9', 'Hero supplemental stylesheet is missing'],
  [heroMediaCss, 'media-only override', 'Hero media override stylesheet is missing'],
  [investorCss, 'Homepage featured-investor component ownership', 'Investor stylesheet is missing'],
  [uiFixesCss, 'Home reference alignment', 'Known Homepage rules disappeared from ui-fixes.css'],
  [releaseFoundationCss, 'Promotion/cards', 'Known Homepage compatibility rules disappeared from release-foundation.css'],
  [releaseCleanupCss, 'No active CSS is allowed in this file', 'release-cleanup.css is not the frozen stub'],
]) {
  requireToken(text, token, message);
}

const promotionPaddingOverride =
  releaseFoundationCss.includes(
    '.d68-promo-banner.d68-home-container{padding-top:50px!important;padding-bottom:50px!important}',
  );
const heroRuntimeCover = heroMediaCss.includes('object-fit:cover!important');
const legacyContain = homeCss.includes('object-fit:contain!important');

if (!promotionPaddingOverride) {
  failures.push('H0 baseline no longer detects the Promotion 50px compatibility padding');
}
if (!heroRuntimeCover) {
  failures.push('H0 baseline no longer detects the late Hero cover override');
}
if (!legacyContain) {
  failures.push('H0 baseline no longer detects the legacy Hero contain rule');
}

if (failures.length) {
  console.error('✗ Deals68 Homepage H0 baseline check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Homepage H0 baseline: PASS');
console.log('✓ Homepage runtime markup and section order are unchanged.');
console.log('✓ Desktop/mobile spacing contract remains 80px/50px.');
console.log('✓ Page canvas remains #F7FAFC.');
console.log('✓ release-cleanup.css remains an inactive compatibility stub.');
console.log('ℹ Known debt intentionally recorded for H1–H5 cleanup:');
console.log('  - Hero CSS owners: 3');
console.log('  - Featured Investor CSS owners: 4');
console.log('  - Promotion still has a 50px compatibility padding override.');
console.log('  - Hero source contains legacy contain while late runtime CSS forces cover.');
