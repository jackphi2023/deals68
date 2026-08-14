# Advisor/Broker Development — Session 4 Atomic Business Intake

## Status

- Target branch: `building`
- Main branch change: **none**
- Existing Business RLS policy change: **none**
- Existing Business mutation access for Advisor: **none**
- Database migration: `20260806184000_advisor_business_intake_phase4_v1.sql`
- Purpose: let an active, verified Advisor submit a new Business into Admin review through one atomic, idempotent transaction.

## User flow

```text
Active and verified Advisor
→ opens Business intake form
→ declares Business identity, deal summary and authority details
→ one RPC validates and sanitizes all fields
→ RPC creates an ownerless, non-public Business draft
→ RPC creates pending Advisor/Broker authority
→ RPC creates pending profile-scoped assignment
→ RPC writes an audit event
→ dashboard refreshes portfolio
→ Admin reviews authority
→ only after Admin verification may the existing Session 1 acceptance flow activate access
```

## Atomic records

`d68_create_advisor_business_intake_v1(intake_key, business_payload, authority_payload)` creates exactly:

1. One `businesses` row.
2. One `business_listing_authority` row.
3. One `advisor_assignments` row.
4. One `audit_logs` row.

It creates no:

- `payment_orders`;
- public snapshot;
- Business owner;
- verified authority;
- active assignment;
- file/image records;
- proposal or data request;
- financial access grant.

Any validation or insert failure rolls back the whole transaction.

## Business state

Server-fixed values:

```text
owner_id = null
visible = false
status = draft
moderation_status = pending_admin_review
public_snapshot_json = null
public_version = 0
show_on_homepage = false
revenue_public_visible = false
quota_total = 0
quota_used = 0
revenue / EBITDA / asking amount = 0
financial_input = {}
```

The Advisor payload cannot override these values.

## Authority state

The authority party type is derived from the verified Advisor profile:

- `broker` → `authorized_broker`
- `advisor` or `advisor_broker` → `authorized_advisor`

Server-fixed authority state:

```text
verification_status = pending_review
verified_by = null
verified_at = null
report_policy = admin_only
```

The Advisor cannot set authority verification status.

## Assignment state

Server-fixed assignment state:

```text
profile_id = auth.uid()
status = pending
permissions = [profile]
accepted_at = null
expires_at = null
visibility = private
admin_review_required = true
```

This pending assignment is an intake linkage, not an active permission grant. Existing Session 1 acceptance still requires verified authority and an active, verified Advisor.

## Idempotency and abuse controls

- Client creates a cryptographically random intake key.
- The Advisor profile row is locked during the transaction, serializing concurrent submissions for the same Advisor.
- Replaying the same intake key returns the original IDs without duplicate records.
- A server-side limit blocks more than 10 new Advisor intakes in 24 hours.
- Slug and public code are generated server-side with collision checks.

## Language behavior

The UI writes the title and description only into the current route language:

- Vietnamese route → `title_vi`, `description_vi`
- English route → `title_en`, `description_en`

The other language field remains empty. Session 4 does not auto-translate or duplicate text between language fields.

## UI

The existing Advisor dashboard now contains a collapsible intake form with:

- Business/legal name;
- deal title;
- short description;
- country ISO-2;
- city/province;
- industry;
- deal type;
- declared owner/principal;
- Business/asset address;
- explicit authority confirmation.

After submission, the new pending assignment appears in the Advisor portfolio. It cannot open Business context while authority remains pending.

## Security model

The frontend calls only:

```text
d68_create_advisor_business_intake_v1
```

It does not call:

```text
supabase.from('businesses').insert(...)
supabase.from('businesses').update(...)
d68_admin_create_advisor_assignment(...)
```

The RPC:

- is `SECURITY DEFINER`;
- has `search_path = ''`;
- is executable only by authenticated/service roles;
- checks `auth.uid()` against active database profile records;
- requires active and verified Advisor status;
- uses a fixed field allowlist;
- derives party type from the verified Advisor profile;
- fixes all privilege-bearing states server-side;
- performs no update to existing Business rows;
- changes no Business RLS policy or table grant.

## Automated verification

Workflow:

```text
npm ci
npm run qa:advisor-session4
npm run qa:advisor-session0
npm run qa:advisor-session1
npm run qa:advisor-session2
npm run qa:advisor-session3
npm run qa:release
```

PGlite coverage:

- non-Advisor rejection;
- inactive/unverified Advisor rejection;
- malformed payload rollback;
- atomic creation of four records;
- ownerless and non-public Business state;
- pending and unverified authority;
- pending profile-only assignment;
- zero payment orders;
- idempotent replay;
- broker party-type derivation;
- direct Advisor Business SELECT blocked;
- direct Advisor Business UPDATE blocked;
- anonymous RPC execution blocked;
- unchanged Business policy count.

## Deferred

Session 4 does not enable:

- editing the newly submitted Business;
- editing an existing assigned Business;
- attaching authority documents;
- Admin authority-review UI;
- Business owner claim/transfer;
- payment or listing publication;
- file/image/proposal/data-request/report access;
- scope escalation.

A later session should add the Admin authority-review workflow before any mutation scope is introduced.
