-- Deals68 Investor marketplace guest-access hardening.
-- Guest users retain only the aggregate active-Investor count used by Home.
-- Investor list/detail rows are available only to signed-in Business, Investor
-- and Admin profiles. Market Partner, Advisor and unauthenticated sessions are denied.

create or replace function public.d68_can_view_investor_marketplace()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in (
          'business'::public.user_role,
          'investor'::public.user_role,
          'admin'::public.user_role
        )
    );
$$;

revoke all on function public.d68_can_view_investor_marketplace()
  from public, anon, authenticated;
grant execute on function public.d68_can_view_investor_marketplace()
  to authenticated, service_role;

create or replace function public.d68_get_public_investor_count()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::bigint
  from public.investors i
  where i.visible = true
    and i.status = 'active'::public.account_status;
$$;

revoke all on function public.d68_get_public_investor_count()
  from public, anon, authenticated;
grant execute on function public.d68_get_public_investor_count()
  to anon, authenticated, service_role;

-- Replace the broad PUBLIC policy with an authenticated, role-aware policy.
drop policy if exists "public visible investors" on public.investors;
drop policy if exists "investor marketplace authenticated read" on public.investors;
create policy "investor marketplace authenticated read"
on public.investors
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (select public.is_admin())
  or (
    visible = true
    and status = 'active'::public.account_status
    and (select public.d68_can_view_investor_marketplace())
  )
);

revoke all on table public.investors from public, anon;
grant select, insert, update, delete on table public.investors to authenticated;
grant all on table public.investors to service_role;

-- The safe view remains security_invoker and therefore obeys the policy above.
revoke all on table public.public_investors_safe from public, anon;
grant select on table public.public_investors_safe to authenticated, service_role;

-- Proposal history is part of Investor Detail and must follow the same gate.
create or replace function public.get_public_investor_proposal_history(investor_uuid uuid)
returns table(
  sent_at timestamptz,
  business_slug text,
  business_title text,
  business_public_code text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    p.sent_at,
    b.slug::text as business_slug,
    coalesce(
      nullif(b.title_vi, ''),
      nullif(b.title_en, ''),
      nullif(b.public_code, ''),
      'Hồ sơ doanh nghiệp ẩn danh'
    )::text as business_title,
    b.public_code::text as business_public_code
  from public.proposals p
  join public.businesses b on b.id = p.business_id
  join public.investors i on i.id = p.investor_id
  where public.d68_can_view_investor_marketplace()
    and p.investor_id = investor_uuid
    and i.visible = true
    and i.status = 'active'::public.account_status
    and b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
  order by p.sent_at desc
  limit 10;
$$;

revoke all on function public.get_public_investor_proposal_history(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_investor_proposal_history(uuid)
  to authenticated, service_role;

-- Legacy bootstrap returned full Investor rows. It is no longer a public API.
revoke all on function public.get_public_homepage_bootstrap(integer, integer)
  from public, anon;
grant execute on function public.get_public_homepage_bootstrap(integer, integer)
  to authenticated, service_role;

comment on function public.d68_get_public_investor_count() is
  'Public aggregate only. Returns the active visible Investor count without exposing Investor rows.';
comment on function public.d68_can_view_investor_marketplace() is
  'Authorization helper for signed-in Business, Investor and Admin profiles.';
