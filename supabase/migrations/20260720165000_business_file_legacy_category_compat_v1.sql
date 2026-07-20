update public.business_files
set category = case category
  when 'corporate' then 'profile'
  when 'business' then 'im'
  when 'financial' then 'financials'
  else category
end
where category in ('corporate', 'business', 'financial');

comment on column public.business_files.category is
  'Optional document group. New values are corporate, legal, business or financial; legacy values remain readable until the owner saves a category.';
