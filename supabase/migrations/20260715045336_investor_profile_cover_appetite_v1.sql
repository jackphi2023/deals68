begin;

alter table public.site_banners
  drop constraint if exists site_banners_placement_check;

alter table public.site_banners
  add constraint site_banners_placement_check
  check (
    placement = any (
      array[
        'home_hero'::text,
        'home_promotion'::text,
        'listing_promotion'::text,
        'investor_cover_default'::text
      ]
    )
  );

insert into public.site_banners (
  placement, title, image_url, image_path, sort_order,
  lang_mode, starts_at, ends_at, active, focal_x, focal_y,
  desktop_fit, mobile_fit
)
select
  'investor_cover_default',
  'Ảnh Cover Investor mặc định',
  '/assets/investor-cover-default.svg',
  null, 1, 'both', current_date, null, true,
  50, 50, 'cover', 'cover'
where not exists (
  select 1 from public.site_banners
  where placement = 'investor_cover_default'
    and sort_order = 1
);

create or replace view public.public_investors_safe
with (security_barrier = true, security_invoker = true)
as
select
  id, code, type, title_vi, title_en, desc_vi, desc_en,
  country_iso2, country, region,
  coalesce(industries, '{}'::text[]) as industries,
  coalesce(deal_types, '{}'::text[]) as deal_types,
  stage, ticket_min, ticket_max,
  jsonb_strip_nulls(jsonb_build_object(
    'sectors', coalesce(criteria -> 'sectors', to_jsonb(coalesce(industries, '{}'::text[]))),
    'dealTypes', coalesce(criteria -> 'dealTypes', to_jsonb(coalesce(deal_types, '{}'::text[]))),
    'targetCountries', coalesce(criteria -> 'targetCountries', criteria -> 'targetCountriesCache', criteria -> 'preferredCountries'),
    'preferredCountries', coalesce(criteria -> 'preferredCountries', criteria -> 'targetCountries'),
    'targetGeographies', coalesce(criteria -> 'targetGeographies', criteria -> 'preferredGeographies'),
    'investment_appetite', criteria -> 'investment_appetite',
    'riskAppetite', criteria -> 'riskAppetite',
    'returnExpectation', criteria -> 'returnExpectation',
    'revenueBand', criteria -> 'revenueBand',
    'proposal_history', criteria -> 'proposal_history',
    'cover_image_url', criteria -> 'cover_image_url'
  )) as criteria,
  true as visible,
  coalesce(verified, false) as verified,
  coalesce(admin_priority, false) as admin_priority,
  activity_level,
  'active'::public.account_status as status,
  created_at, updated_at
from public.investors i
where visible = true
  and status = 'active'::public.account_status;

grant select on public.public_investors_safe to anon, authenticated;

create or replace function public.submit_my_investor_appetite(
  appetite_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_value text := btrim(coalesce(appetite_text, ''));
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_row from public.investors i
  where i.owner_id = auth.uid() for update;
  if not found then raise exception 'investor_not_found'; end if;

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  v_pending := case
    when jsonb_typeof(v_privacy -> 'pending_profile_changes') = 'object'
      then v_privacy -> 'pending_profile_changes'
    else '{}'::jsonb end;
  v_pending_criteria := case
    when jsonb_typeof(v_pending -> 'criteria') = 'object'
      then v_pending -> 'criteria'
    else '{}'::jsonb end;
  v_pending_criteria := jsonb_set(
    v_pending_criteria, '{investment_appetite}', to_jsonb(v_value), true
  );
  v_pending := jsonb_set(v_pending, '{criteria}', v_pending_criteria, true);
  v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
  v_privacy := jsonb_set(
    v_privacy, '{pending_submitted_at}', to_jsonb(now()::text), true
  );

  update public.investors i
  set privacy = v_privacy, updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'appetite_pending', true,
    'pending_value', v_value
  );
end
$$;

revoke all on function public.submit_my_investor_appetite(text) from public;
grant execute on function public.submit_my_investor_appetite(text) to authenticated;

create or replace function public.admin_approve_investor_appetite(
  investor_uuid uuid,
  appetite_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_criteria jsonb;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_value text := btrim(coalesce(appetite_text, ''));
begin
  if not public.is_admin_user() then raise exception 'admin_required'; end if;
  select * into v_row from public.investors i
  where i.id = investor_uuid for update;
  if not found then raise exception 'investor_not_found'; end if;

  v_criteria := coalesce(v_row.criteria, '{}'::jsonb);
  if v_value = '' then
    v_criteria := v_criteria - 'investment_appetite';
  else
    v_criteria := jsonb_set(
      v_criteria, '{investment_appetite}', to_jsonb(v_value), true
    );
  end if;

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  v_pending := case
    when jsonb_typeof(v_privacy -> 'pending_profile_changes') = 'object'
      then v_privacy -> 'pending_profile_changes'
    else '{}'::jsonb end;
  if jsonb_typeof(v_pending -> 'criteria') = 'object' then
    v_pending_criteria := (v_pending -> 'criteria') - 'investment_appetite';
    if v_pending_criteria = '{}'::jsonb then
      v_pending := v_pending - 'criteria';
    else
      v_pending := jsonb_set(v_pending, '{criteria}', v_pending_criteria, true);
    end if;
  end if;
  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
  end if;

  update public.investors i
  set criteria = v_criteria, privacy = v_privacy, updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'approved_value', v_value,
    'has_other_pending_changes', v_pending <> '{}'::jsonb
  );
end
$$;

revoke all on function public.admin_approve_investor_appetite(uuid, text) from public;
grant execute on function public.admin_approve_investor_appetite(uuid, text) to authenticated;

create or replace function public.admin_set_investor_cover(
  investor_uuid uuid,
  cover_url text default null,
  cover_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_criteria jsonb;
  v_old_path text;
  v_url text := nullif(btrim(coalesce(cover_url, '')), '');
  v_path text := nullif(btrim(coalesce(cover_path, '')), '');
begin
  if not public.is_admin_user() then raise exception 'admin_required'; end if;
  select * into v_row from public.investors i
  where i.id = investor_uuid for update;
  if not found then raise exception 'investor_not_found'; end if;

  v_criteria := coalesce(v_row.criteria, '{}'::jsonb);
  v_old_path := nullif(v_criteria ->> 'cover_image_path', '');
  if v_url is null then
    v_criteria := v_criteria - 'cover_image_url' - 'cover_image_path';
  else
    v_criteria := jsonb_set(v_criteria, '{cover_image_url}', to_jsonb(v_url), true);
    if v_path is null then
      v_criteria := v_criteria - 'cover_image_path';
    else
      v_criteria := jsonb_set(v_criteria, '{cover_image_path}', to_jsonb(v_path), true);
    end if;
  end if;

  update public.investors i
  set criteria = v_criteria, updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'old_path', v_old_path,
    'cover_image_url', v_url,
    'cover_image_path', v_path
  );
end
$$;

revoke all on function public.admin_set_investor_cover(uuid, text, text) from public;
grant execute on function public.admin_set_investor_cover(uuid, text, text) to authenticated;

commit;
