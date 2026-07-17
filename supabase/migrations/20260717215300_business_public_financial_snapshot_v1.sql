-- Deals68 Session 8 — publish approved Business asset/transaction fields safely.
-- Keeps raw financial_input private and exposes only Admin-approved public fields.

begin;

create or replace function public.approve_business_pending_changes(
  business_uuid uuid,
  admin_snapshot jsonb default '{}'::jsonb,
  expected_pending_submitted_at timestamptz default null
)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_row public.businesses%rowtype;
  pending jsonb;
  merged jsonb;
  next_financial_input jsonb;
  next_public_financial_input jsonb;
  next_public_version integer;
  next_public_snapshot jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'Admin only';
  end if;

  select *
  into current_row
  from public.businesses
  where id = business_uuid
  for update;

  if not found then
    raise exception 'Business not found';
  end if;

  if expected_pending_submitted_at is not null
     and current_row.pending_submitted_at is distinct from expected_pending_submitted_at then
    raise exception 'Pending changes were updated. Refresh Admin before approving.';
  end if;

  pending := coalesce(current_row.pending_changes_json, '{}'::jsonb);
  merged := to_jsonb(current_row) || pending || coalesce(admin_snapshot, '{}'::jsonb);
  next_financial_input :=
    coalesce(current_row.financial_input, '{}'::jsonb)
    || coalesce(pending->'financial_input', '{}'::jsonb)
    || coalesce(admin_snapshot->'financial_input', '{}'::jsonb);

  next_public_financial_input := jsonb_strip_nulls(
    jsonb_build_object(
      'assets_owned',
        nullif(coalesce(
          next_financial_input->>'assets_owned',
          next_financial_input->>'assets_owned_vi',
          next_financial_input->>'assets_owned_en'
        ), ''),
      'assets_owned_vi',
        nullif(coalesce(
          next_financial_input->>'assets_owned_vi',
          next_financial_input->>'assets_owned'
        ), ''),
      'assets_owned_en',
        nullif(coalesce(
          next_financial_input->>'assets_owned_en',
          next_financial_input->>'assets_owned'
        ), ''),
      'excluded_physical_asset_value',
        nullif(coalesce(
          next_financial_input->>'excluded_physical_asset_value',
          next_financial_input->>'excluded_physical_asset_value_vi',
          next_financial_input->>'excluded_physical_asset_value_en'
        ), ''),
      'excluded_physical_asset_value_vi',
        nullif(coalesce(
          next_financial_input->>'excluded_physical_asset_value_vi',
          next_financial_input->>'excluded_physical_asset_value'
        ), ''),
      'excluded_physical_asset_value_en',
        nullif(coalesce(
          next_financial_input->>'excluded_physical_asset_value_en',
          next_financial_input->>'excluded_physical_asset_value'
        ), '')
    )
  );

  next_public_version := coalesce(current_row.public_version, 0) + 1;

  next_public_snapshot := jsonb_build_object(
    'title_vi', coalesce(merged->>'title_vi', ''),
    'title_en', coalesce(merged->>'title_en', ''),
    'description_vi', coalesce(merged->>'description_vi', ''),
    'description_en', coalesce(merged->>'description_en', ''),
    'country_iso2', coalesce(nullif(merged->>'country_iso2', ''), 'VN'),
    'city', coalesce(merged->>'city', ''),
    'city_key', coalesce(merged->>'city_key', ''),
    'industry', coalesce(merged->>'industry', ''),
    'industry_key', coalesce(merged->>'industry_key', ''),
    'deal_type', coalesce(merged->>'deal_type', ''),
    'revenue_month', coalesce(nullif(merged->>'revenue_month', '')::numeric, 0),
    'revenue_2025', coalesce(nullif(merged->>'revenue_2025', '')::numeric, 0),
    'revenue_currency', coalesce(nullif(merged->>'revenue_currency', ''), 'VND'),
    'ebitda_margin', coalesce(nullif(merged->>'ebitda_margin', '')::numeric, 0),
    'growth_pct', coalesce(nullif(merged->>'growth_pct', '')::numeric, 0),
    'ask_amount', coalesce(nullif(merged->>'ask_amount', '')::numeric, 0),
    'ask_currency', coalesce(nullif(merged->>'ask_currency', ''), nullif(merged->>'revenue_currency', ''), 'VND'),
    'stake_pct', coalesce(nullif(merged->>'stake_pct', '')::numeric, 0),
    'offer_amount', coalesce(nullif(merged->>'offer_amount', '')::numeric, nullif(merged->>'ask_amount', '')::numeric, 0),
    'offer_stake_pct', coalesce(nullif(merged->>'offer_stake_pct', '')::numeric, nullif(merged->>'stake_pct', '')::numeric, 0),
    'highlights_vi', coalesce(merged->>'highlights_vi', ''),
    'highlights_en', coalesce(merged->>'highlights_en', ''),
    'investment_reason_vi', coalesce(merged->>'investment_reason_vi', ''),
    'investment_reason_en', coalesce(merged->>'investment_reason_en', ''),
    'financial_input', next_public_financial_input,
    'data_confidence', coalesce(nullif(merged->>'data_confidence', '')::integer, 0),
    'quality_score', greatest(0, least(100, coalesce(nullif(merged->>'quality_score', '')::integer, current_row.quality_score, 0))),
    'valuation_reasonableness', merged->>'valuation_reasonableness',
    'hero_image_url', nullif(merged->>'hero_image_url', ''),
    'image_url', nullif(coalesce(merged->>'image_url', merged->>'hero_image_url'), ''),
    'approved_at', now(),
    'public_version', next_public_version
  );

  update public.businesses
  set
    company_name_private = case when merged ? 'company_name_private' then merged->>'company_name_private' else current_row.company_name_private end,
    title_vi = coalesce(merged->>'title_vi', current_row.title_vi),
    title_en = coalesce(merged->>'title_en', current_row.title_en),
    description_vi = coalesce(merged->>'description_vi', current_row.description_vi),
    description_en = coalesce(merged->>'description_en', current_row.description_en),
    country_iso2 = coalesce(nullif(merged->>'country_iso2', ''), current_row.country_iso2, 'VN'),
    city = coalesce(merged->>'city', current_row.city),
    city_key = coalesce(merged->>'city_key', current_row.city_key),
    industry = coalesce(merged->>'industry', current_row.industry),
    industry_key = coalesce(merged->>'industry_key', current_row.industry_key),
    deal_type = coalesce(merged->>'deal_type', current_row.deal_type),
    plan = coalesce(nullif(merged->>'plan', ''), current_row.plan),
    revenue_month = coalesce(nullif(merged->>'revenue_month', '')::numeric, current_row.revenue_month, 0),
    revenue_2025 = coalesce(nullif(merged->>'revenue_2025', '')::numeric, current_row.revenue_2025, 0),
    revenue_currency = coalesce(nullif(merged->>'revenue_currency', ''), current_row.revenue_currency, 'VND'),
    ebitda_margin = coalesce(nullif(merged->>'ebitda_margin', '')::numeric, current_row.ebitda_margin, 0),
    growth_pct = coalesce(nullif(merged->>'growth_pct', '')::numeric, current_row.growth_pct, 0),
    ask_amount = coalesce(nullif(merged->>'ask_amount', '')::numeric, current_row.ask_amount, 0),
    ask_currency = coalesce(nullif(merged->>'ask_currency', ''), current_row.ask_currency, current_row.revenue_currency, 'VND'),
    stake_pct = coalesce(nullif(merged->>'stake_pct', '')::numeric, current_row.stake_pct, 0),
    offer_amount = coalesce(nullif(merged->>'offer_amount', '')::numeric, nullif(merged->>'ask_amount', '')::numeric, current_row.offer_amount, 0),
    offer_stake_pct = coalesce(nullif(merged->>'offer_stake_pct', '')::numeric, nullif(merged->>'stake_pct', '')::numeric, current_row.offer_stake_pct, 0),
    self_valuation = coalesce(nullif(merged->>'self_valuation', '')::numeric, current_row.self_valuation),
    bench_low = coalesce(nullif(merged->>'bench_low', '')::numeric, current_row.bench_low),
    bench_mid = coalesce(nullif(merged->>'bench_mid', '')::numeric, current_row.bench_mid),
    bench_high = coalesce(nullif(merged->>'bench_high', '')::numeric, current_row.bench_high),
    bench_verdict = coalesce(merged->>'bench_verdict', current_row.bench_verdict),
    bench_config_version = coalesce(nullif(merged->>'bench_config_version', '')::integer, current_row.bench_config_version),
    bench_calculated_at = coalesce(nullif(merged->>'bench_calculated_at', '')::timestamptz, current_row.bench_calculated_at),
    financial_input = next_financial_input,
    highlights_vi = coalesce(merged->>'highlights_vi', current_row.highlights_vi),
    highlights_en = coalesce(merged->>'highlights_en', current_row.highlights_en),
    investment_reason_vi = coalesce(merged->>'investment_reason_vi', current_row.investment_reason_vi),
    investment_reason_en = coalesce(merged->>'investment_reason_en', current_row.investment_reason_en),
    data_confidence = coalesce(nullif(merged->>'data_confidence', '')::integer, current_row.data_confidence, 0),
    quality_score = greatest(0, least(100, coalesce(nullif(merged->>'quality_score', '')::integer, current_row.quality_score, 0))),
    quality_score_manual_override = coalesce((admin_snapshot->>'quality_score_manual_override')::boolean, current_row.quality_score_manual_override, false),
    quality_score_manual_note = coalesce(admin_snapshot->>'quality_score_manual_note', current_row.quality_score_manual_note),
    valuation_reasonableness = coalesce(merged->>'valuation_reasonableness', current_row.valuation_reasonableness),
    hero_image_url = nullif(merged->>'hero_image_url', ''),
    image_url = nullif(coalesce(merged->>'image_url', merged->>'hero_image_url'), ''),
    public_snapshot_json = next_public_snapshot,
    public_version = next_public_version,
    visible = true,
    status = 'active'::public.account_status,
    pending_changes_json = null,
    pending_submitted_at = null,
    pending_submitted_by = null,
    moderation_status = 'approved',
    last_approved_at = now(),
    last_approved_by = auth.uid(),
    updated_at = now()
  where id = business_uuid
  returning * into current_row;

  return current_row;
end;
$function$;

revoke all on function public.approve_business_pending_changes(uuid, jsonb, timestamptz)
  from public, anon;
grant execute on function public.approve_business_pending_changes(uuid, jsonb, timestamptz)
  to authenticated, service_role;

-- Backfill only previously approved public snapshots, using the protected approved
-- financial_input column and exposing only the two public asset groups.
update public.businesses b
set public_snapshot_json = jsonb_set(
  b.public_snapshot_json,
  '{financial_input}',
  jsonb_strip_nulls(
    jsonb_build_object(
      'assets_owned',
        nullif(coalesce(
          b.financial_input->>'assets_owned',
          b.financial_input->>'assets_owned_vi',
          b.financial_input->>'assets_owned_en'
        ), ''),
      'assets_owned_vi',
        nullif(coalesce(
          b.financial_input->>'assets_owned_vi',
          b.financial_input->>'assets_owned'
        ), ''),
      'assets_owned_en',
        nullif(coalesce(
          b.financial_input->>'assets_owned_en',
          b.financial_input->>'assets_owned'
        ), ''),
      'excluded_physical_asset_value',
        nullif(coalesce(
          b.financial_input->>'excluded_physical_asset_value',
          b.financial_input->>'excluded_physical_asset_value_vi',
          b.financial_input->>'excluded_physical_asset_value_en'
        ), ''),
      'excluded_physical_asset_value_vi',
        nullif(coalesce(
          b.financial_input->>'excluded_physical_asset_value_vi',
          b.financial_input->>'excluded_physical_asset_value'
        ), ''),
      'excluded_physical_asset_value_en',
        nullif(coalesce(
          b.financial_input->>'excluded_physical_asset_value_en',
          b.financial_input->>'excluded_physical_asset_value'
        ), '')
    )
  ),
  true
)
where b.public_snapshot_json is not null
  and b.moderation_status = 'approved'
  and b.last_approved_at is not null;

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
      'financial_input', base.public_financial_input,
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
    coalesce(b.public_snapshot_json->'financial_input', '{}'::jsonb) as public_financial_input,
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

comment on column public.public_businesses_safe.public_snapshot_json is
  'Approved public snapshot. financial_input contains only sanitized Admin-approved asset fields.';

commit;
