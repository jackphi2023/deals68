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

const page = read('src/pages/InvestorDashboard.tsx');
const component = read(
  'src/components/investor/BusinessTitleLink.tsx',
);
const css = read('src/styles/pages/investor-workflow.css');

for (const token of [
  'privateInvestorName',
  'd68-investor-dashboard-title-row',
  'd68-investor-dashboard-id',
  "'Xem Hồ sơ hiển thị'",
  'publicInvestorPath',
]) {
  requireToken(page, token, `Investor Dashboard thiếu ${token}`);
}

forbidToken(
  page,
  'Quản lý hồ sơ và cơ hội đầu tư',
  'Investor Dashboard còn tiêu đề chung cũ',
);
forbidToken(
  page,
  'Manage your profile and investment opportunities',
  'Investor Dashboard còn tiêu đề chung tiếng Anh cũ',
);
forbidToken(
  page,
  'Browse businesses',
  'Đầu Dashboard còn nút xem danh sách doanh nghiệp',
);
forbidToken(
  page,
  'signOut(',
  'Investor Dashboard còn logout trùng Header',
);

const titleLinkCount =
  (page.match(/<BusinessTitleLink/g) || []).length;
if (titleLinkCount !== 3) {
  failures.push(
    `Cần đúng 3 BusinessTitleLink, thực tế ${titleLinkCount}`,
  );
}

if (
  /d68-dashboard-badge blue[\s\S]{0,120}\{investor\.code\}/
    .test(page)
) {
  failures.push(
    'Investor ID vẫn được làm nổi bật trong Profile card',
  );
}

for (const token of [
  'target="_blank"',
  'rel="noopener noreferrer"',
  'toLocalizedPath(`/businesses/${slug}`, lang)',
  'd68-investor-business-title-link',
]) {
  requireToken(
    component,
    token,
    `BusinessTitleLink thiếu ${token}`,
  );
}

for (const token of [
  '.d68-investor-dashboard-title-row',
  '.d68-investor-dashboard-id',
  '.d68-investor-business-title-link',
  'color:#94A3B8',
]) {
  requireToken(css, token, `Investor CSS thiếu ${token}`);
}

if (failures.length) {
  console.error('✗ Deals68 G4 Investor UX static check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 G4 Investor Dashboard UX static check: PASS');
console.log('✓ Header uses private Investor name and muted Investor ID.');
console.log('✓ Browse-businesses and duplicate logout controls are removed.');
console.log('✓ Displayed public-profile link is restored.');
console.log('✓ Business titles open details in a new tab in 3 lists.');
console.log('✓ Investor ID is no longer highlighted inside Profile.');
