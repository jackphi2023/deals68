import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) =>
  fs.readFileSync(path.join(root, rel), 'utf8');

const failures = [];

function requireToken(text, token, message) {
  if (!text.includes(token)) failures.push(message);
}

function forbidToken(text, token, message) {
  if (text.includes(token)) failures.push(message);
}

const home = read('src/pages/Home.tsx');
const investors = read('src/pages/Investors.tsx');
const hero = read('src/components/HeroBannerMedia.tsx');
const siteBanners = read('src/components/SiteBanners.tsx');
const banners = read('src/lib/banners.ts');
const homeCss = read('src/styles/pages/home.css');
const investorsCss = read('src/styles/pages/investors.css');
const adminCss = read('src/styles/pages/admin.css');
const releaseFoundationCss = read(
  'src/styles/final/release-foundation.css',
);
const heroCss = [homeCss, releaseFoundationCss].join('\n');
const migration = read(
  'supabase/migrations/' +
    '20260712112248_home_hero_responsive_fields.sql',
);

requireToken(
  home,
  'className="d68-home-investor-cta"',
  'Home Investor CTA lacks a dedicated class',
);
forbidToken(
  homeCss,
  '.d68-home-investor-card:hover>a',
  'Hovering an entire Investor card still activates the CTA',
);
requireToken(
  homeCss,
  '.d68-home-investor-cta:focus-visible',
  'Investor CTA focus state is missing',
);

for (const token of [
  'mobile_image_url',
  'focal_x',
  'focal_y',
  '<source',
  'media="(max-width: 700px)"',
  '--d68-hero-position',
  'heroFocusPosition',
]) {
  requireToken(hero, token, `Hero media missing ${token}`);
}

for (const token of [
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
    `Banner Admin missing ${token}`,
  );
}

for (const token of [
  'mobile_image_url',
  'mobile_image_path',
  'BannerImageVariant',
  '${placement}/${variant}/',
]) {
  requireToken(banners, token, `Banner library missing ${token}`);
}

for (const token of [
  'const regions =',
  'const [region,',
  'setRegion(',
  'labelRegion(',
  'Investment region',
  'Khu vực đầu tư',
  'region: region || undefined',
]) {
  forbidToken(
    investors,
    token,
    `Investor region filter remains: ${token}`,
  );
}

requireToken(
  investors,
  'd68-investor-card__title-link',
  'Investor display name is not a detail link',
);
requireToken(
  investorsCss,
  '.d68-investor-card__title-link',
  'Investor title-link CSS is missing',
);
requireToken(
  adminCss,
  '.d68-banner-hero-previews',
  'Admin Hero preview CSS is missing',
);

if (
  (
    heroCss.match(
      /var\(--d68-hero-position,center center\)/g,
    ) || []
  ).length < 2
) {
  failures.push(
    'Hero focal point is missing from owned Hero CSS',
  );
}

requireToken(
  heroCss,
  'clamp(420px,37.5vw,600px)',
  'Desktop Hero owned CSS is not aligned to 1600x600',
);

for (const token of [
  'mobile_image_url',
  'mobile_image_path',
  'focal_x smallint',
  'focal_y smallint',
  'site_banners_focal_x_range',
  'site_banners_focal_y_range',
]) {
  requireToken(
    migration,
    token,
    `Hero migration missing ${token}`,
  );
}

if (
  /\.d68-home-investor-card:first-child\s+a/.test(homeCss)
) {
  failures.push(
    'The first Home Investor card still has an active-only rule',
  );
}

if (failures.length) {
  console.error('✗ Deals68 G5 UX static check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 G5 Home/Investors/Hero UX static check: PASS');
console.log('✓ No Home Investor CTA is active by default.');
console.log('✓ Hero supports desktop and optional mobile images.');
console.log('✓ Hero focal point controls object-position.');
console.log('✓ Desktop Hero ratio is aligned to 1600×600.');
console.log('✓ Investor region filter is removed.');
console.log('✓ Investor display names link to detail.');
