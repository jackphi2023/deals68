-- Deals68 Homepage Business selector hardening.
-- The public Homepage RPC previously queried public.businesses as SECURITY INVOKER.
-- Anonymous callers could execute the function but could not SELECT the base table,
-- causing a 401 before the frontend fell back to the public safe view.

begin;

create or replace function public.get_homepage_business_ids(
  max_rows integer default 6
)
returns table (
  business_id uuid,
  display_order integer,
  selected_by_admin boolean
)
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  with params as (
    select greatest(1, least(coalesce(max_rows, 6), 24))::integer as n
  ),
  admin_selected as (
    select b.id, true as selected_by_admin, random() as random_order
    from public.public_businesses_safe b
    where b.show_on_homepage = true
      and b.visible = true
      and b.status = 'active'::public.account_status
      and b.public_snapshot_json is not null
    order by random_order
    limit (select n from params)
  ),
  fallback as (
    select b.id, false as selected_by_admin, random() as random_order
    from public.public_businesses_safe b
    where b.show_on_homepage = false
      and b.visible = true
      and b.status = 'active'::public.account_status
      and b.public_snapshot_json is not null
      and not exists (
        select 1 from admin_selected s where s.id = b.id
      )
    order by random_order
    limit (
      select greatest(0, n - (select count(*) from admin_selected))
      from params
    )
  ),
  combined as (
    select * from admin_selected
    union all
    select * from fallback
  )
  select
    c.id as business_id,
    row_number() over (
      order by c.selected_by_admin desc, c.random_order
    )::integer as display_order,
    c.selected_by_admin
  from combined c
  order by display_order;
$$;

-- Keep implicit PUBLIC access revoked. The RPC is intentionally public only for
-- explicit Supabase application roles and returns public Business IDs only.
revoke all on function public.get_homepage_business_ids(integer)
from public;
grant execute on function public.get_homepage_business_ids(integer)
to anon, authenticated, service_role;

comment on function public.get_homepage_business_ids(integer) is
  'Returns up to 24 public Business IDs for Homepage display using public_businesses_safe only. It never reads the Business base table or returns financial values.';

insert into public.audit_logs (
  actor_id, action, entity_type, entity_id, detail
) values (
  null,
  'homepage_business_ids_safe_view_fix',
  'system',
  'get_homepage_business_ids',
  jsonb_build_object(
    'source', 'public_businesses_safe',
    'base_table_read', false,
    'returns_public_ids_only', true,
    'explicit_execute_roles', jsonb_build_array('anon', 'authenticated', 'service_role')
  )
);

commit;
