import type { Lang } from './i18n';
import { supabase } from './supabase';

export const INVESTOR_COVER_BUCKET = 'site-banners';
export const INVESTOR_COVER_PLACEMENT = 'investor_cover_default';
export const INVESTOR_COVER_WIDTH = 1600;
export const INVESTOR_COVER_HEIGHT = 560;
export const INVESTOR_COVER_MAX_BYTES = 10 * 1024 * 1024;
export const INVESTOR_APPETITE_MAX_LENGTH = 5000;
export const DEFAULT_INVESTOR_COVER = '/assets/investor-cover-default.svg';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type AnyRow = Record<string, any>;

export type InvestorCoverBanner = {
  id: string;
  image_url: string;
  image_path?: string | null;
  title?: string | null;
  lang_mode?: 'vi' | 'en' | 'both' | null;
  active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CoverMutationResult = {
  publicUrl?: string | null;
  path?: string | null;
  oldPath?: string | null;
  cleanupWarning?: string;
};

function objectOf(value: unknown): AnyRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as AnyRow)
    : {};
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(name: string) {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized || 'investor-cover.webp';
}

function uniqueToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bannerMatchesLanguage(row: InvestorCoverBanner, lang: Lang) {
  return !row.lang_mode || row.lang_mode === 'both' || row.lang_mode === lang;
}

function bannerIsPubliclyActive(row: InvestorCoverBanner) {
  const today = todayIso();
  return (
    row.active !== false &&
    (!row.starts_at || row.starts_at <= today) &&
    (!row.ends_at || row.ends_at >= today)
  );
}

export function normalizeInvestorCoverBanner(
  value: unknown,
): InvestorCoverBanner | null {
  const row = objectOf(value);
  const id = clean(row.id);
  const imageUrl = clean(row.image_url);
  if (!id || !imageUrl) return null;

  return {
    id,
    image_url: imageUrl,
    image_path: clean(row.image_path) || null,
    title: clean(row.title) || null,
    lang_mode:
      row.lang_mode === 'vi' ||
      row.lang_mode === 'en' ||
      row.lang_mode === 'both'
        ? row.lang_mode
        : null,
    active: row.active !== false,
    starts_at: clean(row.starts_at) || null,
    ends_at: clean(row.ends_at) || null,
    created_at: clean(row.created_at) || null,
    updated_at: clean(row.updated_at) || null,
  };
}

export async function getDefaultInvestorCover(
  lang: Lang,
  admin = false,
): Promise<InvestorCoverBanner | null> {
  const { data, error } = await supabase
    .from('site_banners')
    .select(
      'id,image_url,image_path,title,lang_mode,active,' +
        'starts_at,ends_at,created_at,updated_at',
    )
    .eq('placement', INVESTOR_COVER_PLACEMENT)
    .order('active', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  const rows = (Array.isArray(data) ? data : [])
    .map(normalizeInvestorCoverBanner)
    .filter((row): row is InvestorCoverBanner => Boolean(row));

  if (admin) return rows[0] || null;

  return (
    rows.find(
      (row) =>
        bannerMatchesLanguage(row, lang) && bannerIsPubliclyActive(row),
    ) || null
  );
}

export function approvedInvestorAppetite(investor: unknown) {
  const criteria = objectOf(objectOf(investor).criteria);
  return clean(criteria.investment_appetite);
}

export function pendingInvestorAppetite(investor: unknown) {
  const privacy = objectOf(objectOf(investor).privacy);
  const pending = objectOf(privacy.pending_profile_changes);
  const criteria = objectOf(pending.criteria);
  return clean(criteria.investment_appetite);
}

export function investorCoverUrl(
  investor: unknown,
  defaultCover?: InvestorCoverBanner | null,
) {
  const criteria = objectOf(objectOf(investor).criteria);
  return (
    clean(criteria.cover_image_url) ||
    clean(defaultCover?.image_url) ||
    DEFAULT_INVESTOR_COVER
  );
}

async function imageDimensions(file: File) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    const result = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  }

  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const result = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được kích thước ảnh.'));
    };
    image.src = url;
  });
}

export async function validateInvestorCoverFile(file: File) {
  if (!file?.name) throw new Error('Vui lòng chọn ảnh Cover.');
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.');
  }
  if (file.size > INVESTOR_COVER_MAX_BYTES) {
    throw new Error('Ảnh Cover không được vượt quá 10 MB.');
  }

  const dimensions = await imageDimensions(file);
  if (
    dimensions.width !== INVESTOR_COVER_WIDTH ||
    dimensions.height !== INVESTOR_COVER_HEIGHT
  ) {
    throw new Error(
      `Ảnh Cover phải chính xác ${INVESTOR_COVER_WIDTH}×` +
        `${INVESTOR_COVER_HEIGHT}px. Ảnh đã chọn là ` +
        `${dimensions.width}×${dimensions.height}px.`,
    );
  }

  return dimensions;
}

async function uploadInvestorCover(file: File, ownerKey: string) {
  await validateInvestorCoverFile(file);
  const path =
    `investor_cover/${ownerKey}/${uniqueToken()}-` + safeFileName(file.name);

  const { error } = await supabase.storage
    .from(INVESTOR_COVER_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: '3600',
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(INVESTOR_COVER_BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: data.publicUrl };
}

export async function removeInvestorCoverPath(path?: string | null) {
  const cleanPath = clean(path);
  if (!cleanPath) return;
  if (!cleanPath.startsWith('investor_cover/')) {
    throw new Error('Từ chối xóa file ngoài thư mục Investor Cover.');
  }

  const { error } = await supabase.storage
    .from(INVESTOR_COVER_BUCKET)
    .remove([cleanPath]);
  if (error) throw error;
}

async function cleanupOldPath(oldPath?: string | null, activePath?: string | null) {
  const oldValue = clean(oldPath);
  if (!oldValue || oldValue === clean(activePath)) return '';

  try {
    await removeInvestorCoverPath(oldValue);
    return '';
  } catch (error: any) {
    return (
      error?.message ||
      'Đã lưu dữ liệu mới nhưng chưa dọn được ảnh cũ trong Storage.'
    );
  }
}

export async function replaceDefaultInvestorCover(
  file: File,
): Promise<CoverMutationResult> {
  const uploaded = await uploadInvestorCover(file, 'default');
  let committed = false;

  try {
    const { data, error } = await supabase.rpc(
      'admin_set_default_investor_cover',
      {
        cover_url: uploaded.publicUrl,
        cover_path: uploaded.path,
      },
    );
    if (error) throw error;
    committed = true;

    const result = objectOf(data);
    const oldPath = clean(result.old_path) || null;
    const cleanupWarning = await cleanupOldPath(oldPath, uploaded.path);

    return {
      publicUrl: uploaded.publicUrl,
      path: uploaded.path,
      oldPath,
      cleanupWarning,
    };
  } catch (error) {
    if (!committed) {
      try {
        await removeInvestorCoverPath(uploaded.path);
      } catch {
        // Best effort: database was not committed, so the new object is orphaned.
      }
    }
    throw error;
  }
}

export async function replaceInvestorCover(
  investorId: string,
  file: File,
): Promise<CoverMutationResult> {
  const id = clean(investorId);
  if (!id) throw new Error('Thiếu Investor ID.');

  const uploaded = await uploadInvestorCover(file, id);
  let committed = false;

  try {
    const { data, error } = await supabase.rpc('admin_set_investor_cover', {
      investor_uuid: id,
      cover_url: uploaded.publicUrl,
      cover_path: uploaded.path,
    });
    if (error) throw error;
    committed = true;

    const result = objectOf(data);
    const oldPath = clean(result.old_path) || null;
    const cleanupWarning = await cleanupOldPath(oldPath, uploaded.path);

    return {
      publicUrl: uploaded.publicUrl,
      path: uploaded.path,
      oldPath,
      cleanupWarning,
    };
  } catch (error) {
    if (!committed) {
      try {
        await removeInvestorCoverPath(uploaded.path);
      } catch {
        // Best effort cleanup after a failed RPC.
      }
    }
    throw error;
  }
}

export async function clearInvestorCover(
  investorId: string,
): Promise<CoverMutationResult> {
  const id = clean(investorId);
  if (!id) throw new Error('Thiếu Investor ID.');

  const { data, error } = await supabase.rpc('admin_set_investor_cover', {
    investor_uuid: id,
    cover_url: null,
    cover_path: null,
  });
  if (error) throw error;

  const result = objectOf(data);
  const oldPath = clean(result.old_path) || null;
  const cleanupWarning = await cleanupOldPath(oldPath, null);
  return { oldPath, cleanupWarning };
}

export async function submitMyInvestorAppetite(value: string) {
  const appetite = clean(value);
  if (appetite.length > INVESTOR_APPETITE_MAX_LENGTH) {
    throw new Error('Khẩu vị đầu tư không được vượt quá 5.000 ký tự.');
  }

  const { data, error } = await supabase.rpc(
    'submit_my_investor_appetite',
    { appetite_text: appetite },
  );
  if (error) throw error;
  return objectOf(data);
}

export async function approveInvestorAppetite(
  investorId: string,
  value: string,
) {
  const id = clean(investorId);
  const appetite = clean(value);
  if (!id) throw new Error('Thiếu Investor ID.');
  if (appetite.length > INVESTOR_APPETITE_MAX_LENGTH) {
    throw new Error('Khẩu vị đầu tư không được vượt quá 5.000 ký tự.');
  }

  const { data, error } = await supabase.rpc(
    'admin_approve_investor_appetite',
    {
      investor_uuid: id,
      appetite_text: appetite,
    },
  );
  if (error) throw error;
  return objectOf(data);
}
