#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'scripts/qa-market-partner-v1.mjs',
  `assert.match(partnerDashboard, /Phase 2 không tự tính hoặc tạo hoa hồng/);
assert.match(partnerDashboard, /Phase 3 đã kích hoạt click và signup attribution/);
assert.match(partnerDashboard, /Tracking \\?ref=CODE đang hoạt động/);`,
  `assert.match(partnerLogin, /d68_claim_market_partner_signup/);
assert.match(partnerLogin, /market_partner_activation_nonce/);
assert.match(partnerDashboard, /Commission lịch sử dùng snapshot X\\/Y/);
assert.match(partnerDashboard, /Lịch sử payout/);
assert.match(partnerDashboard, /Không hiển thị danh tính khách hàng hoặc payment payload/);`,
);

replaceOnce(
  'scripts/qa-market-partner-phase4.mjs',
  `  'READ-ONLY · PHASE 4',`,
  `  'READ-ONLY · MARKET PARTNER',`,
);

console.log('✓ Phase 5 QA reconciliation applied.');
