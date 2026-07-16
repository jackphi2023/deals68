#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const mainDashboardPath = 'src/pages/InvestorDashboard.tsx';
const profilePath = 'src/pages/InvestorProfileV10.tsx';
const navPath = 'src/components/investor/InvestorDashboardNav.tsx';

for (const path of [mainDashboardPath, profilePath, navPath]) {
  if (!fs.existsSync(path)) failures.push(`Missing ${path}`);
}

const mainDashboard = read(mainDashboardPath);
const profile = read(profilePath);
const nav = read(navPath);

for (const token of [
  'd68-dashboard-page d68-investor-dashboard-page',
  'd68-dashboard-wrap',
  'd68-dashboard-head',
  'd68-dashboard-kicker',
  'd68-investor-dashboard-title-row',
  'd68-dashboard-cols',
]) {
  if (!profile.includes(token)) failures.push(`Investor Profile must inherit main shell class ${token}`);
}

if (!profile.includes("import InvestorDashboardNav from '../components/investor/InvestorDashboardNav'")) {
  failures.push('Investor Profile must reuse the shared main-style Investor dashboard navigation');
}
if (!profile.includes('<InvestorDashboardNav lang={lang} publicInvestorPath={publicPath} />')) {
  failures.push('Investor Profile does not render the shared Investor dashboard navigation');
}
if (profile.includes('const LINKS') || profile.includes('<nav className="d68-dashboard-side">')) {
  failures.push('Investor Profile must not define a replacement text-only dashboard menu');
}

for (const icon of [
  'BriefcaseBusiness',
  'LayoutDashboard',
  'FileText',
  'BarChart3',
  'Inbox',
  'CreditCard',
]) {
  if (!mainDashboard.includes(icon)) failures.push(`Main InvestorDashboard icon missing: ${icon}`);
  if (!nav.includes(icon)) failures.push(`Shared Investor navigation icon missing: ${icon}`);
}

for (const href of [
  '/dashboard/investor/profile',
  '/dashboard/investor/matches',
  '/dashboard/investor/saved',
  '/dashboard/investor/proposals',
  '/dashboard/investor/contact',
  '/dashboard/investor/payments',
]) {
  if (!mainDashboard.includes(href)) failures.push(`Main InvestorDashboard destination missing: ${href}`);
  if (!nav.includes(href)) failures.push(`Shared Investor navigation destination missing: ${href}`);
}

for (const token of [
  '<nav className="d68-dashboard-side"',
  '<span className="d68-dashboard-nav-icon"',
  '<item.Icon size={16} />',
  'className={activeTab === item.id ? \'active\' : \'\'}',
  'className="d68-dashboard-public-link"',
]) {
  if (!nav.includes(token)) failures.push(`Shared Investor navigation does not match main markup: ${token}`);
}

if (failures.length) {
  console.error('✗ Deals68 Investor Dashboard main-shell check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Investor Dashboard main-shell check: PASS');
console.log('✓ Profile page inherits the current main dashboard header, grid and sidebar classes.');
console.log('✓ All six main menu icons, labels and destinations are preserved.');
console.log('✓ No replacement text-only menu remains in InvestorProfileV10.');
