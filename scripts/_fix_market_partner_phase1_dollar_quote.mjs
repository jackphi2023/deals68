#!/usr/bin/env node
import fs from 'node:fs';

const path = 'supabase/migrations/20260727084802_market_partner_affiliate_phase1_v1.sql';
const source = fs.readFileSync(path, 'utf8');
const newline = source.includes('\r\n') ? '\r\n' : '\n';
const lines = source.split(/\r?\n/);
const dollarQuote = String.fromCharCode(36).repeat(2);
const opening = lines.reduce((all, line, index) => line === 'do $' ? [...all, index] : all, []);
const closing = lines.reduce((all, line, index) => line === '$;' ? [...all, index] : all, []);

if (opening.length !== 1) throw new Error(`Expected one broken opening dollar quote, found ${opening.length}`);
if (closing.length !== 1) throw new Error(`Expected one broken closing dollar quote, found ${closing.length}`);
if (closing[0] <= opening[0]) throw new Error('Broken dollar-quote order is invalid');

lines[opening[0]] = `do ${dollarQuote}`;
lines[closing[0]] = `${dollarQuote};`;
const repaired = lines.join(newline);

if (repaired.split(/\r?\n/).filter((line) => line === `do ${dollarQuote}`).length !== 1) {
  throw new Error('Opening dollar quote repair failed');
}
if (repaired.split(/\r?\n/).filter((line) => line === `${dollarQuote};`).length < 1) {
  throw new Error('Closing dollar quote repair failed');
}

fs.writeFileSync(path, repaired);
console.log('✓ Phase 1 collision block dollar quotes repaired.');
