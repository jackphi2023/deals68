# Deals68 UI Cluster A — Public Chrome + Static Pages Fix

## Scope

This patch fixes Cluster A:

- Header public navigation
- Footer public links
- Static pages: `/about`, `/terms`, `/privacy`, `/contact`
- Static Market Partner landing: `/partners` and `/market-partner`
- Removes public `/security` route and footer Security link
- Adds transparent logo for sticky navigation
- Removes Market Partner from Create Account dropdown and hamburger drawer
- Updates Vietnamese wording for key public/register labels, including Deal type → Hình thức giao dịch

## Files

```txt
public/assets/logo-beta-transparent.png
src/components/Header.tsx
src/components/Footer.tsx
src/pages/ModuleScreen.tsx
src/pages/Register.tsx
src/pages/Pricing.tsx
src/App.tsx
src/config/screenRegistry.ts
src/lib/i18n.ts
src/reference-overrides.css
```

## Deploy checklist

After upload to GitHub:

```txt
Netlify → Deploys → Trigger deploy → Clear cache and deploy site
```

Test:

```txt
/
/about
/terms
/privacy
/contact
/partners
/market-partner
/register/business
```

Must confirm:

- Header logo has transparent image background.
- Desktop Create Account dropdown has only Business / Investor / Advisor.
- Mobile hamburger drawer has only Business / Investor / Advisor under account creation.
- Footer Company links are About / Terms / Privacy / Contact.
- Footer has no Security link.
- Footer email is partner@vietcapitalpartners.com.
- Vietnamese UI does not show Market Partner in Vietnamese; it shows Đối tác thị trường.
- Register Business dropdown label uses Hình thức giao dịch, not Deal type.
