# Deals68 final patch — corrected valuation engine + taxonomy + businesses mobile filter

Target branch: `beta-reference`
Date: 2026-07-05

## Scope
This zip supersedes the previous valuation patch and includes the latest mobile `/businesses` filter hotfix.

## Included fixes

1. Corrected Valuation Engine
- `/valuation` only asks for: country, industry, latest annual revenue, EBITDA margin, revenue growth.
- No net debt, offer amount, or stake percentage on the public valuation page.
- Business Register/Dashboard do not ask for net debt.
- Register/Dashboard may still use ask amount + stake percentage already present in the deal workflow to infer self valuation.
- Missing/invalid data returns pending/updating, not fake benchmark values.
- Admin can edit valuation coefficients in `/admin/valuation` via `valuation_config`.

2. 23-industry taxonomy
- Adds shared 23-industry taxonomy from Deals68 Valuation Spec v1.0.
- Used for labels, filters, valuation, business register, business dashboard, investor industry selection, and SEO content.

3. Businesses mobile filter fix
- Adds aggressive mobile hardening to `src/styles/pages/ui-fixes.css`.
- Fixes the screenshot issue where the filter sidebar, clear link, labels, and apply button become a narrow broken column on phone screens.
- Keeps filter full width on mobile, prevents vertical button text, and keeps checkbox/count rows inside the 375px viewport.

## Files changed
- src/components/Header.tsx
- src/App.tsx
- src/lib/industryTaxonomy.ts
- src/lib/labels.ts
- src/lib/labelsBase.ts
- src/lib/numberFormat.ts
- src/lib/valuationEngine.ts
- src/pages/AdminValuation.tsx
- src/pages/BusinessDashboard.tsx
- src/pages/Register.tsx
- src/pages/StaticPages.tsx
- src/pages/Valuation.tsx
- src/styles/pages/dashboard.css
- src/styles/pages/ui-fixes.css
- src/styles/pages/valuation.css
- supabase/migrations/20260705_register_business_assets_signup_bundle.sql
- supabase/migrations/20260705_valuation_engine_and_taxonomy.sql

## Commit message
fix: add corrected valuation engine and mobile business filters

## Apply
```bash
git checkout beta-reference
unzip deals68_final_valuation_taxonomy_mobile_patch_20260705.zip -d /tmp/deals68_final_patch
cp -R /tmp/deals68_final_patch/src ./
cp -R /tmp/deals68_final_patch/supabase ./
npm run build
git status
git add src supabase/migrations
git commit -m "fix: add corrected valuation engine and mobile business filters"
git push origin beta-reference
```

Apply Supabase migrations after code review:
1. `20260705_register_business_assets_signup_bundle.sql`
2. `20260705_valuation_engine_and_taxonomy.sql`

## Routes to test
Public:
- `/businesses`
- `/en/businesses`
- `/valuation`
- `/en/valuation`
- `/register/business`
- `/en/register/business`

Dashboard:
- `/dashboard/business`
- `/dashboard/business/profile`
- `/dashboard/business/files`

Admin:
- `/admin/valuation`
- `/admin/valuation-config`
- `/admin/business-review`

## Mobile checklist
375px:
- `/businesses` filter is full width, not a narrow side column.
- `Bộ lọc` + `Xóa lọc` remain in one header row.
- Keyword input fits viewport.
- Checkbox rows show checkbox + label + count without horizontal overflow.
- `Áp dụng bộ lọc` is a full-width button, not vertical text.
- Valuation form/result stack in one column.
- Register valuation panel and upload sections do not overflow.

768px:
- `/businesses` filter appears above list, full width.
- Listing toolbar stacks cleanly.
- Valuation/admin panels remain readable.

1440px:
- Desktop `/businesses` sidebar remains sticky left.
- Valuation/admin/dashboard desktop layouts preserved.

## Guardrails
- No public data guard loosened.
- Public businesses still require `visible=true`, `status=active`, `public_snapshot_json not null`.
- No private data exposed.
- No Supabase changes applied automatically.
- Build was not run in this chat runtime; run `npm run build` before commit.
