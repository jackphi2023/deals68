#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dataSource = fs.readFileSync('src/lib/marketPartnerDemo.ts', 'utf8');
const dashboardSource = fs.readFileSync('src/pages/MarketPartnerDemoDashboard.tsx', 'utf8');
const loginSource = fs.readFileSync('src/pages/MarketPartnerLogin.tsx', 'utf8');
const appSource = fs.readFileSync('src/App.tsx', 'utf8');
const workflowSource = fs.readFileSync('.github/workflows/market-partner-phase1-5-qa.yml', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.ok(dataSource.includes("MARKET_PARTNER_DEMO_EMAIL = 'partnerdemo@deals68.com'"));
assert.ok(dataSource.includes("MARKET_PARTNER_DEMO_PASSWORD = 'Abc@12345'"));
assert.ok(dataSource.includes('24 * 60 * 60 * 1000'), 'Demo session must expire after 24 hours.');
const codeMatch = dataSource.match(/MARKET_PARTNER_DEMO_AFFILIATE_CODE = '([^']+)'/);
assert.ok(codeMatch, 'Demo affiliate code is missing.');
assert.match(codeMatch[1], /^D68[A-F0-9]{9}$/, 'Demo code must follow D68 + 9 uppercase hex characters.');

for (const [businessCode, weeks] of [
  ['D68-20260710-F343', 12],
  ['D68-02', 4],
  ['D68-01', 16],
  ['D68-03', 24],
  ['D68-20260713-7030', 8],
]) {
  assert.ok(dataSource.includes(`businessCode: '${businessCode}'`), `Missing ${businessCode}`);
  assert.ok(dataSource.includes(`termWeeks: ${weeks}`), `Missing ${weeks}-week package`);
}

function quote(weeks) {
  const subtotal = 500_000 * weeks;
  const termPct = weeks >= 16 ? 20 : weeks >= 8 ? 15 : 0;
  const termDiscount = subtotal * termPct / 100;
  const eligible = subtotal - termDiscount;
  const affiliateDiscount = eligible * 40 / 100;
  const netPaid = eligible - affiliateDiscount;
  const y = netPaid < 20_000_000 ? 40 : netPaid <= 50_000_000 ? 50 : 60;
  return { subtotal, termPct, termDiscount, eligible, affiliateDiscount, netPaid, commission: netPaid * y / 100 };
}

const confirmed = [quote(12), quote(4), quote(16), quote(24)];
const pending = quote(8);
assert.equal(confirmed.reduce((sum, row) => sum + row.netPaid, 0), 13_860_000);
assert.equal(confirmed.reduce((sum, row) => sum + row.commission, 0), 5_544_000);
assert.equal(pending.netPaid, 2_040_000);
assert.equal(pending.commission, 816_000);

assert.ok(dashboardSource.includes('Trang quản trị demo của Đối tác thị trường'));
assert.equal((dashboardSource.match(/Trang quản trị demo của Đối tác thị trường/g) || []).length, 1);
assert.doesNotMatch(dashboardSource, /d68-mp-alert/);
assert.doesNotMatch(dataSource, /from ['"]\.\/supabase['"]/);
assert.doesNotMatch(dashboardSource, /from ['"]\.\.\/lib\/supabase['"]/);
assert.doesNotMatch(dashboardSource, /supabase\.(from|rpc|auth)/i);
assert.ok(dashboardSource.includes('Chuyển khoản thành công'));
assert.ok(dashboardSource.includes('Chờ xác nhận'));
assert.ok(dashboardSource.includes('Chưa duyệt thanh toán'));

for (const token of [
  'isMarketPartnerDemoCredentials',
  'startMarketPartnerDemoSession',
  "navigate('/market-partner/demo'",
]) assert.ok(loginSource.includes(token), `Login demo wiring missing ${token}`);

for (const token of [
  "import('./pages/MarketPartnerDemoDashboard')",
  'path="/market-partner/demo"',
  'path="/en/market-partner/demo"',
]) assert.ok(appSource.includes(token), `Demo route wiring missing ${token}`);

assert.equal(pkg.scripts['qa:market-partner-demo'], 'node scripts/qa-market-partner-demo.mjs');
assert.ok(pkg.scripts['qa:release'].includes('qa:market-partner-demo'));
assert.ok(workflowSource.includes('Market Partner static demo QA'));
assert.ok(workflowSource.includes('npm run qa:market-partner-demo'));

console.log('✓ Market Partner static demo QA passed.');
