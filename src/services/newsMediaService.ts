import { supabase } from '../lib/supabase';

export const NEWS_MEDIA_BUCKET = 'news-media';
export const NEWS_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const NEWS_MEDIA_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type NewsMediaUpload = {
  path: string;
  publicUrl: string;
};

function fileExtension(file: File) {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return byType[file.type] || String(file.name || '').split('.').pop()?.toLowerCase() || 'bin';
}

function safeBaseName(value: string) {
  return String(value || 'news-image')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'news-image';
}

function uploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validateNewsImageFile(file: File) {
  if (!NEWS_MEDIA_ALLOWED_TYPES.has(file.type)) {
    throw new Error('Ảnh News chỉ hỗ trợ JPEG, PNG hoặc WebP.');
  }
  if (file.size <= 0 || file.size > NEWS_MEDIA_MAX_BYTES) {
    throw new Error('Ảnh News phải có dung lượng lớn hơn 0 và không vượt quá 10 MB.');
  }
}

export async function adminUploadNewsFeaturedImage(file: File): Promise<NewsMediaUpload> {
  validateNewsImageFile(file);
  const extension = fileExtension(file);
  const datePrefix = new Date().toISOString().slice(0, 10);
  const path = `featured/${datePrefix}/${safeBaseName(file.name)}-${uploadId()}.${extension}`;

  const { error } = await supabase.storage
    .from(NEWS_MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(NEWS_MEDIA_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error('Không tạo được public URL cho ảnh News.');

  return { path, publicUrl: data.publicUrl };
}
