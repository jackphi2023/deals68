-- Deals68 G2 Phase B — enforce private image upload after main cutover.
-- Run only after main and beta-reference both use business-images-private
-- for new pending uploads and all legacy pending public images are migrated.

begin;

do $$
begin
  if exists (
    select 1
    from public.business_images
    where storage_bucket = 'business-images-public'
      and not (
        public_visible is true
        and is_sanitized is true
        and review_status = 'approved'
      )
  ) then
    raise exception
      'Legacy pending/hidden images still exist in public storage. Run Admin migration first.';
  end if;
end
$$;

-- Remove old compatibility policies.
drop policy if exists "authenticated upload business images"
on storage.objects;

drop policy if exists "public read business images"
on storage.objects;

-- New rows must default to the private pending bucket.
alter table public.business_images
  alter column storage_bucket set default 'business-images-private';

commit;
