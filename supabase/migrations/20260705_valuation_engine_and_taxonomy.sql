-- Deals68 Valuation Benchmark Engine v1.0
-- Source spec: Deals68_Module_Dinh_gia_DN_v1.docx
-- This migration adds admin-editable valuation_config, standardized 23-industry taxonomy,
-- and backend calculation fields/functions. It does not change public visibility guard.

create table if not exists public.industry_taxonomy (
  key text primary key,
  vi text not null,
  en text not null,
  seo_vi text,
  seo_en text,
  aliases text[] default array[]::text[],
  sort_order int default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.industry_taxonomy (key, vi, en, seo_vi, seo_en, aliases, sort_order, active) values
('agriculture','Nông nghiệp','Agriculture','doanh nghiệp nông nghiệp, trang trại, chế biến nông sản','agriculture businesses, farms and agri processing',array['nong nghiep','agriculture','agri','farm'],10,true),
('automobile','Ô tô & Phụ tùng','Automobile','ô tô, phụ tùng, đại lý xe, dịch vụ xe','automotive, auto parts, dealerships and services',array['oto','o to','automobile','auto','car','phu tung'],20,true),
('beauty_personal_care','Làm đẹp & Chăm sóc cá nhân','Beauty & Personal Care','spa, thẩm mỹ, chăm sóc da, mỹ phẩm','beauty, spa, aesthetics, skincare and personal care',array['beauty','personal care','spa','derma','tham my','lam dep','cham soc ca nhan'],30,true),
('construction_materials','Xây dựng & Vật liệu','Building, Construction & Materials','xây dựng, vật liệu xây dựng, nhà thầu','building, construction and materials',array['building','construction','materials','xay dung','vat lieu'],40,true),
('chemicals','Hóa chất','Chemicals','hóa chất công nghiệp, phụ gia, vật liệu hóa học','chemicals, industrial chemicals and additives',array['chemical','chemicals','hoa chat'],50,true),
('education_training','Giáo dục & Đào tạo','Education & Training','giáo dục, đào tạo, trung tâm, edtech','education, training centres and edtech',array['education','training','edtech','giao duc','dao tao'],60,true),
('energy_utilities','Năng lượng & Tiện ích','Energy & Utilities','năng lượng, điện, tiện ích, năng lượng tái tạo','energy, utilities, power and renewables',array['energy','utilities','renewable','power','nang luong','dien'],70,true),
('entertainment_leisure','Giải trí & Nghỉ dưỡng','Entertainment & Leisure','giải trí, karaoke, thể thao, khu vui chơi, nghỉ dưỡng','entertainment, leisure, sports and recreation',array['entertainment','leisure','karaoke','giai tri','nghi duong'],80,true),
('finance','Tài chính','Finance','tài chính, fintech, tín dụng, bảo hiểm','finance, fintech, credit and insurance',array['finance','financial','fintech','banking','insurance','tai chinh','ngan hang','bao hiem'],90,true),
('food_beverage','Thực phẩm & Đồ uống (F&B)','Food & Beverage','nhà hàng, quán cà phê, thực phẩm, đồ uống, chuỗi F&B','food and beverage, restaurants, cafes and F&B chains',array['f b','fnb','food','beverage','restaurant','cafe','nha hang','thuc pham','do uong'],100,true),
('healthcare','Y tế & Chăm sóc sức khỏe','Health Care','phòng khám, nha khoa, y tế, chăm sóc sức khỏe','health care, clinics, dental and medical services',array['health','healthcare','health care','clinic','medical','dental','y te','suc khoe','nha khoa'],110,true),
('hotels_resorts','Khách sạn & Resort','Hotels & Resorts','khách sạn, resort, lưu trú, nghỉ dưỡng','hotels, resorts and hospitality assets',array['hotel','hotels','resort','hospitality','khach san'],120,true),
('it_software','CNTT & Phần mềm','IT & Software / Technology','công nghệ thông tin, phần mềm, SaaS, AI, tự động hóa','IT, software, SaaS, AI and technology',array['technology','tech','software','saas','ai','it','cntt','cong nghe','phan mem'],130,true),
('manufacturing','Sản xuất','Manufacturing','nhà máy, sản xuất, công nghiệp, gia công','manufacturing, factories and industrial production',array['manufacturing','factory','industrial','san xuat','nha may'],140,true),
('media_advertising','Truyền thông & Quảng cáo','Media & Advertising','truyền thông, quảng cáo, marketing, agency','media, advertising, marketing and agencies',array['media','advertising','marketing','agency','truyen thong','quang cao'],150,true),
('real_estate','Bất động sản','Real Estate','bất động sản, dự án, tài sản, mặt bằng, văn phòng','real estate, property, projects and assets',array['real estate','property','bat dong san','bds'],160,true),
('retail','Bán lẻ','Retail','bán lẻ, chuỗi cửa hàng, thương mại','retail, store chains and commerce',array['retail','ban le','store'],170,true),
('services','Dịch vụ (B2B/B2C)','Services','dịch vụ doanh nghiệp, dịch vụ tiêu dùng, tư vấn','B2B and B2C services',array['services','business services','consulting','dich vu','dich vu doanh nghiep'],180,true),
('transportation_logistics','Logistics & Vận tải','Transportation & Logistics','logistics, vận tải, kho vận, giao nhận, kho lạnh','transportation, logistics, warehousing and cold chain',array['logistics','transport','transportation','warehouse','cold storage','supply chain','kho van','kho lanh','van tai'],190,true),
('travel','Du lịch','Travel','du lịch, lữ hành, OTA, tour, dịch vụ du lịch','travel, tourism, tours and OTA',array['travel','tourism','tour','du lich','lu hanh'],200,true),
('ecommerce','Thương mại điện tử','E-commerce','thương mại điện tử, bán hàng trực tuyến, marketplace','e-commerce, online retail and marketplaces',array['ecommerce','e commerce','marketplace','online retail','thuong mai dien tu'],210,true),
('textiles_apparel','Dệt may & Thời trang','Textiles & Apparel','dệt may, thời trang, may mặc, thiết kế','textiles, apparel, fashion and garment manufacturing',array['textile','textiles','apparel','fashion','garment','thoi trang','may mac','det may'],220,true),
('seafood_export','Thủy sản & Xuất khẩu','Seafood & Export','thủy sản, xuất khẩu, chế biến, kho lạnh, nông thủy sản','seafood, export, processing and cold storage',array['seafood','aquaculture','export','thuy san','xuat khau','ca tra','tom'],230,true)
on conflict (key) do update set vi=excluded.vi,en=excluded.en,seo_vi=excluded.seo_vi,seo_en=excluded.seo_en,aliases=excluded.aliases,sort_order=excluded.sort_order,active=excluded.active,updated_at=now();

create table if not exists public.valuation_config (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  is_active boolean not null default false,
  params jsonb not null,
  industry jsonb not null,
  country jsonb not null,
  growth_curve jsonb not null,
  size_bands jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create unique index if not exists valuation_config_one_active on public.valuation_config (is_active) where is_active;

insert into public.valuation_config (version,is_active,params,industry,country,growth_curve,size_bands)
values (1,true,
'{"version":1,"w_ebitda":0.70,"w_revenue":0.30,"ebitda_margin_floor":5,"spread_low":0.15,"spread_high":0.15,"usd_vnd":25000,"growth_cap":50}'::jsonb,
'{"agriculture":{"ebitda":5.5,"revenue":0.90},"automobile":{"ebitda":5.5,"revenue":0.65},"beauty_personal_care":{"ebitda":7.5,"revenue":1.20},"construction_materials":{"ebitda":5.0,"revenue":0.60},"chemicals":{"ebitda":6.5,"revenue":1.10},"education_training":{"ebitda":8.0,"revenue":1.50},"energy_utilities":{"ebitda":7.0,"revenue":1.30},"entertainment_leisure":{"ebitda":6.5,"revenue":1.20},"finance":{"ebitda":8.0,"revenue":2.00},"food_beverage":{"ebitda":5.5,"revenue":0.80},"healthcare":{"ebitda":9.0,"revenue":2.00},"hotels_resorts":{"ebitda":8.0,"revenue":2.20},"it_software":{"ebitda":11.0,"revenue":2.80},"manufacturing":{"ebitda":6.0,"revenue":0.85},"media_advertising":{"ebitda":7.0,"revenue":1.30},"real_estate":{"ebitda":9.0,"revenue":3.00},"retail":{"ebitda":5.5,"revenue":0.60},"services":{"ebitda":7.0,"revenue":1.20},"transportation_logistics":{"ebitda":6.0,"revenue":0.85},"travel":{"ebitda":6.5,"revenue":1.20},"ecommerce":{"ebitda":8.5,"revenue":1.40},"textiles_apparel":{"ebitda":5.0,"revenue":0.70},"seafood_export":{"ebitda":5.0,"revenue":0.70}}'::jsonb,
'{"VN":1.00,"SG":1.25,"US":1.35,"KR":1.15,"JP":1.20,"HK":1.20,"CN":1.05,"TH":1.00,"CA":1.25,"AU":1.25,"DE":1.20,"CZ":1.05,"OTHER":1.00}'::jsonb,
'[{"max":0,"factor":0.85},{"max":5,"factor":0.95},{"max":15,"factor":1.05},{"max":30,"factor":1.15},{"max":50,"factor":1.25},{"max":null,"factor":1.35}]'::jsonb,
'[{"max_usd":400000,"factor":0.80},{"max_usd":2000000,"factor":0.90},{"max_usd":10000000,"factor":1.00},{"max_usd":50000000,"factor":1.10},{"max_usd":null,"factor":1.20}]'::jsonb)
on conflict (version) do nothing;

alter table public.businesses add column if not exists industry_key text;
alter table public.businesses add column if not exists revenue_month numeric;
alter table public.businesses add column if not exists growth_pct numeric;
alter table public.businesses add column if not exists offer_stake_pct numeric;
alter table public.businesses add column if not exists offer_amount numeric;
alter table public.businesses add column if not exists self_valuation numeric;
alter table public.businesses add column if not exists bench_low numeric;
alter table public.businesses add column if not exists bench_mid numeric;
alter table public.businesses add column if not exists bench_high numeric;
alter table public.businesses add column if not exists bench_verdict text;
alter table public.businesses add column if not exists bench_config_version int;
alter table public.businesses add column if not exists bench_calculated_at timestamptz;
alter table public.businesses add column if not exists valuation_factors jsonb;

create or replace function public.normalize_industry_key(raw text)
returns text language plpgsql stable as $$
declare r text := lower(coalesce(raw,'')); found text;
begin
  select key into found from public.industry_taxonomy t
  where lower(t.key) = r
     or lower(t.vi) = r
     or lower(t.en) = r
     or exists (select 1 from unnest(t.aliases) a where r like '%' || lower(a) || '%' or lower(a) like '%' || r || '%')
  order by sort_order limit 1;
  return found;
end $$;

create or replace function public.calculate_business_valuation_payload(input jsonb)
returns jsonb language plpgsql stable as $$
declare
  cfg record; p jsonb; ind_key text; ind jsonb; revenue_year numeric; currency text; country_key text;
  margin numeric; growth numeric; stake numeric; offer numeric; ebitda numeric; rev_usd numeric;
  cf numeric := 1; gf numeric := 1; sf numeric := 1; adj_e numeric; adj_r numeric; ev_e numeric; ev_r numeric; ev_mid numeric; mid numeric; low numeric; high numeric;
  item jsonb; maxv numeric; selfv numeric; verdict text; pct_above int; method text;
begin
  select * into cfg from public.valuation_config where is_active = true order by version desc limit 1;
  if cfg is null then return null; end if;
  p := cfg.params;
  ind_key := coalesce(nullif(input->>'industry_key',''), public.normalize_industry_key(input->>'industry'), '');
  ind := cfg.industry -> ind_key;
  revenue_year := coalesce(nullif(input->>'revenue_year','')::numeric, nullif(input->>'revenue_2025','')::numeric, nullif(input->>'revenueYear','')::numeric, nullif(input->>'revenue_month','')::numeric * 12, 0);
  if ind is null or revenue_year <= 0 then return null; end if;
  currency := upper(coalesce(nullif(input->>'currency',''), nullif(input->>'revenue_currency',''), 'VND'));
  country_key := upper(coalesce(nullif(input->>'country_key',''), nullif(input->>'country_iso2',''), 'VN'));
  margin := coalesce(nullif(input->>'ebitda_margin','')::numeric, 0);
  growth := least(coalesce(nullif(input->>'growth_pct','')::numeric, 0), coalesce((p->>'growth_cap')::numeric, 50));
  offer := coalesce(nullif(input->>'offer_amount','')::numeric, nullif(input->>'ask_amount','')::numeric, 0);
  stake := coalesce(nullif(input->>'offer_stake_pct','')::numeric, nullif(input->>'stake_pct','')::numeric, 0);
  ebitda := revenue_year * margin / 100;
  rev_usd := case when currency = 'USD' then revenue_year else revenue_year / coalesce((p->>'usd_vnd')::numeric, 25000) end;
  cf := coalesce((cfg.country ->> country_key)::numeric, (cfg.country ->> 'OTHER')::numeric, 1);
  for item in select * from jsonb_array_elements(cfg.growth_curve) loop
    if item->>'max' is null or growth < (item->>'max')::numeric then gf := (item->>'factor')::numeric; exit; end if;
  end loop;
  for item in select * from jsonb_array_elements(cfg.size_bands) loop
    if item->>'max_usd' is null or rev_usd < (item->>'max_usd')::numeric then sf := (item->>'factor')::numeric; exit; end if;
  end loop;
  adj_e := (ind->>'ebitda')::numeric * cf * gf * sf;
  adj_r := (ind->>'revenue')::numeric * cf * gf * sf;
  ev_e := ebitda * adj_e;
  ev_r := revenue_year * adj_r;
  if margin >= coalesce((p->>'ebitda_margin_floor')::numeric, 5) and ebitda > 0 then
    ev_mid := coalesce((p->>'w_ebitda')::numeric, .7) * ev_e + coalesce((p->>'w_revenue')::numeric, .3) * ev_r;
    method := 'blend';
  else
    ev_mid := ev_r;
    method := 'revenue_only';
  end if;
  mid := greatest(0, ev_mid);
  low := mid * (1 - coalesce((p->>'spread_low')::numeric, .15));
  high := mid * (1 + coalesce((p->>'spread_high')::numeric, .15));
  if offer > 0 and stake > 0 then
    selfv := offer / (stake / 100);
    if selfv < low then verdict := 'low_of';
    elsif selfv <= high then verdict := 'in_range';
    else verdict := 'above'; pct_above := round((selfv - high) / greatest(high,1) * 100); end if;
  end if;
  return jsonb_build_object('low',low,'mid',mid,'high',high,'method',method,'currency',currency,'revenueYear',revenue_year,'ebitda',ebitda,'adjE',adj_e,'adjR',adj_r,'self',selfv,'verdict',verdict,'pctAbove',pct_above,'configVersion',cfg.version,'industryKey',ind_key,'countryFactor',cf,'growthFactor',gf,'sizeFactor',sf);
end $$;


create or replace function public.set_business_valuation_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r jsonb;
begin
  new.industry_key := coalesce(nullif(new.industry_key,''), nullif(new.pending_changes_json->>'industry_key',''), public.normalize_industry_key(new.industry));
  new.revenue_month := coalesce(new.revenue_month, nullif(new.pending_changes_json->>'revenue_month','')::numeric, nullif(new.pending_changes_json#>>'{financial_input,revenue_month}','')::numeric);
  new.growth_pct := coalesce(new.growth_pct, nullif(new.pending_changes_json->>'growth_pct','')::numeric, nullif(new.pending_changes_json#>>'{financial_input,growth_pct}','')::numeric);
  new.offer_amount := coalesce(new.offer_amount, nullif(new.pending_changes_json->>'offer_amount','')::numeric, new.ask_amount);
  new.offer_stake_pct := coalesce(new.offer_stake_pct, nullif(new.pending_changes_json->>'offer_stake_pct','')::numeric, new.stake_pct);
  r := public.calculate_business_valuation_payload(to_jsonb(new));
  if r is not null then
    new.self_valuation := nullif(r->>'self','')::numeric;
    new.bench_low := nullif(r->>'low','')::numeric;
    new.bench_mid := nullif(r->>'mid','')::numeric;
    new.bench_high := nullif(r->>'high','')::numeric;
    new.bench_verdict := r->>'verdict';
    new.bench_config_version := nullif(r->>'configVersion','')::int;
    new.bench_calculated_at := now();
    new.valuation_factors := r;
    new.valuation_reasonableness := coalesce(r->>'verdict', new.valuation_reasonableness);
  end if;
  return new;
end $$;

drop trigger if exists trg_businesses_set_valuation on public.businesses;
create trigger trg_businesses_set_valuation
before insert or update of industry, industry_key, revenue_2025, revenue_month, revenue_currency, ebitda_margin, growth_pct, ask_amount, ask_currency, stake_pct, offer_amount, offer_stake_pct, pending_changes_json
on public.businesses
for each row execute function public.set_business_valuation_fields();

create or replace function public.recalculate_business_valuation(business_uuid uuid)
returns businesses language plpgsql security definer set search_path to 'public' as $$
declare b businesses; r jsonb;
begin
  select * into b from public.businesses where id = business_uuid;
  if b.id is null then raise exception 'Business not found'; end if;
  if not (public.is_admin_user() or b.owner_id = auth.uid()) then raise exception 'Not allowed'; end if;
  r := public.calculate_business_valuation_payload(to_jsonb(b));
  update public.businesses set
    industry_key = coalesce(industry_key, r->>'industryKey'),
    self_valuation = nullif(r->>'self','')::numeric,
    bench_low = nullif(r->>'low','')::numeric,
    bench_mid = nullif(r->>'mid','')::numeric,
    bench_high = nullif(r->>'high','')::numeric,
    bench_verdict = r->>'verdict',
    bench_config_version = nullif(r->>'configVersion','')::int,
    bench_calculated_at = case when r is null then bench_calculated_at else now() end,
    valuation_factors = r,
    valuation_reasonableness = coalesce(r->>'verdict', valuation_reasonableness),
    updated_at = now()
  where id = business_uuid returning * into b;
  return b;
end $$;

create or replace function public.save_valuation_config(config_payload jsonb)
returns valuation_config language plpgsql security definer set search_path to 'public' as $$
declare new_version int; row valuation_config;
begin
  if not public.is_admin_user() then raise exception 'Admin only'; end if;
  select coalesce(max(version),0)+1 into new_version from public.valuation_config;
  update public.valuation_config set is_active = false where is_active = true;
  insert into public.valuation_config(version,is_active,params,industry,country,growth_curve,size_bands,updated_by,updated_at)
  values(new_version,true,config_payload->'params',config_payload->'industry',config_payload->'country',config_payload->'growth_curve',config_payload->'size_bands',auth.uid(),now()) returning * into row;
  return row;
end $$;

alter table public.valuation_config enable row level security;
alter table public.industry_taxonomy enable row level security;

drop policy if exists "valuation config admin read" on public.valuation_config;
drop policy if exists "valuation config active read" on public.valuation_config;
create policy "valuation config active read" on public.valuation_config for select using (is_active = true or public.is_admin_user());
drop policy if exists "valuation taxonomy public read" on public.industry_taxonomy;
create policy "valuation taxonomy public read" on public.industry_taxonomy for select using (true);
