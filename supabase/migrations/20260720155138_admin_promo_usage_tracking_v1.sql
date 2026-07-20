create or replace function public.d68_payment_order_promo_code(order_payload jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
    upper(trim(coalesce(
      nullif(order_payload->>'promoCode', ''),
      nullif(order_payload#>>'{price,promoCode}', ''),
      nullif(order_payload#>>'{pricing,promoCode}', ''),
      nullif(order_payload#>>'{checkout_intent,promoCode}', '')
    ))),
    ''
  );
$$;

create or replace function public.get_admin_promo_usage(promo_uuid uuid)
returns table (
  promo_id uuid,
  payment_order_id uuid,
  order_code text,
  entity_type text,
  entity_code text,
  entity_name text,
  service_plan text,
  service_amount numeric,
  discount_amount numeric,
  currency text,
  used_at timestamptz,
  payment_status text,
  payment_confirmed boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.promo_codes pc where pc.id = promo_uuid) then
    raise exception 'Promotion code not found' using errcode = 'P0002';
  end if;

  return query
  with normalized_orders as (
    select
      po.*,
      public.d68_payment_order_promo_code(coalesce(po.payload, '{}'::jsonb)) as normalized_promo_code,
      case
        when jsonb_typeof(po.payload->'price') = 'object' then po.payload->'price'
        when jsonb_typeof(po.payload->'pricing') = 'object' then po.payload->'pricing'
        else '{}'::jsonb
      end as pricing_json
    from public.payment_orders po
  )
  select
    pc.id,
    no.id,
    no.order_code,
    case
      when no.business_id is not null then 'business'
      when no.investor_id is not null then 'investor'
      else coalesce(nullif(no.payload->>'role', ''), 'profile')
    end,
    coalesce(
      nullif(b.public_code, ''),
      nullif(i.code, ''),
      no.business_id::text,
      no.investor_id::text,
      no.profile_id::text,
      '—'
    ),
    coalesce(
      nullif(b.company_name_private, ''),
      nullif(b.title_vi, ''),
      nullif(b.title_en, ''),
      nullif(i.private_name, ''),
      nullif(i.title_vi, ''),
      nullif(i.title_en, ''),
      nullif(pr.display_name, ''),
      nullif(pr.username, ''),
      nullif(no.title, ''),
      '—'
    ),
    concat_ws(
      ' · ',
      coalesce(
        nullif(no.pricing_json->>'planLabel', ''),
        nullif(no.payload->>'businessPlan', ''),
        nullif(no.payload->>'plan', ''),
        'Gói dịch vụ'
      ),
      case
        when public.d68_try_numeric(no.pricing_json->>'termWeeks') > 0 then
          case
            when coalesce(no.payload->>'role', no.pricing_json->>'role') = 'business'
              then trim(to_char(public.d68_try_numeric(no.pricing_json->>'termWeeks'), 'FM999999990')) || ' tuần'
            else trim(to_char(round(public.d68_try_numeric(no.pricing_json->>'termWeeks') / 4), 'FM999999990')) || ' tháng'
          end
      end
    ),
    coalesce(
      public.d68_try_numeric(no.pricing_json->>'total'),
      public.d68_try_numeric(no.payload->>'amount'),
      0
    ),
    coalesce(public.d68_try_numeric(no.pricing_json->>'promoDiscount'), 0),
    coalesce(
      nullif(no.pricing_json->>'currency', ''),
      nullif(no.payload->>'currency', ''),
      'VND'
    ),
    no.created_at,
    coalesce(no.status, 'pending'),
    (
      lower(coalesce(no.status, '')) in ('confirmed', 'paid', 'active', 'approved', 'applied')
      or no.confirmed_at is not null
      or no.applied_at is not null
    )
  from public.promo_codes pc
  join normalized_orders no
    on no.normalized_promo_code = upper(trim(pc.code))
  left join public.businesses b on b.id = no.business_id
  left join public.investors i on i.id = no.investor_id
  left join public.profiles pr on pr.id = coalesce(no.profile_id, no.created_by)
  where pc.id = promo_uuid
  order by no.created_at desc;
end;
$$;

create or replace function public.get_admin_promo_usage_summary()
returns table (
  promo_id uuid,
  usage_count bigint,
  confirmed_count bigint,
  service_amount_total numeric,
  discount_amount_total numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  return query
  with normalized_orders as (
    select
      po.id,
      po.status,
      po.confirmed_at,
      po.applied_at,
      po.payload,
      public.d68_payment_order_promo_code(coalesce(po.payload, '{}'::jsonb)) as normalized_promo_code,
      case
        when jsonb_typeof(po.payload->'price') = 'object' then po.payload->'price'
        when jsonb_typeof(po.payload->'pricing') = 'object' then po.payload->'pricing'
        else '{}'::jsonb
      end as pricing_json
    from public.payment_orders po
  )
  select
    pc.id,
    count(no.id),
    count(no.id) filter (
      where lower(coalesce(no.status, '')) in ('confirmed', 'paid', 'active', 'approved', 'applied')
        or no.confirmed_at is not null
        or no.applied_at is not null
    ),
    coalesce(sum(coalesce(
      public.d68_try_numeric(no.pricing_json->>'total'),
      public.d68_try_numeric(no.payload->>'amount'),
      0
    )), 0),
    coalesce(sum(coalesce(public.d68_try_numeric(no.pricing_json->>'promoDiscount'), 0)), 0)
  from public.promo_codes pc
  left join normalized_orders no
    on no.normalized_promo_code = upper(trim(pc.code))
  group by pc.id;
end;
$$;

revoke all on function public.get_admin_promo_usage(uuid) from public;
revoke all on function public.get_admin_promo_usage_summary() from public;
grant execute on function public.get_admin_promo_usage(uuid) to authenticated, service_role;
grant execute on function public.get_admin_promo_usage_summary() to authenticated, service_role;

comment on function public.get_admin_promo_usage(uuid) is 'Admin-only normalized promotion usage rows derived from payment orders.';
comment on function public.get_admin_promo_usage_summary() is 'Admin-only promotion usage counts and amount totals derived from payment orders.';
