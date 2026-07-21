-- Deals68 AI Report Phase 2 reconciliation.
-- Keep ai_report_business_requests as the canonical generation workflow.
-- Use ai_report_rate_events only for Business PDF download claims.
-- Remove the duplicate two-argument preflight overload introduced during concurrent rollout.

drop function if exists public.d68_run_business_report_preflight(uuid, boolean);

revoke all on function public.d68_claim_business_report_action(uuid, public.d68_ai_report_action, uuid)
  from public, anon, authenticated;
grant execute on function public.d68_claim_business_report_action(uuid, public.d68_ai_report_action, uuid)
  to service_role;

create or replace function public.d68_get_business_report_rate_status(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_last_generate timestamptz;
  v_last_download timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  v_business := public.d68_ai_report_assert_business_access(p_business_id);

  select max(r.completed_at)
    into v_last_generate
  from public.ai_report_business_requests r
  where r.business_id = p_business_id
    and r.status = 'completed';

  select max(e.occurred_at)
    into v_last_download
  from public.ai_report_rate_events e
  where e.business_id = p_business_id
    and e.action = 'download';

  return jsonb_build_object(
    'business_id', p_business_id,
    'window_seconds', 3600,
    'generate', jsonb_build_object(
      'allowed', v_last_generate is null or v_last_generate <= v_now - interval '1 hour',
      'last_at', v_last_generate,
      'next_allowed_at', case when v_last_generate is null then v_now else greatest(v_now, v_last_generate + interval '1 hour') end,
      'retry_after_seconds', case
        when v_last_generate is null or v_last_generate <= v_now - interval '1 hour' then 0
        else greatest(1, ceil(extract(epoch from (v_last_generate + interval '1 hour' - v_now)))::integer)
      end,
      'source', 'ai_report_business_requests'
    ),
    'download', jsonb_build_object(
      'allowed', v_last_download is null or v_last_download <= v_now - interval '1 hour',
      'last_at', v_last_download,
      'next_allowed_at', case when v_last_download is null then v_now else greatest(v_now, v_last_download + interval '1 hour') end,
      'retry_after_seconds', case
        when v_last_download is null or v_last_download <= v_now - interval '1 hour' then 0
        else greatest(1, ceil(extract(epoch from (v_last_download + interval '1 hour' - v_now)))::integer)
      end,
      'source', 'ai_report_rate_events'
    )
  );
end;
$$;

create or replace function public.d68_claim_business_report_download(
  p_business_id uuid,
  p_report_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_result jsonb;
begin
  if p_report_id is null then
    raise exception 'report_id_required' using errcode = '22004';
  end if;

  v_business := public.d68_ai_report_assert_business_access(p_business_id);

  if v_business.status::text <> 'active'
     or v_business.visible is not true
     or v_business.public_snapshot_json is null then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'BUSINESS_NOT_ACTIVE',
      'rate_limit_minutes', 60
    );
  end if;

  v_result := public.d68_claim_business_report_action(
    p_business_id,
    'download',
    p_report_id
  );

  return v_result || jsonb_build_object(
    'reason', case when coalesce((v_result ->> 'allowed')::boolean, false)
      then 'DOWNLOAD_CLAIMED' else 'RATE_LIMITED' end,
    'rate_limit_minutes', 60
  );
end;
$$;

revoke all on function public.d68_claim_business_report_download(uuid, uuid)
  from public, anon;
grant execute on function public.d68_claim_business_report_download(uuid, uuid)
  to authenticated, service_role;

comment on function public.d68_claim_business_report_download(uuid, uuid) is
  'Canonical Business PDF download claim. Active Business owners may claim at most one download per rolling 60-minute window; Admin/service operations are exempt but logged.';
comment on function public.d68_get_business_report_rate_status(uuid) is
  'Combined hourly limits: report generation comes from completed ai_report_business_requests; report download comes from ai_report_rate_events.';
comment on table public.ai_report_rate_events is
  'Business report action ledger. In the canonical Phase 2 flow this table enforces PDF download limits; generation remains controlled by ai_report_business_requests.';

notify pgrst, 'reload schema';