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
  "investment_appetite_en": "...",
  "riskAppetite": "balanced",
  "returnExpectation": 15,
  "cover_image_url": "https://...",
  "cover_image_path": "investor-covers/..."
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
6. A Vietnamese registration writes only `desc_vi` and `investment_appetite_vi`; the EN pair remains empty. An English registration does the inverse. The frontend does not translate or copy into a shared legacy appetite field.

## Dashboard flow

1. MAIN Dashboard menu, icons, route and layout remain unchanged.
2. Private name and private website can update immediately.
3. Criteria, Introduction and Investment appetite are submitted through `update_my_investor_profile`.
4. Investor type, stage, industries, deal types, target markets, ticket size, risk appetite, expected return and revenue band save immediately.
5. Only `desc_vi/desc_en` and `investment_appetite_vi/investment_appetite_en` are stored in `privacy.pending_profile_changes`.
6. The currently approved Introduction and Investment appetite remain public until Admin approval.
7. Dashboard shows a pending-review alert after submission.

## Admin flow

1. Existing Admin Investors list/filter shell remains in use.
2. New or changed profiles are sorted into the review queue.
3. Admin sees approved values and pending values with labels.
4. Admin can edit the proposed public values before approval.
5. `admin_update_investor_profile` validates and publishes the reviewed bilingual appetite; its approval action also clears and publishes pending Introduction when selected.
6. Admin contact fields remain private and are not exposed by public queries.
7. Dashboard and Admin always expose independent VN and EN fields for both Introduction and Investment appetite.
8. Risk appetite and expected return remain empty until explicitly entered; empty values are not rendered on the public detail page.
9. Admin can upload one approved Investor-specific cover. Its URL is stored in approved `criteria`, so later changes to the shared default cover do not replace it.

## Public and filters

1. Public Detail/List read approved data only.
2. Legacy records are normalized at read time.
3. A filter matches when any approved array value matches.
4. Proposal quota, duplicate state, contact unlock, proposal history and SEO routes remain unchanged.
5. Investor Detail selects the field matching the route language, then falls back only to the other language field when the selected field is blank. Labels and surrounding UI always remain in the route language.
6. Risk appetite labels are localized on display. Expected return is formatted with `%/năm` on VN routes and `%/year` on EN routes.
7. Public cover resolution order is: approved Investor cover → active shared default cover → repository fallback image.

## ID contract

- New ID format: `INV-XXXXXX`.
- Database trigger fills null, blank or `INV-NEW-*` codes.
- Unique index remains authoritative.
- Existing non-placeholder codes remain stable to avoid broken public links.

## Database rollout

The migration file is idempotent in intent but must first be tested with the repository PGlite fixture or another disposable local PostgreSQL database.
Do not apply it to production before:

- TypeScript production build passes.
- Static scope/contract checks pass.
- SQL function definitions are reviewed against the live schema.
- Register, Dashboard, Admin and public QA pass on `building`.
- A rollback snapshot/backup is confirmed.
