# Deals68.com — QA UI CHECKLIST

Use this to verify the React build matches the approved HTML design. Check each item
on every listed breakpoint. A row passes only when it is **pixel- and behaviour-faithful**
to the design file. Reference: `design-tokens.css`, `COMPONENTS.md`, `components.html`.

Breakpoints: **Desktop 1440 · Laptop 1280 · Tablet 768 · Mobile 375**.

## 0. Design-system integrity
- [ ] All color values resolve to a `--d68-*` token — no stray hex in components.
- [ ] All spacing uses the 4/8/12/16/24/32/48/64 scale — no arbitrary margins.
- [ ] Radius only from sm/md/lg/xl/pill tokens.
- [ ] Shadow only from card/dropdown/modal/raised/button tokens.
- [ ] Font is Be Vietnam Pro everywhere; weights 400–800 as designed.
- [ ] No page ships its own duplicate CSS bundle — shared tokens + app styles only.
- [ ] Class names stable and structured (`.d68-header`, `.d68-btn`, `.d68-card`…).

## 1. Global chrome
- [ ] Header identical on every page; sticky; language toggle persists VI/EN.
- [ ] Register dropdown opens/closes, keyboard accessible, correct links.
- [ ] Mobile hamburger drawer opens; nav links ≥44px; closes on route change.
- [ ] Footer identical everywhere; all links resolve; VI/EN toggles.
- [ ] Dashboard sidebar identical across the 4 dashboards; active state correct.

## 2. Responsive (per breakpoint)
- [ ] No horizontal scroll / overflow at 1440, 1280, 768, 375.
- [ ] Card grids reflow (4→2→1) without clipping.
- [ ] Filter sidebar becomes a drawer/bottom-sheet on tablet & mobile.
- [ ] Tables scroll or stack on mobile; no truncated numerics.
- [ ] Hit targets ≥44px on touch breakpoints.

## 3. Reusable components
- [ ] Buttons: all 5 variants + disabled render per tokens; hover/active/focus states.
- [ ] DealCard: blur, anonymised title, all metrics, quality pill, 3 CTAs.
- [ ] InvestorCard: type/country/ticket/sectors/deal-type; **no** real name/website/email.
- [ ] QualityScore: gauge + band color; full breakdown only for logged-in investors.
- [ ] Badge status colors match map (live/pending/expiring/hidden/verified/featured).
- [ ] Modal: scrim, focus trap, ESC + backdrop close, action row.
- [ ] Alert/Toast: 4 severities, correct tokens, auto-dismiss for toast.
- [ ] Pagination + SortDropdown behave and are keyboard operable.

## 4. Required screen states (every dashboard tab & every list)
- [ ] Empty state — icon + message + CTA.
- [ ] Loading state — skeleton/spinner, no layout shift on resolve.
- [ ] Locked / pending-approval — gated content hidden, upgrade/verify CTA.
- [ ] Active / live — normal render.
- [ ] Hidden — profile not public; data retained.
- [ ] Pending review — warn banner with reason.
- [ ] Error state — retry affordance; no blank screen.

## 5. Data & privacy (verify against DATA_FIELDS.md)
- [ ] Teaser payloads never contain 🔒 fields (name, tax code, email, contacts, file paths).
- [ ] Email never rendered on any frontend surface, even after connection.
- [ ] Website/contact unlock only after admin-approved proposal + admin allow flag.
- [ ] Currency = VND for Vietnam, USD otherwise; admin override respected.
- [ ] Proposal quota capped at 100 (Standard) / 200 (Priority); blocked past cap.
- [ ] Document/file links are short-lived signed URLs; expire and re-issue correctly.

## 6. Flows (behaviour parity)
- [ ] Pricing estimator: role/country/term/promo recompute total; discounts stack correctly.
- [ ] Register wizards: per-step validation, save-draft, teaser/full preview.
- [ ] Express interest: modal → NDA consent → connection `sent`; chat opens on `accepted`.
- [ ] Investor "Express interest" appears in the target Business Dashboard tab; accept works.
- [ ] Request Data: investor → admin queue → business tab reflects status.
- [ ] Affiliate: register/login gated by admin approval; 15% discount + commission tiers.
- [ ] Advisor dashboard shows the "coming soon" placeholder (no silent redirect).

## 7. i18n
- [ ] Every visible string has VI + EN; no missing/duplicated language leaks.
- [ ] Language choice persists across navigation and reload.
- [ ] Numbers/currency/date formats localise (vi-VN vs en-US).

## 8. SEO & meta
- [ ] Public marketing/listing routes `index,follow`; auth/dashboard/admin `noindex,nofollow`.
- [ ] JSON-LD Organization present; canonical + OG/Twitter tags per page.
- [ ] hreflang VI/EN; sitemap.xml + robots.txt served.

## 9. Accessibility
- [ ] Visible focus rings; logical tab order; modals trap focus.
- [ ] Form fields have associated labels; errors announced.
- [ ] Color contrast ≥ AA for text on navy and on gold.
- [ ] Images have alt text; icon-only buttons have aria-labels.
