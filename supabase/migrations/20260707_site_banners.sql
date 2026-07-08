
-- Deals68 Admin-managed site banners
-- placements: home_hero, home_promotion, listing_promotion

create table if not exists public.site_banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('home_hero','home_promotion','listing_promotion')),
  title text,
  image_url text not null,
  image_path text,
  link_url text,
  sort_order int not null default 1,
  lang_mode text not null default 'both' check (lang_mode in ('vi','en','both')),
  starts_at date not null default current_date,
  ends_at date,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_banners_public_idx on public.site_banners (placement, active, lang_mode, sort_order, starts_at, ends_at);

alter table public.site_banners enable row level security;

drop policy if exists "site banners public read" on public.site_banners;
create policy "site banners public read" on public.site_banners for select using (
  active = true
  and starts_at <= current_date
  and (ends_at is null or ends_at >= current_date)
);

drop policy if exists "site banners admin all" on public.site_banners;
create policy "site banners admin all" on public.site_banners for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-banners','site-banners', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']::text[])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']::text[];

drop policy if exists "site banners storage public read" on storage.objects;
create policy "site banners storage public read" on storage.objects for select using (bucket_id = 'site-banners');

drop policy if exists "site banners storage admin insert" on storage.objects;
create policy "site banners storage admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'site-banners' and public.is_admin_user());

drop policy if exists "site banners storage admin update" on storage.objects;
create policy "site banners storage admin update" on storage.objects for update to authenticated using (bucket_id = 'site-banners' and public.is_admin_user()) with check (bucket_id = 'site-banners' and public.is_admin_user());

drop policy if exists "site banners storage admin delete" on storage.objects;
create policy "site banners storage admin delete" on storage.objects for delete to authenticated using (bucket_id = 'site-banners' and public.is_admin_user());
