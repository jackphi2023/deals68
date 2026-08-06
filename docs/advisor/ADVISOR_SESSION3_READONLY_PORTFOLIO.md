# Advisor/Broker Development — Session 3 Read-only Portfolio

## Status

- Target branch: `building`
- Public Business/Investor Login change: **none**
- Business mutation access: **none**
- Existing Business RLS policy change: **none**
- Database migration: `20260806111000_advisor_readonly_portfolio_phase3_v1.sql`
- Purpose: let an active, verified Advisor inspect assigned clients, accept pending assignments and switch among strictly read-only Business contexts.

## User flow

```text
Admin verifies Advisor and creates a pending assignment
→ Advisor signs in through the dedicated Advisor route
→ portfolio RPC returns only that Advisor's assignments
→ Advisor accepts a pending assignment through the audited Session 1 RPC
→ an active, accepted, unexpired assignment with `profile` scope may open Business context
→ Advisor switches context with the `business` query parameter
→ context remains read-only
```

## Dashboard behavior

The existing routes remain:

```text
/dashboard/advisor
/en/dashboard/advisor
```

The dashboard now provides:

- assignment counters;
- active, pending, suspended, revoked and expired states;
- assignment scope chips;
- authority status and expiry awareness;
- an acceptance action for the Advisor's own pending assignment;
- client context switching persisted in the URL query parameter;
- a read-only Business identity/status panel;
- clear boundaries for data and actions not yet enabled.

## RPC surface

### `d68_get_my_advisor_portfolio_v1()`

Returns assignment metadata and a redacted Business summary only when the caller is:

- authenticated;
- `profiles.role = advisor`;
- `profiles.status = active`;
- dashboard-enabled;
- backed by an active and verified `advisor_profiles` record.

Pending assignments do not reveal `company_name_private`. Active accepted assignments may reveal the assigned client's private company name because the Admin-created assignment and verified authority establish the relationship.

### `d68_get_my_advisor_business_context_v1(business_id)`

Requires all of the following:

- active, verified Advisor account;
- the assignment belongs to `auth.uid()`;
- assignment status is active;
- Advisor accepted it;
- assignment has not expired;
- verified, unexpired matching authority;
- explicit `profile` scope;
- `d68_private.can_manage_business(business_id, 'profile') = true`.

The response contains only:

- Business ID, public code and slug;
- private company name for the valid assigned relationship;
- bilingual listing titles;
- industry, country/city and deal type;
- listing/moderation status and visibility;
- image references already stored on the Business row;
- assignment and authority metadata;
- an explicit `read_only` access declaration.

It excludes:

- revenue and EBITDA;
- valuation and asking price;
- `financial_input` and all financial reports;
- private files and images;
- proposals;
- data requests;
- payment orders;
- financial access grants;
- owner contact information.

## Assignment acceptance

Session 3 reuses the audited Session 1 RPC:

```text
d68_accept_advisor_assignment(assignment_id)
```

The Advisor can accept only their own pending assignment. The RPC revalidates Advisor status, verified authority and expiry before activation. Session 3 adds no RPC for assignment creation, scope changes, suspension, revocation or Admin actions.

## Security model

The frontend never performs:

```text
supabase.from('businesses')
```

Advisor Business data is returned only through field-restricted `SECURITY DEFINER` RPCs. Both RPCs:

- use `search_path = ''`;
- revoke default/public and anonymous execution;
- grant execution only to authenticated/service roles;
- check the caller from database tables, not user-editable metadata;
- limit output fields explicitly;
- perform no writes.

Existing Business RLS policies and table grants remain owner/Admin-only. Session 3 does not connect Advisor scopes to direct table access.

## Automated verification

The workflow runs:

```text
npm ci
npm run qa:advisor-session3
npm run qa:advisor-session0
npm run qa:advisor-session1
npm run qa:advisor-session2
npm run qa:release
```

PGlite coverage includes:

- non-Advisor portfolio rejection;
- direct Business SELECT returning no rows;
- pending assignment visibility with private company name redacted;
- pending context rejection;
- audited Advisor acceptance;
- active profile-scoped context success;
- financial and valuation field redaction;
- files-only scope context rejection;
- direct Business UPDATE rejection;
- anonymous RPC denial;
- unchanged Business policy count.

## Deferred

Session 3 does not enable:

- Business profile editing;
- Business creation by Advisor;
- file or image access;
- proposal or data-request operations;
- payment or report access;
- shared Business workspace components;
- scoped Business RLS mutation policies.

A later session should introduce the shared Business workspace adapter and then enable one mutation scope at a time with separate RLS, RPC and regression coverage.
