-- Deals68 Advisor/Broker — Session 3 read-only portfolio and Business context.
-- Scope: expose a tightly redacted Advisor assignment portfolio and a read-only
-- Business context through authenticated RPCs. Existing Business RLS policies,
-- table grants and mutation paths remain unchanged.

create or replace function public.d68_get_my_advisor_portfolio_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_items jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.advisor_profiles ap on ap.profile_id = p.id
    where p.id = v_actor
      and p.role = 'advisor'
      and p.status = 'active'
      and p.dashboard_login_enabled is true
      and ap.status = 'active'
      and ap.verification_status = 'verified'
  ) then
    raise exception 'Active and verified Advisor account required';
  end if;

  select coalesce(jsonb_agg(item order by sort_rank, granted_at desc, assignment_id), '[]'::jsonb)
  into v_items
  from (
    select
      aa.id as assignment_id,
      aa.granted_at,
      case
        when aa.expires_at is not null
         and aa.expires_at <= now()
         and aa.status in ('pending', 'active') then 4
        when aa.status = 'active' then 1
        when aa.status = 'pending' then 2
        when aa.status = 'suspended' then 3
        else 5
      end as sort_rank,
      jsonb_strip_nulls(jsonb_build_object(
        'assignment_id', aa.id,
        'business_id', aa.business_id,
        'assignment_title', aa.title,
        'status', case
          when aa.expires_at is not null
           and aa.expires_at <= now()
           and aa.status in ('pending', 'active') then 'expired'
          else aa.status
        end,
        'permissions', to_jsonb(aa.permissions),
        'granted_at', aa.granted_at,
        'accepted_at', aa.accepted_at,
        'expires_at', aa.expires_at,
        'suspension_reason', aa.suspension_reason,
        'revoke_reason', aa.revoke_reason,
        'can_accept', (
          aa.status = 'pending'
          and (aa.expires_at is null or aa.expires_at > now())
          and bla.verification_status = 'verified'
          and (bla.expires_at is null or bla.expires_at > now())
        ),
        'can_open_context', (
          aa.status = 'active'
          and aa.accepted_at is not null
          and (aa.expires_at is null or aa.expires_at > now())
          and 'profile' = any(aa.permissions)
          and bla.verification_status = 'verified'
          and (bla.expires_at is null or bla.expires_at > now())
        ),
        'authority', jsonb_build_object(
          'id', bla.id,
          'party_type', bla.listing_party_type::text,
          'verification_status', bla.verification_status::text,
          'expires_at', bla.expires_at
        ),
        'business', jsonb_strip_nulls(jsonb_build_object(
          'public_code', b.public_code,
          'slug', b.slug,
          'title_vi', b.title_vi,
          'title_en', b.title_en,
          'company_name', case
            when aa.status = 'active'
             and aa.accepted_at is not null
             and (aa.expires_at is null or aa.expires_at > now())
            then b.company_name_private
            else null
          end,
          'industry', b.industry,
          'country_iso2', b.country_iso2,
          'city', b.city,
          'deal_type', b.deal_type,
          'status', b.status::text,
          'moderation_status', b.moderation_status,
          'image_url', b.image_url,
          'hero_image_url', b.hero_image_url
        ))
      )) as item
    from public.advisor_assignments aa
    join public.businesses b on b.id = aa.business_id
    join public.business_listing_authority bla on bla.id = aa.authority_id
    where aa.profile_id = v_actor
  ) portfolio_rows;

  return jsonb_build_object(
    'advisor_profile_id', v_actor,
    'generated_at', now(),
    'items', v_items
  );
end;
$$;

create or replace function public.d68_get_my_advisor_business_context_v1(
  p_business_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_business_id is null then
    raise exception 'Business ID is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.advisor_profiles ap on ap.profile_id = p.id
    where p.id = v_actor
      and p.role = 'advisor'
      and p.status = 'active'
      and p.dashboard_login_enabled is true
      and ap.status = 'active'
      and ap.verification_status = 'verified'
  ) then
    raise exception 'Active and verified Advisor account required';
  end if;

  if not d68_private.can_manage_business(p_business_id, 'profile') then
    raise exception 'Active profile-scoped Advisor assignment required';
  end if;

  select jsonb_build_object(
    'assignment', jsonb_strip_nulls(jsonb_build_object(
      'assignment_id', aa.id,
      'business_id', aa.business_id,
      'assignment_title', aa.title,
      'status', aa.status,
      'permissions', to_jsonb(aa.permissions),
      'granted_at', aa.granted_at,
      'accepted_at', aa.accepted_at,
      'expires_at', aa.expires_at,
      'authority_id', bla.id,
      'authority_party_type', bla.listing_party_type::text,
      'authority_verification_status', bla.verification_status::text,
      'authority_expires_at', bla.expires_at
    )),
    'business', jsonb_strip_nulls(jsonb_build_object(
      'id', b.id,
      'public_code', b.public_code,
      'slug', b.slug,
      'company_name', b.company_name_private,
      'title_vi', b.title_vi,
      'title_en', b.title_en,
      'industry', b.industry,
      'industry_key', b.industry_key,
      'country_iso2', b.country_iso2,
      'city', b.city,
      'city_key', b.city_key,
      'deal_type', b.deal_type,
      'status', b.status::text,
      'moderation_status', b.moderation_status,
      'visible', b.visible,
      'image_url', b.image_url,
      'hero_image_url', b.hero_image_url,
      'updated_at', b.updated_at
    )),
    'access', jsonb_build_object(
      'mode', 'read_only',
      'scope', 'profile',
      'mutations_enabled', false,
      'files_enabled', false,
      'images_enabled', false,
      'proposals_enabled', false,
      'data_requests_enabled', false,
      'payments_enabled', false,
      'reports_enabled', false
    )
  )
  into v_result
  from public.advisor_assignments aa
  join public.businesses b on b.id = aa.business_id
  join public.business_listing_authority bla on bla.id = aa.authority_id
  where aa.profile_id = v_actor
    and aa.business_id = p_business_id
    and aa.status = 'active'
    and aa.accepted_at is not null
    and (aa.expires_at is null or aa.expires_at > now())
    and 'profile' = any(aa.permissions)
    and bla.business_id = aa.business_id
    and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
    and bla.verification_status = 'verified'
    and (bla.expires_at is null or bla.expires_at > now())
  limit 1;

  if v_result is null then
    raise exception 'Advisor Business context is unavailable';
  end if;

  return v_result;
end;
$$;

revoke all on function public.d68_get_my_advisor_portfolio_v1()
  from public, anon, authenticated;
revoke all on function public.d68_get_my_advisor_business_context_v1(uuid)
  from public, anon, authenticated;

grant execute on function public.d68_get_my_advisor_portfolio_v1()
  to authenticated, service_role;
grant execute on function public.d68_get_my_advisor_business_context_v1(uuid)
  to authenticated, service_role;

comment on function public.d68_get_my_advisor_portfolio_v1() is
  'Session 3 authenticated Advisor portfolio. Returns only assignment metadata and redacted Business identity fields.';
comment on function public.d68_get_my_advisor_business_context_v1(uuid) is
  'Session 3 read-only Business profile context. Requires an active accepted unexpired profile-scoped assignment and verified authority.';

-- Session 3 intentionally does not create or modify Business RLS policies,
-- Business table grants, storage policies or any Business mutation RPC.
