-- Deals68 Investor Premium pricing — V2.
-- Replaces only the canonical server-side monthly price contract.
-- Historical payment orders, memberships, discounts and entitlements are unchanged.

begin;

create or replace function public.d68_get_investor_premium_price(
  p_country_iso2 text default 'VN'
)
returns jsonb
language sql
immutable
security invoker
set search_path = public
as $function$
  select jsonb_build_object(
    'plan', 'premium',
    'billing_period', 'month',
    'currency', case
      when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 'VND'
      else 'USD'
    end,
    'unit_amount', case
      when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 26000000
      else 1000
    end,
    'price_version', 'investor-premium-v2-20260724',
    'effective_from', '2026-07-24'
  );
$function$;

revoke all on function public.d68_get_investor_premium_price(text)
from public;
grant execute on function public.d68_get_investor_premium_price(text)
to anon, authenticated, service_role;

comment on function public.d68_get_investor_premium_price(text) is
  'Canonical Investor Premium monthly price: VND 26,000,000 in Vietnam and USD 1,000 in other countries, effective 2026-07-24.';

commit;
