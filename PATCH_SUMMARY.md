# Deals68 AI Automated Test Suite Patch — 2026-07-06

Target branch: beta-reference

## Scope
Adds automated QA infrastructure for Spec v1.3 + all business updates in this session.

## Files included
- package.json
- playwright.config.ts
- QA_TESTING_GUIDE.md
- .gitignore.deals68-tests
- scripts/deals68-print-latest-report.mjs
- tests/specs/deals68-v1_3-contract.json
- tests/reporters/deals68-reporter.ts
- tests/helpers/deals68.ts
- tests/e2e/00-public-smoke.spec.ts
- tests/e2e/01-pricing-valuation.spec.ts
- tests/e2e/02-register-business.spec.ts
- tests/e2e/03-register-investor.spec.ts
- tests/e2e/04-public-profile-rules.spec.ts
- tests/e2e/05-dashboard-admin-workflows.spec.ts
- src/lib/supabase.ts
- src/types/postgrest-catch.d.ts

## Also included
Small Netlify build hotfix:
- Adds Postgrest `.catch()` type/runtime compatibility so existing Supabase builder `.catch()` call sites compile under `tsc -b`.

## Commands
```bash
npm run build
D68_BASE_URL=https://beta-reference-deals68.netlify.app npm run test:e2e:public
npm run test:report
```

## Commit message
test: add automated qa suite for deals68 beta
