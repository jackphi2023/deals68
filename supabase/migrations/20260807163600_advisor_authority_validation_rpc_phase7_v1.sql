-- Deals68 Advisor/Broker — Session 7 evidence validation and replacement RPCs.
-- These RPCs preserve the Session 6 private Storage model and add no Business mutation.

create or replace function public.d68_advisor_begin_authority_evidence_v2(
  p_assignment_id uuid,
  p_document_type text,
  p_original_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_note text default null,
  p_replaces_evidence_id uuid default null
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
  v_rereview public.advisor_authority_rereviews;
  v_replaced public.advisor_authority_evidence;
  v_evidence_id uuid := gen_random_uuid();
  v_document_type text := lower(btrim(coalesce(p_document_type,'')));
  v_original_name text := btrim(coalesce(p_original_name,''));
  v_mime text := lower(btrim(coalesce(p_mime_type,'')));
  v_note text := nullif(left(btrim(coalesce(p_note,'')),500),'');
  v_extension text;
  v_path text;
  v_active_count integer;
begin
  if v_actor is null or not exists (
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
    raise exception 'Active verified Advisor access required' using errcode = '42501';
  end if;

  if v_document_type not in ('authorization_letter','mandate','ownership_proof','identity','other') then
    raise exception 'Unsupported authority evidence type' using errcode = '22023';
  end if;
  if char_length(v_original_name) < 1 or char_length(v_original_name) > 180 then
    raise exception 'Evidence file name must be between 1 and 180 characters' using errcode = '22023';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 10485760 then
    raise exception 'Authority evidence must be 10 MB or smaller' using errcode = '22023';
  end if;

  v_extension := case v_mime
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    else null
  end;
  if v_extension is null then
    raise exception 'Only PDF, JPEG, PNG or WebP authority evidence is allowed' using errcode = '22023';
  end if;

  select aa.* into v_assignment
  from public.advisor_assignments aa
  where aa.id = p_assignment_id
    and aa.profile_id = v_actor
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
  if not found or v_authority.verification_status <> 'pending_review' then
    raise exception 'Authority is not pending Admin review';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_assignment.business_id
  for update;
  if not found
     or v_business.owner_id is not null
     or v_business.visible is true
     or v_business.status <> 'draft'::public.account_status then
    raise exception 'Business intake state changed; authority evidence upload is closed';
  end if;

  select rr.* into v_rereview
  from public.advisor_authority_rereviews rr
  where rr.assignment_id = v_assignment.id
    and rr.authority_id = v_authority.id
    and rr.status = 'pending'
  order by rr.started_at desc
  limit 1;

  if not (
    (v_assignment.status = 'pending' and v_assignment.accepted_at is null)
    or v_rereview.id is not null
  ) then
    raise exception 'Authority re-review is not open for evidence submission';
  end if;

  if p_replaces_evidence_id is not null then
    select e.* into v_replaced
    from public.advisor_authority_evidence e
    where e.id = p_replaces_evidence_id
    for update;
    if not found
       or v_replaced.assignment_id <> v_assignment.id
       or v_replaced.authority_id <> v_authority.id
       or v_replaced.advisor_profile_id <> v_actor
       or v_replaced.status <> 'submitted'
       or v_replaced.validation_status not in ('insufficient','invalid')
       or v_replaced.superseded_at is not null then
      raise exception 'Replacement target must be a current insufficient or invalid submitted evidence' using errcode = '22023';
    end if;
  end if;

  select count(*)::integer into v_active_count
  from public.advisor_authority_evidence e
  where e.assignment_id = v_assignment.id
    and e.status = 'submitted'
    and e.superseded_at is null;

  if v_active_count >= 8 and p_replaces_evidence_id is null then
    raise exception 'Maximum 8 current authority evidence files per intake' using errcode = '22023';
  end if;
  if (select count(*) from public.advisor_authority_evidence e
      where e.advisor_profile_id = v_actor and e.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Authority evidence upload allocation limit reached' using errcode = '22023';
  end if;

  v_path := v_authority.id::text || '/' || v_actor::text || '/' || v_evidence_id::text || '.' || v_extension;

  insert into public.advisor_authority_evidence(
    id, assignment_id, authority_id, business_id, advisor_profile_id,
    document_type, original_name, mime_type, file_size_bytes,
    storage_bucket, storage_path, status, note, upload_expires_at, replaces_evidence_id
  ) values (
    v_evidence_id, v_assignment.id, v_authority.id, v_business.id, v_actor,
    v_document_type, v_original_name, v_mime, p_file_size_bytes,
    'advisor-authority-evidence-private', v_path, 'pending_upload', v_note,
    now() + interval '2 hours', p_replaces_evidence_id
  );

  return jsonb_strip_nulls(jsonb_build_object(
    'evidence_id', v_evidence_id,
    'assignment_id', v_assignment.id,
    'authority_id', v_authority.id,
    'business_id', v_business.id,
    'rereview_id', v_rereview.id,
    'replaces_evidence_id', p_replaces_evidence_id,
    'storage_bucket', 'advisor-authority-evidence-private',
    'storage_path', v_path,
    'upload_expires_at', now() + interval '2 hours',
    'max_current_files', 8,
    'max_file_size_bytes', 10485760,
    'immutable_after_submit', true
  ));
end;
$$;

create or replace function public.d68_advisor_complete_authority_evidence_v2(
  p_evidence_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_evidence public.advisor_authority_evidence;
  v_assignment public.advisor_assignments;
  v_authority public.business_listing_authority;
  v_business public.businesses;
  v_rereview public.advisor_authority_rereviews;
  v_replaced public.advisor_authority_evidence;
  v_owner uuid;
  v_owner_id text;
  v_metadata jsonb;
  v_actual_size bigint;
  v_actual_mime text;
begin
  if v_actor is null then
    raise exception 'Advisor authentication required' using errcode = '42501';
  end if;

  select e.* into v_evidence
  from public.advisor_authority_evidence e
  where e.id = p_evidence_id
  for update;
  if not found or v_evidence.advisor_profile_id <> v_actor then
    raise exception 'Authority evidence allocation not found' using errcode = '42501';
  end if;

  if v_evidence.status = 'submitted' then
    return jsonb_strip_nulls(jsonb_build_object(
      'evidence_id', v_evidence.id,
      'status', 'submitted',
      'submitted_at', v_evidence.submitted_at,
      'replaces_evidence_id', v_evidence.replaces_evidence_id,
      'idempotent_replay', true
    ));
  end if;
  if v_evidence.upload_expires_at <= now() then
    raise exception 'Authority evidence upload allocation expired';
  end if;

  select aa.* into v_assignment
  from public.advisor_assignments aa
  where aa.id = v_evidence.assignment_id
    and aa.profile_id = v_actor
    and aa.business_id = v_evidence.business_id
    and aa.authority_id = v_evidence.authority_id
    and aa.metadata->>'source' = 'advisor_session4_business_intake'
    and aa.status in ('pending','active','expired')
    and aa.permissions = array['profile']::text[]
  for update;
  if not found then
    raise exception 'Eligible Session 4 profile-only assignment required';
  end if;

  select bla.* into v_authority
  from public.business_listing_authority bla
  where bla.id = v_evidence.authority_id
    and bla.business_id = v_evidence.business_id
    and bla.verification_status = 'pending_review'
  for update;
  if not found then
    raise exception 'Authority is no longer pending Admin review';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_evidence.business_id
  for update;
  if not found
     or v_business.owner_id is not null
     or v_business.visible is true
     or v_business.status <> 'draft'::public.account_status then
    raise exception 'Business intake state changed; authority evidence completion is closed';
  end if;

  select rr.* into v_rereview
  from public.advisor_authority_rereviews rr
  where rr.assignment_id = v_assignment.id
    and rr.authority_id = v_authority.id
    and rr.status = 'pending'
  order by rr.started_at desc
  limit 1;

  if not (
    (v_assignment.status = 'pending' and v_assignment.accepted_at is null)
    or v_rereview.id is not null
  ) then
    raise exception 'Authority re-review is not open for evidence submission';
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
    raise exception 'Active verified Advisor access required' using errcode = '42501';
  end if;

  select o.owner, o.owner_id, o.metadata
  into v_owner, v_owner_id, v_metadata
  from storage.objects o
  where o.bucket_id = v_evidence.storage_bucket
    and o.name = v_evidence.storage_path
  limit 1;
  if not found or coalesce(v_owner_id, v_owner::text, '') <> v_actor::text then
    raise exception 'Uploaded authority evidence object not found or owner mismatch';
  end if;

  begin
    v_actual_size := nullif(v_metadata->>'size','')::bigint;
  exception when others then
    v_actual_size := null;
  end;
  v_actual_mime := lower(coalesce(v_metadata->>'mimetype', v_metadata->>'contentType', ''));
  if v_actual_size is null or v_actual_size <> v_evidence.file_size_bytes then
    raise exception 'Uploaded authority evidence size does not match allocation';
  end if;
  if v_actual_mime <> v_evidence.mime_type then
    raise exception 'Uploaded authority evidence MIME type does not match allocation';
  end if;

  if v_evidence.replaces_evidence_id is not null then
    select e.* into v_replaced
    from public.advisor_authority_evidence e
    where e.id = v_evidence.replaces_evidence_id
    for update;
    if not found
       or v_replaced.assignment_id <> v_assignment.id
       or v_replaced.advisor_profile_id <> v_actor
       or v_replaced.status <> 'submitted'
       or v_replaced.validation_status not in ('insufficient','invalid')
       or v_replaced.superseded_at is not null then
      raise exception 'Replacement target is no longer eligible';
    end if;
  end if;

  update public.advisor_authority_evidence e
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where e.id = v_evidence.id
  returning * into v_evidence;

  if v_replaced.id is not null then
    update public.advisor_authority_evidence e
    set superseded_by_evidence_id = v_evidence.id,
        superseded_at = now(),
        updated_at = now()
    where e.id = v_replaced.id;
  end if;

  update public.business_listing_authority bla
  set authority_document_ids = case
        when v_evidence.id = any(bla.authority_document_ids) then bla.authority_document_ids
        else array_append(bla.authority_document_ids, v_evidence.id)
      end,
      updated_at = now()
  where bla.id = v_evidence.authority_id;

  insert into public.advisor_authority_review_events(
    assignment_id, authority_id, business_id, actor_profile_id, actor_role,
    event_type, rereview_id, evidence_id, note, note_visible_to_advisor, event_data
  ) values (
    v_evidence.assignment_id,
    v_evidence.authority_id,
    v_evidence.business_id,
    v_actor,
    'advisor',
    'evidence_submitted',
    v_rereview.id,
    v_evidence.id,
    v_evidence.note,
    true,
    jsonb_strip_nulls(jsonb_build_object(
      'document_type', v_evidence.document_type,
      'original_name', v_evidence.original_name,
      'mime_type', v_evidence.mime_type,
      'file_size_bytes', v_evidence.file_size_bytes,
      'replaces_evidence_id', v_evidence.replaces_evidence_id
    ))
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.authority_evidence.submitted',
    'advisor_authority_evidence',
    v_evidence.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'assignment_id', v_evidence.assignment_id,
      'authority_id', v_evidence.authority_id,
      'business_id', v_evidence.business_id,
      'rereview_id', v_rereview.id,
      'replaces_evidence_id', v_evidence.replaces_evidence_id,
      'document_type', v_evidence.document_type,
      'file_size_bytes', v_evidence.file_size_bytes,
      'storage_bucket', v_evidence.storage_bucket,
      'storage_path', v_evidence.storage_path
    ))
  );

  return jsonb_strip_nulls(jsonb_build_object(
    'evidence_id', v_evidence.id,
    'status', v_evidence.status,
    'submitted_at', v_evidence.submitted_at,
    'authority_status', v_authority.verification_status::text,
    'rereview_id', v_rereview.id,
    'replaces_evidence_id', v_evidence.replaces_evidence_id,
    'business_mutations_enabled', false,
    'idempotent_replay', false
  ));
end;
$$;

create or replace function public.d68_admin_validate_advisor_authority_evidence_v1(
  p_evidence_id uuid,
  p_validation_status text,
  p_note text default null,
  p_request_replacement boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status text := lower(btrim(coalesce(p_validation_status,'')));
  v_note text := nullif(left(btrim(coalesce(p_note,'')),2000),'');
  v_evidence public.advisor_authority_evidence;
  v_assignment public.advisor_assignments;
  v_authority public.business_listing_authority;
  v_business public.businesses;
  v_rereview public.advisor_authority_rereviews;
  v_event_id uuid;
  v_replacement_event_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if v_status not in ('valid','insufficient','invalid') then
    raise exception 'Evidence validation must be valid, insufficient or invalid' using errcode = '22023';
  end if;
  if v_status in ('insufficient','invalid') and (v_note is null or char_length(v_note) < 5) then
    raise exception 'Insufficient or invalid evidence requires a note of at least 5 characters' using errcode = '22023';
  end if;
  if p_request_replacement and v_status not in ('insufficient','invalid') then
    raise exception 'Replacement can be requested only for insufficient or invalid evidence' using errcode = '22023';
  end if;

  select e.* into v_evidence
  from public.advisor_authority_evidence e
  where e.id = p_evidence_id
  for update;
  if not found
     or v_evidence.status <> 'submitted'
     or v_evidence.superseded_at is not null then
    raise exception 'Current submitted authority evidence required';
  end if;

  select aa.* into v_assignment
  from public.advisor_assignments aa
  where aa.id = v_evidence.assignment_id
    and aa.authority_id = v_evidence.authority_id
    and aa.business_id = v_evidence.business_id
    and aa.metadata->>'source' = 'advisor_session4_business_intake'
  for update;
  if not found or v_assignment.permissions <> array['profile']::text[] then
    raise exception 'Session 4 profile-only assignment required';
  end if;

  select bla.* into v_authority
  from public.business_listing_authority bla
  where bla.id = v_evidence.authority_id
    and bla.business_id = v_evidence.business_id
  for update;
  if not found or v_authority.verification_status <> 'pending_review' then
    raise exception 'Authority is not pending review';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_evidence.business_id
  for update;
  if not found
     or v_business.owner_id is not null
     or v_business.visible is true
     or v_business.status <> 'draft'::public.account_status then
    raise exception 'Business intake state changed; evidence validation is closed';
  end if;

  select rr.* into v_rereview
  from public.advisor_authority_rereviews rr
  where rr.assignment_id = v_assignment.id
    and rr.authority_id = v_authority.id
    and rr.status = 'pending'
  order by rr.started_at desc
  limit 1;

  if not (
    (v_assignment.status = 'pending' and v_assignment.accepted_at is null)
    or v_rereview.id is not null
  ) then
    raise exception 'No open initial review or authority re-review exists';
  end if;

  update public.advisor_authority_evidence e
  set validation_status = v_status,
      validation_note = v_note,
      validated_by = v_actor,
      validated_at = now(),
      updated_at = now()
  where e.id = v_evidence.id
  returning * into v_evidence;

  insert into public.advisor_authority_review_events(
    assignment_id, authority_id, business_id, actor_profile_id, actor_role,
    event_type, rereview_id, evidence_id, note, note_visible_to_advisor, event_data
  ) values (
    v_assignment.id,
    v_authority.id,
    v_business.id,
    v_actor,
    'admin',
    'evidence_validated',
    v_rereview.id,
    v_evidence.id,
    v_note,
    false,
    jsonb_build_object(
      'validation_status', v_status,
      'request_replacement', p_request_replacement
    )
  ) returning id into v_event_id;

  if p_request_replacement then
    insert into public.advisor_authority_review_events(
      assignment_id, authority_id, business_id, actor_profile_id, actor_role,
      event_type, rereview_id, evidence_id, note, note_visible_to_advisor, event_data
    ) values (
      v_assignment.id,
      v_authority.id,
      v_business.id,
      v_actor,
      'admin',
      'evidence_replacement_requested',
      v_rereview.id,
      v_evidence.id,
      v_note,
      true,
      jsonb_build_object('validation_status', v_status)
    ) returning id into v_replacement_event_id;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.authority_evidence.validated',
    'advisor_authority_evidence',
    v_evidence.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'assignment_id', v_assignment.id,
      'authority_id', v_authority.id,
      'business_id', v_business.id,
      'rereview_id', v_rereview.id,
      'validation_status', v_status,
      'request_replacement', p_request_replacement,
      'validation_event_id', v_event_id,
      'replacement_event_id', v_replacement_event_id
    ))
  );

  return jsonb_strip_nulls(jsonb_build_object(
    'evidence_id', v_evidence.id,
    'validation_status', v_evidence.validation_status,
    'validated_at', v_evidence.validated_at,
    'request_replacement', p_request_replacement,
    'review_event_id', v_event_id,
    'replacement_event_id', v_replacement_event_id,
    'business_status', v_business.status::text,
    'business_visible', v_business.visible,
    'business_mutations_enabled', false
  ));
end;
$$;

create or replace function public.d68_admin_request_advisor_authority_evidence_v2(
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
  v_rereview public.advisor_authority_rereviews;
  v_note text := nullif(left(btrim(coalesce(p_note,'')),2000),'');
  v_event_id uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) < 5 then
    raise exception 'Evidence request note must contain at least 5 characters' using errcode = '22023';
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
  if not found or v_authority.verification_status <> 'pending_review' then
    raise exception 'Authority is no longer pending Admin review';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_assignment.business_id
  for update;
  if not found
     or v_business.owner_id is not null
     or v_business.visible is true
     or v_business.status <> 'draft'::public.account_status then
    raise exception 'Business intake state changed; manual reconciliation is required';
  end if;

  select rr.* into v_rereview
  from public.advisor_authority_rereviews rr
  where rr.assignment_id = v_assignment.id
    and rr.authority_id = v_authority.id
    and rr.status = 'pending'
  order by rr.started_at desc
  limit 1;

  if not (
    (v_assignment.status = 'pending' and v_assignment.accepted_at is null)
    or v_rereview.id is not null
  ) then
    raise exception 'No open initial review or authority re-review exists';
  end if;

  if (select count(*) from public.advisor_authority_review_events ev
      where ev.assignment_id = v_assignment.id
        and ev.event_type in ('evidence_requested','evidence_replacement_requested')
        and ev.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Evidence request rate limit reached' using errcode = '22023';
  end if;

  insert into public.advisor_authority_review_events(
    assignment_id, authority_id, business_id, actor_profile_id, actor_role,
    event_type, rereview_id, note, note_visible_to_advisor, event_data
  ) values (
    v_assignment.id,
    v_authority.id,
    v_business.id,
    v_actor,
    'admin',
    'evidence_requested',
    v_rereview.id,
    v_note,
    true,
    jsonb_build_object(
      'business_status_unchanged',v_business.status::text,
      'business_visible_unchanged',v_business.visible,
      'rereview',v_rereview.id is not null
    )
  ) returning id into v_event_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.business_intake.evidence_requested',
    'advisor_assignment',
    v_assignment.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'review_event_id', v_event_id,
      'rereview_id', v_rereview.id,
      'business_id', v_business.id,
      'authority_id', v_authority.id,
      'advisor_profile_id', v_assignment.profile_id,
      'note', v_note,
      'business_status_unchanged', v_business.status::text,
      'business_visible_unchanged', v_business.visible
    ))
  );

  return jsonb_strip_nulls(jsonb_build_object(
    'review_event_id', v_event_id,
    'rereview_id', v_rereview.id,
    'assignment_id', v_assignment.id,
    'authority_id', v_authority.id,
    'status', 'evidence_requested',
    'business_status', v_business.status::text,
    'business_visible', v_business.visible,
    'business_mutations_enabled', false
  ));
end;
$$;

revoke all on function public.d68_advisor_begin_authority_evidence_v2(uuid,text,text,text,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.d68_advisor_complete_authority_evidence_v2(uuid) from public, anon, authenticated;
revoke all on function public.d68_admin_validate_advisor_authority_evidence_v1(uuid,text,text,boolean) from public, anon, authenticated;
revoke all on function public.d68_admin_request_advisor_authority_evidence_v2(uuid,text) from public, anon, authenticated;

grant execute on function public.d68_advisor_begin_authority_evidence_v2(uuid,text,text,text,bigint,text,uuid) to authenticated, service_role;
grant execute on function public.d68_advisor_complete_authority_evidence_v2(uuid) to authenticated, service_role;
grant execute on function public.d68_admin_validate_advisor_authority_evidence_v1(uuid,text,text,boolean) to authenticated, service_role;
grant execute on function public.d68_admin_request_advisor_authority_evidence_v2(uuid,text) to authenticated, service_role;

comment on function public.d68_advisor_begin_authority_evidence_v2(uuid,text,text,text,bigint,text,uuid) is
  'Session 7 allocates original, replacement or re-review authority evidence for a verified Advisor without Business mutation.';
comment on function public.d68_advisor_complete_authority_evidence_v2(uuid) is
  'Session 7 finalizes allocated evidence and atomically supersedes a prior insufficient/invalid evidence when applicable.';
comment on function public.d68_admin_validate_advisor_authority_evidence_v1(uuid,text,text,boolean) is
  'Session 7 classifies current submitted evidence as valid, insufficient or invalid and may create an Advisor-visible replacement request.';
comment on function public.d68_admin_request_advisor_authority_evidence_v2(uuid,text) is
  'Session 7 requests additional evidence during either initial authority review or an explicit authority re-review.';

-- Explicit Session 7 RPC boundary:
-- * frontend-supplied permissions are not accepted;
-- * assignment scope must already equal exactly ['profile'];
-- * no UPDATE/INSERT/DELETE against public.businesses occurs;
-- * submitted file payload remains immutable; only Admin validation/supersession metadata can change.