# Deals68 Admin + Static Pages UI Reference Patch

Generated: 2026-07-04

## Scope

This patch ports the following React pages toward their approved `ui-reference/*.dc.html` sources:

- `src/pages/Admin.tsx`
  - Source of truth: `ui-reference/Deals68 Admin.dc.html`
  - Keeps production Supabase admin operations from the existing React page.
  - Ports the dark Admin header, left-side admin nav, overview cards, approvals/payment gate, business review, promo, payments, quality, requests, market partner, audit/settings style.

- `src/pages/StaticPages.tsx`
  - Source of truth:
    - `ui-reference/Deals68 About.dc.html`
    - `ui-reference/Deals68 Terms.dc.html`
    - `ui-reference/Deals68 Privacy.dc.html`
    - `ui-reference/Deals68 Contact.dc.html`
    - `ui-reference/Deals68 Market Partner.dc.html`
  - Ports body sections only because `App.tsx` already wraps pages with shared React Header/Footer.
  - Keeps React Router links instead of `.dc.html` links.

## Validation performed

Syntax/transpile check only:

```txt
PASS src/pages/Admin.tsx
PASS src/pages/StaticPages.tsx
```

Full `npm run build` and visual diff were not run in this sandbox because the full repo and node_modules are not available here.

## Apply

From repo root:

```bash
unzip deals68_admin_static_patch.zip -d /tmp/deals68-admin-static

cp -f /tmp/deals68-admin-static/src/pages/Admin.tsx src/pages/Admin.tsx
cp -f /tmp/deals68-admin-static/src/pages/StaticPages.tsx src/pages/StaticPages.tsx

npm run build
```

## Suggested routes to test

```txt
/admin
/admin/approvals
/admin/businesses
/admin/investors
/admin/payments
/admin/promo
/admin/quality-criteria
/admin/data-requests
/admin/market-partners
/about
/terms
/privacy
/contact
/partners
/market-partner
```

## Notes

- Shared Header/Footer are intentionally not duplicated inside static pages.
- Admin page includes its own dark admin header, matching reference admin layout.
- Some Admin submodules remain simplified UI wrappers over current Supabase tables; deeper features like full SEO/import/email queue/feature flags can be wired in the next iteration.
