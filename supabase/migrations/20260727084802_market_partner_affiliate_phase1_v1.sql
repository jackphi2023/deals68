-- Deals68 Market Partner / Affiliate v1 — Phase 1 foundation.
-- Additive only. No payment trigger, no automatic commission creation, and no public table reads.

alter type public.user_role add value if not exists 'market_partner';

create table if not exists public.market_partners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  source_lead_id uuid unique references public.partner_leads(id) on delete set null,
  display_name text not null,
  contact_email text not null,
  phone text,
  country text,
  country_iso2 text,
  intro text,
  affiliate_code text not null,
  customer_discount_pct numeric(5,2) not null default 0,
  commission_pct numeric(5,2) not null default 0,
  status text not null default 'active',
  bank_account_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_partners_email_normalized_check
    check (contact_email = lower(btrim(contact_email)) and position('@' in contact_email) > 1),
  constraint market_partners_code_normalized_check
    check (
      affiliate_code = upper(btrim(affiliate_code))
      and affiliate_code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$'
    ),
  constraint market_partners_country_iso2_check
    check (country_iso2 is null or country_iso2 ~ '^[A-Z]{2}$'),
  constraint market_partners_discount_pct_check
    check (customer_discount_pct >= 0 and customer_discount_pct <= 100),
  constraint market_partners_commission_pct_check
    check (commission_pct >= 0 and commission_pct <= 100),
  constraint market_partners_status_check
    check (status in ('active', 'suspended')),
  constraint market_partners_bank_account_object_check
    check (jsonb_typeof(bank_account_json) = 'object'),
  constraint market_partners_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists market_partners_affiliate_code_uidx
  on public.market_partners (affiliate_code);
create unique index if not exists market_partners_contact_email_uidx
  on public.market_partners (lower(contact_email));
create index if not exists market_partners_status_created_idx
  on public.market_partners (status, created_at desc);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.market_partners(id) on delete cascade,
  affiliate_code text not null,
  landing_path text not null default '/',
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visitor_hash text,
  click_bucket timestamptz not null,
  clicked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint affiliate_clicks_code_check
    check (affiliate_code = upper(btrim(affiliate_code))),
  constraint affiliate_clicks_landing_path_check
    check (left(landing_path, 1) = '/' and length(landing_path) <= 500),
  constraint affiliate_clicks_referrer_host_check
    check (referrer_host is null or length(referrer_host) <= 255),
  constraint affiliate_clicks_utm_source_check
    check (utm_source is null or length(utm_source) <= 120),
  constraint affiliate_clicks_utm_medium_check
    check (utm_medium is null or length(utm_medium) <= 120),
  constraint affiliate_clicks_utm_campaign_check
    check (utm_campaign is null or length(utm_campaign) <= 160),
  constraint affiliate_clicks_visitor_hash_check
    check (visitor_hash is null or visitor_hash ~ '^[a-f0-9]{64}$')
);

create unique index if not exists affiliate_clicks_partner_visitor_bucket_uidx
  on public.affiliate_clicks (partner_id, visitor_hash, click_bucket)
  where visitor_hash is not null;
create index if not exists affiliate_clicks_partner_clicked_idx
  on public.affiliate_clicks (partner_id, clicked_at desc);

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.market_partners(id) on delete restrict,
  click_id uuid references public.affiliate_clicks(id) on delete set null,
  affiliate_code text not null,
  subject_profile_id uuid not null references public.profiles(id) on delete restrict,
  subject_role text not null,
  status text not null default 'registered',
  attributed_at timestamptz not null default now(),
  qualified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_attributions_role_check
    check (subject_role in ('business', 'investor')),
  constraint affiliate_attributions_status_check
    check (status in ('registered', 'qualified', 'paid', 'rejected', 'cancelled')),
  constraint affiliate_attributions_code_check
    check (affiliate_code = upper(btrim(affiliate_code))),
  constraint affiliate_attributions_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists affiliate_attributions_subject_profile_uidx
  on public.affiliate_attributions (subject_profile_id);
create index if not exists affiliate_attributions_partner_status_idx
  on public.affiliate_attributions (partner_id, status, attributed_at desc);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.market_partners(id) on delete restrict,
  payout_code text not null,
  period_start date,
  period_end date,
  currency text not null,
  gross_commission_amount numeric(20,2) not null default 0,
  adjustment_amount numeric(20,2) not null default 0,
  net_payout_amount numeric(20,2)
    generated always as (round(gross_commission_amount + adjustment_amount, 2)) stored,
  commission_count integer not null default 0,
  status text not null default 'draft',
  payment_reference text,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_payouts_code_check
    check (payout_code = upper(btrim(payout_code)) and length(payout_code) between 6 and 40),
  constraint affiliate_payouts_currency_check
    check (currency = upper(btrim(currency)) and currency ~ '^[A-Z]{3}$'),
  constraint affiliate_payouts_period_check
    check (period_start is null or period_end is null or period_start <= period_end),
  constraint affiliate_payouts_gross_check
    check (gross_commission_amount >= 0),
  constraint affiliate_payouts_count_check
    check (commission_count >= 0),
  constraint affiliate_payouts_status_check
    check (status in ('draft', 'approved', 'processing', 'paid', 'rejected', 'cancelled'))
);

create unique index if not exists affiliate_payouts_code_uidx
  on public.affiliate_payouts (payout_code);
create index if not exists affiliate_payouts_partner_status_idx
  on public.affiliate_payouts (partner_id, status, created_at desc);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.market_partners(id) on delete restrict,
  attribution_id uuid not null references public.affiliate_attributions(id) on delete restrict,
  payment_order_id uuid not null references public.payment_orders(id) on delete restrict,
  payout_id uuid references public.affiliate_payouts(id) on delete set null,
  currency text not null,
  net_paid_amount numeric(20,2) not null,
  commission_pct numeric(5,2) not null,
  commission_amount numeric(20,2)
    generated always as (round(net_paid_amount * commission_pct / 100, 2)) stored,
  status text not null default 'pending',
  source text not null default 'payment_confirmed',
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  paid_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_commissions_currency_check
    check (currency = upper(btrim(currency)) and currency ~ '^[A-Z]{3}$'),
  constraint affiliate_commissions_net_paid_check
    check (net_paid_amount >= 0),
  constraint affiliate_commissions_pct_check
    check (commission_pct >= 0 and commission_pct <= 100),
  constraint affiliate_commissions_status_check
    check (status in ('pending', 'approved', 'rejected', 'paid', 'reversed')),
  constraint affiliate_commissions_source_check
    check (source in ('payment_confirmed', 'admin_reconciliation'))
);

create unique index if not exists affiliate_commissions_payment_order_uidx
  on public.affiliate_commissions (payment_order_id);
create index if not exists affiliate_commissions_partner_status_idx
  on public.affiliate_commissions (partner_id, status, created_at desc);
create index if not exists affiliate_commissions_payout_idx
  on public.affiliate_commissions (payout_id)
  where payout_id is not null;

alter table public.market_partners enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;

-- Partner/Admin SELECT boundaries. Writes stay RPC-only in Phase 1.
drop policy if exists market_partners_owner_select on public.market_partners;
create policy market_partners_owner_select
  on public.market_partners for select to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists market_partners_admin_all on public.market_partners;
create policy market_partners_admin_all
  on public.market_partners for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists affiliate_clicks_partner_select on public.affiliate_clicks;
create policy affiliate_clicks_partner_select
  on public.affiliate_clicks for select to authenticated
  using (
    exists (
      select 1 from public.market_partners mp
      where mp.id = affiliate_clicks.partner_id
        and mp.profile_id = (select auth.uid())
    )
  );

drop policy if exists affiliate_clicks_admin_all on public.affiliate_clicks;
create policy affiliate_clicks_admin_all
  on public.affiliate_clicks for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists affiliate_attributions_partner_select on public.affiliate_attributions;
create policy affiliate_attributions_partner_select
  on public.affiliate_attributions for select to authenticated
  using (
    exists (
      select 1 from public.market_partners mp
      where mp.id = affiliate_attributions.partner_id
        and mp.profile_id = (select auth.uid())
    )
  );

drop policy if exists affiliate_attributions_admin_all on public.affiliate_attributions;
create policy affiliate_attributions_admin_all
  on public.affiliate_attributions for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists affiliate_commissions_partner_select on public.affiliate_commissions;
create policy affiliate_commissions_partner_select
  on public.affiliate_commissions for select to authenticated
  using (
    exists (
      select 1 from public.market_partners mp
      where mp.id = affiliate_commissions.partner_id
        and mp.profile_id = (select auth.uid())
    )
  );

drop policy if exists affiliate_commissions_admin_all on public.affiliate_commissions;
create policy affiliate_commissions_admin_all
  on public.affiliate_commissions for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists affiliate_payouts_partner_select on public.affiliate_payouts;
create policy affiliate_payouts_partner_select
  on public.affiliate_payouts for select to authenticated
  using (
    exists (
      select 1 from public.market_partners mp
      where mp.id = affiliate_payouts.partner_id
        and mp.profile_id = (select auth.uid())
    )
  );

drop policy if exists affiliate_payouts_admin_all on public.affiliate_payouts;
create policy affiliate_payouts_admin_all
  on public.affiliate_payouts for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

revoke all on table public.market_partners from public, anon, authenticated;
revoke all on table public.affiliate_clicks from public, anon, authenticated;
revoke all on table public.affiliate_attributions from public, anon, authenticated;
revoke all on table public.affiliate_commissions from public, anon, authenticated;
revoke all on table public.affiliate_payouts from public, anon, authenticated;

grant select on table public.market_partners to authenticated;
grant select (
  id, partner_id, affiliate_code, landing_path, referrer_host,
  utm_source, utm_medium, utm_campaign, click_bucket, clicked_at, created_at
) on table public.affiliate_clicks to authenticated;
grant select (
  id, partner_id, click_id, affiliate_code, subject_role, status,
  attributed_at, qualified_at, created_at, updated_at
) on table public.affiliate_attributions to authenticated;
grant select (
  id, partner_id, payout_id, currency, net_paid_amount, commission_pct,
  commission_amount, status, source, approved_at, rejected_at,
  rejection_reason, paid_at, note, created_at, updated_at
) on table public.affiliate_commissions to authenticated;
grant select (
  id, partner_id, payout_code, period_start, period_end, currency,
  gross_commission_amount, adjustment_amount, net_payout_amount,
  commission_count, status, payment_reference, note,
  approved_at, paid_at, created_at, updated_at
) on table public.affiliate_payouts to authenticated;

grant all on table public.market_partners to service_role;
grant all on table public.affiliate_clicks to service_role;
grant all on table public.affiliate_attributions to service_role;
grant all on table public.affiliate_commissions to service_role;
grant all on table public.affiliate_payouts to service_role;

create or replace function public.d68_normalize_affiliate_code(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
    left(
      regexp_replace(upper(btrim(coalesce(p_value, ''))), '[^A-Z0-9_-]+', '', 'g'),
      32
    ),
    ''
  );
$$;

create or replace function public.d68_issue_affiliate_code(p_preferred text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_attempt integer := 0;
begin
  v_code := public.d68_normalize_affiliate_code(p_preferred);
  if v_code is not null then
    if length(v_code) < 4 then
      raise exception 'Affiliate code must contain at least 4 characters' using errcode = '22023';
    end if;
    if exists (select 1 from public.market_partners mp where mp.affiliate_code = v_code) then
      raise exception 'Affiliate code already exists' using errcode = '23505';
    end if;
    return v_code;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'D68' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 9));
    exit when not exists (
      select 1 from public.market_partners mp where mp.affiliate_code = v_code
    );
    if v_attempt >= 20 then
      raise exception 'Could not generate a unique affiliate code' using errcode = 'P0001';
    end if;
  end loop;

  return v_code;
end;
$$;

create or replace function public.d68_admin_list_market_partners()
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
    select jsonb_agg(
      to_jsonb(mp)
      || jsonb_build_object(
        'click_count', (select count(*) from public.affiliate_clicks c where c.partner_id = mp.id),
        'attribution_count', (select count(*) from public.affiliate_attributions a where a.partner_id = mp.id),
        'commission_count', (select count(*) from public.affiliate_commissions c where c.partner_id = mp.id)
      )
      order by mp.created_at desc
    )
    from public.market_partners mp
  ), '[]'::jsonb);
end;
$$;

create or replace function public.d68_get_my_market_partner()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select * into v_partner
  from public.market_partners mp
  where mp.profile_id = auth.uid()
  limit 1;

  if v_partner.id is null then
    return null;
  end if;

  return to_jsonb(v_partner);
end;
$$;

create or replace function public.d68_admin_create_market_partner(
  p_display_name text,
  p_contact_email text,
  p_phone text default null,
  p_country text default null,
  p_country_iso2 text default null,
  p_intro text default null,
  p_customer_discount_pct numeric default 0,
  p_commission_pct numeric default 0,
  p_status text default 'active',
  p_profile_id uuid default null,
  p_affiliate_code text default null,
  p_source_lead_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
  v_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_status text := lower(btrim(coalesce(p_status, 'active')));
  v_country_iso2 text := nullif(upper(btrim(coalesce(p_country_iso2, ''))), '');
  v_code text;
  v_profile_role text;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_display_name, '')) = '' then
    raise exception 'Partner name is required' using errcode = '22023';
  end if;
  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'Valid partner email is required' using errcode = '22023';
  end if;
  if v_status not in ('active', 'suspended') then
    raise exception 'Unsupported partner status' using errcode = '22023';
  end if;
  if coalesce(p_customer_discount_pct, 0) < 0 or coalesce(p_customer_discount_pct, 0) > 100
     or coalesce(p_commission_pct, 0) < 0 or coalesce(p_commission_pct, 0) > 100 then
    raise exception 'Discount and commission must be between 0 and 100' using errcode = '22023';
  end if;
  if v_country_iso2 is not null and v_country_iso2 !~ '^[A-Z]{2}$' then
    raise exception 'Country ISO2 must contain two letters' using errcode = '22023';
  end if;

  if p_profile_id is not null then
    select p.role::text into v_profile_role from public.profiles p where p.id = p_profile_id;
    if v_profile_role is distinct from 'market_partner' then
      raise exception 'Linked profile must already use the market_partner role' using errcode = '42501';
    end if;
  end if;

  if p_source_lead_id is not null and not exists (
    select 1 from public.partner_leads pl where pl.id = p_source_lead_id
  ) then
    raise exception 'Partner lead not found' using errcode = 'P0002';
  end if;

  v_code := public.d68_issue_affiliate_code(p_affiliate_code);

  insert into public.market_partners (
    profile_id,
    source_lead_id,
    display_name,
    contact_email,
    phone,
    country,
    country_iso2,
    intro,
    affiliate_code,
    customer_discount_pct,
    commission_pct,
    status,
    created_by,
    activated_at,
    suspended_at,
    created_at,
    updated_at
  ) values (
    p_profile_id,
    p_source_lead_id,
    btrim(p_display_name),
    v_email,
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    v_country_iso2,
    nullif(btrim(coalesce(p_intro, '')), ''),
    v_code,
    coalesce(p_customer_discount_pct, 0),
    coalesce(p_commission_pct, 0),
    v_status,
    auth.uid(),
    case when v_status = 'active' then now() else null end,
    case when v_status = 'suspended' then now() else null end,
    now(),
    now()
  )
  returning * into v_partner;

  if p_source_lead_id is not null then
    update public.partner_leads
    set status = 'converted', updated_at = now()
    where id = p_source_lead_id;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'create_market_partner',
    'market_partner',
    v_partner.id::text,
    jsonb_build_object(
      'source_lead_id', p_source_lead_id,
      'affiliate_code', v_partner.affiliate_code,
      'customer_discount_pct', v_partner.customer_discount_pct,
      'commission_pct', v_partner.commission_pct,
      'status', v_partner.status
    )
  );

  return to_jsonb(v_partner);
end;
$$;

create or replace function public.d68_admin_convert_partner_lead(
  p_lead_id uuid,
  p_customer_discount_pct numeric default 0,
  p_commission_pct numeric default 0,
  p_status text default 'active',
  p_affiliate_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead public.partner_leads%rowtype;
  v_partner public.market_partners%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select * into v_lead
  from public.partner_leads pl
  where pl.id = p_lead_id
  for update;

  if v_lead.id is null then
    raise exception 'Partner lead not found' using errcode = 'P0002';
  end if;

  select * into v_partner
  from public.market_partners mp
  where mp.source_lead_id = v_lead.id
     or lower(mp.contact_email) = lower(v_lead.email)
  order by (mp.source_lead_id = v_lead.id) desc
  limit 1;

  if v_partner.id is not null then
    if v_partner.source_lead_id is null then
      update public.market_partners
      set source_lead_id = v_lead.id, updated_at = now()
      where id = v_partner.id
      returning * into v_partner;
    end if;
    update public.partner_leads set status = 'converted', updated_at = now() where id = v_lead.id;
    return to_jsonb(v_partner);
  end if;

  v_result := public.d68_admin_create_market_partner(
    p_display_name => v_lead.full_name,
    p_contact_email => v_lead.email,
    p_phone => v_lead.phone,
    p_country => v_lead.country,
    p_country_iso2 => null,
    p_intro => v_lead.intro,
    p_customer_discount_pct => p_customer_discount_pct,
    p_commission_pct => p_commission_pct,
    p_status => p_status,
    p_profile_id => null,
    p_affiliate_code => p_affiliate_code,
    p_source_lead_id => v_lead.id
  );

  return v_result;
end;
$$;

create or replace function public.d68_admin_update_market_partner(
  p_partner_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.market_partners%rowtype;
  v_after public.market_partners%rowtype;
  v_status text;
  v_email text;
  v_country_iso2 text;
  v_discount numeric;
  v_commission numeric;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Patch must be a JSON object' using errcode = '22023';
  end if;

  select * into v_before
  from public.market_partners mp
  where mp.id = p_partner_id
  for update;

  if v_before.id is null then
    raise exception 'Market Partner not found' using errcode = 'P0002';
  end if;

  v_status := case when p_patch ? 'status'
    then lower(btrim(coalesce(p_patch->>'status', '')))
    else v_before.status end;
  v_email := case when p_patch ? 'contact_email'
    then lower(btrim(coalesce(p_patch->>'contact_email', '')))
    else v_before.contact_email end;
  v_country_iso2 := case when p_patch ? 'country_iso2'
    then nullif(upper(btrim(coalesce(p_patch->>'country_iso2', ''))), '')
    else v_before.country_iso2 end;
  v_discount := case when p_patch ? 'customer_discount_pct'
    then (p_patch->>'customer_discount_pct')::numeric
    else v_before.customer_discount_pct end;
  v_commission := case when p_patch ? 'commission_pct'
    then (p_patch->>'commission_pct')::numeric
    else v_before.commission_pct end;

  if v_status not in ('active', 'suspended') then
    raise exception 'Unsupported partner status' using errcode = '22023';
  end if;
  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'Valid partner email is required' using errcode = '22023';
  end if;
  if v_country_iso2 is not null and v_country_iso2 !~ '^[A-Z]{2}$' then
    raise exception 'Country ISO2 must contain two letters' using errcode = '22023';
  end if;
  if v_discount < 0 or v_discount > 100 or v_commission < 0 or v_commission > 100 then
    raise exception 'Discount and commission must be between 0 and 100' using errcode = '22023';
  end if;

  update public.market_partners
  set display_name = case when p_patch ? 'display_name'
        then coalesce(nullif(btrim(p_patch->>'display_name'), ''), display_name)
        else display_name end,
      contact_email = v_email,
      phone = case when p_patch ? 'phone' then nullif(btrim(coalesce(p_patch->>'phone', '')), '') else phone end,
      country = case when p_patch ? 'country' then nullif(btrim(coalesce(p_patch->>'country', '')), '') else country end,
      country_iso2 = v_country_iso2,
      intro = case when p_patch ? 'intro' then nullif(btrim(coalesce(p_patch->>'intro', '')), '') else intro end,
      customer_discount_pct = v_discount,
      commission_pct = v_commission,
      status = v_status,
      activated_at = case
        when v_status = 'active' then coalesce(activated_at, now())
        else activated_at
      end,
      suspended_at = case
        when v_status = 'suspended' and v_before.status is distinct from 'suspended' then now()
        when v_status = 'active' then null
        else suspended_at
      end,
      suspension_reason = case
        when v_status = 'suspended' and p_patch ? 'suspension_reason'
          then nullif(btrim(coalesce(p_patch->>'suspension_reason', '')), '')
        when v_status = 'active' then null
        else suspension_reason
      end,
      updated_at = now()
  where id = p_partner_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'update_market_partner',
    'market_partner',
    v_after.id::text,
    jsonb_build_object(
      'old_status', v_before.status,
      'new_status', v_after.status,
      'old_customer_discount_pct', v_before.customer_discount_pct,
      'new_customer_discount_pct', v_after.customer_discount_pct,
      'old_commission_pct', v_before.commission_pct,
      'new_commission_pct', v_after.commission_pct
    )
  );

  return to_jsonb(v_after);
end;
$$;

create or replace function public.d68_admin_regenerate_market_partner_code(
  p_partner_id uuid,
  p_preferred_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
  v_old_code text;
  v_new_code text;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select * into v_partner
  from public.market_partners mp
  where mp.id = p_partner_id
  for update;

  if v_partner.id is null then
    raise exception 'Market Partner not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.affiliate_clicks c where c.partner_id = p_partner_id)
     or exists (select 1 from public.affiliate_attributions a where a.partner_id = p_partner_id) then
    raise exception 'Affiliate code cannot be changed after tracking has started' using errcode = 'P0001';
  end if;

  v_old_code := v_partner.affiliate_code;
  v_new_code := public.d68_issue_affiliate_code(p_preferred_code);

  update public.market_partners
  set affiliate_code = v_new_code, updated_at = now()
  where id = p_partner_id
  returning * into v_partner;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'regenerate_market_partner_affiliate_code',
    'market_partner',
    v_partner.id::text,
    jsonb_build_object('old_code', v_old_code, 'new_code', v_new_code)
  );

  return to_jsonb(v_partner);
end;
$$;

create or replace function public.d68_record_affiliate_click(
  p_affiliate_code text,
  p_landing_path text default '/',
  p_referrer_host text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_visitor_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_partner public.market_partners%rowtype;
  v_click_id uuid;
  v_path text;
  v_referrer text;
  v_visitor_hash text;
  v_bucket timestamptz := date_trunc('hour', now());
begin
  select * into v_partner
  from public.market_partners mp
  where mp.affiliate_code = public.d68_normalize_affiliate_code(p_affiliate_code)
    and mp.status = 'active'
  limit 1;

  if v_partner.id is null then
    return null;
  end if;

  v_path := left(split_part(btrim(coalesce(p_landing_path, '/')), '?', 1), 500);
  if left(v_path, 1) <> '/' then v_path := '/'; end if;
  v_referrer := nullif(left(lower(btrim(coalesce(p_referrer_host, ''))), 255), '');

  if length(btrim(coalesce(p_visitor_token, ''))) between 16 and 200 then
    v_visitor_hash := encode(
      extensions.digest(v_partner.id::text || ':' || btrim(p_visitor_token), 'sha256'),
      'hex'
    );
  end if;

  insert into public.affiliate_clicks (
    partner_id,
    affiliate_code,
    landing_path,
    referrer_host,
    utm_source,
    utm_medium,
    utm_campaign,
    visitor_hash,
    click_bucket,
    clicked_at,
    created_at
  ) values (
    v_partner.id,
    v_partner.affiliate_code,
    v_path,
    v_referrer,
    nullif(left(btrim(coalesce(p_utm_source, '')), 120), ''),
    nullif(left(btrim(coalesce(p_utm_medium, '')), 120), ''),
    nullif(left(btrim(coalesce(p_utm_campaign, '')), 160), ''),
    v_visitor_hash,
    v_bucket,
    now(),
    now()
  )
  on conflict (partner_id, visitor_hash, click_bucket)
    where visitor_hash is not null
  do update set clicked_at = excluded.clicked_at
  returning id into v_click_id;

  return v_click_id;
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
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  select * into v_attribution
  from public.affiliate_attributions a
  where a.id = p_attribution_id
  for update;
  if v_attribution.id is null then
    raise exception 'Affiliate attribution not found' using errcode = 'P0002';
  end if;

  select * into v_partner
  from public.market_partners mp
  where mp.id = v_attribution.partner_id;

  select * into v_payment
  from public.payment_orders po
  where po.id = p_payment_order_id
  for update;
  if v_payment.id is null then
    raise exception 'Payment order not found' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_payment.status, '')) <> 'confirmed' or v_payment.confirmed_at is null then
    raise exception 'Commission requires a confirmed payment' using errcode = 'P0001';
  end if;
  if coalesce(v_payment.profile_id, v_payment.created_by) is distinct from v_attribution.subject_profile_id then
    raise exception 'Payment order does not belong to the attributed account' using errcode = '42501';
  end if;

  select * into v_commission
  from public.affiliate_commissions c
  where c.payment_order_id = p_payment_order_id;
  if v_commission.id is not null then
    return to_jsonb(v_commission);
  end if;

  v_amount_text := coalesce(
    v_payment.payload #>> '{affiliate,net_paid_amount}',
    v_payment.payload ->> 'net_paid_amount',
    v_payment.payload #>> '{price,total}',
    v_payment.payload ->> 'total',
    v_payment.payload ->> 'amount'
  );
  v_amount_text := replace(replace(btrim(coalesce(v_amount_text, '')), ',', ''), ' ', '');
  if v_amount_text !~ '^[0-9]+([.][0-9]+)?$' then
    raise exception 'Confirmed payment does not contain a valid net paid amount' using errcode = '22023';
  end if;
  v_net_paid := v_amount_text::numeric;
  v_currency := upper(coalesce(
    nullif(v_payment.payload #>> '{affiliate,currency}', ''),
    nullif(v_payment.payload #>> '{price,currency}', ''),
    nullif(v_payment.payload ->> 'currency', ''),
    'VND'
  ));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Confirmed payment does not contain a valid currency' using errcode = '22023';
  end if;

  insert into public.affiliate_commissions (
    partner_id,
    attribution_id,
    payment_order_id,
    currency,
    net_paid_amount,
    commission_pct,
    status,
    source,
    created_by,
    created_at,
    updated_at
  ) values (
    v_partner.id,
    v_attribution.id,
    v_payment.id,
    v_currency,
    v_net_paid,
    v_partner.commission_pct,
    'pending',
    'payment_confirmed',
    auth.uid(),
    now(),
    now()
  )
  returning * into v_commission;

  update public.affiliate_attributions
  set status = 'qualified', qualified_at = coalesce(qualified_at, now()), updated_at = now()
  where id = v_attribution.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'create_affiliate_commission',
    'affiliate_commission',
    v_commission.id::text,
    jsonb_build_object(
      'partner_id', v_commission.partner_id,
      'attribution_id', v_commission.attribution_id,
      'payment_order_id', v_commission.payment_order_id,
      'net_paid_amount', v_commission.net_paid_amount,
      'commission_pct', v_commission.commission_pct,
      'commission_amount', v_commission.commission_amount,
      'currency', v_commission.currency
    )
  );

  return to_jsonb(v_commission);
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
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  if v_status not in ('approved', 'rejected', 'paid', 'reversed') then
    raise exception 'Unsupported commission status' using errcode = '22023';
  end if;

  select * into v_before
  from public.affiliate_commissions c
  where c.id = p_commission_id
  for update;
  if v_before.id is null then
    raise exception 'Affiliate commission not found' using errcode = 'P0002';
  end if;
  if v_status = 'paid' and v_before.payout_id is null then
    raise exception 'Paid commission must belong to a payout' using errcode = 'P0001';
  end if;

  update public.affiliate_commissions
  set status = v_status,
      approved_by = case when v_status = 'approved' then auth.uid() else approved_by end,
      approved_at = case when v_status = 'approved' then now() else approved_at end,
      rejected_by = case when v_status = 'rejected' then auth.uid() else rejected_by end,
      rejected_at = case when v_status = 'rejected' then now() else rejected_at end,
      rejection_reason = case when v_status = 'rejected' then nullif(btrim(coalesce(p_note, '')), '') else rejection_reason end,
      paid_by = case when v_status = 'paid' then auth.uid() else paid_by end,
      paid_at = case when v_status = 'paid' then now() else paid_at end,
      note = case when p_note is not null then nullif(btrim(p_note), '') else note end,
      updated_at = now()
  where id = p_commission_id
  returning * into v_after;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'set_affiliate_commission_status',
    'affiliate_commission',
    v_after.id::text,
    jsonb_build_object('old_status', v_before.status, 'new_status', v_after.status)
  );

  return to_jsonb(v_after);
end;
$$;

-- Explicit function ACLs: public may only record a sanitized click through one RPC.
revoke all on function public.d68_normalize_affiliate_code(text)
  from public, anon, authenticated;
revoke all on function public.d68_issue_affiliate_code(text)
  from public, anon, authenticated;
revoke all on function public.d68_admin_list_market_partners()
  from public, anon, authenticated;
revoke all on function public.d68_get_my_market_partner()
  from public, anon, authenticated;
revoke all on function public.d68_admin_create_market_partner(
  text, text, text, text, text, text, numeric, numeric, text, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function public.d68_admin_convert_partner_lead(uuid, numeric, numeric, text, text)
  from public, anon, authenticated;
revoke all on function public.d68_admin_update_market_partner(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.d68_admin_regenerate_market_partner_code(uuid, text)
  from public, anon, authenticated;
revoke all on function public.d68_record_affiliate_click(text, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.d68_admin_create_affiliate_commission(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.d68_admin_set_affiliate_commission_status(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.d68_normalize_affiliate_code(text) to service_role;
grant execute on function public.d68_issue_affiliate_code(text) to service_role;
grant execute on function public.d68_admin_list_market_partners() to authenticated, service_role;
grant execute on function public.d68_get_my_market_partner() to authenticated, service_role;
grant execute on function public.d68_admin_create_market_partner(
  text, text, text, text, text, text, numeric, numeric, text, uuid, text, uuid
) to authenticated, service_role;
grant execute on function public.d68_admin_convert_partner_lead(uuid, numeric, numeric, text, text)
  to authenticated, service_role;
grant execute on function public.d68_admin_update_market_partner(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.d68_admin_regenerate_market_partner_code(uuid, text)
  to authenticated, service_role;
grant execute on function public.d68_record_affiliate_click(text, text, text, text, text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.d68_admin_create_affiliate_commission(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.d68_admin_set_affiliate_commission_status(uuid, text, text)
  to authenticated, service_role;

comment on table public.market_partners is
  'Market Partner account domain. partner_leads remains an intake-only lead table.';
comment on table public.affiliate_clicks is
  'Sanitized referral click ledger. No raw IP address, user-agent or customer identity is stored.';
comment on table public.affiliate_attributions is
  'Server-owned referral attribution ledger. Partner SELECT excludes subject_profile_id through column grants.';
comment on table public.affiliate_commissions is
  'Server-calculated commission ledger. No automatic payment trigger is installed in Phase 1.';
comment on table public.affiliate_payouts is
  'Affiliate payout ledger; no bank-account payload or payment-order raw payload is exposed to partners.';
comment on function public.d68_record_affiliate_click(text, text, text, text, text, text, text) is
  'Public RPC that validates an active affiliate code and stores only sanitized, deduplicated click metadata.';
comment on function public.d68_admin_create_affiliate_commission(uuid, uuid) is
  'Admin-only, idempotent commission creation from a confirmed payment. Amount is generated by PostgreSQL from net paid amount and the partner rate.';
