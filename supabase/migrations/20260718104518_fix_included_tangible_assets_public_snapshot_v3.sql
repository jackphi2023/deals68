begin;

-- Publish the approved "included in transaction" tangible-asset fields.
-- Legacy excluded_physical_asset_value* data remains internal and is never reinterpreted.
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
      'included_tangible_assets',
        nullif(coalesce(
          next_financial_input->>'included_tangible_assets',
          next_financial_input->>'included_tangible_assets_vi',
          next_financial_input->>'included_tangible_assets_en'
        ), ''),
      'included_tangible_assets_vi',
        nullif(coalesce(
          next_financial_input->>'included_tangible_assets_vi',
          next_financial_input->>'included_tangible_assets'
        ), ''),
      'included_tangible_assets_en',
        nullif(coalesce(
          next_financial_input->>'included_tangible_assets_en',
          next_financial_input->>'included_tangible_assets'
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

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.businesses'::regclass
      and tgname = 'trg_refresh_quality_businesses'
      and not tgisinternal
  ) then
    execute 'alter table public.businesses disable trigger trg_refresh_quality_businesses';
  end if;
end
$$;

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
      'included_tangible_assets',
        nullif(coalesce(
          b.financial_input->>'included_tangible_assets',
          b.financial_input->>'included_tangible_assets_vi',
          b.financial_input->>'included_tangible_assets_en'
        ), ''),
      'included_tangible_assets_vi',
        nullif(coalesce(
          b.financial_input->>'included_tangible_assets_vi',
          b.financial_input->>'included_tangible_assets'
        ), ''),
      'included_tangible_assets_en',
        nullif(coalesce(
          b.financial_input->>'included_tangible_assets_en',
          b.financial_input->>'included_tangible_assets'
        ), '')
    )
  ),
  true
)
where b.public_snapshot_json is not null
  and b.moderation_status = 'approved'
  and b.last_approved_at is not null;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.businesses'::regclass
      and tgname = 'trg_refresh_quality_businesses'
      and not tgisinternal
  ) then
    execute 'alter table public.businesses enable trigger trg_refresh_quality_businesses';
  end if;
end
$$;

commit;
