# Deals68 UX Fix Patch — Navigation, Proposal, Investor Dashboard

## Files patched by script

- `src/components/Header.tsx`
- `src/App.tsx`
- `src/pages/InvestorDetail.tsx`
- `src/pages/BusinessDashboard.tsx`
- `src/pages/InvestorDashboard.tsx`

## Fixes

1. Navigation
- Guest sees: Đăng nhập + Đăng ký.
- Logged-in business/investor/admin sees Dashboard button in global nav.
- Removes global Log out from Header.
- Logout remains inside dashboards and is made darker.

2. Investor profile CTA
- Business user logged in can send profile directly from investor public profile.
- Inserts into `proposals`.
- Shows success date/time message.
- Disables button after already sent.
- Duplicate proposal is handled by existing unique constraint `(business_id, investor_id)`.

3. Business dashboard
- Proposal tab shows sent proposals.
- Investor interests still shown below.

4. Investor dashboard
- Adds internal fund/investor name (`private_name`) and Website (`private_website`) in Profile tab.
- Updates private DB fields immediately; public profile updates still go through `pending_profile_changes`.
- Moves the admin approval/anonymous notice to bottom above submit button.
- Adds `/en/dashboard/...` routes to avoid 404 when switching language from dashboards.

## Supabase checks already confirmed

- `proposals` has unique `(business_id, investor_id)`.
- Business can insert proposals through existing RLS policy.
- `investors.private_name` and `investors.private_website` already exist.
