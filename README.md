# Deals68.com Production Beta v2

React + Vite + Supabase + Netlify codebase for Deals68.com.

This package is a deployable production-beta foundation generated from the approved Deals68 design. It includes:

- Public marketplace: home, business search, investor search, detail pages, pricing, valuation.
- Business workflow: register, dashboard, edit profile/financials, upload Word/Excel/PPT/PDF files, upload images, pending admin review, interested investors, proposals, data requests.
- Investor workflow: English default dashboard, criteria, saved businesses, recommended businesses, proposals, privacy email/WhatsApp/Zalo, request data, alerts.
- Admin workflow: manage businesses/investors/advisors/affiliates/payments/promo/proposals/data requests/valuation rules/quality criteria/SEO/import/security/audit.
- Affiliate/advisor beta screens.
- Internationalization foundation: countries, phone country codes, language/localization tables, local time fields.
- Supabase schema: 14 core tables + 66 extension tables = about 80 tables.
- Seed scripts for admin, 6 businesses and 624 investors.

## Local run

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Build test

```bash
npm run build
npm run check:routes
```

## Supabase setup

Run migrations in order in Supabase SQL Editor:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_country_calling_codes_seed.sql`
3. `supabase/migrations/0003_quality_criteria_seed.sql`
4. `supabase/migrations/0004_extended_production_schema_80_tables.sql`

Then run seed locally with the service role key in `.env`:

```bash
npm run seed
```

## Netlify

Build command: `npm run build`
Publish directory: `dist`

Environment variables:

```bash
VITE_SUPABASE_URL=https://tucaqhsfdjbclxqaoxio.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_NtuPrVdBigEWFz444enWuA_Fl_clDMe
VITE_SITE_URL=https://deals68.com
```

Never add `SUPABASE_SERVICE_ROLE_KEY` to Netlify or GitHub.

## Reality note

This is a production-beta foundation with route coverage, schema, seed, RLS and upload logic. A fully hardened commercial marketplace still needs staged QA, payment webhook certification, email provider credentials, legal review and manual penetration/security testing before public launch.
