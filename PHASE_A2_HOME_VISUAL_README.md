# Phase A2 — Home Pilot Port + Visual Diff

## Purpose

This patch continues the CSS one-source workflow after the `/businesses` pilot.
It fixes the current Home page drift and adds a multi-route visual regression script.

## Changed files

```txt
src/pages/Home.tsx
src/styles/pages/home.css
src/styles/index.css
scripts/visual-diff-routes.mjs
.github/workflows/visual-ui-pilots.yml
package.json
BUILD_TEST_RESULT.md
```

## Home fixes

- Removes the wrong `Tìm Market Partner` search tab.
- Removes the wrong 4th role card for Market Partner.
- Search tabs are only Business / Investor.
- Role cards are only Business / Investor / Advisor.
- Adds the promo banner after role cards.
- Reorders sections to match the reference:
  - Hero
  - Stats
  - Role cards
  - Promo banner
  - Featured Deals
  - Featured Industries
  - Valuation CTA
  - Featured Investors
  - How it works
  - Market Partner CTA
- Market Partner appears only as a CTA section near the bottom.
- Adds `src/styles/pages/home.css` in a layer, without adding new `!important`.

## Visual diff

New script:

```bash
npm run visual:routes
npm run visual:pilots
npm run visual:home
```

Default routes:

```txt
/
/businesses
```

Default reference:

```txt
https://glittering-unicorn-afbf10.netlify.app
```

Default threshold:

```txt
3%
```

## Important upload note

The workflow lives in a hidden directory:

```txt
.github/workflows/visual-ui-pilots.yml
```

If using GitHub web upload, make sure the `.github` folder is included. If it is missed, the visual diff will not run on GitHub Actions.
