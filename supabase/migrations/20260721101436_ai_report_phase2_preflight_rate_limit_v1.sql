-- Deals68 AI Report Phase 2: deterministic Business preflight and rolling 60-minute request gate.
-- Depends on the Phase 2 evidence foundation migration.
-- Missing or insufficient broker authority remains non-blocking and requires the mandatory notice.

create or replace function public.d68_set_ai_report_alert(
  p_business_id uuid,
  p_preflight_check_id uuid,
  p_alert_code public.d68_ai_report_alert_code,
  p_severity public.d68_ai_report_alert_severity,
  p_title_vi text,
  p_title_en text,
  p_detail_json jsonb,
  p_blocks_report boolean,
  p_requires_admin_review boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alert_id uuid;
begin
  select a.id
    into v_alert_id
  from public.ai_report_alerts a
  where a.business_id = p_business_id
    and a.business_file_id is null
    and a.alert_code = p_alert_code
    and a.status in ('open','acknowledged')
  order by a.created_at desc
  limit 1
  for update;

  if v_alert_id is null then
    insert into public.ai_report_alerts (
      business_id, preflight_check_id, alert_code, severity,
      title_vi, title_en, detail_json, blocks_report,
      requires_admin_review, visible_to_business
    )
    values (
      p_business_id, p_preflight_check_id, p_alert_code, p_severity,
      p_title_vi, p_title_en, coalesce(p_detail_json, '{}'::jsonb), p_blocks_report,
      p_requires_admin_review, true
    )
    returning id into v_alert_id;
  else
    update public.ai_report_alerts
    set preflight_check_id = p_preflight_check_id,
        severity = p_severity,
        title_vi = p_title_vi,
        title_en = p_title_en,
        detail_json = coalesce(p_detail_json, '{}'::jsonb),
        blocks_report = p_blocks_report,
        requires_admin_review = p_requires_admin_review,
        updated_at = now()
    where id = v_alert_id;
  end if;

  return v_alert_id;
end;
$$;

create or replace function public.d68_resolve_ai_report_alert(
  p_business_id uuid,
  p_alert_code public.d68_ai_report_alert_code
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ai_report_alerts
  set status = 'resolved',
      resolved_at = now(),
      updated_at = now()
  where business_id = p_business_id
    and business_file_id is null
    and alert_code = p_alert_code
    and status in ('open','acknowledged');
end;
$$;

create or replace function public.d68_run_business_report_preflight(
  p_business_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_is_admin boolean := coalesce((select public.is_admin()), false);
  v_actor_profile_id uuid;
  v_business public.businesses%rowtype;
  v_authority public.business_listing_authority%rowtype;
  v_has_authority boolean := false;
  v_file_count integer := 0;
  v_candidate_file_count integer := 0;
  v_usable_file_count integer := 0;
  v_pending_file_count integer := 0;
  v_unreadable_file_count integer := 0;
  v_mismatch_file_count integer := 0;
  v_fact_count integer := 0;
  v_has_documented_revenue boolean := false;
  v_has_documented_ebitda boolean := false;
  v_has_documented_debt boolean := false;
  v_has_documented_cash boolean := false;
  v_has_profile_core boolean := false;
  v_has_self_financial boolean := false;
  v_has_external_block boolean := false;
  v_allow_report boolean := true;
  v_allow_valuation boolean := false;
  v_data_gate public.d68_report_gate_status := 'pass';
  v_entity_gate public.d68_report_gate_status := 'pass';
  v_authority_gate public.d68_report_gate_status := 'pass';
  v_grade public.d68_report_grade := 'limited';
  v_missing jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_blocking jsonb := '[]'::jsonb;
  v_source_hash text;
  v_preflight_id uuid;
  v_notice_required boolean := false;
  v_notice_vi text;
  v_notice_en text;
begin
  perform pg_advisory_xact_lock(hashtextextended('d68-preflight:' || p_business_id::text, 0));

  select b.*
    into v_business
  from public.businesses b
  where b.id = p_business_id;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if not v_is_service
     and not v_is_admin
     and (v_actor is null or v_business.owner_id is distinct from v_actor) then
    raise exception 'business_report_access_denied' using errcode = '42501';
  end if;

  if v_actor is not null and exists (select 1 from public.profiles p where p.id = v_actor) then
    v_actor_profile_id := v_actor;
  end if;

  v_has_profile_core :=
    coalesce(nullif(trim(v_business.industry_key), ''), nullif(trim(v_business.industry), '')) is not null
    and coalesce(
      nullif(trim(v_business.description_vi), ''),
      nullif(trim(v_business.description_en), ''),
      nullif(trim(v_business.highlights_vi), ''),
      nullif(trim(v_business.highlights_en), '')
    ) is not null;

  v_has_self_financial :=
    coalesce(v_business.revenue_2025, 0) > 0
    or coalesce(v_business.revenue_month, 0) > 0
    or coalesce(v_business.ebitda_margin, 0) <> 0
    or (
      v_business.financial_input is not null
      and v_business.financial_input <> '{}'::jsonb
    );

  select
    count(*)::integer,
    count(*) filter (
      where coalesce(f.review_status, 'pending') not in ('reviewed_hidden','rejected')
    )::integer,
    count(*) filter (
      where coalesce(f.review_status, 'pending') not in ('reviewed_hidden','rejected')
        and (
          p.parse_status = 'processed'
          or p.ocr_status = 'processed'
        )
        and p.entity_match_status <> 'mismatch'
    )::integer,
    count(*) filter (
      where coalesce(f.review_status, 'pending') not in ('reviewed_hidden','rejected')
        and not (p.parse_status = 'processed' or p.ocr_status = 'processed')
        and (
          p.parse_status in ('pending','processing')
          or p.ocr_status in ('pending','processing')
        )
    )::integer,
    count(*) filter (
      where coalesce(f.review_status, 'pending') not in ('reviewed_hidden','rejected')
        and not (p.parse_status = 'processed' or p.ocr_status = 'processed')
        and p.parse_status in ('unreadable','rejected','error')
        and p.ocr_status in ('unreadable','rejected','error')
    )::integer,
    count(*) filter (
      where coalesce(f.review_status, 'pending') not in ('reviewed_hidden','rejected')
        and p.entity_match_status = 'mismatch'
    )::integer
  into
    v_file_count,
    v_candidate_file_count,
    v_usable_file_count,
    v_pending_file_count,
    v_unreadable_file_count,
    v_mismatch_file_count
  from public.business_files f
  left join public.dataroom_file_processing p
    on p.business_file_id = f.id
  where f.business_id = p_business_id;

  select
    count(*) filter (
      where validation_status in ('extracted','validated')
        and confidence >= 0.70
    )::integer,
    bool_or(
      field_key in ('revenue_net','revenue_annual','revenue_2025')
      and validation_status in ('extracted','validated')
      and confidence >= 0.70
    ),
    bool_or(
      field_key in ('ebitda','ebitda_amount','noi')
      and validation_status in ('extracted','validated')
      and confidence >= 0.80
    ),
    bool_or(
      field_key in ('debt','total_debt','borrowings')
      and validation_status in ('extracted','validated')
      and confidence >= 0.70
    ),
    bool_or(
      field_key in ('cash','cash_balance','cash_and_equivalents')
      and validation_status in ('extracted','validated')
      and confidence >= 0.70
    )
  into
    v_fact_count,
    v_has_documented_revenue,
    v_has_documented_ebitda,
    v_has_documented_debt,
    v_has_documented_cash
  from public.dataroom_facts
  where business_id = p_business_id;

  v_has_documented_revenue := coalesce(v_has_documented_revenue, false);
  v_has_documented_ebitda := coalesce(v_has_documented_ebitda, false);
  v_has_documented_debt := coalesce(v_has_documented_debt, false);
  v_has_documented_cash := coalesce(v_has_documented_cash, false);

  if v_business.status::text <> 'active'
     or v_business.visible is not true
     or v_business.public_snapshot_json is null then
    v_allow_report := false;
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'BUSINESS_NOT_ACTIVE',
      'message_vi', 'Hồ sơ doanh nghiệp chưa được kích hoạt và hiển thị.',
      'message_en', 'The Business profile is not active and visible yet.'
    ));
    v_blocking := v_blocking || jsonb_build_array('BUSINESS_NOT_ACTIVE');
  end if;

  if not v_has_profile_core then
    v_allow_report := false;
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'PROFILE_CORE_MISSING',
      'message_vi', 'Vui lòng bổ sung ngành và nội dung giới thiệu hoặc điểm nổi bật của doanh nghiệp.',
      'message_en', 'Add the Business industry and an introduction or highlights.'
    ));
    v_blocking := v_blocking || jsonb_build_array('PROFILE_CORE_MISSING');
  end if;

  if not v_has_self_financial then
    v_allow_report := false;
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'FINANCIAL_INPUT_MISSING',
      'message_vi', 'Vui lòng bổ sung doanh thu, biên EBITDA/lợi nhuận hoặc thông tin giao dịch.',
      'message_en', 'Add revenue, EBITDA/profit margin, or transaction information.'
    ));
    v_blocking := v_blocking || jsonb_build_array('FINANCIAL_INPUT_MISSING');
  end if;

  if v_candidate_file_count = 0 then
    v_allow_report := false;
    v_data_gate := 'blocked';
    v_missing := v_missing || jsonb_build_array(jsonb_build_object(
      'code', 'BUSINESS_FILE_MISSING',
      'message_vi', 'Vui lòng tải lên ít nhất một tài liệu doanh nghiệp có thể sử dụng.',
      'message_en', 'Upload at least one usable Business document.'
    ));
    v_blocking := v_blocking || jsonb_build_array('BUSINESS_FILE_MISSING');
  elsif v_usable_file_count = 0 then
    v_allow_report := false;
    v_data_gate := 'blocked';
    if v_pending_file_count > 0 then
      v_missing := v_missing || jsonb_build_array(jsonb_build_object(
        'code', 'DOCUMENT_PROCESSING_PENDING',
        'message_vi', 'Tài liệu đang chờ xử lý. Báo cáo có thể tạo sau khi hệ thống đọc xong tài liệu.',
        'message_en', 'Documents are awaiting processing. The report can be created after processing finishes.'
      ));
      v_blocking := v_blocking || jsonb_build_array('DOCUMENT_PROCESSING_PENDING');
    else
      v_missing := v_missing || jsonb_build_array(jsonb_build_object(
        'code', 'NO_READABLE_DOCUMENT',
        'message_vi', 'Chưa có tài liệu đọc được để tạo báo cáo.',
        'message_en', 'There is no readable document available for the report.'
      ));
      v_blocking := v_blocking || jsonb_build_array('NO_READABLE_DOCUMENT');
    end if;
  end if;

  if v_unreadable_file_count > 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'FILE_UNREADABLE',
      'count', v_unreadable_file_count,
      'message_vi', 'Một số tài liệu không đọc được và sẽ không được dùng trong báo cáo.',
      'message_en', 'Some documents are unreadable and will be excluded from the report.'
    ));
  end if;

  if v_mismatch_file_count > 0 then
    v_entity_gate := case when v_usable_file_count = 0 then 'blocked' else 'warning' end;
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'FILE_ENTITY_MISMATCH',
      'count', v_mismatch_file_count,
      'message_vi', 'Một số tài liệu không khớp với doanh nghiệp hoặc tài sản đang đăng và sẽ bị loại khỏi báo cáo.',
      'message_en', 'Some documents do not match the listed Business or asset and will be excluded.'
    ));
    if v_usable_file_count = 0 then
      v_allow_report := false;
      v_blocking := v_blocking || jsonb_build_array('FILE_ENTITY_MISMATCH');
    end if;
  end if;

  if not v_has_documented_revenue then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'DOCUMENT_BACKED_REVENUE_MISSING',
      'message_vi', 'Doanh thu hiện là dữ liệu tự kê khai hoặc chưa đủ độ tin cậy; báo cáo không dùng số này để định giá.',
      'message_en', 'Revenue is self-declared or insufficiently supported; it will not be used for valuation.'
    ));
  end if;

  select exists (
    select 1
    from public.ai_report_alerts a
    where a.business_id = p_business_id
      and a.status in ('open','acknowledged')
      and a.blocks_report is true
      and a.alert_code not in (
        'INSUFFICIENT_FINANCIAL_DATA',
        'FILE_UNREADABLE',
        'FILE_ENTITY_MISMATCH',
        'BROKER_AUTHORITY_MISSING',
        'AUTHORITY_SCOPE_INSUFFICIENT'
      )
  )
  into v_has_external_block;

  if v_has_external_block then
    v_allow_report := false;
    v_blocking := v_blocking || jsonb_build_array('OPEN_BLOCKING_ALERT');
  end if;

  select a.*
    into v_authority
  from public.business_listing_authority a
  where a.business_id = p_business_id;

  v_has_authority := found;

  if v_has_authority then
    if v_authority.report_policy = 'block' then
      v_allow_report := false;
      v_authority_gate := 'blocked';
      v_blocking := v_blocking || jsonb_build_array('AUTHORITY_BLOCKED');
    elsif v_authority.report_policy = 'allow_with_notice' then
      v_authority_gate := 'warning';
      v_notice_required := true;
      v_notice_vi := v_authority.report_notice_vi;
      v_notice_en := v_authority.report_notice_en;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'AUTHORITY_NOTICE_REQUIRED',
        'message_vi', v_notice_vi,
        'message_en', v_notice_en
      ));
    end if;
  end if;

  if not v_allow_report then
    v_grade := 'blocked';
  elsif v_has_documented_revenue and v_fact_count >= 4 and v_mismatch_file_count = 0 then
    v_grade := 'full';
  else
    v_grade := 'limited';
  end if;

  v_allow_valuation :=
    v_allow_report
    and v_has_documented_revenue
    and v_has_documented_ebitda
    and v_has_documented_debt
    and v_has_documented_cash;

  if v_allow_report and (
    not v_has_documented_revenue
    or v_unreadable_file_count > 0
    or v_mismatch_file_count > 0
    or v_pending_file_count > 0
  ) then
    v_data_gate := 'warning';
  elsif not v_allow_report then
    v_data_gate := 'blocked';
  end if;

  select md5(concat_ws('|',
    v_business.id::text,
    coalesce(v_business.updated_at::text, ''),
    coalesce(v_business.public_version::text, ''),
    coalesce((
      select string_agg(
        concat_ws(':',
          f.id::text,
          coalesce(f.updated_at::text, ''),
          coalesce(p.updated_at::text, ''),
          coalesce(p.processing_version, '')
        ),
        ',' order by f.id
      )
      from public.business_files f
      left join public.dataroom_file_processing p on p.business_file_id = f.id
      where f.business_id = p_business_id
    ), ''),
    coalesce((
      select string_agg(
        concat_ws(':',
          df.id::text,
          df.field_key,
          df.confidence::text,
          df.validation_status::text,
          df.updated_at::text
        ),
        ',' order by df.id
      )
      from public.dataroom_facts df
      where df.business_id = p_business_id
    ), ''),
    coalesce(v_authority.updated_at::text, '')
  ))
  into v_source_hash;

  insert into public.ai_report_preflight_checks (
    business_id,
    actor_profile_id,
    audience,
    data_gate_status,
    entity_gate_status,
    authority_gate_status,
    report_grade,
    allow_report,
    allow_valuation,
    authority_notice_required,
    authority_notice_vi,
    authority_notice_en,
    missing_items_json,
    warning_items_json,
    blocking_alerts_json,
    source_hash,
    checked_at
  )
  values (
    p_business_id,
    v_actor_profile_id,
    'business_owner',
    v_data_gate,
    v_entity_gate,
    v_authority_gate,
    v_grade,
    v_allow_report,
    v_allow_valuation,
    v_notice_required,
    v_notice_vi,
    v_notice_en,
    v_missing,
    v_warnings,
    v_blocking,
    v_source_hash,
    now()
  )
  returning id into v_preflight_id;

  if not v_has_documented_revenue then
    perform public.d68_set_ai_report_alert(
      p_business_id,
      v_preflight_id,
      'INSUFFICIENT_FINANCIAL_DATA',
      'warning',
      'Doanh thu chưa có tài liệu chứng minh',
      'Revenue is not document-backed',
      jsonb_build_object('documented_revenue', false),
      false,
      false
    );
  else
    perform public.d68_resolve_ai_report_alert(p_business_id, 'INSUFFICIENT_FINANCIAL_DATA');
  end if;

  if v_unreadable_file_count > 0 then
    perform public.d68_set_ai_report_alert(
      p_business_id,
      v_preflight_id,
      'FILE_UNREADABLE',
      'warning',
      'Có tài liệu không đọc được',
      'Some documents are unreadable',
      jsonb_build_object('count', v_unreadable_file_count),
      false,
      false
    );
  else
    perform public.d68_resolve_ai_report_alert(p_business_id, 'FILE_UNREADABLE');
  end if;

  if v_mismatch_file_count > 0 then
    perform public.d68_set_ai_report_alert(
      p_business_id,
      v_preflight_id,
      'FILE_ENTITY_MISMATCH',
      case when v_usable_file_count = 0 then 'high' else 'warning' end,
      'Tài liệu không khớp hồ sơ doanh nghiệp',
      'Documents do not match the Business profile',
      jsonb_build_object('count', v_mismatch_file_count),
      v_usable_file_count = 0,
      true
    );
  else
    perform public.d68_resolve_ai_report_alert(p_business_id, 'FILE_ENTITY_MISMATCH');
  end if;

  if v_has_authority and v_authority.listing_party_type in ('authorized_broker','authorized_advisor','asset_operator','other') then
    if v_authority.verification_status in ('declared','missing') then
      perform public.d68_set_ai_report_alert(
        p_business_id,
        v_preflight_id,
        'BROKER_AUTHORITY_MISSING',
        'warning',
        'Cần bổ sung tài liệu ủy quyền',
        'Authorization document should be added',
        jsonb_build_object('verification_status', v_authority.verification_status),
        false,
        true
      );
      perform public.d68_resolve_ai_report_alert(p_business_id, 'AUTHORITY_SCOPE_INSUFFICIENT');
    elsif v_authority.verification_status = 'insufficient_scope' then
      perform public.d68_set_ai_report_alert(
        p_business_id,
        v_preflight_id,
        'AUTHORITY_SCOPE_INSUFFICIENT',
        'warning',
        'Phạm vi ủy quyền cần được bổ sung',
        'Authorization scope should be expanded',
        jsonb_build_object('verification_status', v_authority.verification_status),
        false,
        true
      );
      perform public.d68_resolve_ai_report_alert(p_business_id, 'BROKER_AUTHORITY_MISSING');
    else
      perform public.d68_resolve_ai_report_alert(p_business_id, 'BROKER_AUTHORITY_MISSING');
      perform public.d68_resolve_ai_report_alert(p_business_id, 'AUTHORITY_SCOPE_INSUFFICIENT');
    end if;
  else
    perform public.d68_resolve_ai_report_alert(p_business_id, 'BROKER_AUTHORITY_MISSING');
    perform public.d68_resolve_ai_report_alert(p_business_id, 'AUTHORITY_SCOPE_INSUFFICIENT');
  end if;

  return jsonb_build_object(
    'preflight_id', v_preflight_id,
    'business_id', p_business_id,
    'allow_report', v_allow_report,
    'allow_valuation', v_allow_valuation,
    'grade', v_grade,
    'gates', jsonb_build_object(
      'data', v_data_gate,
      'entity', v_entity_gate,
      'authority', v_authority_gate
    ),
    'authority_notice_required', v_notice_required,
    'authority_notice_vi', v_notice_vi,
    'authority_notice_en', v_notice_en,
    'evidence', jsonb_build_object(
      'file_count', v_file_count,
      'candidate_file_count', v_candidate_file_count,
      'usable_file_count', v_usable_file_count,
      'pending_file_count', v_pending_file_count,
      'unreadable_file_count', v_unreadable_file_count,
      'mismatch_file_count', v_mismatch_file_count,
      'documented_fact_count', v_fact_count,
      'documented_revenue', v_has_documented_revenue
    ),
    'missing', v_missing,
    'warnings', v_warnings,
    'blocking', v_blocking,
    'source_hash', v_source_hash,
    'checked_at', now()
  );
end;
$$;

create or replace function public.d68_get_business_report_status(
  p_business_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_is_admin boolean := coalesce((select public.is_admin()), false);
  v_business public.businesses%rowtype;
  v_preflight public.ai_report_preflight_checks%rowtype;
  v_active_request public.ai_report_business_requests%rowtype;
  v_last_completed_at timestamptz;
  v_next_allowed_at timestamptz;
  v_account_enabled boolean := false;
  v_can_request boolean := false;
  v_reason text;
begin
  select b.*
    into v_business
  from public.businesses b
  where b.id = p_business_id;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if not v_is_service
     and not v_is_admin
     and (v_actor is null or v_business.owner_id is distinct from v_actor) then
    raise exception 'business_report_access_denied' using errcode = '42501';
  end if;

  v_account_enabled :=
    v_business.status::text = 'active'
    and v_business.visible is true
    and v_business.public_snapshot_json is not null;

  select p.*
    into v_preflight
  from public.ai_report_preflight_checks p
  where p.business_id = p_business_id
    and p.audience = 'business_owner'
  order by p.checked_at desc
  limit 1;

  select r.*
    into v_active_request
  from public.ai_report_business_requests r
  where r.business_id = p_business_id
    and r.status = 'reserved'
    and r.reserved_until > now()
  order by r.reserved_at desc
  limit 1;

  select max(r.completed_at)
    into v_last_completed_at
  from public.ai_report_business_requests r
  where r.business_id = p_business_id
    and r.status = 'completed';

  if v_last_completed_at is not null then
    v_next_allowed_at := v_last_completed_at + interval '60 minutes';
  end if;

  if not v_account_enabled then
    v_reason := 'BUSINESS_NOT_ACTIVE';
  elsif v_active_request.id is not null then
    v_reason := 'REPORT_IN_PROGRESS';
  elsif v_next_allowed_at is not null and v_next_allowed_at > now() then
    v_reason := 'RATE_LIMITED';
  elsif v_preflight.id is null then
    v_reason := 'PREFLIGHT_REQUIRED';
  elsif v_preflight.allow_report is false then
    v_reason := 'PREFLIGHT_BLOCKED';
  else
    v_can_request := true;
    v_reason := 'READY';
  end if;

  return jsonb_build_object(
    'business_id', p_business_id,
    'account_enabled', v_account_enabled,
    'can_request', v_can_request,
    'reason', v_reason,
    'rate_limit_minutes', 60,
    'active_request_id', v_active_request.id,
    'active_request_until', v_active_request.reserved_until,
    'last_completed_at', v_last_completed_at,
    'next_allowed_at', v_next_allowed_at,
    'latest_preflight', case when v_preflight.id is null then null else jsonb_build_object(
      'id', v_preflight.id,
      'allow_report', v_preflight.allow_report,
      'allow_valuation', v_preflight.allow_valuation,
      'grade', v_preflight.report_grade,
      'data_gate', v_preflight.data_gate_status,
      'entity_gate', v_preflight.entity_gate_status,
      'authority_gate', v_preflight.authority_gate_status,
      'authority_notice_required', v_preflight.authority_notice_required,
      'authority_notice_vi', v_preflight.authority_notice_vi,
      'authority_notice_en', v_preflight.authority_notice_en,
      'missing', v_preflight.missing_items_json,
      'warnings', v_preflight.warning_items_json,
      'blocking', v_preflight.blocking_alerts_json,
      'source_hash', v_preflight.source_hash,
      'checked_at', v_preflight.checked_at
    ) end
  );
end;
$$;

create or replace function public.d68_reserve_business_report_request(
  p_business_id uuid,
  p_request_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_is_service boolean := coalesce((select auth.role()), '') = 'service_role';
  v_is_admin boolean := coalesce((select public.is_admin()), false);
  v_actor_profile_id uuid;
  v_business public.businesses%rowtype;
  v_existing public.ai_report_business_requests%rowtype;
  v_last_completed_at timestamptz;
  v_next_allowed_at timestamptz;
  v_request_id uuid;
  v_retry_after integer := 0;
  v_preflight jsonb;
begin
  if p_request_key is not null and length(p_request_key) > 200 then
    raise exception 'request_key_too_long' using errcode = '22001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('d68-report-request:' || p_business_id::text, 0));

  select b.*
    into v_business
  from public.businesses b
  where b.id = p_business_id;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if not v_is_service
     and not v_is_admin
     and (v_actor is null or v_business.owner_id is distinct from v_actor) then
    raise exception 'business_report_access_denied' using errcode = '42501';
  end if;

  if v_business.status::text <> 'active'
     or v_business.visible is not true
     or v_business.public_snapshot_json is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'BUSINESS_NOT_ACTIVE',
      'rate_limit_minutes', 60
    );
  end if;

  if v_actor is not null and exists (select 1 from public.profiles p where p.id = v_actor) then
    v_actor_profile_id := v_actor;
  end if;

  if p_request_key is not null then
    select r.*
      into v_existing
    from public.ai_report_business_requests r
    where r.business_id = p_business_id
      and r.actor_profile_id is not distinct from v_actor_profile_id
      and r.request_key = p_request_key
    order by r.created_at desc
    limit 1;

    if found then
      return jsonb_build_object(
        'allowed', v_existing.status = 'reserved',
        'idempotent', true,
        'reason', case
          when v_existing.status = 'reserved' then 'REPORT_IN_PROGRESS'
          when v_existing.status = 'completed' then 'ALREADY_COMPLETED'
          else 'PREVIOUS_REQUEST_RELEASED'
        end,
        'request_id', v_existing.id,
        'status', v_existing.status,
        'reserved_until', v_existing.reserved_until,
        'completed_at', v_existing.completed_at,
        'rate_limit_minutes', 60
      );
    end if;
  end if;

  v_preflight := public.d68_run_business_report_preflight(p_business_id);

  if not coalesce((v_preflight ->> 'allow_report')::boolean, false) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'PREFLIGHT_BLOCKED',
      'preflight', v_preflight,
      'rate_limit_minutes', 60
    );
  end if;

  update public.ai_report_business_requests
  set status = 'failed',
      failed_at = now(),
      error_code = 'RESERVATION_EXPIRED',
      updated_at = now()
  where business_id = p_business_id
    and status = 'reserved'
    and reserved_until <= now();

  select r.*
    into v_existing
  from public.ai_report_business_requests r
  where r.business_id = p_business_id
    and r.status = 'reserved'
    and r.reserved_until > now()
  order by r.reserved_at desc
  limit 1;

  if found then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_existing.reserved_until - now())))::integer);
    return jsonb_build_object(
      'allowed', false,
      'reason', 'REPORT_IN_PROGRESS',
      'request_id', v_existing.id,
      'retry_after_seconds', v_retry_after,
      'next_allowed_at', v_existing.reserved_until,
      'rate_limit_minutes', 60
    );
  end if;

  select max(r.completed_at)
    into v_last_completed_at
  from public.ai_report_business_requests r
  where r.business_id = p_business_id
    and r.status = 'completed';

  if v_last_completed_at is not null then
    v_next_allowed_at := v_last_completed_at + interval '60 minutes';
  end if;

  if v_next_allowed_at is not null and v_next_allowed_at > now() then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_next_allowed_at - now())))::integer);
    return jsonb_build_object(
      'allowed', false,
      'reason', 'RATE_LIMITED',
      'retry_after_seconds', v_retry_after,
      'next_allowed_at', v_next_allowed_at,
      'rate_limit_minutes', 60
    );
  end if;

  insert into public.ai_report_business_requests (
    business_id,
    actor_profile_id,
    request_key,
    status,
    reserved_at,
    reserved_until
  )
  values (
    p_business_id,
    v_actor_profile_id,
    nullif(p_request_key, ''),
    'reserved',
    now(),
    now() + interval '15 minutes'
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'allowed', true,
    'reason', 'RESERVED',
    'request_id', v_request_id,
    'reserved_until', now() + interval '15 minutes',
    'rate_limit_minutes', 60
  );
end;
$$;

create or replace function public.d68_complete_business_report_request(
  p_request_id uuid,
  p_report_id uuid default null,
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
    raise exception 'report_request_completion_denied' using errcode = '42501';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'report_request_metadata_must_be_object' using errcode = '22023';
  end if;

  select r.*
    into v_request
  from public.ai_report_business_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'report_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object(
      'completed', true,
      'idempotent', true,
      'request_id', v_request.id,
      'report_id', v_request.report_id,
      'completed_at', v_request.completed_at,
      'next_allowed_at', v_request.completed_at + interval '60 minutes'
    );
  end if;

  if v_request.status <> 'reserved' then
    raise exception 'report_request_not_reservable' using errcode = '55000';
  end if;

  update public.ai_report_business_requests
  set status = 'completed',
      report_id = p_report_id,
      completed_at = now(),
      metadata = metadata || p_metadata,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  return jsonb_build_object(
    'completed', true,
    'idempotent', false,
    'request_id', v_request.id,
    'report_id', v_request.report_id,
    'completed_at', v_request.completed_at,
    'next_allowed_at', v_request.completed_at + interval '60 minutes',
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
    raise exception 'report_request_failure_denied' using errcode = '42501';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'report_request_metadata_must_be_object' using errcode = '22023';
  end if;

  select r.*
    into v_request
  from public.ai_report_business_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'report_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status in ('failed','cancelled') then
    return jsonb_build_object(
      'released', true,
      'idempotent', true,
      'request_id', v_request.id,
      'status', v_request.status
    );
  end if;

  if v_request.status = 'completed' then
    raise exception 'completed_report_request_cannot_fail' using errcode = '55000';
  end if;

  update public.ai_report_business_requests
  set status = 'failed',
      failed_at = now(),
      error_code = coalesce(nullif(trim(p_error_code), ''), 'REPORT_REQUEST_FAILED'),
      metadata = metadata || p_metadata,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  return jsonb_build_object(
    'released', true,
    'idempotent', false,
    'request_id', v_request.id,
    'status', v_request.status
  );
end;
$$;

revoke all on function public.d68_set_ai_report_alert(uuid,uuid,public.d68_ai_report_alert_code,public.d68_ai_report_alert_severity,text,text,jsonb,boolean,boolean) from public;
revoke all on function public.d68_resolve_ai_report_alert(uuid,public.d68_ai_report_alert_code) from public;
revoke all on function public.d68_run_business_report_preflight(uuid) from public;
revoke all on function public.d68_get_business_report_status(uuid) from public;
revoke all on function public.d68_reserve_business_report_request(uuid,text) from public;
revoke all on function public.d68_complete_business_report_request(uuid,uuid,jsonb) from public;
revoke all on function public.d68_fail_business_report_request(uuid,text,jsonb) from public;

grant execute on function public.d68_run_business_report_preflight(uuid) to authenticated, service_role;
grant execute on function public.d68_get_business_report_status(uuid) to authenticated, service_role;
grant execute on function public.d68_reserve_business_report_request(uuid,text) to authenticated, service_role;
grant execute on function public.d68_complete_business_report_request(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.d68_fail_business_report_request(uuid,text,jsonb) to authenticated, service_role;

comment on function public.d68_run_business_report_preflight(uuid) is
  'Runs deterministic Business report eligibility checks. Missing or insufficient broker authority is non-blocking and requires the mandatory notice.';

comment on function public.d68_reserve_business_report_request(uuid,text) is
  'Reserves one combined Business report create-download workflow; no more than one completed workflow per rolling 60 minutes.';

comment on function public.d68_complete_business_report_request(uuid,uuid,jsonb) is
  'Marks a Business report create-download workflow completed and starts its rolling 60-minute limit.';

comment on function public.d68_fail_business_report_request(uuid,text,jsonb) is
  'Releases a failed Business report workflow without consuming the rolling 60-minute limit.';

notify pgrst, 'reload schema';