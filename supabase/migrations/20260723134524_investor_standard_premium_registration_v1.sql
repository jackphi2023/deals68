-- Deals68 Investor registration plans — Phase 2.
-- Standard Investor registration is free and must not leave a payment order.
-- Premium registration keeps the existing pending-payment workflow.

create or replace function public.create_signup_bundle_v2(
  user_uuid uuid,
  user_email text,
  role_text text,
  signup_nonce text,
  profile_payload jsonb default '{}'::jsonb,
  business_payload jsonb default null::jsonb,
  investor_payload jsonb default null::jsonb,
  payment_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  auth_email text;
  auth_created_at timestamptz;
  stored_nonce text;
  result_value jsonb;
  safe_role text := lower(trim(coalesce(role_text, '')));
  requested_investor_plan text := lower(trim(coalesce(payment_payload->>'investorPlan', '')));
  skip_payment boolean := lower(trim(coalesce(payment_payload->>'skipPayment', 'false'))) in ('true', '1', 'yes');
  payment_uuid uuid;
begin
  if length(trim(coalesce(signup_nonce, ''))) < 24 then
    raise exception 'Invalid signup nonce' using errcode = '42501';
  end if;

  if skip_payment and not (
    safe_role = 'investor'
    and requested_investor_plan = 'standard'
  ) then
    raise exception 'Payment may only be skipped for Standard Investor registration'
      using errcode = '42501';
  end if;

  select
    lower(coalesce(u.email, '')),
    u.created_at,
    u.raw_user_meta_data->>'signup_nonce'
  into auth_email, auth_created_at, stored_nonce
  from auth.users u
  where u.id = user_uuid
  for update;

  if not found
     or auth_email <> lower(trim(coalesce(user_email, '')))
     or stored_nonce is distinct from signup_nonce
     or auth_created_at < now() - interval '30 minutes' then
    raise exception 'Signup verification failed' using errcode = '42501';
  end if;

  result_value := public.create_signup_bundle(
    user_uuid,
    user_email,
    safe_role,
    coalesce(profile_payload, '{}'::jsonb),
    business_payload,
    investor_payload,
    coalesce(payment_payload, '{}'::jsonb)
  );

  if skip_payment then
    payment_uuid := nullif(result_value->>'payment_order_id', '')::uuid;
    if payment_uuid is null then
      raise exception 'Standard Investor payment cleanup failed';
    end if;

    delete from public.payment_orders
    where id = payment_uuid
      and profile_id = user_uuid
      and investor_id = nullif(result_value->>'investor_id', '')::uuid
      and lower(coalesce(status, '')) = 'pending';

    if not found then
      raise exception 'Standard Investor payment cleanup failed';
    end if;

    result_value := jsonb_set(
      result_value,
      '{payment_order_id}',
      'null'::jsonb,
      true
    ) || jsonb_build_object(
      'payment_skipped', true,
      'investor_plan', 'standard'
    );
  end if;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'signup_nonce'
  where id = user_uuid;

  return result_value;
end;
$$;

revoke all on function public.create_signup_bundle_v2(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) from public;

grant execute on function public.create_signup_bundle_v2(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) to anon, authenticated, service_role;

comment on function public.create_signup_bundle_v2(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) is
  'Creates signup entities atomically. Standard Investor registration leaves no payment order; Premium and other paid registrations keep the existing payment workflow.';
