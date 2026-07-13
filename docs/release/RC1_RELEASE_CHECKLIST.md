# Deals68 Beta v2 RC1 — Release Checklist

## Git and migrations

- [ ] `beta-reference` includes `main` and has no unresolved conflict.
- [ ] Phase A, B and C are separate commits.
- [ ] Git migration names match `docs/release/MIGRATION_STATE.md`.
- [ ] The new Phase A migration is applied to the connected Deals68 Supabase project.

## Automated QA

- [ ] `npm run qa:release` passes.
- [ ] `npm run test:e2e:public` passes.
- [ ] Authenticated Business, Investor and Admin smoke tests pass in Codespaces/Deploy Preview.
- [ ] GitHub Actions Release Gate is green on the PR to `main`.

## Manual UI at required widths

- [ ] 375 × 812
- [ ] 768 × 1024
- [ ] 1366 × 768
- [ ] 1440 × 900

Verify:

- [ ] Home Hero and G9 Deal value labels.
- [ ] Compact Business filters and full-frame Business hero.
- [ ] Registration CTA and About partnership statement from G10.
- [ ] Business Dashboard spacing and quota wording from G11.
- [ ] Investor Dashboard, Admin queues, payment confirmation and Proposal flow.
- [ ] Vietnamese and English routes.

## Security smoke test

- [ ] Guest cannot read private profile/contact data.
- [ ] Business cannot read another Business dashboard.
- [ ] Investor cannot read locked Business files before approval/connection.
- [ ] User cannot call Admin approval/payment RPC successfully.
- [ ] Proposal duplicate/quota behavior is correct and atomic.
- [ ] Public image/banner URLs work after broad bucket listing policies are removed.

## Merge and deploy

- [ ] Create PR `beta-reference` → `main`.
- [ ] Review changed files and green checks.
- [ ] Merge with a merge commit.
- [ ] Netlify production deploy from `main` succeeds.
- [ ] Check `https://deals68.com`, `/businesses`, `/investors`, `/pricing`, `/valuation`, `/login`.
- [ ] Record the production commit SHA and Netlify deploy ID.
