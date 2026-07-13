-- Deals68 Release Candidate — run only AFTER Netlify production is serving
-- frontend code that calls create_signup_bundle_v2.

revoke all on function public.create_signup_bundle(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

comment on function public.create_signup_bundle(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb
) is 'Deprecated signup v1. Client EXECUTE revoked after Deals68 v2 production cutover.';
