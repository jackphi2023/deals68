import type { Lang } from './i18n';
import { T } from './labelsBase';

export type IndustryTaxonomyItem = {
  key: string;
  vi: string;
  en: string;
  seoVi: string;
  seoEn: string;
  aliases: string[];
};

function norm(raw: any) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const INDUSTRY_TAXONOMY: IndustryTaxonomyItem[] = [
  { key: 'agriculture', vi: 'Nông nghiệp', en: 'Agriculture', seoVi: 'doanh nghiệp nông nghiệp, trang trại, chế biến nông sản', seoEn: 'agriculture businesses, farms and agri processing', aliases: ['nong nghiep', 'agriculture', 'agri', 'farm'] },
  { key: 'automobile', vi: 'Ô tô & Phụ tùng', en: 'Automobile', seoVi: 'ô tô, phụ tùng, đại lý xe, dịch vụ xe', seoEn: 'automotive, auto parts, dealerships and services', aliases: ['oto', 'o to', 'automobile', 'auto', 'car', 'phu tung'] },
  { key: 'beauty_personal_care', vi: 'Làm đẹp & Chăm sóc cá nhân', en: 'Beauty & Personal Care', seoVi: 'spa, thẩm mỹ, chăm sóc da, mỹ phẩm', seoEn: 'beauty, spa, aesthetics, skincare and personal care', aliases: ['beauty', 'personal care', 'spa', 'derma', 'tham my', 'lam dep', 'cham soc ca nhan'] },
  { key: 'construction_materials', vi: 'Xây dựng & Vật liệu', en: 'Building, Construction & Materials', seoVi: 'xây dựng, vật liệu xây dựng, nhà thầu', seoEn: 'building, construction and materials', aliases: ['building', 'construction', 'materials', 'xay dung', 'vat lieu'] },
  { key: 'chemicals', vi: 'Hóa chất', en: 'Chemicals', seoVi: 'hóa chất công nghiệp, phụ gia, vật liệu hóa học', seoEn: 'chemicals, industrial chemicals and additives', aliases: ['chemical', 'chemicals', 'hoa chat'] },
  { key: 'education_training', vi: 'Giáo dục & Đào tạo', en: 'Education & Training', seoVi: 'giáo dục, đào tạo, trung tâm, edtech', seoEn: 'education, training centres and edtech', aliases: ['education', 'training', 'edtech', 'giao duc', 'dao tao'] },
  { key: 'energy_utilities', vi: 'Năng lượng & Tiện ích', en: 'Energy & Utilities', seoVi: 'năng lượng, điện, tiện ích, năng lượng tái tạo', seoEn: 'energy, utilities, power and renewables', aliases: ['energy', 'utilities', 'renewable', 'power', 'nang luong', 'dien'] },
  { key: 'entertainment_leisure', vi: 'Giải trí & Nghỉ dưỡng', en: 'Entertainment & Leisure', seoVi: 'giải trí, karaoke, thể thao, khu vui chơi, nghỉ dưỡng', seoEn: 'entertainment, leisure, sports and recreation', aliases: ['entertainment', 'leisure', 'karaoke', 'giai tri', 'nghi duong'] },
  { key: 'finance', vi: 'Tài chính', en: 'Finance', seoVi: 'tài chính, fintech, tín dụng, bảo hiểm', seoEn: 'finance, fintech, credit and insurance', aliases: ['finance', 'financial', 'fintech', 'banking', 'insurance', 'tai chinh', 'ngan hang', 'bao hiem'] },
  { key: 'food_beverage', vi: 'Thực phẩm & Đồ uống (F&B)', en: 'Food & Beverage', seoVi: 'nhà hàng, quán cà phê, thực phẩm, đồ uống, chuỗi F&B', seoEn: 'food and beverage, restaurants, cafes and F&B chains', aliases: ['f b', 'fnb', 'food', 'beverage', 'restaurant', 'cafe', 'nha hang', 'thuc pham', 'do uong'] },
  { key: 'healthcare', vi: 'Y tế & Chăm sóc sức khỏe', en: 'Health Care', seoVi: 'phòng khám, nha khoa, y tế, chăm sóc sức khỏe', seoEn: 'health care, clinics, dental and medical services', aliases: ['health', 'healthcare', 'health care', 'clinic', 'medical', 'dental', 'y te', 'suc khoe', 'nha khoa'] },
  { key: 'hotels_resorts', vi: 'Khách sạn & Resort', en: 'Hotels & Resorts', seoVi: 'khách sạn, resort, lưu trú, nghỉ dưỡng', seoEn: 'hotels, resorts and hospitality assets', aliases: ['hotel', 'hotels', 'resort', 'hospitality', 'khach san'] },
  { key: 'it_software', vi: 'CNTT & Phần mềm', en: 'IT & Software / Technology', seoVi: 'công nghệ thông tin, phần mềm, SaaS, AI, tự động hóa', seoEn: 'IT, software, SaaS, AI and technology', aliases: ['technology', 'tech', 'software', 'saas', 'ai', 'it', 'cntt', 'cong nghe', 'phan mem'] },
  { key: 'manufacturing', vi: 'Sản xuất', en: 'Manufacturing', seoVi: 'nhà máy, sản xuất, công nghiệp, gia công', seoEn: 'manufacturing, factories and industrial production', aliases: ['manufacturing', 'factory', 'industrial', 'san xuat', 'nha may'] },
  { key: 'media_advertising', vi: 'Truyền thông & Quảng cáo', en: 'Media & Advertising', seoVi: 'truyền thông, quảng cáo, marketing, agency', seoEn: 'media, advertising, marketing and agencies', aliases: ['media', 'advertising', 'marketing', 'agency', 'truyen thong', 'quang cao'] },
  { key: 'real_estate', vi: 'Bất động sản', en: 'Real Estate', seoVi: 'bất động sản, dự án, tài sản, mặt bằng, văn phòng', seoEn: 'real estate, property, projects and assets', aliases: ['real estate', 'property', 'bat dong san', 'bds'] },
  { key: 'retail', vi: 'Bán lẻ', en: 'Retail', seoVi: 'bán lẻ, chuỗi cửa hàng, thương mại', seoEn: 'retail, store chains and commerce', aliases: ['retail', 'ban le', 'store'] },
  { key: 'services', vi: 'Dịch vụ (B2B/B2C)', en: 'Services', seoVi: 'dịch vụ doanh nghiệp, dịch vụ tiêu dùng, tư vấn', seoEn: 'B2B and B2C services', aliases: ['services', 'business services', 'consulting', 'dich vu', 'dich vu doanh nghiep'] },
  { key: 'transportation_logistics', vi: 'Logistics & Vận tải', en: 'Transportation & Logistics', seoVi: 'logistics, vận tải, kho vận, giao nhận, kho lạnh', seoEn: 'transportation, logistics, warehousing and cold chain', aliases: ['logistics', 'transport', 'transportation', 'warehouse', 'cold storage', 'supply chain', 'kho van', 'kho lanh', 'van tai'] },
  { key: 'travel', vi: 'Du lịch', en: 'Travel', seoVi: 'du lịch, lữ hành, OTA, tour, dịch vụ du lịch', seoEn: 'travel, tourism, tours and OTA', aliases: ['travel', 'tourism', 'tour', 'du lich', 'lu hanh'] },
  { key: 'ecommerce', vi: 'Thương mại điện tử', en: 'E-commerce', seoVi: 'thương mại điện tử, bán hàng trực tuyến, marketplace', seoEn: 'e-commerce, online retail and marketplaces', aliases: ['ecommerce', 'e commerce', 'marketplace', 'online retail', 'thuong mai dien tu'] },
  { key: 'textiles_apparel', vi: 'Dệt may & Thời trang', en: 'Textiles & Apparel', seoVi: 'dệt may, thời trang, may mặc, thiết kế', seoEn: 'textiles, apparel, fashion and garment manufacturing', aliases: ['textile', 'textiles', 'apparel', 'fashion', 'garment', 'thoi trang', 'may mac', 'det may'] },
  { key: 'seafood_export', vi: 'Thủy sản & Xuất khẩu', en: 'Seafood & Export', seoVi: 'thủy sản, xuất khẩu, chế biến, kho lạnh, nông thủy sản', seoEn: 'seafood, export, processing and cold storage', aliases: ['seafood', 'aquaculture', 'export', 'thuy san', 'xuat khau', 'ca tra', 'tom'] }
];

export const industryOptions = INDUSTRY_TAXONOMY.map(({ key, vi, en }) => ({ key, vi, en }));

export function industryKeyFromLabel(raw: any) {
  const n = norm(raw);
  if (!n) return '';
  const exact = INDUSTRY_TAXONOMY.find((item) => norm(item.key) === n || norm(item.vi) === n || norm(item.en) === n);
  if (exact) return exact.key;
  const fuzzy = INDUSTRY_TAXONOMY.find((item) => item.aliases.some((a) => n.includes(norm(a)) || norm(a).includes(n)));
  return fuzzy?.key || '';
}

export function industryByKeyOrLabel(raw: any) {
  const key = industryKeyFromLabel(raw);
  return INDUSTRY_TAXONOMY.find((item) => item.key === key) || null;
}

export function labelIndustryTaxonomy(raw: any, lang: Lang) {
  const item = industryByKeyOrLabel(raw);
  if (item) return T(lang, item.vi, item.en);
  return String(raw || '').trim() || T(lang, 'Đang cập nhật', 'Updating');
}

export function industrySeoText(raw: any, lang: Lang) {
  const item = industryByKeyOrLabel(raw);
  return item ? T(lang, item.seoVi, item.seoEn) : '';
}

export function normalizeIndustryForDb(raw: any, lang: Lang = 'vi') {
  const item = industryByKeyOrLabel(raw);
  return item ? T(lang, item.vi, item.en) : String(raw || '').trim();
}
