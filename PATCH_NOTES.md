# Deals68 beta-reference patch: Dashboard + Admin workflows

Scope per Spec v1.3:
- Business Dashboard
- Investor Dashboard
- Admin
- Register payment-order workflow
- CSS imports for dashboard/admin

No changes to public Home/Businesses/Business Detail/Investors/Investor Detail/Pricing/Valuation/Auth UI except Register payment-order creation and CSS import entry.

## Workflow covered
1. User registers Business/Investor.
   - Creates Supabase Auth user + profile.
   - Creates business/investor row hidden/pending.
   - Creates payment_orders row with status=pending.
2. Admin confirms payment.
   - payment_orders.status=confirmed.
   - profiles.status=active, dashboard_login_enabled=true.
   - listing remains pending Admin public review.
3. Business user edits dashboard.
   - Changes saved to businesses.pending_changes_json.
   - Existing public_snapshot_json remains unchanged.
   - Existing visible/status active is preserved when a public snapshot already exists.
4. Admin approves Business public snapshot.
   - public_snapshot_json updated.
   - visible=true, status=active.
   - pending_changes_json cleared.
   - moderation_status=approved.
5. Investor user edits dashboard.
   - Changes saved in investors.privacy.pending_profile_changes.
   - Public investor fields remain unchanged.
6. Admin approves Investor profile.
   - Pending changes applied to public investor fields.
   - visible=true, status=active.
   - pending_profile_changes cleared.

## Files
- src/pages/BusinessDashboard.tsx
- src/pages/InvestorDashboard.tsx
- src/pages/Admin.tsx
- src/pages/Register.tsx
- src/styles/index.css
- src/styles/pages/dashboard.css
- src/styles/pages/admin.css

## Test routes
- /register/business
- /register/investor
- /login
- /dashboard/business
- /dashboard/investor
- /admin/payments
- /admin/business-review
- /admin/investors
- /admin/assets

## Netlify
Run Clear cache and deploy site after upload.
