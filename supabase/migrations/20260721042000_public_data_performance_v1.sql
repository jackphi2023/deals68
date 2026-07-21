create index if not exists investors_public_ranking_idx
on public.investors (admin_priority desc, verified desc, created_at desc)
where visible = true and status = 'active'::public.account_status;

create or replace function public.get_public_homepage_bootstrap(
  max_businesses integer default 6,
  max_investors integer default 80
)
returns jsonb
language sql
security invoker
set search_path = public
as $function$
  with params as (
    select
      greatest(1, least(coalesce(max_businesses, 6), 24))::integer as business_limit,
      greatest(1, least(coalesce(max_investors, 80), 200))::integer as investor_limit
  ),
  selected_businesses as (
    select
      h.display_order,
      b.id, b.public_code, b.slug, b.title_vi, b.title_en,
      b.description_vi, b.description_en, b.country_iso2, b.city,
      b.city_key, b.industry, b.industry_key, b.deal_type, b.plan,
      b.revenue_2025, b.revenue_currency, b.ebitda_margin,
      b.ask_amount, b.ask_currency, b.stake_pct, b.highlights_vi,
      b.highlights_en, b.investment_reason_vi, b.investment_reason_en,
      b.data_confidence, b.quality_score, b.valuation_reasonableness,
      b.visible, b.status, b.image_url, b.hero_image_url,
      b.created_at, b.updated_at, b.public_version,
      b.last_approved_at, b.moderation_status
    from public.get_homepage_business_ids((select business_limit from params)) h
    join public.public_businesses_safe b on b.id = h.business_id
    order by h.display_order
  ),
  business_payload as (
    select coalesce(
      jsonb_agg(to_jsonb(sb) - 'display_order' order by sb.display_order),
      '[]'::jsonb
    ) as rows
    from selected_businesses sb
  ),
  investor_rows as (
    select
      i.id, i.code, i.type, i.title_vi, i.title_en, i.desc_vi,
      i.desc_en, i.country_iso2, i.country, i.region, i.industries,
      i.deal_types, i.stage, i.ticket_min, i.ticket_max, i.criteria,
      i.visible, i.verified, i.admin_priority, i.activity_level,
      i.status, i.created_at, i.updated_at
    from public.public_investors_safe i
    order by i.admin_priority desc, i.verified desc, i.created_at desc
    limit (select investor_limit from params)
  ),
  investor_payload as (
    select coalesce(jsonb_agg(to_jsonb(ir)), '[]'::jsonb) as rows
    from investor_rows ir
  ),
  business_metrics as (
    select
      count(*)::integer as business_count,
      coalesce(sum(
        case
          when upper(coalesce(ask_currency, revenue_currency, 'VND')) = 'USD'
            then coalesce(ask_amount, 0) * 26000
          else coalesce(ask_amount, 0)
        end
      ), 0) as total_vnd,
      coalesce(sum(
        case
          when upper(coalesce(ask_currency, revenue_currency, 'VND')) = 'USD'
            then coalesce(ask_amount, 0)
          else coalesce(ask_amount, 0) / 26000
        end
      ), 0) as total_usd
    from public.public_businesses_safe
  ),
  investor_metrics as (
    select count(*)::integer as investor_count
    from public.public_investors_safe
  )
  select jsonb_build_object(
    'business_count', bm.business_count,
    'investor_count', im.investor_count,
    'deal_value', jsonb_build_object(
      'total_vnd', bm.total_vnd,
      'total_usd', bm.total_usd,
      'count', bm.business_count,
      'fx_rate', 26000
    ),
    'businesses', bp.rows,
    'investors', ip.rows
  )
  from business_metrics bm
  cross join investor_metrics im
  cross join business_payload bp
  cross join investor_payload ip;
$function$;

grant execute on function public.get_public_homepage_bootstrap(integer, integer)
to anon, authenticated;
