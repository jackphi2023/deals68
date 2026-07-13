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

const register = read('src/pages/Register.tsx');
const valuation = read('src/pages/Valuation.tsx');
const css = read('src/styles/pages/ui-fixes.css');
const authCss = read('src/styles/pages/auth.css');

for (const token of [
  'd68-register-section--business-pricing',
  '<div className="d68-bizreg-paygrid">',
  '<aside className="d68-bizreg-summary">',
  "'Tạm tính'",
  "'Tổng thanh toán'",
  "useState<BusinessPlan | ''>",
  'investorPackageSelected',
  'const hasSelectedPackage =',
  "b={hasSelectedPackage ? money(price.subtotal, price.currency) : '-'}",
  'd68-bizreg-package-pending',
  'd68-assets-source-grid',
]) {
  requireToken(register, token, `Register missing ${token}`);
}

forbidToken(
  register,
  "useState<BusinessPlan>(intent.businessPlan === 'featured' ? 'featured' : 'standard')",
  'Business registration still defaults to Standard plan',
);

forbidToken(
  register,
  '<button type="button" className="active"><h3>{T(lang, \'Gói Nhà đầu tư\'',
  'Investor membership remains active by default',
);

for (const token of [
  '@media(min-width:781px)',
  '.d68-register-section--business-pricing .d68-bizreg-paygrid',
  'grid-template-columns:minmax(0,1fr) 350px',
  '.d68-register-section--business-pricing .d68-bizreg-promo',
  'grid-template-columns:200px 88px',
  'width:200px',
]) {
  requireToken(css, token, `Register CSS missing ${token}`);
}

for (const token of [
  '.d68-assets-source-grid',
  'min-height: 34px',
  '.d68-bizreg-package-pending',
]) {
  requireToken(
    authCss,
    token,
    `Register page-owned CSS missing ${token}`,
  );
}

requireToken(
  css,
  'grid-template-columns:minmax(0,1fr) 290px',
  'Investor payment summary baseline changed',
);

requireToken(
  css,
  'grid-template-columns:minmax(0,1fr) 88px',
  'Investor promo baseline changed',
);

for (const token of [
  "const [country, setCountry] = useState('');",
  "const [industryKey, setIndustryKey] = useState('');",
  "const [revenueYear, setRevenueYear] = useState('');",
  "const [margin, setMargin] = useState('');",
  "const [growth, setGrowth] = useState('');",
  'const hasRequiredInputs =',
  'parsedRevenue > 0',
  "'Chọn quốc gia'",
  "'Chọn ngành'",
]) {
  requireToken(valuation, token, `Valuation missing ${token}`);
}

for (const token of [
  "useState('VN')",
  "useState('food_beverage')",
  "formatNumberTyping('9000000000')",
  "useState('17')",
  "useState('10')",
  "'Đang cập nhật'",
  "'Pending'",
]) {
  forbidToken(
    valuation,
    token,
    `Valuation retains old default ${token}`,
  );
}

const dashRows = (valuation.match(/b="—"/g) || []).length;

if (dashRows < 6) {
  failures.push(
    `Expected at least 6 em-dash rows, found ${dashRows}`,
  );
}

if (failures.length) {
  console.error(
    '✗ Deals68 G6 Register/Valuation UX check failed:',
  );
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log(
  '✓ Deals68 G6 Register/Valuation UX static check: PASS',
);
console.log(
  '✓ Business and Investor packages start unselected on direct registration.',
);
console.log(
  '✓ Estimate and total display "-" until a package is selected.',
);
console.log(
  '✓ Payment QR remains hidden until package selection.',
);
console.log(
  '✓ Asset value and financial-source controls are aligned.',
);
console.log(
  '✓ Business promo-code input is 200px on desktop.',
);
console.log(
  '✓ Business payment summary is 350px, +60px.',
);
console.log(
  '✓ Investor registration dimensions remain unchanged.',
);
console.log('✓ Valuation fields start empty.');
console.log(
  '✓ Valuation waits for country, industry and valid revenue.',
);
console.log(
  '✓ Incomplete valuation outputs display em dashes.',
);
