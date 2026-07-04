import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
function arr(v: any): string[] { if (Array.isArray(v)) return v.filter(Boolean).map(String); if (!v) return []; return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean); }
function ticket(min: any, max: any) { const a = Number(min || 0), b = Number(max || 0); if (!a && !b) return 'TBD'; return `${formatCompactMoney(a, 'USD')} – ${formatCompactMoney(b, 'USD')}`; }
function criteriaList(criteria: any): string[] {
  if (!criteria || typeof criteria !== 'object') return [];
  return Object.entries(criteria).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v ?? '')}`).filter((x) => !x.endsWith(': '));
}

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
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
    [T(lang, 'Ngành quan tâm', 'Preferred industries'), industries.join(', ') || 'TBD'],
    [T(lang, 'Loại giao dịch', 'Deal types'), dealTypes.join(', ') || 'TBD'],
    [T(lang, 'Giai đoạn', 'Stage'), inv.stage || 'TBD'],
    [T(lang, 'Trạng thái xác minh', 'Verification status'), inv.verified === true ? T(lang, 'Đã xác minh', 'Verified') : T(lang, 'Chờ xác nhận', 'Pending')]
  ] : [];

  function sendProposal() {
    if (!profile) { navigate('/register/business'); return; }
    if (profile.role !== 'business') { setMsg(T(lang, 'Chỉ tài khoản Doanh nghiệp được gửi proposal.', 'Only Business accounts can send proposals.')); return; }
    setMsg(T(lang, 'Vui lòng gửi proposal từ Business Dashboard để hệ thống ghi nhận hạn mức/quota và workflow duyệt.', 'Please send proposals from the Business Dashboard so quota and approval workflow are recorded.'));
  }

  if (loading) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 32 }}>{T(lang, 'Đang tải hồ sơ thật từ database...', 'Loading live investor profile from database...')}</div></main>;
  if (error || !inv) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 32 }}><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p style={{ color: '#64748B' }}>{error}</p><Link to="/investors" style={{ color: '#1596cc', fontWeight: 700 }}>← {T(lang, 'Quay lại danh sách', 'Back to investors')}</Link></div></main>;

  return <main style={{ background: '#F7FAFC' }}>
    <section style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px 60px' }}>
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 18 }}><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to="/investors">{T(lang, 'Nhà đầu tư', 'Investors')}</Link> › <b style={{ color: '#475569' }}>{inv.code}</b></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 330px', gap: 24 }} className="d68-detail-cols">
        <article style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 28 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}><span style={{ background: '#E7F6FD', color: '#1596cc', fontWeight: 800, fontSize: 12, padding: '5px 10px', borderRadius: 7 }}>{inv.type || 'Investor'}</span>{inv.verified ? <span style={{ background: '#E9F9EF', color: '#16A34A', fontWeight: 800, fontSize: 12, padding: '5px 10px', borderRadius: 7 }}>✓ Verified</span> : null}</div>
          <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: '0 0 12px', letterSpacing: -.7 }}>{title}</h1>
          <p style={{ color: '#64748B', lineHeight: 1.65, margin: '0 0 22px' }}>{T(lang, inv.desc_vi || 'Hồ sơ ẩn danh đang được cập nhật tiêu chí đầu tư.', inv.desc_en || inv.desc_vi || 'Anonymous investor profile is being updated.')}</p>
          <Section title={T(lang, 'Thông tin chính', 'Key facts')}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }} className="d68-form-2">{facts.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</div></Section>
          <Section title={T(lang, 'Tiêu chí đầu tư từ database', 'Database-backed investment criteria')}><ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, color: '#334155' }}>{criteria.length ? criteria.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có tiêu chí chi tiết.', 'No detailed criteria yet.')}</li>}</ul></Section>
          <Section title={T(lang, 'Quyền xem thông tin', 'Information access')}><p style={{ color: '#64748B', lineHeight: 1.6 }}>{T(lang, 'Tên thật, email, số điện thoại, website và thông tin liên hệ riêng tư không hiển thị công khai. Những thông tin này chỉ được mở theo workflow duyệt kết nối và tùy chọn riêng tư của nhà đầu tư.', 'Real name, email, phone, website and private contact details are not public. They unlock only through approved connection workflow and investor privacy settings.')}</p></Section>
        </article>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 24 }}><div style={{ color: '#9db4cc', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{T(lang, 'Gửi proposal', 'Send proposal')}</div><h2 style={{ margin: '0 0 8px', color: '#F2B51D' }}>{ticket(inv.ticket_min, inv.ticket_max)}</h2><p style={{ color: '#c6d5e6', margin: 0 }}>{industries.join(', ') || 'Industries TBD'}</p><button onClick={sendProposal} style={{ width: '100%', marginTop: 18, border: 'none', borderRadius: 10, padding: 12, background: '#F2B51D', color: '#0F2A4A', fontWeight: 800 }}>{T(lang, 'Gửi hồ sơ DN', 'Send business profile')}</button></div>
          <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 22 }}><h3 style={{ margin: '0 0 12px' }}>{T(lang, 'Dữ liệu trung thực', 'Data integrity')}</h3><p style={{ color: '#64748B', lineHeight: 1.55 }}>{T(lang, 'Trang này không dùng lịch sử proposal, biểu đồ hay tiêu chí giả khi database chưa có dữ liệu backing.', 'This page does not use fake proposal history, charts or criteria when database backing data is missing.')}</p></div>
          {msg ? <div style={{ background: '#E7F6FD', border: '1px solid #BEE3F5', color: '#0F2A4A', borderRadius: 14, padding: 14, fontWeight: 600 }}>{msg}</div> : null}
        </aside>
      </div>
    </section>
  </main>;
}
function Section({ title, children }: { title: string; children: any }) { return <section style={{ borderTop: '1px solid #EEF2F6', paddingTop: 22, marginTop: 22 }}><h2 style={{ margin: '0 0 14px', fontSize: 20 }}>{title}</h2>{children}</section>; }
function Fact({ k, v }: { k: string; v: string }) { return <div style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: 13, background: '#F8FAFC' }}><div style={{ color: '#94A3B8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{k}</div><div style={{ fontWeight: 800, marginTop: 4 }}>{v}</div></div>; }
