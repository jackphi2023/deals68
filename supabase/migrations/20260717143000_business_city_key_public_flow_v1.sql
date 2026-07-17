-- Deals68 Business location canonical flow v1
-- Exposes only the approved canonical city key through the existing safe view.

update public.businesses b
set city_key = lt.key
from public.location_taxonomy lt
where nullif(btrim(b.city_key), '') is null
  and lt.active = true
  and upper(coalesce(b.country_iso2, 'VN')) = lt.country_iso2
  and (
    lower(btrim(coalesce(b.city, ''))) = lower(btrim(lt.vi))
    or lower(btrim(coalesce(b.city, ''))) = lower(btrim(lt.en))
    or (
      lt.key = 'VN-ho-chi-minh'
      and lower(btrim(coalesce(b.city, ''))) in (
        'tp.hcm', 'tp hcm', 'hcmc', 'ho chi minh city', 'saigon', 'sài gòn'
      )
    )
  );

create index if not exists idx_businesses_city_key
on public.businesses(city_key);

create index if not exists idx_businesses_public_city_key
on public.businesses((
  coalesce(
    nullif(public_snapshot_json->>'city_key', ''),
    nullif(city_key, '')
  )
))
where visible = true
  and status = 'active'::public.account_status
  and public_snapshot_json is not null;

create or replace view public.public_businesses_safe
with (security_barrier = true)
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
  base.revenue_2025,
  base.revenue_currency,
  base.ebitda_margin,
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
      'revenue_2025', base.revenue_2025,
      'revenue_currency', base.revenue_currency,
      'ebitda_margin', base.ebitda_margin,
      'ask_amount', base.ask_amount,
      'ask_currency', base.ask_currency,
      'stake_pct', base.stake_pct,
      'highlights_vi', base.highlights_vi,
      'highlights_en', base.highlights_en,
      'investment_reason_vi', base.investment_reason_vi,
      'investment_reason_en', base.investment_reason_en,
      'data_confidence', base.data_confidence,
      'quality_score', base.quality_score,
      'valuation_reasonableness', base.valuation_reasonableness,
      'hero_image_url', base.hero_image_url,
      'image_url', base.image_url,
      'public_version', base.public_version
    )
  ) as public_snapshot_json,
  base.city_key
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
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025, 0) as revenue_2025,
    coalesce(nullif(b.public_snapshot_json->>'revenue_currency', ''), nullif(b.revenue_currency, ''), 'VND') as revenue_currency,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'), b.ebitda_margin) as ebitda_margin,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ask_amount'), b.ask_amount, 0) as ask_amount,
    coalesce(nullif(b.public_snapshot_json->>'ask_currency', ''), nullif(b.ask_currency, ''), nullif(b.revenue_currency, ''), 'VND') as ask_currency,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'stake_pct'), b.stake_pct) as stake_pct,
    coalesce(b.public_snapshot_json->>'highlights_vi', b.highlights_vi, '') as highlights_vi,
    coalesce(b.public_snapshot_json->>'highlights_en', b.highlights_en, b.public_snapshot_json->>'highlights_vi', b.highlights_vi, '') as highlights_en,
    coalesce(b.public_snapshot_json->>'investment_reason_vi', b.investment_reason_vi, '') as investment_reason_vi,
    coalesce(b.public_snapshot_json->>'investment_reason_en', b.investment_reason_en, b.public_snapshot_json->>'investment_reason_vi', b.investment_reason_vi, '') as investment_reason_en,
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
    coalesce(
      nullif(b.public_snapshot_json->>'city_key', ''),
      nullif(b.city_key, '')
    ) as city_key
  from public.businesses b
  where b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
) base;

alter view public.public_businesses_safe owner to postgres;
revoke all on public.public_businesses_safe from public, anon, authenticated;
grant select on public.public_businesses_safe to anon, authenticated;
alter view public.public_businesses_safe set (security_invoker = true);

comment on column public.public_businesses_safe.city_key is
  'Approved canonical location key used by public Business filters.';
