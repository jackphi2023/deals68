-- Deals68 Advisor/Broker — Session 2 isolated authentication and application flow.
-- Scope: create a pending Advisor profile from a fresh Supabase Auth signup,
-- confirm email verification after OTP, and expose only the Advisor's own status.
-- IMPORTANT: this migration does NOT create Business records, payment orders,
-- listing authority, assignments, or any Advisor access to existing Business data.

create or replace function public.d68_create_advisor_signup_v1(
  p_user_uuid uuid,
  p_user_email text,
  p_signup_nonce text,
  p_profile_payload jsonb default '{}'::jsonb,
  p_advisor_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_email text;
  v_auth_created_at timestamptz;
  v_auth_nonce text;
  v_auth_role text;
  v_username text;
  v_display_name text;
  v_country_iso2 text;
  v_language_code text;
  v_timezone text;
  v_phone_country_iso2 text;
  v_phone text;
  v_advisor_type text;
  v_title text;
  v_company_name text;
  v_website text;
  v_introduction text;
  v_expertise jsonb;
  v_advisor_id uuid;
begin
  if jsonb_typeof(coalesce(p_profile_payload, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_advisor_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Advisor signup payload must be JSON objects' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_signup_nonce, ''))) < 24 then
    raise exception 'Invalid Advisor signup nonce' using errcode = '42501';
  end if;

  select
    lower(coalesce(u.email, '')),
    u.created_at,
    u.raw_user_meta_data->>'signup_nonce',
    lower(coalesce(u.raw_user_meta_data->>'role', ''))
  into v_auth_email, v_auth_created_at, v_auth_nonce, v_auth_role
  from auth.users u
  where u.id = p_user_uuid
  for update;

  if not found
     or v_auth_email <> lower(btrim(coalesce(p_user_email, '')))
     or v_auth_nonce is distinct from p_signup_nonce
     or v_auth_role <> 'advisor'
     or v_auth_created_at < now() - interval '30 minutes' then
    raise exception 'Advisor signup verification failed' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_user_uuid and p.role <> 'advisor'
  ) then
    raise exception 'Existing account role cannot be converted to Advisor' using errcode = '42501';
  end if;

  v_display_name := left(btrim(coalesce(p_profile_payload->>'display_name', '')), 160);
  v_username := lower(left(btrim(coalesce(p_profile_payload->>'username', '')), 42));
  v_username := regexp_replace(v_username, '[^a-z0-9._-]+', '', 'g');
  v_username := regexp_replace(v_username, '^[._-]+|[._-]+$', '', 'g');
  if length(v_username) < 3 then
    v_username := 'advisor.' || substr(md5(p_user_uuid::text), 1, 8);
  end if;
  if exists (select 1 from public.profiles p where p.username = v_username and p.id <> p_user_uuid) then
    v_username := left(v_username, 33) || '.' || substr(md5(p_user_uuid::text), 1, 8);
  end if;

  v_country_iso2 := upper(left(btrim(coalesce(p_profile_payload->>'country_iso2', 'VN')), 2));
  if v_country_iso2 !~ '^[A-Z]{2}$' then v_country_iso2 := 'VN'; end if;
  v_language_code := lower(btrim(coalesce(p_profile_payload->>'language_code', 'vi')));
  if v_language_code not in ('vi', 'en') then v_language_code := 'vi'; end if;
  v_timezone := left(btrim(coalesce(p_profile_payload->>'timezone', 'Asia/Ho_Chi_Minh')), 80);
  v_phone_country_iso2 := upper(left(btrim(coalesce(p_profile_payload->>'phone_country_iso2', v_country_iso2)), 2));
  if v_phone_country_iso2 !~ '^[A-Z]{2}$' then v_phone_country_iso2 := v_country_iso2; end if;
  v_phone := left(btrim(coalesce(p_profile_payload->>'phone', '')), 80);

  v_advisor_type := lower(btrim(coalesce(p_advisor_payload->>'advisor_type', 'advisor')));
  if v_advisor_type not in ('advisor', 'broker', 'advisor_broker') then
    raise exception 'Unsupported Advisor type' using errcode = '22023';
  end if;
  v_title := left(btrim(coalesce(p_advisor_payload->>'title', '')), 180);
  v_company_name := nullif(left(btrim(coalesce(p_advisor_payload->>'company_name', '')), 220), '');
  v_website := nullif(left(btrim(coalesce(p_advisor_payload->>'website', '')), 500), '');
  v_introduction := left(btrim(coalesce(p_advisor_payload->>'introduction', '')), 3000);
  v_expertise := coalesce(p_advisor_payload->'expertise', '[]'::jsonb);

  if v_display_name = '' or v_title = '' or v_phone = '' or v_introduction = '' then
    raise exception 'Required Advisor signup fields are missing' using errcode = '22023';
  end if;
  if jsonb_typeof(v_expertise) <> 'array'
     or jsonb_array_length(v_expertise) < 1
     or jsonb_array_length(v_expertise) > 12 then
    raise exception 'Advisor expertise must contain 1 to 12 items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_expertise) item
    where jsonb_typeof(item) <> 'string' or length(btrim(item #>> '{}')) > 120
  ) then
    raise exception 'Advisor expertise contains an invalid item' using errcode = '22023';
  end if;
  if v_website is not null and v_website !~* '^https?://[^[:space:]]+$' then
    raise exception 'Advisor website must use http or https' using errcode = '22023';
  end if;

  insert into public.profiles (
    id, role, email, username, display_name, country_iso2, language_code,
    timezone, phone_country_iso2, phone, status, dashboard_login_enabled
  ) values (
    p_user_uuid, 'advisor'::public.user_role, lower(btrim(p_user_email)),
    v_username, v_display_name, v_country_iso2, v_language_code, v_timezone,
    v_phone_country_iso2, v_phone,
    'pending_admin_review'::public.account_status, false
  )
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    display_name = excluded.display_name,
    country_iso2 = excluded.country_iso2,
    language_code = excluded.language_code,
    timezone = excluded.timezone,
    phone_country_iso2 = excluded.phone_country_iso2,
    phone = excluded.phone,
    updated_at = now();

  insert into public.advisor_profiles (
    profile_id, created_by, status, advisor_type, title, company_name, website,
    payload, metadata, visibility, verification_status
  ) values (
    p_user_uuid, p_user_uuid, 'pending', v_advisor_type, v_title,
    v_company_name, v_website,
    jsonb_build_object(
      'introduction', v_introduction,
      'expertise', v_expertise,
      'language_code', v_language_code,
      'country_iso2', v_country_iso2
    ),
    jsonb_build_object(
      'signup_source', 'advisor_session2',
      'email_verified', false,
      'submitted_at', now()
    ),
    'private', 'pending'
  )
  on conflict (profile_id) do update set
    advisor_type = excluded.advisor_type,
    title = excluded.title,
    company_name = excluded.company_name,
    website = excluded.website,
    payload = excluded.payload,
    metadata = public.advisor_profiles.metadata || excluded.metadata,
    updated_at = now()
  where public.advisor_profiles.status = 'pending'
    and public.advisor_profiles.verification_status = 'pending'
  returning id into v_advisor_id;

  if v_advisor_id is null then
    select ap.id into v_advisor_id
    from public.advisor_profiles ap
    where ap.profile_id = p_user_uuid;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  select
    p_user_uuid,
    'advisor.registration.submitted',
    'advisor_profile',
    v_advisor_id::text,
    jsonb_build_object(
      'profile_id', p_user_uuid,
      'advisor_type', v_advisor_type,
      'status', 'pending',
      'verification_status', 'pending'
    )
  where not exists (
    select 1 from public.audit_logs al
    where al.actor_id = p_user_uuid
      and al.action = 'advisor.registration.submitted'
      and al.entity_id = v_advisor_id::text
  );

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'signup_nonce'
    - 'affiliate_code'
    - 'affiliate_click_id'
    - 'affiliate_captured_at'
  where id = p_user_uuid;

  return jsonb_build_object(
    'profile_id', p_user_uuid,
    'advisor_profile_id', v_advisor_id,
    'profile_status', 'pending_admin_review',
    'advisor_status', 'pending',
    'verification_status', 'pending'
  );
end;
$$;

revoke all on function public.d68_create_advisor_signup_v1(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.d68_create_advisor_signup_v1(uuid, text, text, jsonb, jsonb)
  to anon, authenticated, service_role;
comment on function public.d68_create_advisor_signup_v1(uuid, text, text, jsonb, jsonb) is
  'Session 2 fresh-signup RPC. Creates only pending Advisor identity/profile records; never a Business, payment order, authority or assignment.';

create or replace function public.d68_mark_advisor_email_verified_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_advisor public.advisor_profiles;
  v_profile public.profiles;
begin
  if v_actor is null then
    raise exception 'Authenticated Advisor required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = v_actor
      and u.email_confirmed_at is not null
      and p.role = 'advisor'
  ) then
    raise exception 'Verified Advisor email required' using errcode = '42501';
  end if;

  select ap.* into v_advisor
  from public.advisor_profiles ap
  where ap.profile_id = v_actor
  for update;

  if not found then
    raise exception 'Advisor profile not found' using errcode = 'P0002';
  end if;

  update public.profiles p
  set
    dashboard_login_enabled = true,
    status = case
      when p.status in ('draft', 'payment_pending')
        then 'pending_admin_review'::public.account_status
      else p.status
    end,
    updated_at = now()
  where p.id = v_actor
  returning p.* into v_profile;

  update public.advisor_profiles ap
  set metadata = coalesce(ap.metadata, '{}'::jsonb) || jsonb_build_object(
      'email_verified', true,
      'email_verified_at', now()
    ),
    updated_at = now()
  where ap.profile_id = v_actor
  returning ap.* into v_advisor;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  select
    v_actor,
    'advisor.email.verified',
    'advisor_profile',
    v_advisor.id::text,
    jsonb_build_object(
      'profile_id', v_actor,
      'profile_status', v_profile.status,
      'advisor_status', v_advisor.status,
      'verification_status', v_advisor.verification_status
    )
  where not exists (
    select 1 from public.audit_logs al
    where al.actor_id = v_actor
      and al.action = 'advisor.email.verified'
      and al.entity_id = v_advisor.id::text
  );

  return jsonb_build_object(
    'profile_id', v_actor,
    'profile_status', v_profile.status,
    'dashboard_login_enabled', v_profile.dashboard_login_enabled,
    'advisor_status', v_advisor.status,
    'verification_status', v_advisor.verification_status
  );
end;
$$;

revoke all on function public.d68_mark_advisor_email_verified_v1()
  from public, anon, authenticated;
grant execute on function public.d68_mark_advisor_email_verified_v1()
  to authenticated, service_role;
comment on function public.d68_mark_advisor_email_verified_v1() is
  'Session 2 OTP completion RPC. Enables the Advisor status page only; does not activate or verify the Advisor and grants no Business access.';

-- Session 2 intentionally leaves every existing Business RLS policy unchanged.
-- The Session 1 assignment helper is still not referenced by Business tables.
