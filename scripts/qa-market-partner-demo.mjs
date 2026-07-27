#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dataSource = fs.readFileSync('src/lib/marketPartnerDemo.ts', 'utf8');
const dashboardSource = fs.readFileSync('src/pages/MarketPartnerDemoDashboard.tsx', 'utf8');
const realDashboardSource = fs.readFileSync('src/pages/MarketPartnerDashboard.tsx', 'utf8');
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

for (const publicTitleVi of [
  'Chuyển nhượng Khách sạn 5*, Quận 1, Tp HCM',
  'Công ty Mobile App đang gọi vốn 2M USD cho 30%',
  'Chuỗi phòng khám da liễu & thẩm mỹ 5 chi nhánh đang gọi vốn mở rộng toàn quốc',
  'Nền tảng may đo cá nhân hóa gọi vốn 300.000 USD cho 22,6%',
  'Gọi vốn · Nông nghiệp · TP. Hồ Chí Minh',
]) assert.ok(dataSource.includes(publicTitleVi), `Missing public Vietnamese business title: ${publicTitleVi}`);
assert.ok(dashboardSource.includes('row.businessTitleVi'));
assert.ok(dashboardSource.includes('row.business_title_vi'));
assert.equal((dashboardSource.match(/row\.businessTitleVi/g) || []).length, 1);
assert.equal((dashboardSource.match(/row\.business_title_vi/g) || []).length, 1);
assert.ok(!dashboardSource.includes('<td><b>{row.businessCode}</b>'));
assert.ok(!dashboardSource.includes('<td><b>{row.business_code}</b></td>'));

// Requested Market Partner demo wording must remain exact and legacy wording must not return.
assert.ok(dashboardSource.includes('Quản trị doanh thu Đối tác thị trường'));
assert.equal((dashboardSource.match(/Quản trị doanh thu Đối tác thị trường/g) || []).length, 1);
assert.ok(dashboardSource.includes('<h1>Đối tác Thị trường</h1>'));
assert.doesNotMatch(dashboardSource, /d68-mp-alert/);
assert.doesNotMatch(dataSource, /from ['"]\.\/supabase['"]/);
assert.doesNotMatch(dashboardSource, /from ['"]\.\.\/lib\/supabase['"]/);
assert.doesNotMatch(dashboardSource, /supabase\.(from|rpc|auth)/i);
assert.ok(dashboardSource.includes('Chuyển khoản thành công'));
assert.ok(dashboardSource.includes('Chờ xác nhận'));
assert.ok(dashboardSource.includes('Chưa duyệt thanh toán'));
for (const wording of [
  "label: 'Giao dịch'",
  "label: 'Thu nhập'",
  'Chờ thanh toán',
  'Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.',
  'Đơn vị: VNĐ. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.',
  'Quản trị doanh thu Đối tác thị trường',
  '<h1>Đối tác Thị trường</h1>',
  'chưa ghi nhận đến khi thanh toán đã được xác thực',
  'Giá và hoa hồng được tính theo trị thanh toán của khách hàng.',
  '<h2>Thu nhập</h2>',
  'Khách hàng đã được xác nhận thanh toán dịch vụ thành công.',
  '<h2>Lịch sử chi trả</h2>',
  'Tổng hợp theo mã đối tác hiện tại.',
  'Mã Đối tác',
  'Thông tin này chỉ Đối tác và Admin được xem. Cần hoàn tất trước khi thanh toán.',
]) assert.ok(dashboardSource.includes(wording), `Missing requested demo wording: ${wording}`);
for (const legacyWording of [
  "label: 'Lead & chuyển đổi'",
  "label: 'Hoa hồng & thanh toán'",
  'Khả dụng để lập payout',
  'Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.',
  'Đồng tiền cơ sở: VND. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.',
  'Trang quản trị demo của Đối tác thị trường',
  '<h1>{partner.display_name}</h1>',
  'chưa ghi nhận đến khi payment confirmed',
  'Giá và hoa hồng được tính theo đúng thứ tự: giảm kỳ hạn → giảm Partner X → hoa hồng Y trên số tiền thực trả.',
  '<h2>Commission</h2>',
  'Không hiển thị danh tính khách hàng hoặc payment payload.',
  '<h2>Lịch sử payout</h2>',
  'Tổng hợp theo mã affiliate hiện tại.',
  '<th>Mã affiliate</th>',
  'Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.',
]) assert.ok(!dashboardSource.includes(legacyWording), `Legacy demo wording still present: ${legacyWording}`);

for (const sharedWording of [
  "label: 'Giao dịch'",
  "label: 'Thu nhập'",
  'Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.',
  'Khách hàng đã được xác nhận thanh toán dịch vụ thành công.',
  '<h2>Lịch sử chi trả</h2>',
  'Mã Đối tác hiện tại:',
  'Thông tin này chỉ Đối tác và Admin được xem. Cần hoàn tất trước khi thanh toán.',
]) assert.ok(realDashboardSource.includes(sharedWording), `Real Partner dashboard missing synchronized wording: ${sharedWording}`);
for (const legacyWording of [
  "label: 'Lead & chuyển đổi'",
  "label: 'Hoa hồng & thanh toán'",
  'Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.',
  '<h2>Commission</h2>',
  'Không hiển thị danh tính khách hàng hoặc payment payload.',
  '<h2>Lịch sử payout</h2>',
  'Mã affiliate hiện tại:',
  'Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.',
]) assert.ok(!realDashboardSource.includes(legacyWording), `Real Partner dashboard still contains legacy wording: ${legacyWording}`);

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
