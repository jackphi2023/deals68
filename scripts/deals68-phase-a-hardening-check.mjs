#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const need = (text, token, message) => { if (!text.includes(token)) failures.push(message); };
const forbid = (text, token, message) => { if (text.includes(token)) failures.push(message); };

const proposals = read('src/lib/proposals.ts');
const data = read('src/lib/data.ts');
const register = read('src/pages/Register.tsx');
const auth = read('src/contexts/AuthContext.tsx');
const migration = read('supabase/migrations/20260713010000_release_candidate_phase_a_hardening.sql');

need(proposals, "rpc('submit_business_proposal'", 'Proposal submit RPC missing');
forbid(proposals, ".from('proposals')\n    .insert", 'Proposal direct-insert fallback remains');
need(proposals, 'countBusinessProposals(businessId)', 'Proposal quota refresh missing');

need(data, "'approve_business_public_snapshot'", 'Admin approval RPC missing');
forbid(data, "supabase.from('businesses').update(fallback)", 'Admin approval direct-update fallback remains');
need(data, "rpc('create_signup_bundle_v2'", 'Signup bundle v2 RPC missing');
need(data, 'signup_nonce: payload.signupNonce', 'Signup nonce RPC argument missing');

need(auth, 'signup_nonce?: string', 'Auth signup metadata type missing nonce');
need(auth, 'signup_nonce: meta.signup_nonce', 'Auth signUp does not store nonce');
need(register, 'const signupNonce', 'Register does not generate signup nonce');
need(register, 'signup_nonce: signupNonce', 'Register does not send nonce to Auth');
need(register, 'signupNonce,', 'Register does not send nonce to bundle RPC');

for (const token of [
  'create or replace function public.submit_business_proposal',
  'Business profile not accessible',
  'Proposal quota exceeded',
  'create or replace function public.create_signup_bundle_v2',
  "raw_user_meta_data->>'signup_nonce'",
  "raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'signup_nonce'",
  'skip_auth is retained only for signature compatibility',
  'drop policy if exists "proposal business insert"',
  'drop policy if exists "public read business images"',
  'drop policy if exists "site banners storage public read"',
]) need(migration, token, `Phase A migration missing: ${token}`);

for (const wrong of [
  'supabase/migrations/20260711103000_normalize_investor_taxonomy_on_write_v1.sql',
  'supabase/migrations/20260711104500_expand_investor_taxonomy_aliases_v1.sql',
  'supabase/migrations/20260711110000_normalize_investor_type_on_write_v1.sql',
  'supabase/migrations/20260712131500_payment_invoice_atomic_lifecycle.sql',
  'supabase/migrations/20260712132500_payment_order_code_collision_guard.sql',
]) {
  if (fs.existsSync(wrong)) failures.push(`Old migration filename remains: ${wrong}`);
}

for (const required of [
  'supabase/migrations/20260711100135_normalize_investor_taxonomy_on_write_v1.sql',
  'supabase/migrations/20260711100329_expand_investor_taxonomy_aliases_v1.sql',
  'supabase/migrations/20260711100835_normalize_investor_type_on_write_v1.sql',
  'supabase/migrations/20260712124143_payment_invoice_atomic_lifecycle.sql',
  'supabase/migrations/20260712124601_payment_order_code_collision_guard.sql',
  'supabase/migrations/20260712153808_restore_public_business_view_helper_execute.sql',
]) {
  if (!fs.existsSync(required)) failures.push(`Required migration missing: ${required}`);
}

if (failures.length) {
  console.error('✗ Deals68 Phase A hardening check failed:');
  failures.forEach((x) => console.error(`  - ${x}`));
  process.exit(1);
}

console.log('✓ Deals68 Phase A hardening check: PASS');
console.log('✓ Proposal and Admin approval are RPC-only/fail-closed.');
console.log('✓ Signup bundle is bound to a one-time Auth nonce.');
console.log('✓ Migration names match the production ledger.');
