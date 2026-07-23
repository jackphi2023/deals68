#!/usr/bin/env node
import fs from 'node:fs';

const path = 'scripts/apply-investor-plan-entitlements-phase1.mjs';
let source = fs.readFileSync(path, 'utf8');
const filename = '20260723183000_investor_plan_entitlements_v1.sql';
const before = source;
source = source.replaceAll("'${migrationName}'", `'${filename}'`);
if (source === before) {
  throw new Error('Expected literal migrationName placeholders were not found.');
}
if (source.includes("'${migrationName}'")) {
  throw new Error('Literal migrationName placeholder remains after repair.');
}
fs.writeFileSync(path, source);
console.log('Investor plan migration registry interpolation repaired.');
