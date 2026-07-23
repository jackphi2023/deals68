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
  '20260721102249_ai_report_phase2_function_acl_hardening_v1.sql',
  '20260721103201_ai_report_phase2_preflight_and_hourly_limits_v1.sql',
  '20260721103504_ai_report_phase2_hourly_download_reconciliation_v1.sql',
  '20260721121832_ai_report_phase5_worker_artifact_v1.sql',
  '20260723115526_investor_plan_entitlements_v1.sql',
  '20260723134524_investor_standard_premium_registration_v1.sql',
];
const forbidden = [
  '20260711103000_normalize_investor_taxonomy_on_write_v1.sql',
  '20260711104500_expand_investor_taxonomy_aliases_v1.sql',
  '20260711110000_normalize_investor_type_on_write_v1.sql',
  '20260712131500_payment_invoice_atomic_lifecycle.sql',
  '20260712132500_payment_order_code_collision_guard.sql',
  '20260723183000_investor_plan_entitlements_v1.sql',
  '20260723193000_investor_standard_premium_registration_v1.sql',
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
      'v_preflight := public.d68_run_business_report_preflight(p_business_id);',
      "v_next_allowed_at := v_last_completed_at + interval '60 minutes';",
      "'rate_limit_minutes', 60",
      "'BROKER_AUTHORITY_MISSING'",
      "'AUTHORITY_SCOPE_INSUFFICIENT'",
      'Missing or insufficient broker authority remains non-blocking',
    ],
  },
  {
    name: '20260721102249_ai_report_phase2_function_acl_hardening_v1.sql',
    snippets: [
      'from public, anon, authenticated',
      'from public, anon;',
      'to authenticated, service_role',
      'to service_role',
      'd68_complete_business_report_request',
      'd68_set_ai_report_alert',
    ],
  },
  {
    name: '20260721103201_ai_report_phase2_preflight_and_hourly_limits_v1.sql',
    snippets: [
      'create table if not exists public.ai_report_rate_events',
      "create type public.d68_ai_report_action as enum ('generate','download')",
      'create or replace function public.d68_get_business_report_rate_status',
      'create or replace function public.d68_get_business_report_source_snapshot',
      'rolling one-hour limit',
    ],
  },
  {
    name: '20260721103504_ai_report_phase2_hourly_download_reconciliation_v1.sql',
    snippets: [
      'drop function if exists public.d68_run_business_report_preflight(uuid, boolean)',
      'create or replace function public.d68_claim_business_report_download',
      "'source', 'ai_report_business_requests'",
      "'source', 'ai_report_rate_events'",
      'at most one download per rolling 60-minute window',
    ],
  },
  {
    name: '20260721121832_ai_report_phase5_worker_artifact_v1.sql',
    snippets: [
      'create table if not exists public.ai_reports',
      "source_label text not null default 'Deals68 AI Report'",
      "constraint ai_reports_source_label_check check (source_label = 'Deals68 AI Report')",
      "'business-reports-private'",
      'create or replace function public.d68_finalize_business_report',
      'create or replace function public.d68_fail_business_report_request',
      'create or replace function public.d68_get_latest_business_report',
      'to service_role',
      'no private storage path is exposed',
    ],
  },
  {
    name: '20260723115526_investor_plan_entitlements_v1.sql',
    snippets: [
      "add column if not exists plan text not null default 'standard'",
      "set plan = 'standard'",
      'create or replace function public.d68_guard_investor_plan_contract',
      'create or replace function public.d68_get_investor_plan_snapshot',
      'create or replace function public.d68_investor_has_entitlement',
      'create or replace function public.admin_set_investor_plan',
      'then 50000000 else 2500 end',
    ],
  },
  {
    name: '20260723134524_investor_standard_premium_registration_v1.sql',
    snippets: [
      'create or replace function public.create_signup_bundle_v2',
      "payment_payload->>'skipPayment'",
      "requested_investor_plan = 'standard'",
      'delete from public.payment_orders',
      "'payment_skipped', true",
      'to anon, authenticated, service_role',
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
