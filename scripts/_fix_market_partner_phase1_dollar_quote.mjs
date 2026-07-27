#!/usr/bin/env node
import fs from 'node:fs';

const dollarQuote = String.fromCharCode(36).repeat(2);

function repairExactLines(path, expectedOpening, expectedClosing) {
  const source = fs.readFileSync(path, 'utf8');
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const opening = lines.reduce((all, line, index) => line === expectedOpening ? [...all, index] : all, []);
  const closing = lines.reduce((all, line, index) => line === expectedClosing ? [...all, index] : all, []);

  if (opening.length !== 1) throw new Error(`${path}: expected one broken opening dollar quote, found ${opening.length}`);
  if (closing.length !== 1) throw new Error(`${path}: expected one broken closing dollar quote, found ${closing.length}`);
  if (closing[0] <= opening[0]) throw new Error(`${path}: broken dollar-quote order is invalid`);

  lines[opening[0]] = expectedOpening.startsWith('do ') ? `do ${dollarQuote}` : `as ${dollarQuote}`;
  lines[closing[0]] = `${dollarQuote};`;
  const repaired = lines.join(newline);
  const repairedLines = repaired.split(/\r?\n/);

  if (repairedLines.some((line) => line === 'do $' || line === 'as $' || line === '$;')) {
    throw new Error(`${path}: broken dollar quote remains after repair`);
  }
  fs.writeFileSync(path, repaired);
}

repairExactLines(
  'supabase/migrations/20260727084802_market_partner_affiliate_phase1_v1.sql',
  'do $',
  '$;',
);
repairExactLines(
  'supabase/migrations/20260727124500_market_partner_affiliate_phase5_commission_payout_v1.sql',
  'as $',
  '$;',
);

console.log('✓ Phase 1 and Phase 5 dollar quotes repaired.');
