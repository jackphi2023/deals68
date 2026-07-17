import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getMyBusiness, investorTargetCountries } from '../lib/data';
import { listCanonicalInvestors } from '../lib/investorListing';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import {
  listBusinessProposalStatuses,
  proposalQuotaTotal,
  sendBusinessProposalToInvestor,
} from '../lib/proposals';
import {
  countryOptions,
  labelCountry,
  labelDealType,
  labelIndustry,
  labelInvestorType,
  labelStage,
  T,
} from '../lib/labels';
import type { Lang } from '../lib/i18n';
import { PromotionBanner } from '../components/SiteBanners';
import {
  investorPublicDescription,
  investorPublicTitle,
  investorTicketLabel,
} from '../lib/investorDisplay';
import { industryOptions } from '../lib/industryTaxonomy';
import {
  approvedInvestorDealTypes,
  approvedInvestorSectors,
  approvedInvestorStages,
  approvedInvestorTypes,
  INVESTOR_STAGE_VALUES,
  INVESTOR_TYPE_VALUES,
  investorDealOptionsCanonical,
} from '../lib/investorCriteria';

const PAGE_SIZE = 20;

function scrollListingToTop(selector: string) {
  if (typeof window === 'undefined') return;
  const element = document.querySelector(selector);
  const top =
    element instanceof HTMLElement
      ? Math.max(
          0,
          element.getBoundingClientRect().top + window.scrollY - 92,
        )
      : 0;
  window.scrollTo({ top, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
  document
    .querySelectorAll(
      '.d68-filter-scroll,.d68-investors-sidebar,.d68-list-cols,.d68-investors-results',
    )
    .forEach((node) => {
      if (node instanceof HTMLElement) node.scrollTop = 0;
    });
}

type Investor = {
  raw: any;
  id: string;
  code: string;
  types: string[];
  targetCountries: string[];
  industries: string[];
  dealTypes: string[];
  stages: string[];
  verified: boolean;
};

function normalize(investor: any): Investor {
  const code = String(investor.code || investor.id || 'INV');
  return {
    raw: investor,
    id: String(investor.id || code),
    code,
    types: approvedInvestorTypes(investor),
    targetCountries: investorTargetCountries(investor),
    industries: approvedInvestorSectors(investor),
    dealTypes: approvedInvestorDealTypes(investor),
    stages: approvedInvestorStages(investor),
    verified: investor.verified === true,
  };
}

function Skeleton() {
  return (
    <div className="d68-investor-card d68-investor-card--loading">
      <div />
      <section />
    </div>
  );
}

function InvestorCard({
  inv,
  lang,
  onProposal,
  proposalState,
  quotaExceeded,
  busy,
}: {
  inv: Investor;
  lang: Lang;
  onProposal: () => void;
  proposalState?: string;
  quotaExceeded?: boolean;
  busy?: boolean;
}) {
  const sent = !!proposalState;
  const disabled = busy || sent || quotaExceeded;
  const ticket = investorTicketLabel(lang, inv.raw);
  const typeLabels = inv.types.map((value) => labelInvestorType(value, lang));
  const primaryType = typeLabels[0] || T(lang, 'Nhà đầu tư', 'Investor');

  return (
    <article className="d68-investor-card">
      <div className="d68-investor-card__icon">
        {primaryType.slice(0, 2).toUpperCase()}
      </div>
      <div className="d68-investor-card__body">
        <div className="d68-investor-card__badges">
          <span>{typeLabels.slice(0, 2).join(' / ')}</span>
          {inv.targetCountries.length ? (
            <span>
              🎯{' '}
              {inv.targetCountries
                .slice(0, 3)
                .map((country) => labelCountry(country, lang))
                .join(', ')}
            </span>
          ) : null}
          {inv.verified ? (
            <span className="verified">
              ✓ {T(lang, 'Xác minh', 'Verified')}
            </span>
          ) : null}
        </div>

        <h3>
          <Link
            className="d68-investor-card__title-link d68-entity-title-link"
            to={toLocalizedPath(`/investors/${inv.code}`, lang)}
          >
            {investorPublicTitle(inv.raw, lang)}
          </Link>
        </h3>
        <p>{investorPublicDescription(inv.raw, lang)}</p>

        <div className="d68-investor-card__meta">
          {ticket ? (
            <span>
              <b>{T(lang, 'Quy mô đầu tư', 'Investment size')}:</b>{' '}
              {ticket}
            </span>
          ) : null}
          {inv.industries.length ? (
            <span className="d68-investor-card__industries">
              <b>{T(lang, 'Ngành', 'Industries')}:</b>{' '}
              {inv.industries
                .map((value) => labelIndustry(value, lang))
                .join(', ')}
            </span>
          ) : null}
          {inv.dealTypes.length ? (
            <span>
              <b>{T(lang, 'Loại giao dịch', 'Deal types')}:</b>{' '}
              {inv.dealTypes
                .map((value) => labelDealType(value, lang, true))
                .join(', ')}
            </span>
          ) : null}
          {inv.stages.length ? (
            <span>
              <b>{T(lang, 'Giai đoạn', 'Stages')}:</b>{' '}
              {inv.stages
                .map((value) => labelStage(value, lang))
                .join(', ')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="d68-investor-card__actions">
        <Link to={toLocalizedPath(`/investors/${inv.code}`, lang)}>
          {T(lang, 'Xem chi tiết', 'View detail')}
        </Link>
        <button onClick={onProposal} disabled={disabled}>
          {busy
            ? T(lang, 'Đang gửi...', 'Sending...')
            : sent
              ? T(lang, 'Đã gửi', 'Sent')
              : quotaExceeded
                ? T(lang, 'Hết hạn mức', 'Quota used')
                : T(lang, 'Gửi hồ sơ DN', 'Send business proposal')}
        </button>
      </div>
    </article>
  );
}

export default function Investors({ lang }: { lang: Lang }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const [items, setItems] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState(() => params.get('type') || '');
  const [country, setCountry] = useState(
    () => params.get('country') || '',
  );
  const [industry, setIndustry] = useState(
    () => params.get('industry') || '',
  );
  const [stage, setStage] = useState(() => params.get('stage') || '');
  const [dealType, setDealType] = useState(
    () => params.get('dealType') || '',
  );
  const [minTicket, setMinTicket] = useState(
    () => params.get('minTicket') || '',
  );
  const [search, setSearch] = useState(
    () => params.get('search') || params.get('q') || '',
  );
  const [feedback, setFeedback] = useState('');
  const [myBusiness, setMyBusiness] = useState<any>(null);
  const [sentMap, setSentMap] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState('');

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    setType(next.get('type') || '');
    setCountry(next.get('country') || '');
    setIndustry(next.get('industry') || '');
    setStage(next.get('stage') || '');
    setDealType(next.get('dealType') || '');
    setMinTicket(next.get('minTicket') || '');
    setSearch(next.get('search') || next.get('q') || '');
    setPage(1);
  }, [location.search]);

  useEffect(() => {
    let live = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const result = await listCanonicalInvestors({
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          type: type || undefined,
          country: country || undefined,
          industry: industry || undefined,
          stage: stage || undefined,
          dealType: dealType || undefined,
          minTicket: minTicket || undefined,
          search: search || undefined,
        });

        if (!live) return;
        setItems(result.rows.map(normalize));
        setTotal(result.total);
      } catch (loadError: any) {
        if (!live) return;
        setItems([]);
        setTotal(0);
        setError(
          loadError?.message ||
            T(
              lang,
              'Không tải được dữ liệu nhà đầu tư.',
              'Could not load investors.',
            ),
        );
      } finally {
        if (live) setLoading(false);
      }
    }

    load();
    return () => { live = false; };
  }, [page, type, country, industry, stage, dealType, minTicket, search, lang]);

  useEffect(() => {
    let live = true;

    async function loadBusinessProposalState() {
      setMyBusiness(null);
      setSentMap({});
      if (!profile || profile.role !== 'business') return;

      const business = await getMyBusiness(profile.id).catch(() => null);
      if (!live) return;
      setMyBusiness(business || null);

      if (business?.id) {
        const rows = await listBusinessProposalStatuses(business.id).catch(
          () => [],
        );
        if (live) {
          setSentMap(
            Object.fromEntries(
              rows.map((row: any) => [
                row.investor_id,
                row.status || 'sent',
              ]),
            ),
          );
        }
      }
    }

    loadBusinessProposalState();
    return () => { live = false; };
  }, [profile?.id, profile?.role, items.length]);

  const pages = useMemo(
    () =>
      total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );
  const resultStart =
    total === 0 || (!loading && !items.length)
      ? 0
      : (page - 1) * PAGE_SIZE + 1;
  const resultEnd =
    total === null
      ? (page - 1) * PAGE_SIZE + items.length
      : Math.min((page - 1) * PAGE_SIZE + items.length, total);
  const resultRangeText =
    total !== null
      ? `${T(lang, 'Hiển thị', 'Showing')} ${resultStart}-${resultEnd}/${total} ${T(lang, 'hồ sơ', 'profiles')}`
      : `${T(lang, 'Hiển thị', 'Showing')} ${items.length} ${T(lang, 'hồ sơ', 'profiles')}`;
  const quotaTotal = proposalQuotaTotal(myBusiness);
  const quotaUsed = Object.keys(sentMap).length;
  const quotaExceeded = !!myBusiness && quotaUsed >= quotaTotal;
  const typeOptions = INVESTOR_TYPE_VALUES;
  const stageOptions = INVESTOR_STAGE_VALUES.filter((value) => value !== 'Any');
  const dealOptions = investorDealOptionsCanonical(lang);
  const marketOptions = countryOptions.filter((item) => item.iso2 !== 'OTHER');

  function clearFilters() {
    setType('');
    setCountry('');
    setIndustry('');
    setStage('');
    setDealType('');
    setMinTicket('');
    setSearch('');
    setPage(1);
  }

  function goPage(nextPage: number) {
    setPage(Math.max(1, nextPage));
    scrollListingToTop('.d68-investors-page');
    setTimeout(() => scrollListingToTop('.d68-investors-page'), 0);
  }

  useEffect(() => {
    scrollListingToTop('.d68-investors-page');
  }, [page]);

  async function proposal(inv: Investor) {
    if (!profile) {
      navigate(toLocalizedPath('/register/business', lang));
      return;
    }

    if (profile.role !== 'business') {
      setFeedback(
        T(
          lang,
          'Chỉ tài khoản Doanh nghiệp được gửi proposal.',
          'Only Business accounts can send proposals.',
        ),
      );
      return;
    }

    const business =
      myBusiness || (await getMyBusiness(profile.id).catch(() => null));
    if (!business?.id) {
      setFeedback(
        T(
          lang,
          'Tài khoản chưa có hồ sơ Doanh nghiệp để gửi.',
          'No Business profile found for this account.',
        ),
      );
      return;
    }

    setSendingId(inv.id);
    const result = await sendBusinessProposalToInvestor({
      business,
      investorId: inv.id,
      message: 'Submitted from Investors listing page.',
    }).catch(
      (sendError): import('../lib/proposals').ProposalSendResult => ({
        ok: false,
        reason: 'error',
        message: sendError?.message,
      }),
    );
    setSendingId('');

    if (!result.ok) {
      setFeedback(
        result.reason === 'quota_exceeded'
          ? T(
              lang,
              'Bạn đã hết hạn mức gửi Proposal. Vui lòng nâng gói hoặc gia hạn.',
              'You have no proposal quota left. Please upgrade or renew.',
            )
          : result.message ||
              T(lang, 'Không gửi được proposal.', 'Could not send proposal.'),
      );
      return;
    }

    setSentMap((current) => ({
      ...current,
      [inv.id]: result.proposal?.status || 'sent',
    }));
    setFeedback(
      result.reason === 'duplicate'
        ? T(
            lang,
            'Bạn đã gửi Hồ sơ DN tới Nhà đầu tư này trước đó. Vui lòng theo dõi trạng thái tại Dashboard DN → Proposal.',
            'You already sent your business profile to this investor. Please track the status in Business Dashboard → Proposals.',
          )
        : T(
            lang,
            'Đã gửi Hồ sơ DN tới Nhà đầu tư. Trạng thái hiện tại: Chờ Nhà đầu tư xem xét.',
            'Business profile sent to the investor. Current status: Waiting for investor review.',
          ),
    );
  }

  return (
    <main className="d68-investors-page">
      <section className="d68-investors-title">
        <div>
          <Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link>
          {' › '}
          <b>{T(lang, 'Nhà đầu tư', 'Investors')}</b>
        </div>
        <h1>
          {T(
            lang,
            'Nhà đầu tư, tổ chức cho vay',
            'Investors and lending institutions',
          )}
        </h1>
        <p>
          {T(
            lang,
            'Nhà đầu tư cá nhân, doanh nghiệp, quỹ đầu tư, tổ chức... tại Việt Nam và quốc tế.',
            'Individual investors, corporates, investment funds, institutions and lenders in Vietnam and internationally.',
          )}
        </p>
      </section>

      <section className="d68-investors-layout">
        <aside className="d68-investors-sidebar">
          <header>
            <b>{T(lang, 'Bộ lọc', 'Filters')}</b>
            <button onClick={clearFilters}>{T(lang, 'Xóa lọc', 'Clear')}</button>
          </header>

          <label>
            {T(lang, 'Tìm kiếm', 'Search')}
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={T(lang, 'Từ khóa...', 'Keyword...')}
            />
          </label>
          <label>
            {T(lang, 'Loại hình nhà đầu tư', 'Investor type')}
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{T(lang, 'Tất cả', 'All')}</option>
              {typeOptions.map((value) => (
                <option key={value} value={value}>
                  {labelInvestorType(value, lang)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {T(lang, 'Thị trường quan tâm', 'Investment market')}
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{T(lang, 'Tất cả', 'All')}</option>
              {marketOptions.map((item) => (
                <option key={item.iso2} value={item.iso2}>
                  {T(lang, item.vi, item.en)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {T(lang, 'Ngành quan tâm', 'Preferred industry')}
            <select
              value={industry}
              onChange={(event) => {
                setIndustry(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{T(lang, 'Tất cả', 'All')}</option>
              {industryOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {T(lang, item.vi, item.en)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {T(lang, 'Loại giao dịch', 'Deal type')}
            <select
              value={dealType}
              onChange={(event) => {
                setDealType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{T(lang, 'Tất cả', 'All')}</option>
              {dealOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {T(lang, 'Giai đoạn phù hợp', 'Preferred stage')}
            <select
              value={stage}
              onChange={(event) => {
                setStage(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{T(lang, 'Tất cả', 'All')}</option>
              {stageOptions.map((value) => (
                <option key={value} value={value}>
                  {labelStage(value, lang)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {T(lang, 'Khoản đầu tư tối thiểu', 'Minimum ticket')}
            <select
              value={minTicket}
              onChange={(event) => {
                setMinTicket(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{T(lang, 'Tất cả', 'All')}</option>
              <option value="100000">≤ $100K</option>
              <option value="1000000">≤ $1M</option>
              <option value="5000000">≤ $5M</option>
              <option value="50000000">≤ $50M</option>
            </select>
          </label>
        </aside>

        <div className="d68-investors-results">
          <div className="d68-investors-toolbar">
            <span>
              {loading ? T(lang, 'Đang tải…', 'Loading…') : resultRangeText}
            </span>
            {myBusiness ? (
              <span>{`${T(lang, 'Proposal đã gửi', 'Proposals sent')}: ${quotaUsed}/${quotaTotal}`}</span>
            ) : null}
          </div>

          {feedback ? (
            <div className="d68-investors-feedback">{feedback}</div>
          ) : null}
          {error ? <div className="d68-investors-error">{error}</div> : null}

          <div className="d68-investor-list">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} />
                ))
              : items.map((inv) => (
                  <InvestorCard
                    key={inv.id}
                    inv={inv}
                    lang={lang}
                    onProposal={() => proposal(inv)}
                    proposalState={sentMap[inv.id]}
                    quotaExceeded={quotaExceeded && !sentMap[inv.id]}
                    busy={sendingId === inv.id}
                  />
                ))}
          </div>

          {!loading && !error && !items.length ? (
            <div className="d68-investors-empty">
              <b>
                {T(
                  lang,
                  'Chưa có nhà đầu tư phù hợp.',
                  'No matching investor profiles.',
                )}
              </b>
            </div>
          ) : null}

          <div className="d68-investors-pages">
            <button
              disabled={page <= 1 || loading}
              onClick={() => goPage(page - 1)}
            >
              {T(lang, '< Trang trước', '< Previous')}
            </button>
            <span>
              {page}
              {pages ? ` / ${pages}` : ''}
            </span>
            <button
              disabled={loading || (pages !== null && page >= pages)}
              onClick={() => goPage(page + 1)}
            >
              {T(lang, 'Trang tiếp >', 'Next >')}
            </button>
          </div>

          <PromotionBanner
            placement="listing_promotion"
            lang={lang}
            className="d68-listing-promo"
          />
        </div>
      </section>
    </main>
  );
}
