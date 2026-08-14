# Advisor/Broker Development — Session 5 Admin Authority Review

## Status

- Target branch: `building`
- Main branch change: **none**
- Existing Business RLS policy change: **none**
- Existing Business ownership/publication change: **none**
- Database migration: `20260806203000_advisor_authority_review_phase5_v1.sql`
- Purpose: allow an active Admin to approve or reject authority declared through Session 4 Business intake, while retaining a profile-only, acceptance-gated Advisor assignment.

## Session 5 boundary

Session 5 reviews the Advisor/Broker authority relationship. It does not approve the Business for public listing and does not create Business ownership.

An intake Business remains:

```text
owner_id = null
visible = false
status = draft
moderation_status = pending_admin_review
```

The only assignment scope permitted in Session 5 is:

```text
profile
```

No file, image, proposal, data-request, payment or report scope is enabled.

## Production compatibility fix

Session 1 installed `d68_private.validate_advisor_assignment()` with a verified-authority requirement on every assignment insert/update.

Session 4 intentionally creates an atomic intake bundle containing:

1. ownerless Business draft;
2. `pending_review` authority;
3. pending, profile-only assignment;
4. audit event.

Without a narrow trigger exception, the Session 4 assignment insert would be blocked on a real database where the Session 1 trigger is present.

Session 5 replaces the trigger function with a fail-closed version:

- normal pending/active/suspended assignments still require verified, unexpired authority;
- exactly a Session 4 intake linkage may exist with pending authority when it is:
  - `status = pending`;
  - `permissions = [profile]`;
  - `visibility = private`;
  - unaccepted;
  - marked `admin_review_required = true`;
- revoked/expired terminal transitions remain possible even when authority is no longer valid, because these states grant no access.

## Admin queue RPC

```text
d68_admin_list_advisor_business_intakes_v1()
```

The RPC:

- requires active Admin status in database records;
- returns only Session 4 intake assignments;
- returns an explicit Business/Advisor/authority/assignment allowlist;
- excludes revenue, EBITDA, valuation, financial input, files, proposals, payments and reports;
- returns an explicit access boundary declaring no Business mutation/publication capability.

Review states:

```text
pending_review
approved_awaiting_acceptance
accepted
rejected
```

## Admin review RPC

```text
d68_admin_review_advisor_business_intake_v1(
  assignment_id,
  decision,
  expires_at,
  permissions,
  note
)
```

The transaction locks:

1. assignment;
2. matching authority;
3. Business intake.

It verifies:

- active Admin actor;
- Session 4 source metadata;
- pending/unaccepted assignment;
- pending-review authority;
- ownerless/non-public/draft Business state;
- active and verified Advisor profile;
- profile-only scope;
- expiry between one hour and 365 days.

## Approval flow

Admin approval:

```text
authority.verification_status = verified
authority.verified_by = Admin
authority.verified_at = now
authority.expires_at = selected expiry
assignment.status = pending
assignment.permissions = [profile]
assignment.granted_by = Admin
assignment.expires_at = selected expiry
assignment.accepted_at = null
```

The assignment intentionally remains pending. Advisor must still use the existing Session 1 acceptance RPC.

Only after acceptance does the existing Session 3 read-only Business context become available.

## Rejection flow

Admin rejection:

```text
authority.verification_status = rejected
assignment.status = revoked
assignment.revoked_by = Admin
assignment.revoked_at = now
assignment.revoke_reason = required Admin reason
```

The Business remains ownerless, draft and non-public. Advisor cannot accept a revoked assignment.

## Audit

Approval writes:

```text
advisor.business_intake.authority_approved
```

Rejection writes:

```text
advisor.business_intake.authority_rejected
```

Audit detail records:

- Business, authority and assignment IDs;
- Advisor profile ID;
- decision;
- scope;
- expiry;
- Admin note;
- confirmation that Business status and visibility remain unchanged.

## Admin UI

Route:

```text
/admin/advisor-intakes
```

Admin navigation label:

```text
Duyệt Advisor intake
```

The page provides:

- pending/approved/accepted/rejected filters;
- Business intake summary;
- Advisor/Broker identity and verification summary;
- declared authority details;
- expiry selection, default 180 days;
- locked profile-only scope;
- Admin note;
- approve/reject controls;
- explicit Business and capability boundary.

Frontend calls only the two Session 5 RPCs. It does not update Business, authority or assignment tables directly.

## Security model

Both public RPCs:

- are `SECURITY DEFINER`;
- have `search_path = ''`;
- revoke default/public/anonymous execution;
- grant execute only to authenticated and service roles;
- enforce active Admin authorization in the function body.

Session 5 creates no Business RLS policies and changes no Business table grants.

## Automated verification

Workflow:

```text
npm ci
npm run qa:advisor-session5
npm run qa:advisor-session0
npm run qa:advisor-session1
npm run qa:advisor-session2
npm run qa:advisor-session3
npm run qa:advisor-session4
npm run qa:release
```

PGlite coverage:

- real Session 1–5 migration sequence;
- Session 4 intake succeeds under the revised trigger;
- non-Admin list/review rejection;
- allowlisted Admin queue;
- invalid scope rejection and rollback;
- excessive expiry rejection and rollback;
- approval verifies authority but leaves assignment pending;
- Advisor acceptance after approval;
- rejection revokes assignment;
- rejected assignment cannot be accepted;
- Business remains ownerless/draft/non-public;
- direct Advisor Business update remains blocked;
- anonymous RPC execution remains blocked;
- Business policy count remains unchanged;
- no payment order is created.

## Deferred

Session 5 does not add:

- authority-document upload or document validation;
- Business owner claim/transfer;
- Business content/public-listing approval;
- Advisor editing of Business fields;
- file/image/proposal/request/payment/report scopes;
- assignment renewal or re-review;
- notification delivery.

A later session may add authority-document evidence and Admin review history before introducing any new scoped mutation capability.
