import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getInvestorByCode } from '../lib/data';
import { formatCompactMoney } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type InvestorDetailData = {
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
  criteria: string[];
};

const FALLBACK_INVESTORS: InvestorDetailData[] = [
  { code: 'INV-0001', type: 'VC', titleVi: 'Quỹ VC khu vực đang tìm công ty công nghệ Việt Nam', titleEn: 'Regional VC fund seeking Vietnamese technology companies', descVi: 'Nhà đầu tư mạo hiểm tập trung SaaS, mobile, AI và nền tảng số tại Việt Nam và Singapore. Hồ sơ được ẩn danh; thông tin liên hệ chỉ mở theo workflow được duyệt.', descEn: 'Venture investor focused on SaaS, mobile, AI and digital platforms in Vietnam and Singapore. Profile is anonymous; contact information unlocks only through approved workflow.', country: 'Singapore', countryVi: 'Singapore', region: 'asia', industries: ['Technology', 'SaaS', 'AI'], dealTypes: ['Equity', 'Seed', 'Series A'], stage: 'Seed', ticketMin: 500000, ticketMax: 3000000, verified: true, activity_level: 'high', ranking_score: 92, criteria: ['Ưu tiên doanh nghiệp có traction và tăng trưởng doanh thu rõ ràng.', 'Đội ngũ sáng lập có năng lực sản phẩm và phân phối.', 'Có khả năng mở rộng sang Singapore hoặc thị trường quốc tế.'] },
  { code: 'INV-0002', type: 'PE', titleVi: 'Quỹ PE khu vực quan tâm chuỗi F&B, bán lẻ và sản xuất', titleEn: 'Regional PE fund interested in F&B, retail and manufacturing', descVi: 'Tìm doanh nghiệp có doanh thu, lợi nhuận và khả năng mở rộng tại Việt Nam và Đông Nam Á.', descEn: 'Looking for revenue-generating, profitable and scalable businesses in Vietnam and Southeast Asia.', country: 'Singapore', countryVi: 'Singapore', region: 'asia', industries: ['F&B', 'Retail', 'Manufacturing'], dealTypes: ['Growth equity', 'Buyout'], stage: 'Growth', ticketMin: 2000000, ticketMax: 10000000, verified: true, activity_level: 'high', ranking_score: 90, criteria: ['EBITDA dương hoặc lộ trình rõ ràng đến EBITDA dương.', 'Founder sẵn sàng chuyên nghiệp hóa quản trị.', 'Ưu tiên sở hữu thiểu số đáng kể hoặc buyout có kiểm soát.'] },
  { code: 'INV-0003', type: 'Family Office', titleVi: 'Family Office ưu tiên y tế, giáo dục và bất động sản vận hành', titleEn: 'Family Office prioritizing healthcare, education and operating real estate', descVi: 'Khẩu vị đầu tư dài hạn, ưu tiên tài sản/dòng tiền ổn định và đội ngũ sáng lập mạnh.', descEn: 'Long-term capital preference, prioritizing stable cash flow/assets and strong founders.', country: 'Hong Kong', countryVi: 'Hong Kong', region: 'asia', industries: ['Healthcare', 'Education', 'Real Estate'], dealTypes: ['Equity', 'Strategic stake'], stage: 'Mature', ticketMin: 5000000, ticketMax: 20000000, verified: true, activity_level: 'medium', ranking_score: 83, criteria: ['Ưu tiên dòng tiền ổn định.', 'Có tài sản hoặc thị phần phòng thủ.', 'Tầm nhìn đầu tư 5–10 năm.'] },
  { code: 'INV-0004', type: 'Corporate/Strategic', titleVi: 'Người mua chiến lược trong ngành thủy sản và thực phẩm xuất khẩu', titleEn: 'Strategic buyer in seafood and food export', descVi: 'Tìm nhà máy chế biến, thương hiệu thực phẩm và doanh nghiệp xuất khẩu có chứng chỉ quốc tế.', descEn: 'Seeking processing plants, food brands and exporters with international certifications.', country: 'Japan', countryVi: 'Nhật Bản', region: 'asia', industries: ['Seafood & Export', 'Manufacturing', 'Food'], dealTypes: ['M&A', 'Strategic investment'], stage: 'Mature', ticketMin: 3000000, ticketMax: 50000000, verified: true, activity_level: 'high', ranking_score: 88, criteria: ['Có chứng chỉ xuất khẩu quốc tế.', 'Sản phẩm phù hợp kênh phân phối châu Á.', 'Sẵn sàng M&A hoặc liên doanh chiến lược.'] }
];

function arr(value: any): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  return String(value).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

function normalize(inv: any, code: string): InvestorDetailData {
  const fallback = FALLBACK_INVESTORS.find((x) => x.code === code) || FALLBACK_INVESTORS[0];
  if (!inv) return fallback;
  const type = inv.type || fallback.type;
  const country = inv.country || inv.country_iso2 || fallback.country;
  const regionRaw = String(inv.region || fallback.region || '').toLowerCase();
  const region = regionRaw.includes('america') ? 'americas' : regionRaw.includes('middle') || regionRaw.includes('mideast') || regionRaw.includes('uae') ? 'mideast' : 'asia';
  const criteria = inv.criteria && typeof inv.criteria === 'object'
    ? Object.entries(inv.criteria).slice(0, 6).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v ?? '')}`)
    : fallback.criteria;
  return {
    code: inv.code || inv.username || code,
    type,
    titleVi: inv.title_vi || inv.titleVi || fallback.titleVi,
    titleEn: inv.title_en || inv.titleEn || inv.title_vi || fallback.titleEn,
    descVi: inv.desc_vi || inv.descVi || fallback.descVi,
    descEn: inv.desc_en || inv.descEn || inv.desc_vi || fallback.descEn,
    country,
    countryVi: country === 'United States' ? 'Hoa Kỳ' : country === 'Japan' ? 'Nhật Bản' : country === 'South Korea' ? 'Hàn Quốc' : country,
    region,
    industries: arr(inv.industries).length ? arr(inv.industries) : fallback.industries,
    dealTypes: arr(inv.deal_types).length ? arr(inv.deal_types) : arr(inv.dealTypes).length ? arr(inv.dealTypes) : fallback.dealTypes,
    stage: inv.stage || fallback.stage,
    ticketMin: Number(inv.ticket_min ?? inv.ticketMin ?? fallback.ticketMin),
    ticketMax: Number(inv.ticket_max ?? inv.ticketMax ?? fallback.ticketMax),
    verified: Boolean(inv.verified ?? fallback.verified),
    activity_level: inv.activity_level || fallback.activity_level,
    ranking_score: Number(inv.ranking_score || inv.admin_priority || fallback.ranking_score),
    criteria
  };
}

function iconStyle(type: string): [string, string] {
  const map: Record<string, [string, string]> = {
    VC: ['#E7F6FD', '#1596cc'], PE: ['#FEF3D3', '#B8860B'], Institutional: ['#EAF0F6', '#0F2A4A'],
    'Corporate/Strategic': ['#FDECEC', '#DC2626'], 'Individual/Angel': ['#E9F9EF', '#16A34A'], 'Family Office': ['#F3E8FF', '#7c3aed'], 'Lender/Debt': ['#F1F5F9', '#334155']
  };
  return map[type] || ['#F1F5F9', '#334155'];
}

function regionLabel(lang: Lang, region: string) {
  if (region === 'americas') return T(lang, 'Châu Mỹ', 'Americas');
  if (region === 'mideast') return T(lang, 'Trung Đông', 'Middle East');
  return T(lang, 'Châu Á', 'Asia');
}

function activityColor(level: string) { return level === 'high' ? '#16A34A' : level === 'medium' ? '#B8860B' : '#94A3B8'; }
function activityLabel(lang: Lang, level: string) { return level === 'high' ? T(lang, 'Hoạt động cao', 'High activity') : level === 'medium' ? T(lang, 'Hoạt động vừa', 'Medium activity') : T(lang, 'Ít hoạt động', 'Low activity'); }
function ticketLabel(inv: InvestorDetailData) { return `${formatCompactMoney(inv.ticketMin, 'USD')} – ${formatCompactMoney(inv.ticketMax, 'USD')}`; }

function buildDonut(entries: { count: number; color: string }[]) {
  const total = entries.reduce((s, e) => s + e.count, 0) || 1;
  let acc = 0;
  const stops = entries.map((e) => {
    const from = (acc / total) * 100;
    acc += e.count;
    const to = (acc / total) * 100;
    return `${e.color} ${from}% ${to}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function colorLegend(labels: string[]) {
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#E2E8F0'];
  return labels.slice(0, 5).map((label, i) => ({ label, color: colors[i] }));
}

function pillStyle(bg: string, color: string): CSSProperties {
  return { fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 7, background: bg, color, display: 'inline-flex', alignItems: 'center', gap: 6 };
}

export default function InvestorDetail({ lang }: { lang: Lang }) {
  const { code = 'INV-0001' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ ok?: boolean; reason?: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getInvestorByCode(code).then((data) => { if (active) setRaw(data); }).catch(() => { if (active) setRaw(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  const inv = useMemo(() => normalize(raw, code), [raw, code]);
  const ic = iconStyle(inv.type);
  const isBusiness = profile?.role === 'business';
  const isInvestorOwner = profile?.role === 'investor';
  const paidUnlocked = isBusiness || profile?.role === 'admin';
  const approved = false;
  const pending = !!feedback?.ok;
  const contactUnlocked = approved;
  const industryLegend = colorLegend([...inv.industries, T(lang, 'Khác', 'Others')]);
  const locationLegend = colorLegend([lang === 'vi' ? inv.countryVi : inv.country, regionLabel(lang, inv.region), T(lang, 'Khác', 'Others')]);
  const historyItems = inv.industries.slice(0, 3).map((ind, i) => ({
    teaser: T(lang, `DN ${ind} tại ${inv.countryVi} đang tìm đối tác vốn dài hạn.`, `${ind} business in ${inv.country} seeking a long-term capital partner.`),
    time: T(lang, 'Hơn 15 ngày trước', 'Earlier than 15 days'),
    line: i < 2
  }));
  const facts = [
    [T(lang, 'Loại nhà đầu tư', 'Investor type'), inv.type],
    [T(lang, 'Quốc gia', 'Country'), lang === 'vi' ? inv.countryVi : inv.country],
    [T(lang, 'Khu vực', 'Region'), regionLabel(lang, inv.region)],
    ['Ticket', ticketLabel(inv)],
    [T(lang, 'Ngành quan tâm', 'Preferred industries'), inv.industries.join(', ')],
    [T(lang, 'Giai đoạn', 'Stage'), inv.stage],
    [T(lang, 'Loại giao dịch', 'Deal types'), inv.dealTypes.join(', ')],
    [T(lang, 'Điểm xếp hạng', 'Ranking score'), String(inv.ranking_score)]
  ];

  let ctaTag = T(lang, 'Gửi Proposal', 'Send Proposal');
  let ctaText = T(lang, 'Đăng nhập hoặc đăng ký tài khoản Doanh nghiệp để gửi proposal tới nhà đầu tư này.', 'Log in or register a Business account to send a proposal to this investor.');
  let showLinkButton = true;
  let ctaLinkHref = '/register/business';
  let ctaLinkLabel = T(lang, 'Đăng ký Doanh nghiệp', 'Register as Business');
  if (isInvestorOwner) {
    ctaTag = T(lang, 'Hồ sơ nhà đầu tư', 'Investor profile');
    ctaText = T(lang, 'Đây là hồ sơ nhà đầu tư. Chỉnh sửa thông tin trong Dashboard.', 'This is an investor profile. Edit details from the Dashboard.');
    ctaLinkHref = '/dashboard/investor';
    ctaLinkLabel = T(lang, 'Vào Dashboard', 'Go to Dashboard');
  } else if (isBusiness) {
    ctaTag = T(lang, 'Gửi hồ sơ DN', 'Send business proposal');
    ctaText = T(lang, 'Gửi hồ sơ doanh nghiệp của bạn tới nhà đầu tư này để bắt đầu kết nối.', 'Send your business profile to this investor to start a connection.');
    showLinkButton = false;
  }

  function sendProposal() {
    if (!profile) { navigate('/register/business'); return; }
    if (!isBusiness) { setFeedback({ ok: false, reason: 'wrong_role' }); return; }
    setFeedback({ ok: true, reason: 'sent' });
  }

  const sendDisabled = pending || !isBusiness;
  const feedbackText = feedback ? feedback.ok ? T(lang, 'Đã gửi proposal ✓', 'Proposal sent ✓') : T(lang, 'Chỉ tài khoản Doanh nghiệp mới gửi được proposal.', 'Only Business accounts can send proposals.') : '';

  if (loading) return <section style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 24px' }}><div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: 28, color: '#64748B' }}>{T(lang, 'Đang tải hồ sơ nhà đầu tư...', 'Loading investor profile...')}</div></section>;

  return <>
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '22px 24px 0' }}>
      <div style={{ fontSize: 13, color: '#94A3B8' }}>
        <Link to="/"><span className="l-vi">Trang chủ</span><span className="l-en">Home</span></Link><span style={{ margin: '0 8px' }}>›</span>
        <Link to="/investors"><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></Link><span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: '#475569', fontWeight: 600 }}>{inv.code}</span>
      </div>
    </div>

    <div className="d68-detail-cols" style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 24px 40px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 28, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={pillStyle(ic[0], ic[1])}>{inv.type}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '5px 11px', borderRadius: 7 }}>📍 {lang === 'vi' ? inv.countryVi : inv.country}</span>
          {inv.verified ? <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16A34A', background: '#E9F9EF', padding: '5px 11px', borderRadius: 7 }}>✓ <span className="l-vi">Đã xác minh</span><span className="l-en">Verified</span></span> : null}
          <span style={{ fontSize: 12, fontWeight: 700, color: activityColor(inv.activity_level) }}>● {activityLabel(lang, inv.activity_level)}</span>
        </div>
        <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: -.6, margin: '0 0 10px', lineHeight: 1.3 }}>{T(lang, inv.titleVi, inv.titleEn)}</h1>
        <p style={{ fontSize: 15.5, color: '#64748B', lineHeight: 1.6, margin: '0 0 22px', maxWidth: 760 }}>{T(lang, inv.descVi, inv.descEn)}</p>

        <div className="d68-facts" style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '8px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 44, boxShadow: '0 1px 2px rgba(15,42,74,.04)', marginBottom: 22 }}>
          {facts.map((ft) => <div key={ft[0]} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: 13.5, color: '#64748B', flexShrink: 0 }}>{ft[0]}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0F2A4A', textAlign: 'right' }}>{ft[1]}</span>
          </div>)}
        </div>

        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '24px 26px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 16px' }}><span className="l-vi">Lịch sử nhận proposal</span><span className="l-en">Proposal history</span></h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>{historyItems.map((h) => <div key={h.teaser} style={{ display: 'flex', gap: 14, paddingBottom: 18, position: 'relative' }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#1BADEA', flexShrink: 0, marginTop: 4 }} />{h.line ? <span style={{ width: 2, flex: 1, background: '#E2E8F0', marginTop: 2 }} /> : null}</div>
            <div style={{ flex: 1, paddingBottom: 2 }}><div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginBottom: 3 }}>{h.time}</div><div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}><span className="l-vi">Đã nhận proposal từ</span><span className="l-en">Received a proposal from</span> <b style={{ color: '#1596cc' }}>{h.teaser}</b></div></div>
          </div>)}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '24px 26px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 18px' }}><span className="l-vi">Mức độ quan tâm</span><span className="l-en">Preferences</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 14 }}><span className="l-vi">Lĩnh vực</span><span className="l-en">Industries</span></div><div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px', borderRadius: '50%', background: buildDonut([{ count: 38, color: '#ef4444' }, { count: 24, color: '#3b82f6' }, { count: 16, color: '#10b981' }, { count: 12, color: '#f59e0b' }, { count: 10, color: '#E2E8F0' }]) }}><div style={{ position: 'absolute', inset: 26, background: '#fff', borderRadius: '50%' }} /></div><div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', maxWidth: 200, margin: '0 auto' }}>{industryLegend.map((il) => <div key={il.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: il.color, flexShrink: 0 }} />{il.label}</div>)}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 14 }}><span className="l-vi">Khu vực</span><span className="l-en">Locations</span></div><div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px', borderRadius: '50%', background: buildDonut([{ count: 40, color: '#ef4444' }, { count: 22, color: '#3b82f6' }, { count: 15, color: '#10b981' }, { count: 13, color: '#f59e0b' }, { count: 10, color: '#E2E8F0' }]) }}><div style={{ position: 'absolute', inset: 26, background: '#fff', borderRadius: '50%' }} /></div><div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', maxWidth: 200, margin: '0 auto' }}>{locationLegend.map((ll) => <div key={ll.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: ll.color, flexShrink: 0 }} />{ll.label}</div>)}</div></div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '24px 26px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 14px' }}>Tags</h2>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 2.2 }}>{[...inv.industries.map((x) => T(lang, `Nhà đầu tư ${x}`, `${x} Investor`)), T(lang, `Nhà đầu tư ${inv.type}`, `${inv.type} Investor`), T(lang, `Nhà đầu tư tại ${inv.countryVi}`, `Investor in ${inv.country}`), T(lang, `Nhà đầu tư giai đoạn ${inv.stage}`, `${inv.stage} Investor`)].map((tg, i, all) => <span key={tg} style={{ whiteSpace: 'nowrap', display: 'inline-block', margin: '0 2px 6px 0' }}>{tg}{i < all.length - 1 ? <span style={{ margin: '0 6px', color: '#CBD5E1' }}>·</span> : null}</span>)}</div>
        </div>

        {paidUnlocked ? <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '24px 26px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 14px' }}><span className="l-vi">Tiêu chí đầu tư đầy đủ</span><span className="l-en">Full investment criteria</span></h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{inv.criteria.map((pc) => <div key={pc} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, color: '#334155' }}><span style={{ color: '#1BADEA', fontWeight: 800, flexShrink: 0, lineHeight: 1.6 }}>▪</span><span style={{ flex: 1, lineHeight: 1.6 }}>{pc}</span></div>)}</div>
        </div> : null}

        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '24px 26px' }}>
          <h2 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 14px' }}><span className="l-vi">Thông tin liên hệ</span><span className="l-en">Contact information</span></h2>
          {contactUnlocked ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#E9F9EF', borderRadius: 10 }}><span style={{ fontSize: 18 }}>👤</span><div><div style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}><span className="l-vi">Người liên hệ</span><span className="l-en">Contact name</span></div><div style={{ fontSize: 14.5, fontWeight: 700 }}>NĐT {inv.code} — Đại diện liên hệ</div></div></div></div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[T(lang, 'Tên người liên hệ', 'Contact name'), T(lang, 'Số điện thoại', 'Phone number'), 'Website'].map((lf) => <div key={lf} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F7FAFC', border: '1px solid #EEF2F6', borderRadius: 10 }}><span style={{ fontSize: 15 }}>🔒</span><span style={{ flex: 1, fontSize: 13.5, color: '#64748B' }}>{lf}</span></div>)}</div>}
        </div>
      </div>

      <aside className="d68-side" style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#0F2A4A', color: '#fff', borderRadius: 18, padding: 22, boxShadow: '0 8px 26px rgba(15,42,74,.08)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9db4cc', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>{ctaTag}</div>
          <p style={{ fontSize: 14, color: '#dbe6f2', lineHeight: 1.6, margin: '0 0 16px' }}>{ctaText}</p>
          {!showLinkButton ? <button onClick={sendProposal} disabled={sendDisabled} style={{ width: '100%', fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 11, border: 'none', cursor: sendDisabled ? 'not-allowed' : 'pointer', background: sendDisabled ? 'rgba(255,255,255,.15)' : '#F2B51D', color: sendDisabled ? '#9db4cc' : '#0F2A4A', boxShadow: sendDisabled ? 'none' : '0 8px 20px rgba(242,181,29,.32)' }}>{pending ? T(lang, 'Đã gửi ✓', 'Sent ✓') : T(lang, 'Gửi hồ sơ DN', 'Send business proposal')}</button> : null}
          {showLinkButton ? <Link to={ctaLinkHref} style={{ display: 'block', textAlign: 'center', background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 15, padding: 13, borderRadius: 11, marginTop: 10 }}>{ctaLinkLabel}</Link> : null}
          {feedback ? <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: feedback.ok ? '#4ade80' : '#fca5a5' }}>{feedbackText}</div> : null}
        </div>

        <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: '#334155' }}><span className="l-vi">Ai xem được gì</span><span className="l-en">Who sees what</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: '#64748B', lineHeight: 1.6 }}>
            <div>👤 <span className="l-vi">Khách:</span><span className="l-en">Guest:</span> <span className="l-vi">teaser ẩn danh</span><span className="l-en">anonymous teaser</span></div>
            <div>🏢 <span className="l-vi">DN đã trả phí:</span><span className="l-en">Paid business:</span> <span className="l-vi">xem tiêu chí đầy đủ, gửi proposal</span><span className="l-en">full criteria, can send proposal</span></div>
            <div>✅ <span className="l-vi">Sau khi duyệt:</span><span className="l-en">Once approved:</span> <span className="l-vi">mở tên & SĐT liên hệ (email luôn ẩn)</span><span className="l-en">name & phone unlock (email always hidden)</span></div>
          </div>
        </div>
      </aside>
    </div>
  </>;
}
