-- Deals68 Advisor/Broker — Session 5 Admin authority review.
-- Scope: let an active Admin review Session 4 Business intakes, verify or reject
-- the declared Advisor/Broker authority, and prepare a pending profile-only
-- assignment for Advisor acceptance. This migration grants no Business mutation,
-- publication, payment, file, proposal, request or report capability.

-- Session 4 intentionally creates a pending assignment before authority review.
-- The Session 1 trigger originally required verified authority for every write,
-- which would block that intake transaction in production. Preserve fail-closed
-- behavior while allowing exactly the pending, profile-only Session 4 linkage.
create or replace function d68_private.validate_advisor_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.profile_id
      and p.role = 'advisor'
  ) then
    raise exception 'Target profile does not have Advisor role';
  end if;

  if not exists (
    select 1
    from public.business_listing_authority bla
    where bla.id = new.authority_id
      and bla.business_id = new.business_id
      and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
  ) then
    raise exception 'Advisor authority does not match the Business';
  end if;

  -- Revocation and expiry must remain possible even when an Advisor or authority
  -- has ceased to be valid. These terminal states never grant access.
  if new.status in ('revoked', 'expired') then
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.advisor_profiles ap on ap.profile_id = p.id
    where p.id = new.profile_id
      and p.role = 'advisor'
      and p.status = 'active'
      and p.dashboard_login_enabled is true
      and ap.status = 'active'
      and ap.verification_status = 'verified'
  ) then
    raise exception 'Advisor profile is not active and verified';
  end if;

  -- Narrow Session 4 exception: an intake linkage may remain pending while the
  -- matching authority is pending Admin review. It must be profile-only, private,
  -- unaccepted and explicitly marked as requiring Admin review.
  if new.status = 'pending'
     and new.accepted_at is null
     and new.visibility = 'private'
     and new.permissions = array['profile']::text[]
     and new.metadata->>'source' = 'advisor_session4_business_intake'
     and new.metadata->>'admin_review_required' = 'true'
     and exists (
       select 1
       from public.business_listing_authority bla
       where bla.id = new.authority_id
         and bla.business_id = new.business_id
         and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
         and bla.verification_status = 'pending_review'
         and bla.verified_by is null
         and bla.verified_at is null
     ) then
    return new;
  end if;

  -- Every non-terminal assignment outside the narrow intake exception requires
  -- currently verified, unexpired authority.
  if not exists (
    select 1
    from public.business_listing_authority bla
    where bla.id = new.authority_id
      and bla.business_id = new.business_id
      and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
      and bla.verification_status = 'verified'
      and bla.verified_by is not null
      and bla.verified_at is not null
      and (bla.expires_at is null or bla.expires_at > now())
  ) then
    raise exception 'Business listing authority is not verified, does not match the Business, or has expired';
  end if;

  return new;
end;
$$;

revoke all on function d68_private.validate_advisor_assignment()
  from public, anon, authenticated;

create index if not exists advisor_assignments_intake_review_idx
  on public.advisor_assignments ((metadata->>'source'), status, created_at desc)
  where metadata->>'source' = 'advisor_session4_business_intake';

create or replace function public.d68_admin_list_advisor_business_intakes_v1()
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
  if v_actor is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.role = 'admin'
      and p.status = 'active'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into v_items
  from (
    select
      aa.created_at,
      jsonb_build_object(
        'assignment_id', aa.id,
        'business_id', aa.business_id,
        'authority_id', aa.authority_id,
        'advisor_profile_id', aa.profile_id,
        'submitted_at', aa.created_at,
        'review_status', case
          when aa.status = 'active' then 'accepted'
          when aa.status in ('revoked', 'expired') or bla.verification_status = 'rejected' then 'rejected'
          when bla.verification_status = 'verified' and aa.status = 'pending' then 'approved_awaiting_acceptance'
          else 'pending_review'
        end,
        'can_review', (
          aa.status = 'pending'
          and aa.accepted_at is null
          and bla.verification_status = 'pending_review'
          and coalesce(aa.metadata->>'admin_review_required', 'false') = 'true'
        ),
        'business', jsonb_strip_nulls(jsonb_build_object(
          'public_code', b.public_code,
          'company_name', b.company_name_private,
          'title_vi', nullif(b.title_vi, ''),
          'title_en', nullif(b.title_en, ''),
          'description_vi', nullif(b.description_vi, ''),
          'description_en', nullif(b.description_en, ''),
          'country_iso2', b.country_iso2,
          'city', b.city,
          'industry', b.industry,
          'deal_type', b.deal_type,
          'status', b.status::text,
          'moderation_status', b.moderation_status,
          'visible', b.visible,
          'owner_id', b.owner_id
        )),
        'advisor', jsonb_strip_nulls(jsonb_build_object(
          'profile_id', ap.profile_id,
          'display_name', p.display_name,
          'email', p.email,
          'advisor_type', ap.advisor_type,
          'company_name', ap.company_name,
          'website', ap.website,
          'status', ap.status,
          'verification_status', ap.verification_status
        )),
        'authority', jsonb_strip_nulls(jsonb_build_object(
          'listing_party_type', bla.listing_party_type::text,
          'declared_owner_name', bla.declared_owner_name,
          'declared_principal_name', bla.declared_principal_name,
          'declared_agent_name', bla.declared_agent_name,
          'declared_asset_name', bla.declared_asset_name,
          'declared_asset_address', bla.declared_asset_address,
          'verification_status', bla.verification_status::text,
          'verification_reasons', bla.verification_reasons,
          'verified_by', bla.verified_by,
          'verified_at', bla.verified_at,
          'expires_at', bla.expires_at,
          'report_policy', bla.report_policy::text
        )),
        'assignment', jsonb_strip_nulls(jsonb_build_object(
          'status', aa.status,
          'permissions', to_jsonb(aa.permissions),
          'granted_by', aa.granted_by,
          'granted_at', aa.granted_at,
          'accepted_at', aa.accepted_at,
          'expires_at', aa.expires_at,
          'revoked_at', aa.revoked_at,
          'revoke_reason', aa.revoke_reason,
          'metadata', aa.metadata
        ))
      ) as item
    from public.advisor_assignments aa
    join public.businesses b on b.id = aa.business_id
    join public.business_listing_authority bla on bla.id = aa.authority_id
    join public.advisor_profiles ap on ap.profile_id = aa.profile_id
    join public.profiles p on p.id = aa.profile_id
    where aa.metadata->>'source' = 'advisor_session4_business_intake'
    order by aa.created_at desc
    limit 500
  ) q;

  return jsonb_build_object(
    'items', v_items,
    'access', jsonb_build_object(
      'mode', 'admin_review',
      'allowed_permissions', jsonb_build_array('profile'),
      'business_mutations_enabled', false,
      'publication_enabled', false
    )
  );
end;
$$;

create or replace function public.d68_admin_review_advisor_business_intake_v1(
  p_assignment_id uuid,
  p_decision text,
  p_expires_at timestamptz default null,
  p_permissions text[] default array['profile']::text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_assignment public.advisor_assignments;
  v_authority public.business_listing_authority;
  v_business public.businesses;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 2000), '');
  v_expiry timestamptz;
  v_action text;
begin
  if v_actor is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.role = 'admin'
      and p.status = 'active'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  p_decision := lower(btrim(coalesce(p_decision, '')));
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;

  select aa.* into v_assignment
  from public.advisor_assignments aa
  where aa.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Advisor Business intake assignment not found';
  end if;

  select bla.* into v_authority
  from public.business_listing_authority bla
  where bla.id = v_assignment.authority_id
    and bla.business_id = v_assignment.business_id
  for update;

  if not found then
    raise exception 'Matching Business authority not found';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_assignment.business_id
  for update;

  if not found then
    raise exception 'Business not found';
  end if;

  if v_assignment.metadata->>'source' <> 'advisor_session4_business_intake'
     or coalesce(v_assignment.metadata->>'admin_review_required', 'false') <> 'true'
     or v_assignment.status <> 'pending'
     or v_assignment.accepted_at is not null
     or v_authority.verification_status <> 'pending_review' then
    raise exception 'Business intake is no longer pending Admin authority review';
  end if;

  if v_business.owner_id is not null
     or v_business.visible is true
     or v_business.status <> 'draft'::public.account_status then
    raise exception 'Business intake state changed; manual reconciliation is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.advisor_profiles ap on ap.profile_id = p.id
    where p.id = v_assignment.profile_id
      and p.role = 'advisor'
      and p.status = 'active'
      and p.dashboard_login_enabled is true
      and ap.status = 'active'
      and ap.verification_status = 'verified'
  ) then
    raise exception 'Advisor profile is not active and verified';
  end if;

  if p_decision = 'approve' then
    if p_permissions is null
       or p_permissions <> array['profile']::text[] then
      raise exception 'Session 5 permits only the profile scope' using errcode = '22023';
    end if;

    v_expiry := coalesce(p_expires_at, now() + interval '180 days');
    if v_expiry <= now() + interval '1 hour'
       or v_expiry > now() + interval '365 days' then
      raise exception 'Authority expiry must be between 1 hour and 365 days from now' using errcode = '22023';
    end if;

    update public.business_listing_authority bla
    set verification_status = 'verified',
        verified_by = v_actor,
        verified_at = now(),
        expires_at = v_expiry,
        verification_reasons = coalesce(bla.verification_reasons, '[]'::jsonb)
          || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'code', 'advisor_intake_admin_approved',
            'reviewed_by', v_actor,
            'reviewed_at', now(),
            'note', v_note
          ))),
        report_policy = 'admin_only',
        updated_at = now()
    where bla.id = v_authority.id
    returning * into v_authority;

    update public.advisor_assignments aa
    set permissions = array['profile']::text[],
        granted_by = v_actor,
        granted_at = now(),
        expires_at = v_expiry,
        updated_by = v_actor,
        metadata = aa.metadata || jsonb_strip_nulls(jsonb_build_object(
          'admin_review_required', false,
          'admin_review_status', 'approved',
          'admin_reviewed_by', v_actor,
          'admin_reviewed_at', now(),
          'admin_review_note', v_note,
          'scope_policy', 'session5_profile_only'
        )),
        updated_at = now()
    where aa.id = v_assignment.id
    returning * into v_assignment;

    v_action := 'advisor.business_intake.authority_approved';
  else
    if v_note is null or length(v_note) < 5 then
      raise exception 'A rejection reason of at least 5 characters is required' using errcode = '22023';
    end if;

    update public.business_listing_authority bla
    set verification_status = 'rejected',
        verified_by = null,
        verified_at = null,
        expires_at = null,
        verification_reasons = coalesce(bla.verification_reasons, '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object(
            'code', 'advisor_intake_admin_rejected',
            'reviewed_by', v_actor,
            'reviewed_at', now(),
            'note', v_note
          )),
        report_policy = 'admin_only',
        updated_at = now()
    where bla.id = v_authority.id
    returning * into v_authority;

    update public.advisor_assignments aa
    set status = 'revoked',
        revoked_by = v_actor,
        revoked_at = now(),
        revoke_reason = v_note,
        updated_by = v_actor,
        metadata = aa.metadata || jsonb_build_object(
          'admin_review_required', false,
          'admin_review_status', 'rejected',
          'admin_reviewed_by', v_actor,
          'admin_reviewed_at', now(),
          'admin_review_note', v_note,
          'scope_policy', 'session5_profile_only'
        ),
        updated_at = now()
    where aa.id = v_assignment.id
    returning * into v_assignment;

    v_action := 'advisor.business_intake.authority_rejected';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    v_action,
    'advisor_assignment',
    v_assignment.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'business_id', v_assignment.business_id,
      'authority_id', v_assignment.authority_id,
      'advisor_profile_id', v_assignment.profile_id,
      'decision', p_decision,
      'permissions', to_jsonb(v_assignment.permissions),
      'expires_at', v_assignment.expires_at,
      'note', v_note,
      'business_status_unchanged', v_business.status::text,
      'business_visible_unchanged', v_business.visible
    ))
  );

  return jsonb_build_object(
    'assignment_id', v_assignment.id,
    'business_id', v_assignment.business_id,
    'authority_id', v_assignment.authority_id,
    'decision', p_decision,
    'authority_status', v_authority.verification_status::text,
    'assignment_status', v_assignment.status,
    'permissions', to_jsonb(v_assignment.permissions),
    'expires_at', v_assignment.expires_at,
    'can_advisor_accept', (
      v_authority.verification_status = 'verified'
      and v_assignment.status = 'pending'
      and v_assignment.accepted_at is null
    ),
    'business_status', v_business.status::text,
    'business_visible', v_business.visible
  );
end;
$$;

revoke all on function public.d68_admin_list_advisor_business_intakes_v1()
  from public, anon, authenticated;
revoke all on function public.d68_admin_review_advisor_business_intake_v1(uuid, text, timestamptz, text[], text)
  from public, anon, authenticated;

grant execute on function public.d68_admin_list_advisor_business_intakes_v1()
  to authenticated, service_role;
grant execute on function public.d68_admin_review_advisor_business_intake_v1(uuid, text, timestamptz, text[], text)
  to authenticated, service_role;

comment on function public.d68_admin_list_advisor_business_intakes_v1() is
  'Session 5 Admin-only allowlisted queue of Advisor-created Business intakes and authority review state.';
comment on function public.d68_admin_review_advisor_business_intake_v1(uuid, text, timestamptz, text[], text) is
  'Session 5 Admin approval/rejection of Session 4 authority. Approval leaves assignment pending for Advisor acceptance and permits only profile scope.';

-- Session 5 intentionally leaves Business RLS, Business ownership, publication,
-- payment creation and all direct Advisor Business mutation privileges unchanged.
