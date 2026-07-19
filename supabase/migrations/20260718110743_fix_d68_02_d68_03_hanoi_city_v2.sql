begin;

-- Normalize the two approved profiles so Dashboard, public snapshot and city facets
-- all use the same Vietnam/Hanoi location contract.
alter table public.businesses disable trigger trg_refresh_quality_businesses;

do $$
declare
  affected_rows integer;
begin
  update public.businesses
  set
    country_iso2 = 'VN',
    city = 'Hà Nội',
    city_key = 'VN-ha-noi',
    public_snapshot_json = coalesce(public_snapshot_json, '{}'::jsonb)
      || jsonb_build_object(
        'country_iso2', 'VN',
        'city', 'Hà Nội',
        'city_key', 'VN-ha-noi'
      ),
    updated_at = now()
  where public_code in ('D68-02', 'D68-03');

  get diagnostics affected_rows = row_count;
  if affected_rows <> 2 then
    raise exception 'Expected to update 2 businesses, updated %', affected_rows;
  end if;
end
$$;

alter table public.businesses enable trigger trg_refresh_quality_businesses;

commit;
