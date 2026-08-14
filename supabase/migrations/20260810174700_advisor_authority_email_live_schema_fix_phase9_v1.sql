-- Deals68 Advisor/Broker — Session 9 live-schema compatibility fix.
-- Production Business display/private company field is company_name_private, not company_name.
-- This replaces only the Session 9 private enqueue function; no ACL, RLS, Business state or permissions change.

create or replace function d68_private.enqueue_advisor_authority_notifications_v1()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_recovered integer := 0;
begin
  update public.advisor_authority_notification_outbox
     set status = case when attempt_count >= 3 then 'exhausted' else 'failed' end,
         processing_started_at = null,
         next_attempt_at = now(),
         last_error = left(coalesce(last_error || ' | ', '') || 'WORKER_LEASE_TIMEOUT', 1000),
         updated_at = now()
   where status = 'processing'
     and processing_started_at < now() - interval '20 minutes';
  get diagnostics v_recovered = row_count;

  with eligible as (
    select
      aa.id as assignment_id,
      aa.authority_id,
      aa.business_id,
      aa.profile_id,
      lower(btrim(coalesce(p.email,''))) as recipient_email,
      case when lower(coalesce(p.language_code,'vi')) = 'en' then 'en' else 'vi' end as language_code,
      bla.verification_status::text as authority_status,
      bla.expires_at as authority_expires_at,
      rr.id as rereview_id,
      case
        when rr.id is not null then 'rereview_pending'
        when bla.verification_status::text = 'verified' and bla.expires_at is not null and bla.expires_at <= now() then 'expired'
        when bla.verification_status::text = 'verified' and bla.expires_at is not null and bla.expires_at <= now() + interval '7 days' then 'expiry_7d'
        when bla.verification_status::text = 'verified' and bla.expires_at is not null and bla.expires_at <= now() + interval '14 days' then 'expiry_14d'
        when bla.verification_status::text = 'verified' and bla.expires_at is not null and bla.expires_at <= now() + interval '30 days' then 'expiry_30d'
        else null
      end as alert_code,
      coalesce(pref.email_enabled, true) as email_enabled,
      coalesce(pref.email_expiry_30d, true) as email_expiry_30d,
      coalesce(pref.email_expiry_14d, true) as email_expiry_14d,
      coalesce(pref.email_expiry_7d, true) as email_expiry_7d,
      coalesce(pref.email_expired, true) as email_expired,
      coalesce(pref.email_rereview_pending, true) as email_rereview_pending,
      b.public_code,
      coalesce(nullif(b.title_vi,''), nullif(b.title_en,''), nullif(b.company_name_private,''), 'Business') as business_name
    from public.advisor_assignments aa
    join public.business_listing_authority bla on bla.id = aa.authority_id and bla.business_id = aa.business_id
    join public.businesses b on b.id = aa.business_id
    join public.profiles p on p.id = aa.profile_id
    join public.advisor_profiles ap on ap.profile_id = aa.profile_id
    left join public.advisor_authority_notification_preferences pref on pref.profile_id = aa.profile_id
    left join lateral (
      select r.id
      from public.advisor_authority_rereviews r
      where r.assignment_id = aa.id and r.status = 'pending'
      order by r.cycle_no desc
      limit 1
    ) rr on true
    where aa.metadata->>'source' = 'advisor_session4_business_intake'
      and aa.permissions = array['profile']::text[]
      and aa.status::text in ('pending','active')
      and p.role::text = 'advisor'
      and p.status::text = 'active'
      and ap.status::text = 'active'
      and ap.verification_status::text = 'verified'
      and b.owner_id is null
      and b.status::text = 'draft'
      and b.visible = false
      and lower(btrim(coalesce(p.email,''))) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ), prepared as (
    select e.*,
      case e.alert_code
        when 'rereview_pending' then 'critical'
        when 'expired' then 'critical'
        when 'expiry_7d' then 'high'
        when 'expiry_14d' then 'medium'
        when 'expiry_30d' then 'notice'
      end as severity,
      case
        when e.alert_code = 'rereview_pending' then e.alert_code || ':' || e.rereview_id::text
        else e.alert_code || ':' || to_char(e.authority_expires_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      end as alert_key,
      case e.alert_code
        when 'rereview_pending' then e.email_rereview_pending
        when 'expired' then e.email_expired
        when 'expiry_7d' then e.email_expiry_7d
        when 'expiry_14d' then e.email_expiry_14d
        when 'expiry_30d' then e.email_expiry_30d
        else false
      end as band_enabled
    from eligible e
    where e.alert_code is not null
  )
  insert into public.advisor_authority_notification_outbox(
    assignment_id, authority_id, business_id, profile_id, channel,
    alert_key, alert_code, severity, recipient_email, language_code,
    authority_expires_at, rereview_id, status, attempt_count, next_attempt_at,
    payload, created_at, updated_at
  )
  select
    x.assignment_id, x.authority_id, x.business_id, x.profile_id, 'email',
    x.alert_key, x.alert_code, x.severity, x.recipient_email, x.language_code,
    x.authority_expires_at, x.rereview_id, 'pending', 0, now(),
    jsonb_strip_nulls(jsonb_build_object(
      'business_public_code', x.public_code,
      'business_name', x.business_name,
      'authority_expires_at', x.authority_expires_at,
      'rereview_id', x.rereview_id,
      'alert_code', x.alert_code,
      'severity', x.severity
    )),
    now(), now()
  from prepared x
  where x.email_enabled = true
    and x.band_enabled = true
  on conflict (assignment_id, alert_key, channel) do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'queued', v_inserted,
    'recovered_leases', v_recovered,
    'channel', 'email',
    'business_mutations_enabled', false,
    'authority_mutations_enabled', false
  );
end;
$$;

revoke all on function d68_private.enqueue_advisor_authority_notifications_v1() from public, anon, authenticated;

comment on function d68_private.enqueue_advisor_authority_notifications_v1() is
  'Session 9 live-schema-compatible governed authority email enqueue. Reads title_vi/title_en/company_name_private and writes only the notification outbox.';
