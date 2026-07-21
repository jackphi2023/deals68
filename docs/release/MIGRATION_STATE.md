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

The new Release Candidate migration is:

- `20260713010000_release_candidate_phase_a_hardening.sql` — apply before production code cutover.
- `20260713020000_after_main_cutover_revoke_signup_v1.sql` — apply only after Netlify production serves the v2 frontend.
- `20260717101552_investor_appetite_moderation_v1.sql` — additive Session 7 migration; apply after the Investor Profile V2 migrations so bilingual Investment appetite waits for Admin approval.
- `20260717143000_business_city_key_public_flow_v1.sql` — additive Session 4 migration; apply before testing the canonical Business location filter.
- `20260717215300_business_public_financial_snapshot_v1.sql` — additive Session 8 migration; stores only Admin-approved asset fields in the public Business snapshot and preserves the safe view contract.
- `20260721093859_ai_report_phase1_foundation_v1.sql` — additive AI Report Phase 1 foundation; adds file-processing, listing-authority, preflight and alert schemas with Business/Admin RLS. Missing or insufficient broker authority remains non-blocking and requires a mandatory report notice.
- `20260721101214_ai_report_phase2_evidence_foundation_v1.sql` — additive AI Report Phase 2 evidence foundation; separates self-declared values with `q_source = 0`, stores document-backed facts with citations/confidence, queues Business files for processing, and adds request reservation storage with Business/Admin RLS.
- `20260721101436_ai_report_phase2_preflight_rate_limit_v1.sql` — additive AI Report Phase 2 deterministic preflight and request gate; enforces active/visible Business ownership, data/entity/authority checks, mandatory broker authorization notices, idempotency, and no more than one completed Business report create-download workflow per rolling 60 minutes. Failed workflows do not consume the limit.

Rules:

1. Never rename a migration after it is applied to Supabase.
2. All new schema changes must be additive migrations.
3. Do not apply SQL manually without committing the matching migration file.
4. Before merging to `main`, run the Phase A hardening check and compare the Supabase migration ledger with this file.
