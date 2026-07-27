-- Deals68 Market Partner / Affiliate v1 — Phase 5 commission, payout and account activation.
-- Additive/compatible. Commission uses the immutable Phase 4 payment snapshot.
-- Payment confirmation is never rolled back by an affiliate reconciliation error.

alter table public.affiliate_commissions
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb;

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_policy_snapshot_object_check,
  add constraint affiliate_commissions_policy_snapshot_object_check
    check (jsonb_typeof(policy_snapshot) = 'object');

alter table public.affiliate_payouts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.affiliate_payouts
  drop constraint if exists affiliate_payouts_metadata_object_check,
  add constraint affiliate_payouts_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

create or replace function public.d68_can_claim_market_partner_account(
  p_email text,
  p_affiliate_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text := public.d68_normalize_affiliate_code(p_affiliate_code);
begin
  if v_email = '' or position('@' in v_email) <= 1 or v_code is null then
    return false;
  end if;

  return exists (
    select 1
    from public.market_partners mp
    where lower(mp.contact_email) = v_email
      and mp.affiliate_code = v_code
      and mp.status = 'active'
      and mp.profile_id is null
  )
  and not exists (
    select 1 from public.profiles p where lower(coalesce(p.email, '')) = v_email
  )
  and not exists (
    select 1 from auth.users u where lower(coalesce(u.email, '')) = v_email
  );
end;
$$;

create or replace function public.d68_claim_market_partner_signup(
  user_uuid uuid,
  user_email text,
  affiliate_code text,
  activation_nonce text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_email text;
  v_auth_created_at timestamptz;
  v_auth_metadata jsonb := '{}'::jsonb;
  v_partner public.market_partners%rowtype;
  v_existing_role text;
  v_code text := public.d68_normalize_affiliate_code(affiliate_code);
begin
  if user_uuid is null
     or length(btrim(coalesce(activation_nonce, ''))) < 24
     or v_code is null then
    raise exception 'Market Partner activation data is invalid' using errcode = '42501';
  end if;

  select lower(coalesce(u.email, '')), u.created_at, coalesce(u.raw_user_meta_data, '{}'::jsonb)
  into v_auth_email, v_auth_created_at, v_auth_metadata
  from auth.users u
  where u.id = user_uuid
  for update;

  if not found
     or v_auth_email <> lower(btrim(coalesce(user_email, '')))
     or v_auth_created_at < now() - interval '30 minutes'
     or v_auth_metadata->>'role' is distinct from 'market_partner'
     or v_auth_metadata->>'market_partner_activation_nonce' is distinct from activation_nonce
     or public.d68_normalize_affiliate_code(v_auth_metadata->>'market_partner_affiliate_code') is distinct from v_code then
    raise exception 'Market Partner activation data is invalid' using errcode = '42501';
  end if;

  select * into v_partner
  from public.market_partners mp
  where lower(mp.contact_email) = v_auth_email
    and mp.affiliate_code = v_code
    and mp.status = 'active'
  for update;

  if v_partner.id is null
     or (v_partner.profile_id is not null and v_partner.profile_id is distinct from user_uuid) then
    raise exception 'Market Partner activation data is invalid' using errcode = '42501';
  end if;

  select p.role::text into v_existing_role
  from public.profiles p
  where p.id = user_uuid;

  if v_existing_role is not null and v_existing_role <> 'market_partner' then
    raise exception 'Market Partner activation data is invalid' using errcode = '42501';
  end if;

  insert into public.profiles (
    id, role, username, display_name, email, country_iso2, language_code,
    timezone, phone_country_iso2, phone, status, dashboard_login_enabled,
    created_at, updated_at
  ) values (
    user_uuid,
    'market_partner'::public.user_role,
    lower(v_partner.affiliate_code),
    v_partner.display_name,
    v_partner.contact_email,
    coalesce(v_partner.country_iso2, 'VN'),
    'vi',
    'Asia/Ho_Chi_Minh',
    coalesce(v_partner.country_iso2, 'VN'),
    v_partner.phone,
    'active'::public.account_status,
    true,
    now(),
    now()
  )
  on conflict (id) do update
  set display_name = excluded.display_name,
      username = excluded.username,
      email = excluded.email,
      country_iso2 = excluded.country_iso2,
      phone_country_iso2 = excluded.phone_country_iso2,
      phone = excluded.phone,
      status = 'active'::public.account_status,
      dashboard_login_enabled = true,
      updated_at = now()
  where public.profiles.role = 'market_partner'::public.user_role;

  update public.market_partners
  set profile_id = user_uuid,
      activated_at = coalesce(activated_at, now()),
      updated_at = now()
  where id = v_partner.id
  returning * into v_partner;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'market_partner_activation_nonce'
    - 'market_partner_affiliate_code'
  where id = user_uuid;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    user_uuid,
    'claim_market_partner_account',
    'market_partner',
    v_partner.id::text,
    jsonb_build_object('affiliate_code', v_partner.affiliate_code, 'profile_id', user_uuid)
  );

  return jsonb_build_object(
    'partner_id', v_partner.id,
    'profile_id', v_partner.profile_id,
    'display_name', v_partner.display_name,
    'affiliate_code', v_partner.affiliate_code,
    'status', v_partner.status
  );
end;
$$;

create or replace function public.d68_create_affiliate_commission_for_payment(
  p_payment_order_id uuid,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payment_orders%rowtype;
  v_partner public.market_partners%rowtype;
  v_attribution public.affiliate_attributions%rowtype;
  v_commission public.affiliate_commissions%rowtype;
  v_affiliate jsonb;
  v_policy jsonb;
  v_partner_id uuid;
  v_click_id uuid;
  v_code text;
  v_subject_profile_id uuid;
  v_currency text;
  v_basis_currency text;
  v_policy_version text;
  v_amount_text text;
  v_net_paid numeric;
  v_tier_1_max numeric;
  v_tier_2_max numeric;
  v_tier_1_pct numeric;
  v_tier_2_pct numeric;
  v_tier_3_pct numeric;
  v_commission_pct numeric;
  v_actor uuid;
begin
  select * into v_payment
  from public.payment_orders po
  where po.id = p_payment_order_id;

  if v_payment.id is null then
    raise exception 'Payment order not found' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_payment.status, '')) <> 'confirmed' or v_payment.confirmed_at is null then
    raise exception 'Commission requires a confirmed payment' using errcode = 'P0001';
  end if;

  select * into v_commission
  from public.affiliate_commissions c
  where c.payment_order_id = v_payment.id;
  if v_commission.id is not null then
    return to_jsonb(v_commission);
  end if;

  v_affiliate := v_payment.payload->'affiliate';
  if v_affiliate is null or jsonb_typeof(v_affiliate) <> 'object' then
    return null;
  end if;

  begin
    v_partner_id := nullif(v_affiliate->>'partner_id', '')::uuid;
    v_click_id := nullif(v_affiliate->>'click_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Affiliate payment snapshot contains invalid identifiers' using errcode = '22023';
  end;

  v_code := public.d68_normalize_affiliate_code(v_affiliate->>'affiliate_code');
  v_subject_profile_id := coalesce(v_payment.profile_id, v_payment.created_by);
  if v_partner_id is null or v_subject_profile_id is null or v_code is null then
    raise exception 'Affiliate payment snapshot is incomplete' using errcode = '22023';
  end if;

  select * into v_partner
  from public.market_partners mp
  where mp.id = v_partner_id
    and mp.affiliate_code = v_code;
  if v_partner.id is null then
    raise exception 'Affiliate payment snapshot does not match a Market Partner' using errcode = '42501';
  end if;

  select * into v_attribution
  from public.affiliate_attributions a
  where a.partner_id = v_partner.id
    and a.subject_profile_id = v_subject_profile_id
    and (v_click_id is null or a.click_id = v_click_id)
  limit 1;
  if v_attribution.id is null then
    raise exception 'Affiliate attribution does not match the confirmed payment' using errcode = '42501';
  end if;

  v_amount_text := replace(replace(btrim(coalesce(v_affiliate->>'net_paid_amount', '')), ',', ''), ' ', '');
  if v_amount_text !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'Affiliate payment snapshot has an invalid net paid amount' using errcode = '22023';
  end if;
  v_net_paid := v_amount_text::numeric;
  v_currency := upper(btrim(coalesce(v_affiliate->>'currency', '')));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Affiliate payment snapshot has an invalid currency' using errcode = '22023';
  end if;

  v_policy := v_affiliate->'commission_policy';
  if v_policy is null or jsonb_typeof(v_policy) <> 'object' then
    raise exception 'Affiliate payment snapshot has no commission policy' using errcode = '22023';
  end if;

  v_basis_currency := upper(btrim(coalesce(v_policy->>'basis_currency', '')));
  v_policy_version := nullif(btrim(coalesce(v_affiliate->>'policy_version', '')), '');
  begin
    v_tier_1_max := (v_policy->>'tier_1_max')::numeric;
    v_tier_2_max := (v_policy->>'tier_2_max')::numeric;
    v_tier_1_pct := (v_policy->>'tier_1_pct')::numeric;
    v_tier_2_pct := (v_policy->>'tier_2_pct')::numeric;
    v_tier_3_pct := (v_policy->>'tier_3_pct')::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Affiliate commission policy snapshot is invalid' using errcode = '22023';
  end;

  if v_basis_currency is distinct from v_currency
     or v_policy_version is null
     or v_tier_1_max < 0
     or v_tier_2_max <= v_tier_1_max
     or v_tier_1_pct not between 0 and 100
     or v_tier_2_pct not between 0 and 100
     or v_tier_3_pct not between 0 and 100 then
    raise exception 'Affiliate commission policy snapshot requires Admin reconciliation' using errcode = '22023';
  end if;

  v_commission_pct := case
    when v_net_paid < v_tier_1_max then v_tier_1_pct
    when v_net_paid <= v_tier_2_max then v_tier_2_pct
    else v_tier_3_pct
  end;
  v_actor := coalesce(p_actor_id, v_payment.confirmed_by, auth.uid());

  insert into public.affiliate_commissions (
    partner_id, attribution_id, payment_order_id, currency, net_paid_amount,
    commission_pct, status, source, policy_snapshot, created_by, created_at, updated_at
  ) values (
    v_partner.id,
    v_attribution.id,
    v_payment.id,
    v_currency,
    v_net_paid,
    v_commission_pct,
    'pending',
    'payment_confirmed',
    v_policy || jsonb_build_object(
      'affiliate_policy_version', v_policy_version,
      'customer_discount_pct', v_affiliate->'customer_discount_pct',
      'discount_amount', v_affiliate->'discount_amount',
      'eligible_amount', v_affiliate->'eligible_amount',
      'net_paid_amount', v_net_paid,
      'currency', v_currency,
      'selected_commission_pct', v_commission_pct,
      'snapshot_source', 'payment_order.payload.affiliate'
    ),
    v_actor,
    now(),
    now()
  )
  on conflict (payment_order_id) do nothing
  returning * into v_commission;

  if v_commission.id is null then
    select * into v_commission
    from public.affiliate_commissions c
    where c.payment_order_id = v_payment.id;
  end if;

  update public.affiliate_attributions
  set status = case when status = 'registered' then 'qualified' else status end,
      qualified_at = coalesce(qualified_at, now()),
      updated_at = now()
  where id = v_attribution.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    v_actor,
    'auto_create_affiliate_commission',
    'affiliate_commission',
    v_commission.id::text,
    jsonb_build_object(
      'partner_id', v_commission.partner_id,
      'payment_order_id', v_commission.payment_order_id,
      'net_paid_amount', v_commission.net_paid_amount,
      'commission_pct', v_commission.commission_pct,
      'commission_amount', v_commission.commission_amount,
      'currency', v_commission.currency,
      'policy_version', v_policy_version
    )
  );

  return to_jsonb(v_commission);
end;
$$;

create or replace function public.d68_payment_confirmed_affiliate_commission_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if lower(coalesce(new.status, '')) = 'confirmed'
     and new.confirmed_at is not null
     and new.payload ? 'affiliate'
     and (
       tg_op = 'INSERT'
       or lower(coalesce(old.status, '')) <> 'confirmed'
       or old.confirmed_at is null
     ) then
    begin
      v_result := public.d68_create_affiliate_commission_for_payment(
        new.id,
        coalesce(new.confirmed_by, auth.uid())
      );
    exception when others then
      insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
      values (
        coalesce(new.confirmed_by, auth.uid()),
        'affiliate_commission_auto_create_failed',
        'payment_order',
        new.id::text,
        jsonb_build_object(
          'order_code', new.order_code,
          'sqlstate', sqlstate,
          'error', left(sqlerrm, 500),
          'requires_admin_reconciliation', true
        )
      );
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists d68_payment_confirmed_affiliate_commission on public.payment_orders;
create trigger d68_payment_confirmed_affiliate_commission
after insert or update of status, confirmed_at on public.payment_orders
for each row execute function public.d68_payment_confirmed_affiliate_commission_trigger();

create or replace function public.d68_admin_create_affiliate_commission(
  p_attribution_id uuid,
  p_payment_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  v_result := public.d68_create_affiliate_commission_for_payment(p_payment_order_id, auth.uid());
  if v_result is null then
    raise exception 'Payment order has no affiliate snapshot' using errcode = 'P0001';
  end if;
  if (v_result->>'attribution_id')::uuid is distinct from p_attribution_id then
    raise exception 'Attribution does not match payment order' using errcode = '42501';
  end if;
  return v_result;
end;
$$;

create or replace function public.d68_admin_reconcile_affiliate_payment(p_payment_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  return public.d68_create_affiliate_commission_for_payment(p_payment_order_id, auth.uid());
end;
$$;

create or replace function public.d68_admin_set_affiliate_commission_status(
  p_commission_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.affiliate_commissions%rowtype;
  v_after public.affiliate_commissions%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  if v_status not in ('approved', 'rejected', 'reversed') then
    raise exception 'Use payout workflow to mark commission paid' using errcode = '22023';
  end if;

  select * into v_before
  from public.affiliate_commissions c
  where c.id = p_commission_id
  for update;
  if v_before.id is null then
    raise exception 'Affiliate commission not found' using errcode = 'P0002';
  end if;
  if v_before.status = 'paid' then
    raise exception 'Paid commission is immutable' using errcode = 'P0001';
  end if;
  if v_before.payout_id is not null then
    raise exception 'Commission already belongs to a payout' using errcode = 'P0001';
  end if;
  if v_status in ('approved', 'rejected') and v_before.status <> 'pending' then
    raise exception 'Only pending commission may be approved or rejected' using errcode = 'P0001';
  end if;
  if v_status = 'rejected' and v_note is null then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;
  if v_status = 'reversed' and v_before.status <> 'approved' then
    raise exception 'Only approved commission may be reversed' using errcode = 'P0001';
  end if;

  update public.affiliate_commissions
  set status = v_status,
      approved_by = case when v_status = 'approved' then auth.uid() else approved_by end,
      approved_at = case when v_status = 'approved' then now() else approved_at end,
      rejected_by = case when v_status = 'rejected' then auth.uid() else rejected_by end,
      rejected_at = case when v_status = 'rejected' then now() else rejected_at end,
      rejection_reason = case when v_status = 'rejected' then v_note else rejection_reason end,
      note = coalesce(v_note, note),
      updated_at = now()
  where id = p_commission_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'set_affiliate_commission_status',
    'affiliate_commission',
    v_after.id::text,
    jsonb_build_object('old_status', v_before.status, 'new_status', v_after.status, 'note', v_note)
  );

  return to_jsonb(v_after);
end;
$$;

create or replace function public.d68_admin_create_affiliate_payout(
  p_partner_id uuid,
  p_currency text,
  p_commission_ids uuid[],
  p_period_start date default null,
  p_period_end date default null,
  p_adjustment_amount numeric default 0,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.affiliate_payouts%rowtype;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_count integer;
  v_distinct_count integer;
  v_gross numeric;
  v_code text;
  v_bank jsonb;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  if p_partner_id is null or coalesce(cardinality(p_commission_ids), 0) = 0 then
    raise exception 'At least one commission is required' using errcode = '22023';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Payout currency is invalid' using errcode = '22023';
  end if;
  if p_period_start is not null and p_period_end is not null and p_period_start > p_period_end then
    raise exception 'Payout period is invalid' using errcode = '22023';
  end if;

  perform 1
  from public.affiliate_commissions c
  where c.id = any(p_commission_ids)
  for update;

  select count(*), count(distinct c.id), coalesce(sum(c.commission_amount), 0)
  into v_count, v_distinct_count, v_gross
  from public.affiliate_commissions c
  where c.id = any(p_commission_ids)
    and c.partner_id = p_partner_id
    and c.currency = v_currency
    and c.status = 'approved'
    and c.payout_id is null;

  if v_count <> cardinality(p_commission_ids) or v_distinct_count <> v_count then
    raise exception 'Payout commissions must be unique, approved, unassigned and use one Partner/currency' using errcode = '22023';
  end if;

  select mp.bank_account_json into v_bank
  from public.market_partners mp
  where mp.id = p_partner_id;
  if v_bank is null then
    raise exception 'Market Partner not found' using errcode = 'P0002';
  end if;

  v_code := 'D68PO-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.affiliate_payouts (
    partner_id, payout_code, period_start, period_end, currency,
    gross_commission_amount, adjustment_amount, commission_count,
    status, note, metadata, created_by, created_at, updated_at
  ) values (
    p_partner_id,
    v_code,
    p_period_start,
    p_period_end,
    v_currency,
    round(v_gross, 2),
    round(coalesce(p_adjustment_amount, 0), 2),
    v_count,
    'draft',
    nullif(left(btrim(coalesce(p_note, '')), 1000), ''),
    jsonb_build_object(
      'bank_account_snapshot', coalesce(v_bank, '{}'::jsonb),
      'commission_ids', to_jsonb(p_commission_ids),
      'created_policy', 'approved_unpaid_commissions'
    ),
    auth.uid(),
    now(),
    now()
  ) returning * into v_payout;

  update public.affiliate_commissions
  set payout_id = v_payout.id, updated_at = now()
  where id = any(p_commission_ids);

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'create_affiliate_payout',
    'affiliate_payout',
    v_payout.id::text,
    jsonb_build_object(
      'partner_id', p_partner_id,
      'payout_code', v_payout.payout_code,
      'currency', v_currency,
      'commission_count', v_count,
      'gross_commission_amount', v_gross,
      'adjustment_amount', coalesce(p_adjustment_amount, 0)
    )
  );

  return to_jsonb(v_payout);
end;
$$;

create or replace function public.d68_admin_set_affiliate_payout_status(
  p_payout_id uuid,
  p_status text,
  p_payment_reference text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.affiliate_payouts%rowtype;
  v_after public.affiliate_payouts%rowtype;
  v_partner public.market_partners%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_reference text := nullif(left(btrim(coalesce(p_payment_reference, '')), 200), '');
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  if v_status not in ('approved', 'processing', 'paid', 'rejected', 'cancelled') then
    raise exception 'Unsupported payout status' using errcode = '22023';
  end if;

  select * into v_before
  from public.affiliate_payouts p
  where p.id = p_payout_id
  for update;
  if v_before.id is null then
    raise exception 'Affiliate payout not found' using errcode = 'P0002';
  end if;
  if v_before.status in ('paid', 'rejected', 'cancelled') then
    raise exception 'Terminal payout status is immutable' using errcode = 'P0001';
  end if;
  if v_status = 'approved' and v_before.status <> 'draft' then
    raise exception 'Only draft payout may be approved' using errcode = 'P0001';
  end if;
  if v_status = 'processing' and v_before.status <> 'approved' then
    raise exception 'Only approved payout may enter processing' using errcode = 'P0001';
  end if;
  if v_status = 'paid' and v_before.status not in ('approved', 'processing') then
    raise exception 'Only approved or processing payout may be marked paid' using errcode = 'P0001';
  end if;
  if v_status in ('rejected', 'cancelled') and v_note is null then
    raise exception 'Reason is required' using errcode = '22023';
  end if;

  if v_status = 'paid' then
    if v_reference is null then
      raise exception 'Payment reference is required' using errcode = '22023';
    end if;
    select * into v_partner from public.market_partners mp where mp.id = v_before.partner_id;
    if nullif(btrim(coalesce(v_partner.bank_account_json->>'bank_name', '')), '') is null
       or nullif(btrim(coalesce(v_partner.bank_account_json->>'account_holder', '')), '') is null
       or nullif(btrim(coalesce(v_partner.bank_account_json->>'account_number', '')), '') is null then
      raise exception 'Partner bank account must be completed before payout' using errcode = '22023';
    end if;
  end if;

  update public.affiliate_payouts
  set status = v_status,
      approved_by = case when v_status = 'approved' then auth.uid() else approved_by end,
      approved_at = case when v_status = 'approved' then now() else approved_at end,
      paid_by = case when v_status = 'paid' then auth.uid() else paid_by end,
      paid_at = case when v_status = 'paid' then now() else paid_at end,
      payment_reference = case when v_reference is not null then v_reference else payment_reference end,
      note = coalesce(v_note, note),
      updated_at = now()
  where id = p_payout_id
  returning * into v_after;

  if v_status = 'paid' then
    update public.affiliate_commissions
    set status = 'paid', paid_by = auth.uid(), paid_at = now(), updated_at = now()
    where payout_id = v_after.id and status = 'approved';

    update public.affiliate_attributions a
    set status = 'paid', updated_at = now()
    where exists (
      select 1 from public.affiliate_commissions c
      where c.payout_id = v_after.id and c.attribution_id = a.id and c.status = 'paid'
    );
  elsif v_status in ('rejected', 'cancelled') then
    update public.affiliate_commissions
    set payout_id = null, updated_at = now()
    where payout_id = v_after.id and status = 'approved';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'set_affiliate_payout_status',
    'affiliate_payout',
    v_after.id::text,
    jsonb_build_object(
      'old_status', v_before.status,
      'new_status', v_after.status,
      'payment_reference', v_reference,
      'note', v_note
    )
  );

  return to_jsonb(v_after);
end;
$$;

create or replace function public.d68_admin_list_affiliate_commissions(
  p_partner_id uuid default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_data order by created_at desc)
    from (
      select
        jsonb_build_object(
          'id', c.id,
          'partner_id', c.partner_id,
          'partner_name', mp.display_name,
          'affiliate_code', mp.affiliate_code,
          'payment_order_code', po.order_code,
          'currency', c.currency,
          'net_paid_amount', c.net_paid_amount,
          'commission_pct', c.commission_pct,
          'commission_amount', c.commission_amount,
          'status', c.status,
          'payout_id', c.payout_id,
          'payout_code', ap.payout_code,
          'source', c.source,
          'policy_snapshot', c.policy_snapshot,
          'approved_at', c.approved_at,
          'rejected_at', c.rejected_at,
          'rejection_reason', c.rejection_reason,
          'paid_at', c.paid_at,
          'note', c.note,
          'created_at', c.created_at,
          'updated_at', c.updated_at
        ) as row_data,
        c.created_at
      from public.affiliate_commissions c
      join public.market_partners mp on mp.id = c.partner_id
      join public.payment_orders po on po.id = c.payment_order_id
      left join public.affiliate_payouts ap on ap.id = c.payout_id
      where (p_partner_id is null or c.partner_id = p_partner_id)
        and (nullif(lower(btrim(coalesce(p_status, ''))), '') is null or c.status = lower(btrim(p_status)))
      order by c.created_at desc
      limit 1000
    ) rows
  ), '[]'::jsonb);
end;
$$;

create or replace function public.d68_admin_list_affiliate_payouts(
  p_partner_id uuid default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_data order by created_at desc)
    from (
      select
        jsonb_build_object(
          'id', p.id,
          'partner_id', p.partner_id,
          'partner_name', mp.display_name,
          'affiliate_code', mp.affiliate_code,
          'payout_code', p.payout_code,
          'period_start', p.period_start,
          'period_end', p.period_end,
          'currency', p.currency,
          'gross_commission_amount', p.gross_commission_amount,
          'adjustment_amount', p.adjustment_amount,
          'net_payout_amount', p.net_payout_amount,
          'commission_count', p.commission_count,
          'status', p.status,
          'payment_reference', p.payment_reference,
          'note', p.note,
          'approved_at', p.approved_at,
          'paid_at', p.paid_at,
          'created_at', p.created_at,
          'updated_at', p.updated_at
        ) as row_data,
        p.created_at
      from public.affiliate_payouts p
      join public.market_partners mp on mp.id = p.partner_id
      where (p_partner_id is null or p.partner_id = p_partner_id)
        and (nullif(lower(btrim(coalesce(p_status, ''))), '') is null or p.status = lower(btrim(p_status)))
      order by p.created_at desc
      limit 500
    ) rows
  ), '[]'::jsonb);
end;
$$;

create or replace function public.d68_get_my_market_partner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
  v_click_count bigint := 0;
  v_signup_count bigint := 0;
  v_paid_transaction_count bigint := 0;
  v_recorded_commission numeric := 0;
  v_pending_commission numeric := 0;
  v_approved_commission numeric := 0;
  v_paid_commission numeric := 0;
  v_available_commission numeric := 0;
  v_currency text := 'VND';
  v_commissions jsonb := '[]'::jsonb;
  v_payouts jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select * into v_partner
  from public.market_partners mp
  where mp.profile_id = auth.uid()
  limit 1;
  if v_partner.id is null then
    raise exception 'Market Partner account is not linked to this login' using errcode = 'P0002';
  end if;

  select count(*) into v_click_count from public.affiliate_clicks c where c.partner_id = v_partner.id;
  select count(*) into v_signup_count from public.affiliate_attributions a where a.partner_id = v_partner.id;

  select
    count(*) filter (where c.status in ('pending', 'approved', 'paid')),
    coalesce(sum(c.commission_amount) filter (where c.status in ('pending', 'approved', 'paid')), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'pending'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'approved'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'paid'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'approved' and c.payout_id is null), 0),
    coalesce(min(c.currency) filter (where c.status in ('pending', 'approved', 'paid')), v_partner.commission_basis_currency)
  into
    v_paid_transaction_count, v_recorded_commission, v_pending_commission,
    v_approved_commission, v_paid_commission, v_available_commission, v_currency
  from public.affiliate_commissions c
  where c.partner_id = v_partner.id;

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into v_commissions
  from (
    select
      jsonb_build_object(
        'id', c.id,
        'currency', c.currency,
        'net_paid_amount', c.net_paid_amount,
        'commission_pct', c.commission_pct,
        'commission_amount', c.commission_amount,
        'status', c.status,
        'payout_code', p.payout_code,
        'approved_at', c.approved_at,
        'paid_at', c.paid_at,
        'note', c.note,
        'created_at', c.created_at
      ) as item,
      c.created_at
    from public.affiliate_commissions c
    left join public.affiliate_payouts p on p.id = c.payout_id
    where c.partner_id = v_partner.id
    order by c.created_at desc
    limit 100
  ) rows;

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into v_payouts
  from (
    select
      jsonb_build_object(
        'id', p.id,
        'payout_code', p.payout_code,
        'period_start', p.period_start,
        'period_end', p.period_end,
        'currency', p.currency,
        'gross_commission_amount', p.gross_commission_amount,
        'adjustment_amount', p.adjustment_amount,
        'net_payout_amount', p.net_payout_amount,
        'commission_count', p.commission_count,
        'status', p.status,
        'payment_reference', p.payment_reference,
        'approved_at', p.approved_at,
        'paid_at', p.paid_at,
        'created_at', p.created_at
      ) as item,
      p.created_at
    from public.affiliate_payouts p
    where p.partner_id = v_partner.id
    order by p.created_at desc
    limit 100
  ) rows;

  return jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_partner.id,
      'display_name', v_partner.display_name,
      'contact_email', v_partner.contact_email,
      'phone', v_partner.phone,
      'country', v_partner.country,
      'country_iso2', v_partner.country_iso2,
      'affiliate_code', v_partner.affiliate_code,
      'customer_discount_pct', v_partner.customer_discount_pct,
      'commission_pct', v_partner.commission_pct,
      'commission_basis_currency', v_partner.commission_basis_currency,
      'commission_tier_1_max', v_partner.commission_tier_1_max,
      'commission_tier_2_max', v_partner.commission_tier_2_max,
      'commission_tier_1_pct', v_partner.commission_tier_1_pct,
      'commission_tier_2_pct', v_partner.commission_tier_2_pct,
      'commission_tier_3_pct', v_partner.commission_tier_3_pct,
      'status', v_partner.status,
      'bank_account_json', v_partner.bank_account_json,
      'activated_at', v_partner.activated_at,
      'suspended_at', v_partner.suspended_at,
      'suspension_reason', v_partner.suspension_reason,
      'created_at', v_partner.created_at,
      'updated_at', v_partner.updated_at
    ),
    'metrics', jsonb_build_object(
      'click_count', v_click_count,
      'signup_count', v_signup_count,
      'paid_transaction_count', v_paid_transaction_count,
      'recorded_commission', v_recorded_commission,
      'pending_commission', v_pending_commission,
      'approved_commission', v_approved_commission,
      'paid_commission', v_paid_commission,
      'available_commission', v_available_commission,
      'currency', v_currency
    ),
    'commissions', v_commissions,
    'payouts', v_payouts
  );
end;
$$;

revoke all on function public.d68_can_claim_market_partner_account(text, text) from public, anon, authenticated;
revoke all on function public.d68_claim_market_partner_signup(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.d68_create_affiliate_commission_for_payment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.d68_payment_confirmed_affiliate_commission_trigger() from public, anon, authenticated;
revoke all on function public.d68_admin_create_affiliate_commission(uuid, uuid) from public, anon, authenticated;
revoke all on function public.d68_admin_reconcile_affiliate_payment(uuid) from public, anon, authenticated;
revoke all on function public.d68_admin_set_affiliate_commission_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.d68_admin_create_affiliate_payout(uuid, text, uuid[], date, date, numeric, text) from public, anon, authenticated;
revoke all on function public.d68_admin_set_affiliate_payout_status(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.d68_admin_list_affiliate_commissions(uuid, text) from public, anon, authenticated;
revoke all on function public.d68_admin_list_affiliate_payouts(uuid, text) from public, anon, authenticated;
revoke all on function public.d68_get_my_market_partner_dashboard() from public, anon, authenticated;

grant execute on function public.d68_can_claim_market_partner_account(text, text) to anon, authenticated, service_role;
grant execute on function public.d68_claim_market_partner_signup(uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.d68_create_affiliate_commission_for_payment(uuid, uuid) to service_role;
grant execute on function public.d68_payment_confirmed_affiliate_commission_trigger() to service_role;
grant execute on function public.d68_admin_create_affiliate_commission(uuid, uuid) to authenticated, service_role;
grant execute on function public.d68_admin_reconcile_affiliate_payment(uuid) to authenticated, service_role;
grant execute on function public.d68_admin_set_affiliate_commission_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.d68_admin_create_affiliate_payout(uuid, text, uuid[], date, date, numeric, text) to authenticated, service_role;
grant execute on function public.d68_admin_set_affiliate_payout_status(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.d68_admin_list_affiliate_commissions(uuid, text) to authenticated, service_role;
grant execute on function public.d68_admin_list_affiliate_payouts(uuid, text) to authenticated, service_role;
grant execute on function public.d68_get_my_market_partner_dashboard() to authenticated, service_role;

comment on function public.d68_can_claim_market_partner_account(text, text) is
  'Generic Partner activation preflight. Returns only true/false for an exact active unclaimed email/code pair and prevents creating an orphan Auth account.';
comment on function public.d68_claim_market_partner_signup(uuid, text, text, text) is
  'Claims an Admin-approved active Market Partner using a recent Auth signup, exact email and affiliate code. It cannot upgrade an existing Business/Investor profile.';
comment on function public.d68_create_affiliate_commission_for_payment(uuid, uuid) is
  'Creates one pending commission from a confirmed payment using the immutable Phase 4 X/Y snapshot. Idempotent by payment_order_id.';
comment on function public.d68_payment_confirmed_affiliate_commission_trigger() is
  'Phase 5 non-blocking payment hook. Affiliate reconciliation errors are audited and never roll back confirmed Business/Investor service activation.';
comment on function public.d68_admin_create_affiliate_payout(uuid, text, uuid[], date, date, numeric, text) is
  'Creates a draft payout from approved, unassigned commissions belonging to one Partner and currency.';
comment on function public.d68_admin_set_affiliate_payout_status(uuid, text, text, text) is
  'Admin payout lifecycle. Marking a payout paid atomically marks its commissions and attributions paid.';

insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
values (
  null,
  'market_partner_phase5_commission_payout_installed',
  'market_partner_release',
  'phase5',
  jsonb_build_object(
    'commission_source', 'confirmed_payment_phase4_snapshot',
    'automatic_commission', true,
    'payment_confirmation_fail_open_for_affiliate_reconciliation', true,
    'admin_commission_statuses', jsonb_build_array('approved', 'rejected', 'reversed'),
    'payout_statuses', jsonb_build_array('draft', 'approved', 'processing', 'paid', 'rejected', 'cancelled'),
    'partner_customer_data_exposed', false,
    'partner_payment_payload_exposed', false
  )
);
