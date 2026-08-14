-- Deals68 Advisor/Broker — Session 9 hardened worker v2 routing.
-- The original Edge Function slug retained stale import-map metadata in the hosted runtime.
-- Route the private dispatcher to the clean v2 worker. Scheduler authorization, queue,
-- dedupe, rate limits and all Business/authority boundaries remain unchanged.

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
      'worker_slug', 'advisor-authority-notification-email-v2',
      'business_mutations_enabled', false,
      'authority_mutations_enabled', false
    );
  end if;

  select net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/advisor-authority-notification-email-v2',
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
    'worker_slug', 'advisor-authority-notification-email-v2',
    'business_mutations_enabled', false,
    'authority_mutations_enabled', false
  );
end;
$$;

revoke all on function d68_private.dispatch_advisor_authority_notifications_v1() from public, anon, authenticated;

comment on function d68_private.dispatch_advisor_authority_notifications_v1() is
  'Session 9 hardened cron dispatcher routed to advisor-authority-notification-email-v2 with dedicated Vault scheduler token. No authority or Business mutation.';
