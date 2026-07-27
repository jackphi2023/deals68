# Market Partner / Affiliate v1 — Phase 5 release review

Status: source complete on `feature/market-partner-affiliate-v1`; production migration and branch merges remain gated by production verification.

## Lifecycle

1. Admin creates or converts an active Market Partner and configures X/Y.
2. Partner claims the account with the exact approved email and affiliate code, then verifies email OTP.
3. Phase 4 stores an immutable server-side X/Y snapshot in the payment order.
4. When the payment becomes confirmed, Phase 5 creates exactly one pending commission using that snapshot.
5. Affiliate reconciliation failures are audited and never roll back Business/Investor service activation.
6. Admin approves or rejects pending commission.
7. Admin groups approved, unassigned commission records for one Partner and currency into a payout draft.
8. Payout moves through approved/processing/paid. Marking paid atomically marks its commission and attribution records paid.

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
