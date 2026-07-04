import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

function iconForType(type?: string) {
  const t = String(type || '').toLowerCase();
  if (t.includes('strategic') || t.includes('corporate')) return '🌐';
  if (t.includes('family')) return '🏛️';
  if (t.includes('angel') || t.includes('individual')) return '👤';
  if (t.includes('lender') || t.includes('debt')) return '💳';
  if (t.includes('vc')) return '🚀';
  return '🏦';
}

function arrayValue(value: any): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  return [String(value)];
}

function criteriaRows(criteria: any) {
  if (!criteria || typeof criteria !== 'object') return [];
  if (Array.isArray(criteria)) return criteria.map((x, idx) => ({ label: String(x?.label || x?.name || `Criterion ${idx + 1}`), value: String(x?.value || x?.note || '') }));
  return Object.entries(criteria).slice(0, 8).map(([key, value]) => ({ label: key.replace(/_/g, ' '), value: Array.isArray(value) ? value.join(', ') : String(value ?? '') }));
}

export default function InvestorDetail({lang}:{lang:Lang}){
  const { code } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [inv,setInv] = useState<any>();
  const [loading,setLoading] = useState(true);
  const [msg,setMsg] = useState('');
  const isAdmin = profile?.role === 'admin';
  const isBusiness = profile?.role === 'business';

  useEffect(()=>{
    let active = true;
    if (!code) return;
    setLoading(true);
    getInvestorByCode(code).then(data=>{ if(active) setInv(data); }).finally(()=>{ if(active) setLoading(false); });
    return () => { active = false; };
  },[code]);

  function sendProposal(){
    if(!profile){ navigate('/login?next=' + encodeURIComponent(location.pathname)); return; }
    if(!isBusiness && !isAdmin){ setMsg(T(lang, 'Chỉ tài khoản doanh nghiệp mới có thể gửi đề xuất cho nhà đầu tư.', 'Only business accounts can send proposals to investors.')); return; }
    setMsg(T(lang, 'Tính năng gửi đề xuất sẽ được kích hoạt ở dashboard doanh nghiệp trong bản Beta tiếp theo. Hiện admin có thể hỗ trợ kết nối thủ công.', 'Proposal sending will be enabled from the business dashboard in the next Beta. Admin can currently support manual matching.'));
  }

  if(loading) return <section className="section"><div className="container empty">{T(lang,'Đang tải hồ sơ nhà đầu tư...','Loading investor profile...')}</div></section>;
  if(!inv) return <section className="section"><div className="container empty">{T(lang,'Không tìm thấy hồ sơ nhà đầu tư.','Investor profile not found.')}</div></section>;

  const title = lang === 'en' ? (inv.title_en || inv.title_vi || inv.type) : (inv.title_vi || inv.title_en || inv.type);
  const desc = lang === 'en' ? inv.desc_en : inv.desc_vi;
  const industries = arrayValue(inv.industries);
  const dealTypes = arrayValue(inv.deal_types);
  const rows = criteriaRows(inv.criteria);
  const ticket = `${formatCompactMoney(inv.ticket_min,'USD')}–${formatCompactMoney(inv.ticket_max,'USD')}`;

  return <>
    <section className="detail-hero--beta investor-detail-hero">
      <div className="container detail-grid">
        <div className="detail-heading investor-heading">
          <div className="investor-detail-icon">{iconForType(inv.type)}</div>
          <div className="pills"><span className="pill gold">{inv.code}</span><span className="pill">{inv.type}</span>{inv.verified && <span className="pill green">✓ {T(lang,'Xác minh','Verified')}</span>}{inv.admin_priority && <span className="pill gold">★ Priority</span>}</div>
          <h1>{title}</h1>
          <p>{desc || T(lang,'Hồ sơ nhà đầu tư ẩn danh đang tìm kiếm các thương vụ phù hợp trên Deals68.', 'Anonymous investor profile looking for suitable deals on Deals68.')}</p>
          <div className="detail-meta-row"><span>{inv.country || inv.country_iso2}</span><span>•</span><span>{inv.region || T(lang,'Khu vực linh hoạt','Flexible geography')}</span><span>•</span><span>{inv.activity_level || T(lang,'Đang hoạt động','Active')}</span></div>
        </div>
        <aside className="deal-summary-card">
          <h3>{T(lang,'Khẩu vị đầu tư','Investment appetite')}</h3>
          <div className="summary-grid"><div><span>Ticket</span><b>{ticket}</b></div><div><span>{T(lang,'Giai đoạn','Stage')}</span><b>{inv.stage || '-'}</b></div><div><span>{T(lang,'Quốc gia','Country')}</span><b>{inv.country || inv.country_iso2 || '-'}</b></div><div><span>{T(lang,'Trạng thái','Status')}</span><b>{inv.verified ? T(lang,'Đã xác minh','Verified') : T(lang,'Đang hoạt động','Active')}</b></div></div>
          <button className="btn blue block" onClick={sendProposal}>{T(lang,'Gửi đề xuất kết nối','Send proposal')}</button>
          <Link className="btn secondary block" style={{marginTop:10}} to="/businesses">{T(lang,'Xem DN phù hợp','Browse matching businesses')}</Link>
          {msg && <p className="notice" style={{marginTop:12}}>{msg}</p>}
        </aside>
      </div>
    </section>

    <section className="section alt">
      <div className="container detail-grid">
        <main>
          <div className="card detail-section-card" style={{marginTop:0}}><div className="card-body">
            <h2>{T(lang,'Ngành & hình thức quan tâm','Sector and deal preferences')}</h2>
            <div className="tag-cloud"><div><b>{T(lang,'Ngành quan tâm','Sectors')}</b><p>{industries.length ? industries.map(x=><span className="pill green" key={x}>{x}</span>) : <span className="muted">-</span>}</p></div><div><b>{T(lang,'Hình thức đầu tư','Deal types')}</b><p>{dealTypes.length ? dealTypes.map(x=><span className="pill" key={x}>{x}</span>) : <span className="muted">-</span>}</p></div></div>
          </div></div>

          <div className="card detail-section-card"><div className="card-body">
            <h2>{T(lang,'Tiêu chí đầu tư','Investment criteria')}</h2>
            {rows.length ? <div className="criteria-grid">{rows.map(row=><div className="criteria-item" key={row.label}><span>{row.label}</span><b>{row.value || '-'}</b></div>)}</div> : <p className="muted">{T(lang,'Nhà đầu tư chưa công khai tiêu chí chi tiết. Business có thể gửi đề xuất để admin hỗ trợ xác minh khẩu vị.', 'The investor has not published detailed criteria. Businesses can submit a proposal for admin-assisted matching.')}</p>}
          </div></div>
        </main>

        <aside>
          <div className="card privacy-card"><div className="card-body">
            <h3>🔒 {T(lang,'Bảo mật & ẩn danh','Privacy & anonymisation')}</h3>
            <p>{T(lang,'Deals68 chỉ hiển thị hồ sơ teaser. Tên thật, website, email, số điện thoại và người liên hệ không được gửi xuống frontend ở trang công khai.', 'Deals68 only shows teaser profiles. Real name, website, email, phone and contact person are not sent to the public frontend.')}</p>
            <ul>
              <li>{T(lang,'Ẩn danh nhà đầu tư trên public listing.', 'Anonymous investor listing.')}</li>
              <li>{T(lang,'Business chưa được duyệt kết nối không thấy contact thật.', 'Businesses without approved connection cannot see real contact data.')}</li>
              <li>{T(lang,'Admin quản lý dữ liệu thật trong dashboard riêng.', 'Admins manage real-source data in a separate dashboard.')}</li>
            </ul>
            <div className="notice warn">{T(lang,'Email nhà đầu tư không bao giờ render trên trang public/business surface.', 'Investor email is never rendered on public/business-facing surfaces.')}</div>
          </div></div>

          <div className="card data-room-card"><div className="card-body">
            <h3>{T(lang,'Kết nối có kiểm soát','Controlled connection')}</h3>
            <p className="muted">{T(lang,'Business gửi đề xuất → Admin kiểm tra → Nhà đầu tư duyệt → mới mở thêm thông tin theo quyền được cấu hình.', 'Business submits proposal → Admin reviews → Investor approves → additional information unlocks based on configured permissions.')}</p>
            <Link className="btn secondary block" to="/pricing">{T(lang,'Xem gói Business','View Business plans')}</Link>
          </div></div>
        </aside>
      </div>
    </section>
  </>;
}
