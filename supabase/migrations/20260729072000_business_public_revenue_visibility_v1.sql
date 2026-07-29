-- Deals68 Business annual revenue public visibility.
-- Business owners may immediately opt in/out of exposing the exact approved annual revenue.
-- The existing Investor-specific financial grant workflow remains unchanged.

begin;

alter table public.businesses
  add column if not exists revenue_public_visible boolean not null default false;

comment on column public.businesses.revenue_public_visible is
  'Owner-controlled opt-in for exposing exact approved annual revenue on public pages. Defaults to false.';

create or replace function public.protect_business_admin_fields()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  old_locked jsonb;
  new_locked jsonb;
  forbidden_pending text[] := array[
    'owner_id', 'public_code', 'slug', 'plan', 'visible', 'status',
    'quota_total', 'quota_used', 'public_snapshot_json', 'public_version',
    'last_approved_at', 'last_approved_by', 'show_on_homepage',
    'quality_score', 'quality_score_auto', 'quality_breakdown',
    'quality_breakdown_json', 'quality_score_manual_override',
    'quality_score_manual_note', 'hero_image_url', 'image_url',
    'revenue_public_visible'
  ];
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or public.is_admin() then
    return new;
  end if;

  if old.owner_id is distinct from auth.uid() then
    raise exception 'business_update_not_owned';
  end if;

  old_locked := to_jsonb(old) - array[
    'pending_changes_json', 'pending_submitted_at', 'pending_submitted_by',
    'moderation_status', 'visible', 'status', 'updated_at',
    'revenue_public_visible'
  ];
  new_locked := to_jsonb(new) - array[
    'pending_changes_json', 'pending_submitted_at', 'pending_submitted_by',
    'moderation_status', 'visible', 'status', 'updated_at',
    'revenue_public_visible'
  ];

  if new_locked is distinct from old_locked then
    raise exception 'protected_business_field';
  end if;

  if new.pending_submitted_by is distinct from old.pending_submitted_by
     and new.pending_submitted_by is distinct from auth.uid() then
    raise exception 'invalid_pending_submitter';
  end if;

  if new.moderation_status is distinct from old.moderation_status
     and new.moderation_status is distinct from 'pending_admin_review' then
    raise exception 'invalid_business_moderation_status';
  end if;

  if new.visible is distinct from old.visible and new.visible is distinct from false then
    raise exception 'business_cannot_self_publish';
  end if;

  if new.status is distinct from old.status
     and new.status::text is distinct from 'pending_admin_review' then
    raise exception 'business_cannot_change_status';
  end if;

  if coalesce(new.pending_changes_json, '{}'::jsonb) ?| forbidden_pending then
    raise exception 'forbidden_business_pending_field';
  end if;

  return new;
end;
$function$;

-- Preserve the canonical redacted view and replace only the public presentation wrapper.
-- The wrapper restores exact annual revenue only when the owner has explicitly opted in.
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
        'revenue_2025', case
          when coalesce(b.revenue_public_visible, false) then coalesce(
            public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'),
            b.revenue_2025
          )
          else null::numeric
        end,
        'ebitda_margin', coalesce(
          public.d68_try_numeric(b.public_snapshot_json->>'ebitda_margin'),
          b.ebitda_margin
        ),
        'public_snapshot_json',
          (
            coalesce(redacted.public_snapshot_json, '{}'::jsonb)
            - 'revenue_2025'
            - 'revenue_currency'
            - 'revenue_public_visible'
          )
          || jsonb_build_object(
            'revenue_public_visible', coalesce(b.revenue_public_visible, false)
          )
          || case
            when coalesce(b.revenue_public_visible, false) then jsonb_strip_nulls(
              jsonb_build_object(
                'revenue_2025', coalesce(
                  public.d68_try_numeric(b.public_snapshot_json->>'revenue_2025'),
                  b.revenue_2025
                ),
                'revenue_currency', coalesce(
                  nullif(b.public_snapshot_json->>'revenue_currency', ''),
                  nullif(b.revenue_currency, ''),
                  'VND'
                )
              )
            )
            else '{}'::jsonb
          end
      )
    )
  ).*
from public.public_businesses_safe_revenue_redacted_v1 redacted
join public.businesses b on b.id = redacted.id;

alter view public.public_businesses_safe owner to postgres;
revoke all on public.public_businesses_safe from public, anon, authenticated;
grant select on public.public_businesses_safe to anon, authenticated, service_role;

comment on column public.public_businesses_safe.revenue_2025 is
  'Exact approved annual revenue is exposed only when the Business owner sets revenue_public_visible=true; otherwise NULL.';
comment on column public.public_businesses_safe.ebitda_margin is
  'Approved EBITDA margin remains public. Investor-specific detailed financial access continues through protected RPCs.';
comment on column public.public_businesses_safe.public_snapshot_json is
  'Sanitized public snapshot includes exact annual revenue only after explicit Business owner opt-in.';

insert into public.audit_logs (
  actor_id, action, entity_type, entity_id, detail
) values (
  null,
  'business_public_revenue_visibility_v1',
  'system',
  'public_businesses_safe',
  jsonb_build_object(
    'default_public_visibility', false,
    'owner_controlled', true,
    'admin_approval_required', false,
    'hidden_value_api_behavior', 'revenue_2025_null',
    'investor_grant_workflow_changed', false
  )
);

notify pgrst, 'reload schema';

commit;
