# Deals68 UI Reference Ready

This folder is safe to deploy as a separate static UI reference site.

Do NOT overwrite the production React app root with this folder unless you intentionally want a static mock/reference site.

Recommended:
- Put these files in a separate GitHub folder: `ui-reference/`
- Create a separate Netlify site with:
  - Base directory: `ui-reference`
  - Build command: blank
  - Publish directory: `.`
- Or drag-and-drop this folder manually into a new Netlify site.

Files included:
- 21 `.dc.html` pixel-reference pages
- `support.js` runtime required by `.dc.html`
- `assets/`
- `handoff/`
- root `netlify.toml` copied from `handoff/netlify.toml`
