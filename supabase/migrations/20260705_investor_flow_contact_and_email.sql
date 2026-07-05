-- Deals68 Spec v1.3 — Investor signup/profile/contact guardrails
-- Purpose: keep Investor create -> OTP login dashboard -> Admin approve public -> Investor edit pending -> Admin approve logic.
-- This migration exposes only safe booleans/contact via SECURITY DEFINER checks; it does not make private investor data public.

create or replace function public.investor_public_email_exists(email_text text)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.investors i
    where i.visible = true
      and i.status = 'active'::public.account_status
      and lower(coalesce(i.private_email, i.privacy->>'email', '')) = lower(trim(email_text))
  );
$function$;

grant execute on function public.investor_public_email_exists(text) to anon, authenticated;

create or replace function public.get_investor_contact_if_connected(investor_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  row_i public.investors;
  can_view boolean := false;
  p jsonb := '{}'::jsonb;
  share_email boolean := false;
  share_phone boolean := false;
  share_website boolean := false;
begin
  select * into row_i from public.investors where id = investor_uuid;
  if row_i.id is null then
    return jsonb_build_object('connected', false);
  end if;

  p := coalesce(row_i.privacy, '{}'::jsonb);
  share_email := lower(coalesce(p->>'shareEmail','false')) in ('true','1','yes','on');
  share_phone := lower(coalesce(p->>'sharePhone','false')) in ('true','1','yes','on');
  share_website := lower(coalesce(p->>'shareWebsite','false')) in ('true','1','yes','on');

  if actor is null then
    return jsonb_build_object('connected', false);
  end if;

  can_view := public.is_admin_user() or row_i.owner_id = actor or exists (
    select 1
    from public.proposals pr
    join public.businesses b on b.id = pr.business_id
    where pr.investor_id = investor_uuid
      and b.owner_id = actor
      and pr.status::text in ('approved','connected')
  );

  if not can_view then
    return jsonb_build_object('connected', false);
  end if;

  return jsonb_build_object(
    'connected', true,
    'name', coalesce(nullif(row_i.private_name,''), nullif(row_i.title_vi,''), nullif(row_i.title_en,''), row_i.code),
    'email', case when share_email or public.is_admin_user() or row_i.owner_id = actor then coalesce(nullif(row_i.private_email,''), p->>'email') else null end,
    'phone', case when share_phone or public.is_admin_user() or row_i.owner_id = actor then coalesce(nullif(row_i.private_phone,''), p->>'phone') else null end,
    'website', case when share_website or public.is_admin_user() or row_i.owner_id = actor then coalesce(nullif(row_i.private_website,''), p->>'website') else null end
  );
end;
$function$;

grant execute on function public.get_investor_contact_if_connected(uuid) to authenticated;
