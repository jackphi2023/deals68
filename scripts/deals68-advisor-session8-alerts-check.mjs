#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260810170000_advisor_authority_expiry_alerts_phase8_v1.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const advisorLib = fs.readFileSync('src/lib/advisorAuthorityEvidence.ts', 'utf8');
const advisorPanel = fs.readFileSync('src/components/AdvisorAuthorityEvidencePanel.tsx', 'utf8');
const advisorPage = fs.readFileSync('src/pages/AdvisorAccount.tsx', 'utf8');
const adminLib = fs.readFileSync('src/lib/adminAdvisorIntakes.ts', 'utf8');
const adminCard = fs.readFileSync('src/components/AdminAdvisorIntakeCard.tsx', 'utf8');
const adminPage = fs.readFileSync('src/pages/AdminAdvisorIntakes.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const token of [
  'create table if not exists public.advisor_authority_alert_receipts',
  'alter table public.advisor_authority_alert_receipts enable row level security',
  'revoke all on table public.advisor_authority_alert_receipts from public, anon, authenticated',
  "alert_code in ('rereview_pending','expired','expiry_7d','expiry_14d','expiry_30d')",
  'advisor_authority_alert_receipts_unique unique (assignment_id, profile_id, alert_key)',
  'd68_get_my_authority_review_v3',
  'd68_advisor_ack_authority_expiry_alert_v1',
  'd68_admin_list_advisor_business_intakes_v4',
  'public.d68_get_my_authority_review_v2(p_assignment_id)',
  'public.d68_admin_list_advisor_business_intakes_v3()',
  "when 'rereview_pending' then 0",
  "when 'expired' then 1",
  "when 'expiry_7d' then 2",
  "when 'expiry_14d' then 3",
  "when 'expiry_30d' then 4",
  "'external_notification_delivery_enabled', false",
  "'business_mutations_enabled', false",
  "'publication_enabled', false",
  "set search_path = ''",
]) assert.ok(migration.includes(token), `Session 8 migration missing contract token: ${token}`);

for (const signature of [
  'public.d68_get_my_authority_review_v3(uuid)',
  'public.d68_advisor_ack_authority_expiry_alert_v1(uuid,text)',
  'public.d68_admin_list_advisor_business_intakes_v4()',
]) {
  assert.ok(migration.includes(`revoke all on function ${signature} from public, anon, authenticated`), `Missing fail-closed revoke for ${signature}`);
  assert.ok(migration.includes(`grant execute on function ${signature} to authenticated, service_role`), `Missing authenticated/service grant for ${signature}`);
}

assert.ok(/p_alert_key\s+is\s+null\s+or\s+p_alert_key\s+<>\s+v_expected_key/i.test(migration), 'Advisor acknowledgement must reject stale/arbitrary alert keys');
assert.ok(/insert into public\.advisor_authority_alert_receipts/i.test(migration), 'Acknowledgement must write only the alert receipt ledger');

const forbidden = [
  ['no Business row mutation', /(?:update|delete\s+from)\s+public\.businesses|insert\s+into\s+public\.businesses/i],
  ['no Business ownership mutation', /update\s+public\.businesses[\s\S]*owner_id\s*=/i],
  ['no Business publication mutation', /update\s+public\.businesses[\s\S]*visible\s*=\s*true/i],
  ['no payment write', /(insert|update|delete)\s+(?:into\s+|from\s+)?public\.payment_orders/i],
  ['no Business RLS change', /(create|drop|alter)\s+policy[^;]+on\s+public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)/is],
  ['no authority Storage policy change', /(create|drop|alter)\s+policy[^;]+on\s+storage\.objects/is],
  ['no cron/background scheduler', /cron\.|pg_cron|net\.http|http_post|schedule\s*\(/i],
  ['no external notification table/write', /(insert|update|delete)\s+(?:into\s+|from\s+)?public\.(notifications|emails|sms|push_notifications)/i],
  ['no anonymous RPC grant', /grant execute on function public\.d68_[^;]+\bto\s+[^;]*anon/i],
  ['no broad Advisor scope', /permissions\s*=\s*array\[[^\]]*(files|images|proposals|data_requests|payments|reports)/i],
];
for (const [name, pattern] of forbidden) assert.doesNotMatch(migration, pattern, `Forbidden Session 8 pattern: ${name}`);

assert.ok(/d68_get_my_authority_review_v(?:3|4)/.test(advisorLib), 'Advisor read client must use Session 8 v3 or a later compatible wrapper');
assert.ok(advisorLib.includes('d68_advisor_ack_authority_expiry_alert_v1'), 'Advisor client must acknowledge through Session 8 RPC');
assert.equal(/\.from\(['"](?:businesses|advisor_authority_alert_receipts|advisor_authority_evidence|advisor_authority_rereviews)['"]\)[\s\S]{0,160}\.(?:insert|update|delete)\(/i.test(advisorLib + advisorPanel + advisorPage), false, 'Advisor frontend must not write protected tables directly');
assert.ok(advisorPanel.includes('Đã xem cảnh báo') && /Phiên (?:8|9)/.test(advisorPanel), 'Advisor UI must preserve governed expiry acknowledgement in Session 8 or later');
assert.ok(advisorPage.includes('Ranh giới Phiên 8') && advisorPage.includes('Ranh giới Phiên 7'), 'Advisor page must preserve Session 8 and inherited Session 7 boundary');

assert.ok(/d68_admin_list_advisor_business_intakes_v(?:4|5)/.test(adminLib), 'Admin queue must use Session 8 v4 or a later compatible wrapper');
assert.equal(/\.from\(['"](?:businesses|advisor_authority_alert_receipts|advisor_authority_evidence|advisor_authority_rereviews)['"]\)[\s\S]{0,160}\.(?:insert|update|delete)\(/i.test(adminLib + adminCard + adminPage), false, 'Admin frontend must not mutate protected tables directly');
assert.ok(adminPage.includes('Cần tái thẩm định') && adminPage.includes('Ranh giới Phiên 8'), 'Admin UI must preserve Session 8 attention queue');
assert.ok(/Ưu tiên Phiên (?:8|9)/.test(adminCard) && adminCard.includes('attention.recommended_action'), 'Admin card must preserve priority/recommended action in Session 8 or later');

assert.ok(pkg.scripts['qa:advisor-session8'], 'package.json must expose qa:advisor-session8');
assert.ok(pkg.scripts['qa:release']?.includes('qa:advisor-session8'), 'release QA must include Session 8');

console.log('✓ Advisor Session 8 authority expiry alerts & Admin re-review queue static contract: PASS');
console.log('✓ Session 8 backend remains read-time only; later UI wrappers may add operational delivery without altering the Session 8 contract.');
console.log('✓ Admin queue still prioritizes re-review/expired/30-14-7 day authority without changing Business permissions.');
