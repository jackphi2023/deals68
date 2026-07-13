import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const home = read('src/pages/Home.tsx');
const homeCss = read('src/styles/pages/home.css');
const businessesCss = read('src/styles/pages/businesses.css');
const detailCss = read('src/styles/pages/business-detail.css');

assert.match(home, /Math\.floor\(value\.totalVnd \/ 1_000_000_000\)/);
assert.match(home, /Math\.floor\(value\.totalUsd \/ 1_000_000\)/);
assert.equal(
  `${Math.floor(3_099_800_000_000 / 1_000_000_000).toLocaleString('vi-VN')} tỷ ₫`,
  '3.099 tỷ ₫',
);

assert.match(homeCss, /\.d68-home-page \.d68-home-hero-stats span/);
assert.match(homeCss, /font-size:10px!important/);

assert.match(businessesCss, /\.d68-businesses-page \.d68-sidebar \.d68-filter-scroll\{[^}]*padding:4px 14px 14px!important/);
assert.match(businessesCss, /\.d68-businesses-page \.d68-sidebar \.d68-filter-submit\{[^}]*padding:12px 14px!important/);

assert.match(detailCss, /\.d68-detail-image-card \{ overflow:hidden; padding:0; \}/);
assert.match(detailCss, /\.d68-detail-hero-media img \{[^}]*position:absolute/);
assert.match(detailCss, /\.d68-detail-thumbs \{[^}]*padding:0 12px 12px/);

console.log('✓ G9 static QA: PASS');
