-- Deals68 Market Partner / Affiliate v1 — Phase 2 login/dashboard contract.
-- Additive only. No referral attribution, payment discount or automatic commission trigger.

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

  select count(*) into v_click_count
  from public.affiliate_clicks c
  where c.partner_id = v_partner.id;

  select count(*) into v_signup_count
  from public.affiliate_attributions a
  where a.partner_id = v_partner.id;

  select
    count(*) filter (where c.status in ('approved', 'paid')),
    coalesce(sum(c.commission_amount), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'pending'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'approved'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'paid'), 0),
    coalesce(sum(c.commission_amount) filter (where c.status = 'approved'), 0),
    coalesce(min(c.currency), 'VND')
  into
    v_paid_transaction_count,
    v_recorded_commission,
    v_pending_commission,
    v_approved_commission,
    v_paid_commission,
    v_available_commission,
    v_currency
  from public.affiliate_commissions c
  where c.partner_id = v_partner.id
    and c.status <> 'reversed';

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

create or replace function public.d68_update_my_market_partner_bank_account(
  p_bank_account jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
  v_clean jsonb;
  v_allowed_keys text[] := array[
    'bank_name',
    'account_holder',
    'account_number',
    'branch',
    'swift_code',
    'currency',
    'country',
    'note'
  ];
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  if p_bank_account is null or jsonb_typeof(p_bank_account) <> 'object' then
    raise exception 'Bank account must be a JSON object' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_bank_account)
  loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception 'Unsupported bank account field: %', v_key using errcode = '22023';
    end if;
  end loop;

  select * into v_partner
  from public.market_partners mp
  where mp.profile_id = auth.uid()
  for update;

  if v_partner.id is null then
    raise exception 'Market Partner account is not linked to this login' using errcode = 'P0002';
  end if;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'bank_name', nullif(left(btrim(coalesce(p_bank_account->>'bank_name', '')), 160), ''),
    'account_holder', nullif(left(btrim(coalesce(p_bank_account->>'account_holder', '')), 160), ''),
    'account_number', nullif(left(regexp_replace(btrim(coalesce(p_bank_account->>'account_number', '')), '[^A-Za-z0-9.-]+', '', 'g'), 80), ''),
    'branch', nullif(left(btrim(coalesce(p_bank_account->>'branch', '')), 160), ''),
    'swift_code', nullif(left(upper(regexp_replace(btrim(coalesce(p_bank_account->>'swift_code', '')), '[^A-Za-z0-9]+', '', 'g')), 11), ''),
    'currency', nullif(left(upper(regexp_replace(btrim(coalesce(p_bank_account->>'currency', '')), '[^A-Za-z]+', '', 'g')), 3), ''),
    'country', nullif(left(btrim(coalesce(p_bank_account->>'country', '')), 120), ''),
    'note', nullif(left(btrim(coalesce(p_bank_account->>'note', '')), 500), '')
  ));

  if coalesce(v_clean->>'bank_name', '') = ''
     or coalesce(v_clean->>'account_holder', '') = ''
     or coalesce(v_clean->>'account_number', '') = '' then
    raise exception 'Bank name, account holder and account number are required' using errcode = '22023';
  end if;
  if v_clean ? 'swift_code' and length(v_clean->>'swift_code') not between 8 and 11 then
    raise exception 'SWIFT code must contain 8 to 11 characters' using errcode = '22023';
  end if;
  if v_clean ? 'currency' and (v_clean->>'currency') !~ '^[A-Z]{3}$' then
    raise exception 'Currency must contain three letters' using errcode = '22023';
  end if;

  update public.market_partners
  set bank_account_json = v_clean,
      updated_at = now()
  where id = v_partner.id
  returning * into v_partner;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'update_market_partner_bank_account',
    'market_partner',
    v_partner.id::text,
    jsonb_build_object('updated_fields', (select jsonb_agg(key) from jsonb_object_keys(v_clean) key))
  );

  return jsonb_build_object(
    'id', v_partner.id,
    'bank_account_json', v_partner.bank_account_json,
    'updated_at', v_partner.updated_at
  );
end;
$$;

revoke all on function public.d68_get_my_market_partner_dashboard()
  from public, anon, authenticated;
revoke all on function public.d68_update_my_market_partner_bank_account(jsonb)
  from public, anon, authenticated;

grant execute on function public.d68_get_my_market_partner_dashboard()
  to authenticated, service_role;
grant execute on function public.d68_update_my_market_partner_bank_account(jsonb)
  to authenticated, service_role;

comment on function public.d68_get_my_market_partner_dashboard() is
  'Authenticated Market Partner dashboard summary. Returns only the caller own partner profile and aggregate affiliate metrics; no customer identity or payment payload.';
comment on function public.d68_update_my_market_partner_bank_account(jsonb) is
  'Authenticated Market Partner self-service bank account update with a strict field whitelist and server-side validation.';
