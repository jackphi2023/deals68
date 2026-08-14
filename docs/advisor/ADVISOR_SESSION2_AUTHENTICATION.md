# Advisor/Broker Development — Session 2 Authentication

## Status

- Target branch: `building`
- Public Business/Investor Login change: **none**
- Existing Business registration change: **none**
- Business RLS widening: **none**
- Database migration: `20260806102000_advisor_auth_phase2_v1.sql`
- Purpose: create a separate Advisor/Broker identity, OTP flow and application-status page without granting Business access.

## Routes

Vietnamese:

```text
/advisor/register
/advisor/login
/dashboard/advisor
```

English:

```text
/en/advisor/register
/en/advisor/login
/en/dashboard/advisor
```

Legacy/generic Advisor registration routes redirect to the dedicated form:

```text
/register/advisor → /advisor/register
/en/register/advisor → /en/advisor/register
```

The shared `/login` page remains Business/Investor-only. Admin continues to use `/admin/login`.

## Registration lifecycle

```text
Advisor submits professional application
→ Supabase Auth creates a fresh email/password identity and sends signup OTP
→ d68_create_advisor_signup_v1 validates email, fresh nonce and Advisor signup metadata
→ profiles receives role=advisor, status=pending_admin_review, dashboard_login_enabled=false
→ advisor_profiles receives status=pending, verification_status=pending
→ no Business/payment/authority/assignment row is created
→ user is signed out and sent to the dedicated Advisor OTP page
```

The signup RPC is available to `anon` only because signup OTP mode normally returns no authenticated session before email verification. It is fail-closed through a random nonce, matching email/user ID, Advisor signup metadata, a 30-minute freshness limit, fixed server-side role/status values and constrained payload validation.

## OTP lifecycle

```text
Advisor enters 6-digit signup OTP
→ Supabase verifies the email and creates a session
→ UI re-reads profiles.role from the database
→ d68_mark_advisor_email_verified_v1 verifies auth.uid(), confirmed email and Advisor role
→ dashboard_login_enabled=true
→ account remains pending_admin_review
→ Advisor sees only the application-status page
```

OTP completion does not set Advisor `status=active` or `verification_status=verified`. Only the existing Admin RPC from Session 1 can do that.

## Advisor application data

The form captures:

- Advisor, Broker or Advisor & Broker type;
- full name and account email;
- professional title;
- company/organization and website;
- country and phone;
- professional introduction;
- up to 12 areas of expertise.

All public-facing state remains private and pending until Admin review.

## Security boundaries

Session 2 does not:

- create a Business profile;
- create a payment order;
- create listing authority;
- create or accept an Advisor assignment;
- connect `d68_private.can_manage_business` to Business RLS;
- read Business records from Advisor pages;
- expose client portfolio/context switching;
- allow Advisor self-activation or self-verification;
- allow a Business/Investor account to enter the Advisor dashboard.

## Audit

Session 2 records idempotent audit events:

```text
advisor.registration.submitted
advisor.email.verified
```

The authenticated actor remains the real Advisor account; no impersonation is used.

## Automated verification

The Session 2 workflow runs:

```text
npm ci
npm run qa:advisor-session2
npm run qa:advisor-session0
npm run qa:advisor-session1
npm run qa:release
```

Coverage includes:

- static route/RPC/security contracts;
- PGlite execution of Session 1 followed by Session 2 migrations;
- fresh anonymous signup RPC;
- fixed pending roles and states;
- direct Advisor-table write rejection;
- rejection before email confirmation;
- OTP completion without Admin activation;
- function privilege verification;
- audit verification;
- zero Business/payment/authority/assignment side effects;
- unchanged Business RLS count;
- production TypeScript/Vite build and existing release regression.

## Deferred to Session 3

- Advisor portfolio of assigned Businesses;
- read-only Business context switching;
- assignment acceptance UI;
- scoped Business reads;
- shared Business workspace adapter.
