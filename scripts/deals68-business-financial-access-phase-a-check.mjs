#!/usr/bin/env node
import fs from 'node:fs';

const migrationName = '20260724100000_business_financial_access_phase_a_v1.sql';
const migrationPath = `supabase/migrations/${migrationName}`;
const failures = [];

if (!fs.existsSync(migrationPath)) {
  failures.push(`Missing ${migrationName}`);
} else {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const required = [
    'create table if not exists public.business_financial_access_grants',
    "check (source_type in ('proposal', 'data_request', 'admin'))",
    "check (status in ('active', 'revoked', 'expired'))",
    "array['financial_summary', 'financial_detail', 'dataroom']::text[]",
    'business_financial_access_grants_source_uidx',
    'business_financial_access_grants_lookup_idx',
    'add column if not exists requested_scopes text[]',
    'add column if not exists granted_scopes text[]',
    'add column if not exists responded_at timestamptz',
    'add column if not exists access_expires_at timestamptz',
    'create unique index if not exists request_data_one_open_pair_uidx',
    'create or replace function public.d68_normalize_business_financial_scopes',
    'create or replace function public.d68_sync_proposal_financial_access',
    'create or replace function public.d68_sync_request_financial_access',
    'create or replace function public.d68_get_business_financial_access',
    'create or replace function public.d68_has_business_financial_scope',
    'create or replace function public.d68_request_business_financial_access',
    'create or replace function public.d68_respond_business_financial_request',
    'create or replace function public.d68_revoke_business_financial_access',
    'proposals_financial_access_insert',
    'proposals_financial_access_status_update',
    'request_data_financial_access_update',
    "p.status::text in ('sent', 'request_data', 'approved', 'connected')",
    "where r.status::text = 'fulfilled'",
    "'dataroom_inferred', false",
    'alter table public.business_financial_access_grants enable row level security',
    'business_financial_access_grants_parties_select',
    'grant select on table public.business_financial_access_grants to authenticated',
    'to authenticated, service_role',
    'business_financial_access_phase_a_backfill',
  ];

  for (const snippet of required) {
    if (!sql.includes(snippet)) failures.push(`${migrationName} missing contract: ${snippet}`);
  }

  const forbidden = [
    'create or replace view public.public_businesses_safe',
    'drop view public.public_businesses_safe',
    'grant insert on table public.business_financial_access_grants to authenticated',
    'grant update on table public.business_financial_access_grants to authenticated',
    'grant delete on table public.business_financial_access_grants to authenticated',
    "'dataroom_inferred', true",
  ];

  for (const snippet of forbidden) {
    if (sql.includes(snippet)) failures.push(`${migrationName} contains forbidden Phase A change: ${snippet}`);
  }

  const proposalBackfill = sql.match(/p\.status::text in \('sent', 'request_data', 'approved', 'connected'\)/g) || [];
  if (proposalBackfill.length < 1) failures.push('Proposal summary backfill/status contract is missing.');

  if (!sql.includes("array['financial_summary']::text[]")) {
    failures.push('Proposal access must be financial_summary only.');
  }

  if (!sql.includes("array['financial_summary', 'financial_detail']::text[]")) {
    failures.push('Fulfilled request access must default to summary + detail.');
  }
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (packageJson.scripts?.['qa:financial-access-phase-a'] !== 'node scripts/deals68-business-financial-access-phase-a-check.mjs') {
  failures.push('package.json is missing qa:financial-access-phase-a.');
}

if (failures.length) {
  console.error('✗ Deals68 Business financial access Phase A check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Business financial access Phase A contract: PASS');