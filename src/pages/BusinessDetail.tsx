import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBusinessBySlug, getInvestorByOwner, listBusinesses } from '../lib/data';
import { formatCompactMoney, formatMoney, percent } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import BusinessCard from '../components/BusinessCard';
import type { Lang } from '../lib/i18n';
import { t } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const criteriaLabels = [
  { key: 'profile_completeness', vi: 'Độ đầy đủ hồ sơ', en: 'Profile completeness' },
  { key: 'financial_data_quality', vi: 'Chất lượng dữ liệu tài chính', en: 'Financial data quality' },
  { key: 'data_source_confidence', vi: 'Độ tin cậy nguồn dữ liệu', en: 'Data source confidence' },
  { key: 'deal_terms_clarity', vi: 'Độ rõ ràng điều khoản deal', en: 'Deal terms clarity' },
  { key: 'documents_data_room', vi: 'Tài liệu & data room', en: 'Documents & data room' },
  { key: 'valuation_rationale', vi: 'Cơ sở định giá', en: 'Valuation rationale' },
  { key: 'growth_margin', vi: 'Tăng trưởng & biên lợi nhuận', en: 'Growth & margin' },
  { key: 'admin_reviewed', vi: 'Đã được admin rà soát', en: 'Admin reviewed' },
];

function scoreColor(score: number) {
  if (score >= 80) return 'green';
  if (score >= 65) return 'gold';
  if (score >= 50) return 'gray';
  return 'red';
}

function getBreakdown(b: any) {
  const raw = b?.quality_breakdown || {};
  return criteriaLabels.map((c, idx) => {
    const direct = raw[c.key] ?? raw[c.en] ?? raw[c.vi];
    const fallback = Math.max(45, Math.min(96, Number(b?.quality_score || 70) + ((idx % 4) - 1.5) * 5));
    return { ...c, score: Math.round(Number(direct ?? fallback)) };
  });
}

export default function BusinessDetail({ lang }: { lang: Lang }){
  const { slug } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [b, setB] = useState<any>();
  const [investor, setInvestor] = useState<any>();
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const isInvestor = profile?.role === 'investor';
  const isAdmin = profile?.role === 'admin';
  const canViewFullQuality = isInvestor || isAdmin;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!slug) return;
      setLoading(true); setErr('');
      try {
        const data = await getBusinessBySlug(slug);
        if (!mounted) return;
        setB(data);
        if (data?.industry) {
          listBusinesses({ industry: String(data.industry).split(';')[0] }).then(rows => {
            if (mounted) setSimilar((rows || []).filter((x:any)=>x.slug !== slug).slice(0,3));
          }).catch(()=>{});
        }
      } catch (e:any) {
        if (mounted) setErr(e?.message || 'Cannot load business detail');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [slug]);

  useEffect(() => {
    if (profile?.role === 'investor') getInvestorByOwner(profile.id).then(setInvestor).catch(()=>{});
  }, [profile?.id, profile?.role]);

  const title = lang === 'en' ? (b?.title_en || b?.title_vi) : (b?.title_vi || b?.title_en);
  const description = lang === 'en' ? (b?.description_en || b?.highlights_en) : (b?.description_vi || b?.highlights_vi);
  const highlights = lang === 'en' ? b?.highlights_en : b?.highlights_vi;
  const reason = lang === 'en' ? b?.investment_reason_en : b?.investment_reason_vi;
  const breakdown = useMemo(() => getBreakdown(b), [b?.id, b?.quality_score, b?.quality_breakdown]);
  const score = Number(b?.quality_score || 0);

  async function expressInterest(){
    if (!profile) { navigate('/login?next=' + location.pathname); return; }
    if (profile.role !== 'investor' || !investor) { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư mới bày tỏ quan tâm.', 'Only investor accounts can express interest.')); return; }
    const { error } = await supabase.from('investor_interests').upsert({ business_id:b.id, investor_id:investor.id, status:'interested' }, { onConflict:'business_id,investor_id' });
    setMsg(error ? error.message : T(lang, 'Đã gửi quan tâm. Doanh nghiệp/Admin sẽ xem xét kết nối.', 'Interest submitted. Business/Admin can review the connection.'));
  }

  async function save(){
    if (!profile) { navigate('/login?next=' + location.pathname); return; }
    if (!investor) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error } = await supabase.from('saved_businesses').upsert({ business_id:b.id, investor_id:investor.id }, { onConflict:'investor_id,business_id' });
    setMsg(error ? error.message : T(lang, 'Đã lưu vào dashboard nhà đầu tư.', 'Saved to your investor dashboard.'));
  }

  async function requestData(){
    if (!profile) { navigate('/login?next=' + location.pathname); return; }
    if (!investor) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error } = await supabase.from('request_data').insert({ business_id:b.id, investor_id:investor.id, requested_items:['IM','NDA','Financial statements'], note:'Investor requested IM/NDA from business detail.' });
    setMsg(error ? error.message : T(lang, 'Đã gửi yêu cầu dữ liệu tới Deals68/Admin và doanh nghiệp.', 'Data request sent to Deals68/Admin and the business.'));
  }

  if (loading) return <section className="section"><div className="container"><div className="empty">Loading...</div></div></section>;
  if (err || !b) return <section className="section"><div className="container"><div className="empty">{err || T(lang,'Không tìm thấy doanh nghiệp.','Business not found.')}</div></div></section>;

  return <>
    <section className="detail-hero detail-hero--beta">
      <div className="container detail-grid">
        <div className="detail-heading">
          <div className="pills"><span className="pill gold">{b.public_code || 'D68'}</span><span className={`pill ${scoreColor(score)}`}>Quality {score || '-'}/100</span><span className="pill gray">{b.industry}</span></div>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="detail-meta-row">
            <span>{b.city || 'Vietnam'}</span><span>•</span><span>{b.deal_type || T(lang,'Cơ hội đầu tư','Investment opportunity')}</span><span>•</span><span>{T(lang,'Hồ sơ ẩn danh','Anonymous profile')}</span>
          </div>
        </div>
        <aside className="deal-summary-card">
          <h3>{T(lang,'Tóm tắt thương vụ','Deal summary')}</h3>
          <div className="summary-grid">
            <div><span>{T(lang,'Doanh thu 2025E','2025E revenue')}</span><b>{formatMoney(b.revenue_2025,b.revenue_currency)}</b></div>
            <div><span>EBITDA</span><b>{percent(b.ebitda_margin)}</b></div>
            <div><span>{T(lang,'Nhu cầu','Ask')}</span><b>{formatMoney(b.ask_amount,b.ask_currency)}</b></div>
            <div><span>{T(lang,'Tỷ lệ chào','Stake')}</span><b>{percent(b.stake_pct)}</b></div>
          </div>
          <button className="btn blue block" onClick={expressInterest}>{t(lang,'expressInterest')}</button>
          <div className="deal-action-row"><button className="btn secondary" onClick={save}>{t(lang,'save')}</button><button className="btn secondary" onClick={requestData}>{t(lang,'requestData')}</button></div>
          {msg && <p className="notice ok">{msg}</p>}
        </aside>
      </div>
    </section>

    <section className="section"><div className="container detail-grid">
      <main>
        <div className="detail-image-card"><img className="deal-img" src={b.image_url || '/assets/deal1.png'} alt={title}/></div>
        <div className="card detail-section-card">
          <div className="card-body">
            <h2>{T(lang,'Điểm nổi bật','Highlights')}</h2>
            <p style={{whiteSpace:'pre-line'}}>{highlights || description}</p>
          </div>
        </div>
        <div className="card detail-section-card">
          <div className="card-body">
            <h2>{T(lang,'Lý do gọi vốn / chuyển nhượng','Use of funds / sale reason')}</h2>
            <p>{reason || T(lang,'Thông tin chi tiết sẽ được cập nhật sau khi hồ sơ được duyệt hoặc khi hai bên kết nối.','Details will be updated after review or approved connection.')}</p>
          </div>
        </div>
        <div className="card detail-section-card">
          <div className="card-body">
            <h2>{T(lang,'Bảng tài chính tóm tắt','Financial summary')}</h2>
            <table className="table"><tbody>
              <tr><th>{T(lang,'Doanh thu 2025E','2025E revenue')}</th><td>{formatMoney(b.revenue_2025,b.revenue_currency)}</td></tr>
              <tr><th>EBITDA margin</th><td>{percent(b.ebitda_margin)}</td></tr>
              <tr><th>{T(lang,'Nhu cầu vốn / giá trị','Ask amount')}</th><td>{formatMoney(b.ask_amount,b.ask_currency)}</td></tr>
              <tr><th>{T(lang,'Cổ phần / tỷ lệ chào','Stake offered')}</th><td>{percent(b.stake_pct)}</td></tr>
              <tr><th>{T(lang,'Độ tin cậy dữ liệu','Data confidence')}</th><td>{b.data_confidence ? `${b.data_confidence}/100` : T(lang,'Đang cập nhật','Updating')}</td></tr>
            </tbody></table>
          </div>
        </div>
      </main>

      <aside>
        <div className="card quality-card">
          <div className="card-body">
            <div className="quality-head"><div><span className="muted">Business Quality Score</span><h3>{score || '-'} / 100</h3></div><span className={`quality-circle ${scoreColor(score)}`}>{score || '-'}</span></div>
            <div className="score"><span style={{width:`${Math.max(3, Math.min(100, score))}%`}} /></div>
            {canViewFullQuality ? <div className="quality-list">
              {breakdown.map(c=><div key={c.key} className="quality-row"><span>{lang==='en'?c.en:c.vi}</span><b>{c.score}/100</b><i><em style={{width:`${c.score}%`}} /></i></div>)}
            </div> : <div className="quality-locked">
              <p className="notice warn">{t(lang,'onlyInvestorsQuality')}</p>
              <ul>{criteriaLabels.map(c=><li key={c.key}>{lang==='en'?c.en:c.vi}</li>)}</ul>
              <Link className="btn secondary block" to="/register/investor">{T(lang,'Đăng ký Nhà đầu tư để xem chi tiết','Register as investor to view details')}</Link>
            </div>}
          </div>
        </div>
        <div className="card data-room-card">
          <div className="card-body">
            <h3>{T(lang,'Data room bị khóa','Locked data room')}</h3>
            <p className="muted">{T(lang,'IM, NDA, báo cáo tài chính, pháp lý và thông tin liên hệ chỉ mở sau khi có đề xuất/kết nối được duyệt.','IM, NDA, financial, legal and contact details unlock only after approved proposal/connection.')}</p>
            <button className="btn gold block" onClick={requestData}>{T(lang,'Yêu cầu mở dữ liệu','Request data access')}</button>
          </div>
        </div>
      </aside>
    </div></section>

    {similar.length > 0 && <section className="section alt"><div className="container">
      <div className="section-title"><div><div className="badge-title blue">◆ {T(lang,'Thương vụ tương tự','Similar deals')}</div><h2>{T(lang,'Có thể bạn quan tâm','You may also like')}</h2></div><Link className="view-all" to="/businesses">{T(lang,'Xem tất cả','View all')} →</Link></div>
      <div className="grid">{similar.map((x,i)=><BusinessCard key={x.id || x.slug} b={x} lang={lang} index={i}/>)}</div>
    </div></section>}
  </>;
}
