-- Adds backing tables so Contact and Market Partner forms do not report fake success.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  source text default 'contact_page',
  status text default 'new',
  created_at timestamptz default now()
);

create table if not exists public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  country text,
  intro text,
  source text default 'market_partner_page',
  status text default 'new',
  created_at timestamptz default now()
);

alter table public.contact_messages enable row level security;
alter table public.partner_leads enable row level security;

drop policy if exists "Anyone can create contact messages" on public.contact_messages;
create policy "Anyone can create contact messages" on public.contact_messages
  for insert to anon, authenticated with check (true);

drop policy if exists "Anyone can create partner leads" on public.partner_leads;
create policy "Anyone can create partner leads" on public.partner_leads
  for insert to anon, authenticated with check (true);
