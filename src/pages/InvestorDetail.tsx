import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode, getMyBusiness } from '../lib/data';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { formatMoneyForLang, labelCountry, labelDealType, labelIndustry, labelInvestorType, labelRegion, labelStage, T } from '../lib/labels';
import type { Lang } from '../lib/i18n';

type ContactAccess = { connected?: boolean; name?: string; email?: string; phone?: string; website?: string } | null;

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (!v) return [];
  return String(v).split(/[;,\n]/).map((x) => x.trim()).filter(Boolean);
}
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
  const markets = arr(criteria.preferredCountries || inv?.country_iso2 || inv?.country);
  const sectors = arr(inv?.industries || criteria.sectors);
  if (deals.length) out.push(`${T(lang, 'Ưu tiên giao dịch', 'Preferred transactions')}: ${deals.map((x) => labelDealType(x, lang, true)).join(', ')}`);
  if (markets.length) out.push(`${T(lang, 'Địa lý quan tâm', 'Target geographies')}: ${markets.map((x) => labelCountry(x, lang)).join(', ')}`);
  if (inv?.stage) out.push(`${T(lang, 'Giai đoạn phù hợp', 'Preferred stage')}: ${labelStage(inv.stage, lang)}`);
  if (sectors.length) out.push(`${T(lang, 'Ngành quan tâm', 'Target sectors')}: ${sectors.map((x) => labelIndustry(x, lang)).join(', ')}`);
  if (criteria.investment_appetite) out.push(`${T(lang, 'Khẩu vị đầu tư', 'Investment appetite')}: ${criteria.investment_appetite}`);
  if (criteria.riskAppetite) out.push(`${T(lang, 'Khẩu vị rủi ro', 'Risk appetite')}: ${criteria.riskAppetite}`);
  if (criteria.returnExpectation) out.push(`${T(lang, 'Kỳ vọng lợi nhuận', 'Return expectation')}: ${criteria.returnExpectation}`);
  if (inv?.activity_level) out.push(`${T(lang, 'Mức độ hoạt động gần đây', 'Recent activity')}: ${inv.activity_level}`);
  return out;
}
function proposalHistory(inv: any, lang: Lang): string[] {
  const raw = inv?.criteria?.proposal_history || inv?.criteria?.proposalHistory || [];
  return arr(raw).map(String).filter(Boolean);
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

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setInv(null); setContact(null); setMsg('');
      try {
        const data = await getInvestorByCode(code);
        if (!live) return;
        if (!data) setError(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.', 'Investor profile not found or not public.'));
        else setInv(data);
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
      } catch {
        if (live) setSentProposal(null);
      }
    }
    loadSentProposal();
    return () => { live = false; };
  }, [profile?.id, profile?.role, inv?.id]);

  const title = inv ? T(lang, inv.title_vi || inv.code || 'Nhà đầu tư', inv.title_en || inv.title_vi || inv.code || 'Investor') : '';
  const desc = inv ? T(lang, inv.desc_vi || 'Hồ sơ nhà đầu tư ẩn danh đang được cập nhật.', inv.desc_en || inv.desc_vi || 'Anonymous investor profile is being updated.') : '';
  const industries = useMemo(() => arr(inv?.industries), [inv]);
  const dealTypes = useMemo(() => arr(inv?.deal_types), [inv]);
  const criteria = useMemo(() => criteriaList(inv, lang), [inv, lang]);
  const history = useMemo(() => proposalHistory(inv, lang), [inv, lang]);
  const markets = useMemo(() => {
    const fromCriteria = arr(inv?.criteria?.preferredCountries);
    return fromCriteria.length ? fromCriteria : [inv?.country_iso2 || inv?.country || 'Global'];
  }, [inv]);
  const connected = !!contact?.connected;

  async function sendProposal() {
    if (!profile) { navigate(toLocalizedPath(`/login?role=business&next=/investors/${code}`, lang)); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi hồ sơ DN.', 'Only Business accounts can send a business profile.')); return; }
    if (sentProposal) {
      setMsg(T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.'));
      return;
    }
    setProposalBusy(true); setMsg('');
    try {
      const biz = await getMyBusiness(profile.id);
      if (!biz?.id) {
        navigate(toLocalizedPath('/dashboard/business', lang));
        return;
      }
      const now = new Date();
      const { data, error } = await supabase.from('proposals').insert({
        business_id: biz.id,
        investor_id: inv.id,
        message: `Business profile sent from investor profile on ${now.toISOString()}`,
        status: 'pending',
        sent_at: now.toISOString()
      }).select('id,status,sent_at').single();
      if (error) {
        const text = String(error.message || '').toLowerCase();
        if (text.includes('duplicate') || text.includes('unique')) {
          const { data: existing } = await supabase.from('proposals').select('id,status,sent_at').eq('business_id', biz.id).eq('investor_id', inv.id).maybeSingle();
          setSentProposal(existing || { status: 'pending', sent_at: now.toISOString() });
          setMsg(T(lang, 'Bạn đã gửi hồ sơ DN tới nhà đầu tư này trước đó. Vui lòng theo dõi tại Dashboard DN → Proposal.', 'You already sent your business profile to this investor. Please track it in Business Dashboard → Proposals.'));
          return;
        }
        throw error;
      }
      setSentProposal(data || { status: 'pending', sent_at: now.toISOString() });
      const displayDate = now.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
      setMsg(T(lang, `Bạn đã gửi thành công ngày ${displayDate}. Hãy đợi nhà đầu tư xem xét duyệt.`, `Sent successfully on ${displayDate}. Please wait for the investor to review and approve.`));
    } catch (e: any) {
      setMsg(e?.message || T(lang, 'Không gửi được hồ sơ DN. Vui lòng thử lại.', 'Could not send business profile. Please try again.'));
    } finally {
      setProposalBusy(false);
    }
  }

  if (loading) return <main className="d68-investor-detail"><div className="d68-id-state">{T(lang, 'Đang tải hồ sơ nhà đầu tư...', 'Loading investor profile...')}</div></main>;
  if (error || !inv) return <main className="d68-investor-detail"><div className="d68-id-state"><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p>{error}</p><Link to={toLocalizedPath('/investors', lang)}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></main>;

  return <main className="d68-investor-detail"><section className="d68-id-wrap">
    <div className="d68-id-breadcrumb"><Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to={toLocalizedPath('/investors', lang)}>{T(lang, 'Nhà đầu tư', 'Investors')}</Link> › <b>{inv.code}</b></div>

    <div className="d68-id-hero-grid">
      <article className="d68-id-hero">
        <div className="d68-id-badges"><span>{labelInvestorType(inv.type, lang)}</span><span>📍 {labelCountry(inv.country_iso2 || inv.country, lang)}</span>{inv.activity_level ? <span className="gold">● {inv.activity_level}</span> : null}</div>
        <h1>{title}</h1>
        <p>{desc}</p>
        <div className="d68-id-facts d68-id-facts--top">
          <Fact k={T(lang, 'Loại nhà đầu tư', 'Investor type')} v={labelInvestorType(inv.type, lang)} />
          <Fact k={T(lang, 'Quốc gia', 'Country')} v={labelCountry(inv.country_iso2 || inv.country, lang)} />
          <Fact k={T(lang, 'Khoản đầu tư / Ticket size', 'Ticket size')} v={ticket(lang, inv.ticket_min, inv.ticket_max)} />
          <Fact k={T(lang, 'Giai đoạn đầu tư', 'Investment stage')} v={labelStage(inv.stage, lang)} />
        </div>
      </article>
      <aside className="d68-id-side d68-id-side--top">
        <div className="d68-id-cta"><span>{T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</span><p>{T(lang, 'Gửi hồ sơ doanh nghiệp của bạn tới nhà đầu tư này để bắt đầu kết nối.', 'Send your business profile to this investor to start the connection workflow.')}</p><button onClick={sendProposal} disabled={proposalBusy || !!sentProposal}>{sentProposal ? T(lang, 'Đã gửi hồ sơ DN', 'Profile sent') : proposalBusy ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button><small>{sentProposal ? T(lang, 'Đã gửi. Theo dõi tại Dashboard DN → Proposal.', 'Sent. Track it in Business Dashboard → Proposals.') : T(lang, 'Proposal còn lại được kiểm tra trong Dashboard Business.', 'Remaining proposal quota is checked in the Business Dashboard.')}</small></div>
        <div className="d68-id-access"><h3>{T(lang, 'Ai xem được gì', 'Who can see what')}</h3><p>👤 {T(lang, 'Khách: chỉ thấy teaser ẩn danh', 'Guests: anonymous teaser only')}</p><p>🏢 {T(lang, 'DN đã trả phí: xem tiêu chí đầy đủ, gửi proposal', 'Paid businesses: view criteria and send proposals')}</p><p>✅ {T(lang, 'Sau khi duyệt: mở tên & thông tin liên hệ theo cài đặt', 'After approval: contact details unlock according to settings')}</p></div>
      </aside>
    </div>

    <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Thông tin Nhà đầu tư', 'Investor information')}</h2><div className="d68-id-facts">
      <Fact k={T(lang, 'Loại NĐT', 'Investor type')} v={labelInvestorType(inv.type, lang)} />
      <Fact k={T(lang, 'Quốc gia', 'Country')} v={labelCountry(inv.country_iso2 || inv.country, lang)} />
      <Fact k={T(lang, 'Khu vực', 'Region')} v={labelRegion(inv.region, lang)} />
      <Fact k={T(lang, 'Khoản đầu tư/Ticket size', 'Ticket size')} v={ticket(lang, inv.ticket_min, inv.ticket_max)} />
      <Fact k={T(lang, 'Giai đoạn đầu tư', 'Investment stage')} v={labelStage(inv.stage, lang)} />
      <Fact k={T(lang, 'Ngành quan tâm', 'Sectors')} v={industries.map((x) => labelIndustry(x, lang)).join(', ') || T(lang, 'Đang cập nhật', 'Updating')} />
    </div></section>

    <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}</h2><ul className="d68-id-bullets">{criteria.length ? criteria.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có tiêu chí chi tiết được Admin duyệt public.', 'No detailed Admin-approved criteria yet.')}</li>}</ul></section>

    <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Lịch sử nhận Proposal', 'Proposal history')}</h2>{history.length ? <div className="d68-id-timeline">{history.map((item, idx) => <div key={idx}><i /> <span>{T(lang, 'Đã nhận proposal từ', 'Received proposal from')} <b>{item}</b></span></div>)}</div> : <p className="d68-id-muted">{T(lang, 'Chưa có lịch sử proposal công khai được Admin duyệt.', 'No Admin-approved public proposal history yet.')}</p>}</section>

    <section className="d68-id-section d68-id-section--card"><h2>{T(lang, 'Thông tin liên hệ', 'Contact information')}</h2><p className="d68-id-muted">{T(lang, 'Chỉ Doanh nghiệp đã kết nối với Nhà đầu tư mới được xem.', 'Only businesses connected with this investor can view contact details.')}</p><div className="d68-id-contact-list">
      <ContactRow label={T(lang, 'Người liên hệ', 'Contact person')} value={contact?.name} unlocked={connected && !!contact?.name} />
      <ContactRow label="Email" value={contact?.email} unlocked={connected && !!contact?.email} />
      <ContactRow label={T(lang, 'Website', 'Website')} value={contact?.website} unlocked={connected && !!contact?.website} href={contact?.website} />
    </div></section>
    {msg ? <div className="d68-id-msg">{msg}</div> : null}
  </section></main>;
}

function Fact({ k, v }: { k: string; v: string }) { return <div className="d68-id-fact"><span>{k}</span><b>{v}</b></div>; }
function ContactRow({ label, value, unlocked, href }: { label: string; value?: string; unlocked: boolean; href?: string }) {
  const display = unlocked ? (href ? <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noreferrer">{value}</a> : value) : '🔒';
  return <div className={`d68-id-contact-row${unlocked ? ' unlocked' : ''}`}><span>{unlocked ? '✅' : '🔒'}</span><b>{label}</b><em>{display}</em></div>;
}
