#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir)
  .filter((name) => name.includes('market_partner_affiliate_phase'))
  .sort();

assert.equal(files.length, 5, `Expected 5 Market Partner Phase migrations, found ${files.length}`);

for (const file of files) {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/);
  const broken = lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line === 'do $' || line === 'as $' || line === '$;');
  assert.deepEqual(broken, [], `${file} contains broken single-dollar SQL quote lines: ${JSON.stringify(broken)}`);
}

console.log('✓ Market Partner SQL dollar-quote contract: PASS');
