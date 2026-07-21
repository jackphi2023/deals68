type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

const entries = new Map<string, CacheEntry<unknown>>();

export async function cachedPublicQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 30_000,
): Promise<T> {
  const now = Date.now();
  const current = entries.get(key) as CacheEntry<T> | undefined;

  if (current?.value !== undefined && current.expiresAt > now) {
    return current.value;
  }

  if (current?.promise) return current.promise;

  const promise = loader()
    .then((value) => {
      entries.set(key, {
        value,
        expiresAt: Date.now() + Math.max(0, ttlMs),
      });
      return value;
    })
    .catch((error) => {
      entries.delete(key);
      throw error;
    });

  entries.set(key, {
    value: current?.value,
    expiresAt: current?.expiresAt || 0,
    promise,
  });

  return promise;
}

export function invalidatePublicQueryCache(prefix?: string) {
  if (!prefix) {
    entries.clear();
    return;
  }

  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

export function publicQueryCacheSize() {
  return entries.size;
}
