#!/usr/bin/env node
import fs from 'node:fs';

const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');
const cache = fs.readFileSync('src/lib/homePublicData.ts', 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(/loadHomePublicData\(\)\.then/.test(home), 'Home must load through the shared payload cache');
check(/\}, \[\]\);/.test(home), 'Home data effect must not depend on language');
check(/\[businessRows, lang\]/.test(home), 'Localized deals must be derived locally from raw rows');
check(!/countBusinesses\(\)/.test(home), 'Home must not call countBusinesses directly');
check(!/listHomepageBusinesses\(6\)/.test(home), 'Home must not call listHomepageBusinesses directly');
check(/cachedPublicQuery\(/.test(cache), 'Home payload must use the shared in-memory cache');
check(/HOME_PUBLIC_DATA_CACHE_TTL_MS = 30_000/.test(cache), 'Home payload cache TTL must remain 30 seconds');
check(/Promise\.all\(\[/.test(cache), 'Cold-load requests must remain parallel');
check(/countBusinesses\(\)/.test(cache) && /countInvestors\(\)/.test(cache), 'Home counts must be preserved');
check(/listHomepageBusinesses\(6\)/.test(cache) && /listInvestors\(\{ limit: 80 \}\)/.test(cache), 'Homepage listing contracts must be preserved');

if (failures.length) {
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}

console.log('✓ Performance Phase 3 contract: 10/10 PASS');
