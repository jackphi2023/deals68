import { supabase } from './supabase';

export type BusinessAssetKind = 'file' | 'image';

export const BUSINESS_FILE_BUCKET = 'business-files-private';
export const BUSINESS_IMAGE_PRIVATE_BUCKET = 'business-images-private';
export const BUSINESS_IMAGE_PUBLIC_BUCKET = 'business-images-public';

type Row = Record<string, any>;

function storageStatus(error: any) {
  return Number(error?.statusCode || error?.status || 0);
}

function storageMessage(error: any) {
  return String(error?.message || error || '').toLowerCase();
}

function isStorageNotFound(error: any) {
  const status = storageStatus(error);
  const message = storageMessage(error);
  return (
    status === 404 ||
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('object not found')
  );
}

function isDuplicateStorageError(error: any) {
  const status = storageStatus(error);
  const message = storageMessage(error);
  return (
    status === 409 ||
    message.includes('already exists') ||
    message.includes('duplicate')
  );
}

function safeName(value: any) {
  return String(value || 'image')
    .split('/')
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(-140) || 'image';
}

function imageTargetPath(row: Row, target: 'pending' | 'approved') {
  const businessId = String(row?.business_id || '').trim();
  const imageId = String(row?.id || '').trim();
  if (!businessId || !imageId) {
    throw new Error('Ảnh thiếu Business ID hoặc Image ID.');
  }
  return `${businessId}/${target}/${imageId}-${safeName(row?.image_path)}`;
}

export function businessImageBucket(row: Row) {
  const explicit = String(row?.storage_bucket || '').trim();
  if (
    explicit === BUSINESS_IMAGE_PRIVATE_BUCKET ||
    explicit === BUSINESS_IMAGE_PUBLIC_BUCKET
  ) {
    return explicit;
  }
  return row?.public_url
    ? BUSINESS_IMAGE_PUBLIC_BUCKET
    : BUSINESS_IMAGE_PRIVATE_BUCKET;
}

export function isApprovedPublicBusinessImage(row: Row) {
  return (
    businessImageBucket(row) === BUSINESS_IMAGE_PUBLIC_BUCKET &&
    row?.public_visible === true &&
    row?.is_sanitized === true &&
    String(row?.review_status || '').toLowerCase() === 'approved' &&
    !!String(row?.public_url || '').trim()
  );
}

async function uploadBlob(
  bucket: string,
  path: string,
  blob: Blob,
  allowExisting = false,
) {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: false,
    contentType: blob.type || 'application/octet-stream',
    cacheControl: '3600',
  });
  if (error && !(allowExisting && isDuplicateStorageError(error))) {
    throw error;
  }
}

async function removeObject(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error && !isStorageNotFound(error)) throw error;
}

async function restoreObject(bucket: string, path: string, blob: Blob | null) {
  if (!blob) return;
  try {
    await uploadBlob(bucket, path, blob, true);
  } catch {
    // Best-effort compensation. The original error remains more important.
  }
}

async function moveBusinessImage(
  row: Row,
  targetBucket: string,
  targetFolder: 'pending' | 'approved',
) {
  const imageId = String(row?.id || '').trim();
  const businessId = String(row?.business_id || '').trim();
  const sourcePath = String(row?.image_path || '').trim();
  const sourceBucket = businessImageBucket(row);

  if (!imageId || !businessId || !sourcePath) {
    throw new Error('Ảnh thiếu thông tin Storage để di chuyển.');
  }

  if (sourceBucket === targetBucket) return row;

  const targetPath = imageTargetPath(row, targetFolder);
  const { data: sourceBlob, error: downloadError } = await supabase.storage
    .from(sourceBucket)
    .download(sourcePath);

  if (downloadError || !sourceBlob) {
    throw downloadError || new Error('Không tải được ảnh nguồn từ Storage.');
  }

  await uploadBlob(targetBucket, targetPath, sourceBlob, true);

  try {
    await removeObject(sourceBucket, sourcePath);
  } catch (error) {
    await removeObject(targetBucket, targetPath).catch(() => undefined);
    throw error;
  }

  const publicUrl =
    targetBucket === BUSINESS_IMAGE_PUBLIC_BUCKET
      ? supabase.storage
          .from(BUSINESS_IMAGE_PUBLIC_BUCKET)
          .getPublicUrl(targetPath).data.publicUrl
      : null;

  const { data, error } = await supabase.rpc(
    'finalize_business_image_storage_move',
    {
      image_uuid: imageId,
      expected_bucket: sourceBucket,
      expected_path: sourcePath,
      target_bucket: targetBucket,
      target_path: targetPath,
      target_public_url: publicUrl,
    },
  );

  if (error) {
    await restoreObject(sourceBucket, sourcePath, sourceBlob);
    await removeObject(targetBucket, targetPath).catch(() => undefined);
    throw error;
  }

  return data;
}

export async function ensureBusinessImagePublic(row: Row) {
  if (
    businessImageBucket(row) === BUSINESS_IMAGE_PUBLIC_BUCKET &&
    String(row?.public_url || '').trim()
  ) {
    return row;
  }

  return moveBusinessImage(
    row,
    BUSINESS_IMAGE_PUBLIC_BUCKET,
    'approved',
  );
}

export async function ensureBusinessImagePrivate(row: Row) {
  if (businessImageBucket(row) === BUSINESS_IMAGE_PRIVATE_BUCKET) {
    return row;
  }

  return moveBusinessImage(
    row,
    BUSINESS_IMAGE_PRIVATE_BUCKET,
    'pending',
  );
}

export async function attachBusinessImagePreviewUrls(rows: Row[]) {
  return Promise.all(
    (rows || []).map(async (row) => {
      if (businessImageBucket(row) !== BUSINESS_IMAGE_PRIVATE_BUCKET) {
        return row;
      }

      const path = String(row?.image_path || '').trim();
      if (!path) return row;

      const { data, error } = await supabase.storage
        .from(BUSINESS_IMAGE_PRIVATE_BUCKET)
        .createSignedUrl(path, 10 * 60);

      if (error || !data?.signedUrl) return row;

      return {
        ...row,
        public_url: data.signedUrl,
        preview_url: data.signedUrl,
      };
    }),
  );
}

export async function countLegacyPendingBusinessImages() {
  const { data, error } = await supabase
    .from('business_images')
    .select(
      'id,storage_bucket,public_visible,is_sanitized,review_status,public_url',
    );

  if (error) throw error;

  const rows = (data || []) as unknown as Row[];

  return rows.filter(
    (row) =>
      businessImageBucket(row) === BUSINESS_IMAGE_PUBLIC_BUCKET &&
      !isApprovedPublicBusinessImage(row),
  ).length;
}

export async function migrateLegacyPendingBusinessImages() {
  const { data, error } = await supabase
    .from('business_images')
    .select(
      'id,business_id,owner_id,image_path,storage_bucket,public_url,' +
        'public_visible,is_sanitized,is_hero,review_status,title,display_title',
    )
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data || []) as unknown as Row[];
  const pending = rows.filter(
    (row) =>
      businessImageBucket(row) === BUSINESS_IMAGE_PUBLIC_BUCKET &&
      !isApprovedPublicBusinessImage(row),
  );

  const errors: string[] = [];
  let migrated = 0;

  for (const row of pending) {
    try {
      await ensureBusinessImagePrivate(row);
      migrated += 1;
    } catch (migrationError: any) {
      errors.push(
        `${row.id}: ${
          migrationError?.message || 'Không di chuyển được ảnh chưa duyệt.'
        }`,
      );
    }
  }

  return {
    total: pending.length,
    migrated,
    errors,
  };
}

export async function deleteBusinessAsset(
  kind: BusinessAssetKind,
  assetId: string,
) {
  const { data: targetData, error: targetError } = await supabase.rpc(
    'get_business_asset_delete_target',
    {
      asset_kind: kind,
      asset_uuid: assetId,
    },
  );

  if (targetError) throw targetError;

  const target = targetData as Row;
  const bucket = String(target?.bucket || '').trim();
  const path = String(target?.path || '').trim();

  if (!bucket || !path) {
    throw new Error('Không xác định được object Storage cần xóa.');
  }

  const { data: backupBlob, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(path);

  if (downloadError && !isStorageNotFound(downloadError)) {
    throw downloadError;
  }

  await removeObject(bucket, path);

  const { data, error } = await supabase.rpc(
    'delete_business_asset_record',
    {
      asset_kind: kind,
      asset_uuid: assetId,
      expected_path: path,
    },
  );

  if (error) {
    await restoreObject(bucket, path, backupBlob || null);
    throw error;
  }

  if (!data || String((data as Row).deleted_id || '') !== assetId) {
    await restoreObject(bucket, path, backupBlob || null);
    throw new Error('Database không xác nhận asset đã được xóa.');
  }

  return data;
}
