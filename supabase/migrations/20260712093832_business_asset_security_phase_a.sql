-- Deals68 G2 Phase A — Business asset storage and deletion security.
-- Backward compatible with the current main branch:
-- old clients may still upload images to business-images-public until Phase B.

create extension if not exists pgcrypto;

alter table public.business_images
  add column if not exists storage_bucket text;

update public.business_images
set storage_bucket = 'business-images-public'
where storage_bucket is null or btrim(storage_bucket) = '';

alter table public.business_images
  alter column storage_bucket set default 'business-images-public';

alter table public.business_images
  alter column storage_bucket set not null;

alter table public.business_images
  drop constraint if exists business_images_storage_bucket_check;

alter table public.business_images
  add constraint business_images_storage_bucket_check
  check (storage_bucket in ('business-images-public', 'business-images-private'));

-- Preserve currently displayed legacy assets by normalizing their review status.
update public.business_images
set review_status = 'approved',
    updated_at = now()
where public_visible is true
  and is_sanitized is true
  and coalesce(review_status, '') <> 'approved';

update public.business_images
set is_hero = false,
    updated_at = now()
where not (public_visible is true and is_sanitized is true and review_status = 'approved')
  and is_hero is true;

update public.business_files
set review_status = 'approved',
    updated_at = now()
where public_visible is true
  and coalesce(review_status, '') <> 'approved';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'business-images-private',
  'business-images-private',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set file_size_limit = 52428800
where id = 'business-files-private';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'business-images-public';

create or replace function public.protect_business_file_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null
       or new.owner_id is distinct from auth.uid()
       or not exists (
         select 1
         from public.businesses b
         where b.id = new.business_id
           and b.owner_id = auth.uid()
       ) then
      raise exception 'business_file_insert_not_owned';
    end if;

    new.public_visible := false;
    new.review_status := 'pending_admin_approval';
    return new;
  end if;

  if old.owner_id is distinct from auth.uid() then
    raise exception 'business_file_update_not_owned';
  end if;

  if new.id is distinct from old.id
     or new.business_id is distinct from old.business_id
     or new.owner_id is distinct from old.owner_id
     or new.file_name is distinct from old.file_name
     or new.file_path is distinct from old.file_path
     or new.file_type is distinct from old.file_type
     or new.size_bytes is distinct from old.size_bytes
     or new.client_upload_id is distinct from old.client_upload_id then
    raise exception 'protected_business_file_field';
  end if;

  if new.public_visible is distinct from old.public_visible
     or new.review_status is distinct from old.review_status then
    raise exception 'business_file_approval_field_admin_only';
  end if;

  if new.display_name is distinct from old.display_name
     or new.category is distinct from old.category
     or new.privacy_level is distinct from old.privacy_level then
    new.public_visible := false;
    new.review_status := 'pending_admin_approval';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_protect_business_file_fields on public.business_files;
create trigger aaa_protect_business_file_fields
before insert or update on public.business_files
for each row
execute function public.protect_business_file_fields();

create or replace function public.protect_business_image_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null
       or new.owner_id is distinct from auth.uid()
       or not exists (
         select 1
         from public.businesses b
         where b.id = new.business_id
           and b.owner_id = auth.uid()
       ) then
      raise exception 'business_image_insert_not_owned';
    end if;

    new.public_visible := false;
    new.is_sanitized := false;
    new.is_hero := false;
    new.review_status := 'pending_admin_approval';
    return new;
  end if;

  if old.owner_id is distinct from auth.uid() then
    raise exception 'business_image_update_not_owned';
  end if;

  if new.id is distinct from old.id
     or new.business_id is distinct from old.business_id
     or new.owner_id is distinct from old.owner_id
     or new.image_path is distinct from old.image_path
     or new.public_url is distinct from old.public_url
     or new.storage_bucket is distinct from old.storage_bucket
     or new.client_upload_id is distinct from old.client_upload_id then
    raise exception 'protected_business_image_storage_field';
  end if;

  if new.public_visible is distinct from old.public_visible
     or new.is_sanitized is distinct from old.is_sanitized
     or new.is_hero is distinct from old.is_hero
     or new.review_status is distinct from old.review_status
     or new.sort_order is distinct from old.sort_order then
    raise exception 'business_image_approval_field_admin_only';
  end if;

  if new.title is distinct from old.title
     or new.display_title is distinct from old.display_title then
    new.public_visible := false;
    new.is_sanitized := false;
    new.is_hero := false;
    new.review_status := 'pending_admin_approval';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_protect_business_image_fields on public.business_images;
create trigger aaa_protect_business_image_fields
before insert or update on public.business_images
for each row
execute function public.protect_business_image_fields();

-- Tighten table-level asset policies.
drop policy if exists "files insert owner/admin" on public.business_files;
drop policy if exists "files readable to owner investor connected or admin" on public.business_files;
drop policy if exists "files update owner/admin" on public.business_files;
drop policy if exists "files delete owner/admin" on public.business_files;

create policy "files insert owned business or admin"
on public.business_files
for insert
to authenticated
with check (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.businesses b
      where b.id = business_files.business_id
        and b.owner_id = auth.uid()
    )
  )
);

create policy "files select owner admin or approved connected"
on public.business_files
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_admin()
  or (
    public_visible is true
    and review_status = 'approved'
    and exists (
      select 1
      from public.proposals p
      join public.investors i on i.id = p.investor_id
      where p.business_id = business_files.business_id
        and i.owner_id = auth.uid()
        and p.status in ('approved'::public.proposal_status, 'connected'::public.proposal_status)
    )
  )
);

create policy "files update owner or admin"
on public.business_files
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "files delete owner or admin"
on public.business_files
for delete
to authenticated
using (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.businesses b
      where b.id = business_files.business_id
        and b.owner_id = auth.uid()
    )
  )
);

drop policy if exists "images insert owner/admin" on public.business_images;
drop policy if exists "images public visible" on public.business_images;
drop policy if exists "images update owner/admin" on public.business_images;
drop policy if exists "images delete owner/admin" on public.business_images;
drop policy if exists "images select approved public" on public.business_images;
drop policy if exists "images select authenticated approved owner admin" on public.business_images;

create policy "images insert owned business or admin"
on public.business_images
for insert
to authenticated
with check (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.businesses b
      where b.id = business_images.business_id
        and b.owner_id = auth.uid()
    )
  )
);

create policy "images select approved public"
on public.business_images
for select
to anon
using (
  public_visible is true
  and is_sanitized is true
  and review_status = 'approved'
  and storage_bucket = 'business-images-public'
);

create policy "images select authenticated approved owner admin"
on public.business_images
for select
to authenticated
using (
  public.is_admin()
  or owner_id = auth.uid()
  or (
    public_visible is true
    and is_sanitized is true
    and review_status = 'approved'
    and storage_bucket = 'business-images-public'
  )
);

create policy "images update owner or admin"
on public.business_images
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "images delete owner or admin"
on public.business_images
for delete
to authenticated
using (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.businesses b
      where b.id = business_images.business_id
        and b.owner_id = auth.uid()
    )
  )
);

-- Replace overly broad private-file policies.
drop policy if exists "authenticated upload private business files" on storage.objects;
drop policy if exists "authenticated read own private business files" on storage.objects;
drop policy if exists "business file path access owner connected admin" on storage.objects;
drop policy if exists "business files insert owned folder" on storage.objects;
drop policy if exists "business files select owned or approved connected" on storage.objects;
drop policy if exists "business files update owned folder" on storage.objects;
drop policy if exists "business files delete owned folder" on storage.objects;

create policy "business files insert owned folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-files-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

create policy "business files select owned or approved connected"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-files-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.business_files f
      join public.proposals p on p.business_id = f.business_id
      join public.investors i on i.id = p.investor_id
      where f.file_path = storage.objects.name
        and f.public_visible is true
        and f.review_status = 'approved'
        and i.owner_id = auth.uid()
        and p.status in ('approved'::public.proposal_status, 'connected'::public.proposal_status)
    )
  )
);

create policy "business files update owned folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-files-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'business-files-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

create policy "business files delete owned folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-files-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

-- Private-image bucket policies.
drop policy if exists "business private images insert owned folder" on storage.objects;
drop policy if exists "business private images select owned folder" on storage.objects;
drop policy if exists "business private images update owned folder" on storage.objects;
drop policy if exists "business private images delete owned folder" on storage.objects;

create policy "business private images insert owned folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-images-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

create policy "business private images select owned folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-images-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

create policy "business private images update owned folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-images-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'business-images-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

create policy "business private images delete owned folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-images-private'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

-- Public-image authenticated management.
-- The legacy broad owner upload policy remains during Phase A for old main compatibility.
drop policy if exists "business public images select owner admin" on storage.objects;
drop policy if exists "business public images insert admin or restore" on storage.objects;
drop policy if exists "business public images update admin or restore" on storage.objects;
drop policy if exists "business public images delete owner admin" on storage.objects;

create policy "business public images select owner admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-images-public'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

create policy "business public images insert admin or restore"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-images-public'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.business_images img
      where img.image_path = storage.objects.name
        and img.storage_bucket = 'business-images-public'
        and img.public_visible is true
        and img.is_sanitized is true
        and img.review_status = 'approved'
        and img.owner_id = auth.uid()
    )
  )
);

create policy "business public images update admin or restore"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-images-public'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.business_images img
      where img.image_path = storage.objects.name
        and img.storage_bucket = 'business-images-public'
        and img.owner_id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'business-images-public'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.business_images img
      where img.image_path = storage.objects.name
        and img.storage_bucket = 'business-images-public'
        and img.owner_id = auth.uid()
    )
  )
);

create policy "business public images delete owner admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-images-public'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.owner_id = auth.uid()
    )
  )
);

create or replace function public.get_business_file_metadata_for_viewer(
  business_uuid uuid
)
returns table(
  id uuid,
  business_id uuid,
  display_name text,
  file_type text,
  size_bytes bigint,
  category text,
  privacy_level text,
  public_visible boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    f.id,
    f.business_id,
    f.display_name,
    f.file_type,
    f.size_bytes,
    f.category,
    f.privacy_level,
    f.public_visible,
    f.created_at,
    f.updated_at
  from public.business_files f
  join public.businesses b on b.id = f.business_id
  where f.business_id = business_uuid
    and f.public_visible is true
    and f.review_status = 'approved'
    and nullif(trim(coalesce(f.display_name, '')), '') is not null
    and b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
    and auth.uid() is not null
    and (
      public.is_admin()
      or b.owner_id = auth.uid()
      or exists (
        select 1
        from public.investors i
        where i.owner_id = auth.uid()
      )
    )
  order by f.created_at desc;
$$;

revoke all on function public.get_business_file_metadata_for_viewer(uuid)
from public, anon;
grant execute on function public.get_business_file_metadata_for_viewer(uuid)
to authenticated;

create or replace function public.get_business_asset_delete_target(
  asset_kind text,
  asset_uuid uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if lower(asset_kind) = 'file' then
    select jsonb_build_object(
      'kind', 'file',
      'id', f.id,
      'business_id', f.business_id,
      'bucket', 'business-files-private',
      'path', f.file_path
    )
    into result
    from public.business_files f
    where f.id = asset_uuid
      and (
        public.is_admin()
        or (
          f.owner_id = auth.uid()
          and exists (
            select 1 from public.businesses b
            where b.id = f.business_id
              and b.owner_id = auth.uid()
          )
        )
      );
  elsif lower(asset_kind) = 'image' then
    select jsonb_build_object(
      'kind', 'image',
      'id', img.id,
      'business_id', img.business_id,
      'bucket', img.storage_bucket,
      'path', img.image_path,
      'public_url', img.public_url,
      'is_hero', img.is_hero
    )
    into result
    from public.business_images img
    where img.id = asset_uuid
      and (
        public.is_admin()
        or (
          img.owner_id = auth.uid()
          and exists (
            select 1 from public.businesses b
            where b.id = img.business_id
              and b.owner_id = auth.uid()
          )
        )
      );
  else
    raise exception 'invalid_asset_kind';
  end if;

  if result is null then
    raise exception 'asset_not_found_or_not_owned';
  end if;

  return result;
end;
$$;

create or replace function public.delete_business_asset_record(
  asset_kind text,
  asset_uuid uuid,
  expected_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_file public.business_files%rowtype;
  deleted_image public.business_images%rowtype;
  fallback_id uuid;
  fallback_url text;
  snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if lower(asset_kind) = 'file' then
    delete from public.business_files f
    where f.id = asset_uuid
      and f.file_path = expected_path
      and (
        public.is_admin()
        or (
          f.owner_id = auth.uid()
          and exists (
            select 1 from public.businesses b
            where b.id = f.business_id
              and b.owner_id = auth.uid()
          )
        )
      )
    returning * into deleted_file;

    if deleted_file.id is null then
      raise exception 'asset_delete_failed';
    end if;

    return jsonb_build_object(
      'deleted_id', deleted_file.id,
      'kind', 'file',
      'business_id', deleted_file.business_id
    );
  end if;

  if lower(asset_kind) <> 'image' then
    raise exception 'invalid_asset_kind';
  end if;

  delete from public.business_images img
  where img.id = asset_uuid
    and img.image_path = expected_path
    and (
      public.is_admin()
      or (
        img.owner_id = auth.uid()
        and exists (
          select 1 from public.businesses b
          where b.id = img.business_id
            and b.owner_id = auth.uid()
        )
      )
    )
  returning * into deleted_image;

  if deleted_image.id is null then
    raise exception 'asset_delete_failed';
  end if;

  if deleted_image.is_hero is true
     or exists (
       select 1
       from public.businesses b
       where b.id = deleted_image.business_id
         and (
           b.hero_image_url is not distinct from deleted_image.public_url
           or b.image_url is not distinct from deleted_image.public_url
         )
     ) then
    select img.id, img.public_url
    into fallback_id, fallback_url
    from public.business_images img
    where img.business_id = deleted_image.business_id
      and img.public_visible is true
      and img.is_sanitized is true
      and img.review_status = 'approved'
      and img.storage_bucket = 'business-images-public'
    order by img.sort_order asc nulls last, img.created_at asc
    limit 1;

    update public.business_images
    set is_hero = (fallback_id is not null and id = fallback_id),
        updated_at = case
          when fallback_id is not null and id = fallback_id then now()
          else updated_at
        end
    where business_id = deleted_image.business_id;

    select coalesce(b.public_snapshot_json, '{}'::jsonb)
    into snapshot
    from public.businesses b
    where b.id = deleted_image.business_id
    for update;

    snapshot := jsonb_set(
      snapshot,
      '{hero_image_url}',
      coalesce(to_jsonb(fallback_url), 'null'::jsonb),
      true
    );
    snapshot := jsonb_set(
      snapshot,
      '{image_url}',
      coalesce(to_jsonb(fallback_url), 'null'::jsonb),
      true
    );

    update public.businesses
    set hero_image_url = fallback_url,
        image_url = fallback_url,
        public_snapshot_json = snapshot,
        public_version = coalesce(public_version, 0) + 1,
        updated_at = now()
    where id = deleted_image.business_id;
  end if;

  return jsonb_build_object(
    'deleted_id', deleted_image.id,
    'kind', 'image',
    'business_id', deleted_image.business_id,
    'fallback_hero_id', fallback_id,
    'fallback_hero_url', fallback_url
  );
end;
$$;

revoke all on function public.get_business_asset_delete_target(text, uuid)
from public, anon;
revoke all on function public.delete_business_asset_record(text, uuid, text)
from public, anon;

grant execute on function public.get_business_asset_delete_target(text, uuid)
to authenticated;
grant execute on function public.delete_business_asset_record(text, uuid, text)
to authenticated;

create or replace function public.approve_business_assets(
  business_uuid uuid,
  image_updates jsonb default '[]'::jsonb,
  file_updates jsonb default '[]'::jsonb,
  hero_image_uuid uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  affected integer;
  approved_images integer := 0;
  approved_files integer := 0;
  v_hero_id uuid := hero_image_uuid;
  v_hero_url text := null;
  v_snapshot jsonb;
  wants_public boolean;
  wants_sanitized boolean;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  perform 1 from public.businesses where id = business_uuid for update;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(coalesce(image_updates, '[]'::jsonb)) <> 'array' then
    raise exception 'image_updates must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(file_updates, '[]'::jsonb)) <> 'array' then
    raise exception 'file_updates must be a JSON array' using errcode = '22023';
  end if;

  for item in select value
    from jsonb_array_elements(coalesce(image_updates, '[]'::jsonb))
  loop
    wants_public := coalesce((item->>'public_visible')::boolean, false);
    wants_sanitized := coalesce((item->>'is_sanitized')::boolean, false);

    if wants_public and wants_sanitized and not exists (
      select 1
      from public.business_images img
      where img.id = (item->>'id')::uuid
        and img.business_id = business_uuid
        and img.storage_bucket = 'business-images-public'
        and nullif(trim(coalesce(img.public_url, '')), '') is not null
    ) then
      raise exception 'Approved image must be promoted to public storage first: %',
        item->>'id' using errcode = '22023';
    end if;

    update public.business_images
    set display_title = coalesce(
          nullif(trim(item->>'display_title'), ''),
          display_title,
          title
        ),
        public_visible = wants_public,
        is_sanitized = wants_sanitized,
        is_hero = false,
        review_status = case
          when wants_public and wants_sanitized then 'approved'
          else 'reviewed_hidden'
        end,
        admin_note = 'Admin reviewed image at ' || now()::text,
        updated_at = now()
    where id = (item->>'id')::uuid
      and business_id = business_uuid;

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Image does not belong to Business: %',
        item->>'id' using errcode = '22023';
    end if;

    approved_images := approved_images + affected;
  end loop;

  for item in select value
    from jsonb_array_elements(coalesce(file_updates, '[]'::jsonb))
  loop
    update public.business_files
    set display_name = coalesce(
          nullif(trim(item->>'display_name'), ''),
          display_name,
          file_name
        ),
        public_visible = coalesce((item->>'public_visible')::boolean, false),
        privacy_level = case
          when lower(coalesce(item->>'privacy_level', 'locked')) = 'public'
            then 'public'
          else 'locked'
        end,
        review_status = case
          when coalesce((item->>'public_visible')::boolean, false)
            then 'approved'
          else 'reviewed_hidden'
        end,
        admin_note = 'Admin reviewed file at ' || now()::text,
        updated_at = now()
    where id = (item->>'id')::uuid
      and business_id = business_uuid;

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'File does not belong to Business: %',
        item->>'id' using errcode = '22023';
    end if;

    approved_files := approved_files + affected;
  end loop;

  if v_hero_id is not null then
    select id, public_url
    into v_hero_id, v_hero_url
    from public.business_images
    where id = v_hero_id
      and business_id = business_uuid
      and public_visible is true
      and is_sanitized is true
      and review_status = 'approved'
      and storage_bucket = 'business-images-public';

    if not found then
      raise exception 'Hero image must be approved and in public storage'
        using errcode = '22023';
    end if;
  else
    select id, public_url
    into v_hero_id, v_hero_url
    from public.business_images
    where business_id = business_uuid
      and is_hero is true
      and public_visible is true
      and is_sanitized is true
      and review_status = 'approved'
      and storage_bucket = 'business-images-public'
    order by updated_at desc nulls last, created_at desc
    limit 1;

    if not found then
      select id, public_url
      into v_hero_id, v_hero_url
      from public.business_images
      where business_id = business_uuid
        and public_visible is true
        and is_sanitized is true
        and review_status = 'approved'
        and storage_bucket = 'business-images-public'
      order by sort_order asc nulls last, created_at asc
      limit 1;
    end if;
  end if;

  update public.business_images
  set is_hero = (v_hero_id is not null and id = v_hero_id),
      updated_at = case
        when v_hero_id is not null and id = v_hero_id then now()
        else updated_at
      end
  where business_id = business_uuid;

  select coalesce(public_snapshot_json, '{}'::jsonb)
  into v_snapshot
  from public.businesses
  where id = business_uuid;

  v_snapshot := jsonb_set(
    v_snapshot,
    '{hero_image_url}',
    coalesce(to_jsonb(v_hero_url), 'null'::jsonb),
    true
  );
  v_snapshot := jsonb_set(
    v_snapshot,
    '{image_url}',
    coalesce(to_jsonb(v_hero_url), 'null'::jsonb),
    true
  );

  update public.businesses
  set hero_image_url = v_hero_url,
      image_url = v_hero_url,
      public_snapshot_json = v_snapshot,
      public_version = coalesce(public_version, 0) + 1,
      last_approved_at = now(),
      last_approved_by = auth.uid(),
      updated_at = now()
  where id = business_uuid;

  return jsonb_build_object(
    'business_id', business_uuid,
    'approved_images', approved_images,
    'approved_files', approved_files,
    'hero_image_id', v_hero_id,
    'hero_image_url', v_hero_url
  );
end;
$$;

revoke all on function public.approve_business_assets(uuid, jsonb, jsonb, uuid)
from public, anon;
grant execute on function public.approve_business_assets(uuid, jsonb, jsonb, uuid)
to authenticated;
