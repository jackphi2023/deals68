-- Deals68 AI Report Phase 2: deterministic preflight and hourly Business action limits.
-- Additive only. No frontend route, component or existing workflow is changed.
-- Business generation and Business download use independent rolling 60-minute windows.

do $$ begin
  create type public.d68_ai_report_action as enum ('generate','download');
exception when duplicate_object then null; end $$;

create table if not exists public.ai_report_rate_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action public.d68_ai_report_action not null,
  report_id uuid,
  source text not null default 'business_dashboard',
  occurred_at timestamptz not null default now(),
  constraint ai_report_rate_events_source_check check (source in ('business_dashboard','edge_function','admin'))
);

create index if not exists ai_report_rate_events_lookup_idx
  on public.ai_report_rate_events (business_id, action, occurred_at desc);

alter table public.ai_report_preflight_checks
  add column if not exists eligibility_status text not null default 'not_checked',
  add column if not exists file_total integer not null default 0,
  add column if not exists file_usable integer not null default 0,
  add column if not exists file_pending integer not null default 0,
  add column if not exists file_unreadable integer not null default 0,
  add column if not exists file_mismatch integer not null default 0,
  add column if not exists preflight_version text not null default 'phase2-v1';

do $$ begin
  alter table public.ai_report_preflight_checks
    add constraint ai_report_preflight_eligibility_status_check
    check (eligibility_status in ('not_checked','eligible','inactive_profile','insufficient_data','processing_pending','entity_mismatch','authority_blocked'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.ai_report_preflight_checks
    add constraint ai_report_preflight_file_counts_check
    check (
      file_total >= 0 and file_usable >= 0 and file_pending >= 0
      and file_unreadable >= 0 and file_mismatch >= 0
      and file_usable + file_pending + file_unreadable + file_mismatch <= file_total
    );
exception when duplicate_object then null; end $$;

create or replace function public.d68_ai_report_assert_business_access(p_business_id uuid)
returns public.businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_uid uuid := (select auth.uid());
  v_role text := coalesce((select auth.role()), '');
  v_admin boolean := coalesce((select public.is_admin()), false);
begin
  select * into v_business
  from public.businesses
  where id = p_business_id;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if not (v_role = 'service_role' or v_admin or v_business.owner_id = v_uid) then
    raise exception 'business_report_access_denied' using errcode = '42501';
  end if;

  return v_business;
end;
$$;

create or replace function public.d68_get_business_report_rate_status(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_last_generate timestamptz;
  v_last_download timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  v_business := public.d68_ai_report_assert_business_access(p_business_id);

  select max(occurred_at) filter (where action = 'generate'),
         max(occurred_at) filter (where action = 'download')
    into v_last_generate, v_last_download
  from public.ai_report_rate_events
  where business_id = p_business_id;

  return jsonb_build_object(
    'business_id', p_business_id,
    'window_seconds', 3600,
    'generate', jsonb_build_object(
      'allowed', v_last_generate is null or v_last_generate <= v_now - interval '1 hour',
      'last_at', v_last_generate,
      'next_allowed_at', case when v_last_generate is null then v_now else greatest(v_now, v_last_generate + interval '1 hour') end,
      'retry_after_seconds', case when v_last_generate is null or v_last_generate <= v_now - interval '1 hour'
        then 0 else ceil(extract(epoch from (v_last_generate + interval '1 hour' - v_now)))::integer end
    ),
    'download', jsonb_build_object(
      'allowed', v_last_download is null or v_last_download <= v_now - interval '1 hour',
      'last_at', v_last_download,
      'next_allowed_at', case when v_last_download is null then v_now else greatest(v_now, v_last_download + interval '1 hour') end,
      'retry_after_seconds', case when v_last_download is null or v_last_download <= v_now - interval '1 hour'
        then 0 else ceil(extract(epoch from (v_last_download + interval '1 hour' - v_now)))::integer end
    )
  );
end;
$$;

create or replace function public.d68_claim_business_report_action(
  p_business_id uuid,
  p_action public.d68_ai_report_action,
  p_report_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_uid uuid := (select auth.uid());
  v_role text := coalesce((select auth.role()), '');
  v_admin boolean := coalesce((select public.is_admin()), false);
  v_last_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_event_id uuid;
begin
  v_business := public.d68_ai_report_assert_business_access(p_business_id);

  if v_role = 'service_role' or v_admin then
    insert into public.ai_report_rate_events (
      business_id, actor_profile_id, action, report_id, source, occurred_at
    ) values (
      p_business_id, v_uid, p_action, p_report_id,
      case when v_admin then 'admin' else 'edge_function' end,
      v_now
    ) returning id into v_event_id;

    return jsonb_build_object(
      'allowed', true,
      'exempt', true,
      'event_id', v_event_id,
      'action', p_action,
      'claimed_at', v_now,
      'next_allowed_at', v_now
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || p_action::text, 0));

  select max(occurred_at) into v_last_at
  from public.ai_report_rate_events
  where business_id = p_business_id
    and action = p_action;

  if v_last_at is not null and v_last_at > v_now - interval '1 hour' then
    return jsonb_build_object(
      'allowed', false,
      'exempt', false,
      'action', p_action,
      'last_at', v_last_at,
      'next_allowed_at', v_last_at + interval '1 hour',
      'retry_after_seconds', ceil(extract(epoch from (v_last_at + interval '1 hour' - v_now)))::integer
    );
  end if;

  insert into public.ai_report_rate_events (
    business_id, actor_profile_id, action, report_id, source, occurred_at
  ) values (
    p_business_id, v_uid, p_action, p_report_id, 'business_dashboard', v_now
  ) returning id into v_event_id;

  return jsonb_build_object(
    'allowed', true,
    'exempt', false,
    'event_id', v_event_id,
    'action', p_action,
    'claimed_at', v_now,
    'next_allowed_at', v_now + interval '1 hour',
    'retry_after_seconds', 0
  );
end;
$$;

create or replace function public.d68_get_business_report_source_snapshot(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_files jsonb;
  v_authority jsonb;
begin
  v_business := public.d68_ai_report_assert_business_access(p_business_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'display_name', coalesce(nullif(trim(f.display_name), ''), f.file_name),
      'file_name', f.file_name,
      'file_type', f.file_type,
      'size_bytes', f.size_bytes,
      'category', f.category,
      'privacy_level', f.privacy_level,
      'review_status', f.review_status,
      'created_at', f.created_at,
      'updated_at', f.updated_at,
      'processing', case when fp.id is null then jsonb_build_object(
        'parse_status', 'pending',
        'ocr_status', 'pending',
        'entity_match_status', 'not_checked'
      ) else jsonb_build_object(
        'parse_status', fp.parse_status,
        'ocr_status', fp.ocr_status,
        'ocr_quality', fp.ocr_quality,
        'detected_document_type', fp.detected_document_type,
        'relevance_score', fp.relevance_score,
        'entity_match_status', fp.entity_match_status,
        'entity_match_score', fp.entity_match_score,
        'mismatch_reasons', fp.mismatch_reasons,
        'processed_at', fp.processed_at,
        'error_code', fp.error_code
      ) end
    )
    order by f.created_at, f.id
  ), '[]'::jsonb)
  into v_files
  from public.business_files f
  left join public.dataroom_file_processing fp on fp.business_file_id = f.id
  where f.business_id = p_business_id;

  select case when a.id is null then null else jsonb_build_object(
    'listing_party_type', a.listing_party_type,
    'verification_status', a.verification_status,
    'report_policy', a.report_policy,
    'report_notice_vi', a.report_notice_vi,
    'report_notice_en', a.report_notice_en,
    'expires_at', a.expires_at
  ) end
  into v_authority
  from public.business_listing_authority a
  where a.business_id = p_business_id;

  return jsonb_build_object(
    'snapshot_version', 'phase2-v1',
    'generated_at', clock_timestamp(),
    'business', jsonb_build_object(
      'id', v_business.id,
      'public_code', v_business.public_code,
      'company_name_private', v_business.company_name_private,
      'title_vi', v_business.title_vi,
      'title_en', v_business.title_en,
      'description_vi', v_business.description_vi,
      'description_en', v_business.description_en,
      'country_iso2', v_business.country_iso2,
      'city', v_business.city,
      'city_key', v_business.city_key,
      'industry', v_business.industry,
      'industry_key', v_business.industry_key,
      'deal_type', v_business.deal_type,
      'revenue_2025', v_business.revenue_2025,
      'revenue_month', v_business.revenue_month,
      'revenue_currency', v_business.revenue_currency,
      'ebitda_margin', v_business.ebitda_margin,
      'growth_pct', v_business.growth_pct,
      'ask_amount', v_business.ask_amount,
      'ask_currency', v_business.ask_currency,
      'stake_pct', coalesce(v_business.offer_stake_pct, v_business.stake_pct),
      'financial_input', coalesce(v_business.financial_input, '{}'::jsonb),
      'quality_score', coalesce(v_business.quality_score_auto, v_business.quality_score),
      'quality_breakdown', coalesce(v_business.quality_breakdown_json, v_business.quality_breakdown, '{}'::jsonb),
      'status', v_business.status,
      'visible', v_business.visible,
      'public_version', v_business.public_version,
      'updated_at', v_business.updated_at
    ),
    'authority', v_authority,
    'files', v_files
  );
end;
$$;

create or replace function public.d68_run_business_report_preflight(
  p_business_id uuid,
  p_persist boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_uid uuid := (select auth.uid());
  v_active boolean;
  v_has_description boolean;
  v_has_financial boolean;
  v_file_total integer := 0;
  v_file_usable integer := 0;
  v_file_pending integer := 0;
  v_file_unreadable integer := 0;
  v_file_mismatch integer := 0;
  v_data_gate public.d68_report_gate_status := 'pass';
  v_entity_gate public.d68_report_gate_status := 'pass';
  v_authority_gate public.d68_report_gate_status := 'pass';
  v_authority_policy public.d68_report_access_policy := 'allow';
  v_authority_status public.d68_authority_verification_status;
  v_notice_vi text;
  v_notice_en text;
  v_allow_report boolean := true;
  v_allow_valuation boolean := false;
  v_grade public.d68_report_grade := 'full';
  v_eligibility text := 'eligible';
  v_missing jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_blocking jsonb := '[]'::jsonb;
  v_source_hash text;
  v_preflight_id uuid;
  v_result jsonb;
begin
  v_business := public.d68_ai_report_assert_business_access(p_business_id);

  v_active := coalesce(v_business.visible, false)
    and v_business.status::text = 'active'
    and v_business.public_snapshot_json is not null;

  v_has_description := length(trim(coalesce(nullif(v_business.description_vi, ''), nullif(v_business.description_en, ''), ''))) > 0;
  v_has_financial := coalesce(v_business.revenue_2025, 0) > 0
    or coalesce(v_business.revenue_month, 0) > 0
    or coalesce(v_business.ask_amount, 0) > 0
    or coalesce(v_business.offer_amount, 0) > 0
    or coalesce(v_business.financial_input, '{}'::jsonb) <> '{}'::jsonb;

  select
    count(*)::integer,
    count(*) filter (
      where fp.parse_status = 'processed'
        and fp.entity_match_status in ('match','probable_match','not_checked')
        and coalesce(fp.relevance_score, 1) >= 0.5
    )::integer,
    count(*) filter (
      where fp.id is null or fp.parse_status in ('pending','processing')
    )::integer,
    count(*) filter (
      where fp.parse_status in ('unreadable','rejected','error')
    )::integer,
    count(*) filter (
      where fp.entity_match_status = 'mismatch'
    )::integer
  into v_file_total, v_file_usable, v_file_pending, v_file_unreadable, v_file_mismatch
  from public.business_files f
  left join public.dataroom_file_processing fp on fp.business_file_id = f.id
  where f.business_id = p_business_id;

  select a.report_policy, a.verification_status, a.report_notice_vi, a.report_notice_en
    into v_authority_policy, v_authority_status, v_notice_vi, v_notice_en
  from public.business_listing_authority a
  where a.business_id = p_business_id;

  if v_authority_policy is null then
    v_authority_policy := 'allow';
  end if;

  if not v_active then
    v_allow_report := false;
    v_grade := 'blocked';
    v_eligibility := 'inactive_profile';
    v_blocking := v_blocking || jsonb_build_array(jsonb_build_object(
      'code', 'BUSINESS_PROFILE_INACTIVE',
      'message_vi', 'Bạn chưa sử dụng được do chưa được kích hoạt hồ sơ.',
      'message_en', 'This feature is unavailable because your Business profile has not been activated.'
    ));
  end if;

  if coalesce(nullif(v_business.industry_key, ''), nullif(v_business.industry, '')) is null then
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'BUSINESS_INDUSTRY_REQUIRED',
      'message_vi', 'Vui lòng bổ sung ngành hoạt động của doanh nghiệp.',
      'message_en', 'Please add the Business industry.'
    ));
  end if;

  if not v_has_description then
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'BUSINESS_DESCRIPTION_REQUIRED',
      'message_vi', 'Vui lòng bổ sung mô tả doanh nghiệp.',
      'message_en', 'Please add the Business description.'
    ));
  end if;

  if not v_has_financial then
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'INSUFFICIENT_FINANCIAL_DATA',
      'message_vi', 'Vui lòng bổ sung doanh thu, EBITDA/lợi nhuận hoặc dữ liệu tài chính.',
      'message_en', 'Please add revenue, EBITDA/profit or other financial data.'
    ));
  end if;

  if v_file_total = 0 then
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'BUSINESS_FILE_REQUIRED',
      'message_vi', 'Vui lòng tải lên ít nhất một tài liệu doanh nghiệp, tài chính hoặc vận hành.',
      'message_en', 'Please upload at least one Business, financial or operating document.'
    ));
  end if;

  if v_file_mismatch > 0 then
    if v_file_usable = 0 and v_file_pending = 0 then
      v_entity_gate := 'blocked';
      v_eligibility := 'entity_mismatch';
      v_blocking := v_blocking || jsonb_build_array(jsonb_build_object(
        'code', 'FILE_ENTITY_MISMATCH',
        'count', v_file_mismatch,
        'message_vi', 'Các tài liệu đã xử lý không khớp với doanh nghiệp hoặc tài sản trong hồ sơ.',
        'message_en', 'The processed documents do not match the Business or asset in the profile.'
      ));
    else
      v_entity_gate := 'warning';
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'FILE_ENTITY_MISMATCH',
        'count', v_file_mismatch,
        'message_vi', 'Một số tài liệu không khớp hồ sơ và sẽ bị loại khỏi nguồn báo cáo.',
        'message_en', 'Some documents do not match the profile and will be excluded from report sources.'
      ));
    end if;
  end if;

  if v_file_unreadable > 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'FILE_UNREADABLE',
      'count', v_file_unreadable,
      'message_vi', 'Một số tài liệu không đọc được và sẽ không được sử dụng.',
      'message_en', 'Some documents are unreadable and will not be used.'
    ));
  end if;

  if v_file_total > 0 and v_file_usable = 0 and v_file_pending > 0 then
    v_entity_gate := 'review_required';
    v_eligibility := 'processing_pending';
    v_blocking := v_blocking || jsonb_build_array(jsonb_build_object(
      'code', 'FILE_PROCESSING_PENDING',
      'count', v_file_pending,
      'message_vi', 'Tài liệu đang chờ xử lý. Vui lòng thử lại sau khi hệ thống hoàn tất kiểm tra.',
      'message_en', 'Documents are awaiting processing. Please try again after processing is complete.'
    ));
  elsif v_file_total > 0 and v_file_usable = 0 and v_file_unreadable > 0 and v_file_pending = 0 and v_file_mismatch = 0 then
    v_entity_gate := 'blocked';
    v_blocking := v_blocking || jsonb_build_array(jsonb_build_object(
      'code', 'FILE_UNREADABLE',
      'count', v_file_unreadable,
      'message_vi', 'Không có tài liệu nào đọc được để tạo báo cáo.',
      'message_en', 'No readable document is available to create the report.'
    ));
  end if;

  if v_authority_policy = 'block' then
    v_authority_gate := 'blocked';
    v_eligibility := 'authority_blocked';
    v_blocking := v_blocking || jsonb_build_array(jsonb_build_object(
      'code', case
        when v_authority_status = 'expired' then 'AUTHORITY_DOCUMENT_EXPIRED'
        when v_authority_status = 'entity_mismatch' then 'OWNER_IDENTITY_MISMATCH'
        else 'ADMIN_REVIEW_REQUIRED'
      end,
      'message_vi', 'Tư cách hoặc thẩm quyền đăng hồ sơ chưa hợp lệ.',
      'message_en', 'The listing authority is not valid.'
    ));
  elsif v_authority_policy = 'allow_with_notice' then
    v_authority_gate := 'warning';
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', case when v_authority_status = 'insufficient_scope'
        then 'AUTHORITY_SCOPE_INSUFFICIENT' else 'BROKER_AUTHORITY_MISSING' end,
      'message_vi', v_notice_vi,
      'message_en', v_notice_en,
      'mandatory_report_notice', true
    ));
  end if;

  if v_data_gate = 'blocked' then
    v_allow_report := false;
    if v_eligibility = 'eligible' then v_eligibility := 'insufficient_data'; end if;
    v_blocking := v_blocking || v_missing;
  end if;

  if v_entity_gate in ('blocked','review_required') or v_authority_gate = 'blocked' then
    v_allow_report := false;
  end if;

  if v_allow_report then
    v_grade := case
      when v_data_gate = 'warning' or v_entity_gate = 'warning' or v_authority_gate = 'warning'
        or v_file_unreadable > 0 or v_file_mismatch > 0
      then 'limited'::public.d68_report_grade
      else 'full'::public.d68_report_grade
    end;
  else
    v_grade := 'blocked';
  end if;

  v_allow_valuation := v_allow_report and v_has_financial and v_file_usable > 0 and v_file_mismatch = 0;

  v_source_hash := md5(concat_ws('|',
    p_business_id::text,
    coalesce(v_business.updated_at::text, ''),
    coalesce((select max(f.updated_at)::text from public.business_files f where f.business_id = p_business_id), ''),
    coalesce((select max(fp.updated_at)::text from public.dataroom_file_processing fp where fp.business_id = p_business_id), ''),
    coalesce(v_authority_status::text, 'none'),
    v_file_total::text,
    v_file_usable::text,
    v_file_pending::text,
    v_file_unreadable::text,
    v_file_mismatch::text
  ));

  if p_persist then
    insert into public.ai_report_preflight_checks (
      business_id, actor_profile_id, audience,
      data_gate_status, entity_gate_status, authority_gate_status,
      report_grade, allow_report, allow_valuation,
      authority_notice_required, authority_notice_vi, authority_notice_en,
      missing_items_json, warning_items_json, blocking_alerts_json,
      source_hash, eligibility_status,
      file_total, file_usable, file_pending, file_unreadable, file_mismatch,
      preflight_version, checked_at
    ) values (
      p_business_id, v_uid, 'business_owner',
      v_data_gate, v_entity_gate, v_authority_gate,
      v_grade, v_allow_report, v_allow_valuation,
      v_authority_policy = 'allow_with_notice', v_notice_vi, v_notice_en,
      v_missing, v_warnings, v_blocking,
      v_source_hash, v_eligibility,
      v_file_total, v_file_usable, v_file_pending, v_file_unreadable, v_file_mismatch,
      'phase2-v1', clock_timestamp()
    ) returning id into v_preflight_id;

    update public.ai_report_alerts
    set status = 'dismissed', resolved_at = clock_timestamp(), resolved_by = v_uid
    where business_id = p_business_id
      and status in ('open','acknowledged')
      and detail_json ->> 'source' = 'phase2_preflight_v1';

    if not v_has_financial then
      insert into public.ai_report_alerts (
        business_id, preflight_check_id, alert_code, severity,
        title_vi, title_en, detail_json, blocks_report
      ) values (
        p_business_id, v_preflight_id, 'INSUFFICIENT_FINANCIAL_DATA', 'high',
        'Thiếu dữ liệu tài chính tối thiểu',
        'Minimum financial data is missing',
        jsonb_build_object('source','phase2_preflight_v1'), true
      );
    end if;

    if v_file_unreadable > 0 then
      insert into public.ai_report_alerts (
        business_id, preflight_check_id, alert_code, severity,
        title_vi, title_en, detail_json, blocks_report
      ) values (
        p_business_id, v_preflight_id, 'FILE_UNREADABLE',
        case when v_file_usable = 0 and v_file_pending = 0 then 'high' else 'warning' end,
        'Có tài liệu không đọc được',
        'Some documents are unreadable',
        jsonb_build_object('source','phase2_preflight_v1','count',v_file_unreadable),
        v_file_usable = 0 and v_file_pending = 0
      );
    end if;

    if v_file_mismatch > 0 then
      insert into public.ai_report_alerts (
        business_id, preflight_check_id, alert_code, severity,
        title_vi, title_en, detail_json, blocks_report, requires_admin_review
      ) values (
        p_business_id, v_preflight_id, 'FILE_ENTITY_MISMATCH',
        case when v_file_usable = 0 and v_file_pending = 0 then 'critical' else 'high' end,
        'Tài liệu không khớp hồ sơ',
        'Document does not match the profile',
        jsonb_build_object('source','phase2_preflight_v1','count',v_file_mismatch),
        v_file_usable = 0 and v_file_pending = 0,
        true
      );
    end if;

    if v_file_pending > 0 and v_file_usable = 0 then
      insert into public.ai_report_alerts (
        business_id, preflight_check_id, alert_code, severity,
        title_vi, title_en, detail_json, blocks_report
      ) values (
        p_business_id, v_preflight_id, 'ADMIN_REVIEW_REQUIRED', 'info',
        'Tài liệu đang chờ xử lý',
        'Documents are awaiting processing',
        jsonb_build_object('source','phase2_preflight_v1','count',v_file_pending,'reason','file_processing_pending'),
        true
      );
    end if;

    if v_authority_policy = 'allow_with_notice' then
      insert into public.ai_report_alerts (
        business_id, preflight_check_id, alert_code, severity,
        title_vi, title_en, detail_json, blocks_report, requires_admin_review
      ) values (
        p_business_id, v_preflight_id,
        case when v_authority_status = 'insufficient_scope'
          then 'AUTHORITY_SCOPE_INSUFFICIENT'::public.d68_ai_report_alert_code
          else 'BROKER_AUTHORITY_MISSING'::public.d68_ai_report_alert_code end,
        'warning',
        case when v_authority_status = 'insufficient_scope'
          then 'Phạm vi ủy quyền chưa đầy đủ' else 'Chưa có giấy ủy quyền được xác thực' end,
        case when v_authority_status = 'insufficient_scope'
          then 'Authorization scope is insufficient' else 'Authenticated authorization is not available' end,
        jsonb_build_object('source','phase2_preflight_v1','mandatory_report_notice',true),
        false,
        true
      );
    end if;

    if v_authority_policy = 'block' then
      insert into public.ai_report_alerts (
        business_id, preflight_check_id, alert_code, severity,
        title_vi, title_en, detail_json, blocks_report, requires_admin_review
      ) values (
        p_business_id, v_preflight_id,
        case
          when v_authority_status = 'expired' then 'AUTHORITY_DOCUMENT_EXPIRED'::public.d68_ai_report_alert_code
          when v_authority_status = 'entity_mismatch' then 'OWNER_IDENTITY_MISMATCH'::public.d68_ai_report_alert_code
          else 'ADMIN_REVIEW_REQUIRED'::public.d68_ai_report_alert_code
        end,
        'critical',
        'Thẩm quyền đăng hồ sơ chưa hợp lệ',
        'Listing authority is not valid',
        jsonb_build_object('source','phase2_preflight_v1','verification_status',v_authority_status),
        true,
        true
      );
    end if;
  end if;

  v_result := jsonb_build_object(
    'preflight_id', v_preflight_id,
    'business_id', p_business_id,
    'preflight_version', 'phase2-v1',
    'checked_at', clock_timestamp(),
    'eligibility_status', v_eligibility,
    'allow_report', v_allow_report,
    'allow_valuation', v_allow_valuation,
    'report_grade', v_grade,
    'gates', jsonb_build_object(
      'data', v_data_gate,
      'entity', v_entity_gate,
      'authority', v_authority_gate
    ),
    'files', jsonb_build_object(
      'total', v_file_total,
      'usable', v_file_usable,
      'pending', v_file_pending,
      'unreadable', v_file_unreadable,
      'mismatch', v_file_mismatch
    ),
    'authority_notice_required', v_authority_policy = 'allow_with_notice',
    'authority_notice_vi', v_notice_vi,
    'authority_notice_en', v_notice_en,
    'missing', v_missing,
    'warnings', v_warnings,
    'blocking', v_blocking,
    'source_hash', v_source_hash,
    'rate_limit', public.d68_get_business_report_rate_status(p_business_id)
  );

  return v_result;
end;
$$;

alter table public.ai_report_rate_events enable row level security;

drop policy if exists ai_report_rate_events_admin_all on public.ai_report_rate_events;
create policy ai_report_rate_events_admin_all
  on public.ai_report_rate_events for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists ai_report_rate_events_owner_select on public.ai_report_rate_events;
create policy ai_report_rate_events_owner_select
  on public.ai_report_rate_events for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = ai_report_rate_events.business_id
      and b.owner_id = (select auth.uid())
  ));

revoke all on table public.ai_report_rate_events from anon;
grant select on table public.ai_report_rate_events to authenticated;
grant select, insert, update, delete on table public.ai_report_rate_events to service_role;

revoke all on function public.d68_ai_report_assert_business_access(uuid) from public, anon, authenticated;
grant execute on function public.d68_ai_report_assert_business_access(uuid) to service_role;

revoke all on function public.d68_get_business_report_rate_status(uuid) from public, anon;
grant execute on function public.d68_get_business_report_rate_status(uuid) to authenticated, service_role;

revoke all on function public.d68_claim_business_report_action(uuid, public.d68_ai_report_action, uuid) from public, anon;
grant execute on function public.d68_claim_business_report_action(uuid, public.d68_ai_report_action, uuid) to authenticated, service_role;

revoke all on function public.d68_get_business_report_source_snapshot(uuid) from public, anon;
grant execute on function public.d68_get_business_report_source_snapshot(uuid) to authenticated, service_role;

revoke all on function public.d68_run_business_report_preflight(uuid, boolean) from public, anon;
grant execute on function public.d68_run_business_report_preflight(uuid, boolean) to authenticated, service_role;

grant usage on type public.d68_ai_report_action to authenticated, service_role;
revoke usage on type public.d68_ai_report_action from anon;

comment on table public.ai_report_rate_events is
  'Successful Business report generation/download claims. Generation and download each use an independent rolling one-hour limit.';
comment on function public.d68_claim_business_report_action(uuid, public.d68_ai_report_action, uuid) is
  'Atomically claims one Business report generation or download action. Business owners are limited to one successful action of each type per rolling hour.';
comment on function public.d68_run_business_report_preflight(uuid, boolean) is
  'Deterministic Business report preflight. Missing/insufficient broker authority remains non-blocking and adds a mandatory report notice.';
comment on function public.d68_get_business_report_source_snapshot(uuid) is
  'Returns a private owner/Admin report-source snapshot without exposing Storage file paths.';
comment on column public.ai_report_preflight_checks.eligibility_status is
  'Machine-readable Phase 2 eligibility result used by future Business report UI and Edge Functions.';

notify pgrst, 'reload schema';