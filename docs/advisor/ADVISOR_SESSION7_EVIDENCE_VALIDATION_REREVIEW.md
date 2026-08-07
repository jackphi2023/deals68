# Advisor/Broker Development — Session 7 Evidence Validation & Authority Re-review

## Status

- Target branch: `building`
- Main branch change: **none**
- Business RLS change: **none**
- Business ownership/publication change: **none**
- Storage UPDATE/DELETE policy change: **none**
- Purpose: validate individual authority evidence, govern replacement evidence and re-review verified authority before expiry or when the mandate must be re-confirmed.

## Session 7 boundary

Session 7 strengthens the authority trust layer introduced in Sessions 4–6. It does not grant Advisor Business editing, ownership, publication, dataroom, proposal, data-request, payment, financial or report access.

The Session 4 intake Business remains:

- ownerless;
- `draft`;
- `visible=false`;
- not publication-approved.

The only assignment scope allowed through initial approval or re-review remains exactly `profile`.

## Evidence validation

Session 7 adds Admin-owned validation metadata to `advisor_authority_evidence`:

- `unreviewed`;
- `valid`;
- `insufficient`;
- `invalid`.

The uploaded evidence payload remains immutable after submission. Admin validation may change only review metadata and replacement/supersession linkage; it cannot change the original file path, MIME type, size, document type, submission note or submitted timestamp.

An internal trigger blocks mutation of submitted evidence payload fields even if a future privileged code path accidentally attempts it.

### Advisor visibility

The Advisor may see:

- validation status;
- validation timestamp;
- whether an evidence has been superseded;
- Advisor-visible evidence/replacement requests;
- re-review status and reason.

Admin internal validation notes are not returned by the Advisor review RPC.

## Replacement evidence

An Admin may classify a current evidence as `insufficient` or `invalid` and request a replacement.

The Advisor cannot overwrite or delete the original object. Instead:

1. Advisor selects the insufficient/invalid evidence to replace.
2. `d68_advisor_begin_authority_evidence_v2(...)` validates the replacement target and allocates a new random Storage path.
3. The browser uploads with `upsert=false` to that exact path.
4. `d68_advisor_complete_authority_evidence_v2(...)` revalidates Storage owner/owner_id, size and MIME.
5. The new evidence is linked through `replaces_evidence_id`.
6. The old evidence receives `superseded_by_evidence_id` and `superseded_at`.
7. Both records remain in the audit trail.

A replacement is allowed only for a current submitted evidence whose validation status is `insufficient` or `invalid`.

Session 7 keeps at most eight current evidence files per intake. Superseded records remain retained but do not count as current evidence.

## Storage compatibility

The private bucket remains:

`advisor-authority-evidence-private`

Session 7 does not create any Storage UPDATE or DELETE policy. It reuses the Session 6 INSERT/SELECT policies.

The Session 7 completion RPC checks `storage.objects.owner_id` first and falls back to the legacy `owner` column for compatibility with the existing project schema.

## Re-review ledger

Session 7 creates:

`advisor_authority_rereviews`

Each row records one governed cycle:

- assignment / authority / Business;
- cycle number;
- Admin who started it;
- reason;
- previous verification and expiry snapshot;
- decision Admin;
- decision time and note;
- new expiry after approval.

Only one `pending` re-review may exist per assignment.

The table has RLS enabled and no direct `anon` or `authenticated` table privileges. Clients interact only through checked RPCs.

## Start re-review

`d68_admin_start_advisor_authority_rereview_v1(assignment_id, note)` requires:

- active Admin;
- Session 4 Advisor intake source;
- exact assignment permission `[profile]`;
- assignment status `pending`, `active` or `expired`;
- verified matching authority;
- ownerless/draft/non-public Business;
- no already-pending re-review;
- a reason of at least five characters.

Suspended and revoked assignments cannot start a re-review.

Starting re-review:

- snapshots the previous authority verification and expiry;
- sets authority to `pending_review`;
- clears `verified_by`, `verified_at` and authority expiry;
- leaves assignment scope/status unchanged;
- writes review history and audit logs;
- does not mutate Business.

Because the Session 3 Business-context RPC revalidates verified/unexpired authority on every call, returning authority to `pending_review` immediately closes Advisor Business context without adding new Business RLS or mutation logic.

## Evidence during re-review

A verified Advisor may upload evidence during a pending re-review even when the existing assignment has already been accepted.

Upload remains allowed only when:

- assignment is a Session 4 intake;
- assignment status is `pending`, `active` or `expired`;
- permissions equal exactly `[profile]`;
- matching authority is `pending_review`;
- Business remains ownerless/draft/non-public;
- a pending re-review exists for accepted/non-pending assignments;
- Advisor profile remains active and verified.

Suspended and revoked assignments remain excluded.

## Re-review approval

`d68_admin_review_advisor_authority_rereview_v1(..., 'approve', expires_at, note)` requires:

- active Admin;
- pending re-review;
- matching Session 4 profile-only assignment;
- matching `pending_review` authority;
- unchanged ownerless/draft/non-public Business;
- expiry more than one hour and no more than 365 days ahead;
- at least one current `valid` evidence;
- zero current `insufficient` or `invalid` evidence.

Approval then:

- restores authority to `verified`;
- records the Admin verifier and timestamp;
- sets the new authority expiry;
- synchronizes assignment expiry;
- keeps permissions exactly `[profile]`;
- returns accepted assignments to `active`, otherwise `pending`;
- records review history and audit logs;
- leaves Business unchanged.

An unreviewed evidence is not itself a blocking invalid result, but at least one current evidence must be explicitly validated as `valid` before a re-review can be approved.

## Re-review rejection

Rejection:

- sets authority to `rejected`;
- revokes the assignment;
- records the rejection reason;
- records re-review history and audit logs;
- leaves Business ownerless, draft and non-public.

The assignment remains profile-only in its historical permissions field; revoked status prevents access.

## Expiry awareness

The Session 7 read surfaces calculate authority lifecycle state:

- `initial_pending`;
- `rereview_pending`;
- `verified_current`;
- `expiring_soon` — verified authority expiring within 30 days;
- `expired`;
- `rejected`.

This is read-time state, not a broad background mutation job.

## Public RPCs

### Advisor

- `d68_advisor_begin_authority_evidence_v2(...)`
- `d68_advisor_complete_authority_evidence_v2(evidence_id)`
- `d68_get_my_authority_review_v2(assignment_id)`

### Admin

- `d68_admin_validate_advisor_authority_evidence_v1(...)`
- `d68_admin_request_advisor_authority_evidence_v2(...)`
- `d68_admin_start_advisor_authority_rereview_v1(...)`
- `d68_admin_review_advisor_authority_rereview_v1(...)`
- `d68_admin_list_advisor_business_intakes_v3()`

Every new public RPC:

- is `SECURITY DEFINER`;
- uses `search_path=''`;
- revokes default/PUBLIC/anon/authenticated execution before explicit grants;
- grants execution only to authenticated/service role;
- performs role, assignment, authority and Business-state authorization inside the function.

## Admin UI

`/admin/advisor-intakes` now adds:

- authority lifecycle badge;
- current/total evidence count;
- validation summary;
- per-file `Valid / Insufficient / Invalid` controls;
- replacement request action;
- re-review cycle status;
- start re-review action;
- re-review approve/reject actions;
- new expiry selection.

The Admin frontend performs no direct Business, evidence or re-review table mutation.

## Advisor UI

The Advisor dashboard now adds:

- per-file validation status;
- superseded/replacement markers;
- replacement upload action for insufficient/invalid evidence;
- Advisor-visible replacement reason;
- authority lifecycle label;
- re-review cycle/reason banner;
- explicit notice that Business context is closed during pending re-review.

The Advisor frontend performs no direct Business/evidence/re-review table mutation.

## Review history

Session 7 extends the append-only review event vocabulary with:

- `evidence_validated`;
- `evidence_replacement_requested`;
- `authority_rereview_started`;
- `authority_rereview_approved`;
- `authority_rereview_rejected`.

Admin internal decision notes remain hidden from Advisor read surfaces unless an event is explicitly marked Advisor-visible.

## Automated verification

Workflow:

`Advisor Session 7 - Evidence Validation & Re-review`

Runs:

- `npm ci`;
- `npm run qa:advisor-session7`;
- Sessions 0–6 regressions;
- existing `qa:release`.

Session 7 PostgreSQL coverage includes:

- migrations 1→7 in order;
- initial evidence upload through v2;
- invalid evidence validation;
- Advisor-visible replacement request with Admin validation-note redaction;
- replacement upload and atomic supersession;
- immutable submitted evidence payload trigger;
- Admin validation summary;
- initial Session 5 approval remains profile-only and acceptance-gated;
- accepted read-only Business context before re-review;
- re-review start returning authority to `pending_review`;
- immediate Business-context denial during re-review;
- evidence upload while accepted assignment is under re-review;
- re-review approval blocked by current invalid evidence;
- replacement + valid evidence resolving the blocker;
- profile-only re-review approval restoring read-only context;
- second re-review rejection revoking assignment;
- Business ownerless/draft/non-public throughout;
- unchanged Business RLS policy count;
- unchanged private Storage policy shape (INSERT + SELECT only);
- no payment order creation;
- anonymous execution denied for every new RPC;
- direct authenticated access to evidence/re-review tables denied.

## Deferred

Session 7 does not add:

- OCR/document authenticity scoring;
- electronic-signature validation;
- malware/content scanning;
- automatic document-expiry extraction;
- scheduled notification delivery;
- evidence retention/deletion workflows;
- owner claim/transfer;
- Business publication/content approval;
- Advisor Business editing;
- financial, dataroom, proposal, request, payment or report scopes.

A later session may add expiry notifications and/or an Admin-governed narrow Business profile-edit workflow, but mutation should remain a separate security release.