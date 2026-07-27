#!/usr/bin/env node
import fs from 'node:fs';

const dollarQuote = String.fromCharCode(36).repeat(2);

function repairExactLines(path, brokenOpening, properOpening) {
  const source = fs.readFileSync(path, 'utf8');
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const opening = lines.reduce((all, line, index) => line === brokenOpening ? [...all, index] : all, []);
  const closing = lines.reduce((all, line, index) => line === '$;' ? [...all, index] : all, []);

  if (opening.length === 0 && closing.length === 0) {
    if (!lines.includes(properOpening)) throw new Error(`${path}: no broken quote found, but proper opening quote is missing`);
    return false;
  }
  if (opening.length !== 1) throw new Error(`${path}: expected one broken opening dollar quote, found ${opening.length}`);
  if (closing.length !== 1) throw new Error(`${path}: expected one broken closing dollar quote, found ${closing.length}`);
  if (closing[0] <= opening[0]) throw new Error(`${path}: broken dollar-quote order is invalid`);

  lines[opening[0]] = properOpening;
  lines[closing[0]] = `${dollarQuote};`;
  const repaired = lines.join(newline);
  const repairedLines = repaired.split(/\r?\n/);

  if (repairedLines.some((line) => line === 'do $' || line === 'as $' || line === '$;')) {
    throw new Error(`${path}: broken dollar quote remains after repair`);
  }
  fs.writeFileSync(path, repaired);
  return true;
}

const repairedPhase1 = repairExactLines(
  'supabase/migrations/20260727084802_market_partner_affiliate_phase1_v1.sql',
  'do $',
  `do ${dollarQuote}`,
);
const repairedPhase5 = repairExactLines(
  'supabase/migrations/20260727124500_market_partner_affiliate_phase5_commission_payout_v1.sql',
  'as $',
  `as ${dollarQuote}`,
);

console.log(`✓ Market Partner dollar quotes verified (Phase 1 repaired=${repairedPhase1}, Phase 5 repaired=${repairedPhase5}).`);
