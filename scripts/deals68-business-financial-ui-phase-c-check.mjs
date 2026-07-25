import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const checks = [];
function expect(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

const component = read('src/components/business/SensitiveFinancialValue.tsx');
const css = read('src/styles/components/sensitive-financial-value.css');
const stylesEntry = read('src/styles/index.css');
const home = read('src/pages/Home.tsx');
const businesses = read('src/pages/Businesses.tsx');
const detail = read('src/pages/BusinessDetail.tsx');
const investorDashboard = read('src/pages/InvestorDashboard.tsx');
const register = read('src/pages/Register.tsx');
const labelsBase = read('src/lib/labelsBase.ts');
const data = read('src/lib/data.ts');

expect('shared component exists', component.includes('SensitiveFinancialValue'));
expect('masked placeholder contains no exact value or block glyphs', component.includes('d68-sensitive-financial__placeholder') && !component.includes('██████████'));
expect('blur mask is CSS-rendered', component.includes('role="img"') && css.includes('radial-gradient') && css.includes('filter: blur'));
expect('blur mask desktop width is 68px', /\.d68-sensitive-financial__placeholder\s*\{[\s\S]*?width:\s*68px;/m.test(css));
expect('blur mask preserves supplied aspect ratio', css.includes('aspect-ratio: 257 / 81'));
expect('compact blur mask remains 68px', /\.is-compact \.d68-sensitive-financial__placeholder\s*\{[\s\S]*?width:\s*68px;/m.test(css));
expect('restricted wording VI', component.includes('Chỉ nhà đầu tư được doanh nghiệp gửi Proposal'));
expect('restricted wording EN', component.includes('Only investors who receive a Proposal from the Business'));
expect('pending wording VI', component.includes('Yêu cầu số liệu đang chờ doanh nghiệp chấp thuận.'));
expect('pending wording EN', component.includes('Your financial data request is awaiting Business approval.'));
expect('authorized values render without grant badge text', !component.includes('Doanh nghiệp đã cấp quyền xem số liệu.') && !component.includes('d68-sensitive-financial__badge'));
expect('detail-only hint contract', component.includes('const showHint = (restricted || pending) && !compact'));
expect('detail hint uses [?]', component.includes('>[?]</span>'));
expect('keyboard support', component.includes("event.key !== 'Enter'") && component.includes("event.key !== ' '"));
expect('aria support', component.includes('aria-describedby') && component.includes('role="tooltip"'));
expect('compact cards have no tooltip trigger', component.includes('tabIndex={showHint ? 0 : undefined}') && component.includes('{showHint ? ('));
expect('component css imported by owner', stylesEntry.includes("./components/sensitive-financial-value.css"));
expect('Homepage uses shared component', home.includes('<SensitiveFinancialValue'));
expect('Homepage always supplies null exact Revenue value', home.includes('value={null}'));
expect('Homepage does not import secure hydration', !home.includes('attachAuthorizedBusinessFinancials'));
expect('Business List uses shared component twice', (businesses.match(/<SensitiveFinancialValue/g) || []).length >= 2);
expect('Business Detail uses shared component', (detail.match(/<SensitiveFinancialValue/g) || []).length >= 3);
expect('Investor Dashboard uses shared component', investorDashboard.includes('<SensitiveFinancialValue'));
expect('Register privacy wording source remains centralized', register.includes('Các số liệu tài chính chính xác chỉ được chia sẻ'));
expect('Register privacy wording updated', labelsBase.includes("'Các số liệu tài chính chính xác chỉ được chia sẻ với nhà đầu tư khi doanh nghiệp gửi Proposal hoặc chấp thuận yêu cầu dữ liệu. Người xem công khai và nhà đầu tư chưa được cấp quyền chỉ thấy trạng thái bảo mật',"));
expect('Register asset placeholder copy updated', labelsBase.includes('Nhập số: giá trị đất đai/nhà máy/khách sạn/tòa nhà...'));
expect('server-derived access metadata', data.includes('d68_get_business_financial_access'));
expect('public revenue sorting remains band-based', data.includes("q.order('revenue_band_rank'"));
expect('Homepage disables authorized hydration', data.includes('includeAuthorizedFinancials: false'));

const failed = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? 'PASS' : 'FAIL'} — ${check.name}`);
}
if (failed.length) {
  console.error(`\nPhase C QA failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nPhase C QA passed: ${checks.length}/${checks.length}`);
