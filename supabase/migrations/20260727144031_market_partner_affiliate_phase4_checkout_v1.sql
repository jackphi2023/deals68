-- Deals68 Market Partner / Affiliate v1 — Phase 4 checkout and commercial policy.
-- Additive/compatible: affiliate discount is recomputed server-side; promo stacking is rejected.
-- No automatic commission trigger is installed in Phase 4.

alter table public.market_partners
  add column if not exists commission_basis_currency text not null default 'VND',
  add column if not exists commission_tier_1_max numeric(20,2) not null default 20000000,
  add column if not exists commission_tier_2_max numeric(20,2) not null default 50000000,
  add column if not exists commission_tier_1_pct numeric(5,2) not null default 40,
  add column if not exists commission_tier_2_pct numeric(5,2) not null default 50,
  add column if not exists commission_tier_3_pct numeric(5,2) not null default 60;

alter table public.market_partners
  alter column customer_discount_pct set default 40;

alter table public.market_partners
  drop constraint if exists market_partners_commission_basis_currency_check,
  add constraint market_partners_commission_basis_currency_check
    check (commission_basis_currency = upper(btrim(commission_basis_currency)) and commission_basis_currency ~ '^[A-Z]{3}$'),
  drop constraint if exists market_partners_commission_thresholds_check,
  add constraint market_partners_commission_thresholds_check
    check (commission_tier_1_max >= 0 and commission_tier_2_max > commission_tier_1_max),
  drop constraint if exists market_partners_commission_tiers_pct_check,
  add constraint market_partners_commission_tiers_pct_check
    check (
      commission_tier_1_pct between 0 and 100
      and commission_tier_2_pct between 0 and 100
      and commission_tier_3_pct between 0 and 100
    );

create or replace function public.d68_admin_update_market_partner_commercial_policy(
  p_partner_id uuid,
  p_customer_discount_pct numeric,
  p_commission_basis_currency text,
  p_commission_tier_1_max numeric,
  p_commission_tier_2_max numeric,
  p_commission_tier_1_pct numeric,
  p_commission_tier_2_pct numeric,
  p_commission_tier_3_pct numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.market_partners%rowtype;
  v_after public.market_partners%rowtype;
  v_currency text := upper(btrim(coalesce(p_commission_basis_currency, 'VND')));
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select * into v_before
  from public.market_partners mp
  where mp.id = p_partner_id
  for update;

  if v_before.id is null then
    raise exception 'Market Partner not found' using errcode = 'P0002';
  end if;
  if coalesce(p_customer_discount_pct, -1) < 0 or p_customer_discount_pct > 100 then
    raise exception 'Customer discount must be between 0 and 100' using errcode = '22023';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Commission basis currency must contain three letters' using errcode = '22023';
  end if;
  if coalesce(p_commission_tier_1_max, -1) < 0
     or coalesce(p_commission_tier_2_max, -1) <= p_commission_tier_1_max then
    raise exception 'Commission revenue thresholds are invalid' using errcode = '22023';
  end if;
  if coalesce(p_commission_tier_1_pct, -1) not between 0 and 100
     or coalesce(p_commission_tier_2_pct, -1) not between 0 and 100
     or coalesce(p_commission_tier_3_pct, -1) not between 0 and 100 then
    raise exception 'Commission percentages must be between 0 and 100' using errcode = '22023';
  end if;

  update public.market_partners
  set customer_discount_pct = round(p_customer_discount_pct, 2),
      commission_pct = round(p_commission_tier_1_pct, 2),
      commission_basis_currency = v_currency,
      commission_tier_1_max = round(p_commission_tier_1_max, 2),
      commission_tier_2_max = round(p_commission_tier_2_max, 2),
      commission_tier_1_pct = round(p_commission_tier_1_pct, 2),
      commission_tier_2_pct = round(p_commission_tier_2_pct, 2),
      commission_tier_3_pct = round(p_commission_tier_3_pct, 2),
      updated_at = now()
  where id = p_partner_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'update_market_partner_commercial_policy',
    'market_partner',
    v_after.id::text,
    jsonb_build_object(
      'old_customer_discount_pct', v_before.customer_discount_pct,
      'new_customer_discount_pct', v_after.customer_discount_pct,
      'old_commission_policy', jsonb_build_object(
        'basis_currency', v_before.commission_basis_currency,
        'tier_1_max', v_before.commission_tier_1_max,
        'tier_2_max', v_before.commission_tier_2_max,
        'tier_1_pct', v_before.commission_tier_1_pct,
        'tier_2_pct', v_before.commission_tier_2_pct,
        'tier_3_pct', v_before.commission_tier_3_pct
      ),
      'new_commission_policy', jsonb_build_object(
        'basis_currency', v_after.commission_basis_currency,
        'tier_1_max', v_after.commission_tier_1_max,
        'tier_2_max', v_after.commission_tier_2_max,
        'tier_1_pct', v_after.commission_tier_1_pct,
        'tier_2_pct', v_after.commission_tier_2_pct,
        'tier_3_pct', v_after.commission_tier_3_pct
      )
    )
  );

  return to_jsonb(v_after);
end;
$$;

create or replace function public.d68_get_affiliate_checkout_quote(
  p_affiliate_code text,
  p_click_id uuid,
  p_role text,
  p_country_iso2 text,
  p_business_plan text default null,
  p_term_units integer default null,
  p_investor_plan text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
  v_click_id uuid;
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_country_iso2 text := upper(btrim(coalesce(p_country_iso2, 'VN')));
  v_currency text;
  v_business_plan text := lower(btrim(coalesce(p_business_plan, 'standard')));
  v_investor_plan text := lower(btrim(coalesce(p_investor_plan, 'premium')));
  v_term_units integer := coalesce(p_term_units, 0);
  v_unit_amount numeric := 0;
  v_featured_unit numeric := 0;
  v_subtotal numeric := 0;
  v_term_discount_pct numeric := 0;
  v_term_discount numeric := 0;
  v_eligible_amount numeric := 0;
  v_affiliate_discount numeric := 0;
  v_net_paid numeric := 0;
  v_plan_label text;
  v_payable boolean := true;
  v_price jsonb;
  v_affiliate jsonb;
begin
  if v_role not in ('business', 'investor') then
    return jsonb_build_object('valid', false, 'reason', 'unsupported_role');
  end if;
  if p_click_id is null then
    return jsonb_build_object('valid', false, 'reason', 'missing_click');
  end if;

  select mp.* into v_partner
  from public.market_partners mp
  where mp.affiliate_code = public.d68_normalize_affiliate_code(p_affiliate_code)
    and mp.status = 'active'
  limit 1;

  if v_partner.id is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_partner');
  end if;

  select c.id into v_click_id
  from public.affiliate_clicks c
  where c.id = p_click_id
    and c.partner_id = v_partner.id
    and c.affiliate_code = v_partner.affiliate_code
    and c.clicked_at >= now() - interval '30 days'
  limit 1;

  if v_click_id is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_or_expired_click');
  end if;

  v_currency := case when v_country_iso2 = 'VN' then 'VND' else 'USD' end;

  if v_role = 'investor' and v_investor_plan = 'standard' then
    v_payable := false;
    v_term_units := 0;
    v_plan_label := 'Standard';
  else
    if v_term_units not in (4, 8, 12, 16, 24) then
      return jsonb_build_object('valid', false, 'reason', 'unsupported_term');
    end if;

    if v_role = 'business' then
      if v_business_plan not in ('standard', 'featured') then
        return jsonb_build_object('valid', false, 'reason', 'unsupported_business_plan');
      end if;
      v_unit_amount := case when v_currency = 'VND' then 500000 else 20 end;
      v_featured_unit := round(v_unit_amount * 1.3, 2);
      v_unit_amount := case when v_business_plan = 'featured' then v_featured_unit else v_unit_amount end;
      v_plan_label := case when v_business_plan = 'featured' then 'Featured' else 'Standard' end;
    else
      if v_investor_plan <> 'premium' then
        return jsonb_build_object('valid', false, 'reason', 'unsupported_investor_plan');
      end if;
      v_unit_amount := case when v_currency = 'VND' then 26000000 else 1000 end;
      v_featured_unit := v_unit_amount;
      v_plan_label := 'Premium';
    end if;

    v_subtotal := round(v_unit_amount * v_term_units, 2);
    v_term_discount_pct := case when v_term_units >= 16 then 20 when v_term_units >= 8 then 15 else 0 end;
    v_term_discount := round(v_subtotal * v_term_discount_pct / 100, 2);
    v_eligible_amount := greatest(0, v_subtotal - v_term_discount);
    v_affiliate_discount := round(v_eligible_amount * v_partner.customer_discount_pct / 100, 2);
    v_net_paid := greatest(0, v_eligible_amount - v_affiliate_discount);
  end if;

  v_price := jsonb_build_object(
    'role', v_role,
    'country', v_country_iso2,
    'currency', v_currency,
    'baseWeekly', case when v_role = 'business' and v_business_plan = 'featured' then case when v_currency = 'VND' then 500000 else 20 end else v_unit_amount end,
    'featuredWeekly', v_featured_unit,
    'planWeekly', v_unit_amount,
    'termWeeks', case when v_role = 'investor' then v_term_units * 4 else v_term_units end,
    'termMonths', case when v_role = 'investor' then v_term_units else null end,
    'subtotal', v_subtotal,
    'termDiscountPct', v_term_discount_pct,
    'termDiscount', v_term_discount,
    'promoCode', null,
    'promoDiscountPct', 0,
    'promoDiscount', 0,
    'affiliateDiscountPct', v_partner.customer_discount_pct,
    'affiliateDiscount', v_affiliate_discount,
    'affiliateEligibleAmount', v_eligible_amount,
    'total', v_net_paid,
    'planLabel', v_plan_label
  );

  v_affiliate := jsonb_build_object(
    'partner_id', v_partner.id,
    'affiliate_code', v_partner.affiliate_code,
    'click_id', v_click_id,
    'customer_discount_pct', v_partner.customer_discount_pct,
    'discount_amount', v_affiliate_discount,
    'eligible_amount', v_eligible_amount,
    'net_paid_amount', v_net_paid,
    'currency', v_currency,
    'commission_policy', jsonb_build_object(
      'basis_currency', v_partner.commission_basis_currency,
      'tier_1_max', v_partner.commission_tier_1_max,
      'tier_2_max', v_partner.commission_tier_2_max,
      'tier_1_pct', v_partner.commission_tier_1_pct,
      'tier_2_pct', v_partner.commission_tier_2_pct,
      'tier_3_pct', v_partner.commission_tier_3_pct,
      'calculation_basis', 'net_paid_amount'
    ),
    'policy_version', 'market-partner-v1-phase4'
  );

  return jsonb_build_object(
    'valid', true,
    'payable', v_payable,
    'affiliate', v_affiliate,
    'price', v_price
  );
end;
$$;

create or replace function public.d68_affiliate_commission_pct_for_net_paid(
  p_partner_id uuid,
  p_net_paid_amount numeric,
  p_currency text
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  select * into v_partner from public.market_partners mp where mp.id = p_partner_id;
  if v_partner.id is null then
    raise exception 'Market Partner not found' using errcode = 'P0002';
  end if;
  if coalesce(p_net_paid_amount, -1) < 0 then
    raise exception 'Net paid amount must be non-negative' using errcode = '22023';
  end if;
  if v_currency is distinct from v_partner.commission_basis_currency then
    raise exception 'Commission basis currency mismatch; Admin FX reconciliation is required' using errcode = '22023';
  end if;

  return case
    when p_net_paid_amount < v_partner.commission_tier_1_max then v_partner.commission_tier_1_pct
    when p_net_paid_amount <= v_partner.commission_tier_2_max then v_partner.commission_tier_2_pct
    else v_partner.commission_tier_3_pct
  end;
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
    count(*) filter (where c.status in ('approved', 'paid')),
    coalesce(sum(c.commission_amount), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'pending'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'approved'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'paid'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'approved'), 0),
    coalesce(min(c.currency), v_partner.commission_basis_currency)
  into
    v_paid_transaction_count, v_recorded_commission, v_pending_commission,
    v_approved_commission, v_paid_commission, v_available_commission, v_currency
  from public.affiliate_commissions c
  where c.partner_id = v_partner.id and c.status <> 'reversed';

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
    )
  );
end;
$$;

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
  v_attribution public.affiliate_attributions%rowtype;
  v_partner public.market_partners%rowtype;
  v_payment public.payment_orders%rowtype;
  v_commission public.affiliate_commissions%rowtype;
  v_amount_text text;
  v_currency text;
  v_net_paid numeric;
  v_commission_pct numeric;
  v_payload_partner_id uuid;
  v_payload_affiliate_code text;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select * into v_attribution from public.affiliate_attributions a where a.id = p_attribution_id for update;
  if v_attribution.id is null then raise exception 'Affiliate attribution not found' using errcode = 'P0002'; end if;
  select * into v_partner from public.market_partners mp where mp.id = v_attribution.partner_id;
  select * into v_payment from public.payment_orders po where po.id = p_payment_order_id for update;
  if v_payment.id is null then raise exception 'Payment order not found' using errcode = 'P0002'; end if;
  if lower(coalesce(v_payment.status, '')) <> 'confirmed' or v_payment.confirmed_at is null then
    raise exception 'Commission requires a confirmed payment' using errcode = 'P0001';
  end if;
  if coalesce(v_payment.profile_id, v_payment.created_by) is distinct from v_attribution.subject_profile_id then
    raise exception 'Payment order does not belong to the attributed account' using errcode = '42501';
  end if;

  select * into v_commission from public.affiliate_commissions c where c.payment_order_id = p_payment_order_id;
  if v_commission.id is not null then return to_jsonb(v_commission); end if;

  begin
    v_payload_partner_id := nullif(v_payment.payload #>> '{affiliate,partner_id}', '')::uuid;
  exception when invalid_text_representation then
    v_payload_partner_id := null;
  end;
  v_payload_affiliate_code := public.d68_normalize_affiliate_code(v_payment.payload #>> '{affiliate,affiliate_code}');
  if v_payload_partner_id is distinct from v_partner.id
     or v_payload_affiliate_code is distinct from v_partner.affiliate_code then
    raise exception 'Payment order does not contain a valid server-side affiliate snapshot' using errcode = '42501';
  end if;

  v_amount_text := coalesce(v_payment.payload #>> '{affiliate,net_paid_amount}', v_payment.payload #>> '{price,total}');
  v_amount_text := replace(replace(btrim(coalesce(v_amount_text, '')), ',', ''), ' ', '');
  if v_amount_text !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'Confirmed payment does not contain a valid net paid amount' using errcode = '22023';
  end if;
  v_net_paid := v_amount_text::numeric;
  v_currency := upper(coalesce(nullif(v_payment.payload #>> '{affiliate,currency}', ''), nullif(v_payment.payload #>> '{price,currency}', ''), 'VND'));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Confirmed payment does not contain a valid currency' using errcode = '22023';
  end if;

  v_commission_pct := public.d68_affiliate_commission_pct_for_net_paid(v_partner.id, v_net_paid, v_currency);

  insert into public.affiliate_commissions (
    partner_id, attribution_id, payment_order_id, currency, net_paid_amount,
    commission_pct, status, source, created_by, created_at, updated_at
  ) values (
    v_partner.id, v_attribution.id, v_payment.id, v_currency, v_net_paid,
    v_commission_pct, 'pending', 'payment_confirmed', auth.uid(), now(), now()
  ) returning * into v_commission;

  update public.affiliate_attributions
  set status = 'qualified', qualified_at = coalesce(qualified_at, now()), updated_at = now()
  where id = v_attribution.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(), 'create_affiliate_commission', 'affiliate_commission', v_commission.id::text,
    jsonb_build_object(
      'partner_id', v_commission.partner_id,
      'attribution_id', v_commission.attribution_id,
      'payment_order_id', v_commission.payment_order_id,
      'net_paid_amount', v_commission.net_paid_amount,
      'commission_pct', v_commission.commission_pct,
      'commission_amount', v_commission.commission_amount,
      'currency', v_commission.currency,
      'tier_policy', 'net_paid_amount'
    )
  );

  return to_jsonb(v_commission);
end;
$$;

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
  auth_metadata jsonb := '{}'::jsonb;
  result_value jsonb;
  safe_role text := lower(trim(coalesce(role_text, '')));
  requested_investor_plan text := lower(trim(coalesce(payment_payload->>'investorPlan', '')));
  skip_payment boolean := lower(trim(coalesce(payment_payload->>'skipPayment', 'false'))) in ('true', '1', 'yes');
  payment_uuid uuid;
  safe_payment_payload jsonb := coalesce(payment_payload, '{}'::jsonb);
  v_affiliate_code text;
  v_affiliate_click_id uuid;
  v_quote jsonb;
  v_term_text text;
  v_term_units integer;
  v_business_plan text;
  v_country_iso2 text;
  v_promo_code text;
  v_promo_pct numeric := 0;
  v_promo_amount numeric := 0;
begin
  if length(trim(coalesce(signup_nonce, ''))) < 24 then
    raise exception 'Invalid signup nonce' using errcode = '42501';
  end if;
  if skip_payment and not (safe_role = 'investor' and requested_investor_plan = 'standard') then
    raise exception 'Payment may only be skipped for Standard Investor registration' using errcode = '42501';
  end if;

  select lower(coalesce(u.email, '')), u.created_at, u.raw_user_meta_data->>'signup_nonce', coalesce(u.raw_user_meta_data, '{}'::jsonb)
  into auth_email, auth_created_at, stored_nonce, auth_metadata
  from auth.users u
  where u.id = user_uuid
  for update;

  if not found
     or auth_email <> lower(trim(coalesce(user_email, '')))
     or stored_nonce is distinct from signup_nonce
     or auth_created_at < now() - interval '30 minutes' then
    raise exception 'Signup verification failed' using errcode = '42501';
  end if;

  v_affiliate_code := public.d68_normalize_affiliate_code(auth_metadata->>'affiliate_code');
  begin
    v_affiliate_click_id := nullif(btrim(coalesce(auth_metadata->>'affiliate_click_id', '')), '')::uuid;
  exception when invalid_text_representation then
    v_affiliate_click_id := null;
  end;

  if safe_role = 'business' then
    v_term_text := coalesce(safe_payment_payload #>> '{price,termWeeks}', safe_payment_payload->>'termWeeks', '');
    v_business_plan := lower(btrim(coalesce(business_payload->>'plan', safe_payment_payload->>'plan', 'standard')));
  elsif safe_role = 'investor' then
    v_term_text := coalesce(safe_payment_payload->>'termMonths', '');
    if v_term_text = '' and coalesce(safe_payment_payload #>> '{price,termWeeks}', '') ~ '^[0-9]+$' then
      v_term_text := ((safe_payment_payload #>> '{price,termWeeks}')::integer / 4)::text;
    end if;
  end if;
  v_term_units := case when v_term_text ~ '^[0-9]+$' then v_term_text::integer else null end;
  v_country_iso2 := upper(btrim(coalesce(profile_payload->>'country_iso2', safe_payment_payload->>'country', 'VN')));

  if v_affiliate_code is not null and v_affiliate_click_id is not null and safe_role in ('business', 'investor') then
    v_quote := public.d68_get_affiliate_checkout_quote(
      v_affiliate_code,
      v_affiliate_click_id,
      safe_role,
      v_country_iso2,
      v_business_plan,
      v_term_units,
      requested_investor_plan
    );
  else
    v_quote := jsonb_build_object('valid', false);
  end if;

  if coalesce((v_quote->>'valid')::boolean, false) then
    v_promo_code := nullif(btrim(coalesce(safe_payment_payload #>> '{price,promoCode}', safe_payment_payload->>'promoCode', '')), '');
    begin
      v_promo_pct := coalesce(nullif(safe_payment_payload #>> '{price,promoDiscountPct}', '')::numeric, 0);
      v_promo_amount := coalesce(nullif(safe_payment_payload #>> '{price,promoDiscount}', '')::numeric, 0);
    exception when invalid_text_representation then
      raise exception 'Promo payload is invalid' using errcode = '22023';
    end;
    if v_promo_code is not null or v_promo_pct > 0 or v_promo_amount > 0 then
      raise exception 'Promo code cannot be combined with a Market Partner code' using errcode = '22023';
    end if;

    safe_payment_payload := jsonb_set(safe_payment_payload, '{price}', v_quote->'price', true)
      || jsonb_build_object(
        'affiliate', v_quote->'affiliate',
        'affiliate_code', v_quote #>> '{affiliate,affiliate_code}',
        'partner_id', v_quote #>> '{affiliate,partner_id}',
        'affiliate_discount_pct', (v_quote #>> '{affiliate,customer_discount_pct}')::numeric,
        'affiliate_discount_amount', (v_quote #>> '{affiliate,discount_amount}')::numeric,
        'net_paid_amount', (v_quote #>> '{affiliate,net_paid_amount}')::numeric,
        'affiliate_policy_version', 'market-partner-v1-phase4'
      );
  else
    safe_payment_payload := safe_payment_payload
      - 'affiliate'
      - 'affiliate_code'
      - 'partner_id'
      - 'affiliate_discount_pct'
      - 'affiliate_discount_amount'
      - 'net_paid_amount'
      - 'affiliate_policy_version';
  end if;

  result_value := public.create_signup_bundle(
    user_uuid,
    user_email,
    safe_role,
    coalesce(profile_payload, '{}'::jsonb),
    business_payload,
    investor_payload,
    safe_payment_payload
  );

  if skip_payment then
    payment_uuid := nullif(result_value->>'payment_order_id', '')::uuid;
    if payment_uuid is null then raise exception 'Standard Investor payment cleanup failed'; end if;
    delete from public.payment_orders
    where id = payment_uuid
      and profile_id = user_uuid
      and investor_id = nullif(result_value->>'investor_id', '')::uuid
      and lower(coalesce(status, '')) = 'pending';
    if not found then raise exception 'Standard Investor payment cleanup failed'; end if;
    result_value := jsonb_set(result_value, '{payment_order_id}', 'null'::jsonb, true)
      || jsonb_build_object('payment_skipped', true, 'investor_plan', 'standard');
  end if;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'signup_nonce'
    - 'affiliate_code'
    - 'affiliate_click_id'
    - 'affiliate_captured_at'
  where id = user_uuid;

  return result_value;
end;
$$;

revoke all on function public.d68_admin_update_market_partner_commercial_policy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;
revoke all on function public.d68_get_affiliate_checkout_quote(text, uuid, text, text, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.d68_affiliate_commission_pct_for_net_paid(uuid, numeric, text)
  from public, anon, authenticated;
revoke all on function public.d68_get_my_market_partner_dashboard()
  from public, anon, authenticated;
revoke all on function public.d68_admin_create_affiliate_commission(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_signup_bundle_v2(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.d68_admin_update_market_partner_commercial_policy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric)
  to authenticated, service_role;
grant execute on function public.d68_get_affiliate_checkout_quote(text, uuid, text, text, text, integer, text)
  to anon, authenticated, service_role;
grant execute on function public.d68_affiliate_commission_pct_for_net_paid(uuid, numeric, text)
  to service_role;
grant execute on function public.d68_get_my_market_partner_dashboard()
  to authenticated, service_role;
grant execute on function public.d68_admin_create_affiliate_commission(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.create_signup_bundle_v2(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb)
  to anon, authenticated, service_role;

comment on function public.d68_get_affiliate_checkout_quote(text, uuid, text, text, text, integer, text) is
  'Phase 4 server-side affiliate quote. Applies Partner X after term discount, rejects invalid/expired clicks, returns no customer identity and creates no commission.';
comment on function public.d68_admin_update_market_partner_commercial_policy(uuid, numeric, text, numeric, numeric, numeric, numeric, numeric) is
  'Admin-only per-Partner X and Y policy editor. Y is a three-tier net-paid revenue policy with explicit basis currency and thresholds.';
comment on function public.create_signup_bundle_v2(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb) is
  'Creates signup entities atomically. Valid affiliate orders are server-repriced, promo stacking is rejected, and payment payload receives a private affiliate snapshot. No commission is created.';
comment on function public.d68_admin_create_affiliate_commission(uuid, uuid) is
  'Admin-only, idempotent commission creation after confirmed payment. Uses the Partner tier policy on server-validated net paid amount; Phase 4 installs no automatic trigger.';

insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
values (
  null,
  'market_partner_phase4_checkout_policy_installed',
  'market_partner_release',
  'phase4',
  jsonb_build_object(
    'customer_discount_default_pct', 40,
    'commission_policy_default', jsonb_build_object(
      'basis_currency', 'VND',
      'under_20000000_pct', 40,
      'from_20000000_to_50000000_pct', 50,
      'over_50000000_pct', 60
    ),
    'promo_stacking', false,
    'server_side_quote', true,
    'payment_trigger_installed', false,
    'automatic_commission_installed', false
  )
);
