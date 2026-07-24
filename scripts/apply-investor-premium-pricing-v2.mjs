#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = process.argv[2];
if (!migrationPath) throw new Error('Migration path is required.');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function replaceOnce(file, from, to) {
  const source = read(file);
  if (!source.includes(from)) {
    throw new Error(`Anchor not found in ${file}: ${from.slice(0, 160)}`);
  }
  write(file, source.replace(from, to));
}

const migrationName = path.basename(migrationPath);
const migrationVersion = migrationName.split('_')[0];

write(migrationPath, `-- Deals68 Investor Premium pricing — V2.
-- Replaces only the canonical server-side monthly price contract.
-- Historical payment orders, memberships, discounts and entitlements are unchanged.

begin;

create or replace function public.d68_get_investor_premium_price(
  p_country_iso2 text default 'VN'
)
returns jsonb
language sql
immutable
security invoker
set search_path = public
as $function$
  select jsonb_build_object(
    'plan', 'premium',
    'billing_period', 'month',
    'currency', case
      when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 'VND'
      else 'USD'
    end,
    'unit_amount', case
      when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 26000000
      else 1000
    end,
    'price_version', 'investor-premium-v2-20260724',
    'effective_from', '2026-07-24'
  );
$function$;

revoke all on function public.d68_get_investor_premium_price(text)
from public;
grant execute on function public.d68_get_investor_premium_price(text)
to anon, authenticated, service_role;

comment on function public.d68_get_investor_premium_price(text) is
  'Canonical Investor Premium monthly price: VND 26,000,000 in Vietnam and USD 1,000 in other countries, effective 2026-07-24.';

commit;
`);

replaceOnce(
  'src/lib/investorPlans.ts',
  `export const INVESTOR_PREMIUM_MONTHLY_VND = 50_000_000;\nexport const INVESTOR_PREMIUM_MONTHLY_USD = 2_500;`,
  `export const INVESTOR_PREMIUM_MONTHLY_VND = 26_000_000;\nexport const INVESTOR_PREMIUM_MONTHLY_USD = 1_000;\nexport const INVESTOR_PREMIUM_PRICE_VERSION = 'investor-premium-v2-20260724';`,
);

replaceOnce(
  'src/pages/Pricing.tsx',
  `'Xem Báo cáo Phân tích đầu tư: 50 triệu đ/tháng.',\n          'View Investment Analysis Reports: USD 2,500/month.',`,
  `'Gói Premium: 26.000.000 VNĐ/tháng tại Việt Nam hoặc 1.000 USD/tháng tại quốc gia khác.',\n          'Premium: VND 26,000,000/month in Vietnam or USD 1,000/month in other countries.',`,
);
replaceOnce(
  'src/pages/Pricing.tsx',
  `aVi: 'Nhà đầu tư Tiêu chuẩn được miễn phí. Nhà đầu tư Nâng cao có giá 50.000.000 VNĐ/tháng tại Việt Nam hoặc 2.500 USD/tháng tại các quốc gia khác. Các gói trả phí được tính theo vai trò, quốc gia và kỳ hạn; kỳ hạn dài được giảm 15–20%.',\n      aEn: 'Standard Investors are free. Premium Investors cost VND 50,000,000 per month in Vietnam or USD 2,500 per month in other countries. Paid plans are calculated by role, country and term, with 15–20% discounts for longer terms.',`,
  `aVi: 'Nhà đầu tư Tiêu chuẩn được miễn phí. Nhà đầu tư Nâng cao (Premium) có giá 26.000.000 VNĐ/tháng tại Việt Nam hoặc 1.000 USD/tháng tại các quốc gia khác. Các gói trả phí được tính theo vai trò, quốc gia và kỳ hạn; kỳ hạn dài được giảm 15–20%.',\n      aEn: 'Standard Investors are free. Premium Investors cost VND 26,000,000 per month in Vietnam or USD 1,000 per month in other countries. Paid plans are calculated by role, country and term, with 15–20% discounts for longer terms.',`,
);
replaceOnce(
  'src/pages/Pricing.tsx',
  `b={T(lang, '50 triệu đ/tháng', 'USD 2,500/month')}`,
  `b={premiumUnitPrice + '/' + T(lang, 'tháng', 'month')}`,
);
replaceOnce(
  'src/pages/Pricing.tsx',
  `: T(lang, 'Đăng ký tài khoản', 'Register account')}{' '}`,
  `: role === 'investor' && investorPlan === 'premium'\n                      ? T(lang, 'Đăng ký gói Nâng cao', 'Choose Premium')\n                      : T(lang, 'Đăng ký tài khoản', 'Register account')}{' '}`,
);

replaceOnce(
  'src/pages/Register.tsx',
  `<h3>{T(lang, 'Nhà đầu tư Nâng cao', 'Premium Investor')}</h3>\n            <p>\n              {T(\n                lang,\n                'Được sử dụng tính năng Báo cáo Phân tích cơ hội đầu tư',\n                'Access the Investment Opportunity Analysis Report feature',\n              )}\n            </p>`,
  `<h3>{T(lang, 'Nhà đầu tư Nâng cao (Premium)', 'Premium Investor')}</h3>\n            <p>\n              {T(\n                lang,\n                'Bao gồm toàn bộ quyền Tiêu chuẩn, Báo cáo Phân tích cơ hội đầu tư và các tính năng phân tích nâng cao.',\n                'Includes all Standard benefits, Investment Opportunity Analysis Reports and advanced analytics.',\n              )}\n            </p>`,
);
replaceOnce(
  'src/pages/Register.tsx',
  `: isInvestor\n                  ? T(\n                      lang,\n                      'Tạo tài khoản Nhà đầu tư',\n                      'Create investor account',\n                    )`,
  `: isInvestor\n                  ? investorPremiumSelected\n                    ? T(\n                        lang,\n                        'Đăng ký gói Nhà đầu tư Nâng cao',\n                        'Choose Premium Investor plan',\n                      )\n                    : T(\n                        lang,\n                        'Tạo tài khoản Nhà đầu tư miễn phí',\n                        'Create free Investor account',\n                      )`,
);

replaceOnce(
  'src/components/investor/InvestorBillingPanel.tsx',
  `import {\n  createOwnPaymentOrder,`,
  `import { INVESTOR_PREMIUM_PRICE_VERSION } from '../../lib/investorPlans';\nimport {\n  createOwnPaymentOrder,`,
);
replaceOnce(
  'src/components/investor/InvestorBillingPanel.tsx',
  `orderType: 'investor_service_upgrade',\n       role: 'investor',`,
  `orderType: 'investor_service_upgrade',\n       role: 'investor',\n       investorPlan: 'premium',\n       priceVersion: INVESTOR_PREMIUM_PRICE_VERSION,`,
);
replaceOnce(
  'src/components/investor/InvestorBillingPanel.tsx',
  `` + "`${T(lang, 'Mua/Nâng cấp dịch vụ Nhà đầu tư', 'Buy/Upgrade investor service')}`" + ` +`,
  `` + "`${T(lang, 'Nâng cấp gói Nhà đầu tư Nâng cao', 'Upgrade to Premium Investor')}`" + ` +`,
);
replaceOnce(
  'src/components/investor/InvestorBillingPanel.tsx',
  `{T(lang, 'Mua/Nâng cấp dịch vụ', 'Buy/Upgrade service')}`,
  `{T(lang, 'Nâng cấp gói Premium', 'Upgrade to Premium')}`,
);
replaceOnce(
  'src/components/investor/InvestorBillingPanel.tsx',
  `'Dịch vụ Nhà đầu tư và Thanh toán',\n              'Investor service and payment',`,
  `'Nâng cấp Nhà đầu tư Nâng cao (Premium)',\n              'Upgrade to Premium Investor',`,
);
replaceOnce(
  'src/components/investor/InvestorBillingPanel.tsx',
  `</h3>\n\n           <div className="d68-bizreg-paygrid">`,
  `</h3>\n          <p>\n            {T(\n              lang,\n              \`Đơn giá Premium hiện tại: \${money(price.baseWeekly, price.currency)}/tháng. Kỳ hạn dài được áp dụng chiết khấu theo bảng giá.\`,\n              \`Current Premium rate: \${money(price.baseWeekly, price.currency)}/month. Longer terms receive the published term discount.\`,\n            )}\n          </p>\n\n           <div className="d68-bizreg-paygrid">`,
);
replaceOnce(
  'src/components/investor/InvestorBillingPanel.tsx',
  `<span>{T(lang, 'Tạm tính', 'Estimate')}</span>\n               <div>`,
  `<span>{T(lang, 'Tạm tính', 'Estimate')}</span>\n              <div>\n                <span>{T(lang, 'Đơn giá Premium', 'Premium unit price')}</span>\n                <b>{money(price.baseWeekly, price.currency)} / {T(lang, 'tháng', 'month')}</b>\n              </div>\n               <div>`,
);

replaceOnce(
  'scripts/deals68-investor-plan-entitlements-check.mjs',
  `requireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_VND = 50_000_000');\nrequireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_USD = 2_500');`,
  `requireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_VND = 26_000_000');\nrequireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_USD = 1_000');\nrequireSnippet('plan constants', planSource, "INVESTOR_PREMIUM_PRICE_VERSION = 'investor-premium-v2-20260724'");`,
);

replaceOnce(
  'scripts/deals68-investor-pricing-phase3-check.mjs',
  `"Xem Báo cáo Phân tích đầu tư: 50 triệu đ/tháng.",\n  "View Investment Analysis Reports: USD 2,500/month.",`,
  `"Gói Premium: 26.000.000 VNĐ/tháng tại Việt Nam hoặc 1.000 USD/tháng tại quốc gia khác.",\n  "Premium: VND 26,000,000/month in Vietnam or USD 1,000/month in other countries.",`,
);
replaceOnce(
  'scripts/deals68-investor-pricing-phase3-check.mjs',
  `"50.000.000 VNĐ/tháng",\n  "2.500 USD/tháng",`,
  `"26.000.000 VNĐ/tháng",\n  "1.000 USD/tháng",\n  "Đăng ký gói Nâng cao",\n  "Choose Premium",`,
);

replaceOnce(
  'scripts/deals68-investor-register-plans-phase2-check.mjs',
  `"Được sử dụng tính năng Báo cáo Phân tích cơ hội đầu tư",`,
  `"Bao gồm toàn bộ quyền Tiêu chuẩn, Báo cáo Phân tích cơ hội đầu tư và các tính năng phân tích nâng cao.",\n  "Đăng ký gói Nhà đầu tư Nâng cao",\n  "Tạo tài khoản Nhà đầu tư miễn phí",`,
);

replaceOnce(
  'tests/e2e/01-pricing-valuation.spec.ts',
  `/Xem Báo cáo Phân tích đầu tư: 50 triệu đ\\/tháng\\.|View Investment Analysis Reports: USD 2,500\\/month\\./i,`,
  `/Gói Premium: 26\\.000\\.000 VNĐ\\/tháng.*1\\.000 USD\\/tháng|Premium: VND 26,000,000\\/month.*USD 1,000\\/month/i,`,
);
replaceOnce(
  'tests/e2e/01-pricing-valuation.spec.ts',
  `/50\\.000\\.000 ₫|\\$50,000,000|\\$2,500/i`,
  `/26\\.000\\.000 ₫|\\$1,000/i`,
);
replaceOnce(
  'tests/e2e/01-pricing-valuation.spec.ts',
  `/Đăng ký tài khoản|Register account/i`,
  `/Đăng ký gói Nâng cao|Choose Premium/i`,
);

const priceCheckFile = 'scripts/deals68-investor-premium-price-v2-check.mjs';
write(priceCheckFile, `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');
const migrations = fs.readdirSync('supabase/migrations')
  .filter((name) => name.endsWith('_investor_premium_price_v2.sql'));
if (migrations.length !== 1) failures.push('Exactly one Investor Premium price V2 migration is required.');
const migration = migrations.length ? read(path.join('supabase/migrations', migrations[0])) : '';
const plans = read('src/lib/investorPlans.ts');
const pricing = read('src/lib/pricing.ts');
const pricingPage = read('src/pages/Pricing.tsx');
const register = read('src/pages/Register.tsx');
const billing = read('src/components/investor/InvestorBillingPanel.tsx');
const e2e = read('tests/e2e/01-pricing-valuation.spec.ts');

const requireSnippet = (label, source, snippet) => {
  if (!source.includes(snippet)) failures.push(label + ': missing ' + snippet);
};

[
  'create or replace function public.d68_get_investor_premium_price',
  'then 26000000',
  'else 1000',
  "'price_version', 'investor-premium-v2-20260724'",
  'to anon, authenticated, service_role',
].forEach((snippet) => requireSnippet('migration', migration, snippet));
requireSnippet('constants', plans, 'INVESTOR_PREMIUM_MONTHLY_VND = 26_000_000');
requireSnippet('constants', plans, 'INVESTOR_PREMIUM_MONTHLY_USD = 1_000');
requireSnippet('constants', plans, "INVESTOR_PREMIUM_PRICE_VERSION = 'investor-premium-v2-20260724'");
requireSnippet('pricing core', pricing, 'INVESTOR_PREMIUM_MONTHLY_VND');
requireSnippet('pricing page', pricingPage, '26.000.000 VNĐ/tháng');
requireSnippet('pricing page', pricingPage, '1.000 USD/tháng');
requireSnippet('pricing CTA', pricingPage, 'Đăng ký gói Nâng cao');
requireSnippet('register wording', register, 'Đăng ký gói Nhà đầu tư Nâng cao');
requireSnippet('register wording', register, 'Tạo tài khoản Nhà đầu tư miễn phí');
requireSnippet('dashboard upgrade', billing, "investorPlan: 'premium'");
requireSnippet('dashboard upgrade', billing, 'priceVersion: INVESTOR_PREMIUM_PRICE_VERSION');
requireSnippet('dashboard upgrade', billing, 'Nâng cấp gói Premium');
requireSnippet('dashboard upgrade', billing, 'Đơn giá Premium hiện tại');
requireSnippet('e2e', e2e, '26\\.000\\.000');
requireSnippet('e2e', e2e, '\\$1,000');

for (const [label, source] of [
  ['plans', plans],
  ['pricing page', pricingPage],
  ['register', register],
  ['billing', billing],
  ['e2e', e2e],
]) {
  for (const stale of ['50_000_000', '2_500', '50.000.000 VNĐ/tháng', '2.500 USD/tháng', '50 triệu đ/tháng', 'USD 2,500/month']) {
    if (source.includes(stale)) failures.push(label + ': stale Premium price remains: ' + stale);
  }
}

if (failures.length) {
  console.error('✗ Investor Premium price V2 check failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}
console.log('✓ Investor Premium price V2 contract: PASS');
`);

const pkg = JSON.parse(read('package.json'));
pkg.scripts['qa:investor-premium-price-v2'] = 'node scripts/deals68-investor-premium-price-v2-check.mjs';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

replaceOnce(
  'scripts/deals68-package-checks.mjs',
  `  'scripts/deals68-investor-pricing-phase3-check.mjs',\n  'scripts/deals68-admin-investor-plans-phase4-check.mjs',`,
  `  'scripts/deals68-investor-pricing-phase3-check.mjs',\n  'scripts/deals68-investor-premium-price-v2-check.mjs',\n  'scripts/deals68-admin-investor-plans-phase4-check.mjs',`,
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  '20260724120937_business_dataroom_access_phase_e_stabilization.sql',\n];`,
  `  '20260724120937_business_dataroom_access_phase_e_stabilization.sql',\n  '${migrationName}',\n];`,
);
replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  {\n    name: '20260724120937_business_dataroom_access_phase_e_stabilization.sql',\n    snippets: [\n      'create or replace function public.get_business_file_metadata_for_viewer',\n      'create or replace function public.d68_get_business_dataroom_file_access',\n      "'dataroom' = any(g.scopes)",\n      'access_business_dataroom_file',\n      'files select owner admin or active dataroom grant',\n      'business files select owner admin or active dataroom grant',\n      'Deliberately no INSERT/UPDATE into business_financial_access_grants',\n    ],\n  },\n];`,
  `  {\n    name: '20260724120937_business_dataroom_access_phase_e_stabilization.sql',\n    snippets: [\n      'create or replace function public.get_business_file_metadata_for_viewer',\n      'create or replace function public.d68_get_business_dataroom_file_access',\n      "'dataroom' = any(g.scopes)",\n      'access_business_dataroom_file',\n      'files select owner admin or active dataroom grant',\n      'business files select owner admin or active dataroom grant',\n      'Deliberately no INSERT/UPDATE into business_financial_access_grants',\n    ],\n  },\n  {\n    name: '${migrationName}',\n    snippets: [\n      'create or replace function public.d68_get_investor_premium_price',\n      'then 26000000',\n      'else 1000',\n      "'price_version', 'investor-premium-v2-20260724'",\n      'to anon, authenticated, service_role',\n    ],\n  },\n];`,
);

const migrationStateFile = 'docs/release/MIGRATION_STATE.md';
let migrationState = read(migrationStateFile);
migrationState = migrationState.replace(
  `| 20260724120937 | \`20260724120937_business_dataroom_access_phase_e_stabilization.sql\` — committed, NOT APPLIED; requires explicit approval |`,
  `| 20260724120937 | \`20260724120937_business_dataroom_access_phase_e_stabilization.sql\` — committed, NOT APPLIED; requires explicit approval |\n| ${migrationVersion} | \`${migrationName}\` — committed, NOT APPLIED; canonical Premium price V2 |`,
);
migrationState = migrationState.replace(
  `- \`20260724120937_business_dataroom_access_phase_e_stabilization.sql\` — Phase E additive Dataroom stabilization; committed but NOT APPLIED. It replaces Proposal-based file metadata/Storage reads with an active, unexpired \`dataroom\` scope, adds an audited file-path RPC and creates no grants. Apply only after explicit approval.`,
  `- \`20260724120937_business_dataroom_access_phase_e_stabilization.sql\` — Phase E additive Dataroom stabilization; committed but NOT APPLIED. It replaces Proposal-based file metadata/Storage reads with an active, unexpired \`dataroom\` scope, adds an audited file-path RPC and creates no grants. Apply only after explicit approval.\n- \`${migrationName}\` — Investor Premium price V2; committed but NOT APPLIED. Overrides only the canonical server price RPC to 26,000,000 VND/month in Vietnam and 1,000 USD/month elsewhere. Historical orders and entitlements are unchanged.`,
);
write(migrationStateFile, migrationState);

write('docs/release/INVESTOR_PREMIUM_PRICING_V2_RELEASE.md', `# Deals68 — Investor Premium Pricing V2 Release

Date: 2026-07-24 (Asia/Ho_Chi_Minh)

## Canonical price

- Vietnam: 26,000,000 VND per month.
- Other countries: 1,000 USD per month.
- Standard Investor remains free.
- Existing term discounts and promo-code rules remain unchanged.

## Synchronized surfaces

- Shared frontend constants and pricing calculator.
- Pricing page in Vietnamese and English.
- Investor registration plan selection, totals and CTA wording.
- Investor Dashboard Premium upgrade, totals, payment payload and wording.
- Server-side d68_get_investor_premium_price RPC.
- Static contracts and public pricing E2E expectations.

## Safety boundaries

- No CSS or layout changes.
- No entitlement, Proposal, eNDA, Dataroom or report-access changes.
- No historical payment order is modified.
- The historical Phase 1 migration remains immutable; ${migrationName} is an additive override.
- Migration is committed but NOT APPLIED until release approval and QA complete.

## Release sequence

1. Build and focused Investor pricing/registration/Admin QA.
2. Regression checks for financial access, Business Reports, routes and CSS.
3. Apply Phase E migration, then the Premium price V2 migration.
4. Verify production RPC prices and financial redaction.
5. Merge the verified building release to main.
6. Verify the Netlify deployment generated from the main commit.
`);

console.log(`Applied Investor Premium price V2 patch using ${migrationName}`);
