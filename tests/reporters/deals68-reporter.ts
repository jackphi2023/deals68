import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, FullConfig, Suite, TestCase, TestResult } from '@playwright/test/reporter';

type Row = { id:string; title:string; file:string; project:string; status:string; expectedStatus:string; durationMs:number; errors:string[]; annotations:{type:string;description?:string}[] };
function esc(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string,string>)[s]); }

export default class Deals68Reporter implements Reporter {
  private rows: Row[] = [];
  private startedAt = new Date().toISOString();
  private outputDir = 'reports/deals68';
  onBegin(_config: FullConfig, _suite: Suite) { fs.mkdirSync(this.outputDir, { recursive: true }); }
  onTestEnd(test: TestCase, result: TestResult) {
    this.rows.push({ id:test.id, title:test.titlePath().join(' › '), file:test.location.file, project:test.parent.project()?.name || '', status:result.status, expectedStatus:test.expectedStatus, durationMs:result.duration, errors:result.errors.map((e) => e.message || String(e)), annotations:test.annotations });
  }
  async onEnd() {
    const endedAt = new Date().toISOString();
    const summary = { startedAt:this.startedAt, endedAt, total:this.rows.length, passed:this.rows.filter(r=>r.status==='passed').length, failed:this.rows.filter(r=>r.status==='failed').length, skipped:this.rows.filter(r=>r.status==='skipped').length, timedOut:this.rows.filter(r=>r.status==='timedOut').length, interrupted:this.rows.filter(r=>r.status==='interrupted').length };
    fs.writeFileSync(path.join(this.outputDir,'test-report.json'), JSON.stringify({ summary, tests:this.rows }, null, 2));
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Deals68 Test Report</title><style>body{font-family:Arial,sans-serif;margin:0;background:#f6f8fb;color:#0f2a4a}header{background:#0f2a4a;color:#fff;padding:24px 32px}main{padding:24px 32px}.cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:24px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}.pass{color:#16a34a}.fail{color:#dc2626}.skip{color:#64748b}table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top;font-size:13px}th{background:#eaf6fd}code{white-space:pre-wrap;color:#b91c1c}</style></head><body><header><h1>Deals68 Automated Test Report</h1><p>${esc(summary.startedAt)} → ${esc(summary.endedAt)}</p></header><main><section class="cards"><div class="card"><b>Total</b><h2>${summary.total}</h2></div><div class="card"><b>Passed</b><h2 class="pass">${summary.passed}</h2></div><div class="card"><b>Failed</b><h2 class="fail">${summary.failed}</h2></div><div class="card"><b>Skipped</b><h2 class="skip">${summary.skipped}</h2></div><div class="card"><b>Timed out</b><h2 class="fail">${summary.timedOut}</h2></div><div class="card"><b>Interrupted</b><h2 class="fail">${summary.interrupted}</h2></div></section><table><thead><tr><th>Status</th><th>Project</th><th>Test</th><th>File</th><th>Duration</th><th>Errors</th></tr></thead><tbody>${this.rows.map(r=>`<tr><td class="${r.status==='passed'?'pass':r.status==='skipped'?'skip':'fail'}">${esc(r.status)}</td><td>${esc(r.project)}</td><td>${esc(r.title)}</td><td>${esc(r.file)}</td><td>${r.durationMs}ms</td><td><code>${esc(r.errors.join('\n\n'))}</code></td></tr>`).join('')}</tbody></table></main></body></html>`;
    fs.writeFileSync(path.join(this.outputDir,'test-report.html'), html);
    console.log(`Deals68 report written to ${this.outputDir}/test-report.html`);
  }
}
