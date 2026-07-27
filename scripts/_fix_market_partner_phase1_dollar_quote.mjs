#!/usr/bin/env node
import fs from 'node:fs';

const path = 'supabase/migrations/20260727084802_market_partner_affiliate_phase1_v1.sql';
let source = fs.readFileSync(path, 'utf8');
const dollarQuote = String.fromCharCode(36).repeat(2);

const openToken = 'do $\nbegin';
const closeToken = '\n$;\n\nalter type public.user_role';
if ((source.split(openToken).length - 1) !== 1) throw new Error('Expected one broken opening dollar quote');
if ((source.split(closeToken).length - 1) !== 1) throw new Error('Expected one broken closing dollar quote');

source = source.replace(openToken, `do ${dollarQuote}\nbegin`);
source = source.replace(closeToken, `\n${dollarQuote};\n\nalter type public.user_role`);

if (!source.includes(`do ${dollarQuote}\nbegin`)) throw new Error('Opening dollar quote repair failed');
if (!source.includes(`\n${dollarQuote};\n\nalter type public.user_role`)) throw new Error('Closing dollar quote repair failed');

fs.writeFileSync(path, source);
console.log('✓ Phase 1 collision block dollar quotes repaired.');
