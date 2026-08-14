-- Deals68 Advisor/Broker — Session 6 Authority Evidence & Review History.
-- Scope: immutable private authority evidence, Advisor upload allocation/completion,
-- Admin evidence request, review history, and an enriched Admin queue.
-- Session 6 does not grant Business ownership, mutation, publication, payment,
-- file/image/proposal/request/report scopes or any privilege beyond Session 5 profile scope.

create table if not exists public.advisor_authority_evidence (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.advisor_assignments(id) on delete cascade,
  authority_id uuid not null references public.business_listing_authority(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  advisor_profile_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  original_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  storage_bucket text not null default 'advisor-authority-evidence-private',
  storage_path text not null unique,
  status text not null default 'pending_upload',
  note text,
  upload_expires_at timestamptz not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisor_authority_evidence_document_type_check
    check (document_type in ('authorization_letter','mandate','ownership_proof','identity','other')),
  constraint advisor_authority_evidence_name_check
    check (char_length(original_name) between 1 and 180),
  constraint advisor_authority_evidence_mime_check
    check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  constraint advisor_authority_evidence_size_check
    check (file_size_bytes between 1 and 10485760),
  constraint advisor_authority_evidence_bucket_check
    check (storage_bucket = 'advisor-authority-evidence-private'),
  constraint advisor_authority_evidence_status_check
    check (status in ('pending_upload','submitted')),
  constraint advisor_authority_evidence_note_check
    check (note is null or char_length(note) <= 500),
  constraint advisor_authority_evidence_submission_check
    check ((status = 'pending_upload' and submitted_at is null) or (status = 'submitted' and submitted_at is not null))
);

create index if not exists advisor_authority_evidence_assignment_idx
  on public.advisor_authority_evidence(assignment_id, status, submitted_at desc);
create index if not exists advisor_authority_evidence_authority_idx
  on public.advisor_authority_evidence(authority_id, status, submitted_at desc);
create index if not exists advisor_authority_evidence_profile_idx
  on public.advisor_authority_evidence(advisor_profile_id, created_at desc);

alter table public.advisor_authority_evidence enable row level security;
revoke all on table public.advisor_authority_evidence from public, anon, authenticated;

create table if not exists public.advisor_authority_review_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.advisor_assignments(id) on delete cascade,
  authority_id uuid not null references public.business_listing_authority(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role text not null,
  event_type text not null,
  evidence_id uuid references public.advisor_authority_evidence(id) on delete set null,
  note text,
  note_visible_to_advisor boolean not null default false,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint advisor_authority_review_actor_role_check
    check (actor_role in ('advisor','admin','system')),
  constraint advisor_authority_review_event_type_check
    check (event_type in ('intake_created','evidence_submitted','evidence_requested','authority_approved','authority_rejected')),
  constraint advisor_authority_review_note_check
    check (note is null or char_length(note) <= 2000),
  constraint advisor_authority_review_event_data_object_check
    check (jsonb_typeof(event_data) = 'object')
);

create index if not exists advisor_authority_review_assignment_idx
  on public.advisor_authority_review_events(assignment_id, created_at asc);
create index if not exists advisor_authority_review_authority_idx
  on public.advisor_authority_review_events(authority_id, created_at asc);

alter table public.advisor_authority_review_events enable row level security;
revoke all on table public.advisor_authority_review_events from public, anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'advisor-authority-evidence-private',
  'advisor-authority-evidence-private',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function d68_private.can_advisor_upload_authority_evidence(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.advisor_authority_evidence e
    join public.advisor_assignments aa on aa.id = e.assignment_id
    join public.business_listing_authority bla on bla.id = e.authority_id
    join public.profiles p on p.id = e.advisor_profile_id
    join public.advisor_profiles ap on ap.profile_id = e.advisor_profile_id
    where e.storage_bucket = 'advisor-authority-evidence-private'
      and e.storage_path = p_name
      and e.status = 'pending_upload'
      and e.upload_expires_at > now()
      and e.advisor_profile_id = (select auth.uid())
      and aa.profile_id = e.advisor_profile_id
      and aa.business_id = e.business_id
      and aa.authority_id = e.authority_id
      and aa.status = 'pending'
      and aa.accepted_at is null
      and aa.metadata->>'source' = 'advisor_session4_business_intake'
      and bla.business_id = e.business_id
      and bla.verification_status = 'pending_review'
      and p.role = 'advisor'
      and p.status = 'active'
      and p.dashboard_login_enabled is true
      and ap.status = 'active'
      and ap.verification_status = 'verified'
  );
$$;

create or replace function d68_private.can_read_advisor_authority_evidence(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.status = 'active'
    )
    or exists (
      select 1
      from public.advisor_authority_evidence e
      join public.profiles p on p.id = e.advisor_profile_id
      join public.advisor_profiles ap on ap.profile_id = e.advisor_profile_id
      where e.storage_bucket = 'advisor-authority-evidence-private'
        and e.storage_path = p_name
        and e.status = 'submitted'
        and e.advisor_profile_id = (select auth.uid())
        and p.role = 'advisor'
        and p.status = 'active'
        and p.dashboard_login_enabled is true
        and ap.status = 'active'
        and ap.verification_status = 'verified'
    );
$$;

revoke all on function d68_private.can_advisor_upload_authority_evidence(text) from public, anon, authenticated;
revoke all on function d68_private.can_read_advisor_authority_evidence(text) from public, anon, authenticated;
grant execute on function d68_private.can_advisor_upload_authority_evidence(text) to authenticated, service_role;
grant execute on function d68_private.can_read_advisor_authority_evidence(text) to authenticated, service_role;

drop policy if exists "advisor authority evidence insert allocated path" on storage.objects;
create policy "advisor authority evidence insert allocated path"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'advisor-authority-evidence-private'
  and d68_private.can_advisor_upload_authority_evidence(name)
);

drop policy if exists "advisor authority evidence select owner or admin" on storage.objects;
create policy "advisor authority evidence select owner or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'advisor-authority-evidence-private'
  and d68_private.can_read_advisor_authority_evidence(name)
);

-- No UPDATE or DELETE policy is created for this bucket. Submitted authority
-- evidence is immutable in Session 6; a later governed retention flow can add cleanup.

create or replace function d68_private.capture_advisor_intake_created_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.metadata->>'source' = 'advisor_session4_business_intake' then
    insert into public.advisor_authority_review_events(
      assignment_id, authority_id, business_id, actor_profile_id, actor_role,
      event_type, note_visible_to_advisor, event_data, created_at
    )
    select
      new.id, new.authority_id, new.business_id, new.profile_id, 'advisor',
      'intake_created', true,
      jsonb_build_object('source','advisor_session4_business_intake'),
      coalesce(new.created_at, now())
    where new.authority_id is not null
      and not exists (
        select 1 from public.advisor_authority_review_events ev
        where ev.assignment_id = new.id and ev.event_type = 'intake_created'
      );
  end if;
  return new;
end;
$$;

create or replace function d68_private.capture_advisor_authority_decision_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.advisor_assignments;
  v_note text;
begin
  if old.verification_status = 'pending_review'
     and new.verification_status in ('verified','rejected') then
    select aa.* into v_assignment
    from public.advisor_assignments aa
    where aa.authority_id = new.id
      and aa.business_id = new.business_id
      and aa.metadata->>'source' = 'advisor_session4_business_intake'
    order by aa.created_at desc
    limit 1;

    if found then
      v_note := nullif(new.verification_reasons->-1->>'note', '');
      insert into public.advisor_authority_review_events(
        assignment_id, authority_id, business_id, actor_profile_id, actor_role,
        event_type, note, note_visible_to_advisor, event_data, created_at
      ) values (
        v_assignment.id,
        new.id,
        new.business_id,
        (select auth.uid()),
        'admin',
        case when new.verification_status = 'verified' then 'authority_approved' else 'authority_rejected' end,
        v_note,
        false,
        jsonb_build_object('verification_status', new.verification_status::text),
        coalesce(new.verified_at, now())
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function d68_private.capture_advisor_intake_created_review_event() from public, anon, authenticated;
revoke all on function d68_private.capture_advisor_authority_decision_review_event() from public, anon, authenticated;

drop trigger if exists d68_capture_advisor_intake_created_review_event on public.advisor_assignments;
create trigger d68_capture_advisor_intake_created_review_event
after insert on public.advisor_assignments
for each row execute function d68_private.capture_advisor_intake_created_review_event();

drop trigger if exists d68_capture_advisor_authority_decision_review_event on public.business_listing_authority;
create trigger d68_capture_advisor_authority_decision_review_event
after update of verification_status on public.business_listing_authority
for each row execute function d68_private.capture_advisor_authority_decision_review_event();

-- Backfill review history for any Session 4 intake that predates Session 6.
insert into public.advisor_authority_review_events(
  assignment_id, authority_id, business_id, actor_profile_id, actor_role,
  event_type, note_visible_to_advisor, event_data, created_at
)
select
  aa.id, aa.authority_id, aa.business_id, aa.profile_id, 'advisor',
  'intake_created', true,
  jsonb_build_object('source','advisor_session4_business_intake','backfilled',true),
  aa.created_at
from public.advisor_assignments aa
where aa.metadata->>'source' = 'advisor_session4_business_intake'
  and aa.authority_id is not null
  and not exists (
    select 1 from public.advisor_authority_review_events ev
    where ev.assignment_id = aa.id and ev.event_type = 'intake_created'
  );

insert into public.advisor_authority_review_events(
  assignment_id, authority_id, business_id, actor_profile_id, actor_role,
  event_type, note, note_visible_to_advisor, event_data, created_at
)
select
  aa.id,
  aa.authority_id,
  aa.business_id,
  nullif(aa.metadata->>'admin_reviewed_by','')::uuid,
  'admin',
  case when aa.metadata->>'admin_review_status' = 'approved' then 'authority_approved' else 'authority_rejected' end,
  nullif(aa.metadata->>'admin_review_note',''),
  false,
  jsonb_build_object('backfilled',true,'admin_review_status',aa.metadata->>'admin_review_status'),
  coalesce(nullif(aa.metadata->>'admin_reviewed_at','')::timestamptz, aa.updated_at, now())
from public.advisor_assignments aa
where aa.metadata->>'source' = 'advisor_session4_business_intake'
  and aa.metadata->>'admin_review_status' in ('approved','rejected')
  and aa.authority_id is not null
  and not exists (
    select 1 from public.advisor_authority_review_events ev
    where ev.assignment_id = aa.id
      and ev.event_type = case when aa.metadata->>'admin_review_status' = 'approved' then 'authority_approved' else 'authority_rejected' end
  );

create or replace function public.d68_advisor_begin_authority_evidence_v1(
  p_assignment_id uuid,
  p_document_type text,
  p_original_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
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
  v_evidence_id uuid := gen_random_uuid();
  v_document_type text := lower(btrim(coalesce(p_document_type,'')));
  v_original_name text := btrim(coalesce(p_original_name,''));
  v_mime text := lower(btrim(coalesce(p_mime_type,'')));
  v_note text := nullif(left(btrim(coalesce(p_note,'')),500),'');
  v_extension text;
  v_path text;
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
  for update;
  if not found
     or v_assignment.profile_id <> v_actor
     or v_assignment.metadata->>'source' <> 'advisor_session4_business_intake'
     or v_assignment.status <> 'pending'
     or v_assignment.accepted_at is not null then
    raise exception 'Session 4 pending intake assignment required';
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

  if (select count(*) from public.advisor_authority_evidence e
      where e.assignment_id = v_assignment.id and e.status = 'submitted') >= 8 then
    raise exception 'Maximum 8 submitted authority evidence files per intake' using errcode = '22023';
  end if;
  if (select count(*) from public.advisor_authority_evidence e
      where e.advisor_profile_id = v_actor and e.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Authority evidence upload allocation limit reached' using errcode = '22023';
  end if;

  v_path := v_authority.id::text || '/' || v_actor::text || '/' || v_evidence_id::text || '.' || v_extension;

  insert into public.advisor_authority_evidence(
    id, assignment_id, authority_id, business_id, advisor_profile_id,
    document_type, original_name, mime_type, file_size_bytes,
    storage_bucket, storage_path, status, note, upload_expires_at
  ) values (
    v_evidence_id, v_assignment.id, v_authority.id, v_business.id, v_actor,
    v_document_type, v_original_name, v_mime, p_file_size_bytes,
    'advisor-authority-evidence-private', v_path, 'pending_upload', v_note,
    now() + interval '2 hours'
  );

  return jsonb_build_object(
    'evidence_id', v_evidence_id,
    'assignment_id', v_assignment.id,
    'authority_id', v_authority.id,
    'business_id', v_business.id,
    'storage_bucket', 'advisor-authority-evidence-private',
    'storage_path', v_path,
    'upload_expires_at', now() + interval '2 hours',
    'max_file_size_bytes', 10485760,
    'immutable_after_submit', true
  );
end;
$$;

create or replace function public.d68_advisor_complete_authority_evidence_v1(
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
  v_owner uuid;
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
    return jsonb_build_object(
      'evidence_id', v_evidence.id,
      'status', 'submitted',
      'submitted_at', v_evidence.submitted_at,
      'idempotent_replay', true
    );
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
    and aa.status = 'pending'
    and aa.accepted_at is null
    and aa.metadata->>'source' = 'advisor_session4_business_intake'
  for update;
  if not found then
    raise exception 'Session 4 pending intake assignment required';
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

  select o.owner, o.metadata
  into v_owner, v_metadata
  from storage.objects o
  where o.bucket_id = v_evidence.storage_bucket
    and o.name = v_evidence.storage_path
  limit 1;
  if not found or v_owner is distinct from v_actor then
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

  update public.advisor_authority_evidence e
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where e.id = v_evidence.id
  returning * into v_evidence;

  update public.business_listing_authority bla
  set authority_document_ids = case
        when v_evidence.id = any(bla.authority_document_ids) then bla.authority_document_ids
        else array_append(bla.authority_document_ids, v_evidence.id)
      end,
      updated_at = now()
  where bla.id = v_evidence.authority_id;

  insert into public.advisor_authority_review_events(
    assignment_id, authority_id, business_id, actor_profile_id, actor_role,
    event_type, evidence_id, note, note_visible_to_advisor, event_data
  ) values (
    v_evidence.assignment_id,
    v_evidence.authority_id,
    v_evidence.business_id,
    v_actor,
    'advisor',
    'evidence_submitted',
    v_evidence.id,
    v_evidence.note,
    true,
    jsonb_build_object(
      'document_type', v_evidence.document_type,
      'original_name', v_evidence.original_name,
      'mime_type', v_evidence.mime_type,
      'file_size_bytes', v_evidence.file_size_bytes
    )
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.authority_evidence.submitted',
    'advisor_authority_evidence',
    v_evidence.id::text,
    jsonb_build_object(
      'assignment_id', v_evidence.assignment_id,
      'authority_id', v_evidence.authority_id,
      'business_id', v_evidence.business_id,
      'document_type', v_evidence.document_type,
      'file_size_bytes', v_evidence.file_size_bytes,
      'storage_bucket', v_evidence.storage_bucket,
      'storage_path', v_evidence.storage_path
    )
  );

  return jsonb_build_object(
    'evidence_id', v_evidence.id,
    'status', v_evidence.status,
    'submitted_at', v_evidence.submitted_at,
    'authority_status', v_authority.verification_status::text,
    'business_mutations_enabled', false,
    'idempotent_replay', false
  );
end;
$$;

create or replace function public.d68_get_my_authority_review_v1(
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
  v_evidence jsonb;
  v_history jsonb;
  v_can_upload boolean := false;
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

  v_can_upload := v_assignment.status = 'pending'
    and v_assignment.accepted_at is null
    and v_authority.verification_status = 'pending_review';

  select coalesce(jsonb_agg(jsonb_build_object(
    'evidence_id', e.id,
    'document_type', e.document_type,
    'original_name', e.original_name,
    'mime_type', e.mime_type,
    'file_size_bytes', e.file_size_bytes,
    'storage_bucket', e.storage_bucket,
    'storage_path', e.storage_path,
    'note', e.note,
    'submitted_at', e.submitted_at
  ) order by e.submitted_at desc), '[]'::jsonb)
  into v_evidence
  from public.advisor_authority_evidence e
  where e.assignment_id = v_assignment.id and e.status = 'submitted';

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'event_id', ev.id,
    'event_type', ev.event_type,
    'actor_role', ev.actor_role,
    'evidence_id', ev.evidence_id,
    'note', case when ev.note_visible_to_advisor then ev.note else null end,
    'created_at', ev.created_at
  )) order by ev.created_at asc), '[]'::jsonb)
  into v_history
  from public.advisor_authority_review_events ev
  where ev.assignment_id = v_assignment.id;

  return jsonb_build_object(
    'assignment_id', v_assignment.id,
    'business_id', v_assignment.business_id,
    'authority_id', v_authority.id,
    'assignment_status', v_assignment.status,
    'authority_status', v_authority.verification_status::text,
    'can_upload', v_can_upload,
    'evidence', v_evidence,
    'review_history', v_history,
    'access', jsonb_build_object(
      'bucket', 'advisor-authority-evidence-private',
      'max_files', 8,
      'max_file_size_bytes', 10485760,
      'allowed_mime_types', jsonb_build_array('application/pdf','image/jpeg','image/png','image/webp'),
      'immutable_after_submit', true,
      'business_mutations_enabled', false
    )
  );
end;
$$;

create or replace function public.d68_admin_request_advisor_authority_evidence_v1(
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
  for update;
  if not found
     or v_assignment.metadata->>'source' <> 'advisor_session4_business_intake'
     or v_assignment.status <> 'pending'
     or v_assignment.accepted_at is not null then
    raise exception 'Business intake is no longer pending Admin review';
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

  if (select count(*) from public.advisor_authority_review_events ev
      where ev.assignment_id = v_assignment.id
        and ev.event_type = 'evidence_requested'
        and ev.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Evidence request rate limit reached' using errcode = '22023';
  end if;

  insert into public.advisor_authority_review_events(
    assignment_id, authority_id, business_id, actor_profile_id, actor_role,
    event_type, note, note_visible_to_advisor, event_data
  ) values (
    v_assignment.id,
    v_authority.id,
    v_business.id,
    v_actor,
    'admin',
    'evidence_requested',
    v_note,
    true,
    jsonb_build_object('business_status_unchanged',v_business.status::text,'business_visible_unchanged',v_business.visible)
  ) returning id into v_event_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.business_intake.evidence_requested',
    'advisor_assignment',
    v_assignment.id::text,
    jsonb_build_object(
      'review_event_id', v_event_id,
      'business_id', v_business.id,
      'authority_id', v_authority.id,
      'advisor_profile_id', v_assignment.profile_id,
      'note', v_note,
      'business_status_unchanged', v_business.status::text,
      'business_visible_unchanged', v_business.visible
    )
  );

  return jsonb_build_object(
    'review_event_id', v_event_id,
    'assignment_id', v_assignment.id,
    'authority_id', v_authority.id,
    'status', 'evidence_requested',
    'business_status', v_business.status::text,
    'business_visible', v_business.visible,
    'business_mutations_enabled', false
  );
end;
$$;

create or replace function public.d68_admin_list_advisor_business_intakes_v2()
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

  v_base := public.d68_admin_list_advisor_business_intakes_v1();

  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'evidence_count', (
        select count(*) from public.advisor_authority_evidence e
        where e.assignment_id = (item->>'assignment_id')::uuid and e.status = 'submitted'
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
          'submitted_at', e.submitted_at
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
          'note', ev.note,
          'note_visible_to_advisor', ev.note_visible_to_advisor,
          'event_data', ev.event_data,
          'created_at', ev.created_at
        )) order by ev.created_at asc), '[]'::jsonb)
        from public.advisor_authority_review_events ev
        where ev.assignment_id = (item->>'assignment_id')::uuid
      ),
      'can_request_evidence', coalesce((item->>'can_review')::boolean, false)
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
      'business_mutations_enabled', false,
      'publication_enabled', false
    )
  );
end;
$$;

revoke all on function public.d68_advisor_begin_authority_evidence_v1(uuid,text,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.d68_advisor_complete_authority_evidence_v1(uuid) from public, anon, authenticated;
revoke all on function public.d68_get_my_authority_review_v1(uuid) from public, anon, authenticated;
revoke all on function public.d68_admin_request_advisor_authority_evidence_v1(uuid,text) from public, anon, authenticated;
revoke all on function public.d68_admin_list_advisor_business_intakes_v2() from public, anon, authenticated;

grant execute on function public.d68_advisor_begin_authority_evidence_v1(uuid,text,text,text,bigint,text) to authenticated, service_role;
grant execute on function public.d68_advisor_complete_authority_evidence_v1(uuid) to authenticated, service_role;
grant execute on function public.d68_get_my_authority_review_v1(uuid) to authenticated, service_role;
grant execute on function public.d68_admin_request_advisor_authority_evidence_v1(uuid,text) to authenticated, service_role;
grant execute on function public.d68_admin_list_advisor_business_intakes_v2() to authenticated, service_role;

comment on table public.advisor_authority_evidence is
  'Session 6 immutable private authority evidence allocated by RPC and finalized only after a matching Storage object exists.';
comment on table public.advisor_authority_review_events is
  'Session 6 append-only review history for Advisor-created Business intake authority verification.';
comment on function public.d68_advisor_begin_authority_evidence_v1(uuid,text,text,text,bigint,text) is
  'Session 6 allocates a short-lived server-generated private Storage path for verified Advisor authority evidence.';
comment on function public.d68_advisor_complete_authority_evidence_v1(uuid) is
  'Session 6 validates uploaded object owner/size/MIME, freezes evidence as submitted, links it to authority_document_ids, and audits the submission.';
comment on function public.d68_get_my_authority_review_v1(uuid) is
  'Session 6 returns a verified Advisor only their own Session 4 authority evidence and review history, without Business mutation access.';
comment on function public.d68_admin_request_advisor_authority_evidence_v1(uuid,text) is
  'Session 6 lets an active Admin request more authority evidence while keeping Business and authority state unchanged.';
comment on function public.d68_admin_list_advisor_business_intakes_v2() is
  'Session 6 enriches the Session 5 Admin intake queue with submitted authority evidence and append-only review history.';

-- Explicit Session 6 boundary:
-- * Business owner_id, visible, status and moderation state are not changed here.
-- * Session 5 approval remains profile-only and acceptance-gated.
-- * No Advisor Business UPDATE/INSERT/DELETE privilege is added.
-- * No payment, dataroom, image, proposal, request or report scope is granted.
