import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
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
