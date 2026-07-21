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
  '20260717073820_promote_legacy_pending_investor_criteria_v1.sql',
  '20260717101552_investor_appetite_moderation_v1.sql',
  '20260717143000_business_city_key_public_flow_v1.sql',
  '20260717215300_business_public_financial_snapshot_v1.sql',
  '20260721093859_ai_report_phase1_foundation_v1.sql',
  '20260721101214_ai_report_phase2_evidence_foundation_v1.sql',
  '20260721101436_ai_report_phase2_preflight_rate_limit_v1.sql',
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

const migrationContracts = [
  {
    name: '20260721101214_ai_report_phase2_evidence_foundation_v1.sql',
    snippets: [
      'q_source numeric(5,4) generated always as (0::numeric) stored',
      'create table if not exists public.dataroom_facts',
      'create table if not exists public.ai_report_business_requests',
      'create unique index if not exists ai_report_business_requests_active_idx',
      "where status = 'reserved'",
      'Only completed requests count toward the rolling 60-minute limit.',
    ],
  },
  {
    name: '20260721101436_ai_report_phase2_preflight_rate_limit_v1.sql',
    snippets: [
      'create or replace function public.d68_run_business_report_preflight',
      'create or replace function public.d68_reserve_business_report_request',
      "v_preflight := public.d68_run_business_report_preflight(p_business_id);",
      "v_next_allowed_at := v_last_completed_at + interval '60 minutes';",
      "'rate_limit_minutes', 60",
      "'BROKER_AUTHORITY_MISSING'",
      "'AUTHORITY_SCOPE_INSUFFICIENT'",
      'Missing or insufficient broker authority remains non-blocking',
    ],
  },
];

for (const contract of migrationContracts) {
  const path = `supabase/migrations/${contract.name}`;
  if (!fs.existsSync(path)) continue;
  const content = fs.readFileSync(path, 'utf8');
  for (const snippet of contract.snippets) {
    if (!content.includes(snippet)) {
      failures.push(`${contract.name} missing contract: ${snippet}`);
    }
  }
}

if (!fs.existsSync('docs/release/MIGRATION_STATE.md')) failures.push('MIGRATION_STATE.md missing');

if (failures.length) {
  console.error('✗ Deals68 migration state check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}
console.log('✓ Deals68 migration state check: PASS');
