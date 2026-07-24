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
- The historical Phase 1 migration remains immutable; 20260724130910_investor_premium_price_v2.sql is an additive override.
- Migration version `20260724130910` is applied to production and verified through the canonical RPC.

## Release status

- Build and focused Investor pricing/registration/Admin QA: PASS.
- Financial Access A–E, Business Reports, routes and CSS regressions: PASS.
- Phase E production migration: APPLIED as version `20260724130742`.
- Premium price V2 production migration: APPLIED as version `20260724130910`.
- Production RPC verification: 26,000,000 VND/month in Vietnam and 1,000 USD/month elsewhere.
- Public financial redaction verification: PASS.
- Main merge and Netlify deployment verification: pending the final release cutover.
