#!/usr/bin/env node
import fs from 'node:fs';

const path = 'scripts/_apply_market_partner_phase4_ui.mjs';
const source = fs.readFileSync(path, 'utf8');
const before = '${REFERRAL_COOKIE}';
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected one REFERRAL_COOKIE interpolation, found ${count}`);
fs.writeFileSync(path, source.replace(before, '\\${REFERRAL_COOKIE}'));
console.log('✓ Phase 4 applicator escape fixed.');
