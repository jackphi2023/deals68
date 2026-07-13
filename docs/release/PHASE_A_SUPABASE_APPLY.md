# Apply Phase A to Supabase

The repository commit must contain:

- `supabase/migrations/20260713010000_release_candidate_phase_a_hardening.sql`
- the reconciled historical migration filenames;
- the missing `20260712153808` migration.

After the Phase A commit is pushed to `beta-reference`, apply only `20260713010000_release_candidate_phase_a_hardening.sql` to the connected Deals68 Supabase project. Do not apply the `20260713020000` cutover migration yet and do not re-run historical migrations that already exist in the Supabase ledger.

Post-apply checks:

1. `submit_business_proposal` is executable by `authenticated`, not `anon`.
2. Direct Business inserts into `proposals` are denied.
3. `create_signup_bundle_v2` is available and the old signup RPC is not executable by clients.
4. `log_admin_action` requires Admin.
5. `recalculate_business_quality_score` ignores caller-supplied bypass flags.
6. Public storage buckets no longer expose broad object listing policies.
7. Existing public images and site banners still load by URL.


After `main` is merged and Netlify production is confirmed to use `create_signup_bundle_v2`, apply `20260713020000_after_main_cutover_revoke_signup_v1.sql`.
