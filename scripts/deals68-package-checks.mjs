#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const scripts = [
  'scripts/deals68-security-phase-a-check.mjs',
  'scripts/deals68-business-assets-security-check.mjs',
  'scripts/deals68-business-dashboard-ux-check.mjs',
  'scripts/deals68-investor-dashboard-ux-check.mjs',
  'scripts/deals68-home-investors-hero-ux-check.mjs',
  'scripts/deals68-entity-title-hover-check.mjs',
  'scripts/deals68-business-location-flow-check.mjs',
  'scripts/deals68-business-register-copy-term-check.mjs',
  'scripts/deals68-business-dashboard-auth-profile-check.mjs',
  'scripts/deals68-register-valuation-ux-check.mjs',
  'scripts/deals68-payment-invoice-hardening-check.mjs',
  'scripts/deals68-admin-operations-check.mjs',
  'scripts/deals68-phase-a-hardening-check.mjs',
  'scripts/deals68-public-discovery-ux-check.mjs',
  'scripts/deals68-register-about-cta-ux-check.mjs',
  'scripts/deals68-business-dashboard-overview-spacing-check.mjs',
  'scripts/deals68-admin-business-financial-review-check.mjs',
  'scripts/deals68-business-detail-assets-transaction-check.mjs',
  'scripts/deals68-investor-detail-localization-check.mjs',
  'scripts/deals68-investor-profile-contract-v2-check.mjs',
  'scripts/deals68-investor-profile-postgres-v2-test.mjs',
  'scripts/deals68-css-architecture-check.mjs',
  'scripts/deals68-migration-state-check.mjs',
  'scripts/deals68-ui-business-fixes-v1-contract-check.mjs',
];

for (const script of scripts) {
  if (!fs.existsSync(script)) {
    console.error(`✗ Missing QA script: ${script}`);
    process.exit(1);
  }
  console.log(`\n▶ ${script}`);
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n✓ Deals68 package checks: ${scripts.length}/${scripts.length} PASS`);
