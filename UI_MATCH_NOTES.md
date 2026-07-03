# Deals68 UI Match Claude Design v2.0.2

This update aligns the React/Vite app UI with the Claude Design HTML files in `DEALS68.com.zip`.

Changed areas:
- `src/styles.css`: Deals68 navy/blue/gold theme, Be Vietnam Pro font, hero/search/stat cards/role cards/deal cards/investor cards/footer.
- `src/components/Header.tsx`: sticky white header, logo-beta, VI/EN toggle, register dropdown.
- `src/pages/Home.tsx`: Claude Design-like home layout: hero, search module, stats, role cards, featured deals, industries, featured investors, how-it-works, valuation CTA.
- `src/components/BusinessCard.tsx`: deal cards matching design.
- `src/components/InvestorCard.tsx`: investor cards matching design.
- `src/components/Footer.tsx`: navy footer matching design.
- `public/assets/*.png`: original Claude Design visual assets.
- `package.json`: pinned stable React 18/Vite 5 dependency set for Netlify.

Local check performed:
- `npm install --no-audit --no-fund`
- `npm run build`
- Build status: success.
