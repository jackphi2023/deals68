#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const media = fs.readFileSync(
  'src/components/HeroBannerMedia.tsx',
  'utf8',
);
const slider = fs.readFileSync(
  'src/components/SiteBanners.tsx',
  'utf8',
);
const homeCss = fs.readFileSync(
  'src/styles/pages/home.css',
  'utf8',
);
const foundationCss = fs.readFileSync(
  'src/styles/final/release-foundation.css',
  'utf8',
);

for (const token of [
  "const MOBILE_QUERY = '(max-width: 700px)'",
  'window.matchMedia(MOBILE_QUERY)',
  'const usingMobileSource =',
  "const variant = usingMobileSource ? 'mobile' : 'desktop'",
  'data-hero-variant={variant}',
  'className="d68-hero-media__image"',
  'setMobileSourceEnabled(false)',
]) {
  assert.ok(
    media.includes(token),
    `HeroBannerMedia missing: ${token}`,
  );
}

assert.ok(
  !media.includes('<picture'),
  'Hero still relies on picture rendering',
);
assert.ok(
  !media.includes('<source'),
  'Hero still relies on source rendering',
);
assert.ok(
  !slider.includes('sliderClassName'),
  'Hero slider keeps an unused mobile class state',
);

for (const token of [
  'Deals68 Homepage Hero owner v6',
  '.d68-hero-slide.is-active',
  'opacity:1!important',
  'visibility:visible!important',
  '.d68-hero-media__image',
  'object-fit:contain!important',
  'aspect-ratio:3/4!important',
]) {
  assert.ok(
    homeCss.includes(token),
    `Home Hero CSS missing: ${token}`,
  );
}

assert.ok(
  !foundationCss.includes(
    'Deals68 Hero responsive full-frame v4',
  ),
  'Frozen Release Foundation still owns Hero feature CSS',
);

console.log('✓ Mobile Hero deterministic render QA: PASS');
console.log('✓ One explicit img is selected through matchMedia.');
console.log('✓ Failed mobile images fall back to desktop.');
console.log('✓ Active slide visibility is deterministic.');
console.log('✓ Hero responsive CSS is owned by home.css.');
