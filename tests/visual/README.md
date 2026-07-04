# Visual QA pilot — /businesses

This pilot compares the React route `/businesses` against the approved UI reference site.

Run locally after installing dev dependencies and Playwright browser:

```bash
npm install --no-audit --no-fund --package-lock=false
npx playwright install chromium
npm run visual:businesses:local
```

Environment variables:

```bash
D68_TARGET_URL=http://127.0.0.1:4173
D68_REFERENCE_URL=https://glittering-unicorn-afbf10.netlify.app
D68_VISUAL_THRESHOLD=0.03
```

Output:

```txt
visual-diff/businesses/reference-1440.png
visual-diff/businesses/target-1440.png
visual-diff/businesses/diff-1440.png
visual-diff/businesses/visual-report.json
```

The test currently runs only for the pilot route `/businesses` at 1440 / 768 / 375 widths.
