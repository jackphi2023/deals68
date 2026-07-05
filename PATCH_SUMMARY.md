# Deals68 combined patch — public UI + Register + Business Dashboard

Target branch: `beta-reference`

This combined patch merges every patch prepared in this chat session and adds the latest Business Dashboard valuation/numeric-input update.

## Files included

1. `src/components/Header.tsx`
   - Logged-in public header shows Logout only, no Dashboard link.
   - Mobile hamburger uses React state and closes after navigation/language switch/logout.

2. `src/styles/pages/ui-fixes.css`
   - Header mobile hotfix.
   - `/businesses` mobile guard.
   - Home Featured Industries + Featured Investors card alignment.
   - Register Business richer intake styles.

3. `src/pages/StaticPages.tsx`
   - Static pages copy tightened for About/Terms/Privacy/Market Partner in VN/EN.

4. `src/pages/Valuation.tsx`
   - Cleaner VN labels, privacy/admin-approval note, valuation disclaimer.
   - Numeric inputs use readable thousand separators while keeping calculation-safe numeric values.

5. `src/styles/pages/valuation.css`
   - Mobile-safe valuation form and notes.

6. `src/pages/Register.tsx`
   - Business register adds images/docs intake, assets/data-source fields, valuation reasonableness guidance, detailed pricing/payment section.
   - All numeric inputs in Register use readable thousand separators while saving clean numeric values.

7. `supabase/migrations/20260705_register_business_assets_signup_bundle.sql`
   - Updates `create_signup_bundle` so `financial_input` from Register Business is saved to `businesses.financial_input` and retained in `pending_changes_json`.
   - Does not change public data guard.

8. `src/pages/BusinessDashboard.tsx`
   - Menu icons aligned closer to UI Reference using `lucide-react`.
   - Overview valuation box added above Business Quality Score:
     - Business value = ask amount / stake percent.
     - Industry benchmark = median valuation from public active listings with same country, same industry, and similar revenue band when enough peer data exists.
   - Business Quality Score copy changed per request.
   - Quality checklist shows required submitted/missing files/data; missing items are orange.
   - Status displays `Hiển thị/Đang ẩn` instead of raw DB status.
   - Plan displays `Thường/Ưu tiên` instead of raw plan.
   - Metrics changed to proposals sent/approved and investor attention count.
   - Documents tab supports editing and saving display file names.
   - Upload document UI requires a display name before/alongside file upload.
   - VCPC support copy updated.
   - Numeric inputs in Business Dashboard profile use readable thousand separators while posting clean numeric hidden values.

9. `src/styles/pages/dashboard.css`
   - Dashboard menu/icon styles.
   - Quality checklist styles.
   - Document rename/upload styles.
   - Overview valuation box styles with light logo-blue background and yellow valuation numbers.
   - Mobile guards for 375/768 widths.

## Guardrails

- No Admin page logic changed.
- No Public Business guard changed.
- No Dashboard approval/public snapshot guard changed.
- No RLS policies changed.
- No mock runtime introduced.
- Public listing filter remains: `visible=true`, `status=active`, `public_snapshot_json is not null`.
- Benchmark uses only public active business records; no private business data is exposed.

## Apply commands

```bash
git checkout beta-reference
unzip deals68_combined_patch_20260705.zip -d /tmp/deals68_combined_patch
cp -R /tmp/deals68_combined_patch/src ./
cp -R /tmp/deals68_combined_patch/supabase ./
npm run build
git status
git add \
  src/components/Header.tsx \
  src/pages/BusinessDashboard.tsx \
  src/pages/Register.tsx \
  src/pages/StaticPages.tsx \
  src/pages/Valuation.tsx \
  src/styles/pages/dashboard.css \
  src/styles/pages/ui-fixes.css \
  src/styles/pages/valuation.css \
  supabase/migrations/20260705_register_business_assets_signup_bundle.sql
git commit -m "fix: align register home and business dashboard workflows"
git push origin beta-reference
```

Then apply the Supabase migration through the normal Supabase CLI/migration process for the `deals68` project.

## Route tests

Public VI:
- `/`
- `/businesses`
- `/valuation`
- `/about`
- `/terms`
- `/privacy`
- `/market-partner`
- `/register/business`
- `/register/investor`

Public EN:
- `/en`
- `/en/businesses`
- `/en/valuation`
- `/en/about`
- `/en/terms`
- `/en/privacy`
- `/en/market-partner`
- `/en/register/business`
- `/en/register/investor`

Dashboard:
- `/dashboard/business`
- `/dashboard/business/profile`
- `/dashboard/business/files`
- `/dashboard/business/images`
- `/dashboard/business/investor-interest`
- `/dashboard/business/data-requests`
- `/dashboard/business/payments`

## Mobile checklist

375px:
- Home featured industries = 1 column, no horizontal overflow.
- Home investor cards = 1 column, CTA not broken.
- Register Business upload/file rows stack cleanly.
- Dashboard sidebar becomes 2-column menu; icons do not break.
- Dashboard valuation box stacks into 1 column.
- Dashboard document rename/upload rows do not overflow.

768px:
- Home cards = 2 columns where applicable.
- Register Business sections remain readable.
- Dashboard sidebar appears above content.
- Dashboard metrics use 2 columns.

1440px:
- Home industry cards = 3 columns.
- Home investor cards = 4 columns.
- Register max width stays centered.
- Dashboard sidebar sticky left; overview valuation + quality score + metrics align cleanly.

## Notes

- I did not commit or push this patch.
- I did not run a real `npm run build` in the target repo runtime, so do not treat this as a build-pass claim until you run it locally/CI.
