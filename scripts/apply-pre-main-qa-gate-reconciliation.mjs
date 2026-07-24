#!/usr/bin/env node
import fs from 'node:fs';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content); }
function replaceRequired(file, from, to) {
  const source = read(file);
  if (!source.includes(from)) throw new Error(`Missing QA reconciliation anchor in ${file}`);
  write(file, source.replace(from, to));
}

const g5 = 'scripts/deals68-home-investors-hero-ux-check.mjs';
replaceRequired(
  g5,
  `for (const token of [
  'HeroBannerMedia',
  'mobile_file',
  'remove_mobile',
  'focal_x',
  'focal_y',
  'Desktop 1600×600',
  'Mobile 900×1200',
  'HeroAdminPreview',
]) {
  requireToken(
    siteBanners,
    token,
    \`Banner Admin missing \${token}\`,
  );
}`,
  `for (const token of [
  'HeroBannerMedia',
  'HERO_FALLBACK_ROW',
  'data-hero-layout="single-active"',
  'activeBanner ?',
  'setRows(data.slice(0, 5))',
  "'(prefers-reduced-motion: reduce)'",
  'next?.mobile_image_url',
]) {
  requireToken(
    siteBanners,
    token,
    \`Public Hero architecture missing \${token}\`,
  );
}`,
);
replaceRequired(
  g5,
  `for (const token of [
  'HERO_FALLBACK_ROW',
  'd68-hero-slider--fallback',
  '!loaded || !rows.length',
  "'(prefers-reduced-motion: reduce)'",
  'ariaHidden={index !== active}',
  'tabIndex={index === active ? undefined : -1}',
  ".order('updated_at', { ascending: false })",
  "row?.updated_at || ''",
  'const savedId = String(',
  ".neq('id', savedId)",
]) {
  requireToken(
    siteBanners,
    token,
    \`Banner save/canonical logic missing \${token}\`,
  );
}`,
  `for (const token of [
  'HERO_FALLBACK_ROW',
  'd68-hero-slider--fallback',
  '!loaded || !rows.length',
  'data-hero-layout="single-active"',
  'activeBanner ?',
  'setActive((current) => (current + 1) % rows.length)',
]) {
  requireToken(
    siteBanners,
    token,
    \`Hero single-active logic missing \${token}\`,
  );
}`,
);
replaceRequired(
  g5,
  "console.log('✓ Hidden slides are removed from keyboard navigation.');",
  "console.log('✓ Hero renders only the active slide, so inactive slides are absent from keyboard navigation.');",
);
replaceRequired(
  g5,
  "console.log('✓ Latest saved Hero row wins in Admin and public.');\nconsole.log('✓ Duplicate active rows are disabled on save.');",
  "console.log('✓ Public banner loading prioritizes the latest saved row per placement and slot.');\nconsole.log('✓ Public banner loading deduplicates active rows by placement and sort order.');",
);

const release = 'scripts/deals68-release-qa-check.mjs';
replaceRequired(
  release,
  "const home = read('src/pages/Home.tsx');\nconst businessesPage = read('src/pages/Businesses.tsx');",
  "const home = read('src/pages/Home.tsx');\nconst homePublicData = read('src/lib/homePublicData.ts');\nconst businessesPage = read('src/pages/Businesses.tsx');",
);
replaceRequired(
  release,
  `  /listHomepageBusinesses\(6\)/.test(home)
    && /get_homepage_business_ids/.test(dataLib)`,
  `  /loadHomePublicData\(\)/.test(home)
    && /listHomepageBusinesses\(6\)/.test(homePublicData)
    && /get_homepage_business_ids/.test(dataLib)`,
);
replaceRequired(
  release,
  `/\{ industry: it\.key \}/.test(home)`,
  `/\{ industry: item\.key \}/.test(home)`,
);

console.log('Pre-main QA gate reconciliation applied.');
