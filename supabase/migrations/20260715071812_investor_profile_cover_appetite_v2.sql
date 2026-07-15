begin;

create or replace function public.admin_set_default_investor_cover(
  cover_url text,
  cover_path text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_url text := nullif(btrim(coalesce(cover_url, '')), '');
  v_path text := nullif(btrim(coalesce(cover_path, '')), '');
  v_row public.site_banners%rowtype;
  v_old_path text;
begin
  if not public.is_admin_user() then
    raise exception 'admin_required';
  end if;

  if v_url is null or v_path is null then
    raise exception 'cover_url_and_path_required';
  end if;

  if v_path !~ '^investor_cover/default/[A-Za-z0-9._/-]+$' then
    raise exception 'invalid_default_cover_path';
  end if;

  select *
  into v_row
  from public.site_banners b
  where b.placement = 'investor_cover_default'
  order by b.active desc, b.updated_at desc, b.created_at desc
  limit 1
  for update;

  if found then
    v_old_path := nullif(v_row.image_path, '');

    update public.site_banners b
    set title = 'Ảnh Cover Investor mặc định',
        image_url = v_url,
        image_path = v_path,
        link_url = null,
        sort_order = 1,
        lang_mode = 'both',
        starts_at = current_date,
        ends_at = null,
        active = true,
        focal_x = 50,
        focal_y = 50,
        desktop_fit = 'cover',
        mobile_fit = 'cover',
        updated_at = now()
    where b.id = v_row.id
    returning * into v_row;
  else
    insert into public.site_banners (
      placement, title, image_url, image_path, link_url, sort_order,
      lang_mode, starts_at, ends_at, active, focal_x, focal_y,
      desktop_fit, mobile_fit, updated_at
    ) values (
      'investor_cover_default', 'Ảnh Cover Investor mặc định',
      v_url, v_path, null, 1, 'both', current_date, null, true,
      50, 50, 'cover', 'cover', now()
    ) returning * into v_row;
  end if;

  update public.site_banners b
  set active = false, updated_at = now()
  where b.placement = 'investor_cover_default'
    and b.id <> v_row.id
    and b.active = true;

  return jsonb_build_object(
    'banner_id', v_row.id,
    'old_path', v_old_path,
    'image_url', v_row.image_url,
    'image_path', v_row.image_path
  );
end
$$;

revoke all on function public.admin_set_default_investor_cover(text, text)
from public;
grant execute on function public.admin_set_default_investor_cover(text, text)
to authenticated;

create or replace function public.submit_my_investor_appetite(
  appetite_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_value text := btrim(coalesce(appetite_text, ''));
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if char_length(v_value) > 5000 then
    raise exception 'investment_appetite_too_long';
  end if;

  select * into v_row
  from public.investors i
  where i.owner_id = auth.uid()
  for update;
  if not found then raise exception 'investor_not_found'; end if;

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
  v_pending_criteria := jsonb_set(
    v_pending_criteria, '{investment_appetite}', to_jsonb(v_value), true
  );
  v_pending := jsonb_set(v_pending, '{criteria}', v_pending_criteria, true);
  v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
  v_privacy := jsonb_set(
    v_privacy, '{pending_submitted_at}', to_jsonb(now()::text), true
  );

  update public.investors i
  set privacy = v_privacy, updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'appetite_pending', true,
    'pending_value', v_value
  );
end
$$;

revoke all on function public.submit_my_investor_appetite(text)
from public;
grant execute on function public.submit_my_investor_appetite(text)
to authenticated;

create or replace function public.admin_approve_investor_appetite(
  investor_uuid uuid,
  appetite_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_criteria jsonb;
  v_privacy jsonb;
  v_pending jsonb;
  v_pending_criteria jsonb;
  v_value text := btrim(coalesce(appetite_text, ''));
begin
  if not public.is_admin_user() then raise exception 'admin_required'; end if;
  if char_length(v_value) > 5000 then
    raise exception 'investment_appetite_too_long';
  end if;

  select * into v_row
  from public.investors i
  where i.id = investor_uuid
  for update;
  if not found then raise exception 'investor_not_found'; end if;

  v_criteria := coalesce(v_row.criteria, '{}'::jsonb);
  if v_value = '' then
    v_criteria := v_criteria - 'investment_appetite';
  else
    v_criteria := jsonb_set(
      v_criteria, '{investment_appetite}', to_jsonb(v_value), true
    );
  end if;

  v_privacy := coalesce(v_row.privacy, '{}'::jsonb);
  v_pending := case
    when jsonb_typeof(v_privacy -> 'pending_profile_changes') = 'object'
      then v_privacy -> 'pending_profile_changes'
    else '{}'::jsonb
  end;
  if jsonb_typeof(v_pending -> 'criteria') = 'object' then
    v_pending_criteria := (v_pending -> 'criteria') - 'investment_appetite';
    if v_pending_criteria = '{}'::jsonb then
      v_pending := v_pending - 'criteria';
    else
      v_pending := jsonb_set(v_pending, '{criteria}', v_pending_criteria, true);
    end if;
  end if;
  if v_pending = '{}'::jsonb then
    v_privacy := v_privacy - 'pending_profile_changes' - 'pending_submitted_at';
  else
    v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true);
  end if;

  update public.investors i
  set criteria = v_criteria, privacy = v_privacy, updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'approved_value', v_value,
    'has_other_pending_changes', v_pending <> '{}'::jsonb
  );
end
$$;

revoke all on function public.admin_approve_investor_appetite(uuid, text)
from public;
grant execute on function public.admin_approve_investor_appetite(uuid, text)
to authenticated;

create or replace function public.admin_set_investor_cover(
  investor_uuid uuid,
  cover_url text default null,
  cover_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.investors%rowtype;
  v_criteria jsonb;
  v_old_path text;
  v_url text := nullif(btrim(coalesce(cover_url, '')), '');
  v_path text := nullif(btrim(coalesce(cover_path, '')), '');
  v_expected_prefix text := 'investor_cover/' || investor_uuid::text || '/';
begin
  if not public.is_admin_user() then raise exception 'admin_required'; end if;
  if (v_url is null) <> (v_path is null) then
    raise exception 'cover_url_and_path_must_be_set_together';
  end if;
  if v_path is not null and left(v_path, char_length(v_expected_prefix))
      <> v_expected_prefix then
    raise exception 'invalid_investor_cover_path';
  end if;

  select * into v_row
  from public.investors i
  where i.id = investor_uuid
  for update;
  if not found then raise exception 'investor_not_found'; end if;

  v_criteria := coalesce(v_row.criteria, '{}'::jsonb);
  v_old_path := nullif(v_criteria ->> 'cover_image_path', '');
  if v_url is null then
    v_criteria := v_criteria - 'cover_image_url' - 'cover_image_path';
  else
    v_criteria := jsonb_set(v_criteria, '{cover_image_url}', to_jsonb(v_url), true);
    v_criteria := jsonb_set(v_criteria, '{cover_image_path}', to_jsonb(v_path), true);
  end if;

  update public.investors i
  set criteria = v_criteria, updated_at = now()
  where i.id = v_row.id;

  return jsonb_build_object(
    'investor_id', v_row.id,
    'old_path', v_old_path,
    'cover_image_url', v_url,
    'cover_image_path', v_path
  );
end
$$;

revoke all on function public.admin_set_investor_cover(uuid, text, text)
from public;
grant execute on function public.admin_set_investor_cover(uuid, text, text)
to authenticated;

commit;
