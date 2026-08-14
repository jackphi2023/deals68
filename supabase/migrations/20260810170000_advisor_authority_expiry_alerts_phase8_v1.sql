-- Deals68 Advisor/Broker — Session 8 authority expiry alerts & Admin re-review queue.
-- Boundary: in-app/read-time alerting only. No email/SMS scheduler, Business mutation,
-- ownership/publication change, Storage policy change, payment scope or broader Advisor permission.

create table if not exists public.advisor_authority_alert_receipts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.advisor_assignments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  alert_key text not null,
  alert_code text not null,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisor_authority_alert_receipts_alert_key_check check (char_length(alert_key) between 3 and 240),
  constraint advisor_authority_alert_receipts_alert_code_check check (alert_code in ('rereview_pending','expired','expiry_7d','expiry_14d','expiry_30d')),
  constraint advisor_authority_alert_receipts_unique unique (assignment_id, profile_id, alert_key)
);

create index if not exists advisor_authority_alert_receipts_profile_idx
  on public.advisor_authority_alert_receipts(profile_id, acknowledged_at desc);

alter table public.advisor_authority_alert_receipts enable row level security;
revoke all on table public.advisor_authority_alert_receipts from public, anon, authenticated;

comment on table public.advisor_authority_alert_receipts is
  'Session 8 immutable-scope receipt ledger for Advisor acknowledgement of the current read-time authority expiry/re-review alert. No notification delivery or Business permission is granted.';

create or replace function public.d68_get_my_authority_review_v3(
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
  v_authority_status text;
  v_rereview_status text;
  v_rereview_id text;
  v_expires_at timestamptz;
  v_code text;
  v_severity text;
  v_key text;
  v_days_remaining integer;
  v_acknowledged_at timestamptz;
  v_alert jsonb;
begin
  -- Session 7 v2 remains the authorization source of truth and verifies that
  -- the caller is the active/verified Advisor who owns this assignment.
  v_base := public.d68_get_my_authority_review_v2(p_assignment_id);

  v_authority_status := coalesce(v_base->>'authority_status','');
  v_rereview_status := coalesce(v_base->'current_rereview'->>'status','');
  v_rereview_id := nullif(v_base->'current_rereview'->>'rereview_id','');
  v_expires_at := nullif(v_base->>'authority_expires_at','')::timestamptz;

  if v_rereview_status = 'pending' then
    v_code := 'rereview_pending';
    v_severity := 'critical';
  elsif v_authority_status = 'verified' and v_expires_at is not null and v_expires_at <= now() then
    v_code := 'expired';
    v_severity := 'critical';
  elsif v_authority_status = 'verified' and v_expires_at is not null and v_expires_at <= now() + interval '7 days' then
    v_code := 'expiry_7d';
    v_severity := 'high';
  elsif v_authority_status = 'verified' and v_expires_at is not null and v_expires_at <= now() + interval '14 days' then
    v_code := 'expiry_14d';
    v_severity := 'medium';
  elsif v_authority_status = 'verified' and v_expires_at is not null and v_expires_at <= now() + interval '30 days' then
    v_code := 'expiry_30d';
    v_severity := 'notice';
  end if;

  if v_expires_at is not null then
    v_days_remaining := floor(extract(epoch from (v_expires_at - now())) / 86400)::integer;
  end if;

  if v_code is not null then
    v_key := v_code || ':' || coalesce(
      v_rereview_id,
      to_char(v_expires_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    select r.acknowledged_at
      into v_acknowledged_at
    from public.advisor_authority_alert_receipts r
    where r.assignment_id = p_assignment_id
      and r.profile_id = v_actor
      and r.alert_key = v_key
    limit 1;

    v_alert := jsonb_strip_nulls(jsonb_build_object(
      'key', v_key,
      'code', v_code,
      'severity', v_severity,
      'authority_expires_at', v_expires_at,
      'days_remaining', v_days_remaining,
      'acknowledged', v_acknowledged_at is not null,
      'acknowledged_at', v_acknowledged_at,
      'title_vi', case v_code
        when 'rereview_pending' then 'Authority đang được tái thẩm định'
        when 'expired' then 'Authority đã hết hạn'
        when 'expiry_7d' then 'Authority hết hạn trong 7 ngày'
        when 'expiry_14d' then 'Authority hết hạn trong 14 ngày'
        else 'Authority hết hạn trong 30 ngày'
      end,
      'title_en', case v_code
        when 'rereview_pending' then 'Authority re-review is pending'
        when 'expired' then 'Authority has expired'
        when 'expiry_7d' then 'Authority expires within 7 days'
        when 'expiry_14d' then 'Authority expires within 14 days'
        else 'Authority expires within 30 days'
      end,
      'message_vi', case v_code
        when 'rereview_pending' then 'Business context đang đóng cho đến khi Admin hoàn tất tái thẩm định. Hãy bổ sung bằng chứng nếu được yêu cầu.'
        when 'expired' then 'Business context đã đóng do authority hết hạn. Admin cần mở tái thẩm định để xác minh mandate mới.'
        else 'Chuẩn bị bằng chứng authority cập nhật. Admin có thể mở tái thẩm định trước ngày hết hạn.'
      end,
      'message_en', case v_code
        when 'rereview_pending' then 'Business context is closed until Admin completes re-review. Provide updated evidence when requested.'
        when 'expired' then 'Business context is closed because authority expired. Admin must start re-review to verify a renewed mandate.'
        else 'Prepare updated authority evidence. Admin may start re-review before the expiry date.'
      end
    ));
  end if;

  return v_base || jsonb_build_object(
    'expiry_alert', v_alert,
    'access', coalesce(v_base->'access','{}'::jsonb) || jsonb_build_object(
      'expiry_alerts_enabled', true,
      'alert_acknowledgement_enabled', true,
      'external_notification_delivery_enabled', false,
      'business_mutations_enabled', false
    )
  );
end;
$$;

create or replace function public.d68_advisor_ack_authority_expiry_alert_v1(
  p_assignment_id uuid,
  p_alert_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_review jsonb;
  v_alert jsonb;
  v_expected_key text;
  v_code text;
  v_ack timestamptz;
begin
  if v_actor is null then
    raise exception 'Authenticated Advisor access required' using errcode = '42501';
  end if;

  v_review := public.d68_get_my_authority_review_v3(p_assignment_id);
  v_alert := v_review->'expiry_alert';
  if v_alert is null or jsonb_typeof(v_alert) = 'null' then
    raise exception 'No current authority expiry alert to acknowledge';
  end if;

  v_expected_key := v_alert->>'key';
  v_code := v_alert->>'code';
  if p_alert_key is null or p_alert_key <> v_expected_key then
    raise exception 'Authority alert is stale or does not belong to this assignment' using errcode = '42501';
  end if;

  insert into public.advisor_authority_alert_receipts(
    assignment_id, profile_id, alert_key, alert_code, acknowledged_at, updated_at
  ) values (
    p_assignment_id, v_actor, v_expected_key, v_code, now(), now()
  )
  on conflict (assignment_id, profile_id, alert_key)
  do update set
    acknowledged_at = excluded.acknowledged_at,
    alert_code = excluded.alert_code,
    updated_at = now()
  returning acknowledged_at into v_ack;

  return jsonb_build_object(
    'assignment_id', p_assignment_id,
    'alert_key', v_expected_key,
    'alert_code', v_code,
    'acknowledged', true,
    'acknowledged_at', v_ack,
    'business_mutations_enabled', false,
    'external_notification_delivery_enabled', false
  );
end;
$$;

create or replace function public.d68_admin_list_advisor_business_intakes_v4()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_items jsonb;
  v_attention_total integer := 0;
  v_critical integer := 0;
  v_high integer := 0;
  v_medium integer := 0;
  v_notice integer := 0;
begin
  -- Session 7 v3 remains the Admin authorization and Business allowlist source.
  v_base := public.d68_admin_list_advisor_business_intakes_v3();

  with raw as (
    select
      q.item,
      q.ord,
      coalesce(q.item->'current_rereview'->>'status','') as rereview_status,
      coalesce(q.item->'authority'->>'verification_status','') as authority_status,
      nullif(q.item->'authority'->>'expires_at','')::timestamptz as expires_at
    from jsonb_array_elements(coalesce(v_base->'items','[]'::jsonb)) with ordinality as q(item, ord)
  ), coded as (
    select raw.*,
      case
        when rereview_status = 'pending' then 'rereview_pending'
        when authority_status = 'verified' and expires_at is not null and expires_at <= now() then 'expired'
        when authority_status = 'verified' and expires_at is not null and expires_at <= now() + interval '7 days' then 'expiry_7d'
        when authority_status = 'verified' and expires_at is not null and expires_at <= now() + interval '14 days' then 'expiry_14d'
        when authority_status = 'verified' and expires_at is not null and expires_at <= now() + interval '30 days' then 'expiry_30d'
        else 'none'
      end as attention_code
    from raw
  ), enriched as (
    select coded.*,
      case attention_code
        when 'rereview_pending' then 0
        when 'expired' then 1
        when 'expiry_7d' then 2
        when 'expiry_14d' then 3
        when 'expiry_30d' then 4
        else 99
      end as attention_rank,
      case attention_code
        when 'rereview_pending' then 'critical'
        when 'expired' then 'critical'
        when 'expiry_7d' then 'high'
        when 'expiry_14d' then 'medium'
        when 'expiry_30d' then 'notice'
        else 'none'
      end as attention_severity
    from coded
  )
  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'attention', jsonb_strip_nulls(jsonb_build_object(
        'code', attention_code,
        'rank', attention_rank,
        'severity', attention_severity,
        'needs_attention', attention_rank < 99,
        'authority_expires_at', expires_at,
        'days_remaining', case when expires_at is null then null else floor(extract(epoch from (expires_at - now())) / 86400)::integer end,
        'recommended_action', case
          when attention_code = 'rereview_pending' then 'review_rereview'
          when attention_code in ('expired','expiry_7d','expiry_14d','expiry_30d') and coalesce((item->>'can_start_rereview')::boolean,false) then 'start_rereview'
          when attention_rank < 99 then 'monitor'
          else 'none'
        end
      ))
    ) order by attention_rank, ord
  ), '[]'::jsonb)
  into v_items
  from enriched;

  select
    count(*) filter (where coalesce((x.value->'attention'->>'needs_attention')::boolean,false)),
    count(*) filter (where x.value->'attention'->>'severity' = 'critical'),
    count(*) filter (where x.value->'attention'->>'severity' = 'high'),
    count(*) filter (where x.value->'attention'->>'severity' = 'medium'),
    count(*) filter (where x.value->'attention'->>'severity' = 'notice')
  into v_attention_total, v_critical, v_high, v_medium, v_notice
  from jsonb_array_elements(v_items) x(value);

  return jsonb_build_object(
    'items', v_items,
    'attention_summary', jsonb_build_object(
      'total', v_attention_total,
      'critical', v_critical,
      'high', v_high,
      'medium', v_medium,
      'notice', v_notice
    ),
    'access', coalesce(v_base->'access','{}'::jsonb) || jsonb_build_object(
      'admin_rereview_queue_enabled', true,
      'authority_expiry_alerts_enabled', true,
      'external_notification_delivery_enabled', false,
      'business_mutations_enabled', false,
      'publication_enabled', false
    )
  );
end;
$$;

revoke all on function public.d68_get_my_authority_review_v3(uuid) from public, anon, authenticated;
revoke all on function public.d68_advisor_ack_authority_expiry_alert_v1(uuid,text) from public, anon, authenticated;
revoke all on function public.d68_admin_list_advisor_business_intakes_v4() from public, anon, authenticated;

grant execute on function public.d68_get_my_authority_review_v3(uuid) to authenticated, service_role;
grant execute on function public.d68_advisor_ack_authority_expiry_alert_v1(uuid,text) to authenticated, service_role;
grant execute on function public.d68_admin_list_advisor_business_intakes_v4() to authenticated, service_role;

comment on function public.d68_get_my_authority_review_v3(uuid) is
  'Session 8 wraps Advisor Session 7 review data with one current read-time authority expiry/re-review alert and acknowledgement state; no external delivery.';
comment on function public.d68_advisor_ack_authority_expiry_alert_v1(uuid,text) is
  'Session 8 lets the owning Advisor acknowledge only the current server-derived authority alert; no Business state or permission changes.';
comment on function public.d68_admin_list_advisor_business_intakes_v4() is
  'Session 8 enriches the Session 7 Admin allowlist with a priority-sorted expiry/re-review attention queue; no Business writes.';

-- Explicit Session 8 boundary:
-- * alerts are computed at read time; no cron/background mutation is introduced;
-- * acknowledgement writes only advisor_authority_alert_receipts;
-- * Admin re-review actions continue to use Session 7 governed RPCs;
-- * no Business, publication, ownership, Storage, payment, financial, dataroom,
--   proposal, request or report permission is added.
