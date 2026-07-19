-- Promote criteria left in the legacy broad-review queue before the Investor
-- Profile V2 contract became active. Introduction and future asset keys stay
-- pending; no profile rows or test data are created.

do $$
declare
  v_row record;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_criteria jsonb;
  v_privacy jsonb;
  v_types text[];
  v_stages text[];
begin
  for v_row in
    select id, type, stage, criteria, privacy
    from public.investors
    where jsonb_typeof(privacy -> 'pending_profile_changes' -> 'criteria') = 'object'
    for update
  loop
    v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
    v_pending := v_privacy -> 'pending_profile_changes';
    v_pending_criteria := v_pending -> 'criteria';
    v_criteria := case
      when jsonb_typeof(v_row.criteria) = 'object' then v_row.criteria
      else '{}'::jsonb
    end || v_pending_criteria;

    v_types := public.normalize_investor_type_array(
      case
        when jsonb_typeof(v_criteria -> 'investorTypes') = 'array'
          then v_criteria -> 'investorTypes'
        else jsonb_build_array(v_row.type)
      end
    );
    v_stages := public.normalize_investor_stage_array(
      case
        when jsonb_typeof(v_criteria -> 'stages') = 'array'
          then v_criteria -> 'stages'
        else jsonb_build_array(coalesce(v_row.stage, 'Any'))
      end
    );

    if cardinality(v_types) > 0 then
      v_criteria := jsonb_set(v_criteria, '{investorTypes}', to_jsonb(v_types), true);
    end if;
    if cardinality(v_stages) > 0 then
      v_criteria := jsonb_set(v_criteria, '{stages}', to_jsonb(v_stages), true);
    end if;

    v_pending := v_pending - 'criteria';
    if v_pending = '{}'::jsonb then
      v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
    else
      v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
    end if;

    update public.investors i
    set criteria = v_criteria,
        type = coalesce(v_types[1], i.type),
        stage = coalesce(v_stages[1], i.stage),
        privacy = v_privacy,
        updated_at = now()
    where i.id = v_row.id;
  end loop;
end
$$;
