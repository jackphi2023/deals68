-- Deals68 AI Report Phase 5: private PDF artifacts and atomic worker completion.
-- Source label for every generated/downloaded report: Deals68 AI Report.

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.ai_report_business_requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  audience public.d68_report_audience not null default 'business_owner',
  status text not null default 'completed',
  language text not null default 'vi',
  report_grade public.d68_report_grade not null default 'limited',
  generator_mode text not null default 'deterministic',
  source_label text not null default 'Deals68 AI Report',
  source_hash text,
  content_json jsonb not null default '{}'::jsonb,
  source_manifest_json jsonb not null default '[]'::jsonb,
  storage_bucket text not null default 'business-reports-private',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null,
  sha256 text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_reports_status_check check (status in ('completed','superseded','deleted')),
  constraint ai_reports_language_check check (language in ('vi','en')),
  constraint ai_reports_generator_mode_check check (generator_mode in ('deterministic','openai_assisted')),
  constraint ai_reports_source_label_check check (source_label = 'Deals68 AI Report'),
  constraint ai_reports_content_object_check check (jsonb_typeof(content_json) = 'object'),
  constraint ai_reports_manifest_array_check check (jsonb_typeof(source_manifest_json) = 'array'),
  constraint ai_reports_storage_bucket_check check (storage_bucket = 'business-reports-private'),
  constraint ai_reports_storage_path_check check (length(trim(storage_path)) between 1 and 500 and storage_path not like '%://%'),
  constraint ai_reports_file_name_check check (length(trim(file_name)) between 5 and 220 and lower(file_name) like '%.pdf'),
  constraint ai_reports_mime_type_check check (mime_type = 'application/pdf'),
  constraint ai_reports_size_check check (size_bytes > 0 and size_bytes <= 15728640),
  constraint ai_reports_sha256_check check (sha256 ~ '^[0-9a-f]{64}$')
);

create index if not exists ai_reports_business_generated_idx
  on public.ai_reports (business_id, generated_at desc)
  where status = 'completed';

create index if not exists ai_reports_actor_generated_idx
  on public.ai_reports (actor_profile_id, generated_at desc)
  where status = 'completed';

alter table public.ai_reports enable row level security;

drop policy if exists ai_reports_owner_select on public.ai_reports;
create policy ai_reports_owner_select
  on public.ai_reports
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.businesses b
      where b.id = ai_reports.business_id
        and b.owner_id = (select auth.uid())
    )
  );

drop policy if exists ai_reports_admin_all on public.ai_reports;
create policy ai_reports_admin_all
  on public.ai_reports
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on table public.ai_reports from public, anon;
grant select on table public.ai_reports to authenticated;
grant all on table public.ai_reports to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'business-reports-private',
  'business-reports-private',
  false,
  15728640,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_reports_private_admin_select on storage.objects;
create policy business_reports_private_admin_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'business-reports-private'
    and (select public.is_admin())
  );

create or replace function public.d68_finalize_business_report(
  p_request_id uuid,
  p_report_id uuid,
  p_language text,
  p_report_grade public.d68_report_grade,
  p_generator_mode text,
  p_source_hash text,
  p_content_json jsonb,
  p_source_manifest_json jsonb,
  p_storage_path text,
  p_file_name text,
  p_size_bytes bigint,
  p_sha256 text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_is_admin boolean := coalesce((select public.is_admin()), false);
  v_request public.ai_report_business_requests%rowtype;
  v_report public.ai_reports%rowtype;
begin
  if not v_is_service and not v_is_admin then
    raise exception 'report_finalize_denied' using errcode = '42501';
  end if;

  if p_report_id is null or p_request_id is null then
    raise exception 'report_finalize_id_required' using errcode = '22004';
  end if;

  if p_language not in ('vi','en') then
    raise exception 'report_language_invalid' using errcode = '22023';
  end if;

  if p_generator_mode not in ('deterministic','openai_assisted') then
    raise exception 'report_generator_mode_invalid' using errcode = '22023';
  end if;

  if p_content_json is null or jsonb_typeof(p_content_json) <> 'object' then
    raise exception 'report_content_must_be_object' using errcode = '22023';
  end if;

  if p_source_manifest_json is null or jsonb_typeof(p_source_manifest_json) <> 'array' then
    raise exception 'report_manifest_must_be_array' using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'report_metadata_must_be_object' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('d68-report-finalize:' || p_request_id::text, 0));

  select r.*
    into v_report
  from public.ai_reports r
  where r.request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'completed', true,
      'idempotent', true,
      'request_id', p_request_id,
      'report_id', v_report.id,
      'business_id', v_report.business_id,
      'generated_at', v_report.generated_at,
      'source_label', v_report.source_label,
      'storage_bucket', v_report.storage_bucket,
      'storage_path', v_report.storage_path,
      'file_name', v_report.file_name
    );
  end if;

  select r.*
    into v_request
  from public.ai_report_business_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'report_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'reserved' then
    raise exception 'report_request_not_reserved' using errcode = '55000';
  end if;

  insert into public.ai_reports (
    id,
    request_id,
    business_id,
    actor_profile_id,
    audience,
    status,
    language,
    report_grade,
    generator_mode,
    source_label,
    source_hash,
    content_json,
    source_manifest_json,
    storage_bucket,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    sha256,
    generated_at
  )
  values (
    p_report_id,
    p_request_id,
    v_request.business_id,
    v_request.actor_profile_id,
    'business_owner',
    'completed',
    p_language,
    p_report_grade,
    p_generator_mode,
    'Deals68 AI Report',
    p_source_hash,
    p_content_json,
    p_source_manifest_json,
    'business-reports-private',
    p_storage_path,
    p_file_name,
    'application/pdf',
    p_size_bytes,
    lower(p_sha256),
    now()
  )
  returning * into v_report;

  update public.ai_report_business_requests
  set status = 'completed',
      report_id = v_report.id,
      completed_at = now(),
      metadata = metadata || p_metadata || jsonb_build_object(
        'pdf_bucket', v_report.storage_bucket,
        'pdf_path', v_report.storage_path,
        'file_name', v_report.file_name,
        'mime_type', v_report.mime_type,
        'size_bytes', v_report.size_bytes,
        'sha256', v_report.sha256,
        'language', v_report.language,
        'report_grade', v_report.report_grade,
        'generator_mode', v_report.generator_mode,
        'source_label', v_report.source_label,
        'source_hash', v_report.source_hash,
        'generated_at', v_report.generated_at
      ),
      updated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'completed', true,
    'idempotent', false,
    'request_id', p_request_id,
    'report_id', v_report.id,
    'business_id', v_report.business_id,
    'generated_at', v_report.generated_at,
    'source_label', v_report.source_label,
    'storage_bucket', v_report.storage_bucket,
    'storage_path', v_report.storage_path,
    'file_name', v_report.file_name,
    'next_allowed_at', v_report.generated_at + interval '60 minutes',
    'rate_limit_minutes', 60
  );
end;
$$;

create or replace function public.d68_fail_business_report_request(
  p_request_id uuid,
  p_error_code text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_is_admin boolean := coalesce((select public.is_admin()), false);
  v_request public.ai_report_business_requests%rowtype;
begin
  if not v_is_service and not v_is_admin then
    raise exception 'report_failure_update_denied' using errcode = '42501';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'report_failure_metadata_must_be_object' using errcode = '22023';
  end if;

  select r.*
    into v_request
  from public.ai_report_business_requests r
  where r.id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('updated', false, 'reason', 'NOT_FOUND');
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object('updated', false, 'reason', 'ALREADY_COMPLETED');
  end if;

  update public.ai_report_business_requests
  set status = 'failed',
      failed_at = now(),
      error_code = left(coalesce(nullif(trim(p_error_code), ''), 'REPORT_WORKER_FAILED'), 120),
      metadata = metadata || p_metadata,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  return jsonb_build_object(
    'updated', true,
    'request_id', v_request.id,
    'business_id', v_request.business_id,
    'status', v_request.status,
    'error_code', v_request.error_code,
    'failed_at', v_request.failed_at
  );
end;
$$;

create or replace function public.d68_get_latest_business_report(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_report public.ai_reports%rowtype;
begin
  v_business := public.d68_ai_report_assert_business_access(p_business_id);

  select r.*
    into v_report
  from public.ai_reports r
  where r.business_id = p_business_id
    and r.status = 'completed'
  order by r.generated_at desc, r.id desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_report.id,
    'request_id', v_report.request_id,
    'business_id', v_report.business_id,
    'language', v_report.language,
    'report_grade', v_report.report_grade,
    'generator_mode', v_report.generator_mode,
    'source_label', v_report.source_label,
    'source_hash', v_report.source_hash,
    'file_name', v_report.file_name,
    'mime_type', v_report.mime_type,
    'size_bytes', v_report.size_bytes,
    'sha256', v_report.sha256,
    'generated_at', v_report.generated_at,
    'download_available', true
  );
end;
$$;

revoke all on function public.d68_finalize_business_report(uuid,uuid,text,public.d68_report_grade,text,text,jsonb,jsonb,text,text,bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.d68_finalize_business_report(uuid,uuid,text,public.d68_report_grade,text,text,jsonb,jsonb,text,text,bigint,text,jsonb) to service_role;

revoke all on function public.d68_fail_business_report_request(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.d68_fail_business_report_request(uuid,text,jsonb) to service_role;

revoke all on function public.d68_get_latest_business_report(uuid) from public, anon;
grant execute on function public.d68_get_latest_business_report(uuid) to authenticated, service_role;

comment on table public.ai_reports is
  'Completed private Business PDF artifacts. Every report is branded with source_label = Deals68 AI Report.';

comment on function public.d68_finalize_business_report is
  'Atomically records a private PDF artifact and completes its reserved request. Service role only.';

comment on function public.d68_get_latest_business_report is
  'Returns safe metadata for the latest completed Business report; no private storage path is exposed.';
