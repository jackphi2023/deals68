-- Deals68 final homepage deploy fix
-- Purpose:
-- 1) Treat the six curated seed deals D68-01..D68-06 as Admin-approved public snapshot v1.
-- 2) Add missing asset columns defensively so BusinessDetail/Home queries do not fail after code deploy.
-- 3) Keep user-edited changes in pending_changes_json; public pages use public_snapshot_json/approved columns only.

-- Defensive schema hardening for the public snapshot workflow.
alter table if exists public.businesses
  add column if not exists public_snapshot_json jsonb,
  add column if not exists public_version integer not null default 0,
  add column if not exists last_approved_at timestamptz,
  add column if not exists last_approved_by uuid,
  add column if not exists pending_submitted_at timestamptz,
  add column if not exists pending_submitted_by uuid,
  add column if not exists moderation_status text not null default 'pending_admin_review',
  add column if not exists hero_image_url text,
  add column if not exists image_url text,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.business_images
  add column if not exists title text,
  add column if not exists display_title text,
  add column if not exists image_path text,
  add column if not exists public_url text,
  add column if not exists sort_order integer,
  add column if not exists public_visible boolean not null default false,
  add column if not exists is_sanitized boolean not null default false,
  add column if not exists is_hero boolean not null default false,
  add column if not exists admin_note text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.business_files
  add column if not exists file_name text,
  add column if not exists display_name text,
  add column if not exists file_path text,
  add column if not exists file_type text,
  add column if not exists size_bytes bigint,
  add column if not exists category text default 'document',
  add column if not exists privacy_level text default 'locked',
  add column if not exists public_visible boolean not null default false,
  add column if not exists admin_note text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Identify the six founder/admin curated seed deals.
create temporary table tmp_d68_seed_businesses_final on commit drop as
select id
from public.businesses
where public_code in ('D68-01','D68-02','D68-03','D68-04','D68-05','D68-06')
   or username in ('hkmedi','infinitytech','dunniotailor','phongcua','trongnhanseafoods','automatedcoldstore')
   or slug in (
      'dermatology-aesthetics-chain-vietnam',
      'global-mobile-app-studio-fundraise',
      'personalized-custom-tailoring-platform',
      'two-seafood-restaurants-hcmc-sale',
      'seafood-export-processing-plant-strategic-investor',
      'automated-cold-storage-hcmc-transfer'
   );

-- Backfill Admin-approved public snapshot v1 from existing structured DB fields.
-- These six deals are launch/seed content, not unmoderated user submissions.
update public.businesses b
set
  public_snapshot_json = jsonb_strip_nulls(jsonb_build_object(
    'title_vi', b.title_vi,
    'title_en', coalesce(nullif(b.title_en, ''), b.title_vi),
    'description_vi', b.description_vi,
    'description_en', coalesce(nullif(b.description_en, ''), b.description_vi),
    'highlights_vi', b.highlights_vi,
    'highlights_en', coalesce(nullif(b.highlights_en, ''), b.highlights_vi),
    'investment_reason_vi', b.investment_reason_vi,
    'investment_reason_en', coalesce(nullif(b.investment_reason_en, ''), b.investment_reason_vi),
    'industry', b.industry,
    'deal_type', b.deal_type,
    'city', b.city,
    'country_iso2', b.country_iso2,
    'revenue_2025', b.revenue_2025,
    'revenue_currency', b.revenue_currency,
    'ebitda_margin', b.ebitda_margin,
    'ask_amount', b.ask_amount,
    'ask_currency', b.ask_currency,
    'stake_pct', b.stake_pct,
    'quality_score', b.quality_score,
    'data_confidence', b.data_confidence,
    'image_url', coalesce(nullif(b.hero_image_url, ''), nullif(b.image_url, '')),
    'hero_image_url', coalesce(nullif(b.hero_image_url, ''), nullif(b.image_url, '')),
    'approved_source', 'seed_admin_curated_v1',
    'approved_note', 'Initial six Deals68 seed deals treated as Admin-approved public snapshot v1.',
    'approved_at', now(),
    'public_version', greatest(coalesce(b.public_version, 0), 1)
  )),
  public_version = greatest(coalesce(b.public_version, 0), 1),
  visible = true,
  status = 'active',
  moderation_status = 'approved_public',
  pending_changes_json = null,
  pending_submitted_at = null,
  pending_submitted_by = null,
  last_approved_at = coalesce(b.last_approved_at, now()),
  updated_at = now()
where b.id in (select id from tmp_d68_seed_businesses_final);

-- Mark existing images attached to these six seed deals as Admin-reviewed/sanitized.
-- If a business only has businesses.image_url/hero_image_url, the snapshot above already allows Home/Detail to show it.
update public.business_images bi
set
  public_visible = true,
  is_sanitized = true,
  display_title = coalesce(nullif(bi.display_title, ''), nullif(bi.title, ''), 'Ảnh hồ sơ doanh nghiệp đã duyệt'),
  admin_note = coalesce(nullif(bi.admin_note, ''), 'Seed deal image treated as Admin-reviewed/sanitized for Beta launch.'),
  updated_at = now()
where bi.business_id in (select id from tmp_d68_seed_businesses_final);

-- Ensure one hero image per seed business when business_images rows exist.
with ranked_images as (
  select
    bi.id,
    bi.business_id,
    row_number() over (
      partition by bi.business_id
      order by bi.is_hero desc, coalesce(bi.sort_order, 999999), bi.created_at asc, bi.id asc
    ) as rn
  from public.business_images bi
  where bi.business_id in (select id from tmp_d68_seed_businesses_final)
)
update public.business_images bi
set is_hero = (ri.rn = 1), updated_at = now()
from ranked_images ri
where bi.id = ri.id;

-- Approve only public metadata for public seed files. Private/locked files remain locked.
update public.business_files bf
set
  public_visible = case
    when coalesce(bf.privacy_level, '') = 'public' then true
    else coalesce(bf.public_visible, false)
  end,
  display_name = coalesce(nullif(bf.display_name, ''), nullif(bf.file_name, ''), 'Tài liệu doanh nghiệp'),
  admin_note = coalesce(nullif(bf.admin_note, ''), 'Seed deal file metadata reviewed by Admin for Beta launch.'),
  updated_at = now()
where bf.business_id in (select id from tmp_d68_seed_businesses_final);

-- Defensive indexes for public list/detail performance.
create index if not exists idx_businesses_public_snapshot_visible
  on public.businesses (visible, public_version)
  where public_snapshot_json is not null;

create index if not exists idx_business_images_public
  on public.business_images (business_id, public_visible, is_sanitized, is_hero);

create index if not exists idx_business_files_public
  on public.business_files (business_id, public_visible, privacy_level);

-- SQL editor verification result: should return 6 rows, all active/visible/has_public_snapshot = true.
select
  b.public_code,
  b.slug,
  b.visible,
  b.status,
  b.moderation_status,
  b.public_version,
  b.public_snapshot_json is not null as has_public_snapshot,
  coalesce(b.hero_image_url, b.image_url, b.public_snapshot_json->>'hero_image_url', b.public_snapshot_json->>'image_url') as display_image,
  (select count(*) from public.business_images bi where bi.business_id = b.id and bi.public_visible = true and bi.is_sanitized = true) as approved_images,
  (select count(*) from public.business_files bf where bf.business_id = b.id and bf.public_visible = true) as public_files
from public.businesses b
where b.id in (select id from tmp_d68_seed_businesses_final)
order by b.public_code;
