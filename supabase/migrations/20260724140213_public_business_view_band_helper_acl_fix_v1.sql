-- Deals68 public Business view helper ACL fix.
-- The public_businesses_safe view computes only coarse discovery bands through
-- immutable, table-free helper functions. Phase B revoked EXECUTE from anon and
-- authenticated, which caused every public Business query to fail even though
-- SELECT on the safe view remained granted.

begin;

do $$
begin
  if to_regprocedure('public.d68_public_revenue_band_key(numeric,text)') is null
     or to_regprocedure('public.d68_public_revenue_band_rank(numeric,text)') is null
     or to_regprocedure('public.d68_public_revenue_match_band_key(numeric,text)') is null
     or to_regprocedure('public.d68_public_ebitda_band_key(numeric)') is null then
    raise exception 'Required public Business band helper function is missing';
  end if;
end;
$$;

-- Keep PUBLIC revoked so only explicit Supabase application roles can execute.
revoke all on function public.d68_public_revenue_band_key(numeric, text)
from public;
revoke all on function public.d68_public_revenue_band_rank(numeric, text)
from public;
revoke all on function public.d68_public_revenue_match_band_key(numeric, text)
from public;
revoke all on function public.d68_public_ebitda_band_key(numeric)
from public;

grant execute on function public.d68_public_revenue_band_key(numeric, text)
to anon, authenticated, service_role;
grant execute on function public.d68_public_revenue_band_rank(numeric, text)
to anon, authenticated, service_role;
grant execute on function public.d68_public_revenue_match_band_key(numeric, text)
to anon, authenticated, service_role;
grant execute on function public.d68_public_ebitda_band_key(numeric)
to anon, authenticated, service_role;

comment on function public.d68_public_revenue_band_key(numeric, text) is
  'Immutable table-free helper used by public_businesses_safe. Explicitly executable by anon/authenticated because it only classifies caller-supplied values into coarse public bands.';
comment on function public.d68_public_revenue_band_rank(numeric, text) is
  'Immutable table-free helper used by public_businesses_safe to sort coarse public revenue bands.';
comment on function public.d68_public_revenue_match_band_key(numeric, text) is
  'Immutable table-free helper used by public_businesses_safe for coarse Investor matching bands.';
comment on function public.d68_public_ebitda_band_key(numeric) is
  'Immutable table-free helper used by public_businesses_safe for coarse EBITDA bands.';

insert into public.audit_logs (
  actor_id, action, entity_type, entity_id, detail
) values (
  null,
  'public_business_view_band_helper_acl_fix',
  'system',
  'public_businesses_safe',
  jsonb_build_object(
    'helper_execute_roles', jsonb_build_array('anon', 'authenticated', 'service_role'),
    'public_role_execute', false,
    'base_table_select_changed', false,
    'exact_financial_public_changed', false,
    'reason', 'restore safe view execution after Phase B helper ACL revocation'
  )
);

commit;
