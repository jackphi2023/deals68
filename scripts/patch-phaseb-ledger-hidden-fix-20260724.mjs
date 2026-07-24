#!/usr/bin/env node
import fs from 'node:fs';

const originalTentative = '20260724110000_business_public_financial_redaction_phase_b_v1.sql';
const originalActual = '20260724085657_business_public_financial_redaction_phase_b_v1.sql';
const hiddenFix = '20260724120000_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}
function write(path, content) {
  fs.writeFileSync(path, content);
}
function replaceOnce(path, from, to, label) {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`${path}: missing ${label}`);
  write(path, content.replace(from, to));
}

replaceOnce(
  'scripts/deals68-business-financial-redaction-phase-b-check.mjs',
  `const migrationName = '${originalTentative}';\nconst failures = [];\nconst read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';\nconst sql = read(\`supabase/migrations/\${migrationName}\`);`,
  `const migrationName = '${originalActual}';\nconst hiddenInvestorFixName = '${hiddenFix}';\nconst failures = [];\nconst read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';\nconst sql = read(\`supabase/migrations/\${migrationName}\`);\nconst hiddenInvestorFixSql = read(\`supabase/migrations/\${hiddenInvestorFixName}\`);`,
  'Phase B actual migration name',
);
replaceOnce(
  'scripts/deals68-business-financial-redaction-phase-b-check.mjs',
  `for (const snippet of requiredSql) if (!sql.includes(snippet)) failures.push(\`Migration missing: \${snippet}\`);`,
  `for (const snippet of requiredSql) if (!sql.includes(snippet)) failures.push(\`Migration missing: \${snippet}\`);\nfor (const snippet of [\n  "i.status in (",\n  "'active'::public.account_status",\n  "'hidden'::public.account_status",\n  'create or replace function public.d68_get_business_financial_summaries',\n  'create or replace function public.d68_request_business_financial_access',\n  "'grant_required', true",\n]) if (!hiddenInvestorFixSql.includes(snippet)) failures.push(\`Hidden Investor fix missing: \${snippet}\`);`,
  'hidden Investor compatibility QA',
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  '${originalTentative}',\n];`,
  `  '${originalActual}',\n  '${hiddenFix}',\n];`,
  'Phase B required migration names',
);
replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  '20260724100000_business_financial_access_phase_a_v1.sql',\n];`,
  `  '20260724100000_business_financial_access_phase_a_v1.sql',\n  '${originalTentative}',\n];`,
  'Phase B obsolete filename guard',
);
replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `    name: '${originalTentative}',`,
  `    name: '${originalActual}',`,
  'Phase B migration contract actual name',
);
replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  {\n    name: '${originalActual}',\n    snippets: [\n      'null::numeric as revenue_2025',\n      'null::numeric as ebitda_margin',\n      'security_invoker = false',\n      'create or replace function public.d68_get_business_financial_summaries',\n      'business_financial_access_grants g',\n      'revoke select on table public.businesses from public, anon',\n      'business select owner or admin',\n      'd68_calculate_business_quality_score_payload_internal',\n      "'exact_revenue_public', false",\n    ],\n  },`,
  `  {\n    name: '${originalActual}',\n    snippets: [\n      'null::numeric as revenue_2025',\n      'null::numeric as ebitda_margin',\n      'security_invoker = false',\n      'create or replace function public.d68_get_business_financial_summaries',\n      'business_financial_access_grants g',\n      'revoke select on table public.businesses from public, anon',\n      'business select owner or admin',\n      'd68_calculate_business_quality_score_payload_internal',\n      "'exact_revenue_public', false",\n    ],\n  },\n  {\n    name: '${hiddenFix}',\n    snippets: [\n      "'active'::public.account_status",\n      "'hidden'::public.account_status",\n      'create or replace function public.d68_get_business_financial_summaries',\n      'create or replace function public.d68_request_business_financial_access',\n      "'grant_required', true",\n      "'public_redaction_unchanged', true",\n    ],\n  },`,
  'hidden Investor migration registry contract',
);

replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  `| 20260724110000 | \`${originalTentative}\` |`,
  `| 20260724085657 | \`${originalActual}\` |\n| 20260724120000 | \`${hiddenFix}\` |`,
  'Phase B ledger rows',
);
replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  `- \`${originalTentative}\` — Business Financial Redaction Phase B; removes exact revenue, EBITDA, growth and numeric asset values from public Business reads, preserves coarse discovery/matching bands, closes direct public base-table access, guards the quality calculator and adds a grant-aware batch summary RPC.`,
  `- \`${originalActual}\` — Business Financial Redaction Phase B applied to production; removes exact revenue, EBITDA, growth and numeric asset values from public Business reads, preserves coarse discovery/matching bands, closes direct public base-table access, guards the quality calculator and adds a grant-aware batch summary RPC.\n- \`${hiddenFix}\` — Phase B compatibility fix; treats Investor status \`hidden\` as a public-profile visibility state rather than loss of entitlement, so the authenticated owner can use active Proposal/request grants and submit idempotent financial-data requests.`,
  'Phase B ledger descriptions',
);

console.log('Phase B ledger and hidden Investor fix patch applied.');
