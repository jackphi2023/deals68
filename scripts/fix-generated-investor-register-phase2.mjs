#!/usr/bin/env node
import fs from 'node:fs';

const literal = '${migrationName}';
const actual = '20260723193000_investor_standard_premium_registration_v1.sql';

for (const path of [
  'scripts/deals68-migration-state-check.mjs',
  'docs/release/MIGRATION_STATE.md',
]) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(literal)) {
    throw new Error(`${path}: generated migration placeholder not found`);
  }
  fs.writeFileSync(path, source.replaceAll(literal, actual));
}

console.log('Generated Investor registration Phase 2 migration registry fixed.');
