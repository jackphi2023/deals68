-- Deals68 Market Partner / Affiliate v1 — Phase 3 referral capture and signup attribution.
-- Additive only. No affiliate discount, payment mutation or automatic commission creation.

create or replace function public.d68_attach_affiliate_attribution_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_metadata jsonb := '{}'::jsonb;
  v_auth_created_at timestamptz;
  v_code text;
  v_partner public.market_partners%rowtype;
  v_requested_click_id uuid;
  v_click_id uuid;
  v_attribution_id uuid;
begin
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return new;
  end if;

  if new.role::text not in ('business', 'investor') then
    return new;
  end if;

  select coalesce(u.raw_user_meta_data, '{}'::jsonb), u.created_at
  into v_metadata, v_auth_created_at
  from auth.users u
  where u.id = new.id;

  if v_auth_created_at is null or v_auth_created_at < now() - interval '24 hours' then
    return new;
  end if;

  v_code := public.d68_normalize_affiliate_code(v_metadata->>'affiliate_code');
  if v_code is null then
    return new;
  end if;

  select * into v_partner
  from public.market_partners mp
  where mp.affiliate_code = v_code
    and mp.status = 'active'
  limit 1;

  if v_partner.id is null then
    return new;
  end if;

  begin
    v_requested_click_id := nullif(btrim(coalesce(v_metadata->>'affiliate_click_id', '')), '')::uuid;
  exception when invalid_text_representation then
    v_requested_click_id := null;
  end;

  if v_requested_click_id is not null then
    select c.id into v_click_id
    from public.affiliate_clicks c
    where c.id = v_requested_click_id
      and c.partner_id = v_partner.id
      and c.affiliate_code = v_partner.affiliate_code
      and c.clicked_at >= now() - interval '30 days'
    limit 1;
  end if;

  insert into public.affiliate_attributions (
    partner_id,
    click_id,
    affiliate_code,
    subject_profile_id,
    subject_role,
    status,
    attributed_at,
    metadata,
    created_at,
    updated_at
  ) values (
    v_partner.id,
    v_click_id,
    v_partner.affiliate_code,
    new.id,
    new.role::text,
    'registered',
    now(),
    jsonb_build_object(
      'source', 'signup',
      'attribution_model', 'last_valid_referral_30d',
      'click_validated', v_click_id is not null
    ),
    now(),
    now()
  )
  on conflict (subject_profile_id) do nothing
  returning id into v_attribution_id;

  if v_attribution_id is not null then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, detail)
    values (
      new.id,
      'attach_affiliate_signup',
      'affiliate_attribution',
      v_attribution_id::text,
      jsonb_build_object(
        'partner_id', v_partner.id,
        'affiliate_code', v_partner.affiliate_code,
        'click_id', v_click_id,
        'subject_role', new.role::text,
        'attribution_model', 'last_valid_referral_30d'
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.d68_attach_affiliate_attribution_from_profile()
  from public, anon, authenticated;
grant execute on function public.d68_attach_affiliate_attribution_from_profile()
  to service_role;

drop trigger if exists d68_profiles_attach_affiliate_attribution on public.profiles;
create trigger d68_profiles_attach_affiliate_attribution
after insert or update of role on public.profiles
for each row execute function public.d68_attach_affiliate_attribution_from_profile();

comment on function public.d68_attach_affiliate_attribution_from_profile() is
  'Phase 3 server-side signup attribution. Reads validated referral metadata from the new Auth user, accepts only active partners and an optional matching click from the last 30 days, and never creates commission or changes payment.';
