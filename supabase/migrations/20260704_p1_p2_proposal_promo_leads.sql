-- Deals68 P1/P2 core data integrity, proposal direction, quota and lead inbox.
-- Safe to run more than once. Designed for Beta hardening.

create extension if not exists pgcrypto;

alter table if exists businesses add column if not exists quota_total integer default 0;
alter table if exists businesses add column if not exists quota_used integer default 0;
alter table if exists businesses add column if not exists views integer default 0;
alter table if exists businesses add column if not exists pending_changes_json jsonb;
alter table if exists businesses add column if not exists data_confidence numeric;
alter table if exists businesses add column if not exists visible boolean default false;
alter table if exists businesses add column if not exists status text default 'draft';

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  investor_id uuid references investors(id) on delete cascade,
  sender_role text default 'business',
  sender_profile_id uuid references profiles(id) on delete set null,
  status text default 'sent',
  note text,
  sent_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table if exists proposals add column if not exists business_id uuid references businesses(id) on delete cascade;
alter table if exists proposals add column if not exists investor_id uuid references investors(id) on delete cascade;
alter table if exists proposals add column if not exists sender_role text default 'business';
alter table if exists proposals add column if not exists sender_profile_id uuid references profiles(id) on delete set null;
alter table if exists proposals add column if not exists status text default 'sent';
alter table if exists proposals add column if not exists note text;
alter table if exists proposals add column if not exists sent_at timestamptz default now();
alter table if exists proposals add column if not exists created_at timestamptz default now();
alter table if exists proposals add column if not exists updated_at timestamptz default now();
create index if not exists proposals_business_id_idx on proposals(business_id);
create index if not exists proposals_investor_id_idx on proposals(investor_id);
create unique index if not exists proposals_business_investor_active_uidx on proposals(business_id, investor_id) where status in ('sent','pending','approved','connected');

create table if not exists investor_interests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  investor_id uuid references investors(id) on delete cascade,
  status text default 'interested',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table if exists investor_interests add column if not exists business_id uuid references businesses(id) on delete cascade;
alter table if exists investor_interests add column if not exists investor_id uuid references investors(id) on delete cascade;
alter table if exists investor_interests add column if not exists status text default 'interested';
alter table if exists investor_interests add column if not exists note text;
alter table if exists investor_interests add column if not exists created_at timestamptz default now();
alter table if exists investor_interests add column if not exists updated_at timestamptz default now();
create unique index if not exists investor_interests_business_investor_uidx on investor_interests(business_id, investor_id);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  source text default 'contact_page',
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists partner_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  country text,
  intro text,
  source text default 'market_partner_page',
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists promo_codes add column if not exists code text;
alter table if exists promo_codes add column if not exists role text default 'all';
alter table if exists promo_codes add column if not exists discount_pct numeric default 0;
alter table if exists promo_codes add column if not exists quota_total integer default 0;
alter table if exists promo_codes add column if not exists usage_count integer default 0;
alter table if exists promo_codes add column if not exists starts_at timestamptz default now();
alter table if exists promo_codes add column if not exists ends_at timestamptz;
alter table if exists promo_codes add column if not exists active boolean default true;
create unique index if not exists promo_codes_code_uidx on promo_codes(upper(code));

create table if not exists promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid references promo_codes(id) on delete cascade,
  code text not null,
  profile_id uuid references profiles(id) on delete set null,
  role text,
  discount_pct numeric default 0,
  created_at timestamptz default now()
);
create index if not exists promo_code_redemptions_code_idx on promo_code_redemptions(upper(code));
create index if not exists promo_code_redemptions_profile_idx on promo_code_redemptions(profile_id);

create or replace function submit_business_proposal(p_business_id uuid, p_investor_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_business businesses%rowtype;
  v_existing uuid;
  v_quota_total integer;
  v_quota_used integer;
  v_proposal uuid;
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'not_authenticated';
  end if;
  if v_profile.role not in ('business','admin') then
    raise exception 'business_role_required';
  end if;

  select * into v_business from businesses where id = p_business_id for update;
  if v_business.id is null then
    raise exception 'business_not_found';
  end if;
  if v_profile.role <> 'admin' and v_business.owner_id <> v_profile.id then
    raise exception 'business_not_owned_by_user';
  end if;
  if coalesce(v_business.status,'') not in ('active','pending_admin_review') then
    raise exception 'business_not_active';
  end if;

  select id into v_existing
  from proposals
  where business_id = p_business_id and investor_id = p_investor_id and status in ('sent','pending','approved','connected')
  limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'proposal_id', v_existing, 'quota_used', coalesce(v_business.quota_used,0), 'quota_total', coalesce(v_business.quota_total,0));
  end if;

  v_quota_total := greatest(coalesce(v_business.quota_total, 0), 0);
  v_quota_used := greatest(coalesce(v_business.quota_used, 0), 0);
  if v_quota_total <= 0 then
    raise exception 'proposal_quota_not_configured';
  end if;
  if v_quota_used >= v_quota_total then
    raise exception 'proposal_quota_exceeded';
  end if;

  insert into proposals(business_id, investor_id, sender_role, sender_profile_id, status, note, sent_at)
  values (p_business_id, p_investor_id, 'business', v_profile.id, 'sent', p_note, now())
  returning id into v_proposal;

  update businesses
  set quota_used = coalesce(quota_used,0) + 1,
      updated_at = coalesce(updated_at, now())
  where id = p_business_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'proposal_id', v_proposal, 'quota_used', v_quota_used + 1, 'quota_total', v_quota_total);
end;
$$;

create or replace function express_investor_interest(p_business_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_investor investors%rowtype;
  v_interest uuid;
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'not_authenticated'; end if;
  if v_profile.role not in ('investor','admin') then raise exception 'investor_role_required'; end if;

  select * into v_investor from investors where owner_id = v_profile.id limit 1;
  if v_profile.role = 'admin' and v_investor.id is null then
    select * into v_investor from investors order by created_at desc limit 1;
  end if;
  if v_investor.id is null then raise exception 'investor_profile_not_found'; end if;

  insert into investor_interests(business_id, investor_id, status, note, created_at, updated_at)
  values (p_business_id, v_investor.id, 'interested', p_note, now(), now())
  on conflict (business_id, investor_id) do update set status = excluded.status, note = excluded.note, updated_at = now()
  returning id into v_interest;

  return jsonb_build_object('ok', true, 'interest_id', v_interest);
end;
$$;

create or replace function redeem_promo_code(p_code text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_promo promo_codes%rowtype;
  v_quota_total integer;
  v_usage integer;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'promo_code_required';
  end if;

  select * into v_promo from promo_codes where upper(code) = upper(trim(p_code)) and coalesce(active,true) = true for update;
  if v_promo.id is null then raise exception 'promo_not_found_or_inactive'; end if;

  if v_promo.starts_at is not null and now() < v_promo.starts_at then raise exception 'promo_not_started'; end if;
  if v_promo.ends_at is not null and now() > v_promo.ends_at then raise exception 'promo_expired'; end if;
  if coalesce(v_promo.role,'all') not in ('all', p_role) then raise exception 'promo_not_applicable_to_role'; end if;

  v_quota_total := coalesce(v_promo.quota_total, 0);
  v_usage := coalesce(v_promo.usage_count, 0);
  if v_quota_total > 0 and v_usage >= v_quota_total then raise exception 'promo_quota_exceeded'; end if;

  insert into promo_code_redemptions(promo_code_id, code, profile_id, role, discount_pct)
  values (v_promo.id, upper(trim(p_code)), v_profile_id, p_role, coalesce(v_promo.discount_pct,0));

  update promo_codes set usage_count = coalesce(usage_count,0) + 1 where id = v_promo.id;

  return jsonb_build_object('ok', true, 'code', upper(trim(p_code)), 'discount_pct', coalesce(v_promo.discount_pct,0), 'usage_count', v_usage + 1, 'quota_total', v_quota_total);
end;
$$;

grant execute on function submit_business_proposal(uuid, uuid, text) to authenticated;
grant execute on function express_investor_interest(uuid, text) to authenticated;
grant execute on function redeem_promo_code(text, text) to authenticated;

alter table contact_messages enable row level security;
alter table partner_leads enable row level security;

do $$ begin
  create policy contact_messages_public_insert on contact_messages for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy partner_leads_public_insert on partner_leads for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy contact_messages_admin_select on contact_messages for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy partner_leads_admin_select on partner_leads for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
exception when duplicate_object then null; end $$;
