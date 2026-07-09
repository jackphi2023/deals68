import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode, getMyBusiness, investorTargetCountries } from '../lib/data';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { sendBusinessProposalToInvestor } from '../lib/proposals';
import { formatMoneyForLang, labelCountry, labelDealType, labelIndustry, labelInvestorType, labelRegion, labelStage, T } from '../lib/labels';
import { investorPublicDescription, investorPublicTitle, investorTicketLabel } from '../lib/investorDisplay';
import type { Lang } from '../lib/i18n';

type ContactAccess = { connected?: boolean; name?: string; email?: string; phone?: string; website?: string } | null;

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String).map((x) => x.trim()).filter(Boolean);
  if (!v) return [];
  return String(v).split(/[;,\n]/).map((x) => x.trim()).filter(Boolean);
}
function clean(v: any) { return String(v ?? '').trim(); }
function ticket(lang: Lang, min: any, max: any) {
  const a = Number(min || 0), b = Number(max || 0);
  if (!a && !b) return T(lang, 'Đang cập nhật', 'Updating');
  if (a && b) return `${formatMoneyForLang(a, 'USD', lang)} – ${formatMoneyForLang(b, 'USD', lang)}`;
  return b ? `≤ ${formatMoneyForLang(b, 'USD', lang)}` : `≥ ${formatMoneyForLang(a, 'USD', lang)}`;
}
function criteriaList(inv: any, lang: Lang): string[] {
  const criteria = inv?.criteria && typeof inv.criteria === 'object' ? inv.criteria : {};
  const out: string[] = [];
  const deals = arr(inv?.deal_types || criteria.dealTypes);
  const markets = investorTargetCountries(inv);
  const sectors = arr(inv?.industries || criteria.sectors);
  if (deals.length) out.push(`${T(lang, 'Ưu tiên giao dịch', 'Preferred transactions')}: ${deals.map((x) => labelDealType(x, lang, true)).join(', ')}`);
  if (markets.length) out.push(`${T(lang, 'Địa lý quan tâm', 'Target geographies')}: ${markets.map((x) => labelCountry(x, lang)).join(', ')}`);
  if (inv?.stage) out.push(`${T(lang, 'Giai đoạn phù hợp', 'Preferred stage')}: ${labelStage(inv.stage, lang)}`);
  if (sectors.length) out.push(`${T(lang, 'Ngành quan tâm', 'Target sectors')}: ${sectors.map((x) => labelIndustry(x, lang)).join(', ')}`);
  if (criteria.investment_appetite) out.push(`${T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}: ${criteria.investment_appetite}`);
  if (criteria.riskAppetite) out.push(`${T(lang, 'Khẩu vị rủi ro', 'Risk appetite')}: ${criteria.riskAppetite}`);
  if (criteria.returnExpectation) out.push(`${T(lang, 'Kỳ vọng lợi nhuận', 'Return expectation')}: ${criteria.returnExpectation}`);
  return out;
}
function proposalHistory(inv: any): string[] {
  const raw = inv?.criteria?.proposal_history || inv?.criteria?.proposalHistory || [];
  return arr(raw).map(String).filter(Boolean);
}
function fmtDate(value: any, lang: Lang) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN');
}
function relativeTime(value: any, lang: Lang) {
  const d = value ? new Date(value) : new Date();
  const diffDays = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  if (!Number.isFinite(diffDays)) return '';
  if (diffDays < 1) return T(lang, 'Hôm nay', 'Today');
  if (diffDays < 30) return T(lang, `${diffDays} ngày trước`, `${diffDays} day${diffDays > 1 ? 's' : ''} ago`);
  const months = Math.max(1, Math.floor(diffDays / 30));
  return T(lang, `${months} tháng trước`, `${months} month${months > 1 ? 's' : ''} ago`);
}

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [contact, setContact] = useState<ContactAccess>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const [sentProposal, setSentProposal] = useState<any>(null);
  const [publicHistory, setPublicHistory] = useState<any[]>([]);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setInv(null); setContact(null); setMsg(''); setPublicHistory([]);
      try {
        const data = await getInvestorByCode(code);
        if (!live) return;
        if (!data) setError(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.', 'Investor profile not found or not public.'));
        else {
          setInv(data);
          const fallback = proposalHistory(data).map((item) => ({ label: `${item}`, slug: '', sent_at: null }));
          setPublicHistory(fallback);
          const { data: hist } = await supabase
            .rpc('get_public_investor_proposal_history', { investor_uuid: data.id })
            .catch(() => ({ data: null } as any));
          if (live && hist?.length) {
            setPublicHistory(hist.slice(0, 10).map((row: any) => ({
              sent_at: row.sent_at,
              slug: row.business_slug,
              label: row.business_title || row.business_public_code || T(lang, 'Hồ sơ doanh nghiệp ẩn danh', 'Anonymous business profile')
            })));
          }
        }
      } catch (e: any) {
        if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ nhà đầu tư.', 'Could not load investor profile.'));
      } finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [code, lang]);

  useEffect(() => {
    let live = true;
    async function loadContact() {
      if (!profile || !inv?.id) { setContact(null); return; }
      const { data } = await supabase.rpc('get_investor_contact_if_connected', { investor_uuid: inv.id }).catch(() => ({ data: null } as any));
      if (live) setContact(data || null);
    }
    loadContact();
    return () => { live = false; };
  }, [profile?.id, inv?.id]);

  useEffect(() => {
    let live = true;
    async function loadSentProposal() {
      setSentProposal(null);
      if (!profile || profile.role !== 'business' || !inv?.id) return;
      try {
        const biz = await getMyBusiness(profile.id);
        if (!live || !biz?.id) return;
        const { data } = await supabase.from('proposals').select('id,status,sent_at').eq('business_id', biz.id).eq('investor_id', inv.id).maybeSingle();
        if (live) setSentProposal(data || null);
      } catch { if (live) setSentProposal(null); }
    }
    loadSentProposal();
    return () => { live = false; };
  }, [profile?.id, profile?.role, inv?.id]);

  const title = inv ? investorPublicTitle(inv, lang) : '';
  const desc = inv ? investorPublicDescription(inv, lang) : '';
  const industries = useMemo(() => arr(inv?.industries), [inv]);
  const criteria = useMemo(() => criteriaList(inv, lang), [inv, lang]);
  const markets = useMemo(() => {
    return investorTargetCountries(inv);
  }, [inv]);
  const connected = !!contact?.connected;

  async function sendProposal() {
    if (!profile) { navigate(toLocalizedPath(`/register/business?next=/investors/${code}`, lang)); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.', 'Only Business accounts can send a business profile.')); return; }
    if (sentProposal) { setMsg(T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.')); return; }
    setProposalBusy(true); setMsg('');
    try {
      const biz = await getMyBusiness(profile.id);
      if (!biz?.id) { navigate(toLocalizedPath('/dashboard/business', lang)); return; }
      const result = await sendBusinessProposalToInvestor({ business: biz, investorId: inv.id, message: 'Submitted from public investor detail page.' });
      if (!result.ok) {
        if (result.reason === 'quota_exceeded') setMsg(T(lang, 'Bạn đã hết hạn mức gửi Proposal. Vui lòng nâng gói hoặc gia hạn.', 'You have no proposal quota left. Please upgrade or renew your plan.'));
        else setMsg(result.message || T(lang, 'Không gửi được hồ sơ DN. Vui lòng thử lại.', 'Could not send business profile. Please try again.'));
        return;
      }
      setSentProposal(result.proposal || { status: 'sent', sent_at: new Date().toISOString() });
      const displayDate = new Date(result.proposal?.sent_at || Date.now()).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
      setMsg(result.reason === 'duplicate'
        ? T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này trước đó. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.')
        : T(lang, `Bạn đã gửi thành công ngày ${displayDate}. Hãy đợi nhà đầu tư xem xét duyệt.`, `Sent successfully on ${displayDate}. Please wait for the investor to review and approve.`));
    } catch (e: any) { setMsg(e?.message || T(lang, 'Không gửi được hồ sơ DN. Vui lòng thử lại.', 'Could not send business profile. Please try again.')); }
    finally { setProposalBusy(false); }
  }

  if (loading) return <main className="d68-investor-detail"><div className="d68-id-state">{T(lang, 'Đang tải hồ sơ nhà đầu tư...', 'Loading investor profile...')}</div></main>;
  if (error || !inv) return <main className="d68-investor-detail"><div className="d68-id-state"><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p>{error}</p><Link to={toLocalizedPath('/investors', lang)}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></main>;

  return <main className="d68-investor-detail"><section className="d68-id-wrap">
    <div className="d68-id-breadcrumb"><Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to={toLocalizedPath('/investors', lang)}>{T(lang, 'Nhà đầu tư', 'Investors')}</Link> › <b>{inv.code}</b></div>
    <div className="d68-id-layout">
      <div className="d68-id-main">
        <article className="d68-id-hero d68-id-section--card">
          <div className="d68-id-badges"><span>{labelInvestorType(inv.type, lang)}</span><span>📍 {labelCountry(inv.country_iso2 || inv.country, lang)}</span></div>
          <h1>{title}</h1><p>{desc}</p>
          <div className="d68-id-facts d68-id-facts--top">
            <Fact k={T(lang, 'Quốc gia trụ sở', 'HQ country')} v={labelCountry(inv.country_iso2 || inv.country, lang)} />
            <Fact k={T(lang, 'Loại nhà đầu tư', 'Investor type')} v={labelInvestorType(inv.type, lang)} />
            <Fact k={T(lang, 'Khu vực', 'Region')} v={labelRegion(inv.region, lang)} />
            <Fact k={T(lang, 'Giai đoạn đầu tư', 'Investment stage')} v={labelStage(inv.stage, lang)} />
            {investorTicketLabel(lang, inv) ? <Fact k={T(lang, 'Quy mô đầu tư', 'Investment size')} v={investorTicketLabel(lang, inv)} /> : null}
            <Fact k={T(lang, 'Thị trường quan tâm đầu tư', 'Target investment markets')} v={markets.map((x) => labelCountry(x, lang)).join(', ')} />
          </div>
        </article>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}</h2><ul className="d68-id-bullets">{criteria.length ? criteria.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có tiêu chí chi tiết được Admin duyệt public.', 'No detailed Admin-approved criteria yet.')}</li>}</ul></section>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Ngành quan tâm', 'Sectors of interest')}</h2><div className="d68-id-tags">{industries.length ? industries.map((x) => <span key={x}>{labelIndustry(x, lang)}</span>) : <span>{T(lang, 'Đang cập nhật', 'Updating')}</span>}</div></section>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Lịch sử nhận proposal', 'Proposal history')}</h2>{publicHistory.length ? <div className="d68-id-timeline d68-id-timeline--proposal">{publicHistory.map((item, idx) => <div key={idx}><i /> <span><small>{relativeTime(item.sent_at, lang)}</small>{item.slug ? <Link to={`/businesses/${item.slug}`} target="_blank" rel="noreferrer">{item.label}</Link> : <b>{item.label}</b>}</span></div>)}</div> : <p className="d68-id-muted">{T(lang, 'Chưa nhận Hồ sơ chào từ doanh nghiệp nào.', 'No business proposal profiles received yet.')}</p>}</section>
        <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Thông tin liên hệ', 'Contact information')}</h2><p className="d68-id-muted">{T(lang, 'Chỉ Doanh nghiệp đã kết nối với Nhà đầu tư mới được xem.', 'Only businesses connected with this investor can view contact details.')}</p><div className="d68-id-contact-list"><ContactRow label={T(lang, 'Người liên hệ', 'Contact person')} value={contact?.name} unlocked={connected && !!contact?.name} /><ContactRow label="Email" value={contact?.email} unlocked={connected && !!contact?.email} /><ContactRow label={T(lang, 'Website', 'Website')} value={contact?.website} unlocked={connected && !!contact?.website} href={contact?.website} /></div></section>
      </div>
      <aside className="d68-id-side d68-id-side--sticky">
        <div className="d68-id-cta"><span>{T(lang, 'Gửi Hồ sơ Doanh nghiệp', 'Send business profile')}</span><p>{T(lang, 'Gửi hồ sơ doanh nghiệp của bạn tới nhà đầu tư này để bắt đầu kết nối.', 'Send your business profile to this investor to start the connection workflow.')}</p><button onClick={sendProposal} disabled={proposalBusy || !!sentProposal}>{sentProposal ? T(lang, 'Đã gửi hồ sơ DN', 'Profile sent') : proposalBusy ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button><small>{sentProposal ? T(lang, 'Đã gửi. Theo dõi tại Dashboard DN → Proposal.', 'Sent. Track it in Business Dashboard → Proposals.') : T(lang, 'Hạn mức gửi còn lại xem tại Dashboard Doanh nghiệp.', 'Remaining send quota is available in the Business Dashboard.')}</small></div>
        <div className="d68-id-access"><h3>{T(lang, 'Ai được xem gì', 'Who can see what')}</h3><p>👤 {T(lang, 'Khách: chỉ xem teaser public.', 'Guests: public teaser only.')}</p><p>🏢 {T(lang, 'Business đã đăng nhập/trả phí: xem tiêu chí và gửi proposal.', 'Logged-in/paid businesses: view criteria and send proposals.')}</p><p>✅ {T(lang, 'Sau khi kết nối/duyệt: mở thông tin liên hệ theo cài đặt.', 'After approval/connection: contact details unlock according to settings.')}</p></div>
        {msg ? <div className="d68-id-msg">{msg}</div> : null}
      </aside>
    </div>
  </section></main>;
}

function Fact({ k, v }: { k: string; v: string }) { return <div className="d68-id-fact"><span>{k}</span><b>{v || '—'}</b></div>; }
function ContactRow({ label, value, unlocked, href }: { label: string; value?: string; unlocked: boolean; href?: string }) {
  const display = unlocked ? (href ? <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noreferrer">{value}</a> : value) : '';
  return <div className={`d68-id-contact-row${unlocked ? ' unlocked' : ''}`}><span>{unlocked ? '✅' : '🔒'}</span><b>{label}</b><em>{display}</em></div>;
}
