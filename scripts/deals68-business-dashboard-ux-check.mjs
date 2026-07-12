import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];

function requireToken(text, token, message) {
  if (!text.includes(token)) failures.push(message);
}

function forbidToken(text, token, message) {
  if (text.includes(token)) failures.push(message);
}

const page = read('src/pages/BusinessDashboard.tsx');
const indexCss = read('src/styles/index.css');
const dashboardCss = read('src/styles/pages/dashboard.css');
const businessCss = read('src/styles/pages/business-dashboard.css');
const cleanupCss = read('src/styles/pages/release-cleanup.css');

requireToken(
  page,
  "const lang = langFromPath(location.pathname) as Lang;",
  'Business Dashboard does not derive language from the URL',
);
forbidToken(
  page,
  'setLang(',
  'Business Dashboard still has a duplicate language control',
);
forbidToken(
  page,
  'signOut(',
  'Business Dashboard still has a duplicate logout control',
);
requireToken(
  page,
  'to={toLocalizedPath(t.href, lang)}',
  'Dashboard tab links do not preserve language',
);
requireToken(
  page,
  'href={toLocalizedPath(`/businesses/${b.slug}`, lang)}',
  'Public profile link does not preserve language',
);
requireToken(
  page,
  "to={toLocalizedPath('/investors', lang)}",
  'Investor list link does not preserve language',
);

requireToken(
  indexCss,
  "@import './pages/business-dashboard.css' layer(d68-overrides);",
  'Dedicated Business Dashboard CSS is not imported',
);
if (
  /(?:^|})\s*\.d68-dashboard-side\{max-height:calc\(100vh - 110px\);overflow:auto\}/
    .test(dashboardCss)
) {
  failures.push(
    'Generic dashboard sidebar still has an internal height cap',
  );
}
requireToken(
  dashboardCss,
  '.d68-investor-dashboard-page .d68-dashboard-side{' +
    'max-height:calc(100vh - 110px);overflow:auto}',
  'Legacy Investor behavior was not isolated',
);

for (const token of [
  '.d68-business-dashboard-page .d68-dashboard-side',
  'height: max-content',
  'max-height: none',
  'overflow: visible',
  'position: sticky',
  'top: 90px',
  'position: static',
]) {
  requireToken(
    businessCss,
    token,
    `Business Dashboard CSS is missing: ${token}`,
  );
}

forbidToken(
  cleanupCss,
  'G3 Business Dashboard',
  'G3 rules must not be added to release-cleanup.css',
);

if (failures.length) {
  console.error('✗ Deals68 G3 UX static check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 G3 Business Dashboard UX static check: PASS');
console.log('✓ Sidebar has no internal height cap on Business Dashboard.');
console.log('✓ Desktop remains sticky; tablet/mobile remains in normal flow.');
console.log('✓ Shared Header owns language and logout controls.');
console.log('✓ Dashboard links preserve VI/EN routes.');
console.log('✓ No release-cleanup.css patch added.');
