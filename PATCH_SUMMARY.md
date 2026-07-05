# Deals68 Netlify Build Hotfix — Postgrest `.catch()` TS errors

Target branch: beta-reference
Commit message: fix: unblock Netlify build postgrest catch types

## Reason
Netlify build fails during `tsc -b` because several files call `.catch()` on Supabase Postgrest query builders. Runtime code uses Supabase query builders as Promise-like objects, but TypeScript definitions expose `then()` without `catch()` on `PostgrestBuilder` / `PostgrestFilterBuilder` / `PromiseLike`.

Errors fixed:
- src/pages/BusinessDetail.tsx(123,16)
- src/pages/InvestorDetail.tsx(75,107)
- src/pages/Login.tsx(88,98)
- src/pages/Register.tsx(279,144)

## Files
- src/lib/supabase.ts
- src/types/postgrest-catch.d.ts

## What changed
1. Adds a runtime compatibility shim in `src/lib/supabase.ts` that installs a `.catch()` method on the Supabase Postgrest builder prototype. It delegates to `Promise.resolve(this).catch(...)`.
2. Adds TypeScript module/global declarations so `tsc -b` accepts the existing `.catch()` call sites.

## Scope guard
- No changes to Business/Register/Dashboard/Admin/Public data logic.
- No changes to Supabase RLS/RPC/migrations.
- No changes to UI.

## Apply
```bash
git checkout beta-reference
unzip deals68_netlify_build_hotfix_20260706.zip -d /tmp/deals68_build_hotfix
cp -R /tmp/deals68_build_hotfix/src ./
npm run build
git status
git add src/lib/supabase.ts src/types/postgrest-catch.d.ts
git commit -m "fix: unblock Netlify build postgrest catch types"
git push origin beta-reference
```

## Test
- npm run build
- /businesses/:slug
- /investors/:code
- /login?role=business&otp=1
- /register/investor
