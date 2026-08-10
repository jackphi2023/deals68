#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync('supabase/migrations/20260810174500_advisor_authority_email_notifications_phase9_v1.sql', 'utf8');
const scheduler = fs.readFileSync('supabase/migrations/20260810174600_advisor_authority_email_scheduler_phase9_v1.sql', 'utf8');
const worker = fs.readFileSync('supabase/functions/advisor-authority-notification-email/index.ts', 'utf8');
const advisorLib = fs.readFileSync('src/lib/advisorAuthorityEvidence.ts', 'utf8');
const advisorPanel = fs.readFileSync('src/components/AdvisorAuthorityEvidencePanel.tsx', 'utf8');
const adminLib = fs.readFileSync('src/lib/adminAdvisorIntakes.ts', 'utf8');
const adminCard = fs.readFileSync('src/components/AdminAdvisorIntakeCard.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

for (const token of [
  'create table if not exists public.advisor_authority_notification_preferences',
  'create table if not exists public.advisor_authority_notification_outbox',
  'alter table public.advisor_authority_notification_preferences enable row level security',
  'alter table public.advisor_authority_notification_outbox enable row level security',
  'revoke all on table public.advisor_authority_notification_preferences from public, anon, authenticated',
  'revoke all on table public.advisor_authority_notification_outbox from public, anon, authenticated',
  'advisor_authority_notification_outbox_unique unique (assignment_id, alert_key, channel)',
  "status in ('pending','processing','sent','failed','exhausted')",
  'd68_private.enqueue_advisor_authority_notifications_v1',
  'd68_notification_worker_claim_v1',
  'd68_notification_worker_complete_v1',
  'd68_advisor_update_authority_notification_preferences_v1',
  'd68_get_my_authority_review_v4',
  'd68_admin_list_advisor_business_intakes_v5',
  'public.d68_get_my_authority_review_v3(p_assignment_id)',
  'public.d68_admin_list_advisor_business_intakes_v4()',
  "aa.permissions = array['profile']::text[]",
  "b.owner_id is null",
  "b.status::text = 'draft'",
  'b.visible = false',
  "< 6",
  'attempt_count < 3',
  "interval '20 minutes'",
  "interval '15 minutes'",
  "interval '1 hour'",
  "'business_mutations_enabled', false",
  "'authority_mutations_enabled', false",
  "'sms_notification_delivery_enabled', false",
  "'push_notification_delivery_enabled', false",
  "set search_path = ''",
]) assert.ok(core.includes(token), `Session 9 core migration missing contract token: ${token}`);

for (const signature of [
  'public.d68_notification_worker_claim_v1(integer)',
  'public.d68_notification_worker_complete_v1(uuid,boolean,text,text,text)',
]) {
  assert.ok(core.includes(`revoke all on function ${signature} from public, anon, authenticated`), `Worker RPC must fail closed: ${signature}`);
  assert.ok(core.includes(`grant execute on function ${signature} to service_role`), `Worker RPC must be service-role only: ${signature}`);
  assert.equal(core.includes(`grant execute on function ${signature} to authenticated`), false, `Worker RPC must not be granted to authenticated: ${signature}`);
}
for (const signature of [
  'public.d68_advisor_update_authority_notification_preferences_v1(boolean,boolean,boolean,boolean,boolean,boolean)',
  'public.d68_get_my_authority_review_v4(uuid)',
  'public.d68_admin_list_advisor_business_intakes_v5()',
]) {
  assert.ok(core.includes(`revoke all on function ${signature} from public, anon, authenticated`), `User/Admin RPC must fail closed first: ${signature}`);
  assert.ok(core.includes(`grant execute on function ${signature} to authenticated, service_role`), `Expected authenticated/service grant: ${signature}`);
}

for (const token of [
  'create extension if not exists pg_net',
  'create extension if not exists pg_cron',
  'd68_private.dispatch_advisor_authority_notifications_v1',
  "advisor_notification_project_url",
  "advisor_notification_anon_key",
  "'/functions/v1/advisor-authority-notification-email'",
  "'advisor-authority-notifications-session9'",
  "'*/15 * * * *'",
  'net.http_post',
  'vault.decrypted_secrets',
]) assert.ok(scheduler.includes(token), `Session 9 scheduler migration missing: ${token}`);
assert.ok(scheduler.includes('revoke all on function d68_private.dispatch_advisor_authority_notifications_v1() from public, anon, authenticated'), 'Dispatcher must not be callable by public/anon/authenticated');

for (const token of [
  "Deno.env.get('RESEND_API_KEY')",
  "Deno.env.get('BREVO_API_KEY')",
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  "Deno.env.get('SUPABASE_ANON_KEY')",
  "d68_notification_worker_claim_v1",
  "d68_notification_worker_complete_v1",
  "Authorization: `Bearer ${RESEND_API_KEY}`",
  "'api-key': BREVO_API_KEY",
  "authorization !== `Bearer ${SUPABASE_ANON_KEY}`",
  'maximum 6 authority emails per Advisor per 24 hours',
]) assert.ok(worker.includes(token), `Session 9 email worker missing contract token: ${token}`);
assert.equal(/req\.json\s*\(/.test(worker), false, 'Worker must not accept caller-controlled recipient/content payload');
assert.equal(/console\.(?:log|error)\([^\n]*(recipient_email|recipient|to:)/i.test(worker), false, 'Worker must not log recipient email');
assert.doesNotMatch(worker, /(?:re_|xkeysib-|sk_live_|sk_test_)[A-Za-z0-9_-]{16,}/, 'No provider secret may be hardcoded');

const protectedWrite = /(?:insert\s+into|update|delete\s+from)\s+public\.(businesses|business_files|business_images|payment_orders|proposals|request_data|business_financial_access_grants)/i;
assert.doesNotMatch(core + scheduler, protectedWrite, 'Session 9 must not write Business/payment/data-room/proposal scopes');
assert.doesNotMatch(core + scheduler, /(create|drop|alter)\s+policy[^;]+on\s+(?:public\.businesses|storage\.objects)/is, 'Session 9 must not change Business or Storage RLS policies');
assert.doesNotMatch(core + scheduler, /grant\s+execute[^;]+\bto\s+[^;]*anon/i, 'No Session 9 RPC may be granted to anon');
assert.doesNotMatch(core + scheduler, /permissions\s*=\s*array\[[^\]]*(files|images|proposals|data_requests|payments|reports)/i, 'No broad Advisor scope');

assert.ok(advisorLib.includes('d68_get_my_authority_review_v4'), 'Advisor client must use Session 9 v4 wrapper');
assert.ok(advisorLib.includes('d68_advisor_update_authority_notification_preferences_v1'), 'Advisor client must update preferences through Session 9 RPC');
assert.ok(advisorPanel.includes('Phiên 9') && advisorPanel.includes('Tùy chọn email authority') && advisorPanel.includes('6 email authority/24h'), 'Advisor UI must expose Session 9 email preference boundary');
assert.ok(adminLib.includes('d68_admin_list_advisor_business_intakes_v5'), 'Admin client must use Session 9 v5 wrapper');
assert.ok(adminCard.includes('Delivery monitor Phiên 9') && adminCard.includes('không có nút gửi thủ công'), 'Admin UI must monitor delivery without manual bypass');
assert.equal(/\.from\(['"](?:businesses|advisor_authority_notification_preferences|advisor_authority_notification_outbox)['"]\)[\s\S]{0,180}\.(?:insert|update|delete)\(/i.test(advisorLib + advisorPanel + adminLib + adminCard), false, 'Frontend must not directly mutate protected Session 9 tables');

assert.ok(pkg.scripts['qa:advisor-session9'], 'package.json must expose qa:advisor-session9');
assert.ok(pkg.scripts['qa:release']?.includes('qa:advisor-session9'), 'release QA must include Session 9');

console.log('✓ Advisor Session 9 controlled authority email notifications static contract: PASS');
console.log('✓ Preferences affect delivery only; queue dedupes exact alert lifecycle and rate-limits to 6 sent emails/profile/24h.');
console.log('✓ Worker RPCs are service-role only, max 3 attempts, and caller cannot choose recipient/content.');
console.log('✓ pg_cron/pg_net trigger only the delivery worker; no Business, authority, Storage or payment permission was added.');
