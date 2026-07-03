# Deals68.com — Developer Handoff

Everything a dev needs to rebuild the approved HTML design in React/Vite/Supabase
**without changing the look**. Do not restyle; consume the tokens and match the screens.

## Files
| File | Purpose |
|------|---------|
| `design-tokens.css` | Single source of truth: color, type, spacing, radius, shadow — **values audited against all 21 `.dc.html` pages**, not invented. Import first at app root. |
| `app.css` | Shared component layer — canonical `.d68-*` classes (header, footer, sidebar, buttons, cards, badges, forms, table, modal, alerts, empty/loading, pagination). Import after tokens. Pages call **only** these two stylesheets. |
| `components.html` | Live visual reference of every component (renders straight from `design-tokens.css` + `app.css`). Open in a browser. |
| `demo/home.html`, `demo/business-detail.html` | Two **demo-only** pages rebuilt with the shared `.d68-*` classes, to show devs the pattern in context. Not a replacement for the `.dc.html` reference. |
| `ROUTES.md` | URL → screen file → component mapping for all 21 pages. |
| `COMPONENTS.md` | Each shared component: description, class name, where used, token usage. |
| `DATA_FIELDS.md` | Every UI field → Supabase column, with 🔒 privacy markers and derived values. |
| `QA_UI_CHECKLIST.md` | Pass/fail parity checklist across the 4 breakpoints. |
| `REACT_CONVERSION_GUIDE.md` | Step-by-step: how to port each `.dc.html` page to a React route without redesigning it. |
| `PAGE_SCREENSHOT_CHECKLIST.md` | Per-page, per-breakpoint visual-parity sign-off sheet (21 pages × 4 breakpoints). |
| `STATIC_PREVIEW_README.md` | How to deploy the 21 `.dc.html` pages to Netlify as a shareable, click-through UI reference. |
| `netlify.toml` | Ready-to-use Netlify config for that static reference deploy (redirects, headers, no build step). |

## The 21 `.dc.html` pages stay authoritative
Per the brief: the 21 reference pages are **not migrated** to class-based CSS — they
stay as the editable, pixel-accurate source of truth in the design tool (inline
styles are a hard requirement there). `design-tokens.css` + `app.css` are the
class-based translation of that same system, extracted from real values in those
pages, for the React/Vite/Supabase rebuild to consume.

## Sample data
Mock/seed data is already isolated in **`assets/deals68-mock.js`** (+ `assets/deals68-investors-import.js`).
Use it verbatim for the 6 canonical deals (`D68-01…06`) and investor seeds; do not
invent alternate sample records.

## Non-negotiables
- Font: **Be Vietnam Pro** everywhere (weights 400–800).
- Colors: Navy `#0F2A4A` · Blue `#1BADEA` · Gold `#F2B51D` · BG `#F7FAFC` · Border `#E2E8F0`.
- Spacing only from 4/8/12/16/24/32/48/64. Radius/shadow only from tokens.
- Stable class names (`.d68-header`, `.d68-btn`, `.d68-card`, `.d68-sidebar`, `.d68-table`, `.d68-badge`).
- Bilingual VI/EN on every string; currency VND (VN) / USD (other).
- Privacy enforced server-side (RLS); never render 🔒 fields (email never, anywhere).
- Responsive at 1440 / 1280 / 768 / 375 with a real mobile hamburger.
