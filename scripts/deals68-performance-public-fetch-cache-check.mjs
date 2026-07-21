#!/usr/bin/env node
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(/PUBLIC_REST_CACHE_TTL_MS = 15_000/.test(source), 'Public REST cache TTL must remain 15 seconds');
check(/PUBLIC_REST_CACHE_MAX_ENTRIES = 120/.test(source), 'Public REST cache must remain bounded');
check(/public_businesses_safe/.test(source), 'Business safe-view allowlist is missing');
check(/public_investors_safe/.test(source), 'Investor safe-view allowlist is missing');
check(/request\.method !== 'GET'/.test(source), 'Only GET requests may be cached');
check(/request\.cache === 'no-store'/.test(source), 'No-store requests must bypass cache');
check(/headers\.get\('authorization'\)/.test(source), 'Cache key must be isolated by auth session');
check(/headers\.get\('range'\)/.test(source), 'Cache key must preserve pagination range');
check(/headers\.get\('prefer'\)/.test(source), 'Cache key must preserve PostgREST count preferences');
check(/response\.clone\(\)/.test(source), 'Cached responses must be cloned before reuse');
check(/current\?\.promise/.test(source), 'Concurrent identical requests must share one in-flight promise');
check(/global:\s*\{\s*fetch: publicSupabaseFetch/.test(source), 'Supabase client must use the guarded fetch implementation');
check(!/site_banners/.test(source), 'Admin-capable banner table must not be cached at transport level');
check(!/businesses['"`]/.test(source.replace(/public_businesses_safe/g, '')), 'Raw businesses table must not be cached');
check(!/investors['"`]/.test(source.replace(/public_investors_safe/g, '')), 'Raw investors table must not be cached');

if (failures.length) {
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}

console.log('✓ Public safe-view response cache contract: 15/15 PASS');
