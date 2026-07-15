begin;

create or replace function public.submit_my_investor_criteria_review(
  criteria_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_patch jsonb := case
    when jsonb_typeof(criteria_patch) = 'object' then criteria_patch
    else '{}'::jsonb
  end;
  v_approved_criteria jsonb;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_key text;
  v_value text;
  v_approved_value text;
  v_allowed constant text[] := array[
    'investment_appetite',
    'riskAppetite',
    'returnExpectation',
    'revenueRange'
  ];
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_patch) as key_name
    where not (key_name = any(v_allowed))
  ) then
    raise exception 'unsupported_investor_criteria_field';
  end if;

  select * into v_row
  from public.investors i
  where i.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'investor_not_found';
  end if;

  v_approved_criteria := coalesce(v_row.criteria, '{}'::jsonb);
  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  v_pending := case
    when jsonb_typeof(v_privacy -> 'pending_profile_changes') = 'object'
      then v_privacy -> 'pending_profile_changes'
    else '{}'::jsonb
  end;
  v_pending_criteria := case
    when jsonb_typeof(v_pending -> 'criteria') = 'object'
      then v_pending -> 'criteria'
    else '{}'::jsonb
  end;

  foreach v_key in array v_allowed loop
    if v_patch ? v_key then
      if jsonb_typeof(v_patch -> v_key) not in ('string', 'number', 'null') then
        raise exception 'invalid_investor_criteria_value';
      end if;

      v_value := btrim(coalesce(v_patch ->> v_key, ''));
      if v_key = 'investment_appetite' and char_length(v_value) > 5000 then
        raise exception 'investment_appetite_too_long';
      end if;
      if v_key <> 'investment_appetite' and char_length(v_value) > 160 then
        raise exception 'investor_criteria_value_too_long';
      end if;

      v_approved_value := btrim(coalesce(
        case
          when v_key = 'revenueRange' then
            coalesce(
              v_approved_criteria ->> 'revenueRange',
              v_approved_criteria ->> 'revenueBand'
            )
          else v_approved_criteria ->> v_key
        end,
        ''
      ));

      if v_value = v_approved_value then
        v_pending_criteria := v_pending_criteria - v_key;
      else
        v_pending_criteria := jsonb_set(
          v_pending_criteria,
          array[v_key],
          to_jsonb(v_value),
          true
        );
      end if;
    end if;
  end loop;

  if v_pending_criteria = '{}'::jsonb then
    v_pending := v_pending - 'criteria';
  else
    v_pending := jsonb_set(
      v_pending,
      '{criteria}',
      v_pending_criteria,
      true
    );
  end if;

  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(
      v_privacy,
      '{pending_profile_changes}',
      v_pending,
      true
    );
    v_privacy := jsonb_set(
      v_privacy,
      '{pending_submitted_at}',
      to_jsonb(now()::text),
      true
    );
  end if;

  update public.investors i
  set privacy = v_privacy,
      updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'criteria_pending', v_pending_criteria
  );
end
$$;

revoke all on function public.submit_my_investor_criteria_review(jsonb)
  from public, anon;
grant execute on function public.submit_my_investor_criteria_review(jsonb)
  to authenticated, service_role;

commit;
