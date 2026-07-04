# Deals68 UI Reference Patch — Business Detail / Deal Detail

Source of truth read directly from:
- `ui-reference/Deals68 Deal.dc.html` — SHA `c7127add458bb6a1961021636e437c6800fc7745`

Updated file:
- `src/pages/BusinessDetail.tsx`

Scope:
- Port body layout of Deal/Business Detail from `.dc.html` into React.
- Does not use `.dc.html` runtime.
- Keeps shared Header/Footer from App, because Header/Footer were already ported as shared components.
- Converts `{{ }}` to typed data/state.
- Converts `sc-for` to `.map()`.
- Converts `sc-if` to conditional render.
- Converts `.dc.html` hrefs to React Router `Link` or actions.
- Keeps Supabase actions for express interest/request data where a real business row exists.

Section order preserved:
1. Breadcrumb
2. Main detail columns
3. Badges + title/subtitle
4. Hero image
5. Key facts
6. Business Quality Score
7. Business profile
8. Deal highlights
9. Facility & technology conditional
10. Financials 2024–2025
11. Documents
12. Disclaimer
13. Sidebar transaction summary
14. Connect card
15. Verified card
16. Similar deals
17. FAQ

Validation:
- TSX parse/transpile check passed locally in sandbox.
