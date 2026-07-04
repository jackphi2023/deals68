import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { countBusinesses, countInvestors, listBusinesses, listInvestors } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
type SearchMode = 'business' | 'investor';
type Deal = { id: string; slug: string; title: string; industry: string; revenue: string; ask: string; image?: string | null; featured: boolean };

function normalizeDeal(b: any, lang: Lang): Deal {
  const title = T(lang, b.title_vi || b.public_code || 'Hồ sơ doanh nghiệp', b.title_en || b.title_vi || b.public_code || 'Business profile');
  const image = b.image_url || b.hero_image_url || (Array.isArray(b.business_images) && b.business_images[0]?.public_url) || null;
  return {
    id: String(b.id || b.slug), slug: String(b.slug || b.username || b.id), title,
    industry: b.industry || 'TBD',
    revenue: Number(b.revenue_2025 || 0) > 0 ? formatCompactMoney(b.revenue_2025, b.revenue_currency || 'VND') : 'TBD',
    ask: Number(b.ask_amount || 0) > 0 ? formatCompactMoney(b.ask_amount, b.ask_currency || b.revenue_currency || 'VND') : 'TBD',
    image,
    featured: b.plan === 'featured' || b.featured === true
  };
}
function buildPath(base: string, params: Record<string, string>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v.trim()) qs.set(k, v.trim()); });
  return `${base}${qs.toString() ? `?${qs.toString()}` : ''}`;
}

export default function Home({ lang }: { lang: Lang }) {
  const navigate = useNavigate();
  const [bizCount, setBizCount] = useState<number | null>(null);
  const [invCount, setInvCount] = useState<number | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<SearchMode>('business');
  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [dealType, setDealType] = useState('');
  const [investorType, setInvestorType] = useState('');

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      try {
        const [bc, ic, bs, invs] = await Promise.all([
          countBusinesses().catch(() => null), countInvestors().catch(() => null),
          listBusinesses({ limit: 6 }).catch(() => []), listInvestors({ limit: 4 }).catch(() => [])
        ]);
        if (!live) return;
        setBizCount(bc); setInvCount(ic); setDeals((bs || []).map((b: any) => normalizeDeal(b, lang))); setInvestors(invs || []);
      } finally { if (live) setLoading(false); }
    }
    load(); return () => { live = false; };
  }, [lang]);

  const totalAsk = useMemo(() => deals.reduce((sum, d) => sum + (d.ask === 'TBD' ? 0 : 1), 0), [deals]);
  const businessSearchUrl = buildPath('/businesses', { search: keyword, industry, country, dealType });
  const investorSearchUrl = buildPath('/investors', { search: keyword, industry, country, type: investorType });
  const searchUrl = mode === 'business' ? businessSearchUrl : investorSearchUrl;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(searchUrl);
  }

  return <main>
    <section style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(900px 420px at 82% 0%, rgba(27,173,234,.22), transparent 60%), linear-gradient(180deg,#0F2A4A,#14315A)', color: '#fff' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '76px 24px 88px', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) 460px', gap: 36, alignItems: 'center' }} className="d68-detail-cols">
        <div>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#cfe8f6', padding: '7px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, marginBottom: 20 }}>{T(lang, 'Kết nối thương vụ, khai mở lộc phát', 'Connecting Deals, Unlocking Prosperity')}</div>
          <h1 style={{ fontSize: 48, lineHeight: 1.08, letterSpacing: -1.2, margin: '0 0 18px' }}>
            {T(lang, 'Nơi Doanh nghiệp gặp gỡ', 'Where Businesses Meet')}<br />{T(lang, 'Nhà đầu tư', 'Investors')}
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#c6d5e6', margin: '0 0 28px' }}>{T(lang, 'Deals68 hiển thị hồ sơ ẩn danh, dữ liệu theo database thật, và chỉ mở thông tin nhạy cảm sau workflow kết nối được duyệt.', 'Deals68 displays anonymous profiles, uses live database-backed data, and unlocks sensitive information only after an approved connection workflow.')}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Link to="/businesses" style={{ background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, padding: '14px 24px', borderRadius: 11 }}>{T(lang, 'Xem doanh nghiệp', 'View businesses')}</Link><Link to="/investors" style={{ border: '1px solid rgba(255,255,255,.28)', color: '#fff', fontWeight: 800, padding: '14px 24px', borderRadius: 11 }}>{T(lang, 'Xem nhà đầu tư', 'View investors')}</Link></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <form onSubmit={submitSearch} style={{ background: '#fff', color: '#0F2A4A', borderRadius: 22, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#EEF2F6', borderRadius: 13, padding: 4, marginBottom: 16 }}>
              <button type="button" onClick={() => setMode('business')} style={{ border: 0, borderRadius: 10, padding: '11px 12px', fontWeight: 800, color: mode === 'business' ? '#0F2A4A' : '#64748B', background: mode === 'business' ? '#fff' : 'transparent', cursor: 'pointer' }}>{T(lang, 'Tìm Doanh nghiệp', 'Find Businesses')}</button>
              <button type="button" onClick={() => setMode('investor')} style={{ border: 0, borderRadius: 10, padding: '11px 12px', fontWeight: 800, color: mode === 'investor' ? '#0F2A4A' : '#64748B', background: mode === 'investor' ? '#fff' : 'transparent', cursor: 'pointer' }}>{T(lang, 'Tìm nhà đầu tư', 'Find Investors')}</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={mode === 'business' ? T(lang, 'Từ khóa: ngành, mã hồ sơ, địa điểm...', 'Keyword: industry, code, location...') : T(lang, 'Từ khóa: quỹ, ngành, quốc gia...', 'Keyword: fund, sector, country...')} style={fieldStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="d68-form-2">
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={T(lang, 'Ngành', 'Industry')} style={fieldStyle} />
                <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder={T(lang, 'Quốc gia: VN, US, SG...', 'Country: VN, US, SG...')} style={fieldStyle} />
              </div>
              {mode === 'business' ? <select value={dealType} onChange={(e) => setDealType(e.target.value)} style={fieldStyle}><option value="">{T(lang, 'Tất cả loại giao dịch', 'All deal types')}</option><option value="gọi vốn">{T(lang, 'Gọi vốn', 'Fundraising')}</option><option value="bán">{T(lang, 'Mua bán / chuyển nhượng', 'Sale / transfer')}</option><option value="vay">{T(lang, 'Vay vốn', 'Debt')}</option><option value="đối tác">JV / Partner</option></select> : <select value={investorType} onChange={(e) => setInvestorType(e.target.value)} style={fieldStyle}><option value="">{T(lang, 'Tất cả loại nhà đầu tư', 'All investor types')}</option><option>VC</option><option>PE</option><option>Family Office</option><option>Corporate/Strategic</option><option>Individual/Angel</option><option>Lender/Debt</option></select>}
              <button type="submit" style={{ border: 0, borderRadius: 12, background: '#1BADEA', color: '#fff', padding: '13px 16px', fontWeight: 900, cursor: 'pointer' }}>{mode === 'business' ? T(lang, 'Tìm Doanh nghiệp', 'Find Businesses') : T(lang, 'Tìm nhà đầu tư', 'Find Investors')} →</button>
            </div>
          </form>
          <div style={{ background: '#FEF3D3', color: '#7a5c12', border: '1px solid rgba(242,181,29,.55)', borderRadius: 16, padding: '13px 16px', fontSize: 13.5, fontWeight: 700, lineHeight: 1.5 }}>
            🎁 {T(lang, 'Ưu đãi Beta áp dụng trong thời gian giới hạn. Banner hiện chưa gắn link; khi có chương trình chính thức Admin sẽ cập nhật đường dẫn.', 'Beta promotion applies for a limited time. This banner has no link yet; Admin can add one when the campaign is official.')}
          </div>
        </div>
      </div>
    </section>

    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, marginBottom: 24 }}><div><div style={{ color: '#1596cc', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Live opportunities</div><h2 style={{ fontSize: 30, margin: '8px 0 0' }}>{T(lang, 'Doanh nghiệp đang hiển thị', 'Currently listed businesses')}</h2></div><Link to="/businesses" style={{ color: '#1596cc', fontWeight: 800 }}>{T(lang, 'Xem tất cả', 'View all')} →</Link></div>{loading ? <p>{T(lang, 'Đang tải...', 'Loading...')}</p> : deals.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>{deals.map((d) => <Link key={d.id} to={`/businesses/${d.slug}`} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', color: '#0F2A4A' }}><div style={{ height: 150, background: '#EAF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: 700 }}>{d.image ? <img src={d.image} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : T(lang, 'Ảnh đang cập nhật', 'Image pending')}</div><div style={{ padding: 16 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#1596cc' }}>{d.industry}</span><h3 style={{ fontSize: 15.5, lineHeight: 1.35 }}>{d.title}</h3><div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 13 }}><span>{d.revenue}</span><b style={{ color: '#0F2A4A' }}>{d.ask}</b></div></div></Link>)}</div> : <Empty text={T(lang, 'Chưa có doanh nghiệp active/visible.', 'No active/visible businesses yet.')} />}</section>

    <section style={{ background: '#F7FAFC', borderTop: '1px solid #E7EDF3' }}><div style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}><div style={{ color: '#1596cc', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Live investors</div><h2 style={{ fontSize: 30, margin: '8px 0 22px' }}>{T(lang, 'Nhà đầu tư đang hiển thị', 'Currently listed investors')}</h2>{investors.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>{investors.map((i) => <Link to={`/investors/${i.code}`} key={i.id || i.code} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 18 }}><b>{i.title_vi || i.title_en || i.code}</b><p style={{ color: '#64748B', fontSize: 13 }}>{i.type || 'Investor'} · {i.country || i.country_iso2 || 'Global'}</p></Link>)}</div> : <Empty text={T(lang, 'Chưa có nhà đầu tư active/visible.', 'No active/visible investors yet.')} />}</div></section>
  </main>;
}
const fieldStyle = { border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 13px', fontSize: 14.5, color: '#0F2A4A', background: '#F8FAFC', outline: 'none', width: '100%' };
function Empty({ text }: { text: string }) { return <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: 34, color: '#64748B', textAlign: 'center' }}>{text}</div>; }
