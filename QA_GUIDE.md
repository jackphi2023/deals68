# How to apply this patch in GitHub Codespaces

Upload/copy this folder into the repo, then run:

```bash
python3 scripts/apply-nav-proposal-investor-dashboard-ux.py
npm run build
git status
git add src/components/Header.tsx src/App.tsx src/pages/InvestorDetail.tsx src/pages/BusinessDashboard.tsx src/pages/InvestorDashboard.tsx
git commit -m "fix: improve nav proposal and investor dashboard UX"
git push origin beta-reference
```

Do not run `git add .` because `node_modules/` may be untracked in Codespaces.

## Test after Netlify deploy

Guest:
- Header shows Đăng nhập + Đăng ký.

Logged-in Business:
- Header shows Dashboard.
- Investor profile → Gửi hồ sơ DN → success message and button disabled.
- Dashboard Business → Proposal shows the sent investor proposal.

Logged-in Investor:
- Header shows Dashboard.
- Dashboard Investor → Profile shows Website and internal fund/investor name.
- Header language EN from dashboard no longer goes to 404.

Dashboards:
- Logout button is darker.
