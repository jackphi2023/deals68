import {
  countBusinesses,
  listHomepageBusinesses,
  listInvestors,
} from './data';
import {
  getPublicDealValueSummary,
  type PublicDealValueSummary,
} from './publicMetrics';
import { cachedPublicQuery, invalidatePublicQueryCache } from './publicQueryCache';
import { supabase } from './supabase';
import { canViewInvestorMarketplace } from './investorAccess';

const HOME_PUBLIC_DATA_CACHE_KEY = 'public:home:payload:v2';
const HOME_PUBLIC_DATA_CACHE_TTL_MS = 30_000;

export type HomePublicData = {
  businessCount: number | null;
  investorCount: number | null;
  dealValue: PublicDealValueSummary | null;
  businesses: any[];
  investors: any[];
};

type InvestorViewer = {
  cacheKey: string;
  canView: boolean;
};

async function resolveInvestorViewer(): Promise<InvestorViewer> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { cacheKey: 'guest', canView: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return {
    cacheKey: `viewer:${userId}`,
    canView: canViewInvestorMarketplace(profile?.role),
  };
}

async function getPublicInvestorCount(): Promise<number | null> {
  const { data, error } = await supabase.rpc('d68_get_public_investor_count');
  if (error) throw error;
  const count = Number(data);
  return Number.isFinite(count) ? count : null;
}

async function fetchHomePublicData(canViewInvestors: boolean): Promise<HomePublicData> {
  const [businessCount, investorCount, dealValue, businesses, investors] = await Promise.all([
    countBusinesses().catch(() => null),
    getPublicInvestorCount().catch(() => null),
    getPublicDealValueSummary().catch(() => null),
    listHomepageBusinesses(6).catch(() => []),
    canViewInvestors ? listInvestors({ limit: 80 }).catch(() => []) : Promise.resolve([]),
  ]);

  return {
    businessCount,
    investorCount,
    dealValue,
    businesses: businesses || [],
    investors: investors || [],
  };
}

export async function loadHomePublicData(): Promise<HomePublicData> {
  const viewer = await resolveInvestorViewer().catch(() => ({ cacheKey: 'guest', canView: false }));
  return cachedPublicQuery(
    `${HOME_PUBLIC_DATA_CACHE_KEY}:${viewer.cacheKey}`,
    () => fetchHomePublicData(viewer.canView),
    HOME_PUBLIC_DATA_CACHE_TTL_MS,
  );
}

export function invalidateHomePublicData() {
  invalidatePublicQueryCache(HOME_PUBLIC_DATA_CACHE_KEY);
}
