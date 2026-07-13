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

The new Release Candidate migration is:

- `20260713010000_release_candidate_phase_a_hardening.sql` — apply before production code cutover.
- `20260713020000_after_main_cutover_revoke_signup_v1.sql` — apply only after Netlify production serves the v2 frontend.

Rules:

1. Never rename a migration after it is applied to Supabase.
2. All new schema changes must be additive migrations.
3. Do not apply SQL manually without committing the matching migration file.
4. Before merging to `main`, run the Phase A hardening check and compare the Supabase migration ledger with this file.
