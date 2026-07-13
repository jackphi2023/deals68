-- Deals68 Release Candidate — Phase A security and transaction hardening.
-- Additive migration. Keep public reads on safe views and sensitive writes in RPCs.

-- -----------------------------------------------------------------------------
-- 1. Reconcile Business Proposal quota with the actual unique Proposal rows.
-- -----------------------------------------------------------------------------
update public.businesses b
set quota_used = coalesce(p.proposal_count, 0),
    updated_at = now()
from (
  select b0.id as business_id, count(pr.id)::integer as proposal_count
  from public.businesses b0
  left join public.proposals pr on pr.business_id = b0.id
  group by b0.id
) p
where b.id = p.business_id
  and coalesce(b.quota_used, 0) is distinct from coalesce(p.proposal_count, 0);

-- -----------------------------------------------------------------------------
-- 2. Business-owner Proposal submission is atomic and fail-closed.
-- -----------------------------------------------------------------------------
create or replace function public.submit_business_proposal(
  business_uuid uuid,
  investor_uuid uuid,
  proposal_note text default ''::text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  business_row public.businesses%rowtype;
  existing_id uuid;
  new_id uuid;
  used_count integer := 0;
  quota_limit integer := 0;
begin
  if actor_uuid is null then
    raise exception 'Login required' using errcode = '42501';
  end if;

  select *
  into business_row
  from public.businesses
  where id = business_uuid
  for update;

  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  if not (business_row.owner_id = actor_uuid or public.is_admin_user()) then
    raise exception 'Business profile not accessible' using errcode = '42501';
  end if;

  if business_row.visible is not true
     or business_row.status <> 'active'::public.account_status
     or business_row.public_snapshot_json is null then
    raise exception 'Business profile is not public and active' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.investors i
    where i.id = investor_uuid
      and i.visible is true
      and i.status = 'active'::public.account_status
  ) then
    raise exception 'Investor profile is not public and active' using errcode = 'P0002';
  end if;

  select p.id
  into existing_id
  from public.proposals p
  where p.business_id = business_uuid
    and p.investor_id = investor_uuid
  limit 1;

  if existing_id is not null then
    select count(*)::integer
    into used_count
    from public.proposals p
    where p.business_id = business_uuid;

    update public.businesses
    set quota_used = used_count,
        updated_at = now()
    where id = business_uuid
      and coalesce(quota_used, 0) is distinct from used_count;

    return existing_id;
  end if;

  select count(*)::integer
  into used_count
  from public.proposals p
  where p.business_id = business_uuid;

  quota_limit := case
    when coalesce(business_row.quota_total, 0) > 0
      then business_row.quota_total
    when lower(coalesce(business_row.plan, 'standard')) = 'featured'
      then 80
    else 50
  end;

  if used_count >= quota_limit then
    raise exception 'Proposal quota exceeded' using errcode = 'P0001';
  end if;

  insert into public.proposals (
    business_id,
    investor_id,
    message,
    status,
    sent_at,
    updated_at
  )
  values (
    business_uuid,
    investor_uuid,
    left(coalesce(proposal_note, ''), 5000),
    'sent'::public.proposal_status,
    now(),
    now()
  )
  returning id into new_id;

  update public.businesses
  set quota_used = used_count + 1,
      updated_at = now()
  where id = business_uuid;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    detail
  )
  values (
    actor_uuid,
    'submit_business_proposal',
    'proposal',
    new_id::text,
    jsonb_build_object(
      'business_id', business_uuid,
      'investor_id', investor_uuid,
      'quota_used', used_count + 1,
      'quota_total', quota_limit
    )
  );

  return new_id;
exception
  when unique_violation then
    select p.id
    into existing_id
    from public.proposals p
    where p.business_id = business_uuid
      and p.investor_id = investor_uuid
    limit 1;

    if existing_id is not null then
      return existing_id;
    end if;
    raise;
end;
$$;

revoke all on function public.submit_business_proposal(uuid, uuid, text)
from public, anon;
grant execute on function public.submit_business_proposal(uuid, uuid, text)
to authenticated;

drop policy if exists "proposal business insert" on public.proposals;

comment on function public.submit_business_proposal(uuid, uuid, text) is
  'Atomic Business-owner Proposal submission with ownership, active profile, duplicate and quota enforcement.';

-- -----------------------------------------------------------------------------
-- 3. Signup bundle v2 is bound to a one-time nonce in auth user metadata.
-- -----------------------------------------------------------------------------
create or replace function public.create_signup_bundle_v2(
  user_uuid uuid,
  user_email text,
  role_text text,
  signup_nonce text,
  profile_payload jsonb default '{}'::jsonb,
  business_payload jsonb default null::jsonb,
  investor_payload jsonb default null::jsonb,
  payment_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  auth_email text;
  auth_created_at timestamptz;
  stored_nonce text;
  result_value jsonb;
begin
  if length(trim(coalesce(signup_nonce, ''))) < 24 then
    raise exception 'Invalid signup nonce' using errcode = '42501';
  end if;

  select
    lower(coalesce(u.email, '')),
    u.created_at,
    u.raw_user_meta_data->>'signup_nonce'
  into auth_email, auth_created_at, stored_nonce
  from auth.users u
  where u.id = user_uuid
  for update;

  if not found
     or auth_email <> lower(trim(coalesce(user_email, '')))
     or stored_nonce is distinct from signup_nonce
     or auth_created_at < now() - interval '30 minutes' then
    raise exception 'Signup verification failed' using errcode = '42501';
  end if;

  result_value := public.create_signup_bundle(
    user_uuid,
    user_email,
    role_text,
    coalesce(profile_payload, '{}'::jsonb),
    business_payload,
    investor_payload,
    coalesce(payment_payload, '{}'::jsonb)
  );

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'signup_nonce'
  where id = user_uuid;

  return result_value;
end;
$$;

-- Keep signup v1 executable during the beta-to-main cutover so the current
-- production frontend remains compatible. Revoke it only after Netlify has
-- deployed the v2 frontend; see the separate after-main-cutover migration.

revoke all on function public.create_signup_bundle_v2(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) from public;
grant execute on function public.create_signup_bundle_v2(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) to anon, authenticated;

comment on function public.create_signup_bundle_v2(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) is 'Creates the pre-OTP signup bundle only when a recent one-time Auth metadata nonce matches.';

-- -----------------------------------------------------------------------------
-- 4. Audit and quality-score helpers may not trust caller-supplied bypasses.
-- -----------------------------------------------------------------------------
create or replace function public.log_admin_action(
  action text,
  entity_type text,
  entity_id text,
  detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    left(coalesce(action, ''), 120),
    left(coalesce(entity_type, ''), 120),
    left(coalesce(entity_id, ''), 240),
    coalesce(detail, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_admin_action(text, text, text, jsonb)
from public, anon;
grant execute on function public.log_admin_action(text, text, text, jsonb)
to authenticated;

create or replace function public.recalculate_business_quality_score(
  business_uuid uuid,
  skip_auth boolean default false
)
returns public.businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b public.businesses%rowtype;
  payload jsonb;
  total_score integer;
  auto_score integer;
begin
  select * into b
  from public.businesses
  where id = business_uuid;

  if b.id is null then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;

  -- skip_auth is retained only for signature compatibility. It is intentionally ignored.
  if auth.uid() is null
     or not (public.is_admin_user() or b.owner_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  payload := public.calculate_business_quality_score_payload(business_uuid);
  total_score := least(100, greatest(0, coalesce((payload->>'total')::integer, 0)));
  auto_score := least(100, greatest(0, coalesce((payload->>'auto_total')::integer, total_score)));

  update public.businesses
  set quality_score_auto = auto_score,
      quality_score = total_score,
      quality_breakdown_json = payload,
      quality_calculated_at = now(),
      updated_at = now()
  where id = business_uuid
  returning * into b;

  return b;
end;
$$;

revoke all on function public.recalculate_business_quality_score(uuid, boolean)
from public, anon;
grant execute on function public.recalculate_business_quality_score(uuid, boolean)
to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Explicit RPC grants. Body-level authorization remains mandatory.
-- -----------------------------------------------------------------------------
revoke all on function public.approve_business_pending(uuid)
from public, anon;
revoke all on function public.approve_business_pending_changes(uuid, jsonb, timestamptz)
from public, anon;
revoke all on function public.approve_business_public_snapshot(uuid, jsonb)
from public, anon;
revoke all on function public.approve_business_assets(uuid, jsonb, jsonb, uuid)
from public, anon;
revoke all on function public.admin_set_payment_order_status(uuid, text)
from public, anon;
revoke all on function public.save_valuation_config(jsonb)
from public, anon;
revoke all on function public.get_investor_contact_if_connected(uuid)
from public, anon;

-- Authenticated users may call these RPC endpoints; each function validates role/ownership.
grant execute on function public.approve_business_pending(uuid) to authenticated;
grant execute on function public.approve_business_pending_changes(uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.approve_business_public_snapshot(uuid, jsonb) to authenticated;
grant execute on function public.approve_business_assets(uuid, jsonb, jsonb, uuid) to authenticated;
grant execute on function public.admin_set_payment_order_status(uuid, text) to authenticated;
grant execute on function public.save_valuation_config(jsonb) to authenticated;
grant execute on function public.get_investor_contact_if_connected(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Public buckets do not require broad storage.objects listing policies.
-- Public object URLs continue to work because the buckets themselves are public.
-- -----------------------------------------------------------------------------
drop policy if exists "public read business images" on storage.objects;
drop policy if exists "site banners storage public read" on storage.objects;
