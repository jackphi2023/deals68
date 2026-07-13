# Deals68 — CSS Ownership for Release Candidate

## One entry point

`src/styles/index.css` is the only CSS entry imported by the application.

## Ownership rules

- Homepage rules: `src/styles/pages/home.css`
- Business listing: `src/styles/pages/businesses.css`
- Business detail: `src/styles/pages/business-detail.css`
- Registration: `src/styles/pages/auth.css`
- Static/About pages: `src/styles/pages/static.css`
- Shared Dashboard shell: `src/styles/pages/dashboard.css`
- Business Dashboard: `src/styles/pages/business-dashboard.css`
- Investor workflow: `src/styles/pages/investor-workflow.css`
- Admin: `src/styles/pages/admin.css`

## Frozen compatibility layer

`src/styles/final/release-foundation.css` preserves the already verified RC baseline. It is frozen: do not add new UI rules there.

`src/styles/pages/release-cleanup.css` is a comment-only deprecated stub. QA fails if active CSS is added back.

## New UI rules

New rules must:

1. use a route root such as `.d68-home-page` or `.d68-business-dashboard-page`;
2. live in the page/component owner file;
3. avoid positional selectors such as `:first-child` for state;
4. use an explicit class or `data-state` for active/pending/selected state;
5. be tested at 375, 768, 1366 and 1440 px widths.

The G9, G10 and G11 fixes are integrated into their page-owned files and protected by static QA scripts.
