#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

const phase1Path = fs.readdirSync('supabase/migrations')
  .map((name) => `supabase/migrations/${name}`)
  .find((name) => name.endsWith('_market_partner_affiliate_phase1_v1.sql'));
if (!phase1Path) throw new Error('Phase 1 migration not found');

replaceOnce(
  phase1Path,
  `-- Additive only. No payment trigger, no automatic commission creation, and no public table reads.

alter type public.user_role add value if not exists 'market_partner';
`,
  `-- Additive only. No payment trigger, no automatic commission creation, and no public table reads.
-- Production compatibility: empty legacy placeholder tables with incompatible schemas are
-- preserved in a locked archive schema before the Market Partner tables are created.

create schema if not exists d68_legacy;
revoke all on schema d68_legacy from public, anon, authenticated;
grant usage on schema d68_legacy to service_role;
comment on schema d68_legacy is
  'Locked archive for incompatible pre-Market-Partner placeholder tables. Not exposed to public/anon/authenticated.';

do $$
begin
  if to_regclass('public.affiliate_clicks') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'affiliate_clicks'
         and column_name = 'partner_id'
     ) then
    if to_regclass('d68_legacy.affiliate_clicks_pre_market_partner') is not null then
      raise exception 'Legacy affiliate_clicks archive already exists; manual reconciliation required';
    end if;
    alter table public.affiliate_clicks set schema d68_legacy;
    alter table d68_legacy.affiliate_clicks rename to affiliate_clicks_pre_market_partner;
  end if;

  if to_regclass('public.affiliate_payouts') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'affiliate_payouts'
         and column_name = 'partner_id'
     ) then
    if to_regclass('d68_legacy.affiliate_payouts_pre_market_partner') is not null then
      raise exception 'Legacy affiliate_payouts archive already exists; manual reconciliation required';
    end if;
    alter table public.affiliate_payouts set schema d68_legacy;
    alter table d68_legacy.affiliate_payouts rename to affiliate_payouts_pre_market_partner;
  end if;
end;
$$;

alter type public.user_role add value if not exists 'market_partner';
`,
);

replaceOnce(
  'scripts/qa-market-partner-phase5.mjs',
  `create table public.partner_leads (
`,
  `create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  investor_id uuid,
  profile_id uuid,
  created_by uuid,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  investor_id uuid,
  profile_id uuid,
  created_by uuid,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order integer default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.partner_leads (
`,
);

replaceOnce(
  'scripts/qa-market-partner-phase5.mjs',
  `  await db.exec(phase5);

  const adminId =`,
  `  await db.exec(phase5);

  const collisionState = await db.query(\`
    select
      to_regclass('d68_legacy.affiliate_clicks_pre_market_partner') is not null as legacy_clicks,
      to_regclass('d68_legacy.affiliate_payouts_pre_market_partner') is not null as legacy_payouts,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_clicks' and column_name='partner_id') as new_clicks,
      exists(select 1 from information_schema.columns where table_schema='public' and table_name='affiliate_payouts' and column_name='partner_id') as new_payouts;
  \`);
  assert.deepEqual(collisionState.rows[0], {
    legacy_clicks: true,
    legacy_payouts: true,
    new_clicks: true,
    new_payouts: true,
  });

  const adminId =`,
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `      "alter type public.user_role add value if not exists 'market_partner'",
`,
  `      'create schema if not exists d68_legacy',
      'alter table public.affiliate_clicks set schema d68_legacy',
      'alter table public.affiliate_payouts set schema d68_legacy',
      "alter type public.user_role add value if not exists 'market_partner'",
`,
);

replaceOnce(
  'docs/release/MARKET_PARTNER_PHASE5_RELEASE.md',
  `## Security boundaries
`,
  `## Production schema collision handling

Production contained empty generic placeholder tables named \`affiliate_clicks\` and \`affiliate_payouts\` with an incompatible Business/Investor payload schema. Phase 1 preserves them unchanged in the locked \`d68_legacy\` schema before creating the Market Partner tables. No rows are deleted and the archive schema is not granted to public, anon or authenticated roles.

## Security boundaries
`,
);

console.log('✓ Legacy affiliate table collision hardening applied.');
