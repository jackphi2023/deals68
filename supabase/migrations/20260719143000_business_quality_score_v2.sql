-- Business Quality Score V2
-- - Keeps the public six-dimension model.
-- - Transaction readiness is 20 points, including a hidden 10-point
--   provisional Data Room readiness component.
-- - Scores approved evidence, not filenames/uploads that are still pending.

update public.quality_score_config
set is_active = false,
    updated_at = now()
where is_active = true;

insert into public.quality_score_config (
  version,
  is_active,
  name,
  config,
  updated_at
)
select
  2,
  true,
  'Business Quality Score v2',
  jsonb_build_object(
    'weights', jsonb_build_object(
      'profile', 20,
      'financial', 20,
      'documents', 20,
      'images', 5,
      'valuation', 15,
      'readiness', 20
    ),
    'bands', jsonb_build_object(
      'needs_data', 0,
      'developing', 40,
      'good', 65,
      'strong', 80
    ),
    'data_room', jsonb_build_object(
      'hidden', true,
      'max', 10,
      'catalog_mode', 'provisional_v1'
    )
  ),
  now()
where not exists (
  select 1 from public.quality_score_config where version = 2
);

update public.quality_score_config
set is_active = true,
    name = 'Business Quality Score v2',
    config = jsonb_build_object(
      'weights', jsonb_build_object(
        'profile', 20,
        'financial', 20,
        'documents', 20,
        'images', 5,
        'valuation', 15,
        'readiness', 20
      ),
      'bands', jsonb_build_object(
        'needs_data', 0,
        'developing', 40,
        'good', 65,
        'strong', 80
      ),
      'data_room', jsonb_build_object(
        'hidden', true,
        'max', 10,
        'catalog_mode', 'provisional_v1'
      )
    ),
    updated_at = now()
where version = 2;

create or replace function public.active_quality_score_config()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (
      select config
      from public.quality_score_config
      where is_active = true
      order by version desc
      limit 1
    ),
    '{"weights":{"profile":20,"financial":20,"documents":20,"images":5,"valuation":15,"readiness":20},"data_room":{"hidden":true,"max":10,"catalog_mode":"provisional_v1"}}'::jsonb
  );
$function$;

create or replace function public.calculate_business_quality_score_payload(
  business_uuid uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  b public.businesses%rowtype;
  cfg jsonb := public.active_quality_score_config();
  weights jsonb := cfg -> 'weights';
  w_profile numeric := coalesce((weights ->> 'profile')::numeric, 20);
  w_financial numeric := coalesce((weights ->> 'financial')::numeric, 20);
  w_documents numeric := coalesce((weights ->> 'documents')::numeric, 20);
  w_images numeric := coalesce((weights ->> 'images')::numeric, 5);
  w_valuation numeric := coalesce((weights ->> 'valuation')::numeric, 15);
  w_readiness numeric := coalesce((weights ->> 'readiness')::numeric, 20);
  fi jsonb := '{}'::jsonb;
  source_key text := '';
  source_factor numeric := 0.25;
  evidence_factor numeric := 0.50;
  effective_financial_factor numeric := 0.25;
  has_revenue boolean := false;
  has_revenue_month boolean := false;
  has_ebitda boolean := false;
  has_growth boolean := false;
  has_fin_source boolean := false;
  has_assets boolean := false;
  has_ask boolean := false;
  has_stake boolean := false;
  has_transaction_structure boolean := false;
  financial_consistent boolean := false;
  approved_file_count int := 0;
  approved_image_count int := 0;
  profile_doc_count int := 0;
  financial_doc_count int := 0;
  data_doc_count int := 0;
  legal_doc_count int := 0;
  asset_doc_count int := 0;
  ownership_doc_count int := 0;
  proposals_sent int := 0;
  proposals_connected int := 0;
  interests_total int := 0;
  interests_handled int := 0;
  requests_total int := 0;
  requests_handled int := 0;
  profile_score numeric := 0;
  financial_raw_score numeric := 0;
  financial_score numeric := 0;
  documents_score numeric := 0;
  images_score numeric := 0;
  valuation_score numeric := 0;
  transaction_score numeric := 0;
  data_room_score numeric := 0;
  readiness_score numeric := 0;
  total_auto numeric := 0;
  total_final numeric := 0;
  self_v numeric := 0;
  bench_low_v numeric := 0;
  bench_mid_v numeric := 0;
  bench_high_v numeric := 0;
  below_pct numeric := 0;
  above_pct numeric := 0;
  valuation_reason_score numeric := 0;
  has_benchmark boolean := false;
  has_self boolean := false;
  transaction_basis text := 'operating_business';
  valuation_verdict text := 'missing';
  profile_status_vi text := 'Chưa đầy đủ';
  profile_status_en text := 'Incomplete';
  profile_suggestion_vi text := 'Bổ sung mô tả, điểm nổi bật và lý do giao dịch.';
  profile_suggestion_en text := 'Add the overview, highlights and transaction rationale.';
  financial_status_vi text := 'Chưa đủ dữ liệu';
  financial_status_en text := 'Insufficient data';
  financial_suggestion_vi text := 'Bổ sung doanh thu, EBITDA và nguồn số liệu.';
  financial_suggestion_en text := 'Add revenue, EBITDA and the data source.';
  documents_status_vi text := 'Chưa có';
  documents_status_en text := 'None';
  documents_suggestion_vi text := 'Tải Teaser/IM, báo cáo tài chính và hồ sơ pháp lý để Admin duyệt.';
  documents_suggestion_en text := 'Upload a Teaser/IM, financial statements and legal documents for Admin review.';
  images_status_vi text := 'Chưa có';
  images_status_en text := 'None';
  images_suggestion_vi text := 'Tải ảnh doanh nghiệp rõ nét để Admin duyệt.';
  images_suggestion_en text := 'Upload clear business images for Admin review.';
  valuation_status_vi text := 'Chưa đủ dữ liệu định giá';
  valuation_status_en text := 'Valuation data incomplete';
  valuation_suggestion_vi text := 'Bổ sung giá chào, tỷ lệ giao dịch và dữ liệu tham chiếu.';
  valuation_suggestion_en text := 'Add the offer amount, transaction percentage and benchmark inputs.';
  readiness_status_vi text := 'Đang chuẩn bị';
  readiness_status_en text := 'Preparing';
  readiness_suggestion_vi text := 'Hoàn thiện tài liệu chứng minh và xử lý các yêu cầu dữ liệu trước khi giao dịch.';
  readiness_suggestion_en text := 'Complete supporting documents and handle data requests before a transaction.';
  data_room_status_vi text := 'Chưa sẵn sàng';
  data_room_status_en text := 'Not ready';
  items jsonb := '[]'::jsonb;
  flags jsonb := '[]'::jsonb;
begin
  select * into b from public.businesses where id = business_uuid;
  if b.id is null then
    return jsonb_build_object('version', 2, 'total', 0, 'error', 'business_not_found');
  end if;

  fi := coalesce(b.financial_input, '{}'::jsonb);
  source_key := lower(coalesce(
    nullif(fi ->> 'financial_source', ''),
    nullif(fi ->> 'financial_data_source', ''),
    nullif(fi ->> 'source', ''),
    ''
  ));
  has_revenue := coalesce(b.revenue_2025, 0) > 0;
  has_revenue_month := coalesce(b.revenue_month, nullif(fi ->> 'revenue_month', '')::numeric, 0) > 0;
  has_ebitda := b.ebitda_margin is not null;
  has_growth := b.growth_pct is not null or fi ? 'growth_pct';
  has_fin_source := source_key <> '';
  has_assets := coalesce(
    nullif(fi ->> 'assets_owned', ''),
    nullif(fi ->> 'assets_owned_vi', ''),
    nullif(fi ->> 'included_tangible_assets', ''),
    nullif(fi ->> 'included_tangible_assets_vi', ''),
    nullif(fi ->> 'excluded_physical_asset_value', ''),
    nullif(fi ->> 'excluded_physical_asset_value_vi', '')
  ) is not null;
  has_ask := coalesce(b.ask_amount, b.offer_amount, 0) > 0;
  has_stake := coalesce(b.stake_pct, b.offer_stake_pct, 0) > 0;
  has_transaction_structure := has_ask and (
    has_stake or lower(coalesce(b.deal_type, '')) ~ '(asset|tài sản|tai san|loan|debt|vay|jv|partner|đối tác|doi tac|transfer|chuyển)'
  );
  if has_revenue and has_revenue_month then
    financial_consistent := abs(
      coalesce(b.revenue_2025, 0) - coalesce(b.revenue_month, nullif(fi ->> 'revenue_month', '')::numeric, 0) * 12
    ) / greatest(coalesce(b.revenue_2025, 0), 1) <= 0.25;
  end if;

  with approved_files as (
    select lower(coalesce(category, '') || ' ' || coalesce(file_name, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(file_type, '')) as metadata
    from public.business_files
    where business_id = business_uuid and lower(coalesce(review_status, '')) = 'approved'
  )
  select
    count(*),
    count(*) filter (where metadata ~ '(teaser|investment memorandum|pitch deck|business profile|company profile|hồ sơ doanh nghiệp|ho so doanh nghiep)'),
    count(*) filter (where metadata ~ '(financial|finance|báo cáo tài chính|bao cao tai chinh|management account|excel|xls|xlsx|doanh thu|revenue|ebitda|profit|p&l|statement|tax|thuế|thue|audit|kiểm toán|kiem toan)'),
    count(*) filter (where metadata ~ '(model|forecast|dự báo|du bao|kpi|sales data|revenue data|management report)'),
    count(*) filter (where metadata ~ '(legal|license|registration|giấy phép|giay phep|đăng ký doanh nghiệp|dang ky doanh nghiep|contract|hợp đồng|hop dong|tax code)'),
    count(*) filter (where metadata ~ '(asset|property|land|title deed|ownership certificate|tài sản|tai san|đất|dat|sổ đỏ|so do|quyền sử dụng đất|quyen su dung dat)'),
    count(*) filter (where metadata ~ '(cap table|shareholder|ownership structure|cổ đông|co dong|cơ cấu sở hữu|co cau so huu)')
  into approved_file_count, profile_doc_count, financial_doc_count, data_doc_count, legal_doc_count, asset_doc_count, ownership_doc_count
  from approved_files;

  select count(*) into approved_image_count
  from public.business_images
  where business_id = business_uuid
    and lower(coalesce(review_status, '')) = 'approved'
    and coalesce(is_sanitized, false) = true;

  select count(*) into proposals_sent from public.proposals where business_id = business_uuid;
  select count(*) into proposals_connected from public.proposals
  where business_id = business_uuid and lower(coalesce(status::text, '')) in ('approved', 'connected', 'fulfilled');
  select count(*), count(*) filter (where lower(coalesce(status::text, '')) in ('approved', 'connected', 'rejected'))
  into interests_total, interests_handled from public.investor_interests where business_id = business_uuid;
  select count(*), count(*) filter (where lower(coalesce(status::text, '')) in ('fulfilled', 'approved', 'connected', 'rejected'))
  into requests_total, requests_handled from public.request_data where business_id = business_uuid;

  profile_score :=
    case when nullif(trim(coalesce(b.company_name_private, '')), '') is not null then 2 else 0 end +
    case when nullif(trim(coalesce(b.title_vi, '')), '') is not null then 2 else 0 end +
    case when length(trim(coalesce(b.description_vi, ''))) >= 120 then 4 when length(trim(coalesce(b.description_vi, ''))) >= 60 then 2 when length(trim(coalesce(b.description_vi, ''))) > 0 then 1 else 0 end +
    case when nullif(trim(coalesce(b.industry, '')), '') is not null then 2 else 0 end +
    case when nullif(trim(coalesce(b.city, b.country_iso2, '')), '') is not null then 2 else 0 end +
    case when nullif(trim(coalesce(b.deal_type, '')), '') is not null then 2 else 0 end +
    case when length(trim(coalesce(b.highlights_vi, ''))) >= 80 then 3 when length(trim(coalesce(b.highlights_vi, ''))) >= 30 then 1 else 0 end +
    case when length(trim(coalesce(b.investment_reason_vi, ''))) >= 10 then 3 else 0 end;
  profile_score := least(w_profile, profile_score);
  if profile_score >= 18 then
    profile_status_vi := 'Đầy đủ'; profile_status_en := 'Complete';
    profile_suggestion_vi := 'Duy trì thông tin chính xác và cập nhật khi có thay đổi.';
    profile_suggestion_en := 'Keep the information accurate and update it when circumstances change.';
  elsif profile_score >= 12 then
    profile_status_vi := 'Đã có phần lớn thông tin'; profile_status_en := 'Mostly complete';
  end if;

  financial_raw_score :=
    case when has_revenue then 5 else 0 end + case when has_revenue_month then 2 else 0 end +
    case when has_ebitda then 4 else 0 end + case when has_growth then 2 else 0 end +
    case when has_fin_source then 2 else 0 end + case when has_assets then 2 else 0 end +
    case when financial_consistent then 2 else 0 end +
    case when upper(coalesce(b.revenue_currency, '')) in ('VND', 'USD') then 1 else 0 end;
  financial_raw_score := least(20, financial_raw_score);
  source_factor := case
    when source_key ~ '(audited|audit|kiểm toán|kiem toan)' then 1.00
    when source_key ~ '(tax|thuế|thue)' then 0.90
    when source_key ~ '(bank|pos|accounting software|software|api)' then 0.75
    when source_key ~ '(management|internal|quản trị|quan tri)' then 0.55
    when source_key ~ '(estimate|ước tính|uoc tinh|founder)' then 0.35
    when source_key <> '' then 0.50 else 0.25 end;
  evidence_factor := case when financial_doc_count >= 2 then 1.00 when financial_doc_count = 1 then 0.80 else 0.50 end;
  effective_financial_factor := least(source_factor, evidence_factor);
  financial_score := least(w_financial, round(financial_raw_score * effective_financial_factor));
  if financial_raw_score = 0 then
    financial_status_vi := 'Chưa đủ dữ liệu'; financial_status_en := 'Insufficient data';
  elsif financial_doc_count = 0 then
    financial_status_vi := 'Đã khai báo, chưa được chứng minh'; financial_status_en := 'Declared, not yet evidenced';
    financial_suggestion_vi := 'Tải báo cáo tài chính, Excel số liệu hoặc chứng từ nguồn để Admin duyệt.';
    financial_suggestion_en := 'Upload financial statements, data spreadsheets or source evidence for Admin review.';
  elsif source_factor < 0.75 then
    financial_status_vi := 'Đã có tài liệu, cần xác minh thêm'; financial_status_en := 'Documents available, further verification needed';
  elsif not financial_consistent and has_revenue and has_revenue_month then
    financial_status_vi := 'Có tài liệu, cần đối chiếu số liệu'; financial_status_en := 'Documented, reconciliation needed';
  else
    financial_status_vi := 'Có dữ liệu và tài liệu chứng minh'; financial_status_en := 'Data supported by documents';
  end if;

  documents_score := least(w_documents,
    (case when profile_doc_count > 0 then 6 else 0 end) + (case when financial_doc_count > 0 then 7 else 0 end) +
    (case when data_doc_count > 0 then 2 else 0 end) + (case when legal_doc_count > 0 then 3 else 0 end) +
    (case when asset_doc_count > 0 then 1 else 0 end) + (case when ownership_doc_count > 0 then 1 else 0 end));
  if approved_file_count = 0 then
    documents_status_vi := 'Chưa có'; documents_status_en := 'None';
  elsif documents_score < 10 then
    documents_status_vi := 'Thiếu tài liệu trọng yếu'; documents_status_en := 'Key documents missing';
  elsif documents_score < 17 then
    documents_status_vi := 'Đã có một phần'; documents_status_en := 'Partially available';
  else
    documents_status_vi := 'Tương đối đầy đủ'; documents_status_en := 'Substantially complete';
  end if;

  images_score := least(w_images, approved_image_count);
  if approved_image_count >= 5 then
    images_status_vi := 'Đầy đủ'; images_status_en := 'Complete';
  elsif approved_image_count > 0 then
    images_status_vi := 'Đã có, cần bổ sung'; images_status_en := 'Available, more needed';
  end if;

  self_v := coalesce(b.self_valuation,
    case when has_ask and has_stake then coalesce(b.ask_amount, b.offer_amount, 0) / greatest(coalesce(b.stake_pct, b.offer_stake_pct, 0), 0.000001) * 100 else 0 end);
  bench_low_v := coalesce(b.bench_low, nullif(b.valuation_factors ->> 'low', '')::numeric, 0);
  bench_mid_v := coalesce(b.bench_mid, nullif(b.valuation_factors ->> 'mid', '')::numeric, 0);
  bench_high_v := coalesce(b.bench_high, nullif(b.valuation_factors ->> 'high', '')::numeric, 0);
  has_benchmark := bench_mid_v > 0 and bench_low_v > 0 and bench_high_v > 0;
  has_self := self_v > 0;
  transaction_basis := case
    when lower(coalesce(b.deal_type, '')) ~ '(asset|tài sản|tai san)' then 'asset_sale'
    when has_assets then 'mixed_business_and_assets'
    else 'operating_business' end;
  valuation_score := case when has_ask then 2 else 0 end + case when has_stake or transaction_basis = 'asset_sale' then 2 else 0 end + case when has_benchmark then 1 else 0 end;
  if not has_self or not has_benchmark then
    valuation_verdict := 'missing'; valuation_reason_score := 0;
  elsif self_v < bench_low_v then
    below_pct := (bench_low_v - self_v) / greatest(bench_low_v, 1);
    if below_pct <= 0.15 then valuation_verdict := 'below_low_0_15'; valuation_reason_score := 9;
    elsif below_pct <= 0.35 then valuation_verdict := 'below_low_15_35'; valuation_reason_score := 10;
    else valuation_verdict := 'below_low_over_35'; valuation_reason_score := 6; end if;
  elsif self_v <= bench_high_v then
    valuation_verdict := 'in_range'; valuation_reason_score := 10;
  else
    above_pct := (self_v - bench_high_v) / greatest(bench_high_v, 1);
    if above_pct <= 0.15 then valuation_verdict := 'above_high_0_15'; valuation_reason_score := 8;
    elsif above_pct <= 0.35 then valuation_verdict := 'above_high_15_35'; valuation_reason_score := 6;
    elsif above_pct <= 0.60 then valuation_verdict := 'above_high_35_60'; valuation_reason_score := 3;
    else valuation_verdict := 'above_high_over_60'; valuation_reason_score := 0; end if;
  end if;
  valuation_score := least(w_valuation, valuation_score + valuation_reason_score);
  if valuation_verdict = 'missing' then
    valuation_status_vi := 'Chưa đủ dữ liệu định giá'; valuation_status_en := 'Valuation data incomplete';
  elsif valuation_verdict = 'in_range' then
    valuation_status_vi := 'Trong khoảng tham chiếu'; valuation_status_en := 'Within benchmark range';
  elsif valuation_verdict = 'above_high_over_60' and has_assets and asset_doc_count = 0 then
    valuation_status_vi := 'Cần xác minh cơ sở tài sản'; valuation_status_en := 'Asset basis requires verification';
    valuation_suggestion_vi := 'Bổ sung giấy tờ tài sản, phạm vi tài sản đưa vào giao dịch và báo cáo định giá độc lập.';
    valuation_suggestion_en := 'Add asset-title documents, the included-asset scope and an independent valuation.';
  elsif valuation_verdict like 'above_high%' then
    valuation_status_vi := 'Định giá cao, cần bổ sung cơ sở'; valuation_status_en := 'High valuation, supporting basis needed';
  elsif valuation_verdict like 'below_low%' then
    valuation_status_vi := 'Cần xác minh dữ liệu đầu vào'; valuation_status_en := 'Input data requires verification';
  end if;

  transaction_score :=
    case when b.public_snapshot_json is not null and b.visible = true and b.status = 'active' then 2 else 0 end +
    case when b.pending_changes_json is null then 1 else 0 end +
    case when has_transaction_structure then 2 else 0 end +
    case when nullif(trim(coalesce(b.company_name_private, '')), '') is not null then 1 else 0 end +
    case when proposals_connected > 0 or interests_handled > 0 then 2 else 0 end +
    case when requests_total > 0 and requests_handled >= requests_total then 2 when requests_handled > 0 then 1 else 0 end;
  transaction_score := least(10, transaction_score);

  data_room_score :=
    case when profile_doc_count > 0 then 2 else 0 end + case when financial_doc_count > 0 then 3 else 0 end +
    case when legal_doc_count > 0 then 2 else 0 end + case when data_doc_count > 0 then 1 else 0 end +
    case when ownership_doc_count > 0 then 1 else 0 end + case when asset_doc_count > 0 then 1 else 0 end;
  data_room_score := least(10, data_room_score);
  if data_room_score >= 8 then data_room_status_vi := 'Sẵn sàng'; data_room_status_en := 'Ready';
  elsif data_room_score >= 4 then data_room_status_vi := 'Đang hoàn thiện'; data_room_status_en := 'In progress'; end if;
  readiness_score := least(w_readiness, transaction_score + data_room_score);
  if transaction_score >= 8 and data_room_score >= 7 then
    readiness_status_vi := 'Sẵn sàng'; readiness_status_en := 'Ready';
  elsif readiness_score >= 10 then
    readiness_status_vi := 'Đang hoàn thiện'; readiness_status_en := 'In progress';
  end if;

  total_auto := least(100, greatest(0, round(profile_score + financial_score + documents_score + images_score + valuation_score + readiness_score)));
  total_final := case when coalesce(b.quality_score_manual_override, false) and coalesce(b.quality_score, 0) between 0 and 100 then round(b.quality_score) else total_auto end;

  items := jsonb_build_array(
    jsonb_build_object('key','profile','label_vi','Thông tin hồ sơ','label_en','Profile information','score',round(profile_score),'max',w_profile,'status_vi',profile_status_vi,'status_en',profile_status_en,'suggestion_vi',profile_suggestion_vi,'suggestion_en',profile_suggestion_en,'public',true),
    jsonb_build_object('key','financial','label_vi','Số liệu tài chính','label_en','Financial data','score',round(financial_score),'max',w_financial,'status_vi',financial_status_vi,'status_en',financial_status_en,'suggestion_vi',financial_suggestion_vi,'suggestion_en',financial_suggestion_en,'public',true),
    jsonb_build_object('key','documents','label_vi','Tài liệu','label_en','Documents','score',round(documents_score),'max',w_documents,'status_vi',documents_status_vi,'status_en',documents_status_en,'suggestion_vi',documents_suggestion_vi,'suggestion_en',documents_suggestion_en,'public',true),
    jsonb_build_object('key','images','label_vi','Hình ảnh','label_en','Images','score',round(images_score),'max',w_images,'status_vi',images_status_vi,'status_en',images_status_en,'suggestion_vi',images_suggestion_vi,'suggestion_en',images_suggestion_en,'public',true),
    jsonb_build_object('key','valuation','label_vi','Định giá','label_en','Valuation','score',round(valuation_score),'max',w_valuation,'status_vi',valuation_status_vi,'status_en',valuation_status_en,'suggestion_vi',valuation_suggestion_vi,'suggestion_en',valuation_suggestion_en,'verdict',valuation_verdict,'public',true),
    jsonb_build_object('key','readiness','label_vi','Sẵn sàng giao dịch','label_en','Transaction readiness','score',round(readiness_score),'max',w_readiness,'status_vi',readiness_status_vi,'status_en',readiness_status_en,'suggestion_vi',readiness_suggestion_vi,'suggestion_en',readiness_suggestion_en,'public',true)
  );
  flags := jsonb_build_array(
    case when profile_score >= 18 then 'profile_complete' else 'profile_incomplete' end,
    case when financial_raw_score = 0 then 'financial_missing' when financial_doc_count = 0 then 'financial_claimed_unverified' else 'financial_evidence_present' end,
    case when approved_file_count = 0 then 'documents_none' else 'documents_present' end,
    case when approved_image_count > 0 then 'approved_images_present' else 'approved_images_missing' end,
    valuation_verdict,
    case when readiness_score >= 10 then 'readiness_in_progress' else 'readiness_preparing' end,
    case when data_room_score >= 8 then 'data_room_ready_hidden' else 'data_room_not_ready_hidden' end
  );

  return jsonb_build_object(
    'version',2,'model','business_quality_v2','total',total_final,'auto_total',total_auto,
    'manual_override',coalesce(b.quality_score_manual_override,false),'calculated_at',now(),'items',items,'flags',flags,'weights',weights,
    'counts',jsonb_build_object('approved_files',approved_file_count,'approved_images',approved_image_count,'profile_docs',profile_doc_count,'financial_docs',financial_doc_count,'data_docs',data_doc_count,'legal_docs',legal_doc_count,'asset_docs',asset_doc_count,'ownership_docs',ownership_doc_count,'proposals_sent',proposals_sent,'proposals_connected',proposals_connected,'investor_interests',interests_total,'investor_interests_handled',interests_handled,'data_requests',requests_total,'data_requests_handled',requests_handled),
    'financial',jsonb_build_object('raw_score',round(financial_raw_score),'source',nullif(source_key,''),'source_factor',source_factor,'evidence_factor',evidence_factor,'effective_factor',effective_financial_factor,'consistent',financial_consistent),
    'valuation',jsonb_build_object('self',nullif(self_v,0),'bench_low',nullif(bench_low_v,0),'bench_mid',nullif(bench_mid_v,0),'bench_high',nullif(bench_high_v,0),'verdict',valuation_verdict,'transaction_basis',transaction_basis,'below_pct',case when below_pct>0 then round(below_pct*100) else null end,'above_pct',case when above_pct>0 then round(above_pct*100) else null end),
    'readiness',jsonb_build_object('transaction_score',round(transaction_score),'transaction_max',10,'data_room_score',round(data_room_score),'data_room_max',10),
    'data_room',jsonb_build_object('hidden',true,'catalog_mode','provisional_v1','score',round(data_room_score),'max',10,'status_vi',data_room_status_vi,'status_en',data_room_status_en,'requirements',jsonb_build_object('profile',profile_doc_count>0,'financial',financial_doc_count>0,'legal',legal_doc_count>0,'operating_data',data_doc_count>0,'ownership',ownership_doc_count>0,'assets',asset_doc_count>0))
  );
end;
$function$;

create or replace function public.apply_business_quality_score_internal(business_uuid uuid)
returns public.businesses
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  b public.businesses%rowtype;
  payload jsonb;
  total_score integer;
  auto_score integer;
begin
  select * into b from public.businesses where id = business_uuid;
  if b.id is null then raise exception 'Business not found' using errcode = 'P0002'; end if;
  payload := public.calculate_business_quality_score_payload(business_uuid);
  total_score := least(100, greatest(0, coalesce((payload ->> 'total')::integer, 0)));
  auto_score := least(100, greatest(0, coalesce((payload ->> 'auto_total')::integer, total_score)));
  update public.businesses
  set quality_score_auto = auto_score,
      quality_score = total_score,
      quality_breakdown_json = payload,
      quality_calculated_at = now(),
      public_snapshot_json = case when public_snapshot_json is null then null else jsonb_set(jsonb_set(public_snapshot_json,'{quality_score}',to_jsonb(total_score),true),'{quality_score_version}',to_jsonb(2),true) end,
      updated_at = now()
  where id = business_uuid
  returning * into b;
  return b;
end;
$function$;

revoke all on function public.apply_business_quality_score_internal(uuid) from public;
revoke execute on function public.apply_business_quality_score_internal(uuid) from anon, authenticated;

create or replace function public.recalculate_business_quality_score(business_uuid uuid, skip_auth boolean default false)
returns public.businesses
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare b public.businesses%rowtype;
begin
  select * into b from public.businesses where id = business_uuid;
  if b.id is null then raise exception 'Business not found' using errcode = 'P0002'; end if;
  if auth.uid() is null or not (public.is_admin_user() or b.owner_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return public.apply_business_quality_score_internal(business_uuid);
end;
$function$;

create or replace function public.refresh_business_quality_score_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare bid uuid;
begin
  if pg_trigger_depth() > 1 then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;
  if TG_TABLE_NAME = 'businesses' then bid := case when TG_OP = 'DELETE' then old.id else new.id end;
  else bid := case when TG_OP = 'DELETE' then old.business_id else new.business_id end; end if;
  if bid is not null then perform public.apply_business_quality_score_internal(bid); end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$function$;

do $backfill$
declare row_item record;
begin
  for row_item in select id from public.businesses loop
    perform public.apply_business_quality_score_internal(row_item.id);
  end loop;
end;
$backfill$;
