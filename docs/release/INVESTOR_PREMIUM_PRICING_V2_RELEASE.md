# Deals68 — Investor Premium Pricing V2 Release

Date: 2026-07-24 (Asia/Ho_Chi_Minh)

## Canonical price

- Vietnam: 26,000,000 VND per month.
- Other countries: 1,000 USD per month.
- Standard Investor remains free.
- Existing term discounts and promo-code rules remain unchanged.

## Synchronized surfaces

- Shared frontend constants and pricing calculator.
- Pricing page in Vietnamese and English.
- Investor registration plan selection, totals and CTA wording.
- Investor Dashboard Premium upgrade, totals, payment payload and wording.
- Server-side d68_get_investor_premium_price RPC.
- Static contracts and public pricing E2E expectations.

## Safety boundaries

- No CSS or layout changes.
- No entitlement, Proposal, eNDA, Dataroom or report-access changes.
- No historical payment order is modified.
- The historical Phase 1 migration remains immutable; 20260724130029_investor_premium_price_v2.sql is an additive override.
- Migration is committed but NOT APPLIED until release approval and QA complete.

## Release sequence

1. Build and focused Investor pricing/registration/Admin QA.
2. Regression checks for financial access, Business Reports, routes and CSS.
3. Apply Phase E migration, then the Premium price V2 migration.
4. Verify production RPC prices and financial redaction.
5. Merge the verified building release to main.
6. Verify the Netlify deployment generated from the main commit.
