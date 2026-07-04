# Deals68 Phase 1-5 Upload README

Upload this patch into the root of `jackphi2023/deals68` through GitHub Web.

## Included phases

1. UI Core + Home + Market Partner wording
2. Businesses + Business Detail + Quality Score gating
3. Investors + Investor Detail + Privacy/Anonymisation
4. Pricing + Valuation + Login + Register
5. Business Dashboard + Investor Dashboard + Admin Control Center

## Important

Do not upload:
- `.zip`
- `node_modules/`
- `dist/`
- `package-lock.json`
- `tsconfig.app.tsbuildinfo`

## After upload

Netlify → Deploys → Trigger deploy → Clear cache and deploy site.

## Test routes

Public:
- `/`
- `/businesses`
- `/businesses/:slug`
- `/investors`
- `/investors/:code`
- `/pricing`
- `/valuation`
- `/login`
- `/register/business`
- `/register/investor`
- `/register/market-partner`

Dashboards/Admin:
- `/dashboard/business`
- `/dashboard/business/profile`
- `/dashboard/business/files`
- `/dashboard/investor`
- `/dashboard/investor/criteria`
- `/dashboard/investor/privacy`
- `/admin`
- `/admin/businesses`
- `/admin/investors`
- `/admin/payments`
- `/admin/market-partners`
