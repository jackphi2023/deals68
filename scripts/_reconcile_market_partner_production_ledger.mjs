#!/usr/bin/env node
import fs from 'node:fs';

const migrations = [
  ['20260727084802_market_partner_affiliate_phase1_v1.sql', '20260727143814_market_partner_affiliate_phase1_v1.sql'],
  ['20260727103000_market_partner_affiliate_phase2_dashboard_v1.sql', '20260727143921_market_partner_affiliate_phase2_dashboard_v1.sql'],
  ['20260727110000_market_partner_affiliate_phase3_referral_v1.sql', '20260727143956_market_partner_affiliate_phase3_referral_v1.sql'],
  ['20260727113000_market_partner_affiliate_phase4_checkout_v1.sql', '20260727144031_market_partner_affiliate_phase4_checkout_v1.sql'],
  ['20260727124500_market_partner_affiliate_phase5_commission_payout_v1.sql', '20260727144122_market_partner_affiliate_phase5_commission_payout_v1.sql'],
];

for (const [oldName, newName] of migrations) {
  const oldPath = `supabase/migrations/${oldName}`;
  const newPath = `supabase/migrations/${newName}`;
  if (!fs.existsSync(oldPath)) throw new Error(`Missing source migration ${oldName}`);
  if (fs.existsSync(newPath)) throw new Error(`Reconciled migration already exists ${newName}`);
  fs.renameSync(oldPath, newPath);
}

function replaceVersions(path) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [oldName, newName] of migrations) source = source.split(oldName).join(newName);
  fs.writeFileSync(path, source);
}

replaceVersions('scripts/deals68-migration-state-check.mjs');
replaceVersions('docs/release/MIGRATION_STATE.md');

{
  const path = 'scripts/deals68-migration-state-check.mjs';
  let source = fs.readFileSync(path, 'utf8');
  const marker = "  '20260724153000_homepage_business_ids_safe_view_v1.sql',\n];";
  if (!source.includes(marker)) throw new Error('Forbidden-list insertion marker not found');
  const oldNames = migrations.map(([oldName]) => `  '${oldName}',`).join('\n');
  source = source.replace(marker, `  '20260724153000_homepage_business_ids_safe_view_v1.sql',\n${oldNames}\n];`);
  fs.writeFileSync(path, source);
}

{
  const path = 'docs/release/MIGRATION_STATE.md';
  let source = fs.readFileSync(path, 'utf8');
  const rows = [
    '| 20260727143814 | `20260727143814_market_partner_affiliate_phase1_v1.sql` — applied to production |',
    '| 20260727143921 | `20260727143921_market_partner_affiliate_phase2_dashboard_v1.sql` — applied to production |',
    '| 20260727143956 | `20260727143956_market_partner_affiliate_phase3_referral_v1.sql` — applied to production |',
    '| 20260727144031 | `20260727144031_market_partner_affiliate_phase4_checkout_v1.sql` — applied to production |',
    '| 20260727144122 | `20260727144122_market_partner_affiliate_phase5_commission_payout_v1.sql` — applied to production |',
  ].join('\n');
  const tableMarker = '| 20260724150019 | `20260724150019_business_public_ebitda_visibility_v1.sql` — applied to production |';
  if (!source.includes(tableMarker)) throw new Error('Migration ledger table marker not found');
  source = source.replace(tableMarker, `${tableMarker}\n${rows}`);
  source = source
    .replace('Market Partner/Affiliate Phase 1 source only;', 'Market Partner/Affiliate Phase 1 applied to production;')
    .replace('Market Partner/Affiliate Phase 2 source only;', 'Market Partner/Affiliate Phase 2 applied to production;')
    .replace('Market Partner/Affiliate Phase 3 source only;', 'Market Partner/Affiliate Phase 3 applied to production;')
    .replace('Market Partner/Affiliate Phase 4 source only;', 'Market Partner/Affiliate Phase 4 applied to production;')
    .replace('Market Partner/Affiliate Phase 5 source only;', 'Market Partner/Affiliate Phase 5 applied to production;')
    .replaceAll(' **Not applied to production.**', ' **Applied and verified on production.**');
  fs.writeFileSync(path, source);
}

{
  const path = 'docs/release/MARKET_PARTNER_PHASE5_RELEASE.md';
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace(
    'Status: source complete on `feature/market-partner-affiliate-v1`; production migration and branch merges remain gated by production verification.',
    'Status: source complete and all five migrations applied and verified on production; branch merges remain gated by post-reconciliation QA.',
  );
  const productionSection = `\n\n## Production verification — 27 July 2026\n\nApplied ledger versions:\n\n- \`20260727143814\` — Phase 1 foundation and collision-safe legacy archive;\n- \`20260727143921\` — Phase 2 Partner Dashboard;\n- \`20260727143956\` — Phase 3 referral attribution;\n- \`20260727144031\` — Phase 4 server-side X/Y checkout;\n- \`20260727144122\` — Phase 5 activation, commission and payout.\n\nVerified after apply:\n\n- the five Market Partner tables, enum role, functions and confirmed-payment trigger exist;\n- the two incompatible empty placeholder tables are preserved in locked \`d68_legacy\`;\n- all new ledgers contain zero rows at cutover;\n- RLS is enabled on all five tables and anon cannot select them;\n- anon/authenticated cannot use the legacy archive schema;\n- public activation RPCs return only generic true/false or perform nonce-bound claim; Admin/financial RPCs are not executable by anon.\n`;
  if (!source.includes('## Production verification — 27 July 2026')) source += productionSection;
  fs.writeFileSync(path, source);
}

console.log('✓ Market Partner production migration ledger reconciled.');
