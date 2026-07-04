# Deals68 Investors + Investor Detail UI Reference Patch

Target repo: `jackphi2023/deals68`

Reference files read directly:
- `ui-reference/Deals68 Investors.dc.html` — SHA `0679f11e37a10bcbb227735e7d149b78163c606d`
- `ui-reference/Deals68 Investor Detail.dc.html` — SHA `9035b8e96d7c8cdd38dfe5efd249ecf25a3022fd`

Files included:
- `src/pages/Investors.tsx`
- `src/pages/InvestorDetail.tsx`

What changed:
- Ported Investors listing layout from `.dc.html` into React.
- Ported Investor Detail layout from `.dc.html` into React.
- Converted `{{ }}` to data/state, `sc-for` to `.map()`, `sc-if` to conditional render.
- Converted `.dc.html` links to React Router `Link`/route paths.
- Kept production data source via `listInvestors()` and `getInvestorByCode()`.
- Added small fallback reference investor data only for local/demo loading if Supabase fails.
- Did not render real investor emails or sensitive contact info on public/business-facing pages.

Local validation:
- TSX syntax transpile PASS for both files.

Not executed here:
- Full `npm run build` and visual diff, because this sandbox cannot install/resolve full project dependencies from the network.

GitHub write attempt:
- Direct `GitHub.update_file` still failed with 403 `Resource not accessible by integration`, so this zip must be applied/uploaded manually.
