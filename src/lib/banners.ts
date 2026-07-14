import { supabase } from './supabase';
import type { Lang } from './i18n';

export type BannerPlacement =
  | 'home_hero'
  | 'home_promotion'
  | 'listing_promotion';

export type BannerLangMode = 'vi' | 'en' | 'both';
export type BannerImageVariant = 'desktop' | 'mobile';

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
