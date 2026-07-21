type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function cachedPublicRequest<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }
  if (existing?.promise) return existing.promise;

  const promise = loader()
    .then((value) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + Math.max(0, ttlMs),
      });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise, expiresAt: now + Math.max(0, ttlMs) });
  return promise;
}
