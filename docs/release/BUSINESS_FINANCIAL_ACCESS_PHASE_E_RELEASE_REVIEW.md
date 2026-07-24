# Deals68 — Business Financial Access Phase E Release Review

Date: 2026-07-24 (Asia/Ho_Chi_Minh)

## Executive conclusion

Phase C and D are integrated into building. Phase E is a stabilization release only. It does not add a Dataroom grant workflow, eNDA, payment behavior, Proposal transitions or a new public financial field.

A release blocker was found: approved/connected Proposal state still controlled private Business file metadata and Storage reads, while financial values already used the canonical access-grant ledger. That meant expiry or revocation of a central grant did not necessarily remove document access. This release aligns metadata, table RLS and Storage SELECT with an active, unexpired Business-specific dataroom scope.

The new migration is committed but NOT APPLIED to Supabase production. Production deploy remains blocked until explicit migration approval and authenticated UAT.

## Audited production baseline before source changes

- main and building started identical at 641030f9c8069c0519d052310896017a171bb0ec.
- Phase A/B migration ledger entries: present.
- Public Business rows: 8.
- Exact revenue returned by public_businesses_safe: 0.
- Exact EBITDA returned by public_businesses_safe: 0.
- Active financial grants: 287.
- Active Dataroom grants: 0.
- Open financial requests: 3.
- Business files: 20; approved/public-visible files: 10.
- document_access_grants rows: 0.

Exact financial values remain inside the private businesses.public_snapshot_json source for owner/Admin and the secure summary RPC. This is intentional internal storage, not a public payload: anon has no SELECT on businesses and public_businesses_safe reconstructs a redacted snapshot.

## Phase E source changes

1. File metadata requires owner/Admin/service role or an active, unexpired dataroom scope.
2. business_files SELECT RLS uses the same scope instead of Proposal approved/connected.
3. business-files-private Storage SELECT uses the same scope and file approval state.
4. d68_get_business_dataroom_file_access returns the private path only after server-side authorization and records an audit event.
5. Business Detail no longer infers download access from Proposal status.
6. Private signed URLs expire after 60 seconds.
7. No Dataroom grant is created or backfilled. Current zero-grant production state remains zero after migration.
8. eNDA is not implemented or bypassed. Future Dataroom grant issuance must require the approved eNDA workflow.

## Netlify readiness

Repository configuration remains:

- Build command: npm run build.
- Publish directory: dist.
- SPA redirect: /* to /index.html with status 200.
- SEO Edge Function: seo on /*.
- CSP permits only the existing Supabase, VietQR and first-party resources.

Netlify site-level branch mapping, environment values, Auth Site URL/Redirect URLs and custom domains are not stored in netlify.toml and must be verified in the Netlify/Supabase dashboards without printing secret values. No production setting was changed in Phase E.

## Rollback

Frontend rollback:

1. Revert the Phase E merge commit or deploy the previous building/main commit.
2. The old frontend does not require the new RPC, but it must not be used as a security rollback after the Phase E migration because it again infers document access from Proposal state.

Database rollback strategy:

- The migration is additive/replacement DDL and has no data backfill.
- Preferred incident response is forward-fix or temporarily revoke EXECUTE on d68_get_business_dataroom_file_access and deny private file SELECT.
- Do not restore the legacy Proposal-based Storage policy during a confidentiality incident.
- Because no Dataroom grants are auto-created, applying the migration safely defaults Investor file access to denied.

Verification after rollback or forward-fix:

- anon public_businesses_safe returns NULL exact revenue and EBITDA.
- anon cannot SELECT businesses.
- Investor without dataroom scope receives no file metadata/path.
- expired or revoked dataroom grant receives no file metadata/path.
- owner/Admin retain access.
- audit_logs records successful Dataroom file path access.

## Release blockers and NOT RUN

- New migration NOT APPLIED to production.
- Authenticated end-to-end tests with safe Investor/Business/Admin accounts: NOT RUN unless credentials are supplied through protected CI secrets.
- eNDA and Dataroom grant issuance: outside Phase E and still disabled.
- Netlify production deploy: NOT RUN.
- main merge: NOT RUN.


## Known pre-existing repository gates

The repository-wide qa:packages command fails in deals68-home-investors-hero-ux-check.mjs because its Banner G5 contract expects former Admin/multi-slide implementation tokens. Phase E does not modify Homepage, Banner Admin, SiteBanners, Hero CSS or banner persistence.

The legacy release-static script also reports two existing building baseline contracts: Homepage Business editorial selection and canonical industry taxonomy links/filters. Phase E changes none of Home.tsx, Admin Homepage controls, industry taxonomy or Business listing filters.

The Phase E runner accepts only these exact known baseline failures. Any additional package or release-static failure blocks the release. All three baseline items remain blockers for a production main release and must be reconciled separately.
