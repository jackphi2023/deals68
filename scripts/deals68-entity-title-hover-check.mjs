import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];

function requireToken(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

const foundation = read('src/styles/final/release-foundation.css');
const sharedCss = read('src/styles/pages/ui-fixes.css');
const home = read('src/pages/Home.tsx');
const businesses = read('src/pages/Businesses.tsx');
const investors = read('src/pages/Investors.tsx');
const investorDetail = read('src/pages/InvestorDetail.tsx');
const businessDetail = read('src/pages/BusinessDetail.tsx');
const businessDashboard = read('src/pages/BusinessDashboard.tsx');
const businessTitleLink = read(
  'src/components/investor/BusinessTitleLink.tsx',
);

requireToken(
  foundation,
  '--d68-entity-title-hover:rgb(27,173,234)',
  'Shared entity-title hover token is missing or has the wrong color',
);
for (const token of [
  '.d68-entity-title-link:focus-visible',
  'a:hover .d68-entity-title-link',
  'a:focus-visible .d68-entity-title-link',
  'color:var(--d68-entity-title-hover,rgb(27,173,234))!important',
  'text-decoration:none!important',
]) {
  requireToken(
    sharedCss,
    token,
    `Shared entity-title interaction CSS missing ${token}`,
  );
}

const surfaces = [
  [
    'Homepage Business',
    home,
    '<h3 className="d68-entity-title-link">{d.title}</h3>',
  ],
  [
    'Homepage Investor',
    home,
    'd68-home-investor-title-link d68-entity-title-link',
  ],
  [
    'Business list',
    businesses,
    '<h3 className="d68-entity-title-link">{title}</h3>',
  ],
  [
    'Investor list',
    investors,
    'd68-investor-card__title-link d68-entity-title-link',
  ],
  [
    'Investor Detail proposal history',
    investorDetail,
    'className="d68-entity-title-link"',
  ],
  [
    'Business Detail related businesses',
    businessDetail,
    '<h3 className="d68-entity-title-link">{deal.title}</h3>',
  ],
  [
    'Business Dashboard proposals',
    businessDashboard,
    'd68-dashboard-row-title d68-entity-title-link',
  ],
  [
    'Investor Dashboard BusinessTitleLink',
    businessTitleLink,
    "'d68-entity-title-link'",
  ],
];

for (const [label, source, token] of surfaces) {
  requireToken(
    source,
    token,
    `${label} does not use the shared entity-title class`,
  );
}

const legacyUnderlinePatterns = [
  /d68-investor-card__title-link[^}]*text-decoration:underline/s,
  /d68-id-timeline--proposal a:hover[^}]*text-decoration:underline/s,
  /d68-dashboard-row-title:hover[^}]*text-decoration:underline/s,
  /d68-investor-business-title-link:hover[^}]*text-decoration:underline/s,
];
const cssSources = [
  read('src/styles/pages/investors.css'),
  read('src/styles/pages/investor-detail.css'),
  read('src/styles/pages/dashboard.css'),
  read('src/styles/pages/investor-workflow.css'),
];

for (const pattern of legacyUnderlinePatterns) {
  if (cssSources.some((source) => pattern.test(source))) {
    failures.push(`Legacy entity-title underline remains: ${pattern}`);
  }
}

if (failures.length) {
  console.error('✗ Deals68 entity-title hover check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 entity-title hover contract: PASS');
console.log('✓ Business/Investor names use rgb(27, 173, 234).');
console.log('✓ Hover and keyboard focus never add an underline.');
console.log(`✓ ${surfaces.length} requested surfaces are covered.`);
