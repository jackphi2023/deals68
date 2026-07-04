# Build test result — Pilot /businesses port

Command:

```bash
npm run build
```

Result:

```txt
✓ 140 modules transformed.
✓ built in 1.68s
```

Notes:

- Build passed after porting `/businesses` to reference-led markup and adding the visual diff pilot script.
- Visual diff script/config is included but was not executed in this container because Playwright browser binaries are not preinstalled here.
- To run visual diff locally or in GitHub Actions:

```bash
npm install --no-audit --no-fund --package-lock=false
npx playwright install chromium
npm run visual:businesses:local
```
