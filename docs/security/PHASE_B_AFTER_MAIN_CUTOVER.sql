-- Deals68 G1 Security Phase B — ENFORCEMENT
-- DO NOT APPLY while deals68.com/main still reads raw businesses/investors.
-- Apply only after BOTH beta-reference and main are deployed with:
--   public_businesses_safe
--   public_investors_safe
-- and authenticated dashboard relation RPCs.
-- This file is intentionally stored under docs/security, not supabase/migrations.

begin;

-- Anonymous visitors may only use the safe public views/RPCs.
revoke select on public.businesses, public.investors from anon;

-- Remove row-public raw-table policies. Column privacy cannot be enforced by RLS,
-- therefore visible public rows must no longer be readable from raw tables.
drop policy if exists "public visible businesses" on public.businesses;
drop policy if exists "public visible investors" on public.investors;

-- Authenticated users may read only their own private record; Admin may read all.
create policy "business owner or admin raw select"
on public.businesses
for select
to authenticated
using (owner_id = auth.uid() or public.is_admin());

create policy "investor owner or admin raw select"
on public.investors
for select
to authenticated
using (owner_id = auth.uid() or public.is_admin());

-- Tighten direct Investor writes after the old main frontend is no longer live.
-- The supported path is update_my_investor_profile/update_my_investor_contact.
create or replace function public.protect_investor_admin_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_pending jsonb;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if old.owner_id is distinct from auth.uid() then
    raise exception 'investor_update_not_owned';
  end if;

  if new.owner_id is distinct from old.owner_id
    or new.code is distinct from old.code
    or new.title_vi is distinct from old.title_vi
    or new.title_en is distinct from old.title_en
    or new.desc_vi is distinct from old.desc_vi
    or new.desc_en is distinct from old.desc_en
    or new.visible is distinct from old.visible
    or new.verified is distinct from old.verified
    or new.admin_priority is distinct from old.admin_priority
    or new.activity_level is distinct from old.activity_level
    or new.status is distinct from old.status
  then
    raise exception 'protected_investor_field';
  end if;

  v_pending := coalesce(new.privacy->'pending_profile_changes', '{}'::jsonb);
  if jsonb_typeof(v_pending) = 'object'
     and exists (
       select 1
       from jsonb_object_keys(v_pending) key_name
       where key_name not in ('desc_vi', 'desc_en')
     )
  then
    raise exception 'invalid_pending_profile_fields';
  end if;

  return new;
end;
$$;

commit;
