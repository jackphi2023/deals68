import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMyBusiness, uploadBusinessFile, uploadBusinessImage } from '../lib/data';
import { supabase } from '../lib/supabase';
import { autoEnglishFromVietnamese } from '../lib/i18n';
import { formatCompactMoney, percent } from '../lib/format';

type Tab = 'overview' | 'profile' | 'documents' | 'images' | 'datacenter' | 'interests' | 'requests' | 'services';
const T = (lang: 'vi' | 'en', vi: string, en: string) => lang === 'en' ? en : vi;
const tabs: { id: Tab; icon: string; vi: string; en: string; href: string }[] = [
  { id: 'overview', icon: '◎', vi: 'Tổng quan', en: 'Overview', href: '/dashboard/business' },
  { id: 'profile', icon: '✎', vi: 'Hồ sơ', en: 'Profile', href: '/dashboard/business/profile' },
  { id: 'documents', icon: '📂', vi: 'Tài liệu', en: 'Documents', href: '/dashboard/business/files' },
  { id: 'images', icon: '🖼', vi: 'Ảnh', en: 'Images', href: '/dashboard/business/images' },
  { id: 'datacenter', icon: '◆', vi: 'Data Center', en: 'Data Center', href: '/dashboard/business/financials' },
  { id: 'interests', icon: '🤝', vi: 'Nhà đầu tư', en: 'Investors', href: '/dashboard/business/investor-interest' },
  { id: 'requests', icon: '📨', vi: 'Yêu cầu data', en: 'Data requests', href: '/dashboard/business/data-requests' },
  { id: 'services', icon: '💳', vi: 'Dịch vụ & phí', en: 'Services', href: '/dashboard/business/payments' }
];

const tabMap: Record<string, Tab> = { '': 'overview', profile: 'profile', files: 'documents', documents: 'documents', images: 'images', financials: 'datacenter', valuation: 'datacenter', 'investor-interest': 'interests', interests: 'interests', proposals: 'interests', 'data-requests': 'requests', requests: 'requests', payments: 'services', plan: 'services', services: 'services' };
function resolveTab(pathname: string): Tab { const suffix = pathname.replace('/dashboard/business','').replace(/^\//,'').split('/')[0]; return tabMap[suffix] || 'overview'; }

const inputStyle: CSSProperties = { border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 13px', fontSize: 15, color: '#0F2A4A', background: '#F7FAFC', fontWeight: 500, outline: 'none', width: '100%' };
const cardStyle: CSSProperties = { background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '22px 24px' };
const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const labelText: CSSProperties = { fontSize: 12.5, fontWeight: 700, color: '#334155' };

function metricCard(label: string, value: string, color = '#0F2A4A') {
  return <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: 18 }}>
    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6, color }}>{value}</div>
  </div>;
}

function qBand(score: number) {
  if (score >= 80) return { labelVi: 'Mạnh', labelEn: 'Strong', color: '#16A34A', bg: '#E9F9EF' };
  if (score >= 65) return { labelVi: 'Tốt', labelEn: 'Good', color: '#1596cc', bg: '#E7F6FD' };
  return { labelVi: 'Cần bổ sung', labelEn: 'Needs data', color: '#B8860B', bg: '#FEF3D3' };
}

export default function BusinessDashboard() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [b, setB] = useState<any>();
  const [files, setFiles] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('financials');
  const [newDocVisibility, setNewDocVisibility] = useState('locked');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (!profile) return;
    setBusy(true); setLoadError('');
    try {
      const biz = await getMyBusiness(profile.id);
      setB(biz);
      if (biz) {
        const [{ data: f }, { data: im }, { data: req }, { data: int }] = await Promise.all([
          supabase.from('business_files').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('business_images').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('request_data').select('*, investors(code,title_en,title_vi,type,country,privacy)').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('investor_interests').select('*, investors(id,code,title_en,title_vi,type,country,industries,deal_types,ticket_min,ticket_max,privacy)').eq('business_id', biz.id).order('created_at', { ascending: false })
        ]);
        setFiles(f || []); setImages(im || []); setRequests(req || []); setInterests(int || []);
      }
    } catch (e: any) { setLoadError(e?.message || 'Could not load dashboard data.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (!loading && !profile) navigate('/login?next=/dashboard/business'); if (profile) load(); }, [profile?.id, loading]);

  if (loading) return <section style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 24px' }}><div style={cardStyle}>Loading...</div></section>;
  if (!profile) return <Navigate to="/login?next=/dashboard/business" replace />;
  if (profile.role !== 'business' && profile.role !== 'admin') return <section style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px' }}><div style={cardStyle}><h2>Business access only</h2><p>Role hiện tại: {profile.role}</p><Link to="/" style={{ color: '#1596cc', fontWeight: 700 }}>Back home</Link></div></section>;
  if (!b) return <section style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px' }}><div style={{ ...cardStyle, textAlign: 'center' }}><h2>Business profile not found</h2><p style={{ color: '#64748B' }}>Tài khoản này chưa có hồ sơ DN hoặc đang chờ admin kích hoạt.</p><Link to="/register/business" style={{ display: 'inline-block', background: '#0F2A4A', color: '#fff', fontWeight: 700, padding: '12px 22px', borderRadius: 10 }}>Tạo hồ sơ DN</Link></div></section>;

  const score = Math.round(Number(b.quality_score || b.data_confidence || 0));
  const band = qBand(score);
  const quotaTotal = Number(b.quota_total || (String(b.plan || '').includes('featured') ? 200 : 100));
  const quotaUsed = Number(b.quota_used || 0);
  const quotaRemaining = Math.max(0, quotaTotal - quotaUsed);
  const quotaPct = Math.min(100, Math.round((quotaUsed / Math.max(1, quotaTotal)) * 100));
  const planLabel = String(b.plan || 'Standard');
  const statusLabel = String(b.status || 'Live');
  const title = b.company_name_private || b.title_vi || b.title_en || 'Business profile';

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const pending: any = {
      company_name_private: fd.get('company_name_private'),
      title_vi: fd.get('title_vi'),
      title_en: autoEnglishFromVietnamese(String(fd.get('title_vi') || '')),
      description_vi: fd.get('description_vi'),
      description_en: autoEnglishFromVietnamese(String(fd.get('description_vi') || '')),
      industry: fd.get('industry'),
      deal_type: fd.get('deal_type'),
      city: fd.get('city'),
      highlights_vi: fd.get('highlights_vi'),
      highlights_en: autoEnglishFromVietnamese(String(fd.get('highlights_vi') || '')),
      investment_reason_vi: fd.get('investment_reason_vi'),
      investment_reason_en: autoEnglishFromVietnamese(String(fd.get('investment_reason_vi') || '')),
      revenue_2025: Number(fd.get('revenue_2025') || 0),
      ebitda_margin: Number(fd.get('ebitda_margin') || 0),
      ask_amount: Number(fd.get('ask_amount') || 0),
      stake_pct: Number(fd.get('stake_pct') || 0),
      data_confidence: Number(fd.get('data_confidence') || 70)
    };
    const { error } = await supabase.from('businesses').update({ pending_changes_json: pending, status: 'pending_admin_review' }).eq('id', b.id);
    setMsg(error ? error.message : T(lang, 'Đã lưu thay đổi, chờ Admin duyệt lại.', 'Saved changes, pending Admin re-review.'));
    await load();
  }

  async function fileChange(e: any) {
    const file = e.target.files?.[0]; if (!file || !b || !profile) return;
    setBusy(true);
    try { await uploadBusinessFile(b.id, profile.id, file, newDocCategory, newDocVisibility); setMsg('File uploaded successfully.'); await load(); }
    catch (err: any) { setMsg(err?.message || 'Upload failed.'); }
    finally { setBusy(false); e.target.value = ''; }
  }

  async function imageChange(e: any) {
    const file = e.target.files?.[0]; if (!file || !b || !profile) return;
    setBusy(true);
    try { await uploadBusinessImage(b.id, profile.id, file, file.name); setMsg('Image uploaded successfully.'); await load(); }
    catch (err: any) { setMsg(err?.message || 'Upload failed.'); }
    finally { setBusy(false); e.target.value = ''; }
  }

  async function acceptInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'connected' }).eq('id', row.id); setMsg(error ? error.message : 'Đã đồng ý kết nối.'); load(); }
  async function rejectInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'rejected' }).eq('id', row.id); setMsg(error ? error.message : 'Đã từ chối kết nối.'); load(); }
  async function fulfillRequest(row: any) { const { error } = await supabase.from('request_data').update({ status: 'fulfilled' }).eq('id', row.id); setMsg(error ? error.message : 'Marked as fulfilled.'); load(); }

  return <div style={{ width: '100%', overflowX: 'hidden', background: '#F7FAFC' }}>
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '26px 24px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Business Dashboard</div>
          <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -.5, margin: 0 }}>{title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} style={{ border: '1px solid #E2E8F0', background: '#fff', borderRadius: 999, padding: '8px 14px', fontWeight: 700 }}>{lang.toUpperCase()}</button>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 8, background: planLabel.toLowerCase().includes('featured') ? '#FEF3D3' : '#EAF0F6', color: planLabel.toLowerCase().includes('featured') ? '#B8860B' : '#0F2A4A' }}>{planLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 8, background: '#E9F9EF', color: '#16A34A' }}>{statusLabel}</span>
          <button onClick={() => signOut().then(() => navigate('/'))} style={{ background: '#EEF2F6', color: '#334155', fontWeight: 700, fontSize: 14, padding: '10px 16px', borderRadius: 9, border: 'none' }}>{T(lang, 'Thoát', 'Exit')}</button>
        </div>
      </div>

      <div className="d68-dash-cols" style={{ display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
        <nav className="d68-side-nav" style={{ position: 'sticky', top: 90, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tabs.map((t) => <Link key={t.id} to={t.href} onClick={() => setTab(t.id)} style={{ textAlign: 'left', border: 'none', borderRadius: 10, padding: '11px 12px', fontSize: 13.5, fontWeight: tab === t.id ? 800 : 600, color: tab === t.id ? '#0F2A4A' : '#64748B', background: tab === t.id ? '#E7F6FD' : 'transparent' }}>{t.icon} {T(lang, t.vi, t.en)}</Link>)}
          <div style={{ borderTop: '1px solid #EEF2F6', marginTop: 6, paddingTop: 10 }}><Link to={`/businesses/${b.slug}`} style={{ display: 'block', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1596cc', padding: 10 }}>{T(lang, 'Xem trang public', 'View public page')} ↗</Link></div>
          <div style={{ marginTop: 8, background: '#FEFCE8', border: '2px solid #0F2A4A', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', lineHeight: 1.5 }}>{T(lang, 'Bạn cần hỗ trợ làm Hồ sơ Huy động vốn, Định giá để làm việc với Nhà đầu tư?', 'Need help preparing your fundraising profile & valuation to work with investors?')}</div>
            <a href="https://vietcapitalpartners.com" target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#1596cc' }}>vietcapitalpartners.com ↗</a>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F2A4A', marginTop: 6 }}>Hotline: 0909.584.075</div>
          </div>
        </nav>

        <main>
          {b.pending_changes_json ? <div style={{ background: '#FEF3D3', border: '1px solid #F2B51D', borderRadius: 14, padding: '16px 20px', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}><span style={{ fontSize: 20 }}>⏳</span><div><b style={{ color: '#8a6300' }}>{T(lang, 'Hồ sơ đang chờ Admin duyệt lại', 'Profile is pending Admin re-review')}</b><div style={{ fontSize: 13, color: '#8a6300', marginTop: 3 }}>{T(lang, 'Hồ sơ tạm dừng nhận proposal mới cho tới khi Admin duyệt lại.', 'The listing pauses new proposals until Admin re-approves it.')}</div></div></div> : null}
          {loadError ? <div style={{ ...cardStyle, marginBottom: 16, color: '#B91C1C' }}>{loadError}</div> : null}
          {msg ? <div style={{ ...cardStyle, marginBottom: 16, color: '#16A34A', fontWeight: 700 }}>{msg}</div> : null}
          {busy ? <div style={{ ...cardStyle, marginBottom: 16, color: '#64748B' }}>{T(lang, 'Đang xử lý dữ liệu...', 'Processing data...')}</div> : null}

          {tab === 'overview' ? <>
            <div style={{ ...cardStyle, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0, width: 120, height: 120, borderRadius: '50%', background: `conic-gradient(${band.color} ${Math.max(0, Math.min(100, score)) * 3.6}deg, #EEF2F6 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 92, height: 92, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 29, fontWeight: 800, color: band.color }}>{score}</span><span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>/ 100</span></div>
              </div>
              <div style={{ flex: 1, minWidth: 250 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}><span style={{ fontSize: 15.5, fontWeight: 800 }}>Business Quality Score</span><span style={{ fontSize: 12, fontWeight: 800, padding: '6px 10px', borderRadius: 8, color: band.color, background: band.bg }}>{T(lang, band.labelVi, band.labelEn)}</span></div><p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: '0 0 12px' }}>{T(lang, 'Điểm tổng hợp từ hồ sơ, tài chính, tài liệu, hình ảnh, data room và thẩm định Admin.', 'Composite score from profile, financials, documents, images, data room and Admin review.')}</p></div>
            </div>
            <div className="d68-cards-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>{metricCard(T(lang,'Trạng thái hồ sơ','Profile status'), statusLabel, '#16A34A')}{metricCard(T(lang,'Gói hiển thị','Plan tier'), planLabel)}{metricCard(T(lang,'Đã gửi / Duyệt','Sent / Approved'), `${quotaUsed} / ${interests.filter((x) => x.status === 'connected').length}`)}{metricCard(T(lang,'Lượt xem hồ sơ','Profile views'), String(Number(b.views || 0)))}</div>
            <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 16, padding: 24, marginBottom: 22 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#c6d5e6' }}>{T(lang,'Hạn mức gửi Proposal','Proposal quota')}</span><span style={{ fontSize: 18, fontWeight: 800, color: '#F2B51D' }}>{quotaUsed} / {quotaTotal}</span></div><div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${quotaPct}%`, background: 'linear-gradient(90deg,#1BADEA,#F2B51D)', borderRadius: 999 }} /></div><p style={{ fontSize: 12.5, color: '#9db4cc', margin: '12px 0 0' }}>{T(lang, `Còn ${quotaRemaining}/${quotaTotal} proposal.`, `${quotaRemaining}/${quotaTotal} proposals remaining.`)} <Link to="/investors" style={{ color: '#F2B51D', fontWeight: 700 }}>{T(lang,'Tìm Nhà đầu tư','Find investors')} →</Link></p></div>
            <div style={cardStyle}><h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 14px' }}>{T(lang, 'Thanh toán', 'Payment')}</h3><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#E9F9EF', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#16A34A' }}><span>✓ {T(lang, `Đã thanh toán — gói ${planLabel}`, `Paid — ${planLabel} plan`)}</span><Link to="/pricing" style={{ color: '#16A34A', textDecoration: 'underline', fontWeight: 700, fontSize: 13 }}>{T(lang,'Gia hạn / Nâng cấp','Renew / Upgrade')}</Link></div></div>
          </> : null}

          {tab === 'profile' || tab === 'datacenter' ? <form onSubmit={saveProfile} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{tab === 'profile' ? T(lang, 'Chỉnh sửa hồ sơ', 'Edit profile') : 'Business Data Center'}</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 4px', lineHeight: 1.55 }}>{T(lang, 'Tiêu đề hiển thị công khai (VI/EN) do Admin biên soạn để đảm bảo ẩn danh & chuẩn SEO — bạn cập nhật dữ liệu gốc và số liệu.', 'Public VI/EN title is curated by Admin to stay anonymous & SEO-ready — update source data and numbers.')}</p>
            <div style={{ background: '#F7FAFC', border: '1px solid #EEF2F6', borderRadius: 12, padding: '14px 16px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{T(lang,'Tiêu đề công khai','Public title')}</div><div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{b.title_vi || b.title_en}</div></div>
            <label style={labelStyle}><span style={labelText}>{T(lang,'Tên doanh nghiệp (thật — chỉ Admin thấy)','Business name (real — Admin only)')}</span><input name="company_name_private" defaultValue={b.company_name_private || ''} style={inputStyle} /></label>
            <label style={labelStyle}><span style={labelText}>{T(lang,'Tiêu đề / mô tả hồ sơ','Profile title')}</span><input name="title_vi" defaultValue={b.title_vi || ''} style={inputStyle} /></label>
            <div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><label style={labelStyle}><span style={labelText}>{T(lang,'Ngành','Industry')}</span><input name="industry" defaultValue={b.industry || ''} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Thành phố','City')}</span><input name="city" defaultValue={b.city || ''} style={inputStyle} /></label></div>
            <label style={labelStyle}><span style={labelText}>{T(lang,'Tổng quan doanh nghiệp','Business overview')}</span><textarea name="description_vi" defaultValue={b.description_vi || ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <label style={labelStyle}><span style={labelText}>{T(lang,'Điểm nổi bật','Highlights')}</span><textarea name="highlights_vi" defaultValue={b.highlights_vi || ''} rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <div style={{ borderTop: '1px solid #EEF2F6', paddingTop: 16 }}><div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>{T(lang,'Giao dịch & tài chính','Deal & financials')}</div><div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><label style={labelStyle}><span style={labelText}>{T(lang,'Phân khúc giao dịch','Deal segment')}</span><input name="deal_type" defaultValue={b.deal_type || ''} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Doanh thu năm gần nhất','Latest annual sales')}</span><input name="revenue_2025" type="number" defaultValue={b.revenue_2025 || 0} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>EBITDA / profit margin (%)</span><input name="ebitda_margin" type="number" defaultValue={b.ebitda_margin || 0} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Tăng trưởng / độ tin cậy dữ liệu','Data confidence')}</span><input name="data_confidence" type="number" defaultValue={b.data_confidence || 70} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Tỷ lệ cổ phần tối đa bán / pha loãng (%)','Max stake to sell / dilute (%)')}</span><input name="stake_pct" type="number" defaultValue={b.stake_pct || 0} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Số tiền gọi vốn / giá trị giao dịch','Amount sought / asking')}</span><input name="ask_amount" type="number" defaultValue={b.ask_amount || 0} style={inputStyle} /></label></div><label style={{ ...labelStyle, marginTop: 16 }}><span style={labelText}>{T(lang,'Lý do gọi vốn / bán / cách dùng tiền','Reason for raise / sale / use of funds')}</span><textarea name="investment_reason_vi" defaultValue={b.investment_reason_vi || ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></label></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14.5, padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>{T(lang,'Lưu thay đổi','Save changes')}</button></div>
          </form> : null}

          {tab === 'documents' ? <div style={cardStyle}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{T(lang,'Tài liệu doanh nghiệp','Business documents')}</h2><p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 20px' }}>{T(lang,'Tài liệu nhạy cảm (khóa) chỉ mở cho Nhà đầu tư sau khi proposal được duyệt. Hỗ trợ PDF, Excel, PowerPoint, Word.', 'Locked documents unlock for investors only after a proposal is approved. PDF, Excel, PowerPoint, Word supported.')}</p><div style={{ display: 'flex', flexDirection: 'column' }}>{files.map((d) => <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid #F1F5F9' }}><span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 9, background: '#E9F9EF', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📄</span><div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 600 }}>{d.filename || d.name}</div><div style={{ fontSize: 12, color: '#94A3B8' }}>{d.category || 'financials'} · {d.visibility || 'locked'}</div></div></div>)}{!files.length ? <div style={{ color: '#94A3B8', padding: '20px 0' }}>{T(lang,'Chưa có tài liệu.','No documents yet.')}</div> : null}</div><div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid #EEF2F6' }}><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}><label style={{ ...labelStyle, flex: 1, minWidth: 180 }}><span style={labelText}>{T(lang,'Tên tài liệu','Document name')}</span><input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder={T(lang,'Báo cáo tài chính 2024-2025','Financial report 2024-2025')} style={inputStyle} /></label><label style={labelStyle}><span style={labelText}>{T(lang,'Danh mục','Category')}</span><select value={newDocCategory} onChange={(e) => setNewDocCategory(e.target.value)} style={inputStyle}><option value="financials">Financials</option><option value="profile">Profile</option><option value="im">Teaser / IM</option><option value="legal">Legal</option><option value="other">Other</option></select></label><label style={labelStyle}><span style={labelText}>{T(lang,'Hiển thị','Visibility')}</span><select value={newDocVisibility} onChange={(e) => setNewDocVisibility(e.target.value)} style={inputStyle}><option value="locked">🔒 Locked</option><option value="public">🌐 Public</option></select></label><label style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '12px 20px', borderRadius: 9, cursor: 'pointer' }}>+ {T(lang,'Tải lên','Upload')}<input type="file" onChange={fileChange} style={{ display: 'none' }} /></label></div></div></div> : null}

          {tab === 'images' ? <div style={cardStyle}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{T(lang,'Ảnh doanh nghiệp','Business images')}</h2><p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 18px' }}>{T(lang,'Tối đa 6 ảnh, khuyến nghị 1600×900px. Admin có thể làm mờ tên/logo nhạy cảm.', 'Up to 6 images, recommended 1600×900px. Admin can blur sensitive names/logos.')}</p><div className="d68-form-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>{[0,1,2,3,4,5].map((i) => { const img = images[i]; return <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><div style={{ height: 150, border: '1px dashed #CBD5E1', borderRadius: 10, background: '#F7FAFC', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>{img?.public_url || img?.url ? <img src={img.public_url || img.url} alt={img.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : T(lang,'Kéo ảnh vào đây','Drop image here')}</div><label style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, background: '#fff', cursor: 'pointer', textAlign: 'center' }}>{T(lang,'Chọn ảnh','Choose image')}<input type="file" accept="image/*" onChange={imageChange} style={{ display: 'none' }} /></label></div>; })}</div></div> : null}

          {tab === 'interests' ? <div style={cardStyle}><h2>{T(lang,'Nhà đầu tư quan tâm','Investor interests')}</h2>{interests.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{interests.map((row) => <div key={row.id} style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 220 }}><b>{row.investors?.title_vi || row.investors?.title_en || row.investors?.code}</b><div style={{ fontSize: 12, color: '#94A3B8' }}>{row.investors?.type} · {row.status}</div></div><button onClick={() => acceptInterest(row)} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 13px', fontWeight: 700 }}>{T(lang,'Duyệt','Approve')}</button><button onClick={() => rejectInterest(row)} style={{ background: '#F1F5F9', color: '#334155', border: 'none', borderRadius: 8, padding: '9px 13px', fontWeight: 700 }}>{T(lang,'Từ chối','Reject')}</button></div>)}</div> : <p style={{ color: '#94A3B8' }}>{T(lang,'Chưa có nhà đầu tư quan tâm.','No investor interest yet.')}</p>}</div> : null}

          {tab === 'requests' ? <div style={cardStyle}><h2>{T(lang,'Yêu cầu tài liệu từ Nhà đầu tư','Data requests from investors')}</h2>{requests.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{requests.map((rq) => <div key={rq.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '1px solid #EEF2F6', borderRadius: 10, padding: '11px 14px' }}><span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>{rq.investors?.code}</span><span style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 600 }}>{Array.isArray(rq.requested_items) ? rq.requested_items.join(', ') : String(rq.requested_items || 'IM / Financials')}</span><span style={{ fontSize: 12, color: '#94A3B8' }}>{rq.status}</span><button onClick={() => fulfillRequest(rq)} style={{ background: '#0F2A4A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700 }}>Fulfilled</button></div>)}</div> : <p style={{ color: '#94A3B8' }}>{T(lang,'Chưa có yêu cầu tài liệu.','No data requests yet.')}</p>}</div> : null}

          {tab === 'services' ? <div style={cardStyle}><h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 16px' }}>{T(lang,'Dịch vụ & Thanh toán','Services & Billing')}</h2><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><div style={{ border: '1px solid #EEF2F6', borderRadius: 14, padding: 18 }}><b>{T(lang,'Gói hiện tại','Current plan')}</b><div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{planLabel}</div><p style={{ color: '#64748B', fontSize: 13 }}>{quotaTotal} proposal</p></div><div style={{ border: '1px solid #EEF2F6', borderRadius: 14, padding: 18 }}><b>{T(lang,'Hạn mức còn lại','Remaining quota')}</b><div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{quotaRemaining}</div><p style={{ color: '#64748B', fontSize: 13 }}>{T(lang,'Gia hạn hoặc nâng cấp tại Bảng giá.','Renew or upgrade in Pricing.')}</p></div></div><Link to="/pricing" style={{ display: 'inline-block', marginTop: 18, background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 15, padding: '13px 22px', borderRadius: 11 }}>{T(lang,'Gia hạn / Nâng cấp','Renew / Upgrade')}</Link></div> : null}
        </main>
      </div>
    </div>
  </div>;
}
