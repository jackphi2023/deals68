-- Deals68 Investor Plan Entitlements — Phase 1.
-- Adds Standard/Premium plan state, server-side entitlement checks, Admin controls,
-- payment-to-Premium synchronization and a canonical Premium price contract.

alter table public.investors
  add column if not exists plan text not null default 'standard';

-- Founder decision: every Investor existing before this migration starts on Standard.
-- Historical payment orders remain intact; stale membership timestamps are removed so
-- they cannot accidentally grant Premium access.
update public.investors
set plan = 'standard',
    membership_started_at = null,
    membership_expires_at = null,
    updated_at = now();

alter table public.investors
  alter column plan set default 'standard',
  alter column plan set not null;

alter table public.investors
  drop constraint if exists investors_plan_check;

alter table public.investors
  add constraint investors_plan_check
  check (plan in ('standard', 'premium'));

create index if not exists investors_plan_expiry_idx
  on public.investors (plan, membership_expires_at);

comment on column public.investors.plan is
  'Investor commercial plan. Standard keeps core marketplace access; Premium unlocks paid analytics entitlements.';
comment on column public.investors.membership_started_at is
  'Premium Investor service start timestamp. Null for Standard or indefinite Premium granted by Admin.';
comment on column public.investors.membership_expires_at is
  'Premium Investor service expiry timestamp. Null means no expiry only when plan is Premium.';

create or replace function public.d68_guard_investor_plan_contract()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  privileged boolean :=
    public.is_admin()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if tg_op = 'INSERT' then
    if not privileged then
      new.plan := 'standard';
      new.membership_started_at := null;
      new.membership_expires_at := null;
    end if;
    return new;
  end if;

  if not privileged and (
    new.plan is distinct from old.plan
    or new.membership_started_at is distinct from old.membership_started_at
    or new.membership_expires_at is distinct from old.membership_expires_at
  ) then
    raise exception 'Investor plan changes require Admin, payment confirmation or service role'
      using errcode = '42501';
  end if;

  if privileged then
    -- An explicit downgrade clears Premium dates.
    if new.plan = 'standard' and old.plan is distinct from 'standard' then
      new.membership_started_at := null;
      new.membership_expires_at := null;
    -- Existing payment confirmation writes membership timestamps. Promote the row
    -- atomically even though the legacy payment RPC predates the plan column.
    elsif (
      new.membership_started_at is distinct from old.membership_started_at
      or new.membership_expires_at is distinct from old.membership_expires_at
    ) and (
      new.membership_started_at is not null
      or new.membership_expires_at is not null
    ) then
      new.plan := 'premium';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.d68_guard_investor_plan_contract()
from public, anon, authenticated;

drop trigger if exists investors_plan_contract_insert on public.investors;
create trigger investors_plan_contract_insert
before insert on public.investors
for each row execute function public.d68_guard_investor_plan_contract();

drop trigger if exists investors_plan_contract_update on public.investors;
create trigger investors_plan_contract_update
before update of plan, membership_started_at, membership_expires_at
on public.investors
for each row execute function public.d68_guard_investor_plan_contract();

create or replace function public.d68_get_investor_premium_price(
  p_country_iso2 text default 'VN'
)
returns jsonb
language sql
immutable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'plan', 'premium',
    'billing_period', 'month',
    'currency', case when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 'VND' else 'USD' end,
    'unit_amount', case when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 50000000 else 2500 end
  );
$$;

revoke all on function public.d68_get_investor_premium_price(text)
from public;
grant execute on function public.d68_get_investor_premium_price(text)
to anon, authenticated, service_role;

create or replace function public.d68_get_investor_plan_snapshot(
  p_investor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  investor_row public.investors%rowtype;
  premium_active boolean;
begin
  select *
  into investor_row
  from public.investors
  where id = p_investor_id;

  if not found then
    raise exception 'Investor not found' using errcode = 'P0002';
  end if;

  if not (
    investor_row.owner_id = auth.uid()
    or public.is_admin()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  ) then
    raise exception 'Investor plan access denied' using errcode = '42501';
  end if;

  premium_active :=
    investor_row.plan = 'premium'
    and (
      investor_row.membership_expires_at is null
      or investor_row.membership_expires_at > now()
    );

  return jsonb_build_object(
    'investor_id', investor_row.id,
    'stored_plan', investor_row.plan,
    'effective_plan', case when premium_active then 'premium' else 'standard' end,
    'premium_active', premium_active,
    'membership_started_at', investor_row.membership_started_at,
    'membership_expires_at', investor_row.membership_expires_at,
    'entitlements', jsonb_build_object(
      'receive_proposals', true,
      'save_businesses', true,
      'express_interest', true,
      'request_documents', true,
      'dataroom_access', true,
      'investment_opportunity_report', premium_active,
      'portfolio_management', premium_active,
      'advanced_analytics', premium_active
    )
  );
end;
$$;

revoke all on function public.d68_get_investor_plan_snapshot(uuid)
from public, anon;
grant execute on function public.d68_get_investor_plan_snapshot(uuid)
to authenticated, service_role;

create or replace function public.d68_investor_has_entitlement(
  p_investor_id uuid,
  p_entitlement_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  entitlement_key text := lower(trim(coalesce(p_entitlement_key, '')));
begin
  snapshot := public.d68_get_investor_plan_snapshot(p_investor_id);

  if entitlement_key not in (
    'receive_proposals',
    'save_businesses',
    'express_interest',
    'request_documents',
    'dataroom_access',
    'investment_opportunity_report',
    'portfolio_management',
    'advanced_analytics'
  ) then
    return false;
  end if;

  return coalesce((snapshot -> 'entitlements' ->> entitlement_key)::boolean, false);
end;
$$;

revoke all on function public.d68_investor_has_entitlement(uuid, text)
from public, anon;
grant execute on function public.d68_investor_has_entitlement(uuid, text)
to authenticated, service_role;

create or replace function public.admin_set_investor_plan(
  p_investor_id uuid,
  p_plan text,
  p_started_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  investor_row public.investors%rowtype;
  normalized_plan text := lower(trim(coalesce(p_plan, '')));
  effective_started_at timestamptz;
  actor_uuid uuid := auth.uid();
  result_value jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if normalized_plan not in ('standard', 'premium') then
    raise exception 'Unsupported Investor plan: %', normalized_plan;
  end if;

  select *
  into investor_row
  from public.investors
  where id = p_investor_id
  for update;

  if not found then
    raise exception 'Investor not found' using errcode = 'P0002';
  end if;

  if normalized_plan = 'premium' then
    effective_started_at := coalesce(p_started_at, now());
    if p_expires_at is not null and p_expires_at <= effective_started_at then
      raise exception 'Premium expiry must be later than its start time';
    end if;

    update public.investors
    set plan = 'premium',
        membership_started_at = effective_started_at,
        membership_expires_at = p_expires_at,
        updated_at = now()
    where id = p_investor_id;
  else
    update public.investors
    set plan = 'standard',
        membership_started_at = null,
        membership_expires_at = null,
        updated_at = now()
    where id = p_investor_id;
  end if;

  result_value := public.d68_get_investor_plan_snapshot(p_investor_id);

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_uuid,
    'admin_set_investor_plan',
    'investor',
    p_investor_id,
    jsonb_build_object(
      'old_plan', investor_row.plan,
      'new_plan', normalized_plan,
      'old_membership_started_at', investor_row.membership_started_at,
      'old_membership_expires_at', investor_row.membership_expires_at,
      'new_membership_started_at', result_value ->> 'membership_started_at',
      'new_membership_expires_at', result_value ->> 'membership_expires_at',
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'source', 'admin'
    )
  );

  return result_value;
end;
$$;

revoke all on function public.admin_set_investor_plan(uuid, text, timestamptz, timestamptz, text)
from public, anon;
grant execute on function public.admin_set_investor_plan(uuid, text, timestamptz, timestamptz, text)
to authenticated;

comment on function public.d68_investor_has_entitlement(uuid, text) is
  'Checks package entitlement only. eNDA, Dataroom grants and Business-specific access remain separate mandatory gates.';
comment on function public.admin_set_investor_plan(uuid, text, timestamptz, timestamptz, text) is
  'Admin-only audited Standard/Premium assignment. Premium may have an expiry or be indefinite.';
