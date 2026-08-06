#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const contractPath = path.join(
  repoRoot,
  'tests/specs/advisor-session0-business-baseline-contract.json',
);

assert.ok(fs.existsSync(contractPath), `Missing contract: ${contractPath}`);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

assert.equal(
  contract.runtimeChangesAllowed,
  false,
  'Session 0 must remain additive QA/documentation only.',
);
assert.ok(Array.isArray(contract.checks) && contract.checks.length > 0, 'Contract has no checks.');

const sourceCache = new Map();
const failures = [];
let passed = 0;

function readSource(relativePath) {
  if (sourceCache.has(relativePath)) return sourceCache.get(relativePath);
  const absolutePath = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Missing baseline source: ${relativePath}`);
  const content = fs.readFileSync(absolutePath, 'utf8');
  sourceCache.set(relativePath, content);
  return content;
}

for (const check of contract.checks) {
  try {
    assert.ok(check.id, 'Every contract check requires an id.');
    assert.ok(check.file, `${check.id}: missing file.`);
    const source = readSource(check.file);

    if (check.type === 'contains') {
      assert.ok(
        source.includes(check.value),
        `${check.id}: expected ${check.file} to contain ${JSON.stringify(check.value)}`,
      );
    } else if (check.type === 'notContains') {
      assert.ok(
        !source.includes(check.value),
        `${check.id}: expected ${check.file} not to contain ${JSON.stringify(check.value)}`,
      );
    } else if (check.type === 'regex') {
      const expression = new RegExp(check.pattern, check.flags || '');
      assert.match(source, expression, `${check.id}: regex did not match ${check.file}`);
    } else if (check.type === 'notRegex') {
      const expression = new RegExp(check.pattern, check.flags || '');
      assert.doesNotMatch(source, expression, `${check.id}: forbidden regex matched ${check.file}`);
    } else {
      throw new Error(`${check.id}: unsupported check type ${check.type}`);
    }

    passed += 1;
    console.log(`✓ ${check.id}`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    console.error(`✗ ${check.id}: ${failures.at(-1)}`);
  }
}

console.log('');
console.log(`Advisor Session 0 Business baseline: ${passed}/${contract.checks.length} checks passed.`);
console.log(`Sources locked: ${sourceCache.size}. Runtime changes allowed: ${contract.runtimeChangesAllowed}.`);

if (failures.length) {
  console.error('');
  console.error('Baseline regression detected:');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log('✓ Existing Business registration/login/dashboard contracts remain unchanged.');
