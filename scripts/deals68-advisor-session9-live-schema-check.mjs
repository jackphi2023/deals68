#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fixPath = 'supabase/migrations/20260810174700_advisor_authority_email_live_schema_fix_phase9_v1.sql';
const fix = fs.readFileSync(fixPath, 'utf8');

assert.ok(fix.includes('d68_private.enqueue_advisor_authority_notifications_v1'), 'Live-schema fix must replace the governed enqueue function');
assert.ok(fix.includes('b.company_name_private'), 'Session 9 live-schema enqueue must use businesses.company_name_private');
assert.ok(fix.includes('b.title_vi') && fix.includes('b.title_en'), 'Session 9 email business label should prefer bilingual Business titles');
assert.doesNotMatch(fix, /\bb\.company_name\b/, 'Live-schema enqueue must not reference nonexistent businesses.company_name');
assert.ok(fix.includes("aa.permissions = array['profile']::text[]"), 'Profile-only assignment boundary must remain');
assert.ok(fix.includes('b.owner_id is null'), 'Business must remain ownerless');
assert.ok(fix.includes("b.status::text = 'draft'"), 'Business must remain draft');
assert.ok(fix.includes('b.visible = false'), 'Business must remain non-public');
assert.ok(fix.includes("set search_path = ''"), 'Replacement function must keep empty search_path');
assert.ok(fix.includes('revoke all on function d68_private.enqueue_advisor_authority_notifications_v1() from public, anon, authenticated'), 'Private enqueue must remain inaccessible to clients');
assert.doesNotMatch(fix, /(?:update|delete\s+from)\s+public\.businesses|insert\s+into\s+public\.businesses/i, 'Live-schema fix must not mutate Business');
assert.doesNotMatch(fix, /(create|drop|alter)\s+policy/i, 'Live-schema fix must not alter RLS policies');

console.log('✓ Advisor Session 9 production Business schema compatibility contract: PASS');
console.log('✓ Enqueue reads title_vi/title_en/company_name_private and preserves ownerless/draft/non-public/profile-only boundaries.');
