import type { Lang } from './i18n';
import { T } from './labelsBase';

export type InvestorCriteriaOption = {
  value: string;
  vi: string;
  en: string;
  aliases?: string[];
};

export const INVESTOR_TYPE_OPTIONS: InvestorCriteriaOption[] = [
  { value: 'Individual/Angel', vi: 'Nhà đầu tư cá nhân', en: 'Individual / Angel', aliases: ['Nhà đầu tư cá nhân', 'individual', 'angel'] },
  { value: 'VC', vi: 'Quỹ đầu tư mạo hiểm', en: 'VC', aliases: ['venture capital', 'quỹ đầu tư mạo hiểm'] },
  { value: 'PE', vi: 'Quỹ đầu tư tư nhân', en: 'PE', aliases: ['private equity', 'quỹ đầu tư tư nhân'] },
  { value: 'Institutional', vi: 'Nhà đầu tư tổ chức', en: 'Institutional', aliases: ['nhà đầu tư tổ chức'] },
  { value: 'Corporate/Strategic', vi: 'Doanh nghiệp chiến lược', en: 'Corporate / Strategic', aliases: ['corporate', 'strategic', 'nhà đầu tư chiến lược'] },
  { value: 'Family Office', vi: 'Văn phòng gia đình', en: 'Family Office', aliases: ['family office', 'văn phòng gia đình'] },
  { value: 'Lender/Debt', vi: 'Bên cho vay / Tín dụng', en: 'Lender / Debt', aliases: ['lender', 'debt', 'credit', 'bên cho vay', 'tín dụng'] },
];

export const INVESTOR_STAGE_OPTIONS: InvestorCriteriaOption[] = [
  { value: 'Seed', vi: 'Doanh nghiệp nhỏ / Khởi nghiệp', en: 'Seed / Early stage', aliases: ['early stage', 'early-stage', 'startup', 'dn nhỏ'] },
  { value: 'Series A', vi: 'Vòng Series A', en: 'Series A' },
  { value: 'Growth', vi: 'Giai đoạn tăng trưởng', en: 'Growth stage', aliases: ['growth stage', 'tăng trưởng'] },
  { value: 'Mature', vi: 'Ổn định / Trưởng thành', en: 'Mature', aliases: ['mature', 'trưởng thành'] },
  { value: 'Buyout', vi: 'Mua lại doanh nghiệp', en: 'Buyout', aliases: ['mua lại'] },
  { value: 'Any', vi: 'Linh hoạt', en: 'Flexible', aliases: ['all', 'flexible', 'linh hoạt'] },
];

export const INVESTOR_DEAL_OPTIONS: InvestorCriteriaOption[] = [
  { value: 'Investment', vi: 'Đầu tư', en: 'Investment', aliases: ['invest', 'equity', 'gọi vốn'] },
  { value: 'Lending', vi: 'Cho vay', en: 'Lending', aliases: ['loan', 'debt', 'credit', 'vay'] },
  { value: 'M&A', vi: 'M&A / Mua bán doanh nghiệp', en: 'M&A', aliases: ['sale', 'acquisition', 'transfer', 'chuyển nhượng'] },
  { value: 'Partnership / JV', vi: 'Đối tác / Liên doanh', en: 'Partnership / JV', aliases: ['partnership', 'joint venture', 'jv', 'liên doanh'] },
];

export const RISK_APPETITE_OPTIONS: InvestorCriteriaOption[] = [
  { value: 'conservative', vi: 'Thận trọng', en: 'Conservative', aliases: ['low', 'cautious', 'thấp'] },
  { value: 'balanced', vi: 'Cân bằng', en: 'Balanced', aliases: ['medium', 'moderate', 'trung bình'] },
  { value: 'growth', vi: 'Ưu tiên tăng trưởng', en: 'Growth-oriented', aliases: ['growth oriented'] },
  { value: 'aggressive', vi: 'Mạo hiểm / Lợi nhuận cao', en: 'Aggressive / High return', aliases: ['high', 'cao', 'mạo hiểm'] },
];

export const REVENUE_RANGE_OPTIONS: InvestorCriteriaOption[] = [
  { value: 'pre_revenue', vi: 'Chưa có doanh thu', en: 'Pre-revenue', aliases: ['pre revenue'] },
  { value: 'under_10b_vnd', vi: 'Dưới 10 tỷ đồng/năm', en: 'Under VND 10B/year', aliases: ['under 10b', '<10'] },
  { value: '10b_50b_vnd', vi: 'Từ 10–50 tỷ đồng/năm', en: 'VND 10–50B/year', aliases: ['10-50', '10–50'] },
  { value: '50b_200b_vnd', vi: 'Từ 50–200 tỷ đồng/năm', en: 'VND 50–200B/year', aliases: ['50-200', '50–200'] },
  { value: 'over_200b_vnd', vi: 'Trên 200 tỷ đồng/năm', en: 'Over VND 200B/year', aliases: ['over 200b', '>200'] },
  { value: 'flexible', vi: 'Linh hoạt theo cơ hội', en: 'Flexible by opportunity', aliases: ['any', 'all', 'linh hoạt'] },
];

function normalize(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function optionValue(
  value: unknown,
  options: InvestorCriteriaOption[],
  fallback = '',
) {
  const raw = String(value || '').trim();
  const wanted = normalize(raw);
  if (!wanted) return fallback;
  const found = options.find((option) =>
    [option.value, option.vi, option.en, ...(option.aliases || [])]
      .some((item) => normalize(item) === wanted || wanted.includes(normalize(item))),
  );
  return found?.value || raw || fallback;
}

export function optionLabel(
  value: unknown,
  options: InvestorCriteriaOption[],
  lang: Lang,
  emptyVi = 'Chưa chọn',
  emptyEn = 'Not selected',
) {
  const raw = String(value || '').trim();
  if (!raw) return T(lang, emptyVi, emptyEn);
  const canonical = optionValue(raw, options);
  const found = options.find((option) => option.value === canonical);
  return found ? T(lang, found.vi, found.en) : raw;
}

export function riskAppetiteLabel(value: unknown, lang: Lang) {
  return optionLabel(value, RISK_APPETITE_OPTIONS, lang);
}

export function revenueRangeLabel(value: unknown, lang: Lang) {
  return optionLabel(value, REVENUE_RANGE_OPTIONS, lang);
}

export function returnExpectationLabel(value: unknown, lang: Lang) {
  const raw = String(value || '').trim();
  if (!raw) return T(lang, 'Chưa chọn', 'Not selected');
  if (/^-?\d+(?:[.,]\d+)?$/.test(raw)) {
    return `${raw.replace(',', '.')}%/${T(lang, 'năm', 'year')}`;
  }
  return raw;
}
