# REACT_CONVERSION_GUIDE — building the production app from the reference

Goal: rebuild each `.dc.html` reference page as a React route wired to Supabase,
**pixel- and behaviour-identical** to the reference. This is a port, not a redesign.
Do not "improve", restyle, re-space, or re-word anything you weren't told to change.

## 0. Set up the shared layer first
1. Copy `design-tokens.css` and `app.css` into the app (e.g. `src/styles/`) and
   import both, in that order, once at the root (`main.tsx`/`App.tsx`).
2. Build the global components **once**, per `COMPONENTS.md`: `Header`, `Footer`,
   `DashboardShell`/`Sidebar`, `Button`, `Card`, `Badge`, `Modal`, `Alert`, `Table`,
   `EmptyState`, `Pagination`, `FilterBar`. Every page consumes these — never
   reimplement per-page.
3. Wire an i18n context (VI/EN) replacing the reference's `.l-vi`/`.l-en` CSS-toggle
   trick — the reference's bilingual copy is your string source, don't retranslate.

## 1. Per-page conversion loop
For **each** of the 21 pages, follow this loop and check it off in
`PAGE_SCREENSHOT_CHECKLIST.md`:

1. Open the reference page (static preview or design tool) side-by-side with your
   in-progress React route.
2. Build the route using shared components first; only write page-specific markup
   for content that is genuinely unique to that screen.
3. Wire real data per `DATA_FIELDS.md` — replace `assets/deals68-mock.js` reads with
   Supabase queries returning the *same shape*. Keep the mock file as fixtures for
   tests/storybook.
4. Screenshot your route at 1440 / 1280 / 768 / 375 and diff against the reference
   screenshot from `PAGE_SCREENSHOT_CHECKLIST.md`. Fix any delta before moving on.
5. Verify every state in that page's flow (empty/loading/locked/live/hidden/pending/error)
   using `QA_UI_CHECKLIST.md` §4.
6. Verify privacy: no 🔒 field from `DATA_FIELDS.md` reaches the client for a role
   that shouldn't see it (check the network tab, not just the rendered DOM).

## 2. Page-by-page notes
Route mapping is in `ROUTES.md`. Notes below flag anything non-obvious per page —
absence of a note means "straightforward port, no special logic."

| Page | Conversion notes |
|------|-------------------|
| Home | Hero search tabs are 3 stateful modes (Business/Investor/Advisor), not 3 pages. Featured deals = the 6 canonical seed records, in fixed order. |
| Businesses listing | Region→Country filter is cascading (country options depend on region). Sort + pagination are URL query params, not local-only state, so links/back-button work. |
| Business detail / Deal | **Quality Score gating is role-based, not a UI toggle**: full breakdown renders only when the session role is `investor` and logged in; everyone else gets score + criteria names + the lock sentence. Get this from the auth/session state, never from a client-only flag. |
| Investors listing | Ranking sort is the *default* sort (not alphabetical) — driven by `ranking_score`, computed server-side per `DATA_FIELDS.md`. |
| Investor detail | Same anonymisation rule as Business detail; contact/website only unlock post-approved-proposal per admin flag. |
| Pricing | Price/discount/promo math must be a single shared function (server or shared util) — do not reimplement the tier/discount formula separately in the estimator vs. the checkout confirmation; they must always agree. |
| Valuation | Public tool, no auth. Treat its output range as advisory only — copy the disclaimer verbatim. |
| Login / Forgot / Reset | Auth flows are role-aware (business/investor/advisor/affiliate share one Login; Admin has its own). Keep the "Admin login" link separate from the main Login page. |
| Register (Business/Investor/Advisor) | Multi-step wizard with per-step validation + save-draft + teaser/full preview — port the stepper component once, reuse across all three, only the field-set per step differs (see `DATA_FIELDS.md`). |
| Register Affiliate | Account stays gated until admin approval — show the pending state, don't auto-activate. |
| Business Dashboard | "Interested investors" tab drives the accept→connect flow; accepting must flip the investor's view to full-profile on their side too. The VCP help box under the sidebar is static content + one external link — don't componentize it beyond that. |
| Investor Dashboard | "Investment criteria" tab is a live filter (sector chips, revenue/EBITDA bands) that re-queries the matching-business grid, newest first. Privacy tab controls what a business sees post-connection (email/phone opt-in with country code) — this writes investor-controlled visibility flags, not admin ones. |
| Affiliate Dashboard | Commission only accrues on a **paid, non-refunded** order — surface that condition in the wording, not just the number. |
| Advisor Dashboard | Ships as an explicit "coming soon" placeholder — do not silently redirect elsewhere; keep the wording. |
| Admin Login / Admin Dashboard | Separate auth path from the main app. Admin Dashboard sections (Payments, Business Review, Investor Manager, Investor Contacts, Proposal Manager, Affiliate Manager, Data Requests) are independent panels sharing `DashboardShell`. |

## 3. Non-negotiables (repeat of brief, enforced at PR review)
- No new colors/fonts/spacing/radius/shadow outside the tokens.
- No component restyled per-page; shared components only.
- Bilingual strings match the reference verbatim (no retranslating/rewording).
- Privacy rules enforced server-side (Supabase RLS), never client-only hiding.
- Every required state (§ QA checklist) implemented, not just the happy path.

## 4. Definition of done, per page
- [ ] Matches reference at all 4 breakpoints (see `PAGE_SCREENSHOT_CHECKLIST.md`).
- [ ] Real Supabase data, correct shape, correct privacy.
- [ ] All required states implemented and demonstrable.
- [ ] Passes the relevant rows of `QA_UI_CHECKLIST.md`.
