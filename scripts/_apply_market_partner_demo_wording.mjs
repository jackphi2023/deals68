#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match for ${JSON.stringify(before)}, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

const dashboard = 'src/pages/MarketPartnerDemoDashboard.tsx';
replaceOnce(dashboard, "label: 'Lead & chuyển đổi'", "label: 'Giao dịch'");
replaceOnce(dashboard, "label: 'Hoa hồng & thanh toán'", "label: 'Thu nhập'");
replaceOnce(dashboard, 'Khả dụng để lập payout', 'Chờ thanh toán');
replaceOnce(
  dashboard,
  'Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.',
  'Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.',
);
replaceOnce(
  dashboard,
  'Đồng tiền cơ sở: VND. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.',
  'Đơn vị: VNĐ. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.',
);
replaceOnce(
  dashboard,
  '<span className="d68-mp-eyebrow">Trang quản trị demo của Đối tác thị trường</span>',
  '<span className="d68-mp-eyebrow">Quản trị doanh thu Đối tác thị trường</span>',
);
replaceOnce(
  dashboard,
  '<h1>{partner.display_name}</h1>',
  '<h1>Đối tác Thị trường</h1>',
);

const qa = 'scripts/qa-market-partner-demo.mjs';
replaceOnce(
  qa,
  "assert.ok(dashboardSource.includes('Chưa duyệt thanh toán'));",
  `assert.ok(dashboardSource.includes('Chưa duyệt thanh toán'));
for (const wording of [
  "label: 'Giao dịch'",
  "label: 'Thu nhập'",
  'Chờ thanh toán',
  'Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.',
  'Đơn vị: VNĐ. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.',
  'Quản trị doanh thu Đối tác thị trường',
  '<h1>Đối tác Thị trường</h1>',
]) assert.ok(dashboardSource.includes(wording), \`Missing requested demo wording: \${wording}\`);
for (const legacyWording of [
  "label: 'Lead & chuyển đổi'",
  "label: 'Hoa hồng & thanh toán'",
  'Khả dụng để lập payout',
  'Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.',
  'Đồng tiền cơ sở: VND. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.',
  'Trang quản trị demo của Đối tác thị trường',
  '<h1>{partner.display_name}</h1>',
]) assert.ok(!dashboardSource.includes(legacyWording), \`Legacy demo wording still present: \${legacyWording}\`);`,
);

console.log('✓ Market Partner demo wording applied.');
