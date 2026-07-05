# Deals68 Master UI Reconcile Patch

This consolidated patch includes:

1. Master UI Standard files.
2. Business list/static page CSS hardening from the master standard patch.
3. Route-specific UI fixes for Home, Register, Login, Investors and Business Dashboard/Profile.
4. Transparent nav logo asset.
5. Per-route audit report: `UI_AUDIT_ROUTES.md`.

Target branch: `beta-reference`.

Commit message:

```text
fix(beta-reference): reconcile key routes with master ui standard
```

Netlify:

```text
Clear cache and deploy site
```

Routes to test:

```text
/
/en
/register/business
/register/investor
/login
/admin/login
/investors
/en/investors
/dashboard/business
/dashboard/business/profile
/businesses
/en/businesses
/about
/contact
/market-partner
```

Do not merge main until full visual + workflow checklist passes.
