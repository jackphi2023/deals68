alter table public.business_files
  alter column category drop default;

update public.business_files
set category = case
  when category is null or btrim(category) = '' then null
  when lower(btrim(category)) in ('corporate', 'profile', 'organization', 'organisation') then 'corporate'
  when lower(btrim(category)) in ('legal', 'legal_document', 'legal_documents') then 'legal'
  when lower(btrim(category)) in ('business', 'im', 'teaser', 'operations', 'operational') then 'business'
  when lower(btrim(category)) in ('financial', 'financials', 'finance', 'tax') then 'financial'
  else null
end;

comment on column public.business_files.category is
  'Optional owner-selected document group: corporate, legal, business or financial.';
