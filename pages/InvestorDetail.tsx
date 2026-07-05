import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';
import { localizedPath } from '../lib/i18nRoutes';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
function arr(v: any): string[] { if (Array.isArray(v)) return v.filter(Boolean).map(String); if (!v) return []; return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function ticket(min: any, max: any) { const a = Number(min || 0), b = Number(max || 0); if (!a && !b) return '—'; if (!a) return `≤ ${formatCompactMoney(b, 'USD')}`; if (!b) return `≥ ${formatCompactMoney(a, 'USD')}`; return `${formatCompactMoney(a, 'USD')} – ${formatCompactMoney(b, 'USD')}`; }
function criteriaList(criteria: any): string[] {
  if (!criteria || typeof criteria !== 'object') return [];
  return Object.entries(criteria).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v ?? '')}`).filter((x) => !x.endsWith(': '));
}
function activityLabel(lang: Lang, activity: any) {
  const v = String(activity || '').toLowerCase();
  if (v.includes('high') || v.includes('active')) return T(lang, 'Hoạt động cao', 'High activity');
  if (v.includes('medium')) return T(lang, 'Hoạt động vừa', 'Medium activity');
  if (v.includes('low')) return T(lang, 'Hoạt động thấp', 'Low activity');
  return T(lang, 'Đang cập nhật', 'Updating');
}
function initials(type: string) { return String(type || 'IN').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'IN'; }

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const to = (path: string) => localizedPath(path, lang);
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setInv(null);
      try {
        const data = await getInvestorByCode(code);
        if (!live) return;
        if (!data) setError(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư hoặc hồ sơ chưa public.', 'Investor profile not found or not public.'));
        else setInv(data);
      } catch (e: any) { if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ nhà đầu tư.', 'Could not load investor profile.')); }
      finally { if (live) setLoading(false); }
    }
    load(); return () => { live = false; };
  }, [code, lang]);

  const title = inv ? T(lang, inv.title_vi || inv.code || 'Nhà đầu tư', inv.title_en || inv.title_vi || inv.code || 'Investor') : '';
  const industries = useMemo(() => arr(inv?.industries), [inv]);
  const dealTypes = useMemo(() => arr(inv?.deal_types), [inv]);
  const criteria = useMemo(() => criteriaList(inv?.criteria), [inv]);
  const facts = inv ? [
    [T(lang, 'Mã hồ sơ', 'Profile code'), inv.code || '-'],
    [T(lang, 'Loại nhà đầu tư', 'Investor type'), inv.type || 'Investor'],
    [T(lang, 'Quốc gia', 'Country'), inv.country || inv.country_iso2 || 'Global'],
    [T(lang, 'Khu vực', 'Region'), inv.region || 'Global'],
    ['Ticket', ticket(inv.ticket_min, inv.ticket_max)],
    [T(lang, 'Ngành quan tâm', 'Preferred industries'), industries.join(', ') || '—'],
    [T(lang, 'Loại giao dịch', 'Deal types'), dealTypes.join(', ') || '—'],
    [T(lang, 'Giai đoạn', 'Stage'), inv.stage || '—'],
    [T(lang, 'Trạng thái xác minh', 'Verification status'), inv.verified === true ? T(lang, 'Đã xác minh', 'Verified') : T(lang, 'Chờ xác nhận', 'Pending')]
  ] : [];

  function sendProposal() {
    if (!profile) { navigate('/register/business'); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi proposal.', 'Only Business accounts can send proposals.')); return; }
    setMsg(T(lang, 'Vui lòng gửi proposal từ Business Dashboard để hệ thống ghi nhận hạn mức/quota và workflow duyệt.', 'Please send proposals from the Business Dashboard so quota and approval workflow are recorded.'));
  }

  if (loading) return <main className="d68-investor-detail-page"><section className="d68-investor-detail-shell"><div className="d68-investor-detail-card">{T(lang, 'Đang tải hồ sơ thật từ database...', 'Loading live investor profile from database...')}</div></section></main>;
  if (error || !inv) return <main className="d68-investor-detail-page"><section className="d68-investor-detail-shell"><div className="d68-investor-detail-card"><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p>{error}</p><Link to={to('/investors')}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></section></main>;

  return <main className="d68-investor-detail-page">
    <section className="d68-investor-detail-shell">
      <div className="d68-investor-detail-breadcrumb"><Link to={to('/')}>{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to={to('/investors')}>{T(lang, 'Nhà đầu tư', 'Investors')}</Link> › <b>{inv.code}</b></div>
      <div className="d68-investor-detail-cols">
        <article className="d68-investor-detail-main">
          <div className="d68-investor-detail-head">
            <div className="d68-investor-detail-avatar">{initials(inv.type)}</div>
            <div>
              <div className="d68-investor-detail-tags"><span>{inv.type || 'Investor'}</span>{inv.verified ? <span className="ok">✓ {T(lang, 'Đã xác minh', 'Verified')}</span> : null}<span className="activity">● {activityLabel(lang, inv.activity_level)}</span></div>
              <h1>{title}</h1>
              <p>{T(lang, inv.desc_vi || 'Hồ sơ ẩn danh đang được cập nhật tiêu chí đầu tư.', inv.desc_en || inv.desc_vi || 'Anonymous investor profile is being updated.')}</p>
            </div>
          </div>

          <Section title={T(lang, 'Thông tin chính', 'Key facts')}><div className="d68-investor-detail-facts">{facts.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</div></Section>
          <Section title={T(lang, 'Tiêu chí đầu tư từ database', 'Database-backed investment criteria')}><ul className="d68-investor-detail-list">{criteria.length ? criteria.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có tiêu chí chi tiết.', 'No detailed criteria yet.')}</li>}</ul></Section>
          <Section title={T(lang, 'Quyền xem thông tin', 'Information access')}><p className="d68-investor-detail-copy">{T(lang, 'Tên thật, email, số điện thoại, website và thông tin liên hệ riêng tư không hiển thị công khai. Những thông tin này chỉ được mở theo workflow duyệt kết nối và tùy chọn riêng tư của nhà đầu tư.', 'Real name, email, phone, website and private contact details are not public. They unlock only through approved connection workflow and investor privacy settings.')}</p></Section>
          <div className="d68-investor-detail-disclaimer"><b>{T(lang, 'Miễn trừ trách nhiệm', 'Disclaimer')}:</b> {T(lang, 'Hồ sơ nhà đầu tư là teaser công khai. Doanh nghiệp cần tự thẩm định và chỉ chia sẻ dữ liệu nhạy cảm theo quy trình kết nối được duyệt.', 'Investor profiles are public teasers. Businesses should conduct their own checks and share sensitive data only through approved connection workflows.')}</div>
        </article>

        <aside className="d68-investor-detail-side">
          <div className="d68-investor-detail-summary"><div>{T(lang, 'Ticket đầu tư', 'Investment ticket')}</div><h2>{ticket(inv.ticket_min, inv.ticket_max)}</h2><p>{industries.slice(0, 5).join(', ') || T(lang, 'Ngành đang cập nhật', 'Industries pending')}</p><button onClick={sendProposal}>{T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button></div>
          <div className="d68-investor-detail-card"><h3>{T(lang, 'Thông tin bị khóa', 'Locked information')}</h3><div className="d68-investor-lock-row"><span>🔒</span><b>{T(lang, 'Email riêng', 'Private email')}</b><em>Hidden</em></div><div className="d68-investor-lock-row"><span>🔒</span><b>{T(lang, 'Điện thoại', 'Phone')}</b><em>Hidden</em></div><div className="d68-investor-lock-row"><span>🔒</span><b>{T(lang, 'Tên cá nhân/pháp nhân', 'Legal/personal name')}</b><em>Hidden</em></div></div>
          <div className="d68-investor-detail-card"><h3>{T(lang, 'Dữ liệu trung thực', 'Data integrity')}</h3><p>{T(lang, 'Trang này không dùng lịch sử proposal, biểu đồ hay tiêu chí giả khi database chưa có dữ liệu backing.', 'This page does not use fake proposal history, charts or criteria when database backing data is missing.')}</p></div>
          {msg ? <div className="d68-investor-detail-message">{msg}</div> : null}
        </aside>
      </div>
    </section>
  </main>;
}
function Section({ title, children }: { title: string; children: any }) { return <section className="d68-investor-detail-section"><h2>{title}</h2>{children}</section>; }
function Fact({ k, v }: { k: string; v: string }) { return <div className="d68-investor-detail-fact"><span>{k}</span><b>{v}</b></div>; }
