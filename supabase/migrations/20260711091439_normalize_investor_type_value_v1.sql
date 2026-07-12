-- Keep Investor type values aligned with the Admin/frontend enum.
update public.investors
set type = 'Nhà đầu tư cá nhân'
where type = 'Individual/Angel';
