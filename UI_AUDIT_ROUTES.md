# Deals68 UI Audit — Master UI Standard Reconcile Patch

Date: 2026-07-05
Branch target: `beta-reference`

## Scope audited

Routes:

- `/`
- `/en`
- `/register/business`
- `/register/investor`
- `/login`
- `/admin/login`
- `/investors`
- `/en/investors`
- `/dashboard/business`
- `/dashboard/business/profile`

## Master UI criteria applied

1. Single source CSS through `src/styles/index.css`.
2. Token-first styling via `design-tokens.css` and `base.css`.
3. UI Reference layout order must be preserved.
4. No private data leakage on public pages.
5. Forms must use stable field/card classes and collapse to 1 column on mobile.
6. Navigation state must reflect logged-in/logged-out state.
7. No public Advisor UX until the Advisor product flow is implemented.
8. Admin login is hidden from public login tabs and remains accessible by URL.

## Result by route

### `/` and `/en`

Status after this patch: PASS with route-specific fixes.

Fixes included:

- Navigation logo uses transparent SVG asset.
- Hero keyword `Nhà đầu tư` / `Investors` is forced to a new line and keeps gold color.
- Total deal value is language-specific:
  - VI: VND only.
  - EN: USD only.
- Business card Ask value is language-specific:
  - VI: VND equivalent.
  - EN: USD equivalent.
- Featured industries CSS is tightened to match the UI Reference tile/card system.
- Featured investor cards use dedicated classes and hover CTA turns gold.
- Header shows Dashboard + Log out after login; shows Login/Register only when logged out.
- Advisor registration is removed from the public header.

Risk left:

- Final visual confirmation still requires Netlify preview at 1440 / 768 / 375.

### `/register/business`

Status after this patch: PASS structure-level, pending Netlify visual check.

Fixes included:

- Register fields use `.d68-auth-field` consistently.
- Agreement row uses `.d68-agree` consistently.
- Form grid uses the master responsive system: 2 columns desktop, 1 column mobile.
- Card width/padding adjusted to avoid broken layout on mobile.
- Existing workflow logic remains unchanged: Auth user + profile/listing + payment order pending.

Risk left:

- Real Supabase sign-up test needed to confirm email/password/Auth settings.

### `/register/investor`

Status after this patch: PASS structure-level, pending Netlify visual check.

Fixes included:

- Same auth/register CSS fixes as Business register.
- Investor chip/select region uses stable classes and mobile collapse.
- Existing workflow logic remains unchanged: Auth user + investor hidden + payment order pending.

Risk left:

- Real test account should verify payment order row appears in `/admin/payments`.

### `/login`

Status after this patch: PASS.

Fixes included:

- Admin tab hidden from public login.
- Advisor tab hidden from public login.
- Public tabs are now Business, Investor and Market Partner only.
- Market Partner is kept as a login role only because partner lead/static flow exists; no Advisor product link is exposed.

Risk left:

- Market Partner dashboard is not yet a fully built product flow; keep as limited/non-core until partner dashboard is implemented.

### `/admin/login`

Status after this patch: PASS route intention.

Fixes included:

- Admin login remains accessible by URL.
- Admin is not shown in public `/login` tabs.

Risk left:

- Route must be verified against `App.tsx` on the uploaded branch after deployment.

### `/investors` and `/en/investors`

Status after this patch: PASS with CSS hardening.

Fixes included:

- Investor cards keep UI Reference list-card structure.
- View Detail CTA hover turns gold.
- Mobile layout avoids horizontal overflow.
- Public investor list remains `visible=true` + `status=active`; private fields are not selected by public query.

Risk left:

- Data-dependent content length should be checked visually in Netlify preview.

### `/dashboard/business`

Status after this patch: PARTIAL PASS, acceptable for beta baseline pending visual confirmation.

Fixes included:

- Overview tab gets scorecard/stat card treatment closer to UI Reference.
- Dashboard CSS has responsive sidebar collapse under 980px and 1-column cards under 700px.
- Existing workflow logic is preserved: dashboard locked until payment is confirmed; business user edits remain pending.

Risk left:

- Dashboard has multiple data-heavy sections; mobile should be manually tested for each tab.

### `/dashboard/business/profile`

Status after this patch: PASS for the issues reported.

Fixes included:

- Anonymous public title is disabled for business users; Admin controls public title.
- Hidden field preserves the submitted value so save does not blank the title.
- Industry field becomes a Vietnamese select.
- Deal type becomes a Vietnamese select.
- Common English DB values are mapped to Vietnamese display values.
- Save still writes to `pending_changes_json`; public snapshot is not overwritten.

Risk left:

- Admin should verify snapshot editing after approving the pending change.

## Build recommendation

Upload this patch together with the Master UI Standard patch, or use this consolidated patch alone because it already includes the Master UI Standard files plus route-specific fixes.

Do not merge `main` yet. Deploy and test on `beta-reference` first.
