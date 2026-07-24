-- Deals68 Business Financial Access — Phase A.
-- Additive access-grant contract for Proposal-based financial summaries and
-- Business-approved financial data requests. Public redaction and UI changes
-- intentionally remain outside this migration.

create table if not exists public.business_financial_access_grants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  scopes text[] not null default '{}'::text[],
  status text not null default 'active',
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_financial_access_grants_source_type_check
    check (source_type in ('proposal', 'data_request', 'admin')),
  constraint business_financial_access_grants_status_check
    check (status in ('active', 'revoked', 'expired')),
  constraint business_financial_access_grants_scopes_check
    check (
      cardinality(scopes) > 0
      and scopes <@ array['financial_summary', 'financial_detail', 'dataroom']::text[]
    ),
  constraint business_financial_access_grants_expiry_check
    check (expires_at is null or expires_at > granted_at)
);

create unique index if not exists business_financial_access_grants_source_uidx
  on public.business_financial_access_grants (source_type, source_id)
  where source_id is not null;

create index if not exists business_financial_access_grants_lookup_idx
  on public.business_financial_access_grants
  (business_id, investor_id, status, expires_at);

create index if not exists business_financial_access_grants_business_idx
  on public.business_financial_access_grants (business_id, updated_at desc);

create index if not exists business_financial_access_grants_investor_idx
  on public.business_financial_access_grants (investor_id, updated_at desc);

comment on table public.business_financial_access_grants is
  'Current Business-specific financial and Dataroom access. Proposal and request history remain in their source tables.';
comment on column public.business_financial_access_grants.scopes is
  'Allowed scopes: financial_summary, financial_detail and dataroom.';
comment on column public.business_financial_access_grants.source_id is
  'Proposal or data_request UUID. Null is reserved for explicit Admin grants.';

alter table public.request_data
  add column if not exists requested_scopes text[] not null default '{}'::text[],
  add column if not exists granted_scopes text[] not null default '{}'::text[],
  add column if not exists response_note text,
  add column if not exists responded_at timestamptz,
  add column if not exists responded_by uuid references public.profiles(id) on delete set null,
  add column if not exists access_expires_at timestamptz;

comment on column public.request_data.requested_scopes is
  'Canonical requested access scopes. Legacy requested_items remains supported.';
comment on column public.request_data.granted_scopes is
  'Scopes approved by the Business. Empty legacy rows are normalized by the access trigger.';
comment on column public.request_data.access_expires_at is
  'Optional expiry for access granted from this request.';

create or replace function public.d68_normalize_business_financial_scopes(
  p_scopes text[],
  p_default_scopes text[] default array['financial_summary']::text[]
)
returns text[]
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized text[];
begin
  select coalesce(array_agg(scope_value order by scope_value), '{}'::text[])
  into normalized
  from (
    select distinct lower(trim(value)) as scope_value
    from unnest(coalesce(p_scopes, '{}'::text[])) as raw(value)
    where lower(trim(value)) in ('financial_summary', 'financial_detail', 'dataroom')
  ) valid_scopes;

  if cardinality(normalized) = 0 then
    select coalesce(array_agg(scope_value order by scope_value), array['financial_summary']::text[])
    into normalized
    from (
      select distinct lower(trim(value)) as scope_value
      from unnest(coalesce(p_default_scopes, array['financial_summary']::text[])) as raw(value)
      where lower(trim(value)) in ('financial_summary', 'financial_detail', 'dataroom')
    ) valid_defaults;
  end if;

  if 'dataroom' = any(normalized)
     and not ('financial_detail' = any(normalized)) then
    normalized := array_append(normalized, 'financial_detail');
  end if;

  if ('financial_detail' = any(normalized) or 'dataroom' = any(normalized))
     and not ('financial_summary' = any(normalized)) then
    normalized := array_append(normalized, 'financial_summary');
  end if;

  select array_agg(value order by value)
  into normalized
  from (select distinct unnest(normalized) as value) deduplicated;

  return normalized;
end;
$$;

revoke all on function public.d68_normalize_business_financial_scopes(text[], text[])
from public, anon, authenticated;

-- Normalize existing request rows before creating the open-request uniqueness guard.
update public.request_data
set requested_scopes = array['financial_summary', 'financial_detail']::text[]
where cardinality(requested_scopes) = 0;

update public.request_data
set granted_scopes = array['financial_summary', 'financial_detail']::text[]
where status::text = 'fulfilled'
  and cardinality(granted_scopes) = 0;

with ranked_open_requests as (
  select
    id,
    row_number() over (
      partition by business_id, investor_id
      order by created_at desc nulls last, id desc
    ) as position
  from public.request_data
  where status::text in ('pending', 'forwarded')
)
update public.request_data r
set status = 'rejected'::public.request_status,
    response_note = coalesce(
      r.response_note,
      'Superseded by a newer pending request during access-contract migration.'
    ),
    responded_at = coalesce(r.responded_at, now()),
    updated_at = now()
from ranked_open_requests ranked
where r.id = ranked.id
  and ranked.position > 1;

create unique index if not exists request_data_one_open_pair_uidx
  on public.request_data (business_id, investor_id)
  where status in ('pending'::public.request_status, 'forwarded'::public.request_status);

-- Backfill Proposal access: sent/requested/approved/connected share summary only.
insert into public.business_financial_access_grants (
  business_id,
  investor_id,
  source_type,
  source_id,
  scopes,
  status,
  granted_by,
  granted_at,
  created_at,
  updated_at
)
select
  p.business_id,
  p.investor_id,
  'proposal',
  p.id,
  array['financial_summary']::text[],
  'active',
  b.owner_id,
  coalesce(p.sent_at, p.updated_at, now()),
  coalesce(p.sent_at, p.updated_at, now()),
  now()
from public.proposals p
join public.businesses b on b.id = p.business_id
where p.status::text in ('sent', 'request_data', 'approved', 'connected')
  and p.business_id is not null
  and p.investor_id is not null
on conflict (source_type, source_id) where source_id is not null
do update set
  business_id = excluded.business_id,
  investor_id = excluded.investor_id,
  scopes = excluded.scopes,
  status = 'active',
  granted_by = coalesce(public.business_financial_access_grants.granted_by, excluded.granted_by),
  expires_at = null,
  revoked_by = null,
  revoked_at = null,
  revoke_reason = null,
  updated_at = now();

-- Backfill fulfilled requests as summary + detail. Dataroom is never inferred.
insert into public.business_financial_access_grants (
  business_id,
  investor_id,
  source_type,
  source_id,
  scopes,
  status,
  granted_by,
  granted_at,
  expires_at,
  created_at,
  updated_at
)
select
  r.business_id,
  r.investor_id,
  'data_request',
  r.id,
  public.d68_normalize_business_financial_scopes(
    nullif(r.granted_scopes, '{}'::text[]),
    array['financial_summary', 'financial_detail']::text[]
  ),
  'active',
  coalesce(r.responded_by, b.owner_id),
  coalesce(r.responded_at, r.updated_at, r.created_at, now()),
  r.access_expires_at,
  coalesce(r.created_at, now()),
  now()
from public.request_data r
join public.businesses b on b.id = r.business_id
where r.status::text = 'fulfilled'
  and r.business_id is not null
  and r.investor_id is not null
on conflict (source_type, source_id) where source_id is not null
do update set
  business_id = excluded.business_id,
  investor_id = excluded.investor_id,
  scopes = excluded.scopes,
  status = 'active',
  granted_by = coalesce(public.business_financial_access_grants.granted_by, excluded.granted_by),
  granted_at = excluded.granted_at,
  expires_at = excluded.expires_at,
  revoked_by = null,
  revoked_at = null,
  revoke_reason = null,
  updated_at = now();

create or replace function public.d68_sync_proposal_financial_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposal_row public.proposals%rowtype;
  business_owner uuid;
  actor_uuid uuid := auth.uid();
  action_name text;
begin
  if tg_op = 'DELETE' then
    proposal_row := old;
  else
    proposal_row := new;
  end if;

  if proposal_row.business_id is null or proposal_row.investor_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select b.owner_id into business_owner
  from public.businesses b
  where b.id = proposal_row.business_id;

  if tg_op <> 'DELETE'
     and proposal_row.status::text in ('sent', 'request_data', 'approved', 'connected') then
    insert into public.business_financial_access_grants (
      business_id, investor_id, source_type, source_id, scopes, status,
      granted_by, granted_at, expires_at, revoked_by, revoked_at,
      revoke_reason, updated_at
    ) values (
      proposal_row.business_id,
      proposal_row.investor_id,
      'proposal',
      proposal_row.id,
      array['financial_summary']::text[],
      'active',
      coalesce(actor_uuid, business_owner),
      coalesce(proposal_row.sent_at, now()),
      null,
      null,
      null,
      null,
      now()
    )
    on conflict (source_type, source_id) where source_id is not null
    do update set
      business_id = excluded.business_id,
      investor_id = excluded.investor_id,
      scopes = excluded.scopes,
      status = 'active',
      granted_by = coalesce(excluded.granted_by, public.business_financial_access_grants.granted_by),
      granted_at = least(public.business_financial_access_grants.granted_at, excluded.granted_at),
      expires_at = null,
      revoked_by = null,
      revoked_at = null,
      revoke_reason = null,
      updated_at = now();

    action_name := 'grant_financial_summary_from_proposal';
  else
    update public.business_financial_access_grants
    set status = 'revoked',
        revoked_by = actor_uuid,
        revoked_at = now(),
        revoke_reason = case
          when tg_op = 'DELETE' then 'proposal_deleted'
          else 'proposal_' || lower(proposal_row.status::text)
        end,
        updated_at = now()
    where source_type = 'proposal'
      and source_id = proposal_row.id
      and status <> 'revoked';

    action_name := 'revoke_financial_summary_from_proposal';
  end if;

  if actor_uuid is not null then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, detail
    ) values (
      actor_uuid,
      action_name,
      'business_financial_access_grant',
      proposal_row.id::text,
      jsonb_build_object(
        'business_id', proposal_row.business_id,
        'investor_id', proposal_row.investor_id,
        'source_type', 'proposal',
        'source_id', proposal_row.id,
        'proposal_status', case
          when tg_op = 'DELETE' then 'deleted'
          else proposal_row.status::text
        end,
        'scopes', jsonb_build_array('financial_summary')
      )
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.d68_sync_proposal_financial_access()
from public, anon, authenticated;

drop trigger if exists proposals_financial_access_insert on public.proposals;
create trigger proposals_financial_access_insert
after insert on public.proposals
for each row execute function public.d68_sync_proposal_financial_access();

drop trigger if exists proposals_financial_access_status_update on public.proposals;
create trigger proposals_financial_access_status_update
after update of status on public.proposals
for each row
when (old.status is distinct from new.status)
execute function public.d68_sync_proposal_financial_access();

drop trigger if exists proposals_financial_access_delete on public.proposals;
create trigger proposals_financial_access_delete
after delete on public.proposals
for each row execute function public.d68_sync_proposal_financial_access();

create or replace function public.d68_sync_request_financial_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row public.request_data%rowtype;
  business_owner uuid;
  actor_uuid uuid := auth.uid();
  normalized_scopes text[];
  action_name text;
begin
  if tg_op = 'DELETE' then
    request_row := old;
  else
    request_row := new;
  end if;

  if request_row.business_id is null or request_row.investor_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select b.owner_id into business_owner
  from public.businesses b
  where b.id = request_row.business_id;

  if tg_op <> 'DELETE' and request_row.status::text = 'fulfilled' then
    normalized_scopes := public.d68_normalize_business_financial_scopes(
      nullif(request_row.granted_scopes, '{}'::text[]),
      array['financial_summary', 'financial_detail']::text[]
    );

    insert into public.business_financial_access_grants (
      business_id, investor_id, source_type, source_id, scopes, status,
      granted_by, granted_at, expires_at, revoked_by, revoked_at,
      revoke_reason, updated_at
    ) values (
      request_row.business_id,
      request_row.investor_id,
      'data_request',
      request_row.id,
      normalized_scopes,
      'active',
      coalesce(request_row.responded_by, actor_uuid, business_owner),
      coalesce(request_row.responded_at, request_row.updated_at, now()),
      request_row.access_expires_at,
      null,
      null,
      null,
      now()
    )
    on conflict (source_type, source_id) where source_id is not null
    do update set
      business_id = excluded.business_id,
      investor_id = excluded.investor_id,
      scopes = excluded.scopes,
      status = 'active',
      granted_by = coalesce(excluded.granted_by, public.business_financial_access_grants.granted_by),
      granted_at = excluded.granted_at,
      expires_at = excluded.expires_at,
      revoked_by = null,
      revoked_at = null,
      revoke_reason = null,
      updated_at = now();

    action_name := 'grant_financial_access_from_data_request';
  elsif tg_op = 'DELETE'
     or request_row.status::text = 'rejected'
     or (tg_op = 'UPDATE' and old.status::text = 'fulfilled' and new.status::text <> 'fulfilled') then
    update public.business_financial_access_grants
    set status = 'revoked',
        revoked_by = actor_uuid,
        revoked_at = now(),
        revoke_reason = case
          when tg_op = 'DELETE' then 'data_request_deleted'
          else 'data_request_' || lower(request_row.status::text)
        end,
        updated_at = now()
    where source_type = 'data_request'
      and source_id = request_row.id
      and status <> 'revoked';

    action_name := 'revoke_financial_access_from_data_request';
  end if;

  if actor_uuid is not null and action_name is not null then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, detail
    ) values (
      actor_uuid,
      action_name,
      'business_financial_access_grant',
      request_row.id::text,
      jsonb_build_object(
        'business_id', request_row.business_id,
        'investor_id', request_row.investor_id,
        'source_type', 'data_request',
        'source_id', request_row.id,
        'request_status', case
          when tg_op = 'DELETE' then 'deleted'
          else request_row.status::text
        end,
        'scopes', coalesce(to_jsonb(normalized_scopes), '[]'::jsonb)
      )
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.d68_sync_request_financial_access()
from public, anon, authenticated;

drop trigger if exists request_data_financial_access_insert on public.request_data;
create trigger request_data_financial_access_insert
after insert on public.request_data
for each row execute function public.d68_sync_request_financial_access();

drop trigger if exists request_data_financial_access_update on public.request_data;
create trigger request_data_financial_access_update
after update of status, granted_scopes, responded_at, responded_by, access_expires_at
on public.request_data
for each row
when (
  old.status is distinct from new.status
  or old.granted_scopes is distinct from new.granted_scopes
  or old.responded_at is distinct from new.responded_at
  or old.responded_by is distinct from new.responded_by
  or old.access_expires_at is distinct from new.access_expires_at
)
execute function public.d68_sync_request_financial_access();

drop trigger if exists request_data_financial_access_delete on public.request_data;
create trigger request_data_financial_access_delete
after delete on public.request_data
for each row execute function public.d68_sync_request_financial_access();

create or replace function public.d68_get_business_financial_access(
  p_business_id uuid,
  p_investor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  business_row public.businesses%rowtype;
  privileged_viewer boolean := false;
  resolved_investor_id uuid;
  resolved_scopes text[] := '{}'::text[];
  source_rows jsonb := '[]'::jsonb;
  has_indefinite boolean := false;
  effective_expires_at timestamptz;
  access_level text := 'none';
  latest_request_status text;
  latest_proposal_status text;
begin
  select * into business_row
  from public.businesses b
  where b.id = p_business_id;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  privileged_viewer := public.is_admin()
    or service_actor
    or business_row.owner_id = actor_uuid;

  if p_investor_id is null and privileged_viewer then
    return jsonb_build_object(
      'business_id', p_business_id,
      'investor_id', null,
      'access_level', 'detail',
      'scopes', jsonb_build_array('financial_summary', 'financial_detail', 'dataroom'),
      'has_financial_summary', true,
      'has_financial_detail', true,
      'has_dataroom', true,
      'sources', jsonb_build_array(
        jsonb_build_object(
          'source_type', case
            when public.is_admin() or service_actor then 'admin'
            else 'owner'
          end
        )
      ),
      'expires_at', null,
      'proposal_status', null,
      'request_status', null
    );
  end if;

  if actor_uuid is null and not service_actor then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_investor_id is not null then
    if privileged_viewer then
      select i.id into resolved_investor_id
      from public.investors i
      where i.id = p_investor_id;
    else
      select i.id into resolved_investor_id
      from public.investors i
      where i.id = p_investor_id
        and i.owner_id = actor_uuid;
    end if;

    if resolved_investor_id is null then
      raise exception 'Investor access denied' using errcode = '42501';
    end if;
  else
    select i.id into resolved_investor_id
    from public.investors i
    where i.owner_id = actor_uuid
    order by i.created_at asc nulls last, i.id
    limit 1;
  end if;

  if resolved_investor_id is null then
    return jsonb_build_object(
      'business_id', p_business_id,
      'investor_id', null,
      'access_level', 'none',
      'scopes', '[]'::jsonb,
      'has_financial_summary', false,
      'has_financial_detail', false,
      'has_dataroom', false,
      'sources', '[]'::jsonb,
      'expires_at', null,
      'proposal_status', null,
      'request_status', null
    );
  end if;

  select coalesce(array_agg(distinct scope_value order by scope_value), '{}'::text[])
  into resolved_scopes
  from public.business_financial_access_grants grant_row
  cross join lateral unnest(grant_row.scopes) as granted_scope(scope_value)
  where grant_row.business_id = p_business_id
    and grant_row.investor_id = resolved_investor_id
    and grant_row.status = 'active'
    and (grant_row.expires_at is null or grant_row.expires_at > now());

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'grant_id', grant_row.id,
        'source_type', grant_row.source_type,
        'source_id', grant_row.source_id,
        'expires_at', grant_row.expires_at
      ) order by grant_row.granted_at desc, grant_row.id
    ), '[]'::jsonb),
    coalesce(bool_or(grant_row.expires_at is null), false),
    max(grant_row.expires_at)
  into source_rows, has_indefinite, effective_expires_at
  from public.business_financial_access_grants grant_row
  where grant_row.business_id = p_business_id
    and grant_row.investor_id = resolved_investor_id
    and grant_row.status = 'active'
    and (grant_row.expires_at is null or grant_row.expires_at > now());

  if 'financial_detail' = any(resolved_scopes) then
    access_level := 'detail';
  elsif 'financial_summary' = any(resolved_scopes) then
    access_level := 'summary';
  end if;

  select p.status::text into latest_proposal_status
  from public.proposals p
  where p.business_id = p_business_id
    and p.investor_id = resolved_investor_id
  order by p.updated_at desc nulls last, p.sent_at desc nulls last
  limit 1;

  select r.status::text into latest_request_status
  from public.request_data r
  where r.business_id = p_business_id
    and r.investor_id = resolved_investor_id
  order by r.created_at desc nulls last, r.id desc
  limit 1;

  return jsonb_build_object(
    'business_id', p_business_id,
    'investor_id', resolved_investor_id,
    'access_level', access_level,
    'scopes', to_jsonb(resolved_scopes),
    'has_financial_summary', 'financial_summary' = any(resolved_scopes),
    'has_financial_detail', 'financial_detail' = any(resolved_scopes),
    'has_dataroom', 'dataroom' = any(resolved_scopes),
    'sources', source_rows,
    'expires_at', case when has_indefinite then null else effective_expires_at end,
    'proposal_status', latest_proposal_status,
    'request_status', latest_request_status
  );
end;
$$;

revoke all on function public.d68_get_business_financial_access(uuid, uuid)
from public, anon;
grant execute on function public.d68_get_business_financial_access(uuid, uuid)
to authenticated, service_role;

create or replace function public.d68_has_business_financial_scope(
  p_business_id uuid,
  p_scope text,
  p_investor_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_scope text := lower(trim(coalesce(p_scope, '')));
  snapshot jsonb;
begin
  if normalized_scope not in ('financial_summary', 'financial_detail', 'dataroom') then
    return false;
  end if;

  snapshot := public.d68_get_business_financial_access(p_business_id, p_investor_id);
  return coalesce((snapshot -> 'scopes') ? normalized_scope, false);
end;
$$;

revoke all on function public.d68_has_business_financial_scope(uuid, text, uuid)
from public, anon;
grant execute on function public.d68_has_business_financial_scope(uuid, text, uuid)
to authenticated, service_role;

create or replace function public.d68_request_business_financial_access(
  p_business_id uuid,
  p_requested_scopes text[] default array['financial_summary', 'financial_detail']::text[],
  p_request_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  investor_row public.investors%rowtype;
  business_row public.businesses%rowtype;
  normalized_scopes text[];
  existing_request public.request_data%rowtype;
  created_request public.request_data%rowtype;
begin
  if actor_uuid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into investor_row
  from public.investors i
  where i.owner_id = actor_uuid
    and i.status = 'active'::public.account_status
  order by i.created_at asc nulls last, i.id
  limit 1;

  if not found then
    raise exception 'Active Investor profile required' using errcode = '42501';
  end if;

  select * into business_row
  from public.businesses b
  where b.id = p_business_id
    and b.visible is true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null;

  if not found then
    raise exception 'Business is not available' using errcode = 'P0002';
  end if;

  normalized_scopes := public.d68_normalize_business_financial_scopes(
    p_requested_scopes,
    array['financial_summary', 'financial_detail']::text[]
  );

  select * into existing_request
  from public.request_data r
  where r.business_id = p_business_id
    and r.investor_id = investor_row.id
    and r.status::text in ('pending', 'forwarded')
  order by r.created_at desc nulls last, r.id desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'request_id', existing_request.id,
      'business_id', existing_request.business_id,
      'investor_id', existing_request.investor_id,
      'status', existing_request.status::text,
      'requested_scopes', to_jsonb(
        public.d68_normalize_business_financial_scopes(
          nullif(existing_request.requested_scopes, '{}'::text[]),
          normalized_scopes
        )
      ),
      'existing', true
    );
  end if;

  begin
    insert into public.request_data (
      business_id, investor_id, requested_items, requested_scopes,
      note, status, created_at, updated_at
    ) values (
      p_business_id,
      investor_row.id,
      normalized_scopes,
      normalized_scopes,
      nullif(left(trim(coalesce(p_request_note, '')), 2000), ''),
      'pending'::public.request_status,
      now(),
      now()
    )
    returning * into created_request;
  exception
    when unique_violation then
      select * into existing_request
      from public.request_data r
      where r.business_id = p_business_id
        and r.investor_id = investor_row.id
        and r.status::text in ('pending', 'forwarded')
      order by r.created_at desc nulls last, r.id desc
      limit 1;

      if found then
        return jsonb_build_object(
          'request_id', existing_request.id,
          'business_id', existing_request.business_id,
          'investor_id', existing_request.investor_id,
          'status', existing_request.status::text,
          'requested_scopes', to_jsonb(existing_request.requested_scopes),
          'existing', true
        );
      end if;
      raise;
  end;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_uuid,
    'request_business_financial_access',
    'request_data',
    created_request.id::text,
    jsonb_build_object(
      'business_id', p_business_id,
      'investor_id', investor_row.id,
      'requested_scopes', to_jsonb(normalized_scopes)
    )
  );

  return jsonb_build_object(
    'request_id', created_request.id,
    'business_id', created_request.business_id,
    'investor_id', created_request.investor_id,
    'status', created_request.status::text,
    'requested_scopes', to_jsonb(normalized_scopes),
    'existing', false
  );
end;
$$;

revoke all on function public.d68_request_business_financial_access(uuid, text[], text)
from public, anon;
grant execute on function public.d68_request_business_financial_access(uuid, text[], text)
to authenticated;

create or replace function public.d68_respond_business_financial_request(
  p_request_id uuid,
  p_decision text,
  p_granted_scopes text[] default null,
  p_expires_at timestamptz default null,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  request_row public.request_data%rowtype;
  business_owner uuid;
  normalized_decision text := lower(trim(coalesce(p_decision, '')));
  requested_defaults text[];
  normalized_scopes text[];
  access_snapshot jsonb;
begin
  select * into request_row
  from public.request_data r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Financial request not found' using errcode = 'P0002';
  end if;

  select b.owner_id into business_owner
  from public.businesses b
  where b.id = request_row.business_id;

  if not (public.is_admin() or service_actor or business_owner = actor_uuid) then
    raise exception 'Business permission required' using errcode = '42501';
  end if;

  if normalized_decision in ('approve', 'approved', 'accept', 'accepted', 'fulfill', 'fulfilled') then
    if p_expires_at is not null and p_expires_at <= now() then
      raise exception 'Access expiry must be in the future';
    end if;

    requested_defaults := public.d68_normalize_business_financial_scopes(
      nullif(request_row.requested_scopes, '{}'::text[]),
      public.d68_normalize_business_financial_scopes(
        request_row.requested_items,
        array['financial_summary', 'financial_detail']::text[]
      )
    );

    normalized_scopes := public.d68_normalize_business_financial_scopes(
      p_granted_scopes,
      requested_defaults
    );

    update public.request_data
    set status = 'fulfilled'::public.request_status,
        granted_scopes = normalized_scopes,
        response_note = nullif(left(trim(coalesce(p_response_note, '')), 2000), ''),
        responded_at = now(),
        responded_by = actor_uuid,
        access_expires_at = p_expires_at,
        updated_at = now()
    where id = p_request_id;
  elsif normalized_decision in ('reject', 'rejected', 'decline', 'declined') then
    update public.request_data
    set status = 'rejected'::public.request_status,
        granted_scopes = '{}'::text[],
        response_note = nullif(left(trim(coalesce(p_response_note, '')), 2000), ''),
        responded_at = now(),
        responded_by = actor_uuid,
        access_expires_at = null,
        updated_at = now()
    where id = p_request_id;

    normalized_scopes := '{}'::text[];
  else
    raise exception 'Unsupported request decision: %', normalized_decision;
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_uuid,
    case when normalized_decision in ('reject', 'rejected', 'decline', 'declined')
      then 'reject_business_financial_request'
      else 'approve_business_financial_request'
    end,
    'request_data',
    p_request_id::text,
    jsonb_build_object(
      'business_id', request_row.business_id,
      'investor_id', request_row.investor_id,
      'decision', normalized_decision,
      'granted_scopes', to_jsonb(normalized_scopes),
      'expires_at', p_expires_at,
      'response_note', nullif(trim(coalesce(p_response_note, '')), '')
    )
  );

  access_snapshot := public.d68_get_business_financial_access(
    request_row.business_id,
    request_row.investor_id
  );

  return jsonb_build_object(
    'request_id', p_request_id,
    'status', case
      when normalized_decision in ('reject', 'rejected', 'decline', 'declined')
        then 'rejected'
      else 'fulfilled'
    end,
    'access', access_snapshot
  );
end;
$$;

revoke all on function public.d68_respond_business_financial_request(uuid, text, text[], timestamptz, text)
from public, anon;
grant execute on function public.d68_respond_business_financial_request(uuid, text, text[], timestamptz, text)
to authenticated, service_role;

create or replace function public.d68_revoke_business_financial_access(
  p_grant_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  grant_row public.business_financial_access_grants%rowtype;
  business_owner uuid;
  snapshot jsonb;
begin
  select * into grant_row
  from public.business_financial_access_grants grant_record
  where grant_record.id = p_grant_id
  for update;

  if not found then
    raise exception 'Financial access grant not found' using errcode = 'P0002';
  end if;

  select b.owner_id into business_owner
  from public.businesses b
  where b.id = grant_row.business_id;

  if not (public.is_admin() or service_actor or business_owner = actor_uuid) then
    raise exception 'Business permission required' using errcode = '42501';
  end if;

  update public.business_financial_access_grants
  set status = 'revoked',
      revoked_by = actor_uuid,
      revoked_at = now(),
      revoke_reason = coalesce(
        nullif(left(trim(coalesce(p_reason, '')), 1000), ''),
        'revoked_by_business'
      ),
      updated_at = now()
  where id = p_grant_id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_uuid,
    'revoke_business_financial_access',
    'business_financial_access_grant',
    p_grant_id::text,
    jsonb_build_object(
      'business_id', grant_row.business_id,
      'investor_id', grant_row.investor_id,
      'source_type', grant_row.source_type,
      'source_id', grant_row.source_id,
      'reason', coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'revoked_by_business')
    )
  );

  snapshot := public.d68_get_business_financial_access(
    grant_row.business_id,
    grant_row.investor_id
  );

  return jsonb_build_object(
    'grant_id', p_grant_id,
    'status', 'revoked',
    'access', snapshot
  );
end;
$$;

revoke all on function public.d68_revoke_business_financial_access(uuid, text)
from public, anon;
grant execute on function public.d68_revoke_business_financial_access(uuid, text)
to authenticated, service_role;

alter table public.business_financial_access_grants enable row level security;

drop policy if exists business_financial_access_grants_parties_select
on public.business_financial_access_grants;
create policy business_financial_access_grants_parties_select
on public.business_financial_access_grants
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.businesses b
    where b.id = business_financial_access_grants.business_id
      and b.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.investors i
    where i.id = business_financial_access_grants.investor_id
      and i.owner_id = auth.uid()
  )
);

revoke all on table public.business_financial_access_grants
from public, anon, authenticated;
grant select on table public.business_financial_access_grants to authenticated;
grant all on table public.business_financial_access_grants to service_role;

insert into public.audit_logs (
  actor_id, action, entity_type, entity_id, detail
) values (
  null,
  'business_financial_access_phase_a_backfill',
  'system',
  'business_financial_access_grants',
  jsonb_build_object(
    'proposal_grants', (
      select count(*)
      from public.business_financial_access_grants
      where source_type = 'proposal'
    ),
    'data_request_grants', (
      select count(*)
      from public.business_financial_access_grants
      where source_type = 'data_request'
    ),
    'dataroom_inferred', false,
    'migration_scope', 'access_contract_only'
  )
);

comment on function public.d68_get_business_financial_access(uuid, uuid) is
  'Canonical Business-specific access snapshot. Proposal grants summary; approved requests may grant detail or Dataroom.';
comment on function public.d68_has_business_financial_scope(uuid, text, uuid) is
  'Server-side scope check for financial_summary, financial_detail or dataroom.';
comment on function public.d68_request_business_financial_access(uuid, text[], text) is
  'Investor-owned idempotent financial access request. Prevents more than one open request per Business/Investor pair.';
comment on function public.d68_respond_business_financial_request(uuid, text, text[], timestamptz, text) is
  'Business/Admin approval or rejection. Trigger atomically synchronizes the access grant and audit history.';
comment on function public.d68_revoke_business_financial_access(uuid, text) is
  'Business/Admin revocation of one active grant without deleting Proposal or request history.';