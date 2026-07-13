-- Keep every new or edited Investor mapped to the canonical 23-industry taxonomy.
create or replace function public.normalize_investor_taxonomy_on_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_industry_source jsonb;
  v_deal_source jsonb;
  v_industries text[];
  v_deal_types text[];
  v_criteria jsonb;
begin
  v_criteria := coalesce(new.criteria, '{}'::jsonb) - 'excludedSectors';

  v_industry_source := to_jsonb(coalesce(new.industries, '{}'::text[]));
  if tg_op = 'INSERT'
    and cardinality(coalesce(new.industries, '{}'::text[])) = 0
    and jsonb_typeof(v_criteria->'sectors') = 'array'
  then
    v_industry_source := v_criteria->'sectors';
  end if;

  select coalesce(array_agg(item.key order by item.first_ord), '{}'::text[])
  into v_industries
  from (
    select
      public.normalize_investor_industry_key(value) as key,
      min(ord) as first_ord
    from jsonb_array_elements_text(v_industry_source)
      with ordinality as source(value, ord)
    where public.normalize_investor_industry_key(value) is not null
    group by public.normalize_investor_industry_key(value)
  ) item;

  v_deal_source := to_jsonb(coalesce(new.deal_types, '{}'::text[]));
  if tg_op = 'INSERT'
    and cardinality(coalesce(new.deal_types, '{}'::text[])) = 0
    and jsonb_typeof(v_criteria->'dealTypes') = 'array'
  then
    v_deal_source := v_criteria->'dealTypes';
  end if;

  select coalesce(array_agg(item.value order by item.first_ord), '{}'::text[])
  into v_deal_types
  from (
    select
      public.normalize_investor_deal_type(value) as value,
      min(ord) as first_ord
    from jsonb_array_elements_text(v_deal_source)
      with ordinality as source(value, ord)
    where public.normalize_investor_deal_type(value) is not null
    group by public.normalize_investor_deal_type(value)
  ) item;

  new.industries := v_industries;
  new.deal_types := v_deal_types;
  new.criteria := jsonb_set(
    jsonb_set(v_criteria, '{sectors}', to_jsonb(v_industries), true),
    '{dealTypes}',
    to_jsonb(v_deal_types),
    true
  );

  return new;
end
$$;

drop trigger if exists trg_normalize_investor_taxonomy_insert
on public.investors;
create trigger trg_normalize_investor_taxonomy_insert
before insert on public.investors
for each row
execute function public.normalize_investor_taxonomy_on_write();

drop trigger if exists trg_normalize_investor_taxonomy_update
on public.investors;
create trigger trg_normalize_investor_taxonomy_update
before update of industries, deal_types, criteria on public.investors
for each row
execute function public.normalize_investor_taxonomy_on_write();
