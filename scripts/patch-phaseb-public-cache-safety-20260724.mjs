#!/usr/bin/env node
import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}
function replaceOnce(path, from, to, label) {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`${path}: missing ${label}`);
  fs.writeFileSync(path, content.replace(from, to));
}

replaceOnce(
  'src/lib/data.ts',
  `  return attachAuthorizedBusinessFinancials(\n    ((data || []) as any[]).map(getPublicBusinessView),\n  );\n}\n\nexport async function listBusinessesPage`,
  `  const rows = ((data || []) as any[]).map(getPublicBusinessView);\n  if (filters.includeAuthorizedFinancials === false) return rows;\n  return attachAuthorizedBusinessFinancials(rows);\n}\n\nexport async function listBusinessesPage`,
  'listBusinesses public-cache opt-out',
);

replaceOnce(
  'src/lib/data.ts',
  `  const homepageRows = await attachAuthorizedBusinessFinancials(\n    ((data || []) as any[]).map(getPublicBusinessView),\n  );\n  const byId = new Map(\n    homepageRows.map((row) => [String(row.id), row]),\n  );`,
  `  // Homepage payload is cached as public data. Never hydrate exact financials here,\n  // even when the current browser session belongs to an authorized Investor.\n  const homepageRows = ((data || []) as any[]).map(getPublicBusinessView);\n  const byId = new Map(\n    homepageRows.map((row) => [String(row.id), row]),\n  );`,
  'Homepage public-only rows',
);

replaceOnce(
  'src/lib/data.ts',
  `  const fallback = await listBusinesses({\n    limit: safeLimit * 3,\n    sort: 'featured',\n  });`,
  `  const fallback = await listBusinesses({\n    limit: safeLimit * 3,\n    sort: 'featured',\n    includeAuthorizedFinancials: false,\n  });`,
  'Homepage fallback public-only rows',
);

replaceOnce(
  'scripts/deals68-business-financial-redaction-phase-b-check.mjs',
  `if (!home.includes("T(lang, 'Được bảo mật', 'Restricted')")) failures.push('Homepage restricted fallback missing');`,
  `if (!home.includes("T(lang, 'Được bảo mật', 'Restricted')")) failures.push('Homepage restricted fallback missing');\nif (!data.includes('filters.includeAuthorizedFinancials === false')) failures.push('Public cache financial hydration opt-out missing');\nconst homepageFunction = data.slice(data.indexOf('export async function listHomepageBusinesses'), data.indexOf('export async function countBusinesses'));\nif (homepageFunction.includes('await attachAuthorizedBusinessFinancials')) failures.push('Homepage public cache must not hydrate exact financials');\nif (!homepageFunction.includes('includeAuthorizedFinancials: false')) failures.push('Homepage fallback must disable exact financial hydration');`,
  'Phase B cache safety QA',
);

console.log('Phase B public cache safety patch applied.');
