import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { countInvestors, getMyBusiness, investorTargetCountries, listInvestors } from '../lib/data';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { listBusinessProposalStatuses, proposalQuotaTotal, sendBusinessProposalToInvestor } from '../lib/proposals';
import { labelCountry, labelDealType, labelIndustry, labelInvestorType, labelRegion, labelStage, T } from '../lib/labels';
import type { Lang } from '../lib/i18n';
import { PromotionBanner } from '../components/SiteBanners';
import { investorPublicDescription, investorPublicTitle, investorTicketLabel } from '../lib/investorDisplay';

const PAGE_SIZE = 12;
const investorTypes = ['VC', 'PE', 'Institutional', 'Corporate/Strategic', 'Individual/Angel', 'Family Office', 'Lender/Debt'];
const regions = ['asia', 'americas', 'europe', 'oceania', 'mideast'];
const countries = ['VN', 'SG', 'US', 'CA', 'KR', 'DE', 'AU', 'JP', 'HK'];
const stages = ['Seed', 'Series A', 'Growth', 'Mature', 'Buyout'];
const dealTypes = ['Investment', 'Lending', 'M&A', 'Partnership / JV'];

type Investor = {
  raw: any;
  id: string;
  code: string;
  type: string;
  targetCountries: string[];
  industries: string[];
  dealTypes: string[];
  stage: string;
  verified: boolean;
};

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (!v) return [];
  return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

function normalize(inv: any): Investor {
  const code = String(inv.code || inv.id || 'INV');
  return {
    raw: inv,
    id: String(inv.id || code),
    code,
    type: inv.type || 'Investor',
    targetCountries: investorTargetCountries(inv),
    industries: arr(inv.industries),
    dealTypes: arr(inv.deal_types),
    stage: inv.stage || 'Any',
    verified: inv.verified === true,
  };
}

function Skeleton() {
  return <div className="d68-investor-card d68-investor-card--loading"><div/><section/></div>;
}

function InvestorCard({ inv, lang, onProposal, proposalState, quotaExceeded, busy }: {
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

  return (
    <article className="d68-investor-card">
      <div className="d68-investor-card__icon">{labelInvestorType(inv.type, lang).slice(0, 2).toUpperCase()}</div>
      <div className="d68-investor-card__body">
        <div className="d68-investor-card__badges">
          <span>{labelInvestorType(inv.type, lang)}</span>
          {inv.targetCountries.length ? <span>🎯 {inv.targetCountries.slice(0, 3).map((c) => labelCountry(c, lang)).join(', ')}</span> : null}
          {inv.verified ? <span className="verified">✓ {T(lang, 'Xác minh', 'Verified')}</span> : null}
        </div>

        <h3>{investorPublicTitle(inv.raw, lang)}</h3>
        <p>{investorPublicDescription(inv.raw, lang)}</p>

        <div className="d68-investor-card__meta">
          {ticket ? <span><b>{T(lang, 'Khoản đầu tư', 'Ticket')}:</b> {ticket}</span> : null}
          {inv.industries.length ? <span><b>{T(lang, 'Ngành', 'Industries')}:</b> {inv.industries.map((x) => labelIndustry(x, lang)).join(', ')}</span> : null}
          {inv.dealTypes.length ? <span><b>{T(lang, 'Loại giao dịch', 'Deal type')}:</b> {inv.dealTypes.map((x) => labelDealType(x, lang, true)).join(', ')}</span> : null}
          {inv.stage && inv.stage !== 'Any' ? <span><b>{T(lang, 'Giai đoạn', 'Stage')}:</b> {labelStage(inv.stage, lang)}</span> : null}
        </div>
      </div>

      <div className="d68-investor-card__actions">
        <Link to={toLocalizedPath(`/investors/${inv.code}`, lang)}>{T(lang, 'Xem chi tiết', 'View detail')}</Link>
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
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [items, setItems] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState(() => params.get('type') || '');
  const [region, setRegion] = useState(() => params.get('region') || '');
  const [country, setCountry] = useState(() => params.get('country') || '');
  const [industry, setIndustry] = useState(() => params.get('industry') || '');
  const [stage, setStage] = useState(() => params.get('stage') || '');
  const [dealType, setDealType] = useState(() => params.get('dealType') || '');
  const [minTicket, setMinTicket] = useState(() => params.get('minTicket') || '');
  const [search, setSearch] = useState(() => params.get('search') || params.get('q') || '');
  const [feedback, setFeedback] = useState('');
  const [myBusiness, setMyBusiness] = useState<any>(null);
  const [sentMap, setSentMap] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setType(p.get('type') || '');
    setRegion(p.get('region') || '');
    setCountry(p.get('country') || '');
    setIndustry(p.get('industry') || '');
    setStage(p.get('stage') || '');
    setDealType(p.get('dealType') || '');
    setMinTicket(p.get('minTicket') || '');
    setSearch(p.get('search') || p.get('q') || '');
    setPage(1);
  }, [location.search]);

  useEffect(() => {
    let live = true;

    async function load() {
      setLoading(true);
      setError('');

      const filters = {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        type: type || undefined,
        region: region || undefined,
        country: country || undefined,
        industry: industry || undefined,
        stage: stage || undefined,
        dealType: dealType || undefined,
        minTicket: minTicket || undefined,
        search: search || undefined,
      };

      try {
        const [data, cnt] = await Promise.all([
          listInvestors(filters),
          countInvestors(filters).catch(() => null),
        ]);
        if (!live) return;
        setItems((data || []).map(normalize));
        setTotal(cnt);
      } catch (e: any) {
        if (!live) return;
        setItems([]);
        setTotal(0);
        setError(e?.message || T(lang, 'Không tải được dữ liệu nhà đầu tư.', 'Could not load investors.'));
      } finally {
        if (live) setLoading(false);
      }
    }

    load();
    return () => { live = false; };
  }, [page, type, region, country, industry, stage, dealType, minTicket, search, lang]);

  useEffect(() => {
    let live = true;

    async function loadBusinessProposalState() {
      setMyBusiness(null);
      setSentMap({});
      if (!profile || profile.role !== 'business') return;

      const biz = await getMyBusiness(profile.id).catch(() => null);
      if (!live) return;
      setMyBusiness(biz || null);

      if (biz?.id) {
        const rows = await listBusinessProposalStatuses(biz.id).catch(() => []);
        if (live) setSentMap(Object.fromEntries(rows.map((r: any) => [r.investor_id, r.status || 'sent'])));
      }
    }

    loadBusinessProposalState();
    return () => { live = false; };
  }, [profile?.id, profile?.role, items.length]);

  const pages = useMemo(() => total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const quotaTotal = proposalQuotaTotal(myBusiness);
  const quotaUsed = Object.keys(sentMap).length;
  const quotaExceeded = !!myBusiness && quotaUsed >= quotaTotal;

  function clearFilters() {
    setType('');
    setRegion('');
    setCountry('');
    setIndustry('');
    setStage('');
    setDealType('');
    setMinTicket('');
    setSearch('');
    setPage(1);
  }

  async function proposal(inv: Investor) {
    if (!profile) {
      navigate(toLocalizedPath('/register/business', lang));
      return;
    }

    if (profile.role !== 'business') {
      setFeedback(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi proposal.', 'Only Business accounts can send proposals.'));
      return;
    }

    const biz = myBusiness || await getMyBusiness(profile.id).catch(() => null);
    if (!biz?.id) {
      setFeedback(T(lang, 'Tài khoản chưa có hồ sơ Doanh nghiệp để gửi.', 'No Business profile found for this account.'));
      return;
    }

    setSendingId(inv.id);
    const result = await sendBusinessProposalToInvestor({
      business: biz,
      investorId: inv.id,
      message: 'Submitted from Investors listing page.',
    }).catch((e): import('../lib/proposals').ProposalSendResult => ({
      ok: false,
      reason: 'error',
      message: e?.message,
    }));
    setSendingId('');

    if (!result.ok) {
      setFeedback(result.reason === 'quota_exceeded'
        ? T(lang, 'Bạn đã hết hạn mức gửi Proposal. Vui lòng nâng gói hoặc gia hạn.', 'You have no proposal quota left. Please upgrade or renew.')
        : (result.message || T(lang, 'Không gửi được proposal.', 'Could not send proposal.')));
      return;
    }

    setSentMap((cur) => ({ ...cur, [inv.id]: result.proposal?.status || 'sent' }));
    setFeedback(result.reason === 'duplicate'
      ? T(lang, 'Bạn đã gửi Hồ sơ DN tới Nhà đầu tư này trước đó. Vui lòng theo dõi trạng thái tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track the status in Business Dashboard → Proposals.')
      : T(lang, 'Đã gửi Hồ sơ DN tới Nhà đầu tư. Trạng thái hiện tại: Chờ Nhà đầu tư xem xét.', 'Business profile sent to the investor. Current status: Waiting for investor review.'));
  }

  return (
    <main className="d68-investors-page">
      <section className="d68-investors-title">
        <div><Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link> › <b>{T(lang, 'Nhà đầu tư', 'Investors')}</b></div>
        <h1>{T(lang, 'Nhà đầu tư, tổ chức cho vay', 'Investors and lending institutions')}</h1>
        <p>{T(lang, 'Nhà đầu tư cá nhân, doanh nghiệp, quỹ đầu tư, tổ chức... tại Việt Nam và quốc tế.', 'Individual investors, corporates, investment funds, institutions and lenders in Vietnam and internationally.')}</p>
      </section>

      <section className="d68-investors-layout">
        <aside className="d68-investors-sidebar">
          <header><b>{T(lang, 'Bộ lọc', 'Filters')}</b><button onClick={clearFilters}>{T(lang, 'Xóa lọc', 'Clear')}</button></header>

          <label>{T(lang, 'Tìm kiếm', 'Search')}<input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="keyword..." /></label>
          <label>{T(lang, 'Loại nhà đầu tư', 'Investor type')}<select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{investorTypes.map((x) => <option key={x} value={x}>{labelInvestorType(x, lang)}</option>)}</select></label>
          <label>{T(lang, 'Khu vực đầu tư', 'Investment region')}<select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{regions.map((x) => <option key={x} value={x}>{labelRegion(x, lang)}</option>)}</select></label>
          <label>{T(lang, 'Quốc gia đầu tư', 'Investment country')}<select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{countries.map((x) => <option key={x} value={x}>{labelCountry(x, lang)}</option>)}</select></label>
          <label>{T(lang, 'Ngành quan tâm', 'Preferred industry')}<input value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} placeholder={T(lang, 'F&B, Công nghệ...', 'F&B, Technology...')} /></label>
          <label>{T(lang, 'Loại giao dịch', 'Deal type')}<select value={dealType} onChange={(e) => { setDealType(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{dealTypes.map((x) => <option key={x} value={x}>{labelDealType(x, lang, true)}</option>)}</select></label>
          <label>{T(lang, 'Giai đoạn', 'Stage')}<select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option>{stages.map((x) => <option key={x} value={x}>{labelStage(x, lang)}</option>)}</select></label>
          <label>{T(lang, 'Khoản đầu tư tối thiểu', 'Minimum ticket')}<select value={minTicket} onChange={(e) => { setMinTicket(e.target.value); setPage(1); }}><option value="">{T(lang, 'Tất cả', 'All')}</option><option value="100000">≤ $100K</option><option value="1000000">≤ $1M</option><option value="5000000">≤ $5M</option><option value="50000000">≤ $50M</option></select></label>
        </aside>

        <div className="d68-investors-results">
          <div className="d68-investors-toolbar">
            <span>{loading ? T(lang, 'Đang tải dữ liệu thật...', 'Loading live data...') : `${items.length}${total !== null ? ` / ${total}` : ''} ${T(lang, 'hồ sơ', 'profiles')}`}</span>
            <span>{myBusiness ? `${T(lang, 'Proposal đã gửi', 'Proposals sent')}: ${quotaUsed}/${quotaTotal}` : T(lang, 'Nguồn: Supabase active + visible', 'Source: Supabase active + visible')}</span>
          </div>

          {feedback ? <div className="d68-investors-feedback">{feedback}</div> : null}
          {error ? <div className="d68-investors-error">{error}</div> : null}

          <div className="d68-investor-list">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
              : items.map((inv) => <InvestorCard key={inv.id} inv={inv} lang={lang} onProposal={() => proposal(inv)} proposalState={sentMap[inv.id]} quotaExceeded={quotaExceeded && !sentMap[inv.id]} busy={sendingId === inv.id} />)}
          </div>

          {!loading && !error && !items.length ? <div className="d68-investors-empty"><b>{T(lang, 'Chưa có nhà đầu tư phù hợp.', 'No matching investor profiles.')}</b></div> : null}

          <div className="d68-investors-pages">
            <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button>
            <span>{page}{pages ? ` / ${pages}` : ''}</span>
            <button disabled={loading || (pages !== null && page >= pages)} onClick={() => setPage((p) => p + 1)}>→</button>
          </div>

          <PromotionBanner placement="listing_promotion" lang={lang} className="d68-listing-promo" />
        </div>
      </section>
    </main>
  );
}
