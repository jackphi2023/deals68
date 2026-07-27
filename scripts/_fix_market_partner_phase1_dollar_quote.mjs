#!/usr/bin/env node
import fs from 'node:fs';

const path = 'supabase/migrations/20260727084802_market_partner_affiliate_phase1_v1.sql';
let source = fs.readFileSync(path, 'utf8');
const dollarQuote = String.fromCharCode(36).repeat(2);
const openPattern = /^do \$$/gm;
const closePattern = /^\$;$/gm;
const openMatches = source.match(openPattern) || [];
const closeMatches = source.match(closePattern) || [];

if (openMatches.length !== 1) throw new Error(`Expected one broken opening dollar quote, found ${openMatches.length}`);
if (closeMatches.length !== 1) throw new Error(`Expected one broken closing dollar quote, found ${closeMatches.length}`);

source = source.replace(openPattern, `do ${dollarQuote}`);
source = source.replace(closePattern, `${dollarQuote};`);

if (!source.includes(`do ${dollarQuote}\nbegin`) && !source.includes(`do ${dollarQuote}\r\nbegin`)) {
  throw new Error('Opening dollar quote repair failed');
}
if (!source.includes(`\n${dollarQuote};\n\nalter type public.user_role`) && !source.includes(`\r\n${dollarQuote};\r\n\r\nalter type public.user_role`)) {
  throw new Error('Closing dollar quote repair failed');
}

fs.writeFileSync(path, source);
console.log('✓ Phase 1 collision block dollar quotes repaired.');
