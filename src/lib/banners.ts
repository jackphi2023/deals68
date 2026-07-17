import { supabase } from './supabase';
import type { Lang } from './i18n';

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

export async function listSiteBanners(
  placement: BannerPlacement,
  lang: Lang,
  admin = false,
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
      .lte('starts_at', today)
      .or(`ends_at.is.null,ends_at.gte.${today}`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const filtered = ((data || []) as SiteBanner[]).filter(
    (row) => admin || bannerMatchesLang(row, lang),
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
  const safeName = file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  );
  const path = `${placement}/${variant}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('site-banners')
    .upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
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

export async function uploadInvestorCoverImage(
  file: File,
  investorId: string,
) {
  const allowedTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  if (!allowedTypes.has(file.type)) {
    throw new Error('Cover chỉ hỗ trợ JPG, PNG hoặc WebP.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Ảnh cover phải nhỏ hơn hoặc bằng 10 MB.');
  }

  const safeInvestorId = String(investorId).replace(
    /[^a-zA-Z0-9_-]/g,
    '',
  );
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path =
    `investor-covers/${safeInvestorId}/` +
    `${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('site-banners')
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: '31536000',
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('site-banners')
    .getPublicUrl(path);

  return { path, publicUrl: data.publicUrl };
}
