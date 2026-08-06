# Advisor/Broker Development — Session 0 Business Baseline

## Status

- Target branch: `building`
- Runtime change: **none**
- Database migration: **none**
- Production branch `main`: **not changed**
- Purpose: freeze the existing Business workflow before multi-Business Advisor development.

## Why this baseline exists

The current application assumes one Business account owns and opens one Business dashboard. Advisor development will introduce a separate account type that can manage multiple independent Business records. The new capability must not silently change the existing Business owner workflow.

Session 0 therefore adds an executable regression contract around the existing implementation. It does not introduce Advisor registration, Advisor routes, multi-Business queries, RLS changes or database writes.

## Existing Business contracts locked

### 1. Registration

Current Business registration remains at:

```text
/register/business
/en/register/business
```

The Business registration flow must continue to:

- create a Business-role auth/profile path;
- require a Business service plan;
- require a service term;
- require payment acknowledgement for paid Business packages;
- calculate `quota_total` from the selected Business plan;
- create the signup bundle through `create_signup_bundle_v2`;
- queue selected Business assets against the returned `business_id`;
- redirect OTP/login completion to `/dashboard/business`.

### 2. Public login

The existing public login UI remains limited to:

- Business;
- Investor.

Advisor must later receive a separate login route. Session 0 prevents an incomplete Advisor tab from being inserted into the existing Login page.

### 3. Business route and gate

The existing owner dashboard remains:

```text
/dashboard/business
/dashboard/business/*
```

It remains protected by `DashboardGate role="business"`, with Admin override and `dashboard_login_enabled` enforcement.

### 4. One-owner/one-dashboard loader

The current owner contract remains:

```text
getMyBusiness(profile.id)
→ businesses.owner_id = profile.id
→ maybeSingle()
```

Advisor development must not change this helper in place. A later Advisor wrapper must load a Business through a separate assignment-aware service/RPC.

### 5. Business data isolation

The owner dashboard continues to scope these operations to the loaded `business_id`:

- Business files;
- Business images;
- Proposal/data-request relations;
- payment orders;
- financial grants;
- Realtime subscriptions.

### 6. Moderation boundary

Business edits continue to write:

```text
pending_changes_json
pending_submitted_at
pending_submitted_by
moderation_status = pending_admin_review
```

For a profile without a public snapshot, the Business remains hidden and pending review. The owner dashboard must not write an approved public snapshot directly.

### 7. Asset actor and ownership boundary

Existing owner uploads continue to use:

```text
business_id = current Business
owner_id / actor = current Business profile
```

Advisor support must later add explicit delegated permissions and audit fields rather than impersonating the owner.

## Live database read-only findings recorded at Session 0

The connected Deals68 Supabase project was inspected read-only before this baseline was created:

- `user_role` already contains `advisor`;
- `advisor_profiles`, `advisor_assignments` and `business_listing_authority` exist;
- the three Advisor/authority tables currently contain no rows;
- current Business RLS primarily authorizes by `businesses.owner_id = auth.uid()` or Admin;
- current file/image/payment/proposal/request policies are also tied to Business owner identity;
- `business_listing_authority` already supports `authorized_broker` and `authorized_advisor` party types;
- current production data has a maximum of one Business per non-null owner.

These findings confirm that Session 1 must harden delegated assignment permissions before any Advisor UI receives Business write access.

## Files added by Session 0

```text
tests/specs/advisor-session0-business-baseline-contract.json
scripts/deals68-advisor-session0-business-baseline-check.mjs
.github/workflows/advisor-session0-business-baseline.yml
docs/advisor/ADVISOR_SESSION0_BUSINESS_BASELINE.md
```

`package.json` adds:

```text
npm run qa:advisor-session0
```

The same check is included in `qa:release` so future release QA fails when an Advisor change breaks the existing Business contract.

## Acceptance gate for Session 0

Session 0 passes only when:

1. the new contract check passes;
2. the existing production build passes;
3. the existing release QA passes;
4. no runtime source is changed by the Session 0 commit;
5. no migration is added or applied;
6. `building` is updated by fast-forward;
7. `main` remains unchanged.

## Rules for the following sessions

- Do not replace `getMyBusiness()` with a multi-row query.
- Do not let Advisor reuse the Business owner auth identity.
- Do not add Advisor to the existing public Business/Investor login tabs.
- Do not let React insert directly into `advisor_assignments`.
- Do not open Business/file/payment RLS to all authenticated users.
- Do not copy the entire Business Dashboard into a second divergent implementation.
- Add Advisor access through assignment-aware RPC/RLS and a separate wrapper around reusable Business workspace modules.
