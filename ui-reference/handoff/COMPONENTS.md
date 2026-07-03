# Deals68.com — COMPONENTS

Reusable UI building blocks shared across every screen. Build these **once** as
React components and reuse — do not restyle per page. All visual values come from
`design-tokens.css`; a component must never introduce a raw hex/px that a token covers.
A live visual reference of each is in `components.html`.

Legend for "Used on": H=Home, BL=Businesses, BD=Business Detail, DL=Deal, IL=Investors,
ID=Investor Detail, PR=Pricing, VA=Valuation, AU=Auth (login/forgot/reset), RG=Register,
DB=Dashboards, AD=Admin.

---

## Global chrome

### `Header` / `d68-header`
Sticky top bar, height `--d68-header-h`. Logo left; primary nav center; language
toggle (VI/EN) + **Log in** + **Register** dropdown right. Register dropdown =
`d68-reg-menu` popover (`--d68-shadow-dropdown`).
- **Mobile (≤768px)**: nav collapses to a hamburger drawer. Hit targets ≥44px.
- Used on: all except AU/AD (which use a minimal logo-only variant).

### `Footer` / `d68-footer`
Navy (`--d68-navy`) 3–4 column footer: About, Pricing, Affiliate, Terms, Privacy,
Contact + VI/EN. Copyright + "A Viet Capital Partners & Consulting platform" line.
- Used on: all public + dashboards.

### `DashboardShell` / `d68-dashboard`
Two-pane layout: fixed left `Sidebar` (`--d68-sidebar-w`) + scrollable content.
Sidebar = vertical tab list (icon + label), active item navy fill. A help box may
pin below the menu (see `HelpBox`). Collapses to a top tab-scroller on mobile.
- Used on: DB, AD.

---

## Buttons — `d68-btn`

| Variant | Style | Token usage |
|---------|-------|-------------|
| `--primary` | blue fill, white text | bg `--d68-blue`, `--d68-shadow-button`, radius `--d68-radius-sm` |
| `--gold` | gold fill, navy text | bg `--d68-gold` — checkout / featured CTA only |
| `--ghost` | transparent, border | border `--d68-border`, text `--d68-navy` |
| `--danger` | white, red text+border | text `--d68-danger`, border `--d68-danger-border` |
| `--success` | green fill | bg `--d68-success` — accept/approve actions |

Sizes: default `11px 20px` / `--d68-fs-md`; small `9px 16px` / `--d68-fs-sm`.
Disabled = 45% opacity, no shadow, `cursor:not-allowed`.

---

## Surfaces & data display

### `Card` / `d68-card`
White surface, `--d68-border-card`, `--d68-radius-lg`, padding `26–30px`,
`--d68-shadow-card`. Featured/selected variant: 2px `--d68-gold` border +
`--d68-shadow-raised`.

### `DealCard` (business teaser)
Anonymous business card. Blurred hero image, non-identifying title
("F&B chain in HCMC raising capital"), country·region badge, industry, deal type,
revenue, EBITDA/margin, ask/valuation, stake. QualityScore pill. CTAs: View / Save /
Express interest. **The 6 canonical seed deals** (`D68-01…06`) live in `mock-data.js`.
- Used on: H, BL, BD (similar), DL.

### `InvestorCard`
Anonymised investor. Type (Angel/VC/PE/Family Office/Corporate/Lender/Search Fund),
current country, geographies of interest, ticket size min–max, preferred sectors,
deal type, active/verified badge, ranking score. Never shows real name/website/email.
- Used on: IL, ID.

### `QualityScore`
Circular gauge + `X/100` + band color (from score) + criteria list. **Gated**: full
breakdown only for logged-in investors; others see score + criteria names + a lock note.
- Used on: BD, DL, DB, AD.

### `FinancialTable` / `d68-table`
Zebra-free bordered table. Header row navy text. Value labels: Actual /
Management Estimate / Estimated / Subject to DD. Right-aligned numerics.
- Used on: BD, DL, DB, AD.

### `Badge` / `d68-badge`
Pill (`--d68-radius-pill`). Status map: Live=success, Pending review=warn,
Expiring=warn, Hidden/Expired=muted, Verified=blue, Featured=gold.
- Used on: BL, BD, DB, AD.

### `HelpBox`
Yellow (`--d68-warn-wash`) box, navy border, matches sidebar width. Wording + external
link (opens new tab) + hotline. Pinned under dashboard left menu.
- Used on: DB.

---

## Forms — `d68-form`

### `Field` / `Input` / `Select` / `Textarea`
Border `--d68-border`, radius `--d68-radius-sm`, padding `10px 12px`,
bg `--d68-surface` (or `--d68-bg` inset), `--d68-fs-base`. Focus: blue ring.
Label above (`--d68-fs-sm`, semibold). Error text `--d68-danger` below.

### `Checkbox` / `Radio`
`accent-color: --d68-success` (consent) or `--d68-blue`. 17px box, 44px row hit area.

### `SegmentedToggle`
Pill container, active segment navy fill. Used for VI/EN, country VN/Other, role tabs.

### `StepperWizard`
Numbered step rail + panel body + Back/Next footer. Save-draft + Preview
(teaser/full). Inline validation per step.
- Used on: RG.

### `FilterBar` / `FilterSidebar`
Region→Country cascading selects, then industry / deal type / revenue / valuation /
ticket / verified / featured. Mobile: bottom-sheet drawer.
- Used on: BL, IL.

### `SearchTabs`
Hero search with role tabs (Businesses / Investors / Advisors) + query + region.
- Used on: H.

---

## Feedback & navigation

### `Modal` / `d68-modal`
Centered dialog, `--d68-radius-lg`, `--d68-shadow-modal`, scrim `rgba(6,20,40,.5)`.
Header + body + action row. Used by Express-interest (message + NDA consent), confirmations.

### `Alert` / `Toast`
Inline alert bar (info/success/warn/danger) using status tokens. Toast = same palette,
top-right, auto-dismiss.

### `EmptyState`
Centered icon + `--d68-text-faint` message + optional CTA. Every list/tab must have one.

### `LoadingState`
Skeleton blocks (surface-alt) or spinner. Cards render skeleton at `hint-placeholder-count`.

### `Pagination`
Prev / numbered / Next; active = navy. ≥44px targets.

---

## Required dashboard states
Every dashboard tab must implement all of: **empty · loading · locked/pending-approval ·
active/live · hidden · pending-review · error**. See `QA_UI_CHECKLIST.md`.
