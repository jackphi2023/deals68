-- Deals68 Spec v1.3 — Register Business asset/financial-input persistence
-- Purpose: keep User create -> Admin view/edit/approve -> Dashboard edit -> Pending -> Admin approve logic intact.
-- This migration does not publish private data. It only stores extra signup inputs in private business row / pending_changes_json.

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
set search_path to 'public', 'auth'
as $function$
declare
  business_uuid uuid;
  investor_uuid uuid;
  pay_uuid uuid;
  safe_role text := lower(coalesce(role_text, ''));
  title_text text;
begin
  if safe_role not in ('business','investor','affiliate') then
    raise exception 'Invalid signup role';
  end if;

  if not exists (select 1 from auth.users u where u.id = user_uuid and lower(u.email) = lower(user_email)) then
    raise exception 'Auth user not found for signup bundle';
  end if;

  insert into public.profiles (
    id, role, email, username, display_name, country_iso2, language_code, timezone, status, dashboard_login_enabled, phone_country_iso2, phone
  ) values (
    user_uuid,
    safe_role::public.user_role,
    user_email,
    nullif(profile_payload->>'username',''),
    coalesce(nullif(profile_payload->>'display_name',''), user_email),
    coalesce(nullif(profile_payload->>'country_iso2',''), 'VN'),
    coalesce(nullif(profile_payload->>'language_code',''), case when safe_role = 'investor' then 'en' else 'vi' end),
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
      owner_id, username, public_code, slug, company_name_private, title_vi, title_en, description_vi, description_en,
      country_iso2, city, city_key, industry, deal_type, plan, revenue_2025, revenue_currency, ebitda_margin, ask_amount,
      ask_currency, stake_pct, highlights_vi, highlights_en, investment_reason_vi, investment_reason_en,
      financial_input, valuation_reasonableness, data_confidence, quality_score, visible, status, quota_total, quota_used,
      pending_changes_json, public_snapshot_json, moderation_status
    ) values (
      user_uuid,
      business_payload->>'username',
      coalesce(nullif(business_payload->>'public_code',''), 'D68-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4))),
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
    insert into public.investors (
      owner_id, code, username, type, title_vi, title_en, desc_vi, desc_en, country_iso2, country, region,
      industries, deal_types, stage, ticket_min, ticket_max, criteria, privacy, private_email, private_phone, private_website,
      visible, verified, admin_priority, activity_level, status
    ) values (
      user_uuid,
      coalesce(nullif(investor_payload->>'code',''), 'INV-NEW-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4))),
      investor_payload->>'username',
      investor_payload->>'type',
      investor_payload->>'title_vi',
      investor_payload->>'title_en',
      investor_payload->>'desc_vi',
      investor_payload->>'desc_en',
      coalesce(nullif(investor_payload->>'country_iso2',''), 'VN'),
      investor_payload->>'country',
      investor_payload->>'region',
      coalesce(array(select jsonb_array_elements_text(coalesce(investor_payload->'industries', '[]'::jsonb))), array[]::text[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(investor_payload->'deal_types', '[]'::jsonb))), array[]::text[]),
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

  title_text := coalesce(payment_payload->>'title', case when safe_role = 'business' then 'Business registration' when safe_role = 'investor' then 'Investor registration' else 'Market partner registration' end);
  insert into public.payment_orders (business_id, investor_id, profile_id, created_by, status, title, payload, visibility, sort_order)
  values (business_uuid, investor_uuid, user_uuid, user_uuid, 'pending', title_text, payment_payload, 'admin', 0)
  returning id into pay_uuid;

  return jsonb_build_object('profile_id', user_uuid, 'business_id', business_uuid, 'investor_id', investor_uuid, 'payment_order_id', pay_uuid);
end;
$function$;

create or replace function public.approve_business_public_snapshot(business_uuid uuid, snapshot jsonb)
returns businesses
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  updated_row public.businesses;
begin
  if not public.is_admin_user() then
    raise exception 'Admin only';
  end if;

  update public.businesses
  set public_snapshot_json = snapshot,
      title_vi = coalesce(snapshot->>'title_vi', title_vi),
      title_en = coalesce(snapshot->>'title_en', title_en),
      description_vi = coalesce(snapshot->>'description_vi', description_vi),
      description_en = coalesce(snapshot->>'description_en', description_en),
      highlights_vi = coalesce(snapshot->>'highlights_vi', highlights_vi),
      highlights_en = coalesce(snapshot->>'highlights_en', highlights_en),
      investment_reason_vi = coalesce(snapshot->>'investment_reason_vi', investment_reason_vi),
      investment_reason_en = coalesce(snapshot->>'investment_reason_en', investment_reason_en),
      industry = coalesce(snapshot->>'industry', industry),
      deal_type = coalesce(snapshot->>'deal_type', deal_type),
      city = coalesce(snapshot->>'city', city),
      city_key = coalesce(snapshot->>'city_key', city_key),
      country_iso2 = coalesce(snapshot->>'country_iso2', country_iso2),
      revenue_2025 = coalesce(nullif(snapshot->>'revenue_2025','')::numeric, revenue_2025),
      revenue_currency = coalesce(snapshot->>'revenue_currency', revenue_currency),
      ebitda_margin = coalesce(nullif(snapshot->>'ebitda_margin','')::numeric, ebitda_margin),
      ask_amount = coalesce(nullif(snapshot->>'ask_amount','')::numeric, ask_amount),
      ask_currency = coalesce(snapshot->>'ask_currency', ask_currency),
      stake_pct = coalesce(nullif(snapshot->>'stake_pct','')::numeric, stake_pct),
      quality_score = coalesce(nullif(snapshot->>'quality_score','')::integer, quality_score),
      data_confidence = coalesce(nullif(snapshot->>'data_confidence','')::integer, data_confidence),
      valuation_reasonableness = coalesce(snapshot->>'valuation_reasonableness', valuation_reasonableness),
      hero_image_url = nullif(snapshot->>'hero_image_url',''),
      image_url = nullif(coalesce(snapshot->>'image_url', snapshot->>'hero_image_url'), ''),
      visible = true,
      status = 'active',
      pending_changes_json = null,
      pending_submitted_at = null,
      pending_submitted_by = null,
      moderation_status = 'approved',
      last_approved_at = now(),
      last_approved_by = auth.uid(),
      public_version = coalesce(public_version, 0) + 1,
      updated_at = now()
  where id = business_uuid
  returning * into updated_row;

  return updated_row;
end;
$function$;
