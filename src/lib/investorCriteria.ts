import type { Lang } from './i18n';
import {
  T,
  countryOptions,
  investorDealOptions,
  labelCountry,
  labelDealType,
  labelInvestorType,
  labelStage,
  normalizeInvestorDealForDb,
} from './labels';
import {
  industryKeyFromLabel,
  labelIndustryTaxonomy,
} from './industryTaxonomy';

export const INVESTOR_TYPE_VALUES = [
  'Individual/Angel',
  'VC',
  'PE',
  'Institutional',
  'Corporate/Strategic',
  'Family Office',
  'Lender/Debt',
] as const;

export const INVESTOR_STAGE_VALUES = [
  'Seed',
  'Series A',
  'Growth',
  'Mature',
  'Buyout',
  'Any',
] as const;

export type InvestorTypeValue = (typeof INVESTOR_TYPE_VALUES)[number];
export type InvestorStageValue = (typeof INVESTOR_STAGE_VALUES)[number];

export type CanonicalInvestorCriteria = {
  investorTypes: InvestorTypeValue[];
  stages: InvestorStageValue[];
  sectors: string[];
  dealTypes: string[];
  targetCountries: string[];
  investment_appetite_vi: string;
  investment_appetite_en: string;
};

export type InvestorCriteriaSource = Record<string, any> | null | undefined;

export function investorCriteriaArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value || '')
    .split(/[;,\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueInvestorCriteriaValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizedText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeInvestorType(value: unknown): InvestorTypeValue | '' {
  const raw = normalizedText(value);
  if (!raw) return '';

  if (
    raw === 'vc' ||
    raw.includes('venture capital') ||
    raw.includes('quy dau tu mao hiem')
  ) return 'VC';

  if (
    raw === 'pe' ||
    raw.includes('private equity') ||
    raw.includes('quy dau tu tu nhan')
  ) return 'PE';

  if (
    raw.includes('institutional') ||
    raw.includes('nha dau tu to chuc')
  ) return 'Institutional';

  if (
    raw.includes('corporate') ||
    raw.includes('strategic') ||
    raw.includes('doanh nghiep chien luoc') ||
    raw.includes('nha dau tu chien luoc')
  ) return 'Corporate/Strategic';

  if (
    raw.includes('family office') ||
    raw.includes('van phong gia dinh')
  ) return 'Family Office';

  if (
    raw.includes('lender') ||
    raw.includes('debt') ||
    raw.includes('credit') ||
    raw.includes('cho vay') ||
    raw.includes('tin dung')
  ) return 'Lender/Debt';

  if (
    raw.includes('individual') ||
    raw.includes('angel') ||
    raw.includes('nha dau tu ca nhan')
  ) return 'Individual/Angel';

  return '';
}

export function normalizeInvestorTypes(value: unknown): InvestorTypeValue[] {
  return uniqueInvestorCriteriaValues(
    investorCriteriaArray(value)
      .map(normalizeInvestorType)
      .filter(Boolean) as InvestorTypeValue[],
  ) as InvestorTypeValue[];
}

export function normalizeInvestorStage(value: unknown): InvestorStageValue | '' {
  const raw = normalizedText(value);
  if (!raw) return '';

  if (
    raw === 'any' ||
    raw === 'all' ||
    raw.includes('flexible') ||
    raw.includes('linh hoat')
  ) return 'Any';

  if (raw.includes('buyout') || raw.includes('mua lai')) return 'Buyout';
  if (raw.includes('mature') || raw.includes('truong thanh') || raw.includes('on dinh')) return 'Mature';
  if (raw.includes('growth') || raw.includes('tang truong')) return 'Growth';
  if (raw.includes('series a')) return 'Series A';
  if (raw.includes('seed') || raw.includes('early') || raw.includes('startup')) return 'Seed';

  return '';
}

export function normalizeInvestorStages(value: unknown): InvestorStageValue[] {
  return uniqueInvestorCriteriaValues(
    investorCriteriaArray(value)
      .map(normalizeInvestorStage)
      .filter(Boolean) as InvestorStageValue[],
  ) as InvestorStageValue[];
}

export function normalizeInvestorSectors(value: unknown) {
  return uniqueInvestorCriteriaValues(
    investorCriteriaArray(value)
      .map((item) => industryKeyFromLabel(item))
      .filter(Boolean),
  );
}

export function normalizeInvestorDealTypes(value: unknown) {
  return uniqueInvestorCriteriaValues(
    investorCriteriaArray(value)
      .map((item) => normalizeInvestorDealForDb(item))
      .filter(Boolean),
  );
}

export function normalizeInvestorCountries(value: unknown) {
  const known = new Map<string, string>();
  countryOptions.forEach((item) => {
    known.set(normalizedText(item.iso2), item.iso2);
    known.set(normalizedText(item.vi), item.iso2);
    known.set(normalizedText(item.en), item.iso2);
  });

  return uniqueInvestorCriteriaValues(
    investorCriteriaArray(value)
      .map((item) => {
        const upper = item.trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(upper)) return upper;
        return known.get(normalizedText(item)) || '';
      })
      .filter(Boolean),
  );
}

function sourceCriteria(source: InvestorCriteriaSource) {
  const criteria = source?.criteria;
  return criteria && typeof criteria === 'object' && !Array.isArray(criteria)
    ? criteria
    : {};
}

export function approvedInvestorTypes(source: InvestorCriteriaSource) {
  const criteria = sourceCriteria(source);
  const values = normalizeInvestorTypes([
    ...investorCriteriaArray(criteria.investorTypes),
    ...investorCriteriaArray(source?.type),
  ]);
  return values.length ? values : ['Individual/Angel'] as InvestorTypeValue[];
}

export function approvedInvestorStages(source: InvestorCriteriaSource) {
  const criteria = sourceCriteria(source);
  const values = normalizeInvestorStages([
    ...investorCriteriaArray(criteria.stages),
    ...investorCriteriaArray(criteria.stage),
    ...investorCriteriaArray(source?.stage),
  ]);
  return values.length ? values : ['Any'] as InvestorStageValue[];
}

export function approvedInvestorSectors(source: InvestorCriteriaSource) {
  const criteria = sourceCriteria(source);
  return normalizeInvestorSectors([
    ...investorCriteriaArray(source?.industries),
    ...investorCriteriaArray(criteria.sectors),
  ]);
}

export function approvedInvestorDealTypes(source: InvestorCriteriaSource) {
  const criteria = sourceCriteria(source);
  return normalizeInvestorDealTypes([
    ...investorCriteriaArray(source?.deal_types),
    ...investorCriteriaArray(criteria.dealTypes),
  ]);
}

export function approvedInvestorCountries(source: InvestorCriteriaSource) {
  const criteria = sourceCriteria(source);
  return normalizeInvestorCountries(
    criteria.targetCountries ||
      criteria.preferredCountries ||
      criteria.targetCountriesCache ||
      [],
  );
}

export function approvedInvestorAppetite(source: InvestorCriteriaSource, lang: Lang) {
  const criteria = sourceCriteria(source);
  if (lang === 'en') {
    return String(
      criteria.investment_appetite_en ||
        criteria.investmentAppetiteEn ||
        criteria.investment_appetite ||
        '',
    ).trim();
  }

  return String(
    criteria.investment_appetite_vi ||
      criteria.investmentAppetiteVi ||
      criteria.investment_appetite ||
      '',
  ).trim();
}

export function canonicalInvestorCriteria(
  source: InvestorCriteriaSource,
): CanonicalInvestorCriteria {
  return {
    investorTypes: approvedInvestorTypes(source),
    stages: approvedInvestorStages(source),
    sectors: approvedInvestorSectors(source),
    dealTypes: approvedInvestorDealTypes(source),
    targetCountries: approvedInvestorCountries(source),
    investment_appetite_vi: approvedInvestorAppetite(source, 'vi'),
    investment_appetite_en: approvedInvestorAppetite(source, 'en'),
  };
}

export function investorTypeOptionsCanonical(lang: Lang) {
  return INVESTOR_TYPE_VALUES.map((value) => ({
    value,
    label: labelInvestorType(value, lang),
  }));
}

export function investorStageOptionsCanonical(lang: Lang) {
  return INVESTOR_STAGE_VALUES.map((value) => ({
    value,
    label: labelStage(value, lang),
  }));
}

export function investorDealOptionsCanonical(lang: Lang) {
  return investorDealOptions.map((item) => {
    const value = normalizeInvestorDealForDb(item.en);
    return {
      value,
      label: labelDealType(value, lang, true),
    };
  });
}

export function investorCriteriaLabels(
  source: InvestorCriteriaSource,
  lang: Lang,
) {
  const criteria = canonicalInvestorCriteria(source);
  return {
    investorTypes: criteria.investorTypes.map((value) =>
      labelInvestorType(value, lang),
    ),
    stages: criteria.stages.map((value) => labelStage(value, lang)),
    sectors: criteria.sectors.map((value) =>
      labelIndustryTaxonomy(value, lang),
    ),
    dealTypes: criteria.dealTypes.map((value) =>
      labelDealType(value, lang, true),
    ),
    targetCountries: criteria.targetCountries.map((value) =>
      labelCountry(value, lang),
    ),
    appetite: approvedInvestorAppetite(source, lang),
  };
}

export function investorCriteriaEmptyLabel(lang: Lang) {
  return T(lang, 'Đang cập nhật', 'Updating');
}
