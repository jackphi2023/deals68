-- Deals68 migration-history reconciliation for Issue #26.
--
-- This migration is intentionally a final-state baseline. It recreates the
-- production investor cover/review schema from the repository's tracked
-- history without overwriting existing banner data.
begin;

alter table public.site_banners
  add column if not exists desktop_fit text default 'contain',
  add column if not exists mobile_fit text default 'contain';

update public.site_banners
set desktop_fit = 'contain'
where desktop_fit is null or desktop_fit not in ('cover', 'contain');

update public.site_banners
set mobile_fit = 'contain'
where mobile_fit is null or mobile_fit not in ('cover', 'contain');

alter table public.site_banners
  alter column desktop_fit set default 'contain',
  alter column desktop_fit set not null,
  alter column mobile_fit set default 'contain',
  alter column mobile_fit set not null;

alter table public.site_banners
  drop constraint if exists site_banners_desktop_fit_check,
  drop constraint if exists site_banners_mobile_fit_check,
  drop constraint if exists site_banners_placement_check;

alter table public.site_banners
  add constraint site_banners_desktop_fit_check
    check (desktop_fit in ('cover', 'contain')),
  add constraint site_banners_mobile_fit_check
    check (mobile_fit in ('cover', 'contain')),
  add constraint site_banners_placement_check
    check (
      placement in (
        'home_hero',
        'home_promotion',
        'listing_promotion',
        'investor_cover_default'
      )
    );

comment on column public.site_banners.desktop_fit is
  'Desktop banner image fit mode: cover or contain.';
comment on column public.site_banners.mobile_fit is
  'Mobile banner image fit mode: cover or contain.';

insert into public.site_banners (
  placement,
  title,
  image_url,
  image_path,
  sort_order,
  lang_mode,
  starts_at,
  ends_at,
  active,
  focal_x,
  focal_y,
  desktop_fit,
  mobile_fit
)
select
  'investor_cover_default',
  'Ảnh Cover Investor mặc định',
  '/assets/investor-cover-default.svg',
  null,
  1,
  'both',
  current_date,
  null,
  true,
  50,
  50,
  'cover',
  'cover'
where not exists (
  select 1
  from public.site_banners
  where placement = 'investor_cover_default'
    and sort_order = 1
);

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

create or replace function public.admin_set_default_investor_cover(
  cover_url text,
  cover_path text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_url text := nullif(btrim(coalesce(cover_url, '')), '');
  v_path text := nullif(btrim(coalesce(cover_path, '')), '');
  v_row public.site_banners%rowtype;
  v_old_path text;
begin
  if not public.is_admin_user() then
    raise exception 'admin_required';
  end if;

  if v_url is null or v_path is null then
    raise exception 'cover_url_and_path_required';
  end if;

  if v_path !~ '^investor_cover/default/[A-Za-z0-9._/-]+$' then
    raise exception 'invalid_default_cover_path';
  end if;

  select *
  into v_row
  from public.site_banners b
  where b.placement = 'investor_cover_default'
  order by b.active desc, b.updated_at desc, b.created_at desc
  limit 1
  for update;

  if found then
    v_old_path := nullif(v_row.image_path, '');

    update public.site_banners b
    set title = 'Ảnh Cover Investor mặc định',
        image_url = v_url,
        image_path = v_path,
        link_url = null,
        sort_order = 1,
        lang_mode = 'both',
        starts_at = current_date,
        ends_at = null,
        active = true,
        focal_x = 50,
        focal_y = 50,
        desktop_fit = 'cover',
        mobile_fit = 'cover',
        updated_at = now()
    where b.id = v_row.id
    returning * into v_row;
  else
    insert into public.site_banners (
      placement, title, image_url, image_path, link_url, sort_order,
      lang_mode, starts_at, ends_at, active, focal_x, focal_y,
      desktop_fit, mobile_fit, updated_at
    ) values (
      'investor_cover_default', 'Ảnh Cover Investor mặc định',
      v_url, v_path, null, 1, 'both', current_date, null, true,
      50, 50, 'cover', 'cover', now()
    ) returning * into v_row;
  end if;

  update public.site_banners b
  set active = false, updated_at = now()
  where b.placement = 'investor_cover_default'
    and b.id <> v_row.id
    and b.active = true;

  return jsonb_build_object(
    'banner_id', v_row.id,
    'old_path', v_old_path,
    'image_url', v_row.image_url,
    'image_path', v_row.image_path
  );
end
$$;

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
  v_expected_prefix text := 'investor_cover/' || investor_uuid::text || '/';
begin
  if not public.is_admin_user() then raise exception 'admin_required'; end if;
  if (v_url is null) <> (v_path is null) then
    raise exception 'cover_url_and_path_must_be_set_together';
  end if;
  if v_path is not null and left(v_path, char_length(v_expected_prefix))
      <> v_expected_prefix then
    raise exception 'invalid_investor_cover_path';
  end if;

  select * into v_row
  from public.investors i
  where i.id = investor_uuid
  for update;
  if not found then raise exception 'investor_not_found'; end if;

  v_criteria := coalesce(v_row.criteria, '{}'::jsonb);
  v_old_path := nullif(v_criteria ->> 'cover_image_path', '');
  if v_url is null then
    v_criteria := v_criteria - 'cover_image_url' - 'cover_image_path';
  else
    v_criteria := jsonb_set(v_criteria, '{cover_image_url}', to_jsonb(v_url), true);
    v_criteria := jsonb_set(v_criteria, '{cover_image_path}', to_jsonb(v_path), true);
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
  v_approved_criteria jsonb;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_key text;
  v_value text;
  v_approved_value text;
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
    where not (key_name = any(v_allowed))
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

  v_approved_criteria := coalesce(v_row.criteria, '{}'::jsonb);
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

      v_approved_value := btrim(coalesce(
        case
          when v_key = 'revenueRange' then
            coalesce(
              v_approved_criteria ->> 'revenueRange',
              v_approved_criteria ->> 'revenueBand'
            )
          else v_approved_criteria ->> v_key
        end,
        ''
      ));

      if v_value = v_approved_value then
        v_pending_criteria := v_pending_criteria - v_key;
      else
        v_pending_criteria := jsonb_set(
          v_pending_criteria,
          array[v_key],
          to_jsonb(v_value),
          true
        );
      end if;
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

-- SECURITY DEFINER functions are never executable by anon or PUBLIC.
revoke all on function public.admin_set_default_investor_cover(text, text)
  from public, anon;
grant execute on function public.admin_set_default_investor_cover(text, text)
  to authenticated, service_role;

revoke all on function public.admin_set_investor_cover(uuid, text, text)
  from public, anon;
grant execute on function public.admin_set_investor_cover(uuid, text, text)
  to authenticated, service_role;

revoke all on function public.submit_my_investor_criteria_review(jsonb)
  from public, anon;
grant execute on function public.submit_my_investor_criteria_review(jsonb)
  to authenticated, service_role;

revoke all on function public.admin_approve_investor_criteria(uuid, jsonb)
  from public, anon;
grant execute on function public.admin_approve_investor_criteria(uuid, jsonb)
  to authenticated, service_role;

revoke all on function public.submit_my_investor_appetite(text)
  from public, anon;
grant execute on function public.submit_my_investor_appetite(text)
  to authenticated, service_role;

revoke all on function public.admin_approve_investor_appetite(uuid, text)
  from public, anon;
grant execute on function public.admin_approve_investor_appetite(uuid, text)
  to authenticated, service_role;

revoke all on function public.update_my_investor_profile(jsonb, jsonb)
  from public, anon;
grant execute on function public.update_my_investor_profile(jsonb, jsonb)
  to authenticated, service_role;

commit;



