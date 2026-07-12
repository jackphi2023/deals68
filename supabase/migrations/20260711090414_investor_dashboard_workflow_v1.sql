-- Deals68 Investor Dashboard workflow v1
-- Already applied to Supabase project tucaqhsfdjbclxqaoxio.
-- This file records the migration in Git for reproducibility.

create or replace function public.normalize_investor_industry_key(raw_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(trim(coalesce(raw_value, '')))
    when 'agriculture' then 'agriculture'
    when 'nông nghiệp' then 'agriculture'
    when 'automobile' then 'automobile'
    when 'ô tô & phụ tùng' then 'automobile'
    when 'beauty & personal care' then 'beauty_personal_care'
    when 'làm đẹp & chăm sóc cá nhân' then 'beauty_personal_care'
    when 'building, construction & materials' then 'construction_materials'
    when 'construction & materials' then 'construction_materials'
    when 'xây dựng & vật liệu' then 'construction_materials'
    when 'chemicals' then 'chemicals'
    when 'hóa chất' then 'chemicals'
    when 'education' then 'education_training'
    when 'education & training' then 'education_training'
    when 'giáo dục & đào tạo' then 'education_training'
    when 'energy & utilities' then 'energy_utilities'
    when 'năng lượng & tiện ích' then 'energy_utilities'
    when 'entertainment & leisure' then 'entertainment_leisure'
    when 'giải trí & nghỉ dưỡng' then 'entertainment_leisure'
    when 'finance' then 'finance'
    when 'tài chính' then 'finance'
    when 'f&b' then 'food_beverage'
    when 'food & beverage' then 'food_beverage'
    when 'thực phẩm & đồ uống (f&b)' then 'food_beverage'
    when 'healthcare' then 'healthcare'
    when 'health care' then 'healthcare'
    when 'y tế & chăm sóc sức khỏe' then 'healthcare'
    when 'hotels & resorts' then 'hotels_resorts'
    when 'khách sạn & resort' then 'hotels_resorts'
    when 'it & software' then 'it_software'
    when 'it & software / technology' then 'it_software'
    when 'cntt & phần mềm' then 'it_software'
    when 'manufacturing' then 'manufacturing'
    when 'sản xuất' then 'manufacturing'
    when 'media & advertising' then 'media_advertising'
    when 'truyền thông & quảng cáo' then 'media_advertising'
    when 'real estate' then 'real_estate'
    when 'bất động sản' then 'real_estate'
    when 'retail' then 'retail'
    when 'bán lẻ' then 'retail'
    when 'services' then 'services'
    when 'business services' then 'services'
    when 'dịch vụ (b2b/b2c)' then 'services'
    when 'logistics' then 'transportation_logistics'
    when 'transportation & logistics' then 'transportation_logistics'
    when 'logistics & vận tải' then 'transportation_logistics'
    when 'travel' then 'travel'
    when 'du lịch' then 'travel'
    when 'e-commerce' then 'ecommerce'
    when 'ecommerce' then 'ecommerce'
    when 'thương mại điện tử' then 'ecommerce'
    when 'textiles & apparel' then 'textiles_apparel'
    when 'dệt may & thời trang' then 'textiles_apparel'
    when 'seafood & export' then 'seafood_export'
    when 'thủy sản & xuất khẩu' then 'seafood_export'
    when 'beauty_personal_care' then 'beauty_personal_care'
    when 'construction_materials' then 'construction_materials'
    when 'education_training' then 'education_training'
    when 'energy_utilities' then 'energy_utilities'
    when 'entertainment_leisure' then 'entertainment_leisure'
    when 'food_beverage' then 'food_beverage'
    when 'hotels_resorts' then 'hotels_resorts'
    when 'it_software' then 'it_software'
    when 'media_advertising' then 'media_advertising'
    when 'real_estate' then 'real_estate'
    when 'transportation_logistics' then 'transportation_logistics'
    when 'textiles_apparel' then 'textiles_apparel'
    when 'seafood_export' then 'seafood_export'
    else null
  end
$$;

create or replace function public.normalize_investor_deal_type(raw_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(trim(coalesce(raw_value, '')))
    when 'investment' then 'Investment'
    when 'fundraise' then 'Investment'
    when 'partial stake sale' then 'Investment'
    when 'đầu tư thiểu số' then 'Investment'
    when 'lending' then 'Lending'
    when 'debt/loan' then 'Lending'
    when 'debt / loan' then 'Lending'
    when 'm&a' then 'M&A'
    when 'full acquisition' then 'M&A'
    when 'partnership / jv' then 'Partnership / JV'
    when 'strategic partnership' then 'Partnership / JV'
    else null
  end
$$;

do $$
declare
  r record;
  p jsonb;
  v_industries text[];
  v_deal_types text[];
  v_criteria jsonb;
  v_privacy jsonb;
  v_desc_pending jsonb;
begin
  for r in select i.* from public.investors i
  loop
    p := coalesce(r.privacy->'pending_profile_changes', '{}'::jsonb);

    select coalesce(array_agg(x.key order by x.first_ord), '{}'::text[])
      into v_industries
    from (
      select public.normalize_investor_industry_key(value) as key,
             min(ord) as first_ord
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(p->'industries') = 'array'
            then p->'industries'
          else to_jsonb(coalesce(r.industries, '{}'::text[]))
        end
      ) with ordinality as e(value, ord)
      where public.normalize_investor_industry_key(value) is not null
      group by public.normalize_investor_industry_key(value)
    ) x;

    select coalesce(array_agg(x.value order by x.first_ord), '{}'::text[])
      into v_deal_types
    from (
      select public.normalize_investor_deal_type(value) as value,
             min(ord) as first_ord
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(p->'deal_types') = 'array'
            then p->'deal_types'
          else to_jsonb(coalesce(r.deal_types, '{}'::text[]))
        end
      ) with ordinality as e(value, ord)
      where public.normalize_investor_deal_type(value) is not null
      group by public.normalize_investor_deal_type(value)
    ) x;

    v_criteria := (
      coalesce(r.criteria, '{}'::jsonb) ||
      case
        when jsonb_typeof(p->'criteria') = 'object'
          then p->'criteria'
        else '{}'::jsonb
      end
    ) - 'excludedSectors';
    v_criteria := jsonb_set(
      v_criteria,
      '{sectors}',
      to_jsonb(v_industries),
      true
    );
    v_criteria := jsonb_set(
      v_criteria,
      '{dealTypes}',
      to_jsonb(v_deal_types),
      true
    );

    v_privacy := coalesce(r.privacy, '{}'::jsonb)
      - 'pending_profile_changes'
      - 'pending_submitted_at';
    v_desc_pending := jsonb_strip_nulls(jsonb_build_object(
      'desc_vi',
      case
        when p ? 'desc_vi'
          and coalesce(p->>'desc_vi', '') is distinct from coalesce(r.desc_vi, '')
          then p->>'desc_vi'
      end,
      'desc_en',
      case
        when p ? 'desc_en'
          and coalesce(p->>'desc_en', '') is distinct from coalesce(r.desc_en, '')
          then p->>'desc_en'
      end
    ));

    if v_desc_pending <> '{}'::jsonb then
      v_privacy := v_privacy || jsonb_build_object(
        'pending_profile_changes',
        v_desc_pending,
        'pending_submitted_at',
        coalesce(r.privacy->>'pending_submitted_at', now()::text)
      );
    end if;

    update public.investors i
    set
      type = case
        when p ? 'type'
          then coalesce(nullif(p->>'type', ''), i.type)
        else i.type
      end,
      country = case
        when p ? 'country'
          then coalesce(nullif(p->>'country', ''), i.country)
        else i.country
      end,
      country_iso2 = case
        when p ? 'country_iso2'
          then coalesce(nullif(upper(p->>'country_iso2'), ''), i.country_iso2)
        else i.country_iso2
      end,
      region = case
        when p ? 'region'
          then coalesce(nullif(p->>'region', ''), i.region)
        else i.region
      end,
      industries = v_industries,
      deal_types = v_deal_types,
      stage = case
        when p ? 'stage'
          then coalesce(nullif(p->>'stage', ''), i.stage)
        else i.stage
      end,
      ticket_min = case
        when p ? 'ticket_min'
          and (p->>'ticket_min') ~ '^[0-9]+([.][0-9]+)?$'
          then (p->>'ticket_min')::numeric
        else i.ticket_min
      end,
      ticket_max = case
        when p ? 'ticket_max'
          and (p->>'ticket_max') ~ '^[0-9]+([.][0-9]+)?$'
          then (p->>'ticket_max')::numeric
        else i.ticket_max
      end,
      criteria = v_criteria,
      privacy = v_privacy
    where i.id = r.id;
  end loop;
end
$$;

create or replace function public.express_investor_interest(
  investor_uuid uuid,
  business_uuid uuid,
  interest_note text default null
)
returns public.investor_interests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.investor_interests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not public.is_admin() and not exists (
    select 1
    from public.investors i
    where i.id = investor_uuid
      and i.owner_id = auth.uid()
  ) then
    raise exception 'investor_not_owned';
  end if;

  if not exists (
    select 1
    from public.businesses b
    where b.id = business_uuid
      and b.visible = true
      and b.status = 'active'::public.account_status
      and b.public_snapshot_json is not null
  ) then
    raise exception 'business_not_available';
  end if;

  insert into public.investor_interests (
    investor_id,
    business_id,
    status,
    created_at,
    updated_at
  )
  values (
    investor_uuid,
    business_uuid,
    'pending',
    now(),
    now()
  )
  on conflict (business_id, investor_id)
  do update
    set status = 'pending',
        updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.get_business_file_metadata_for_viewer(
  business_uuid uuid
)
returns table (
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
as $$
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
    and f.public_visible = true
    and nullif(trim(coalesce(f.display_name, '')), '') is not null
    and b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
    and auth.uid() is not null
    and (
      public.is_admin()
      or b.owner_id = auth.uid()
      or exists (
        select 1
        from public.investors i
        where i.owner_id = auth.uid()
      )
    )
  order by f.created_at desc
$$;

create or replace function public.update_my_investor_profile(
  profile_patch jsonb default '{}'::jsonb,
  description_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.investors%rowtype;
  v_industries text[];
  v_deal_types text[];
  v_criteria jsonb;
  v_privacy jsonb;
  v_pending jsonb;
  v_desc_vi text;
  v_desc_en text;
  v_description_pending boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if profile_patch ?| array[
    'owner_id',
    'code',
    'title_vi',
    'title_en',
    'desc_vi',
    'desc_en',
    'visible',
    'verified',
    'admin_priority',
    'activity_level',
    'status'
  ] then
    raise exception 'protected_field';
  end if;

  select *
  into v_row
  from public.investors i
  where i.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'investor_not_found';
  end if;

  if profile_patch ? 'industries' then
    select coalesce(array_agg(x.key order by x.first_ord), '{}'::text[])
    into v_industries
    from (
      select public.normalize_investor_industry_key(value) as key,
             min(ord) as first_ord
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(profile_patch->'industries') = 'array'
            then profile_patch->'industries'
          else '[]'::jsonb
        end
      ) with ordinality as e(value, ord)
      where public.normalize_investor_industry_key(value) is not null
      group by public.normalize_investor_industry_key(value)
    ) x;
  else
    v_industries := coalesce(v_row.industries, '{}'::text[]);
  end if;

  if profile_patch ? 'deal_types' then
    select coalesce(array_agg(x.value order by x.first_ord), '{}'::text[])
    into v_deal_types
    from (
      select public.normalize_investor_deal_type(value) as value,
             min(ord) as first_ord
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(profile_patch->'deal_types') = 'array'
            then profile_patch->'deal_types'
          else '[]'::jsonb
        end
      ) with ordinality as e(value, ord)
      where public.normalize_investor_deal_type(value) is not null
      group by public.normalize_investor_deal_type(value)
    ) x;
  else
    v_deal_types := coalesce(v_row.deal_types, '{}'::text[]);
  end if;

  v_criteria := (
    coalesce(v_row.criteria, '{}'::jsonb) ||
    case
      when jsonb_typeof(profile_patch->'criteria') = 'object'
        then profile_patch->'criteria'
      else '{}'::jsonb
    end
  ) - 'excludedSectors';
  v_criteria := jsonb_set(
    v_criteria,
    '{sectors}',
    to_jsonb(v_industries),
    true
  );
  v_criteria := jsonb_set(
    v_criteria,
    '{dealTypes}',
    to_jsonb(v_deal_types),
    true
  );

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  if description_patch ? 'desc_vi'
    or description_patch ? 'desc_en'
  then
    v_desc_vi := coalesce(
      description_patch->>'desc_vi',
      v_row.desc_vi,
      ''
    );
    v_desc_en := coalesce(
      description_patch->>'desc_en',
      v_row.desc_en,
      ''
    );
    v_pending := jsonb_strip_nulls(jsonb_build_object(
      'desc_vi',
      case
        when v_desc_vi is distinct from coalesce(v_row.desc_vi, '')
          then v_desc_vi
      end,
      'desc_en',
      case
        when v_desc_en is distinct from coalesce(v_row.desc_en, '')
          then v_desc_en
      end
    ));
    v_privacy := v_privacy
      - 'pending_profile_changes'
      - 'pending_submitted_at';

    if v_pending <> '{}'::jsonb then
      v_description_pending := true;
      v_privacy := v_privacy || jsonb_build_object(
        'pending_profile_changes',
        v_pending,
        'pending_submitted_at',
        now()::text
      );
    end if;
  else
    v_description_pending :=
      jsonb_typeof(v_privacy->'pending_profile_changes') = 'object'
      and (v_privacy->'pending_profile_changes') <> '{}'::jsonb;
  end if;

  update public.investors i
  set
    private_name = case
      when profile_patch ? 'private_name'
        then nullif(trim(profile_patch->>'private_name'), '')
      else i.private_name
    end,
    private_website = case
      when profile_patch ? 'private_website'
        then nullif(trim(profile_patch->>'private_website'), '')
      else i.private_website
    end,
    type = case
      when profile_patch ? 'type'
        then coalesce(nullif(trim(profile_patch->>'type'), ''), i.type)
      else i.type
    end,
    country = case
      when profile_patch ? 'country'
        then coalesce(nullif(trim(profile_patch->>'country'), ''), i.country)
      else i.country
    end,
    country_iso2 = case
      when profile_patch ? 'country_iso2'
        then coalesce(
          nullif(upper(trim(profile_patch->>'country_iso2')), ''),
          i.country_iso2
        )
      else i.country_iso2
    end,
    region = case
      when profile_patch ? 'region'
        then coalesce(nullif(trim(profile_patch->>'region'), ''), i.region)
      else i.region
    end,
    industries = v_industries,
    deal_types = v_deal_types,
    stage = case
      when profile_patch ? 'stage'
        then coalesce(nullif(trim(profile_patch->>'stage'), ''), i.stage)
      else i.stage
    end,
    ticket_min = case
      when profile_patch ? 'ticket_min'
        and (profile_patch->>'ticket_min') ~ '^[0-9]+([.][0-9]+)?$'
        then (profile_patch->>'ticket_min')::numeric
      else i.ticket_min
    end,
    ticket_max = case
      when profile_patch ? 'ticket_max'
        and (profile_patch->>'ticket_max') ~ '^[0-9]+([.][0-9]+)?$'
        then (profile_patch->>'ticket_max')::numeric
      else i.ticket_max
    end,
    criteria = v_criteria,
    privacy = v_privacy,
    updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id',
    v_row.id,
    'description_pending',
    v_description_pending
  );
end
$$;

create or replace function public.update_my_investor_contact(
  contact_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.investors%rowtype;
  v_privacy jsonb;
  v_email text;
  v_phone text;
  v_website text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_row
  from public.investors i
  where i.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'investor_not_found';
  end if;

  v_email := nullif(
    trim(coalesce(contact_patch->>'email', v_row.private_email, '')),
    ''
  );
  v_phone := nullif(
    trim(coalesce(contact_patch->>'phone', v_row.private_phone, '')),
    ''
  );
  v_website := nullif(
    trim(coalesce(contact_patch->>'website', v_row.private_website, '')),
    ''
  );

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb) ||
    jsonb_build_object(
      'email',
      v_email,
      'phone',
      v_phone,
      'website',
      v_website,
      'shareEmail',
      coalesce((contact_patch->>'shareEmail')::boolean, false),
      'sharePhone',
      coalesce((contact_patch->>'sharePhone')::boolean, false),
      'shareWebsite',
      coalesce((contact_patch->>'shareWebsite')::boolean, true)
    );

  update public.investors i
  set
    private_email = v_email,
    private_phone = v_phone,
    private_website = v_website,
    privacy = v_privacy,
    updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id',
    v_row.id,
    'updated',
    true
  );
end
$$;

create or replace function public.protect_investor_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending jsonb;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
    or public.is_admin()
  then
    return new;
  end if;

  if old.owner_id = auth.uid() then
    if new.owner_id is distinct from old.owner_id
      or new.code is distinct from old.code
      or new.title_vi is distinct from old.title_vi
      or new.title_en is distinct from old.title_en
      or new.desc_vi is distinct from old.desc_vi
      or new.desc_en is distinct from old.desc_en
      or new.visible is distinct from old.visible
      or new.verified is distinct from old.verified
      or new.admin_priority is distinct from old.admin_priority
      or new.activity_level is distinct from old.activity_level
      or new.status is distinct from old.status
    then
      raise exception 'protected_investor_field';
    end if;

    v_pending := coalesce(
      new.privacy->'pending_profile_changes',
      '{}'::jsonb
    );
    if jsonb_typeof(v_pending) = 'object'
      and exists (
        select 1
        from jsonb_object_keys(v_pending) key_name
        where key_name not in ('desc_vi', 'desc_en')
      )
    then
      raise exception 'invalid_pending_profile_fields';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_protect_investor_admin_fields
on public.investors;

create trigger trg_protect_investor_admin_fields
before update on public.investors
for each row
execute function public.protect_investor_admin_fields();

update public.investors
set type = 'Nhà đầu tư cá nhân'
where type = 'Individual/Angel';

revoke all on function public.normalize_investor_industry_key(text)
from public, anon;
revoke all on function public.normalize_investor_deal_type(text)
from public, anon;
revoke all on function public.express_investor_interest(uuid, uuid, text)
from public, anon;
revoke all on function public.get_business_file_metadata_for_viewer(uuid)
from public, anon;
revoke all on function public.update_my_investor_profile(jsonb, jsonb)
from public, anon;
revoke all on function public.update_my_investor_contact(jsonb)
from public, anon;

grant execute
on function public.express_investor_interest(uuid, uuid, text)
to authenticated;
grant execute
on function public.get_business_file_metadata_for_viewer(uuid)
to authenticated;
grant execute
on function public.update_my_investor_profile(jsonb, jsonb)
to authenticated;
grant execute
on function public.update_my_investor_contact(jsonb)
to authenticated;
