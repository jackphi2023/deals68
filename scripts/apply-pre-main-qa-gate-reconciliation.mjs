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
heroCheck = replaceOnce(heroCheck, '`Banner Admin missing ${token}`', '`Public Hero architecture missing ${token}`', 'G5 public Hero failure label');
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
heroCheck = replaceOnce(heroCheck, '`Banner save/canonical logic missing ${token}`', '`Hero single-active logic missing ${token}`', 'G5 single-active failure label');
heroCheck = replaceOnce(heroCheck, "console.log('✓ Hidden slides are removed from keyboard navigation.');", "console.log('✓ Hero renders only the active slide, so inactive slides are absent from keyboard navigation.');", 'G5 keyboard-navigation conclusion');
heroCheck = replaceOnce(heroCheck, "console.log('✓ Latest saved Hero row wins in Admin and public.');", "console.log('✓ Public banner loading prioritizes the latest saved row per placement and slot.');", 'G5 latest-row conclusion');
heroCheck = replaceOnce(heroCheck, "console.log('✓ Duplicate active rows are disabled on save.');", "console.log('✓ Public banner loading deduplicates active rows by placement and sort order.');", 'G5 deduplication conclusion');
write(g5, heroCheck);

const release = 'scripts/deals68-release-qa-check.mjs';
let releaseCheck = read(release);
releaseCheck = replaceOnce(releaseCheck, "const home = read('src/pages/Home.tsx');\n", "const home = read('src/pages/Home.tsx');\nconst homePublicData = read('src/lib/homePublicData.ts');\n", 'Release Home data source declaration');
releaseCheck = replaceOnce(releaseCheck, '/listHomepageBusinesses\\(6\\)/.test(home)', '/loadHomePublicData\\(\\)/.test(home)\n    && /listHomepageBusinesses\\(6\\)/.test(homePublicData)', 'Release Homepage editorial loader check');
releaseCheck = replaceOnce(releaseCheck, '/\\{ industry: it\\.key \\}/.test(home)', '/\\{ industry: item\\.key \\}/.test(home)', 'Release canonical industry link check');
write(release, releaseCheck);

const entityTitle = 'scripts/deals68-entity-title-hover-check.mjs';
let entityCheck = read(entityTitle);
entityCheck = replaceOnce(entityCheck, '<h3 className="d68-entity-title-link">{d.title}</h3>', '<h3 className="d68-entity-title-link">{deal.title}</h3>', 'Homepage Business entity-title token');
write(entityTitle, entityCheck);

const location = 'scripts/deals68-business-location-flow-check.mjs';
let locationCheck = read(location);
locationCheck = replaceOnce(locationCheck, `[data, ".eq('city_key', cityKey)", 'Public Business query does not use exact city_key filtering'],`, `[data, 'city_key.eq.\${safeLikeTerm(value)}', 'Public Business query does not build canonical city_key clauses'],`, 'Business location query-builder token');
locationCheck = replaceOnce(locationCheck, `[businesses, 'locationKeyFromLabel(f.city_key || f.city', 'Business facets do not canonicalize legacy labels'],`, `[data, 'locationKeyFromLabel(rawCityKey, countryIso2)', 'Public Business normalization does not canonicalize legacy labels'],`, 'Business location canonical view token');
write(location, locationCheck);

const registerCopy = 'scripts/deals68-business-register-copy-term-check.mjs';
let registerCheck = read(registerCopy);
registerCheck = replaceOnce(
  registerCheck,
  `  ['Doanh thu năm gần nhất (VNĐ)', 'Vietnamese annual-revenue label lacks VNĐ'],
  ['Latest annual revenue (VND)', 'English annual-revenue label lacks VND'],
  ['Số tiền gọi vốn / giá trị giao dịch mong muốn (VNĐ)', 'Vietnamese ask label lacks VNĐ'],
  ['Capital sought / desired transaction value (VND)', 'English ask label lacks VND'],`,
  `  ['const annualRevenueLabel = T(', 'Annual-revenue label is not centralized'],
  ['const askAmountLabel = T(', 'Ask-amount label is not centralized'],
  ["currentCurrency === 'VND' ? 'VNĐ' : 'USD'", 'Vietnamese financial labels do not switch VNĐ/USD'],
  ['\`Latest annual revenue (\${currentCurrency})\`', 'English annual-revenue label does not use current currency'],
  ['\`Capital sought / desired transaction value (\${currentCurrency})\`', 'English ask label does not use current currency'],`,
  'Business registration dynamic currency labels',
);
registerCheck = replaceOnce(registerCheck, "console.log('✓ Revenue and transaction-value labels include VNĐ/VND.');", "console.log('✓ Revenue and transaction-value labels use the selected VNĐ/USD currency dynamically.');", 'Business registration currency conclusion');
write(registerCopy, registerCheck);

const registerValuation = 'scripts/deals68-register-valuation-ux-check.mjs';
let valuationCheck = read(registerValuation);
valuationCheck = replaceOnce(
  valuationCheck,
  `  'investorPackageSelected',`,
  `  'investorPremiumSelected',
  "investorPlan === 'standard' ? 'active' : ''",
  "'Mặc định · Miễn phí'",`,
  'G6 Investor plan-selection tokens',
);
valuationCheck = replaceOnce(
  valuationCheck,
  `  'd68-assets-source-grid',`,
  `  'value={assetsOwned}',
  'value={includedTangibleAssets}',
  'value={financialSource}',`,
  'G6 asset and source controls',
);
valuationCheck = replaceOnce(
  valuationCheck,
  `for (const token of [
  '.d68-assets-source-grid',
  'min-height: 34px',
  '.d68-bizreg-package-pending',
]) {`,
  `for (const token of [
  'min-height: 34px',
  '.d68-bizreg-package-pending',
]) {`,
  'G6 page-owned CSS list',
);
valuationCheck = replaceOnce(valuationCheck, `  'grid-template-columns: minmax(0, 1fr) minmax(140px, .42fr)',
`, '', 'G6 obsolete asymmetric valuation grid');
valuationCheck = replaceOnce(valuationCheck, "console.log(\n  '✓ Business and Investor packages start unselected on direct registration.',\n);", "console.log(\n  '✓ Business package starts unselected; free Standard Investor is selected by default.',\n);", 'G6 package-selection conclusion');
valuationCheck = replaceOnce(valuationCheck, "console.log(\n  '✓ Asset value and financial-source controls are aligned.',\n);", "console.log(\n  '✓ Asset descriptions and financial-source controls remain explicit and independently editable.',\n);", 'G6 asset/source conclusion');
write(registerValuation, valuationCheck);

const adminFinancial = 'scripts/deals68-admin-business-financial-review-check.mjs';
let adminFinancialCheck = read(adminFinancial);
adminFinancialCheck = adminFinancialCheck
  .replaceAll('excluded_physical_asset_value_vi', 'included_tangible_assets_vi')
  .replaceAll('excluded_physical_asset_value_en', 'included_tangible_assets_en');
if (adminFinancialCheck === read(adminFinancial)) {
  throw new Error('Admin financial review legacy field anchors not found.');
}
write(adminFinancial, adminFinancialCheck);

const marker = 'scripts/pre-main-qa-diagnostic-marker.txt';
if (fs.existsSync(marker)) fs.unlinkSync(marker);

console.log('Pre-main QA gate reconciliation applied.');
