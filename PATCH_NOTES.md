# Deals68 UI Reference Patch — Header/Footer + Businesses

## Scope

This patch continues the UI-reference port work after Home:

1. `src/components/Header.tsx`
   - Ported shared public header to the inline style/class structure used by `ui-reference/Deals68 Home.dc.html` and `ui-reference/Deals68 Businesses.dc.html`.
   - Keeps React Router navigation and VI/EN toggles.
   - Uses `/assets/logo-beta.png` per reference.

2. `src/components/Footer.tsx`
   - Ported shared footer to reference layout.
   - Keeps React Router links and bilingual labels.

3. `src/pages/Businesses.tsx`
   - Rebuilt page body from `ui-reference/Deals68 Businesses.dc.html`.
   - Preserves section order:
     - Transaction tabs
     - Title / breadcrumbs
     - Sidebar filters + results
     - Grid/list view
     - Empty state
     - Mid CTA
     - Pagination
     - SEO / explainer
     - Browse by location
     - Browse by industry
     - FAQ
   - Keeps Supabase production data via `listBusinesses({ includeHidden: false })` and falls back to `fallbackSeedBusinesses()`/reference seed data if loading fails.
   - Converts reference `{{ }}`/`sc-for`/`sc-if` into React data, `.map()`, and conditionals.

## Validation

A local TSX parse/transpile check was run for all 3 files:

```bash
PASS /mnt/data/deals68_patch_next/src/components/Header.tsx
PASS /mnt/data/deals68_patch_next/src/components/Footer.tsx
PASS /mnt/data/deals68_patch_next/src/pages/Businesses.tsx
```

Full `npm run build` was not run inside this sandbox because the full repo/node_modules are not present here.

## GitHub status

Attempted to update `main` through the GitHub connector, but GitHub returned:

```text
403 Resource not accessible by integration
```

So this zip is the patch artifact to upload/apply manually.

## Apply

From the repo root:

```bash
unzip deals68_ui_reference_header_footer_businesses_patch.zip -d /tmp/deals68-ui-patch
cp -f /tmp/deals68-ui-patch/src/components/Header.tsx src/components/Header.tsx
cp -f /tmp/deals68-ui-patch/src/components/Footer.tsx src/components/Footer.tsx
cp -f /tmp/deals68-ui-patch/src/pages/Businesses.tsx src/pages/Businesses.tsx
npm run build
npm run visual:home
npm run visual:businesses
```
