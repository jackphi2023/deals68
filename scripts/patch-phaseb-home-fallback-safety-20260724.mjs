#!/usr/bin/env node
import fs from 'node:fs';

const dataPath = 'src/lib/data.ts';
const qaPath = 'scripts/deals68-business-financial-redaction-phase-b-check.mjs';
let data = fs.readFileSync(dataPath, 'utf8');
const from = `return listBusinesses({ limit: safeLimit, sort: 'featured' });`;
const count = data.split(from).length - 1;
if (count !== 2) throw new Error(`Expected 2 Homepage public fallbacks, found ${count}`);
data = data.split(from).join(`return listBusinesses({\n      limit: safeLimit,\n      sort: 'featured',\n      includeAuthorizedFinancials: false,\n    });`);
fs.writeFileSync(dataPath, data);

let qa = fs.readFileSync(qaPath, 'utf8');
const qaFrom = `if (!homepageFunction.includes('includeAuthorizedFinancials: false')) failures.push('Homepage fallback must disable exact financial hydration');`;
const qaTo = `if (!homepageFunction.includes('includeAuthorizedFinancials: false')) failures.push('Homepage fallback must disable exact financial hydration');\nif (homepageFunction.includes("return listBusinesses({ limit: safeLimit, sort: 'featured' });")) failures.push('A Homepage error fallback can still hydrate exact financials');\nconst publicOnlyFallbackCount = (homepageFunction.match(/includeAuthorizedFinancials: false/g) || []).length;\nif (publicOnlyFallbackCount < 3) failures.push('All three Homepage fallback paths must remain public-only');`;
if (!qa.includes(qaFrom)) throw new Error('Phase B QA cache assertion anchor missing');
qa = qa.replace(qaFrom, qaTo);
fs.writeFileSync(qaPath, qa);
console.log('Phase B Homepage fallback safety patch applied.');
