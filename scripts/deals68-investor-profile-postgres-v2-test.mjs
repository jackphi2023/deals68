#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ownerId = '00000000-0000-0000-0000-000000000001';
const investorId = '00000000-0000-0000-0000-000000000101';

const foundation = `
  create schema auth;
  create role anon nologin;
  create role authenticated nologin;

  create type public.account_status as enum (
    'draft', 'payment_pending', 'pending_admin_review', 'active', 'hidden'
  );

  create table public.investors (
    id uuid primary key,
    owner_id uuid not null,
    code text,
    type text,
    title_vi text,
    title_en text,
    desc_vi text,
    desc_en text,
    country_iso2 text,
    country text,
    region text,
    industries text[],
    deal_types text[],
    stage text,
    ticket_min numeric,
    ticket_max numeric,
    criteria jsonb default '{}'::jsonb,
    privacy jsonb default '{}'::jsonb,
    visible boolean default false,
    verified boolean default false,
    admin_priority boolean default false,
    activity_level text,
    status public.account_status default 'draft',
    private_name text,
    private_email text,
    private_phone text,
    private_website text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

  create function auth.uid()
  returns uuid language sql stable
  as $$ select '${ownerId}'::uuid $$;

  create function public.is_admin_user()
  returns boolean language sql stable
  as $$ select true $$;

  create function public.investor_jsonb_text_array(source jsonb)
  returns text[] language sql immutable
  as $$
    select coalesce(array_agg(value), array[]::text[])
    from jsonb_array_elements_text(
      case when jsonb_typeof(source) = 'array' then source else '[]'::jsonb end
    ) as item(value)
  $$;

  create function public.normalize_investor_type_array(source jsonb)
  returns text[] language sql immutable
  as $$ select public.investor_jsonb_text_array(source) $$;

  create function public.normalize_investor_stage_array(source jsonb)
  returns text[] language sql immutable
  as $$ select public.investor_jsonb_text_array(source) $$;

  create function public.normalize_investor_country_array(source jsonb)
  returns text[] language sql immutable
  as $$
    select coalesce(array_agg(upper(value)), array[]::text[])
    from unnest(public.investor_jsonb_text_array(source)) as item(value)
  $$;

  create function public.normalize_investor_industry_key(source text)
  returns text language sql immutable
  as $$ select nullif(btrim(source), '') $$;

  create function public.normalize_investor_deal_type(source text)
  returns text language sql immutable
  as $$ select nullif(btrim(source), '') $$;
`;

try {
  await db.exec(foundation);
  await db.exec(
    fs.readFileSync(
      'supabase/migrations/20260717073045_investor_profile_contract_ui_v2.sql',
      'utf8',
    ),
  );

  await db.query(
    `insert into public.investors (
      id, owner_id, code, type, title_vi, title_en, desc_vi, desc_en,
      country_iso2, country, region, industries, deal_types, stage,
      ticket_min, ticket_max, criteria, privacy, visible, status
    ) values (
      $1, $2, 'INV-TEST', 'VC', 'Nhà đầu tư thử nghiệm', 'Test investor',
      'Giới thiệu cũ', 'Old introduction', 'VN', 'Vietnam', 'asia',
      array['technology'], array['equity'], 'Growth', 100000, 500000,
      '{"investorTypes":["VC"],"stages":["Growth"]}'::jsonb,
      '{}'::jsonb, true, 'active'
    )`,
    [investorId, ownerId],
  );

  const investorSave = await db.query(
    `select public.update_my_investor_profile($1::jsonb, $2::jsonb) as result`,
    [
      JSON.stringify({
        investor_types: ['VC'],
        type: 'VC',
        stages: ['Growth'],
        stage: 'Growth',
        country_iso2: 'VN',
        country: 'Vietnam',
        region: 'asia',
        industries: ['technology'],
        deal_types: ['equity'],
        target_countries: ['VN', 'US'],
        ticket_min: 150000,
        ticket_max: 750000,
        criteria: {
          investorTypes: ['VC'],
          stages: ['Growth'],
          sectors: ['technology'],
          dealTypes: ['equity'],
          targetCountries: ['VN', 'US'],
          investment_appetite_vi: 'Khẩu vị do Investor nhập',
          investment_appetite_en: 'Investor-entered appetite',
          riskAppetite: 'balanced',
          returnExpectation: 15,
          revenueRange: '1_10m',
          revenueBand: '1_10m',
        },
      }),
      JSON.stringify({
        desc_vi: 'Giới thiệu mới chờ duyệt',
        desc_en: 'Old introduction',
      }),
    ],
  );

  assert.equal(investorSave.rows[0].result.saved_immediately, true);
  assert.equal(investorSave.rows[0].result.criteria_pending, false);
  assert.equal(investorSave.rows[0].result.description_pending, true);

  const afterInvestor = await db.query(
    `select ticket_min, criteria, privacy, desc_vi from public.investors where id = $1`,
    [investorId],
  );
  assert.equal(Number(afterInvestor.rows[0].ticket_min), 150000);
  assert.equal(afterInvestor.rows[0].criteria.riskAppetite, 'balanced');
  assert.equal(
    afterInvestor.rows[0].criteria.investment_appetite_en,
    'Investor-entered appetite',
  );
  assert.deepEqual(
    afterInvestor.rows[0].privacy.pending_profile_changes,
    { desc_vi: 'Giới thiệu mới chờ duyệt' },
  );
  assert.equal(afterInvestor.rows[0].desc_vi, 'Giới thiệu cũ');

  const adminSave = await db.query(
    `select public.admin_update_investor_profile($1, $2::jsonb, false) as result`,
    [
      investorId,
      JSON.stringify({
        investor_types: ['VC'],
        stages: ['Growth'],
        industries: ['technology'],
        deal_types: ['equity'],
        target_countries: ['VN', 'US'],
        country_iso2: 'VN',
        country: 'Vietnam',
        region: 'asia',
        ticket_min: 150000,
        ticket_max: 750000,
        status: 'active',
        visible: true,
        desc_vi: 'Giới thiệu mới chờ duyệt',
        desc_en: 'Old introduction',
        criteria: {
          investorTypes: ['VC'],
          stages: ['Growth'],
          sectors: ['technology'],
          dealTypes: ['equity'],
          targetCountries: ['VN', 'US'],
          investment_appetite_vi: 'Khẩu vị VN do Admin sửa',
          investment_appetite_en: 'English appetite edited by Admin',
          riskAppetite: 'conservative',
          returnExpectation: 18,
        },
      }),
    ],
  );

  assert.equal(adminSave.rows[0].result.saved, true);
  assert.equal(adminSave.rows[0].result.introduction_approved, false);

  const publicRow = await db.query(
    `select criteria, desc_vi from public.public_investors_safe where id = $1`,
    [investorId],
  );
  assert.equal(
    publicRow.rows[0].criteria.investment_appetite_vi,
    'Khẩu vị VN do Admin sửa',
  );
  assert.equal(
    publicRow.rows[0].criteria.investment_appetite_en,
    'English appetite edited by Admin',
  );
  assert.equal(publicRow.rows[0].desc_vi, 'Giới thiệu cũ');

  const approveIntro = await db.query(
    `select public.admin_update_investor_profile($1, $2::jsonb, true) as result`,
    [
      investorId,
      JSON.stringify({
        investor_types: ['VC'],
        stages: ['Growth'],
        industries: ['technology'],
        deal_types: ['equity'],
        target_countries: ['VN', 'US'],
        status: 'active',
        visible: true,
        desc_vi: 'Giới thiệu mới đã duyệt',
        desc_en: 'Approved English introduction',
        criteria: publicRow.rows[0].criteria,
      }),
    ],
  );
  assert.equal(approveIntro.rows[0].result.introduction_approved, true);

  const finalRow = await db.query(
    `select desc_vi, desc_en, privacy from public.investors where id = $1`,
    [investorId],
  );
  assert.equal(finalRow.rows[0].desc_vi, 'Giới thiệu mới đã duyệt');
  assert.equal(finalRow.rows[0].desc_en, 'Approved English introduction');
  assert.equal(finalRow.rows[0].privacy.pending_profile_changes, undefined);

  await db.query(
    `update public.investors
     set privacy = jsonb_build_object(
       'pending_profile_changes', jsonb_build_object(
         'desc_vi', 'Giới thiệu vẫn chờ duyệt',
         'criteria', jsonb_build_object(
           'investorTypes', jsonb_build_array('PE'),
           'stages', jsonb_build_array('Mature')
         )
       ),
       'pending_submitted_at', now()::text
     )
     where id = $1`,
    [investorId],
  );
  await db.exec(
    fs.readFileSync(
      'supabase/migrations/20260717073820_promote_legacy_pending_investor_criteria_v1.sql',
      'utf8',
    ),
  );

  const promotedLegacy = await db.query(
    `select type, stage, criteria, privacy from public.investors where id = $1`,
    [investorId],
  );
  assert.equal(promotedLegacy.rows[0].type, 'PE');
  assert.equal(promotedLegacy.rows[0].stage, 'Mature');
  assert.deepEqual(promotedLegacy.rows[0].criteria.investorTypes, ['PE']);
  assert.deepEqual(promotedLegacy.rows[0].criteria.stages, ['Mature']);
  assert.deepEqual(promotedLegacy.rows[0].privacy.pending_profile_changes, {
    desc_vi: 'Giới thiệu vẫn chờ duyệt',
  });

  console.log('✓ Investor Profile PostgreSQL V2: PASS');
  console.log('✓ Migration executed in PGlite; no Supabase project was contacted.');
  console.log('✓ Investor criteria saved immediately; Introduction stayed pending.');
  console.log('✓ Admin VN/EN appetite reached public_investors_safe.');
  console.log('✓ Legacy pending criteria promoted; pending Introduction preserved.');
} finally {
  await db.close();
}
