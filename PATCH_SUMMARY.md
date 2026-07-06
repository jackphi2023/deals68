# Patch Summary — Business Quality Score v1

## Added files

- `supabase/migrations/20260706_business_quality_score_v1.sql`
- `src/lib/businessQuality.ts`
- `scripts/apply-business-quality-score-v1.mjs`
- `patches/business-quality-score-ui.diff`
- `QA_BUSINESS_QUALITY_SCORE_GUIDE.md`

## Scope

Implements Business Quality Score 100-point calculation and display:

- Profile completeness: 15
- Financial data quality: 20
- Supporting documents: 20
- Images: 10
- Valuation & offer reasonableness: 25
- Transaction/connection readiness: 10

## Public rule

- Guest: sees only assessment categories/explanation.
- Logged-in Investor: sees detailed score per criterion.
- Admin: can manually keep a 0-100 score override.

## Risks

- Existing UI files are patched by script/diff, not pushed directly.
- Run `npm run build` after applying.
- Apply SQL migration before relying on `quality_breakdown_json`.
