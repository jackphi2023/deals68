-- Deals68 Business Quality Score v1
-- Adds configurable 100-point score, breakdown JSON and recalculation RPC.

alter table public.businesses add column if not exists quality_score_auto integer;
alter table public.businesses add column if not exists quality_breakdown_json jsonb;
alter table public.businesses add column if not exists quality_calculated_at timestamptz;
alter table public.businesses add column if not exists quality_score_manual_override boolean not null default false;
alter table public.businesses add column if not exists quality_score_manual_note text;

create table if not exists public.quality_score_config (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  is_active boolean not null default false,
  name text not null default 'Business Quality Score v1',
  config jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create unique index if not exists quality_score_config_one_active on public.quality_score_config (is_active) where is_active;

insert into public.quality_score_config (version, is_active, name, config)
values (1, true, 'Business Quality Score v1', '{
  "weights":{"profile":15,"financial":20,"documents":20,"images":10,"valuation":25,"readiness":10},
  "valuation":{"base":{"ask_amount":2,"stake_pct":2,"benchmark":1},"reasonableness":{"missing":5,"in_range":16,"below_low_0_15":18,"below_low_15_35":20,"below_low_over_35":16,"above_high_0_15":13,"above_high_15_35":9,"above_high_35_60":5,"above_high_over_60":2}},
  "bands":{"strong":80,"good":65,"needs_data":50,"not_ready":0}
}'::jsonb)
on conflict (version) do update set is_active=excluded.is_active, name=excluded.name, config=excluded.config, updated_at=now();

alter table public.quality_score_config enable row level security;
drop policy if exists "quality score config active read" on public.quality_score_config;
create policy "quality score config active read" on public.quality_score_config for select using (is_active = true or public.is_admin_user());

create or replace function public.active_quality_score_config()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select config from public.quality_score_config where is_active=true order by version desc limit 1),
  '{"weights":{"profile":15,"financial":20,"documents":20,"images":10,"valuation":25,"readiness":10}}'::jsonb);
$$;

create or replace function public.calculate_business_quality_score_payload(business_uuid uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  b public.businesses%rowtype;
  cfg jsonb := public.active_quality_score_config();
  weights jsonb := cfg->'weights';
  w_profile numeric := coalesce((weights->>'profile')::numeric, 15);
  w_financial numeric := coalesce((weights->>'financial')::numeric, 20);
  w_documents numeric := coalesce((weights->>'documents')::numeric, 20);
  w_images numeric := coalesce((weights->>'images')::numeric, 10);
  w_valuation numeric := coalesce((weights->>'valuation')::numeric, 25);
  w_readiness numeric := coalesce((weights->>'readiness')::numeric, 10);
  profile_score numeric := 0; financial_score numeric := 0; documents_score numeric := 0; images_score numeric := 0; valuation_score numeric := 0; readiness_score numeric := 0;
  total_auto numeric := 0; total_final numeric := 0;
  fi jsonb := '{}'::jsonb;
  file_count int := 0; image_count int := 0; hero_image_count int := 0; profile_doc_count int := 0; financial_doc_count int := 0; data_doc_count int := 0; legal_doc_count int := 0; approved_file_name_count int := 0;
  payment_confirmed int := 0; proposals_sent int := 0; proposals_connected int := 0; interests_total int := 0; interests_handled int := 0; requests_total int := 0; requests_handled int := 0; quota_remaining int := 0;
  has_revenue boolean := false; has_revenue_month boolean := false; has_ebitda boolean := false; has_growth boolean := false; has_fin_source boolean := false; has_assets boolean := false; has_ask boolean := false; has_stake boolean := false; has_benchmark boolean := false; has_self boolean := false;
  self_v numeric := 0; bench_low numeric := 0; bench_mid numeric := 0; bench_high numeric := 0; below_pct numeric := 0; above_pct numeric := 0; reason_score numeric := 0;
  valuation_verdict text := 'missing'; valuation_label_vi text := 'Chưa đủ dữ liệu định giá'; valuation_label_en text := 'Valuation data incomplete';
  items jsonb := '[]'::jsonb; flags jsonb := '[]'::jsonb;
begin
  select * into b from public.businesses where id = business_uuid;
  if b.id is null then return jsonb_build_object('total',0,'error','business_not_found'); end if;

  fi := coalesce(b.financial_input, '{}'::jsonb);
  has_revenue := coalesce(b.revenue_2025,0) > 0;
  has_revenue_month := coalesce(b.revenue_month,0) > 0 or coalesce(nullif(fi->>'revenue_month','')::numeric,0) > 0;
  has_ebitda := b.ebitda_margin is not null;
  has_growth := b.growth_pct is not null or fi ? 'growth_pct';
  has_fin_source := coalesce(nullif(fi->>'financial_source',''), nullif(fi->>'financial_data_source',''), nullif(fi->>'source','')) is not null;
  has_assets := coalesce(nullif(fi->>'assets_owned',''), nullif(fi->>'excluded_physical_asset_value','')) is not null;
  has_ask := coalesce(b.ask_amount,b.offer_amount,0) > 0;
  has_stake := coalesce(b.stake_pct,b.offer_stake_pct,0) > 0;

  select count(*) into file_count from public.business_files where business_id=business_uuid;
  select count(*) into image_count from public.business_images where business_id=business_uuid;
  select count(*) into hero_image_count from public.business_images where business_id=business_uuid and coalesce(is_hero,false)=true;
  select count(*) into profile_doc_count from public.business_files where business_id=business_uuid and lower(coalesce(category,'')||' '||coalesce(file_name,'')||' '||coalesce(display_name,'')||' '||coalesce(file_type,'')) ~ '(profile|teaser|im|pitch|deck|pdf|ppt|pptx|doc|docx)';
  select count(*) into financial_doc_count from public.business_files where business_id=business_uuid and lower(coalesce(category,'')||' '||coalesce(file_name,'')||' '||coalesce(display_name,'')||' '||coalesce(file_type,'')) ~ '(financial|finance|excel|xls|xlsx|doanh thu|ebitda|profit|p&l|pl|statement|tax|audit)';
  select count(*) into data_doc_count from public.business_files where business_id=business_uuid and lower(coalesce(category,'')||' '||coalesce(file_name,'')||' '||coalesce(display_name,'')||' '||coalesce(file_type,'')) ~ '(model|forecast|kpi|revenue|sales|excel|xls|xlsx)';
  select count(*) into legal_doc_count from public.business_files where business_id=business_uuid and lower(coalesce(category,'')||' '||coalesce(file_name,'')||' '||coalesce(display_name,'')||' '||coalesce(file_type,'')) ~ '(legal|license|registration|tax|contract|phap ly|giay phep)';
  select count(*) into approved_file_name_count from public.business_files where business_id=business_uuid and nullif(trim(coalesce(display_name,'')),'') is not null;
  select count(*) into payment_confirmed from public.payment_orders where business_id=business_uuid and lower(coalesce(status,'')) in ('confirmed','paid','active');
  select count(*) into proposals_sent from public.proposals where business_id=business_uuid;
  select count(*) into proposals_connected from public.proposals where business_id=business_uuid and lower(coalesce(status::text,'')) in ('approved','connected','fulfilled');
  select count(*) into interests_total from public.investor_interests where business_id=business_uuid;
  select count(*) into interests_handled from public.investor_interests where business_id=business_uuid and lower(coalesce(status::text,'')) in ('approved','connected','rejected');
  select count(*) into requests_total from public.request_data where business_id=business_uuid;
  select count(*) into requests_handled from public.request_data where business_id=business_uuid and lower(coalesce(status::text,'')) in ('fulfilled','approved','connected','rejected');
  quota_remaining := greatest(coalesce(b.quota_total,0)-coalesce(b.quota_used,0),0);

  profile_score := profile_score + case when nullif(b.company_name_private,'') is not null then 2 else 0 end + case when nullif(b.title_vi,'') is not null then 2 else 0 end + case when nullif(b.title_en,'') is not null then 1 else 0 end + case when nullif(b.description_vi,'') is not null then 3 else 0 end + case when nullif(b.description_en,'') is not null then 1 else 0 end + case when nullif(b.industry,'') is not null then 2 else 0 end + case when nullif(coalesce(b.city,b.country_iso2),'') is not null then 2 else 0 end + case when nullif(b.deal_type,'') is not null then 2 else 0 end;
  profile_score := least(w_profile, profile_score);
  financial_score := least(w_financial, (case when has_revenue then 5 else 0 end) + (case when has_revenue_month then 3 else 0 end) + (case when has_ebitda then 5 else 0 end) + (case when has_growth then 3 else 0 end) + (case when has_fin_source then 2 else 0 end) + (case when has_assets then 2 else 0 end));
  documents_score := least(w_documents, (case when profile_doc_count>0 then 6 else 0 end) + (case when financial_doc_count>0 then 7 else 0 end) + (case when data_doc_count>0 then 3 else 0 end) + (case when legal_doc_count>0 then 2 else 0 end) + (case when approved_file_name_count>0 then 2 else 0 end));
  images_score := least(w_images, (case when image_count>=1 then 3 else 0 end) + (case when image_count>=3 then 2 else 0 end) + (case when hero_image_count>0 or nullif(coalesce(b.hero_image_url,b.image_url),'') is not null then 2 else 0 end) + (case when image_count>0 and nullif(coalesce(b.hero_image_url,b.image_url),'') is not null then 2 else 0 end) + (case when image_count>0 then 1 else 0 end));

  self_v := coalesce(b.self_valuation, case when has_ask and has_stake then coalesce(b.ask_amount,b.offer_amount,0) / greatest(coalesce(b.stake_pct,b.offer_stake_pct,0),0.000001) * 100 else 0 end);
  bench_low := coalesce(b.bench_low, nullif(b.valuation_factors->>'low','')::numeric, 0);
  bench_mid := coalesce(b.bench_mid, nullif(b.valuation_factors->>'mid','')::numeric, 0);
  bench_high := coalesce(b.bench_high, nullif(b.valuation_factors->>'high','')::numeric, 0);
  has_benchmark := bench_mid>0 and bench_low>0 and bench_high>0;
  has_self := self_v>0;
  valuation_score := valuation_score + case when has_ask then coalesce((cfg#>>'{valuation,base,ask_amount}')::numeric,2) else 0 end + case when has_stake then coalesce((cfg#>>'{valuation,base,stake_pct}')::numeric,2) else 0 end + case when has_benchmark then coalesce((cfg#>>'{valuation,base,benchmark}')::numeric,1) else 0 end;

  if not has_self or not has_benchmark then
    reason_score := coalesce((cfg#>>'{valuation,reasonableness,missing}')::numeric,5);
  elsif self_v < bench_low then
    below_pct := (bench_low-self_v)/greatest(bench_low,1);
    if below_pct <= .15 then reason_score := coalesce((cfg#>>'{valuation,reasonableness,below_low_0_15}')::numeric,18); valuation_verdict := 'below_low_0_15'; valuation_label_vi := 'Định giá thấp hơn tham chiếu nhẹ'; valuation_label_en := 'Slightly below benchmark';
    elsif below_pct <= .35 then reason_score := coalesce((cfg#>>'{valuation,reasonableness,below_low_15_35}')::numeric,20); valuation_verdict := 'below_low_15_35'; valuation_label_vi := 'Định giá hấp dẫn so với tham chiếu'; valuation_label_en := 'Attractive versus benchmark';
    else reason_score := coalesce((cfg#>>'{valuation,reasonableness,below_low_over_35}')::numeric,16); valuation_verdict := 'below_low_over_35'; valuation_label_vi := 'Định giá thấp sâu, cần kiểm tra dữ liệu'; valuation_label_en := 'Deep discount, data review needed'; end if;
  elsif self_v <= bench_high then
    reason_score := coalesce((cfg#>>'{valuation,reasonableness,in_range}')::numeric,16); valuation_verdict := 'in_range'; valuation_label_vi := 'Định giá trong khoảng tham chiếu'; valuation_label_en := 'Within benchmark range';
  else
    above_pct := (self_v-bench_high)/greatest(bench_high,1);
    if above_pct <= .15 then reason_score := coalesce((cfg#>>'{valuation,reasonableness,above_high_0_15}')::numeric,13); valuation_verdict := 'above_high_0_15'; valuation_label_vi := 'Định giá cao hơn tham chiếu nhẹ'; valuation_label_en := 'Slightly above benchmark';
    elsif above_pct <= .35 then reason_score := coalesce((cfg#>>'{valuation,reasonableness,above_high_15_35}')::numeric,9); valuation_verdict := 'above_high_15_35'; valuation_label_vi := 'Định giá cao hơn tham chiếu'; valuation_label_en := 'Above benchmark';
    elsif above_pct <= .60 then reason_score := coalesce((cfg#>>'{valuation,reasonableness,above_high_35_60}')::numeric,5); valuation_verdict := 'above_high_35_60'; valuation_label_vi := 'Định giá cao đáng kể so với tham chiếu'; valuation_label_en := 'Materially above benchmark';
    else reason_score := coalesce((cfg#>>'{valuation,reasonableness,above_high_over_60}')::numeric,2); valuation_verdict := 'above_high_over_60'; valuation_label_vi := 'Định giá rất cao so với tham chiếu'; valuation_label_en := 'Far above benchmark'; end if;
  end if;
  valuation_score := least(w_valuation, valuation_score + reason_score);

  readiness_score := least(w_readiness, (case when payment_confirmed>0 then 2 else 0 end) + (case when b.public_snapshot_json is not null and b.visible=true and b.status='active' then 2 else 0 end) + (case when b.pending_changes_json is null then 1 else 0 end) + (case when quota_remaining>0 then 1 else 0 end) + (case when (interests_total+requests_total)=0 then 1 when (interests_handled+requests_handled)>0 then 2 else 0 end) + (case when proposals_sent>0 then 2 else 0 end));

  total_auto := least(100, greatest(0, round(profile_score+financial_score+documents_score+images_score+valuation_score+readiness_score)));
  total_final := case when coalesce(b.quality_score_manual_override,false) and coalesce(b.quality_score,0) between 0 and 100 then round(b.quality_score) else total_auto end;

  items := jsonb_build_array(
    jsonb_build_object('key','profile','label_vi','Độ đầy đủ hồ sơ','label_en','Profile completeness','score',round(profile_score),'max',w_profile,'public',true),
    jsonb_build_object('key','financial','label_vi','Chất lượng số liệu tài chính','label_en','Financial data quality','score',round(financial_score),'max',w_financial,'public',true),
    jsonb_build_object('key','documents','label_vi','Tài liệu chứng minh','label_en','Supporting documents','score',round(documents_score),'max',w_documents,'public',true),
    jsonb_build_object('key','images','label_vi','Hình ảnh','label_en','Images','score',round(images_score),'max',w_images,'public',true),
    jsonb_build_object('key','valuation','label_vi','Định giá & độ hợp lý đề xuất','label_en','Valuation & offer reasonableness','score',round(valuation_score),'max',w_valuation,'public',true,'verdict',valuation_verdict,'verdict_vi',valuation_label_vi,'verdict_en',valuation_label_en),
    jsonb_build_object('key','readiness','label_vi','Mức sẵn sàng giao dịch/kết nối','label_en','Transaction/connection readiness','score',round(readiness_score),'max',w_readiness,'public',true)
  );
  flags := jsonb_build_array(case when has_revenue then 'has_revenue' else 'missing_revenue' end, case when has_ebitda then 'has_ebitda' else 'missing_ebitda' end, case when financial_doc_count>0 then 'has_financial_documents' else 'missing_financial_documents' end, case when image_count>0 then 'has_images' else 'missing_images' end, case when has_benchmark then 'has_valuation_benchmark' else 'missing_valuation_benchmark' end, valuation_verdict);

  return jsonb_build_object('version',1,'total',total_final,'auto_total',total_auto,'manual_override',coalesce(b.quality_score_manual_override,false),'calculated_at',now(),'items',items,'flags',flags,'valuation',jsonb_build_object('self',nullif(self_v,0),'bench_low',nullif(bench_low,0),'bench_mid',nullif(bench_mid,0),'bench_high',nullif(bench_high,0),'verdict',valuation_verdict,'label_vi',valuation_label_vi,'label_en',valuation_label_en,'below_pct',case when below_pct>0 then round(below_pct*100) else null end,'above_pct',case when above_pct>0 then round(above_pct*100) else null end),'weights',weights,'counts',jsonb_build_object('files',file_count,'images',image_count,'profile_docs',profile_doc_count,'financial_docs',financial_doc_count,'data_docs',data_doc_count,'legal_docs',legal_doc_count,'payment_confirmed',payment_confirmed,'proposals_sent',proposals_sent,'proposals_connected',proposals_connected,'investor_interests',interests_total,'data_requests',requests_total));
end;
$$;

create or replace function public.recalculate_business_quality_score(business_uuid uuid, skip_auth boolean default false)
returns public.businesses language plpgsql security definer set search_path to 'public' as $$
declare b public.businesses%rowtype; payload jsonb; total_score int; auto_score int;
begin
  select * into b from public.businesses where id=business_uuid;
  if b.id is null then raise exception 'Business not found'; end if;
  if not skip_auth and not (public.is_admin_user() or b.owner_id = auth.uid()) then raise exception 'Not allowed'; end if;
  payload := public.calculate_business_quality_score_payload(business_uuid);
  total_score := least(100, greatest(0, coalesce((payload->>'total')::int,0)));
  auto_score := least(100, greatest(0, coalesce((payload->>'auto_total')::int,total_score)));
  update public.businesses set quality_score_auto=auto_score, quality_score=total_score, quality_breakdown_json=payload, quality_calculated_at=now(), updated_at=now() where id=business_uuid returning * into b;
  return b;
end;
$$;

grant execute on function public.calculate_business_quality_score_payload(uuid) to authenticated;
grant execute on function public.recalculate_business_quality_score(uuid, boolean) to authenticated;

create or replace function public.refresh_business_quality_score_trigger()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare bid uuid;
begin
  if pg_trigger_depth() > 1 then
    if TG_OP='DELETE' then return old; end if;
    return new;
  end if;
  if TG_TABLE_NAME='businesses' then bid := case when TG_OP='DELETE' then old.id else new.id end;
  else bid := case when TG_OP='DELETE' then old.business_id else new.business_id end;
  end if;
  if bid is not null then perform public.recalculate_business_quality_score(bid, true); end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_quality_businesses on public.businesses;
create trigger trg_refresh_quality_businesses after insert or update of company_name_private,title_vi,title_en,description_vi,description_en,industry,deal_type,city,country_iso2,revenue_2025,revenue_month,revenue_currency,ebitda_margin,growth_pct,ask_amount,ask_currency,stake_pct,offer_amount,offer_stake_pct,self_valuation,bench_low,bench_mid,bench_high,valuation_factors,financial_input,public_snapshot_json,visible,status,pending_changes_json,quota_total,quota_used,quality_score,quality_score_manual_override on public.businesses for each row execute function public.refresh_business_quality_score_trigger();

drop trigger if exists trg_refresh_quality_business_files on public.business_files;
create trigger trg_refresh_quality_business_files after insert or update or delete on public.business_files for each row execute function public.refresh_business_quality_score_trigger();

drop trigger if exists trg_refresh_quality_business_images on public.business_images;
create trigger trg_refresh_quality_business_images after insert or update or delete on public.business_images for each row execute function public.refresh_business_quality_score_trigger();

drop trigger if exists trg_refresh_quality_proposals on public.proposals;
create trigger trg_refresh_quality_proposals after insert or update or delete on public.proposals for each row execute function public.refresh_business_quality_score_trigger();

drop trigger if exists trg_refresh_quality_investor_interests on public.investor_interests;
create trigger trg_refresh_quality_investor_interests after insert or update or delete on public.investor_interests for each row execute function public.refresh_business_quality_score_trigger();

drop trigger if exists trg_refresh_quality_request_data on public.request_data;
create trigger trg_refresh_quality_request_data after insert or update or delete on public.request_data for each row execute function public.refresh_business_quality_score_trigger();

drop trigger if exists trg_refresh_quality_payment_orders on public.payment_orders;
create trigger trg_refresh_quality_payment_orders after insert or update or delete on public.payment_orders for each row execute function public.refresh_business_quality_score_trigger();

do $$ declare r record; begin for r in select id from public.businesses loop perform public.recalculate_business_quality_score(r.id, true); end loop; end $$;
