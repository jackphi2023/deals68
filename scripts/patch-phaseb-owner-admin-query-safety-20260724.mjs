#!/usr/bin/env node
import fs from 'node:fs';

const dataPath = 'src/lib/data.ts';
const qaPath = 'scripts/deals68-business-financial-redaction-phase-b-check.mjs';
let data = fs.readFileSync(dataPath, 'utf8');

function replaceOnce(from, to, label) {
  if (!data.includes(from)) throw new Error(`data.ts missing ${label}`);
  data = data.replace(from, to);
}

replaceOnce(
  `  if (['small', 'mid', 'large'].includes(filters.revenueBand)) {\n    q = q.eq('revenue_band_key', filters.revenueBand);\n  }`,
  `  if (filters.includeHidden && filters.revenueBand === 'small') {\n    q = q.or('and(revenue_currency.eq.VND,revenue_2025.lt.10000000000),and(revenue_currency.eq.USD,revenue_2025.lt.400000)');\n  } else if (filters.includeHidden && filters.revenueBand === 'mid') {\n    q = q.or('and(revenue_currency.eq.VND,revenue_2025.gte.10000000000,revenue_2025.lte.100000000000),and(revenue_currency.eq.USD,revenue_2025.gte.400000,revenue_2025.lte.4000000)');\n  } else if (filters.includeHidden && filters.revenueBand === 'large') {\n    q = q.or('and(revenue_currency.eq.VND,revenue_2025.gt.100000000000),and(revenue_currency.eq.USD,revenue_2025.gt.4000000)');\n  } else if (['small', 'mid', 'large'].includes(filters.revenueBand)) {\n    q = q.eq('revenue_band_key', filters.revenueBand);\n  }`,
  'owner/Admin exact revenue filters',
);

const publicSort = `if (sort === 'revenue') q = q.order('revenue_band_rank', { ascending: false, nullsFirst: false }).order('quality_score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });`;
const safeSort = `if (sort === 'revenue') {\n    q = filters.includeHidden\n      ? q.order('revenue_2025', { ascending: false, nullsFirst: false })\n      : q.order('revenue_band_rank', { ascending: false, nullsFirst: false })\n          .order('quality_score', { ascending: false, nullsFirst: false })\n          .order('created_at', { ascending: false });\n  }`;
const count = data.split(publicSort).length - 1;
if (count !== 2) throw new Error(`Expected 2 revenue sort branches, found ${count}`);
data = data.split(publicSort).join(safeSort);

replaceOnce(
  `  const rows = ((data || []) as any[]).map(getPublicBusinessView);\n  if (filters.includeAuthorizedFinancials === false) return rows;`,
  `  const rows = ((data || []) as any[]).map(getPublicBusinessView);\n  if (filters.includeHidden || filters.includeAuthorizedFinancials === false) return rows;`,
  'owner/Admin hydration bypass',
);

fs.writeFileSync(dataPath, data);

let qa = fs.readFileSync(qaPath, 'utf8');
const anchor = `if (!data.includes('filters.includeAuthorizedFinancials === false')) failures.push('Public cache financial hydration opt-out missing');`;
const replacement = `${anchor}\nif (!data.includes("filters.includeHidden && filters.revenueBand === 'small'")) failures.push('Owner/Admin exact revenue filtering regression');\nif (!data.includes("q.order('revenue_2025', { ascending: false")) failures.push('Owner/Admin exact revenue sorting regression');\nif (!data.includes('filters.includeHidden || filters.includeAuthorizedFinancials === false')) failures.push('Owner/Admin base rows should not require secure re-hydration');`;
if (!qa.includes(anchor)) throw new Error('Phase B QA owner/Admin anchor missing');
qa = qa.replace(anchor, replacement);
fs.writeFileSync(qaPath, qa);
console.log('Phase B owner/Admin query safety patch applied.');
