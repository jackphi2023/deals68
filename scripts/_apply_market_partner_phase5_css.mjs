#!/usr/bin/env node
import fs from 'node:fs';

const path = 'src/styles/pages/admin.css';
const source = fs.readFileSync(path, 'utf8');
const marker = '/* Market Partner Phase 5 finance */';
if (source.includes(marker)) {
  console.log('✓ Phase 5 Admin CSS already applied.');
  process.exit(0);
}

const css = `

${marker}
.d68-admin-market-partner-finance{display:grid;gap:14px;margin-top:14px}
.d68-admin-market-partner-finance>.d68-admin-card{margin-top:0}
.d68-admin-payout-groups{display:grid;gap:10px}
.d68-admin-payout-group{display:flex;justify-content:space-between;align-items:center;gap:16px;border:1px solid #E2E8F0;background:#F8FAFC;border-radius:12px;padding:14px}
.d68-admin-payout-group p{margin:5px 0 0;color:#64748B;font-size:13px}
.d68-admin-market-partner-finance code{font-size:11px;word-break:break-all}
@media(max-width:700px){.d68-admin-payout-group{align-items:flex-start;flex-direction:column}.d68-admin-payout-group .d68-admin-btn{width:100%}}
`;
fs.writeFileSync(path, source.trimEnd() + css + '\n');
console.log('✓ Phase 5 Admin CSS applied.');
