# Deals68 UI Reference Patch — Pricing + Valuation + Register

Target repo: `jackphi2023/deals68`

## Reference files read directly

- `ui-reference/Deals68 Pricing.dc.html`
  - SHA: `ccfc3c0d99511002a659fd611d770d470e4812e9`
- `ui-reference/Deals68 Valuation.dc.html`
  - SHA: `016f46568f86df5d16de8b65de792ab14f221249`
- `ui-reference/Deals68 Register Business.dc.html`
  - SHA: `b519e199a50627da94f9d735eac673ec3f3ff861`
- `ui-reference/Deals68 Register Investor.dc.html`
  - SHA: `97388427639eabf9015731d3991f5088c605c749`

## Current React files replaced

- `src/pages/Pricing.tsx`
  - Original SHA read from GitHub: `69dcb93acb979b73dad06cb43d349bd54eec20e2`
- `src/pages/Valuation.tsx`
  - Original SHA read from GitHub: `9c69665dce339717629d94a06b62d46bec040e48`
- `src/pages/Register.tsx`
  - Original SHA read from GitHub: `787d035c96e5c7d75dd08b27bb42f61db6823a3d`

## What changed

### Pricing
- Ported from `Deals68 Pricing.dc.html` body sections.
- Preserved section order:
  1. Hero
  2. Calculator
  3. Result summary card
  4. Plan cards
  5. Discount tiers
  6. Pricing FAQ
- Converted `{{ }}` to React state/computed values.
- Converted `sc-for` to `.map()`.
- Converted `sc-if` to conditionals.
- Converted checkout link/action to `localStorage` checkout intent + React navigation.

### Valuation
- Ported from `Deals68 Valuation.dc.html` body sections.
- Preserved section order:
  1. Hero
  2. Calculator input card
  3. Result card
  4. Lead capture / CTA
  5. How it works
- Implemented reference valuation logic:
  - country adjustment
  - industry revenue/EBITDA benchmark multiples
  - growth adjustment
  - margin adjustment
  - weighted blend of EBITDA and revenue valuation
  - confidence badge and adjustment reasons.

### Register
- `Register.tsx` remains the single React route `/register/:role`.
- Ported Business and Investor UI flows from their reference pages into role-specific rendering.
- Business flow:
  1. Basic info
  2. Transaction & financials
  3. Account
  4. Review
- Investor flow:
  1. Investor profile
  2. Ticket size
  3. Account
- Keeps existing production hooks:
  - `signUp`
  - `createBusinessFromProfile`
  - `createInvestorForOwner`
  - pricing intent from `localStorage`.

## Local check

Executed TSX transpile/parse check:

```bash
PASS Pricing.tsx
PASS Valuation.tsx
PASS Register.tsx
```

## Not executed

Full `npm run build` and visual diff were not executed in this sandbox because the full repo dependencies are not available here and GitHub direct writes are blocked by connector permissions.

## Apply

From repo root:

```bash
unzip deals68_pricing_valuation_register_patch.zip -d /tmp/deals68-pricing-valuation-register
cp -f /tmp/deals68-pricing-valuation-register/src/pages/Pricing.tsx src/pages/Pricing.tsx
cp -f /tmp/deals68-pricing-valuation-register/src/pages/Valuation.tsx src/pages/Valuation.tsx
cp -f /tmp/deals68-pricing-valuation-register/src/pages/Register.tsx src/pages/Register.tsx
npm run build
```
