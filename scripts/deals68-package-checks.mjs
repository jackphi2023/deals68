#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const scripts = [
  'scripts/deals68-security-phase-a-check.mjs',
  'scripts/deals68-business-assets-security-check.mjs',
  'scripts/deals68-business-dashboard-ux-check.mjs',
  'scripts/deals68-investor-dashboard-ux-check.mjs',
  'scripts/deals68-home-investors-hero-ux-check.mjs',
  'scripts/deals68-register-valuation-ux-check.mjs',
  'scripts/deals68-payment-invoice-hardening-check.mjs',
  'scripts/deals68-admin-operations-check.mjs',
  'scripts/deals68-phase-a-hardening-check.mjs',
  'scripts/deals68-public-discovery-ux-check.mjs',
  'scripts/deals68-register-about-cta-ux-check.mjs',
  'scripts/deals68-business-dashboard-overview-spacing-check.mjs',
  'scripts/deals68-css-architecture-check.mjs',
  'scripts/deals68-migration-state-check.mjs',
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
