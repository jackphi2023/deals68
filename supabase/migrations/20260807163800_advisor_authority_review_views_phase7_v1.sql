-- Deals68 Advisor/Broker — Session 7 read surfaces.
-- Advisor sees only their own validation status and Advisor-visible review notes.
-- Admin receives the Session 6 allowlist enriched with validation and re-review state.

create or replace function public.d68_get_my_authority_review_v2(
  p_assignment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_assignment public.advisor_assignments;
  v_authority public.business_listing_authority;
  v_rereview public.advisor_authority_rereviews;
  v_evidence jsonb;
  v_history jsonb;
  v_rereview_json jsonb;
  v_can_upload boolean := false;
  v_lifecycle text;
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

  select aa.* into v_assignment
  from public.advisor_assignments aa
  where aa.id = p_assignment_id
    and aa.profile_id = v_actor
    and aa.metadata->>'source' = 'advisor_session4_business_intake';
  if not found then
    raise exception 'Session 4 Advisor intake assignment not found' using errcode = '42501';
  end if;

  select bla.* into v_authority
  from public.business_listing_authority bla
  where bla.id = v_assignment.authority_id
    and bla.business_id = v_assignment.business_id;
  if not found then
    raise exception 'Matching Business authority not found';
  end if;

  select rr.* into v_rereview
  from public.advisor_authority_rereviews rr
  where rr.assignment_id = v_assignment.id
  order by rr.cycle_no desc
  limit 1;

  v_can_upload := v_authority.verification_status = 'pending_review'
    and v_assignment.status in ('pending','active','expired')
    and v_assignment.permissions = array['profile']::text[]
    and (
      (v_assignment.status = 'pending' and v_assignment.accepted_at is null)
      or (v_rereview.id is not null and v_rereview.status = 'pending')
    );

  v_lifecycle := case
    when v_rereview.id is not null and v_rereview.status = 'pending' then 'rereview_pending'
    when v_authority.verification_status = 'rejected' then 'rejected'
    when v_authority.verification_status = 'pending_review' then 'initial_pending'
    when v_authority.verification_status = 'verified' and v_authority.expires_at <= now() then 'expired'
    when v_authority.verification_status = 'verified' and v_authority.expires_at <= now() + interval '30 days' then 'expiring_soon'
    when v_authority.verification_status = 'verified' then 'verified_current'
    else v_authority.verification_status::text
  end;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'evidence_id', e.id,
    'document_type', e.document_type,
    'original_name', e.original_name,
    'mime_type', e.mime_type,
    'file_size_bytes', e.file_size_bytes,
    'storage_bucket', e.storage_bucket,
    'storage_path', e.storage_path,
    'note', e.note,
    'submitted_at', e.submitted_at,
    'validation_status', e.validation_status,
    'validated_at', e.validated_at,
    'replaces_evidence_id', e.replaces_evidence_id,
    'superseded_by_evidence_id', e.superseded_by_evidence_id,
    'superseded_at', e.superseded_at
  )) order by e.submitted_at desc), '[]'::jsonb)
  into v_evidence
  from public.advisor_authority_evidence e
  where e.assignment_id = v_assignment.id and e.status = 'submitted';

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'event_id', ev.id,
    'event_type', ev.event_type,
    'actor_role', ev.actor_role,
    'evidence_id', ev.evidence_id,
    'rereview_id', ev.rereview_id,
    'note', case when ev.note_visible_to_advisor then ev.note else null end,
    'created_at', ev.created_at
  )) order by ev.created_at asc), '[]'::jsonb)
  into v_history
  from public.advisor_authority_review_events ev
  where ev.assignment_id = v_assignment.id;

  v_rereview_json := case when v_rereview.id is null then null else jsonb_strip_nulls(jsonb_build_object(
    'rereview_id',v_rereview.id,
    'cycle_no',v_rereview.cycle_no,
    'status',v_rereview.status,
    'started_at',v_rereview.started_at,
    'reason',v_rereview.reason,
    'previous_expires_at',v_rereview.previous_expires_at,
    'decided_at',v_rereview.decided_at,
    'new_expires_at',v_rereview.new_expires_at
  )) end;

  return jsonb_strip_nulls(jsonb_build_object(
    'assignment_id', v_assignment.id,
    'business_id', v_assignment.business_id,
    'authority_id', v_authority.id,
    'assignment_status', v_assignment.status,
    'authority_status', v_authority.verification_status::text,
    'authority_expires_at', v_authority.expires_at,
    'authority_lifecycle_status', v_lifecycle,
    'can_upload', v_can_upload,
    'evidence', v_evidence,
    'review_history', v_history,
    'current_rereview', v_rereview_json,
    'access', jsonb_build_object(
      'bucket', 'advisor-authority-evidence-private',
      'max_current_files', 8,
      'max_file_size_bytes', 10485760,
      'allowed_mime_types', jsonb_build_array('application/pdf','image/jpeg','image/png','image/webp'),
      'immutable_after_submit', true,
      'replacement_upload_enabled', true,
      'business_mutations_enabled', false
    )
  ));
end;
$$;

create or replace function public.d68_admin_list_advisor_business_intakes_v3()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_base jsonb;
  v_items jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  v_base := public.d68_admin_list_advisor_business_intakes_v2();

  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'evidence_count', (
        select count(*) from public.advisor_authority_evidence e
        where e.assignment_id = (item->>'assignment_id')::uuid
          and e.status = 'submitted'
          and e.superseded_at is null
      ),
      'total_evidence_count', (
        select count(*) from public.advisor_authority_evidence e
        where e.assignment_id = (item->>'assignment_id')::uuid
          and e.status = 'submitted'
      ),
      'evidence_validation_summary', jsonb_build_object(
        'unreviewed', (select count(*) from public.advisor_authority_evidence e where e.assignment_id=(item->>'assignment_id')::uuid and e.status='submitted' and e.superseded_at is null and e.validation_status='unreviewed'),
        'valid', (select count(*) from public.advisor_authority_evidence e where e.assignment_id=(item->>'assignment_id')::uuid and e.status='submitted' and e.superseded_at is null and e.validation_status='valid'),
        'insufficient', (select count(*) from public.advisor_authority_evidence e where e.assignment_id=(item->>'assignment_id')::uuid and e.status='submitted' and e.superseded_at is null and e.validation_status='insufficient'),
        'invalid', (select count(*) from public.advisor_authority_evidence e where e.assignment_id=(item->>'assignment_id')::uuid and e.status='submitted' and e.superseded_at is null and e.validation_status='invalid')
      ),
      'evidence', (
        select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'evidence_id', e.id,
          'document_type', e.document_type,
          'original_name', e.original_name,
          'mime_type', e.mime_type,
          'file_size_bytes', e.file_size_bytes,
          'storage_bucket', e.storage_bucket,
          'storage_path', e.storage_path,
          'note', e.note,
          'submitted_at', e.submitted_at,
          'validation_status', e.validation_status,
          'validation_note', e.validation_note,
          'validated_by', e.validated_by,
          'validated_at', e.validated_at,
          'replaces_evidence_id', e.replaces_evidence_id,
          'superseded_by_evidence_id', e.superseded_by_evidence_id,
          'superseded_at', e.superseded_at
        )) order by e.submitted_at desc), '[]'::jsonb)
        from public.advisor_authority_evidence e
        where e.assignment_id = (item->>'assignment_id')::uuid and e.status = 'submitted'
      ),
      'review_history', (
        select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'event_id', ev.id,
          'event_type', ev.event_type,
          'actor_role', ev.actor_role,
          'actor_profile_id', ev.actor_profile_id,
          'evidence_id', ev.evidence_id,
          'rereview_id', ev.rereview_id,
          'note', ev.note,
          'note_visible_to_advisor', ev.note_visible_to_advisor,
          'event_data', ev.event_data,
          'created_at', ev.created_at
        )) order by ev.created_at asc), '[]'::jsonb)
        from public.advisor_authority_review_events ev
        where ev.assignment_id = (item->>'assignment_id')::uuid
      ),
      'current_rereview', (
        select jsonb_strip_nulls(jsonb_build_object(
          'rereview_id',rr.id,
          'cycle_no',rr.cycle_no,
          'status',rr.status,
          'started_by',rr.started_by,
          'started_at',rr.started_at,
          'reason',rr.reason,
          'previous_expires_at',rr.previous_expires_at,
          'decision_by',rr.decision_by,
          'decided_at',rr.decided_at,
          'decision_note',rr.decision_note,
          'new_expires_at',rr.new_expires_at
        ))
        from public.advisor_authority_rereviews rr
        where rr.assignment_id = (item->>'assignment_id')::uuid
        order by rr.cycle_no desc
        limit 1
      ),
      'authority_lifecycle_status', (
        select case
          when exists (
            select 1 from public.advisor_authority_rereviews rr
            where rr.assignment_id=(item->>'assignment_id')::uuid and rr.status='pending'
          ) then 'rereview_pending'
          when bla.verification_status='rejected' then 'rejected'
          when bla.verification_status='pending_review' then 'initial_pending'
          when bla.verification_status='verified' and bla.expires_at <= now() then 'expired'
          when bla.verification_status='verified' and bla.expires_at <= now() + interval '30 days' then 'expiring_soon'
          when bla.verification_status='verified' then 'verified_current'
          else bla.verification_status::text
        end
        from public.business_listing_authority bla
        where bla.id=(item->>'authority_id')::uuid
      ),
      'can_validate_evidence', (
        select bla.verification_status='pending_review'
          and (
            coalesce((item->>'can_review')::boolean,false)
            or exists (
              select 1 from public.advisor_authority_rereviews rr
              where rr.assignment_id=(item->>'assignment_id')::uuid and rr.status='pending'
            )
          )
        from public.business_listing_authority bla
        where bla.id=(item->>'authority_id')::uuid
      ),
      'can_request_evidence', (
        select bla.verification_status='pending_review'
          and (
            coalesce((item->>'can_review')::boolean,false)
            or exists (
              select 1 from public.advisor_authority_rereviews rr
              where rr.assignment_id=(item->>'assignment_id')::uuid and rr.status='pending'
            )
          )
        from public.business_listing_authority bla
        where bla.id=(item->>'authority_id')::uuid
      ),
      'can_start_rereview', (
        select bla.verification_status='verified'
          and aa.status in ('pending','active','expired')
          and aa.permissions = array['profile']::text[]
          and not exists (
            select 1 from public.advisor_authority_rereviews rr
            where rr.assignment_id=aa.id and rr.status='pending'
          )
        from public.advisor_assignments aa
        join public.business_listing_authority bla on bla.id=aa.authority_id
        where aa.id=(item->>'assignment_id')::uuid
      ),
      'can_review_rereview', exists (
        select 1 from public.advisor_authority_rereviews rr
        where rr.assignment_id=(item->>'assignment_id')::uuid and rr.status='pending'
      )
    ) order by ord
  ), '[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_base->'items','[]'::jsonb)) with ordinality as q(item, ord);

  return jsonb_build_object(
    'items', v_items,
    'access', coalesce(v_base->'access','{}'::jsonb) || jsonb_build_object(
      'authority_evidence_enabled', true,
      'evidence_download_enabled', true,
      'evidence_request_enabled', true,
      'evidence_validation_enabled', true,
      'replacement_evidence_enabled', true,
      'authority_rereview_enabled', true,
      'business_mutations_enabled', false,
      'publication_enabled', false
    )
  );
end;
$$;

revoke all on function public.d68_get_my_authority_review_v2(uuid) from public, anon, authenticated;
revoke all on function public.d68_admin_list_advisor_business_intakes_v3() from public, anon, authenticated;

grant execute on function public.d68_get_my_authority_review_v2(uuid) to authenticated, service_role;
grant execute on function public.d68_admin_list_advisor_business_intakes_v3() to authenticated, service_role;

comment on function public.d68_get_my_authority_review_v2(uuid) is
  'Session 7 returns only the calling Advisor own evidence validation state, replacement requests and re-review lifecycle; Admin-internal notes remain redacted.';
comment on function public.d68_admin_list_advisor_business_intakes_v3() is
  'Session 7 enriches the Session 6 Admin allowlist with evidence validation summaries, expiry lifecycle and governed re-review controls.';

-- Explicit Session 7 read boundary:
-- * Advisor response includes no Business financials, dataroom, proposals, requests, payments or reports;
-- * Admin queue still wraps the Session 5/6 allowlisted Business representation;
-- * neither function performs writes.