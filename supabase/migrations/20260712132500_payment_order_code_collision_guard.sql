-- Deals68 G7 — compatibility guard for legacy fixed transfer references.
-- Current main may reuse one bankContent per Business/Investor until G7 source cuts over.

create or replace function public.prepare_payment_order_row()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  raw_code text;
  clean_code text;
  unique_suffix text;
begin
  new.payload := coalesce(new.payload, '{}'::jsonb);

  raw_code := coalesce(
    nullif(trim(new.order_code), ''),
    nullif(trim(new.payload->>'orderCode'), ''),
    nullif(trim(new.payload->>'bankContent'), ''),
    'D68-' || upper(substr(replace(new.id::text, '-', ''), 1, 12))
  );

  clean_code := upper(regexp_replace(raw_code, '[^a-zA-Z0-9-]', '', 'g'));
  if length(clean_code) < 6 then
    clean_code := 'D68-' || upper(substr(replace(new.id::text, '-', ''), 1, 12));
  end if;

  clean_code := left(clean_code, 40);
  unique_suffix := upper(substr(replace(new.id::text, '-', ''), 1, 10));

  if exists (
    select 1
    from public.payment_orders p
    where upper(p.order_code) = upper(clean_code)
      and p.id <> new.id
  ) then
    clean_code := left(clean_code, 29) || '-' || unique_suffix;
  end if;

  new.order_code := clean_code;
  new.payload := jsonb_set(new.payload, '{orderCode}', to_jsonb(new.order_code), true);
  new.payload := jsonb_set(new.payload, '{bankContent}', to_jsonb(new.order_code), true);

  if tg_op = 'INSERT' and not public.is_admin() then
    new.status := 'pending';
    new.confirmed_at := null;
    new.confirmed_by := null;
    new.rejected_at := null;
    new.rejected_by := null;
    new.applied_at := null;
    new.applied_result := '{}'::jsonb;
  end if;

  return new;
end;
$$;
