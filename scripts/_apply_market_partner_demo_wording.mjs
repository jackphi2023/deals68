#!/usr/bin/env node
import fs from 'node:fs';

function replaceOrVerify(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const beforeCount = source.split(before).length - 1;
  const afterCount = source.split(after).length - 1;
  if (beforeCount === 1) {
    fs.writeFileSync(path, source.replace(before, after));
    return;
  }
  if (beforeCount === 0 && afterCount === 1) return;
  throw new Error(`${path}: expected one legacy or one updated match for ${JSON.stringify(before)}, found old=${beforeCount}, new=${afterCount}`);
}

const dashboard = 'src/pages/MarketPartnerDemoDashboard.tsx';
replaceOrVerify(dashboard, "label: 'Lead & chuyển đổi'", "label: 'Giao dịch'");
replaceOrVerify(dashboard, "label: 'Hoa hồng & thanh toán'", "label: 'Thu nhập'");
replaceOrVerify(dashboard, 'Khả dụng để lập payout', 'Chờ thanh toán');
replaceOrVerify(
  dashboard,
  'Commission chỉ được chi trả sau khi Admin duyệt và hoàn tất đối soát.',
  'Thu nhập/Hoa hồng chỉ được chi trả sau khi Admin deals68 duyệt và hoàn tất đối soát.',
);
replaceOrVerify(
  dashboard,
  'Đồng tiền cơ sở: VND. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.',
  'Đơn vị: VNĐ. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.',
);
replaceOrVerify(
  dashboard,
  '<span className="d68-mp-eyebrow">Trang quản trị demo của Đối tác thị trường</span>',
  '<span className="d68-mp-eyebrow">Quản trị doanh thu Đối tác thị trường</span>',
);
replaceOrVerify(
  dashboard,
  '<h1>{partner.display_name}</h1>',
  '<h1>Đối tác Thị trường</h1>',
);

const qa = 'scripts/qa-market-partner-demo.mjs';
replaceOrVerify(
  qa,
  "assert.ok(dashboardSource.includes('Trang quản trị demo của Đối tác thị trường'));\nassert.equal((dashboardSource.match(/Trang quản trị demo của Đối tác thị trường/g) || []).length, 1);",
  "assert.ok(dashboardSource.includes('Quản trị doanh thu Đối tác thị trường'));\nassert.equal((dashboardSource.match(/Quản trị doanh thu Đối tác thị trường/g) || []).length, 1);\nassert.ok(dashboardSource.includes('<h1>Đối tác Thị trường</h1>'));",
);
replaceOrVerify(
  qa,
  "  'Đơn vị: VNĐ. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.',\n])",
  "  'Đơn vị: VNĐ. Thu nhập/Hoa hồng theo Chính sách Đối tác thị trường của Deals68.com.',\n  'Quản trị doanh thu Đối tác thị trường',\n  '<h1>Đối tác Thị trường</h1>',\n])",
);
replaceOrVerify(
  qa,
  "  'Đồng tiền cơ sở: VND. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.',\n])",
  "  'Đồng tiền cơ sở: VND. Commission lịch sử dùng snapshot X/Y tại thời điểm payment.',\n  'Trang quản trị demo của Đối tác thị trường',\n  '<h1>{partner.display_name}</h1>',\n])",
);

console.log('✓ Market Partner demo wording applied and verified.');
