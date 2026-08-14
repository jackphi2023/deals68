# Advisor/Broker Development — Session 6 Authority Evidence & Review History

## Status

- Target branch: `building`
- Main branch change: **none**
- Business RLS change: **none**
- Business ownership/publication change: **none**
- Migration: `20260807155500_advisor_authority_evidence_phase6_v1.sql`
- Purpose: add private, immutable authority evidence and append-only review history to Session 4 Business intakes without expanding Advisor Business permissions.

## Session 6 boundary

Session 6 proves or challenges the Advisor/Broker authority relationship. It still does not approve a Business for public listing, create Business ownership, or enable Business editing.

An intake Business remains ownerless, draft and non-public throughout evidence submission and evidence requests.

The only assignment scope available through Session 5 approval remains `profile`, and the Advisor must still accept that assignment before the Session 3 read-only context opens.

No Business file/image, proposal, data request, payment, financial or report permission is introduced.

## Dedicated private evidence store

Session 6 creates the private Storage bucket:

`advisor-authority-evidence-private`

Restrictions:

- private bucket;
- PDF, JPEG, PNG or WebP only;
- 10 MB maximum per file;
- maximum 8 submitted files per intake;
- server-generated paths only;
- upload allocation expires after two hours;
- evidence is immutable after submission;
- no authenticated UPDATE or DELETE Storage policy is created.

The existing Business private-file bucket is not reused, so Session 6 does not widen Business dataroom access.

## Evidence records

`advisor_authority_evidence` stores an immutable metadata record for each allocated/submitted evidence object. Direct authenticated table privileges are revoked; clients interact through RPCs and Storage RLS only.

Supported evidence types:

- authorization letter;
- mandate / engagement;
- ownership proof;
- identity document;
- other authority evidence.

The existing `business_listing_authority.authority_document_ids` array is populated only after the server confirms that the exact Storage object exists and its owner, size and MIME type match the allocation.

## Advisor upload flow

1. Advisor selects a pending Session 4 intake.
2. `d68_advisor_begin_authority_evidence_v1(...)` validates active/verified Advisor status, assignment, pending authority and unchanged ownerless/draft/non-public Business state.
3. The RPC creates a short-lived allocation with a random server-generated Storage path.
4. The browser uploads exactly to that private path with `upsert=false`.
5. `d68_advisor_complete_authority_evidence_v1(...)` checks the Storage object owner, byte size and MIME type.
6. Only then is the evidence marked submitted and linked to the authority.
7. Submission writes review history and audit log entries.

Evidence submission never changes authority to verified and never activates the assignment.

## Advisor review view

`d68_get_my_authority_review_v1(assignment_id)` returns only the calling Advisor's own Session 4 intake evidence and review timeline.

Admin-internal notes are omitted from the Advisor response. Advisor-visible evidence requests remain visible.

The Advisor dashboard now provides:

- evidence list and download;
- evidence upload while authority remains pending review;
- latest Admin evidence request;
- review history;
- explicit evidence limits and immutability notice.

## Admin evidence review

`d68_admin_list_advisor_business_intakes_v2()` preserves the Session 5 Business/Advisor/authority allowlist and enriches it with:

- submitted evidence count;
- submitted evidence metadata;
- review history;
- eligibility for requesting more evidence.

Admin can download submitted authority evidence from the private bucket because the Storage SELECT policy allows active Admin users.

## Request more evidence

`d68_admin_request_advisor_authority_evidence_v1(assignment_id, note)` requires:

- active Admin;
- Session 4 pending assignment;
- pending-review authority;
- ownerless/draft/non-public Business;
- a reason of at least five characters.

Maximum five evidence requests per intake per 24 hours are allowed.

The request is append-only: it creates a review-history event and audit entry but does not alter Business, authority or assignment state.

## Review history

`advisor_authority_review_events` is an append-only ledger for:

- intake created;
- evidence submitted;
- evidence requested;
- authority approved;
- authority rejected.

Session 6 installs triggers so later Session 4 intakes and Session 5 authority decisions are recorded automatically. Existing Session 4/5 intake history is backfilled where possible.

Review history table access is RPC-only for authenticated clients.

## Approval and rejection remain Session 5 governed

Session 6 deliberately keeps the Session 5 decision RPC unchanged.

Approval still results in:

- authority `verified`;
- assignment `pending`;
- assignment permission `[profile]`;
- Advisor acceptance still required;
- Business unchanged.

Rejection still revokes the assignment and leaves the Business ownerless, draft and non-public.

## Security model

New public RPCs are `SECURITY DEFINER` with `search_path=''`, default/PUBLIC/anon execution revoked, and authenticated/service-role execution explicitly granted. Every user-facing RPC performs database authorization checks in its body.

Storage INSERT is constrained to a server-allocated path belonging to the currently authenticated verified Advisor and a still-pending Session 4 intake. Storage SELECT is limited to the owning active/verified Advisor or active Admin.

There is no Storage UPDATE/DELETE policy for the evidence bucket and no direct authenticated DML grant on the evidence/history metadata tables.

## Audit

Evidence submission:

`advisor.authority_evidence.submitted`

Admin request:

`advisor.business_intake.evidence_requested`

Session 5 approval/rejection audit behavior remains unchanged.

## Automated verification

Workflow:

`Advisor Session 6 - Authority Evidence`

Runs:

- `npm ci`
- `npm run qa:advisor-session6`
- Sessions 0–5 regressions
- `npm run qa:release`

Session 6 PostgreSQL coverage includes:

- migrations 1→6 in order;
- Session 4 intake history trigger;
- active/verified Advisor authorization;
- invalid MIME and oversized evidence rejection;
- server-generated Storage allocation;
- wrong Storage path rejection by RLS;
- successful evidence completion and authority document linking;
- evidence completion idempotency;
- Storage UPDATE/DELETE blocked after submission;
- direct evidence-table access blocked;
- Admin v2 queue evidence/history visibility;
- Admin request-more-evidence flow;
- Advisor visibility of that request;
- approval history capture;
- Admin internal note redaction for Advisor;
- evidence upload closes after authority decision;
- Session 5 profile-only acceptance path still works;
- Business remains ownerless/draft/non-public;
- Business RLS policy count remains unchanged;
- no payment order is created;
- anonymous RPC execution remains denied.

## Deferred

Session 6 does not add:

- OCR or automated document authenticity scoring;
- electronic signature validation;
- authority document expiry extraction;
- malware/content scanning pipeline;
- deletion/retention workflow for evidence;
- owner claim/transfer;
- Business content approval/publication;
- Advisor Business editing;
- financial, dataroom, proposal, request, payment or report scopes;
- notification delivery.

A later session can add governed document validation and re-review/expiry workflows before any broader Advisor mutation capability is considered.
