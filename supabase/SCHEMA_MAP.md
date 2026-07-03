# Deals68 Supabase Schema Map

Core migrations include 14 operational tables for profiles, businesses, investors, proposals, files, images, promo codes, quality criteria and audit logs.

Migration `0004_extended_production_schema_80_tables.sql` adds 66 extension tables, bringing the production-beta schema to about 80 tables.

These tables are intentionally modular so Deals68 can expand from Vietnam to multi-country, multi-language operations without changing the core marketplace logic.

## Extension tables

- `organizations`
- `organization_members`
- `role_permissions`
- `user_sessions`
- `auth_events`
- `countries`
- `languages`
- `localization_strings`
- `translation_memory`
- `seo_pages`
- `seo_redirects`
- `media_assets`
- `documents`
- `document_versions`
- `document_access_grants`
- `payment_orders`
- `payment_transactions`
- `payment_methods`
- `payment_webhooks`
- `pricing_plans`
- `plan_features`
- `subscriptions`
- `promo_campaigns`
- `affiliate_accounts`
- `affiliate_links`
- `affiliate_clicks`
- `affiliate_conversions`
- `affiliate_payouts`
- `advisor_profiles`
- `advisor_assignments`
- `business_financials`
- `business_monthly_metrics`
- `business_valuations`
- `valuation_rules`
- `valuation_rule_versions`
- `data_sources`
- `data_confidence_events`
- `business_quality_scores`
- `business_quality_items`
- `business_change_requests`
- `business_reviews`
- `business_watchers`
- `investor_criteria_versions`
- `investor_recommendations`
- `match_scores`
- `match_explanations`
- `proposal_events`
- `proposal_documents`
- `connection_requests`
- `data_request_items`
- `alerts`
- `alert_subscriptions`
- `email_templates`
- `email_queue`
- `notifications`
- `inbox_threads`
- `inbox_messages`
- `audit_events`
- `security_events`
- `rate_limit_events`
- `webhook_events`
- `import_jobs`
- `import_job_rows`
- `admin_tasks`
- `admin_notes`
- `admin_review_queue`
