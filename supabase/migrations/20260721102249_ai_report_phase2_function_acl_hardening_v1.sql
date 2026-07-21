-- Deals68 AI Report Phase 2 function ACL hardening.
-- Supabase may provision explicit anon/authenticated EXECUTE grants for new public-schema functions.
-- Remove those grants from internal helpers and keep only the intended report RPC surface.

revoke execute on function public.d68_ai_report_set_updated_at() from public, anon, authenticated;
revoke execute on function public.d68_validate_file_processing_business() from public, anon, authenticated;
revoke execute on function public.d68_protect_listing_authority_fields() from public, anon, authenticated;
revoke execute on function public.d68_apply_authority_to_preflight() from public, anon, authenticated;
revoke execute on function public.d68_sync_one_self_declared_field(uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.d68_sync_business_self_declared_fields() from public, anon, authenticated;
revoke execute on function public.d68_queue_business_file_processing() from public, anon, authenticated;
revoke execute on function public.d68_validate_dataroom_fact_business() from public, anon, authenticated;
revoke execute on function public.d68_set_ai_report_alert(uuid,uuid,public.d68_ai_report_alert_code,public.d68_ai_report_alert_severity,text,text,jsonb,boolean,boolean) from public, anon, authenticated;
revoke execute on function public.d68_resolve_ai_report_alert(uuid,public.d68_ai_report_alert_code) from public, anon, authenticated;

revoke execute on function public.d68_run_business_report_preflight(uuid) from public, anon;
revoke execute on function public.d68_get_business_report_status(uuid) from public, anon;
revoke execute on function public.d68_reserve_business_report_request(uuid,text) from public, anon;

grant execute on function public.d68_run_business_report_preflight(uuid) to authenticated, service_role;
grant execute on function public.d68_get_business_report_status(uuid) to authenticated, service_role;
grant execute on function public.d68_reserve_business_report_request(uuid,text) to authenticated, service_role;

revoke execute on function public.d68_complete_business_report_request(uuid,uuid,jsonb) from public, anon, authenticated;
revoke execute on function public.d68_fail_business_report_request(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.d68_complete_business_report_request(uuid,uuid,jsonb) to service_role;
grant execute on function public.d68_fail_business_report_request(uuid,text,jsonb) to service_role;

grant execute on function public.d68_ai_report_set_updated_at() to service_role;
grant execute on function public.d68_validate_file_processing_business() to service_role;
grant execute on function public.d68_protect_listing_authority_fields() to service_role;
grant execute on function public.d68_apply_authority_to_preflight() to service_role;
grant execute on function public.d68_sync_one_self_declared_field(uuid,text,text,jsonb) to service_role;
grant execute on function public.d68_sync_business_self_declared_fields() to service_role;
grant execute on function public.d68_queue_business_file_processing() to service_role;
grant execute on function public.d68_validate_dataroom_fact_business() to service_role;
grant execute on function public.d68_set_ai_report_alert(uuid,uuid,public.d68_ai_report_alert_code,public.d68_ai_report_alert_severity,text,text,jsonb,boolean,boolean) to service_role;
grant execute on function public.d68_resolve_ai_report_alert(uuid,public.d68_ai_report_alert_code) to service_role;

notify pgrst, 'reload schema';