-- Deals68 G7 — payment/invoice lifecycle hardening.
-- Additive schema + atomic admin confirmation; compatible with current main.

alter table public.payment_orders
  add column if not exists order_code text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists applied_at timestamptz,
  add column if not exists applied_result jsonb not null default '{}'::jsonb;

alter table public.businesses
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_expires_at timestamptz;

alter table public.investors
  add column if not exists membership_started_at timestamptz,
  add column if not exists membership_expires_at timestamptz;

update public.payment_orders
set order_code =
  'D68-OLD-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where nullif(trim(order_code), '') is null;

update public.payment_orders
set confirmed_at = coalesce(confirmed_at, updated_at, created_at, now()),
    applied_at = coalesce(applied_at, updated_at, created_at, now()),
    applied_result = case
      when applied_result = '{}'::jsonb
        then jsonb_build_object('legacy', true, 'note', 'Backfilled before G7 atomic confirmation')
      else applied_result
    end
where lower(coalesce(status, '')) in ('confirmed', 'paid', 'active');

create unique index if not exists payment_orders_order_code_upper_uq
  on public.payment_orders (upper(order_code))
  where order_code is not null;

create or replace function public.prepare_payment_order_row()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  raw_code text;
  clean_code text;
begin
  new.payload := coalesce(new.payload, '{}'::jsonb);

  raw_code := coalesce(
    nullif(trim(new.order_code), ''),
    nullif(trim(new.payload->>'orderCode'), ''),
    nullif(trim(new.payload->>'bankContent'), ''),
    'D68-' || upper(substr(replace(new.id::text, '-', ''), 1, 12))
  );

  clean_code := upper(regexp_replace(raw_code, '[^a-zA-Z0-9-]', '', 'g'));
  if length(clean_code) < 6 then
    clean_code := 'D68-' || upper(substr(replace(new.id::text, '-', ''), 1, 12));
  end if;

  new.order_code := left(clean_code, 40);
  new.payload := jsonb_set(new.payload, '{orderCode}', to_jsonb(new.order_code), true);
  new.payload := jsonb_set(new.payload, '{bankContent}', to_jsonb(new.order_code), true);

  if tg_op = 'INSERT' and not public.is_admin() then
    new.status := 'pending';
    new.confirmed_at := null;
    new.confirmed_by := null;
    new.rejected_at := null;
    new.rejected_by := null;
    new.applied_at := null;
    new.applied_result := '{}'::jsonb;
  end if;

  return new;
end;
$$;

drop trigger if exists payment_orders_prepare_row on public.payment_orders;
create trigger payment_orders_prepare_row
before insert or update of order_code, payload
on public.payment_orders
for each row
execute function public.prepare_payment_order_row();

create or replace function public.can_create_own_payment_order(
  business_uuid uuid,
  investor_uuid uuid,
  profile_uuid uuid,
  created_uuid uuid,
  payment_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and lower(coalesce(payment_status, '')) = 'pending'
    and (profile_uuid = auth.uid() or created_uuid = auth.uid())
    and not (business_uuid is not null and investor_uuid is not null)
    and (
      (
        business_uuid is not null
        and exists (
          select 1
          from public.businesses b
          where b.id = business_uuid
            and b.owner_id = auth.uid()
        )
      )
      or
      (
        investor_uuid is not null
        and exists (
          select 1
          from public.investors i
          where i.id = investor_uuid
            and i.owner_id = auth.uid()
        )
      )
    );
$$;

revoke all on function public.can_create_own_payment_order(uuid, uuid, uuid, uuid, text)
from public, anon;
grant execute on function public.can_create_own_payment_order(uuid, uuid, uuid, uuid, text)
to authenticated;

drop policy if exists payment_orders_own_insert on public.payment_orders;
create policy payment_orders_own_insert
on public.payment_orders
for insert
to authenticated
with check (
  public.can_create_own_payment_order(
    business_id,
    investor_id,
    profile_id,
    created_by,
    status
  )
);

-- Users never need to mutate payment rows after creation.
-- Admin retains full access through payment_orders_admin_all.
drop policy if exists payment_orders_own_update on public.payment_orders;

create or replace function public.admin_set_payment_order_status(
  payment_uuid uuid,
  new_status_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payment_orders%rowtype;
  payload_value jsonb;
  normalized_status text;
  order_type text;
  role_value text;
  target_plan text;
  raw_plan text;
  raw_number text;
  quota_add integer := 0;
  term_weeks integer := 4;
  term_months integer := 1;
  base_time timestamptz;
  result_value jsonb := '{}'::jsonb;
  actor_uuid uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  normalized_status := lower(trim(coalesce(new_status_text, '')));
  if normalized_status not in ('confirmed', 'rejected') then
    raise exception 'Unsupported payment status: %', normalized_status;
  end if;

  select *
  into payment_row
  from public.payment_orders
  where id = payment_uuid
  for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  if normalized_status = 'rejected' then
    if payment_row.applied_at is not null then
      raise exception 'Applied payment cannot be rejected';
    end if;

    if lower(coalesce(payment_row.status, '')) = 'rejected' then
      return jsonb_build_object(
        'payment_id', payment_row.id,
        'status', 'rejected',
        'already_rejected', true
      );
    end if;

    update public.payment_orders
    set status = 'rejected',
        rejected_at = now(),
        rejected_by = actor_uuid,
        updated_at = now()
    where id = payment_row.id;

    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, detail
    )
    values (
      actor_uuid,
      'reject_payment_order',
      'payment_order',
      payment_row.id,
      jsonb_build_object('order_code', payment_row.order_code)
    );

    return jsonb_build_object(
      'payment_id', payment_row.id,
      'status', 'rejected',
      'order_code', payment_row.order_code
    );
  end if;

  if payment_row.applied_at is not null then
    return jsonb_build_object(
      'payment_id', payment_row.id,
      'status', 'confirmed',
      'already_applied', true,
      'order_code', payment_row.order_code,
      'applied_result', payment_row.applied_result
    );
  end if;

  payload_value := coalesce(payment_row.payload, '{}'::jsonb);
  order_type := lower(coalesce(payload_value->>'orderType', ''));
  role_value := lower(coalesce(payload_value->>'role', ''));

  if payment_row.profile_id is not null or payment_row.created_by is not null then
    update public.profiles
    set status = 'active',
        dashboard_login_enabled = true,
        updated_at = now()
    where id = coalesce(payment_row.profile_id, payment_row.created_by);
  end if;

  if payment_row.business_id is not null then
    raw_plan := lower(coalesce(
      payload_value->>'businessPlan',
      payload_value->>'plan',
      payload_value#>>'{price,planLabel}',
      'standard'
    ));

    target_plan := case
      when raw_plan like '%feature%'
        or raw_plan like '%priority%'
        or raw_plan like '%ưu%'
      then 'featured'
      else 'standard'
    end;

    raw_number := coalesce(
      payload_value->>'termWeeks',
      payload_value#>>'{price,termWeeks}',
      ''
    );
    if raw_number ~ '^[0-9]+$' then
      term_weeks := least(104, greatest(1, raw_number::integer));
    end if;

    if order_type = 'business_service_upgrade' then
      raw_number := coalesce(
        payload_value->>'proposalQuota',
        payload_value#>>'{price,proposalQuota}',
        ''
      );
      if raw_number ~ '^[0-9]+$' then
        quota_add := least(100000, greatest(0, raw_number::integer));
      else
        quota_add := case when target_plan = 'featured' then 80 else 50 end;
      end if;

      select greatest(coalesce(plan_expires_at, now()), now())
      into base_time
      from public.businesses
      where id = payment_row.business_id
      for update;

      update public.businesses
      set plan = target_plan,
          quota_total = greatest(0, coalesce(quota_total, 0)) + quota_add,
          plan_started_at = coalesce(plan_started_at, now()),
          plan_expires_at = base_time + make_interval(weeks => term_weeks),
          updated_at = now()
      where id = payment_row.business_id;

      result_value := jsonb_build_object(
        'entity', 'business',
        'action', 'upgrade',
        'plan', target_plan,
        'quota_added', quota_add,
        'term_weeks', term_weeks,
        'expires_at', base_time + make_interval(weeks => term_weeks)
      );
    else
      update public.businesses
      set plan = target_plan,
          status = 'pending_admin_review',
          visible = false,
          plan_started_at = coalesce(plan_started_at, now()),
          plan_expires_at = coalesce(
            plan_expires_at,
            now() + make_interval(weeks => term_weeks)
          ),
          updated_at = now()
      where id = payment_row.business_id;

      result_value := jsonb_build_object(
        'entity', 'business',
        'action', 'registration',
        'plan', target_plan,
        'term_weeks', term_weeks
      );
    end if;
  elsif payment_row.investor_id is not null then
    raw_number := coalesce(
      payload_value->>'termMonths',
      ''
    );

    if raw_number ~ '^[0-9]+$' then
      term_months := least(36, greatest(1, raw_number::integer));
    else
      raw_number := coalesce(
        payload_value->>'termWeeks',
        payload_value#>>'{price,termWeeks}',
        '4'
      );
      if raw_number ~ '^[0-9]+$' then
        term_months := least(
          36,
          greatest(1, ceil(raw_number::numeric / 4.0)::integer)
        );
      end if;
    end if;

    select greatest(coalesce(membership_expires_at, now()), now())
    into base_time
    from public.investors
    where id = payment_row.investor_id
    for update;

    if order_type = 'investor_service_upgrade' then
      update public.investors
      set membership_started_at = coalesce(membership_started_at, now()),
          membership_expires_at =
            base_time + make_interval(months => term_months),
          updated_at = now()
      where id = payment_row.investor_id;

      result_value := jsonb_build_object(
        'entity', 'investor',
        'action', 'upgrade',
        'term_months', term_months,
        'expires_at',
          base_time + make_interval(months => term_months)
      );
    else
      update public.investors
      set status = 'pending_admin_review',
          visible = false,
          membership_started_at = coalesce(membership_started_at, now()),
          membership_expires_at = coalesce(
            membership_expires_at,
            now() + make_interval(months => term_months)
          ),
          updated_at = now()
      where id = payment_row.investor_id;

      result_value := jsonb_build_object(
        'entity', 'investor',
        'action', 'registration',
        'term_months', term_months
      );
    end if;
  else
    result_value := jsonb_build_object(
      'entity', coalesce(nullif(role_value, ''), 'profile'),
      'action', 'profile_activation'
    );
  end if;

  update public.payment_orders
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = actor_uuid,
      rejected_at = null,
      rejected_by = null,
      applied_at = now(),
      applied_result = result_value,
      updated_at = now()
  where id = payment_row.id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, detail
  )
  values (
    actor_uuid,
    'confirm_payment_order_atomic',
    'payment_order',
    payment_row.id,
    jsonb_build_object(
      'order_code', payment_row.order_code,
      'business_id', payment_row.business_id,
      'investor_id', payment_row.investor_id,
      'profile_id', payment_row.profile_id,
      'result', result_value
    )
  );

  return jsonb_build_object(
    'payment_id', payment_row.id,
    'status', 'confirmed',
    'order_code', payment_row.order_code,
    'applied_result', result_value
  );
end;
$$;

revoke all on function public.admin_set_payment_order_status(uuid, text)
from public, anon;
grant execute on function public.admin_set_payment_order_status(uuid, text)
to authenticated;

comment on column public.payment_orders.order_code is
  'Unique bank transfer/payment reference for one payment order.';
comment on column public.payment_orders.applied_at is
  'Set exactly once after payment side effects are atomically applied.';
comment on column public.businesses.plan_expires_at is
  'Current paid Business service expiry timestamp.';
comment on column public.investors.membership_expires_at is
  'Current paid Investor membership expiry timestamp.';
