-- Deals68 Business Financial Access — Phase B.
-- Redacts exact sensitive financial values from every public Business read path while
-- preserving coarse public bands for discovery and a grant-aware secure summary RPC.
-- Phase C owns the final blur presentation; this migration prevents API/DOM source leaks.

begin;

create or replace function public.d68_public_revenue_band_key(
  p_revenue numeric,
  p_currency text
)
returns text
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  currency_code text := upper(trim(coalesce(p_currency, '')));
begin
  if p_revenue is null or p_revenue <= 0 then return 'unknown'; end if;
  if currency_code = 'VND' then
    if p_revenue < 10000000000 then return 'small'; end if;
    if p_revenue <= 100000000000 then return 'mid'; end if;
    return 'large';
  end if;
  if currency_code = 'USD' then
    if p_revenue < 400000 then return 'small'; end if;
    if p_revenue <= 4000000 then return 'mid'; end if;
    return 'large';
  end if;
  return 'unknown';
end;
$$;

create or replace function public.d68_public_revenue_band_rank(
  p_revenue numeric,
  p_currency text
)
returns smallint
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select case public.d68_public_revenue_band_key(p_revenue, p_currency)
    when 'small' then 1::smallint
    when 'mid' then 2::smallint
    when 'large' then 3::smallint
    else 0::smallint
  end;
$$;

create or replace function public.d68_public_revenue_match_band_key(
  p_revenue numeric,
  p_currency text
)
returns text
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  currency_code text := upper(trim(coalesce(p_currency, '')));
  revenue_usd numeric;
begin
  if p_revenue is null or p_revenue <= 0 then return 'unknown'; end if;
  if currency_code = 'USD' then
    revenue_usd := p_revenue;
  elsif currency_code = 'VND' then
    revenue_usd := p_revenue / 26000;
  else
    return 'unknown';
  end if;
  if revenue_usd < 1000000 then return 'under_1m'; end if;
  if revenue_usd < 10000000 then return '1_10m'; end if;
  if revenue_usd < 100000000 then return '10_100m'; end if;
  return 'over_100m';
end;
$$;

create or replace function public.d68_public_ebitda_band_key(
  p_margin numeric
)
returns text
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select case
    when p_margin is null then 'unknown'
    when p_margin < 0 then 'negative'
    when p_margin < 10 then '0_10'
    when p_margin <= 20 then '10_20'
    else 'over_20'
  end;
$$;

revoke all on function public.d68_public_revenue_band_key(numeric, text)
from public, anon, authenticated;
revoke all on function public.d68_public_revenue_band_rank(numeric, text)
from public, anon, authenticated;
revoke all on function public.d68_public_revenue_match_band_key(numeric, text)
from public, anon, authenticated;
revoke all on function public.d68_public_ebitda_band_key(numeric)
from public, anon, authenticated;
grant execute on function public.d68_public_revenue_band_key(numeric, text) to service_role;
grant execute on function public.d68_public_revenue_band_rank(numeric, text) to service_role;
grant execute on function public.d68_public_revenue_match_band_key(numeric, text) to service_role;
grant execute on function public.d68_public_ebitda_band_key(numeric) to service_role;

create or replace view public.public_businesses_safe
with (security_barrier = true, security_invoker = false)
as
select
  base.id,
  base.public_code,
  base.slug,
  base.title_vi,
  base.title_en,
  base.description_vi,
  base.description_en,
  base.country_iso2,
  base.city,
  base.industry,
  base.industry_key,
  base.deal_type,
  base.plan,
  null::numeric as revenue_2025,
  base.revenue_currency,
  null::numeric as ebitda_margin,
  base.ask_amount,
  base.ask_currency,
  base.stake_pct,
  base.highlights_vi,
  base.highlights_en,
  base.investment_reason_vi,
  base.investment_reason_en,
  base.data_confidence,
  base.quality_score,
  base.valuation_reasonableness,
  base.visible,
  base.status,
  base.hero_image_url,
  base.image_url,
  base.created_at,
  base.updated_at,
  base.public_version,
  base.last_approved_at,
  base.moderation_status,
  base.show_on_homepage,
  base.business_files_count,
  base.business_files,
  base.business_images_count,
  base.business_images,
  jsonb_strip_nulls(
    jsonb_build_object(
      'title_vi', base.title_vi,
      'title_en', base.title_en,
      'description_vi', base.description_vi,
      'description_en', base.description_en,
      'country_iso2', base.country_iso2,
      'city', base.city,
      'city_key', base.city_key,
      'industry', base.industry,
      'industry_key', base.industry_key,
      'deal_type', base.deal_type,
      'revenue_band_key', base.revenue_band_key,
      'revenue_match_band_key', base.revenue_match_band_key,
      'ebitda_band_key', base.ebitda_band_key,
      'has_financial_data', base.has_financial_data,
      'financial_data_updated_at', base.financial_data_updated_at,
      'ask_amount', base.ask_amount,
      'ask_currency', base.ask_currency,
      'stake_pct', base.stake_pct,
      'highlights_vi', base.highlights_vi,
      'highlights_en', base.highlights_en,
      'investment_reason_vi', base.investment_reason_vi,
      'investment_reason_en', base.investment_reason_en,
      'financial_input', base.public_financial_input,
      'data_confidence', base.data_confidence,
      'quality_score', base.quality_score,
      'valuation_reasonableness', base.valuation_reasonableness,
      'hero_image_url', base.hero_image_url,
      'image_url', base.image_url,
      'public_version', base.public_version
    )
  ) as public_snapshot_json,
  base.city_key,
  base.revenue_band_key,
  base.revenue_band_rank,
  base.revenue_match_band_key,
  base.ebitda_band_key,
  base.has_financial_data,
  base.financial_data_updated_at
from (
  select
    b.id,
    b.public_code,
    b.slug,
    coalesce(nullif(b.public_snapshot_json->>'title_vi', ''), nullif(b.title_vi, ''), b.public_code, 'Hồ sơ doanh nghiệp ẩn danh') as title_vi,
    coalesce(nullif(b.public_snapshot_json->>'title_en', ''), nullif(b.title_en, ''), nullif(b.public_snapshot_json->>'title_vi', ''), nullif(b.title_vi, ''), 'Anonymous business profile') as title_en,
    coalesce(b.public_snapshot_json->>'description_vi', b.description_vi, '') as description_vi,
    coalesce(b.public_snapshot_json->>'description_en', b.description_en, b.public_snapshot_json->>'description_vi', b.description_vi, '') as description_en,
    coalesce(nullif(b.public_snapshot_json->>'country_iso2', ''), nullif(b.country_iso2, ''), 'VN') as country_iso2,
    coalesce(nullif(b.public_snapshot_json->>'city', ''), nullif(b.city, ''), 'Việt Nam') as city,
    coalesce(nullif(b.public_snapshot_json->>'industry', ''), nullif(b.industry, ''), 'Đang cập nhật') as industry,
    coalesce(nullif(b.public_snapshot_json->>'industry_key', ''), nullif(b.industry_key, ''), public.normalize_business_industry_key(coalesce(b.public_snapshot_json->>'industry', b.industry))) as industry_key,
    coalesce(nullif(b.public_snapshot_json->>'deal_type', ''), nullif(b.deal_type, ''), 'Đang cập nhật') as deal_type,
    b.plan,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025) as exact_revenue_2025,
    coalesce(nullif(b.public_snapshot_json->>'revenue_currency', ''), nullif(b.revenue_currency, ''), 'VND') as revenue_currency,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'), b.ebitda_margin) as exact_ebitda_margin,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'growth_pct'), b.growth_pct) as exact_growth_pct,
    public.d68_public_revenue_band_key(
      coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025),
      coalesce(nullif(b.public_snapshot_json->>'revenue_currency', ''), nullif(b.revenue_currency, ''), 'VND')
    ) as revenue_band_key,
    public.d68_public_revenue_band_rank(
      coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025),
      coalesce(nullif(b.public_snapshot_json->>'revenue_currency', ''), nullif(b.revenue_currency, ''), 'VND')
    ) as revenue_band_rank,
    public.d68_public_revenue_match_band_key(
      coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025),
      coalesce(nullif(b.public_snapshot_json->>'revenue_currency', ''), nullif(b.revenue_currency, ''), 'VND')
    ) as revenue_match_band_key,
    public.d68_public_ebitda_band_key(
      coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'), b.ebitda_margin)
    ) as ebitda_band_key,
    (
      coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025, 0) > 0
      or coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'), b.ebitda_margin) is not null
      or coalesce(public.d68_try_numeric(b.public_snapshot_json->>'growth_pct'), b.growth_pct) is not null
    ) as has_financial_data,
    coalesce(b.last_approved_at, b.updated_at) as financial_data_updated_at,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ask_amount'), b.ask_amount, 0) as ask_amount,
    coalesce(nullif(b.public_snapshot_json->>'ask_currency', ''), nullif(b.ask_currency, ''), nullif(b.revenue_currency, ''), 'VND') as ask_currency,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'stake_pct'), b.stake_pct) as stake_pct,
    coalesce(b.public_snapshot_json->>'highlights_vi', b.highlights_vi, '') as highlights_vi,
    coalesce(b.public_snapshot_json->>'highlights_en', b.highlights_en, b.public_snapshot_json->>'highlights_vi', b.highlights_vi, '') as highlights_en,
    coalesce(b.public_snapshot_json->>'investment_reason_vi', b.investment_reason_vi, '') as investment_reason_vi,
    coalesce(b.public_snapshot_json->>'investment_reason_en', b.investment_reason_en, b.public_snapshot_json->>'investment_reason_vi', b.investment_reason_vi, '') as investment_reason_en,
    jsonb_strip_nulls(
      jsonb_build_object(
        'assets_owned', nullif(coalesce(
          b.public_snapshot_json->'financial_input'->>'assets_owned',
          b.public_snapshot_json->'financial_input'->>'assets_owned_vi',
          b.public_snapshot_json->'financial_input'->>'assets_owned_en'
        ), ''),
        'assets_owned_vi', nullif(coalesce(
          b.public_snapshot_json->'financial_input'->>'assets_owned_vi',
          b.public_snapshot_json->'financial_input'->>'assets_owned'
        ), ''),
        'assets_owned_en', nullif(coalesce(
          b.public_snapshot_json->'financial_input'->>'assets_owned_en',
          b.public_snapshot_json->'financial_input'->>'assets_owned'
        ), '')
      )
    ) as public_financial_input,
    coalesce(public.d68_try_integer(b.public_snapshot_json->>'data_confidence'), b.data_confidence, 0) as data_confidence,
    greatest(0, least(100, coalesce(public.d68_try_integer(b.public_snapshot_json->>'quality_score'), b.quality_score, 0))) as quality_score,
    coalesce(nullif(b.public_snapshot_json->>'valuation_reasonableness', ''), b.valuation_reasonableness) as valuation_reasonableness,
    true as visible,
    'active'::public.account_status as status,
    coalesce(nullif(b.public_snapshot_json->>'hero_image_url', ''), nullif(b.hero_image_url, ''), nullif(b.public_snapshot_json->>'image_url', ''), nullif(b.image_url, '')) as hero_image_url,
    coalesce(nullif(b.public_snapshot_json->>'image_url', ''), nullif(b.public_snapshot_json->>'hero_image_url', ''), nullif(b.hero_image_url, ''), nullif(b.image_url, '')) as image_url,
    b.created_at,
    b.updated_at,
    coalesce(b.public_version, 0) as public_version,
    b.last_approved_at,
    b.moderation_status,
    coalesce(b.show_on_homepage, false) as show_on_homepage,
    (
      select count(*)::bigint
      from public.business_files f
      where f.business_id = b.id and f.public_visible = true
    ) as business_files_count,
    jsonb_build_array(jsonb_build_object(
      'count', (
        select count(*)::bigint
        from public.business_files f
        where f.business_id = b.id and f.public_visible = true
      )
    )) as business_files,
    (
      select count(*)::bigint
      from public.business_images img
      where img.business_id = b.id
        and img.public_visible = true
        and img.is_sanitized = true
    ) as business_images_count,
    jsonb_build_array(jsonb_build_object(
      'count', (
        select count(*)::bigint
        from public.business_images img
        where img.business_id = b.id
          and img.public_visible = true
          and img.is_sanitized = true
      )
    )) as business_images,
    coalesce(nullif(b.public_snapshot_json->>'city_key', ''), nullif(b.city_key, '')) as city_key
  from public.businesses b
  where b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
) base;

alter view public.public_businesses_safe owner to postgres;
revoke all on public.public_businesses_safe from public, anon, authenticated;
grant select on public.public_businesses_safe to anon, authenticated, service_role;

comment on column public.public_businesses_safe.revenue_2025 is
  'Compatibility column intentionally redacted to NULL. Exact values require d68_get_business_financial_summaries and an active Business-specific grant.';
comment on column public.public_businesses_safe.ebitda_margin is
  'Compatibility column intentionally redacted to NULL. Only a coarse public band is exposed.';
comment on column public.public_businesses_safe.public_snapshot_json is
  'Redacted public snapshot. Exact revenue, EBITDA, growth and numeric asset values are intentionally omitted.';
comment on column public.public_businesses_safe.revenue_band_key is
  'Coarse discovery band: small, mid, large or unknown. It never contains the exact revenue.';
comment on column public.public_businesses_safe.revenue_match_band_key is
  'Coarse Investor matching band in USD-equivalent ranges; no exact revenue is exposed.';

create or replace function public.d68_get_business_financial_summaries(
  p_business_ids uuid[]
)
returns table (
  business_id uuid,
  revenue_month numeric,
  revenue_2025 numeric,
  revenue_currency text,
  ebitda_margin numeric,
  growth_pct numeric,
  data_confidence integer,
  source_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  actor_investor_id uuid;
  requested_count integer := coalesce(cardinality(p_business_ids), 0);
begin
  if actor_uuid is null and not service_actor then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_count = 0 then return; end if;
  if requested_count > 100 then
    raise exception 'At most 100 Business IDs may be requested' using errcode = '22023';
  end if;

  if actor_uuid is not null then
    select i.id into actor_investor_id
    from public.investors i
    where i.owner_id = actor_uuid
      and i.status = 'active'::public.account_status
    order by i.created_at asc nulls last, i.id
    limit 1;
  end if;

  return query
  with requested as (
    select distinct unnest(p_business_ids) as id
  )
  select
    b.id,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_month'), b.revenue_month),
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025),
    coalesce(nullif(b.public_snapshot_json->>'revenue_currency', ''), nullif(b.revenue_currency, ''), 'VND'),
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'), b.ebitda_margin),
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'growth_pct'), b.growth_pct),
    coalesce(public.d68_try_integer(b.public_snapshot_json->>'data_confidence'), b.data_confidence, 0),
    coalesce(b.last_approved_at, b.updated_at)
  from requested r
  join public.businesses b on b.id = r.id
  where b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
    and (
      public.is_admin()
      or service_actor
      or b.owner_id = actor_uuid
      or (
        actor_investor_id is not null
        and exists (
          select 1
          from public.business_financial_access_grants g
          where g.business_id = b.id
            and g.investor_id = actor_investor_id
            and g.status = 'active'
            and (g.expires_at is null or g.expires_at > now())
            and 'financial_summary' = any(g.scopes)
        )
      )
    );
end;
$$;

revoke all on function public.d68_get_business_financial_summaries(uuid[])
from public, anon;
grant execute on function public.d68_get_business_financial_summaries(uuid[])
to authenticated, service_role;

-- Replace the legacy unrestricted quality calculator with an owner/Admin guard while
-- preserving the original implementation under an internal name.
do $$
begin
  if to_regprocedure('public.d68_calculate_business_quality_score_payload_internal(uuid)') is null
     and to_regprocedure('public.calculate_business_quality_score_payload(uuid)') is not null then
    alter function public.calculate_business_quality_score_payload(uuid)
      rename to d68_calculate_business_quality_score_payload_internal;
  end if;
end;
$$;

revoke all on function public.d68_calculate_business_quality_score_payload_internal(uuid)
from public, anon, authenticated;
grant execute on function public.d68_calculate_business_quality_score_payload_internal(uuid)
to service_role;

create or replace function public.calculate_business_quality_score_payload(
  business_uuid uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  business_owner uuid;
begin
  select b.owner_id into business_owner
  from public.businesses b
  where b.id = business_uuid;

  if not (public.is_admin() or service_actor or business_owner = actor_uuid) then
    raise exception 'Business financial quality access denied' using errcode = '42501';
  end if;

  return public.d68_calculate_business_quality_score_payload_internal(business_uuid);
end;
$$;

revoke all on function public.calculate_business_quality_score_payload(uuid)
from public, anon;
grant execute on function public.calculate_business_quality_score_payload(uuid)
to authenticated, service_role;

-- Public discovery must go through the redacted SECURITY DEFINER view. Direct base-table
-- reads remain available only to the Business owner and Admin.
drop policy if exists "public visible businesses" on public.businesses;
drop policy if exists "business select owner or admin" on public.businesses;
create policy "business select owner or admin"
on public.businesses
for select
to authenticated
using (owner_id = auth.uid() or public.is_admin());

revoke select on table public.businesses from public, anon;
grant select on table public.businesses to authenticated, service_role;

insert into public.audit_logs (
  actor_id, action, entity_type, entity_id, detail
) values (
  null,
  'business_public_financial_redaction_phase_b',
  'system',
  'public_businesses_safe',
  jsonb_build_object(
    'exact_revenue_public', false,
    'exact_ebitda_public', false,
    'public_bands', jsonb_build_array('revenue_band_key', 'revenue_match_band_key', 'ebitda_band_key'),
    'secure_rpc', 'd68_get_business_financial_summaries',
    'base_table_anon_select', false,
    'quality_calculator_guarded', true
  )
);

commit;
