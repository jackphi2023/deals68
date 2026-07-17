import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
} from 'lucide-react';
import {
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getInvestorByOwner,
  listBusinessFacets,
  listBusinesses,
} from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { langFromPath, toLocalizedPath } from '../lib/i18nRoutes';
import type { Lang } from '../lib/i18n';
import {
  T,
  countryOptions,
} from '../lib/labels';
import {
  industryKeyFromLabel,
  industryOptions,
  labelIndustryTaxonomy,
} from '../lib/industryTaxonomy';
import {
  formatInitialNumber,
  formatNumberTyping,
  parseFormattedNumber,
} from '../lib/numberFormat';
import { computeFitScore } from '../lib/scoring';
import {
  proposalStatusLabel,
  updateProposalStatus,
  type ProposalStatus,
} from '../lib/proposals';
import { supabase } from '../lib/supabase';
import {
  InvestorDealTypeTagPicker,
  IndustryTagPicker,
  normalizeIndustryKeys,
} from '../components/investor/IndustryTagPicker';
import {
  InvestorMarketTagPicker,
  InvestorStageTagPicker,
  InvestorTypeTagPicker,
} from '../components/investor/InvestorCriteriaTagPickers';
import {
  approvedInvestorCountries,
  approvedInvestorDealTypes,
  approvedInvestorSectors,
  approvedInvestorStages,
  approvedInvestorTypes,
  normalizeInvestorCountries,
  normalizeInvestorDealTypes,
  normalizeInvestorStages,
  normalizeInvestorTypes,
} from '../lib/investorCriteria';
import InvestorBillingPanel from '../components/investor/InvestorBillingPanel';
import BusinessTitleLink from '../components/investor/BusinessTitleLink';

type Tab =
  | 'profile'
  | 'recommended'
  | 'watchlist'
  | 'proposals'
  | 'contacts'
  | 'billing';

type NoticeType = 'ok' | 'warn' | 'err';

const tabDefinitions: {
  id: Tab;
  Icon: typeof LayoutDashboard;
  vi: string;
  en: string;
  href: string;
}[] = [
  {
    id: 'profile',
    Icon: BriefcaseBusiness,
    vi: 'Hồ sơ',
    en: 'Profile',
    href: '/dashboard/investor/profile',
  },
  {
    id: 'recommended',
    Icon: LayoutDashboard,
    vi: 'Tiêu chí & Gợi ý',
    en: 'Criteria & Matches',
    href: '/dashboard/investor/matches',
  },
  {
    id: 'watchlist',
    Icon: FileText,
    vi: 'Đã lưu',
    en: 'Saved',
    href: '/dashboard/investor/saved',
  },
  {
    id: 'proposals',
    Icon: BarChart3,
    vi: 'Proposal',
    en: 'Proposals',
    href: '/dashboard/investor/proposals',
  },
  {
    id: 'contacts',
    Icon: Inbox,
    vi: 'Liên hệ & Bảo mật',
    en: 'Contact & Privacy',
    href: '/dashboard/investor/contact',
  },
  {
    id: 'billing',
    Icon: CreditCard,
    vi: 'Invoice/Thanh toán',
    en: 'Invoices/Payments',
    href: '/dashboard/investor/payments',
  },
];

const tabAliases: Record<string, Tab> = {
  '': 'profile',
  profile: 'profile',
  criteria: 'recommended',
  matches: 'recommended',
  recommended: 'recommended',
  watchlist: 'watchlist',
  saved: 'watchlist',
  proposals: 'proposals',
  contact: 'contacts',
  contacts: 'contacts',
  privacy: 'contacts',
  payments: 'billing',
  invoices: 'billing',
  billing: 'billing',
};

const riskOptions = [
  { value: 'conservative', vi: 'Thận trọng', en: 'Conservative' },
  { value: 'balanced', vi: 'Cân bằng', en: 'Balanced' },
  { value: 'aggressive', vi: 'Ưu tiên tăng trưởng', en: 'Growth-oriented' },
];

const revenueBandOptions = [
  { value: '', vi: 'Bất kỳ', en: 'Any' },
  { value: 'under_1m', vi: 'Dưới 1 triệu USD', en: 'Under USD 1 million' },
  { value: '1_10m', vi: '1 - 10 triệu USD', en: 'USD 1–10 million' },
  { value: '10_100m', vi: '10 - 100 triệu USD', en: 'USD 10–100 million' },
  { value: 'over_100m', vi: 'Trên 100 triệu USD', en: 'Over USD 100 million' },
];

const ebitdaBandOptions = [
  { value: '', vi: 'Bất kỳ', en: 'Any' },
  { value: '0_10', vi: 'Dưới 10%', en: 'Under 10%' },
  { value: '10_20', vi: '10% - 20%', en: '10%–20%' },
  { value: 'over_20', vi: 'Trên 20%', en: 'Over 20%' },
];

function resolveTab(pathname: string): Tab {
  const suffix = pathname
    .replace(/^\/en/, '')
    .replace('/dashboard/investor', '')
    .replace(/^\//, '')
    .split('/')[0];
  return tabAliases[suffix] || 'profile';
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function pendingProfile(investor: any) {
  const pending = investor?.privacy?.pending_profile_changes;
  return pending && typeof pending === 'object' && !Array.isArray(pending)
    ? pending
    : {};
}

function countryEnglishName(iso2: string) {
  return countryOptions.find((item) => item.iso2 === iso2)?.en || iso2;
}

function regionForCountry(iso2: string) {
  if (['US', 'CA', 'BR'].includes(iso2)) return 'americas';
  if (['DE', 'GB', 'CZ'].includes(iso2)) return 'europe';
  if (['AU'].includes(iso2)) return 'oceania';
  if (['AE'].includes(iso2)) return 'mideast';
  return 'asia';
}

function revenueUsd(business: any) {
  const value = Number(business?.revenue_2025 || 0);
  const currency = String(business?.revenue_currency || 'VND').toUpperCase();
  return currency === 'USD' ? value : value / 26_000;
}

function matchesRevenueBand(business: any, band: string) {
  if (!band) return true;
  const value = revenueUsd(business);
  if (band === 'under_1m') return value < 1_000_000;
  if (band === '1_10m') return value >= 1_000_000 && value < 10_000_000;
  if (band === '10_100m') return value >= 10_000_000 && value < 100_000_000;
  if (band === 'over_100m') return value >= 100_000_000;
  return true;
}

function matchesEbitdaBand(business: any, band: string) {
  if (!band) return true;
  const margin = Number(business?.ebitda_margin || 0);
  if (band === '0_10') return margin < 10;
  if (band === '10_20') return margin >= 10 && margin <= 20;
  if (band === 'over_20') return margin > 20;
  return true;
}

function statusText(lang: Lang, status: unknown) {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'approved') return T(lang, 'Đã duyệt', 'Approved');
  if (value === 'connected') return T(lang, 'Đã kết nối', 'Connected');
  if (value === 'rejected' || value === 'declined') {
    return T(lang, 'Không duyệt', 'Declined');
  }
  return T(lang, 'Chờ duyệt', 'Pending');
}

function FormattedNumberInput({
  name,
  value,
  placeholder,
}: {
  name: string;
  value: unknown;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(() => formatInitialNumber(value));

  useEffect(() => {
    setDisplay(formatInitialNumber(value));
  }, [value]);

  return (
    <input
      name={name}
      className="d68-dashboard-input"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(event) => setDisplay(formatNumberTyping(event.target.value))}
    />
  );
}

function MatchCard({
  business,
  investor,
  lang,
  onInterest,
  onRequest,
}: {
  business: any;
  investor: any;
  lang: Lang;
  onInterest: (business: any) => void;
  onRequest: (business: any) => void;
}) {
  const score = computeFitScore(business, investor);
  const title =
    lang === 'en'
      ? business.title_en || business.title_vi || business.public_code
      : business.title_vi || business.title_en || business.public_code;
  const image = business.hero_image_url || business.image_url;

  return (
    <article className="d68-match-card">
      <div className="d68-match-card__media">
        {image ? <img src={image} alt={title || ''} /> : null}
        <span>{score}% {T(lang, 'phù hợp', 'fit')}</span>
      </div>
      <div className="d68-match-card__body">
        <small>
          {labelIndustryTaxonomy(
            business.industry_key || business.industry,
            lang,
          )}
        </small>
        <h3>
          <BusinessTitleLink business={business} lang={lang}>
            {title}
          </BusinessTitleLink>
        </h3>
        <div className="d68-match-card__metrics">
          <div>
            <small>{T(lang, 'Doanh thu', 'Revenue')}</small>
            <b>{formatCompactMoney(business.revenue_2025, business.revenue_currency)}</b>
          </div>
          <div>
            <small>{T(lang, 'Nhu cầu', 'Ask')}</small>
            <b>
              {formatCompactMoney(
                business.ask_amount,
                business.ask_currency || business.revenue_currency,
              )}
            </b>
          </div>
        </div>
        <div className="d68-investor-card-actions">
          <Link
            className="d68-dashboard-btn light"
            to={toLocalizedPath(`/businesses/${business.slug}`, lang)}
          >
            {T(lang, 'Xem doanh nghiệp', 'View business')}
          </Link>
          <button
            type="button"
            className="d68-dashboard-btn gold"
            onClick={() => onInterest(business)}
          >
            {T(lang, 'Bày tỏ quan tâm', 'Express interest')}
          </button>
          <button
            type="button"
            className="d68-dashboard-btn blue"
            onClick={() => onRequest(business)}
          >
            {T(lang, 'Yêu cầu dữ liệu', 'Request data')}
          </button>
        </div>
      </div>
    </article>
  );
}

function InterestRows({ lang, rows }: { lang: Lang; rows: any[] }) {
  if (!rows.length) {
    return (
      <div className="d68-dashboard-empty">
        {T(
          lang,
          'Chưa có doanh nghiệp nào bạn đã bày tỏ quan tâm.',
          'You have not expressed interest in any business yet.',
        )}
      </div>
    );
  }

  return (
    <div className="d68-investor-interest-list">
      {rows.map((row) => {
        const business = row.businesses || {};
        const title =
          lang === 'en'
            ? business.title_en || business.title_vi || business.public_code
            : business.title_vi || business.title_en || business.public_code;
        const image = business.hero_image_url || business.image_url;
        return (
          <article key={row.id} className="d68-investor-interest-row">
            <div className="d68-investor-interest-row__media">
              {image ? <img src={image} alt={title || ''} /> : <span>🏢</span>}
            </div>
            <div className="d68-investor-interest-row__body">
              <div>
                <span>
                  {labelIndustryTaxonomy(
                    business.industry_key || business.industry,
                    lang,
                  )}
                </span>
                <h3>
                  <BusinessTitleLink business={business} lang={lang}>
                    {title}
                  </BusinessTitleLink>
                </h3>
                <small>
                  {business.city || '—'} ·{' '}
                  {new Date(row.created_at).toLocaleDateString(
                    lang === 'vi' ? 'vi-VN' : 'en-US',
                  )}
                </small>
              </div>
              <div className="d68-investor-interest-row__metrics">
                <div>
                  <small>{T(lang, 'Doanh thu', 'Revenue')}</small>
                  <b>{formatCompactMoney(business.revenue_2025, business.revenue_currency)}</b>
                </div>
                <div>
                  <small>{T(lang, 'Nhu cầu', 'Ask')}</small>
                  <b>
                    {formatCompactMoney(
                      business.ask_amount,
                      business.ask_currency || business.revenue_currency,
                    )}
                  </b>
                </div>
                <div>
                  <small>{T(lang, 'Trạng thái', 'Status')}</small>
                  <b>{statusText(lang, row.status)}</b>
                </div>
              </div>
            </div>
            {business.slug ? (
              <Link
                className="d68-dashboard-btn light"
                to={toLocalizedPath(`/businesses/${business.slug}`, lang)}
              >
                {T(lang, 'Xem chi tiết', 'View details')}
              </Link>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ProposalRows({ lang, proposals, onMark, onRequestData }: any) {
  const newCount = proposals.filter((proposal: any) => proposal.status === 'sent').length;
  const approved = proposals.filter((proposal: any) =>
    ['approved', 'connected'].includes(proposal.status),
  ).length;
  const declined = proposals.filter((proposal: any) => proposal.status === 'declined').length;

  return (
    <div className="d68-dashboard-card">
      <h2>{T(lang, 'Proposal đã nhận', 'Received proposals')}</h2>
      <div className="d68-dashboard-grid4" style={{ margin: '14px 0' }}>
        <div className="d68-proposal-metric"><b>{newCount}</b><span>{T(lang, 'Proposal mới', 'New')}</span></div>
        <div className="d68-proposal-metric"><b>{approved}</b><span>{T(lang, 'Đã duyệt', 'Approved')}</span></div>
        <div className="d68-proposal-metric"><b>{declined}</b><span>{T(lang, 'Bỏ qua', 'Declined')}</span></div>
        <div className="d68-proposal-metric"><b>{proposals.length}</b><span>{T(lang, 'Tổng', 'Total')}</span></div>
      </div>

      {proposals.length ? proposals.map((row: any) => {
        const business = row.businesses || {};
        const status = proposalStatusLabel(row.status, lang);
        return (
          <div key={row.id} className="d68-dashboard-row d68-proposal-row">
            <div style={{ flex: 1 }}>
              <b>
                <BusinessTitleLink business={business} lang={lang}>
                  {business.title_vi || business.title_en || business.public_code || row.business_id}
                </BusinessTitleLink>
              </b>
              <div className="d68-dashboard-mini">
                {new Date(row.sent_at || row.created_at).toLocaleString(
                  lang === 'vi' ? 'vi-VN' : 'en-US',
                )}{' '}· {business.city || '—'} ·{' '}
                {labelIndustryTaxonomy(
                  business.industry_key || business.industry,
                  lang,
                )}
              </div>
              <p>
                {T(lang, 'Nhu cầu vốn/giá chào', 'Ask')}: <b>
                  {formatCompactMoney(
                    business.ask_amount,
                    business.ask_currency || business.revenue_currency,
                  )}
                </b>{' '}· <span className={`d68-dashboard-badge ${status.cls}`}>{status.label}</span>
              </p>
              {business.slug ? (
                <Link
                  to={toLocalizedPath(`/businesses/${business.slug}`, lang)}
                  className="d68-dashboard-btn light"
                >
                  {T(lang, 'Xem hồ sơ doanh nghiệp', 'View business profile')}
                </Link>
              ) : null}
            </div>
            <div className="d68-dashboard-actions">
              <button type="button" onClick={() => onMark(row, 'approved')} className="d68-dashboard-btn green">
                {T(lang, 'Duyệt', 'Approve')}
              </button>
              <button type="button" onClick={() => onMark(row, 'declined')} className="d68-dashboard-btn red">
                {T(lang, 'Bỏ qua', 'Decline')}
              </button>
              <button type="button" onClick={() => onRequestData(row)} className="d68-dashboard-btn gold">
                {T(lang, 'Yêu cầu tài liệu', 'Request data')}
              </button>
            </div>
          </div>
        );
      }) : (
        <div className="d68-dashboard-empty">
          {T(lang, 'Chưa có proposal nào gửi tới bạn.', 'No received proposals yet.')}
        </div>
      )}
    </div>
  );
}

export default function InvestorDashboard() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const lang = langFromPath(location.pathname);
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [investor, setInvestor] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [facets, setFacets] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [filterIndustries, setFilterIndustries] = useState<string[]>([]);
  const [revenueBand, setRevenueBand] = useState('');
  const [ebitdaBand, setEbitdaBand] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('ok');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setTab(resolveTab(location.pathname));
  }, [location.pathname]);

  async function load() {
    if (!profile) return;
    setBusy(true);
    try {
      const currentInvestor = await getInvestorByOwner(profile.id);
      if (!currentInvestor) {
        setInvestor(null);
        return;
      }

      const [nextBusinesses, nextFacets, relationResult, paymentResult] = await Promise.all([
        listBusinesses({ limit: 120, sort: 'featured' }),
        listBusinessFacets(),
        supabase.rpc('get_my_investor_dashboard_relations', {
          investor_uuid: currentInvestor.id,
        }),
        supabase
          .from('payment_orders')
          .select('*')
          .or(
            `investor_id.eq.${currentInvestor.id},` +
              `profile_id.eq.${profile.id},created_by.eq.${profile.id}`,
          )
          .order('created_at', { ascending: false }),
      ]);

      if (relationResult.error || paymentResult.error) {
        throw relationResult.error || paymentResult.error;
      }

      const selectedKeys = approvedInvestorSectors(currentInvestor);
      const availableKeys = unique(
        nextFacets
          .map((item) => industryKeyFromLabel(item.industry_key || item.industry))
          .filter(Boolean),
      );

      setInvestor(currentInvestor);
      setBusinesses(nextBusinesses);
      setFacets(nextFacets);
      const relations = asObject(relationResult.data);
      setInterests(Array.isArray(relations.interests) ? relations.interests : []);
      setProposals(Array.isArray(relations.proposals) ? relations.proposals : []);
      setPayments(paymentResult.data || []);
      setFilterIndustries(selectedKeys.filter((key) => availableKeys.includes(key)));
    } catch {
      setNoticeType('err');
      setNotice(T(lang, 'Có lỗi', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile?.id]);

  const investorIndustries = useMemo(
    () => approvedInvestorSectors(investor),
    [investor],
  );
  const businessIndustryKeys = useMemo(
    () => unique(
      facets
        .map((item) => industryKeyFromLabel(item.industry_key || item.industry))
        .filter(Boolean),
    ),
    [facets],
  );
  const criteriaIndustries = useMemo(
    () => investorIndustries.filter((key) => businessIndustryKeys.includes(key)),
    [investorIndustries, businessIndustryKeys],
  );
  const recommended = useMemo(() => {
    if (!investor) return [];
    return businesses
      .filter((business) => {
        const key = industryKeyFromLabel(business.industry_key || business.industry);
        return (
          (!filterIndustries.length || filterIndustries.includes(key)) &&
          matchesRevenueBand(business, revenueBand) &&
          matchesEbitdaBand(business, ebitdaBand)
        );
      })
      .map((business) => ({ ...business, fit: computeFitScore(business, investor) }))
      .sort((left, right) => right.fit - left.fit)
      .slice(0, 24);
  }, [businesses, investor, filterIndustries, revenueBand, ebitdaBand]);

  const pending = pendingProfile(investor);
  const pendingCriteria = asObject(pending.criteria);
  const hasPending = Object.keys(pending).length > 0;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!investor) return;
    const form = new FormData(event.currentTarget);
    const industries = normalizeIndustryKeys(asArray(form.get('industries')));
    const dealTypes = normalizeInvestorDealTypes(asArray(form.get('deal_types')));
    const investorTypes = normalizeInvestorTypes(asArray(form.get('investor_types')));
    const stages = normalizeInvestorStages(asArray(form.get('stages')));
    const targetCountries = normalizeInvestorCountries(asArray(form.get('target_countries')));
    const iso2 = String(form.get('country_iso2') || 'VN').toUpperCase();
    const returnExpectationRaw = String(
      form.get('returnExpectation') || '',
    ).trim();
    const returnExpectation = returnExpectationRaw
      ? Number(returnExpectationRaw)
      : null;
    const selectedRevenueBand = String(form.get('revenueBand') || '');

    if (!investorTypes.length || !stages.length || !industries.length || !dealTypes.length || !targetCountries.length) {
      setNoticeType('err');
      setNotice(
        T(
          lang,
          'Vui lòng chọn đầy đủ loại hình, giai đoạn, ngành, loại giao dịch và thị trường quan tâm.',
          'Select at least one investor type, stage, industry, deal type and target market.',
        ),
      );
      return;
    }

    const profilePatch = {
      private_name: String(form.get('private_name') || '').trim(),
      private_website: String(form.get('private_website') || '').trim(),
      investor_types: investorTypes,
      type: investorTypes[0],
      stages,
      stage: stages[0],
      country_iso2: iso2,
      country: countryEnglishName(iso2),
      region: regionForCountry(iso2),
      industries,
      deal_types: dealTypes,
      target_countries: targetCountries,
      ticket_min: parseFormattedNumber(form.get('ticket_min')),
      ticket_max: parseFormattedNumber(form.get('ticket_max')),
      criteria: {
        investorTypes,
        stages,
        sectors: industries,
        dealTypes,
        targetCountries,
        preferredCountries: targetCountries,
        targetCountriesCache: targetCountries,
        investment_appetite_vi: String(form.get('investment_appetite_vi') || '').trim(),
        investment_appetite_en: String(form.get('investment_appetite_en') || '').trim(),
        riskAppetite: String(form.get('riskAppetite') || ''),
        returnExpectation:
          returnExpectation !== null &&
          Number.isFinite(returnExpectation) &&
          returnExpectation >= 0
            ? returnExpectation
            : null,
        revenueRange: selectedRevenueBand,
        revenueBand: selectedRevenueBand,
      },
    };

    const descriptionPatch = {
      desc_vi: String(form.get('desc_vi') || '').trim(),
      desc_en: String(form.get('desc_en') || '').trim(),
    };

    const { data, error } = await supabase.rpc('update_my_investor_profile', {
      profile_patch: profilePatch,
      description_patch: descriptionPatch,
    });

    if (error) {
      setNoticeType('err');
      setNotice(error.message || T(lang, 'Có lỗi', 'Something went wrong'));
      return;
    }

    const requiresReview = Boolean(
      data?.profile_pending || data?.criteria_pending || data?.description_pending,
    );
    setNoticeType(requiresReview ? 'warn' : 'ok');
    setNotice(
      requiresReview
        ? T(
            lang,
            'Thay đổi đã được gửi và đang chờ quản trị Deals68 duyệt trước khi hiển thị công khai.',
            'Your changes were submitted and are awaiting Deals68 administrator approval before public display.',
          )
        : T(lang, 'Cập nhật Hồ sơ thành công', 'Profile updated successfully'),
    );
    await load();
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.rpc('update_my_investor_contact', {
      contact_patch: {
        email: String(form.get('email') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        website: String(form.get('website') || '').trim(),
        shareEmail: form.get('shareEmail') === 'on',
        sharePhone: form.get('sharePhone') === 'on',
        shareWebsite: form.get('shareWebsite') === 'on',
      },
    });
    if (error) {
      setNoticeType('err');
      setNotice(T(lang, 'Có lỗi', 'Something went wrong'));
      return;
    }
    setNoticeType('ok');
    setNotice(T(lang, 'Cập nhật thông tin liên hệ thành công', 'Contact details updated successfully'));
    await load();
  }

  async function expressInterest(business: any) {
    if (!investor?.id || !business?.id) return;
    const { error } = await supabase.rpc('express_investor_interest', {
      investor_uuid: investor.id,
      business_uuid: business.id,
      interest_note: 'Expressed from Investor Dashboard.',
    });
    if (error) {
      setNoticeType('err');
      setNotice(T(lang, 'Có lỗi', 'Something went wrong'));
      return;
    }
    setNoticeType('ok');
    setNotice(T(lang, 'Đã ghi nhận quan tâm.', 'Interest recorded.'));
    await load();
  }

  async function requestData(business: any): Promise<boolean> {
    if (!investor?.id || !business?.id) return false;
    const { error } = await supabase.from('request_data').insert({
      investor_id: investor.id,
      business_id: business.id,
      requested_items: ['IM', 'Financials'],
      note: 'Investor requested data from Investor Dashboard.',
      status: 'pending',
    });
    if (error) {
      setNoticeType('err');
      setNotice(T(lang, 'Có lỗi', 'Something went wrong'));
      return false;
    }
    setNoticeType('ok');
    setNotice(T(lang, 'Đã gửi yêu cầu dữ liệu.', 'Data request sent.'));
    return true;
  }

  async function markProposal(row: any, status: ProposalStatus) {
    try {
      await updateProposalStatus(row.id, status);
      setNoticeType('ok');
      setNotice(T(lang, 'Đã cập nhật Proposal.', 'Proposal updated.'));
      await load();
    } catch {
      setNoticeType('err');
      setNotice(T(lang, 'Có lỗi', 'Something went wrong'));
    }
  }

  async function requestProposalData(row: any) {
    const business = row.businesses || {};
    try {
      const requested = await requestData({ id: row.business_id || business.id });
      if (!requested) return;
      await updateProposalStatus(row.id, 'request_data');
      await load();
    } catch {
      setNoticeType('err');
      setNotice(T(lang, 'Có lỗi', 'Something went wrong'));
    }
  }

  if (loading || (busy && !investor)) {
    return (
      <main className="d68-dashboard-page">
        <div className="d68-dashboard-wrap">{T(lang, 'Đang tải…', 'Loading…')}</div>
      </main>
    );
  }

  if (!profile) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  if (!investor) {
    return (
      <main className="d68-dashboard-page">
        <div className="d68-dashboard-wrap">
          <div className="d68-dashboard-card">
            <h1>{T(lang, 'Không tìm thấy hồ sơ Nhà đầu tư', 'Investor profile not found')}</h1>
          </div>
        </div>
      </main>
    );
  }

  const criteria = asObject(investor.criteria);
  const privacy = asObject(investor.privacy);
  const formKey = `${investor.id}:${investor.updated_at || ''}:${privacy.pending_submitted_at || ''}`;
  const privateInvestorName = String(
    investor.private_name ||
      privacy.private_name ||
      profile.display_name ||
      profile.email?.split('@')[0] ||
      investor.title_vi ||
      investor.title_en ||
      T(lang, 'Nhà đầu tư', 'Investor'),
  ).trim();
  const publicInvestorPath = investor.code
    ? toLocalizedPath(`/investors/${investor.code}`, lang)
    : '';

  const formInvestorTypes = normalizeInvestorTypes(
    pendingCriteria.investorTypes || pending.investor_types || approvedInvestorTypes(investor),
  );
  const formStages = normalizeInvestorStages(
    pendingCriteria.stages || pending.stages || approvedInvestorStages(investor),
  );
  const formIndustries = normalizeIndustryKeys(
    pending.industries || pendingCriteria.sectors || approvedInvestorSectors(investor),
  );
  const formDealTypes = normalizeInvestorDealTypes(
    pending.deal_types || pendingCriteria.dealTypes || approvedInvestorDealTypes(investor),
  );
  const formTargetCountries = normalizeInvestorCountries(
    pendingCriteria.targetCountries || approvedInvestorCountries(investor),
  );
  const formCountryIso2 = String(pending.country_iso2 || investor.country_iso2 || 'VN');
  const formTicketMin = pending.ticket_min ?? investor.ticket_min;
  const formTicketMax = pending.ticket_max ?? investor.ticket_max;
  const formDescVi = pending.desc_vi ?? investor.desc_vi ?? '';
  const formDescEn = pending.desc_en ?? investor.desc_en ?? '';
  const formAppetiteVi =
    pendingCriteria.investment_appetite_vi ??
    criteria.investment_appetite_vi ??
    criteria.investmentAppetiteVi ??
    '';
  const formAppetiteEn =
    pendingCriteria.investment_appetite_en ??
    criteria.investment_appetite_en ??
    criteria.investmentAppetiteEn ??
    '';
  const formRiskAppetite =
    pendingCriteria.riskAppetite ?? criteria.riskAppetite ?? '';
  const formReturnExpectation = Object.prototype.hasOwnProperty.call(
    pendingCriteria,
    'returnExpectation',
  )
    ? pendingCriteria.returnExpectation ?? ''
    : criteria.returnExpectation ?? '';

  return (
    <main className="d68-dashboard-page d68-investor-dashboard-page">
      <div className="d68-dashboard-wrap">
        <header className="d68-dashboard-head">
          <div>
            <div className="d68-dashboard-kicker">Investor Dashboard</div>
            <div className="d68-investor-dashboard-title-row">
              <h1>{privateInvestorName}</h1>
              <span className="d68-investor-dashboard-id">{investor.code}</span>
            </div>
          </div>
        </header>

        <div className="d68-dashboard-cols">
          <nav className="d68-dashboard-side">
            {tabDefinitions.map((item) => (
              <Link
                key={item.id}
                to={toLocalizedPath(item.href, lang)}
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                <span className="d68-dashboard-nav-icon"><item.Icon size={16} /></span>
                {T(lang, item.vi, item.en)}
              </Link>
            ))}
            {publicInvestorPath ? (
              <a
                className="d68-dashboard-public-link"
                href={publicInvestorPath}
                target="_blank"
                rel="noopener noreferrer"
              >
                {T(lang, 'Xem Hồ sơ hiển thị', 'View displayed profile')} ↗
              </a>
            ) : null}
          </nav>

          <section>
            {notice ? <div className={`d68-dashboard-notice ${noticeType}`}>{notice}</div> : null}
            {hasPending ? (
              <div className="d68-dashboard-notice warn">
                {T(
                  lang,
                  'Hồ sơ có thay đổi đang chờ quản trị Deals68 duyệt. Dữ liệu công khai hiện tại chưa bị thay thế.',
                  'Your profile has changes awaiting Deals68 administrator approval. The current public data remains unchanged.',
                )}
              </div>
            ) : null}

            {tab === 'profile' ? (
              <form
                key={formKey}
                onSubmit={saveProfile}
                className="d68-dashboard-card d68-investor-profile-form"
              >
                <div className="d68-dashboard-row-head">
                  <div>
                    <h2>{T(lang, 'Hồ sơ Nhà đầu tư', 'Investor profile')}</h2>
                    <p>{T(lang, 'Thông tin hồ sơ và tiêu chí đầu tư của bạn.', 'Your profile and investment criteria.')}</p>
                  </div>
                </div>

                <div className="d68-dashboard-form2">
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Tên Quỹ đầu tư / Nhà đầu tư — nội bộ, không công khai', 'Fund / Investor name — internal, not public')}</span>
                    <input name="private_name" className="d68-dashboard-input" defaultValue={investor.private_name || ''} />
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Website nội bộ', 'Internal website')}</span>
                    <input name="private_website" className="d68-dashboard-input" defaultValue={investor.private_website || ''} />
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Tên hiển thị công khai (VN)', 'Public display name (VI)')}</span>
                    <input className="d68-dashboard-input d68-dashboard-input--locked" value={investor.title_vi || ''} disabled readOnly />
                    <small>{T(lang, 'Chỉ quản trị Deals68 được cập nhật trường này.', 'Only Deals68 administrators can update this field.')}</small>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Tên hiển thị công khai (EN)', 'Public display name (EN)')}</span>
                    <input className="d68-dashboard-input d68-dashboard-input--locked" value={investor.title_en || ''} disabled readOnly />
                    <small>{T(lang, 'Chỉ quản trị Deals68 được cập nhật trường này.', 'Only Deals68 administrators can update this field.')}</small>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Quốc gia trụ sở', 'Headquarters country')}</span>
                    <select name="country_iso2" className="d68-dashboard-input" defaultValue={formCountryIso2}>
                      {countryOptions.map((item) => (
                        <option key={item.iso2} value={item.iso2}>{T(lang, item.vi, item.en)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Khoản đầu tư tối thiểu (USD)', 'Minimum ticket (USD)')}</span>
                    <FormattedNumberInput name="ticket_min" value={formTicketMin} />
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Khoản đầu tư tối đa (USD)', 'Maximum ticket (USD)')}</span>
                    <FormattedNumberInput name="ticket_max" value={formTicketMax} />
                  </label>
                </div>

                <div className="d68-dashboard-field">
                  <span>{T(lang, 'Loại hình nhà đầu tư', 'Investor types')}</span>
                  <InvestorTypeTagPicker lang={lang} values={formInvestorTypes} name="investor_types" />
                </div>
                <div className="d68-dashboard-field">
                  <span>{T(lang, 'Giai đoạn phù hợp', 'Preferred stages')}</span>
                  <InvestorStageTagPicker lang={lang} values={formStages} name="stages" />
                </div>
                <div className="d68-dashboard-field">
                  <span>{T(lang, 'Ngành quan tâm', 'Industries of interest')}</span>
                  <IndustryTagPicker lang={lang} values={formIndustries} name="industries" expandVi="Đầy đủ" expandEn="Show all" />
                </div>
                <div className="d68-dashboard-field">
                  <span>{T(lang, 'Loại giao dịch quan tâm', 'Transaction types of interest')}</span>
                  <InvestorDealTypeTagPicker lang={lang} values={formDealTypes} name="deal_types" />
                </div>
                <div className="d68-dashboard-field">
                  <span>{T(lang, 'Thị trường quan tâm', 'Target investment markets')}</span>
                  <InvestorMarketTagPicker lang={lang} values={formTargetCountries} name="target_countries" />
                </div>

                <div className="d68-dashboard-form2">
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Khẩu vị rủi ro', 'Risk appetite')}</span>
                    <select name="riskAppetite" className="d68-dashboard-input" defaultValue={formRiskAppetite}>
                      <option value="">{T(lang, 'Chưa chọn', 'Not selected')}</option>
                      {riskOptions.map((item) => <option key={item.value} value={item.value}>{T(lang, item.vi, item.en)}</option>)}
                    </select>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Kỳ vọng lợi nhuận (%)', 'Expected return (%)')}</span>
                    <input name="returnExpectation" type="number" inputMode="decimal" min="0" step="0.1" className="d68-dashboard-input" defaultValue={formReturnExpectation} />
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Quy mô Doanh thu DN', 'Business revenue size')}</span>
                    <select name="revenueBand" className="d68-dashboard-input" defaultValue={pendingCriteria.revenueRange || pendingCriteria.revenueBand || criteria.revenueRange || criteria.revenueBand || criteria.preferredDealSize || ''}>
                      {revenueBandOptions.map((item) => <option key={item.value} value={item.value}>{T(lang, item.vi, item.en)}</option>)}
                    </select>
                  </label>
                </div>

                <div className="d68-dashboard-form2">
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Giới thiệu (VN)', 'Introduction (VI)')}</span>
                    <textarea name="desc_vi" className="d68-dashboard-input d68-dashboard-textarea" defaultValue={formDescVi} />
                    <small>{T(lang, 'Nội dung tiếng Việt, chờ Admin duyệt trước khi công khai.', 'Vietnamese content; Admin approval is required before public display.')}</small>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Giới thiệu (EN)', 'Introduction (EN)')}</span>
                    <textarea name="desc_en" className="d68-dashboard-input d68-dashboard-textarea" defaultValue={formDescEn} />
                    <small>{T(lang, 'Nội dung tiếng Anh độc lập, không tự dịch từ bản VN.', 'Independent English content; it is not auto-translated from Vietnamese.')}</small>
                  </label>
                </div>

                <div className="d68-dashboard-form2">
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Khẩu vị đầu tư (VN)', 'Investment appetite (VI)')}</span>
                    <textarea name="investment_appetite_vi" className="d68-dashboard-input d68-dashboard-textarea" defaultValue={formAppetiteVi} />
                    <small>{T(lang, 'Mô tả loại doanh nghiệp, mô hình và điều kiện đầu tư ưu tiên bằng tiếng Việt.', 'Describe preferred businesses, models and investment conditions in Vietnamese.')}</small>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Khẩu vị đầu tư (EN)', 'Investment appetite (EN)')}</span>
                    <textarea name="investment_appetite_en" className="d68-dashboard-input d68-dashboard-textarea" defaultValue={formAppetiteEn} />
                    <small>{T(lang, 'Nội dung tiếng Anh độc lập; để trống nếu chưa có bản EN.', 'Independent English content; leave blank until an English version is available.')}</small>
                  </label>
                </div>

                <div className="d68-investor-profile-review-note">
                  {T(
                    lang,
                    'Giới thiệu, Khẩu vị đầu tư và các tiêu chí public thay đổi đều cần quản trị Deals68 duyệt trước khi hiển thị.',
                    'Changes to the Introduction, Investment Appetite and public criteria require Deals68 administrator approval before display.',
                  )}
                </div>

                <div className="d68-dashboard-actions">
                  <button className="d68-dashboard-btn blue" disabled={busy}>
                    {T(lang, 'Gửi cập nhật để duyệt', 'Submit updates for review')}
                  </button>
                </div>
              </form>
            ) : null}

            {tab === 'recommended' ? (
              <div className="d68-dashboard-card">
                <h2>{T(lang, 'Tiêu chí & Doanh nghiệp gợi ý', 'Criteria & Suggested businesses')}</h2>
                <p>{T(lang, 'Chọn bộ lọc để tìm doanh nghiệp phù hợp', 'Choose filters to find matching businesses')}</p>
                <div className="d68-investor-filter-grid">
                  <div className="d68-dashboard-field">
                    <span>{T(lang, 'Danh mục', 'Categories')}</span>
                    <div className="d68-chip-select">
                      {criteriaIndustries.length ? criteriaIndustries.map((key) => {
                        const option = industryOptions.find((item) => item.key === key);
                        return (
                          <button
                            type="button"
                            key={key}
                            className={filterIndustries.includes(key) ? 'active' : ''}
                            onClick={() => setFilterIndustries((current) =>
                              current.includes(key)
                                ? current.filter((item) => item !== key)
                                : [...current, key],
                            )}
                          >
                            {option ? T(lang, option.vi, option.en) : key}
                          </button>
                        );
                      }) : (
                        <span className="d68-dashboard-mini">
                          {T(lang, 'Chưa có danh mục quan tâm nào đang có doanh nghiệp.', 'None of your selected categories currently has a business.')}
                        </span>
                      )}
                    </div>
                  </div>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Quy mô doanh thu', 'Revenue size')}</span>
                    <select className="d68-dashboard-input" value={revenueBand} onChange={(event) => setRevenueBand(event.target.value)}>
                      {revenueBandOptions.map((item) => <option key={item.value} value={item.value}>{T(lang, item.vi, item.en)}</option>)}
                    </select>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Biên lợi nhuận (% EBITDA)', 'EBITDA margin (%)')}</span>
                    <select className="d68-dashboard-input" value={ebitdaBand} onChange={(event) => setEbitdaBand(event.target.value)}>
                      {ebitdaBandOptions.map((item) => <option key={item.value} value={item.value}>{T(lang, item.vi, item.en)}</option>)}
                    </select>
                  </label>
                </div>
                {recommended.length ? (
                  <div className="d68-dashboard-grid3">
                    {recommended.map((business) => (
                      <MatchCard key={business.id} business={business} investor={investor} lang={lang} onInterest={expressInterest} onRequest={requestData} />
                    ))}
                  </div>
                ) : (
                  <div className="d68-dashboard-empty">
                    {T(lang, 'Chưa có doanh nghiệp phù hợp. Hãy quay lại sau khi có doanh nghiệp mới', 'No matching businesses yet. Please return when new businesses are added.')}
                  </div>
                )}
              </div>
            ) : null}

            {tab === 'watchlist' ? (
              <div className="d68-dashboard-card">
                <h2>{T(lang, 'Doanh nghiệp đã bày tỏ quan tâm', 'Businesses you expressed interest in')}</h2>
                <InterestRows lang={lang} rows={interests} />
              </div>
            ) : null}

            {tab === 'proposals' ? (
              <ProposalRows lang={lang} proposals={proposals} onMark={markProposal} onRequestData={requestProposalData} />
            ) : null}

            {tab === 'contacts' ? (
              <form key={`contact:${formKey}`} onSubmit={saveContact} className="d68-dashboard-card">
                <h2>{T(lang, 'Liên hệ và Bảo mật', 'Contact and Privacy')}</h2>
                <div className="d68-dashboard-form2">
                  <label className="d68-dashboard-field">
                    <span>Email</span>
                    <input name="email" type="email" className="d68-dashboard-input" defaultValue={investor.private_email || privacy.email || ''} />
                    <label className="d68-investor-share-check"><input name="shareEmail" type="checkbox" defaultChecked={!!privacy.shareEmail} />{T(lang, 'Cho phép doanh nghiệp xem sau khi đã kết nối', 'Allow the business to view it after connection')}</label>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>{T(lang, 'Số điện thoại', 'Phone')}</span>
                    <input name="phone" className="d68-dashboard-input" defaultValue={investor.private_phone || privacy.phone || ''} />
                    <label className="d68-investor-share-check"><input name="sharePhone" type="checkbox" defaultChecked={!!privacy.sharePhone} />{T(lang, 'Cho phép doanh nghiệp xem sau khi đã kết nối', 'Allow the business to view it after connection')}</label>
                  </label>
                  <label className="d68-dashboard-field">
                    <span>Website</span>
                    <input name="website" className="d68-dashboard-input" defaultValue={investor.private_website || privacy.website || ''} />
                    <label className="d68-investor-share-check"><input name="shareWebsite" type="checkbox" defaultChecked={privacy.shareWebsite !== false} />{T(lang, 'Cho phép chia sẻ website sau khi kết nối được duyệt', 'Allow the website to be shared after an approved connection')}</label>
                  </label>
                </div>
                <button className="d68-dashboard-btn blue">{T(lang, 'Lưu liên hệ', 'Save contact details')}</button>
              </form>
            ) : null}

            {tab === 'billing' ? (
              <InvestorBillingPanel
                lang={lang}
                investor={investor}
                profile={profile}
                payments={payments}
                onReload={load}
                setMessage={(value) => { setNoticeType('ok'); setNotice(value); }}
                setError={(value) => { setNoticeType('err'); setNotice(value); }}
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
