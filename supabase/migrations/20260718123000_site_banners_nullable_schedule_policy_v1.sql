-- Keep public banner visibility aligned with the application contract:
-- active banners may omit either schedule boundary.

drop policy if exists "site banners public read" on public.site_banners;

create policy "site banners public read"
on public.site_banners
for select
to public
using (
  active = true
  and (starts_at is null or starts_at <= current_date)
  and (ends_at is null or ends_at >= current_date)
);
