-- Deals68 Advisor/Broker — Session 4 atomic Business intake.
-- Scope: an active, verified Advisor may submit a new Business intake. The RPC
-- atomically creates a non-public draft Business, a pending authority declaration,
-- a pending profile-scoped assignment and an audit event.
-- IMPORTANT: it creates no Business ownership, payment order, public listing,
-- verified authority, active assignment or Business mutation privilege.

create or replace function public.d68_create_advisor_business_intake_v1(
  p_intake_key text,
  p_business_payload jsonb,
  p_authority_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles;
  v_advisor public.advisor_profiles;
  v_business_id uuid;
  v_authority_id uuid;
  v_assignment_id uuid;
  v_existing jsonb;
  v_company_name text;
  v_title_vi text;
  v_title_en text;
  v_description_vi text;
  v_description_en text;
  v_country_iso2 text;
  v_city text;
  v_city_key text;
  v_industry text;
  v_industry_key text;
  v_deal_type text;
  v_declared_owner_name text;
  v_declared_principal_name text;
  v_declared_agent_name text;
  v_declared_asset_name text;
  v_declared_asset_address text;
  v_party_type public.d68_listing_party_type;
  v_slug_base text;
  v_slug text;
  v_public_code text;
  v_attempt integer;
begin
  if v_actor is null then
    raise exception 'Authenticated Advisor required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_business_payload, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_authority_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Business intake payloads must be JSON objects' using errcode = '22023';
  end if;

  p_intake_key := btrim(coalesce(p_intake_key, ''));
  if length(p_intake_key) < 24
     or length(p_intake_key) > 120
     or p_intake_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'Invalid Business intake key' using errcode = '22023';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = v_actor
    and p.role = 'advisor'
    and p.status = 'active'
    and p.dashboard_login_enabled is true
  for update;

  if not found then
    raise exception 'Active Advisor account required' using errcode = '42501';
  end if;

  select ap.* into v_advisor
  from public.advisor_profiles ap
  where ap.profile_id = v_actor
    and ap.status = 'active'
    and ap.verification_status = 'verified'
  for update;

  if not found then
    raise exception 'Verified Advisor profile required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'business_id', aa.business_id,
    'authority_id', aa.authority_id,
    'assignment_id', aa.id,
    'business_status', b.status::text,
    'moderation_status', b.moderation_status,
    'authority_status', bla.verification_status::text,
    'assignment_status', aa.status,
    'idempotent_replay', true
  )
  into v_existing
  from public.advisor_assignments aa
  join public.businesses b on b.id = aa.business_id
  join public.business_listing_authority bla on bla.id = aa.authority_id
  where aa.profile_id = v_actor
    and aa.metadata->>'source' = 'advisor_session4_business_intake'
    and aa.metadata->>'intake_key' = p_intake_key
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  if (
    select count(*)
    from public.advisor_assignments aa
    where aa.profile_id = v_actor
      and aa.metadata->>'source' = 'advisor_session4_business_intake'
      and aa.created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Advisor Business intake daily limit reached' using errcode = 'P0001';
  end if;

  v_company_name := left(btrim(coalesce(p_business_payload->>'company_name', '')), 220);
  v_title_vi := left(btrim(coalesce(p_business_payload->>'title_vi', '')), 240);
  v_title_en := left(btrim(coalesce(p_business_payload->>'title_en', '')), 240);
  v_description_vi := nullif(left(btrim(coalesce(p_business_payload->>'description_vi', '')), 5000), '');
  v_description_en := nullif(left(btrim(coalesce(p_business_payload->>'description_en', '')), 5000), '');
  v_country_iso2 := upper(left(btrim(coalesce(p_business_payload->>'country_iso2', 'VN')), 2));
  v_city := nullif(left(btrim(coalesce(p_business_payload->>'city', '')), 160), '');
  v_city_key := nullif(left(lower(btrim(coalesce(p_business_payload->>'city_key', ''))), 160), '');
  v_industry := left(btrim(coalesce(p_business_payload->>'industry', '')), 180);
  v_industry_key := nullif(left(lower(btrim(coalesce(p_business_payload->>'industry_key', ''))), 180), '');
  v_deal_type := left(btrim(coalesce(p_business_payload->>'deal_type', '')), 120);

  v_declared_owner_name := left(btrim(coalesce(p_authority_payload->>'declared_owner_name', v_company_name)), 220);
  v_declared_principal_name := nullif(left(btrim(coalesce(p_authority_payload->>'declared_principal_name', v_company_name)), 220), '');
  v_declared_agent_name := nullif(left(btrim(coalesce(
    p_authority_payload->>'declared_agent_name',
    v_advisor.company_name,
    v_profile.display_name,
    ''
  )), 220), '');
  v_declared_asset_name := nullif(left(btrim(coalesce(p_authority_payload->>'declared_asset_name', v_company_name)), 220), '');
  v_declared_asset_address := nullif(left(btrim(coalesce(p_authority_payload->>'declared_asset_address', '')), 500), '');

  if length(v_company_name) < 2
     or (v_title_vi = '' and v_title_en = '')
     or length(v_industry) < 2
     or length(v_deal_type) < 2
     or length(v_declared_owner_name) < 2 then
    raise exception 'Required Business intake fields are missing' using errcode = '22023';
  end if;

  if v_country_iso2 !~ '^[A-Z]{2}$' then
    raise exception 'Business country must be an ISO-2 code' using errcode = '22023';
  end if;

  if v_description_vi is null and v_description_en is null then
    raise exception 'Business description is required' using errcode = '22023';
  end if;

  v_party_type := case
    when v_advisor.advisor_type = 'broker' then 'authorized_broker'::public.d68_listing_party_type
    else 'authorized_advisor'::public.d68_listing_party_type
  end;

  v_slug_base := lower(coalesce(nullif(v_title_en, ''), nullif(v_title_vi, ''), v_company_name));
  v_slug_base := regexp_replace(v_slug_base, '[^a-z0-9]+', '-', 'g');
  v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');
  if length(v_slug_base) < 3 then
    v_slug_base := 'advisor-business';
  end if;
  v_slug_base := left(v_slug_base, 72);

  v_slug := null;
  for v_attempt in 1..100 loop
    v_slug := v_slug_base || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.businesses b where b.slug = v_slug);
    v_slug := null;
  end loop;
  if v_slug is null then
    raise exception 'Business slug generation failed';
  end if;

  v_public_code := null;
  for v_attempt in 1..100 loop
    v_public_code := 'D68-A' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.businesses b where b.public_code = v_public_code);
    v_public_code := null;
  end loop;
  if v_public_code is null then
    raise exception 'Business public code generation failed';
  end if;

  insert into public.businesses (
    owner_id,
    username,
    public_code,
    slug,
    company_name_private,
    title_vi,
    title_en,
    description_vi,
    description_en,
    country_iso2,
    city,
    city_key,
    industry,
    industry_key,
    deal_type,
    plan,
    revenue_2025,
    revenue_currency,
    ebitda_margin,
    ask_amount,
    ask_currency,
    stake_pct,
    financial_input,
    visible,
    status,
    quota_total,
    quota_used,
    pending_changes_json,
    public_snapshot_json,
    public_version,
    pending_submitted_at,
    pending_submitted_by,
    moderation_status,
    show_on_homepage,
    revenue_public_visible
  ) values (
    null,
    null,
    v_public_code,
    v_slug,
    v_company_name,
    v_title_vi,
    v_title_en,
    v_description_vi,
    v_description_en,
    v_country_iso2,
    v_city,
    v_city_key,
    v_industry,
    v_industry_key,
    v_deal_type,
    'standard',
    0,
    case when v_country_iso2 = 'VN' then 'VND' else 'USD' end,
    0,
    0,
    case when v_country_iso2 = 'VN' then 'VND' else 'USD' end,
    0,
    '{}'::jsonb,
    false,
    'draft'::public.account_status,
    0,
    0,
    jsonb_build_object(
      'source', 'advisor_session4_business_intake',
      'submitted_by', v_actor,
      'submitted_at', now(),
      'business', jsonb_strip_nulls(jsonb_build_object(
        'company_name', v_company_name,
        'title_vi', nullif(v_title_vi, ''),
        'title_en', nullif(v_title_en, ''),
        'description_vi', v_description_vi,
        'description_en', v_description_en,
        'country_iso2', v_country_iso2,
        'city', v_city,
        'city_key', v_city_key,
        'industry', v_industry,
        'industry_key', v_industry_key,
        'deal_type', v_deal_type
      ))
    ),
    null,
    0,
    now(),
    v_actor,
    'pending_admin_review',
    false,
    false
  )
  returning id into v_business_id;

  insert into public.business_listing_authority (
    business_id,
    listing_party_type,
    declared_owner_name,
    declared_principal_name,
    declared_agent_name,
    declared_asset_name,
    declared_asset_address,
    verification_status,
    verification_reasons,
    authority_document_ids,
    report_policy
  ) values (
    v_business_id,
    v_party_type,
    v_declared_owner_name,
    v_declared_principal_name,
    v_declared_agent_name,
    v_declared_asset_name,
    v_declared_asset_address,
    'pending_review',
    jsonb_build_array(jsonb_build_object(
      'code', 'advisor_intake_pending_admin_review',
      'created_at', now()
    )),
    '{}'::uuid[],
    'admin_only'
  )
  returning id into v_authority_id;

  insert into public.advisor_assignments (
    business_id,
    investor_id,
    profile_id,
    created_by,
    status,
    title,
    payload,
    visibility,
    sort_order,
    authority_id,
    permissions,
    granted_by,
    granted_at,
    accepted_at,
    expires_at,
    updated_by,
    metadata
  ) values (
    v_business_id,
    null,
    v_actor,
    v_actor,
    'pending',
    left('Business intake · ' || coalesce(nullif(v_title_vi, ''), nullif(v_title_en, ''), v_company_name), 240),
    '{}'::jsonb,
    'private',
    100,
    v_authority_id,
    array['profile']::text[],
    v_actor,
    now(),
    null,
    null,
    v_actor,
    jsonb_build_object(
      'source', 'advisor_session4_business_intake',
      'intake_key', p_intake_key,
      'admin_review_required', true,
      'originated_by_advisor', true
    )
  )
  returning id into v_assignment_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.business_intake.created',
    'business',
    v_business_id::text,
    jsonb_build_object(
      'authority_id', v_authority_id,
      'assignment_id', v_assignment_id,
      'party_type', v_party_type,
      'business_status', 'draft',
      'authority_status', 'pending_review',
      'assignment_status', 'pending',
      'permissions', jsonb_build_array('profile')
    )
  );

  return jsonb_build_object(
    'business_id', v_business_id,
    'authority_id', v_authority_id,
    'assignment_id', v_assignment_id,
    'business_status', 'draft',
    'moderation_status', 'pending_admin_review',
    'authority_status', 'pending_review',
    'assignment_status', 'pending',
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.d68_create_advisor_business_intake_v1(text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.d68_create_advisor_business_intake_v1(text, jsonb, jsonb)
  to authenticated, service_role;

comment on function public.d68_create_advisor_business_intake_v1(text, jsonb, jsonb) is
  'Session 4 atomic Advisor Business intake. Creates a non-public ownerless draft, pending authority and pending profile assignment; grants no Business mutation or ownership access.';

-- Session 4 intentionally leaves all existing Business RLS policies and table
-- grants unchanged. The RPC creates no payment order and no active/verified access.
