-- Deals68 extended production schema: 66 extension tables + 14 core tables = about 80 tables.
-- Apply after 0001/0002/0003 migrations.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_organizations_business on public.organizations(business_id);
create index if not exists idx_organizations_investor on public.organizations(investor_id);
create index if not exists idx_organizations_profile on public.organizations(profile_id);
create index if not exists idx_organizations_status on public.organizations(status);
alter table public.organizations enable row level security;
create policy "organizations_admin_all" on public.organizations for all using (public.is_admin()) with check (public.is_admin());
create policy "organizations_own_select" on public.organizations for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "organizations_own_insert" on public.organizations for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "organizations_own_update" on public.organizations for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_organization_members_business on public.organization_members(business_id);
create index if not exists idx_organization_members_investor on public.organization_members(investor_id);
create index if not exists idx_organization_members_profile on public.organization_members(profile_id);
create index if not exists idx_organization_members_status on public.organization_members(status);
alter table public.organization_members enable row level security;
create policy "organization_members_admin_all" on public.organization_members for all using (public.is_admin()) with check (public.is_admin());
create policy "organization_members_own_select" on public.organization_members for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "organization_members_own_insert" on public.organization_members for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "organization_members_own_update" on public.organization_members for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_role_permissions_business on public.role_permissions(business_id);
create index if not exists idx_role_permissions_investor on public.role_permissions(investor_id);
create index if not exists idx_role_permissions_profile on public.role_permissions(profile_id);
create index if not exists idx_role_permissions_status on public.role_permissions(status);
alter table public.role_permissions enable row level security;
create policy "role_permissions_admin_all" on public.role_permissions for all using (public.is_admin()) with check (public.is_admin());
create policy "role_permissions_own_select" on public.role_permissions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "role_permissions_own_insert" on public.role_permissions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "role_permissions_own_update" on public.role_permissions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_user_sessions_business on public.user_sessions(business_id);
create index if not exists idx_user_sessions_investor on public.user_sessions(investor_id);
create index if not exists idx_user_sessions_profile on public.user_sessions(profile_id);
create index if not exists idx_user_sessions_status on public.user_sessions(status);
alter table public.user_sessions enable row level security;
create policy "user_sessions_admin_all" on public.user_sessions for all using (public.is_admin()) with check (public.is_admin());
create policy "user_sessions_own_select" on public.user_sessions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "user_sessions_own_insert" on public.user_sessions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "user_sessions_own_update" on public.user_sessions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_auth_events_business on public.auth_events(business_id);
create index if not exists idx_auth_events_investor on public.auth_events(investor_id);
create index if not exists idx_auth_events_profile on public.auth_events(profile_id);
create index if not exists idx_auth_events_status on public.auth_events(status);
alter table public.auth_events enable row level security;
create policy "auth_events_admin_all" on public.auth_events for all using (public.is_admin()) with check (public.is_admin());
create policy "auth_events_own_select" on public.auth_events for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "auth_events_own_insert" on public.auth_events for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "auth_events_own_update" on public.auth_events for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_countries_business on public.countries(business_id);
create index if not exists idx_countries_investor on public.countries(investor_id);
create index if not exists idx_countries_profile on public.countries(profile_id);
create index if not exists idx_countries_status on public.countries(status);
alter table public.countries enable row level security;
create policy "countries_admin_all" on public.countries for all using (public.is_admin()) with check (public.is_admin());
create policy "countries_own_select" on public.countries for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "countries_own_insert" on public.countries for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "countries_own_update" on public.countries for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_languages_business on public.languages(business_id);
create index if not exists idx_languages_investor on public.languages(investor_id);
create index if not exists idx_languages_profile on public.languages(profile_id);
create index if not exists idx_languages_status on public.languages(status);
alter table public.languages enable row level security;
create policy "languages_admin_all" on public.languages for all using (public.is_admin()) with check (public.is_admin());
create policy "languages_own_select" on public.languages for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "languages_own_insert" on public.languages for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "languages_own_update" on public.languages for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.localization_strings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_localization_strings_business on public.localization_strings(business_id);
create index if not exists idx_localization_strings_investor on public.localization_strings(investor_id);
create index if not exists idx_localization_strings_profile on public.localization_strings(profile_id);
create index if not exists idx_localization_strings_status on public.localization_strings(status);
alter table public.localization_strings enable row level security;
create policy "localization_strings_admin_all" on public.localization_strings for all using (public.is_admin()) with check (public.is_admin());
create policy "localization_strings_own_select" on public.localization_strings for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "localization_strings_own_insert" on public.localization_strings for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "localization_strings_own_update" on public.localization_strings for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.translation_memory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_translation_memory_business on public.translation_memory(business_id);
create index if not exists idx_translation_memory_investor on public.translation_memory(investor_id);
create index if not exists idx_translation_memory_profile on public.translation_memory(profile_id);
create index if not exists idx_translation_memory_status on public.translation_memory(status);
alter table public.translation_memory enable row level security;
create policy "translation_memory_admin_all" on public.translation_memory for all using (public.is_admin()) with check (public.is_admin());
create policy "translation_memory_own_select" on public.translation_memory for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "translation_memory_own_insert" on public.translation_memory for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "translation_memory_own_update" on public.translation_memory for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.seo_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_seo_pages_business on public.seo_pages(business_id);
create index if not exists idx_seo_pages_investor on public.seo_pages(investor_id);
create index if not exists idx_seo_pages_profile on public.seo_pages(profile_id);
create index if not exists idx_seo_pages_status on public.seo_pages(status);
alter table public.seo_pages enable row level security;
create policy "seo_pages_admin_all" on public.seo_pages for all using (public.is_admin()) with check (public.is_admin());
create policy "seo_pages_own_select" on public.seo_pages for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "seo_pages_own_insert" on public.seo_pages for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "seo_pages_own_update" on public.seo_pages for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.seo_redirects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_seo_redirects_business on public.seo_redirects(business_id);
create index if not exists idx_seo_redirects_investor on public.seo_redirects(investor_id);
create index if not exists idx_seo_redirects_profile on public.seo_redirects(profile_id);
create index if not exists idx_seo_redirects_status on public.seo_redirects(status);
alter table public.seo_redirects enable row level security;
create policy "seo_redirects_admin_all" on public.seo_redirects for all using (public.is_admin()) with check (public.is_admin());
create policy "seo_redirects_own_select" on public.seo_redirects for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "seo_redirects_own_insert" on public.seo_redirects for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "seo_redirects_own_update" on public.seo_redirects for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_media_assets_business on public.media_assets(business_id);
create index if not exists idx_media_assets_investor on public.media_assets(investor_id);
create index if not exists idx_media_assets_profile on public.media_assets(profile_id);
create index if not exists idx_media_assets_status on public.media_assets(status);
alter table public.media_assets enable row level security;
create policy "media_assets_admin_all" on public.media_assets for all using (public.is_admin()) with check (public.is_admin());
create policy "media_assets_own_select" on public.media_assets for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "media_assets_own_insert" on public.media_assets for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "media_assets_own_update" on public.media_assets for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_documents_business on public.documents(business_id);
create index if not exists idx_documents_investor on public.documents(investor_id);
create index if not exists idx_documents_profile on public.documents(profile_id);
create index if not exists idx_documents_status on public.documents(status);
alter table public.documents enable row level security;
create policy "documents_admin_all" on public.documents for all using (public.is_admin()) with check (public.is_admin());
create policy "documents_own_select" on public.documents for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "documents_own_insert" on public.documents for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "documents_own_update" on public.documents for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_document_versions_business on public.document_versions(business_id);
create index if not exists idx_document_versions_investor on public.document_versions(investor_id);
create index if not exists idx_document_versions_profile on public.document_versions(profile_id);
create index if not exists idx_document_versions_status on public.document_versions(status);
alter table public.document_versions enable row level security;
create policy "document_versions_admin_all" on public.document_versions for all using (public.is_admin()) with check (public.is_admin());
create policy "document_versions_own_select" on public.document_versions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "document_versions_own_insert" on public.document_versions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "document_versions_own_update" on public.document_versions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.document_access_grants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_document_access_grants_business on public.document_access_grants(business_id);
create index if not exists idx_document_access_grants_investor on public.document_access_grants(investor_id);
create index if not exists idx_document_access_grants_profile on public.document_access_grants(profile_id);
create index if not exists idx_document_access_grants_status on public.document_access_grants(status);
alter table public.document_access_grants enable row level security;
create policy "document_access_grants_admin_all" on public.document_access_grants for all using (public.is_admin()) with check (public.is_admin());
create policy "document_access_grants_own_select" on public.document_access_grants for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "document_access_grants_own_insert" on public.document_access_grants for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "document_access_grants_own_update" on public.document_access_grants for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_payment_orders_business on public.payment_orders(business_id);
create index if not exists idx_payment_orders_investor on public.payment_orders(investor_id);
create index if not exists idx_payment_orders_profile on public.payment_orders(profile_id);
create index if not exists idx_payment_orders_status on public.payment_orders(status);
alter table public.payment_orders enable row level security;
create policy "payment_orders_admin_all" on public.payment_orders for all using (public.is_admin()) with check (public.is_admin());
create policy "payment_orders_own_select" on public.payment_orders for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "payment_orders_own_insert" on public.payment_orders for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "payment_orders_own_update" on public.payment_orders for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_payment_transactions_business on public.payment_transactions(business_id);
create index if not exists idx_payment_transactions_investor on public.payment_transactions(investor_id);
create index if not exists idx_payment_transactions_profile on public.payment_transactions(profile_id);
create index if not exists idx_payment_transactions_status on public.payment_transactions(status);
alter table public.payment_transactions enable row level security;
create policy "payment_transactions_admin_all" on public.payment_transactions for all using (public.is_admin()) with check (public.is_admin());
create policy "payment_transactions_own_select" on public.payment_transactions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "payment_transactions_own_insert" on public.payment_transactions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "payment_transactions_own_update" on public.payment_transactions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_payment_methods_business on public.payment_methods(business_id);
create index if not exists idx_payment_methods_investor on public.payment_methods(investor_id);
create index if not exists idx_payment_methods_profile on public.payment_methods(profile_id);
create index if not exists idx_payment_methods_status on public.payment_methods(status);
alter table public.payment_methods enable row level security;
create policy "payment_methods_admin_all" on public.payment_methods for all using (public.is_admin()) with check (public.is_admin());
create policy "payment_methods_own_select" on public.payment_methods for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "payment_methods_own_insert" on public.payment_methods for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "payment_methods_own_update" on public.payment_methods for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_payment_webhooks_business on public.payment_webhooks(business_id);
create index if not exists idx_payment_webhooks_investor on public.payment_webhooks(investor_id);
create index if not exists idx_payment_webhooks_profile on public.payment_webhooks(profile_id);
create index if not exists idx_payment_webhooks_status on public.payment_webhooks(status);
alter table public.payment_webhooks enable row level security;
create policy "payment_webhooks_admin_all" on public.payment_webhooks for all using (public.is_admin()) with check (public.is_admin());
create policy "payment_webhooks_own_select" on public.payment_webhooks for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "payment_webhooks_own_insert" on public.payment_webhooks for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "payment_webhooks_own_update" on public.payment_webhooks for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pricing_plans_business on public.pricing_plans(business_id);
create index if not exists idx_pricing_plans_investor on public.pricing_plans(investor_id);
create index if not exists idx_pricing_plans_profile on public.pricing_plans(profile_id);
create index if not exists idx_pricing_plans_status on public.pricing_plans(status);
alter table public.pricing_plans enable row level security;
create policy "pricing_plans_admin_all" on public.pricing_plans for all using (public.is_admin()) with check (public.is_admin());
create policy "pricing_plans_own_select" on public.pricing_plans for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "pricing_plans_own_insert" on public.pricing_plans for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "pricing_plans_own_update" on public.pricing_plans for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_plan_features_business on public.plan_features(business_id);
create index if not exists idx_plan_features_investor on public.plan_features(investor_id);
create index if not exists idx_plan_features_profile on public.plan_features(profile_id);
create index if not exists idx_plan_features_status on public.plan_features(status);
alter table public.plan_features enable row level security;
create policy "plan_features_admin_all" on public.plan_features for all using (public.is_admin()) with check (public.is_admin());
create policy "plan_features_own_select" on public.plan_features for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "plan_features_own_insert" on public.plan_features for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "plan_features_own_update" on public.plan_features for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_subscriptions_business on public.subscriptions(business_id);
create index if not exists idx_subscriptions_investor on public.subscriptions(investor_id);
create index if not exists idx_subscriptions_profile on public.subscriptions(profile_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
alter table public.subscriptions enable row level security;
create policy "subscriptions_admin_all" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
create policy "subscriptions_own_select" on public.subscriptions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "subscriptions_own_insert" on public.subscriptions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "subscriptions_own_update" on public.subscriptions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_promo_campaigns_business on public.promo_campaigns(business_id);
create index if not exists idx_promo_campaigns_investor on public.promo_campaigns(investor_id);
create index if not exists idx_promo_campaigns_profile on public.promo_campaigns(profile_id);
create index if not exists idx_promo_campaigns_status on public.promo_campaigns(status);
alter table public.promo_campaigns enable row level security;
create policy "promo_campaigns_admin_all" on public.promo_campaigns for all using (public.is_admin()) with check (public.is_admin());
create policy "promo_campaigns_own_select" on public.promo_campaigns for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "promo_campaigns_own_insert" on public.promo_campaigns for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "promo_campaigns_own_update" on public.promo_campaigns for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.affiliate_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_affiliate_accounts_business on public.affiliate_accounts(business_id);
create index if not exists idx_affiliate_accounts_investor on public.affiliate_accounts(investor_id);
create index if not exists idx_affiliate_accounts_profile on public.affiliate_accounts(profile_id);
create index if not exists idx_affiliate_accounts_status on public.affiliate_accounts(status);
alter table public.affiliate_accounts enable row level security;
create policy "affiliate_accounts_admin_all" on public.affiliate_accounts for all using (public.is_admin()) with check (public.is_admin());
create policy "affiliate_accounts_own_select" on public.affiliate_accounts for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "affiliate_accounts_own_insert" on public.affiliate_accounts for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "affiliate_accounts_own_update" on public.affiliate_accounts for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_affiliate_links_business on public.affiliate_links(business_id);
create index if not exists idx_affiliate_links_investor on public.affiliate_links(investor_id);
create index if not exists idx_affiliate_links_profile on public.affiliate_links(profile_id);
create index if not exists idx_affiliate_links_status on public.affiliate_links(status);
alter table public.affiliate_links enable row level security;
create policy "affiliate_links_admin_all" on public.affiliate_links for all using (public.is_admin()) with check (public.is_admin());
create policy "affiliate_links_own_select" on public.affiliate_links for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "affiliate_links_own_insert" on public.affiliate_links for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "affiliate_links_own_update" on public.affiliate_links for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_affiliate_clicks_business on public.affiliate_clicks(business_id);
create index if not exists idx_affiliate_clicks_investor on public.affiliate_clicks(investor_id);
create index if not exists idx_affiliate_clicks_profile on public.affiliate_clicks(profile_id);
create index if not exists idx_affiliate_clicks_status on public.affiliate_clicks(status);
alter table public.affiliate_clicks enable row level security;
create policy "affiliate_clicks_admin_all" on public.affiliate_clicks for all using (public.is_admin()) with check (public.is_admin());
create policy "affiliate_clicks_own_select" on public.affiliate_clicks for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "affiliate_clicks_own_insert" on public.affiliate_clicks for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "affiliate_clicks_own_update" on public.affiliate_clicks for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_affiliate_conversions_business on public.affiliate_conversions(business_id);
create index if not exists idx_affiliate_conversions_investor on public.affiliate_conversions(investor_id);
create index if not exists idx_affiliate_conversions_profile on public.affiliate_conversions(profile_id);
create index if not exists idx_affiliate_conversions_status on public.affiliate_conversions(status);
alter table public.affiliate_conversions enable row level security;
create policy "affiliate_conversions_admin_all" on public.affiliate_conversions for all using (public.is_admin()) with check (public.is_admin());
create policy "affiliate_conversions_own_select" on public.affiliate_conversions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "affiliate_conversions_own_insert" on public.affiliate_conversions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "affiliate_conversions_own_update" on public.affiliate_conversions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_affiliate_payouts_business on public.affiliate_payouts(business_id);
create index if not exists idx_affiliate_payouts_investor on public.affiliate_payouts(investor_id);
create index if not exists idx_affiliate_payouts_profile on public.affiliate_payouts(profile_id);
create index if not exists idx_affiliate_payouts_status on public.affiliate_payouts(status);
alter table public.affiliate_payouts enable row level security;
create policy "affiliate_payouts_admin_all" on public.affiliate_payouts for all using (public.is_admin()) with check (public.is_admin());
create policy "affiliate_payouts_own_select" on public.affiliate_payouts for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "affiliate_payouts_own_insert" on public.affiliate_payouts for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "affiliate_payouts_own_update" on public.affiliate_payouts for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.advisor_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_advisor_profiles_business on public.advisor_profiles(business_id);
create index if not exists idx_advisor_profiles_investor on public.advisor_profiles(investor_id);
create index if not exists idx_advisor_profiles_profile on public.advisor_profiles(profile_id);
create index if not exists idx_advisor_profiles_status on public.advisor_profiles(status);
alter table public.advisor_profiles enable row level security;
create policy "advisor_profiles_admin_all" on public.advisor_profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "advisor_profiles_own_select" on public.advisor_profiles for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "advisor_profiles_own_insert" on public.advisor_profiles for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "advisor_profiles_own_update" on public.advisor_profiles for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.advisor_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_advisor_assignments_business on public.advisor_assignments(business_id);
create index if not exists idx_advisor_assignments_investor on public.advisor_assignments(investor_id);
create index if not exists idx_advisor_assignments_profile on public.advisor_assignments(profile_id);
create index if not exists idx_advisor_assignments_status on public.advisor_assignments(status);
alter table public.advisor_assignments enable row level security;
create policy "advisor_assignments_admin_all" on public.advisor_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy "advisor_assignments_own_select" on public.advisor_assignments for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "advisor_assignments_own_insert" on public.advisor_assignments for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "advisor_assignments_own_update" on public.advisor_assignments for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_financials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_financials_business on public.business_financials(business_id);
create index if not exists idx_business_financials_investor on public.business_financials(investor_id);
create index if not exists idx_business_financials_profile on public.business_financials(profile_id);
create index if not exists idx_business_financials_status on public.business_financials(status);
alter table public.business_financials enable row level security;
create policy "business_financials_admin_all" on public.business_financials for all using (public.is_admin()) with check (public.is_admin());
create policy "business_financials_own_select" on public.business_financials for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_financials_own_insert" on public.business_financials for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_financials_own_update" on public.business_financials for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_monthly_metrics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_monthly_metrics_business on public.business_monthly_metrics(business_id);
create index if not exists idx_business_monthly_metrics_investor on public.business_monthly_metrics(investor_id);
create index if not exists idx_business_monthly_metrics_profile on public.business_monthly_metrics(profile_id);
create index if not exists idx_business_monthly_metrics_status on public.business_monthly_metrics(status);
alter table public.business_monthly_metrics enable row level security;
create policy "business_monthly_metrics_admin_all" on public.business_monthly_metrics for all using (public.is_admin()) with check (public.is_admin());
create policy "business_monthly_metrics_own_select" on public.business_monthly_metrics for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_monthly_metrics_own_insert" on public.business_monthly_metrics for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_monthly_metrics_own_update" on public.business_monthly_metrics for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_valuations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_valuations_business on public.business_valuations(business_id);
create index if not exists idx_business_valuations_investor on public.business_valuations(investor_id);
create index if not exists idx_business_valuations_profile on public.business_valuations(profile_id);
create index if not exists idx_business_valuations_status on public.business_valuations(status);
alter table public.business_valuations enable row level security;
create policy "business_valuations_admin_all" on public.business_valuations for all using (public.is_admin()) with check (public.is_admin());
create policy "business_valuations_own_select" on public.business_valuations for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_valuations_own_insert" on public.business_valuations for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_valuations_own_update" on public.business_valuations for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.valuation_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_valuation_rules_business on public.valuation_rules(business_id);
create index if not exists idx_valuation_rules_investor on public.valuation_rules(investor_id);
create index if not exists idx_valuation_rules_profile on public.valuation_rules(profile_id);
create index if not exists idx_valuation_rules_status on public.valuation_rules(status);
alter table public.valuation_rules enable row level security;
create policy "valuation_rules_admin_all" on public.valuation_rules for all using (public.is_admin()) with check (public.is_admin());
create policy "valuation_rules_own_select" on public.valuation_rules for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "valuation_rules_own_insert" on public.valuation_rules for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "valuation_rules_own_update" on public.valuation_rules for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.valuation_rule_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_valuation_rule_versions_business on public.valuation_rule_versions(business_id);
create index if not exists idx_valuation_rule_versions_investor on public.valuation_rule_versions(investor_id);
create index if not exists idx_valuation_rule_versions_profile on public.valuation_rule_versions(profile_id);
create index if not exists idx_valuation_rule_versions_status on public.valuation_rule_versions(status);
alter table public.valuation_rule_versions enable row level security;
create policy "valuation_rule_versions_admin_all" on public.valuation_rule_versions for all using (public.is_admin()) with check (public.is_admin());
create policy "valuation_rule_versions_own_select" on public.valuation_rule_versions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "valuation_rule_versions_own_insert" on public.valuation_rule_versions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "valuation_rule_versions_own_update" on public.valuation_rule_versions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_data_sources_business on public.data_sources(business_id);
create index if not exists idx_data_sources_investor on public.data_sources(investor_id);
create index if not exists idx_data_sources_profile on public.data_sources(profile_id);
create index if not exists idx_data_sources_status on public.data_sources(status);
alter table public.data_sources enable row level security;
create policy "data_sources_admin_all" on public.data_sources for all using (public.is_admin()) with check (public.is_admin());
create policy "data_sources_own_select" on public.data_sources for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "data_sources_own_insert" on public.data_sources for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "data_sources_own_update" on public.data_sources for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.data_confidence_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_data_confidence_events_business on public.data_confidence_events(business_id);
create index if not exists idx_data_confidence_events_investor on public.data_confidence_events(investor_id);
create index if not exists idx_data_confidence_events_profile on public.data_confidence_events(profile_id);
create index if not exists idx_data_confidence_events_status on public.data_confidence_events(status);
alter table public.data_confidence_events enable row level security;
create policy "data_confidence_events_admin_all" on public.data_confidence_events for all using (public.is_admin()) with check (public.is_admin());
create policy "data_confidence_events_own_select" on public.data_confidence_events for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "data_confidence_events_own_insert" on public.data_confidence_events for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "data_confidence_events_own_update" on public.data_confidence_events for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_quality_scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_quality_scores_business on public.business_quality_scores(business_id);
create index if not exists idx_business_quality_scores_investor on public.business_quality_scores(investor_id);
create index if not exists idx_business_quality_scores_profile on public.business_quality_scores(profile_id);
create index if not exists idx_business_quality_scores_status on public.business_quality_scores(status);
alter table public.business_quality_scores enable row level security;
create policy "business_quality_scores_admin_all" on public.business_quality_scores for all using (public.is_admin()) with check (public.is_admin());
create policy "business_quality_scores_own_select" on public.business_quality_scores for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_quality_scores_own_insert" on public.business_quality_scores for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_quality_scores_own_update" on public.business_quality_scores for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_quality_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_quality_items_business on public.business_quality_items(business_id);
create index if not exists idx_business_quality_items_investor on public.business_quality_items(investor_id);
create index if not exists idx_business_quality_items_profile on public.business_quality_items(profile_id);
create index if not exists idx_business_quality_items_status on public.business_quality_items(status);
alter table public.business_quality_items enable row level security;
create policy "business_quality_items_admin_all" on public.business_quality_items for all using (public.is_admin()) with check (public.is_admin());
create policy "business_quality_items_own_select" on public.business_quality_items for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_quality_items_own_insert" on public.business_quality_items for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_quality_items_own_update" on public.business_quality_items for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_change_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_change_requests_business on public.business_change_requests(business_id);
create index if not exists idx_business_change_requests_investor on public.business_change_requests(investor_id);
create index if not exists idx_business_change_requests_profile on public.business_change_requests(profile_id);
create index if not exists idx_business_change_requests_status on public.business_change_requests(status);
alter table public.business_change_requests enable row level security;
create policy "business_change_requests_admin_all" on public.business_change_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "business_change_requests_own_select" on public.business_change_requests for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_change_requests_own_insert" on public.business_change_requests for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_change_requests_own_update" on public.business_change_requests for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_reviews_business on public.business_reviews(business_id);
create index if not exists idx_business_reviews_investor on public.business_reviews(investor_id);
create index if not exists idx_business_reviews_profile on public.business_reviews(profile_id);
create index if not exists idx_business_reviews_status on public.business_reviews(status);
alter table public.business_reviews enable row level security;
create policy "business_reviews_admin_all" on public.business_reviews for all using (public.is_admin()) with check (public.is_admin());
create policy "business_reviews_own_select" on public.business_reviews for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_reviews_own_insert" on public.business_reviews for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_reviews_own_update" on public.business_reviews for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.business_watchers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_watchers_business on public.business_watchers(business_id);
create index if not exists idx_business_watchers_investor on public.business_watchers(investor_id);
create index if not exists idx_business_watchers_profile on public.business_watchers(profile_id);
create index if not exists idx_business_watchers_status on public.business_watchers(status);
alter table public.business_watchers enable row level security;
create policy "business_watchers_admin_all" on public.business_watchers for all using (public.is_admin()) with check (public.is_admin());
create policy "business_watchers_own_select" on public.business_watchers for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "business_watchers_own_insert" on public.business_watchers for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "business_watchers_own_update" on public.business_watchers for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.investor_criteria_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_investor_criteria_versions_business on public.investor_criteria_versions(business_id);
create index if not exists idx_investor_criteria_versions_investor on public.investor_criteria_versions(investor_id);
create index if not exists idx_investor_criteria_versions_profile on public.investor_criteria_versions(profile_id);
create index if not exists idx_investor_criteria_versions_status on public.investor_criteria_versions(status);
alter table public.investor_criteria_versions enable row level security;
create policy "investor_criteria_versions_admin_all" on public.investor_criteria_versions for all using (public.is_admin()) with check (public.is_admin());
create policy "investor_criteria_versions_own_select" on public.investor_criteria_versions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "investor_criteria_versions_own_insert" on public.investor_criteria_versions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "investor_criteria_versions_own_update" on public.investor_criteria_versions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.investor_recommendations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_investor_recommendations_business on public.investor_recommendations(business_id);
create index if not exists idx_investor_recommendations_investor on public.investor_recommendations(investor_id);
create index if not exists idx_investor_recommendations_profile on public.investor_recommendations(profile_id);
create index if not exists idx_investor_recommendations_status on public.investor_recommendations(status);
alter table public.investor_recommendations enable row level security;
create policy "investor_recommendations_admin_all" on public.investor_recommendations for all using (public.is_admin()) with check (public.is_admin());
create policy "investor_recommendations_own_select" on public.investor_recommendations for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "investor_recommendations_own_insert" on public.investor_recommendations for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "investor_recommendations_own_update" on public.investor_recommendations for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.match_scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_match_scores_business on public.match_scores(business_id);
create index if not exists idx_match_scores_investor on public.match_scores(investor_id);
create index if not exists idx_match_scores_profile on public.match_scores(profile_id);
create index if not exists idx_match_scores_status on public.match_scores(status);
alter table public.match_scores enable row level security;
create policy "match_scores_admin_all" on public.match_scores for all using (public.is_admin()) with check (public.is_admin());
create policy "match_scores_own_select" on public.match_scores for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "match_scores_own_insert" on public.match_scores for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "match_scores_own_update" on public.match_scores for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.match_explanations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_match_explanations_business on public.match_explanations(business_id);
create index if not exists idx_match_explanations_investor on public.match_explanations(investor_id);
create index if not exists idx_match_explanations_profile on public.match_explanations(profile_id);
create index if not exists idx_match_explanations_status on public.match_explanations(status);
alter table public.match_explanations enable row level security;
create policy "match_explanations_admin_all" on public.match_explanations for all using (public.is_admin()) with check (public.is_admin());
create policy "match_explanations_own_select" on public.match_explanations for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "match_explanations_own_insert" on public.match_explanations for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "match_explanations_own_update" on public.match_explanations for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_proposal_events_business on public.proposal_events(business_id);
create index if not exists idx_proposal_events_investor on public.proposal_events(investor_id);
create index if not exists idx_proposal_events_profile on public.proposal_events(profile_id);
create index if not exists idx_proposal_events_status on public.proposal_events(status);
alter table public.proposal_events enable row level security;
create policy "proposal_events_admin_all" on public.proposal_events for all using (public.is_admin()) with check (public.is_admin());
create policy "proposal_events_own_select" on public.proposal_events for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "proposal_events_own_insert" on public.proposal_events for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "proposal_events_own_update" on public.proposal_events for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.proposal_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_proposal_documents_business on public.proposal_documents(business_id);
create index if not exists idx_proposal_documents_investor on public.proposal_documents(investor_id);
create index if not exists idx_proposal_documents_profile on public.proposal_documents(profile_id);
create index if not exists idx_proposal_documents_status on public.proposal_documents(status);
alter table public.proposal_documents enable row level security;
create policy "proposal_documents_admin_all" on public.proposal_documents for all using (public.is_admin()) with check (public.is_admin());
create policy "proposal_documents_own_select" on public.proposal_documents for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "proposal_documents_own_insert" on public.proposal_documents for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "proposal_documents_own_update" on public.proposal_documents for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_connection_requests_business on public.connection_requests(business_id);
create index if not exists idx_connection_requests_investor on public.connection_requests(investor_id);
create index if not exists idx_connection_requests_profile on public.connection_requests(profile_id);
create index if not exists idx_connection_requests_status on public.connection_requests(status);
alter table public.connection_requests enable row level security;
create policy "connection_requests_admin_all" on public.connection_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "connection_requests_own_select" on public.connection_requests for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "connection_requests_own_insert" on public.connection_requests for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "connection_requests_own_update" on public.connection_requests for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.data_request_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_data_request_items_business on public.data_request_items(business_id);
create index if not exists idx_data_request_items_investor on public.data_request_items(investor_id);
create index if not exists idx_data_request_items_profile on public.data_request_items(profile_id);
create index if not exists idx_data_request_items_status on public.data_request_items(status);
alter table public.data_request_items enable row level security;
create policy "data_request_items_admin_all" on public.data_request_items for all using (public.is_admin()) with check (public.is_admin());
create policy "data_request_items_own_select" on public.data_request_items for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "data_request_items_own_insert" on public.data_request_items for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "data_request_items_own_update" on public.data_request_items for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_alerts_business on public.alerts(business_id);
create index if not exists idx_alerts_investor on public.alerts(investor_id);
create index if not exists idx_alerts_profile on public.alerts(profile_id);
create index if not exists idx_alerts_status on public.alerts(status);
alter table public.alerts enable row level security;
create policy "alerts_admin_all" on public.alerts for all using (public.is_admin()) with check (public.is_admin());
create policy "alerts_own_select" on public.alerts for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "alerts_own_insert" on public.alerts for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "alerts_own_update" on public.alerts for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_alert_subscriptions_business on public.alert_subscriptions(business_id);
create index if not exists idx_alert_subscriptions_investor on public.alert_subscriptions(investor_id);
create index if not exists idx_alert_subscriptions_profile on public.alert_subscriptions(profile_id);
create index if not exists idx_alert_subscriptions_status on public.alert_subscriptions(status);
alter table public.alert_subscriptions enable row level security;
create policy "alert_subscriptions_admin_all" on public.alert_subscriptions for all using (public.is_admin()) with check (public.is_admin());
create policy "alert_subscriptions_own_select" on public.alert_subscriptions for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "alert_subscriptions_own_insert" on public.alert_subscriptions for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "alert_subscriptions_own_update" on public.alert_subscriptions for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_email_templates_business on public.email_templates(business_id);
create index if not exists idx_email_templates_investor on public.email_templates(investor_id);
create index if not exists idx_email_templates_profile on public.email_templates(profile_id);
create index if not exists idx_email_templates_status on public.email_templates(status);
alter table public.email_templates enable row level security;
create policy "email_templates_admin_all" on public.email_templates for all using (public.is_admin()) with check (public.is_admin());
create policy "email_templates_own_select" on public.email_templates for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "email_templates_own_insert" on public.email_templates for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "email_templates_own_update" on public.email_templates for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_email_queue_business on public.email_queue(business_id);
create index if not exists idx_email_queue_investor on public.email_queue(investor_id);
create index if not exists idx_email_queue_profile on public.email_queue(profile_id);
create index if not exists idx_email_queue_status on public.email_queue(status);
alter table public.email_queue enable row level security;
create policy "email_queue_admin_all" on public.email_queue for all using (public.is_admin()) with check (public.is_admin());
create policy "email_queue_own_select" on public.email_queue for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "email_queue_own_insert" on public.email_queue for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "email_queue_own_update" on public.email_queue for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_notifications_business on public.notifications(business_id);
create index if not exists idx_notifications_investor on public.notifications(investor_id);
create index if not exists idx_notifications_profile on public.notifications(profile_id);
create index if not exists idx_notifications_status on public.notifications(status);
alter table public.notifications enable row level security;
create policy "notifications_admin_all" on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "notifications_own_select" on public.notifications for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "notifications_own_insert" on public.notifications for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "notifications_own_update" on public.notifications for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_inbox_threads_business on public.inbox_threads(business_id);
create index if not exists idx_inbox_threads_investor on public.inbox_threads(investor_id);
create index if not exists idx_inbox_threads_profile on public.inbox_threads(profile_id);
create index if not exists idx_inbox_threads_status on public.inbox_threads(status);
alter table public.inbox_threads enable row level security;
create policy "inbox_threads_admin_all" on public.inbox_threads for all using (public.is_admin()) with check (public.is_admin());
create policy "inbox_threads_own_select" on public.inbox_threads for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "inbox_threads_own_insert" on public.inbox_threads for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "inbox_threads_own_update" on public.inbox_threads for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_inbox_messages_business on public.inbox_messages(business_id);
create index if not exists idx_inbox_messages_investor on public.inbox_messages(investor_id);
create index if not exists idx_inbox_messages_profile on public.inbox_messages(profile_id);
create index if not exists idx_inbox_messages_status on public.inbox_messages(status);
alter table public.inbox_messages enable row level security;
create policy "inbox_messages_admin_all" on public.inbox_messages for all using (public.is_admin()) with check (public.is_admin());
create policy "inbox_messages_own_select" on public.inbox_messages for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "inbox_messages_own_insert" on public.inbox_messages for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "inbox_messages_own_update" on public.inbox_messages for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_audit_events_business on public.audit_events(business_id);
create index if not exists idx_audit_events_investor on public.audit_events(investor_id);
create index if not exists idx_audit_events_profile on public.audit_events(profile_id);
create index if not exists idx_audit_events_status on public.audit_events(status);
alter table public.audit_events enable row level security;
create policy "audit_events_admin_all" on public.audit_events for all using (public.is_admin()) with check (public.is_admin());
create policy "audit_events_own_select" on public.audit_events for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "audit_events_own_insert" on public.audit_events for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "audit_events_own_update" on public.audit_events for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_security_events_business on public.security_events(business_id);
create index if not exists idx_security_events_investor on public.security_events(investor_id);
create index if not exists idx_security_events_profile on public.security_events(profile_id);
create index if not exists idx_security_events_status on public.security_events(status);
alter table public.security_events enable row level security;
create policy "security_events_admin_all" on public.security_events for all using (public.is_admin()) with check (public.is_admin());
create policy "security_events_own_select" on public.security_events for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "security_events_own_insert" on public.security_events for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "security_events_own_update" on public.security_events for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_rate_limit_events_business on public.rate_limit_events(business_id);
create index if not exists idx_rate_limit_events_investor on public.rate_limit_events(investor_id);
create index if not exists idx_rate_limit_events_profile on public.rate_limit_events(profile_id);
create index if not exists idx_rate_limit_events_status on public.rate_limit_events(status);
alter table public.rate_limit_events enable row level security;
create policy "rate_limit_events_admin_all" on public.rate_limit_events for all using (public.is_admin()) with check (public.is_admin());
create policy "rate_limit_events_own_select" on public.rate_limit_events for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "rate_limit_events_own_insert" on public.rate_limit_events for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "rate_limit_events_own_update" on public.rate_limit_events for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_webhook_events_business on public.webhook_events(business_id);
create index if not exists idx_webhook_events_investor on public.webhook_events(investor_id);
create index if not exists idx_webhook_events_profile on public.webhook_events(profile_id);
create index if not exists idx_webhook_events_status on public.webhook_events(status);
alter table public.webhook_events enable row level security;
create policy "webhook_events_admin_all" on public.webhook_events for all using (public.is_admin()) with check (public.is_admin());
create policy "webhook_events_own_select" on public.webhook_events for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "webhook_events_own_insert" on public.webhook_events for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "webhook_events_own_update" on public.webhook_events for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_import_jobs_business on public.import_jobs(business_id);
create index if not exists idx_import_jobs_investor on public.import_jobs(investor_id);
create index if not exists idx_import_jobs_profile on public.import_jobs(profile_id);
create index if not exists idx_import_jobs_status on public.import_jobs(status);
alter table public.import_jobs enable row level security;
create policy "import_jobs_admin_all" on public.import_jobs for all using (public.is_admin()) with check (public.is_admin());
create policy "import_jobs_own_select" on public.import_jobs for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "import_jobs_own_insert" on public.import_jobs for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "import_jobs_own_update" on public.import_jobs for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_import_job_rows_business on public.import_job_rows(business_id);
create index if not exists idx_import_job_rows_investor on public.import_job_rows(investor_id);
create index if not exists idx_import_job_rows_profile on public.import_job_rows(profile_id);
create index if not exists idx_import_job_rows_status on public.import_job_rows(status);
alter table public.import_job_rows enable row level security;
create policy "import_job_rows_admin_all" on public.import_job_rows for all using (public.is_admin()) with check (public.is_admin());
create policy "import_job_rows_own_select" on public.import_job_rows for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "import_job_rows_own_insert" on public.import_job_rows for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "import_job_rows_own_update" on public.import_job_rows for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_admin_tasks_business on public.admin_tasks(business_id);
create index if not exists idx_admin_tasks_investor on public.admin_tasks(investor_id);
create index if not exists idx_admin_tasks_profile on public.admin_tasks(profile_id);
create index if not exists idx_admin_tasks_status on public.admin_tasks(status);
alter table public.admin_tasks enable row level security;
create policy "admin_tasks_admin_all" on public.admin_tasks for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_tasks_own_select" on public.admin_tasks for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "admin_tasks_own_insert" on public.admin_tasks for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "admin_tasks_own_update" on public.admin_tasks for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_admin_notes_business on public.admin_notes(business_id);
create index if not exists idx_admin_notes_investor on public.admin_notes(investor_id);
create index if not exists idx_admin_notes_profile on public.admin_notes(profile_id);
create index if not exists idx_admin_notes_status on public.admin_notes(status);
alter table public.admin_notes enable row level security;
create policy "admin_notes_admin_all" on public.admin_notes for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_notes_own_select" on public.admin_notes for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "admin_notes_own_insert" on public.admin_notes for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "admin_notes_own_update" on public.admin_notes for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


create table if not exists public.admin_review_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'active',
  title text,
  payload jsonb default '{}'::jsonb,
  visibility text default 'private',
  sort_order int default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_admin_review_queue_business on public.admin_review_queue(business_id);
create index if not exists idx_admin_review_queue_investor on public.admin_review_queue(investor_id);
create index if not exists idx_admin_review_queue_profile on public.admin_review_queue(profile_id);
create index if not exists idx_admin_review_queue_status on public.admin_review_queue(status);
alter table public.admin_review_queue enable row level security;
create policy "admin_review_queue_admin_all" on public.admin_review_queue for all using (public.is_admin()) with check (public.is_admin());
create policy "admin_review_queue_own_select" on public.admin_review_queue for select using (
  visibility = 'public' or created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()
);
create policy "admin_review_queue_own_insert" on public.admin_review_queue for insert with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());
create policy "admin_review_queue_own_update" on public.admin_review_queue for update using (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or profile_id = auth.uid() or public.is_admin());


-- Storage buckets: run once. If direct SQL is blocked, create these in Supabase UI or run scripts/seed.mjs.
insert into storage.buckets (id, name, public) values
('business-files-private', 'business-files-private', false),
('business-images-public', 'business-images-public', true)
on conflict (id) do nothing;

-- Storage policies. Safe to rerun if dropped manually first.
drop policy if exists "business_images_public_read" on storage.objects;
create policy "business_images_public_read" on storage.objects for select using (bucket_id = 'business-images-public');
drop policy if exists "business_images_authenticated_upload" on storage.objects;
create policy "business_images_authenticated_upload" on storage.objects for insert with check (bucket_id = 'business-images-public' and auth.role() = 'authenticated');
drop policy if exists "business_files_authenticated_upload" on storage.objects;
create policy "business_files_authenticated_upload" on storage.objects for insert with check (bucket_id = 'business-files-private' and auth.role() = 'authenticated');
drop policy if exists "business_files_owner_read" on storage.objects;
create policy "business_files_owner_read" on storage.objects for select using (bucket_id = 'business-files-private' and (owner = auth.uid() or public.is_admin()));
