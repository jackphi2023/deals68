begin;

-- SECURITY DEFINER RPCs must never be executable by anon or PUBLIC.
-- Authenticated access remains explicit; every Admin RPC also validates
-- public.is_admin_user() internally before changing data.

revoke execute on function public.admin_set_default_investor_cover(text, text)
from anon, public;
grant execute on function public.admin_set_default_investor_cover(text, text)
to authenticated, service_role;

revoke execute on function public.admin_set_investor_cover(uuid, text, text)
from anon, public;
grant execute on function public.admin_set_investor_cover(uuid, text, text)
to authenticated, service_role;

revoke execute on function public.admin_approve_investor_appetite(uuid, text)
from anon, public;
grant execute on function public.admin_approve_investor_appetite(uuid, text)
to authenticated, service_role;

revoke execute on function public.submit_my_investor_appetite(text)
from anon, public;
grant execute on function public.submit_my_investor_appetite(text)
to authenticated, service_role;

commit;
