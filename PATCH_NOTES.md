# Deals68 Home UI Reference Port Patch

Target repo: `jackphi2023/deals68`
Target file: `src/pages/Home.tsx`
Reference file read directly: `ui-reference/Deals68 Home.dc.html`
Reference blob SHA: `5263e971526052ae30aecda354f746675aba3e47`
Original Home blob SHA: `e48eddf4faeebbdd42e6ef845a7aaf35c3d1b200`

## What changed

- Ported the Home page from the approved `.dc.html` reference.
- Preserved section order from the reference:
  1. Hero
  2. Trust Stats
  3. Role Cards
  4. Promo Banner
  5. Featured Deals
  6. Industries
  7. Valuation CTA
  8. Featured Investors
  9. How It Works
  10. Market Partner CTA
- Converted `{{ }}` values into React data arrays/state.
- Converted `sc-for` into `.map()`.
- Converted `sc-if` into conditional render.
- Converted `.dc.html` page links into React Router `Link` routes.
- Removed runtime dependency on `.dc.html`, `BusinessCard`, `InvestorCard`, and remote business/investor fetches for Home, so the page matches the approved source of truth.

## Files included

- `src/pages/Home.tsx` — replacement file.

## Local check performed in this sandbox

- TypeScript TSX syntax transpile check: PASS.

Full `npm run build` could not be executed here because this sandbox cannot clone GitHub or install npm packages from the network. Apply the replacement file in the repo and run:

```bash
npm install
npm run build
```

## GitHub write note

Attempted to create branch `codex/port-home-ui-reference`, but the GitHub connector returned `403 Resource not accessible by integration`, so this zip is provided as the patch artifact instead of a pushed branch.
