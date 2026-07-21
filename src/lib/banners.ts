import { supabase } from './supabase';
import type { Lang } from './i18n';
import { optimizeImageForUpload } from './imageUploadOptimization';
import { cachedPublicQuery, invalidatePublicQueryCache } from './publicQueryCache';

export type BannerPlacement =
  | 'home_hero'
  | 'home_promotion'
  | 'listing_promotion'
  | 'investor_cover_default';

export type BannerLangMode = 'vi' | 'en' | 'both';
export type BannerImageVariant = 'desktop' | 'mobile';
export type InvestorCoverSource = 'investor' | 'site_banner' | 'fallback';

export const INVESTOR_COVER_FALLBACK =
  '/assets/investor-cover-default.svg';

const PUBLIC_BANNER_CACHE_PREFIX = 'public:banners:';
const PUBLIC_BANNER_CACHE_TTL_MS = 30_000;

export type SiteBanner = {
  id: string;
  placement: BannerPlacement;
  title?: string | null;
  image_url: string;
  image_path?: string | null;
  mobile_image_url?: string | null;
  mobile_image_path?: string | null;
  focal_x?: number | null;
  focal_y?: number | null;
  mobile_focal_x?: number | null;
  mobile_focal_y?: number | null;
  link_url?: string | null;
  sort_order: number;
  lang_mode: BannerLangMode;
  starts_at?: string | null;
  ends_at?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ResolvedInvestorCover = {
  url: string;
  source: InvestorCoverSource;
  banner: SiteBanner | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function cleanUrl(value?: string | null) {
  return String(value || '').trim();
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bannerSlotKey(row: SiteBanner) {
  return `${row.placement}:${Number(row.sort_order || 1)}`;
}

export function bannerMatchesLang(
  row: SiteBanner,
  lang: Lang,
) {
  return row.lang_mode === 'both' || row.lang_mode === lang;
}

export function bannerIsActive(row: SiteBanner) {
  const today = todayIso();

  return (
    row.active !== false &&
    (!row.starts_at || row.starts_at <= today) &&
    (!row.ends_at || row.ends_at >= today)
  );
}

async function fetchSiteBanners(
  placement: BannerPlacement,
  lang: Lang,
  admin: boolean,
): Promise<SiteBanner[]> {
  let q: any = supabase
    .from('site_banners')
    .select('*')
    .eq('placement', placement)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (!admin) {
    const today = todayIso();
    q = q
      .eq('active', true)
      .or(`starts_at.is.null,starts_at.lte.${today}`)
      .or(`ends_at.is.null,ends_at.gte.${today}`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const filtered = ((data || []) as SiteBanner[]).filter((row) =>
    admin
      ? true
      : bannerMatchesLang(row, lang) && bannerIsActive(row),
  );

  if (admin) return filtered;

  const seen = new Set<string>();
  return filtered.filter((row) => {
    const key = bannerSlotKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function invalidateSiteBannerCache(placement?: BannerPlacement) {
  invalidatePublicQueryCache(
    placement
      ? `${PUBLIC_BANNER_CACHE_PREFIX}${placement}:`
      : PUBLIC_BANNER_CACHE_PREFIX,
  );
}

export async function listSiteBanners(
  placement: BannerPlacement,
  lang: Lang,
  admin = false,
): Promise<SiteBanner[]> {
  if (admin) return fetchSiteBanners(placement, lang, true);

  return cachedPublicQuery(
    `${PUBLIC_BANNER_CACHE_PREFIX}${placement}:${lang}:${todayIso()}`,
    () => fetchSiteBanners(placement, lang, false),
    PUBLIC_BANNER_CACHE_TTL_MS,
  );
}

export function investorApprovedCoverUrl(investor: unknown) {
  const row = objectOf(investor);
  const criteria = objectOf(row.criteria);

  return cleanUrl(
    (criteria.cover_image_url as string | null | undefined) ||
      (criteria.coverImageUrl as string | null | undefined) ||
      (row.cover_image_url as string | null | undefined) ||
      (row.hero_image_url as string | null | undefined),
  );
}

export async function getActiveInvestorDefaultCover(
  lang: Lang,
): Promise<SiteBanner | null> {
  const rows = await listSiteBanners(
    'investor_cover_default',
    lang,
  );

  return rows[0] || null;
}

export function resolveInvestorCover(
  investor: unknown,
  defaultBanner?: SiteBanner | string | null,
  fallback = INVESTOR_COVER_FALLBACK,
): ResolvedInvestorCover {
  const approved = investorApprovedCoverUrl(investor);
  if (approved) {
    return {
      url: approved,
      source: 'investor',
      banner: null,
    };
  }

  const banner =
    defaultBanner && typeof defaultBanner === 'object'
      ? defaultBanner
      : null;
  const defaultUrl = cleanUrl(
    typeof defaultBanner === 'string'
      ? defaultBanner
      : banner?.image_url,
  );

  if (defaultUrl) {
    return {
      url: defaultUrl,
      source: 'site_banner',
      banner,
    };
  }

  return {
    url: fallback,
    source: 'fallback',
    banner: null,
  };
}

export async function uploadSiteBannerImage(
  file: File,
  placement: BannerPlacement,
  variant: BannerImageVariant = 'desktop',
) {
  const optimizedFile = await optimizeImageForUpload(file, {
    maxWidth: variant === 'mobile' ? 900 : 1920,
    maxHeight: variant === 'mobile' ? 1800 : 1200,
    quality: 0.9,
    minBytes: 180_000,
  });
  const safeName = optimizedFile.name.replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  );
  const path = `${placement}/${variant}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('site-banners')
    .upload(path, optimizedFile, {
      upsert: false,
      contentType: optimizedFile.type || 'application/octet-stream',
      cacheControl: '31536000',
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('site-banners')
    .getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}
