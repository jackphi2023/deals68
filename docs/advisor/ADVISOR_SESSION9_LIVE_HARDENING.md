# Advisor/Broker Session 9 — Live Hardening Addendum

This addendum records the production compatibility and scheduler-auth hardening completed while validating Session 9. It supersedes the original deployment details where they differ; the Session 9 authority/Business permission boundary is unchanged.

## Production Business schema compatibility

The first live dispatcher smoke test failed closed before queue creation because the production `businesses` table uses `company_name_private`, not `company_name`.

The follow-up migration:

`20260810174700_advisor_authority_email_live_schema_fix_phase9_v1.sql`

replaces only the private enqueue function and now derives the email Business label from:

1. `title_vi`;
2. `title_en`;
3. `company_name_private`;
4. fallback `Business`.

A dedicated static guard and PGlite production-schema smoke test were added so the repository no longer relies on the inaccurate fixture column.

No Business row, ownership state, publication flag, RLS policy or Advisor permission changed during this fix.

## Dedicated scheduler token

A second live smoke reached the Edge Function gateway but the original worker rejected the scheduler because an Edge-runtime `SUPABASE_ANON_KEY` string was not identical to the legacy anon JWT used by the Postgres scheduler.

The system remained fail-closed and no email was claimed or sent.

Instead of weakening worker authorization, Session 9 adds:

`20260810174800_advisor_authority_email_scheduler_auth_phase9_v1.sql`

This migration creates a dedicated high-entropy Vault secret:

`advisor_notification_scheduler_token`

and a service-role-only verifier:

`d68_notification_scheduler_authorize_v1(text)`

The legacy anon JWT is now used only to pass the `verify_jwt=true` Edge gateway. The worker must additionally present the private scheduler token from Vault before it may call service-only queue RPCs.

The worker still does not accept caller-controlled recipient, subject, Business ID, authority ID or alert key.

## Hardened worker v2

Redeploying the original Edge Function slug exposed stale hosted import-map metadata from its first deployment. The hosted bundler rejected the redeploy before runtime.

Rather than disable JWT verification or alter source security, Session 9 publishes a clean worker slug:

`advisor-authority-notification-email-v2`

with:

- `verify_jwt=true`;
- no import map;
- dedicated Vault scheduler-token verification;
- service-only queue claim/complete RPCs;
- Resend first, Brevo fallback;
- no arbitrary request payload;
- no recipient logging.

The routing migration:

`20260810174900_advisor_authority_email_worker_v2_phase9_v1.sql`

moves the private dispatcher to `/functions/v1/advisor-authority-notification-email-v2`.

The original v1 worker is retained as an unused deployment artifact; the Session 9 scheduler no longer routes to it.

## Operational release rule

During hardening the cron job was unscheduled so failed smoke tests could not repeat automatically.

The release procedure is:

1. deploy worker v2;
2. apply scheduler-token and v2-routing migrations;
3. manually call the private dispatcher while cron is off;
4. require HTTP 200 from worker v2;
5. require `claimed=0`, `sent=0`, `failed=0` on the current live dataset when no eligible Advisor exists;
6. confirm notification outbox remains empty;
7. only then reschedule `advisor-authority-notifications-session9` at `*/15 * * * *`;
8. verify exactly one active cron job.

## Boundary unchanged

The hardening work does not add or modify:

- Business ownership;
- Business editing;
- public listing approval;
- Storage policies;
- financial access;
- dataroom access;
- proposals/data requests;
- payments;
- reports;
- Advisor scopes beyond `profile`.

Operational email remains downstream of the governed authority lifecycle. Missing, disabling, opening or receiving an email never changes authority validity or Business access.
