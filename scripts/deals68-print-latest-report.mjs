import fs from 'node:fs';
import path from 'node:path';
const reportPath = path.join('reports','deals68','test-report.json');
if (!fs.existsSync(reportPath)) { console.error(`No report found at ${reportPath}. Run npm run test:e2e first.`); process.exit(1); }
const report = JSON.parse(fs.readFileSync(reportPath,'utf8'));
const s = report.summary || {};
console.log('\nDeals68 Test Report');
console.log('===================');
console.log(`Total: ${s.total || 0}`);
console.log(`Passed: ${s.passed || 0}`);
console.log(`Failed: ${s.failed || 0}`);
console.log(`Skipped: ${s.skipped || 0}`);
console.log(`Timed out: ${s.timedOut || 0}`);
console.log(`HTML: reports/deals68/test-report.html\n`);
const failed = (report.tests || []).filter((t) => !['passed','skipped'].includes(t.status));
if (failed.length) {
  console.log('Failures');
  console.log('--------');
  for (const t of failed) {
    console.log(`- [${t.status}] ${t.title}`);
    console.log(`  File: ${t.file}`);
    if (t.errors?.length) console.log(`  Error: ${t.errors[0].split('\n')[0]}`);
  }
  process.exit(2);
}
