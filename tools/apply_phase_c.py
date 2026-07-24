from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text()

def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))

component = """import {
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { Lang } from '../../lib/i18n';

export type SensitiveFinancialSource =
  | 'proposal'
  | 'data_request'
  | 'owner'
  | 'admin'
  | string
  | null
  | undefined;

type Props = {
  lang: Lang;
  value?: ReactNode;
  isAuthorized?: boolean;
  hasData?: boolean;
  requestStatus?: string | null;
  source?: SensitiveFinancialSource;
  compact?: boolean;
  className?: string;
};

function text(lang: Lang, vi: string, en: string) {
  return lang === 'en' ? en : vi;
}

function normalizedSource(source: SensitiveFinancialSource) {
  const value = String(source || '').trim().toLowerCase();
  return value === 'data-request' ? 'data_request' : value;
}

export default function SensitiveFinancialValue({
  lang,
  value,
  isAuthorized = false,
  hasData = true,
  requestStatus,
  source,
  compact = false,
  className = '',
}: Props) {
  const tooltipId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasExactValue =
    isAuthorized &&
    value !== null &&
    value !== undefined &&
    String(value).trim() !== '';
  const pending =
    !hasExactValue &&
    ['pending', 'forwarded'].includes(
      String(requestStatus || '').trim().toLowerCase(),
    );
  const restricted = !hasExactValue && hasData;
  const sourceType = normalizedSource(source);

  if (!hasExactValue && !hasData && !pending) {
    return (
      <span className={`d68-sensitive-financial is-empty ${className}`.trim()}>
        {text(lang, 'Đang cập nhật', 'Pending')}
      </span>
    );
  }

  const explanation = pending
    ? text(
        lang,
        'Yêu cầu số liệu đang chờ doanh nghiệp chấp thuận.',
        'Your financial data request is awaiting Business approval.',
      )
    : text(
        lang,
        'Chỉ nhà đầu tư được doanh nghiệp gửi Proposal hoặc được doanh nghiệp chấp thuận yêu cầu dữ liệu mới xem được.',
        'Only investors who receive a Proposal from the Business or whose data request is approved by the Business can view this information.',
      );

  const badge =
    hasExactValue && sourceType === 'proposal'
      ? text(
          lang,
          'Được doanh nghiệp chia sẻ qua Proposal.',
          'Shared by the Business through a Proposal.',
        )
      : hasExactValue && sourceType === 'data_request'
        ? text(
            lang,
            'Doanh nghiệp đã cấp quyền xem số liệu.',
            'The Business has granted access to this information.',
          )
        : '';

  function toggle(event: MouseEvent<HTMLSpanElement>) {
    if (!restricted && !pending) return;
    event.preventDefault();
    event.stopPropagation();
    setMobileOpen((current) => !current);
  }

  function handleKey(event: KeyboardEvent<HTMLSpanElement>) {
    if (!restricted && !pending) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    setMobileOpen((current) => !current);
  }

  return (
    <span
      className={[
        'd68-sensitive-financial',
        compact ? 'is-compact' : '',
        hasExactValue ? 'is-authorized' : pending ? 'is-pending' : 'is-restricted',
        mobileOpen ? 'is-open' : '',
        className,
      ].filter(Boolean).join(' ')}
      tabIndex={restricted || pending ? 0 : undefined}
      aria-label={restricted || pending ? explanation : undefined}
      aria-describedby={restricted || pending ? tooltipId : undefined}
      onClick={toggle}
      onKeyDown={handleKey}
    >
      {hasExactValue ? (
        <span className="d68-sensitive-financial__value">{value}</span>
      ) : (
        <span className="d68-sensitive-financial__placeholder" aria-hidden="true">
          ██████████
        </span>
      )}
      {restricted || pending ? (
        <span className="d68-sensitive-financial__info" aria-hidden="true">i</span>
      ) : null}
      {badge ? <small className="d68-sensitive-financial__badge">✓ {badge}</small> : null}
      {restricted || pending ? (
        <span id={tooltipId} role="tooltip" className="d68-sensitive-financial__tooltip">
          {explanation}
        </span>
      ) : null}
    </span>
  );
}
"""

css = """.d68-sensitive-financial {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  color: inherit;
  line-height: 1.35;
}

.d68-sensitive-financial__value {
  font: inherit;
  color: inherit;
}

.d68-sensitive-financial__placeholder {
  display: inline-flex;
  min-width: 112px;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid #dceaf5;
  border-radius: 7px;
  background: #f7fafc;
  padding: 4px 9px;
  color: #c8d6e3;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.4px;
  user-select: none;
}

.d68-sensitive-financial.is-compact .d68-sensitive-financial__placeholder {
  min-width: 92px;
  min-height: 24px;
  padding: 3px 7px;
  font-size: 9px;
}

.d68-sensitive-financial__info {
  position: absolute;
  top: -6px;
  right: -9px;
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border: 1px solid #b9d9ea;
  border-radius: 999px;
  background: #fff;
  color: #1596cc;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
  line-height: 1;
}

.d68-sensitive-financial__badge {
  display: inline-flex;
  max-width: 280px;
  align-items: flex-start;
  gap: 4px;
  color: #256b45;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
}

.d68-sensitive-financial__tooltip {
  position: absolute;
  z-index: 80;
  left: 0;
  top: calc(100% + 9px);
  display: none;
  width: min(320px, calc(100vw - 40px));
  border: 1px solid #cfe4f0;
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  box-shadow: 0 12px 28px rgba(15, 42, 74, 0.14);
  color: #29445f;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  white-space: normal;
}

.d68-sensitive-financial:hover .d68-sensitive-financial__tooltip,
.d68-sensitive-financial:focus .d68-sensitive-financial__tooltip,
.d68-sensitive-financial:focus-within .d68-sensitive-financial__tooltip,
.d68-sensitive-financial.is-open .d68-sensitive-financial__tooltip {
  display: block;
}

.d68-sensitive-financial:focus {
  outline: 2px solid #1badea;
  outline-offset: 3px;
  border-radius: 8px;
}

.d68-sensitive-financial.is-empty {
  color: #718096;
  font-size: 0.92em;
  font-weight: 500;
}

.d68-register-financial-privacy-note {
  margin: 10px 0 4px;
  border: 1px solid #dceaf5;
  border-radius: 10px;
  background: #f7fafc;
  padding: 12px 14px;
  color: #29445f;
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 700px) {
  .d68-sensitive-financial__tooltip {
    position: fixed;
    z-index: 1200;
    left: 20px;
    right: 20px;
    top: auto;
    bottom: 20px;
    width: auto;
  }
}
"""

qa = """import fs from 'node:fs';

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
expect('mask background #f7fafc', /background:\\s*#f7fafc/i.test(css));
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
  console.error(`\\nPhase C QA failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\\nPhase C QA passed: ${checks.length}/${checks.length}`);
"""

write('src/components/business/SensitiveFinancialValue.tsx', component)
write('src/styles/components/sensitive-financial-value.css', css)
write('scripts/deals68-business-financial-ui-phase-c-check.mjs', qa)

package = json.loads(read('package.json'))
package['scripts']['qa:financial-ui-phase-c'] = 'node scripts/deals68-business-financial-ui-phase-c-check.mjs'
write('package.json', json.dumps(package, ensure_ascii=False, indent=2) + '\n')

replace_once(
    'src/styles/index.css',
    "@import './reference/d68-utilities.css';\n",
    "@import './reference/d68-utilities.css';\n@import './components/sensitive-financial-value.css' layer(d68-components);\n",
)

data_helper = """
function financialAccessMetadata(access: any) {
  const sources = Array.isArray(access?.sources) ? access.sources : [];
  const sourceTypes = sources
    .map((item: any) => String(item?.source_type || '').trim().toLowerCase())
    .filter(Boolean);
  const source = sourceTypes.includes('data_request')
    ? 'data_request'
    : sourceTypes.includes('proposal')
      ? 'proposal'
      : sourceTypes.includes('owner')
        ? 'owner'
        : sourceTypes.includes('admin')
          ? 'admin'
          : sourceTypes[0] || null;
  return {
    financial_access_level: access?.access_level || 'none',
    financial_access_source: source,
    financial_request_status: access?.request_status || null,
    financial_proposal_status: access?.proposal_status || null,
    financial_access_expires_at: access?.expires_at || null,
  };
}

"""
replace_once(
    'src/lib/data.ts',
    "export async function attachAuthorizedBusinessFinancials<T extends Record<string, any>>(\n",
    data_helper + "export async function attachAuthorizedBusinessFinancials<T extends Record<string, any>>(\n",
)

replace_once(
    'src/lib/data.ts',
    """  const byBusinessId = new Map(
    summaries.map((summary) => [String(summary.business_id), summary]),
  );
  return rows.map((row) => {
    const summary = byBusinessId.get(String(row.id));
    if (!summary) return row;
    return {
      ...row,
      ...summary,
      id: row.id,
      financial_summary_authorized: true,
      financials_restricted: false,
    };
  });
""",
    """  const accessRows = await Promise.all(
    summaries.map(async (summary) => {
      const response = await supabase.rpc('d68_get_business_financial_access', {
        p_business_id: summary.business_id,
      });
      if (response.error || !response.data) return null;
      return {
        businessId: String(summary.business_id),
        ...financialAccessMetadata(response.data),
      };
    }),
  );
  const byBusinessId = new Map(
    summaries.map((summary) => [String(summary.business_id), summary]),
  );
  const accessByBusinessId = new Map(
    accessRows
      .filter(Boolean)
      .map((access: any) => [String(access.businessId), access]),
  );
  return rows.map((row) => {
    const summary = byBusinessId.get(String(row.id));
    if (!summary) return row;
    const access = accessByBusinessId.get(String(row.id)) || {};
    return {
      ...row,
      ...summary,
      ...access,
      id: row.id,
      financial_summary_authorized: true,
      financials_restricted: false,
    };
  });
""",
)

replace_once(
    'src/lib/data.ts',
    """  const [row] = await attachAuthorizedBusinessFinancials([
    getPublicBusinessView(data),
  ]);
  return row || null;
""",
    """  let [row] = await attachAuthorizedBusinessFinancials([
    getPublicBusinessView(data),
  ]);
  if (row && !row.financial_access_level) {
    const session = await supabase.auth.getSession().catch(() => null);
    if (session?.data?.session) {
      const access = await supabase.rpc('d68_get_business_financial_access', {
        p_business_id: row.id,
      });
      if (!access.error && access.data) {
        row = {
          ...row,
          ...financialAccessMetadata(access.data),
        };
      }
    }
  }
  return row || null;
""",
)

replace_once(
    'src/pages/Home.tsx',
    "import { HeroBannerSlider, PromotionBanner } from '../components/SiteBanners';\n",
    "import { HeroBannerSlider, PromotionBanner } from '../components/SiteBanners';\nimport SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\n",
)
replace_once('src/pages/Home.tsx', '  revenue: string;\n', '  hasRevenueData: boolean;\n')
replace_once(
    'src/pages/Home.tsx',
    """    revenue:
      b.revenue_2025 === null || b.revenue_2025 === undefined
        ? T(lang, 'Được bảo mật', 'Restricted')
        : formatMoneyForLang(b.revenue_2025, b.revenue_currency || 'VND', lang),
""",
    """    hasRevenueData:
      String(b.revenue_band_key || 'unknown') !== 'unknown' ||
      String(b.revenue_match_band_key || 'unknown') !== 'unknown',
""",
)
replace_once(
    'src/pages/Home.tsx',
    '<strong>{deal.revenue}</strong>',
    """<strong><SensitiveFinancialValue
          lang={lang}
          value={null}
          isAuthorized={false}
          hasData={deal.hasRevenueData}
          compact
        /></strong>""",
)

replace_once(
    'src/pages/Businesses.tsx',
    "import { industryKeyFromLabel } from '../lib/industryTaxonomy';\n",
    "import { industryKeyFromLabel } from '../lib/industryTaxonomy';\nimport SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\n",
)
replace_once(
    'src/pages/Businesses.tsx',
    """  revenueValue: number | null; revenueCurrency: string; askValue: number; askCurrency: string; stakePct: number;
  ebitda: string; financialRestricted: boolean; quality: number | null; featured: boolean;
""",
    """  revenueValue: number | null; revenueCurrency: string; hasRevenueData: boolean;
  askValue: number; askCurrency: string; stakePct: number;
  ebitda: string | null; hasEbitdaData: boolean; financialSource: string | null;
  requestStatus: string | null; quality: number | null; featured: boolean;
""",
)
replace_once(
    'src/pages/Businesses.tsx',
    """    revenueCurrency: b.revenue_currency || 'VND',
    askValue: Number(b.ask_amount || 0),
    askCurrency: b.ask_currency || b.revenue_currency || 'VND',
    stakePct: Number(b.stake_pct || 0),
    ebitda: b.ebitda_margin === null || b.ebitda_margin === undefined ? 'Đang cập nhật' : percent(b.ebitda_margin),
    financialRestricted: Boolean(b.has_financial_data) && b.revenue_2025 === null,
""",
    """    revenueCurrency: b.revenue_currency || 'VND',
    hasRevenueData:
      String(b.revenue_band_key || 'unknown') !== 'unknown' ||
      String(b.revenue_match_band_key || 'unknown') !== 'unknown',
    askValue: Number(b.ask_amount || 0),
    askCurrency: b.ask_currency || b.revenue_currency || 'VND',
    stakePct: Number(b.stake_pct || 0),
    ebitda: b.ebitda_margin === null || b.ebitda_margin === undefined ? null : percent(b.ebitda_margin),
    hasEbitdaData: String(b.ebitda_band_key || 'unknown') !== 'unknown',
    financialSource: b.financial_access_source || null,
    requestStatus: b.financial_request_status || null,
""",
)
replace_once(
    'src/pages/Businesses.tsx',
    """<div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b>{d.revenueValue === null ? T(lang, 'Được bảo mật', 'Restricted') : formatMoneyForLang(d.revenueValue, d.revenueCurrency, lang)}</b></div>
          <div><span>EBITDA</span><b>{d.financialRestricted ? T(lang, 'Được bảo mật', 'Restricted') : d.ebitda === 'Đang cập nhật' ? T(lang, 'Đang cập nhật', 'Pending') : d.ebitda}</b></div>""",
    """<div><span>{T(lang, 'Doanh thu', 'Revenue')}</span><b><SensitiveFinancialValue
            lang={lang}
            value={d.revenueValue === null ? null : formatMoneyForLang(d.revenueValue, d.revenueCurrency, lang)}
            isAuthorized={d.revenueValue !== null}
            hasData={d.hasRevenueData}
            requestStatus={d.requestStatus}
            source={d.financialSource}
            compact
          /></b></div>
          <div><span>EBITDA</span><b><SensitiveFinancialValue
            lang={lang}
            value={d.ebitda}
            isAuthorized={d.ebitda !== null}
            hasData={d.hasEbitdaData}
            requestStatus={d.requestStatus}
            source={d.financialSource}
            compact
          /></b></div>""",
)

replace_once(
    'src/pages/BusinessDetail.tsx',
    "import { businessQualityPublicExplanation, normalizeQualityBreakdown, qualityBand, qualityItemLabel, qualityItemNote, qualityPublicCriteria } from '../lib/businessQuality';\n",
    "import { businessQualityPublicExplanation, normalizeQualityBreakdown, qualityBand, qualityItemLabel, qualityItemNote, qualityPublicCriteria } from '../lib/businessQuality';\nimport SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\n",
)
replace_once(
    'src/pages/BusinessDetail.tsx',
    "type SimilarDeal = { id: string; slug: string; title: string; industry: string; city: string; revenue: string; ask: string; image: string | null };\ntype FactRow = { label: string; value: string };",
    "type SimilarDeal = { id: string; slug: string; title: string; industry: string; city: string; revenue: ReactNode; ask: string; image: string | null };\ntype FactRow = { label: string; value: ReactNode };",
)
replace_once(
    'src/pages/BusinessDetail.tsx',
    "function restrictedFinancialText(lang: Lang) { return T(lang, 'Được bảo mật', 'Restricted'); }\n",
    "",
)
replace_once(
    'src/pages/BusinessDetail.tsx',
    "  return { id: String(row.id || slug), slug, title, industry: labelIndustry(primaryIndustry(row.industry), lang), city: labelLocation(row.city_key || row.city || row.country_iso2, lang), revenue: row.revenue_2025 === null || row.revenue_2025 === undefined ? restrictedFinancialText(lang) : money(lang, row.revenue_2025, row.revenue_currency || 'VND'), ask: money(lang, row.ask_amount, row.ask_currency || row.revenue_currency || 'VND'), image: row.image_url || row.hero_image_url || null };",
    """  return { id: String(row.id || slug), slug, title, industry: labelIndustry(primaryIndustry(row.industry), lang), city: labelLocation(row.city_key || row.city || row.country_iso2, lang), revenue: (
    <SensitiveFinancialValue
      lang={lang}
      value={row.revenue_2025 === null || row.revenue_2025 === undefined ? null : money(lang, row.revenue_2025, row.revenue_currency || 'VND')}
      isAuthorized={row.revenue_2025 !== null && row.revenue_2025 !== undefined}
      hasData={String(row.revenue_band_key || 'unknown') !== 'unknown' || String(row.revenue_match_band_key || 'unknown') !== 'unknown'}
      requestStatus={row.financial_request_status}
      source={row.financial_access_source}
      compact
    />
  ), ask: money(lang, row.ask_amount, row.ask_currency || row.revenue_currency || 'VND'), image: row.image_url || row.hero_image_url || null };""",
)
replace_once(
    'src/pages/BusinessDetail.tsx',
    """  const revenue = business
    ? business.revenue_2025 === null || business.revenue_2025 === undefined
      ? restrictedFinancialText(lang)
      : money(lang, business.revenue_2025, business.revenue_currency || 'VND')
    : '';
""",
    """  const revenue = business ? <SensitiveFinancialValue
    lang={lang}
    value={business.revenue_2025 === null || business.revenue_2025 === undefined ? null : money(lang, business.revenue_2025, business.revenue_currency || 'VND')}
    isAuthorized={business.revenue_2025 !== null && business.revenue_2025 !== undefined}
    hasData={String(business.revenue_band_key || 'unknown') !== 'unknown' || String(business.revenue_match_band_key || 'unknown') !== 'unknown'}
    requestStatus={business.financial_request_status}
    source={business.financial_access_source}
  /> : null;
""",
)
replace_once(
    'src/pages/BusinessDetail.tsx',
    "    { label: T(lang, 'Tỷ suất lợi nhuận/EBITDA', 'EBITDA margin'), value: business.ebitda_margin === null || business.ebitda_margin === undefined ? (business.has_financial_data ? restrictedFinancialText(lang) : T(lang, 'Đang cập nhật', 'Pending')) : percent(business.ebitda_margin) },",
    """    { label: T(lang, 'Tỷ suất lợi nhuận/EBITDA', 'EBITDA margin'), value: <SensitiveFinancialValue
      lang={lang}
      value={business.ebitda_margin === null || business.ebitda_margin === undefined ? null : percent(business.ebitda_margin)}
      isAuthorized={business.ebitda_margin !== null && business.ebitda_margin !== undefined}
      hasData={String(business.ebitda_band_key || 'unknown') !== 'unknown'}
      requestStatus={business.financial_request_status}
      source={business.financial_access_source}
    /> },""",
)

replace_once(
    'src/pages/InvestorDashboard.tsx',
    "import BusinessTitleLink from '../components/investor/BusinessTitleLink';\n",
    "import BusinessTitleLink from '../components/investor/BusinessTitleLink';\nimport SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\n",
)
replace_once(
    'src/pages/InvestorDashboard.tsx',
    """function investorRevenueText(business: any, lang: Lang) {
  return business?.revenue_2025 === null || business?.revenue_2025 === undefined
    ? T(lang, 'Được bảo mật', 'Restricted')
    : formatCompactMoney(business.revenue_2025, business.revenue_currency);
}
""",
    """function investorRevenueText(business: any, lang: Lang) {
  const hasValue =
    business?.revenue_2025 !== null &&
    business?.revenue_2025 !== undefined;
  return <SensitiveFinancialValue
    lang={lang}
    value={hasValue ? formatCompactMoney(business.revenue_2025, business.revenue_currency) : null}
    isAuthorized={hasValue}
    hasData={String(business?.revenue_band_key || 'unknown') !== 'unknown' || String(business?.revenue_match_band_key || 'unknown') !== 'unknown'}
    requestStatus={business?.financial_request_status}
    source={business?.financial_access_source}
    compact
  />;
}
""",
)

register_anchor = """                  <Field label={T(lang, 'Tỷ lệ cổ phần (%)', 'Stake (%)')}>
                    <input
                      inputMode="decimal"
                      value={stake}
                      onChange={(event) =>
                        setStake(formatNumberTyping(event.target.value, true))
                      }
                    />
                  </Field>
                </div>
"""
register_note = register_anchor + """                <p className="d68-register-financial-privacy-note" role="note">
                  {T(
                    lang,
                    'Các số liệu tài chính chính xác chỉ được chia sẻ với nhà đầu tư khi doanh nghiệp gửi Proposal hoặc chấp thuận yêu cầu dữ liệu. Người xem công khai và nhà đầu tư chưa được cấp quyền chỉ thấy trạng thái bảo mật hoặc khoảng dữ liệu tổng quát.',
                    'Exact financial figures are shared only when the Business sends a Proposal to an investor or approves the investor’s data request. Public visitors and investors without access see only restricted states or general data ranges.',
                  )}
                </p>
"""
replace_once('src/pages/Register.tsx', register_anchor, register_note)

print('Phase C source patch applied.')
