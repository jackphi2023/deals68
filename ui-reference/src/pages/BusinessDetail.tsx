import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getBusinessBySlug, getBusinessDetailAssets, getInvestorByOwner, listBusinesses } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => (lang === 'en' ? en : vi);

type Doc = { id?: string; file_name?: string; display_name?: string; file_type?: string; size_bytes?: number; category?: string; privacy_level?: string; public_visible?: boolean; created_at?: string };
type Img = { id?: string; public_url?: string; display_title?: string; title?: string; is_hero?: boolean };
type Similar = { id: string; slug: string; title: string; industry: string; amount: string; txType: string; image?: string | null };

function lines(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return String(v || '').split(/\n|;/).map((x) => x.trim()).filter(Boolean);
}
function money(v: any, cur = 'VND') { return Number(v || 0) > 0 ? formatCompactMoney(v, cur) : '—'; }
function val(v: any, fallback = '—') { const s = String(v ?? '').trim(); return s || fallback; }
function qNumber(q: any) { const n = Number(q); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null; }
function qBand(lang: Lang, q: number | null) {
  if (q === null) return T(lang, 'Đang cập nhật', 'Pending');
  if (q >= 85) return T(lang, 'Rất tốt', 'Excellent');
  if (q >= 70) return T(lang, 'Tốt', 'Good');
  if (q >= 55) return T(lang, 'Cần bổ sung', 'Needs update');
  return T(lang, 'Đang hoàn thiện', 'Developing');
}
function qColor(q: number | null) {
  if (q === null) return '#94A3B8';
  if (q >= 85) return '#16A34A';
  if (q >= 70) return '#1BADEA';
  if (q >= 55) return '#F2B51D';
  return '#EF4444';
}
function docExt(d: Doc) {
  const n = d.display_name || d.file_name || '';
  const ext = n.includes('.') ? n.split('.').pop() : String(d.file_type || '').split('/').pop();
  return String(ext || 'file').toUpperCase();
}
function docLabel(d: Doc) { return d.display_name || d.file_name || 'Tài liệu doanh nghiệp'; }
function dealAmount(b: any) {
  const amount = money(b.ask_amount, b.ask_currency || b.revenue_currency || 'VND');
  const stake = Number(b.stake_pct || 0) > 0 ? ` / ${percent(b.stake_pct)}` : '';
  return `${amount}${stake}`;
}

export default function BusinessDetail({ lang }: { lang: Lang }) {
  const { slug = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [images, setImages] = useState<Img[]>([]);
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true); setError(''); setBusiness(null); setDocs([]); setImages([]); setSimilar([]); setActiveImage(0);
      try {
        const b = await getBusinessBySlug(slug);
        if (!live) return;
        if (!b) {
          setError(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp hoặc hồ sơ chưa được Admin duyệt công khai.', 'Business profile not found or not approved for public display.'));
          return;
        }
        setBusiness(b);
        const [assets, sims] = await Promise.all([
          getBusinessDetailAssets(b.id, { publicOnly: true }).catch(() => ({ files: [], images: [] })),
          listBusinesses({ limit: 4, industry: b.industry }).catch(() => [])
        ]);
        if (!live) return;
        setDocs(assets.files || []);
        setImages(assets.images || []);
        setSimilar((sims || []).filter((x: any) => x.id !== b.id).slice(0, 3).map((x: any) => ({
          id: String(x.id || x.slug),
          slug: String(x.slug || x.id),
          title: T(lang, x.title_vi || x.public_code || 'Hồ sơ doanh nghiệp', x.title_en || x.title_vi || 'Business profile'),
          industry: x.industry || 'Industry',
          amount: dealAmount(x),
          txType: x.deal_type || 'Deal',
          image: x.hero_image_url || x.image_url || null
        })));
      } catch (e: any) {
        if (live) setError(e?.message || T(lang, 'Không tải được hồ sơ doanh nghiệp.', 'Could not load business profile.'));
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => { live = false; };
  }, [slug, lang]);

  const title = business ? T(lang, business.title_vi || business.public_code || 'Hồ sơ doanh nghiệp ẩn danh', business.title_en || business.title_vi || business.public_code || 'Anonymous business profile') : '';
  const subtitle = business ? T(lang, business.description_vi || business.investment_reason_vi || 'Hồ sơ công khai đã được Admin duyệt.', business.description_en || business.description_vi || business.investment_reason_en || 'Admin-approved public profile.') : '';
  const highlights = useMemo(() => business ? lines(lang === 'vi' ? business.highlights_vi : (business.highlights_en || business.highlights_vi)) : [], [business, lang]);
  const profileLines = useMemo(() => business ? lines(lang === 'vi' ? business.investment_reason_vi : (business.investment_reason_en || business.investment_reason_vi)) : [], [business, lang]);
  const q = qNumber(business?.quality_score);
  const qDeg = q === null ? 0 : Math.round(q * 3.6);
  const qc = qColor(q);
  const heroImages = useMemo(() => {
    const fromImages = images.filter((i) => i.public_url).map((i) => ({ url: i.public_url || '', title: i.display_title || i.title || title, isHero: !!i.is_hero }));
    const fallback = business?.hero_image_url || business?.image_url ? [{ url: business.hero_image_url || business.image_url, title, isHero: true }] : [];
    return [...fromImages, ...fallback].filter((x, i, arr) => x.url && arr.findIndex((y) => y.url === x.url) === i).sort((a, b) => Number(b.isHero) - Number(a.isHero));
  }, [images, business, title]);
  const hero = heroImages[activeImage] || heroImages[0];
  const amount = business ? money(business.ask_amount, business.ask_currency || business.revenue_currency || 'VND') : '—';
  const stake = business?.stake_pct === null || business?.stake_pct === undefined ? '—' : percent(business.stake_pct);
  const facts = business ? [
    [T(lang, 'Mã hồ sơ', 'Profile code'), val(business.public_code || business.slug)],
    [T(lang, 'Quốc gia', 'Country'), val(business.country_iso2, 'VN')],
    [T(lang, 'Địa điểm', 'Location'), val(business.city || business.country_iso2)],
    [T(lang, 'Ngành', 'Industry'), val(business.industry)],
    [T(lang, 'Loại giao dịch', 'Transaction'), val(business.deal_type)],
    [T(lang, 'Doanh thu 2025E', 'Revenue 2025E'), money(business.revenue_2025, business.revenue_currency || 'VND')],
    ['EBITDA', business.ebitda_margin === null || business.ebitda_margin === undefined ? '—' : percent(business.ebitda_margin)],
    [T(lang, 'Giá trị / Nhu cầu vốn', 'Amount / Capital sought'), amount],
    [T(lang, 'Cổ phần', 'Stake'), stake],
    ['Business Quality Score', q === null ? T(lang, 'Đang cập nhật', 'Pending') : `${q}/100`]
  ] : [];
  const docRows = docs.length ? docs : [
    { display_name: T(lang, 'Bản giới thiệu doanh nghiệp (mở sau NDA)', 'Business teaser / IM (unlocked after NDA)'), privacy_level: 'locked', file_type: 'pdf' },
    { display_name: T(lang, 'Báo cáo tài chính 2024–2025 (mở sau kết nối)', 'Financials 2024–2025 (unlocked after connection)'), privacy_level: 'locked', file_type: 'xlsx' },
    { display_name: T(lang, 'Hồ sơ pháp lý & vận hành (mở sau DD)', 'Legal & operating documents (unlocked after DD)'), privacy_level: 'locked', file_type: 'folder' }
  ];

  async function expressInterest() {
    if (!profile) { navigate(`/login?next=/businesses/${slug}`); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được bày tỏ quan tâm.', 'Only Investor accounts can express interest.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    let error: any = null;
    try {
      const res = await supabase.rpc('express_investor_interest', { p_business_id: business.id, p_note: 'Expressed from public business detail page.' });
      error = res.error;
    } catch (e) { error = e; }
    if (error) {
      const fallback = await supabase.from('investor_interests').upsert({ investor_id: inv.id, business_id: business.id, status: 'pending' }, { onConflict: 'investor_id,business_id' });
      error = fallback.error;
    }
    setMsg(error ? error.message : T(lang, 'Đã ghi nhận quan tâm. Thông tin liên hệ/tài liệu chỉ mở sau khi kết nối được duyệt.', 'Interest recorded. Contact details/documents unlock only after approval.'));
  }

  async function requestData() {
    if (!profile) { navigate(`/login?next=/businesses/${slug}`); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu tài liệu.', 'Only Investor accounts can request documents.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error: reqErr } = await supabase.from('request_data').insert({ investor_id: inv.id, business_id: business.id, requested_items: ['IM', 'Financials', 'NDA'], note: 'Requested from public business detail page.', status: 'requested' });
    setMsg(reqErr ? reqErr.message : T(lang, 'Đã gửi yêu cầu IM/NDA qua Deals68.', 'IM/NDA request sent via Deals68.'));
  }

  if (loading) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={box}>{T(lang, 'Đang tải hồ sơ doanh nghiệp đã duyệt...', 'Loading approved business profile...')}</div></main>;
  if (error || !business) return <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 24px' }}><div style={box}><h1>{T(lang, 'Không hiển thị được hồ sơ', 'Profile unavailable')}</h1><p style={{ color: '#64748B' }}>{error}</p><Link to="/businesses" style={{ color: '#1596cc', fontWeight: 700 }}>← {T(lang, 'Quay lại danh sách', 'Back to businesses')}</Link></div></main>;

  return <main style={{ background: '#F7FAFC' }}>
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 24px 0' }}><div style={{ fontSize: 13, color: '#94A3B8' }}><Link to="/">{T(lang, 'Trang chủ', 'Home')}</Link><span style={{ margin: '0 8px' }}>›</span><Link to="/businesses">{T(lang, 'Doanh nghiệp', 'Businesses')}</Link><span style={{ margin: '0 8px' }}>›</span><span style={{ color: '#475569', fontWeight: 600 }}>{business.public_code || business.slug}</span></div></div>

    <div className="d68-detail-cols" style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 24px 40px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 348px', gap: 28, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Badge bg="#E7F6FD" color="#1596cc">{business.industry || 'Industry'}</Badge><Badge bg="#F1F5F9" color="#64748B">{business.deal_type || 'Deal'}</Badge><Badge bg="#E9F9EF" color="#16A34A">✓ {T(lang, 'Admin đã duyệt', 'Admin approved')}</Badge>{q !== null ? <Badge bg="#FEF3D3" color="#8a6413">◆ Quality {q}/100 · {qBand(lang, q)}</Badge> : null}
        </div>
        <h1 className="d68-h1" style={{ fontSize: 29, fontWeight: 800, letterSpacing: -.7, margin: '0 0 8px', lineHeight: 1.18 }}>{title}</h1>
        <p style={{ fontSize: 16, color: '#64748B', lineHeight: 1.6, margin: '0 0 18px', maxWidth: 780 }}>{subtitle}</p>

        <div style={{ border: '1px solid #E7EDF3', borderRadius: 18, overflow: 'hidden', background: '#0F2A4A', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}><div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9db4cc', fontWeight: 700 }}>{hero?.url ? <img className="d68-hero-img" src={hero.url} alt={hero.title || title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : T(lang, 'Ảnh đang được Admin cập nhật', 'Image pending Admin review')}</div></div>
        {heroImages.length > 1 ? <div style={{ display: 'flex', gap: 10, padding: '12px 0 0', overflowX: 'auto' }}>{heroImages.map((img, i) => <button key={img.url} onClick={() => setActiveImage(i)} style={{ width: 96, height: 64, borderRadius: 10, overflow: 'hidden', border: i === activeImage ? '2px solid #1BADEA' : '1px solid #CBD5E1', padding: 0, background: '#fff', cursor: 'pointer', flexShrink: 0 }}><img src={img.url} alt={img.title || title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></button>)}</div> : null}

        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '26px 0 12px' }}>{T(lang, 'Thông tin chính', 'Key facts')}</h2>
        <div className="d68-facts" style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '8px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 44, boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>{facts.map(([k, v]) => <FactRow key={k} k={k} v={v} />)}</div>

        {q !== null ? <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '22px 24px', boxShadow: '0 1px 2px rgba(15,42,74,.04)', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}><div style={{ flexShrink: 0, width: 104, height: 104, borderRadius: '50%', background: `conic-gradient(${qc} ${qDeg}deg, #EEF2F6 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 25, fontWeight: 800, color: qc }}>{q}</span><span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>/ 100</span></div></div><div style={{ flex: 1, minWidth: 230 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><span style={{ fontSize: 15.5, fontWeight: 800 }}>Business Quality Score</span><Badge bg="#F7FAFC" color={qc}>{qBand(lang, q)}</Badge></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}><Chip>📌 {T(lang, 'Hồ sơ đã duyệt', 'Approved profile')}</Chip><Chip>💰 {T(lang, 'Có số liệu tài chính', 'Financial data')}</Chip><Chip>🖼 {T(lang, 'Ảnh đã kiểm duyệt', 'Reviewed images')}</Chip><Chip>🔒 {T(lang, 'Dữ liệu nhạy cảm bị khóa', 'Sensitive data locked')}</Chip></div><p style={{ fontSize: 12, color: '#94A3B8', margin: '10px 0 0', lineHeight: 1.5 }}>{T(lang, 'Điểm chất lượng do Deals68 tổng hợp từ mức độ hoàn thiện hồ sơ, số liệu tài chính, điều khoản giao dịch, ảnh, tài liệu và thẩm định của Admin.', 'Quality Score is compiled by Deals68 from profile completeness, financials, deal terms, images, documents and Admin review.')}</p></div></div> : null}

        <Panel title={T(lang, 'Hồ sơ doanh nghiệp', 'Business profile')}><ul style={ulStyle}>{profileLines.length ? profileLines.map((p, i) => <li key={i}>{p}</li>) : <li>{T(lang, 'Nội dung hồ sơ đang được Admin cập nhật.', 'Business profile is being updated by Admin.')}</li>}</ul></Panel>
        <Panel title={T(lang, 'Điểm nổi bật thương vụ', 'Deal highlights')}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="d68-form-2">{highlights.length ? highlights.map((h, i) => <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: 14, background: '#F7FAFC', border: '1px solid #EEF2F6', borderRadius: 12 }}><span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: '#E7F6FD', color: '#1596cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>✓</span><span style={{ fontSize: 14, color: '#334155', lineHeight: 1.5 }}>{h}</span></div>) : <p style={{ color: '#64748B' }}>{T(lang, 'Chưa có highlight đã duyệt.', 'No approved highlights yet.')}</p>}</div></Panel>

        <Panel title={T(lang, 'Báo cáo tài chính 2024–2025', 'Financials 2024–2025')} right="Estimated · Subject to DD"><div style={{ overflowX: 'auto', minWidth: 0 }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 520 }}><thead><tr style={{ textAlign: 'left', color: '#94A3B8' }}><th style={th}>Metric</th><th style={th}>2024</th><th style={th}>2025E</th><th style={th}>Note</th></tr></thead><tbody><FinRow k={T(lang, 'Doanh thu', 'Revenue')} y24={T(lang, 'Mở sau DD', 'Unlock after DD')} y25={money(business.revenue_2025, business.revenue_currency || 'VND')} note={T(lang, 'Bản Admin duyệt', 'Admin approved')} /><FinRow k="EBITDA" y24={T(lang, 'Mở sau DD', 'Unlock after DD')} y25={business.ebitda_margin === null || business.ebitda_margin === undefined ? '—' : percent(business.ebitda_margin)} note={T(lang, 'Biên lợi nhuận ước tính', 'Estimated margin')} /><FinRow k={T(lang, 'Giá trị / Nhu cầu vốn', 'Amount / Capital sought')} y24="—" y25={amount} note={stake !== '—' ? `${T(lang, 'Cổ phần', 'Stake')}: ${stake}` : '—'} /></tbody></table></div><p style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 1.55, margin: '14px 0 0' }}>{T(lang, 'Số liệu công khai là teaser đã duyệt, không thay thế thẩm định chi tiết.', 'Public figures are approved teaser data and do not replace full due diligence.')}</p></Panel>

        <Panel title={T(lang, 'Tài liệu', 'Documents')} right={`🔒 ${T(lang, 'Mở khóa sau kết nối / NDA', 'Unlocks after connection / NDA')}`}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }} className="d68-form-2">{docRows.map((d, i) => <div key={d.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}><span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, background: '#EAF0F6', color: '#0F2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📄</span><span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#334155' }}>{docLabel(d)} <small style={{ color: '#94A3B8' }}>· {docExt(d)}</small></span><span style={{ flexShrink: 0, color: d.privacy_level === 'public' ? '#16A34A' : '#94A3B8' }}>{d.privacy_level === 'public' ? '✓' : '🔒'}</span></div>)}</div></Panel>

        <p style={{ marginTop: 20, fontSize: 12.5, color: '#94A3B8', lineHeight: 1.6 }}><b>{T(lang, 'Miễn trừ trách nhiệm:', 'Disclaimer:')}</b> {T(lang, 'Số liệu tài chính là ước tính minh họa, không phải cam kết lợi nhuận. Người dùng chịu trách nhiệm thẩm định trước khi giao dịch.', 'Financials are illustrative estimates, not profit guarantees. Users are responsible for their own due diligence before transacting.')}</p>
      </div>

      <aside className="d68-side" style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 26px rgba(15,42,74,.08)' }}><div style={{ background: '#0F2A4A', color: '#fff', padding: '18px 22px' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>{T(lang, 'Loại giao dịch', 'Transaction')}</div><div style={{ fontSize: 17, fontWeight: 800 }}>{business.deal_type || 'Deal'}</div></div><div style={{ padding: '20px 22px' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: .5 }}>{T(lang, 'Giá trị / Nhu cầu vốn', 'Amount')}</div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -.8, color: '#0F2A4A', margin: '2px 0' }}>{amount}</div><div style={{ fontSize: 12.5, color: '#94A3B8' }}>{stake !== '—' ? `${T(lang, 'Cổ phần', 'Stake')}: ${stake}` : T(lang, 'Điều khoản mở sau kết nối', 'Terms unlock after connection')}</div><div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}><Term k={T(lang, 'Doanh thu 2025E', 'Revenue 2025E')} v={money(business.revenue_2025, business.revenue_currency || 'VND')} /><Term k="EBITDA" v={business.ebitda_margin === null || business.ebitda_margin === undefined ? '—' : percent(business.ebitda_margin)} /><Term k="Quality" v={q === null ? '—' : `${q}/100`} /></div><div style={{ marginTop: 16, padding: '12px 14px', background: '#F7FAFC', border: '1px solid #EEF2F6', borderRadius: 11, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}><b style={{ color: '#334155' }}>{T(lang, 'Lý do giao dịch:', 'Reason:')}</b> {profileLines[0] || subtitle}</div></div></div>
        <div style={box}><div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{T(lang, 'Kết nối với doanh nghiệp', 'Connect with the business')}</div><p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: '0 0 14px' }}>{T(lang, 'Tên, liên hệ và toàn bộ tài liệu mở sau khi hai bên chấp nhận kết nối / ký NDA.', 'Name, contact and all documents unlock after both parties accept the connection / sign an NDA.')}</p><button onClick={expressInterest} style={{ display: 'block', width: '100%', textAlign: 'center', background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 16, padding: 14, borderRadius: 12, boxShadow: '0 8px 20px rgba(242,181,29,.32)', border: 'none', cursor: 'pointer' }}>{T(lang, 'Bày tỏ quan tâm', 'Express interest')}</button><button onClick={requestData} style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 10, border: '1px solid #1BADEA', color: '#1596cc', background: '#fff', fontWeight: 700, fontSize: 14.5, padding: 12, borderRadius: 11, cursor: 'pointer' }}>{T(lang, 'Yêu cầu IM / NDA', 'Request IM / NDA')}</button>{msg ? <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: '#1596cc', lineHeight: 1.45 }}>{msg}</div> : null}</div>
        <div style={box}><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#334155' }}>{T(lang, 'Đã xác minh', 'Verified')}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Verify>{T(lang, 'Hồ sơ ẩn danh', 'Anonymous profile')}</Verify><Verify>{T(lang, 'Admin duyệt', 'Admin reviewed')}</Verify><Verify>{T(lang, 'Thông tin nhạy cảm khóa', 'Private data locked')}</Verify></div></div>
      </aside>
    </div>

    {similar.length ? <section style={{ background: '#fff', borderTop: '1px solid #E7EDF3' }}><div style={{ maxWidth: 1240, margin: '0 auto', padding: '52px 24px' }}><div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}><h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: -.6, margin: 0 }}>{T(lang, 'Thương vụ tương tự', 'Similar deals')}</h2><Link to="/businesses" style={{ fontWeight: 700, color: '#1BADEA', fontSize: 15 }}>{T(lang, 'Xem tất cả', 'View all')} →</Link></div><div className="d68-sim" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>{similar.map((s) => <Link key={s.id} to={`/businesses/${s.slug}`} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}><div style={{ height: 150, overflow: 'hidden', background: '#0F2A4A' }}>{s.image ? <img src={s.image} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}</div><div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontSize: 12, fontWeight: 600, color: '#1596cc', background: '#E7F6FD', padding: '3px 9px', borderRadius: 6, alignSelf: 'flex-start', marginBottom: 9 }}>{s.industry}</span><h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, margin: '0 0 12px', flex: 1 }}>{s.title}</h3><div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #EEF2F6', fontSize: 13 }}><span style={{ color: '#94A3B8', fontWeight: 600 }}>{s.txType}</span><span style={{ fontWeight: 800, color: '#1596cc' }}>{s.amount}</span></div></div></Link>)}</div></div></section> : null}
  </main>;
}

const box = { background: '#fff', border: '1px solid #E7EDF3', borderRadius: 18, padding: 22, boxShadow: '0 1px 2px rgba(15,42,74,.04)' };
const ulStyle = { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 9, color: '#475569', lineHeight: 1.6 };
const th = { padding: '10px 0', borderBottom: '1px solid #EEF2F6' } as const;
const td = { padding: '11px 0', borderBottom: '1px solid #F1F5F9' } as const;
function Badge({ bg, color, children }: { bg: string; color: string; children: any }) { return <span style={{ fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 7, background: bg, color }}>{children}</span>; }
function Chip({ children }: { children: any }) { return <span style={{ fontSize: 12.5, color: '#475569', background: '#F7FAFC', border: '1px solid #EEF2F6', padding: '6px 10px', borderRadius: 999 }}>{children}</span>; }
function FactRow({ k, v }: { k: string; v: any }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid #F1F5F9' }}><span style={{ fontSize: 13.5, color: '#64748B', flexShrink: 0 }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F2A4A', textAlign: 'right' }}>{v}</span></div>; }
function Panel({ title, right, children }: { title: string; right?: string; children: any }) { return <div style={{ marginTop: 22, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '26px 28px', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}><h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{title}</h2>{right ? <span style={{ fontSize: 11.5, fontWeight: 700, color: '#B8860B', background: '#FEF3D3', padding: '5px 11px', borderRadius: 7 }}>{right}</span> : null}</div>{children}</div>; }
function FinRow({ k, y24, y25, note }: { k: string; y24: string; y25: string; note: string }) { return <tr><td style={{ ...td, fontWeight: 800 }}>{k}</td><td style={td}>{y24}</td><td style={{ ...td, fontWeight: 800, color: '#0F2A4A' }}>{y25}</td><td style={{ ...td, color: '#64748B' }}>{note}</td></tr>; }
function Term({ k, v }: { k: string; v: string }) { return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}><span style={{ color: '#64748B' }}>{k}</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span></div>; }
function Verify({ children }: { children: any }) { return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#16A34A', background: '#E9F9EF', padding: '6px 11px', borderRadius: 8 }}>✓ {children}</span>; }
