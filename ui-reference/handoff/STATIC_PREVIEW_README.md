# STATIC_PREVIEW_README — Deploying the 21 `.dc.html` pages as a UI reference

These 21 files are the **pixel-accurate source of truth**. Deploying them (unmodified)
to Netlify gives the whole team a shareable, clickable reference — no design tool
access required. Do NOT edit them for this deploy; if you need a fix, fix it in the
design tool and re-export.

## What actually renders these pages
Each `*.dc.html` file is a self-rendering static page: it loads **`./support.js`**
(a small client-side runtime bundled in the project root) which parses the page's
template markup and mounts it in the browser. There is no build step and no server
requirement — open any file directly and it renders, exactly like the design tool's
own preview.

**Do not** strip, minify away, or "clean up" the `<script src="./support.js">` tag,
the `<x-dc>` wrapper, or the `<script type="text/x-dc" data-dc-script">` block —
removing any of them blanks the page.

## What to deploy
Deploy the project root as-is (or copy this subset into a fresh folder):
```
/*.dc.html              ← all 21 reference pages
/support.js             ← the runtime — required by every page
/assets/                ← images, logos, deals68-mock.js, deals68-investors-import.js
/handoff/               ← optional: include so reviewers can also open component reference
netlify.toml            ← copy from handoff/netlify.toml to the deploy root
```

## Deploy steps (Netlify)
1. Copy `handoff/netlify.toml` to the root of the folder you're deploying.
2. In Netlify: **Add new site → Deploy manually** (drag-and-drop the folder), or
   connect the repo with **Build command: (none)** and **Publish directory: `.`**.
3. Netlify will serve every `*.dc.html` file at its own URL, e.g.
   `https://<site>.netlify.app/Deals68%20Home.dc.html`.
4. `netlify.toml` redirects `/` to the Home page and adds a few short aliases
   (`/pricing`, `/businesses`, `/investors`, `/valuation`, `/admin`) — add more
   redirects there as needed for review links.

## What this deploy is *for*
- A **click-through pixel reference** for design QA and stakeholder review.
- The **visual source of truth** the React build must match (see `QA_UI_CHECKLIST.md`
  and `PAGE_SCREENSHOT_CHECKLIST.md`).

## What this deploy is *not*
- Not production. There's no real auth, database, or payment — all data comes from
  `assets/deals68-mock.js` and `localStorage`. Sessions/role-switching are simulated.
- Not the app dev builds. The React/Vite/Supabase app is a **separate deploy**; this
  static reference stays live purely for visual comparison during and after the build.
- robots are set to `noindex` in `netlify.toml` — this reference site must never be
  indexed or linked publicly.

## Recommended URL to bookmark
`https://<your-site>.netlify.app/` → redirects to Home. From there, every page links
to every other page exactly as a user would navigate the real product.
