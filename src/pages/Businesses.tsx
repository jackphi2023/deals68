import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { fallbackSeedBusinesses, listBusinesses } from '../lib/data';
import { formatCompactMoney, percent } from '../lib/format';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type Tx = 'all' | 'sale' | 'invest' | 'loan' | 'jv';
type ViewMode = 'grid' | 'list';
type RevenueBand = 'any' | 's' | 'm' | 'l';
type SortMode = 'recent' | 'revHigh' | 'revLow' | 'rating';

type Province = { key: string; vi: string; en: string };
type Industry = { key: string; vi: string; en: string };
type Deal = {
  id: string | number;
  real?: boolean;
  bizid?: string;
  slug?: string;
  image?: string;
  tVi: string;
  tEn: string;
  dVi: string;
  dEn: string;
  prov: string;
  ind: string;
  grp: Tx;
  kindVi: string;
  kindEn: string;
  revNum: number;
  revVi: string;
  revEn: string;
  ebitda: string;
  askVi: string;
  askEn: string;
  rating: string;
  verified: boolean;
  featured: boolean;
  tint?: string;
  quality?: number;
  qualityStyle?: CSSProperties;
};

const PROVINCES: Province[] = [
  { key: 'hcmc', vi: 'TP. Hồ Chí Minh', en: 'Ho Chi Minh City' },
  { key: 'hanoi', vi: 'Hà Nội', en: 'Hanoi' },
  { key: 'danang', vi: 'Đà Nẵng', en: 'Da Nang' },
  { key: 'cantho', vi: 'Cần Thơ', en: 'Can Tho' },
  { key: 'khanhhoa', vi: 'Khánh Hòa', en: 'Khanh Hoa' },
  { key: 'dongnai', vi: 'Đồng Nai', en: 'Dong Nai' }
];

const INDS: Industry[] = [
  { key: 'fnb', vi: 'F&B', en: 'F&B' },
  { key: 'health', vi: 'Y tế & Sức khỏe', en: 'Healthcare' },
  { key: 'mfg', vi: 'Sản xuất', en: 'Manufacturing' },
  { key: 'tech', vi: 'Công nghệ', en: 'Technology' },
  { key: 'realestate', vi: 'Bất động sản & Dịch vụ', en: 'Real Estate & Services' },
  { key: 'seafood', vi: 'Thủy sản & Xuất khẩu', en: 'Seafood & Export' },
  { key: 'travel', vi: 'Du lịch', en: 'Travel & Leisure' },
  { key: 'services', vi: 'Dịch vụ', en: 'Business Services' }
];

const REFERENCE_DEALS: Deal[] = [
  { id: 'hkmedi', real: true, bizid: 'hkmedi', slug: 'hkmedi', image: '/assets/deal1.png', tVi: 'Chuỗi phòng khám da liễu & thẩm mỹ 5 chi nhánh đang gọi vốn', tEn: '5-branch dermatology & aesthetics clinic chain raising capital', dVi: 'Chuỗi phòng khám da liễu – thẩm mỹ 5 chi nhánh, hơn 5.500 khách hàng; gọi vốn tăng trưởng mở rộng toàn quốc.', dEn: 'A 5-branch dermatology & aesthetics chain with 5,500+ customers; raising growth capital to expand nationwide.', prov: 'hanoi', ind: 'health', grp: 'invest', kindVi: 'Gọi vốn', kindEn: 'Fundraise', revNum: 155, revVi: '164,3 tỷ ₫', revEn: 'USD 6.2M', ebitda: '9.7%', askVi: 'USD 2.0M · ~17%', askEn: 'USD 2.0M · ~17%', rating: '8.4', verified: true, featured: true },
  { id: 'infinitytech', real: true, bizid: 'infinitytech', slug: 'infinitytech', image: '/assets/deal2.png', tVi: 'Công ty mobile app global đang gọi vốn mở rộng hệ sinh thái', tEn: 'Global mobile app studio raising to expand its ecosystem', dVi: 'Studio mobile app toàn cầu với 280+ ứng dụng; gọi vốn mở rộng user acquisition và AI/product.', dEn: 'A global mobile app studio with 280+ apps; raising to expand user acquisition and AI/product.', prov: 'hanoi', ind: 'tech', grp: 'invest', kindVi: 'Gọi vốn', kindEn: 'Fundraise', revNum: 325, revVi: '318–371 tỷ ₫', revEn: 'USD 12–14M', ebitda: '18–22%', askVi: 'USD 2.0M · 30%', askEn: 'USD 2.0M · 30%', rating: '8.1', verified: true, featured: true },
  { id: 'dunnio', real: true, bizid: 'dunnio', slug: 'dunnio', image: '/assets/deal3.png', tVi: 'Nền tảng may đo cá nhân hóa gọi vốn Seed', tEn: 'Personalized custom-tailoring platform raising Seed', dVi: 'Nền tảng may đo cá nhân hóa, 6 cửa hàng + e-commerce, hơn 34.000 khách; gọi vốn Seed.', dEn: 'A custom-tailoring platform, 6 stores + e-commerce, 34,000+ customers; raising a Seed round.', prov: 'hcmc', ind: 'services', grp: 'invest', kindVi: 'Seed', kindEn: 'Seed', revNum: 29, revVi: '30,7 tỷ ₫', revEn: 'USD 1.16M', ebitda: '1.5%', askVi: 'USD 300K · 22,6%', askEn: 'USD 300K · 22.6%', rating: '7.4', verified: true, featured: false },
  { id: 'phongcua', real: true, bizid: 'phongcua', slug: 'phongcua', image: '/assets/deal4.png', tVi: 'Bán 2 nhà hàng hải sản tại TP.HCM', tEn: 'Two seafood restaurants in HCMC for sale', dVi: '2 nhà hàng hải sản tại khu Bình Quới, TP.HCM; bán 100% hoạt động do chủ nghỉ hưu.', dEn: 'Two seafood restaurants in Binh Quoi, HCMC; 100% business sale as the owner retires.', prov: 'hcmc', ind: 'fnb', grp: 'sale', kindVi: 'Bán toàn bộ', kindEn: 'Full sale', revNum: 46, revVi: '38–55 tỷ ₫', revEn: 'VND 38–55B', ebitda: '10–12%', askVi: '15 tỷ ₫', askEn: 'VND 15B', rating: '7.6', verified: true, featured: false },
  { id: 'trongnhan', real: true, bizid: 'trongnhan', slug: 'trongnhan', image: '/assets/deal5.png', tVi: 'Nhà máy chế biến thủy sản xuất khẩu quy mô lớn', tEn: 'Large-scale seafood export processing plant', dVi: 'Nhà máy chế biến tôm đông lạnh xuất khẩu, hệ chứng chỉ quốc tế; tìm nhà đầu tư chiến lược.', dEn: 'A frozen-shrimp export plant with international certifications; seeking a strategic investor.', prov: 'khanhhoa', ind: 'seafood', grp: 'invest', kindVi: 'Gọi vốn, Vay', kindEn: 'Fundraise, Loan', revNum: 3843, revVi: '3.180–4.505 tỷ ₫', revEn: 'USD 120–170M', ebitda: '5–8%', askVi: 'TBD', askEn: 'TBD', rating: '7.9', verified: true, featured: true },
  { id: 'coldstore', real: true, bizid: 'coldstore', slug: 'coldstore', image: '/assets/deal6.png', tVi: 'Kho lạnh tự động quy mô lớn tại TP.HCM chuyển nhượng', tEn: 'Large automated cold storage in HCMC for transfer', dVi: 'Kho lạnh tự động 50.000+ pallet, 14 robot, 4 kho độc lập; chuyển nhượng công ty/tài sản.', dEn: 'Automated cold storage with 50,000+ pallets, 14 robots, 4 chambers; company/asset transfer.', prov: 'hcmc', ind: 'mfg', grp: 'sale', kindVi: 'Chuyển nhượng', kindEn: 'Transfer', revNum: 375, revVi: '318–477 tỷ ₫', revEn: 'USD 12–18M', ebitda: '35–42%', askVi: 'USD 50M', askEn: 'USD 50M', rating: '8.0', verified: true, featured: true },
  { id: 1, tVi: 'Chuỗi nhà hàng Hàn Quốc tự vận hành tại TP.HCM', tEn: 'Self-running Korean restaurant chain in HCMC', dVi: 'Nhà hàng samgyetang 25 bàn, đội ngũ vận hành ổn định, doanh số tăng đều — sang nhượng toàn bộ.', dEn: '25-table samgyetang restaurant with a stable team and steadily rising sales — full handover.', prov: 'hcmc', ind: 'fnb', grp: 'sale', kindVi: 'Bán toàn bộ', kindEn: 'Business for sale', revNum: 5.6, revVi: '5,6 tỷ ₫', revEn: '$234k', ebitda: '10–20%', askVi: '1,9 tỷ ₫', askEn: '$78K', rating: '7.5', verified: true, featured: true, tint: 'rgba(27,173,234,.28)' },
  { id: 2, tVi: 'Không gian coworking + café rooftop tại Đà Nẵng', tEn: 'Co-working hub with rooftop café in Da Nang', dVi: 'Coworking 4 tầng có café và spa rooftop, cộng đồng remote-work ổn định, thường kín chỗ mùa cao điểm.', dEn: 'Four-floor co-working space with café and rooftop spa, strong remote-work community, full in peak season.', prov: 'danang', ind: 'realestate', grp: 'sale', kindVi: 'Bán toàn bộ', kindEn: 'Business for sale', revNum: 1.5, revVi: '1,5 tỷ ₫', revEn: '$63k', ebitda: '20–30%', askVi: '1,95 tỷ ₫', askEn: '$80K', rating: '7.8', verified: true, featured: false, tint: 'rgba(242,181,29,.28)' },
  { id: 3, tVi: 'Nhà máy chế biến thủy sản xuất khẩu đạt chuẩn EU', tEn: 'EU-certified seafood export processing plant', dVi: 'Cơ sở đạt chứng nhận EU, khách hàng quốc tế lâu năm, hạ tầng sản xuất quy mô lớn — cần vốn mở rộng.', dEn: 'EU-certified facility with long-standing international clients and large-scale infrastructure — seeking growth capital.', prov: 'khanhhoa', ind: 'seafood', grp: 'loan', kindVi: 'Vay vốn', kindEn: 'Business loan', revNum: 190, revVi: '190 tỷ ₫', revEn: '$7.9M', ebitda: '0–10%', askVi: '145 tỷ ₫ @7%', askEn: '$6M @7%', rating: '7.8', verified: true, featured: true, tint: 'rgba(27,173,234,.28)' },
  { id: 4, tVi: 'Nhà sản xuất thực phẩm tự nhiên có kênh xuất khẩu', tEn: 'Natural food manufacturer with export channels', dVi: 'Trà thảo mộc, bột thực vật, gia vị; 70% doanh thu từ B2B & xuất khẩu, có chứng nhận FDA/ISO/Halal.', dEn: 'Herbal teas, plant powders and seasonings; 70% revenue from B2B & export, FDA/ISO/Halal certified.', prov: 'hcmc', ind: 'mfg', grp: 'sale', kindVi: 'Bán toàn bộ', kindEn: 'Business for sale', revNum: 38, revVi: '38 tỷ ₫', revEn: '$1.6M', ebitda: '10–20%', askVi: '37 tỷ ₫', askEn: '$1.52M', rating: '7.6', verified: true, featured: false, tint: 'rgba(242,181,29,.28)' },
  { id: 5, tVi: 'Công ty lữ hành quốc tế cần đối tác chiến lược', tEn: 'Inbound tour operator seeking strategic partner', dVi: 'Tour trọn gói 4–12 ngày cho khách quốc tế, giấy phép lữ hành quốc tế, người sáng lập 18 năm kinh nghiệm.', dEn: '4–12 day packages for international tourists, inbound license, 18-year founder experience.', prov: 'cantho', ind: 'travel', grp: 'sale', kindVi: 'Bán cổ phần 50%', kindEn: 'Partial stake 50%', revNum: 1.4, revVi: '1,4 tỷ ₫', revEn: '$57k', ebitda: '20–30%', askVi: '1,15 tỷ ₫ / 50%', askEn: '$48K / 50%', rating: '6.8', verified: false, featured: false, tint: 'rgba(27,173,234,.28)' },
  { id: 6, tVi: 'Startup nền tảng hosting/VPN gọi vốn tăng trưởng', tEn: 'Hosting/VPN startup raising growth capital', dVi: 'Dịch vụ đăng ký thuê bao với ~1.000 khách trung thành, dòng tiền đều — gọi vốn để tăng tốc.', dEn: 'Subscription service with ~1,000 loyal users and steady cash flow — raising to scale.', prov: 'hanoi', ind: 'tech', grp: 'invest', kindVi: 'Gọi vốn 20%', kindEn: 'Fundraise 20%', revNum: 0.22, revVi: '220 triệu ₫', revEn: '$9.1k', ebitda: '30–40%', askVi: '460 triệu ₫ / 20%', askEn: '$19K / 20%', rating: '6.5', verified: false, featured: false, tint: 'rgba(242,181,29,.28)' },
  { id: 7, tVi: 'Chuỗi 3 nhà hàng ẩm thực quốc tế tại miền Trung', tEn: 'Three-unit international restaurant chain, Central VN', dVi: '3 nhà hàng đang hoạt động, ~20% đơn qua nền tảng giao đồ ăn, tệp khách nước ngoài ổn định.', dEn: '3 operating restaurants, ~20% orders via delivery apps, steady foreign customer base.', prov: 'danang', ind: 'fnb', grp: 'sale', kindVi: 'Bán toàn bộ', kindEn: 'Business for sale', revNum: 11.5, revVi: '11,5 tỷ ₫', revEn: '$480k', ebitda: '10–20%', askVi: '7,2 tỷ ₫', askEn: '$300K', rating: '6.5', verified: true, featured: false, tint: 'rgba(27,173,234,.28)' },
  { id: 8, tVi: 'Trung tâm xét nghiệm y khoa có giấy phép đầy đủ', tEn: 'Licensed medical diagnostic laboratory', dVi: 'Xét nghiệm chẩn đoán & theo dõi, mô hình B2B lẫn B2C, quan hệ ổn định với phòng khám tư.', dEn: 'Diagnostic & monitoring tests, mixed B2B/B2C model, steady clinic partnerships.', prov: 'hcmc', ind: 'health', grp: 'sale', kindVi: 'Bán toàn bộ', kindEn: 'Business for sale', revNum: 2.2, revVi: '2,2 tỷ ₫', revEn: '$91k', ebitda: '0–10%', askVi: '7,2 tỷ ₫', askEn: '$300K', rating: '6.8', verified: true, featured: false, tint: 'rgba(242,181,29,.28)' },
  { id: 9, tVi: 'Công ty tư vấn marketing cần nhà đầu tư chiến lược', tEn: 'Marketing consulting firm seeking strategic investor', dVi: 'Tư vấn tăng trưởng doanh thu & hiệu quả marketing, hợp đồng retainer 6 tháng, khách trong & ngoài nước.', dEn: 'Revenue-growth & marketing consulting, 6-month retainers, local and international clients.', prov: 'danang', ind: 'services', grp: 'invest', kindVi: 'Bán cổ phần 49%', kindEn: 'Partial stake 49%', revNum: 1.1, revVi: '1,1 tỷ ₫', revEn: '$46k', ebitda: '10–20%', askVi: '560 triệu ₫ / 49%', askEn: '$23K / 49%', rating: '7.7', verified: false, featured: false, tint: 'rgba(27,173,234,.28)' },
  { id: 10, tVi: 'Nhà sản xuất gỗ & đá cung ứng thương hiệu toàn cầu', tEn: 'Wood & stone maker supplying global brands', dVi: 'Sản xuất vật liệu gỗ/đá độ bền cao cho khách sạn, bán lẻ và dự án; pipeline đặt trước lớn — cần vốn.', dEn: 'High-durability wood/stone materials for hospitality, retail and projects; large pre-order pipeline — needs funding.', prov: 'dongnai', ind: 'mfg', grp: 'loan', kindVi: 'Vay vốn', kindEn: 'Business loan', revNum: 5200, revVi: '5.200 tỷ ₫', revEn: '$216M', ebitda: '10–20%', askVi: '2.400 tỷ ₫ @7%', askEn: '$100M @7%', rating: '7.3', verified: true, featured: false, tint: 'rgba(242,181,29,.28)' }
];

const txDefs: { key: Tx; vi: string; en: string }[] = [
  { key: 'all', vi: 'Tất cả giao dịch', en: 'All transactions' },
  { key: 'sale', vi: 'Bán doanh nghiệp', en: 'Businesses for sale' },
  { key: 'invest', vi: 'Gọi vốn & Đầu tư', en: 'Investment opportunities' },
  { key: 'loan', vi: 'Vay vốn', en: 'Business loan' },
  { key: 'jv', vi: 'JV & Đối tác', en: 'JV & Partnership' }
];

const listedByFilters = (lang: Lang) => [T(lang, 'Chủ doanh nghiệp', 'Business owner'), T(lang, 'Ban quản lý', 'Management'), T(lang, 'Cố vấn / Môi giới', 'Advisor / Broker')];
const locationLinks = (lang: Lang) => PROVINCES.map((p) => T(lang, p.vi, p.en)).concat([T(lang, 'Hải Phòng', 'Haiphong'), T(lang, 'Huế', 'Hue'), T(lang, 'An Giang', 'An Giang'), T(lang, 'Lâm Đồng', 'Lam Dong'), T(lang, 'Đồng Tháp', 'Dong Thap'), T(lang, 'Bắc Ninh', 'Bac Ninh')]);
const industryLinks = (lang: Lang) => INDS.map((i) => T(lang, i.vi, i.en)).concat([T(lang, 'Bán lẻ', 'Retail'), T(lang, 'Giáo dục', 'Education'), T(lang, 'Làm đẹp', 'Beauty'), T(lang, 'Năng lượng', 'Energy'), T(lang, 'Logistics', 'Logistics'), T(lang, 'Tài chính', 'Finance')]);

function txTabStyle(active: boolean): CSSProperties {
  return { flexShrink: 0, padding: '15px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14.5, fontWeight: active ? 700 : 500, color: active ? '#0F2A4A' : '#64748B', borderBottom: `3px solid ${active ? '#1BADEA' : 'transparent'}`, whiteSpace: 'nowrap' };
}

function viewBtnStyle(active: boolean): CSSProperties {
  return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 700 : 500, background: active ? '#fff' : 'transparent', color: active ? '#0F2A4A' : '#64748B', boxShadow: active ? '0 1px 3px rgba(15,42,74,.12)' : 'none' };
}

function qualityStyle(score: number): CSSProperties {
  const color = score >= 8 ? '#16A34A' : score >= 7 ? '#B8860B' : '#64748B';
  const bg = score >= 8 ? '#E9F9EF' : score >= 7 ? '#FEF3D3' : '#F1F5F9';
  return { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color, background: bg, padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' };
}

function normalizeCity(raw?: string | null) {
  const value = String(raw || '').toLowerCase();
  if (value.includes('hồ chí minh') || value.includes('ho chi minh') || value.includes('hcm')) return 'hcmc';
  if (value.includes('hà nội') || value.includes('hanoi')) return 'hanoi';
  if (value.includes('đà nẵng') || value.includes('da nang')) return 'danang';
  if (value.includes('cần thơ') || value.includes('can tho') || value.includes('mekong')) return 'cantho';
  if (value.includes('khánh hòa') || value.includes('khanh hoa')) return 'khanhhoa';
  if (value.includes('đồng nai') || value.includes('dong nai')) return 'dongnai';
  return 'hcmc';
}

function normalizeIndustry(raw?: string | null) {
  const value = String(raw || '').toLowerCase();
  if (value.includes('f&b') || value.includes('nhà hàng') || value.includes('restaurant') || value.includes('food')) return 'fnb';
  if (value.includes('health') || value.includes('y tế') || value.includes('clinic') || value.includes('beauty') || value.includes('làm đẹp')) return 'health';
  if (value.includes('tech') || value.includes('công nghệ') || value.includes('app') || value.includes('saas')) return 'tech';
  if (value.includes('seafood') || value.includes('thủy sản') || value.includes('export')) return 'seafood';
  if (value.includes('real') || value.includes('bất động') || value.includes('cold') || value.includes('logistics')) return 'realestate';
  if (value.includes('travel') || value.includes('tour') || value.includes('du lịch')) return 'travel';
  if (value.includes('service') || value.includes('dịch vụ') || value.includes('fashion') || value.includes('tailor')) return 'services';
  return 'mfg';
}

function normalizeGroup(raw?: string | null): Tx {
  const value = String(raw || '').toLowerCase();
  if (value.includes('loan') || value.includes('debt') || value.includes('vay')) return 'loan';
  if (value.includes('jv') || value.includes('partner') || value.includes('đối tác')) return 'jv';
  if (value.includes('sale') || value.includes('acquisition') || value.includes('transfer') || value.includes('bán') || value.includes('chuyển nhượng')) return 'sale';
  return 'invest';
}

function revNumOf(b: any) {
  const currency = String(b.revenue_currency || 'VND').toUpperCase();
  const value = Number(b.revenue_2025 || 0);
  const vnd = currency === 'USD' ? value * 25_000 : value;
  return Number.isFinite(vnd) ? vnd / 1_000_000_000 : 0;
}

function ratingOf(b: any) {
  const raw = Number(b.quality_score || b.data_confidence || 0);
  if (!raw) return 7.2;
  return raw > 10 ? raw / 10 : raw;
}

function normalizeBusiness(b: any, index: number): Deal {
  const fallback = REFERENCE_DEALS[index % REFERENCE_DEALS.length];
  const titleVi = b.title_vi || fallback.tVi;
  const titleEn = b.title_en || b.title_vi || fallback.tEn;
  const descVi = b.description_vi || b.highlights_vi || fallback.dVi;
  const descEn = b.description_en || b.highlights_en || b.description_vi || fallback.dEn;
  const ask = b.stake_pct ? `${formatCompactMoney(b.ask_amount, b.ask_currency)} · ${percent(b.stake_pct)}` : formatCompactMoney(b.ask_amount, b.ask_currency);
  const rating = ratingOf(b);
  const kindVi = b.deal_type || fallback.kindVi;
  const revenue = formatCompactMoney(b.revenue_2025, b.revenue_currency);
  return {
    id: b.id || b.slug || fallback.id,
    real: true,
    bizid: b.slug || b.username || fallback.bizid,
    slug: b.slug || b.username || fallback.slug,
    image: b.image_url || `/assets/deal${(index % 6) + 1}.png`,
    tVi: titleVi,
    tEn: titleEn,
    dVi: descVi,
    dEn: descEn,
    prov: normalizeCity(b.city),
    ind: normalizeIndustry(b.industry),
    grp: normalizeGroup(b.deal_type),
    kindVi,
    kindEn: kindVi,
    revNum: revNumOf(b),
    revVi: revenue,
    revEn: revenue,
    ebitda: percent(b.ebitda_margin),
    askVi: ask,
    askEn: ask,
    rating: rating.toFixed(1),
    verified: Number(b.data_confidence || b.quality_score || 0) >= 70 || b.verified === true,
    featured: b.plan === 'featured' || b.featured === true,
    tint: fallback.tint,
    quality: rating,
    qualityStyle: qualityStyle(rating)
  };
}

function provinceLabel(key: string, lang: Lang) {
  const p = PROVINCES.find((item) => item.key === key);
  return p ? T(lang, p.vi, p.en) : T(lang, 'Việt Nam', 'Vietnam');
}

function industryLabel(key: string, lang: Lang) {
  const i = INDS.find((item) => item.key === key);
  return i ? T(lang, i.vi, i.en) : T(lang, 'Doanh nghiệp', 'Business');
}

function countBy(list: Deal[], key: keyof Pick<Deal, 'prov' | 'ind'>, value: string) {
  return list.filter((d) => d[key] === value).length;
}

function detailPath(d: Deal) {
  return d.real && (d.slug || d.bizid) ? `/businesses/${d.slug || d.bizid}` : '#';
}

function applyFilters(all: Deal[], tx: Tx, provinces: string[], industries: string[], revenueBand: RevenueBand, verifiedOnly: boolean, featuredOnly: boolean, sort: SortMode) {
  let list = all.filter((d) => {
    if (tx !== 'all' && d.grp !== tx) return false;
    if (provinces.length && !provinces.includes(d.prov)) return false;
    if (industries.length && !industries.includes(d.ind)) return false;
    if (verifiedOnly && !d.verified) return false;
    if (featuredOnly && !d.featured) return false;
    if (revenueBand === 's' && !(d.revNum < 10)) return false;
    if (revenueBand === 'm' && !(d.revNum >= 10 && d.revNum <= 100)) return false;
    if (revenueBand === 'l' && !(d.revNum > 100)) return false;
    return true;
  });
  if (sort === 'revHigh') list = [...list].sort((a, b) => b.revNum - a.revNum);
  else if (sort === 'revLow') list = [...list].sort((a, b) => a.revNum - b.revNum);
  else if (sort === 'rating') list = [...list].sort((a, b) => Number(b.rating) - Number(a.rating));
  return list;
}

function GridCard({ d, lang }: { d: Deal; lang: Lang }) {
  const title = T(lang, d.tVi, d.tEn);
  return <div style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15,42,74,.04)', transition: 'box-shadow .18s, transform .18s' }}>
    <div style={{ position: 'relative', height: 180, overflow: 'hidden', backgroundImage: `repeating-linear-gradient(135deg,${d.tint || 'rgba(27,173,234,.28)'} 0 14px, rgba(255,255,255,.5) 14px 28px)` }}>
      {d.real && d.image ? <img src={d.image} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
      {!d.real ? <>
        <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(7px)', background: 'rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(15,42,74,.55)', background: 'rgba(255,255,255,.72)', padding: '6px 11px', borderRadius: 8 }}>🔒 <span className="l-vi">Ẩn danh</span><span className="l-en">Anonymous</span></span>
        </div>
        <span style={{ position: 'absolute', top: 10, right: 10, background: '#64748B', color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '4px 8px', borderRadius: 6, letterSpacing: .5 }}>DEMO</span>
      </> : null}
      {d.featured ? <span style={{ position: 'absolute', top: 10, left: 10, background: '#F2B51D', color: '#0F2A4A', fontSize: 11, fontWeight: 800, padding: '5px 9px', borderRadius: 7 }}>★ Featured</span> : null}
      <span style={{ position: 'absolute', bottom: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(15,42,74,.86)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 7 }}><span style={{ color: '#F2B51D' }}>★</span>{d.rating}</span>
    </div>
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1596cc', background: '#E7F6FD', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{industryLabel(d.ind, lang)}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>📍 {provinceLabel(d.prov, lang)}</span>
        {d.quality ? <span style={d.qualityStyle}>◆ Quality {d.quality.toFixed(1)}</span> : null}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, margin: '0 0 14px', flex: 1 }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14, borderTop: '1px solid #EEF2F6', marginBottom: 16 }}>
        <div><div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}><span className="l-vi">Doanh thu</span><span className="l-en">Revenue</span></div><div style={{ fontSize: 14.5, fontWeight: 700, color: '#0F2A4A' }}>{T(lang, d.revVi, d.revEn)}</div></div>
        <div><div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{T(lang, d.kindVi, d.kindEn)}</div><div style={{ fontSize: 14.5, fontWeight: 800, color: '#1596cc' }}>{T(lang, d.askVi, d.askEn)}</div></div>
      </div>
      <Link to={detailPath(d)} style={{ textAlign: 'center', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14, padding: 11, borderRadius: 10 }}><span className="l-vi">Xem chi tiết</span><span className="l-en">View details</span></Link>
    </div>
  </div>;
}

function ListCard({ d, lang }: { d: Deal; lang: Lang }) {
  const title = T(lang, d.tVi, d.tEn);
  return <div className="d68-card" style={{ display: 'grid', gridTemplateColumns: '236px minmax(0,1fr)', background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,42,74,.04)', transition: 'box-shadow .18s, transform .18s' }}>
    <div className="d68-card-img" style={{ position: 'relative', overflow: 'hidden', backgroundImage: `repeating-linear-gradient(135deg,${d.tint || 'rgba(27,173,234,.28)'} 0 14px, rgba(255,255,255,.5) 14px 28px)` }}>
      {d.real && d.image ? <img src={d.image} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
      {!d.real ? <>
        <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(7px)', background: 'rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(15,42,74,.55)', background: 'rgba(255,255,255,.72)', padding: '6px 11px', borderRadius: 8 }}>🔒 <span className="l-vi">Ẩn danh</span><span className="l-en">Anonymous</span></span>
        </div>
        <span style={{ position: 'absolute', top: 10, right: 10, background: '#64748B', color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '4px 8px', borderRadius: 6, letterSpacing: .5 }}>DEMO</span>
      </> : null}
      {d.featured ? <span style={{ position: 'absolute', top: 10, left: 10, background: '#F2B51D', color: '#0F2A4A', fontSize: 11, fontWeight: 800, padding: '5px 9px', borderRadius: 7 }}>★ Featured</span> : null}
      <span style={{ position: 'absolute', bottom: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(15,42,74,.86)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 7 }}><span style={{ color: '#F2B51D' }}>★</span>{d.rating}</span>
    </div>
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1596cc', background: '#E7F6FD', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{industryLabel(d.ind, lang)}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>📍 {provinceLabel(d.prov, lang)}</span>
        {d.quality ? <span style={d.qualityStyle}>◆ Quality {d.quality.toFixed(1)}</span> : null}
        {d.verified ? <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#E9F9EF', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>✓ <span className="l-vi">Đã xác minh</span><span className="l-en">Verified</span></span> : null}
      </div>
      <h3 style={{ fontSize: 17.5, fontWeight: 700, lineHeight: 1.35, margin: '0 0 7px' }}>{title}</h3>
      <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.55, margin: '0 0 14px' }}>{T(lang, d.dVi, d.dEn)}</p>
      <div className="d68-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '14px 0', borderTop: '1px solid #EEF2F6', marginTop: 'auto' }}>
        <div><div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}><span className="l-vi">Doanh thu/năm</span><span className="l-en">Run-rate sales</span></div><div style={{ fontSize: 15, fontWeight: 700, color: '#0F2A4A' }}>{T(lang, d.revVi, d.revEn)}</div></div>
        <div><div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}><span className="l-vi">Biên EBITDA</span><span className="l-en">EBITDA margin</span></div><div style={{ fontSize: 15, fontWeight: 700, color: '#0F2A4A' }}>{d.ebitda}</div></div>
        <div><div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{T(lang, d.kindVi, d.kindEn)}</div><div style={{ fontSize: 15, fontWeight: 800, color: '#1596cc' }}>{T(lang, d.askVi, d.askEn)}</div></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to={detailPath(d)} style={{ background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 18px', borderRadius: 9, whiteSpace: 'nowrap' }}><span className="l-vi">Bày tỏ quan tâm</span><span className="l-en">Express interest</span></Link>
        <Link to={detailPath(d)} style={{ border: '1px solid #E2E8F0', color: '#334155', fontWeight: 600, fontSize: 14, padding: '10px 18px', borderRadius: 9, whiteSpace: 'nowrap' }}><span className="l-vi">Xem chi tiết</span><span className="l-en">View details</span></Link>
        <button style={{ marginLeft: 'auto', border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 9, cursor: 'pointer' }}>♡ <span className="l-vi">Lưu</span><span className="l-en">Save</span></button>
      </div>
    </div>
  </div>;
}

export default function Businesses({ lang }: { lang: Lang }) {
  const [tx, setTx] = useState<Tx>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [provinces, setProvinces] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [revenueBand, setRevenueBand] = useState<RevenueBand>('any');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [allDeals, setAllDeals] = useState<Deal[]>(REFERENCE_DEALS);

  useEffect(() => {
    let mounted = true;
    listBusinesses({ includeHidden: false })
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length) setAllDeals(data.map(normalizeBusiness));
      })
      .catch(async () => {
        try {
          const fallback = await fallbackSeedBusinesses();
          if (mounted && fallback.length) setAllDeals(fallback.map(normalizeBusiness));
        } catch {
          if (mounted) setAllDeals(REFERENCE_DEALS);
        }
      });
    return () => { mounted = false; };
  }, []);

  const deals = useMemo(() => applyFilters(allDeals, tx, provinces, industries, revenueBand, verifiedOnly, featuredOnly, sort), [allDeals, tx, provinces, industries, revenueBand, verifiedOnly, featuredOnly, sort]);
  const shownCount = String(deals.length);
  const totalCount = '237';

  const toggleProvince = (key: string) => setProvinces((cur) => cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]);
  const toggleIndustry = (key: string) => setIndustries((cur) => cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]);
  const clearFilters = () => { setTx('all'); setProvinces([]); setIndustries([]); setRevenueBand('any'); setVerifiedOnly(false); setFeaturedOnly(false); };

  const faqs = [
    { q: T(lang, 'Có bao nhiêu doanh nghiệp Việt Nam đang niêm yết trên Deals68?', 'How many Vietnamese businesses are listed on Deals68?'), a: T(lang, 'Hiện có 237 hồ sơ doanh nghiệp đang hoạt động và đã kiểm duyệt tại Việt Nam, cập nhật đến 01/07/2026.', 'There are 237 active, reviewed business profiles in Vietnam as of 01 July 2026.') },
    { q: T(lang, 'Deals68 kiểm duyệt hồ sơ như thế nào?', 'How does Deals68 review profiles?'), a: T(lang, 'Mọi hồ sơ được admin duyệt trước khi hiển thị: ẩn danh thông tin nhạy cảm, làm mờ hình ảnh và xác minh mã số thuế khi cần.', 'Every profile is reviewed by admins before going live: sensitive data is anonymized, images blurred and tax codes verified when required.') },
    { q: T(lang, 'Làm sao đảm bảo bảo mật và danh tính?', 'How is confidentiality protected?'), a: T(lang, 'Hồ sơ hiển thị công khai ở dạng teaser ẩn danh. Thông tin đầy đủ và tài liệu chỉ mở sau khi hai bên chấp nhận kết nối.', 'Public listings are anonymous teasers. Full details and documents unlock only after both parties accept a connection.') },
    { q: T(lang, 'Tôi liên hệ doanh nghiệp bằng cách nào?', 'How do I contact a business?'), a: T(lang, 'Bạn cần đăng nhập và có gói thành viên phù hợp, sau đó bấm “Bày tỏ quan tâm” kèm cam kết bảo mật nhẹ để gửi yêu cầu kết nối.', 'You must be logged in with an active membership, then click “Express interest” with a light NDA to send a connection request.') }
  ];

  return <>
    <div style={{ borderTop: '1px solid #EEF2F6', background: '#fff' }}>
      <div className="d68-txtabs" style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto', minWidth: 0 }}>
        {txDefs.map((t) => <button key={t.key} onClick={() => setTx(t.key)} style={txTabStyle(tx === t.key)}>{T(lang, t.vi, t.en)}</button>)}
      </div>
    </div>

    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '26px 24px 8px' }}>
      <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}>
        <Link to="/"><span className="l-vi">Trang chủ</span><span className="l-en">Home</span></Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <Link to="/businesses"><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: '#475569', fontWeight: 600 }}>Việt Nam</span>
      </div>
      <h1 className="d68-h1" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -.8, margin: '0 0 8px' }}>
        <span className="l-vi">Doanh nghiệp đang chào bán &amp; gọi vốn tại Việt Nam</span>
        <span className="l-en">Businesses for Sale &amp; Investment in Vietnam</span>
      </h1>
      <p style={{ fontSize: 15, color: '#64748B', margin: 0, lineHeight: 1.55, maxWidth: 820 }}>
        <span className="l-vi">Hiển thị {shownCount} trong {totalCount} thương vụ tại Việt Nam — hồ sơ ẩn danh do chủ doanh nghiệp và cố vấn đăng, đã qua kiểm duyệt Deals68.</span>
        <span className="l-en">Showing {shownCount} of {totalCount} deals in Vietnam — anonymous profiles posted by owners and advisors, reviewed by Deals68.</span>
      </p>
    </div>

    <div className="d68-list-cols" style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 24px 40px', display: 'grid', gridTemplateColumns: '288px minmax(0,1fr)', gap: 26, alignItems: 'start' }}>
      <aside className="d68-sidebar" style={{ position: 'sticky', top: 132, background: '#fff', border: '1px solid #E7EDF3', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,42,74,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #EEF2F6' }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}><span className="l-vi">Bộ lọc</span><span className="l-en">Filters</span></span>
          <button onClick={clearFilters} style={{ border: 'none', background: 'none', color: '#1596cc', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}><span className="l-vi">Xóa lọc</span><span className="l-en">Clear</span></button>
        </div>
        <div style={{ padding: '6px 18px 18px', maxHeight: '66vh', overflowY: 'auto' }}>
          <div style={{ padding: '16px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8' }}><span className="l-vi">Tỉnh / Thành phố</span><span className="l-en">Location</span></div>
          {PROVINCES.map((p) => <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 14, color: '#334155' }}>
            <input type="checkbox" checked={provinces.includes(p.key)} onChange={() => toggleProvince(p.key)} style={{ width: 16, height: 16, accentColor: '#1BADEA' }} />
            <span style={{ flex: 1 }}>{T(lang, p.vi, p.en)}</span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{countBy(allDeals, 'prov', p.key)}</span>
          </label>)}

          <div style={{ padding: '18px 0 6px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8', borderTop: '1px solid #EEF2F6', marginTop: 12 }}><span className="l-vi">Ngành</span><span className="l-en">Industry</span></div>
          {INDS.map((i) => <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 14, color: '#334155' }}>
            <input type="checkbox" checked={industries.includes(i.key)} onChange={() => toggleIndustry(i.key)} style={{ width: 16, height: 16, accentColor: '#1BADEA' }} />
            <span style={{ flex: 1 }}>{T(lang, i.vi, i.en)}</span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{countBy(allDeals, 'ind', i.key)}</span>
          </label>)}

          <div style={{ padding: '18px 0 8px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8', borderTop: '1px solid #EEF2F6', marginTop: 12 }}><span className="l-vi">Doanh thu / năm</span><span className="l-en">Annual revenue</span></div>
          <select value={revenueBand} onChange={(e) => setRevenueBand(e.target.value as RevenueBand)} style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#F7FAFC', color: '#0F2A4A', fontWeight: 500, cursor: 'pointer' }}>
            <option value="any">{T(lang, 'Bất kỳ', 'Any')}</option>
            <option value="s">&lt; 10 tỷ ₫</option>
            <option value="m">10 – 100 tỷ ₫</option>
            <option value="l">&gt; 100 tỷ ₫</option>
          </select>

          <div style={{ padding: '18px 0 8px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .6, color: '#94A3B8', borderTop: '1px solid #EEF2F6', marginTop: 14 }}><span className="l-vi">Đăng bởi</span><span className="l-en">Listed by</span></div>
          {listedByFilters(lang).map((lb) => <label key={lb} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 14, color: '#334155' }}>
            <input type="checkbox" style={{ width: 16, height: 16, accentColor: '#1BADEA' }} />
            <span>{lb}</span>
          </label>)}

          <div style={{ borderTop: '1px solid #EEF2F6', marginTop: 14, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#334155' }}>
              <input type="checkbox" checked={verifiedOnly} onChange={() => setVerifiedOnly(!verifiedOnly)} style={{ width: 16, height: 16, accentColor: '#16A34A' }} />
              <span style={{ flex: 1 }}><span className="l-vi">Đã xác minh</span><span className="l-en">Verified only</span></span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#334155' }}>
              <input type="checkbox" checked={featuredOnly} onChange={() => setFeaturedOnly(!featuredOnly)} style={{ width: 16, height: 16, accentColor: '#F2B51D' }} />
              <span style={{ flex: 1 }}><span className="l-vi">Nổi bật (Featured)</span><span className="l-en">Featured only</span></span>
              <span style={{ color: '#F2B51D' }}>★</span>
            </label>
          </div>
        </div>
        <div style={{ padding: '14px 18px', borderTop: '1px solid #EEF2F6' }}>
          <button style={{ width: '100%', background: '#0F2A4A', color: '#fff', fontWeight: 700, fontSize: 14, padding: 12, border: 'none', borderRadius: 10, cursor: 'pointer' }}><span className="l-vi">Áp dụng bộ lọc</span><span className="l-en">Apply filters</span></button>
        </div>
      </aside>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>{shownCount} <span className="l-vi">thương vụ</span><span className="l-en">deals</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: '#EEF2F6', borderRadius: 10, padding: 4 }}>
              <button onClick={() => setViewMode('grid')} style={viewBtnStyle(viewMode === 'grid')}>▦ <span className="l-vi">Lưới</span><span className="l-en">Grid</span></button>
              <button onClick={() => setViewMode('list')} style={viewBtnStyle(viewMode === 'list')}>☰ <span className="l-vi">Danh sách</span><span className="l-en">List</span></button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#64748B' }}>
              <span className="l-vi">Sắp xếp:</span><span className="l-en">Sort by:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} style={{ border: '1px solid #E2E8F0', borderRadius: 9, padding: '9px 12px', fontSize: 14, background: '#fff', color: '#0F2A4A', fontWeight: 600, cursor: 'pointer' }}>
                <option value="recent">{T(lang, 'Mới đăng', 'Recently listed')}</option>
                <option value="revHigh">{T(lang, 'Doanh thu cao → thấp', 'Revenue high → low')}</option>
                <option value="revLow">{T(lang, 'Doanh thu thấp → cao', 'Revenue low → high')}</option>
                <option value="rating">{T(lang, 'Xếp hạng cao nhất', 'Highest rating')}</option>
              </select>
            </label>
          </div>
        </div>

        {viewMode === 'grid' ? <div className="d68-grid-view" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>{deals.map((d) => <GridCard key={d.id} d={d} lang={lang} />)}</div> : null}
        {viewMode === 'list' ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{deals.map((d) => <ListCard key={d.id} d={d} lang={lang} />)}</div> : null}

        {!deals.length ? <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 16, color: '#64748B' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}><span className="l-vi">Không có thương vụ khớp bộ lọc</span><span className="l-en">No deals match your filters</span></div>
          <button onClick={clearFilters} style={{ marginTop: 8, background: '#1BADEA', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}><span className="l-vi">Xóa bộ lọc</span><span className="l-en">Clear filters</span></button>
        </div> : null}

        <div style={{ marginTop: 22, background: 'linear-gradient(120deg,#0F2A4A,#14315A)', borderRadius: 16, padding: '26px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 19, fontWeight: 800, marginBottom: 4 }}><span className="l-vi">Đăng doanh nghiệp của bạn lên Deals68</span><span className="l-en">List your business on Deals68</span></div>
            <div style={{ color: '#a9bdd4', fontSize: 14 }}><span className="l-vi">Tiếp cận nhà đầu tư, người mua chiến lược và bên cho vay trong nước và quốc tế.</span><span className="l-en">Reach investors, strategic buyers and lenders locally and globally.</span></div>
          </div>
          <Link to="/register/business" style={{ background: '#F2B51D', color: '#0F2A4A', fontWeight: 800, fontSize: 15, padding: '14px 24px', borderRadius: 11, whiteSpace: 'nowrap' }}><span className="l-vi">Tạo hồ sơ DN</span><span className="l-en">Create profile</span> →</Link>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', padding: '9px 15px', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'not-allowed' }}>‹ <span className="l-vi">Trước</span><span className="l-en">Prev</span></button>
          <button style={{ border: '1px solid #1BADEA', background: '#1BADEA', color: '#fff', width: 40, height: 40, borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>1</button>
          <button style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#334155', width: 40, height: 40, borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>2</button>
          <button style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#334155', width: 40, height: 40, borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>3</button>
          <button style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#334155', padding: '9px 15px', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}><span className="l-vi">Sau</span><span className="l-en">Next</span> ›</button>
        </div>
      </div>
    </div>

    <section style={{ background: '#fff', borderTop: '1px solid #E7EDF3' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 20px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -.6, margin: '0 0 16px' }}><span className="l-vi">Khám phá doanh nghiệp đang chào bán tại Việt Nam</span><span className="l-en">Exploring businesses for sale in Vietnam</span></h2>
        <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.7, margin: '0 0 26px' }}>
          <span className="l-vi">Việt Nam là một trong những nền kinh tế tăng trưởng nhanh nhất Đông Nam Á, với tầng lớp trung lưu mở rộng và môi trường đầu tư ngày càng thuận lợi. Trên Deals68, bạn có thể tìm và kết nối với doanh nghiệp đang gọi vốn, bán một phần hoặc toàn bộ — từ F&amp;B, y tế, sản xuất đến công nghệ — tại TP. Hồ Chí Minh, Hà Nội, Đà Nẵng và nhiều tỉnh thành khác.</span>
          <span className="l-en">Vietnam is one of Southeast Asia&apos;s fastest-growing economies, with an expanding middle class and an increasingly investor-friendly environment. On Deals68 you can discover and connect with businesses raising capital or selling part or all of their equity — across F&amp;B, healthcare, manufacturing and technology — in Ho Chi Minh City, Hanoi, Da Nang and beyond.</span>
        </p>
        <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}><span className="l-vi">Vì sao đầu tư vào doanh nghiệp Việt Nam?</span><span className="l-en">Why invest in Vietnamese businesses?</span></h3>
        <ul style={{ fontSize: 15.5, color: '#475569', lineHeight: 1.7, margin: '0 0 24px', paddingLeft: 20 }}>
          <li><b><span className="l-vi">Tăng trưởng ổn định:</span><span className="l-en">Stable growth:</span></b> <span className="l-vi">GDP tăng đều, cải cách khuyến khích đầu tư và vị trí chiến lược trong khối ASEAN.</span><span className="l-en">consistent GDP growth, reforms encouraging investment and a strategic ASEAN location.</span></li>
          <li><b><span className="l-vi">Cầu nội địa lớn:</span><span className="l-en">Rising domestic demand:</span></b> <span className="l-vi">tầng lớp trung lưu mở rộng thúc đẩy bán lẻ, F&amp;B, y tế và công nghệ.</span><span className="l-en">a growing middle class fuels retail, F&amp;B, healthcare and technology.</span></li>
          <li><b><span className="l-vi">Dễ tiếp cận:</span><span className="l-en">Easier to enter:</span></b> <span className="l-vi">thủ tục đăng ký đơn giản hơn và nới lỏng giới hạn sở hữu nước ngoài ở nhiều ngành.</span><span className="l-en">simpler registration and relaxed foreign-ownership limits across many sectors.</span></li>
        </ul>
        <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}><span className="l-vi">Ngành nổi bật</span><span className="l-en">Popular sectors</span></h3>
        <p style={{ fontSize: 15.5, color: '#475569', lineHeight: 1.7, margin: '0 0 24px' }}><span className="l-vi">Du lịch &amp; khách sạn, F&amp;B, sản xuất &amp; xuất khẩu (đặc biệt thủy sản, dệt may, gỗ), y tế và công nghệ là những lĩnh vực có nhiều thương vụ và nhu cầu vốn cao nhất trên nền tảng.</span><span className="l-en">Hospitality &amp; tourism, F&amp;B, manufacturing &amp; export (especially seafood, textiles and wood), healthcare and technology see the most deal flow and capital demand on the platform.</span></p>
        <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px' }}><span className="l-vi">Cần lưu ý khi mua doanh nghiệp</span><span className="l-en">What to consider when buying</span></h3>
        <p style={{ fontSize: 15.5, color: '#475569', lineHeight: 1.7, margin: '0 0 6px' }}><span className="l-vi">Tìm hiểu quy định pháp lý và giới hạn sở hữu nước ngoài, thực hiện thẩm định (due diligence) kỹ về tài chính và pháp lý, lưu ý khác biệt văn hóa kinh doanh, và cân nhắc sử dụng cố vấn M&amp;A trên Deals68. Mọi thông tin nhạy cảm chỉ mở sau khi hai bên chấp nhận kết nối.</span><span className="l-en">Understand legal rules and foreign-ownership limits, run thorough financial and legal due diligence, account for local business culture, and consider engaging an M&amp;A advisor on Deals68. Sensitive details unlock only after both parties accept a connection.</span></p>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 8px' }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 16px' }}><span className="l-vi">Duyệt doanh nghiệp theo địa điểm</span><span className="l-en">Browse businesses by location</span></h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{locationLinks(lang).map((loc) => <Link key={loc} to="/businesses" style={{ fontSize: 14, fontWeight: 500, color: '#334155', background: '#F7FAFC', border: '1px solid #E7EDF3', padding: '9px 14px', borderRadius: 999 }}><span className="l-vi">DN tại</span><span className="l-en">Businesses in</span> {loc}</Link>)}</div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px 56px' }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 16px' }}><span className="l-vi">Duyệt doanh nghiệp theo ngành</span><span className="l-en">Browse businesses by industry</span></h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{industryLinks(lang).map((il) => <Link key={il} to="/businesses" style={{ fontSize: 14, fontWeight: 500, color: '#334155', background: '#F7FAFC', border: '1px solid #E7EDF3', padding: '9px 14px', borderRadius: 999 }}>{il}</Link>)}</div>
      </div>
    </section>

    <section style={{ maxWidth: 900, margin: '0 auto', padding: '52px 24px' }}>
      <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.5, margin: '0 0 22px' }}><span className="l-vi">Câu hỏi thường gặp</span><span className="l-en">Frequently asked questions</span></h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{faqs.map((f) => <div key={f.q} style={{ background: '#fff', border: '1px solid #E7EDF3', borderRadius: 14, padding: '20px 22px' }}><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 7 }}>{f.q}</div><p style={{ fontSize: 14.5, color: '#64748B', lineHeight: 1.6, margin: 0 }}>{f.a}</p></div>)}</div>
    </section>
  </>;
}
