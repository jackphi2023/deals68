#!/usr/bin/env node
import fs from 'node:fs';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
}

function replaceRequired(file, from, to) {
  const source = read(file);
  if (!source.includes(from)) {
    throw new Error(`Missing reconciliation anchor in ${file}: ${from}`);
  }
  write(file, source.replace(from, to));
}

const migrationCheck = 'scripts/deals68-migration-state-check.mjs';
let check = read(migrationCheck);
check = check
  .replaceAll(
    '20260724120937_business_dataroom_access_phase_e_stabilization.sql',
    '20260724130742_business_dataroom_access_phase_e_stabilization.sql',
  )
  .replaceAll(
    '20260724130029_investor_premium_price_v2.sql',
    '20260724130910_investor_premium_price_v2.sql',
  );
const forbiddenAnchor = "  '20260724120000_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',\n];";
if (!check.includes(forbiddenAnchor)) {
  throw new Error('Migration forbidden-list anchor missing.');
}
check = check.replace(
  forbiddenAnchor,
  "  '20260724120000_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',\n" +
    "  '20260724120937_business_dataroom_access_phase_e_stabilization.sql',\n" +
    "  '20260724130029_investor_premium_price_v2.sql',\n];",
);
write(migrationCheck, check);

const phaseE = 'docs/release/BUSINESS_FINANCIAL_ACCESS_PHASE_E_RELEASE_REVIEW.md';
replaceRequired(
  phaseE,
  'The new migration is committed but **NOT APPLIED** to Supabase production. Production deploy remains blocked until explicit migration approval and authenticated UAT.',
  'The migration is applied to Supabase production as version `20260724130742`. Production post-checks confirm the hardened Dataroom policies, zero active Dataroom grants and unchanged public financial redaction.',
);
replaceRequired(
  phaseE,
  'No Phase E function, policy, migration record, grant or audit row was persisted by this validation.\n\n## Netlify readiness',
  'No Phase E function, policy, migration record, grant or audit row was persisted by this validation.\n\n## Production application\n\n- Applied migration version: `20260724130742_business_dataroom_access_phase_e_stabilization.sql`.\n- `d68_get_business_dataroom_file_access(uuid)` exists.\n- `anon` cannot execute the Dataroom RPC or metadata RPC.\n- `authenticated` and `service_role` retain the intended execute permissions.\n- `business_files` and `storage.objects` SELECT policies use active, unexpired `dataroom` grants.\n- Active financial grants remain 287; active Dataroom grants remain 0.\n- Public exact revenue and EBITDA rows remain 0.\n\n## Netlify readiness',
);
replaceRequired(
  phaseE,
  '- New migration **NOT APPLIED** to production.\n',
  '',
);
write(phaseE, read(phaseE).replaceAll('20260724120937', '20260724130742'));

const pricingRelease = 'docs/release/INVESTOR_PREMIUM_PRICING_V2_RELEASE.md';
let pricing = read(pricingRelease)
  .replaceAll('20260724130029_investor_premium_price_v2.sql', '20260724130910_investor_premium_price_v2.sql')
  .replace(
    '- Migration is committed but NOT APPLIED until release approval and QA complete.',
    '- Migration version `20260724130910` is applied to production and verified through the canonical RPC.',
  );
const releaseSequence = `## Release sequence

1. Build and focused Investor pricing/registration/Admin QA.
2. Regression checks for financial access, Business Reports, routes and CSS.
3. Apply Phase E migration, then the Premium price V2 migration.
4. Verify production RPC prices and financial redaction.
5. Merge the verified building release to main.
6. Verify the Netlify deployment generated from the main commit.`;
if (!pricing.includes(releaseSequence)) {
  throw new Error('Pricing release sequence anchor missing.');
}
pricing = pricing.replace(
  releaseSequence,
  `## Release status

- Build and focused Investor pricing/registration/Admin QA: PASS.
- Financial Access A–E, Business Reports, routes and CSS regressions: PASS.
- Phase E production migration: APPLIED as version \`20260724130742\`.
- Premium price V2 production migration: APPLIED as version \`20260724130910\`.
- Production RPC verification: 26,000,000 VND/month in Vietnam and 1,000 USD/month elsewhere.
- Public financial redaction verification: PASS.
- Main merge and Netlify deployment verification: pending the final release cutover.`,
);
write(pricingRelease, pricing);

console.log('Production migration ledger reconciliation applied.');
