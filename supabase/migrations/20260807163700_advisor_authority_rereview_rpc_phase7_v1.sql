-- Deals68 Advisor/Broker — Session 7 authority expiry and re-review lifecycle.
-- A re-review returns a previously verified authority to pending_review, which
-- immediately closes Session 3 Business context access because that context
-- requires a verified and unexpired authority on every call.

create or replace function public.d68_admin_start_advisor_authority_rereview_v1(
  p_assignment_id uuid,
  p_note text
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
  v_note text := nullif(left(btrim(coalesce(p_note,'')),2000),'');
  v_cycle integer;
  v_rereview_id uuid;
  v_event_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) < 5 then
    raise exception 'Re-review reason must contain at least 5 characters' using errcode = '22023';
  end if;

  select aa.* into v_assignment
  from public.advisor_assignments aa
  where aa.id = p_assignment_id
    and aa.metadata->>'source' = 'advisor_session4_business_intake'
  for update;
  if not found
     or v_assignment.status not in ('pending','active','expired')
     or v_assignment.permissions <> array['profile']::text[] then
    raise exception 'Eligible Session 4 profile-only assignment required';
  end if;

  select bla.* into v_authority
  from public.business_listing_authority bla
  where bla.id = v_assignment.authority_id
    and bla.business_id = v_assignment.business_id
  for update;
  if not found or v_authority.verification_status <> 'verified' then
    raise exception 'Verified authority is required to start re-review';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_assignment.business_id
  for update;
  if not found
     or v_business.owner_id is not null
     or v_business.visible is true
     or v_business.status <> 'draft'::public.account_status then
    raise exception 'Business intake state changed; authority re-review is closed';
  end if;

  if exists (
    select 1 from public.advisor_authority_rereviews rr
    where rr.assignment_id = v_assignment.id and rr.status = 'pending'
  ) then
    raise exception 'Authority re-review is already pending' using errcode = '23505';
  end if;

  select coalesce(max(rr.cycle_no),0) + 1 into v_cycle
  from public.advisor_authority_rereviews rr
  where rr.assignment_id = v_assignment.id;

  insert into public.advisor_authority_rereviews(
    assignment_id, authority_id, business_id, cycle_no, status,
    started_by, reason, previous_verified_by, previous_verified_at, previous_expires_at
  ) values (
    v_assignment.id, v_authority.id, v_business.id, v_cycle, 'pending',
    v_actor, v_note, v_authority.verified_by, v_authority.verified_at, v_authority.expires_at
  ) returning id into v_rereview_id;

  update public.business_listing_authority bla
  set verification_status = 'pending_review',
      verified_by = null,
      verified_at = null,
      expires_at = null,
      verification_reasons = coalesce(bla.verification_reasons,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'code','advisor_authority_rereview_started',
        'note',v_note,
        'admin_id',v_actor,
        'rereview_id',v_rereview_id,
        'at',now()
      )),
      updated_at = now()
  where bla.id = v_authority.id;

  insert into public.advisor_authority_review_events(
    assignment_id, authority_id, business_id, actor_profile_id, actor_role,
    event_type, rereview_id, note, note_visible_to_advisor, event_data
  ) values (
    v_assignment.id, v_authority.id, v_business.id, v_actor, 'admin',
    'authority_rereview_started', v_rereview_id, v_note, true,
    jsonb_strip_nulls(jsonb_build_object(
      'cycle_no',v_cycle,
      'previous_expires_at',v_authority.expires_at,
      'assignment_status_unchanged',v_assignment.status,
      'business_status_unchanged',v_business.status::text,
      'business_visible_unchanged',v_business.visible
    ))
  ) returning id into v_event_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.business_intake.authority_rereview_started',
    'advisor_assignment',
    v_assignment.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'review_event_id',v_event_id,
      'rereview_id',v_rereview_id,
      'cycle_no',v_cycle,
      'authority_id',v_authority.id,
      'business_id',v_business.id,
      'advisor_profile_id',v_assignment.profile_id,
      'previous_expires_at',v_authority.expires_at,
      'note',v_note,
      'business_status_unchanged',v_business.status::text,
      'business_visible_unchanged',v_business.visible
    ))
  );

  return jsonb_build_object(
    'rereview_id',v_rereview_id,
    'assignment_id',v_assignment.id,
    'authority_id',v_authority.id,
    'cycle_no',v_cycle,
    'authority_status','pending_review',
    'assignment_status',v_assignment.status,
    'can_upload_evidence',true,
    'business_status',v_business.status::text,
    'business_visible',v_business.visible,
    'business_mutations_enabled',false,
    'context_access_suspended_by_authority',true
  );
end;
$$;

create or replace function public.d68_admin_review_advisor_authority_rereview_v1(
  p_rereview_id uuid,
  p_decision text,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_decision text := lower(btrim(coalesce(p_decision,'')));
  v_note text := nullif(left(btrim(coalesce(p_note,'')),2000),'');
  v_rereview public.advisor_authority_rereviews;
  v_assignment public.advisor_assignments;
  v_authority public.business_listing_authority;
  v_business public.businesses;
  v_valid_count integer;
  v_blocking_count integer;
  v_assignment_status text;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_decision not in ('approve','reject') then
    raise exception 'Re-review decision must be approve or reject' using errcode = '22023';
  end if;
  if v_decision = 'reject' and (v_note is null or char_length(v_note) < 5) then
    raise exception 'Re-review rejection reason must contain at least 5 characters' using errcode = '22023';
  end if;

  select rr.* into v_rereview
  from public.advisor_authority_rereviews rr
  where rr.id = p_rereview_id
  for update;
  if not found or v_rereview.status <> 'pending' then
    raise exception 'Pending authority re-review not found';
  end if;

  select aa.* into v_assignment
  from public.advisor_assignments aa
  where aa.id = v_rereview.assignment_id
    and aa.authority_id = v_rereview.authority_id
    and aa.business_id = v_rereview.business_id
    and aa.metadata->>'source' = 'advisor_session4_business_intake'
  for update;
  if not found
     or v_assignment.status not in ('pending','active','expired')
     or v_assignment.permissions <> array['profile']::text[] then
    raise exception 'Eligible Session 4 profile-only assignment required';
  end if;

  select bla.* into v_authority
  from public.business_listing_authority bla
  where bla.id = v_rereview.authority_id
    and bla.business_id = v_rereview.business_id
  for update;
  if not found or v_authority.verification_status <> 'pending_review' then
    raise exception 'Authority is no longer pending re-review';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_rereview.business_id
  for update;
  if not found
     or v_business.owner_id is not null
     or v_business.visible is true
     or v_business.status <> 'draft'::public.account_status then
    raise exception 'Business intake state changed; authority re-review requires reconciliation';
  end if;

  if v_decision = 'approve' then
    if p_expires_at is null
       or p_expires_at <= now() + interval '1 hour'
       or p_expires_at > now() + interval '365 days' then
      raise exception 'Re-reviewed authority expiry must be more than 1 hour and no more than 365 days from now' using errcode = '22023';
    end if;

    select count(*)::integer into v_valid_count
    from public.advisor_authority_evidence e
    where e.assignment_id = v_assignment.id
      and e.status = 'submitted'
      and e.superseded_at is null
      and e.validation_status = 'valid';

    select count(*)::integer into v_blocking_count
    from public.advisor_authority_evidence e
    where e.assignment_id = v_assignment.id
      and e.status = 'submitted'
      and e.superseded_at is null
      and e.validation_status in ('insufficient','invalid');

    if v_valid_count < 1 then
      raise exception 'At least one current valid authority evidence is required for re-review approval' using errcode = '22023';
    end if;
    if v_blocking_count > 0 then
      raise exception 'Resolve or replace all current insufficient/invalid evidence before re-review approval' using errcode = '22023';
    end if;

    -- Update authority first so the existing assignment validation trigger sees a
    -- verified, unexpired authority when expiry/status is synchronized below.
    update public.business_listing_authority bla
    set verification_status = 'verified',
        verified_by = v_actor,
        verified_at = now(),
        expires_at = p_expires_at,
        report_policy = 'admin_only',
        verification_reasons = coalesce(bla.verification_reasons,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'code','advisor_authority_rereview_approved',
          'note',v_note,
          'admin_id',v_actor,
          'rereview_id',v_rereview.id,
          'at',now()
        )),
        updated_at = now()
    where bla.id = v_authority.id;

    v_assignment_status := case when v_assignment.accepted_at is not null then 'active' else 'pending' end;

    update public.advisor_assignments aa
    set status = v_assignment_status,
        permissions = array['profile']::text[],
        expires_at = p_expires_at,
        updated_by = v_actor,
        metadata = coalesce(aa.metadata,'{}'::jsonb) || jsonb_build_object(
          'authority_rereview_status','approved',
          'authority_rereview_id',v_rereview.id,
          'authority_rereviewed_by',v_actor,
          'authority_rereviewed_at',now(),
          'scope_policy','session7_profile_only'
        )
    where aa.id = v_assignment.id;

    update public.advisor_authority_rereviews rr
    set status = 'approved',
        decision_by = v_actor,
        decided_at = now(),
        decision_note = v_note,
        new_expires_at = p_expires_at,
        updated_at = now()
    where rr.id = v_rereview.id;

    insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
    values (
      v_actor,
      'advisor.business_intake.authority_rereview_approved',
      'advisor_assignment',
      v_assignment.id::text,
      jsonb_build_object(
        'rereview_id',v_rereview.id,
        'authority_id',v_authority.id,
        'business_id',v_business.id,
        'advisor_profile_id',v_assignment.profile_id,
        'permissions',array['profile']::text[],
        'expires_at',p_expires_at,
        'valid_evidence_count',v_valid_count,
        'assignment_status',v_assignment_status,
        'business_status_unchanged',v_business.status::text,
        'business_visible_unchanged',v_business.visible
      )
    );
  else
    -- Rejection is terminal for the assignment. Session 5's assignment trigger
    -- explicitly permits revoked/expired terminal states even when authority is
    -- no longer verified.
    update public.business_listing_authority bla
    set verification_status = 'rejected',
        verified_by = null,
        verified_at = null,
        expires_at = null,
        report_policy = 'admin_only',
        verification_reasons = coalesce(bla.verification_reasons,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'code','advisor_authority_rereview_rejected',
          'note',v_note,
          'admin_id',v_actor,
          'rereview_id',v_rereview.id,
          'at',now()
        )),
        updated_at = now()
    where bla.id = v_authority.id;

    update public.advisor_assignments aa
    set status = 'revoked',
        revoked_by = v_actor,
        revoked_at = now(),
        revoke_reason = v_note,
        updated_by = v_actor,
        metadata = coalesce(aa.metadata,'{}'::jsonb) || jsonb_build_object(
          'authority_rereview_status','rejected',
          'authority_rereview_id',v_rereview.id,
          'authority_rereviewed_by',v_actor,
          'authority_rereviewed_at',now(),
          'scope_policy','session7_profile_only'
        )
    where aa.id = v_assignment.id;

    update public.advisor_authority_rereviews rr
    set status = 'rejected',
        decision_by = v_actor,
        decided_at = now(),
        decision_note = v_note,
        new_expires_at = null,
        updated_at = now()
    where rr.id = v_rereview.id;

    insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
    values (
      v_actor,
      'advisor.business_intake.authority_rereview_rejected',
      'advisor_assignment',
      v_assignment.id::text,
      jsonb_build_object(
        'rereview_id',v_rereview.id,
        'authority_id',v_authority.id,
        'business_id',v_business.id,
        'advisor_profile_id',v_assignment.profile_id,
        'permissions',array['profile']::text[],
        'assignment_status','revoked',
        'note',v_note,
        'business_status_unchanged',v_business.status::text,
        'business_visible_unchanged',v_business.visible
      )
    );
  end if;

  return jsonb_build_object(
    'rereview_id',v_rereview.id,
    'assignment_id',v_assignment.id,
    'authority_id',v_authority.id,
    'decision',v_decision,
    'authority_status',case when v_decision='approve' then 'verified' else 'rejected' end,
    'assignment_status',case when v_decision='approve' then v_assignment_status else 'revoked' end,
    'permissions',array['profile']::text[],
    'expires_at',case when v_decision='approve' then p_expires_at else null end,
    'business_status',v_business.status::text,
    'business_visible',v_business.visible,
    'business_mutations_enabled',false,
    'publication_enabled',false
  );
end;
$$;

revoke all on function public.d68_admin_start_advisor_authority_rereview_v1(uuid,text) from public, anon, authenticated;
revoke all on function public.d68_admin_review_advisor_authority_rereview_v1(uuid,text,timestamptz,text) from public, anon, authenticated;

grant execute on function public.d68_admin_start_advisor_authority_rereview_v1(uuid,text) to authenticated, service_role;
grant execute on function public.d68_admin_review_advisor_authority_rereview_v1(uuid,text,timestamptz,text) to authenticated, service_role;

comment on function public.d68_admin_start_advisor_authority_rereview_v1(uuid,text) is
  'Session 7 starts a governed re-review for previously verified authority and closes Business context through the verified-authority gate.';
comment on function public.d68_admin_review_advisor_authority_rereview_v1(uuid,text,timestamptz,text) is
  'Session 7 approves or rejects a pending re-review. Approval requires current valid evidence and remains profile-only; rejection revokes assignment.';

-- Explicit Session 7 re-review boundary:
-- * Business rows are locked only for reconciliation and never mutated;
-- * re-review approval does not grant new scopes;
-- * authority expiry and assignment expiry are synchronized only after Admin approval;
-- * no public listing or Business ownership transition occurs.