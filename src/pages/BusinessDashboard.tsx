import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteBusinessFile, deleteBusinessImage, getMyBusiness, updateBusinessImage, uploadBusinessFile, uploadBusinessImage } from '../lib/data';
import { supabase } from '../lib/supabase';
import { formatCompactMoney } from '../lib/format';

type Lang = 'vi' | 'en';
type Tab = 'overview' | 'profile' | 'documents' | 'images' | 'interests' | 'requests' | 'services';
const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

const tabs: { id: Tab; icon: string; vi: string; en: string; href: string }[] = [
  { id: 'overview', icon: '◎', vi: 'Tổng quan', en: 'Overview', href: '/dashboard/business' },
  { id: 'profile', icon: '✎', vi: 'Hồ sơ & số liệu', en: 'Profile & data', href: '/dashboard/business/profile' },
  { id: 'documents', icon: '📂', vi: 'Tài liệu', en: 'Documents', href: '/dashboard/business/files' },
  { id: 'images', icon: '🖼', vi: 'Ảnh', en: 'Images', href: '/dashboard/business/images' },
  { id: 'interests', icon: '🤝', vi: 'Nhà đầu tư', en: 'Investors', href: '/dashboard/business/investor-interest' },
  { id: 'requests', icon: '📨', vi: 'Yêu cầu data', en: 'Data requests', href: '/dashboard/business/data-requests' },
  { id: 'services', icon: '💳', vi: 'Dịch vụ & phí', en: 'Services & billing', href: '/dashboard/business/payments' }
];
const tabMap: Record<string, Tab> = { '': 'overview', profile: 'profile', files: 'documents', documents: 'documents', images: 'images', 'investor-interest': 'interests', interests: 'interests', proposals: 'interests', 'data-requests': 'requests', requests: 'requests', payments: 'services', services: 'services', plan: 'services' };
function resolveTab(pathname: string): Tab { const suffix = pathname.replace('/dashboard/business','').replace(/^\//,'').split('/')[0]; return tabMap[suffix] || 'overview'; }
function qBand(score: number) { if (score >= 80) return { labelVi: 'Mạnh', labelEn: 'Strong', cls: 'green' }; if (score >= 65) return { labelVi: 'Tốt', labelEn: 'Good', cls: 'blue' }; return { labelVi: 'Cần bổ sung', labelEn: 'Needs data', cls: 'gold' }; }
function ext(name = '', type = '') { const e = name.includes('.') ? name.split('.').pop()?.toUpperCase() : ''; if (e) return e; if (type.includes('pdf')) return 'PDF'; if (type.includes('excel') || type.includes('spreadsheet')) return 'XLSX'; if (type.includes('word')) return 'DOCX'; if (type.includes('presentation')) return 'PPT'; return type || 'FILE'; }
function fieldValue(fd: FormData, name: string) { return String(fd.get(name) || '').trim(); }
function metric(label: string, value: string, cls = 'blue') { return <div className="d68-dashboard-card"><div className="d68-dashboard-mini">{label}</div><h2 className={`d68-dashboard-badge ${cls}`} style={{ marginTop: 8 }}>{value}</h2></div>; }

export default function BusinessDashboard() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Lang>('vi');
  const [tab, setTab] = useState<Tab>(() => resolveTab(location.pathname));
  const [b, setB] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [interests, setInterests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('financials');

  useEffect(() => setTab(resolveTab(location.pathname)), [location.pathname]);

  async function load() {
    if (!profile) return;
    setBusy(true); setErr('');
    try {
      const biz = await getMyBusiness(profile.id);
      setB(biz);
      if (biz) {
        const [{ data: f }, { data: im }, { data: req }, { data: int }, { data: pay }] = await Promise.all([
          supabase.from('business_files').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('business_images').select('*').eq('business_id', biz.id).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
          supabase.from('request_data').select('*, investors(code,title_en,title_vi,type,country)').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('investor_interests').select('*, investors(id,code,title_en,title_vi,type,country,industries,deal_types,ticket_min,ticket_max)').eq('business_id', biz.id).order('created_at', { ascending: false }),
          supabase.from('payment_orders').select('*').eq('business_id', biz.id).order('created_at', { ascending: false })
        ]);
        setFiles(f || []); setImages(im || []); setRequests(req || []); setInterests(int || []); setPayments(pay || []);
      }
    } catch (e: any) { setErr(e?.message || 'Could not load dashboard data.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (!loading && !profile) navigate('/login?next=/dashboard/business'); if (profile) load(); }, [profile?.id, loading]);

  if (loading) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card">Loading...</div></div></main>;
  if (!profile) return <Navigate to="/login?next=/dashboard/business" replace />;
  if (profile.role !== 'business' && profile.role !== 'admin') return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card"><h2>Business access only</h2><p>Role hiện tại: {profile.role}</p><Link to="/">Back home</Link></div></div></main>;
  if (!b) return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap"><div className="d68-dashboard-card" style={{ textAlign: 'center' }}><h2>{T(lang, 'Chưa có hồ sơ doanh nghiệp', 'Business profile not found')}</h2><p>{T(lang, 'Tài khoản này chưa có hồ sơ DN hoặc đang chờ Admin kích hoạt.', 'This account has no business profile yet or is pending Admin activation.')}</p><Link className="d68-dashboard-btn" to="/register/business">{T(lang, 'Tạo hồ sơ DN', 'Create business profile')}</Link></div></div></main>;

  const score = b.quality_score === null || b.quality_score === undefined ? null : Math.round(Number(b.quality_score));
  const band = qBand(score ?? 0);
  const hasPublicSnapshot = !!b.public_snapshot_json;
  const hasPending = !!b.pending_changes_json || b.moderation_status === 'pending_admin_review';
  const planLabel = String(b.plan || 'Standard');
  const statusLabel = String(b.status || 'pending_admin_review');
  const title = b.company_name_private || b.title_vi || b.title_en || b.public_code || 'Business profile';
  const quotaTotal = Number(b.quota_total || (String(b.plan || '').includes('featured') ? 200 : 100));
  const quotaUsed = Number(b.quota_used || 0);
  const quotaPct = Math.min(100, Math.round((quotaUsed / Math.max(1, quotaTotal)) * 100));

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const pending = {
      company_name_private: fieldValue(fd, 'company_name_private'),
      title_vi: fieldValue(fd, 'title_vi'),
      description_vi: fieldValue(fd, 'description_vi'),
      industry: fieldValue(fd, 'industry'),
      deal_type: fieldValue(fd, 'deal_type'),
      city: fieldValue(fd, 'city'),
      highlights_vi: fieldValue(fd, 'highlights_vi'),
      investment_reason_vi: fieldValue(fd, 'investment_reason_vi'),
      revenue_2025: Number(fd.get('revenue_2025') || 0),
      revenue_currency: fieldValue(fd, 'revenue_currency') || b.revenue_currency || 'VND',
      ebitda_margin: Number(fd.get('ebitda_margin') || 0),
      ask_amount: Number(fd.get('ask_amount') || 0),
      ask_currency: fieldValue(fd, 'ask_currency') || b.ask_currency || b.revenue_currency || 'VND',
      stake_pct: Number(fd.get('stake_pct') || 0),
      data_confidence: Number(fd.get('data_confidence') || 0)
    };
    const patch: any = { pending_changes_json: pending, pending_submitted_at: new Date().toISOString(), pending_submitted_by: profile.id, moderation_status: 'pending_admin_review' };
    if (!hasPublicSnapshot) { patch.status = 'pending_admin_review'; patch.visible = false; }
    const { error } = await supabase.from('businesses').update(patch).eq('id', b.id);
    setMsg(error ? '' : T(lang, 'Đã lưu thay đổi. Public vẫn giữ bản Admin duyệt trước đó; thay đổi mới đang chờ duyệt.', 'Saved. Public profile keeps the last Admin-approved snapshot; new changes are pending review.'));
    setErr(error ? error.message : '');
    await load();
  }
  async function fileChange(e: any) { const file = e.target.files?.[0]; if (!file || !b || !profile) return; setBusy(true); try { await uploadBusinessFile(b.id, profile.id, file, newDocCategory, 'locked', newDocName || file.name); setMsg(T(lang, 'File đã tải lên ở trạng thái khóa/chờ Admin duyệt.', 'File uploaded as locked/pending Admin review.')); await load(); } catch (e: any) { setErr(e?.message || 'Upload failed.'); } finally { setBusy(false); e.target.value = ''; } }
  async function imageChange(e: any) { const file = e.target.files?.[0]; if (!file || !b || !profile) return; setBusy(true); try { await uploadBusinessImage(b.id, profile.id, file, file.name); setMsg(T(lang, 'Ảnh đã tải lên. Ảnh chỉ public sau khi Admin duyệt/làm mờ thông tin nhạy cảm.', 'Image uploaded. It becomes public only after Admin review/sanitization.')); await load(); } catch (e: any) { setErr(e?.message || 'Upload failed.'); } finally { setBusy(false); e.target.value = ''; } }
  async function deleteFile(row: any) { if (!confirm(T(lang, 'Xóa tài liệu này?', 'Delete this document?'))) return; try { await deleteBusinessFile(row); setMsg('Document deleted.'); await load(); } catch (e: any) { setErr(e?.message || 'Delete failed.'); } }
  async function deleteImage(row: any) { if (!confirm(T(lang, 'Xóa ảnh này?', 'Delete this image?'))) return; try { await deleteBusinessImage(row); setMsg('Image deleted.'); await load(); } catch (e: any) { setErr(e?.message || 'Delete failed.'); } }
  async function renameImage(row: any) { const title = prompt(T(lang, 'Tên ảnh mới', 'New image title'), row.title || ''); if (title === null) return; try { await updateBusinessImage(row.id, { title, admin_note: 'User renamed image; Admin must approve display_title/public visibility.' }); setMsg('Image title updated.'); await load(); } catch (e: any) { setErr(e?.message || 'Update failed.'); } }
  async function suggestHero(row: any) { try { await updateBusinessImage(row.id, { admin_note: 'User suggests this as hero image' }); setMsg(T(lang, 'Đã ghi nhận ảnh đề xuất. Admin sẽ chọn ảnh public/hero sau kiểm duyệt.', 'Hero suggestion saved. Admin will choose public/hero image after review.')); await load(); } catch (e: any) { setErr(e?.message || 'Update failed.'); } }
  async function acceptInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'connected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đồng ý kết nối.', 'Connection accepted.')); load(); }
  async function rejectInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'rejected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã từ chối kết nối.', 'Connection rejected.')); load(); }
  async function fulfillRequest(row: any) { const { error } = await supabase.from('request_data').update({ status: 'fulfilled' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : 'Marked as fulfilled.'); load(); }

  return <main className="d68-dashboard-page"><div className="d68-dashboard-wrap">
    <header className="d68-dashboard-head"><div><div className="d68-dashboard-kicker">Business Dashboard</div><h1>{title}</h1></div><div className="d68-dashboard-actions"><button className="d68-dashboard-btn light" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}>{lang.toUpperCase()}</button><span className="d68-dashboard-badge blue">{planLabel}</span><span className={`d68-dashboard-badge ${statusLabel.includes('pending') ? 'gold' : statusLabel === 'active' ? 'green' : 'red'}`}>{statusLabel}</span><button className="d68-dashboard-btn light" onClick={() => signOut().then(() => navigate('/'))}>{T(lang,'Thoát','Exit')}</button></div></header>
    {msg ? <div className="d68-dashboard-notice ok">{msg}</div> : null}{err ? <div className="d68-dashboard-notice err">{err}</div> : null}{busy ? <div className="d68-dashboard-notice warn">{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}{hasPending ? <div className="d68-dashboard-notice warn">{T(lang,'Có thay đổi đang chờ Admin duyệt. Public profile vẫn dùng bản snapshot đã duyệt gần nhất.', 'Changes are pending Admin review. Public profile still uses the latest approved snapshot.')}</div> : null}
    <div className="d68-dashboard-cols"><nav className="d68-dashboard-side">{tabs.map((t) => <Link key={t.id} to={t.href} onClick={() => setTab(t.id)} className={tab === t.id ? 'active' : ''}>{t.icon} {T(lang,t.vi,t.en)}</Link>)}<div className="d68-dashboard-side__note">{T(lang,'Cần hỗ trợ hoàn thiện hồ sơ, định giá và tài liệu làm việc với NĐT?', 'Need help preparing your investor profile, valuation and documents?')}<br/><a href="https://vietcapitalpartners.com" target="_blank" rel="noreferrer">vietcapitalpartners.com ↗</a><br/>Hotline: 0909.584.075</div></nav><section>
      {tab === 'overview' ? <><div className="d68-dashboard-card" style={{ marginBottom: 18 }}><h2>Business Quality Score</h2><div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}><strong style={{ fontSize: 42, color: score === null ? '#94A3B8' : '#1596cc' }}>{score === null ? '—' : score}</strong><span className={`d68-dashboard-badge ${band.cls}`}>{score === null ? T(lang,'Đang cập nhật','Pending') : T(lang, band.labelVi, band.labelEn)}</span><p style={{ margin: 0 }}>{T(lang,'Điểm lấy từ quality_score thực tế trong database, không dùng điểm mặc định.', 'Score comes from actual database quality_score, no default score is used.')}</p></div></div><div className="d68-dashboard-grid4" style={{ marginBottom: 18 }}>{metric(T(lang,'Trạng thái hồ sơ','Profile status'), statusLabel, statusLabel === 'active' ? 'green' : 'gold')}{metric(T(lang,'Gói hiển thị','Plan tier'), planLabel)}{metric(T(lang,'Ảnh / File','Images / Files'), `${images.length} / ${files.length}`)}{metric(T(lang,'Doanh thu 2025','Revenue 2025'), formatCompactMoney(b.revenue_2025, b.revenue_currency))}</div><div className="d68-dashboard-card"><h2>{T(lang,'Hạn mức proposal','Proposal quota')}</h2><div className="d68-dashboard-progress"><span style={{ width: `${quotaPct}%` }} /></div><p><b>{quotaUsed} / {quotaTotal}</b> · {T(lang,'hạn mức đã dùng','used')}</p><Link to="/investors" className="d68-dashboard-btn gold">{T(lang,'Tìm Nhà đầu tư','Find investors')} →</Link></div></> : null}
      {tab === 'profile' ? <ProfileForm lang={lang} b={b} saveProfile={saveProfile} /> : null}
      {tab === 'documents' ? <Documents lang={lang} files={files} deleteFile={deleteFile} fileChange={fileChange} newDocName={newDocName} setNewDocName={setNewDocName} newDocCategory={newDocCategory} setNewDocCategory={setNewDocCategory} /> : null}
      {tab === 'images' ? <Images lang={lang} images={images} imageChange={imageChange} deleteImage={deleteImage} renameImage={renameImage} suggestHero={suggestHero} /> : null}
      {tab === 'interests' ? <Rows title={T(lang,'Nhà đầu tư quan tâm','Investor interests')} rows={interests} empty={T(lang,'Chưa có nhà đầu tư quan tâm.','No investor interests yet.')} actions={(row: any) => <><button onClick={() => acceptInterest(row)} className="d68-dashboard-btn green">Accept</button><button onClick={() => rejectInterest(row)} className="d68-dashboard-btn red">Reject</button></>} /> : null}
      {tab === 'requests' ? <Rows title={T(lang,'Yêu cầu dữ liệu','Data requests')} rows={requests} empty={T(lang,'Chưa có yêu cầu dữ liệu.','No data requests yet.')} actions={(row: any) => <button onClick={() => fulfillRequest(row)} className="d68-dashboard-btn green">Fulfilled</button>} /> : null}
      {tab === 'services' ? <div className="d68-dashboard-card"><h2>Services & Billing</h2><p>{T(lang,'Đơn thanh toán gần đây','Recent payment orders')}: {payments.length}</p>{payments.map((p) => <div key={p.id} className="d68-dashboard-row"><div style={{ flex: 1 }}><b>{p.title || p.id}</b><div className="d68-dashboard-mini">{p.status} · {new Date(p.created_at).toLocaleString()}</div></div></div>)}<Link to="/pricing" className="d68-dashboard-btn gold">Renew / Upgrade →</Link></div> : null}
    </section></div>
  </div></main>;
}

function ProfileForm({ lang, b, saveProfile }: any) { return <form onSubmit={saveProfile} className="d68-dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><h2>{T(lang,'Chỉnh sửa hồ sơ','Edit profile')}</h2><p>{T(lang,'Lưu tại đây không tự public. Admin phải duyệt snapshot mới trước khi hiển thị ra ngoài.', 'Saving here does not publish changes. Admin must approve a new snapshot before public display.')}</p><label className="d68-dashboard-field"><span>{T(lang,'Tên doanh nghiệp thật — chỉ Admin thấy','Real business name — Admin only')}</span><input className="d68-dashboard-input" name="company_name_private" defaultValue={b.company_name_private || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Tiêu đề ẩn danh public','Anonymous public title')}</span><input className="d68-dashboard-input" name="title_vi" defaultValue={b.title_vi || ''}/></label><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Ngành','Industry')}</span><input className="d68-dashboard-input" name="industry" defaultValue={b.industry || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Thành phố','City')}</span><input className="d68-dashboard-input" name="city" defaultValue={b.city || ''}/></label></div><label className="d68-dashboard-field"><span>{T(lang,'Tổng quan doanh nghiệp','Business overview')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="description_vi" defaultValue={b.description_vi || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Điểm nổi bật','Highlights')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="highlights_vi" defaultValue={b.highlights_vi || ''}/></label><div className="d68-dashboard-form2"><label className="d68-dashboard-field"><span>{T(lang,'Loại giao dịch','Deal type')}</span><input className="d68-dashboard-input" name="deal_type" defaultValue={b.deal_type || ''}/></label><label className="d68-dashboard-field"><span>{T(lang,'Doanh thu 2025','Revenue 2025')}</span><input className="d68-dashboard-input" type="number" name="revenue_2025" defaultValue={b.revenue_2025 || 0}/></label><label className="d68-dashboard-field"><span>Revenue currency</span><select className="d68-dashboard-input" name="revenue_currency" defaultValue={b.revenue_currency || 'VND'}><option>VND</option><option>USD</option></select></label><label className="d68-dashboard-field"><span>EBITDA margin (%)</span><input className="d68-dashboard-input" type="number" name="ebitda_margin" defaultValue={b.ebitda_margin || 0}/></label><label className="d68-dashboard-field"><span>{T(lang,'Nhu cầu vốn/Giá chào','Ask amount')}</span><input className="d68-dashboard-input" type="number" name="ask_amount" defaultValue={b.ask_amount || 0}/></label><label className="d68-dashboard-field"><span>Ask currency</span><select className="d68-dashboard-input" name="ask_currency" defaultValue={b.ask_currency || b.revenue_currency || 'VND'}><option>VND</option><option>USD</option></select></label><label className="d68-dashboard-field"><span>{T(lang,'Tỷ lệ cổ phần (%)','Stake (%)')}</span><input className="d68-dashboard-input" type="number" name="stake_pct" defaultValue={b.stake_pct || 0}/></label><label className="d68-dashboard-field"><span>{T(lang,'Độ tin cậy dữ liệu','Data confidence')}</span><input className="d68-dashboard-input" type="number" name="data_confidence" defaultValue={b.data_confidence || 0}/></label></div><label className="d68-dashboard-field"><span>{T(lang,'Lý do giao dịch / dùng vốn','Reason / use of funds')}</span><textarea className="d68-dashboard-input d68-dashboard-textarea" name="investment_reason_vi" defaultValue={b.investment_reason_vi || ''}/></label><div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="d68-dashboard-btn">{T(lang,'Lưu & gửi Admin duyệt','Save & submit to Admin')}</button></div></form>; }
function Documents({ lang, files, deleteFile, fileChange, newDocName, setNewDocName, newDocCategory, setNewDocCategory }: any) { return <div className="d68-dashboard-card"><h2>{T(lang,'Tài liệu doanh nghiệp','Business documents')}</h2><p>{T(lang,'File luôn ở trạng thái khóa sau khi upload. Admin mới có thể duyệt public/locked.', 'Uploaded files are always locked first. Only Admin can approve public/locked visibility.')}</p>{files.map((d: any) => <div key={d.id} className="d68-dashboard-row"><span className="d68-dashboard-badge blue">{ext(d.file_name, d.file_type)}</span><div style={{ flex: 1 }}><b>{d.display_name || d.file_name}</b><div className="d68-dashboard-mini">{d.category || 'document'} · {d.privacy_level || 'locked'} · {d.public_visible ? 'public' : 'not public'}</div></div><button onClick={() => deleteFile(d)} className="d68-dashboard-btn red">{T(lang,'Xóa','Delete')}</button></div>)}{!files.length ? <div className="d68-dashboard-empty">{T(lang,'Chưa có tài liệu.','No documents yet.')}</div> : null}<div className="d68-dashboard-form2" style={{ marginTop: 18 }}><label className="d68-dashboard-field"><span>{T(lang,'Tên hiển thị đề xuất','Suggested display name')}</span><input className="d68-dashboard-input" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} /></label><label className="d68-dashboard-field"><span>{T(lang,'Danh mục','Category')}</span><select className="d68-dashboard-input" value={newDocCategory} onChange={(e) => setNewDocCategory(e.target.value)}><option value="financials">Financials</option><option value="profile">Profile</option><option value="im">Teaser / IM</option><option value="legal">Legal</option><option value="other">Other</option></select></label></div><label className="d68-dashboard-btn" style={{ display: 'inline-block', marginTop: 14 }}>+ {T(lang,'Tải lên','Upload')}<input type="file" onChange={fileChange} style={{ display: 'none' }}/></label></div>; }
function Images({ lang, images, imageChange, deleteImage, renameImage, suggestHero }: any) { return <div className="d68-dashboard-card"><h2>{T(lang,'Ảnh doanh nghiệp','Business images')}</h2><p>{T(lang,'Ảnh chỉ public sau khi Admin xác nhận đã làm mờ logo/tên DN.', 'Images become public only after Admin confirms sanitization.')}</p><div className="d68-dashboard-grid3">{images.map((img: any) => <div key={img.id} className="d68-dashboard-card" style={{ padding: 10 }}><img className="d68-dashboard-thumb" style={{ width: '100%', height: 160 }} src={img.public_url} alt={img.title || ''}/><b>{img.title || T(lang,'Chưa đặt tên','Untitled')}</b><div className="d68-dashboard-mini">{img.is_sanitized ? 'sanitized' : 'pending sanitize'} · {img.public_visible ? 'public' : 'not public'}</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}><button onClick={() => renameImage(img)} className="d68-dashboard-btn light">{T(lang,'Đổi tên','Rename')}</button><button onClick={() => suggestHero(img)} className="d68-dashboard-btn blue">Hero</button><button onClick={() => deleteImage(img)} className="d68-dashboard-btn red">{T(lang,'Xóa','Delete')}</button></div></div>)}<label className="d68-dashboard-empty" style={{ cursor: 'pointer' }}>+ {T(lang,'Thêm ảnh','Add image')}<input type="file" accept="image/*" onChange={imageChange} style={{ display: 'none' }}/></label></div></div>; }
function Rows({ title, rows, empty, actions }: any) { return <div className="d68-dashboard-card"><h2>{title}</h2>{rows.length ? rows.map((r: any) => <div key={r.id} className="d68-dashboard-row"><div style={{ flex: 1 }}><b>{r.investors?.title_vi || r.investors?.title_en || r.investors?.code || r.id}</b><div className="d68-dashboard-mini">{r.status || 'pending'} · {new Date(r.created_at).toLocaleString()}</div></div><div style={{ display: 'flex', gap: 8 }}>{actions?.(r)}</div></div>) : <div className="d68-dashboard-empty">{empty}</div>}</div>; }
