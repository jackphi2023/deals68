import {
  countBusinesses,
  countInvestors,
  listHomepageBusinesses,
  listInvestors,
} from './data';
import {
  getPublicDealValueSummary,
  type PublicDealValueSummary,
} from './publicMetrics';
import { cachedPublicQuery, invalidatePublicQueryCache } from './publicQueryCache';

const HOME_PUBLIC_DATA_CACHE_KEY = 'public:home:payload:v1';
const HOME_PUBLIC_DATA_CACHE_TTL_MS = 30_000;

export type HomePublicData = {
  businessCount: number | null;
  investorCount: number | null;
  dealValue: PublicDealValueSummary | null;
  businesses: any[];
  investors: any[];
};

async function fetchHomePublicData(): Promise<HomePublicData> {
  const [businessCount, investorCount, dealValue, businesses, investors] = await Promise.all([
    countBusinesses().catch(() => null),
    countInvestors().catch(() => null),
    getPublicDealValueSummary().catch(() => null),
    listHomepageBusinesses(6).catch(() => []),
    listInvestors({ limit: 80 }).catch(() => []),
  ]);

  return {
    businessCount,
    investorCount,
    dealValue,
    businesses: businesses || [],
    investors: investors || [],
  };
}

export function loadHomePublicData(): Promise<HomePublicData> {
  return cachedPublicQuery(
    HOME_PUBLIC_DATA_CACHE_KEY,
    fetchHomePublicData,
    HOME_PUBLIC_DATA_CACHE_TTL_MS,
  );
}

export function invalidateHomePublicData() {
  invalidatePublicQueryCache(HOME_PUBLIC_DATA_CACHE_KEY);
}
