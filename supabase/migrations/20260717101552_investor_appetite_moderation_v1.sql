-- Deals68 Investor Appetite Moderation V1
--
-- Contract:
--   * Introduction and bilingual Investment appetite wait for Admin review.
--   * Investor type, stage, industries, deal types, target markets, ticket,
--     risk appetite, return expectation and revenue band still save directly.
--   * Approved criteria remain public until Admin saves the pending appetite.
--   * No rows or test data are created by this migration.

create or replace function public.update_my_investor_profile(
  profile_patch jsonb default '{}'::jsonb,
  description_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.investors%rowtype;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
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
  v_appetite_pending boolean := false;
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
  v_pending_criteria := case
    when jsonb_typeof(v_pending -> 'criteria') = 'object'
      then v_pending -> 'criteria'
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

  -- Older broad-review clients may have staged fields that are immediate now.
  -- Keep only the bilingual appetite keys inside the criteria review queue.
  v_pending_criteria := v_pending_criteria
    - 'investorTypes' - 'stages' - 'sectors' - 'dealTypes'
    - 'targetCountries' - 'preferredCountries' - 'targetCountriesCache'
    - 'riskAppetite' - 'returnExpectation' - 'revenueRange'
    - 'revenueBand' - 'ebitdaRange' - 'preferredDealSize';

  foreach v_key in array array['investment_appetite_vi','investment_appetite_en'] loop
    if v_profile_criteria ? v_key then
      v_text := coalesce(v_profile_criteria ->> v_key, '');
      if char_length(v_text) > 5000 then
        raise exception 'investment_appetite_too_long';
      end if;
      if v_text is distinct from coalesce(v_row.criteria ->> v_key, '') then
        v_pending_criteria := jsonb_set(
          v_pending_criteria,
          array[v_key],
          to_jsonb(v_text),
          true
        );
      else
        v_pending_criteria := v_pending_criteria - v_key;
      end if;
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

  -- Profile criteria above are immediate. Introduction and Investment appetite
  -- remain pending; future asset keys are preserved for their own workflow.
  v_pending := v_pending
    - 'type' - 'stage' - 'industries' - 'deal_types'
    - 'country' - 'country_iso2' - 'region'
    - 'ticket_min' - 'ticket_max';

  if v_pending_criteria = '{}'::jsonb then
    v_pending := v_pending - 'criteria';
  else
    v_pending := jsonb_set(v_pending, '{criteria}', v_pending_criteria, true);
  end if;

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
  v_appetite_pending := jsonb_typeof(v_pending -> 'criteria') = 'object'
    and (
      (v_pending -> 'criteria' ? 'investment_appetite_vi')
      or (v_pending -> 'criteria' ? 'investment_appetite_en')
    );

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
    'criteria_pending', v_appetite_pending,
    'investment_appetite_pending', v_appetite_pending,
    'profile_pending', v_pending <> '{}'::jsonb,
    'has_other_pending_changes', v_pending <> '{}'::jsonb,
    'pending_submitted_at', case when v_pending = '{}'::jsonb then null else now() end
  );
end;
$$;

revoke all on function public.update_my_investor_profile(jsonb, jsonb)
from public, anon;

grant execute on function public.update_my_investor_profile(jsonb, jsonb)
to authenticated;

comment on function public.update_my_investor_profile(jsonb, jsonb) is
'Investor profile criteria save immediately except bilingual Investment appetite; Introduction and Investment appetite are staged for Admin review.';
