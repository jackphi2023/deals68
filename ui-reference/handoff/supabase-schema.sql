-- Deals68.com — Supabase (Postgres) schema
-- Mirrors the current localStorage mock (assets/deals68-mock.js). Run in the Supabase SQL editor
-- or via `supabase db push`. RLS policies below are SKETCHES — review before enabling in prod.

create extension if not exists "pgcrypto";

-- ---------- Shared enums ----------
create type d68_role as enum ('business', 'investor', 'advisor', 'affiliate', 'admin');
create type d68_account_status as enum ('draft', 'payment_pending', 'pending_admin_review', 'active', 'expired', 'hidden');
create type d68_profile_status as enum ('Pending review', 'Live', 'Hidden', 'Expired');

-- ---------- Accounts (1 row per business/investor/advisor/affiliate) ----------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id),
  role d68_role not null,
  code text unique,                         -- e.g. INV-0001, AFF-4457
  account_status d68_account_status not null default 'draft',
  dashboard_login_enabled boolean not null default false,
  paid boolean not null default false,
  plan text,                                -- Standard | Featured (business), null for others
  payment_method text,
  order_code text,
  pending_expires_at timestamptz,
  joined_at timestamptz not null default now()
);
create index on accounts (role, account_status);

-- ---------- Business profiles ----------
create table businesses (
  account_id uuid primary key references accounts(id) on delete cascade,
  profile_status d68_profile_status not null default 'Pending review',
  quota_total int not null default 100,
  quota_used int not null default 0,
  company_name text,
  industry text,
  country text,
  segment text,
  highlights text,
  investment_reason text,
  financial_input jsonb not null default '{}',   -- avg_monthly_sales, latest_annual_sales, ebitda_margin_pct, growth_rate_pct, investment_amount_sought, max_stake_pct, data_source
  quality_review text not null default 'pending', -- 'pending' | 'approved' (admin quality-score signal)
  pending_review_reason text,
  pending_review_since timestamptz
);

create table business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(account_id) on delete cascade,
  title text,
  storage_path text,          -- private Storage bucket path; signed URLs issued via Edge Function
  uploaded boolean not null default false,
  visibility text not null default 'locked'  -- 'locked' | 'open'
);

create table business_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(account_id) on delete cascade,
  title text,
  storage_path text
);

-- ---------- Investor profiles ----------
create table investors (
  account_id uuid primary key references accounts(id) on delete cascade,
  type text, country text, industries text[], stage text, deal_type text,
  ticket_min numeric, ticket_max numeric,
  desc_vi text, desc_en text,
  overrides jsonb not null default '{}',      -- editable profile fields layered over any imported seed row
  privacy jsonb not null default '{}'         -- { shareEmail, email, sharePhone, phone, phoneCountry }
);

create table investor_contacts (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references investors(account_id) on delete cascade,
  name text, email text, phone text, role text, is_primary boolean default false
);

-- ---------- Advisor profiles (V1.7 — dashboard is a placeholder today) ----------
create table advisors (
  account_id uuid primary key references accounts(id) on delete cascade,
  full_name text, firm text, country text, deal_count int default 1
);

-- ---------- Affiliate profiles ----------
create table affiliates (
  account_id uuid primary key references accounts(id) on delete cascade,
  name text, email text,
  customer_discount_percent int not null default 15,
  payout_method jsonb not null default '{}'   -- { type, bank, account, holder }
);

create table affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references affiliates(account_id) on delete cascade,
  masked_name text, role d68_role, status text,   -- clicked | signup | pending | paid
  plan text, gross_amount numeric default 0,
  clicked_at timestamptz, converted_at timestamptz
);

create table affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid references affiliates(account_id) on delete cascade,
  period_label text, amount numeric, status text,  -- scheduled | processing | paid
  paid_at timestamptz
);

-- ---------- Credentials ----------
-- Prefer Supabase Auth (auth.users) over a custom table. Kept here only to document the mock's
-- 1:1 mapping: role + username(email) + password → accounts.id.
-- In production: auth.users.id = accounts.auth_user_id, role stored as a custom claim or in accounts.role.

-- ---------- Proposals (business → investor) ----------
create table proposals (
  code text primary key,
  business_id uuid references businesses(account_id) on delete cascade,
  investor_code text not null,
  status text not null default 'pending',   -- pending | approved | rejected
  sent_at timestamptz not null default now()
);

-- ---------- Investor "interested" flow (public Deal page → Business Dashboard) ----------
create table interests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(account_id) on delete cascade,
  investor_code text not null,
  status text not null default 'interested',  -- interested | connected
  created_at timestamptz not null default now()
);

-- ---------- Watchlist / saved businesses ----------
create table watchlist (
  investor_id uuid references investors(account_id) on delete cascade,
  business_id uuid references businesses(account_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (investor_id, business_id)
);

-- ---------- Request Data workflow (investor → admin queue → business tab) ----------
create table request_data_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(account_id) on delete cascade,
  investor_code text not null,
  fields text not null,
  status text not null default 'pending',   -- pending | fulfilled | declined
  requested_at timestamptz not null default now()
);

-- ---------- Business Quality Score criteria (Admin-editable) ----------
create table quality_criteria (
  key text primary key,          -- built-in signal key, or 'custom_<id>' for admin-added criteria
  label_vi text not null,
  label_en text not null,
  weight numeric not null default 10,
  enabled boolean not null default true,
  builtin boolean not null default false,
  default_pct numeric              -- used only when builtin = false (flat contribution %)
);

-- ---------- Promo codes ----------
create table promo_codes (
  code text primary key,
  name text,
  discount_percent int not null,
  applies_to_roles d68_role[] not null default '{business,investor,advisor}',
  usage_limit_total int,
  usage_limit_by_role jsonb default '{}',
  used_total int not null default 0,
  used_by_role jsonb not null default '{}',
  valid_from timestamptz,
  valid_to timestamptz,
  status text not null default 'active'   -- active | paused
);

-- ---------- Audit log ----------
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  event text not null,
  detail text
);

-- ================= RLS SKETCHES (enable + refine before launch) =================
-- alter table businesses enable row level security;
-- create policy "public reads live businesses" on businesses for select using (profile_status = 'Live');
-- create policy "owner reads/writes own business" on businesses for all
--   using (account_id in (select id from accounts where auth_user_id = auth.uid()));
-- (financial_input is a jsonb column on the same row — restrict via a view or column-level grants
--  if teaser vs. full data needs to differ for public vs. owner.)

-- alter table investors enable row level security;
-- create policy "public reads investor teaser" on investors for select using (true);
--   -- teaser = all columns EXCEPT investor_contacts (kept in a separate table, admin/owner only)
-- create policy "owner/admin read contacts" on investor_contacts for select
--   using (investor_id in (select id from accounts where auth_user_id = auth.uid()) or auth.role() = 'admin');

-- alter table proposals enable row level security;
-- create policy "investor sees own proposals" on proposals for select
--   using (investor_code = (select code from investors where account_id in
--     (select id from accounts where auth_user_id = auth.uid())));
-- create policy "business sees proposals sent to it" on proposals for select
--   using (business_id in (select id from accounts where auth_user_id = auth.uid()));
-- -- status UPDATE: investor (approve/reject) or admin only — enforce via a SECURITY DEFINER RPC, not raw UPDATE.

-- alter table request_data_queue enable row level security;
-- create policy "investor inserts own requests" on request_data_queue for insert
--   with check (investor_code = current_investor_code());
-- create policy "business reads its requests" on request_data_queue for select
--   using (business_id in (select id from accounts where auth_user_id = auth.uid()));
-- -- status UPDATE (fulfilled/declined): admin-only RPC.

-- alter table quality_criteria enable row level security;
-- create policy "public reads criteria" on quality_criteria for select using (true);
-- -- INSERT/UPDATE/DELETE: admin-only.

-- alter table accounts enable row level security;
-- -- account_status / dashboard_login_enabled writes: admin-only RPC (approveAccount), never direct client UPDATE.
