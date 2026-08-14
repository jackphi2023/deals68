-- Deals68 Advisor/Broker — Session 9 authority email notifications core.
-- Scope: Advisor notification preferences, immutable delivery outbox, service-only worker RPCs,
-- and Session 8 read/Admin wrappers enriched with delivery state.
-- Boundary: notification state never grants authority, Business ownership, Business mutation,
-- publication, Storage, payment, financial, dataroom, proposal, request or report access.

create table if not exists public.advisor_authority_notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  email_expiry_30d boolean not null default true,
  email_expiry_14d boolean not null default true,
  email_expiry_7d boolean not null default true,
  email_expired boolean not null default true,
  email_rereview_pending boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.advisor_authority_notification_preferences enable row level security;
revoke all on table public.advisor_authority_notification_preferences from public, anon, authenticated;

comment on table public.advisor_authority_notification_preferences is
  'Session 9 Advisor-controlled operational email preferences. These flags affect delivery only and never authority validity or Business permissions.';

create table if not exists public.advisor_authority_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.advisor_assignments(id) on delete cascade,
  authority_id uuid not null references public.business_listing_authority(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'email',
  alert_key text not null,
  alert_code text not null,
  severity text not null,
  recipient_email text not null,
  language_code text not null default 'vi',
  authority_expires_at timestamptz,
  rereview_id uuid references public.advisor_authority_rereviews(id) on delete set null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider text,
  provider_message_id text,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisor_authority_notification_outbox_channel_check check (channel = 'email'),
  constraint advisor_authority_notification_outbox_alert_key_check check (char_length(alert_key) between 3 and 240),
  constraint advisor_authority_notification_outbox_alert_code_check check (alert_code in ('rereview_pending','expired','expiry_7d','expiry_14d','expiry_30d')),
  constraint advisor_authority_notification_outbox_severity_check check (severity in ('critical','high','medium','notice')),
  constraint advisor_authority_notification_outbox_status_check check (status in ('pending','processing','sent','failed','exhausted')),
  constraint advisor_authority_notification_outbox_attempt_check check (attempt_count between 0 and 3),
  constraint advisor_authority_notification_outbox_recipient_check check (char_length(recipient_email) between 3 and 320),
  constraint advisor_authority_notification_outbox_language_check check (language_code in ('vi','en')),
  constraint advisor_authority_notification_outbox_unique unique (assignment_id, alert_key, channel)
);

create index if not exists advisor_authority_notification_outbox_due_idx
  on public.advisor_authority_notification_outbox(status, next_attempt_at, created_at)
  where status in ('pending','failed');
create index if not exists advisor_authority_notification_outbox_profile_idx
  on public.advisor_authority_notification_outbox(profile_id, sent_at desc);
create index if not exists advisor_authority_notification_outbox_authority_idx
  on public.advisor_authority_notification_outbox(authority_id, created_at desc);
create index if not exists advisor_authority_notification_outbox_business_idx
  on public.advisor_authority_notification_outbox(business_id, created_at desc);
create index if not exists advisor_authority_notification_outbox_rereview_idx
  on public.advisor_authority_notification_outbox(rereview_id, created_at desc)
  where rereview_id is not null;

alter table public.advisor_authority_notification_outbox enable row level security;
revoke all on table public.advisor_authority_notification_outbox from public, anon, authenticated;

comment on table public.advisor_authority_notification_outbox is
  'Session 9 server-owned authority notification delivery ledger. Rows are derived from governed authority state; clients cannot insert/update/delete them directly.';

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
  -- Recover a worker lease only after a bounded timeout. A recovered job keeps
  -- its attempt_count and will be retried by the normal worker rules.
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
      coalesce(nullif(b.company_name,''), nullif(b.title_vi,''), nullif(b.title_en,''), 'Business') as business_name
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

create or replace function public.d68_notification_worker_claim_v1(
  p_limit integer default 10
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,10), 20));
  v_jobs jsonb;
begin
  -- This function is intentionally service_role-only via ACL below.
  perform d68_private.enqueue_advisor_authority_notifications_v1();

  with candidates as (
    select o.id
    from public.advisor_authority_notification_outbox o
    where o.status in ('pending','failed')
      and o.attempt_count < 3
      and o.next_attempt_at <= now()
      and (
        select count(*)
        from public.advisor_authority_notification_outbox sent
        where sent.profile_id = o.profile_id
          and sent.status = 'sent'
          and sent.sent_at >= now() - interval '24 hours'
      ) < 6
    order by
      case o.severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
      o.created_at
    for update skip locked
    limit v_limit
  ), claimed as (
    update public.advisor_authority_notification_outbox o
       set status = 'processing',
           attempt_count = o.attempt_count + 1,
           processing_started_at = now(),
           last_attempt_at = now(),
           updated_at = now()
      from candidates c
     where o.id = c.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'job_id', c.id,
    'assignment_id', c.assignment_id,
    'alert_key', c.alert_key,
    'alert_code', c.alert_code,
    'severity', c.severity,
    'recipient_email', c.recipient_email,
    'language_code', c.language_code,
    'attempt_count', c.attempt_count,
    'authority_expires_at', c.authority_expires_at,
    'payload', c.payload
  ) order by c.created_at), '[]'::jsonb)
  into v_jobs
  from claimed c;

  return jsonb_build_object(
    'jobs', v_jobs,
    'max_jobs', v_limit,
    'max_sent_per_profile_24h', 6,
    'business_mutations_enabled', false,
    'authority_mutations_enabled', false
  );
end;
$$;

create or replace function public.d68_notification_worker_complete_v1(
  p_job_id uuid,
  p_success boolean,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_job public.advisor_authority_notification_outbox%rowtype;
  v_next_status text;
  v_next_at timestamptz;
begin
  select * into v_job
  from public.advisor_authority_notification_outbox
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Notification job not found';
  end if;
  if v_job.status <> 'processing' then
    raise exception 'Notification job is not processing';
  end if;

  if p_success then
    update public.advisor_authority_notification_outbox
       set status = 'sent',
           processing_started_at = null,
           sent_at = now(),
           provider = nullif(left(btrim(coalesce(p_provider,'')),80),''),
           provider_message_id = nullif(left(btrim(coalesce(p_provider_message_id,'')),240),''),
           last_error = null,
           updated_at = now()
     where id = p_job_id;
    v_next_status := 'sent';
    v_next_at := null;
  else
    if v_job.attempt_count >= 3 then
      v_next_status := 'exhausted';
      v_next_at := now();
    else
      v_next_status := 'failed';
      v_next_at := now() + case when v_job.attempt_count = 1 then interval '15 minutes' else interval '1 hour' end;
    end if;
    update public.advisor_authority_notification_outbox
       set status = v_next_status,
           processing_started_at = null,
           next_attempt_at = v_next_at,
           last_error = left(coalesce(p_error,'EMAIL_DELIVERY_FAILED'),1000),
           provider = nullif(left(btrim(coalesce(p_provider,'')),80),''),
           updated_at = now()
     where id = p_job_id;
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'status', v_next_status,
    'next_attempt_at', v_next_at,
    'business_mutations_enabled', false,
    'authority_mutations_enabled', false
  );
end;
$$;

create or replace function public.d68_advisor_update_authority_notification_preferences_v1(
  p_email_enabled boolean,
  p_email_expiry_30d boolean,
  p_email_expiry_14d boolean,
  p_email_expiry_7d boolean,
  p_email_expired boolean,
  p_email_rereview_pending boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_pref public.advisor_authority_notification_preferences%rowtype;
begin
  if v_actor is null then
    raise exception 'Authenticated Advisor access required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.profiles p
    join public.advisor_profiles ap on ap.profile_id = p.id
    where p.id = v_actor
      and p.role::text = 'advisor'
      and p.status::text = 'active'
      and ap.status::text = 'active'
      and ap.verification_status::text = 'verified'
  ) then
    raise exception 'Active verified Advisor access required' using errcode = '42501';
  end if;

  insert into public.advisor_authority_notification_preferences(
    profile_id, email_enabled, email_expiry_30d, email_expiry_14d,
    email_expiry_7d, email_expired, email_rereview_pending, updated_at
  ) values (
    v_actor,
    coalesce(p_email_enabled,true),
    coalesce(p_email_expiry_30d,true),
    coalesce(p_email_expiry_14d,true),
    coalesce(p_email_expiry_7d,true),
    coalesce(p_email_expired,true),
    coalesce(p_email_rereview_pending,true),
    now()
  )
  on conflict (profile_id) do update set
    email_enabled = excluded.email_enabled,
    email_expiry_30d = excluded.email_expiry_30d,
    email_expiry_14d = excluded.email_expiry_14d,
    email_expiry_7d = excluded.email_expiry_7d,
    email_expired = excluded.email_expired,
    email_rereview_pending = excluded.email_rereview_pending,
    updated_at = now()
  returning * into v_pref;

  return jsonb_build_object(
    'profile_id', v_actor,
    'email_enabled', v_pref.email_enabled,
    'email_expiry_30d', v_pref.email_expiry_30d,
    'email_expiry_14d', v_pref.email_expiry_14d,
    'email_expiry_7d', v_pref.email_expiry_7d,
    'email_expired', v_pref.email_expired,
    'email_rereview_pending', v_pref.email_rereview_pending,
    'updated_at', v_pref.updated_at,
    'business_mutations_enabled', false,
    'authority_mutations_enabled', false
  );
end;
$$;

create or replace function public.d68_get_my_authority_review_v4(
  p_assignment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_base jsonb;
  v_alert_key text;
  v_pref jsonb;
  v_delivery jsonb;
begin
  -- Session 8 v3 remains the identity/assignment/authority source of truth.
  v_base := public.d68_get_my_authority_review_v3(p_assignment_id);
  v_alert_key := nullif(v_base->'expiry_alert'->>'key','');

  select jsonb_build_object(
    'email_enabled', p.email_enabled,
    'email_expiry_30d', p.email_expiry_30d,
    'email_expiry_14d', p.email_expiry_14d,
    'email_expiry_7d', p.email_expiry_7d,
    'email_expired', p.email_expired,
    'email_rereview_pending', p.email_rereview_pending,
    'updated_at', p.updated_at
  ) into v_pref
  from public.advisor_authority_notification_preferences p
  where p.profile_id = v_actor;

  if v_pref is null then
    v_pref := jsonb_build_object(
      'email_enabled', true,
      'email_expiry_30d', true,
      'email_expiry_14d', true,
      'email_expiry_7d', true,
      'email_expired', true,
      'email_rereview_pending', true,
      'updated_at', null
    );
  end if;

  if v_alert_key is not null then
    select jsonb_strip_nulls(jsonb_build_object(
      'job_id', o.id,
      'channel', o.channel,
      'status', o.status,
      'attempt_count', o.attempt_count,
      'last_attempt_at', o.last_attempt_at,
      'next_attempt_at', o.next_attempt_at,
      'sent_at', o.sent_at,
      'provider', o.provider,
      'provider_message_id', o.provider_message_id
    )) into v_delivery
    from public.advisor_authority_notification_outbox o
    where o.assignment_id = p_assignment_id
      and o.profile_id = v_actor
      and o.alert_key = v_alert_key
      and o.channel = 'email'
    limit 1;
  end if;

  return v_base || jsonb_build_object(
    'notification_preferences', v_pref,
    'current_notification_delivery', v_delivery,
    'access', coalesce(v_base->'access','{}'::jsonb) || jsonb_build_object(
      'external_notification_delivery_enabled', true,
      'email_notification_delivery_enabled', true,
      'sms_notification_delivery_enabled', false,
      'push_notification_delivery_enabled', false,
      'notification_preferences_enabled', true,
      'notification_dedupe_enabled', true,
      'max_authority_emails_per_profile_24h', 6,
      'business_mutations_enabled', false
    )
  );
end;
$$;

create or replace function public.d68_admin_list_advisor_business_intakes_v5()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_items jsonb;
  v_pending integer := 0;
  v_failed integer := 0;
  v_exhausted integer := 0;
  v_sent integer := 0;
begin
  -- Session 8 v4 remains the Admin authorization and Business allowlist source.
  v_base := public.d68_admin_list_advisor_business_intakes_v4();

  with rows as (
    select q.item, q.ord, q.item->>'assignment_id' as assignment_id
    from jsonb_array_elements(coalesce(v_base->'items','[]'::jsonb)) with ordinality q(item,ord)
  ), enriched as (
    select r.*,
      coalesce((select p.email_enabled from public.advisor_authority_notification_preferences p where p.profile_id = (r.item->>'advisor_profile_id')::uuid), true) as email_enabled,
      (select jsonb_strip_nulls(jsonb_build_object(
        'job_id', o.id,
        'alert_code', o.alert_code,
        'severity', o.severity,
        'status', o.status,
        'attempt_count', o.attempt_count,
        'next_attempt_at', o.next_attempt_at,
        'last_attempt_at', o.last_attempt_at,
        'sent_at', o.sent_at,
        'provider', o.provider
      ))
       from public.advisor_authority_notification_outbox o
       where o.assignment_id = r.assignment_id::uuid
       order by o.created_at desc
       limit 1) as latest_delivery
    from rows r
  )
  select coalesce(jsonb_agg(
    e.item || jsonb_build_object(
      'notification', jsonb_build_object(
        'email_enabled', e.email_enabled,
        'latest_delivery', e.latest_delivery
      )
    ) order by e.ord
  ), '[]'::jsonb)
  into v_items
  from enriched e;

  select
    count(*) filter (where o.status = 'pending'),
    count(*) filter (where o.status = 'failed'),
    count(*) filter (where o.status = 'exhausted'),
    count(*) filter (where o.status = 'sent')
  into v_pending, v_failed, v_exhausted, v_sent
  from public.advisor_authority_notification_outbox o;

  return jsonb_build_object(
    'items', v_items,
    'attention_summary', coalesce(v_base->'attention_summary','{}'::jsonb),
    'notification_summary', jsonb_build_object(
      'pending', v_pending,
      'failed', v_failed,
      'exhausted', v_exhausted,
      'sent', v_sent
    ),
    'access', coalesce(v_base->'access','{}'::jsonb) || jsonb_build_object(
      'external_notification_delivery_enabled', true,
      'email_notification_delivery_enabled', true,
      'notification_delivery_monitoring_enabled', true,
      'business_mutations_enabled', false,
      'publication_enabled', false
    )
  );
end;
$$;

revoke all on function d68_private.enqueue_advisor_authority_notifications_v1() from public, anon, authenticated;
revoke all on function public.d68_notification_worker_claim_v1(integer) from public, anon, authenticated;
revoke all on function public.d68_notification_worker_complete_v1(uuid,boolean,text,text,text) from public, anon, authenticated;
revoke all on function public.d68_advisor_update_authority_notification_preferences_v1(boolean,boolean,boolean,boolean,boolean,boolean) from public, anon, authenticated;
revoke all on function public.d68_get_my_authority_review_v4(uuid) from public, anon, authenticated;
revoke all on function public.d68_admin_list_advisor_business_intakes_v5() from public, anon, authenticated;

grant execute on function public.d68_notification_worker_claim_v1(integer) to service_role;
grant execute on function public.d68_notification_worker_complete_v1(uuid,boolean,text,text,text) to service_role;
grant execute on function public.d68_advisor_update_authority_notification_preferences_v1(boolean,boolean,boolean,boolean,boolean,boolean) to authenticated, service_role;
grant execute on function public.d68_get_my_authority_review_v4(uuid) to authenticated, service_role;
grant execute on function public.d68_admin_list_advisor_business_intakes_v5() to authenticated, service_role;

comment on function public.d68_notification_worker_claim_v1(integer) is
  'Session 9 service-only worker claim. It may enqueue/lease notification jobs but cannot mutate authority or Business state.';
comment on function public.d68_notification_worker_complete_v1(uuid,boolean,text,text,text) is
  'Session 9 service-only delivery completion/retry transition. It writes only the notification outbox.';
comment on function public.d68_advisor_update_authority_notification_preferences_v1(boolean,boolean,boolean,boolean,boolean,boolean) is
  'Session 9 active verified Advisor preference update. Preferences affect operational email delivery only.';
comment on function public.d68_get_my_authority_review_v4(uuid) is
  'Session 9 wraps Session 8 Advisor authority review with email preferences and current delivery state.';
comment on function public.d68_admin_list_advisor_business_intakes_v5() is
  'Session 9 wraps Session 8 Admin authority queue with email delivery monitoring; no Business writes.';

-- Explicit Session 9 boundary:
-- * direct preference/outbox table access remains closed to anon/authenticated;
-- * email is operational messaging only and is derived from the existing server authority lifecycle;
-- * outbox uniqueness provides one delivery job per assignment + exact alert lifecycle key + email channel;
-- * worker rate limit is at most 6 sent authority emails/profile/24h and max 3 attempts/job;
-- * no Business, ownership, publication, Storage, payment, financial, dataroom,
--   proposal, request or report permission is added.
