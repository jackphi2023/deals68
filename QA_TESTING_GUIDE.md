# Deals68 Automated QA Suite

Target branch: `beta-reference`

This patch adds a full automated QA framework for Deals68 based on Spec v1.3 and the business updates in the current session.

## What is covered

1. Public routes, redirects, console errors, link health, wording placeholders, mobile overflow.
2. Pricing logic as shown on Pricing and Register Business/Investor pages.
3. Valuation scope:
   - `/valuation` only asks: country, industry, latest annual revenue, EBITDA margin, revenue growth.
   - No net debt, offer amount or stake on free valuation page.
   - Business Register preview still uses ask/stake for implied valuation.
4. Business registration validation, payment UI, OTP redirect path.
5. Investor registration validation, payment UI, OTP redirect path.
6. Public Business profile rules:
   - Guest sees teaser.
   - Contact and locked docs remain locked.
   - Business Quality Score summary visible; details require logged-in investor.
7. Public Investor profile rules:
   - Guest sees anonymous title/description.
   - Contact rows are locked.
   - Contact unlock wording exists.
8. Dashboard/Admin workflow smoke tests, gated behind env credentials.

## Commands

```bash
npm run build
npm run test:e2e:public
npm run test:e2e
npm run test:report
```

## Run against Netlify preview

```bash
D68_BASE_URL=https://beta-reference-deals68.netlify.app npm run test:e2e:public
```

## Run against local Vite

```bash
D68_USE_LOCAL_SERVER=1 npm run test:e2e:public
```

## Auth/dashboard tests

These tests are skipped by default because they need staging users and may change data.

```bash
D68_E2E_RUN_AUTH=1 \
D68_BASE_URL=https://beta-reference-deals68.netlify.app \
D68_E2E_PASSWORD='...' \
D68_E2E_BUSINESS_LOGIN_EMAIL='business.active@test.local' \
D68_E2E_INVESTOR_LOGIN_EMAIL='investor.active@test.local' \
D68_E2E_ADMIN_EMAIL='admin@test.local' \
D68_E2E_ADMIN_PASSWORD='...' \
npm run test:e2e:auth
```

## Reports

The custom reporter writes:

```text
reports/deals68/test-report.json
reports/deals68/test-report.html
playwright-report/
test-results/
```

## Safe staging requirements

Use a staging Supabase project or seeded test records. Avoid running destructive signup/admin tests on production data.

## Notes

This patch also includes the small Postgrest `.catch()` build compatibility hotfix so `tsc -b` can pass with the existing call sites that use `.catch()` on Supabase query builders.
