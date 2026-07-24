-- Deals68 Business public financial presentation adjustment.
-- Exact annual revenue remains redacted. The approved EBITDA margin is public again so
-- cards and Business Detail can display EBITDA while only Revenue uses the blur mask.

begin;

do $$
begin
  if to_regclass('public.public_businesses_safe_revenue_redacted_v1') is null then
    alter view public.public_businesses_safe
      rename to public_businesses_safe_revenue_redacted_v1;
  end if;
end;
$$;

-- Re-running this migration replaces only the wrapper view. The underlying redacted
-- view remains the canonical safe source for every field except approved EBITDA margin.
drop view if exists public.public_businesses_safe;

create view public.public_businesses_safe
with (security_barrier = true, security_invoker = false)
as
select
  (
    jsonb_populate_record(
      null::public.public_businesses_safe_revenue_redacted_v1,
      to_jsonb(redacted)
      || jsonb_build_object(
        'revenue_2025', null,
        'ebitda_margin', coalesce(
          public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'),
          b.ebitda_margin
        )
      )
    )
  ).*
from public.public_businesses_safe_revenue_redacted_v1 redacted
join public.businesses b on b.id = redacted.id;

alter view public.public_businesses_safe owner to postgres;
revoke all on public.public_businesses_safe from public, anon, authenticated;
grant select on public.public_businesses_safe to anon, authenticated, service_role;

comment on column public.public_businesses_safe.revenue_2025 is
  'Compatibility column intentionally redacted to NULL. Exact Revenue requires a Business-specific active financial grant.';
comment on column public.public_businesses_safe.ebitda_margin is
  'Approved EBITDA margin is public. Revenue and other exact sensitive financial values remain redacted.';
comment on column public.public_businesses_safe.public_snapshot_json is
  'Redacted public snapshot. Exact Revenue, growth and numeric asset values remain omitted; approved EBITDA is exposed only in the dedicated top-level column.';

insert into public.audit_logs (
  actor_id, action, entity_type, entity_id, detail
) values (
  null,
  'business_public_ebitda_visibility_v1',
  'system',
  'public_businesses_safe',
  jsonb_build_object(
    'exact_revenue_public', false,
    'exact_ebitda_public', true,
    'ebitda_source', 'admin_approved_snapshot_or_business_value',
    'revenue_mask_required', true,
    'public_snapshot_exact_financial_changed', false
  )
);

notify pgrst, 'reload schema';

commit;
