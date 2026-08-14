-- Deals68 Advisor/Broker — Session 9 scheduled authority email dispatch.
-- Requires Vault secrets created outside source control:
--   advisor_notification_project_url = https://<project-ref>.supabase.co
--   advisor_notification_anon_key    = active legacy anon JWT (public client key)
-- Provider keys remain Edge Function project secrets (RESEND_API_KEY/BREVO_API_KEY).

create extension if not exists pg_net;
create extension if not exists pg_cron;

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

  if nullif(btrim(coalesce(v_project_url,'')), '') is null
     or nullif(btrim(coalesce(v_anon_key,'')), '') is null then
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
      'apikey', v_anon_key
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
  'Session 9 cron dispatcher: enqueue governed authority alerts then invoke the dedicated email worker. No authority or Business state mutation.';

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'advisor-authority-notifications-session9'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'advisor-authority-notifications-session9',
    '*/15 * * * *',
    $cron$select d68_private.dispatch_advisor_authority_notifications_v1();$cron$
  );
end $$;

-- Explicit Session 9 scheduler boundary:
-- * cadence: every 15 minutes;
-- * pg_cron/pg_net only trigger the service-owned delivery worker;
-- * Vault is used for the project URL and public legacy anon JWT; provider secrets stay in Edge Function secrets;
-- * the Edge worker can only claim server-derived outbox jobs and cannot choose arbitrary recipients/content;
-- * no Business, authority, ownership, publication, Storage, payment, financial,
--   dataroom, proposal, request or report permission is added.
