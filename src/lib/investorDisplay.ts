import type { Lang } from './i18n';
import { investorTargetCountries } from './data';
import {
  approvedInvestorAppetite,
  approvedInvestorDealTypes,
  approvedInvestorSectors,
  approvedInvestorStages,
  approvedInvestorTypes,
} from './investorCriteria';
import {
  formatMoneyForLang,
  labelCountry,
  labelDealType,
  labelIndustry,
  labelInvestorType,
  labelStage,
  T,
} from './labels';

type AnyRow = Record<string, any>;

function cleanPublicText(value: any) {
  return String(value || '')
    .replace(
      /Tên, tổ chức và thông tin liên hệ chỉ lưu cho admin xác thực và chỉ mở sau khi kết nối được duyệt\./gi,
      '',
    )
    .replace(
      /Name, organization and contact details are kept private for admin verification and are only shared after an approved connection\./gi,
      '',
    )
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function investorTicketLabel(lang: Lang, row: AnyRow) {
  const min = Number(row?.ticket_min ?? row?.ticketMin ?? 0);
  const max = Number(row?.ticket_max ?? row?.ticketMax ?? 0);
  if (!min && !max) return '';
  if (min && max) {
    return `${formatMoneyForLang(min, 'USD', lang)} – ${formatMoneyForLang(
      max,
      'USD',
      lang,
    )}`;
  }
  return max
    ? `≤ ${formatMoneyForLang(max, 'USD', lang)}`
    : `≥ ${formatMoneyForLang(min, 'USD', lang)}`;
}

export function investorPublicTypeLabels(row: AnyRow, lang: Lang) {
  return unique(
    approvedInvestorTypes(row).map((value) => labelInvestorType(value, lang)),
  );
}

export function investorPublicStageLabels(row: AnyRow, lang: Lang) {
  return unique(
    approvedInvestorStages(row).map((value) => labelStage(value, lang)),
  );
}

export function investorPublicIndustryLabels(row: AnyRow, lang: Lang) {
  return unique(
    approvedInvestorSectors(row).map((value) => labelIndustry(value, lang)),
  );
}

export function investorPublicDealTypeLabels(row: AnyRow, lang: Lang) {
  return unique(
    approvedInvestorDealTypes(row).map((value) =>
      labelDealType(value, lang, true),
    ),
  );
}

export function investorPublicTitle(row: AnyRow, lang: Lang) {
  const editedTitle = cleanPublicText(
    lang === 'en'
      ? row?.title_en || row?.title_vi
      : row?.title_vi || row?.title_en,
  );

  if (editedTitle) return editedTitle;

  const industries = investorPublicIndustryLabels(row, lang).slice(0, 2);
  const types = investorPublicTypeLabels(row, lang).slice(0, 2);
  const targets = investorTargetCountries(row)
    .slice(0, 2)
    .map((value) => labelCountry(value, lang));
  const typeText =
    types.join(' / ') || T(lang, 'Nhà đầu tư', 'Investor');
  const sectorText =
    industries.join(', ') || T(lang, 'đa lĩnh vực', 'multiple sectors');
  const targetText = targets.length ? ` (${targets.join(', ')})` : '';

  return lang === 'en'
    ? `${typeText} interested in ${sectorText}${targetText}`
    : `${typeText} quan tâm ${sectorText}${targetText}`;
}

export function investorPublicDescription(row: AnyRow, lang: Lang) {
  const primary = cleanPublicText(lang === 'en' ? row?.desc_en : row?.desc_vi);
  const fallback = cleanPublicText(lang === 'en' ? row?.desc_vi : row?.desc_en);
  const edited = primary || fallback;
  if (edited) return edited;

  const industries = investorPublicIndustryLabels(row, lang).slice(0, 4);
  const types = investorPublicTypeLabels(row, lang);
  const targets = investorTargetCountries(row)
    .slice(0, 6)
    .map((value) => labelCountry(value, lang));
  const stages = investorPublicStageLabels(row, lang);
  const dealTypes = investorPublicDealTypeLabels(row, lang);
  const ticket = investorTicketLabel(lang, row);
  const appetite = approvedInvestorAppetite(row, lang);
  const typeText =
    types.join(' / ') || T(lang, 'Nhà đầu tư', 'Investor');

  if (lang === 'en') {
    return [
      `An anonymous ${typeText.toLowerCase()} profile interested in ${
        industries.join(', ') || 'multiple sectors'
      }.`,
      targets.length ? `Target investment markets: ${targets.join('; ')}.` : '',
      stages.length ? `Preferred stages: ${stages.join('; ')}.` : '',
      dealTypes.length ? `Preferred deal types: ${dealTypes.join('; ')}.` : '',
      ticket ? `Indicative ticket size: ${ticket}.` : '',
      appetite ? `Investment appetite: ${appetite}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    `Hồ sơ ${typeText.toLowerCase()} ẩn danh quan tâm ${
      industries.join(', ') || 'đa lĩnh vực'
    }.`,
    targets.length
      ? `Thị trường quan tâm đầu tư: ${targets.join('; ')}.`
      : '',
    stages.length ? `Giai đoạn phù hợp: ${stages.join('; ')}.` : '',
    dealTypes.length
      ? `Loại giao dịch quan tâm: ${dealTypes.join('; ')}.`
      : '',
    ticket ? `Quy mô đầu tư tham khảo: ${ticket}.` : '',
    appetite ? `Khẩu vị đầu tư: ${appetite}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
