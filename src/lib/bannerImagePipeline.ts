import { supabase } from './supabase';
import type { BannerImageVariant, BannerPlacement } from './banners';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export type BannerImageMeta = {
  width: number;
  height: number;
  bytes: number;
  ratio: number;
  mimeType: string;
  optimized: boolean;
  outputBytes: number;
  warnings: string[];
};

export type PreparedBannerImage = {
  file: File;
  previewUrl: string;
  meta: BannerImageMeta;
};

type ImageRules = {
  targetRatio: number;
  ratioTolerance: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  label: string;
  acceptedRatioMin?: number;
  acceptedRatioMax?: number;
};

function rulesFor(placement: BannerPlacement, variant: BannerImageVariant): ImageRules {
  if (placement === 'home_hero' && variant === 'mobile') {
    return {
      targetRatio: 3 / 4,
      ratioTolerance: 0.12,
      minWidth: 720,
      minHeight: 960,
      maxWidth: 900,
      maxHeight: 1200,
      label: 'Hero mobile 900×1200',
    };
  }
  if (placement === 'home_hero') {
    return {
      targetRatio: 8 / 3,
      ratioTolerance: 0.25,
      minWidth: 1200,
      minHeight: 450,
      maxWidth: 1920,
      maxHeight: 720,
      label: 'Hero desktop 1600×600',
    };
  }
  if (placement === 'investor_cover_default') {
    return {
      targetRatio: 20 / 7,
      ratioTolerance: 0.28,
      minWidth: 1200,
      minHeight: 420,
      maxWidth: 1920,
      maxHeight: 672,
      label: 'Cover 1600×560',
    };
  }
  return {
    targetRatio: 9 / 2,
    ratioTolerance: 0.2,
    acceptedRatioMin: 3.6,
    acceptedRatioMax: 5.4,
    minWidth: 1200,
    minHeight: 220,
    maxWidth: 1920,
    maxHeight: 480,
    label: 'Promotion siêu ngang 4:1–5:1',
  };
}

function safeBaseName(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || 'banner';
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;
  await image.decode();
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareBannerImage(
  sourceFile: File,
  placement: BannerPlacement,
  variant: BannerImageVariant = 'desktop',
): Promise<PreparedBannerImage> {
  if (!ALLOWED_TYPES.has(sourceFile.type)) {
    throw new Error('Banner chỉ hỗ trợ JPG, PNG hoặc WebP.');
  }
  if (sourceFile.size > MAX_SOURCE_BYTES) {
    throw new Error('Ảnh nguồn phải nhỏ hơn hoặc bằng 15 MB.');
  }

  const rules = rulesFor(placement, variant);
  const decoded = await loadImage(sourceFile);
  const { width, height } = decoded;
  if (!width || !height) {
    decoded.cleanup();
    throw new Error('Không đọc được kích thước ảnh.');
  }

  const ratio = width / height;
  const warnings: string[] = [];
  const ratioDelta = Math.abs(ratio - rules.targetRatio) / rules.targetRatio;
  const ratioOutsideAcceptedRange =
    rules.acceptedRatioMin !== undefined &&
    rules.acceptedRatioMax !== undefined
      ? ratio < rules.acceptedRatioMin || ratio > rules.acceptedRatioMax
      : ratioDelta > rules.ratioTolerance;
  if (ratioOutsideAcceptedRange) {
    warnings.push(
      `Tỷ lệ ${width}×${height} (${ratio.toFixed(2)}:1) nằm ngoài ${rules.label}; ảnh vẫn được giữ nguyên tỷ lệ và hiển thị toàn bộ.`,
    );
  }
  if (width < rules.minWidth || height < rules.minHeight) {
    warnings.push(`Ảnh ${width}×${height} nhỏ hơn mức khuyến nghị ${rules.minWidth}×${rules.minHeight}; có thể giảm độ nét trên màn hình lớn.`);
  }

  const scale = Math.min(1, rules.maxWidth / width, rules.maxHeight / height);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d', { alpha: true });

  let outputFile = sourceFile;
  let optimized = false;
  if (context) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, 0, 0, outputWidth, outputHeight);
    const blob = await canvasBlob(canvas, 'image/webp', 0.84);
    if (blob && blob.size > 0 && (blob.size < sourceFile.size || scale < 1)) {
      outputFile = new File([blob], `${safeBaseName(sourceFile.name)}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });
      optimized = true;
    }
  }
  decoded.cleanup();

  return {
    file: outputFile,
    previewUrl: URL.createObjectURL(outputFile),
    meta: {
      width,
      height,
      bytes: sourceFile.size,
      ratio,
      mimeType: sourceFile.type,
      optimized,
      outputBytes: outputFile.size,
      warnings,
    },
  };
}

export async function uploadPreparedBannerImage(
  prepared: PreparedBannerImage,
  placement: BannerPlacement,
  variant: BannerImageVariant = 'desktop',
) {
  const safeName = prepared.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${placement}/${variant}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('site-banners').upload(path, prepared.file, {
    upsert: false,
    contentType: prepared.file.type || 'application/octet-stream',
    cacheControl: '31536000',
  });
  if (error) throw error;
  const { data } = supabase.storage.from('site-banners').getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export function formatBannerBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
