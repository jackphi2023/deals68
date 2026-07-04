-- Deals68 business public snapshot workflow
-- Goal: public pages only read Admin-approved anonymous snapshots.

alter table public.businesses
  add column if not exists public_snapshot_json jsonb,
  add column if not exists public_version integer not null default 0,
  add column if not exists last_approved_at timestamptz,
  add column if not exists last_approved_by uuid,
  add column if not exists pending_submitted_at timestamptz,
  add column if not exists pending_submitted_by uuid,
  add column if not exists moderation_status text not null default 'pending_admin_review';

alter table public.business_images
  add column if not exists display_title text,
  add column if not exists public_visible boolean not null default false,
  add column if not exists is_sanitized boolean not null default false,
  add column if not exists is_hero boolean not null default false,
  add column if not exists admin_note text;

alter table public.business_files
  add column if not exists display_name text,
  add column if not exists public_visible boolean not null default false,
  add column if not exists admin_note text;

create index if not exists idx_businesses_public_snapshot_visible
  on public.businesses (visible, public_version)
  where public_snapshot_json is not null;

create index if not exists idx_business_images_public
  on public.business_images (business_id, public_visible, is_sanitized, is_hero);

create index if not exists idx_business_files_public
  on public.business_files (business_id, public_visible, privacy_level);

create or replace function public.approve_business_public_snapshot(business_uuid uuid, snapshot jsonb)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.businesses;
  next_version integer;
begin
  select coalesce(public_version, 0) + 1 into next_version
  from public.businesses
  where id = business_uuid
  for update;

  update public.businesses
  set
    public_snapshot_json = snapshot || jsonb_build_object('public_version', next_version, 'approved_at', now()),
    public_version = next_version,
    title_vi = coalesce(nullif(snapshot->>'title_vi', ''), title_vi),
    title_en = coalesce(nullif(snapshot->>'title_en', ''), title_en),
    description_vi = coalesce(nullif(snapshot->>'description_vi', ''), description_vi),
    description_en = coalesce(nullif(snapshot->>'description_en', ''), description_en),
    highlights_vi = coalesce(nullif(snapshot->>'highlights_vi', ''), highlights_vi),
    highlights_en = coalesce(nullif(snapshot->>'highlights_en', ''), highlights_en),
    investment_reason_vi = coalesce(nullif(snapshot->>'investment_reason_vi', ''), investment_reason_vi),
    investment_reason_en = coalesce(nullif(snapshot->>'investment_reason_en', ''), investment_reason_en),
    industry = coalesce(nullif(snapshot->>'industry', ''), industry),
    deal_type = coalesce(nullif(snapshot->>'deal_type', ''), deal_type),
    city = coalesce(nullif(snapshot->>'city', ''), city),
    country_iso2 = coalesce(nullif(snapshot->>'country_iso2', ''), country_iso2),
    revenue_2025 = coalesce(nullif(snapshot->>'revenue_2025', '')::numeric, revenue_2025),
    revenue_currency = coalesce(nullif(snapshot->>'revenue_currency', ''), revenue_currency),
    ebitda_margin = coalesce(nullif(snapshot->>'ebitda_margin', '')::numeric, ebitda_margin),
    ask_amount = coalesce(nullif(snapshot->>'ask_amount', '')::numeric, ask_amount),
    ask_currency = coalesce(nullif(snapshot->>'ask_currency', ''), ask_currency),
    stake_pct = coalesce(nullif(snapshot->>'stake_pct', '')::numeric, stake_pct),
    quality_score = coalesce(nullif(snapshot->>'quality_score', '')::numeric, quality_score),
    data_confidence = coalesce(nullif(snapshot->>'data_confidence', '')::numeric, data_confidence),
    hero_image_url = coalesce(nullif(snapshot->>'hero_image_url', ''), hero_image_url),
    image_url = coalesce(nullif(snapshot->>'image_url', ''), nullif(snapshot->>'hero_image_url', ''), image_url),
    visible = true,
    status = 'active',
    moderation_status = 'approved_public',
    pending_changes_json = null,
    last_approved_at = now(),
    last_approved_by = auth.uid(),
    updated_at = now()
  where id = business_uuid
  returning * into updated_row;

  return updated_row;
end;
$$;

comment on column public.businesses.public_snapshot_json is 'Admin-approved anonymous public snapshot. Public pages must use this snapshot/approved columns only.';
comment on column public.businesses.pending_changes_json is 'User-created or user-edited source changes waiting for Admin moderation. Public pages must not read this directly.';
comment on column public.business_images.is_sanitized is 'Admin confirms the image has been blurred/cleaned so no logo or real business name leaks.';
comment on column public.business_files.display_name is 'Admin-edited anonymous file name for public display; raw file_name may contain private data.';
