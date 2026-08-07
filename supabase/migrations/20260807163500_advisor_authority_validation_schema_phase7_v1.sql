-- Deals68 Advisor/Broker — Session 7 Evidence Validation & Authority Re-review schema.
-- Scope: Admin-owned validation metadata, replacement links, re-review cycles and review ledger extensions.
-- No Business ownership, mutation, publication, dataroom, proposal, request, payment, financial or report scope is added.

alter table public.advisor_authority_evidence
  add column if not exists validation_status text not null default 'unreviewed',
  add column if not exists validation_note text,
  add column if not exists validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists validated_at timestamptz,
  add column if not exists replaces_evidence_id uuid references public.advisor_authority_evidence(id) on delete set null,
  add column if not exists superseded_by_evidence_id uuid references public.advisor_authority_evidence(id) on delete set null,
  add column if not exists superseded_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'advisor_authority_evidence_validation_status_check'
      and conrelid = 'public.advisor_authority_evidence'::regclass
  ) then
    alter table public.advisor_authority_evidence
      add constraint advisor_authority_evidence_validation_status_check
      check (validation_status in ('unreviewed','valid','insufficient','invalid'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'advisor_authority_evidence_validation_note_check'
      and conrelid = 'public.advisor_authority_evidence'::regclass
  ) then
    alter table public.advisor_authority_evidence
      add constraint advisor_authority_evidence_validation_note_check
      check (validation_note is null or char_length(validation_note) <= 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'advisor_authority_evidence_validation_audit_check'
      and conrelid = 'public.advisor_authority_evidence'::regclass
  ) then
    alter table public.advisor_authority_evidence
      add constraint advisor_authority_evidence_validation_audit_check
      check (
        (validation_status = 'unreviewed' and validated_by is null and validated_at is null)
        or
        (validation_status <> 'unreviewed' and validated_by is not null and validated_at is not null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'advisor_authority_evidence_replacement_self_check'
      and conrelid = 'public.advisor_authority_evidence'::regclass
  ) then
    alter table public.advisor_authority_evidence
      add constraint advisor_authority_evidence_replacement_self_check
      check (
        (replaces_evidence_id is null or replaces_evidence_id <> id)
        and (superseded_by_evidence_id is null or superseded_by_evidence_id <> id)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'advisor_authority_evidence_supersession_check'
      and conrelid = 'public.advisor_authority_evidence'::regclass
  ) then
    alter table public.advisor_authority_evidence
      add constraint advisor_authority_evidence_supersession_check
      check (
        (superseded_by_evidence_id is null and superseded_at is null)
        or
        (superseded_by_evidence_id is not null and superseded_at is not null)
      );
  end if;
end $$;

create index if not exists advisor_authority_evidence_validation_idx
  on public.advisor_authority_evidence(assignment_id, validation_status, submitted_at desc);
create index if not exists advisor_authority_evidence_validated_by_idx
  on public.advisor_authority_evidence(validated_by, validated_at desc);
create index if not exists advisor_authority_evidence_replaces_idx
  on public.advisor_authority_evidence(replaces_evidence_id)
  where replaces_evidence_id is not null;
create index if not exists advisor_authority_evidence_superseded_by_idx
  on public.advisor_authority_evidence(superseded_by_evidence_id)
  where superseded_by_evidence_id is not null;

create table if not exists public.advisor_authority_rereviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.advisor_assignments(id) on delete cascade,
  authority_id uuid not null references public.business_listing_authority(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  cycle_no integer not null,
  status text not null default 'pending',
  started_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  reason text not null,
  previous_verified_by uuid references public.profiles(id) on delete set null,
  previous_verified_at timestamptz,
  previous_expires_at timestamptz,
  decision_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  new_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisor_authority_rereviews_cycle_check check (cycle_no >= 1),
  constraint advisor_authority_rereviews_status_check check (status in ('pending','approved','rejected')),
  constraint advisor_authority_rereviews_reason_check check (char_length(reason) between 5 and 2000),
  constraint advisor_authority_rereviews_decision_note_check check (decision_note is null or char_length(decision_note) <= 2000),
  constraint advisor_authority_rereviews_decision_check check (
    (status = 'pending' and decision_by is null and decided_at is null and new_expires_at is null)
    or
    (status = 'approved' and decision_by is not null and decided_at is not null and new_expires_at is not null)
    or
    (status = 'rejected' and decision_by is not null and decided_at is not null and new_expires_at is null)
  ),
  unique(assignment_id, cycle_no)
);

create unique index if not exists advisor_authority_rereviews_one_pending_idx
  on public.advisor_authority_rereviews(assignment_id)
  where status = 'pending';
create index if not exists advisor_authority_rereviews_authority_idx
  on public.advisor_authority_rereviews(authority_id, started_at desc);
create index if not exists advisor_authority_rereviews_business_idx
  on public.advisor_authority_rereviews(business_id, started_at desc);
create index if not exists advisor_authority_rereviews_started_by_idx
  on public.advisor_authority_rereviews(started_by, started_at desc);
create index if not exists advisor_authority_rereviews_previous_verified_by_idx
  on public.advisor_authority_rereviews(previous_verified_by, started_at desc);
create index if not exists advisor_authority_rereviews_decision_by_idx
  on public.advisor_authority_rereviews(decision_by, decided_at desc);

alter table public.advisor_authority_rereviews enable row level security;
revoke all on table public.advisor_authority_rereviews from public, anon, authenticated;

alter table public.advisor_authority_review_events
  add column if not exists rereview_id uuid references public.advisor_authority_rereviews(id) on delete set null;

alter table public.advisor_authority_review_events
  drop constraint if exists advisor_authority_review_event_type_check;
alter table public.advisor_authority_review_events
  add constraint advisor_authority_review_event_type_check
  check (event_type in (
    'intake_created',
    'evidence_submitted',
    'evidence_requested',
    'evidence_validated',
    'evidence_replacement_requested',
    'authority_approved',
    'authority_rejected',
    'authority_rereview_started',
    'authority_rereview_approved',
    'authority_rereview_rejected'
  ));

create index if not exists advisor_authority_review_rereview_idx
  on public.advisor_authority_review_events(rereview_id, created_at asc)
  where rereview_id is not null;

create or replace function d68_private.guard_submitted_authority_evidence_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'submitted' and (
    new.assignment_id is distinct from old.assignment_id
    or new.authority_id is distinct from old.authority_id
    or new.business_id is distinct from old.business_id
    or new.advisor_profile_id is distinct from old.advisor_profile_id
    or new.document_type is distinct from old.document_type
    or new.original_name is distinct from old.original_name
    or new.mime_type is distinct from old.mime_type
    or new.file_size_bytes is distinct from old.file_size_bytes
    or new.storage_bucket is distinct from old.storage_bucket
    or new.storage_path is distinct from old.storage_path
    or new.status is distinct from old.status
    or new.note is distinct from old.note
    or new.upload_expires_at is distinct from old.upload_expires_at
    or new.submitted_at is distinct from old.submitted_at
    or new.created_at is distinct from old.created_at
    or new.replaces_evidence_id is distinct from old.replaces_evidence_id
  ) then
    raise exception 'Submitted authority evidence payload is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function d68_private.guard_submitted_authority_evidence_immutable() from public, anon, authenticated;

drop trigger if exists d68_guard_submitted_authority_evidence_immutable on public.advisor_authority_evidence;
create trigger d68_guard_submitted_authority_evidence_immutable
before update on public.advisor_authority_evidence
for each row execute function d68_private.guard_submitted_authority_evidence_immutable();

-- Session 7 broadens only the upload-allocation predicate: a verified Advisor may
-- upload during the original pending review or an explicit pending re-review.
-- Suspended/revoked assignments remain excluded and the Business must still be
-- ownerless, draft and non-public.
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
    join public.businesses b on b.id = e.business_id
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
      and aa.metadata->>'source' = 'advisor_session4_business_intake'
      and aa.status in ('pending','active','expired')
      and aa.permissions = array['profile']::text[]
      and bla.business_id = e.business_id
      and bla.verification_status = 'pending_review'
      and b.owner_id is null
      and b.visible is false
      and b.status = 'draft'::public.account_status
      and p.role = 'advisor'
      and p.status = 'active'
      and p.dashboard_login_enabled is true
      and ap.status = 'active'
      and ap.verification_status = 'verified'
      and (
        (aa.status = 'pending' and aa.accepted_at is null)
        or exists (
          select 1
          from public.advisor_authority_rereviews rr
          where rr.assignment_id = aa.id
            and rr.authority_id = bla.id
            and rr.status = 'pending'
        )
      )
  );
$$;

revoke all on function d68_private.can_advisor_upload_authority_evidence(text) from public, anon, authenticated;
grant execute on function d68_private.can_advisor_upload_authority_evidence(text) to authenticated, service_role;

-- Replaces the Session 6 decision-history trigger body so a pending re-review
-- is distinguished from the original Session 5 decision while keeping the same
-- trigger attachment.
create or replace function d68_private.capture_advisor_authority_decision_review_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.advisor_assignments;
  v_rereview public.advisor_authority_rereviews;
  v_note text;
  v_event_type text;
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
      select rr.* into v_rereview
      from public.advisor_authority_rereviews rr
      where rr.assignment_id = v_assignment.id
        and rr.authority_id = new.id
        and rr.status = 'pending'
      order by rr.started_at desc
      limit 1;

      v_note := nullif(new.verification_reasons->-1->>'note', '');
      v_event_type := case
        when v_rereview.id is not null and new.verification_status = 'verified' then 'authority_rereview_approved'
        when v_rereview.id is not null and new.verification_status = 'rejected' then 'authority_rereview_rejected'
        when new.verification_status = 'verified' then 'authority_approved'
        else 'authority_rejected'
      end;

      insert into public.advisor_authority_review_events(
        assignment_id, authority_id, business_id, actor_profile_id, actor_role,
        event_type, rereview_id, note, note_visible_to_advisor, event_data, created_at
      ) values (
        v_assignment.id,
        new.id,
        new.business_id,
        (select auth.uid()),
        'admin',
        v_event_type,
        v_rereview.id,
        v_note,
        false,
        jsonb_build_object(
          'verification_status', new.verification_status::text,
          'rereview', v_rereview.id is not null
        ),
        coalesce(new.verified_at, now())
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function d68_private.capture_advisor_authority_decision_review_event() from public, anon, authenticated;

comment on table public.advisor_authority_rereviews is
  'Session 7 governed authority re-review ledger. One pending cycle per Session 4 Advisor assignment.';
comment on column public.advisor_authority_evidence.validation_status is
  'Admin-only review classification. Uploaded file bytes and submission metadata remain immutable.';
comment on column public.advisor_authority_evidence.replaces_evidence_id is
  'Optional immutable link from replacement evidence to a prior insufficient/invalid evidence record.';

-- Explicit Session 7 schema boundary:
-- * no Business RLS policy is created, dropped or altered;
-- * no Storage UPDATE or DELETE policy is created;
-- * no direct authenticated DML is granted on evidence, review history or re-review tables;
-- * Business owner_id, visible, status and moderation state are untouched.