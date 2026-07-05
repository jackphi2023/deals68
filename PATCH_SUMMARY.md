# Deals68 Front-end Style Patch — Home UI Reference + Static Hero

Target branch: beta-reference
Status: patch zip only; not committed/pushed; no Supabase migration applied by assistant.

## Scope
This patch is based on the latest combined patch `deals68_investor_flow_otp_register_detail_patch_20260705.zip` and only adds visual CSS overrides in `src/styles/pages/ui-fixes.css`.

No changes to:
- Auth/OTP logic
- Register data logic
- Dashboard/Admin workflows
- Public business/investor data guards
- Supabase schema/RLS/RPC

## Visual fixes
1. Home — Featured Industries
- Match UI Reference card geometry: white section, centered title/subtitle, 4-column desktop grid, rounded cards, fixed color media band, clean content area.
- Responsive: 2 columns tablet, 1 column mobile.

2. Home — Investors looking for deals
- Match UI Reference style: card border/radius/shadow, top icon block, verified visual marker, outline button, first card highlighted CTA.
- Responsive: 4 columns desktop, 2 tablet, 1 mobile.

3. Static Pages Hero
- Hero background changed to Deals logo blue.
- Hero text centered and white.
- Eyebrow pill white/translucent.
- Prominent numbers in static cards use Deals68 gold.

## Changed file
- src/styles/pages/ui-fixes.css

## Commit message
fix: align home sections and static hero styling

## Route test
- /
- /en
- /about
- /en/about
- /terms
- /privacy
- /market-partner

## Mobile checklist
375px:
- Featured Industry cards stack 1 column, no overflow.
- Investor cards stack 1 column, CTA full width.
- Static hero blue background, white centered text readable.

768px:
- Home industry/investor cards 2 columns.
- Static hero maintains center alignment.

1440px:
- Industry grid 4 columns.
- Investor grid 4 columns.
- Static hero blue band spans full width.
