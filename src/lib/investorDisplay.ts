
import type { Lang } from './i18n';
import { investorTargetCountries } from './data';
export { investorTargetCountries };
import { formatMoneyForLang, labelCountry, labelIndustry, labelInvestorType, labelStage, T } from './labels';

type AnyRow = Record<string, any>;

function arr(value: any): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).map((x) => x.trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[;,\n]/).map((x) => x.trim()).filter(Boolean);
}

export function investorTicketLabel(lang: Lang, row: AnyRow) {
  const min = Number(row?.ticket_min ?? row?.ticketMin ?? 0);
  const max = Number(row?.ticket_max ?? row?.ticketMax ?? 0);
  if (!min && !max) return '';
  if (min && max) return `${formatMoneyForLang(min, 'USD', lang)} – ${formatMoneyForLang(max, 'USD', lang)}`;
  return max ? `≤ ${formatMoneyForLang(max, 'USD', lang)}` : `≥ ${formatMoneyForLang(min, 'USD', lang)}`;
}

export function investorPublicTitle(row: AnyRow, lang: Lang) {
  const industries = arr(row?.industries || row?.criteria?.sectors).slice(0, 2).map((x) => labelIndustry(x, lang));
  const type = labelInvestorType(row?.type, lang);
  const targets = investorTargetCountries(row).slice(0, 2).map((x) => labelCountry(x, lang));
  const sectorText = industries.join(', ') || T(lang, 'đa lĩnh vực', 'multiple sectors');
  const targetText = targets.length ? ` (${targets.join(', ')})` : '';
  return lang === 'en' ? `${type} interested in ${sectorText}${targetText}` : `${type} quan tâm ${sectorText}${targetText}`;
}

export function investorPublicDescription(row: AnyRow, lang: Lang) {
  const industries = arr(row?.industries || row?.criteria?.sectors).slice(0, 4).map((x) => labelIndustry(x, lang));
  const targets = investorTargetCountries(row).slice(0, 6).map((x) => labelCountry(x, lang));
  const stage = labelStage(row?.stage || row?.criteria?.stage, lang);
  const ticket = investorTicketLabel(lang, row);

  if (lang === 'en') {
    return [
      `An anonymous ${labelInvestorType(row?.type, lang).toLowerCase()} profile interested in ${industries.join(', ') || 'multiple sectors'}.`,
      targets.length ? `Target investment markets: ${targets.join('; ')}.` : '',
      stage ? `Preferred stage: ${stage}.` : '',
      ticket ? `Indicative ticket size: ${ticket}.` : '',
      'Name, organization and contact details are kept private for admin verification and are only shared after an approved connection.'
    ].filter(Boolean).join(' ');
  }

  return [
    `Hồ sơ ${labelInvestorType(row?.type, lang).toLowerCase()} ẩn danh quan tâm ${industries.join(', ') || 'đa lĩnh vực'}.`,
    targets.length ? `Thị trường quan tâm đầu tư: ${targets.join('; ')}.` : '',
    stage ? `Giai đoạn ưu tiên: ${stage}.` : '',
    ticket ? `Quy mô ticket tham khảo: ${ticket}.` : '',
    'Tên, tổ chức và thông tin liên hệ chỉ lưu cho admin xác thực và chỉ mở sau khi kết nối được duyệt.'
  ].filter(Boolean).join(' ');
}
