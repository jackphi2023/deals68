-- Deals68 G2 — authorized image storage metadata move.
-- Applied after business_asset_security_phase_a.

create or replace function public.finalize_business_image_storage_move(
  image_uuid uuid,
  expected_bucket text,
  expected_path text,
  target_bucket text,
  target_path text,
  target_public_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_image public.business_images%rowtype;
  moved_image public.business_images%rowtype;
  caller_is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  caller_is_admin := public.is_admin();

  select *
  into current_image
  from public.business_images img
  where img.id = image_uuid
    and img.storage_bucket = expected_bucket
    and img.image_path = expected_path
  for update;

  if current_image.id is null then
    raise exception 'image_move_source_mismatch';
  end if;

  if not caller_is_admin and not (
    current_image.owner_id = auth.uid()
    and exists (
      select 1
      from public.businesses b
      where b.id = current_image.business_id
        and b.owner_id = auth.uid()
    )
  ) then
    raise exception 'image_move_not_owned';
  end if;

  if target_bucket not in (
    'business-images-private',
    'business-images-public'
  ) then
    raise exception 'invalid_target_bucket';
  end if;

  if split_part(target_path, '/', 1) <>
     current_image.business_id::text then
    raise exception 'invalid_target_path';
  end if;

  if not caller_is_admin
     and target_bucket <> 'business-images-private' then
    raise exception 'owner_can_only_move_image_to_private';
  end if;

  if target_bucket = 'business-images-private' then
    target_public_url := null;
  elsif nullif(trim(coalesce(target_public_url, '')), '') is null then
    raise exception 'public_image_requires_public_url';
  end if;

  update public.business_images
  set storage_bucket = target_bucket,
      image_path = target_path,
      public_url = target_public_url,
      public_visible = case
        when target_bucket = 'business-images-private' then false
        else public_visible
      end,
      is_sanitized = case
        when target_bucket = 'business-images-private' then false
        else is_sanitized
      end,
      is_hero = case
        when target_bucket = 'business-images-private' then false
        else is_hero
      end,
      review_status = case
        when target_bucket = 'business-images-private'
          then 'pending_admin_approval'
        else review_status
      end,
      updated_at = now()
  where id = image_uuid
  returning * into moved_image;

  return to_jsonb(moved_image);
end;
$$;

revoke all on function public.finalize_business_image_storage_move(
  uuid, text, text, text, text, text
) from public, anon;

grant execute on function public.finalize_business_image_storage_move(
  uuid, text, text, text, text, text
) to authenticated;
