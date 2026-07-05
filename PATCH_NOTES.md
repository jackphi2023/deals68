# Deals68 beta-reference static/admin hardening patch

## Scope
- Port remaining static pages: About, Terms, Privacy, Contact, Market Partner.
- Add mobile-safe CSS for static pages.
- Add Admin leads tab for Contact and Market Partner submissions.
- Add dashboard payment gate in App routes so Business/Investor dashboards require `dashboard_login_enabled=true` unless admin.
- Keep existing public Home/Businesses/Business Detail/Investors/Pricing/Valuation/Auth routes unchanged except route gate.

## Supabase migrations already applied
- `create_static_page_leads`: creates `contact_messages` and `partner_leads` with public insert and admin read/update RLS.
- `add_public_workflow_rpcs`: creates RPCs `submit_business_proposal` and `approve_business_public_snapshot` to match existing frontend helpers and the real schema (`proposals.message`, not `note`).

## Files
- `src/App.tsx`
- `src/pages/Admin.tsx`
- `src/pages/StaticPages.tsx`
- `src/styles/index.css`
- `src/styles/pages/admin.css`
- `src/styles/pages/static.css`

## Test routes
- `/about`, `/en/about`
- `/terms`, `/en/terms`
- `/privacy`, `/en/privacy`
- `/contact`, `/en/contact`
- `/partners`, `/en/partners`
- `/market-partner`, `/en/market-partner`
- `/admin/leads`
- `/dashboard/business` before and after admin payment confirmation
- `/dashboard/investor` before and after admin payment confirmation

## Mobile checks
- 375px: no horizontal overflow on static forms, Admin tables scroll horizontally, Admin side nav stacks.
- 768px: static cards and contact form collapse cleanly.
- 1440px: static grid/card spacing matches Deals68 design language.
