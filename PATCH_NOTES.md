# Deals68 VN/EN UI + Data Label + Register RLS Fix Patch

Branch target: beta-reference
Commit message:
fix(beta-reference): normalize vn en labels and repair register investor detail ui

## Scope

This patch aligns the current UI with Spec v1.3 + Master UI Standard without changing public/private data guards.

## Files

- public/assets/logo-nav.png
- src/App.tsx
- src/components/Header.tsx
- src/contexts/AuthContext.tsx
- src/lib/data.ts
- src/lib/labels.ts
- src/pages/Home.tsx
- src/pages/Businesses.tsx
- src/pages/Investors.tsx
- src/pages/InvestorDetail.tsx
- src/pages/Register.tsx
- src/styles/index.css
- src/styles/base.css
- src/styles/pages/ui-fixes.css
- docs/DEALS68_LABEL_MAPPING.md
- supabase/migrations/20260705_create_signup_bundle_rpc.sql

## Fixed

1. Navigation language memory:
   - User switching EN stores `d68_lang=en`.
   - Public route navigation preserves `/en/...`.
   - Switching back VI stores `d68_lang=vi`.

2. Logo:
   - Generated transparent PNG from user-provided logo.
   - Header now uses `/assets/logo-nav.png`.

3. Home:
   - Hero title first line remains white.
   - `Nhà đầu tư / Investors` is on a new line and remains gold.
   - Total deal value: VI = VND only; EN = USD only.
   - Deal cards render revenue/ask by selected language/currency.
   - Featured investor cards use UI-standard card/button hover.

4. Label mapping:
   - Centralized in `src/lib/labels.ts`.
   - Covers industry, country, region, investor type, stage, business deal type, investor-side deal type.
   - Adds Finance / Tài chính.
   - Docs added at `docs/DEALS68_LABEL_MAPPING.md`.

5. Business & Investor list:
   - Sort label stays one line.
   - Business industries/countries/deal types are mapped to current language.
   - Investor list maps ticket/industry/deal type/stage/country to current language.
   - Investor deal type filter added.

6. Register:
   - Business copy updated.
   - Investor copy updated.
   - Business plan labels: Thường / Ưu tiên.
   - Investor deal types are multi-select from investor perspective.
   - Preferred investment markets added.
   - Phone field has country dial prefix.
   - Label/form spacing hardened.
   - RLS profile insert issue fixed by moving registration bundle creation to RPC.

7. Investor detail:
   - Reworked to match reference structure more closely.
   - Left box contains profile code.
   - Interest scope contains sectors/markets/deal types.
   - Removed text mentioning "database".
   - Information access moved to right sidebar.
   - Proposal history/status is displayed without fabricating private numbers.

## Supabase

Already applied migration in project `tucaqhsfdjbclxqaoxio`:

- `public.create_signup_bundle(...)`

The function creates profile + hidden pending business/investor + payment order in one security-definer workflow, keeping public visibility disabled until Admin approval.

## Checks

- TypeScript transpileModule check: PASS
- Full `npm run build`: must be confirmed by Netlify/local because the active repo dependencies are not installed in this sandbox.
