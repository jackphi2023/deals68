#!/usr/bin/env node
import fs from 'node:fs';
const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const service = read('src/lib/businessFinancialAccess.ts');
const detail = read('src/pages/BusinessDetail.tsx');
const investor = read('src/pages/InvestorDashboard.tsx');
const business = read('src/pages/BusinessDashboard.tsx');
const css = read('src/styles/components/business-financial-access.css');
for (const name of ['d68_request_business_financial_access','d68_respond_business_financial_request','d68_revoke_business_financial_access']) if (!service.includes(name)) failures.push(`Missing secure RPC wrapper: ${name}`);
if (detail.includes("from('request_data').insert")) failures.push('Business Detail still inserts request_data directly');
if (investor.includes("from('request_data').insert")) failures.push('Investor Dashboard still inserts request_data directly');
if (business.includes("from('request_data').update({ status: 'fulfilled'")) failures.push('Business Dashboard still marks request fulfilled directly');
for (const text of ['Yêu cầu xem số liệu','Request financial access','Đang chờ doanh nghiệp chấp thuận','Awaiting Business approval','Đã được cấp quyền','Access granted']) if (!(detail + investor + business).includes(text)) failures.push(`Missing Phase D wording: ${text}`);
for (const text of ['Chấp thuận yêu cầu','Thu hồi quyền truy cập','financial_summary','financial_detail']) if (!business.includes(text)) failures.push(`Business request UI missing: ${text}`);
if (business.includes("onRespond(row, 'approve', ['financial_summary', 'financial_detail', 'dataroom']")) failures.push('Phase D must not auto-grant Dataroom');
if (!business.includes("not enabled in Phase D") || !business.includes("chưa mở trong Phiên D")) failures.push('Dataroom boundary notice missing');
if (!css.includes('#f7fafc')) failures.push('Phase D request cards must use light blue background');
if (!service.includes('financialAccessErrorMessage')) failures.push('User-safe error mapping missing');
const pkg = JSON.parse(read('package.json') || '{}');
if (pkg.scripts?.['qa:financial-workflow-phase-d'] !== 'node scripts/deals68-business-financial-workflow-phase-d-check.mjs') failures.push('Phase D package script missing');
if (failures.length) { console.error('✗ Deals68 Financial Workflow Phase D check failed:'); failures.forEach((x) => console.error(`  - ${x}`)); process.exit(1); }
console.log('✓ Deals68 Financial Workflow Phase D contract: PASS');
