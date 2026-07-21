type ImageOptimizationOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  minBytes?: number;
};

const OPTIMIZABLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function webpName(name: string) {
  const clean = String(name || 'image').replace(/\.[^.]+$/, '');
  return `${clean || 'image'}.webp`;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });
}

export async function optimizeImageBlob(
  input: Blob,
  options: ImageOptimizationOptions,
): Promise<Blob> {
  const minBytes = Math.max(0, options.minBytes ?? 180_000);
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function' ||
    !OPTIMIZABLE_IMAGE_TYPES.has(input.type) ||
    input.size < minBytes
  ) {
    return input;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(input);
    const scale = Math.min(
      1,
      options.maxWidth / bitmap.width,
      options.maxHeight / bitmap.height,
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return input;
    context.drawImage(bitmap, 0, 0, width, height);
    const output = await canvasBlob(
      canvas,
      Math.max(0.72, Math.min(0.95, options.quality ?? 0.88)),
    );
    if (!output || output.size >= input.size * 0.96) return input;
    return output;
  } catch {
    return input;
  } finally {
    bitmap?.close();
  }
}

export async function optimizeImageForUpload(
  file: File,
  options: ImageOptimizationOptions,
): Promise<File> {
  const optimized = await optimizeImageBlob(file, options);
  if (optimized === file) return file;
  return new File([optimized], webpName(file.name), {
    type: optimized.type || 'image/webp',
    lastModified: file.lastModified || Date.now(),
  });
}
