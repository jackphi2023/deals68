-- Deals68 Investor Profile Contract + UI V2
--
-- Business contract:
--   * Investor criteria/profile fields save immediately.
--   * Only Introduction (desc_vi/desc_en) remains in the text review queue.
--   * Image/file moderation remains owned by the dedicated asset workflow.
--   * Admin can save bilingual investment appetite directly, independently.
--   * Public discovery exposes approved bilingual appetite only.

create or replace function public.update_my_investor_profile(
  profile_patch jsonb default '{}'::jsonb,
  description_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.investors%rowtype;
  v_privacy jsonb;
  v_pending jsonb;
  v_profile_criteria jsonb;
  v_criteria jsonb;
  v_types text[];
  v_stages text[];
  v_industries text[];
  v_deal_types text[];
  v_target_countries text[];
  v_type_input jsonb;
  v_stage_input jsonb;
  v_country_input jsonb;
  v_key text;
  v_value jsonb;
  v_text text;
  v_ticket_min numeric;
  v_ticket_max numeric;
  v_return numeric;
  v_description_pending boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if jsonb_typeof(profile_patch) <> 'object'
     or jsonb_typeof(description_patch) <> 'object' then
    raise exception 'invalid_patch';
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
  v_profile_criteria := case
    when jsonb_typeof(profile_patch -> 'criteria') = 'object'
      then profile_patch -> 'criteria'
    else '{}'::jsonb
  end;
  v_criteria := coalesce(v_row.criteria, '{}'::jsonb);

  v_type_input := case
    when jsonb_typeof(profile_patch -> 'investor_types') = 'array'
      then profile_patch -> 'investor_types'
    when jsonb_typeof(v_profile_criteria -> 'investorTypes') = 'array'
      then v_profile_criteria -> 'investorTypes'
    when profile_patch ? 'type'
      then jsonb_build_array(profile_patch ->> 'type')
    else coalesce(v_criteria -> 'investorTypes', jsonb_build_array(v_row.type))
  end;
  v_types := public.normalize_investor_type_array(v_type_input);
  if cardinality(v_types) = 0 then
    raise exception 'investor_type_required';
  end if;

  v_stage_input := case
    when jsonb_typeof(profile_patch -> 'stages') = 'array'
      then profile_patch -> 'stages'
    when jsonb_typeof(v_profile_criteria -> 'stages') = 'array'
      then v_profile_criteria -> 'stages'
    when profile_patch ? 'stage'
      then jsonb_build_array(profile_patch ->> 'stage')
    else coalesce(v_criteria -> 'stages', jsonb_build_array(v_row.stage))
  end;
  v_stages := public.normalize_investor_stage_array(v_stage_input);
  if cardinality(v_stages) = 0 then
    v_stages := array['Any']::text[];
  end if;

  if profile_patch ? 'industries' then
    select coalesce(array_agg(row_value.value order by row_value.first_ord), array[]::text[])
    into v_industries
    from (
      select public.normalize_investor_industry_key(source.value) as value,
             min(source.ord) as first_ord
      from unnest(public.investor_jsonb_text_array(profile_patch -> 'industries'))
        with ordinality as source(value, ord)
      where public.normalize_investor_industry_key(source.value) is not null
      group by public.normalize_investor_industry_key(source.value)
    ) row_value;
  else
    v_industries := coalesce(v_row.industries, array[]::text[]);
  end if;

  if profile_patch ? 'deal_types' then
    select coalesce(array_agg(row_value.value order by row_value.first_ord), array[]::text[])
    into v_deal_types
    from (
      select public.normalize_investor_deal_type(source.value) as value,
             min(source.ord) as first_ord
      from unnest(public.investor_jsonb_text_array(profile_patch -> 'deal_types'))
        with ordinality as source(value, ord)
      where public.normalize_investor_deal_type(source.value) is not null
      group by public.normalize_investor_deal_type(source.value)
    ) row_value;
  else
    v_deal_types := coalesce(v_row.deal_types, array[]::text[]);
  end if;

  v_country_input := case
    when jsonb_typeof(profile_patch -> 'target_countries') = 'array'
      then profile_patch -> 'target_countries'
    when jsonb_typeof(v_profile_criteria -> 'targetCountries') = 'array'
      then v_profile_criteria -> 'targetCountries'
    when jsonb_typeof(v_profile_criteria -> 'preferredCountries') = 'array'
      then v_profile_criteria -> 'preferredCountries'
    else coalesce(v_criteria -> 'targetCountries', '[]'::jsonb)
  end;
  v_target_countries := public.normalize_investor_country_array(v_country_input);

  v_ticket_min := case
    when profile_patch ? 'ticket_min'
      then nullif(profile_patch ->> 'ticket_min', '')::numeric
    else v_row.ticket_min
  end;
  v_ticket_max := case
    when profile_patch ? 'ticket_max'
      then nullif(profile_patch ->> 'ticket_max', '')::numeric
    else v_row.ticket_max
  end;
  if coalesce(v_ticket_min, 0) > coalesce(v_ticket_max, 0) then
    raise exception 'ticket_min_exceeds_ticket_max';
  end if;

  v_criteria := jsonb_set(v_criteria, '{investorTypes}', to_jsonb(v_types), true);
  v_criteria := jsonb_set(v_criteria, '{stages}', to_jsonb(v_stages), true);
  v_criteria := jsonb_set(v_criteria, '{sectors}', to_jsonb(v_industries), true);
  v_criteria := jsonb_set(v_criteria, '{dealTypes}', to_jsonb(v_deal_types), true);
  v_criteria := jsonb_set(v_criteria, '{targetCountries}', to_jsonb(v_target_countries), true);
  v_criteria := jsonb_set(v_criteria, '{preferredCountries}', to_jsonb(v_target_countries), true);
  v_criteria := jsonb_set(v_criteria, '{targetCountriesCache}', to_jsonb(v_target_countries), true);

  foreach v_key in array array['investment_appetite_vi','investment_appetite_en'] loop
    if v_profile_criteria ? v_key then
      v_text := coalesce(v_profile_criteria ->> v_key, '');
      if char_length(v_text) > 5000 then
        raise exception 'investment_appetite_too_long';
      end if;
      v_criteria := jsonb_set(v_criteria, array[v_key], to_jsonb(v_text), true);
    end if;
  end loop;

  if v_profile_criteria ? 'riskAppetite' then
    v_text := btrim(coalesce(v_profile_criteria ->> 'riskAppetite', ''));
    if v_text not in ('', 'conservative', 'balanced', 'aggressive') then
      raise exception 'invalid_risk_appetite';
    end if;
    v_criteria := jsonb_set(v_criteria, '{riskAppetite}', to_jsonb(v_text), true);
  end if;

  if v_profile_criteria ? 'returnExpectation' then
    v_value := v_profile_criteria -> 'returnExpectation';
    v_text := btrim(coalesce(v_value #>> '{}', ''));
    if jsonb_typeof(v_value) = 'null' or v_text = '' then
      v_criteria := v_criteria - 'returnExpectation';
    else
      if v_text !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'invalid_return_expectation';
      end if;
      v_return := v_text::numeric;
      v_criteria := jsonb_set(v_criteria, '{returnExpectation}', to_jsonb(v_return), true);
    end if;
  end if;

  foreach v_key in array array[
    'revenueRange','revenueBand','ebitdaRange','preferredDealSize'
  ] loop
    if v_profile_criteria ? v_key then
      v_criteria := jsonb_set(v_criteria, array[v_key], v_profile_criteria -> v_key, true);
    end if;
  end loop;

  -- Criteria and public profile fields are immediate. Remove stale copies left
  -- by the previous broad review contract while preserving future asset keys.
  v_pending := v_pending
    - 'type' - 'stage' - 'industries' - 'deal_types'
    - 'country' - 'country_iso2' - 'region'
    - 'ticket_min' - 'ticket_max' - 'criteria';

  if description_patch ? 'desc_vi' then
    v_text := coalesce(description_patch ->> 'desc_vi', '');
    if v_text is distinct from coalesce(v_row.desc_vi, '') then
      v_pending := jsonb_set(v_pending, '{desc_vi}', to_jsonb(v_text), true);
    else
      v_pending := v_pending - 'desc_vi';
    end if;
  end if;
  if description_patch ? 'desc_en' then
    v_text := coalesce(description_patch ->> 'desc_en', '');
    if v_text is distinct from coalesce(v_row.desc_en, '') then
      v_pending := jsonb_set(v_pending, '{desc_en}', to_jsonb(v_text), true);
    else
      v_pending := v_pending - 'desc_en';
    end if;
  end if;

  v_description_pending := (v_pending ? 'desc_vi') or (v_pending ? 'desc_en');
  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
    v_privacy := jsonb_set(v_privacy, '{pending_submitted_at}', to_jsonb(now()::text), true);
  end if;

  update public.investors i
  set type = v_types[1],
      stage = v_stages[1],
      industries = v_industries,
      deal_types = v_deal_types,
      country = case when profile_patch ? 'country'
        then nullif(btrim(profile_patch ->> 'country'), '') else i.country end,
      country_iso2 = case when profile_patch ? 'country_iso2'
        then upper(nullif(btrim(profile_patch ->> 'country_iso2'), '')) else i.country_iso2 end,
      region = case when profile_patch ? 'region'
        then nullif(btrim(profile_patch ->> 'region'), '') else i.region end,
      ticket_min = v_ticket_min,
      ticket_max = v_ticket_max,
      criteria = v_criteria,
      private_name = case when profile_patch ? 'private_name'
        then nullif(btrim(profile_patch ->> 'private_name'), '') else i.private_name end,
      private_website = case when profile_patch ? 'private_website'
        then nullif(btrim(profile_patch ->> 'private_website'), '') else i.private_website end,
      privacy = v_privacy,
      updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'saved_immediately', true,
    'description_pending', v_description_pending,
    'criteria_pending', false,
    'profile_pending', false,
    'has_other_pending_changes', v_pending <> '{}'::jsonb,
    'pending_submitted_at', case when v_pending = '{}'::jsonb then null else now() end
  );
end;
$$;

create or replace function public.admin_update_investor_profile(
  investor_uuid uuid,
  admin_patch jsonb default '{}'::jsonb,
  approve_introduction boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.investors%rowtype;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_admin_criteria jsonb;
  v_criteria jsonb;
  v_types text[];
  v_stages text[];
  v_industries text[];
  v_deal_types text[];
  v_target_countries text[];
  v_type_json jsonb;
  v_stage_json jsonb;
  v_industry_json jsonb;
  v_deal_json jsonb;
  v_country_json jsonb;
  v_status public.account_status;
  v_ticket_min numeric;
  v_ticket_max numeric;
  v_return numeric;
  v_text text;
  v_key text;
begin
  if not public.is_admin_user() then
    raise exception 'admin_required';
  end if;
  if jsonb_typeof(admin_patch) <> 'object' then
    raise exception 'invalid_admin_patch';
  end if;

  select * into v_row
  from public.investors i
  where i.id = investor_uuid
  for update;
  if not found then
    raise exception 'investor_not_found';
  end if;

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  v_pending := case when jsonb_typeof(v_privacy -> 'pending_profile_changes') = 'object'
    then v_privacy -> 'pending_profile_changes' else '{}'::jsonb end;
  v_pending_criteria := case when jsonb_typeof(v_pending -> 'criteria') = 'object'
    then v_pending -> 'criteria' else '{}'::jsonb end;
  v_admin_criteria := case when jsonb_typeof(admin_patch -> 'criteria') = 'object'
    then admin_patch -> 'criteria' else '{}'::jsonb end;
  v_criteria := coalesce(v_row.criteria, '{}'::jsonb) || v_pending_criteria || v_admin_criteria;

  v_type_json := coalesce(
    v_admin_criteria -> 'investorTypes',
    admin_patch -> 'investor_types',
    v_pending_criteria -> 'investorTypes',
    v_row.criteria -> 'investorTypes',
    jsonb_build_array(v_row.type)
  );
  v_types := public.normalize_investor_type_array(v_type_json);
  if cardinality(v_types) = 0 then raise exception 'investor_type_required'; end if;

  v_stage_json := coalesce(
    v_admin_criteria -> 'stages',
    admin_patch -> 'stages',
    v_pending_criteria -> 'stages',
    v_row.criteria -> 'stages',
    jsonb_build_array(coalesce(v_row.stage, 'Any'))
  );
  v_stages := public.normalize_investor_stage_array(v_stage_json);
  if cardinality(v_stages) = 0 then v_stages := array['Any']::text[]; end if;

  v_industry_json := coalesce(
    admin_patch -> 'industries', v_pending -> 'industries',
    v_pending_criteria -> 'sectors', to_jsonb(coalesce(v_row.industries, array[]::text[]))
  );
  select coalesce(array_agg(row_value.value order by row_value.first_ord), array[]::text[])
  into v_industries
  from (
    select public.normalize_investor_industry_key(source.value) as value,
           min(source.ord) as first_ord
    from unnest(public.investor_jsonb_text_array(v_industry_json))
      with ordinality as source(value, ord)
    where public.normalize_investor_industry_key(source.value) is not null
    group by public.normalize_investor_industry_key(source.value)
  ) row_value;

  v_deal_json := coalesce(
    admin_patch -> 'deal_types', v_pending -> 'deal_types',
    v_pending_criteria -> 'dealTypes', to_jsonb(coalesce(v_row.deal_types, array[]::text[]))
  );
  select coalesce(array_agg(row_value.value order by row_value.first_ord), array[]::text[])
  into v_deal_types
  from (
    select public.normalize_investor_deal_type(source.value) as value,
           min(source.ord) as first_ord
    from unnest(public.investor_jsonb_text_array(v_deal_json))
      with ordinality as source(value, ord)
    where public.normalize_investor_deal_type(source.value) is not null
    group by public.normalize_investor_deal_type(source.value)
  ) row_value;

  v_country_json := coalesce(
    v_admin_criteria -> 'targetCountries', admin_patch -> 'target_countries',
    v_pending_criteria -> 'targetCountries', v_criteria -> 'targetCountries', '[]'::jsonb
  );
  v_target_countries := public.normalize_investor_country_array(v_country_json);

  v_criteria := jsonb_set(v_criteria, '{investorTypes}', to_jsonb(v_types), true);
  v_criteria := jsonb_set(v_criteria, '{stages}', to_jsonb(v_stages), true);
  v_criteria := jsonb_set(v_criteria, '{sectors}', to_jsonb(v_industries), true);
  v_criteria := jsonb_set(v_criteria, '{dealTypes}', to_jsonb(v_deal_types), true);
  v_criteria := jsonb_set(v_criteria, '{targetCountries}', to_jsonb(v_target_countries), true);
  v_criteria := jsonb_set(v_criteria, '{preferredCountries}', to_jsonb(v_target_countries), true);
  v_criteria := jsonb_set(v_criteria, '{targetCountriesCache}', to_jsonb(v_target_countries), true);

  foreach v_key in array array['investment_appetite_vi','investment_appetite_en'] loop
    if v_criteria ? v_key
       and char_length(coalesce(v_criteria ->> v_key, '')) > 5000 then
      raise exception 'investment_appetite_too_long';
    end if;
  end loop;

  if v_criteria ? 'riskAppetite' then
    v_text := btrim(coalesce(v_criteria ->> 'riskAppetite', ''));
    if v_text not in ('', 'conservative', 'balanced', 'aggressive') then
      raise exception 'invalid_risk_appetite';
    end if;
  end if;

  if v_criteria ? 'returnExpectation'
     and jsonb_typeof(v_criteria -> 'returnExpectation') <> 'null' then
    v_text := btrim(coalesce(v_criteria ->> 'returnExpectation', ''));
    if v_text <> '' then
      if v_text !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'invalid_return_expectation';
      end if;
      v_return := v_text::numeric;
      if v_return < 0 then raise exception 'invalid_return_expectation'; end if;
    end if;
  end if;

  v_ticket_min := case when admin_patch ? 'ticket_min'
    then nullif(admin_patch ->> 'ticket_min', '')::numeric else v_row.ticket_min end;
  v_ticket_max := case when admin_patch ? 'ticket_max'
    then nullif(admin_patch ->> 'ticket_max', '')::numeric else v_row.ticket_max end;
  if coalesce(v_ticket_min, 0) > coalesce(v_ticket_max, 0) then
    raise exception 'ticket_min_exceeds_ticket_max';
  end if;

  v_pending := v_pending
    - 'type' - 'stage' - 'industries' - 'deal_types'
    - 'country' - 'country_iso2' - 'region'
    - 'ticket_min' - 'ticket_max' - 'criteria';
  if approve_introduction then
    v_pending := v_pending - 'desc_vi' - 'desc_en';
  end if;
  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
  end if;

  v_status := case
    when admin_patch ? 'status' then (admin_patch ->> 'status')::public.account_status
    else v_row.status
  end;

  update public.investors i
  set type = v_types[1],
      stage = v_stages[1],
      industries = v_industries,
      deal_types = v_deal_types,
      country = coalesce(nullif(admin_patch ->> 'country', ''), v_pending ->> 'country', i.country),
      country_iso2 = upper(coalesce(nullif(admin_patch ->> 'country_iso2', ''), v_pending ->> 'country_iso2', i.country_iso2)),
      region = coalesce(nullif(admin_patch ->> 'region', ''), v_pending ->> 'region', i.region),
      ticket_min = v_ticket_min,
      ticket_max = v_ticket_max,
      title_vi = coalesce(nullif(admin_patch ->> 'title_vi', ''), i.title_vi),
      title_en = coalesce(nullif(admin_patch ->> 'title_en', ''), i.title_en),
      desc_vi = case when approve_introduction
        then coalesce(admin_patch ->> 'desc_vi', v_row.desc_vi) else i.desc_vi end,
      desc_en = case when approve_introduction
        then coalesce(admin_patch ->> 'desc_en', v_row.desc_en) else i.desc_en end,
      private_name = case when admin_patch ? 'private_name'
        then nullif(btrim(admin_patch ->> 'private_name'), '') else i.private_name end,
      private_email = case when admin_patch ? 'private_email'
        then nullif(btrim(admin_patch ->> 'private_email'), '') else i.private_email end,
      private_phone = case when admin_patch ? 'private_phone'
        then nullif(btrim(admin_patch ->> 'private_phone'), '') else i.private_phone end,
      private_website = case when admin_patch ? 'private_website'
        then nullif(btrim(admin_patch ->> 'private_website'), '') else i.private_website end,
      criteria = v_criteria,
      privacy = v_privacy,
      verified = case when admin_patch ? 'verified'
        then (admin_patch ->> 'verified')::boolean else i.verified end,
      admin_priority = case when admin_patch ? 'admin_priority'
        then (admin_patch ->> 'admin_priority')::boolean else i.admin_priority end,
      visible = case when admin_patch ? 'visible'
        then (admin_patch ->> 'visible')::boolean else i.visible end,
      status = v_status,
      updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'saved', true,
    'introduction_approved', approve_introduction,
    'investment_appetite_vi', v_criteria ->> 'investment_appetite_vi',
    'investment_appetite_en', v_criteria ->> 'investment_appetite_en',
    'visible', case when admin_patch ? 'visible'
      then (admin_patch ->> 'visible')::boolean else v_row.visible end
  );
end;
$$;

-- Compatibility wrapper for older Admin clients. New UI calls
-- admin_update_investor_profile directly and chooses whether to approve intro.
create or replace function public.admin_approve_investor_profile_changes(
  investor_uuid uuid,
  admin_patch jsonb default '{}'::jsonb,
  publish_profile boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patch jsonb := coalesce(admin_patch, '{}'::jsonb);
begin
  if publish_profile then
    v_patch := v_patch || jsonb_build_object('visible', true, 'status', 'active');
  end if;
  return public.admin_update_investor_profile(investor_uuid, v_patch, true);
end;
$$;

create or replace view public.public_investors_safe
with (security_barrier = true, security_invoker = true)
as
select
  id,
  code,
  type,
  title_vi,
  title_en,
  desc_vi,
  desc_en,
  country_iso2,
  country,
  region,
  coalesce(industries, array[]::text[]) as industries,
  coalesce(deal_types, array[]::text[]) as deal_types,
  stage,
  ticket_min,
  ticket_max,
  jsonb_strip_nulls(jsonb_build_object(
    'investorTypes', coalesce(
      criteria -> 'investorTypes',
      to_jsonb(case when type is null then array[]::text[] else array[type]::text[] end)
    ),
    'stages', coalesce(
      criteria -> 'stages',
      to_jsonb(case when stage is null then array[]::text[] else array[stage]::text[] end)
    ),
    'sectors', coalesce(criteria -> 'sectors', to_jsonb(coalesce(industries, array[]::text[]))),
    'dealTypes', coalesce(criteria -> 'dealTypes', to_jsonb(coalesce(deal_types, array[]::text[]))),
    'targetRegions', criteria -> 'targetRegions',
    'targetCountries', coalesce(criteria -> 'targetCountries', criteria -> 'targetCountriesCache', criteria -> 'preferredCountries'),
    'preferredCountries', coalesce(criteria -> 'preferredCountries', criteria -> 'targetCountries'),
    'targetGeographies', coalesce(criteria -> 'targetGeographies', criteria -> 'preferredGeographies'),
    'investment_appetite_vi', criteria -> 'investment_appetite_vi',
    'investment_appetite_en', criteria -> 'investment_appetite_en',
    'riskAppetite', criteria -> 'riskAppetite',
    'returnExpectation', criteria -> 'returnExpectation',
    'revenueRange', coalesce(criteria -> 'revenueRange', criteria -> 'revenueBand'),
    'revenueBand', coalesce(criteria -> 'revenueBand', criteria -> 'revenueRange'),
    'ebitdaRange', criteria -> 'ebitdaRange',
    'preferredDealSize', criteria -> 'preferredDealSize',
    'proposal_history', criteria -> 'proposal_history',
    'cover_image_url', criteria -> 'cover_image_url'
  )) as criteria,
  true as visible,
  coalesce(verified, false) as verified,
  coalesce(admin_priority, false) as admin_priority,
  activity_level,
  'active'::public.account_status as status,
  created_at,
  updated_at
from public.investors i
where visible = true
  and status = 'active'::public.account_status;

grant select on public.public_investors_safe to anon, authenticated;

revoke all on function public.update_my_investor_profile(jsonb, jsonb) from public, anon;
revoke all on function public.admin_update_investor_profile(uuid, jsonb, boolean) from public, anon;
revoke all on function public.admin_approve_investor_profile_changes(uuid, jsonb, boolean) from public, anon;
grant execute on function public.update_my_investor_profile(jsonb, jsonb) to authenticated;
grant execute on function public.admin_update_investor_profile(uuid, jsonb, boolean) to authenticated;
grant execute on function public.admin_approve_investor_profile_changes(uuid, jsonb, boolean) to authenticated;

comment on function public.update_my_investor_profile(jsonb, jsonb) is
'Investor criteria save immediately; only bilingual Introduction text is staged for Admin review.';

comment on function public.admin_update_investor_profile(uuid, jsonb, boolean) is
'Admin saves approved Investor profile/criteria directly and optionally approves pending Introduction text.';
