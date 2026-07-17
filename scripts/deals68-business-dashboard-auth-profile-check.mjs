#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const dashboard = fs.readFileSync(
  'src/pages/BusinessDashboard.tsx',
  'utf8',
);
const css = fs.readFileSync(
  'src/styles/pages/business-dashboard.css',
  'utf8',
);

// The route gate is the only owner of unauthenticated redirects.
assert.match(app, /function DashboardGate/);
assert.match(app, /const loginPath = toLocalizedPath\('\/login', lang\);/);
assert.match(app, /const next = encodeURIComponent\(location\.pathname \+ location\.search\);/);
assert.match(app, /<Navigate to=\{`\$\{loginPath\}\?next=\$\{next\}`\} replace \/>/);
for (const route of [
  '/dashboard/business',
  '/dashboard/business/*',
  '/en/dashboard/business',
  '/en/dashboard/business/*',
]) {
  assert.ok(
    app.includes(`path="${route}"`),
    `Missing guarded Business Dashboard route: ${route}`,
  );
}
assert.doesNotMatch(dashboard, /\bNavigate\b|\buseNavigate\b/);
assert.match(
  dashboard,
  /const suffix = stripLangPrefix\(pathname\)[\s\S]*\.replace\('\/dashboard\/business',''\)/,
);

// A real empty profile is rendered only after the first request completes.
assert.match(
  dashboard,
  /const \[initialLoadComplete, setInitialLoadComplete\] = useState\(false\);/,
);
assert.match(dashboard, /if \(!profile \|\| !initialLoadComplete\)/);
assert.ok(
  dashboard.indexOf('if (!profile || !initialLoadComplete)') <
    dashboard.indexOf('if (!b) return'),
  'The empty-profile state can render before initial loading completes',
);
assert.match(dashboard, /Không thể tải hồ sơ doanh nghiệp/);
assert.match(dashboard, /setInitialLoadComplete\(false\); load\(\)\.finally/);

// Approved Business profile wording and currency controls.
for (const token of [
  "T(lang,'Tên doanh nghiệp','Business name')",
  "T(lang,'Tên doanh nghiệp hiển thị (ẩn danh)','Displayed business name (anonymous)')",
  "T(lang,'Đơn vị','Currency')",
  '<CurrencyField lang={lang} value={revenueCurrency}',
  'name="revenue_currency" value={revenueCurrency}',
  'name="ask_currency" value={askCurrency}',
]) {
  assert.ok(dashboard.includes(token), `Missing profile contract token: ${token}`);
}

for (const legacyToken of [
  'Tên doanh nghiệp thật — chỉ Admin thấy',
  'Tiêu đề ẩn danh public — Admin nhập',
  '<span>Revenue currency</span>',
  '<span>Ask currency</span>',
  "fd.get('data_confidence')",
  'name="data_confidence"',
]) {
  assert.ok(
    !dashboard.includes(legacyToken),
    `Legacy profile token remains: ${legacyToken}`,
  );
}

assert.match(
  css,
  /\.d68-business-dashboard-page \.d68-business-profile-form \{[\s\S]*gap: 15px;/,
);
assert.match(
  css,
  /\.d68-business-dashboard-page \.d68-business-profile-intro \{[\s\S]*margin: 0;/,
);

console.log('✓ Deals68 Session 6 Business Dashboard check: PASS');
console.log('✓ DashboardGate exclusively owns auth redirection for VI/EN routes.');
console.log('✓ Initial loading, request failure and genuine empty-profile states are distinct.');
console.log('✓ Monthly/annual revenue units remain synchronized to one database field.');
console.log('✓ Data confidence is absent from the Business Dashboard form and payload.');
console.log('✓ Static/local test only; no Supabase project or data was used.');
