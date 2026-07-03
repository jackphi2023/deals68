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

