-- Deals68 G5 — responsive Home Hero fields.
-- This additive migration is backward-compatible with current main.

alter table public.site_banners
  add column if not exists mobile_image_url text,
  add column if not exists mobile_image_path text,
  add column if not exists focal_x smallint not null default 50,
  add column if not exists focal_y smallint not null default 50;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_banners_focal_x_range'
      and conrelid = 'public.site_banners'::regclass
  ) then
    alter table public.site_banners
      add constraint site_banners_focal_x_range
      check (focal_x between 0 and 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_banners_focal_y_range'
      and conrelid = 'public.site_banners'::regclass
  ) then
    alter table public.site_banners
      add constraint site_banners_focal_y_range
      check (focal_y between 0 and 100);
  end if;
end
$$;

comment on column public.site_banners.mobile_image_url is
  'Optional mobile-specific banner image URL, primarily for home_hero.';
comment on column public.site_banners.mobile_image_path is
  'Storage path for the optional mobile-specific banner image.';
comment on column public.site_banners.focal_x is
  'Horizontal object-position percentage from 0 to 100.';
comment on column public.site_banners.focal_y is
  'Vertical object-position percentage from 0 to 100.';
