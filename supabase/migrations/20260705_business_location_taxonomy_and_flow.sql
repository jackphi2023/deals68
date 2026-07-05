-- Deals68 location taxonomy for Business Register/List filters
-- Adds normalized province/city keys without changing public data guard.

create table if not exists public.location_taxonomy (
  key text primary key,
  country_iso2 text not null,
  vi text not null,
  en text not null,
  type text default 'province',
  sort_order int default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.location_taxonomy (key,country_iso2,vi,en,type,sort_order,active) values
('VN-ha-noi','VN','Hà Nội','Hanoi','city',1,true),
('VN-hue','VN','Huế','Hue','city',2,true),
('VN-hai-phong','VN','Hải Phòng','Hai Phong','city',3,true),
('VN-da-nang','VN','Đà Nẵng','Da Nang','city',4,true),
('VN-ho-chi-minh','VN','TP. Hồ Chí Minh','Ho Chi Minh City','city',5,true),
('VN-can-tho','VN','Cần Thơ','Can Tho','city',6,true),
('VN-lai-chau','VN','Lai Châu','Lai Chau','province',7,true),
('VN-dien-bien','VN','Điện Biên','Dien Bien','province',8,true),
('VN-son-la','VN','Sơn La','Son La','province',9,true),
('VN-lao-cai','VN','Lào Cai','Lao Cai','province',10,true),
('VN-tuyen-quang','VN','Tuyên Quang','Tuyen Quang','province',11,true),
('VN-cao-bang','VN','Cao Bằng','Cao Bang','province',12,true),
('VN-lang-son','VN','Lạng Sơn','Lang Son','province',13,true),
('VN-thai-nguyen','VN','Thái Nguyên','Thai Nguyen','province',14,true),
('VN-phu-tho','VN','Phú Thọ','Phu Tho','province',15,true),
('VN-bac-ninh','VN','Bắc Ninh','Bac Ninh','province',16,true),
('VN-quang-ninh','VN','Quảng Ninh','Quang Ninh','province',17,true),
('VN-hung-yen','VN','Hưng Yên','Hung Yen','province',18,true),
('VN-ninh-binh','VN','Ninh Bình','Ninh Binh','province',19,true),
('VN-thanh-hoa','VN','Thanh Hóa','Thanh Hoa','province',20,true),
('VN-nghe-an','VN','Nghệ An','Nghe An','province',21,true),
('VN-ha-tinh','VN','Hà Tĩnh','Ha Tinh','province',22,true),
('VN-quang-tri','VN','Quảng Trị','Quang Tri','province',23,true),
('VN-quang-ngai','VN','Quảng Ngãi','Quang Ngai','province',24,true),
('VN-gia-lai','VN','Gia Lai','Gia Lai','province',25,true),
('VN-dak-lak','VN','Đắk Lắk','Dak Lak','province',26,true),
('VN-khanh-hoa','VN','Khánh Hòa','Khanh Hoa','province',27,true),
('VN-lam-dong','VN','Lâm Đồng','Lam Dong','province',28,true),
('VN-dong-nai','VN','Đồng Nai','Dong Nai','province',29,true),
('VN-tay-ninh','VN','Tây Ninh','Tay Ninh','province',30,true),
('VN-dong-thap','VN','Đồng Tháp','Dong Thap','province',31,true),
('VN-vinh-long','VN','Vĩnh Long','Vinh Long','province',32,true),
('VN-an-giang','VN','An Giang','An Giang','province',33,true),
('VN-ca-mau','VN','Cà Mau','Ca Mau','province',34,true)
on conflict (key) do update set country_iso2=excluded.country_iso2,vi=excluded.vi,en=excluded.en,type=excluded.type,sort_order=excluded.sort_order,active=excluded.active,updated_at=now();

alter table public.businesses add column if not exists city_key text;
create index if not exists idx_businesses_city_key on public.businesses(city_key);

update public.businesses b
set city_key = lt.key
from public.location_taxonomy lt
where b.city_key is null
  and upper(coalesce(b.country_iso2,'VN')) = lt.country_iso2
  and (lower(coalesce(b.city,'')) = lower(lt.vi)
       or lower(coalesce(b.city,'')) = lower(lt.en)
       or (lt.key = 'VN-ho-chi-minh' and lower(coalesce(b.city,'')) in ('tp.hcm','tp hcm','hcmc','ho chi minh city','saigon')));

alter table public.location_taxonomy enable row level security;
drop policy if exists "location taxonomy public read" on public.location_taxonomy;
create policy "location taxonomy public read" on public.location_taxonomy for select using (true);
