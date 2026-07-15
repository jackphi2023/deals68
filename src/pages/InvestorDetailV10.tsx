import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import InvestorPublicHeroV10 from '../components/investor/InvestorPublicHeroV10';
import InvestorPublicSectionsV10 from '../components/investor/InvestorPublicSectionsV10';
import { useAuth } from '../contexts/AuthContext';
import {
  getInvestorByCode,
  getMyBusiness,
  investorTargetCountries,
} from '../lib/data';
import type { Lang } from '../lib/i18n';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { approvedInvestorReviewCriteria } from '../lib/investorCriteriaReviewService';
import {
  getDefaultInvestorCover,
  type InvestorCoverBanner,
} from '../lib/investorProfileService';
import {
  investorPublicDescription,
  investorPublicTitle,
  investorTicketLabel,
} from '../lib/investorDisplay';
import { T } from '../lib/labels';
import { sendBusinessProposalToInvestor } from '../lib/proposals';
import { applySeo, DEFAULT_SOCIAL_IMAGE } from '../lib/seo';
import { supabase } from '../lib/supabase';

type ContactAccess = {
  connected?: boolean;
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
} | null;

function arr(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function proposalFallback(investor: any, lang: Lang) {
  const raw = investor?.criteria?.proposal_history || investor?.criteria?.proposalHistory;
  return arr(raw).map((label) => ({
    label: label || T(lang, 'Hồ sơ doanh nghiệp ẩn danh', 'Anonymous business profile'),
    slug: '',
    sent_at: null,
  }));
}

export default function InvestorDetailV10({ lang }: { lang: Lang }) {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [investor, setInvestor] = useState<any>(null);
  const [defaultCover, setDefaultCover] =
    useState<InvestorCoverBanner | null>(null);
  const [contact, setContact] = useState<ContactAccess>(null);
  const [publicHistory, setPublicHistory] = useState<any[]>([]);
  const [sentProposal, setSentProposal] = useState<any>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      setError('');
      setMessage('');
      try {
        const [nextInvestor, nextCover] = await Promise.all([
          getInvestorByCode(code),
          getDefaultInvestorCover(lang).catch(() => null),
        ]);
        if (!live) return;
        if (!nextInvestor) {
          setInvestor(null);
          setError(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.', 'Investor profile not found or not public.'));
          return;
        }
        setInvestor(nextInvestor);
        setDefaultCover(nextCover);
        setPublicHistory(proposalFallback(nextInvestor, lang));

        const { data: history } = await supabase.rpc(
          'get_public_investor_proposal_history',
          { investor_uuid: nextInvestor.id },
        );
        if (live && Array.isArray(history) && history.length) {
          setPublicHistory(
            history.slice(0, 10).map((row: any) => ({
              sent_at: row.sent_at,
              slug: row.business_slug,
              label:
                row.business_title ||
                row.business_public_code ||
                T(lang, 'Hồ sơ doanh nghiệp ẩn danh', 'Anonymous business profile'),
            })),
          );
        }
      } catch (loadError: any) {
        if (live) setError(loadError?.message || T(lang, 'Không tải được hồ sơ nhà đầu tư.', 'Could not load investor profile.'));
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => { live = false; };
  }, [code, lang]);

  useEffect(() => {
    let live = true;
    async function loadPrivateState() {
      setContact(null);
      setSentProposal(null);
      if (!profile || !investor?.id) return;

      const { data: contactData } = await supabase.rpc(
        'get_investor_contact_if_connected',
        { investor_uuid: investor.id },
      );
      if (live) setContact(contactData || null);

      if (profile.role !== 'business') return;
      const business = await getMyBusiness(profile.id);
      if (!live || !business?.id) return;
      const { data } = await supabase
        .from('proposals')
        .select('id,status,sent_at')
        .eq('business_id', business.id)
        .eq('investor_id', investor.id)
        .maybeSingle();
      if (live) setSentProposal(data || null);
    }
    loadPrivateState().catch(() => undefined);
    return () => { live = false; };
  }, [profile?.id, profile?.role, investor?.id]);

  const title = investor ? investorPublicTitle(investor, lang) : '';
  const description = investor ? investorPublicDescription(investor, lang) : '';
  const criteriaSource = useMemo(
    () => investor?.criteria && typeof investor.criteria === 'object'
      ? investor.criteria
      : {},
    [investor],
  );
  const industries = useMemo(
    () => arr(investor?.industries || criteriaSource.sectors),
    [investor, criteriaSource],
  );
  const dealTypes = useMemo(
    () => arr(investor?.deal_types || criteriaSource.dealTypes),
    [investor, criteriaSource],
  );
  const markets = useMemo(() => investorTargetCountries(investor), [investor]);
  const reviewedCriteria = useMemo(
    () => approvedInvestorReviewCriteria(investor),
    [investor],
  );
  const ticket = investor ? investorTicketLabel(lang, investor) : '';

  useEffect(() => {
    if (loading) return;
    const canonicalPath = lang === 'en'
      ? `/en/investors/${encodeURIComponent(code)}`
      : `/investors/${encodeURIComponent(code)}`;
    applySeo({
      lang,
      pageName: investor ? title : T(lang, 'Không tìm thấy hồ sơ Nhà đầu tư', 'Investor Profile Not Found'),
      description: investor ? description : error,
      canonicalPath,
      image: DEFAULT_SOCIAL_IMAGE,
      type: 'article',
      noindex: !investor,
    });
  }, [code, description, error, investor, lang, loading, title]);

  async function sendProposal() {
    if (!profile) {
      navigate(toLocalizedPath(`/register/business?next=/investors/${code}`, lang));
      return;
    }
    if (profile.role !== 'business') {
      setMessage(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.', 'Only Business accounts can send a business profile.'));
      return;
    }
    if (sentProposal) {
      setMessage(T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này.', 'You already sent your business profile to this investor.'));
      return;
    }
    setProposalBusy(true);
    setMessage('');
    try {
      const business = await getMyBusiness(profile.id);
      if (!business?.id) {
        navigate(toLocalizedPath('/dashboard/business', lang));
        return;
      }
      const result = await sendBusinessProposalToInvestor({
        business,
        investorId: investor.id,
        message: 'Submitted from public investor detail page.',
      });
      if (!result.ok) {
        setMessage(result.message || T(lang, 'Không gửi được hồ sơ DN.', 'Could not send business profile.'));
        return;
      }
      setSentProposal(result.proposal || { status: 'sent', sent_at: new Date().toISOString() });
      setMessage(T(lang, 'Đã gửi hồ sơ DN thành công.', 'Business profile sent successfully.'));
    } catch (sendError: any) {
      setMessage(sendError?.message || T(lang, 'Không gửi được hồ sơ DN.', 'Could not send business profile.'));
    } finally {
      setProposalBusy(false);
    }
  }

  if (loading) {
    return <main className="d68-investor-detail"><div className="d68-id-state">{T(lang, 'Đang tải hồ sơ nhà đầu tư...', 'Loading investor profile...')}</div></main>;
  }
  if (error || !investor) {
    return <main className="d68-investor-detail"><div className="d68-id-state"><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p>{error}</p><Link to={toLocalizedPath('/investors', lang)}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></main>;
  }

  return (
    <main
      className="d68-investor-detail d68-v10-investor-detail"
      data-investor-layout="v11-two-column"
    >
      <section className="d68-id-wrap">
        <div className="d68-id-breadcrumb"><Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to={toLocalizedPath('/investors', lang)}>{T(lang, 'Nhà đầu tư', 'Investors')}</Link> › <b>{investor.code}</b></div>
        <div className="d68-id-layout">
          <div className="d68-id-main">
            <InvestorPublicHeroV10 investor={investor} defaultCover={defaultCover} lang={lang} title={title} />
            <InvestorPublicSectionsV10
              lang={lang}
              description={description}
              country={investor.country_iso2 || investor.country}
              investorType={investor.type}
              dealTypes={dealTypes}
              stage={investor.stage || ''}
              ticket={ticket}
              appetite={reviewedCriteria.investment_appetite}
              riskAppetite={reviewedCriteria.riskAppetite}
              returnExpectation={reviewedCriteria.returnExpectation}
              revenueRange={reviewedCriteria.revenueRange}
              industries={industries}
              markets={markets}
              publicHistory={publicHistory}
              contact={contact}
            />
          </div>
          <aside className="d68-id-side d68-id-side--sticky">
            <div className="d68-id-cta">
              <span>{T(lang, 'Gửi Hồ sơ Doanh nghiệp', 'Send business profile')}</span>
              <p>{T(lang, 'Gửi hồ sơ doanh nghiệp của bạn tới nhà đầu tư này để bắt đầu kết nối.', 'Send your business profile to this investor to start the connection workflow.')}</p>
              <button onClick={sendProposal} disabled={proposalBusy || Boolean(sentProposal)}>
                {sentProposal ? T(lang, 'Đã gửi hồ sơ DN', 'Profile sent') : proposalBusy ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi hồ sơ DN', 'Send business profile')}
              </button>
            </div>
            <div className="d68-id-access">
              <h3>{T(lang, 'Ai được xem gì', 'Who can see what')}</h3>
              <p>👤 {T(lang, 'Khách chỉ xem được hồ sơ công khai', 'Guests can only view the public profile.')}</p>
              <p>🏢 {T(lang, 'Doanh nghiệp đã đăng nhập có thể gửi Hồ sơ DN/Proposal', 'Signed-in businesses can send their Business Profile/Proposal.')}</p>
              <p>✅ {T(lang, 'Sau khi kết nối/duyệt: mở thông tin liên hệ do Nhà đầu tư cài đặt (SĐT, Email)', 'After connection/approval: contact details configured by the investor are unlocked (phone and email).')}</p>
            </div>
            {message ? <div className="d68-id-msg">{message}</div> : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
