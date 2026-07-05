import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode } from '../lib/data';
import { useAuth } from '../contexts/AuthContext';
import { toLocalizedPath } from '../lib/i18nRoutes';
import { formatMoneyForLang, labelCountry, labelDealType, labelIndustry, labelInvestorType, labelRegion, labelStage, T } from '../lib/labels';
import type { Lang } from '../lib/i18n';

function arr(v: any): string[] { if (Array.isArray(v)) return v.filter(Boolean).map(String); if (!v) return []; return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function ticket(lang: Lang, min: any, max: any) { const a = Number(min || 0), b = Number(max || 0); if (!a && !b) return T(lang, 'Đang cập nhật', 'Updating'); if (a && b) return `${formatMoneyForLang(a, 'USD', lang)} – ${formatMoneyForLang(b, 'USD', lang)}`; return b ? `≤ ${formatMoneyForLang(b, 'USD', lang)}` : `≥ ${formatMoneyForLang(a, 'USD', lang)}`; }
function criteriaList(criteria: any, lang: Lang): string[] {
  if (!criteria || typeof criteria !== 'object') return [];
  const out: string[] = [];
  if (Array.isArray(criteria.sectors)) out.push(`${T(lang, 'Lĩnh vực', 'Sectors')}: ${criteria.sectors.map((x: string) => labelIndustry(x, lang)).join(', ')}`);
  if (Array.isArray(criteria.dealTypes)) out.push(`${T(lang, 'Loại giao dịch', 'Deal types')}: ${criteria.dealTypes.map((x: string) => labelDealType(x, lang, true)).join(', ')}`);
  if (Array.isArray(criteria.preferredCountries)) out.push(`${T(lang, 'Khu vực', 'Markets')}: ${criteria.preferredCountries.map((x: string) => labelCountry(x, lang)).join(', ')}`);
  if (criteria.riskAppetite) out.push(`${T(lang, 'Khẩu vị rủi ro', 'Risk appetite')}: ${criteria.riskAppetite}`);
  if (criteria.returnExpectation) out.push(`${T(lang, 'Kỳ vọng lợi nhuận', 'Return expectation')}: ${criteria.returnExpectation}`);
  return out;
}

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = '' } = useParams(); const { profile } = useAuth(); const navigate = useNavigate();
  const [inv, setInv] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { let live = true; async function load() { setLoading(true); setError(''); setInv(null); try { const data = await getInvestorByCode(code); if (!live) return; if (!data) setError(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.', 'Investor profile not found or not public.')); else setInv(data); } catch (e: any) { if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ nhà đầu tư.', 'Could not load investor profile.')); } finally { if (live) setLoading(false); } } load(); return () => { live = false; }; }, [code, lang]);
  const title = inv ? T(lang, inv.title_vi || inv.code || 'Nhà đầu tư', inv.title_en || inv.title_vi || inv.code || 'Investor') : '';
  const industries = useMemo(() => arr(inv?.industries), [inv]);
  const dealTypes = useMemo(() => arr(inv?.deal_types), [inv]);
  const criteria = useMemo(() => criteriaList(inv?.criteria, lang), [inv, lang]);
  const markets = useMemo(() => {
    const fromCriteria = arr(inv?.criteria?.preferredCountries);
    return fromCriteria.length ? fromCriteria : [inv?.country_iso2 || inv?.country || 'Global'];
  }, [inv]);
  const facts = inv ? [
    [T(lang, 'Loại nhà đầu tư', 'Investor type'), labelInvestorType(inv.type, lang)],
    [T(lang, 'Quốc gia', 'Country'), labelCountry(inv.country_iso2 || inv.country, lang)],
    [T(lang, 'Khu vực', 'Region'), labelRegion(inv.region, lang)],
    [T(lang, 'Khoản đầu tư', 'Ticket'), ticket(lang, inv.ticket_min, inv.ticket_max)],
    [T(lang, 'Giai đoạn', 'Stage'), labelStage(inv.stage, lang)],
    [T(lang, 'Trạng thái xác minh', 'Verification status'), inv.verified === true ? T(lang, 'Đã xác minh', 'Verified') : T(lang, 'Chờ xác nhận', 'Pending')]
  ] : [];
  function sendProposal() { if (!profile) { navigate(toLocalizedPath('/register/business', lang)); return; } if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi proposal.', 'Only Business accounts can send proposals.')); return; } setMsg(T(lang, 'Vui lòng gửi proposal từ Business Dashboard để hệ thống ghi nhận hạn mức/quota và workflow duyệt.', 'Please send proposals from the Business Dashboard so quota and approval workflow are recorded.')); }
  if (loading) return <main className="d68-investor-detail"><div className="d68-id-state">{T(lang, 'Đang tải hồ sơ nhà đầu tư...', 'Loading investor profile...')}</div></main>;
  if (error || !inv) return <main className="d68-investor-detail"><div className="d68-id-state"><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p>{error}</p><Link to={toLocalizedPath('/investors', lang)}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></main>;
  return <main className="d68-investor-detail"><section className="d68-id-wrap">
    <div className="d68-id-breadcrumb"><Link to={toLocalizedPath('/', lang)}>{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to={toLocalizedPath('/investors', lang)}>{T(lang, 'Nhà đầu tư', 'Investors')}</Link> › <b>{inv.code}</b></div>
    <div className="d68-id-cols">
      <aside className="d68-id-left">
        <div className="d68-id-code-card"><span>{T(lang, 'Mã hồ sơ', 'Profile code')}</span><b>{inv.code}</b><small>{inv.verified ? T(lang, 'Đã xác minh', 'Verified') : T(lang, 'Chờ xác minh', 'Pending verification')}</small></div>
        <div className="d68-id-interest-card"><h3>{T(lang, 'Mức độ quan tâm', 'Interest scope')}</h3><div><span>{T(lang, 'Lĩnh vực', 'Sectors')}</span><b>{industries.map((x) => labelIndustry(x, lang)).join(', ') || T(lang, 'Đang cập nhật', 'Updating')}</b></div><div><span>{T(lang, 'Khu vực', 'Markets')}</span><b>{markets.map((x: string) => labelCountry(x, lang)).join(', ')}</b></div><div><span>{T(lang, 'Loại giao dịch', 'Deal types')}</span><b>{dealTypes.map((x) => labelDealType(x, lang, true)).join(', ') || T(lang, 'Đang cập nhật', 'Updating')}</b></div></div>
      </aside>

      <article className="d68-id-main">
        <div className="d68-id-badges"><span>{labelInvestorType(inv.type, lang)}</span>{inv.verified ? <span className="verified">✓ {T(lang, 'Xác minh', 'Verified')}</span> : null}</div>
        <h1>{title}</h1>
        <p>{T(lang, inv.desc_vi || 'Hồ sơ ẩn danh đang được cập nhật tiêu chí đầu tư.', inv.desc_en || inv.desc_vi || 'Anonymous investor profile is being updated.')}</p>
        <Section title={T(lang, 'Thông tin chính', 'Key facts')}><div className="d68-id-facts">{facts.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</div></Section>
        <Section title={T(lang, 'Tiêu chí đầu tư', 'Investment criteria')}><ul>{criteria.length ? criteria.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có tiêu chí chi tiết.', 'No detailed criteria yet.')}</li>}</ul></Section>
        <Section title={T(lang, 'Lịch sử nhận yêu cầu / proposal', 'Proposal request history')}><div className="d68-id-history"><div><b>{T(lang, 'Kênh nhận đề xuất', 'Proposal channel')}</b><span>{T(lang, 'Qua Deals68 workflow', 'Via Deals68 workflow')}</span></div><div><b>{T(lang, 'Trạng thái', 'Status')}</b><span>{T(lang, 'Sẵn sàng nhận hồ sơ doanh nghiệp phù hợp', 'Open to relevant business profiles')}</span></div><div><b>{T(lang, 'Chi tiết lịch sử', 'Detailed history')}</b><span>{T(lang, 'Chỉ hiển thị cho chủ hồ sơ/Admin sau đăng nhập', 'Visible only to the profile owner/Admin after login')}</span></div></div></Section>
      </article>

      <aside className="d68-id-side">
        <div className="d68-id-cta"><span>{T(lang, 'Gửi proposal', 'Send proposal')}</span><h2>{ticket(lang, inv.ticket_min, inv.ticket_max)}</h2><p>{industries.map((x) => labelIndustry(x, lang)).join(', ') || T(lang, 'Ngành đang cập nhật', 'Industries updating')}</p><button onClick={sendProposal}>{T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button></div>
        <div className="d68-id-locked"><h3>{T(lang, 'Quyền xem thông tin', 'Information access')}</h3><p>{T(lang, 'Tên thật, email, số điện thoại, website và thông tin liên hệ riêng tư không hiển thị công khai.', 'Real name, email, phone, website and private contact details are not public.')}</p><small>{T(lang, 'Chỉ mở sau workflow kết nối được duyệt.', 'Unlocked only after approved connection workflow.')}</small></div>
        <div className="d68-id-note"><h3>{T(lang, 'Bảo mật dữ liệu', 'Data privacy')}</h3><p>{T(lang, 'Trang public chỉ hiển thị teaser hồ sơ nhà đầu tư; thông tin riêng tư không public.', 'The public page shows only an investor teaser; private details are not public.')}</p></div>{msg ? <div className="d68-id-msg">{msg}</div> : null}
      </aside>
    </div>
  </section></main>;
}
function Section({ title, children }: { title: string; children: any }) { return <section className="d68-id-section"><h2>{title}</h2>{children}</section>; }
function Fact({ k, v }: { k: string; v: string }) { return <div className="d68-id-fact"><span>{k}</span><b>{v}</b></div>; }
