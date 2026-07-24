-- Deals68 Business Financial Access — Phase E stabilization.
-- Aligns Dataroom file metadata and private Storage reads with the canonical
-- Business-specific access-grant ledger. This migration never creates or
-- backfills a Dataroom grant and does not implement or bypass eNDA.

begin;

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
as $function$
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
    and (
      coalesce(auth.jwt()->>'role', '') = 'service_role'
      or public.is_admin()
      or b.owner_id = auth.uid()
      or exists (
        select 1
        from public.investors i
        join public.business_financial_access_grants g
          on g.investor_id = i.id
         and g.business_id = f.business_id
        where i.owner_id = auth.uid()
          and i.status::text in ('active', 'hidden')
          and g.status = 'active'
          and (g.expires_at is null or g.expires_at > now())
          and 'dataroom' = any(g.scopes)
      )
    )
  order by f.created_at desc;
$function$;

revoke all on function public.get_business_file_metadata_for_viewer(uuid)
from public, anon;
grant execute on function public.get_business_file_metadata_for_viewer(uuid)
to authenticated, service_role;

alter table public.business_files enable row level security;

drop policy if exists "files select owner admin or approved connected"
on public.business_files;
drop policy if exists "files select owner admin or active dataroom grant"
on public.business_files;
create policy "files select owner admin or active dataroom grant"
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
      from public.investors i
      join public.business_financial_access_grants g
        on g.investor_id = i.id
       and g.business_id = business_files.business_id
      where i.owner_id = auth.uid()
        and i.status::text in ('active', 'hidden')
        and g.status = 'active'
        and (g.expires_at is null or g.expires_at > now())
        and 'dataroom' = any(g.scopes)
    )
  )
);

create or replace function public.d68_get_business_dataroom_file_access(
  p_file_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  file_row public.business_files%rowtype;
  business_owner uuid;
  resolved_investor_id uuid;
  grant_row public.business_financial_access_grants%rowtype;
  access_source text;
begin
  if actor_uuid is null and not service_actor then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select f.*, b.owner_id
  into file_row, business_owner
  from public.business_files f
  join public.businesses b on b.id = f.business_id
  where f.id = p_file_id;

  if not found then
    raise exception 'Business file not found' using errcode = 'P0002';
  end if;

  if service_actor or public.is_admin() then
    access_source := 'admin';
  elsif business_owner = actor_uuid then
    access_source := 'owner';
  else
    select i.id
    into resolved_investor_id
    from public.investors i
    where i.owner_id = actor_uuid
      and i.status::text in ('active', 'hidden')
    order by i.created_at asc nulls last, i.id
    limit 1;

    if resolved_investor_id is null
       or file_row.public_visible is not true
       or file_row.review_status <> 'approved' then
      raise exception 'Dataroom access required' using errcode = '42501';
    end if;

    select g.*
    into grant_row
    from public.business_financial_access_grants g
    where g.business_id = file_row.business_id
      and g.investor_id = resolved_investor_id
      and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
      and 'dataroom' = any(g.scopes)
    order by g.granted_at desc, g.id
    limit 1;

    if not found then
      raise exception 'Dataroom access required' using errcode = '42501';
    end if;

    access_source := grant_row.source_type;
  end if;

  if actor_uuid is not null then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, detail
    ) values (
      actor_uuid,
      'access_business_dataroom_file',
      'business_file',
      file_row.id::text,
      jsonb_build_object(
        'business_id', file_row.business_id,
        'investor_id', resolved_investor_id,
        'file_id', file_row.id,
        'privacy_level', file_row.privacy_level,
        'access_source', access_source,
        'grant_id', grant_row.id,
        'grant_expires_at', grant_row.expires_at
      )
    );
  end if;

  return jsonb_build_object(
    'file_id', file_row.id,
    'business_id', file_row.business_id,
    'file_path', file_row.file_path,
    'file_name', file_row.file_name,
    'display_name', file_row.display_name,
    'file_type', file_row.file_type,
    'size_bytes', file_row.size_bytes,
    'access_source', access_source,
    'grant_id', grant_row.id,
    'expires_at', grant_row.expires_at
  );
end;
$function$;

revoke all on function public.d68_get_business_dataroom_file_access(uuid)
from public, anon;
grant execute on function public.d68_get_business_dataroom_file_access(uuid)
to authenticated, service_role;

comment on function public.d68_get_business_dataroom_file_access(uuid) is
  'Audited file-path gate. Investor access requires an active, unexpired Business-specific dataroom scope and an approved file. No grant is inferred from Proposal or financial_detail.';

do $storage_policy$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "business files select owned or approved connected" on storage.objects';
    execute 'drop policy if exists "business files select owner admin or active dataroom grant" on storage.objects';
    execute $policy$
      create policy "business files select owner admin or active dataroom grant"
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
            where b.id::text = (storage.foldername(objects.name))[1]
              and b.owner_id = auth.uid()
          )
          or exists (
            select 1
            from public.business_files f
            join public.investors i on i.owner_id = auth.uid()
            join public.business_financial_access_grants g
              on g.business_id = f.business_id
             and g.investor_id = i.id
            where f.file_path = objects.name
              and f.public_visible is true
              and f.review_status = 'approved'
              and i.status::text in ('active', 'hidden')
              and g.status = 'active'
              and (g.expires_at is null or g.expires_at > now())
              and 'dataroom' = any(g.scopes)
          )
        )
      )
    $policy$;
  end if;
end;
$storage_policy$;

-- Deliberately no INSERT/UPDATE into business_financial_access_grants.
-- Current production has no active Dataroom grants; eNDA/grant issuance remains a separate release.

commit;
