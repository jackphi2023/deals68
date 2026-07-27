# Deals68 — Migration State for Release Candidate

This file reconciles the migration filenames in Git with the migration versions already recorded in the Deals68 Supabase project.

| Supabase version | Git migration file |
|---|---|
| 20260711100135 | `20260711100135_normalize_investor_taxonomy_on_write_v1.sql` |
| 20260711100329 | `20260711100329_expand_investor_taxonomy_aliases_v1.sql` |
| 20260711100835 | `20260711100835_normalize_investor_type_on_write_v1.sql` |
| 20260712124143 | `20260712124143_payment_invoice_atomic_lifecycle.sql` |
| 20260712124601 | `20260712124601_payment_order_code_collision_guard.sql` |
| 20260712153808 | `20260712153808_restore_public_business_view_helper_execute.sql` |
| 20260721093859 | `20260721093859_ai_report_phase1_foundation_v1.sql` |
| 20260721101214 | `20260721101214_ai_report_phase2_evidence_foundation_v1.sql` |
| 20260721101436 | `20260721101436_ai_report_phase2_preflight_rate_limit_v1.sql` |
| 20260721102249 | `20260721102249_ai_report_phase2_function_acl_hardening_v1.sql` |
| 20260721103201 | `20260721103201_ai_report_phase2_preflight_and_hourly_limits_v1.sql` |
| 20260721103504 | `20260721103504_ai_report_phase2_hourly_download_reconciliation_v1.sql` |
| 20260721121832 | `20260721121832_ai_report_phase5_worker_artifact_v1.sql` |
| 20260723115526 | `20260723115526_investor_plan_entitlements_v1.sql` |
| 20260723134524 | `20260723134524_investor_standard_premium_registration_v1.sql` |
| 20260724073247 | `20260724073247_business_financial_access_phase_a_v1.sql` |
| 20260724085657 | `20260724085657_business_public_financial_redaction_phase_b_v1.sql` |
| 20260724090819 | `20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql` |
| 20260724130742 | `20260724130742_business_dataroom_access_phase_e_stabilization.sql` — applied to production |
| 20260724130910 | `20260724130910_investor_premium_price_v2.sql` — applied to production |
| 20260724140213 | `20260724140213_public_business_view_band_helper_acl_fix_v1.sql` — applied to production |
| 20260724142506 | `20260724142506_homepage_business_ids_safe_view_v1.sql` — applied to production |
| 20260724150019 | `20260724150019_business_public_ebitda_visibility_v1.sql` — applied to production |

The new Release Candidate migration is:

- `20260713010000_release_candidate_phase_a_hardening.sql` — apply before production code cutover.
- `20260713020000_after_main_cutover_revoke_signup_v1.sql` — apply only after Netlify production serves the v2 frontend.
- `20260717101552_investor_appetite_moderation_v1.sql` — additive Session 7 migration; apply after the Investor Profile V2 migrations so bilingual Investment appetite waits for Admin approval.
- `20260717143000_business_city_key_public_flow_v1.sql` — additive Session 4 migration; apply before testing the canonical Business location filter.
- `20260717215300_business_public_financial_snapshot_v1.sql` — additive Session 8 migration; stores only Admin-approved asset fields in the public Business snapshot and preserves the safe view contract.
- `20260721093859_ai_report_phase1_foundation_v1.sql` — additive AI Report Phase 1 foundation; adds file-processing, listing-authority, preflight and alert schemas with Business/Admin RLS. Missing or insufficient broker authority remains non-blocking and requires a mandatory report notice.
- `20260721101214_ai_report_phase2_evidence_foundation_v1.sql` — additive AI Report Phase 2 evidence foundation; separates self-declared values with `q_source = 0`, stores document-backed facts with citations/confidence, queues Business files for processing, and adds request reservation storage with Business/Admin RLS.
- `20260721101436_ai_report_phase2_preflight_rate_limit_v1.sql` — additive AI Report Phase 2 deterministic preflight and request gate; enforces active/visible Business ownership, data/entity/authority checks, mandatory broker authorization notices, idempotency, and one completed Business report generation per rolling 60 minutes. Failed workflows do not consume the limit.
- `20260721102249_ai_report_phase2_function_acl_hardening_v1.sql` — explicit function ACL hardening after Supabase provisioned role grants: anonymous cannot execute report RPCs, authenticated Business users can only call preflight/status/reserve, and helper plus complete/fail functions remain backend service-role only.
- `20260721103201_ai_report_phase2_preflight_and_hourly_limits_v1.sql` — additive report source snapshot, preflight metadata and rate-event ledger foundation applied during the concurrent Phase 2 rollout.
- `20260721103504_ai_report_phase2_hourly_download_reconciliation_v1.sql` — reconciles the concurrent rollout: generation continues to use `ai_report_business_requests`, Business PDF downloads use `ai_report_rate_events`, and each action is limited independently to one successful action per rolling 60 minutes.
- `20260721121832_ai_report_phase5_worker_artifact_v1.sql` — additive Phase 5 artifact foundation applied to production; creates the private `business-reports-private` bucket, atomic `ai_reports` storage, service-role finalize/fail RPCs and safe latest-report metadata for Business. Every PDF and artifact is constrained to `source_label = "Deals68 AI Report"`; private storage paths are not exposed to Business clients.
- `20260723115526_investor_plan_entitlements_v1.sql` — Investor Plan Phase 1 applied to production; establishes Standard/Premium entitlements and the original price contract. Its historical 50,000,000 VND / 2,500 USD values are superseded by Investor Premium Pricing V2.
- `20260723134524_investor_standard_premium_registration_v1.sql` — Investor Registration Phase 2 applied to production; allows free Standard Investor signup without retaining a payment order while preserving the existing Premium payment workflow and nonce verification.
- `20260724073247_business_financial_access_phase_a_v1.sql` — Business Financial Access Phase A applied to production; adds the canonical access-grant ledger, Proposal summary grants, approved-request detail grants, idempotent request/response/revoke RPCs, trigger synchronization, audit history, RLS/ACL and legacy backfill. It intentionally does not modify the public Business view, financial display or Dataroom file policy.
- `20260724085657_business_public_financial_redaction_phase_b_v1.sql` — Business Financial Redaction Phase B applied to production; removes exact revenue, EBITDA, growth and numeric asset values from public Business reads, preserves coarse discovery/matching bands, closes direct public base-table access, guards the quality calculator and adds a grant-aware batch summary RPC.
- `20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql` — Phase B compatibility fix applied to production; treats Investor status `hidden` as a public-profile visibility state rather than loss of entitlement, so the authenticated owner can use active Proposal/request grants and submit idempotent financial-data requests.
- `20260724130742_business_dataroom_access_phase_e_stabilization.sql` — Phase E Dataroom stabilization applied to production. It replaces Proposal-based file metadata/Storage reads with an active, unexpired `dataroom` scope, adds an audited file-path RPC and creates no grants.
- `20260724130910_investor_premium_price_v2.sql` — Investor Premium price V2 applied to production. It sets the canonical server price to 26,000,000 VND/month in Vietnam and 1,000 USD/month elsewhere; historical orders and entitlements are unchanged.
- `20260724140213_public_business_view_band_helper_acl_fix_v1.sql` — public Business availability fix applied to production. It restores EXECUTE for anon/authenticated on four immutable, table-free coarse-band helpers required by `public_businesses_safe`; it does not reopen `businesses`, alter RLS, or expose exact financial values.
- `20260724142506_homepage_business_ids_safe_view_v1.sql` — Homepage selector fix applied to production. It replaces the anonymous base-table read in `get_homepage_business_ids` with `public_businesses_safe`, keeps explicit app-role EXECUTE only, and returns public Business IDs without financial values.
- `20260724150019_business_public_ebitda_visibility_v1.sql` — applied to production. It keeps exact Revenue redacted, restores approved EBITDA margin on the public safe view, leaves exact Revenue/other sensitive values outside the public snapshot, and records the presentation-policy change in `audit_logs`.
- `20260727084802_market_partner_affiliate_phase1_v1.sql` — Market Partner/Affiliate Phase 1 source only; creates the account domain, click/attribution/commission/payout ledgers, RLS/ACL, Admin RPCs and confirmed-payment commission guard. **Not applied to production.**
- `20260727103000_market_partner_affiliate_phase2_dashboard_v1.sql` — Market Partner/Affiliate Phase 2 source only; adds owner-only Dashboard aggregates and bank-account self-service RPC. **Not applied to production.**
- `20260727110000_market_partner_affiliate_phase3_referral_v1.sql` — Market Partner/Affiliate Phase 3 source only; creates server-side Business/Investor signup attribution only when a matching active Partner click exists within 30 days. It does not change payment, discount or commission. **Not applied to production.**
- `20260727113000_market_partner_affiliate_phase4_checkout_v1.sql` — Market Partner/Affiliate Phase 4 source only; adds per-Partner X discount and three-tier Y policy, server-side package/term/affiliate repricing, private affiliate payment snapshots and explicit promo non-stacking. It installs no automatic payment/commission trigger. **Not applied to production.**

Rules:

1. Reconcile any production-assigned migration version in Git immediately after apply; once reconciled, never rename it again.
2. All new schema changes must be additive migrations.
3. Do not apply SQL manually without committing the matching migration file.
4. Before merging to `main`, run the Phase A hardening check and compare the Supabase migration ledger with this file.
