-- Deals68 Advisor/Broker — Session 9 scheduler invocation hardening.
-- The legacy anon JWT is used only to pass the Edge gateway. A separate random token,
-- stored only in Vault, is required before the Edge worker can claim service-owned jobs.

-- Create a dedicated high-entropy scheduler token once. Do not expose its value.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'advisor_notification_scheduler_token'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'advisor_notification_scheduler_token'
    );
  end if;
end $$;

create or replace function public.d68_notification_scheduler_authorize_v1(
  p_token text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(p_token), '') is not null
    and exists (
      select 1
      from vault.decrypted_secrets s
      where s.name = 'advisor_notification_scheduler_token'
        and s.decrypted_secret = p_token
    ),
    false
  )
$$;

revoke all on function public.d68_notification_scheduler_authorize_v1(text) from public, anon, authenticated;
grant execute on function public.d68_notification_scheduler_authorize_v1(text) to service_role;

comment on function public.d68_notification_scheduler_authorize_v1(text) is
  'Session 9 service-only constant-purpose scheduler-token verification. It grants no notification, authority or Business capability by itself.';

create or replace function d68_private.dispatch_advisor_authority_notifications_v1()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_anon_key text;
  v_scheduler_token text;
  v_enqueue jsonb;
  v_request_id bigint;
begin
  v_enqueue := d68_private.enqueue_advisor_authority_notifications_v1();

  select s.decrypted_secret into v_project_url
  from vault.decrypted_secrets s
  where s.name = 'advisor_notification_project_url'
  limit 1;

  select s.decrypted_secret into v_anon_key
  from vault.decrypted_secrets s
  where s.name = 'advisor_notification_anon_key'
  limit 1;

  select s.decrypted_secret into v_scheduler_token
  from vault.decrypted_secrets s
  where s.name = 'advisor_notification_scheduler_token'
  limit 1;

  if nullif(btrim(coalesce(v_project_url,'')), '') is null
     or nullif(btrim(coalesce(v_anon_key,'')), '') is null
     or nullif(btrim(coalesce(v_scheduler_token,'')), '') is null then
    return jsonb_build_object(
      'queued', coalesce((v_enqueue->>'queued')::integer,0),
      'invoked', false,
      'reason', 'scheduler_vault_secrets_missing',
      'business_mutations_enabled', false,
      'authority_mutations_enabled', false
    );
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/advisor-authority-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key,
      'x-d68-scheduler-token', v_scheduler_token
    ),
    body := jsonb_build_object(
      'source', 'advisor_session9_pg_cron',
      'requested_at', now()
    ),
    timeout_milliseconds := 10000
  ) into v_request_id;

  return jsonb_build_object(
    'queued', coalesce((v_enqueue->>'queued')::integer,0),
    'invoked', true,
    'request_id', v_request_id,
    'business_mutations_enabled', false,
    'authority_mutations_enabled', false
  );
end;
$$;

revoke all on function d68_private.dispatch_advisor_authority_notifications_v1() from public, anon, authenticated;

comment on function d68_private.dispatch_advisor_authority_notifications_v1() is
  'Session 9 hardened cron dispatcher: governed enqueue plus Edge invocation carrying a dedicated Vault scheduler token. No authority or Business mutation.';

-- Scheduler remains disabled until the release process verifies the hardened worker live,
-- then it is operationally rescheduled with the existing 15-minute command.
