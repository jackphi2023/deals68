# Advisor/Broker Development — Session 1 Assignment Security

## Status

- Target branch: `building`
- Business runtime UI change: **none**
- Existing Business RLS widening: **none**
- Database migration: `20260806093000_advisor_assignment_security_phase1_v1.sql`
- Purpose: make Advisor delegation explicit, scoped, auditable and safe before any Advisor UI receives Business access.

## Security problem fixed

The legacy placeholder policy allowed an authenticated user to insert or update `advisor_assignments` when `profile_id = auth.uid()`. If Business RLS later trusted those rows, a user could attach themselves to an arbitrary `business_id` and escalate privileges.

Session 1 removes all client-side assignment writes and replaces them with an audited lifecycle:

```text
Admin verifies Advisor profile
→ Admin creates pending assignment
→ Advisor accepts own pending assignment
→ Assignment becomes active
→ Admin may return it to pending, suspend or revoke it
```

## Database model

### `advisor_profiles`

One `profiles.id` maps to one Advisor/Broker profile through a unique, non-null `profile_id`.

New controlled fields include:

- `advisor_type`: `advisor`, `broker`, `advisor_broker`;
- `status`: `pending`, `active`, `suspended`, `rejected`;
- `verification_status`: `pending`, `verified`, `rejected`;
- verification and suspension audit fields;
- JSON metadata constrained to an object.

Legacy `business_id` and `investor_id` columns are retained only for migration compatibility. They never grant access.

### `advisor_assignments`

Each assignment now requires:

- one Advisor `profile_id`;
- one `business_id`;
- one verified `business_listing_authority` row;
- one or more allowed scopes;
- explicit lifecycle timestamps and actors.

Allowed scopes:

```text
profile
files
images
proposals
data_requests
payments
reports
```

A unique `(profile_id, business_id)` index prevents duplicate parallel grants. Revoked or suspended assignments remain as audit history and may only be reset through an Admin RPC.

## Authorization helper

The internal helper:

```text
d68_private.can_manage_business(business_id, required_scope)
```

returns true only for:

1. the actual Business owner;
2. an active Admin;
3. an active, verified Advisor with an accepted, non-expired assignment, matching verified authority and requested permission scope.

The helper is intentionally **not connected to existing Business RLS in Session 1**. Therefore this migration grants no Advisor read/write access to `businesses`, files, images, payments, proposals, requests or reports yet.

## RPC-only lifecycle

Session 1 adds:

```text
d68_admin_set_advisor_profile_status
d68_admin_create_advisor_assignment
d68_accept_advisor_assignment
d68_admin_set_advisor_assignment_status
```

All functions:

- use `SECURITY DEFINER` only where privileged writes are required;
- set an empty `search_path` and schema-qualify relations;
- revoke execution from `PUBLIC` and `anon`;
- validate the authenticated actor internally;
- write `audit_logs` entries for state changes.

Advisor registration/profile creation is deferred to Session 2.

## RLS and grants

The unsafe generic policies are removed.

Authenticated users receive only `SELECT` on Advisor tables:

- Advisor sees their own profile and assignments;
- Business owner sees assignments attached to their own Business;
- Admin sees all;
- no authenticated user receives direct `INSERT`, `UPDATE` or `DELETE` privileges.

An Advisor may read only the authority row linked to their own assignment.

## Verification

Automated checks include:

- static SQL security contract;
- PGlite migration execution;
- direct self-assignment rejection;
- Admin pending assignment creation;
- Advisor acceptance;
- permission-scope enforcement;
- Admin revocation;
- audit event verification;
- Session 0 Business baseline and full release QA.

## Explicit non-goals

Session 1 does not add:

- Advisor registration or login pages;
- Advisor Dashboard;
- Advisor Business creation;
- Business context switching;
- Advisor access in existing Business RLS;
- changes to `/register/business`, Business Login or Business Dashboard;
- changes to `main`.
