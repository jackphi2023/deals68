# Deals68 Phase A0 + A1 — CSS One Source + Public Chrome/Static Pages

## Scope

### A0 — CSS one-source architecture

- Adds `scripts/extract-reference-css.mjs`.
- Adds `npm run extract:reference`.
- Adds `src/styles/index.css` as the single CSS entry point.
- Moves legacy CSS into `src/styles/legacy.css` inside `@layer d68-legacy`.
- Adds generated reference CSS:
  - `src/styles/reference/d68-components.css`
  - `src/styles/reference/d68-utilities.css`
  - `src/styles/reference/d68-page-styles.css`
  - `src/styles/reference/extraction-report.md`
- Keeps old `src/styles.css` and `src/reference-overrides.css` as harmless stubs.

### A1 — Public chrome + static pages

- Rebuilds Header with transparent logo asset:
  - `/assets/logo-beta-transparent.png`
- Sticky header remains enabled.
- Desktop and mobile account menu contains only:
  - Business registration
  - Investor registration
  - Advisor registration
- Removes Market Partner from the account dropdown / mobile hamburger account menu.
- Rebuilds Footer with the correct links:
  - About
  - Terms
  - Privacy
  - Contact
- Removes public Security link/route.
- Updates email to `partner@vietcapitalpartners.com`.
- Adds proper static routes/pages:
  - `/about`
  - `/terms`
  - `/privacy`
  - `/contact`
  - `/partners`
  - `/market-partner`
- Adds Market Partner landing page as a static public page, not a listing/search entity.

## Upload instructions

Upload/overwrite these files into GitHub root. Do not upload:

- `.zip`
- `node_modules/`
- `dist/`
- `package-lock.json`
- `tsconfig.app.tsbuildinfo`

After upload:

```bash
npm install --no-audit --no-fund --package-lock=false
npm run build
```

Then deploy Netlify with **Clear cache and deploy site**.

## QA checklist

- Header logo has transparent background and does not show a white rectangle while sticky over content.
- Account dropdown does not include Market Partner / Đối tác thị trường.
- Mobile hamburger account menu does not include Market Partner / Đối tác thị trường.
- Footer has: Giới thiệu, Điều khoản, Bảo mật, Liên hệ.
- Footer has no Security link.
- Footer email is `partner@vietcapitalpartners.com`.
- `/about`, `/terms`, `/privacy`, `/contact`, `/partners`, `/market-partner` are real pages, not ModuleScreen placeholders.
- Vietnamese UI does not use avoidable English wording in the public chrome/static pages.
- Business register form shows “Hình thức giao dịch”, not “Deal type”.
