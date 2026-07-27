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
  '20260724073247_business_financial_access_phase_a_v1.sql',
  '20260724085657_business_public_financial_redaction_phase_b_v1.sql',
  '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',
  '20260724130742_business_dataroom_access_phase_e_stabilization.sql',
  '20260724130910_investor_premium_price_v2.sql',
  '20260724140213_public_business_view_band_helper_acl_fix_v1.sql',
  '20260724142506_homepage_business_ids_safe_view_v1.sql',
  '20260727084802_market_partner_affiliate_phase1_v1.sql',
  '20260727103000_market_partner_affiliate_phase2_dashboard_v1.sql',
  '20260727110000_market_partner_affiliate_phase3_referral_v1.sql',
  '20260727113000_market_partner_affiliate_phase4_checkout_v1.sql',
  '20260727124500_market_partner_affiliate_phase5_commission_payout_v1.sql',
];
const forbidden = [
  '20260711103000_normalize_investor_taxonomy_on_write_v1.sql',
  '20260711104500_expand_investor_taxonomy_aliases_v1.sql',
  '20260711110000_normalize_investor_type_on_write_v1.sql',
  '20260712131500_payment_invoice_atomic_lifecycle.sql',
  '20260712132500_payment_order_code_collision_guard.sql',
  '20260723183000_investor_plan_entitlements_v1.sql',
  '20260723193000_investor_standard_premium_registration_v1.sql',
  '20260724100000_business_financial_access_phase_a_v1.sql',
  '20260724110000_business_public_financial_redaction_phase_b_v1.sql',
  '20260724120000_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',
  '20260724120937_business_dataroom_access_phase_e_stabilization.sql',
  '20260724130029_investor_premium_price_v2.sql',
  '20260724163000_public_business_view_band_helper_acl_fix_v1.sql',
  '20260724153000_homepage_business_ids_safe_view_v1.sql',
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
  {
    name: '20260724073247_business_financial_access_phase_a_v1.sql',
    snippets: [
      'create table if not exists public.business_financial_access_grants',
      'create unique index if not exists request_data_one_open_pair_uidx',
      'create or replace function public.d68_get_business_financial_access',
      'create or replace function public.d68_request_business_financial_access',
      'create or replace function public.d68_respond_business_financial_request',
      'create or replace function public.d68_revoke_business_financial_access',
      'proposals_financial_access_status_update',
      'request_data_financial_access_update',
      "'dataroom_inferred', false",
      'business_financial_access_grants_parties_select',
    ],
  },
  {
    name: '20260724085657_business_public_financial_redaction_phase_b_v1.sql',
    snippets: [
      'null::numeric as revenue_2025',
      'null::numeric as ebitda_margin',
      'security_invoker = false',
      'create or replace function public.d68_get_business_financial_summaries',
      'business_financial_access_grants g',
      'revoke select on table public.businesses from public, anon',
      'business select owner or admin',
      'd68_calculate_business_quality_score_payload_internal',
      "'exact_revenue_public', false",
    ],
  },
  {
    name: '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',
    snippets: [
      "'active'::public.account_status",
      "'hidden'::public.account_status",
      'create or replace function public.d68_get_business_financial_summaries',
      'create or replace function public.d68_request_business_financial_access',
      "'grant_required', true",
      "'public_redaction_unchanged', true",
    ],
  },
  {
    name: '20260724130742_business_dataroom_access_phase_e_stabilization.sql',
    snippets: [
      'create or replace function public.get_business_file_metadata_for_viewer',
      'create or replace function public.d68_get_business_dataroom_file_access',
      "'dataroom' = any(g.scopes)",
      'access_business_dataroom_file',
      'files select owner admin or active dataroom grant',
      'business files select owner admin or active dataroom grant',
      'Deliberately no INSERT/UPDATE into business_financial_access_grants',
    ],
  },
  {
    name: '20260724130910_investor_premium_price_v2.sql',
    snippets: [
      'create or replace function public.d68_get_investor_premium_price',
      'then 26000000',
      'else 1000',
      "'price_version', 'investor-premium-v2-20260724'",
      'to anon, authenticated, service_role',
    ],
  },
  {
    name: '20260724140213_public_business_view_band_helper_acl_fix_v1.sql',
    snippets: [
      'd68_public_revenue_band_key(numeric, text)',
      'd68_public_revenue_band_rank(numeric, text)',
      'd68_public_revenue_match_band_key(numeric, text)',
      'd68_public_ebitda_band_key(numeric)',
      'to anon, authenticated, service_role',
      "'base_table_select_changed', false",
      "'exact_financial_public_changed', false",
    ],
  },
  {
    name: '20260724142506_homepage_business_ids_safe_view_v1.sql',
    snippets: [
      'create or replace function public.get_homepage_business_ids',
      'from public.public_businesses_safe b',
      'security invoker',
      'set search_path = public, pg_temp',
      'to anon, authenticated, service_role',
      "'base_table_read', false",
      "'returns_public_ids_only', true",
    ],
  },
  {
    name: '20260727084802_market_partner_affiliate_phase1_v1.sql',
    snippets: [
      "alter type public.user_role add value if not exists 'market_partner'",
      'create table if not exists public.market_partners',
      'create table if not exists public.affiliate_clicks',
      'create table if not exists public.affiliate_attributions',
      'create table if not exists public.affiliate_commissions',
      'create table if not exists public.affiliate_payouts',
      'create or replace function public.d68_record_affiliate_click',
      'No automatic payment trigger is installed in Phase 1',
    ],
  },
  {
    name: '20260727103000_market_partner_affiliate_phase2_dashboard_v1.sql',
    snippets: [
      'create or replace function public.d68_get_my_market_partner_dashboard',
      'create or replace function public.d68_update_my_market_partner_bank_account',
      'no customer identity or payment payload',
      'strict field whitelist and server-side validation',
    ],
  },
  {
    name: '20260727110000_market_partner_affiliate_phase3_referral_v1.sql',
    snippets: [
      'create or replace function public.d68_attach_affiliate_attribution_from_profile',
      "new.role::text not in ('business', 'investor')",
      "mp.status = 'active'",
      "clicked_at >= now() - interval '30 days'",
      'if v_requested_click_id is null then',
      'if v_click_id is null then',
      'on conflict (subject_profile_id) do nothing',
      'create trigger d68_profiles_attach_affiliate_attribution',
      'never creates commission or changes payment',
    ],
  },
  {
    name: '20260727113000_market_partner_affiliate_phase4_checkout_v1.sql',
    snippets: [
      "commission_basis_currency text not null default 'VND'",
      'commission_tier_1_max numeric(20,2) not null default 20000000',
      'commission_tier_2_max numeric(20,2) not null default 50000000',
      'commission_tier_1_pct numeric(5,2) not null default 40',
      'commission_tier_2_pct numeric(5,2) not null default 50',
      'commission_tier_3_pct numeric(5,2) not null default 60',
      'create or replace function public.d68_admin_update_market_partner_commercial_policy',
      'create or replace function public.d68_get_affiliate_checkout_quote',
      'create or replace function public.d68_affiliate_commission_pct_for_net_paid',
      'Promo code cannot be combined with a Market Partner code',
      "'calculation_basis', 'net_paid_amount'",
      'No automatic commission trigger is installed in Phase 4',
    ],
  },
  {
    name: '20260727124500_market_partner_affiliate_phase5_commission_payout_v1.sql',
    snippets: [
      'create or replace function public.d68_claim_market_partner_signup',
      'create or replace function public.d68_create_affiliate_commission_for_payment',
      'create trigger d68_payment_confirmed_affiliate_commission',
      'affiliate_commission_auto_create_failed',
      "'snapshot_source', 'payment_order.payload.affiliate'",
      'create or replace function public.d68_admin_set_affiliate_commission_status',
      'create or replace function public.d68_admin_create_affiliate_payout',
      'create or replace function public.d68_admin_set_affiliate_payout_status',
      'Paid commission is immutable',
      'Payment reference is required',
      "'partner_customer_data_exposed', false",
      "'partner_payment_payload_exposed', false",
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
