#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const required = [
  '20260711100135_normalize_investor_taxonomy_on_write_v1.sql',
  '20260711100329_expand_investor_taxonomy_aliases_v1.sql',
  '20260711100835_normalize_investor_type_on_write_v1.sql',
  '20260712124143_payment_invoice_atomic_lifecycle.sql',
  '20260712124601_payment_order_code_collision_guard.sql',
  '20260712153808_restore_public_business_view_helper_execute.sql',
  '20260713010000_release_candidate_phase_a_hardening.sql',
  '20260713020000_after_main_cutover_revoke_signup_v1.sql',
  '20260717073001_investor_criteria_review_v1.sql',
  '20260717073045_investor_profile_contract_ui_v2.sql',
];
const forbidden = [
  '20260711103000_normalize_investor_taxonomy_on_write_v1.sql',
  '20260711104500_expand_investor_taxonomy_aliases_v1.sql',
  '20260711110000_normalize_investor_type_on_write_v1.sql',
  '20260712131500_payment_invoice_atomic_lifecycle.sql',
  '20260712132500_payment_order_code_collision_guard.sql',
];
for (const name of required) {
  if (!fs.existsSync(`supabase/migrations/${name}`)) failures.push(`Missing ${name}`);
}
for (const name of forbidden) {
  if (fs.existsSync(`supabase/migrations/${name}`)) failures.push(`Obsolete filename remains: ${name}`);
}
if (!fs.existsSync('docs/release/MIGRATION_STATE.md')) failures.push('MIGRATION_STATE.md missing');

if (failures.length) {
  console.error('✗ Deals68 migration state check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}
console.log('✓ Deals68 migration state check: PASS');
