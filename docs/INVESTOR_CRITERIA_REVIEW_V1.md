# Investor Criteria Review V1

## Release strategy

This feature is stacked after PR #28 on branch `feature/investor-criteria-review-v1`.
It must not be merged directly into `main` and must not receive a Netlify feature-branch deployment.
The migration is source-only until the full `building` stack is reviewed and an explicit database rollout is approved.

## Canonical approved model

Approved public criteria live in `investors.criteria`:

```json
{
  "investorTypes": ["Individual/Angel", "VC"],
  "stages": ["Seed", "Growth"],
  "sectors": ["it_software", "healthcare"],
  "dealTypes": ["Investment", "M&A"],
  "targetCountries": ["VN", "SG"],
  "preferredCountries": ["VN", "SG"],
  "targetCountriesCache": ["VN", "SG"],
  "investment_appetite_vi": "...",
  "investment_appetite_en": "..."
}
```

Legacy columns remain mirrors for MAIN compatibility:

- `type` = first approved `investorTypes` value.
- `stage` = first approved `stages` value.
- `industries` = approved `sectors`.
- `deal_types` = approved `dealTypes`.

No public page may read `privacy.pending_profile_changes`.

## Canonical values

### Investor types

- `Individual/Angel`
- `VC`
- `PE`
- `Institutional`
- `Corporate/Strategic`
- `Family Office`
- `Lender/Debt`

### Stages

- `Seed`
- `Series A`
- `Growth`
- `Mature`
- `Buyout`
- `Any`

### Deal types

- `Investment`
- `Lending`
- `M&A`
- `Partnership / JV`

Industries use the existing industry taxonomy keys. Countries use uppercase ISO-2 values.

## Registration flow

1. Investor selects one or more investor types, stages, industries, deal types and target countries.
2. Registration payload stores canonical arrays in `criteria` and mirrors first values into legacy `type` and `stage`.
3. New profiles remain `pending_admin_review` and hidden.
4. Database, not the frontend, allocates the unique `INV-XXXXXX` public code.
5. Existing valid public codes are not renamed by this feature.

## Dashboard flow

1. MAIN Dashboard menu, icons, route and layout remain unchanged.
2. Private name and private website can update immediately.
3. Public criteria, public description and investment appetite are submitted through `update_my_investor_profile`.
4. The RPC stores those fields in `privacy.pending_profile_changes`.
5. Approved public fields remain unchanged until Admin approval.
6. Dashboard shows a pending-review alert after submission.

## Admin flow

1. Existing Admin Investors list/filter shell remains in use.
2. New or changed profiles are sorted into the review queue.
3. Admin sees approved values and pending values with labels.
4. Admin can edit the proposed public values before approval.
5. `admin_approve_investor_profile_changes` validates, normalizes, mirrors legacy fields, clears pending data and optionally publishes.
6. Admin contact fields remain private and are not exposed by public queries.

## Public and filters

1. Public Detail/List read approved data only.
2. Legacy records are normalized at read time.
3. A filter matches when any approved array value matches.
4. Proposal quota, duplicate state, contact unlock, proposal history and SEO routes remain unchanged.

## ID contract

- New ID format: `INV-XXXXXX`.
- Database trigger fills null, blank or `INV-NEW-*` codes.
- Unique index remains authoritative.
- Existing non-placeholder codes remain stable to avoid broken public links.

## Database rollout

The migration file is idempotent in intent but must first be tested on a Supabase development branch or disposable database.
Do not apply it to production before:

- TypeScript production build passes.
- Static scope/contract checks pass.
- SQL function definitions are reviewed against the live schema.
- Register, Dashboard, Admin and public QA pass on `building`.
- A rollback snapshot/backup is confirmed.
