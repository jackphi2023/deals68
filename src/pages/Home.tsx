import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { countBusinesses, countInvestors, listBusinesses, listInvestors } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type Deal = { id: string; slug: string; title: string; industry: string; revenue: string; ask: string; image?: string | null; featured: boolean };
function normalizeDeal(b: any, lang: Lang): Deal {
  const title = T(lang, b.title_vi || b.public_code || 'Hồ sơ doanh nghiệp', b.title_en || b.title_vi || b.public_code || 'Business profile');
  return { id: String(b.id || b.slug), slug: String(b.slug || b.username || b.id), title, industry: b.industry || 'TBD', revenue: Number(b.revenue_2025 || 0) > 0 ? formatCompactMoney(b.revenue_2025, b.revenue_currency || 'VND') : 'TBD', ask: Number(b.ask_amount || 0) > 0 ? formatCompactMoney(b.ask_amount, b.ask_currency || b.revenue_currency || 'VND') : 'TBD', image: b.image_url || b.hero_image_url || null, featured: b.plan === 'featured' || b.featured === true };
}

export default function Home({ lang }: { lang: Lang }) {
  const [bizCount, setBizCount] = useState<number | null>(null);
  const [invCount, setInvCount] = useState<number | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      try {
        const [bc, ic, bs, invs] = await Promise.all([
          countBusinesses().catch(() => null),
          countInvestors().catch(() => null),
          listBusinesses({ limit: 6 }).catch(() => []),
          listInvestors({ limit: 4 }).catch(() => [])
        ]);
        if (!live) return;
        setBizCount(bc); setInvCount(ic); setDeals((bs || []).map((b: any) => normalizeDeal(b, lang))); setInvestors(invs || []);
      } finally { if (live) setLoading(false); }
    }
    load(); return () => { live = false; };
  }, [lang]);

  const totalAsk = useMemo(() => deals.reduce((sum, d) => sum + (d.ask === 'TBD' ? 0 : 1), 0), [deals]);

  return <main>
    <section style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(900px 420px at 82% 0%, rgba(27,173,234,.22), transparent 60%), linear-gradient(180deg,#0F2A4A,#14315A)', color: '#fff' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '76px 24px 88px', display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) 430px', gap: 36, alignItems: 'center' }} className="d68-detail-cols">
        <div><div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.16)', color: '#cfe8f6', padding: '7px 14px', borderRadius: 999, fontWeight: 700, fontSize: 13, marginBottom: 20 }}>{T(lang, 'Kết nối thương vụ, khai mở lộc phát', 'Connecting Deals, Unlocking Prosperity')}</div><h1 style={{ fontSize: 48, lineHeight: 1.08, letterSpacing: -1.2, margin: '0 0 18px' }}>{T(lang, 'Nền tảng kết nối doanh nghiệp và nhà đầu tư toàn cầu', 'Connecting businesses with global investors')}</h1><p style={{ fontSize: 17, lineHeight: 1.65, color: '#c6d5e6', margin: '0 0 28px' }}>{T(lang, 'Deals68 hiển thị hồ sơ ẩn danh, dữ liệu theo database thật, và chỉ mở thông tin nhạy cảm sau workflow kết nối được duyệt.', 'Deals68 displays anonymous profiles, uses live database-backed data, and unlocks sensitive information only after an approved connection workflow.')}</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Link to="/businesses" style={{ background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, padding: '14px 24px', borderRadius: 11 }}>{T(lang, 'Xem doanh nghiệp', 'View businesses')}</Link><Link to="/investors" style={{ border: '1px solid rgba(255,255,255,.28)', color: '#fff', fontWeight: 800, padding: '14px 24px', borderRadius: 11 }}>{T(lang, 'Xem nhà đầu tư', 'View investors')}</Link></div></div>
        <div style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 22, padding: 24 }}><h3 style={{ margin: '0 0 16px', color: '#F2B51D' }}>{T(lang, 'Dữ liệu Beta hiện tại', 'Current Beta data')}</h3><Stat label={T(lang, 'Doanh nghiệp active', 'Active businesses')} value={bizCount === null ? '—' : bizCount.toLocaleString('vi-VN')} /><Stat label={T(lang, 'Nhà đầu tư active', 'Active investors')} value={invCount === null ? '—' : invCount.toLocaleString('vi-VN')} /><Stat label={T(lang, 'Hồ sơ có giá chào', 'Profiles with ask data')} value={loading ? '—' : String(totalAsk)} /><p style={{ color: '#9db4cc', fontSize: 12.5, lineHeight: 1.55, margin: '14px 0 0' }}>{T(lang, 'Không dùng số marketing giả; số liệu tự động lấy từ Supabase.', 'No fake marketing numbers; metrics are loaded from Supabase.')}</p></div>
      </div>
    </section>

    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, marginBottom: 24 }}><div><div style={{ color: '#1596cc', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Live opportunities</div><h2 style={{ fontSize: 30, margin: '8px 0 0' }}>{T(lang, 'Doanh nghiệp đang hiển thị', 'Currently listed businesses')}</h2></div><Link to="/businesses" style={{ color: '#1596cc', fontWeight: 800 }}>{T(lang, 'Xem tất cả', 'View all')} →</Link></div>{loading ? <p>{T(lang, 'Đang tải...', 'Loading...')}</p> : deals.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>{deals.map((d) => <Link key={d.id} to={`/businesses/${d.slug}`} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', color: '#0F2A4A' }}><div style={{ height: 150, background: '#EAF0F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: 700 }}>{d.image ? <img src={d.image} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : T(lang, 'Ảnh đang cập nhật', 'Image pending')}</div><div style={{ padding: 16 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#1596cc' }}>{d.industry}</span><h3 style={{ fontSize: 15.5, lineHeight: 1.35 }}>{d.title}</h3><div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 13 }}><span>{d.revenue}</span><b style={{ color: '#0F2A4A' }}>{d.ask}</b></div></div></Link>)}</div> : <Empty text={T(lang, 'Chưa có doanh nghiệp active/visible.', 'No active/visible businesses yet.')} />}</section>

    <section style={{ background: '#F7FAFC', borderTop: '1px solid #E7EDF3' }}><div style={{ maxWidth: 1180, margin: '0 auto', padding: '62px 24px' }}><div style={{ color: '#1596cc', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' }}>Live investors</div><h2 style={{ fontSize: 30, margin: '8px 0 22px' }}>{T(lang, 'Nhà đầu tư đang hiển thị', 'Currently listed investors')}</h2>{investors.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>{investors.map((i) => <Link to={`/investors/${i.code}`} key={i.id || i.code} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 18 }}><b>{i.title_vi || i.title_en || i.code}</b><p style={{ color: '#64748B', fontSize: 13 }}>{i.type || 'Investor'} · {i.country || i.country_iso2 || 'Global'}</p></Link>)}</div> : <Empty text={T(lang, 'Chưa có nhà đầu tư active/visible.', 'No active/visible investors yet.')} />}</div></section>
  </main>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.12)', padding: '12px 0' }}><span style={{ color: '#c6d5e6' }}>{label}</span><b style={{ color: '#fff' }}>{value}</b></div>; }
function Empty({ text }: { text: string }) { return <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, padding: 34, color: '#64748B', textAlign: 'center' }}>{text}</div>; }
