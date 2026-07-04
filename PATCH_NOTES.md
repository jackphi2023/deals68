# Deals68 UI reference patch — Login + Business/Investor Dashboards

Target repo: `jackphi2023/deals68`

## Reference files read directly

- `ui-reference/Deals68 Login.dc.html` — SHA `99bfbd2733ed8298c2fc8991ba169162acb42ad6`
- `ui-reference/Deals68 Business Dashboard.dc.html` — SHA `ae60741a7aacdc7cd1c69521e2c64b21fe5688fa`
- `ui-reference/Deals68 Investor Dashboard.dc.html` — SHA `f9fec3e409eafab3583a0eef1670a8ac84dedd85`

## Files included

- `src/pages/Login.tsx`
- `src/pages/BusinessDashboard.tsx`
- `src/pages/InvestorDashboard.tsx`

## What changed

### Login

Ported the reference login body structure:

1. Centered login page
2. VI/EN switch
3. Role tabs: Business, Investor, Advisor, Market Partner
4. Login form
5. Gated/account pending state
6. Demo account hint
7. Register link per role

Kept production logic:

- `useAuth().signIn`
- role-based dashboard redirects
- `next` query param redirect
- `/forgot-password` route

### Business Dashboard

Ported the reference dashboard structure:

1. Dashboard title/top status bar
2. Side nav
3. Overview
4. Business Quality Score card
5. KPI cards
6. Proposal quota card
7. Profile/Data Center editable fields
8. Documents upload/list
9. Images upload grid
10. Investor interests
11. Data requests
12. Services & Billing

Kept production logic:

- `getMyBusiness`
- `business_files`, `business_images`, `request_data`, `investor_interests`
- `uploadBusinessFile`
- `uploadBusinessImage`
- `pending_changes_json` + `pending_admin_review` for sensitive profile edits
- accept/reject investor interests
- fulfill data requests

### Investor Dashboard

Ported the reference dashboard structure:

1. Dashboard title
2. Side nav
3. Investor profile edit
4. Investment criteria + recommended matches
5. Watchlist/saved businesses
6. Alerts
7. Contact & privacy
8. Security/proposals summary

Kept production logic:

- `getInvestorByOwner`
- `listBusinesses`
- `computeFitScore`
- `saved_businesses`, `proposals`, `request_data`, `investor_interests`
- investor privacy update
- save business / request data / proposal status update

## Local checks

TSX syntax transpile check:

```text
PASS Login.tsx
PASS BusinessDashboard.tsx
PASS InvestorDashboard.tsx
```

Full `npm run build` was not executed in this sandbox because the environment does not have the full repo/node_modules available.

## Apply

From repo root:

```bash
unzip deals68_login_dashboard_patch.zip -d /tmp/deals68-login-dashboard

cp -f /tmp/deals68-login-dashboard/src/pages/Login.tsx src/pages/Login.tsx
cp -f /tmp/deals68-login-dashboard/src/pages/BusinessDashboard.tsx src/pages/BusinessDashboard.tsx
cp -f /tmp/deals68-login-dashboard/src/pages/InvestorDashboard.tsx src/pages/InvestorDashboard.tsx

npm run build
```

Recommended smoke test:

```text
/login
/login?role=business
/login?role=investor
/dashboard/business
/dashboard/business/profile
/dashboard/business/files
/dashboard/business/images
/dashboard/business/financials
/dashboard/investor
/dashboard/investor/profile
/dashboard/investor/recommended
/dashboard/investor/saved
```
