import { listInvestors } from './data';
import { cachedPublicQuery, invalidatePublicQueryCache } from './publicQueryCache';
import {
  approvedInvestorCountries,
  approvedInvestorDealTypes,
  approvedInvestorSectors,
  approvedInvestorStages,
  approvedInvestorTypes,
  normalizeInvestorDealTypes,
  normalizeInvestorStage,
  normalizeInvestorType,
} from './investorCriteria';
import { industryKeyFromLabel } from './industryTaxonomy';

const MAX_CANONICAL_INVESTOR_ROWS = 2000;
const CANONICAL_INVESTOR_CACHE_KEY = 'public:investors:canonical';
const CANONICAL_INVESTOR_CACHE_TTL_MS = 30_000;

type InvestorListingFilters = {
  limit?: number;
  offset?: number;
  type?: string;
  country?: string;
  industry?: string;
  stage?: string;
  dealType?: string;
  minTicket?: string | number;
  maxTicket?: string | number;
  search?: string;
  q?: string;
  sort?: string;
};

function searchableText(row: Record<string, any>) {
  return [
    row.code,
    row.title_vi,
    row.title_en,
    row.desc_vi,
    row.desc_en,
    row.type,
    row.stage,
    row.country,
    row.country_iso2,
    ...approvedInvestorTypes(row),
    ...approvedInvestorStages(row),
    ...approvedInvestorSectors(row),
    ...approvedInvestorDealTypes(row),
    ...approvedInvestorCountries(row),
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
}

function matchesCanonicalInvestorFilters(
  row: Record<string, any>,
  filters: InvestorListingFilters,
) {
  if (filters.type) {
    const wanted = normalizeInvestorType(filters.type);
    if (wanted && !approvedInvestorTypes(row).includes(wanted)) return false;
  }

  if (filters.stage) {
    const wanted = normalizeInvestorStage(filters.stage);
    if (wanted && !approvedInvestorStages(row).includes(wanted)) return false;
  }

  if (filters.dealType) {
    const wanted = normalizeInvestorDealTypes([filters.dealType])[0];
    if (wanted && !approvedInvestorDealTypes(row).includes(wanted)) return false;
  }

  if (filters.industry) {
    const wanted = industryKeyFromLabel(filters.industry);
    if (wanted && !approvedInvestorSectors(row).includes(wanted)) return false;
  }

  if (filters.country) {
    const wanted = String(filters.country).trim().toUpperCase();
    if (wanted && !approvedInvestorCountries(row).includes(wanted)) return false;
  }

  const keyword = String(filters.search || filters.q || '')
    .trim()
    .toLowerCase();
  if (keyword && !searchableText(row).includes(keyword)) return false;

  return true;
}

function canonicalInvestorSource(filters: InvestorListingFilters) {
  const minTicket = String(filters.minTicket ?? '');
  const maxTicket = String(filters.maxTicket ?? '');
  const sort = String(filters.sort || 'ranking');
  const key = `${CANONICAL_INVESTOR_CACHE_KEY}:${minTicket}:${maxTicket}:${sort}`;

  return cachedPublicQuery(
    key,
    () => listInvestors({
      limit: MAX_CANONICAL_INVESTOR_ROWS,
      offset: 0,
      minTicket: filters.minTicket,
      maxTicket: filters.maxTicket,
      sort: filters.sort,
    }),
    CANONICAL_INVESTOR_CACHE_TTL_MS,
  );
}

export function invalidateCanonicalInvestorCache() {
  invalidatePublicQueryCache(CANONICAL_INVESTOR_CACHE_KEY);
}

export async function listCanonicalInvestors(
  filters: InvestorListingFilters = {},
) {
  const rows = await canonicalInvestorSource(filters);
  const filtered = rows.filter((row) =>
    matchesCanonicalInvestorFilters(row, filters),
  );
  const offset = Math.max(0, Number(filters.offset || 0));
  const limit = Math.max(1, Number(filters.limit || 24));

  return {
    rows: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export function investorListingFilterMatches(
  row: Record<string, any>,
  filters: InvestorListingFilters,
) {
  return matchesCanonicalInvestorFilters(row, filters);
}
