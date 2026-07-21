-- Deals68 AI Report Phase 2: deterministic preflight and Business request throttling.
-- Additive only: no UI changes, no changes to existing Business/Investor/Admin workflows.
-- A successful Business report create-download workflow is limited to once per rolling 60 minutes.
-- Missing or insufficient broker authority remains non-blocking and adds the mandatory report notice.

do $$ begin
  create type public.d68_fact_kind as enum ('document_backed','derived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_fact_validation_status as enum ('extracted','validated','conflict','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.d68_report_request_status as enum ('reserved','completed','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.self_declared_fields (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  field_key text not null,
  source_column text not null,
  value jsonb not null,
  q_source numeric(5,4) generated always as (0::numeric) stored,
  declared_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_count integer not null default 0,
  constraint self_declared_fields_field_key_check check (length(trim(field_key)) between 1 and 120),
  constraint self_declared_fields_source_column_check check (length(trim(source_column)) between 1 and 120),
  constraint self_declared_fields_updated_count_check check (updated_count >= 0),
  unique (business_id, field_key)
);

create table if not exists public.dataroom_facts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_file_id uuid references public.business_files(id) on delete cascade,
  fact_kind public.d68_fact_kind not null default 'document_backed',
  field_key text not null,
  period_key text,
  value_json jsonb not null,
  normalized_value numeric,
  unit text,
  currency text,
  confidence numeric(5,4) not null default 0,
  validation_status public.d68_fact_validation_status not null default 'extracted',
  page_number integer,
  sheet_name text,
  cell_range text,
  source_excerpt text,
  source_fact_ids uuid[] not null default '{}'::uuid[],
  extraction_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dataroom_facts_field_key_check check (length(trim(field_key)) between 1 and 160),
  constraint dataroom_facts_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint dataroom_facts_page_number_check check (page_number is null or page_number > 0),
  constraint dataroom_facts_source_check check (
    (fact_kind = 'document_backed' and business_file_id is not null)
    or
    (fact_kind = 'derived' and cardinality(source_fact_ids) > 0)
  )
);

create table if not exists public.ai_report_business_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  request_key text,
  status public.d68_report_request_status not null default 'reserved',
  report_id uuid,
  reserved_at timestamptz not null default now(),
  reserved_until timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz,
  failed_at timestamptz,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_report_business_requests_request_key_check check (
    request_key is null or length(request_key) between 1 and 200
  ),
  constraint ai_report_business_requests_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint ai_report_business_requests_time_check check (reserved_until > reserved_at),
  constraint ai_report_business_requests_state_check check (
    (status = 'reserved' and completed_at is null and failed_at is null)
    or (status = 'completed' and completed_at is not null and failed_at is null)
    or (status in ('failed','cancelled') and failed_at is not null and completed_at is null)
  )
);

create index if not exists self_declared_fields_business_idx
  on public.self_declared_fields (business_id, field_key);

create index if not exists dataroom_facts_business_field_idx
  on public.dataroom_facts (business_id, field_key, period_key);

create index if not exists dataroom_facts_file_idx
  on public.dataroom_facts (business_file_id, validation_status);

create index if not exists dataroom_facts_report_gate_idx
  on public.dataroom_facts (business_id, confidence desc)
  where validation_status in ('extracted','validated');

create unique index if not exists dataroom_facts_source_dedupe_idx
  on public.dataroom_facts (
    business_id,
    business_file_id,
    fact_kind,
    field_key,
    coalesce(period_key, ''),
    coalesce(page_number, 0),
    coalesce(sheet_name, ''),
    coalesce(cell_range, '')
  );

create unique index if not exists ai_report_business_requests_active_idx
  on public.ai_report_business_requests (business_id)
  where status = 'reserved';

create unique index if not exists ai_report_business_requests_idempotency_idx
  on public.ai_report_business_requests (
    business_id,
    coalesce(actor_profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    request_key
  )
  where request_key is not null;

create index if not exists ai_report_business_requests_completed_idx
  on public.ai_report_business_requests (business_id, completed_at desc)
  where status = 'completed';

create or replace function public.d68_sync_one_self_declared_field(
  p_business_id uuid,
  p_field_key text,
  p_source_column text,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  p_value := coalesce(p_value, 'null'::jsonb);

  insert into public.self_declared_fields (
    business_id, field_key, source_column, value
  )
  values (
    p_business_id, p_field_key, p_source_column, p_value
  )
  on conflict (business_id, field_key) do update
    set source_column = excluded.source_column,
        value = excluded.value,
        updated_count = public.self_declared_fields.updated_count
          + case when public.self_declared_fields.value is distinct from excluded.value then 1 else 0 end,
        updated_at = case
          when public.self_declared_fields.value is distinct from excluded.value then now()
          else public.self_declared_fields.updated_at
        end;
end;
$$;

create or replace function public.d68_sync_business_self_declared_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.d68_sync_one_self_declared_field(
    new.id, 'industry_key', 'industry_key',
    to_jsonb(coalesce(nullif(trim(new.industry_key), ''), nullif(trim(new.industry), '')))
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'deal_type', 'deal_type', to_jsonb(nullif(trim(new.deal_type), ''))
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'revenue_annual', 'revenue_2025', to_jsonb(new.revenue_2025)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'revenue_monthly', 'revenue_month', to_jsonb(new.revenue_month)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'ebitda_margin', 'ebitda_margin', to_jsonb(new.ebitda_margin)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'growth_pct', 'growth_pct', to_jsonb(new.growth_pct)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'ask_amount', 'ask_amount', to_jsonb(new.ask_amount)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'ask_currency', 'ask_currency', to_jsonb(nullif(trim(new.ask_currency), ''))
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'stake_pct', 'stake_pct', to_jsonb(new.stake_pct)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'offer_amount', 'offer_amount', to_jsonb(new.offer_amount)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'offer_stake_pct', 'offer_stake_pct', to_jsonb(new.offer_stake_pct)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'self_valuation', 'self_valuation', to_jsonb(new.self_valuation)
  );
  perform public.d68_sync_one_self_declared_field(
    new.id, 'financial_input', 'financial_input', coalesce(new.financial_input, '{}'::jsonb)
  );
  return new;
end;
$$;

drop trigger if exists businesses_sync_self_declared_insert on public.businesses;
create trigger businesses_sync_self_declared_insert
after insert on public.businesses
for each row execute function public.d68_sync_business_self_declared_fields();

drop trigger if exists businesses_sync_self_declared_update on public.businesses;
create trigger businesses_sync_self_declared_update
after update of
  industry_key, industry, deal_type, revenue_2025, revenue_month,
  ebitda_margin, growth_pct, ask_amount, ask_currency, stake_pct,
  offer_amount, offer_stake_pct, self_valuation, financial_input
on public.businesses
for each row execute function public.d68_sync_business_self_declared_fields();

create or replace function public.d68_queue_business_file_processing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.business_id is null then
    return new;
  end if;

  insert into public.dataroom_file_processing (
    business_file_id, business_id, parse_status, ocr_status
  )
  values (
    new.id, new.business_id, 'pending', 'pending'
  )
  on conflict (business_file_id) do update
    set business_id = excluded.business_id,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists business_files_queue_processing_insert on public.business_files;
create trigger business_files_queue_processing_insert
after insert on public.business_files
for each row execute function public.d68_queue_business_file_processing();

drop trigger if exists business_files_queue_processing_business_update on public.business_files;
create trigger business_files_queue_processing_business_update
after update of business_id on public.business_files
for each row execute function public.d68_queue_business_file_processing();

create or replace function public.d68_validate_dataroom_fact_business()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_file_business_id uuid;
begin
  if new.fact_kind = 'document_backed' then
    select f.business_id
      into v_file_business_id
    from public.business_files f
    where f.id = new.business_file_id;

    if v_file_business_id is null then
      raise exception 'business_file_not_found' using errcode = 'P0002';
    end if;

    if new.business_id is distinct from v_file_business_id then
      raise exception 'dataroom_fact_business_mismatch' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists dataroom_facts_business_guard on public.dataroom_facts;
create trigger dataroom_facts_business_guard
before insert or update on public.dataroom_facts
for each row execute function public.d68_validate_dataroom_fact_business();

drop trigger if exists dataroom_facts_touch_updated_at on public.dataroom_facts;
create trigger dataroom_facts_touch_updated_at
before update on public.dataroom_facts
for each row execute function public.d68_ai_report_set_updated_at();

drop trigger if exists ai_report_business_requests_touch_updated_at on public.ai_report_business_requests;
create trigger ai_report_business_requests_touch_updated_at
before update on public.ai_report_business_requests
for each row execute function public.d68_ai_report_set_updated_at();

insert into public.dataroom_file_processing (
  business_file_id, business_id, parse_status, ocr_status
)
select f.id, f.business_id, 'pending', 'pending'
from public.business_files f
where f.business_id is not null
on conflict (business_file_id) do nothing;

insert into public.self_declared_fields (
  business_id, field_key, source_column, value
)
select b.id, v.field_key, v.source_column, v.value
from public.businesses b
cross join lateral (
  values
    ('industry_key', 'industry_key', to_jsonb(coalesce(nullif(trim(b.industry_key), ''), nullif(trim(b.industry), '')))),
    ('deal_type', 'deal_type', to_jsonb(nullif(trim(b.deal_type), ''))),
    ('revenue_annual', 'revenue_2025', to_jsonb(b.revenue_2025)),
    ('revenue_monthly', 'revenue_month', to_jsonb(b.revenue_month)),
    ('ebitda_margin', 'ebitda_margin', to_jsonb(b.ebitda_margin)),
    ('growth_pct', 'growth_pct', to_jsonb(b.growth_pct)),
    ('ask_amount', 'ask_amount', to_jsonb(b.ask_amount)),
    ('ask_currency', 'ask_currency', to_jsonb(nullif(trim(b.ask_currency), ''))),
    ('stake_pct', 'stake_pct', to_jsonb(b.stake_pct)),
    ('offer_amount', 'offer_amount', to_jsonb(b.offer_amount)),
    ('offer_stake_pct', 'offer_stake_pct', to_jsonb(b.offer_stake_pct)),
    ('self_valuation', 'self_valuation', to_jsonb(b.self_valuation)),
    ('financial_input', 'financial_input', case
      when b.financial_input is not null and b.financial_input <> '{}'::jsonb then b.financial_input
      else null
    end)
) as v(field_key, source_column, value)
where v.value is not null and v.value <> 'null'::jsonb
on conflict (business_id, field_key) do nothing;

alter table public.self_declared_fields enable row level security;
alter table public.dataroom_facts enable row level security;
alter table public.ai_report_business_requests enable row level security;

drop policy if exists self_declared_fields_admin_all on public.self_declared_fields;
create policy self_declared_fields_admin_all
on public.self_declared_fields
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists self_declared_fields_owner_select on public.self_declared_fields;
create policy self_declared_fields_owner_select
on public.self_declared_fields
for select to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = self_declared_fields.business_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists dataroom_facts_admin_all on public.dataroom_facts;
create policy dataroom_facts_admin_all
on public.dataroom_facts
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists dataroom_facts_owner_select on public.dataroom_facts;
create policy dataroom_facts_owner_select
on public.dataroom_facts
for select to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = dataroom_facts.business_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists ai_report_business_requests_admin_all on public.ai_report_business_requests;
create policy ai_report_business_requests_admin_all
on public.ai_report_business_requests
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists ai_report_business_requests_owner_select on public.ai_report_business_requests;
create policy ai_report_business_requests_owner_select
on public.ai_report_business_requests
for select to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = ai_report_business_requests.business_id
      and b.owner_id = (select auth.uid())
  )
);

revoke all on table
  public.self_declared_fields,
  public.dataroom_facts,
  public.ai_report_business_requests
from anon;

grant select, insert, update, delete on table
  public.self_declared_fields,
  public.dataroom_facts,
  public.ai_report_business_requests
to authenticated;

grant select, insert, update, delete on table
  public.self_declared_fields,
  public.dataroom_facts,
  public.ai_report_business_requests
to service_role;

grant usage on type
  public.d68_fact_kind,
  public.d68_fact_validation_status,
  public.d68_report_request_status
to authenticated, service_role;

revoke usage on type
  public.d68_fact_kind,
  public.d68_fact_validation_status,
  public.d68_report_request_status
from anon;

revoke all on function public.d68_sync_one_self_declared_field(uuid,text,text,jsonb) from public;
revoke all on function public.d68_sync_business_self_declared_fields() from public;
revoke all on function public.d68_queue_business_file_processing() from public;
revoke all on function public.d68_validate_dataroom_fact_business() from public;

comment on table public.self_declared_fields is
  'Business form values copied separately from document-backed facts; these values never increase report reliability by themselves.';

comment on table public.dataroom_facts is
  'Normalized document-backed or derived facts with source location and confidence for report preflight and later AI generation.';

comment on table public.ai_report_business_requests is
  'Business report create-download workflow reservations. Only completed requests count toward the rolling 60-minute limit.';

notify pgrst, 'reload schema';