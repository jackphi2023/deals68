# Advisor/Broker Development — Session 9 Controlled Authority Email Notifications

## Status

- Target branch: `building`
- Main branch change: **none**
- Business RLS change: **none**
- Business ownership/publication change: **none**
- Storage policy change: **none**
- External notification channel enabled: **email only**
- SMS/push: **disabled**
- Purpose: deliver the existing Session 8 server-derived authority expiry/re-review alerts by controlled operational email without creating a parallel authorization system.

## Session 9 boundary

Session 9 inherits the full Session 7/8 authority lifecycle boundary.

It does not grant Advisor:

- Business ownership;
- Business editing;
- publication approval;
- dataroom/files/images access;
- financial access;
- proposal/data-request access;
- payment access;
- report access.

For Session 4 Advisor-created Business intakes the Business remains ownerless, `draft`, `visible=false`, and not publication-approved. Assignment scope remains exactly `profile`.

Email delivery is operational messaging only. Whether an Advisor enables, disables, receives, opens or misses an email has no effect on authority validity or Business context access.

## Source of truth

Session 8 remains the alert identity/source of truth:

1. `rereview_pending:<rereview_uuid>`;
2. `expired:<exact-expiry-utc>`;
3. `expiry_7d:<exact-expiry-utc>`;
4. `expiry_14d:<exact-expiry-utc>`;
5. `expiry_30d:<exact-expiry-utc>`.

Session 9 independently derives the same current lifecycle from governed database state when building the outbox. It does not accept an alert code, recipient or Business from the browser or scheduler.

## Notification preferences

Session 9 creates:

`advisor_authority_notification_preferences`

Each active/verified Advisor can control only their own operational authority email settings through an RPC:

- master email on/off;
- 30-day expiry email;
- 14-day expiry email;
- 7-day expiry email;
- expired email;
- re-review-pending email.

Defaults are enabled. The preference table has RLS enabled and direct PUBLIC/anon/authenticated access revoked; the client writes only through the governed Advisor RPC.

Turning a preference off suppresses new delivery jobs for that alert band. It does not acknowledge an alert, extend authority, reopen Business context or mutate Business state.

## Delivery outbox

Session 9 creates:

`advisor_authority_notification_outbox`

The outbox is server-owned. Direct PUBLIC/anon/authenticated table privileges are revoked and RLS is enabled.

Each job stores:

- assignment / authority / Business / Advisor profile;
- email channel;
- exact alert key and alert code;
- severity;
- recipient email snapshot;
- language;
- authority expiry / re-review ID;
- status and attempt count;
- next attempt / processing lease / sent timestamps;
- provider + provider message ID;
- bounded delivery error;
- non-sensitive rendering payload.

There is a unique constraint on:

`(assignment_id, alert_key, channel)`

This is the main lifecycle dedupe guarantee: one email job for the exact alert identity.

## Enqueue boundary

`d68_private.enqueue_advisor_authority_notifications_v1()` may create an outbox row only when all governed conditions still hold, including:

- Session 4 Advisor Business-intake source;
- assignment status `pending` or `active`;
- assignment permissions exactly `['profile']`;
- active/verified Advisor account/profile;
- Business remains ownerless;
- Business remains `draft`;
- Business remains `visible=false`;
- email address is syntactically usable;
- matching email preference is enabled;
- a current expiry/re-review alert exists.

The function writes only the notification outbox. It does not update authority, assignment permissions or Business.

## Rate limit and retries

Worker policy:

- maximum 6 **sent** authority emails per Advisor profile per rolling 24 hours;
- maximum 3 attempts per job;
- first failed delivery retries after 15 minutes;
- second failed delivery retries after 1 hour;
- third failure becomes `exhausted`;
- a `processing` lease older than 20 minutes is recovered;
- worker batch defaults to 10 and is hard-capped at 20.

This protects against repeated scheduler invocations, provider faults and concurrent workers without loosening the authority lifecycle.

## Service-only worker RPCs

### Claim

`d68_notification_worker_claim_v1(integer)`

- service role only;
- invokes governed enqueue;
- chooses due jobs server-side;
- applies rate limit;
- uses `FOR UPDATE SKIP LOCKED`;
- returns only the jobs that the email worker is allowed to process.

### Complete

`d68_notification_worker_complete_v1(...)`

- service role only;
- accepts only a claimed `processing` job ID plus provider result;
- marks sent or schedules bounded retry/exhaustion;
- writes only the outbox.

Neither worker RPC is granted to `authenticated` or `anon`.

## Email worker

Supabase Edge Function:

`advisor-authority-notification-email`

The function:

1. accepts POST only;
2. is deployed with `verify_jwt=true`;
3. uses the service-role client only after scheduler-call validation;
4. claims jobs from the service-only worker RPC;
5. renders VI/EN content from server-returned job fields;
6. sends using the project email provider configuration;
7. completes each job through the service-only completion RPC.

The caller cannot provide recipient, subject, Business ID, authority ID or alert key in a request body. This prevents the public scheduler credential from becoming a generic email API.

## Email provider

The project already has a live `market-partner-activation-email` Edge Function that uses project-level email secrets.

Session 9 follows the same provider policy:

1. Resend when `RESEND_API_KEY` exists;
2. Brevo fallback when `BREVO_API_KEY` exists;
3. fail closed with `EMAIL_PROVIDER_NOT_CONFIGURED` otherwise.

Default sender:

`Deals68 <no-reply@deals68.com>`

Optional function-level environment names:

- `AUTHORITY_NOTIFICATION_FROM_EMAIL`
- `AUTHORITY_NOTIFICATION_FROM_NAME`
- `AUTHORITY_NOTIFICATION_BATCH_LIMIT`

No provider API key is stored in GitHub, Postgres tables, migration files, frontend code or Vault scheduler secrets.

## Scheduler

Session 9 enables Supabase/Postgres:

- `pg_cron`;
- `pg_net`.

Cron job:

`advisor-authority-notifications-session9`

Cadence:

`*/15 * * * *`

The private dispatcher:

`d68_private.dispatch_advisor_authority_notifications_v1()`

first runs governed enqueue, then invokes the Edge Function through `pg_net`.

Scheduler configuration uses Vault secret names:

- `advisor_notification_project_url`;
- `advisor_notification_anon_key`.

The Vault key is the active legacy anon JWT needed by the current `verify_jwt=true` Edge gateway. It is not a privileged secret and cannot call service-only worker RPCs. The Edge Function still refuses caller-controlled email payloads.

Provider secrets remain Edge Function project secrets, not Vault scheduler values.

## Advisor read surface

`d68_get_my_authority_review_v4(assignment_id)` wraps Session 8 `d68_get_my_authority_review_v3(...)` and adds:

- notification preferences;
- current exact-alert email delivery status;
- email enabled flag;
- SMS/push disabled flags;
- dedupe enabled flag;
- 6-email/24h limit metadata.

The Advisor UI adds a preference center to the existing authority panel and shows the current delivery state where applicable.

## Admin monitoring

`d68_admin_list_advisor_business_intakes_v5()` wraps Session 8 queue v4.

It adds:

- Advisor master email-enabled state per intake;
- latest delivery state per intake;
- aggregate pending / failed / exhausted / sent counts.

Admin receives **no manual “send now” bypass**. Delivery stays governed by current lifecycle + preferences + dedupe + rate limit.

Authority decisions/re-review continue to use the Session 7 RPCs.

## Automated QA

`qa:advisor-session9` runs:

1. static contract/security checks;
2. PGlite PostgreSQL lifecycle tests.

The PostgreSQL test covers:

- current 7-day alert read through Session 9 wrapper;
- default preferences;
- first enqueue;
- exact-alert replay dedupe;
- service-role-only worker ACL;
- worker claim;
- successful delivery completion;
- sent lifecycle replay dedupe;
- preference suppression;
- re-enable creating the new lifecycle job once;
- retry attempt 1 → 2 → 3 → exhausted;
- direct preference/outbox table access denied;
- outsider Advisor read denied;
- Admin delivery monitor;
- Business/publication mutation flags remain false.

The dedicated CI workflow re-runs Advisor Sessions 0–8 and full release QA.

## Deferred

Session 9 intentionally does not add:

- SMS;
- mobile/web push;
- marketing campaigns;
- arbitrary Admin send/resend;
- user-entered notification recipients;
- open/click tracking as an access-control input;
- webhook-driven authority mutation;
- OCR/authenticity scoring;
- malware scanning;
- automated mandate-expiry extraction;
- Business editing/ownership/publication;
- financial, dataroom, proposal, request, payment or report scopes.

A later session may add delivery observability or SMS/push using the same server-derived lifecycle. Those channels must remain downstream operational messaging and must never become a parallel authority system.
