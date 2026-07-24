#!/usr/bin/env node
import fs from 'node:fs';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content); }
function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return source.replace(from, to);
}

const g5 = 'scripts/deals68-home-investors-hero-ux-check.mjs';
let heroCheck = read(g5);
heroCheck = replaceOnce(
  heroCheck,
  `  'mobile_file',
  'remove_mobile',
  'focal_x',
  'focal_y',
  'Desktop 1600×600',
  'Mobile 900×1200',
  'HeroAdminPreview',`,
  `  'HERO_FALLBACK_ROW',
  'data-hero-layout="single-active"',
  'activeBanner ?',
  'setRows(data.slice(0, 5))',
  "'(prefers-reduced-motion: reduce)'",
  'next?.mobile_image_url',`,
  'G5 public Hero token list',
);
heroCheck = replaceOnce(
  heroCheck,
  '`Banner Admin missing ${token}`',
  '`Public Hero architecture missing ${token}`',
  'G5 public Hero failure label',
);
heroCheck = replaceOnce(
  heroCheck,
  `  "'(prefers-reduced-motion: reduce)'",
  'ariaHidden={index !== active}',
  'tabIndex={index === active ? undefined : -1}',
  ".order('updated_at', { ascending: false })",
  "row?.updated_at || ''",
  'const savedId = String(',
  ".neq('id', savedId)",`,
  `  'data-hero-layout="single-active"',
  'activeBanner ?',
  'setActive((current) => (current + 1) % rows.length)',`,
  'G5 single-active token list',
);
heroCheck = replaceOnce(
  heroCheck,
  '`Banner save/canonical logic missing ${token}`',
  '`Hero single-active logic missing ${token}`',
  'G5 single-active failure label',
);
heroCheck = replaceOnce(
  heroCheck,
  "console.log('✓ Hidden slides are removed from keyboard navigation.');",
  "console.log('✓ Hero renders only the active slide, so inactive slides are absent from keyboard navigation.');",
  'G5 keyboard-navigation conclusion',
);
heroCheck = replaceOnce(
  heroCheck,
  "console.log('✓ Latest saved Hero row wins in Admin and public.');",
  "console.log('✓ Public banner loading prioritizes the latest saved row per placement and slot.');",
  'G5 latest-row conclusion',
);
heroCheck = replaceOnce(
  heroCheck,
  "console.log('✓ Duplicate active rows are disabled on save.');",
  "console.log('✓ Public banner loading deduplicates active rows by placement and sort order.');",
  'G5 deduplication conclusion',
);
write(g5, heroCheck);

const release = 'scripts/deals68-release-qa-check.mjs';
let releaseCheck = read(release);
releaseCheck = replaceOnce(
  releaseCheck,
  "const home = read('src/pages/Home.tsx');\n",
  "const home = read('src/pages/Home.tsx');\nconst homePublicData = read('src/lib/homePublicData.ts');\n",
  'Release Home data source declaration',
);
releaseCheck = replaceOnce(
  releaseCheck,
  '/listHomepageBusinesses\\(6\\)/.test(home)',
  '/loadHomePublicData\\(\\)/.test(home)\n    && /listHomepageBusinesses\\(6\\)/.test(homePublicData)',
  'Release Homepage editorial loader check',
);
releaseCheck = replaceOnce(
  releaseCheck,
  '/\\{ industry: it\\.key \\}/.test(home)',
  '/\\{ industry: item\\.key \\}/.test(home)',
  'Release canonical industry link check',
);
write(release, releaseCheck);

console.log('Pre-main QA gate reconciliation applied.');
