# Deals68 Phase 1 + 2 + 3 + 4 Upload README

Upload this patch to GitHub root, preserving folders. Do not upload the ZIP itself.

## Includes

- Phase 1: UI Core + Home + Market Partner wording
- Phase 2: Businesses + Business Detail + Quality Score gating
- Phase 3: Investors + Investor Detail + privacy/anonymisation
- Phase 4: Pricing + Valuation + Login + Register + Forgot/Reset Password
- Fix: adds missing `src/styles/design-tokens.css` and `src/styles/app.css`

## Do not upload

- `node_modules/`
- `dist/`
- `package-lock.json`
- `.zip` files

## After upload

Netlify → Deploys → Trigger deploy → Clear cache and deploy site.

## Test routes

- `/`
- `/businesses`
- `/businesses/:slug`
- `/investors`
- `/investors/:code`
- `/pricing`
- `/valuation`
- `/login`
- `/forgot-password`
- `/reset-password`
- `/register/business`
- `/register/investor`
- `/register/advisor`
- `/register/market-partner`
