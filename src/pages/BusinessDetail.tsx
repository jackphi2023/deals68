import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBusinessBySlug, getBusinessDetailAssets, getInvestorByOwner } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type Doc = { id?: string; file_name?: string; display_name?: string; file_type?: string; size_bytes?: number; category?: string; privacy_level?: string; created_at?: string };
type Img = { id?: string; public_url?: string; display_title?: string; title?: string; is_hero?: boolean };

function lines(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return String(v || '').split(/\n|;/).map((x) => x.trim()).filter(Boolean);
}
function money(v: any, cur: string) { return Number(v || 0) > 0 ? formatCompactMoney(v, cur) : 'TBD'; }
function qualityLabel(lang: Lang, q: any) { const n = Number(q); if (!Number.isFinite(n) || q === null || q === undefined || q === '') return T(lang, 'Đang cập nhật', 'Pending'); return `${Math.round(n)}/100`; }
function fileExt(d: Doc) { const name = d.file_name || ''; const fromName = name.includes('.') ? name.split('.').pop() : ''; const fromType = String(d.file_type || '').split('/').pop(); return String(fromName || fromType || 'file').toUpperCase(); }
function fileSize(bytes?: number) { const n = Number(bytes || 0); if (!n) return ''; if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`; if (n > 1024) return `${Math.round(n / 1024)} KB`; return `${n} B`; }

export default function BusinessDetail({ lang }: { lang: Lang }) {
  const { slug = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [images, setImages] = useState<Img[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setBusiness(null); setDocs([]); setImages([]); setActiveImage(0);
      try {
        const b = await getBusinessBySlug(slug);
        if (!live) return;
        if (!b) { setError(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp hoặc hồ sơ chưa được Admin duyệt công khai.', 'Business profile not found or not approved for public display.')); return; }
        setBusiness(b);
        const assets = await getBusinessDetailAssets(b.id, { publicOnly: true });
        if (live) { setDocs(assets.files || []); setImages(assets.images || []); }
      } catch (e: any) { if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ.', 'Could not load profile.')); }
      finally { if (live) setLoading(false); }
    }
    load();
    return () => { live = false; };
  }, [slug, lang]);

  const title = business ? T(lang, business.title_vi || business.public_code || 'Hồ sơ doanh nghiệp ẩn danh', business.title_en || business.title_vi || business.public_code || 'Anonymous business profile') : '';
  const description = business ? T(lang, business.description_vi || business.highlights_vi || 'Hồ sơ đang được cập nhật từ bản Admin đã duyệt.', business.description_en || business.description_vi || 'Profile is being updated from the Admin-approved version.') : '';
  const highlights = useMemo(() => business ? lines(lang === 'vi' ? business.highlights_vi : (business.highlights_en || business.highlights_vi)) : [], [business, lang]);
  const overview = useMemo(() => business ? [description, ...lines(lang === 'vi' ? business.investment_reason_vi : (business.investment_reason_en || business.investment_reason_vi))].filter(Boolean) : [], [business, lang, description]);
  const heroImages = useMemo(() => {
    const approved = images.filter((img) => img.public_url).map((img) => ({ url: img.public_url || '', title: img.display_title || img.title || '', isHero: !!img.is_hero }));
    const fallback = business?.hero_image_url || business?.image_url ? [{ url: business.hero_image_url || business.image_url, title, isHero: true }] : [];
    const merged = [...approved, ...fallback].filter((x, idx, arr) => x.url && arr.findIndex((y) => y.url === x.url) === idx);
    return merged.sort((a, b) => Number(b.isHero) - Number(a.isHero));
  }, [images, business, title]);
  const hero = heroImages[activeImage] || heroImages[0];
  const facts = business ? [
    [T(lang, 'Mã hồ sơ', 'Profile code'), business.public_code || business.slug || '-'],
    [T(lang, 'Ngành', 'Industry'), business.industry || T(lang, 'Đang cập nhật', 'Pending')],
    [T(lang, 'Địa điểm', 'Location'), business.city || business.country_iso2 || T(lang, 'Đang cập nhật', 'Pending')],
    [T(lang, 'Loại giao dịch', 'Transaction'), business.deal_type || T(lang, 'Đang cập nhật', 'Pending')],
    [T(lang, 'Doanh thu năm', 'Annual revenue'), money(business.revenue_2025, business.revenue_currency || 'VND')],
    ['EBITDA', business.ebitda_margin === null || business.ebitda_margin === undefined ? T(lang, 'Đang cập nhật', 'Pending') : percent(business.ebitda_margin)],
    [T(lang, 'Nhu cầu vốn/giá chào', 'Capital sought / asking'), money(business.ask_amount, business.ask_currency || business.revenue_currency || 'VND')],
    [T(lang, 'Tỷ lệ cổ phần', 'Stake'), business.stake_pct === null || business.stake_pct === undefined ? 'TBD' : percent(business.stake_pct)],
    ['Business Quality Score', qualityLabel(lang, business.quality_score)],
    [T(lang, 'Phiên bản public', 'Public version'), business.public_version ? `v${business.public_version}` : 'v1']
  ] : [];
  const publicDocs = docs.filter((d) => d.privacy_level === 'public');
  const lockedDocs = docs.filter((d) => d.privacy_level !== 'public');

  async function expressInterest() {
    if (!profile) { navigate(`/login?next=/businesses/${slug}`); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được bày tỏ quan tâm.', 'Only Investor accounts can express interest.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }

    let upErr: any = null;
    try {
      const rpcRes = await supabase.rpc('express_investor_interest', {
        investor_uuid: inv.id,
        business_uuid: business.id,
        interest_note: 'Expressed from public business detail page.'
      });
      upErr = rpcRes.error;
    } catch (err: any) {
      upErr = err;
    }

    if (upErr) {
      const fallback = await supabase
        .from('investor_interests')
        .upsert({ investor_id: inv.id, business_id: business.id, status: 'pending' }, { onConflict: 'investor_id,business_id' });
      upErr = fallback.error;
    }

    setMsg(upErr ? upErr.message : T(lang, 'Đã ghi nhận quan tâm. Admin/Doanh nghiệp sẽ duyệt kết nối trước khi mở thêm dữ liệu.', 'Interest recorded. Admin/Business approval is required before additional data unlocks.'));
  }
  async function requestData() {
    if (!profile) { navigate(`/login?next=/businesses/${slug}`); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu tài liệu.', 'Only Investor accounts can request documents.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error: reqErr } = await supabase.from('request_data').insert({ investor_id: inv.id, business_id: business.id, requested_items: ['IM', 'Financials'], note: 'Requested from public business detail page.', status: 'requested' });
    setMsg(reqErr ? reqErr.message : T(lang, 'Đã gửi yêu cầu tài liệu qua Deals68.', 'Data request sent via Deals68.'));
  }

  if (loading) return <main style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 32 }}>{T(lang, 'Đang tải bản public đã duyệt...', 'Loading approved public profile...')}</div></main>;
  if (error || !business) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 32 }}><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p style={{ color: '#64748B' }}>{error}</p><Link to="/businesses" style={{ color: '#1596cc', fontWeight: 700 }}>← {T(lang, 'Quay lại danh sách', 'Back to businesses')}</Link></div></main>;

  return <main style={{ background: '#F7FAFC' }}>
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px 60px' }}>
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 18 }}><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link> › <Link to="/businesses">{T(lang, 'Doanh nghiệp', 'Businesses')}</Link> › <b style={{ color: '#475569' }}>{business.public_code || business.slug}</b></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 26 }} className="d68-detail-cols">
        <article style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ height: 390, background: '#EAF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: 800 }}>{hero?.url ? <img src={hero.url} alt={hero.title || title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : T(lang, 'Ảnh doanh nghiệp đang cập nhật sau duyệt Admin', 'Business image pending Admin approval')}</div>
          {heroImages.length > 1 ? <div style={{ display: 'flex', gap: 10, padding: 14, overflowX: 'auto', borderBottom: '1px solid #EEF2F6' }}>{heroImages.map((img, i) => <button key={`${img.url}-${i}`} onClick={() => setActiveImage(i)} style={{ width: 92, height: 62, borderRadius: 10, overflow: 'hidden', border: i === activeImage ? '2px solid #1BADEA' : '1px solid #E2E8F0', background: '#fff', padding: 0, cursor: 'pointer', flexShrink: 0 }}><img src={img.url} alt={img.title || title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></button>)}</div> : null}
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}><span style={pill('#E7F6FD','#1596cc')}>{business.industry || 'Industry TBD'}</span><span style={pill('#F1F5F9','#64748B')}>{business.deal_type || 'Transaction TBD'}</span><span style={pill('#FEF3D3','#8a6413')}>Quality: {qualityLabel(lang, business.quality_score)}</span></div>
            <h1 style={{ fontSize: 30, lineHeight: 1.18, margin: '0 0 12px', letterSpacing: -.7 }}>{title}</h1>
            <p style={{ color: '#64748B', lineHeight: 1.65, margin: '0 0 22px' }}>{description}</p>
            <Section title={T(lang, 'Thông tin chính', 'Key facts')}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }} className="d68-form-2">{facts.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</div></Section>
            <Section title={T(lang, 'Điểm nổi bật', 'Highlights')}><ul style={{ margin: 0, paddingLeft: 20, color: '#334155', lineHeight: 1.7 }}>{highlights.length ? highlights.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có điểm nổi bật đã duyệt.', 'No approved highlights yet.')}</li>}</ul></Section>
            <Section title={T(lang, 'Hồ sơ doanh nghiệp', 'Business profile')}><ul style={{ margin: 0, paddingLeft: 20, color: '#334155', lineHeight: 1.7 }}>{overview.length ? overview.map((x, i) => <li key={i}>{x}</li>) : <li>{T(lang, 'Chưa có mô tả chi tiết trong bản public.', 'No detailed public description yet.')}</li>}</ul></Section>
            <Section title={T(lang, 'Danh sách file đã duyệt', 'Approved file list')}><DocList docs={publicDocs} title={T(lang, 'Công khai', 'Public')} empty={T(lang, 'Chưa có file công khai đã duyệt.', 'No approved public files yet.')} /><DocList docs={lockedDocs} title={T(lang, 'Khóa sau kết nối/NDA', 'Locked after connection/NDA')} empty={T(lang, 'Chưa có file khóa đã duyệt.', 'No approved locked files yet.')} /></Section>
            <div style={{ background: '#FEF3D3', color: '#7a5c12', border: '1px solid #F5D98A', borderRadius: 14, padding: 16, fontSize: 13.5, lineHeight: 1.55 }}><b>{T(lang, 'Nguyên tắc hiển thị', 'Display rule')}:</b> {T(lang, 'Trang này chỉ hiển thị bản ẩn danh đã được Admin duyệt. User sửa dữ liệu sẽ không thay đổi trang public cho tới khi Admin duyệt phiên bản mới.', 'This page only displays the Admin-approved anonymous snapshot. User edits do not change the public page until Admin approves a new version.')}</div>
          </div>
        </article>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 24 }}><div style={{ color: '#9db4cc', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{T(lang, 'Tóm tắt giao dịch', 'Transaction summary')}</div><h2 style={{ margin: '0 0 8px', color: '#F2B51D' }}>{money(business.ask_amount, business.ask_currency || business.revenue_currency || 'VND')}</h2><p style={{ color: '#c6d5e6', margin: 0 }}>{business.stake_pct ? `${percent(business.stake_pct)} · ` : ''}{business.deal_type || 'Transaction TBD'}</p><button onClick={expressInterest} style={sideBtn('#F2B51D', '#0F2A4A')}>{T(lang, 'Bày tỏ quan tâm', 'Express interest')}</button><button onClick={requestData} style={{ ...sideBtn('transparent', '#fff'), border: '1px solid rgba(255,255,255,.2)', marginTop: 10 }}>{T(lang, 'Yêu cầu tài liệu', 'Request documents')}</button></div><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 20 }}><h3 style={{ marginTop: 0 }}>Business Quality Score</h3><div style={{ fontSize: 30, fontWeight: 900, color: '#0F2A4A' }}>{qualityLabel(lang, business.quality_score)}</div><p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.55 }}>{T(lang, 'Điểm lấy từ snapshot Admin duyệt/database, không dùng điểm mặc định.', 'Score comes from the Admin-approved/database snapshot, never from a default value.')}</p></div>{msg ? <div style={{ background: '#FEF3D3', color: '#7a5c12', borderRadius: 14, padding: 14, fontSize: 13.5, lineHeight: 1.5 }}>{msg}</div> : null}</aside>
      </div>
    </section>
  </main>;
}
function Section({ title, children }: { title: string; children: any }) { return <section style={{ marginTop: 26 }}><h2 style={{ fontSize: 20, margin: '0 0 14px' }}>{title}</h2>{children}</section>; }
function Fact({ k, v }: { k: string; v: string }) { return <div style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: 13, background: '#FAFCFE' }}><div style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>{k}</div><div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 4 }}>{v}</div></div>; }
function DocList({ docs, title, empty }: { docs: Doc[]; title: string; empty: string }) { return <div style={{ marginBottom: 16 }}><h3 style={{ fontSize: 15, margin: '0 0 8px' }}>{title}</h3>{docs.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{docs.map((d) => <div key={d.id || d.file_name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid #EEF2F6', background: '#fff', borderRadius: 10, padding: '10px 12px' }}><div><b>{d.display_name || `${d.category || 'Document'} file`}</b><div style={{ fontSize: 12, color: '#94A3B8' }}>{d.category || 'document'} · {fileExt(d)}{fileSize(d.size_bytes) ? ` · ${fileSize(d.size_bytes)}` : ''}</div></div><span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>{d.privacy_level || 'locked'}</span></div>)}</div> : <p style={{ color: '#94A3B8', margin: 0 }}>{empty}</p>}</div>; }
function pill(background: string, color: string) { return { background, color, fontWeight: 800, fontSize: 12, padding: '5px 10px', borderRadius: 7 } as const; }
function sideBtn(bg: string, color: string) { return { width: '100%', marginTop: 18, border: 'none', borderRadius: 10, padding: 12, background: bg, color, fontWeight: 800, cursor: 'pointer' } as const; }
