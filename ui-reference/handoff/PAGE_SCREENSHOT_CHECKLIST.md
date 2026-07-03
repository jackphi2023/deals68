# PAGE_SCREENSHOT_CHECKLIST — visual parity per page

Capture the reference (`.dc.html` static preview) and your React route at each
breakpoint below, then diff side-by-side. Check off only when there is **no visible
delta** in layout, spacing, type, color, or content. Note any intentional deviation
(should be none) with a reason.

Breakpoints: **Desktop 1440 · Laptop 1280 · Tablet 768 · Mobile 375**.
For each page: capture the top of the page AND scroll to capture full-length (long
pages may need 2–3 stitched shots per breakpoint).

## How to capture
- Reference: open the deployed static preview (or the design tool), set viewport
  width, screenshot.
- React: same URL pattern per `ROUTES.md`, same viewport width, screenshot.
- Store pairs as `screenshots/<page>/<breakpoint>-reference.png` and `-react.png`.

## Checklist

| # | Page | 1440 | 1280 | 768 | 375 | Notes |
|---|------|:---:|:---:|:---:|:---:|-------|
| 1 | Home | ☐ | ☐ | ☐ | ☐ | Hero, search tabs, trust stats, role cards, featured deals ×6, promo banner, regions, industries, featured investors, how-it-works, valuation CTA, footer |
| 2 | Businesses listing | ☐ | ☐ | ☐ | ☐ | Filter sidebar → drawer at ≤768; grid reflow 3→2→1 |
| 3 | Business detail | ☐ | ☐ | ☐ | ☐ | Image slider, key facts grid, financials table, documents lock states, quality score gating (test both logged-out and investor-logged-in) |
| 4 | Deal detail | ☐ | ☐ | ☐ | ☐ | Same gating check as Business detail; express-interest modal |
| 5 | Investors listing | ☐ | ☐ | ☐ | ☐ | Ranking sort order matches reference exactly |
| 6 | Investor detail | ☐ | ☐ | ☐ | ☐ | Anonymisation — confirm no real name/site/email in DOM or network payload |
| 7 | Pricing | ☐ | ☐ | ☐ | ☐ | Estimator recompute across role/country/term/promo combinations |
| 8 | Valuation | ☐ | ☐ | ☐ | ☐ | Result range + confidence meter + disclaimer copy verbatim |
| 9 | Login | ☐ | ☐ | ☐ | ☐ | Gated-state variant (test the `gated` banner) |
| 10 | Forgot password | ☐ | ☐ | ☐ | ☐ | |
| 11 | Reset password | ☐ | ☐ | ☐ | ☐ | Success state after submit |
| 12 | Register Business | ☐ | ☐ | ☐ | ☐ | All wizard steps + teaser/full preview step |
| 13 | Register Investor | ☐ | ☐ | ☐ | ☐ | All wizard steps + checkout (QR/Senpay/Paypal) + free-order path |
| 14 | Register Advisor | ☐ | ☐ | ☐ | ☐ | |
| 15 | Register Affiliate | ☐ | ☐ | ☐ | ☐ | Pending-approval state |
| 16 | Business Dashboard | ☐ | ☐ | ☐ | ☐ | Every tab: Profile, Financials, Files, Images, Interested investors, Requests, Plan, Settings — plus pending-re-review banner + VCP help box |
| 17 | Investor Dashboard | ☐ | ☐ | ☐ | ☐ | Every tab: Profile, Investment criteria (+ recommendations grid), Saved businesses, Proposals, Privacy, Alerts, Contacts, Security |
| 18 | Affiliate Dashboard | ☐ | ☐ | ☐ | ☐ | Referral link, commission table, payouts table |
| 19 | Advisor Dashboard | ☐ | ☐ | ☐ | ☐ | "Coming soon" placeholder wording |
| 20 | Admin Login | ☐ | ☐ | ☐ | ☐ | |
| 21 | Admin Dashboard | ☐ | ☐ | ☐ | ☐ | Every section: Payments, Business Review, Investor Manager, Investor Contacts, Proposal Manager, Affiliate Manager, Data Requests |

## Cross-page checks (do once, not per-page)
- [ ] Header identical pixel-for-pixel across all pages at every breakpoint.
- [ ] Footer identical pixel-for-pixel across all pages at every breakpoint.
- [ ] Mobile hamburger drawer identical behaviour/animation across all pages.
- [ ] Dashboard sidebar identical across the 4 dashboards (only active item + menu items differ).
- [ ] Language toggle (VI/EN) produces identical copy to the reference on every page.
- [ ] Currency formatting (VND vs USD) matches on every page showing money.

## Sign-off
Only mark this handoff item complete when every row above is fully checked with **zero
open notes**, and the cross-page checks all pass.
