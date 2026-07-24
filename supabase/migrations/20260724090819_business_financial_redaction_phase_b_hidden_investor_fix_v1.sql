-- Deals68 Business Financial Redaction — Phase B compatibility fix.
-- Investor status `hidden` controls public profile visibility; it must not cancel
-- Proposal/request entitlements for the authenticated owner of that Investor profile.

begin;

create or replace function public.d68_get_business_financial_summaries(
  p_business_ids uuid[]
)
returns table (
  business_id uuid,
  revenue_month numeric,
  revenue_2025 numeric,
  revenue_currency text,
  ebitda_margin numeric,
  growth_pct numeric,
  data_confidence integer,
  source_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  actor_investor_id uuid;
  requested_count integer := coalesce(cardinality(p_business_ids), 0);
begin
  if actor_uuid is null and not service_actor then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_count = 0 then return; end if;
  if requested_count > 100 then
    raise exception 'At most 100 Business IDs may be requested' using errcode = '22023';
  end if;

  if actor_uuid is not null then
    select i.id into actor_investor_id
    from public.investors i
    where i.owner_id = actor_uuid
      and i.status in (
        'active'::public.account_status,
        'hidden'::public.account_status
      )
    order by i.created_at asc nulls last, i.id
    limit 1;
  end if;

  return query
  with requested as (
    select distinct unnest(p_business_ids) as id
  )
  select
    b.id,
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_month'), b.revenue_month),
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'), b.revenue_2025),
    coalesce(nullif(b.public_snapshot_json->>'revenue_currency', ''), nullif(b.revenue_currency, ''), 'VND'),
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'), b.ebitda_margin),
    coalesce(public.d68_try_numeric(b.public_snapshot_json->>'growth_pct'), b.growth_pct),
    coalesce(public.d68_try_integer(b.public_snapshot_json->>'data_confidence'), b.data_confidence, 0),
    coalesce(b.last_approved_at, b.updated_at)
  from requested r
  join public.businesses b on b.id = r.id
  where b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
    and (
      public.is_admin()
      or service_actor
      or b.owner_id = actor_uuid
      or (
        actor_investor_id is not null
        and exists (
          select 1
          from public.business_financial_access_grants g
          where g.business_id = b.id
            and g.investor_id = actor_investor_id
            and g.status = 'active'
            and (g.expires_at is null or g.expires_at > now())
            and 'financial_summary' = any(g.scopes)
        )
      )
    );
end;
$$;

revoke all on function public.d68_get_business_financial_summaries(uuid[])
from public, anon;
grant execute on function public.d68_get_business_financial_summaries(uuid[])
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
    and i.status in (
      'active'::public.account_status,
      'hidden'::public.account_status
    )
  order by i.created_at asc nulls last, i.id
  limit 1;

  if not found then
    raise exception 'Usable Investor profile required' using errcode = '42501';
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
      'requested_scopes', to_jsonb(normalized_scopes),
      'investor_visibility_status', investor_row.status::text
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

comment on function public.d68_get_business_financial_summaries(uuid[]) is
  'Returns exact approved summary values only to Admin, Business owner, service role, or the owner of an active/hidden Investor profile with an active financial_summary grant.';
comment on function public.d68_request_business_financial_access(uuid, text[], text) is
  'Idempotent request RPC for active or hidden Investor profiles. Hidden is a public-visibility state, not a loss of account entitlement.';

insert into public.audit_logs (
  actor_id, action, entity_type, entity_id, detail
) values (
  null,
  'business_financial_redaction_phase_b_hidden_investor_fix',
  'system',
  'd68_get_business_financial_summaries',
  jsonb_build_object(
    'allowed_investor_statuses', jsonb_build_array('active', 'hidden'),
    'grant_required', true,
    'public_redaction_unchanged', true
  )
);

commit;
