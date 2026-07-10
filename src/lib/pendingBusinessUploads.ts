import { supabase } from './supabase';
import { uploadBusinessFile, uploadBusinessImage } from './data';

const DB_NAME = 'deals68-business-upload-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_business_assets';
const USER_INDEX = 'by_user_id';

export type PendingBusinessAssetInput = {
  id?: string;
  file: File;
  displayName: string;
};

type PendingBusinessAssetRow = {
  id: string;
  userId: string;
  businessId: string;
  kind: 'image' | 'file';
  displayName: string;
  fileName: string;
  mimeType: string;
  lastModified: number;
  blob: Blob;
  createdAt: string;
};

export type PendingBusinessUploadResult = {
  attempted: number;
  uploadedImages: number;
  uploadedFiles: number;
  remaining: number;
  errors: string[];
};

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ lưu file tạm trước OTP.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: 'id' });

      if (!store.indexNames.contains(USER_INDEX)) {
        store.createIndex(USER_INDEX, 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Không thể mở hàng đợi upload.'));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error('Không thể lưu hàng đợi upload.'));
    transaction.onabort = () =>
      reject(transaction.error || new Error('Hàng đợi upload đã bị hủy.'));
  });
}

async function listQueuedAssets(
  userId: string,
): Promise<PendingBusinessAssetRow[]> {
  const db = await openQueueDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const done = waitForTransaction(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index(USER_INDEX);

    const rows = await new Promise<PendingBusinessAssetRow[]>(
      (resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(userId));
        request.onsuccess = () =>
          resolve((request.result || []) as PendingBusinessAssetRow[]);
        request.onerror = () =>
          reject(request.error || new Error('Không thể đọc hàng đợi upload.'));
      },
    );

    await done;
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

async function deleteQueuedAsset(id: string): Promise<void> {
  const db = await openQueueDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const done = waitForTransaction(transaction);
    transaction.objectStore(STORE_NAME).delete(id);
    await done;
  } finally {
    db.close();
  }
}

export async function queuePendingBusinessSignupAssets(input: {
  userId: string;
  businessId: string;
  images: PendingBusinessAssetInput[];
  files: PendingBusinessAssetInput[];
}): Promise<number> {
  const rows: PendingBusinessAssetRow[] = [
    ...(input.images || []).map((item) => ({
      id: makeId(),
      userId: input.userId,
      businessId: input.businessId,
      kind: 'image' as const,
      displayName: item.displayName || item.file.name,
      fileName: item.file.name,
      mimeType: item.file.type || 'application/octet-stream',
      lastModified: item.file.lastModified || Date.now(),
      blob: item.file,
      createdAt: new Date().toISOString(),
    })),
    ...(input.files || []).map((item) => ({
      id: makeId(),
      userId: input.userId,
      businessId: input.businessId,
      kind: 'file' as const,
      displayName: item.displayName || item.file.name,
      fileName: item.file.name,
      mimeType: item.file.type || 'application/octet-stream',
      lastModified: item.file.lastModified || Date.now(),
      blob: item.file,
      createdAt: new Date().toISOString(),
    })),
  ];

  if (!rows.length) return 0;

  const db = await openQueueDb();

  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const done = waitForTransaction(transaction);
    const store = transaction.objectStore(STORE_NAME);
    rows.forEach((row) => store.put(row));
    await done;
    return rows.length;
  } finally {
    db.close();
  }
}

export async function resumePendingBusinessSignupUploads(
  userId: string,
): Promise<PendingBusinessUploadResult> {
  const result: PendingBusinessUploadResult = {
    attempted: 0,
    uploadedImages: 0,
    uploadedFiles: 0,
    remaining: 0,
    errors: [],
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id;

  if (!sessionUserId || sessionUserId !== userId) {
    result.errors.push('Chưa có phiên đăng nhập hợp lệ để tiếp tục upload.');
    return result;
  }

  const rows = await listQueuedAssets(userId);
  result.attempted = rows.length;

  for (const row of rows) {
    const file = new File([row.blob], row.fileName, {
      type: row.mimeType,
      lastModified: row.lastModified,
    });

    try {
      if (row.kind === 'image') {
        await uploadBusinessImage(
          row.businessId,
          row.userId,
          file,
          row.displayName,
          row.id,
        );
        result.uploadedImages += 1;
      } else {
        await uploadBusinessFile(
          row.businessId,
          row.userId,
          file,
          'profile',
          'locked',
          row.displayName,
          row.id,
        );
        result.uploadedFiles += 1;
      }

      await deleteQueuedAsset(row.id);
    } catch (error: any) {
      result.errors.push(
        `${row.fileName}: ${error?.message || 'upload failed'}`,
      );
    }
  }

  result.remaining = (await listQueuedAssets(userId)).length;
  return result;
}
