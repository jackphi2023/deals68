#!/usr/bin/env node
import fs from 'node:fs';

const oldVersion = '20260723183000';
const appliedVersion = '20260723115526';
const suffix = '_investor_plan_entitlements_v1.sql';
const oldPath = `supabase/migrations/${oldVersion}${suffix}`;
const newPath = `supabase/migrations/${appliedVersion}${suffix}`;

if (!fs.existsSync(oldPath)) throw new Error(`Missing source migration: ${oldPath}`);
if (fs.existsSync(newPath)) throw new Error(`Applied-version migration already exists: ${newPath}`);
fs.copyFileSync(oldPath, newPath);
fs.unlinkSync(oldPath);

for (const path of [
  'docs/release/MIGRATION_STATE.md',
  'scripts/deals68-migration-state-check.mjs',
  'scripts/deals68-investor-plan-entitlements-check.mjs',
]) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(oldVersion)) throw new Error(`${path}: old version not found`);
  fs.writeFileSync(path, source.replaceAll(oldVersion, appliedVersion));
}

const statePath = 'scripts/deals68-migration-state-check.mjs';
let state = fs.readFileSync(statePath, 'utf8');
const forbiddenAnchor = "  '20260712132500_payment_order_code_collision_guard.sql',\n];";
if (!state.includes(forbiddenAnchor)) throw new Error('Migration forbidden-list anchor not found');
state = state.replace(
  forbiddenAnchor,
  `  '20260712132500_payment_order_code_collision_guard.sql',\n  '${oldVersion}${suffix}',\n];`,
);
fs.writeFileSync(statePath, state);

console.log(`Migration source reconciled to Supabase ledger ${appliedVersion}.`);
