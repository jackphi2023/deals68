import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const PUBLIC_REST_CACHE_TTL_MS = 15_000;
const PUBLIC_REST_CACHE_MAX_ENTRIES = 120;
const PUBLIC_REST_PATHS = new Set([
  '/rest/v1/public_businesses_safe',
  '/rest/v1/public_investors_safe',
]);

type PublicRestCacheEntry = {
  expiresAt: number;
  response?: Response;
  promise?: Promise<Response>;
};

const publicRestCache = new Map<string, PublicRestCacheEntry>();
const nativeFetch = globalThis.fetch.bind(globalThis);

function prunePublicRestCache(now = Date.now()) {
  for (const [key, entry] of publicRestCache.entries()) {
    if (entry.expiresAt > 0 && entry.expiresAt <= now && !entry.promise) {
      publicRestCache.delete(key);
    }
  }

  while (publicRestCache.size >= PUBLIC_REST_CACHE_MAX_ENTRIES) {
    const oldestKey = publicRestCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    publicRestCache.delete(oldestKey);
  }
}

function cacheablePublicRequest(request: Request) {
  if (request.method !== 'GET') return false;
  if (request.cache === 'no-store' || request.cache === 'reload') return false;

  try {
    return PUBLIC_REST_PATHS.has(new URL(request.url).pathname);
  } catch {
    return false;
  }
}

function publicRestCacheKey(request: Request) {
  const headers = request.headers;
  return [
    request.method,
    request.url,
    headers.get('authorization') || '',
    headers.get('apikey') || '',
    headers.get('accept-profile') || '',
    headers.get('range') || '',
    headers.get('prefer') || '',
    headers.get('accept') || '',
  ].join('|');
}

const publicSupabaseFetch: typeof fetch = async (input, init) => {
  let request: Request;
  try {
    request = input instanceof Request && !init
      ? input
      : new Request(input, init);
  } catch {
    return nativeFetch(input, init);
  }

  if (!cacheablePublicRequest(request)) return nativeFetch(request);

  const now = Date.now();
  prunePublicRestCache(now);
  const key = publicRestCacheKey(request);
  const current = publicRestCache.get(key);

  if (current?.response && current.expiresAt > now) {
    return current.response.clone();
  }

  if (current?.promise) {
    return (await current.promise).clone();
  }

  const promise = nativeFetch(request)
    .then((response) => {
      if (response.ok) {
        publicRestCache.set(key, {
          expiresAt: Date.now() + PUBLIC_REST_CACHE_TTL_MS,
          response: response.clone(),
        });
      } else {
        publicRestCache.delete(key);
      }
      return response;
    })
    .catch((error) => {
      publicRestCache.delete(key);
      throw error;
    });

  publicRestCache.set(key, { expiresAt: 0, promise });
  return (await promise).clone();
};

export function clearPublicRestResponseCache() {
  publicRestCache.clear();
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: publicSupabaseFetch,
  },
});

function installPostgrestCatchCompat() {
  try {
    const probe = supabase.from('__d68_postgrest_compat_probe__').select('*') as any;
    let proto = Object.getPrototypeOf(probe);
    while (proto && proto !== Object.prototype) {
      if (typeof proto.then === 'function') {
        if (typeof proto.catch !== 'function') {
          Object.defineProperty(proto, 'catch', {
            configurable: true,
            writable: true,
            value(this: PromiseLike<unknown>, onRejected?: ((reason: any) => unknown) | null) {
              return Promise.resolve(this).catch(onRejected || undefined);
            },
          });
        }
        return;
      }
      proto = Object.getPrototypeOf(proto);
    }
  } catch {
    // Compatibility guard only. Query failures are handled at call sites.
  }
}

installPostgrestCatchCompat();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('YOUR_PROJECT'));

export type Role = 'business' | 'investor' | 'advisor' | 'affiliate' | 'admin';
