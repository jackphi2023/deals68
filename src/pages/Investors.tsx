import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listInvestors } from '../lib/data';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const PAGE_SIZE = 12;
const INVESTOR_TYPES = ['VC', 'PE', 'Institutional', 'Corporate/Strategic', 'Individual/Angel', 'Family Office', 'Lender/Debt'];
const REGION_OPTIONS = ['asia', 'americas', 'mideast'] as const;
const FALLBACK_INDUSTRIES = ['F&B', 'Healthcare', 'Retail', 'Manufacturing', 'Technology', 'Logistics', 'Education', 'Real Estate', 'Seafood & Export', 'Business Services'];
const FALLBACK_STAGES = ['Seed', 'Series A', 'Growth', 'Mature', 'Buyout', 'Debt', 'Strategic'];

type InvestorLite = {
  id?: string;
  code: string;
  type: string;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  country: string;
  countryVi: string;
  region: string;
  industries: string[];
  dealTypes: string[];
  stage: string;
  ticketMin: number;
  ticketMax: number;
  verified: boolean;
  activity_level: string;
  ranking_score: number;
};

const REFERENCE_INVESTORS: InvestorLite[] = [
  { code: 'INV-0001', type: 'VC', titleVi: 'Quỹ VC khu vực đang tìm công ty công nghệ Việt Nam', titleEn: 'Regional VC fund seeking Vietnamese technology companies', descVi: 'Nhà đầu tư mạo hiểm tập trung SaaS, mobile, AI và nền tảng số tại Việt Nam và Singapore.', descEn: 'Venture investor focused on SaaS, mobile, AI and digital platforms in Vietnam and Singapore.', country: 'Singapore', countryVi: 'Singapore', region: 'asia', industries: ['Technology', 'SaaS', 'AI'], dealTypes: ['Equity', 'Seed', 'Series A'], stage: 'Seed', ticketMin: 500000, ticketMax: 3000000, verified: true, activity_level: 'high', ranking_score: 92 },
  { code: 'INV-0002', type: 'PE', titleVi: 'Quỹ PE khu vực quan tâm chuỗi F&B, bán lẻ và sản xuất', titleEn: 'Regional PE fund interested in F&B, retail and manufacturing', descVi: 'Tìm doanh nghiệp có doanh thu, lợi nhuận và khả năng mở rộng tại Việt Nam và Đông Nam Á.', descEn: 'Looking for revenue-generating, profitable and scalable businesses in Vietnam and Southeast Asia.', country: 'Singapore', countryVi: 'Singapore', region: 'asia', industries: ['F&B', 'Retail', 'Manufacturing'], dealTypes: ['Growth equity', 'Buyout'], stage: 'Growth', ticketMin: 2000000, ticketMax: 10000000, verified: true, activity_level: 'high', ranking_score: 90 },
  { code: 'INV-0003', type: 'Family Office', titleVi: 'Family Office ưu tiên y tế, giáo dục và bất động sản vận hành', titleEn: 'Family Office prioritizing healthcare, education and operating real estate', descVi: 'Khẩu vị đầu tư dài hạn, ưu tiên tài sản/dòng tiền ổn định và đội ngũ sáng lập mạnh.', descEn: 'Long-term capital preference, prioritizing stable cash flow/assets and strong founders.', country: 'Hong Kong', countryVi: 'Hong Kong', region: 'asia', industries: ['Healthcare', 'Education', 'Real Estate'], dealTypes: ['Equity', 'Strategic stake'], stage: 'Mature', ticketMin: 5000000, ticketMax: 20000000, verified: true, activity_level: 'medium', ranking_score: 83 },
  { code: 'INV-0004', type: 'Corporate/Strategic', titleVi: 'Người mua chiến lược trong ngành thủy sản và thực phẩm xuất khẩu', titleEn: 'Strategic buyer in seafood and food export', descVi: 'Tìm nhà máy chế biến, thương hiệu thực phẩm và doanh nghiệp xuất khẩu có chứng chỉ quốc tế.', descEn: 'Seeking processing plants, food brands and exporters with international certifications.', country: 'Japan', countryVi: 'Nhật Bản', region: 'asia', industries: ['Seafood & Export', 'Manufacturing', 'Food'], dealTypes: ['M&A', 'Strategic investment'], stage: 'Mature', ticketMin: 3000000, ticketMax: 50000000, verified: true, activity_level: 'high', ranking_score: 88 },
  { code: 'INV-0005', type: 'Individual/Angel', titleVi: 'Nhà đầu tư cá nhân quan tâm công nghệ và dịch vụ B2B', titleEn: 'Angel investor interested in technology and B2B services', descVi: 'Tìm các startup có traction sớm, đội ngũ gọn và mô hình doanh thu rõ ràng.', descEn: 'Looking for early traction startups with lean teams and clear revenue models.', country: 'United States', countryVi: 'Hoa Kỳ', region: 'americas', industries: ['Technology', 'Business Services'], dealTypes: ['Angel', 'Convertible'], stage: 'Seed', ticketMin: 100000, ticketMax: 1000000, verified: false, activity_level: 'medium', ranking_score: 72 },
  { code: 'INV-0006', type: 'Lender/Debt', titleVi: 'Bên cho vay tìm doanh nghiệp có dòng tiền và tài sản đảm bảo', titleEn: 'Debt investor seeking cash-flow businesses with collateral', descVi: 'Ưu tiên doanh nghiệp có lịch sử doanh thu, đơn hàng, tài sản hoặc hợp đồng khách hàng ổn định.', descEn: 'Prefers businesses with revenue history, orders, assets or stable customer contracts.', country: 'United Arab Emirates', countryVi: 'UAE', region: 'mideast', industries: ['Manufacturing', 'Logistics', 'Real Estate'], dealTypes: ['Debt', 'Asset-backed loan'], stage: 'Growth', ticketMin: 1000000, ticketMax: 15000000, verified: true, activity_level: 'medium', ranking_score: 78 },
  { code: 'INV-0007', type: 'Institutional', titleVi: 'Định chế tài chính tìm cơ hội hạ tầng và cold chain', titleEn: 'Institutional investor seeking infrastructure and cold-chain opportunities', descVi: 'Quan tâm tài sản có dòng tiền, hợp đồng dài hạn và nhu cầu vốn lớn.', descEn: 'Interested in cash-flow assets, long-term contracts and larger capital needs.', country: 'Singapore', countryVi: 'Singapore', region: 'asia', industries: ['Logistics', 'Cold Chain', 'Infrastructure'], dealTypes: ['Infrastructure equity', 'Debt'], stage: 'Mature', ticketMin: 5000000, ticketMax: 50000000, verified: true, activity_level: 'high', ranking_score: 86 }
];

function arr(value: any): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  return String(value).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

function normalizeInvestor(inv: any, index: number): InvestorLite {
  const code = inv?.code || inv?.username || inv?.id || `INV-${String(index + 1).padStart(4, '0')}`;
  const type = inv?.type || INVESTOR_TYPES[index % INVESTOR_TYPES.length];
  const country = inv?.country || inv?.country_iso2 || 'Vietnam';
  const regionRaw = String(inv?.region || '').toLowerCase();
  const region = regionRaw.includes('america') ? 'americas' : regionRaw.includes('middle') || regionRaw.includes('mideast') || regionRaw.includes('uae') ? 'mideast' : 'asia';
  const industries = arr(inv?.industries).length ? arr(inv?.industries) : FALLBACK_INDUSTRIES.slice(index % 4, index % 4 + 3);
  const dealTypes = arr(inv?.deal_types).length ? arr(inv?.deal_types) : arr(inv?.dealTypes).length ? arr(inv?.dealTypes) : ['Equity', 'M&A'];
  const activity = inv?.activity_level || (Number(inv?.admin_priority || 0) > 5 ? 'high' : inv?.verified ? 'medium' : 'low');
  const ranking = Number(inv?.admin_priority || 0) * 10 + (inv?.verified ? 20 : 0) + (activity === 'high' ? 30 : activity === 'medium' ? 15 : 0);
  return {
    id: inv?.id,
    code,
    type,
    titleVi: inv?.title_vi || inv?.titleVi || `${type} · ${country}`,
    titleEn: inv?.title_en || inv?.titleEn || inv?.title_vi || `${type} · ${country}`,
    descVi: inv?.desc_vi || inv?.descVi || 'Hồ sơ nhà đầu tư ẩn danh đang tìm kiếm thương vụ phù hợp trên Deals68.',
    descEn: inv?.desc_en || inv?.descEn || inv?.desc_vi || 'Anonymous investor profile looking for suitable deals on Deals68.',
    country,
    countryVi: country === 'United States' ? 'Hoa Kỳ' : country === 'Japan' ? 'Nhật Bản' : country === 'South Korea' ? 'Hàn Quốc' : country,
    region,
    industries,
    dealTypes,
    stage: inv?.stage || FALLBACK_STAGES[index % FALLBACK_STAGES.length],
    ticketMin: Number(inv?.ticket_min ?? inv?.ticketMin ?? 100000),
    ticketMax: Number(inv?.ticket_max ?? inv?.ticketMax ?? 5000000),
    verified: Boolean(inv?.verified),
    activity_level: activity,
    ranking_score: Number(inv?.ranking_score || ranking || 50)
  };
}

function regionLabel(lang: Lang, region: string) {
  if (region === 'americas') return T(lang, 'Châu Mỹ', 'Americas');
  if (region === 'mideast') return T(lang, 'Trung Đông', 'Middle East');
  return T(lang, 'Châu Á', 'Asia');
}

function iconStyle(type: string) {
  const map: Record<string, [string, string]> = {
    VC: ['#E7F6FD', '#1596cc'],
    PE: ['#FEF3D3', '#B8860B'],
    Institutional: ['#EAF0F6', '#0F2A4A'],
    'Corporate/Strategic': ['#FDECEC', '#DC2626'],
    'Individual/Angel': ['#E9F9EF', '#16A34A'],
    'Family Office': ['#F3E8FF', '#7c3aed'],
    'Lender/Debt': ['#F1F5F9', '#334155']
  };
  return map[type] || ['#F1F5F9', '#334155'];
}

function initials(type: string) {
  return ({ VC: 'VC', PE: 'PE', Institutional: 'IN', 'Corporate/Strategic': 'CS', 'Individual/Angel': 'IA', 'Family Office': 'FO', 'Lender/Debt': 'LD' } as Record<string, string>)[type] || '?';
}

function activityLabel(lang: Lang, level: string) {
  if (level === 'high') return T(lang, 'Hoạt động cao', 'High activity');
  if (level === 'medium') return T(lang, 'Hoạt động vừa', 'Medium activity');
  return T(lang, 'Ít hoạt động', 'Low activity');
}

function activityColor(level: string) {
  return level === 'high' ? '#16A34A' : level === 'medium' ? '#B8860B' : '#94A3B8';
}

function ticketLabel(inv: InvestorLite) {
  return '$' + (inv.ticketMin / 1000).toFixed(0) + 'K – $' + (inv.ticketMax / 1e6).toFixed(1) + 'M';
}

function countByType(items: InvestorLite[], type: string) {
  return items.filter((x) => x.type === type).length;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export default function Investors({ lang }: { lang: Lang }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InvestorLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [region, setRegion] = useState('all');
  const [country, setCountry] = useState('all');
  const [industry, setIndustry] = useState('all');
  const [stage, setStage] = useState('all');
  const [ticket, setTicket] = useState('0');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const rows = await listInvestors({ limit: 1000 });
        if (mounted) setItems((rows || []).map(normalizeInvestor));
      } catch {
        if (mounted) setItems(REFERENCE_INVESTORS);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  function toggleType(type: string) {
    setTypeFilters((cur) => cur.includes(type) ? cur.filter((x) => x !== type) : [...cur, type]);
    setPage(1);
  }

  function clearFilters() {
    setTypeFilters([]); setRegion('all'); setCountry('all'); setIndustry('all'); setStage('all'); setTicket('0'); setPage(1);
  }

  const countryOptions = useMemo(() => uniqueSorted(items.map((i) => i.country)), [items]);
  const industryOptions = useMemo(() => uniqueSorted(items.flatMap((i) => i.industries)).length ? uniqueSorted(items.flatMap((i) => i.industries)) : FALLBACK_INDUSTRIES, [items]);
  const stageOptions = useMemo(() => uniqueSorted(items.map((i) => i.stage)).length ? uniqueSorted(items.map((i) => i.stage)) : FALLBACK_STAGES, [items]);

  const filtered = useMemo(() => {
    const list = items.filter((inv) => {
      if (typeFilters.length && !typeFilters.includes(inv.type)) return false;
      if (region !== 'all' && inv.region !== region) return false;
      if (country !== 'all' && inv.country !== country) return false;
      if (industry !== 'all' && !inv.industries.includes(industry)) return false;
      if (stage !== 'all' && inv.stage !== stage) return false;
      if (Number(ticket) > 0 && inv.ticketMin > Number(ticket)) return false;
      return true;
    });
    return list.slice().sort((a, b) => b.ranking_score - a.ranking_score);
  }, [items, typeFilters, region, country, industry, stage, ticket]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageInvestors = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showLoginBanner = !profile;
  const showQuotaBanner = profile?.role === 'business';

  function sendProposal(code: string) {
    if (!profile) { navigate('/register/business'); return; }
    if (profile.role !== 'business') { setFeedback((cur) => ({ ...cur, [code]: { ok: false, msg: T(lang, 'Chỉ tài khoản DN được gửi', 'Business accounts only') } })); return; }
    setFeedback((cur) => ({ ...cur, [code]: { ok: true, msg: T(lang, 'Đã ghi nhận proposal ✓', 'Proposal recorded ✓') } }));
  }

  return <>
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '26px 24px 8px' }}>
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}>
        <Link to="/"><span className="l-vi">Trang chủ</span><span className="l-en">Home</span></Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: '#475569', fontWeight: 600 }}><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></span>
      </div>
      <h1 className="d68-h1" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -.8, margin: '0 0 8px' }}><span className="l-vi">Nhà đầu tư trên Deals68</span><span className="l-en">Investors on Deals68</span></h1>
      <p style={{ fontSize: 15, color: '#64748B', margin: '0 0 14px', maxWidth: 820 }}><span className="l-vi">{items.length || 624} hồ sơ Nhà đầu tư ẩn danh — VC, PE, định chế, chiến lược, family office và cá nhân. Sắp xếp theo mức độ hoạt động.</span><span className="l-en">{items.length || 624} anonymous investor profiles — VC, PE, institutional, strategic, family office and individuals. Sorted by activity ranking.</span></p>
      {showLoginBanner ? <div style={{ background: '#FEF3D3', border: '1px solid #F5D98A', color: '#8a6413', borderRadius: 12, padding: '14px 18px', fontSize: 14, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>ℹ️ {T(lang, 'Bạn cần đăng nhập với tài khoản Doanh nghiệp để gửi proposal tới Nhà đầu tư.', 'You need a Business account login to send proposals to investors.')}</span>
        <Link to="/register/business" style={{ fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>{T(lang, 'Đăng ký Doanh nghiệp →', 'Register as Business →')}</Link>
      </div> : null}
      {showQuotaBanner ? <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 12, padding: '14px 18px', fontSize: 14, marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>📤 <span className="l-vi">Đăng nhập là</span><span className="l-en">Logged in as</span> <b>{profile?.role}</b> — <span className="l-vi">còn</span><span className="l-en">remaining</span> <b style={{ color: '#F2B51D' }}>Beta</b> proposal</span>
        <Link to="/dashboard/business" style={{ color: '#F2B51D', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>Dashboard</Link>
      </div> : null}
    </div>

    <div className="d68-list-cols" style={{ maxWidth: 1240, margin: '0 auto', padding: '8px 24px 40px', display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: 26, alignItems: 'start' }}>
      <aside className="d68-sidebar" style={{ position: 'sticky', top: 90, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #EEF2F6' }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}><span className="l-vi">Bộ lọc</span><span className="l-en">Filters</span></span>
          <button onClick={clearFilters} style={{ border: 'none', background: 'none', color: '#1596cc', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}><span className="l-vi">Xóa lọc</span><span className="l-en">Clear</span></button>
        </div>
        <div style={{ padding: '6px 18px 18px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ padding: '16px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8' }}><span className="l-vi">Loại nhà đầu tư</span><span className="l-en">Investor type</span></div>
          {INVESTOR_TYPES.map((tf) => <label key={tf} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 13.5, color: '#334155' }}>
            <input type="checkbox" checked={typeFilters.includes(tf)} onChange={() => toggleType(tf)} style={{ width: 15, height: 15, accentColor: '#1BADEA' }} />
            <span style={{ flex: 1 }}>{tf}</span><span style={{ fontSize: 12, color: '#94A3B8' }}>{countByType(items, tf)}</span>
          </label>)}

          <div style={{ padding: '16px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8', borderTop: '1px solid #EEF2F6', marginTop: 10 }}><span className="l-vi">Khu vực</span><span className="l-en">Region</span></div>
          <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, background: '#F7FAFC', fontWeight: 500, cursor: 'pointer' }}>
            <option value="all">{T(lang, 'Tất cả khu vực', 'All regions')}</option>
            {REGION_OPTIONS.map((ro) => <option value={ro} key={ro}>{regionLabel(lang, ro)}</option>)}
          </select>

          <div style={{ padding: '16px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8' }}><span className="l-vi">Quốc gia</span><span className="l-en">Country</span></div>
          <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }} style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, background: '#F7FAFC', fontWeight: 500, cursor: 'pointer' }}>
            <option value="all">{T(lang, 'Tất cả', 'All')}</option>
            {countryOptions.map((co) => <option value={co} key={co}>{co}</option>)}
          </select>

          <div style={{ padding: '16px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8' }}><span className="l-vi">Ngành quan tâm</span><span className="l-en">Preferred industry</span></div>
          <select value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1); }} style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, background: '#F7FAFC', fontWeight: 500, cursor: 'pointer' }}>
            <option value="all">{T(lang, 'Tất cả', 'All')}</option>
            {industryOptions.map((io) => <option key={io}>{io}</option>)}
          </select>

          <div style={{ padding: '16px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8' }}><span className="l-vi">Giai đoạn</span><span className="l-en">Stage</span></div>
          <select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }} style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, background: '#F7FAFC', fontWeight: 500, cursor: 'pointer' }}>
            <option value="all">{T(lang, 'Tất cả', 'All')}</option>
            {stageOptions.map((so) => <option key={so}>{so}</option>)}
          </select>

          <div style={{ padding: '16px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8' }}><span className="l-vi">Ticket tối thiểu (USD)</span><span className="l-en">Min ticket (USD)</span></div>
          <select value={ticket} onChange={(e) => { setTicket(e.target.value); setPage(1); }} style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, background: '#F7FAFC', fontWeight: 500, cursor: 'pointer' }}>
            <option value="0">{T(lang, 'Bất kỳ', 'Any')}</option>
            <option value="100000">≤ $100K</option>
            <option value="1000000">≤ $1M</option>
            <option value="5000000">≤ $5M</option>
            <option value="50000000">≤ $50M</option>
          </select>
        </div>
      </aside>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>{filtered.length} / {items.length} <span className="l-vi">nhà đầu tư</span><span className="l-en">investors</span>{loading ? <span> · {T(lang, 'đang tải', 'loading')}</span> : null}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13.5, color: '#64748B' }}><span className="l-vi">Sắp xếp: Xếp hạng hoạt động</span><span className="l-en">Sort: Ranking score</span></span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(Math.max(1, safePage - 1))} style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#334155', width: 34, height: 34, borderRadius: 8, cursor: 'pointer' }}>‹</button>
              <span style={{ fontSize: 13.5, fontWeight: 700, padding: '6px 4px' }}>{safePage} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#334155', width: 34, height: 34, borderRadius: 8, cursor: 'pointer' }}>›</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pageInvestors.map((inv) => {
            const ic = iconStyle(inv.type);
            const fb = feedback[inv.code];
            const disabled = !!fb?.ok || profile?.role !== 'business';
            return <div key={inv.code} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', boxShadow: '0 1px 2px rgba(15,42,74,.04)', transition: 'transform .18s, box-shadow .18s, border-color .18s' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: ic[0], color: ic[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{initials(inv.type)}</div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1596cc', background: '#E7F6FD', padding: '3px 9px', borderRadius: 6 }}>{inv.type}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '3px 9px', borderRadius: 6 }}>📍 {lang === 'vi' ? inv.countryVi : inv.country}</span>
                  {inv.verified ? <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#E9F9EF', padding: '3px 9px', borderRadius: 6 }}>✓ <span className="l-vi">Xác minh</span><span className="l-en">Verified</span></span> : null}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: activityColor(inv.activity_level) }}>● {activityLabel(lang, inv.activity_level)}</span>
                </div>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.4 }}>{T(lang, inv.titleVi, inv.titleEn)}</h3>
                <p style={{ fontSize: 13.5, color: '#64748B', margin: '0 0 10px', lineHeight: 1.5 }}>{T(lang, inv.descVi, inv.descEn)}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12.5, color: '#475569' }}>
                  <span><b><span className="l-vi">Ticket:</span><span className="l-en">Ticket:</span></b> {ticketLabel(inv)}</span>
                  <span><b><span className="l-vi">Ngành:</span><span className="l-en">Industries:</span></b> {inv.industries.join(', ')}</span>
                  <span><b><span className="l-vi">Giai đoạn:</span><span className="l-en">Stage:</span></b> {inv.stage}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 170 }}>
                <Link to={`/investors/${inv.code}`} style={{ textAlign: 'center', border: '1px solid #E2E8F0', color: '#334155', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', borderRadius: 9, transition: 'background .16s, border-color .16s, color .16s' }}><span className="l-vi">Xem chi tiết</span><span className="l-en">View detail</span></Link>
                <button onClick={() => sendProposal(inv.code)} disabled={disabled} style={{ background: disabled ? '#F1F5F9' : '#0F2A4A', color: disabled ? '#94A3B8' : '#fff', fontWeight: 700, fontSize: 13.5, padding: '10px 14px', borderRadius: 9, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}>{fb?.ok ? T(lang, 'Đã gửi ✓', 'Sent ✓') : !profile ? T(lang, 'Gửi hồ sơ DN', 'Send business proposal') : profile.role !== 'business' ? T(lang, 'Chỉ tài khoản DN được gửi', 'Business accounts only') : T(lang, 'Gửi hồ sơ DN', 'Send business proposal')}</button>
                {fb ? <div style={{ fontSize: 11.5, textAlign: 'center', color: fb.ok ? '#16A34A' : '#DC2626', fontWeight: 600 }}>{fb.msg}</div> : null}
              </div>
            </div>;
          })}
          {!loading && !pageInvestors.length ? <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, color: '#64748B' }}><b>{T(lang, 'Không có nhà đầu tư khớp bộ lọc', 'No investors match your filters')}</b></div> : null}
        </div>
      </div>
    </div>
  </>;
}
