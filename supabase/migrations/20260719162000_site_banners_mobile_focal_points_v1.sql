-- Complete the responsive Hero banner schema expected by AdminBannerManager.
-- Promotion banners do not use these fields, but Hero desktop/mobile previews do.

alter table public.site_banners
  add column if not exists mobile_focal_x smallint not null default 50,
  add column if not exists mobile_focal_y smallint not null default 50;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_banners'::regclass
      and conname = 'site_banners_mobile_focal_x_range'
  ) then
    alter table public.site_banners
      add constraint site_banners_mobile_focal_x_range
      check (mobile_focal_x between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_banners'::regclass
      and conname = 'site_banners_mobile_focal_y_range'
  ) then
    alter table public.site_banners
      add constraint site_banners_mobile_focal_y_range
      check (mobile_focal_y between 0 and 100);
  end if;
end;
$constraints$;

comment on column public.site_banners.mobile_focal_x is
  'Mobile Hero horizontal focal point from 0 to 100.';
comment on column public.site_banners.mobile_focal_y is
  'Mobile Hero vertical focal point from 0 to 100.';

notify pgrst, 'reload schema';
