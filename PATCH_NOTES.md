# Deals68 beta-reference patch — Pricing / Valuation / Auth + Home/Nav fixes

Scope following Spec v1.3:

- Fix i18n public route standard:
  - VI canonical: `/`, `/businesses`, `/investors`, `/pricing`, `/valuation`, `/login`, `/register/...`
  - EN canonical: `/en`, `/en/businesses`, `/en/investors`, `/en/pricing`, `/en/valuation`, `/en/login`, `/en/register/...`
  - Deprecated `/vi/...` redirects to VI canonical.
- Header language switch uses React Router navigation, not full browser reload.
- Header nav links keep EN prefix when user is in EN.
- Navigation logo uses transparent SVG: `public/assets/logo-nav.svg`.
- Home stats third box now displays live public total deal value from Supabase active/visible businesses, not “Ẩn danh”.
- Home featured industries styling aligned closer to UI Reference: white background, tile grid, gradient image area, note text.
- Port/baseline pages:
  - Pricing
  - Valuation
  - Register business/investor/advisor
  - Login
  - Forgot password
  - Reset password
  - Investors / Investor Detail included to ensure i18n route patch is complete if previous commit did not include it.

Files included:
- public/assets/logo-nav.svg
- src/lib/i18nRoutes.ts
- src/lib/publicMetrics.ts
- src/App.tsx
- src/components/Header.tsx
- src/pages/Home.tsx
- src/pages/Investors.tsx
- src/pages/InvestorDetail.tsx
- src/pages/Pricing.tsx
- src/pages/Valuation.tsx
- src/pages/Register.tsx
- src/pages/Login.tsx
- src/pages/ForgotPassword.tsx
- src/pages/ResetPassword.tsx
- src/styles/index.css
- src/styles/pages/home.css
- src/styles/pages/investors.css
- src/styles/pages/investor-detail.css
- src/styles/pages/pricing.css
- src/styles/pages/valuation.css
- src/styles/pages/auth.css

No Dashboard/Admin/Supabase schema changes.
