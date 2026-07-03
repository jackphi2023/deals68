-- Deals68.com Production Beta schema
-- Run in Supabase SQL editor, then run scripts/seed.mjs with service role key.
create extension if not exists pgcrypto;

create type public.user_role as enum ('business','investor','advisor','affiliate','admin');
create type public.account_status as enum ('draft','payment_pending','pending_admin_review','active','hidden','expired','rejected');
create type public.proposal_status as enum ('sent','approved','declined','request_data','connected');
create type public.request_status as enum ('pending','forwarded','fulfilled','rejected');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  username text unique,
  display_name text,
  email text,
  country_iso2 text default 'VN',
  language_code text default 'vi',
  timezone text default 'Asia/Ho_Chi_Minh',
  phone_country_iso2 text default 'VN',
  phone text,
  status public.account_status default 'draft',
  dashboard_login_enabled boolean default false,
  initial_password text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.country_calling_codes (
  iso2 text primary key,
  iso3 text,
  country text not null,
  country_vi text,
  dial_code text not null,
  example_format text,
  phone_validation_pattern text,
  timezone_default text,
  language_default text,
  display_order int default 999,
  top boolean default false
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  username text unique,
  public_code text unique,
  slug text unique not null,
  company_name_private text,
  title_vi text not null,
  title_en text not null,
  description_vi text,
  description_en text,
  country_iso2 text default 'VN',
  city text,
  industry text,
  deal_type text,
  plan text default 'standard',
  revenue_2025 numeric default 0,
  revenue_currency text default 'VND',
  ebitda_margin numeric default 0,
  ask_amount numeric default 0,
  ask_currency text default 'VND',
  stake_pct numeric default 0,
  highlights_vi text,
  highlights_en text,
  investment_reason_vi text,
  investment_reason_en text,
  financial_input jsonb default '{}'::jsonb,
  data_confidence int default 40,
  quality_score int default 50,
  quality_breakdown jsonb default '{}'::jsonb,
  valuation_reasonableness text default 'Fair',
  visible boolean default true,
  status public.account_status default 'active',
  quota_total int default 100,
  quota_used int default 0,
  pending_changes_json jsonb,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  code text unique,
  username text unique,
  type text default 'Individual/Angel',
  title_vi text not null,
  title_en text not null,
  desc_vi text,
  desc_en text,
  country_iso2 text default 'US',
  country text,
  region text,
  industries text[] default '{}',
  deal_types text[] default '{}',
  stage text,
  ticket_min numeric default 0,
  ticket_max numeric default 0,
  criteria jsonb default '{}'::jsonb,
  privacy jsonb default '{"shareEmail":false,"sharePhone":false}'::jsonb,
  private_name text,
  private_website text,
  private_email text,
  private_phone text,
  visible boolean default true,
  verified boolean default false,
  admin_priority boolean default false,
  activity_level text default 'medium',
  status public.account_status default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.business_files (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text,
  size_bytes bigint default 0,
  category text default 'other',
  privacy_level text default 'locked',
  review_status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.business_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  title text,
  image_path text not null,
  public_url text,
  review_status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  message text,
  status public.proposal_status default 'sent',
  sent_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (business_id, investor_id)
);

create table if not exists public.investor_interests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  status text default 'interested',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (business_id, investor_id)
);

create table if not exists public.saved_businesses (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references public.investors(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  created_at timestamptz default now(),
  unique (investor_id, business_id)
);

create table if not exists public.request_data (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  requested_items text[] default '{}',
  note text,
  status public.request_status default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  role public.user_role,
  discount_pct numeric default 0,
  quota_total int default 0,
  quota_used int default 0,
  starts_at timestamptz default now(),
  ends_at timestamptz,
  active boolean default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid references public.promo_codes(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role public.user_role,
  amount_before numeric default 0,
  amount_after numeric default 0,
  created_at timestamptz default now(),
  unique (promo_id, profile_id)
);

create table if not exists public.quality_criteria (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label_vi text not null,
  label_en text not null,
  weight numeric not null default 10,
  active boolean default true,
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'active');
$$;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role::text from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_businesses_updated before update on public.businesses for each row execute function public.touch_updated_at();
create trigger trg_investors_updated before update on public.investors for each row execute function public.touch_updated_at();

create or replace function public.log_admin_action(action text, entity_type text, entity_id text, detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), action, entity_type, entity_id, detail);
end $$;

create or replace function public.approve_business_pending(business_uuid uuid)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare b public.businesses;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.businesses
  set
    title_vi = coalesce(pending_changes_json->>'title_vi', title_vi),
    title_en = coalesce(pending_changes_json->>'title_en', title_en),
    revenue_2025 = coalesce((pending_changes_json->>'revenue_2025')::numeric, revenue_2025),
    ebitda_margin = coalesce((pending_changes_json->>'ebitda_margin')::numeric, ebitda_margin),
    ask_amount = coalesce((pending_changes_json->>'ask_amount')::numeric, ask_amount),
    stake_pct = coalesce((pending_changes_json->>'stake_pct')::numeric, stake_pct),
    highlights_vi = coalesce(pending_changes_json->>'highlights_vi', highlights_vi),
    highlights_en = coalesce(pending_changes_json->>'highlights_en', highlights_en),
    investment_reason_vi = coalesce(pending_changes_json->>'investment_reason_vi', investment_reason_vi),
    investment_reason_en = coalesce(pending_changes_json->>'investment_reason_en', investment_reason_en),
    financial_input = coalesce(pending_changes_json->'financial_input', financial_input),
    pending_changes_json = null,
    status = 'active'
  where id = business_uuid
  returning * into b;
  perform public.log_admin_action('approve_pending_changes','business',business_uuid::text,'{}'::jsonb);
  return b;
end $$;

-- RLS
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.investors enable row level security;
alter table public.business_files enable row level security;
alter table public.business_images enable row level security;
alter table public.proposals enable row level security;
alter table public.investor_interests enable row level security;
alter table public.saved_businesses enable row level security;
alter table public.request_data enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.quality_criteria enable row level security;
alter table public.audit_logs enable row level security;
alter table public.country_calling_codes enable row level security;

create policy "public country codes" on public.country_calling_codes for select using (true);
create policy "public quality criteria" on public.quality_criteria for select using (true);
create policy "admin quality write" on public.quality_criteria for all using (public.is_admin()) with check (public.is_admin());

create policy "profile own or admin select" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profile own insert" on public.profiles for insert with check (id = auth.uid() or public.is_admin());
create policy "profile own update" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "public visible businesses" on public.businesses for select using ((visible = true and status = 'active') or owner_id = auth.uid() or public.is_admin());
create policy "business insert own" on public.businesses for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "business update own or admin" on public.businesses for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "business delete admin" on public.businesses for delete using (public.is_admin());

create policy "public visible investors" on public.investors for select using ((visible = true and status = 'active') or owner_id = auth.uid() or public.is_admin());
create policy "investor insert own" on public.investors for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "investor update own or admin" on public.investors for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "investor delete admin" on public.investors for delete using (public.is_admin());

create policy "files readable to owner investor connected or admin" on public.business_files for select using (
  owner_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.proposals p join public.investors i on i.id = p.investor_id
    where p.business_id = business_files.business_id and i.owner_id = auth.uid() and p.status in ('approved','connected')
  )
);
create policy "files insert owner/admin" on public.business_files for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "files update owner/admin" on public.business_files for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

create policy "images public visible" on public.business_images for select using (true);
create policy "images insert owner/admin" on public.business_images for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "images update owner/admin" on public.business_images for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

create policy "proposal parties admin select" on public.proposals for select using (
  public.is_admin()
  or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())
);
create policy "proposal business insert" on public.proposals for insert with check (exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()) or public.is_admin());
create policy "proposal investor admin update" on public.proposals for update using (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()));

create policy "interest parties select" on public.investor_interests for select using (
  public.is_admin()
  or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())
);
create policy "interest investor insert" on public.investor_interests for insert with check (exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()) or public.is_admin());
create policy "interest business update" on public.investor_interests for update using (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "saved investor own" on public.saved_businesses for all using (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()));

create policy "request parties select" on public.request_data for select using (
  public.is_admin()
  or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid())
);
create policy "request investor insert" on public.request_data for insert with check (public.is_admin() or exists(select 1 from public.investors i where i.id = investor_id and i.owner_id = auth.uid()));
create policy "request business admin update" on public.request_data for update using (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())) with check (public.is_admin() or exists(select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "public active promos" on public.promo_codes for select using (active = true or public.is_admin());
create policy "admin promo write" on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());
create policy "redemption own/admin" on public.promo_redemptions for select using (profile_id = auth.uid() or public.is_admin());
create policy "redemption own insert" on public.promo_redemptions for insert with check (profile_id = auth.uid() or public.is_admin());

create policy "audit admin only" on public.audit_logs for select using (public.is_admin());
create policy "audit admin insert" on public.audit_logs for insert with check (public.is_admin());

-- Storage buckets should be created from Supabase UI or seed script:
-- business-files-private (private), business-images-public (public).

create or replace function public.resolve_login_email(login text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from public.profiles where username = login or email = login limit 1;
$$;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Storage policies. Create buckets first via scripts/seed.mjs or Supabase UI.
drop policy if exists "public read business images" on storage.objects;
create policy "public read business images" on storage.objects for select using (bucket_id = 'business-images-public');
drop policy if exists "authenticated upload business images" on storage.objects;
create policy "authenticated upload business images" on storage.objects for insert with check (bucket_id = 'business-images-public' and auth.role() = 'authenticated');
drop policy if exists "authenticated update own business images" on storage.objects;
create policy "authenticated update own business images" on storage.objects for update using (bucket_id = 'business-images-public' and owner = auth.uid());
drop policy if exists "authenticated upload private business files" on storage.objects;
create policy "authenticated upload private business files" on storage.objects for insert with check (bucket_id = 'business-files-private' and auth.role() = 'authenticated');
drop policy if exists "authenticated read own private business files" on storage.objects;
create policy "authenticated read own private business files" on storage.objects for select using (bucket_id = 'business-files-private' and (owner = auth.uid() or public.is_admin()));
drop policy if exists "authenticated update own private business files" on storage.objects;
create policy "authenticated update own private business files" on storage.objects for update using (bucket_id = 'business-files-private' and (owner = auth.uid() or public.is_admin()));
