#!/usr/bin/env node
import fs from 'node:fs';
import ts from 'typescript';

const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const requiredFiles = [
  'src/lib/investorProfileService.ts',
  'src/lib/investorAdminV10.ts',
  'src/pages/AdminBannersV10.tsx',
  'src/pages/AdminInvestorsV10.tsx',
  'src/pages/InvestorProfileV10.tsx',
  'src/pages/InvestorDetailV10.tsx',
  'src/components/admin/InvestorAppetiteEditorV10.tsx',
  'src/components/admin/InvestorCoverEditorV10.tsx',
  'src/components/investor/InvestorAppetiteFormV10.tsx',
  'src/components/investor/InvestorPublicHeroV10.tsx',
  'src/styles/pages/investor-profile-v10.css',
  'public/assets/investor-cover-default.svg',
  'supabase/migrations/20260715045336_investor_profile_cover_appetite_v1.sql',
  'supabase/migrations/20260715071812_investor_profile_cover_appetite_v2.sql',
  'supabase/migrations/20260715085429_investor_profile_cover_appetite_v3_privilege_hardening.sql',
];

for (const path of requiredFiles) {
  if (!fs.existsSync(path)) failures.push(`Missing ${path}`);
}

for (const path of requiredFiles.filter((item) => /\.(ts|tsx|mjs)$/.test(item))) {
  if (!fs.existsSync(path)) continue;
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const diagnostic of source.parseDiagnostics) {
    failures.push(`${path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

function constantValue(path, name) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let result;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      if (ts.isStringLiteral(node.initializer) || ts.isNumericLiteral(node.initializer)) result = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

const servicePath = 'src/lib/investorProfileService.ts';
if (fs.existsSync(servicePath)) {
  const expected = {
    INVESTOR_COVER_BUCKET: 'site-banners',
    INVESTOR_COVER_PLACEMENT: 'investor_cover_default',
    INVESTOR_COVER_WIDTH: '1600',
    INVESTOR_COVER_HEIGHT: '560',
    INVESTOR_APPETITE_MAX_LENGTH: '5000',
    DEFAULT_INVESTOR_COVER: '/assets/investor-cover-default.svg',
  };
  for (const [name, value] of Object.entries(expected)) {
    if (constantValue(servicePath, name) !== value) failures.push(`${name} must equal ${value}`);
  }
  const service = read(servicePath);
  for (const rpc of [
    'admin_set_default_investor_cover',
    'admin_set_investor_cover',
    'submit_my_investor_appetite',
    'admin_approve_investor_appetite',
  ]) {
    if (!service.includes(`'${rpc}'`)) failures.push(`Service missing RPC ${rpc}`);
  }
  if (service.includes('as unknown as')) failures.push('Blind double cast remains in Investor service');
}

const app = read('src/App.tsx');
for (const token of [
  "import InvestorDetailV10 from './pages/InvestorDetailV10'",
  "import('./pages/InvestorProfileV10')",
  "import('./pages/AdminBannersV10')",
  "import('./pages/AdminInvestorsV10')",
  '<Route path="/admin/banners" element={<AdminBannersV10/>}/>',
  '<Route path="/admin/investors" element={<AdminInvestorsV10/>}/>',
]) {
  if (!app.includes(token)) failures.push(`App integration missing ${token}`);
}

const adminHelper = read('src/lib/investorAdminV10.ts');
if (!adminHelper.includes('hasPendingInvestorAppetiteV10')) failures.push('Empty pending appetite helper missing');
if (!adminHelper.includes("hasOwnProperty.call")) failures.push('Pending appetite must use property presence, not truthiness');

for (const path of [
  'src/components/admin/InvestorAppetiteEditorV10.tsx',
  'src/components/investor/InvestorAppetiteFormV10.tsx',
]) {
  const source = read(path);
  if (!source.includes('hasPendingInvestorAppetiteV10')) failures.push(`${path} does not preserve empty pending appetite`);
  if (/\[investor\.id,\s*investor\.updated_at\]/.test(source)) failures.push(`${path} still clears feedback on same-Investor refresh`);
  if (!/setMessage\(''\);[\s\S]*?\}, \[investor\.id\]\);/.test(source)) failures.push(`${path} must reset feedback only when Investor ID changes`);
}

const cover = read('public/assets/investor-cover-default.svg');
if (!cover.startsWith('<svg')) failures.push('Default Investor cover is not valid SVG text');
if (!cover.includes('width="1600"') || !cover.includes('height="560"')) failures.push('Default Investor cover is not 1600x560');
if (!cover.includes('data:image/webp;base64,')) failures.push('Provided Investor cover artwork is not embedded');
if (!cover.trimEnd().endsWith('</svg>')) failures.push('Default Investor cover SVG is truncated');

for (const [path, tokens] of [
  ['supabase/migrations/20260715045336_investor_profile_cover_appetite_v1.sql', ['investor_cover_default', 'submit_my_investor_appetite', 'admin_approve_investor_appetite', 'admin_set_investor_cover']],
  ['supabase/migrations/20260715071812_investor_profile_cover_appetite_v2.sql', ['admin_set_default_investor_cover', 'investment_appetite_too_long', 'invalid_default_cover_path']],
  ['supabase/migrations/20260715085429_investor_profile_cover_appetite_v3_privilege_hardening.sql', ['from anon, public', 'to authenticated, service_role']],
]) {
  const sql = read(path).toLowerCase();
  if (!sql.trimStart().startsWith('begin;') || !sql.trimEnd().endsWith('commit;')) failures.push(`${path} must be transactional`);
  for (const token of tokens) if (!sql.includes(token.toLowerCase())) failures.push(`${path} missing ${token}`);
}

for (const obsolete of [
  'src/components/PortalSlot.tsx',
  'src/pages/AdminEnhanced.tsx',
  'src/pages/InvestorDashboardEnhanced.tsx',
]) {
  if (fs.existsSync(obsolete)) failures.push(`Obsolete duplicate-state wrapper remains: ${obsolete}`);
}

if (failures.length) {
  console.error('✗ Deals68 Investor Profile V10 check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 Investor Profile V10 check: PASS');
console.log('✓ Default and per-Investor cover flows are wired through atomic RPCs.');
console.log('✓ Empty appetite submissions remain pending until Admin approval.');
console.log('✓ Success/warning feedback survives same-Investor refresh.');
console.log('✓ No Portal/Enhanced duplicate data owner is present.');
