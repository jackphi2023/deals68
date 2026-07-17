-- Investor Criteria Review V1
-- Canonical multi-select criteria + admin moderation + INV-XXXXXX guard.
-- This migration is intentionally compatible with the existing investors table.

begin;

create or replace function public.investor_jsonb_text_array(input_value jsonb)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(item.value order by item.ord), array[]::text[])
  from (
    select btrim(value) as value, ord
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(input_value) = 'array' then input_value
        else '[]'::jsonb
      end
    ) with ordinality as source(value, ord)
    where btrim(value) <> ''
  ) item;
$$;

create or replace function public.normalize_investor_type(raw_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when lower(btrim(coalesce(raw_value, ''))) in ('vc', 'venture capital', 'quỹ đầu tư mạo hiểm') then 'VC'
    when lower(btrim(coalesce(raw_value, ''))) in ('pe', 'private equity', 'quỹ đầu tư tư nhân') then 'PE'
    when lower(btrim(coalesce(raw_value, ''))) in ('institutional', 'institutional investor', 'nhà đầu tư tổ chức') then 'Institutional'
    when lower(btrim(coalesce(raw_value, ''))) in ('corporate/strategic', 'corporate / strategic', 'corporate', 'strategic', 'doanh nghiệp chiến lược', 'nhà đầu tư chiến lược') then 'Corporate/Strategic'
    when lower(btrim(coalesce(raw_value, ''))) in ('family office', 'văn phòng gia đình') then 'Family Office'
    when lower(btrim(coalesce(raw_value, ''))) in ('lender/debt', 'lender / debt', 'lender', 'debt', 'bên cho vay / tín dụng', 'tổ chức cho vay / nợ') then 'Lender/Debt'
    when lower(btrim(coalesce(raw_value, ''))) in ('individual/angel', 'individual / angel', 'individual', 'angel', 'nhà đầu tư cá nhân') then 'Individual/Angel'
    else null
  end;
$$;

create or replace function public.normalize_investor_stage(raw_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when lower(btrim(coalesce(raw_value, ''))) in ('seed', 'early stage', 'early-stage', 'early_stage', 'seed / early stage', 'dn nhỏ/startup') then 'Seed'
    when lower(btrim(coalesce(raw_value, ''))) = 'series a' then 'Series A'
    when lower(btrim(coalesce(raw_value, ''))) in ('growth', 'growth stage', 'tăng trưởng') then 'Growth'
    when lower(btrim(coalesce(raw_value, ''))) in ('mature', 'mature stage', 'ổn định / trưởng thành') then 'Mature'
    when lower(btrim(coalesce(raw_value, ''))) in ('buyout', 'mua lại / buyout') then 'Buyout'
    when lower(btrim(coalesce(raw_value, ''))) in ('any', 'all', 'flexible', 'linh hoạt') then 'Any'
    else null
  end;
$$;

create or replace function public.normalize_investor_type_array(input_value jsonb)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(row_value.value order by row_value.first_ord), array[]::text[])
  from (
    select public.normalize_investor_type(source.value) as value,
           min(source.ord) as first_ord
    from unnest(public.investor_jsonb_text_array(input_value))
      with ordinality as source(value, ord)
    where public.normalize_investor_type(source.value) is not null
    group by public.normalize_investor_type(source.value)
  ) row_value;
$$;

create or replace function public.normalize_investor_stage_array(input_value jsonb)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(row_value.value order by row_value.first_ord), array[]::text[])
  from (
    select public.normalize_investor_stage(source.value) as value,
           min(source.ord) as first_ord
    from unnest(public.investor_jsonb_text_array(input_value))
      with ordinality as source(value, ord)
    where public.normalize_investor_stage(source.value) is not null
    group by public.normalize_investor_stage(source.value)
  ) row_value;
$$;

create or replace function public.normalize_investor_country_array(input_value jsonb)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(row_value.value order by row_value.first_ord), array[]::text[])
  from (
    select upper(btrim(source.value)) as value,
           min(source.ord) as first_ord
    from unnest(public.investor_jsonb_text_array(input_value))
      with ordinality as source(value, ord)
    where upper(btrim(source.value)) ~ '^[A-Z]{2}$'
    group by upper(btrim(source.value))
  ) row_value;
$$;

create or replace function public.generate_investor_public_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  candidate text;
  attempt integer;
begin
  -- Serialize generators so concurrent inserts cannot select the same code.
  perform pg_advisory_xact_lock(hashtext('deals68.investor_public_code')::bigint);

  for attempt in 1..200 loop
    candidate := 'INV-' || lpad((floor(random() * 1000000)::integer)::text, 6, '0');
    exit when not exists (
      select 1 from public.investors i where i.code = candidate
    );
    candidate := null;
  end loop;

  if candidate is null then
    raise exception 'investor_code_generation_failed';
  end if;

  return candidate;
end;
$$;

create or replace function public.ensure_investor_public_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.code is null
     or btrim(new.code) = ''
     or new.code ilike 'INV-NEW-%' then
    new.code := public.generate_investor_public_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_investor_public_code on public.investors;
create trigger trg_ensure_investor_public_code
before insert or update of code on public.investors
for each row execute function public.ensure_investor_public_code();

-- Only replace temporary placeholders. Existing public legacy codes remain stable.
update public.investors
set code = public.generate_investor_public_code()
where code is null
   or btrim(code) = ''
   or code ilike 'INV-NEW-%';

-- Add canonical arrays without deleting legacy criteria keys.
update public.investors i
set criteria = jsonb_build_object(
  'investorTypes', to_jsonb(
    case
      when public.normalize_investor_type(i.type) is null then array[]::text[]
      else array[public.normalize_investor_type(i.type)]
    end
  ),
  'stages', to_jsonb(
    case
      when public.normalize_investor_stage(i.stage) is null then array[]::text[]
      else array[public.normalize_investor_stage(i.stage)]
    end
  ),
  'sectors', to_jsonb(coalesce(i.industries, array[]::text[])),
  'dealTypes', to_jsonb(coalesce(i.deal_types, array[]::text[]))
) || case
  when jsonb_typeof(i.criteria) = 'object' then i.criteria
  else '{}'::jsonb
end
where not (coalesce(i.criteria, '{}'::jsonb) ? 'investorTypes')
   or not (coalesce(i.criteria, '{}'::jsonb) ? 'stages')
   or not (coalesce(i.criteria, '{}'::jsonb) ? 'sectors')
   or not (coalesce(i.criteria, '{}'::jsonb) ? 'dealTypes');

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
  v_pending_criteria jsonb;
  v_profile_criteria jsonb;
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
  v_has_pending boolean;
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

  v_type_input := case
    when jsonb_typeof(profile_patch -> 'investor_types') = 'array'
      then profile_patch -> 'investor_types'
    when jsonb_typeof(v_profile_criteria -> 'investorTypes') = 'array'
      then v_profile_criteria -> 'investorTypes'
    when profile_patch ? 'type'
      then jsonb_build_array(profile_patch ->> 'type')
    else coalesce(v_row.criteria -> 'investorTypes', jsonb_build_array(v_row.type))
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
    else coalesce(v_row.criteria -> 'stages', jsonb_build_array(v_row.stage))
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
    else coalesce(v_row.criteria -> 'targetCountries', '[]'::jsonb)
  end;
  v_target_countries := public.normalize_investor_country_array(v_country_input);

  v_pending := jsonb_set(v_pending, '{type}', to_jsonb(v_types[1]), true);
  v_pending := jsonb_set(v_pending, '{stage}', to_jsonb(v_stages[1]), true);
  v_pending := jsonb_set(v_pending, '{industries}', to_jsonb(v_industries), true);
  v_pending := jsonb_set(v_pending, '{deal_types}', to_jsonb(v_deal_types), true);

  foreach v_key in array array['country','country_iso2','region'] loop
    if profile_patch ? v_key then
      v_text := btrim(coalesce(profile_patch ->> v_key, ''));
      if v_key = 'country_iso2' then v_text := upper(v_text); end if;
      v_pending := jsonb_set(v_pending, array[v_key], to_jsonb(v_text), true);
    end if;
  end loop;

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

  if profile_patch ? 'ticket_min' then
    v_pending := jsonb_set(v_pending, '{ticket_min}', to_jsonb(coalesce(v_ticket_min, 0)), true);
  end if;
  if profile_patch ? 'ticket_max' then
    v_pending := jsonb_set(v_pending, '{ticket_max}', to_jsonb(coalesce(v_ticket_max, 0)), true);
  end if;

  v_pending_criteria := jsonb_set(v_pending_criteria, '{investorTypes}', to_jsonb(v_types), true);
  v_pending_criteria := jsonb_set(v_pending_criteria, '{stages}', to_jsonb(v_stages), true);
  v_pending_criteria := jsonb_set(v_pending_criteria, '{sectors}', to_jsonb(v_industries), true);
  v_pending_criteria := jsonb_set(v_pending_criteria, '{dealTypes}', to_jsonb(v_deal_types), true);
  v_pending_criteria := jsonb_set(v_pending_criteria, '{targetCountries}', to_jsonb(v_target_countries), true);
  v_pending_criteria := jsonb_set(v_pending_criteria, '{preferredCountries}', to_jsonb(v_target_countries), true);
  v_pending_criteria := jsonb_set(v_pending_criteria, '{targetCountriesCache}', to_jsonb(v_target_countries), true);

  foreach v_key in array array[
    'investment_appetite_vi','investment_appetite_en','investment_appetite',
    'riskAppetite','returnExpectation','revenueRange','revenueBand',
    'ebitdaRange','preferredDealSize'
  ] loop
    if v_profile_criteria ? v_key then
      v_value := v_profile_criteria -> v_key;
      if v_key like 'investment_appetite%' and char_length(coalesce(v_value #>> '{}', '')) > 5000 then
        raise exception 'investment_appetite_too_long';
      end if;
      v_pending_criteria := jsonb_set(v_pending_criteria, array[v_key], v_value, true);
    end if;
  end loop;

  if description_patch ? 'desc_vi' then
    v_pending := jsonb_set(
      v_pending,
      '{desc_vi}',
      to_jsonb(coalesce(description_patch ->> 'desc_vi', '')),
      true
    );
  end if;
  if description_patch ? 'desc_en' then
    v_pending := jsonb_set(
      v_pending,
      '{desc_en}',
      to_jsonb(coalesce(description_patch ->> 'desc_en', '')),
      true
    );
  end if;

  v_pending := jsonb_set(v_pending, '{criteria}', v_pending_criteria, true);
  v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
  v_privacy := jsonb_set(v_privacy, '{pending_submitted_at}', to_jsonb(now()::text), true);

  update public.investors i
  set private_name = case
        when profile_patch ? 'private_name'
          then nullif(btrim(profile_patch ->> 'private_name'), '')
        else i.private_name
      end,
      private_website = case
        when profile_patch ? 'private_website'
          then nullif(btrim(profile_patch ->> 'private_website'), '')
        else i.private_website
      end,
      privacy = v_privacy,
      updated_at = now()
  where i.id = v_row.id;

  v_has_pending := v_pending <> '{}'::jsonb;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'description_pending', (v_pending ? 'desc_vi') or (v_pending ? 'desc_en'),
    'criteria_pending', jsonb_typeof(v_pending -> 'criteria') = 'object',
    'profile_pending', v_has_pending,
    'has_other_pending_changes', v_has_pending,
    'pending_submitted_at', now()
  );
end;
$$;

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
  v_admin_criteria := case
    when jsonb_typeof(admin_patch -> 'criteria') = 'object'
      then admin_patch -> 'criteria'
    else '{}'::jsonb
  end;
  v_criteria := coalesce(v_row.criteria, '{}'::jsonb) || v_pending_criteria || v_admin_criteria;

  v_type_json := coalesce(
    v_admin_criteria -> 'investorTypes',
    admin_patch -> 'investor_types',
    v_pending_criteria -> 'investorTypes',
    jsonb_build_array(coalesce(admin_patch ->> 'type', v_pending ->> 'type', v_row.type))
  );
  v_types := public.normalize_investor_type_array(v_type_json);
  if cardinality(v_types) = 0 then
    v_types := array['Individual/Angel']::text[];
  end if;

  v_stage_json := coalesce(
    v_admin_criteria -> 'stages',
    admin_patch -> 'stages',
    v_pending_criteria -> 'stages',
    jsonb_build_array(coalesce(admin_patch ->> 'stage', v_pending ->> 'stage', v_row.stage, 'Any'))
  );
  v_stages := public.normalize_investor_stage_array(v_stage_json);
  if cardinality(v_stages) = 0 then
    v_stages := array['Any']::text[];
  end if;

  v_industry_json := coalesce(
    admin_patch -> 'industries',
    v_pending -> 'industries',
    v_pending_criteria -> 'sectors',
    to_jsonb(coalesce(v_row.industries, array[]::text[]))
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
    admin_patch -> 'deal_types',
    v_pending -> 'deal_types',
    v_pending_criteria -> 'dealTypes',
    to_jsonb(coalesce(v_row.deal_types, array[]::text[]))
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
    v_admin_criteria -> 'targetCountries',
    admin_patch -> 'target_countries',
    v_pending_criteria -> 'targetCountries',
    v_criteria -> 'targetCountries',
    '[]'::jsonb
  );
  v_target_countries := public.normalize_investor_country_array(v_country_json);

  v_criteria := jsonb_set(v_criteria, '{investorTypes}', to_jsonb(v_types), true);
  v_criteria := jsonb_set(v_criteria, '{stages}', to_jsonb(v_stages), true);
  v_criteria := jsonb_set(v_criteria, '{sectors}', to_jsonb(v_industries), true);
  v_criteria := jsonb_set(v_criteria, '{dealTypes}', to_jsonb(v_deal_types), true);
  v_criteria := jsonb_set(v_criteria, '{targetCountries}', to_jsonb(v_target_countries), true);
  v_criteria := jsonb_set(v_criteria, '{preferredCountries}', to_jsonb(v_target_countries), true);
  v_criteria := jsonb_set(v_criteria, '{targetCountriesCache}', to_jsonb(v_target_countries), true);

  v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';

  update public.investors i
  set type = v_types[1],
      stage = v_stages[1],
      industries = v_industries,
      deal_types = v_deal_types,
      country = coalesce(admin_patch ->> 'country', v_pending ->> 'country', i.country),
      country_iso2 = upper(coalesce(admin_patch ->> 'country_iso2', v_pending ->> 'country_iso2', i.country_iso2)),
      region = coalesce(admin_patch ->> 'region', v_pending ->> 'region', i.region),
      ticket_min = coalesce(
        nullif(admin_patch ->> 'ticket_min', '')::numeric,
        nullif(v_pending ->> 'ticket_min', '')::numeric,
        i.ticket_min
      ),
      ticket_max = coalesce(
        nullif(admin_patch ->> 'ticket_max', '')::numeric,
        nullif(v_pending ->> 'ticket_max', '')::numeric,
        i.ticket_max
      ),
      title_vi = coalesce(nullif(admin_patch ->> 'title_vi', ''), nullif(v_pending ->> 'title_vi', ''), i.title_vi),
      title_en = coalesce(nullif(admin_patch ->> 'title_en', ''), nullif(v_pending ->> 'title_en', ''), i.title_en),
      desc_vi = coalesce(admin_patch ->> 'desc_vi', v_pending ->> 'desc_vi', i.desc_vi),
      desc_en = coalesce(admin_patch ->> 'desc_en', v_pending ->> 'desc_en', i.desc_en),
      private_name = coalesce(nullif(admin_patch ->> 'private_name', ''), i.private_name),
      private_email = coalesce(nullif(admin_patch ->> 'private_email', ''), i.private_email),
      private_phone = coalesce(nullif(admin_patch ->> 'private_phone', ''), i.private_phone),
      private_website = coalesce(nullif(admin_patch ->> 'private_website', ''), i.private_website),
      criteria = v_criteria,
      privacy = v_privacy,
      verified = case when admin_patch ? 'verified' then (admin_patch ->> 'verified')::boolean else i.verified end,
      admin_priority = case when admin_patch ? 'admin_priority' then (admin_patch ->> 'admin_priority')::boolean else i.admin_priority end,
      visible = case when admin_patch ? 'visible' then (admin_patch ->> 'visible')::boolean else publish_profile or i.visible end,
      status = case
        when admin_patch ? 'status' then (admin_patch ->> 'status')::public.account_status
        when publish_profile then 'active'::public.account_status
        else i.status
      end,
      updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'code', v_row.code,
    'approved', true,
    'published', publish_profile,
    'investorTypes', v_types,
    'stages', v_stages,
    'sectors', v_industries,
    'dealTypes', v_deal_types,
    'targetCountries', v_target_countries
  );
end;
$$;

-- Public discovery must expose only approved canonical criteria. In particular,
-- bilingual appetite fields stay independent and pending profile data never
-- crosses this view boundary.
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
    'sectors', coalesce(
      criteria -> 'sectors',
      to_jsonb(coalesce(industries, array[]::text[]))
    ),
    'dealTypes', coalesce(
      criteria -> 'dealTypes',
      to_jsonb(coalesce(deal_types, array[]::text[]))
    ),
    'targetRegions', criteria -> 'targetRegions',
    'targetCountries', coalesce(
      criteria -> 'targetCountries',
      criteria -> 'targetCountriesCache',
      criteria -> 'preferredCountries'
    ),
    'preferredCountries', coalesce(
      criteria -> 'preferredCountries',
      criteria -> 'targetCountries'
    ),
    'targetGeographies', coalesce(
      criteria -> 'targetGeographies',
      criteria -> 'preferredGeographies'
    ),
    'investment_appetite_vi', criteria -> 'investment_appetite_vi',
    'investment_appetite_en', criteria -> 'investment_appetite_en',
    'investment_appetite', criteria -> 'investment_appetite',
    'riskAppetite', criteria -> 'riskAppetite',
    'returnExpectation', criteria -> 'returnExpectation',
    'revenueRange', coalesce(
      criteria -> 'revenueRange',
      criteria -> 'revenueBand'
    ),
    'revenueBand', coalesce(
      criteria -> 'revenueBand',
      criteria -> 'revenueRange'
    ),
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

revoke all on function public.generate_investor_public_code() from public;
revoke all on function public.ensure_investor_public_code() from public;
revoke all on function public.update_my_investor_profile(jsonb, jsonb) from public;
revoke all on function public.admin_approve_investor_profile_changes(uuid, jsonb, boolean) from public;

grant execute on function public.update_my_investor_profile(jsonb, jsonb) to authenticated;
grant execute on function public.admin_approve_investor_profile_changes(uuid, jsonb, boolean) to authenticated;

comment on function public.update_my_investor_profile(jsonb, jsonb) is
'Investor submits public profile/criteria changes into privacy.pending_profile_changes. Private name/website update immediately; approved public data remains unchanged.';

comment on function public.admin_approve_investor_profile_changes(uuid, jsonb, boolean) is
'Admin approves pending Investor profile and canonical multi-select criteria, mirrors legacy fields, clears pending changes and optionally publishes the profile.';

commit;
