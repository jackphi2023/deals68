-- Deals68 Advisor/Broker — Session 1 assignment security foundation.
-- Scope: harden empty legacy Advisor placeholder tables, add scoped delegation,
-- audited RPC lifecycle and an internal authorization helper.
-- IMPORTANT: this migration does NOT modify any existing Business RLS policy and
-- does NOT grant Advisor access to Business records, assets, payments or workflows.

create schema if not exists d68_private;
revoke all on schema d68_private from public, anon;
grant usage on schema d68_private to authenticated, service_role;
comment on schema d68_private is
  'Internal Deals68 authorization helpers. Not exposed to anon and not a public Data API surface.';

-- Fail closed if legacy placeholder rows appear before this migration is applied.
-- Session 0 verified these tables were empty; automatic conversion would otherwise
-- risk treating generic placeholder data as a real authorization grant.
do $$
begin
  if exists (select 1 from public.advisor_profiles)
     or exists (select 1 from public.advisor_assignments) then
    raise exception
      'Advisor Session 1 requires empty legacy advisor_profiles and advisor_assignments tables; manual reconciliation is required';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Advisor profile identity and verification state
-- ---------------------------------------------------------------------------

alter table public.advisor_profiles
  add column if not exists advisor_type text not null default 'advisor',
  add column if not exists company_name text,
  add column if not exists website text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.advisor_profiles
  alter column profile_id set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column visibility set default 'private',
  alter column visibility set not null,
  alter column payload set default '{}'::jsonb,
  alter column payload set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.advisor_profiles
  drop constraint if exists advisor_profiles_profile_id_fkey;
alter table public.advisor_profiles
  add constraint advisor_profiles_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

alter table public.advisor_profiles
  drop constraint if exists advisor_profiles_advisor_type_check,
  drop constraint if exists advisor_profiles_status_check,
  drop constraint if exists advisor_profiles_verification_status_check,
  drop constraint if exists advisor_profiles_payload_object_check,
  drop constraint if exists advisor_profiles_metadata_object_check,
  drop constraint if exists advisor_profiles_verified_state_check,
  drop constraint if exists advisor_profiles_suspended_state_check;

alter table public.advisor_profiles
  add constraint advisor_profiles_advisor_type_check
    check (advisor_type in ('advisor', 'broker', 'advisor_broker')),
  add constraint advisor_profiles_status_check
    check (status in ('pending', 'active', 'suspended', 'rejected')),
  add constraint advisor_profiles_verification_status_check
    check (verification_status in ('pending', 'verified', 'rejected')),
  add constraint advisor_profiles_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  add constraint advisor_profiles_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  add constraint advisor_profiles_verified_state_check
    check (
      verification_status <> 'verified'
      or (verified_by is not null and verified_at is not null)
    ),
  add constraint advisor_profiles_suspended_state_check
    check (status <> 'suspended' or suspended_at is not null);

create unique index if not exists advisor_profiles_profile_id_uidx
  on public.advisor_profiles(profile_id);
create index if not exists advisor_profiles_status_verification_idx
  on public.advisor_profiles(status, verification_status, updated_at desc);

comment on column public.advisor_profiles.business_id is
  'Legacy placeholder column retained for compatibility. Never used for Advisor authorization.';
comment on column public.advisor_profiles.investor_id is
  'Legacy placeholder column retained for compatibility. Never used for Advisor authorization.';

-- ---------------------------------------------------------------------------
-- Scoped Advisor-to-Business assignment lifecycle
-- ---------------------------------------------------------------------------

alter table public.advisor_assignments
  add column if not exists authority_id uuid references public.business_listing_authority(id) on delete restrict,
  add column if not exists permissions text[] not null default array['profile']::text[],
  add column if not exists granted_by uuid references public.profiles(id) on delete restrict,
  add column if not exists granted_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoke_reason text,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.advisor_assignments
  alter column business_id set not null,
  alter column profile_id set not null,
  alter column authority_id set not null,
  alter column granted_by set not null,
  alter column granted_at set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column visibility set default 'private',
  alter column visibility set not null,
  alter column payload set default '{}'::jsonb,
  alter column payload set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.advisor_assignments
  drop constraint if exists advisor_assignments_profile_id_fkey;
alter table public.advisor_assignments
  add constraint advisor_assignments_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

alter table public.advisor_assignments
  drop constraint if exists advisor_assignments_business_only_check,
  drop constraint if exists advisor_assignments_status_check,
  drop constraint if exists advisor_assignments_permissions_check,
  drop constraint if exists advisor_assignments_payload_object_check,
  drop constraint if exists advisor_assignments_metadata_object_check,
  drop constraint if exists advisor_assignments_active_state_check,
  drop constraint if exists advisor_assignments_suspended_state_check,
  drop constraint if exists advisor_assignments_revoked_state_check,
  drop constraint if exists advisor_assignments_expiry_order_check;

alter table public.advisor_assignments
  add constraint advisor_assignments_business_only_check
    check (investor_id is null),
  add constraint advisor_assignments_status_check
    check (status in ('pending', 'active', 'suspended', 'revoked', 'expired')),
  add constraint advisor_assignments_permissions_check
    check (
      cardinality(permissions) > 0
      and permissions <@ array[
        'profile', 'files', 'images', 'proposals',
        'data_requests', 'payments', 'reports'
      ]::text[]
    ),
  add constraint advisor_assignments_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  add constraint advisor_assignments_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  add constraint advisor_assignments_active_state_check
    check (
      status <> 'active'
      or (
        accepted_at is not null
        and suspended_at is null
        and revoked_at is null
      )
    ),
  add constraint advisor_assignments_suspended_state_check
    check (status <> 'suspended' or suspended_at is not null),
  add constraint advisor_assignments_revoked_state_check
    check (status <> 'revoked' or revoked_at is not null),
  add constraint advisor_assignments_expiry_order_check
    check (expires_at is null or expires_at > granted_at);

create unique index if not exists advisor_assignments_profile_business_uidx
  on public.advisor_assignments(profile_id, business_id);
create index if not exists advisor_assignments_business_status_idx
  on public.advisor_assignments(business_id, status, expires_at);
create index if not exists advisor_assignments_profile_status_idx
  on public.advisor_assignments(profile_id, status, expires_at);
create index if not exists advisor_assignments_authority_idx
  on public.advisor_assignments(authority_id);
create index if not exists advisor_assignments_permissions_gin_idx
  on public.advisor_assignments using gin(permissions);

comment on column public.advisor_assignments.permissions is
  'Explicit delegated scopes. No scope grants access until a later Business RLS migration references the internal helper.';
comment on column public.advisor_assignments.investor_id is
  'Legacy placeholder column. Session 1 assignments are Business-only and require this value to remain NULL.';

-- ---------------------------------------------------------------------------
-- Internal validation and authorization helpers
-- ---------------------------------------------------------------------------

create or replace function d68_private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function d68_private.touch_updated_at() from public, anon;

drop trigger if exists advisor_profiles_touch_updated_at on public.advisor_profiles;
create trigger advisor_profiles_touch_updated_at
before update on public.advisor_profiles
for each row execute function d68_private.touch_updated_at();

drop trigger if exists advisor_assignments_touch_updated_at on public.advisor_assignments;
create trigger advisor_assignments_touch_updated_at
before update on public.advisor_assignments
for each row execute function d68_private.touch_updated_at();

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
    join public.advisor_profiles ap on ap.profile_id = p.id
    where p.id = new.profile_id
      and p.role = 'advisor'
      and p.status = 'active'
      and ap.status = 'active'
      and ap.verification_status = 'verified'
  ) then
    raise exception 'Advisor profile is not active and verified';
  end if;

  if not exists (
    select 1
    from public.business_listing_authority bla
    where bla.id = new.authority_id
      and bla.business_id = new.business_id
      and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
      and bla.verification_status = 'verified'
      and (bla.expires_at is null or bla.expires_at > now())
  ) then
    raise exception 'Business listing authority is not verified, does not match the Business, or has expired';
  end if;

  return new;
end;
$$;

revoke all on function d68_private.validate_advisor_assignment() from public, anon, authenticated;

drop trigger if exists advisor_assignments_validate on public.advisor_assignments;
create trigger advisor_assignments_validate
before insert or update of business_id, profile_id, authority_id, status, permissions, expires_at
on public.advisor_assignments
for each row execute function d68_private.validate_advisor_assignment();

create or replace function d68_private.can_manage_business(
  p_business_id uuid,
  p_required_scope text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.businesses b
      where b.id = p_business_id
        and b.owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.status = 'active'
    )
    or exists (
      select 1
      from public.advisor_assignments aa
      join public.advisor_profiles ap
        on ap.profile_id = aa.profile_id
      join public.profiles p
        on p.id = aa.profile_id
      join public.business_listing_authority bla
        on bla.id = aa.authority_id
       and bla.business_id = aa.business_id
      where aa.business_id = p_business_id
        and aa.profile_id = (select auth.uid())
        and aa.status = 'active'
        and aa.accepted_at is not null
        and (aa.expires_at is null or aa.expires_at > now())
        and p.role = 'advisor'
        and p.status = 'active'
        and ap.status = 'active'
        and ap.verification_status = 'verified'
        and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
        and bla.verification_status = 'verified'
        and (bla.expires_at is null or bla.expires_at > now())
        and (
          p_required_scope is null
          or p_required_scope = any(aa.permissions)
        )
    );
$$;

revoke all on function d68_private.can_manage_business(uuid, text) from public, anon;
grant execute on function d68_private.can_manage_business(uuid, text)
  to authenticated, service_role;

comment on function d68_private.can_manage_business(uuid, text) is
  'Session 1 internal authorization primitive. Not referenced by existing Business RLS until a later scoped-access session.';

-- ---------------------------------------------------------------------------
-- Fail-closed RLS and table privileges
-- ---------------------------------------------------------------------------

alter table public.advisor_profiles enable row level security;
alter table public.advisor_assignments enable row level security;

-- Remove unsafe generic placeholder policies, including self-insert/self-update.
drop policy if exists advisor_profiles_admin_all on public.advisor_profiles;
drop policy if exists advisor_profiles_own_select on public.advisor_profiles;
drop policy if exists advisor_profiles_own_insert on public.advisor_profiles;
drop policy if exists advisor_profiles_own_update on public.advisor_profiles;

drop policy if exists advisor_assignments_admin_all on public.advisor_assignments;
drop policy if exists advisor_assignments_own_select on public.advisor_assignments;
drop policy if exists advisor_assignments_own_insert on public.advisor_assignments;
drop policy if exists advisor_assignments_own_update on public.advisor_assignments;

create policy advisor_profiles_self_or_admin_select
  on public.advisor_profiles
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin()
  );

create policy advisor_assignments_parties_or_admin_select
  on public.advisor_assignments
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id = advisor_assignments.business_id
        and b.owner_id = (select auth.uid())
    )
  );

-- Advisor may inspect only the authority record attached to their own assignment.
drop policy if exists business_listing_authority_advisor_assignment_select
  on public.business_listing_authority;
create policy business_listing_authority_advisor_assignment_select
  on public.business_listing_authority
  for select to authenticated
  using (
    exists (
      select 1
      from public.advisor_assignments aa
      where aa.authority_id = business_listing_authority.id
        and aa.profile_id = (select auth.uid())
        and aa.status in ('pending', 'active', 'suspended')
        and (aa.expires_at is null or aa.expires_at > now())
    )
  );

revoke all on table public.advisor_profiles from public, anon, authenticated;
revoke all on table public.advisor_assignments from public, anon, authenticated;
grant select on table public.advisor_profiles to authenticated;
grant select on table public.advisor_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- Audited RPC-only lifecycle
-- Advisor profile creation is intentionally deferred to Session 2.
-- ---------------------------------------------------------------------------

create or replace function public.d68_admin_set_advisor_profile_status(
  p_profile_id uuid,
  p_status text,
  p_verification_status text default null,
  p_reason text default null
)
returns public.advisor_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_before public.advisor_profiles;
  v_after public.advisor_profiles;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('pending', 'active', 'suspended', 'rejected') then
    raise exception 'Unsupported Advisor profile status';
  end if;

  if p_verification_status is not null
     and p_verification_status not in ('pending', 'verified', 'rejected') then
    raise exception 'Unsupported Advisor verification status';
  end if;

  select * into v_before
  from public.advisor_profiles ap
  where ap.profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'Advisor profile not found';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.role = 'advisor'
  ) then
    raise exception 'Target profile does not have Advisor role';
  end if;

  update public.advisor_profiles ap
  set status = p_status,
      verification_status = coalesce(p_verification_status, ap.verification_status),
      verified_by = case
        when coalesce(p_verification_status, ap.verification_status) = 'verified' then v_actor
        else null
      end,
      verified_at = case
        when coalesce(p_verification_status, ap.verification_status) = 'verified' then coalesce(ap.verified_at, now())
        else null
      end,
      suspended_at = case when p_status = 'suspended' then now() else null end,
      suspension_reason = case when p_status = 'suspended' then nullif(btrim(p_reason), '') else null end,
      updated_at = now()
  where ap.profile_id = p_profile_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.profile.status_changed',
    'advisor_profile',
    v_after.id::text,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'from_status', v_before.status,
      'to_status', v_after.status,
      'from_verification_status', v_before.verification_status,
      'to_verification_status', v_after.verification_status,
      'reason', nullif(btrim(p_reason), '')
    )
  );

  return v_after;
end;
$$;

create or replace function public.d68_admin_create_advisor_assignment(
  p_advisor_profile_id uuid,
  p_business_id uuid,
  p_authority_id uuid,
  p_permissions text[],
  p_expires_at timestamptz default null,
  p_title text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.advisor_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.advisor_assignments;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.advisor_profiles ap on ap.profile_id = p.id
    where p.id = p_advisor_profile_id
      and p.role = 'advisor'
      and p.status = 'active'
      and ap.status = 'active'
      and ap.verification_status = 'verified'
  ) then
    raise exception 'Advisor profile is not active and verified';
  end if;

  if not exists (select 1 from public.businesses b where b.id = p_business_id) then
    raise exception 'Business not found';
  end if;

  if not exists (
    select 1
    from public.business_listing_authority bla
    where bla.id = p_authority_id
      and bla.business_id = p_business_id
      and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
      and bla.verification_status = 'verified'
      and (bla.expires_at is null or bla.expires_at > now())
  ) then
    raise exception 'Verified matching Advisor/Broker authority is required';
  end if;

  if p_permissions is null
     or cardinality(p_permissions) = 0
     or not (p_permissions <@ array[
       'profile', 'files', 'images', 'proposals',
       'data_requests', 'payments', 'reports'
     ]::text[]) then
    raise exception 'Invalid Advisor permission scope';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Assignment expiry must be in the future';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Assignment metadata must be a JSON object';
  end if;

  insert into public.advisor_assignments(
    business_id,
    investor_id,
    profile_id,
    created_by,
    status,
    title,
    payload,
    visibility,
    authority_id,
    permissions,
    granted_by,
    granted_at,
    expires_at,
    updated_by,
    metadata
  ) values (
    p_business_id,
    null,
    p_advisor_profile_id,
    v_actor,
    'pending',
    nullif(btrim(p_title), ''),
    '{}'::jsonb,
    'private',
    p_authority_id,
    p_permissions,
    v_actor,
    now(),
    p_expires_at,
    v_actor,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_row;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.assignment.created',
    'advisor_assignment',
    v_row.id::text,
    jsonb_build_object(
      'advisor_profile_id', p_advisor_profile_id,
      'business_id', p_business_id,
      'authority_id', p_authority_id,
      'permissions', p_permissions,
      'expires_at', p_expires_at
    )
  );

  return v_row;
end;
$$;

create or replace function public.d68_accept_advisor_assignment(
  p_assignment_id uuid
)
returns public.advisor_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.advisor_assignments;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select * into v_row
  from public.advisor_assignments aa
  where aa.id = p_assignment_id
    and aa.profile_id = v_actor
  for update;

  if not found then
    raise exception 'Assignment not found for current Advisor';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'Only a pending assignment may be accepted';
  end if;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    raise exception 'Assignment has expired';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.advisor_profiles ap on ap.profile_id = p.id
    join public.business_listing_authority bla on bla.id = v_row.authority_id
    where p.id = v_actor
      and p.role = 'advisor'
      and p.status = 'active'
      and ap.status = 'active'
      and ap.verification_status = 'verified'
      and bla.business_id = v_row.business_id
      and bla.listing_party_type in ('authorized_broker', 'authorized_advisor')
      and bla.verification_status = 'verified'
      and (bla.expires_at is null or bla.expires_at > now())
  ) then
    raise exception 'Advisor profile or authority is no longer valid';
  end if;

  update public.advisor_assignments aa
  set status = 'active',
      accepted_at = now(),
      suspended_by = null,
      suspended_at = null,
      suspension_reason = null,
      revoked_by = null,
      revoked_at = null,
      revoke_reason = null,
      updated_by = v_actor,
      updated_at = now()
  where aa.id = p_assignment_id
  returning * into v_row;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.assignment.accepted',
    'advisor_assignment',
    v_row.id::text,
    jsonb_build_object(
      'business_id', v_row.business_id,
      'permissions', v_row.permissions,
      'accepted_at', v_row.accepted_at
    )
  );

  return v_row;
end;
$$;

create or replace function public.d68_admin_set_advisor_assignment_status(
  p_assignment_id uuid,
  p_status text,
  p_reason text default null
)
returns public.advisor_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_before public.advisor_assignments;
  v_after public.advisor_assignments;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('pending', 'suspended', 'revoked', 'expired') then
    raise exception 'Admin may set only pending, suspended, revoked or expired; Advisor acceptance activates an assignment';
  end if;

  select * into v_before
  from public.advisor_assignments aa
  where aa.id = p_assignment_id
  for update;

  if not found then
    raise exception 'Advisor assignment not found';
  end if;

  if p_status = 'suspended' and v_before.status <> 'active' then
    raise exception 'Only an active assignment may be suspended';
  end if;

  update public.advisor_assignments aa
  set status = p_status,
      accepted_at = case when p_status = 'pending' then null else aa.accepted_at end,
      suspended_by = case when p_status = 'suspended' then v_actor else null end,
      suspended_at = case when p_status = 'suspended' then now() else null end,
      suspension_reason = case when p_status = 'suspended' then nullif(btrim(p_reason), '') else null end,
      revoked_by = case when p_status = 'revoked' then v_actor else null end,
      revoked_at = case when p_status = 'revoked' then now() else null end,
      revoke_reason = case when p_status = 'revoked' then nullif(btrim(p_reason), '') else null end,
      expires_at = case
        when p_status = 'expired' then coalesce(aa.expires_at, now())
        else aa.expires_at
      end,
      updated_by = v_actor,
      updated_at = now()
  where aa.id = p_assignment_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'advisor.assignment.status_changed',
    'advisor_assignment',
    v_after.id::text,
    jsonb_build_object(
      'business_id', v_after.business_id,
      'advisor_profile_id', v_after.profile_id,
      'from_status', v_before.status,
      'to_status', v_after.status,
      'reason', nullif(btrim(p_reason), '')
    )
  );

  return v_after;
end;
$$;

revoke execute on function public.d68_admin_set_advisor_profile_status(uuid, text, text, text)
  from public, anon;
revoke execute on function public.d68_admin_create_advisor_assignment(uuid, uuid, uuid, text[], timestamptz, text, jsonb)
  from public, anon;
revoke execute on function public.d68_accept_advisor_assignment(uuid)
  from public, anon;
revoke execute on function public.d68_admin_set_advisor_assignment_status(uuid, text, text)
  from public, anon;

grant execute on function public.d68_admin_set_advisor_profile_status(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.d68_admin_create_advisor_assignment(uuid, uuid, uuid, text[], timestamptz, text, jsonb)
  to authenticated, service_role;
grant execute on function public.d68_accept_advisor_assignment(uuid)
  to authenticated, service_role;
grant execute on function public.d68_admin_set_advisor_assignment_status(uuid, text, text)
  to authenticated, service_role;

comment on function public.d68_admin_create_advisor_assignment(uuid, uuid, uuid, text[], timestamptz, text, jsonb) is
  'Admin-only creation of a pending, scoped and audited Advisor-to-Business assignment.';
comment on function public.d68_accept_advisor_assignment(uuid) is
  'Advisor accepts only their own pending assignment after profile and authority validation.';

-- Session 1 intentionally ends here. Existing Business RLS remains owner/admin-only.
