-- Deals68 G1 Phase A view hardening.
-- This migration version matches Supabase project history.
-- It is safe on a fresh database because it only acts when the views already exist.

do $$
begin
  if to_regclass('public.public_businesses_safe') is not null then
    execute 'revoke all on public.public_businesses_safe from public, anon, authenticated';
    execute 'grant select on public.public_businesses_safe to anon, authenticated';
    execute 'alter view public.public_businesses_safe set (security_invoker = true)';
  end if;

  if to_regclass('public.public_investors_safe') is not null then
    execute 'revoke all on public.public_investors_safe from public, anon, authenticated';
    execute 'grant select on public.public_investors_safe to anon, authenticated';
    execute 'alter view public.public_investors_safe set (security_invoker = true)';
  end if;
end
$$;
