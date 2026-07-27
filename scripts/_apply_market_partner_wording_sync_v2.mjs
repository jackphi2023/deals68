#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match for ${JSON.stringify(before)}, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

const dataPath = 'src/lib/marketPartnerDemo.ts';
replaceOnce(
  dataPath,
  'export type DemoPartnerTransaction = {\n  businessCode: string;\n  termWeeks:',
  'export type DemoPartnerTransaction = {\n  businessCode: string;\n  businessTitleVi: string;\n  termWeeks:',
);
replaceOnce(dataPath, '  business_code: string;\n  term_weeks:', '  business_code: string;\n  business_title_vi: string;\n  term_weeks:');
replaceOnce(
  dataPath,
  'function calculateTransaction(input: {\n  businessCode: string;\n  termWeeks: DemoPartnerTransaction',
  'function calculateTransaction(input: {\n  businessCode: string;\n  businessTitleVi: string;\n  termWeeks: DemoPartnerTransaction',
);
replaceOnce(dataPath, '    businessCode: input.businessCode,\n    termWeeks:', '    businessCode: input.businessCode,\n    businessTitleVi: input.businessTitleVi,\n    termWeeks:');

const titles = [
  ['D68-20260710-F343', 'Chuyển nhượng Khách sạn 5*, Quận 1, Tp HCM'],
  ['D68-02', 'Công ty Mobile App đang gọi vốn 2M USD cho 30%'],
  ['D68-01', 'Chuỗi phòng khám da liễu & thẩm mỹ 5 chi nhánh đang gọi vốn mở rộng toàn quốc'],
  ['D68-03', 'Nền tảng may đo cá nhân hóa gọi vốn 300.000 USD cho 22,6%'],
  ['D68-20260713-7030', 'Gọi vốn · Nông nghiệp · TP. Hồ Chí Minh'],
];
for (const [code, title] of titles) {
  replaceOnce(
    dataPath,
    `    businessCode: '${code}',\n    termWeeks:`,
    `    businessCode: '${code}',\n    businessTitleVi: '${title.replaceAll("'", "\\'")}',\n    termWeeks:`,
  );
}
replaceOnce(dataPath, '  business_code: row.businessCode,\n  term_weeks:', '  business_code: row.businessCode,\n  business_title_vi: row.businessTitleVi,\n  term_weeks:');

const demoPath = 'src/pages/MarketPartnerDemoDashboard.tsx';
replaceOnce(demoPath, 'note="chưa ghi nhận đến khi payment confirmed"', 'note="chưa ghi nhận đến khi thanh toán đã được xác thực"');
replaceOnce(
  demoPath,
  'Giá và hoa hồng được tính theo đúng thứ tự: giảm kỳ hạn → giảm Partner X → hoa hồng Y trên số tiền thực trả.',
  'Giá và hoa hồng được tính theo trị thanh toán của khách hàng.',
);
replaceOnce(demoPath, '<td><b>{row.businessCode}</b><br /><small>', '<td><b>{row.businessTitleVi}</b><br /><small>');
replaceOnce(demoPath, '<div><h2>Commission</h2><p>Không hiển thị danh tính khách hàng hoặc payment payload.</p></div>', '<div><h2>Thu nhập</h2><p>Khách hàng đã được xác nhận thanh toán dịch vụ thành công.</p></div>');
replaceOnce(demoPath, '<td><b>{row.business_code}</b></td>', '<td><b>{row.business_title_vi}</b></td>');
replaceOnce(demoPath, '<div><h2>Lịch sử payout</h2>', '<div><h2>Lịch sử chi trả</h2>');
replaceOnce(demoPath, 'Mã affiliate: {partner.affiliate_code}.', 'Mã Đối tác: {partner.affiliate_code}.');
replaceOnce(demoPath, 'Tổng hợp theo mã affiliate hiện tại.', 'Tổng hợp theo mã đối tác hiện tại.');
replaceOnce(demoPath, '<th>Mã affiliate</th>', '<th>Mã Đối tác</th>');
replaceOnce(
  demoPath,
  'Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.',
  'Thông tin này chỉ Đối tác và Admin được xem. Cần hoàn tất trước khi thanh toán.',
);

const realPath = 'src/pages/MarketPartnerDashboard.tsx';
replaceOnce(realPath, "{ id: 'leads', label: 'Lead & chuyển đổi', icon: Users }", "{ id: 'leads', label: 'Giao dịch', icon: Users }");
replaceOnce(realPath, "{ id: 'commissions', label: 'Hoa hồng & thanh toán', icon: WalletCards }", "{ id: 'commissions', label: 'Thu nhập', icon: WalletCards }");
replaceOnce(realPath, '<div className="available"><span>Khả dụng để lập payout</span>', '<div className="available"><span>Chờ thanh toán</span>');
replaceOnce(realPath, 'Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.', 'Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.');
replaceOnce(
  realPath,
  '<p>Đồng tiền cơ sở: {policy.basisCurrency}. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.</p>',
  "<p>Đơn vị: {policy.basisCurrency === 'VND' ? 'VNĐ' : policy.basisCurrency}. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.</p>",
);
replaceOnce(realPath, '<ReadOnlyPanel title="Lead & chuyển đổi"', '<ReadOnlyPanel title="Giao dịch"');
replaceOnce(realPath, 'text={`Mã affiliate hiện tại:', 'text={`Mã Đối tác hiện tại:');
replaceOnce(realPath, '<div><h2>Commission</h2><p>Không hiển thị danh tính khách hàng hoặc payment payload.</p></div>', '<div><h2>Thu nhập</h2><p>Khách hàng đã được xác nhận thanh toán dịch vụ thành công.</p></div>');
replaceOnce(realPath, 'Chưa có commission được ghi nhận.', 'Chưa có thu nhập được ghi nhận.');
replaceOnce(realPath, '<div><h2>Lịch sử payout</h2>', '<div><h2>Lịch sử chi trả</h2>');
replaceOnce(realPath, 'Chưa có payout.', 'Chưa có lịch sử chi trả.');
replaceOnce(
  realPath,
  'Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.',
  'Thông tin này chỉ Đối tác và Admin được xem. Cần hoàn tất trước khi thanh toán.',
);

const qaV1Path = 'scripts/qa-market-partner-v1.mjs';
replaceOnce(qaV1Path, 'assert.match(partnerDashboard, /Lead & chuyển đổi/);', 'assert.match(partnerDashboard, /Giao dịch/);');
replaceOnce(qaV1Path, 'assert.match(partnerDashboard, /Hoa hồng & thanh toán/);', 'assert.match(partnerDashboard, /Thu nhập/);');
replaceOnce(qaV1Path, 'assert.match(partnerDashboard, /Commission lịch sử dùng snapshot X\\/Y/);', 'assert.match(partnerDashboard, /Thu nhập\\/Hoa hồng theo Chính sách Đối tác thị trường/);');
replaceOnce(qaV1Path, 'assert.match(partnerDashboard, /Lịch sử payout/);', 'assert.match(partnerDashboard, /Lịch sử chi trả/);');
replaceOnce(qaV1Path, 'assert.match(partnerDashboard, /Không hiển thị danh tính khách hàng hoặc payment payload/);', 'assert.match(partnerDashboard, /Khách hàng đã được xác nhận thanh toán dịch vụ thành công/);');

const qaPath = 'scripts/qa-market-partner-demo.mjs';
replaceOnce(
  qaPath,
  "const dashboardSource = fs.readFileSync('src/pages/MarketPartnerDemoDashboard.tsx', 'utf8');",
  "const dashboardSource = fs.readFileSync('src/pages/MarketPartnerDemoDashboard.tsx', 'utf8');\nconst realDashboardSource = fs.readFileSync('src/pages/MarketPartnerDashboard.tsx', 'utf8');",
);
replaceOnce(
  qaPath,
  "assert.equal(pending.commission, 816_000);",
  `assert.equal(pending.commission, 816_000);

for (const publicTitleVi of [
  'Chuyển nhượng Khách sạn 5*, Quận 1, Tp HCM',
  'Công ty Mobile App đang gọi vốn 2M USD cho 30%',
  'Chuỗi phòng khám da liễu & thẩm mỹ 5 chi nhánh đang gọi vốn mở rộng toàn quốc',
  'Nền tảng may đo cá nhân hóa gọi vốn 300.000 USD cho 22,6%',
  'Gọi vốn · Nông nghiệp · TP. Hồ Chí Minh',
]) assert.ok(dataSource.includes(publicTitleVi), \`Missing public Vietnamese business title: \${publicTitleVi}\`);
assert.ok(dashboardSource.includes('row.businessTitleVi'));
assert.ok(dashboardSource.includes('row.business_title_vi'));
assert.ok(!dashboardSource.includes('<td><b>{row.businessCode}</b>'));
assert.ok(!dashboardSource.includes('<td><b>{row.business_code}</b></td>'));`,
);
replaceOnce(
  qaPath,
  "  '<h1>Đối tác Thị trường</h1>',\n])",
  `  '<h1>Đối tác Thị trường</h1>',
  'chưa ghi nhận đến khi thanh toán đã được xác thực',
  'Giá và hoa hồng được tính theo trị thanh toán của khách hàng.',
  '<h2>Thu nhập</h2>',
  'Khách hàng đã được xác nhận thanh toán dịch vụ thành công.',
  '<h2>Lịch sử chi trả</h2>',
  'Tổng hợp theo mã đối tác hiện tại.',
  'Mã Đối tác',
  'Thông tin này chỉ Đối tác và Admin được xem. Cần hoàn tất trước khi thanh toán.',
])`,
);
replaceOnce(
  qaPath,
  "  '<h1>{partner.display_name}</h1>',\n])",
  `  '<h1>{partner.display_name}</h1>',
  'chưa ghi nhận đến khi payment confirmed',
  'Giá và hoa hồng được tính theo đúng thứ tự: giảm kỳ hạn → giảm Partner X → hoa hồng Y trên số tiền thực trả.',
  '<h2>Commission</h2>',
  'Không hiển thị danh tính khách hàng hoặc payment payload.',
  '<h2>Lịch sử payout</h2>',
  'Tổng hợp theo mã affiliate hiện tại.',
  '<th>Mã affiliate</th>',
  'Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.',
])`,
);
replaceOnce(
  qaPath,
  "for (const token of [\n  'isMarketPartnerDemoCredentials',",
  `for (const sharedWording of [
  "label: 'Giao dịch'",
  "label: 'Thu nhập'",
  'Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.',
  'Khách hàng đã được xác nhận thanh toán dịch vụ thành công.',
  '<h2>Lịch sử chi trả</h2>',
  'Mã Đối tác hiện tại:',
  'Thông tin này chỉ Đối tác và Admin được xem. Cần hoàn tất trước khi thanh toán.',
]) assert.ok(realDashboardSource.includes(sharedWording), \`Real Partner dashboard missing synchronized wording: \${sharedWording}\`);
for (const legacyWording of [
  "label: 'Lead & chuyển đổi'",
  "label: 'Hoa hồng & thanh toán'",
  'Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.',
  '<h2>Commission</h2>',
  'Không hiển thị danh tính khách hàng hoặc payment payload.',
  '<h2>Lịch sử payout</h2>',
  'Mã affiliate hiện tại:',
  'Thông tin này chỉ Partner và Admin được xem. Cần hoàn tất trước khi payout được đánh dấu đã trả.',
]) assert.ok(!realDashboardSource.includes(legacyWording), \`Real Partner dashboard still contains legacy wording: \${legacyWording}\`);

for (const token of [
  'isMarketPartnerDemoCredentials',`,
);

console.log('✓ Market Partner demo and real dashboard wording synchronized.');
