#!/usr/bin/env node
import fs from 'node:fs';

const data = fs.readFileSync('src/lib/data.ts', 'utf8');
const businesses = fs.readFileSync('src/pages/Businesses.tsx', 'utf8');
const investors = fs.readFileSync('src/pages/Investors.tsx', 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(/export async function listBusinessesPage/.test(data), 'Combined Business page query is missing');
check(/select\(select as string, \{ count: 'exact' \}\)/.test(data), 'Business rows and exact count must share one request');
check(/return \{ rows, total: count \?\? rows\.length \}/.test(data), 'Business page result contract changed');
check(/BUSINESS_FACET_CACHE_TTL_MS = 30_000/.test(data), 'Business facet cache TTL must remain 30 seconds');
check(/cachedPublicQuery\(/.test(data) && /public:businesses:facets/.test(data), 'Business facets must use shared query cache');
check(/listBusinessesPage\(filters\)/.test(businesses), 'Businesses page must use combined rows/count query');
check(!/countBusinesses/.test(businesses) && !/listBusinesses\(filters\)/.test(businesses), 'Businesses page still performs duplicate rows/count requests');
check(/featuredOnly\]\);/.test(businesses), 'Businesses data effect must not depend on language');
check(/BUSINESS_LIST_LOAD_ERROR/.test(businesses), 'Businesses localized error fallback is missing');
check(/search\]\);/.test(investors), 'Investors data effect must not depend on language');
check(/INVESTOR_LIST_LOAD_ERROR/.test(investors), 'Investors localized error fallback is missing');
check(!/search, lang\]\);/.test(investors), 'Investors still reloads listings on locale switch');

if (failures.length) {
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}
console.log('✓ Performance Phase 4 contract: 12/12 PASS');
