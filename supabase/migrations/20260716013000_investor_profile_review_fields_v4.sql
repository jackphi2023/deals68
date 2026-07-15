begin;

-- Backfill legacy signup codes before enforcing the new generation path.
do $$
declare
  v_row record;
  v_code text;
  v_attempt integer;
begin
  for v_row in
    select id
    from public.investors
    where code like 'INV-NEW-%'
    order by created_at, id
    for update
  loop
    v_code := null;
    for v_attempt in 1..100 loop
      v_code := 'INV-' || lpad((floor(random() * 1000000)::integer)::text, 6, '0');
      exit when not exists (
        select 1 from public.investors i where i.code = v_code
      );
      v_code := null;
    end loop;

    if v_code is null then
      raise exception 'investor_code_generation_failed';
    end if;

    update public.investors
    set code = v_code,
        updated_at = now()
    where id = v_row.id;
  end loop;
end
$$;

-- Signup remains backward compatible, but the database now owns Investor code generation.
create or replace function public.create_signup_bundle(
  user_uuid uuid,
  user_email text,
  role_text text,
  profile_payload jsonb default '{}'::jsonb,
  business_payload jsonb default null::jsonb,
  investor_payload jsonb default null::jsonb,
  payment_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  business_uuid uuid;
  investor_uuid uuid;
  pay_uuid uuid;
  safe_role text := lower(coalesce(role_text, ''));
  title_text text;
  v_investor_code text;
  v_attempt integer;
begin
  if safe_role not in ('business','investor','affiliate') then
    raise exception 'Invalid signup role';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = user_uuid
      and lower(u.email) = lower(user_email)
  ) then
    raise exception 'Auth user not found for signup bundle';
  end if;

  insert into public.profiles (
    id, role, email, username, display_name, country_iso2, language_code,
    timezone, status, dashboard_login_enabled, phone_country_iso2, phone
  ) values (
    user_uuid,
    safe_role::public.user_role,
    user_email,
    nullif(profile_payload->>'username',''),
    coalesce(nullif(profile_payload->>'display_name',''), user_email),
    coalesce(nullif(profile_payload->>'country_iso2',''), 'VN'),
    coalesce(
      nullif(profile_payload->>'language_code',''),
      case when safe_role = 'investor' then 'en' else 'vi' end
    ),
    coalesce(nullif(profile_payload->>'timezone',''), 'Asia/Ho_Chi_Minh'),
    'pending_admin_review'::public.account_status,
    true,
    nullif(profile_payload->>'phone_country_iso2',''),
    nullif(profile_payload->>'phone','')
  )
  on conflict (id) do update set
    role = excluded.role,
    email = excluded.email,
    username = coalesce(excluded.username, public.profiles.username),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    country_iso2 = coalesce(excluded.country_iso2, public.profiles.country_iso2),
    language_code = coalesce(excluded.language_code, public.profiles.language_code),
    timezone = coalesce(excluded.timezone, public.profiles.timezone),
    updated_at = now();

  if safe_role = 'business' and business_payload is not null then
    insert into public.businesses (
      owner_id, username, public_code, slug, company_name_private, title_vi,
      title_en, description_vi, description_en, country_iso2, city, city_key,
      industry, deal_type, plan, revenue_2025, revenue_currency, ebitda_margin,
      ask_amount, ask_currency, stake_pct, highlights_vi, highlights_en,
      investment_reason_vi, investment_reason_en, financial_input,
      valuation_reasonableness, data_confidence, quality_score, visible, status,
      quota_total, quota_used, pending_changes_json, public_snapshot_json,
      moderation_status
    ) values (
      user_uuid,
      business_payload->>'username',
      coalesce(
        nullif(business_payload->>'public_code',''),
        'D68-' || to_char(now(), 'YYYYMMDD') || '-' ||
          upper(substr(md5(random()::text), 1, 4))
      ),
      business_payload->>'slug',
      business_payload->>'company_name_private',
      business_payload->>'title_vi',
      business_payload->>'title_en',
      business_payload->>'description_vi',
      business_payload->>'description_en',
      coalesce(nullif(business_payload->>'country_iso2',''), 'VN'),
      business_payload->>'city',
      nullif(business_payload->>'city_key',''),
      business_payload->>'industry',
      business_payload->>'deal_type',
      coalesce(nullif(business_payload->>'plan',''), 'standard'),
      coalesce(nullif(business_payload->>'revenue_2025','')::numeric, 0),
      coalesce(nullif(business_payload->>'revenue_currency',''), 'VND'),
      coalesce(nullif(business_payload->>'ebitda_margin','')::numeric, 0),
      coalesce(nullif(business_payload->>'ask_amount','')::numeric, 0),
      coalesce(nullif(business_payload->>'ask_currency',''), 'VND'),
      coalesce(nullif(business_payload->>'stake_pct','')::numeric, 0),
      business_payload->>'highlights_vi',
      business_payload->>'highlights_en',
      business_payload->>'investment_reason_vi',
      business_payload->>'investment_reason_en',
      coalesce(business_payload->'financial_input', '{}'::jsonb),
      nullif(business_payload->>'valuation_reasonableness',''),
      coalesce(nullif(business_payload->>'data_confidence','')::integer, 0),
      coalesce(nullif(business_payload->>'quality_score','')::integer, 0),
      false,
      'pending_admin_review'::public.account_status,
      coalesce(nullif(business_payload->>'quota_total','')::integer, 100),
      0,
      business_payload,
      null,
      'pending_admin_review'
    )
    returning id into business_uuid;
  end if;

  if safe_role = 'investor' and investor_payload is not null then
    v_investor_code := null;
    for v_attempt in 1..100 loop
      v_investor_code :=
        'INV-' || lpad((floor(random() * 1000000)::integer)::text, 6, '0');
      exit when not exists (
        select 1 from public.investors i where i.code = v_investor_code
      );
      v_investor_code := null;
    end loop;

    if v_investor_code is null then
      raise exception 'investor_code_generation_failed';
    end if;

    insert into public.investors (
      owner_id, code, username, type, title_vi, title_en, desc_vi, desc_en,
      country_iso2, country, region, industries, deal_types, stage, ticket_min,
      ticket_max, criteria, privacy, private_email, private_phone,
      private_website, visible, verified, admin_priority, activity_level, status
    ) values (
      user_uuid,
      v_investor_code,
      investor_payload->>'username',
      investor_payload->>'type',
      investor_payload->>'title_vi',
      investor_payload->>'title_en',
      investor_payload->>'desc_vi',
      investor_payload->>'desc_en',
      coalesce(nullif(investor_payload->>'country_iso2',''), 'VN'),
      investor_payload->>'country',
      investor_payload->>'region',
      coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(investor_payload->'industries', '[]'::jsonb)
          )
        ),
        array[]::text[]
      ),
      coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(investor_payload->'deal_types', '[]'::jsonb)
          )
        ),
        array[]::text[]
      ),
      investor_payload->>'stage',
      coalesce(nullif(investor_payload->>'ticket_min','')::numeric, 0),
      coalesce(nullif(investor_payload->>'ticket_max','')::numeric, 0),
      coalesce(investor_payload->'criteria', '{}'::jsonb),
      coalesce(investor_payload->'privacy', '{}'::jsonb),
      investor_payload#>>'{privacy,email}',
      investor_payload#>>'{privacy,phone}',
      investor_payload#>>'{privacy,website}',
      false,
      false,
      false,
      'pending',
      'pending_admin_review'::public.account_status
    )
    returning id into investor_uuid;
  end if;

  title_text := coalesce(
    payment_payload->>'title',
    case
      when safe_role = 'business' then 'Business registration'
      when safe_role = 'investor' then 'Investor registration'
      else 'Market partner registration'
    end
  );

  insert into public.payment_orders (
    business_id, investor_id, profile_id, created_by, status, title, payload,
    visibility, sort_order
  ) values (
    business_uuid, investor_uuid, user_uuid, user_uuid, 'pending', title_text,
    payment_payload, 'admin', 0
  )
  returning id into pay_uuid;

  return jsonb_build_object(
    'profile_id', user_uuid,
    'business_id', business_uuid,
    'investor_id', investor_uuid,
    'payment_order_id', pay_uuid
  );
end
$$;

-- Investor-editable fields are submitted as one review bundle and remain private
-- until an administrator approves them.
create or replace function public.submit_my_investor_criteria_review(
  criteria_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_patch jsonb := case
    when jsonb_typeof(criteria_patch) = 'object' then criteria_patch
    else '{}'::jsonb
  end;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_key text;
  v_value text;
  v_allowed constant text[] := array[
    'investment_appetite',
    'riskAppetite',
    'returnExpectation',
    'revenueRange'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_patch) as key_name
    where key_name <> all(v_allowed)
  ) then
    raise exception 'unsupported_investor_criteria_field';
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

  foreach v_key in array v_allowed loop
    if v_patch ? v_key then
      if jsonb_typeof(v_patch -> v_key) not in ('string', 'number', 'null') then
        raise exception 'invalid_investor_criteria_value';
      end if;

      v_value := btrim(coalesce(v_patch ->> v_key, ''));
      if v_key = 'investment_appetite' and char_length(v_value) > 5000 then
        raise exception 'investment_appetite_too_long';
      end if;
      if v_key <> 'investment_appetite' and char_length(v_value) > 160 then
        raise exception 'investor_criteria_value_too_long';
      end if;

      v_pending_criteria := jsonb_set(
        v_pending_criteria,
        array[v_key],
        to_jsonb(v_value),
        true
      );
    end if;
  end loop;

  if v_pending_criteria = '{}'::jsonb then
    v_pending := v_pending - 'criteria';
  else
    v_pending := jsonb_set(
      v_pending,
      '{criteria}',
      v_pending_criteria,
      true
    );
  end if;

  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(
      v_privacy,
      '{pending_profile_changes}',
      v_pending,
      true
    );
    v_privacy := jsonb_set(
      v_privacy,
      '{pending_submitted_at}',
      to_jsonb(now()::text),
      true
    );
  end if;

  update public.investors i
  set privacy = v_privacy,
      updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'criteria_pending', v_pending_criteria
  );
end
$$;

revoke all on function public.submit_my_investor_criteria_review(jsonb)
  from public, anon;
grant execute on function public.submit_my_investor_criteria_review(jsonb)
  to authenticated, service_role;

create or replace function public.admin_approve_investor_criteria(
  investor_uuid uuid,
  criteria_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_patch jsonb := case
    when jsonb_typeof(criteria_patch) = 'object' then criteria_patch
    else '{}'::jsonb
  end;
  v_criteria jsonb;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_key text;
  v_value text;
  v_allowed constant text[] := array[
    'investment_appetite',
    'riskAppetite',
    'returnExpectation',
    'revenueRange'
  ];
begin
  if not public.is_admin_user() then
    raise exception 'admin_required';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_patch) as key_name
    where key_name <> all(v_allowed)
  ) then
    raise exception 'unsupported_investor_criteria_field';
  end if;

  select * into v_row
  from public.investors i
  where i.id = investor_uuid
  for update;

  if not found then
    raise exception 'investor_not_found';
  end if;

  v_criteria := coalesce(v_row.criteria, '{}'::jsonb);
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

  foreach v_key in array v_allowed loop
    if v_patch ? v_key then
      if jsonb_typeof(v_patch -> v_key) not in ('string', 'number', 'null') then
        raise exception 'invalid_investor_criteria_value';
      end if;

      v_value := btrim(coalesce(v_patch ->> v_key, ''));
      if v_key = 'investment_appetite' and char_length(v_value) > 5000 then
        raise exception 'investment_appetite_too_long';
      end if;
      if v_key <> 'investment_appetite' and char_length(v_value) > 160 then
        raise exception 'investor_criteria_value_too_long';
      end if;

      if v_value = '' then
        v_criteria := v_criteria - v_key;
      else
        v_criteria := jsonb_set(
          v_criteria,
          array[v_key],
          to_jsonb(v_value),
          true
        );
      end if;
      v_pending_criteria := v_pending_criteria - v_key;
    end if;
  end loop;

  if v_pending_criteria = '{}'::jsonb then
    v_pending := v_pending - 'criteria';
  else
    v_pending := jsonb_set(
      v_pending,
      '{criteria}',
      v_pending_criteria,
      true
    );
  end if;

  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(
      v_privacy,
      '{pending_profile_changes}',
      v_pending,
      true
    );
  end if;

  update public.investors i
  set criteria = v_criteria,
      privacy = v_privacy,
      updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'approved_criteria', v_patch,
    'has_other_pending_changes', v_pending <> '{}'::jsonb
  );
end
$$;

revoke all on function public.admin_approve_investor_criteria(uuid, jsonb)
  from public, anon;
grant execute on function public.admin_approve_investor_criteria(uuid, jsonb)
  to authenticated, service_role;

-- Keep old clients working while routing them through the expanded review model.
create or replace function public.submit_my_investor_appetite(
  appetite_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  return public.submit_my_investor_criteria_review(
    jsonb_build_object(
      'investment_appetite',
      btrim(coalesce(appetite_text, ''))
    )
  );
end
$$;

revoke all on function public.submit_my_investor_appetite(text)
  from public, anon;
grant execute on function public.submit_my_investor_appetite(text)
  to authenticated, service_role;

create or replace function public.admin_approve_investor_appetite(
  investor_uuid uuid,
  appetite_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  return public.admin_approve_investor_criteria(
    investor_uuid,
    jsonb_build_object(
      'investment_appetite',
      btrim(coalesce(appetite_text, ''))
    )
  );
end
$$;

revoke all on function public.admin_approve_investor_appetite(uuid, text)
  from public, anon;
grant execute on function public.admin_approve_investor_appetite(uuid, text)
  to authenticated, service_role;

-- Preserve pending reviewed criteria when the Investor edits other profile fields.
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
  v_industries text[];
  v_deal_types text[];
  v_criteria jsonb;
  v_profile_criteria jsonb;
  v_privacy jsonb;
  v_pending jsonb;
  v_desc_vi text;
  v_desc_en text;
  v_description_pending boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if profile_patch ?| array[
    'owner_id','code','title_vi','title_en','desc_vi','desc_en','visible',
    'verified','admin_priority','activity_level','status'
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

  v_profile_criteria := case
    when jsonb_typeof(profile_patch->'criteria') = 'object'
      then profile_patch->'criteria'
    else '{}'::jsonb
  end;
  v_profile_criteria := v_profile_criteria
    - 'investment_appetite'
    - 'riskAppetite'
    - 'returnExpectation'
    - 'revenueRange';

  v_criteria := (coalesce(v_row.criteria, '{}'::jsonb) || v_profile_criteria)
    - 'excludedSectors';
  v_criteria := jsonb_set(
    v_criteria,
    '{sectors}',
    to_jsonb(v_industries),
    true
  );
  v_criteria := jsonb_set(
    v_criteria,
    '{dealTypes}',
    to_jsonb(v_deal_types),
    true
  );

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  v_pending := case
    when jsonb_typeof(v_privacy -> 'pending_profile_changes') = 'object'
      then v_privacy -> 'pending_profile_changes'
    else '{}'::jsonb
  end;

  if description_patch ? 'desc_vi' or description_patch ? 'desc_en' then
    v_pending := v_pending - 'desc_vi' - 'desc_en';
    v_desc_vi := coalesce(description_patch->>'desc_vi', v_row.desc_vi, '');
    v_desc_en := coalesce(description_patch->>'desc_en', v_row.desc_en, '');

    if v_desc_vi is distinct from coalesce(v_row.desc_vi, '') then
      v_pending := jsonb_set(
        v_pending,
        '{desc_vi}',
        to_jsonb(v_desc_vi),
        true
      );
    end if;
    if v_desc_en is distinct from coalesce(v_row.desc_en, '') then
      v_pending := jsonb_set(
        v_pending,
        '{desc_en}',
        to_jsonb(v_desc_en),
        true
      );
    end if;
  end if;

  v_description_pending := v_pending ? 'desc_vi' or v_pending ? 'desc_en';

  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(
      v_privacy,
      '{pending_profile_changes}',
      v_pending,
      true
    );
    v_privacy := jsonb_set(
      v_privacy,
      '{pending_submitted_at}',
      to_jsonb(now()::text),
      true
    );
  end if;

  update public.investors i
  set
    private_name = case
      when profile_patch ? 'private_name'
        then nullif(trim(profile_patch->>'private_name'),'')
      else i.private_name
    end,
    private_website = case
      when profile_patch ? 'private_website'
        then nullif(trim(profile_patch->>'private_website'),'')
      else i.private_website
    end,
    type = case
      when profile_patch ? 'type'
        then coalesce(nullif(trim(profile_patch->>'type'),''), i.type)
      else i.type
    end,
    country = case
      when profile_patch ? 'country'
        then coalesce(nullif(trim(profile_patch->>'country'),''), i.country)
      else i.country
    end,
    country_iso2 = case
      when profile_patch ? 'country_iso2'
        then coalesce(
          nullif(upper(trim(profile_patch->>'country_iso2')),''),
          i.country_iso2
        )
      else i.country_iso2
    end,
    region = case
      when profile_patch ? 'region'
        then coalesce(nullif(trim(profile_patch->>'region'),''), i.region)
      else i.region
    end,
    industries = v_industries,
    deal_types = v_deal_types,
    stage = case
      when profile_patch ? 'stage'
        then coalesce(nullif(trim(profile_patch->>'stage'),''), i.stage)
      else i.stage
    end,
    ticket_min = case
      when profile_patch ? 'ticket_min'
       and (profile_patch->>'ticket_min') ~ '^[0-9]+([.][0-9]+)?$'
        then (profile_patch->>'ticket_min')::numeric
      else i.ticket_min
    end,
    ticket_max = case
      when profile_patch ? 'ticket_max'
       and (profile_patch->>'ticket_max') ~ '^[0-9]+([.][0-9]+)?$'
        then (profile_patch->>'ticket_max')::numeric
      else i.ticket_max
    end,
    criteria = v_criteria,
    privacy = v_privacy,
    updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'description_pending', v_description_pending,
    'has_other_pending_changes', v_pending <> '{}'::jsonb
  );
end
$$;

revoke all on function public.update_my_investor_profile(jsonb, jsonb)
  from public, anon;
grant execute on function public.update_my_investor_profile(jsonb, jsonb)
  to authenticated, service_role;

-- Expose only approved values in the public safe view.
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
    'sectors', coalesce(
      criteria -> 'sectors',
      to_jsonb(coalesce(industries, '{}'::text[]))
    ),
    'dealTypes', coalesce(
      criteria -> 'dealTypes',
      to_jsonb(coalesce(deal_types, '{}'::text[]))
    ),
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

commit;
