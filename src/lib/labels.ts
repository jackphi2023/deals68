import type { Lang } from './i18n';

export const FX_VND_PER_USD = 26000;

export function T(lang: Lang, vi: string, en: string) {
  return lang === 'en' ? en : vi;
}

function norm(raw: any) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function first(raw: any) {
  return String(raw || '').split(/[;,/|]+/).map((x) => x.trim()).filter(Boolean)[0] || '';
}

const industryMap: { keys: string[]; vi: string; en: string }[] = [
  { keys: ['finance', 'financial', 'fintech', 'banking', 'insurance', 'tai chinh', 'ngan hang', 'bao hiem'], vi: 'Tài chính', en: 'Finance' },
  { keys: ['health', 'healthcare', 'clinic', 'medical', 'dental', 'y te', 'suc khoe', 'nha khoa'], vi: 'Y tế & Sức khỏe', en: 'Healthcare' },
  { keys: ['beauty', 'personal care', 'spa', 'derma', 'tham my', 'lam dep', 'cham soc ca nhan'], vi: 'Làm đẹp & Chăm sóc cá nhân', en: 'Beauty & Personal Care' },
  { keys: ['technology', 'tech', 'software', 'saas', 'ai', 'cong nghe'], vi: 'Công nghệ', en: 'Technology' },
  { keys: ['f b', 'food', 'beverage', 'restaurant', 'cafe', 'fnb', 'nha hang', 'thuc pham'], vi: 'F&B', en: 'F&B' },
  { keys: ['retail', 'ban le'], vi: 'Bán lẻ', en: 'Retail' },
  { keys: ['manufacturing', 'factory', 'industrial', 'san xuat'], vi: 'Sản xuất', en: 'Manufacturing' },
  { keys: ['real estate', 'property', 'bat dong san'], vi: 'Bất động sản', en: 'Real Estate' },
  { keys: ['logistics', 'warehouse', 'cold storage', 'supply chain', 'kho van', 'kho lanh'], vi: 'Logistics & Kho vận', en: 'Logistics & Warehousing' },
  { keys: ['education', 'edtech', 'giao duc'], vi: 'Giáo dục', en: 'Education' },
  { keys: ['energy', 'renewable', 'nang luong'], vi: 'Năng lượng', en: 'Energy' },
  { keys: ['ecommerce', 'e commerce', 'thuong mai dien tu'], vi: 'Thương mại điện tử', en: 'E-commerce' },
  { keys: ['seafood', 'aquaculture', 'thuy san', 'xuat khau'], vi: 'Thủy sản & Xuất khẩu', en: 'Seafood & Export' },
  { keys: ['fashion', 'apparel', 'textile', 'thoi trang', 'may mac'], vi: 'Thời trang', en: 'Fashion' },
  { keys: ['business services', 'consulting', 'dich vu doanh nghiep'], vi: 'Dịch vụ doanh nghiệp', en: 'Business Services' },
];

const investorTypeMap: { keys: string[]; vi: string; en: string }[] = [
  { keys: ['vc', 'venture'], vi: 'Quỹ đầu tư mạo hiểm', en: 'VC' },
  { keys: ['pe', 'private equity'], vi: 'Quỹ đầu tư tư nhân', en: 'PE' },
  { keys: ['institutional'], vi: 'Nhà đầu tư tổ chức', en: 'Institutional' },
  { keys: ['corporate', 'strategic'], vi: 'Doanh nghiệp chiến lược', en: 'Corporate / Strategic' },
  { keys: ['individual', 'angel'], vi: 'Nhà đầu tư cá nhân / Angel', en: 'Individual / Angel' },
  { keys: ['family office'], vi: 'Family Office', en: 'Family Office' },
  { keys: ['lender', 'debt', 'credit'], vi: 'Bên cho vay / Tín dụng', en: 'Lender / Debt' },
];

const dealMap: { keys: string[]; vi: string; en: string; investorVi: string; investorEn: string }[] = [
  { keys: ['fund', 'raise', 'fundraise', 'primary', 'equity', 'invest', 'goi von', 'dau tu'], vi: 'Gọi vốn', en: 'Fundraise', investorVi: 'Đầu tư', investorEn: 'Investment' },
  { keys: ['loan', 'debt', 'credit', 'vay'], vi: 'Vay vốn', en: 'Debt financing', investorVi: 'Cho vay', investorEn: 'Lending' },
  { keys: ['ma', 'm a', 'sale', 'acquisition', 'transfer', 'asset', 'ban', 'chuyen nhuong'], vi: 'M&A / Chuyển nhượng', en: 'M&A / Sale', investorVi: 'M&A', investorEn: 'M&A' },
  { keys: ['jv', 'joint', 'partner', 'partnership', 'lien doanh', 'doi tac'], vi: 'Đối tác / Liên doanh', en: 'Partnership / JV', investorVi: 'Đối tác / Liên doanh', investorEn: 'Partnership / JV' },
];

const stageMap: { keys: string[]; vi: string; en: string }[] = [
  { keys: ['seed'], vi: 'Seed', en: 'Seed' },
  { keys: ['series a'], vi: 'Series A', en: 'Series A' },
  { keys: ['growth'], vi: 'Tăng trưởng', en: 'Growth' },
  { keys: ['mature'], vi: 'Ổn định / Trưởng thành', en: 'Mature' },
  { keys: ['buyout'], vi: 'Mua lại / Buyout', en: 'Buyout' },
  { keys: ['any', 'all'], vi: 'Linh hoạt', en: 'Flexible' },
];

export const countryOptions = [
  { iso2: 'VN', vi: 'Việt Nam', en: 'Vietnam', dial: '+84' },
  { iso2: 'SG', vi: 'Singapore', en: 'Singapore', dial: '+65' },
  { iso2: 'US', vi: 'Hoa Kỳ', en: 'United States', dial: '+1' },
  { iso2: 'JP', vi: 'Nhật Bản', en: 'Japan', dial: '+81' },
  { iso2: 'KR', vi: 'Hàn Quốc', en: 'South Korea', dial: '+82' },
  { iso2: 'HK', vi: 'Hồng Kông', en: 'Hong Kong', dial: '+852' },
  { iso2: 'AU', vi: 'Úc', en: 'Australia', dial: '+61' },
  { iso2: 'DE', vi: 'Đức', en: 'Germany', dial: '+49' },
  { iso2: 'CA', vi: 'Canada', en: 'Canada', dial: '+1' },
  { iso2: 'TH', vi: 'Thái Lan', en: 'Thailand', dial: '+66' },
  { iso2: 'AE', vi: 'UAE', en: 'UAE', dial: '+971' },
];

export const industryOptions = industryMap.map(({ vi, en }) => ({ vi, en }));
export const investorDealOptions = dealMap.map(({ investorVi, investorEn }) => ({ vi: investorVi, en: investorEn }));
export const businessDealOptions = dealMap.map(({ vi, en }) => ({ vi, en }));
export const investorTypeOptions = investorTypeMap.map(({ vi, en }) => ({ vi, en }));
export const stageOptions = stageMap.map(({ vi, en }) => ({ vi, en }));

function matchMap(raw: any, map: { keys: string[]; vi: string; en: string }[]) {
  const n = norm(raw);
  return map.find((item) => item.keys.some((k) => n.includes(norm(k))));
}

export function labelIndustry(raw: any, lang: Lang) {
  const rawText = first(raw);
  const item = matchMap(rawText, industryMap);
  if (item) return T(lang, item.vi, item.en);
  return rawText || T(lang, 'Đang cập nhật', 'Updating');
}

export function labelInvestorType(raw: any, lang: Lang) {
  const item = matchMap(raw, investorTypeMap);
  return item ? T(lang, item.vi, item.en) : (String(raw || '').trim() || T(lang, 'Nhà đầu tư', 'Investor'));
}

export function labelStage(raw: any, lang: Lang) {
  const item = matchMap(raw, stageMap);
  return item ? T(lang, item.vi, item.en) : (String(raw || '').trim() || T(lang, 'Linh hoạt', 'Flexible'));
}

export function labelDealType(raw: any, lang: Lang, investorView = false) {
  const rawText = first(raw);
  const n = norm(rawText);
  const item = dealMap.find((d) => d.keys.some((k) => n.includes(norm(k))));
  if (!item) return rawText || T(lang, 'Đang cập nhật', 'Updating');
  return investorView ? T(lang, item.investorVi, item.investorEn) : T(lang, item.vi, item.en);
}

export function labelList(values: any, lang: Lang, mapper: (v: any, l: Lang) => string) {
  const arr = Array.isArray(values) ? values : String(values || '').split(/[;,/|]+/);
  const labels = arr.map((v) => mapper(v, lang)).filter(Boolean);
  return [...new Set(labels)].join(', ') || T(lang, 'Đang cập nhật', 'Updating');
}

export function labelCountry(raw: any, lang: Lang) {
  const r = String(raw || '').trim();
  const n = norm(r);
  const item = countryOptions.find((c) => norm(c.iso2) === n || norm(c.vi) === n || norm(c.en) === n);
  return item ? T(lang, item.vi, item.en) : (r || T(lang, 'Toàn cầu', 'Global'));
}

export function labelRegion(raw: any, lang: Lang) {
  const v = norm(raw);
  if (v.includes('america')) return T(lang, 'Châu Mỹ', 'Americas');
  if (v.includes('europe')) return T(lang, 'Châu Âu', 'Europe');
  if (v.includes('oceania') || v.includes('australia')) return T(lang, 'Châu Úc', 'Oceania');
  if (v.includes('middle') || v.includes('mideast')) return T(lang, 'Trung Đông', 'Middle East');
  if (v.includes('asia')) return T(lang, 'Châu Á', 'Asia');
  return T(lang, 'Toàn cầu', 'Global');
}

export function phoneDialFromIso(iso2: string) {
  return countryOptions.find((c) => c.iso2 === iso2)?.dial || '+84';
}

export function normalizeInvestorDealForDb(label: string) {
  const n = norm(label);
  if (n.includes('cho vay') || n.includes('lending')) return 'Lending';
  if (n.includes('ma') || n.includes('m a')) return 'M&A';
  if (n.includes('doi tac') || n.includes('joint') || n.includes('partner')) return 'Partnership / JV';
  return 'Investment';
}

export function formatMoneyForLang(value: any, currency: any, lang: Lang, opts: { stakePct?: any } = {}) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return T(lang, 'Đang cập nhật', 'Pending');
  const cur = String(currency || 'VND').toUpperCase();
  const usd = cur === 'USD' ? amount : amount / FX_VND_PER_USD;
  const vnd = cur === 'VND' ? amount : amount * FX_VND_PER_USD;
  const base = lang === 'en'
    ? (usd >= 1_000_000 ? `$${(usd / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M` : `$${Math.round(usd).toLocaleString('en-US')}`)
    : (vnd >= 1_000_000_000 ? `${(vnd / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫` : `${Math.round(vnd / 1_000_000).toLocaleString('vi-VN')} triệu ₫`);
  const pct = Number(opts.stakePct || 0);
  return pct > 0 ? `${base} · ${pct.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 })}%` : base;
}
