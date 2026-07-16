# Investor Workflow V14 QA

Target branch: `beta-reference`

This gate verifies the Investor workflow without modifying `main`:

- canonical Investor registration taxonomy;
- Dashboard Profile using the current main menu, icons and layout classes;
- Vietnamese labels and shared tag pickers;
- Admin Investor list filters, review alerts and detail workflow;
- custom/default cover precedence;
- separate profile and appetite approval;
- public Investor changes remain pending until Admin approval;
- production build, package, CSS and migration-state checks;
- public Netlify Beta regression smokes.
