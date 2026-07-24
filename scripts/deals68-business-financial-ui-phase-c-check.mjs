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
const data = read('src/lib/data.ts');

expect('shared component exists', component.includes('SensitiveFinancialValue'));
expect('masked placeholder contains no exact value', component.includes('██████████'));
expect('restricted wording VI', component.includes('Chỉ nhà đầu tư được doanh nghiệp gửi Proposal'));
expect('restricted wording EN', component.includes('Only investors who receive a Proposal from the Business'));
expect('pending wording VI', component.includes('Yêu cầu số liệu đang chờ doanh nghiệp chấp thuận.'));
expect('pending wording EN', component.includes('Your financial data request is awaiting Business approval.'));
expect('proposal badge VI', component.includes('Được doanh nghiệp chia sẻ qua Proposal.'));
expect('request badge VI', component.includes('Doanh nghiệp đã cấp quyền xem số liệu.'));
expect('keyboard support', component.includes("event.key !== 'Enter'") && component.includes("event.key !== ' '"));
expect('aria support', component.includes('aria-describedby') && component.includes('role="tooltip"'));
expect('mask background #f7fafc', /background:\s*#f7fafc/i.test(css));
expect('component css imported by owner', stylesEntry.includes("./components/sensitive-financial-value.css"));
expect('Homepage uses shared component', home.includes('<SensitiveFinancialValue'));
expect('Homepage always supplies null exact value', home.includes('value={null}'));
expect('Homepage does not import secure hydration', !home.includes('attachAuthorizedBusinessFinancials'));
expect('Business List uses shared component twice', (businesses.match(/<SensitiveFinancialValue/g) || []).length >= 2);
expect('Business Detail uses shared component', (detail.match(/<SensitiveFinancialValue/g) || []).length >= 3);
expect('Investor Dashboard uses shared component', investorDashboard.includes('<SensitiveFinancialValue'));
expect('Register privacy wording VI', register.includes('Các số liệu tài chính chính xác chỉ được chia sẻ'));
expect('Register privacy wording EN', register.includes('Exact financial figures are shared only'));
expect('server-derived access metadata', data.includes("d68_get_business_financial_access"));
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
