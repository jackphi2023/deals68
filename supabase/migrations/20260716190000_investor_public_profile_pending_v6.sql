begin;

create or replace function public.update_my_investor_profile(
  profile_patch jsonb default '{}'::jsonb,
  description_patch jsonb default '{}'::jsonb
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
  v_approved_criteria jsonb;
  v_profile_criteria jsonb;
  v_industries text[];
  v_deal_types text[];
  v_key text;
  v_value jsonb;
  v_approved jsonb;
  v_text text;
  v_ticket numeric;
  v_description_pending boolean := false;
  v_profile_pending boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if profile_patch ?| array[
    'owner_id','code','title_vi','title_en','desc_vi','desc_en','visible',
    'verified','admin_priority','activity_level','status','privacy'
  ] then
    raise exception 'protected_field';
  end if;

  select * into v_row
  from public.investors i
  where i.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'investor_not_found';
  end if;

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  v_pending := case
    when jsonb_typeof(v_privacy -> 'pending_profile_changes') = 'object'
      then v_privacy -> 'pending_profile_changes'
    else '{}'::jsonb
  end;
  v_pending_criteria := case
    when jsonb_typeof(v_pending -> 'criteria') = 'object'
      then v_pending -> 'criteria'
    else '{}'::jsonb
  end;
  v_approved_criteria := coalesce(v_row.criteria, '{}'::jsonb);

  if profile_patch ? 'industries' then
    select coalesce(array_agg(x.key order by x.first_ord), '{}'::text[])
    into v_industries
    from (
      select public.normalize_investor_industry_key(value) as key,
             min(ord) as first_ord
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(profile_patch->'industries') = 'array'
            then profile_patch->'industries'
          else '[]'::jsonb
        end
      ) with ordinality as e(value, ord)
      where public.normalize_investor_industry_key(value) is not null
      group by public.normalize_investor_industry_key(value)
    ) x;
  else
    v_industries := coalesce(v_row.industries, '{}'::text[]);
  end if;

  if profile_patch ? 'deal_types' then
    select coalesce(array_agg(x.value order by x.first_ord), '{}'::text[])
    into v_deal_types
    from (
      select public.normalize_investor_deal_type(value) as value,
             min(ord) as first_ord
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(profile_patch->'deal_types') = 'array'
            then profile_patch->'deal_types'
          else '[]'::jsonb
        end
      ) with ordinality as e(value, ord)
      where public.normalize_investor_deal_type(value) is not null
      group by public.normalize_investor_deal_type(value)
    ) x;
  else
    v_deal_types := coalesce(v_row.deal_types, '{}'::text[]);
  end if;

  -- Public scalar fields are staged and compared with the approved row.
  foreach v_key in array array['type','country','country_iso2','region','stage'] loop
    if profile_patch ? v_key then
      v_text := btrim(coalesce(profile_patch->>v_key, ''));
      if v_key = 'country_iso2' then v_text := upper(v_text); end if;
      if v_text is distinct from coalesce(to_jsonb(v_row)->>v_key, '') then
        v_pending := jsonb_set(v_pending, array[v_key], to_jsonb(v_text), true);
      else
        v_pending := v_pending - v_key;
      end if;
    end if;
  end loop;

  if profile_patch ? 'industries' then
    if to_jsonb(v_industries) is distinct from to_jsonb(coalesce(v_row.industries, '{}'::text[])) then
      v_pending := jsonb_set(v_pending, '{industries}', to_jsonb(v_industries), true);
    else
      v_pending := v_pending - 'industries';
    end if;
  end if;

  if profile_patch ? 'deal_types' then
    if to_jsonb(v_deal_types) is distinct from to_jsonb(coalesce(v_row.deal_types, '{}'::text[])) then
      v_pending := jsonb_set(v_pending, '{deal_types}', to_jsonb(v_deal_types), true);
    else
      v_pending := v_pending - 'deal_types';
    end if;
  end if;

  foreach v_key in array array['ticket_min','ticket_max'] loop
    if profile_patch ? v_key then
      if coalesce(profile_patch->>v_key, '') !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'invalid_%', v_key;
      end if;
      v_ticket := (profile_patch->>v_key)::numeric;
      if v_ticket is distinct from (to_jsonb(v_row)->>v_key)::numeric then
        v_pending := jsonb_set(v_pending, array[v_key], to_jsonb(v_ticket), true);
      else
        v_pending := v_pending - v_key;
      end if;
    end if;
  end loop;

  if (profile_patch ? 'ticket_min' or profile_patch ? 'ticket_max') then
    if coalesce((v_pending->>'ticket_min')::numeric, v_row.ticket_min, 0) >
       coalesce((v_pending->>'ticket_max')::numeric, v_row.ticket_max, 0) then
      raise exception 'ticket_min_exceeds_ticket_max';
    end if;
  end if;

  -- Only approved profile taxonomy keys are accepted here. Appetite fields keep
  -- their dedicated submit/approve workflow and are never overwritten.
  v_profile_criteria := case
    when jsonb_typeof(profile_patch->'criteria') = 'object'
      then profile_patch->'criteria'
    else '{}'::jsonb
  end;
  v_profile_criteria := jsonb_set(v_profile_criteria, '{sectors}', to_jsonb(v_industries), true);
  v_profile_criteria := jsonb_set(v_profile_criteria, '{dealTypes}', to_jsonb(v_deal_types), true);

  foreach v_key in array array[
    'investorTypes','stages','targetRegions','targetCountries',
    'preferredCountries','targetCountriesCache','sectors','dealTypes'
  ] loop
    if v_profile_criteria ? v_key then
      v_value := v_profile_criteria -> v_key;
      v_approved := v_approved_criteria -> v_key;
      if v_value is distinct from v_approved then
        v_pending_criteria := jsonb_set(v_pending_criteria, array[v_key], v_value, true);
      else
        v_pending_criteria := v_pending_criteria - v_key;
      end if;
    end if;
  end loop;

  if description_patch ? 'desc_vi' then
    v_text := coalesce(description_patch->>'desc_vi', '');
    if v_text is distinct from coalesce(v_row.desc_vi, '') then
      v_pending := jsonb_set(v_pending, '{desc_vi}', to_jsonb(v_text), true);
    else
      v_pending := v_pending - 'desc_vi';
    end if;
  end if;
  if description_patch ? 'desc_en' then
    v_text := coalesce(description_patch->>'desc_en', '');
    if v_text is distinct from coalesce(v_row.desc_en, '') then
      v_pending := jsonb_set(v_pending, '{desc_en}', to_jsonb(v_text), true);
    else
      v_pending := v_pending - 'desc_en';
    end if;
  end if;

  if v_pending_criteria = '{}'::jsonb then
    v_pending := v_pending - 'criteria';
  else
    v_pending := jsonb_set(v_pending, '{criteria}', v_pending_criteria, true);
  end if;

  v_description_pending := (v_pending ? 'desc_vi') or (v_pending ? 'desc_en');
  v_profile_pending := exists (
    select 1
    from jsonb_object_keys(v_pending) as k(key)
    where k.key <> 'criteria'
  ) or exists (
    select 1
    from jsonb_object_keys(coalesce(v_pending->'criteria', '{}'::jsonb)) as k(key)
    where k.key not in ('investment_appetite','riskAppetite','returnExpectation','revenueRange')
  );

  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
    v_privacy := jsonb_set(v_privacy, '{pending_submitted_at}', to_jsonb(now()::text), true);
  end if;

  -- Internal fields remain editable immediately.
  update public.investors i
  set
    private_name = case
      when profile_patch ? 'private_name'
        then nullif(btrim(profile_patch->>'private_name'), '')
      else i.private_name
    end,
    private_website = case
      when profile_patch ? 'private_website'
        then nullif(btrim(profile_patch->>'private_website'), '')
      else i.private_website
    end,
    privacy = v_privacy,
    updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'description_pending', v_description_pending,
    'profile_pending', v_profile_pending,
    'has_other_pending_changes', v_pending <> '{}'::jsonb,
    'pending_submitted_at', case when v_pending = '{}'::jsonb then null else now() end
  );
end
$$;

revoke all on function public.update_my_investor_profile(jsonb, jsonb) from public;
grant execute on function public.update_my_investor_profile(jsonb, jsonb) to authenticated;

commit;
