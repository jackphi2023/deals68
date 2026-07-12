-- Deals68 G1 Security Phase A
-- Backward-compatible foundation for a shared Beta/Production Supabase project.
-- This migration creates safe public views/RPCs and protects account/admin fields.
-- It deliberately DOES NOT remove public SELECT access from raw businesses/investors yet.
-- Raw public SELECT enforcement is Phase B and must only run after main uses the safe views.

create or replace function public.d68_try_numeric(raw_value text)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(coalesce(raw_value, '')), '') is null then
    return null;
  end if;
  return raw_value::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.d68_try_integer(raw_value text)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(coalesce(raw_value, '')), '') is null then
    return null;
  end if;
  return raw_value::integer;
exception when others then
  return null;
end;
$$;

revoke all on function public.d68_try_numeric(text) from public, anon, authenticated;
revoke all on function public.d68_try_integer(text) from public, anon, authenticated;

create or replace view public.public_businesses_safe
with (security_barrier = true)
as
select
  base.*,
  jsonb_strip_nulls(
    jsonb_build_object(
      'title_vi', base.title_vi,
      'title_en', base.title_en,
      'description_vi', base.description_vi,
      'description_en', base.description_en,
      'country_iso2', base.country_iso2,
      'city', base.city,
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
  ) as public_snapshot_json
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
      where f.business_id = b.id
        and f.public_visible = true
    ) as business_files_count,
    jsonb_build_array(jsonb_build_object(
      'count', (
        select count(*)::bigint
        from public.business_files f
        where f.business_id = b.id
          and f.public_visible = true
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
    )) as business_images
  from public.businesses b
  where b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
) base;

alter view public.public_businesses_safe owner to postgres;
revoke all on public.public_businesses_safe from public, anon, authenticated;
grant select on public.public_businesses_safe to anon, authenticated;
alter view public.public_businesses_safe set (security_invoker = true);

create or replace view public.public_investors_safe
with (security_barrier = true)
as
select
  i.id,
  i.code,
  i.type,
  i.title_vi,
  i.title_en,
  i.desc_vi,
  i.desc_en,
  i.country_iso2,
  i.country,
  i.region,
  coalesce(i.industries, '{}'::text[]) as industries,
  coalesce(i.deal_types, '{}'::text[]) as deal_types,
  i.stage,
  i.ticket_min,
  i.ticket_max,
  jsonb_strip_nulls(
    jsonb_build_object(
      'sectors', coalesce(i.criteria->'sectors', to_jsonb(coalesce(i.industries, '{}'::text[]))),
      'dealTypes', coalesce(i.criteria->'dealTypes', to_jsonb(coalesce(i.deal_types, '{}'::text[]))),
      'targetCountries', coalesce(i.criteria->'targetCountries', i.criteria->'targetCountriesCache', i.criteria->'preferredCountries'),
      'preferredCountries', coalesce(i.criteria->'preferredCountries', i.criteria->'targetCountries'),
      'targetGeographies', coalesce(i.criteria->'targetGeographies', i.criteria->'preferredGeographies'),
      'investment_appetite', i.criteria->'investment_appetite',
      'riskAppetite', i.criteria->'riskAppetite',
      'returnExpectation', i.criteria->'returnExpectation',
      'revenueBand', i.criteria->'revenueBand',
      'proposal_history', i.criteria->'proposal_history'
    )
  ) as criteria,
  true as visible,
  coalesce(i.verified, false) as verified,
  coalesce(i.admin_priority, false) as admin_priority,
  i.activity_level,
  'active'::public.account_status as status,
  i.created_at,
  i.updated_at
from public.investors i
where i.visible = true
  and i.status = 'active'::public.account_status;

alter view public.public_investors_safe owner to postgres;
revoke all on public.public_investors_safe from public, anon, authenticated;
grant select on public.public_investors_safe to anon, authenticated;
alter view public.public_investors_safe set (security_invoker = true);

create or replace function public.get_my_investor_dashboard_relations(
  investor_uuid uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from public.investors i
    where i.id = investor_uuid
      and i.owner_id = auth.uid()
  ) then
    raise exception 'investor_not_owned';
  end if;

  select jsonb_build_object(
    'interests', coalesce((
      select jsonb_agg(
        to_jsonb(ii) || jsonb_build_object('businesses', to_jsonb(pb))
        order by ii.created_at desc
      )
      from public.investor_interests ii
      left join public.public_businesses_safe pb on pb.id = ii.business_id
      where ii.investor_id = investor_uuid
    ), '[]'::jsonb),
    'proposals', coalesce((
      select jsonb_agg(
        to_jsonb(p) || jsonb_build_object('businesses', to_jsonb(pb))
        order by p.sent_at desc nulls last, p.updated_at desc
      )
      from public.proposals p
      left join public.public_businesses_safe pb on pb.id = p.business_id
      where p.investor_id = investor_uuid
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.get_my_business_dashboard_relations(
  business_uuid uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from public.businesses b
    where b.id = business_uuid
      and b.owner_id = auth.uid()
  ) then
    raise exception 'business_not_owned';
  end if;

  select jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(
        to_jsonb(r) || jsonb_build_object('investors', to_jsonb(pi))
        order by r.created_at desc
      )
      from public.request_data r
      left join public.public_investors_safe pi on pi.id = r.investor_id
      where r.business_id = business_uuid
    ), '[]'::jsonb),
    'interests', coalesce((
      select jsonb_agg(
        to_jsonb(ii) || jsonb_build_object('investors', to_jsonb(pi))
        order by ii.created_at desc
      )
      from public.investor_interests ii
      left join public.public_investors_safe pi on pi.id = ii.investor_id
      where ii.business_id = business_uuid
    ), '[]'::jsonb),
    'proposals', coalesce((
      select jsonb_agg(
        to_jsonb(p) || jsonb_build_object('investors', to_jsonb(pi))
        order by p.sent_at desc nulls last, p.updated_at desc
      )
      from public.proposals p
      left join public.public_investors_safe pi on pi.id = p.investor_id
      where p.business_id = business_uuid
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_my_investor_dashboard_relations(uuid) from public, anon;
revoke all on function public.get_my_business_dashboard_relations(uuid) from public, anon;
grant execute on function public.get_my_investor_dashboard_relations(uuid) to authenticated;
grant execute on function public.get_my_business_dashboard_relations(uuid) to authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin() then
    new.initial_password := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null or new.id is distinct from auth.uid() then
      raise exception 'profile_insert_not_owned';
    end if;
    if new.role::text not in ('business', 'investor', 'affiliate') then
      raise exception 'profile_role_not_allowed';
    end if;
    new.status := 'pending_admin_review'::public.account_status;
    new.dashboard_login_enabled := false;
    new.initial_password := null;
    return new;
  end if;

  if old.id is distinct from auth.uid() then
    raise exception 'profile_update_not_owned';
  end if;

  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.dashboard_login_enabled is distinct from old.dashboard_login_enabled
     or new.initial_password is distinct from old.initial_password
     or new.email is distinct from old.email then
    raise exception 'protected_profile_field';
  end if;

  new.initial_password := null;
  return new;
end;
$$;

drop trigger if exists aaa_protect_profile_security_fields on public.profiles;
create trigger aaa_protect_profile_security_fields
before insert or update on public.profiles
for each row
execute function public.protect_profile_security_fields();

create or replace function public.protect_business_admin_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  old_locked jsonb;
  new_locked jsonb;
  forbidden_pending text[] := array[
    'owner_id', 'public_code', 'slug', 'plan', 'visible', 'status',
    'quota_total', 'quota_used', 'public_snapshot_json', 'public_version',
    'last_approved_at', 'last_approved_by', 'show_on_homepage',
    'quality_score', 'quality_score_auto', 'quality_breakdown',
    'quality_breakdown_json', 'quality_score_manual_override',
    'quality_score_manual_note', 'hero_image_url', 'image_url'
  ];
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if old.owner_id is distinct from auth.uid() then
    raise exception 'business_update_not_owned';
  end if;

  old_locked := to_jsonb(old) - array[
    'pending_changes_json', 'pending_submitted_at', 'pending_submitted_by',
    'moderation_status', 'visible', 'status', 'updated_at'
  ];
  new_locked := to_jsonb(new) - array[
    'pending_changes_json', 'pending_submitted_at', 'pending_submitted_by',
    'moderation_status', 'visible', 'status', 'updated_at'
  ];

  if new_locked is distinct from old_locked then
    raise exception 'protected_business_field';
  end if;

  if new.pending_submitted_by is distinct from old.pending_submitted_by
     and new.pending_submitted_by is distinct from auth.uid() then
    raise exception 'invalid_pending_submitter';
  end if;

  if new.moderation_status is distinct from old.moderation_status
     and new.moderation_status is distinct from 'pending_admin_review' then
    raise exception 'invalid_business_moderation_status';
  end if;

  if new.visible is distinct from old.visible and new.visible is distinct from false then
    raise exception 'business_cannot_self_publish';
  end if;

  if new.status is distinct from old.status
     and new.status::text is distinct from 'pending_admin_review' then
    raise exception 'business_cannot_change_status';
  end if;

  if coalesce(new.pending_changes_json, '{}'::jsonb) ?| forbidden_pending then
    raise exception 'forbidden_business_pending_field';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_protect_business_admin_fields on public.businesses;
create trigger aaa_protect_business_admin_fields
before update on public.businesses
for each row
execute function public.protect_business_admin_fields();

create or replace function public.protect_investor_admin_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if old.owner_id = auth.uid() then
    if new.owner_id is distinct from old.owner_id
      or new.code is distinct from old.code
      or new.title_vi is distinct from old.title_vi
      or new.title_en is distinct from old.title_en
      or new.desc_vi is distinct from old.desc_vi
      or new.desc_en is distinct from old.desc_en
      or new.visible is distinct from old.visible
      or new.verified is distinct from old.verified
      or new.admin_priority is distinct from old.admin_priority
      or new.activity_level is distinct from old.activity_level
      or new.status is distinct from old.status
    then
      raise exception 'protected_investor_field';
    end if;
  end if;

  return new;
end;
$$;

-- Existing trigger trg_protect_investor_admin_fields is retained and now uses
-- the corrected SECURITY INVOKER function above.

update public.profiles
set initial_password = null,
    updated_at = now()
where initial_password is not null;

alter table public.profiles
alter column initial_password set default null;

comment on column public.profiles.initial_password is
  'Deprecated security field. Must remain NULL. Passwords are managed only by Supabase Auth.';

-- Principle of least privilege that is safe before the frontend cutover.
-- SELECT remains temporarily for legacy public pages until Phase B.
revoke insert, update, delete, truncate, references, trigger
on public.profiles, public.businesses, public.investors
from anon;

revoke truncate, references, trigger
on public.profiles, public.businesses, public.investors
from authenticated;
