# Deals68 Homepage H0 Baseline

**Baseline branch:** `building`  
**Baseline source SHA:** `816b319e85ff5839367a92428e2e65ce0424a5ea`  
**Date:** 2026-07-18  
**Scope:** documentation and static baseline only; no runtime UI, database, route, banner workflow or business logic changes.

## 1. Purpose

H0 freezes the current Homepage structure before CSS stabilization sessions H1–H5. It records the visible contract, CSS ownership debt and QA matrix so later cleanup can preserve behavior while reducing override risk.

## 2. Homepage section order

1. Hero banner and statistics
2. Role selection
3. Featured Investors
4. Home promotion banner
5. Featured Business opportunities
6. Featured industries
7. Valuation CTA
8. How it works

The order, data queries, route targets, loading states and empty states are frozen for H0.

## 3. Current visual contract

| Item | Desktop | Mobile |
|---|---:|---:|
| Homepage canvas | `#F7FAFC` | `#F7FAFC` |
| Direct-section gap | `80px` | `50px` |
| Homepage content width | `1200px` | full width with page gutters |
| Hero source ratio | `1600×600` | optional `900×1200` |
| Hero media runtime | `cover` + focal point | `cover` + mobile focal point |
| Featured Investors | 4 columns where space permits | 1 column |
| Featured Business cards | 3 columns | 1 column |

## 4. CSS import baseline

Homepage output currently depends on this cascade order:

```text
home.css
ui-fixes.css
release-foundation.css
release-cleanup.css (inactive stub)
home-hero.css
home-featured-investors.css
home-layout.css
home-hero-media.css
```

All page files above are imported in the same `d68-overrides` layer, so equal-specificity selectors are resolved by import order.

## 5. Known debt intentionally frozen

### Hero ownership

Current selectors are distributed across:

- `src/styles/pages/home.css`
- `src/styles/pages/home-hero.css`
- `src/styles/pages/home-hero-media.css`

`home.css` still contains a legacy mobile `contain` rule while the later `home-hero-media.css` forces runtime `cover !important`.

### Featured Investor ownership

Current rules are distributed across:

- `src/styles/pages/home.css`
- `src/styles/pages/home-featured-investors.css`
- `src/styles/pages/ui-fixes.css`
- `src/styles/final/release-foundation.css`

The canonical Home CSS still contains a verification pseudo-element and reserved margin which are later disabled by the dedicated Investor stylesheet.

### Promotion spacing

`release-foundation.css` still adds `50px` top and bottom padding to `.d68-promo-banner.d68-home-container`. This padding is additional to the parent Homepage `80px` section gap and is the primary H1 spacing target.

### Compatibility layers

- `release-cleanup.css` is correctly retained as a comment-only stub.
- `release-foundation.css` and `ui-fixes.css` still contain active Homepage rules.
- `home.css` retains historical patch generations and dead selectors.

## 6. Visual baseline matrix for H1–H5

Required routes:

```text
/
/en
```

Required viewports:

```text
1440×900
1280×800
768×1024
390×844
375×812
```

Required states:

- Hero with no rows/fallback
- Hero with one row
- Hero with two to five rows
- Desktop-only Hero image
- Desktop and mobile Hero images
- Broken mobile image falling back to desktop
- Broken desktop image falling back to SVG
- Focal X/Y at 0, 50 and 100
- Reduced motion
- Promotion present and absent
- Business loading, empty and populated
- Investor loading, empty and populated
- Vietnamese and English

## 7. H0 acceptance criteria

- No source file under `src/` is changed by H0.
- No CSS rule is changed by H0.
- No Supabase migration, RPC, RLS or view is changed.
- No Netlify configuration or deployment is changed.
- `main` remains unchanged.
- A static H0 checker records the current markup, layout contract, import order and known debt.

## 8. Next sessions

- **H1:** spacing and canvas ownership
- **H2:** Hero CSS consolidation
- **H3:** Featured Investor CSS consolidation
- **H4:** remaining Homepage sections and tokens
- **H5:** final runtime-aligned QA contract
