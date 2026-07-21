-- Deals68 AI Report Phase 1 foundation.
-- Additive schema for file analysis, listing authority, preflight checks and alerts.
-- Missing / pending / insufficient broker authority is non-blocking and requires a report notice.

do $$ begin
  create type public.d68_file_processing_status as enum ('pending','processing','processed','unreadable','rejected','error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_entity_match_status as enum ('not_checked','match','probable_match','ambiguous','mismatch');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_listing_party_type as enum ('business_owner','legal_representative','asset_owner','authorized_broker','authorized_advisor','asset_operator','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_authority_verification_status as enum ('not_required','declared','missing','pending_review','verified','insufficient_scope','expired','rejected','entity_mismatch');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_report_access_policy as enum ('allow','allow_with_notice','block');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_report_gate_status as enum ('not_checked','pass','warning','blocked','review_required');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_report_grade as enum ('blocked','limited','full');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_report_audience as enum ('business_owner','investor','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_ai_report_alert_code as enum (
    'INSUFFICIENT_FINANCIAL_DATA','FILE_UNREADABLE','FILE_NOT_RELEVANT','FILE_ENTITY_MISMATCH',
    'DECLARED_DOCUMENT_CONFLICT','DOCUMENT_EXPIRED','BROKER_AUTHORITY_MISSING',
    'AUTHORITY_SCOPE_INSUFFICIENT','AUTHORITY_DOCUMENT_EXPIRED','OWNER_IDENTITY_MISMATCH',
    'ASSET_IDENTIFIER_MISMATCH','FORGERY_SUSPECT','ADMIN_REVIEW_REQUIRED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_ai_report_alert_severity as enum ('info','warning','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_ai_report_alert_status as enum ('open','acknowledged','resolved','dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.dataroom_file_processing (
  id uuid primary key default gen_random_uuid(),
  business_file_id uuid not null unique references public.business_files(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  parse_status public.d68_file_processing_status not null default 'pending',
  ocr_status public.d68_file_processing_status not null default 'pending',
  ocr_quality numeric(5,4),
  detected_document_type text,
  relevance_score numeric(5,4),
  detected_company_name text,
  detected_tax_id text,
  detected_representative text,
  detected_owner_name text,
  detected_asset_address text,
  detected_asset_identifier text,
  entity_match_status public.d68_entity_match_status not null default 'not_checked',
  entity_match_score numeric(5,4),
  mismatch_reasons jsonb not null default '[]'::jsonb,
  authority_document_type text,
  authority_principal text,
  authority_agent text,
  authority_scope jsonb not null default '{}'::jsonb,
  authority_valid_from date,
  authority_valid_until date,
  processing_version text,
  error_code text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dataroom_file_processing_ocr_quality_check check (ocr_quality is null or (ocr_quality >= 0 and ocr_quality <= 1)),
  constraint dataroom_file_processing_relevance_score_check check (relevance_score is null or (relevance_score >= 0 and relevance_score <= 1)),
  constraint dataroom_file_processing_entity_match_score_check check (entity_match_score is null or (entity_match_score >= 0 and entity_match_score <= 1)),
  constraint dataroom_file_processing_mismatch_reasons_array_check check (jsonb_typeof(mismatch_reasons) = 'array'),
  constraint dataroom_file_processing_authority_scope_object_check check (jsonb_typeof(authority_scope) = 'object'),
  constraint dataroom_file_processing_authority_dates_check check (authority_valid_from is null or authority_valid_until is null or authority_valid_until >= authority_valid_from)
);

create table if not exists public.business_listing_authority (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  listing_party_type public.d68_listing_party_type not null default 'business_owner',
  declared_owner_name text,
  declared_principal_name text,
  declared_agent_name text,
  declared_asset_name text,
  declared_asset_address text,
  verification_status public.d68_authority_verification_status not null default 'declared',
  verification_reasons jsonb not null default '[]'::jsonb,
  authority_document_ids uuid[] not null default '{}'::uuid[],
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  report_policy public.d68_report_access_policy generated always as (
    case
      when verification_status in ('expired','rejected','entity_mismatch') then 'block'::public.d68_report_access_policy
      when listing_party_type in ('authorized_broker','authorized_advisor','asset_operator','other')
       and verification_status in ('declared','missing','pending_review','insufficient_scope')
        then 'allow_with_notice'::public.d68_report_access_policy
      else 'allow'::public.d68_report_access_policy
    end
  ) stored,
  report_notice_vi text generated always as (
    case when listing_party_type in ('authorized_broker','authorized_advisor','asset_operator','other')
      and verification_status in ('declared','missing','pending_review','insufficient_scope')
      then 'Nhà đầu tư có thể yêu cầu Giấy ủy quyền có xác thực thì mới xúc tiến giao dịch tại Deals68.com.'
      else null end
  ) stored,
  report_notice_en text generated always as (
    case when listing_party_type in ('authorized_broker','authorized_advisor','asset_operator','other')
      and verification_status in ('declared','missing','pending_review','insufficient_scope')
      then 'Investors may require a duly authenticated authorization letter before proceeding with a transaction on Deals68.com.'
      else null end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_listing_authority_reasons_array_check check (jsonb_typeof(verification_reasons) = 'array')
);

create table if not exists public.ai_report_preflight_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  audience public.d68_report_audience not null default 'business_owner',
  data_gate_status public.d68_report_gate_status not null default 'not_checked',
  entity_gate_status public.d68_report_gate_status not null default 'not_checked',
  authority_gate_status public.d68_report_gate_status not null default 'not_checked',
  report_grade public.d68_report_grade not null default 'blocked',
  allow_report boolean not null default false,
  allow_valuation boolean not null default false,
  authority_notice_required boolean not null default false,
  authority_notice_vi text,
  authority_notice_en text,
  missing_items_json jsonb not null default '[]'::jsonb,
  warning_items_json jsonb not null default '[]'::jsonb,
  blocking_alerts_json jsonb not null default '[]'::jsonb,
  source_hash text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ai_report_preflight_missing_items_array_check check (jsonb_typeof(missing_items_json) = 'array'),
  constraint ai_report_preflight_warning_items_array_check check (jsonb_typeof(warning_items_json) = 'array'),
  constraint ai_report_preflight_blocking_alerts_array_check check (jsonb_typeof(blocking_alerts_json) = 'array')
);

create table if not exists public.ai_report_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  report_job_id uuid,
  business_file_id uuid references public.business_files(id) on delete set null,
  preflight_check_id uuid references public.ai_report_preflight_checks(id) on delete set null,
  alert_code public.d68_ai_report_alert_code not null,
  severity public.d68_ai_report_alert_severity not null default 'warning',
  status public.d68_ai_report_alert_status not null default 'open',
  title_vi text not null,
  title_en text not null,
  detail_json jsonb not null default '{}'::jsonb,
  blocks_report boolean not null default false,
  requires_admin_review boolean not null default false,
  visible_to_business boolean not null default true,
  requires_report_notice boolean generated always as (
    alert_code in ('BROKER_AUTHORITY_MISSING','AUTHORITY_SCOPE_INSUFFICIENT')
  ) stored,
  report_notice_vi text generated always as (
    case when alert_code in ('BROKER_AUTHORITY_MISSING','AUTHORITY_SCOPE_INSUFFICIENT')
      then 'Nhà đầu tư có thể yêu cầu Giấy ủy quyền có xác thực thì mới xúc tiến giao dịch tại Deals68.com.'
      else null end
  ) stored,
  report_notice_en text generated always as (
    case when alert_code in ('BROKER_AUTHORITY_MISSING','AUTHORITY_SCOPE_INSUFFICIENT')
      then 'Investors may require a duly authenticated authorization letter before proceeding with a transaction on Deals68.com.'
      else null end
  ) stored,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_report_alerts_detail_object_check check (jsonb_typeof(detail_json) = 'object'),
  constraint ai_report_alerts_authority_warning_non_blocking_check check (
    alert_code not in ('BROKER_AUTHORITY_MISSING','AUTHORITY_SCOPE_INSUFFICIENT') or blocks_report = false
  ),
  constraint ai_report_alerts_resolved_state_check check (
    (status in ('resolved','dismissed') and resolved_at is not null) or status in ('open','acknowledged')
  )
);

create index if not exists dataroom_file_processing_business_idx on public.dataroom_file_processing (business_id, updated_at desc);
create index if not exists dataroom_file_processing_status_idx on public.dataroom_file_processing (parse_status, ocr_status, processed_at desc);
create index if not exists dataroom_file_processing_entity_idx on public.dataroom_file_processing (entity_match_status, business_id);
create index if not exists business_listing_authority_status_idx on public.business_listing_authority (verification_status, report_policy);
create index if not exists ai_report_preflight_business_idx on public.ai_report_preflight_checks (business_id, audience, checked_at desc);
create index if not exists ai_report_preflight_actor_idx on public.ai_report_preflight_checks (actor_profile_id, checked_at desc) where actor_profile_id is not null;
create index if not exists ai_report_alerts_business_idx on public.ai_report_alerts (business_id, status, created_at desc);
create index if not exists ai_report_alerts_admin_review_idx on public.ai_report_alerts (status, severity, created_at desc) where requires_admin_review is true;
create unique index if not exists ai_report_alerts_open_dedupe_idx on public.ai_report_alerts (
  business_id,
  coalesce(business_file_id, '00000000-0000-0000-0000-000000000000'::uuid),
  alert_code
) where status in ('open','acknowledged');

create or replace function public.d68_ai_report_set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end; $$;

create or replace function public.d68_validate_file_processing_business()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare source_business_id uuid;
begin
  select f.business_id into source_business_id from public.business_files f where f.id = new.business_file_id;
  if source_business_id is null then raise exception 'business_file_not_found' using errcode = 'P0002'; end if;
  if new.business_id is distinct from source_business_id then raise exception 'business_file_business_mismatch' using errcode = '23514'; end if;
  return new;
end; $$;

create or replace function public.d68_protect_listing_authority_fields()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare is_privileged boolean := false; owned boolean := false;
begin
  is_privileged := current_user in ('postgres','service_role','supabase_admin') or coalesce((select public.is_admin()), false);
  if is_privileged then return new; end if;
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select exists (select 1 from public.businesses b where b.id = new.business_id and b.owner_id = (select auth.uid())) into owned;
  if not owned then raise exception 'business_not_owned' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.business_id is distinct from old.business_id) then
    raise exception 'protected_listing_authority_identity' using errcode = '42501';
  end if;
  new.verified_by := null;
  new.verified_at := null;
  new.expires_at := null;
  new.verification_reasons := '[]'::jsonb;
  if new.listing_party_type in ('authorized_broker','authorized_advisor','asset_operator','other') then
    new.verification_status := case when coalesce(cardinality(new.authority_document_ids),0) = 0 then 'missing'::public.d68_authority_verification_status else 'pending_review'::public.d68_authority_verification_status end;
  else
    new.verification_status := 'declared'::public.d68_authority_verification_status;
  end if;
  return new;
end; $$;

create or replace function public.d68_apply_authority_to_preflight()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare authority_policy public.d68_report_access_policy; notice_vi text; notice_en text;
begin
  select a.report_policy, a.report_notice_vi, a.report_notice_en
    into authority_policy, notice_vi, notice_en
  from public.business_listing_authority a where a.business_id = new.business_id;
  if authority_policy is null then return new; end if;
  if authority_policy = 'block' then
    new.authority_gate_status := 'blocked';
    new.allow_report := false;
    new.authority_notice_required := false;
    new.authority_notice_vi := null;
    new.authority_notice_en := null;
  elsif authority_policy = 'allow_with_notice' then
    new.authority_gate_status := 'warning';
    new.authority_notice_required := true;
    new.authority_notice_vi := notice_vi;
    new.authority_notice_en := notice_en;
  else
    if new.authority_gate_status = 'not_checked' then new.authority_gate_status := 'pass'; end if;
    new.authority_notice_required := false;
    new.authority_notice_vi := null;
    new.authority_notice_en := null;
  end if;
  return new;
end; $$;

drop trigger if exists dataroom_file_processing_business_guard on public.dataroom_file_processing;
create trigger dataroom_file_processing_business_guard before insert or update on public.dataroom_file_processing for each row execute function public.d68_validate_file_processing_business();
drop trigger if exists dataroom_file_processing_touch_updated_at on public.dataroom_file_processing;
create trigger dataroom_file_processing_touch_updated_at before update on public.dataroom_file_processing for each row execute function public.d68_ai_report_set_updated_at();
drop trigger if exists business_listing_authority_protect on public.business_listing_authority;
create trigger business_listing_authority_protect before insert or update on public.business_listing_authority for each row execute function public.d68_protect_listing_authority_fields();
drop trigger if exists business_listing_authority_touch_updated_at on public.business_listing_authority;
create trigger business_listing_authority_touch_updated_at before update on public.business_listing_authority for each row execute function public.d68_ai_report_set_updated_at();
drop trigger if exists ai_report_preflight_apply_authority on public.ai_report_preflight_checks;
create trigger ai_report_preflight_apply_authority before insert or update on public.ai_report_preflight_checks for each row execute function public.d68_apply_authority_to_preflight();
drop trigger if exists ai_report_alerts_touch_updated_at on public.ai_report_alerts;
create trigger ai_report_alerts_touch_updated_at before update on public.ai_report_alerts for each row execute function public.d68_ai_report_set_updated_at();

alter table public.dataroom_file_processing enable row level security;
alter table public.business_listing_authority enable row level security;
alter table public.ai_report_preflight_checks enable row level security;
alter table public.ai_report_alerts enable row level security;

drop policy if exists dataroom_file_processing_admin_all on public.dataroom_file_processing;
create policy dataroom_file_processing_admin_all on public.dataroom_file_processing for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists dataroom_file_processing_owner_select on public.dataroom_file_processing;
create policy dataroom_file_processing_owner_select on public.dataroom_file_processing for select to authenticated using (exists (select 1 from public.businesses b where b.id = dataroom_file_processing.business_id and b.owner_id = (select auth.uid())));

drop policy if exists business_listing_authority_admin_all on public.business_listing_authority;
create policy business_listing_authority_admin_all on public.business_listing_authority for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists business_listing_authority_owner_select on public.business_listing_authority;
create policy business_listing_authority_owner_select on public.business_listing_authority for select to authenticated using (exists (select 1 from public.businesses b where b.id = business_listing_authority.business_id and b.owner_id = (select auth.uid())));
drop policy if exists business_listing_authority_owner_insert on public.business_listing_authority;
create policy business_listing_authority_owner_insert on public.business_listing_authority for insert to authenticated with check (exists (select 1 from public.businesses b where b.id = business_listing_authority.business_id and b.owner_id = (select auth.uid())));
drop policy if exists business_listing_authority_owner_update on public.business_listing_authority;
create policy business_listing_authority_owner_update on public.business_listing_authority for update to authenticated
using (exists (select 1 from public.businesses b where b.id = business_listing_authority.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = business_listing_authority.business_id and b.owner_id = (select auth.uid())));

drop policy if exists ai_report_preflight_checks_admin_all on public.ai_report_preflight_checks;
create policy ai_report_preflight_checks_admin_all on public.ai_report_preflight_checks for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists ai_report_preflight_checks_owner_select on public.ai_report_preflight_checks;
create policy ai_report_preflight_checks_owner_select on public.ai_report_preflight_checks for select to authenticated using (exists (select 1 from public.businesses b where b.id = ai_report_preflight_checks.business_id and b.owner_id = (select auth.uid())));

drop policy if exists ai_report_alerts_admin_all on public.ai_report_alerts;
create policy ai_report_alerts_admin_all on public.ai_report_alerts for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists ai_report_alerts_owner_select on public.ai_report_alerts;
create policy ai_report_alerts_owner_select on public.ai_report_alerts for select to authenticated using (visible_to_business is true and exists (select 1 from public.businesses b where b.id = ai_report_alerts.business_id and b.owner_id = (select auth.uid())));

revoke all on table public.dataroom_file_processing, public.business_listing_authority, public.ai_report_preflight_checks, public.ai_report_alerts from anon;
grant select, insert, update, delete on table public.dataroom_file_processing, public.business_listing_authority, public.ai_report_preflight_checks, public.ai_report_alerts to authenticated;
grant select, insert, update, delete on table public.dataroom_file_processing, public.business_listing_authority, public.ai_report_preflight_checks, public.ai_report_alerts to service_role;

grant usage on type public.d68_file_processing_status, public.d68_entity_match_status, public.d68_listing_party_type, public.d68_authority_verification_status, public.d68_report_access_policy, public.d68_report_gate_status, public.d68_report_grade, public.d68_report_audience, public.d68_ai_report_alert_code, public.d68_ai_report_alert_severity, public.d68_ai_report_alert_status to authenticated, service_role;
revoke usage on type public.d68_file_processing_status, public.d68_entity_match_status, public.d68_listing_party_type, public.d68_authority_verification_status, public.d68_report_access_policy, public.d68_report_gate_status, public.d68_report_grade, public.d68_report_audience, public.d68_ai_report_alert_code, public.d68_ai_report_alert_severity, public.d68_ai_report_alert_status from anon;

comment on table public.dataroom_file_processing is 'Technical parse/OCR/classification and entity-match state for each Business Data Room file.';
comment on table public.business_listing_authority is 'Declared listing-party role and Admin verification state. Missing or insufficient broker authority is non-blocking but requires a report notice.';
comment on table public.ai_report_preflight_checks is 'Snapshots of data, entity and authority gates evaluated before AI report generation.';
comment on table public.ai_report_alerts is 'Structured Business/Admin alerts for missing, invalid, mismatched or suspicious report inputs.';
comment on column public.business_listing_authority.report_policy is 'allow_with_notice for broker/advisor authority missing, pending or insufficient; block only for expired, rejected or entity mismatch.';
comment on column public.ai_report_alerts.blocks_report is 'Must remain false for BROKER_AUTHORITY_MISSING and AUTHORITY_SCOPE_INSUFFICIENT.';
comment on column public.ai_report_preflight_checks.authority_notice_required is 'True when a report may proceed but must display the authority notice.';

notify pgrst, 'reload schema';