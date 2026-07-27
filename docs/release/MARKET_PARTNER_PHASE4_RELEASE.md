# Market Partner / Affiliate v1 — Phase 4 release review

Status: source complete on `feature/market-partner-affiliate-v1`; not applied to Supabase production and not merged into `building` or `main`.

## Commercial policy

- X is configured per Partner and defaults to 40% customer discount.
- X is applied after the package term discount.
- Partner code and promo code cannot be combined.
- Y is calculated on the customer net paid amount using a per-Partner basis currency, two thresholds and three percentages.
- Default VND tiers: below 20,000,000 = 40%; 20,000,000 through 50,000,000 = 50%; above 50,000,000 = 60%.

## Security boundary

- Package price, term discount, X discount and net paid amount are recomputed by PostgreSQL.
- The payment order receives a server-validated private affiliate snapshot.
- Invalid or expired referral clicks do not receive an affiliate discount.
- Phase 4 installs no payment or commission trigger.
- Commission creation remains idempotent and requires a confirmed payment plus a matching server affiliate snapshot.
- Currency mismatches fail closed for Admin FX reconciliation.

## Verification

Exact-tree workflow `30263653949` passed:

- production TypeScript/Vite build;
- release QA;
- CSS architecture QA;
- migration registry QA;
- Market Partner Phase 1–3 PostgreSQL contract;
- Market Partner Phase 4 PostgreSQL checkout/tier contract;
- `git diff --check`.

Verified examples:

- Business Standard, 4 weeks, VND: 2,000,000 subtotal; X40% = 800,000; net paid = 1,200,000.
- Business Standard, 8 weeks, VND: 4,000,000 subtotal; 15% term discount; 3,400,000 eligible; X40% = 1,360,000; net paid = 2,040,000.
- Y boundary results: 19,999,999 → 40%; 20,000,000 → 50%; 50,000,000 → 50%; 50,000,001 → 60%.
