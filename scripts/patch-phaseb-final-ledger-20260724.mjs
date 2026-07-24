#!/usr/bin/env node
import fs from 'node:fs';

const tentative = '20260724120000_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql';
const actual = '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql';
const files = [
  'scripts/deals68-business-financial-redaction-phase-b-check.mjs',
  'scripts/deals68-migration-state-check.mjs',
  'docs/release/MIGRATION_STATE.md',
];
for (const path of files) {
  let content = fs.readFileSync(path, 'utf8');
  if (!content.includes(tentative)) throw new Error(`${path}: tentative filename missing`);
  content = content.split(tentative).join(actual);
  fs.writeFileSync(path, content);
}

const registryPath = 'scripts/deals68-migration-state-check.mjs';
let registry = fs.readFileSync(registryPath, 'utf8');
const forbiddenAnchor = `  '20260724110000_business_public_financial_redaction_phase_b_v1.sql',\n];`;
if (!registry.includes(forbiddenAnchor)) throw new Error('Migration forbidden anchor missing');
registry = registry.replace(
  forbiddenAnchor,
  `  '20260724110000_business_public_financial_redaction_phase_b_v1.sql',\n  '${tentative}',\n];`,
);
fs.writeFileSync(registryPath, registry);

const docsPath = 'docs/release/MIGRATION_STATE.md';
let docs = fs.readFileSync(docsPath, 'utf8');
docs = docs.replace('| 20260724120000 |', '| 20260724090819 |');
docs = docs.replace(
  `- \`${actual}\` — Phase B compatibility fix;`,
  `- \`${actual}\` — Phase B compatibility fix applied to production;`,
);
fs.writeFileSync(docsPath, docs);
console.log('Final Phase B migration ledger reconciliation applied.');
