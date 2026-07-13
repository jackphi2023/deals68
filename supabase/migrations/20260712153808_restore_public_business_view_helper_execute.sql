-- Restore only the immutable parsing helpers required by the
-- security_invoker public_businesses_safe view.
-- These functions accept text and return parsed numeric/integer values;
-- they do not read or mutate tables.

grant execute on function public.d68_try_numeric(text)
to anon, authenticated;

grant execute on function public.d68_try_integer(text)
to anon, authenticated;

comment on function public.d68_try_numeric(text) is
  'Immutable safe numeric parser used by public_businesses_safe; executable by anon/authenticated because the view is security_invoker.';

comment on function public.d68_try_integer(text) is
  'Immutable safe integer parser used by public_businesses_safe; executable by anon/authenticated because the view is security_invoker.';
