# Advisor/Broker Development — Session 8 Authority Expiry Alerts & Admin Re-review Queue

## Status

- Target branch: `building`
- Main branch change: **none**
- Business RLS change: **none**
- Business ownership/publication change: **none**
- Storage policy change: **none**
- External notification delivery: **disabled**
- Purpose: surface authority expiry/re-review risk early, let Advisor acknowledge the current in-app alert, and give Admin a priority queue that reuses Session 7 governed re-review controls.

## Session 8 boundary

Session 8 inherits the Session 7 evidence-validation and re-review boundary. It does not grant Advisor Business editing, ownership, publication, dataroom, proposal, data-request, payment, financial or report access.

For Session 4 Advisor-created intake Businesses, the Business remains:

- ownerless;
- `draft`;
- `visible=false`;
- not publication-approved.

Assignment scope remains exactly `profile`.

Session 8 adds no cron/background mutation and no email/SMS/push sender. Alerts are calculated when the Advisor/Admin reads the authority state.

## Why read-time alerts first

The existing Session 7 trust layer already enforces authority expiry on every Business-context call. Session 8 adds operational visibility without creating a second access-control system.

This means:

1. the database remains the source of truth for expiry;
2. an alert cannot keep an expired authority active;
3. acknowledging an alert cannot extend authority;
4. Admin still uses the Session 7 re-review RPCs to change authority state;
5. a later delivery service may send notifications, but it must consume the same server-derived state rather than inventing another lifecycle.

## Alert bands

One current alert is returned per Advisor assignment, using this priority:

1. `rereview_pending` — critical;
2. `expired` — critical;
3. `expiry_7d` — high;
4. `expiry_14d` — medium;
5. `expiry_30d` — notice.

If none applies, no Advisor alert is returned.

A pending re-review outranks expiry because Business context is already suspended by the authority returning to `pending_review`.

## Advisor alert key

Every alert receives a server-derived key.

For expiry alerts the key includes the exact authority expiry timestamp. For a pending re-review the key includes the re-review UUID.

Therefore:

- changing the expiry creates a new alert identity;
- a new re-review cycle creates a new alert identity;
- a stale browser cannot acknowledge a different lifecycle event;
- the Advisor cannot submit an arbitrary alert key and have it accepted.

`d68_advisor_ack_authority_expiry_alert_v1(...)` recalculates the current alert and requires an exact key match before writing a receipt.

## Acknowledgement receipt

Session 8 creates:

`advisor_authority_alert_receipts`

The receipt records only:

- assignment;
- Advisor profile;
- current alert key;
- alert code;
- acknowledgement time.

The table has RLS enabled and direct PUBLIC/anon/authenticated privileges revoked. Clients do not write it directly.

Acknowledgement means only “Advisor has seen this current in-app alert.” It does not:

- renew authority;
- change assignment status;
- change permissions;
- open Business context;
- verify evidence;
- start or approve re-review;
- modify Business.

## Advisor read surface

`d68_get_my_authority_review_v3(assignment_id)` wraps Session 7 `d68_get_my_authority_review_v2(...)`.

Session 7 remains the authorization/source-of-truth layer for:

- active verified Advisor identity;
- ownership of the assignment;
- authority status;
- evidence state;
- re-review state;
- Admin-note redaction.

Session 8 then adds:

- `expiry_alert`;
- acknowledgement state;
- VI/EN alert title/message;
- severity;
- days remaining;
- explicit access flags showing external delivery and Business mutation are disabled.

## Advisor UI

The existing authority evidence panel now also shows:

- 30/14/7-day expiry warnings;
- expired authority warning;
- pending re-review warning;
- authority expiry date;
- “Đã xem cảnh báo / Acknowledge alert” action;
- acknowledgement timestamp.

The UI explicitly states that alerts are read-time only and that no automated email/SMS delivery exists in Session 8.

Evidence upload/replacement remains Session 7 v2 and `upsert=false`.

## Admin priority queue

`d68_admin_list_advisor_business_intakes_v4()` wraps Session 7 `d68_admin_list_advisor_business_intakes_v3()`.

The Session 7 Admin allowlist remains the source for Business/Advisor/authority/evidence/re-review data. Session 8 adds an `attention` object per item:

- `code`;
- `rank`;
- `severity`;
- `needs_attention`;
- authority expiry;
- days remaining;
- `recommended_action`.

Priority order is:

- pending re-review;
- expired authority;
- <=7 days;
- <=14 days;
- <=30 days;
- all other rows.

The response also includes `attention_summary` for critical/high/medium/notice counts.

## Admin actions

Session 8 creates no new authority decision shortcut.

If an authority needs re-review, Admin continues to call:

`d68_admin_start_advisor_authority_rereview_v1(...)`

If a pending re-review needs a decision, Admin continues to call:

`d68_admin_review_advisor_authority_rereview_v1(...)`

Therefore all Session 7 safeguards remain enforced, including:

- active Admin check;
- Session 4 source check;
- profile-only assignment check;
- ownerless/draft/non-public Business check;
- evidence validation prerequisites;
- bounded new expiry;
- rejection revoking assignment;
- no Business mutation.

## Public RPCs added

### Advisor

- `d68_get_my_authority_review_v3(uuid)`
- `d68_advisor_ack_authority_expiry_alert_v1(uuid,text)`

### Admin

- `d68_admin_list_advisor_business_intakes_v4()`

Every new Session 8 public RPC:

- is `SECURITY DEFINER`;
- uses `search_path=''`;
- revokes PUBLIC/anon/authenticated execution before explicit grants;
- grants execution only to authenticated/service role;
- delegates identity/assignment/Admin authorization to the existing governed source functions where appropriate.

## Security properties

Session 8 does not add:

- Business RLS policies;
- Storage policies;
- direct authenticated receipt-table DML;
- anonymous RPC execution;
- Business writes;
- payment writes;
- broad Advisor permissions;
- cron jobs;
- background HTTP calls;
- external notification queues.

The receipt table is isolated from Business state. Even a valid acknowledgement has no effect on authority validity or Business context.

## Automated QA

`qa:advisor-session8` runs:

1. static boundary/contract checks;
2. PGlite PostgreSQL lifecycle tests.

The Session 8 PostgreSQL test verifies:

- 7-day alert derivation;
- alert severity;
- stale/arbitrary acknowledgement rejection;
- successful current-key acknowledgement;
- one receipt persisted;
- acknowledged state returned on the next read;
- outsider Advisor access denied;
- Admin priority ordering: re-review > expired > 7-day > normal;
- attention summary;
- direct authenticated receipt-table SELECT/INSERT denied;
- anonymous execute denied for all Session 8 RPCs;
- Business mutation/publication flags remain false.

The dedicated workflow also re-runs Advisor Sessions 0–7 and the existing release QA.

## Deferred

Session 8 intentionally does not add:

- email notification delivery;
- SMS notification delivery;
- push notification delivery;
- scheduled/cron notification jobs;
- notification preference center;
- escalation to external channels;
- OCR/document authenticity scoring;
- malware scanning;
- automatic document-expiry extraction;
- Business editing;
- owner claim/transfer;
- publication approval;
- financial, dataroom, proposal, data-request, payment or report scopes.

A later session may add external delivery based on the same server-derived alert lifecycle. That should remain operational messaging only and must not become a parallel authorization system.
