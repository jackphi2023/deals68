alter table if exists public.site_banners
  add column if not exists mobile_focal_x numeric;

alter table if exists public.site_banners
  add column if not exists mobile_focal_y numeric;

update public.site_banners
set
  mobile_focal_x = coalesce(mobile_focal_x, focal_x, 50),
  mobile_focal_y = coalesce(mobile_focal_y, focal_y, 50)
where placement = 'home_hero'
  and (mobile_focal_x is null or mobile_focal_y is null);

alter table if exists public.site_banners
  drop constraint if exists site_banners_mobile_focal_x_range;

alter table if exists public.site_banners
  add constraint site_banners_mobile_focal_x_range
  check (mobile_focal_x is null or mobile_focal_x between 0 and 100);

alter table if exists public.site_banners
  drop constraint if exists site_banners_mobile_focal_y_range;

alter table if exists public.site_banners
  add constraint site_banners_mobile_focal_y_range
  check (mobile_focal_y is null or mobile_focal_y between 0 and 100);

comment on column public.site_banners.mobile_focal_x is
  'Mobile hero focal point X from 0 to 100; falls back to focal_x when null.';

comment on column public.site_banners.mobile_focal_y is
  'Mobile hero focal point Y from 0 to 100; falls back to focal_y when null.';
