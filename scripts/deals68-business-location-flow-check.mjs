#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];

function requireToken(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

const register = read('src/pages/Register.tsx');
const dashboard = read('src/pages/BusinessDashboard.tsx');
const admin = read('src/pages/Admin.tsx');
const data = read('src/lib/data.ts');
const businesses = read('src/pages/Businesses.tsx');
const taxonomy = read('src/lib/locationTaxonomy.ts');
const migrationPath =
  'supabase/migrations/20260717143000_business_city_key_public_flow_v1.sql';
const migration = read(migrationPath);

for (const [source, token, message] of [
  [register, 'city_key: cityKey', 'Registration does not persist the canonical city key'],
  [register, 'city: canonicalCity', 'Registration does not persist a stable city label'],
  [dashboard, 'getLocationOptionsForCountry', 'Dashboard does not load canonical location options'],
  [dashboard, 'name="city_key"', 'Dashboard location dropdown is not keyed by city_key'],
  [dashboard, 'city_key: cityKey', 'Dashboard pending payload omits city_key'],
  [admin, 'city_key: cityKey', 'Admin approval snapshot omits city_key'],
  [admin, 'AdminBusinessLocationFields', 'Admin location editor is not canonical'],
  [data, ".eq('city_key', cityKey)", 'Public Business query does not use exact city_key filtering'],
  [data, "'city_key'", 'Public Business select omits city_key'],
  [businesses, 'locationKeyFromLabel(f.city_key || f.city', 'Business facets do not canonicalize legacy labels'],
  [businesses, 'labelLocation(cityKey, lang)', 'Business location filters do not use localized canonical labels'],
  [taxonomy, "'TP.HCM'", 'HCMC legacy alias is missing from the canonical taxonomy'],
  [migration, 'create index if not exists idx_businesses_city_key', 'Migration does not retain an index for exact location filters'],
  [migration, 'create index if not exists idx_businesses_public_city_key', 'Approved snapshot city filters do not have an expression index'],
  [migration, 'alter view public.public_businesses_safe set (security_invoker = true)', 'Safe Business view does not retain security_invoker'],
  [migration, 'revoke all on public.public_businesses_safe from public, anon, authenticated', 'Safe Business view privileges are not reset explicitly'],
]) {
  requireToken(source, token, message);
}

if (data.includes("q.ilike('city'")) {
  failures.push('Legacy text-based city filter remains in the public query');
}

if (failures.length) {
  console.error('✗ Deals68 Business location static contract failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;

    create type public.account_status as enum (
      'draft', 'payment_pending', 'pending_admin_review', 'active', 'hidden'
    );

    create table public.businesses (
      id uuid primary key,
      public_code text,
      slug text,
      title_vi text,
      title_en text,
      description_vi text,
      description_en text,
      country_iso2 text,
      city text,
      city_key text,
      industry text,
      industry_key text,
      deal_type text,
      plan text,
      revenue_2025 numeric,
      revenue_currency text,
      ebitda_margin numeric,
      ask_amount numeric,
      ask_currency text,
      stake_pct numeric,
      highlights_vi text,
      highlights_en text,
      investment_reason_vi text,
      investment_reason_en text,
      data_confidence integer,
      quality_score integer,
      valuation_reasonableness text,
      visible boolean,
      status public.account_status,
      hero_image_url text,
      image_url text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      public_version integer default 0,
      last_approved_at timestamptz,
      moderation_status text,
      show_on_homepage boolean default false,
      public_snapshot_json jsonb
    );

    create table public.business_files (
      id uuid primary key,
      business_id uuid,
      public_visible boolean default false
    );

    create table public.business_images (
      id uuid primary key,
      business_id uuid,
      public_visible boolean default false,
      is_sanitized boolean default false
    );

    create table public.location_taxonomy (
      key text primary key,
      country_iso2 text not null,
      vi text not null,
      en text not null,
      active boolean not null default true
    );

    create function public.normalize_business_industry_key(source text)
    returns text language sql immutable
    as $$ select nullif(btrim(source), '') $$;

    create function public.d68_try_numeric(source text)
    returns numeric language plpgsql immutable
    as $$
    begin
      return nullif(source, '')::numeric;
    exception when others then
      return null;
    end;
    $$;

    create function public.d68_try_integer(source text)
    returns integer language plpgsql immutable
    as $$
    begin
      return nullif(source, '')::integer;
    exception when others then
      return null;
    end;
    $$;
  `);

  const foundationMigration = read(
    'supabase/migrations/20260712090520_security_foundation_phase_a.sql',
  );
  const viewStart = foundationMigration.indexOf(
    'create or replace view public.public_businesses_safe',
  );
  const viewEndMarker =
    'alter view public.public_businesses_safe set (security_invoker = true);';
  const viewEnd = foundationMigration.indexOf(viewEndMarker, viewStart);
  assert.ok(viewStart >= 0 && viewEnd > viewStart, 'Could not isolate baseline safe view');
  await db.exec(
    foundationMigration.slice(viewStart, viewEnd + viewEndMarker.length),
  );

  await db.exec(`
    insert into public.location_taxonomy (key, country_iso2, vi, en) values
      ('VN-ho-chi-minh', 'VN', 'TP. Hồ Chí Minh', 'Ho Chi Minh City'),
      ('VN-ha-noi', 'VN', 'Hà Nội', 'Hanoi');

    insert into public.businesses (
      id, public_code, slug, title_vi, title_en, country_iso2, city,
      city_key, industry, industry_key, deal_type, plan, visible, status,
      public_snapshot_json
    ) values
      ('00000000-0000-0000-0000-000000000001', 'D68-1', 'hcm-one',
       'Doanh nghiệp HCM 1', 'HCM Business 1', 'VN', 'TP.HCM', null,
       'technology', 'technology', 'fundraise', 'standard', true, 'active', '{}'::jsonb),
      ('00000000-0000-0000-0000-000000000002', 'D68-2', 'hcm-two',
       'Doanh nghiệp HCM 2', 'HCM Business 2', 'VN', 'Ho Chi Minh City', null,
       'technology', 'technology', 'fundraise', 'standard', true, 'active', '{}'::jsonb),
      ('00000000-0000-0000-0000-000000000003', 'D68-3', 'hanoi-one',
       'Doanh nghiệp Hà Nội', 'Hanoi Business', 'VN', 'Hà Nội', null,
       'services', 'services', 'sale', 'featured', true, 'active', '{}'::jsonb);
  `);

  await db.exec(migration);

  const columns = await db.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'public_businesses_safe'
    order by ordinal_position
  `);
  assert.deepEqual(
    columns.rows.slice(-2).map((row) => row.column_name),
    ['public_snapshot_json', 'city_key'],
  );

  const exactFilter = await db.query(`
    select slug, city_key
    from public.public_businesses_safe
    where city_key = 'VN-ho-chi-minh'
    order by slug
  `);
  assert.deepEqual(
    exactFilter.rows.map((row) => row.slug),
    ['hcm-one', 'hcm-two'],
  );

  const facets = await db.query(`
    select city_key, count(*)::integer as total
    from public.public_businesses_safe
    group by city_key
    order by city_key
  `);
  assert.deepEqual(facets.rows, [
    { city_key: 'VN-ha-noi', total: 1 },
    { city_key: 'VN-ho-chi-minh', total: 2 },
  ]);

  const publicSnapshots = await db.query(`
    select public_snapshot_json->>'city_key' as city_key
    from public.public_businesses_safe
    where slug = 'hcm-one'
  `);
  assert.equal(publicSnapshots.rows[0].city_key, 'VN-ho-chi-minh');

  await db.exec(`
    update public.businesses
    set public_snapshot_json = public_snapshot_json || jsonb_build_object(
      'city', 'Hà Nội',
      'city_key', 'VN-ha-noi'
    )
    where slug = 'hcm-one'
  `);
  const approvedLocation = await db.query(`
    select city, city_key
    from public.public_businesses_safe
    where slug = 'hcm-one'
  `);
  assert.deepEqual(approvedLocation.rows[0], {
    city: 'Hà Nội',
    city_key: 'VN-ha-noi',
  });
  const oldLocationCount = await db.query(`
    select count(*)::integer as total
    from public.public_businesses_safe
    where city_key = 'VN-ho-chi-minh'
  `);
  assert.equal(oldLocationCount.rows[0].total, 1);

  const indexes = await db.query(`
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'businesses'
  `);
  assert.ok(
    indexes.rows.some((row) => row.indexname === 'idx_businesses_city_key'),
    'city_key index is missing',
  );
  assert.ok(
    indexes.rows.some((row) => row.indexname === 'idx_businesses_public_city_key'),
    'approved public city_key index is missing',
  );

  console.log('✓ Deals68 Business location canonical flow: PASS');
  console.log('✓ Registration → Dashboard → Admin keeps one city_key source of truth.');
  console.log('✓ Public filtering uses exact city_key equality; no city text search remains.');
  console.log('✓ TP.HCM aliases collapse into one filter facet (2 records).');
  console.log('✓ Admin-approved snapshot city_key overrides the previously approved key.');
  console.log('✓ Migration executed in PGlite; no Supabase project or test data was used.');
} finally {
  await db.close();
}
