import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(
  root,
  'tests/specs/deals68-ui-business-fixes-v1-contract.json',
);
const manifest = JSON.parse(
  fs.readFileSync(manifestPath, 'utf8'),
);
const failures = [];
const ids = new Set();

function complete(checks) {
  return checks.every((check) => {
    const sourcePath = path.join(root, check.path);
    if (!fs.existsSync(sourcePath)) return false;
    const source = fs.readFileSync(sourcePath, 'utf8');
    const required = check.contains || [];
    const forbidden = check.notContains || [];
    return (
      required.every((token) => source.includes(token)) &&
      forbidden.every((token) => !source.includes(token))
    );
  });
}

for (const contract of manifest.contracts || []) {
  if (!contract.id || ids.has(contract.id)) {
    failures.push(
      `Contract ID is missing or duplicated: ${contract.id || '(empty)'}`,
    );
    continue;
  }
  ids.add(contract.id);

  if (!manifest.statusValues.includes(contract.status)) {
    failures.push(
      `${contract.id} has invalid status: ${contract.status}`,
    );
    continue;
  }
  if (!Number.isInteger(contract.session) || contract.session < 2) {
    failures.push(`${contract.id} has an invalid owner session`);
  }
  if (!contract.requirement || !contract.checks?.length) {
    failures.push(`${contract.id} lacks requirement/check coverage`);
    continue;
  }

  const implemented = complete(contract.checks);
  if (contract.status === 'completed' && !implemented) {
    failures.push(
      `${contract.id} is marked completed but its regression checks fail`,
    );
  }
  if (contract.status === 'pending' && implemented) {
    failures.push(
      `${contract.id} now passes; promote its status to completed`,
    );
  }
}

if (failures.length) {
  console.error('✗ Deals68 requested-fix contract check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

const pending = manifest.contracts.filter(
  (contract) => contract.status === 'pending',
);
const completed = manifest.contracts.length - pending.length;

console.log('✓ Deals68 requested-fix contract baseline: PASS');
console.log(
  `✓ ${manifest.contracts.length} contracts are uniquely owned by Sessions 2–8.`,
);
console.log(
  `✓ Status: ${completed} completed / ${pending.length} known pending gaps.`,
);
console.log(
  '✓ No network, Supabase project or test data was used.',
);
