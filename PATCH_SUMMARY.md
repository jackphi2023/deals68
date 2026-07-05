# Deals68 patch — Business signup OTP login flow

Target branch: `beta-reference`

This patch is based on the previous combined Business Flow patch and adds the corrected Supabase Email OTP authentication workflow requested in `Deals68_Auth_Flow_Supabase_OTP.md`.

## Scope

- Keep previous fixes: valuation corrected scope, 23-industry taxonomy, VN/location taxonomy, mobile business filters, Business Register pricing/payment, Business Detail public display cleanup.
- Add signup OTP flow:
  - Register Business/Investor still creates Auth user + private profile/listing/payment order.
  - After submit, user is redirected to `/login?otp=1&email=...&next=...`.
  - Login page shows Email + Password + OTP input with wording: “Hãy nhập mã OTP đã gửi đến Email của Anh/Chị dưới đây.”
  - `verifyOtp({ type: 'signup' })` creates a Supabase session, activates dashboard login, then redirects to the proper dashboard.
- Add resend signup OTP with 60-second cooldown.
- Add recovery OTP flow:
  - `/forgot-password` sends reset OTP.
  - `/reset-password` asks Email + OTP + New password + Confirm.
  - `verifyOtp({ type: 'recovery' })` then `updateUser({ password })`.

## Important Supabase configuration

This patch expects Supabase Auth Email templates to use `{{ .Token }}` for Confirm signup and Reset password, not magic-link-only templates. Also configure SMTP because Supabase default email limits are low.

## Files changed

- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/pages/ForgotPassword.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/Register.tsx`
- `src/styles/pages/ui-fixes.css`
- Previous Business Flow files remain included in this combined zip.
- `supabase/migrations/20260705_register_business_assets_signup_bundle.sql` now sets new profiles to `pending_admin_review` and `dashboard_login_enabled=true`; email verification remains the actual login gate because no session exists before OTP verification.

## Known implementation note

When Supabase Email OTP is enabled, `auth.signUp` usually does not return a session. Because private storage upload requires an authenticated session and RLS owner checks, file/image bytes selected on Register cannot be uploaded before OTP verification unless a secure backend/service-role upload endpoint is added. This patch stores the upload plan metadata and tells users to upload files/images again in Dashboard after OTP login if no session exists at signup time.

## Suggested commit message

`fix: add signup otp login flow for business accounts`

## Test routes

- `/register/business`
- `/en/register/business`
- `/login?role=business&otp=1`
- `/forgot-password?role=business`
- `/reset-password`
- `/dashboard/business`
- `/admin/business-review`
- `/businesses`
- `/valuation`

## Manual QA checklist

1. Register a business with a fresh email.
2. Confirm Supabase sends Confirm signup OTP.
3. Browser redirects to `/login` and shows OTP prompt.
4. Enter email + password + OTP.
5. User lands on `/dashboard/business`.
6. Business row remains `visible=false`, `status=pending_admin_review`, `public_snapshot_json=null`.
7. Admin can still approve public snapshot later.
8. Forgot password sends recovery OTP.
9. Reset password works from `/reset-password` with Email + OTP + new password.
10. Mobile 375px: Login OTP form and Register payment section do not overflow.
