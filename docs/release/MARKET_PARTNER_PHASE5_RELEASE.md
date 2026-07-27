# Market Partner / Affiliate v1 — Phase 5 release review

Status: source complete and all five migrations applied and verified on production; branch merges remain gated by post-reconciliation QA.

## Lifecycle

1. Admin creates or converts an active Market Partner and configures X/Y.
2. A generic preflight validates the exact active, unclaimed email/code pair before Auth signup; Partner then claims the account and verifies email OTP.
3. Phase 4 stores an immutable server-side X/Y snapshot in the payment order.
4. When the payment becomes confirmed, Phase 5 creates exactly one pending commission using that snapshot.
5. Affiliate reconciliation failures are audited and never roll back Business/Investor service activation.
6. Admin approves or rejects pending commission.
7. Admin groups approved, unassigned commission records for one Partner and currency into a payout draft.
8. Payout moves through approved/processing/paid. Marking paid atomically marks its commission and attribution records paid.

## Production schema collision handling

Production contained empty generic placeholder tables named `affiliate_clicks` and `affiliate_payouts` with an incompatible Business/Investor payload schema. Phase 1 preserves them unchanged in the locked `d68_legacy` schema before creating the Market Partner tables. No rows are deleted and the archive schema is not granted to public, anon or authenticated roles.

## Security boundaries

- Frontend never inserts or updates commission/payout tables directly.
- Partner cannot change X, Y, commission status or payout status.
- Account claiming cannot convert an existing Business/Investor profile to `market_partner`.
- Partner Dashboard does not receive customer identity, profile ID, payment order ID, raw payment payload or policy snapshot.
- Paid commission and terminal payout statuses are immutable.
- Payment reference and a complete Partner bank account are required before marking payout paid.

## Phase 4 inheritance

Commission uses the payment-time snapshot, not the current Partner policy. A later Admin change to X/Y affects only later payment quotes and does not recalculate historical commission.

## Exact-tree verification

Workflow `30268239599` passed on the complete Phase 1–5 tree:

- production TypeScript/Vite build;
- release and package QA;
- CSS architecture QA;
- migration registry QA;
- Phase 1–3 PostgreSQL/RLS contracts;
- Phase 4 server pricing and X/Y boundary tests;
- Phase 5 Partner account claim, immutable snapshot, automatic commission, non-blocking reconciliation failure, commission approval and payout-to-paid lifecycle;
- `git diff --check`.


## Production verification — 27 July 2026

Applied ledger versions:

- `20260727143814` — Phase 1 foundation and collision-safe legacy archive;
- `20260727143921` — Phase 2 Partner Dashboard;
- `20260727143956` — Phase 3 referral attribution;
- `20260727144031` — Phase 4 server-side X/Y checkout;
- `20260727144122` — Phase 5 activation, commission and payout.

Verified after apply:

- the five Market Partner tables, enum role, functions and confirmed-payment trigger exist;
- the two incompatible empty placeholder tables are preserved in locked `d68_legacy`;
- all new ledgers contain zero rows at cutover;
- RLS is enabled on all five tables and anon cannot select them;
- anon/authenticated cannot use the legacy archive schema;
- public activation RPCs return only generic true/false or perform nonce-bound claim; Admin/financial RPCs are not executable by anon.
