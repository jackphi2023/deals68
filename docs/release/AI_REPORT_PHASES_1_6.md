# Deals68 AI Report — Architecture after Phases 1–6

Updated: 2026-07-21

## Product model

One report engine supports two audiences:

- `business_owner`: Business Profile Optimization Report.
- `investor`: Investment Report, added later after relation, e-NDA and scoped Data Room permission checks.

The audience changes access scope, narrative emphasis, watermark and Dashboard entry point. It does not create a second extraction pipeline, duplicate artifact tables or a parallel PDF worker.

## Invariants

1. Every report is source-grounded; unsupported numbers are not introduced.
2. Self-declared values remain separate from document-backed facts.
3. Entity-mismatched and unusable files are excluded.
4. Missing or insufficient broker authority remains non-blocking with a mandatory notice; expired, rejected or mismatched authority may block.
5. Business generation and download each use an independent rolling 60-minute limit.
6. PDF files remain private and downloads use short-lived signed URLs.
7. Every artifact uses `source_label = Deals68 AI Report`.
8. Authorization is enforced by database, RPC and Edge Function; UI states only explain it.

## Phase 1 — Foundation

Created file-processing state, listing-authority state, preflight checks, report alerts, RLS and helper gates. AI does not declare legal authority verified.

## Phase 2 — Evidence and deterministic gates

Added `dataroom_facts`, idempotent generation reservations, data/entity/authority preflight, source snapshots, separate hourly ledgers and advisory-lock concurrency protection. Only completed generation consumes the generation limit.

## Phase 3 — Business Dashboard entry

Added the Business report panel to existing Dashboard routes. It shows readiness, preflight, alerts, authority notice and localized states without replacing the current Dashboard or Data Room page.

## Phase 4 — Admin operations

Added Admin visibility for report readiness, file/entity issues, authority status, alerts and generated artifact metadata while preserving existing Admin moderation flows.

## Phase 5 — Production worker and private PDF

Added `ai_reports`, private Storage, atomic finalize/fail/latest RPCs, the `business-ai-report` Edge Function, deterministic generation with optional OpenAI narrative enrichment, PDF integrity metadata and signed download.

## Phase 6 — Inline viewer and reusable core

Added without a database migration or Edge Function redeploy:

- lazy-loaded inline viewer;
- session-only report-content cache;
- stale detection from source hash, Business update time and latest file update time;
- localized error-code mapping;
- expandable facts with citations and source excerpts;
- included/excluded source manifest;
- shared `ReportAudience`, `ReportContent`, `ReportFreshness`, `ReportSubject` and runtime-adapter contracts.

The viewer reads `content_json` from the existing RLS-protected `ai_reports` row. It cannot create reports or claim downloads.

## Business flow

```text
Business Dashboard
  → status, rates and alerts
  → deterministic preflight
  → generation reservation
  → source snapshot and eligible facts
  → deterministic narrative or optional OpenAI enrichment
  → PDF generation and private upload
  → atomic artifact finalize
  → inline viewer
  → signed PDF download after download claim
```

## Investor extension

Investor should reuse the same content model, viewer, PDF renderer, source rules, private artifact pattern and localized states. Add only Investor-specific gates and scope:

1. `audience = investor`.
2. Approved Business–Investor relation.
3. Signed e-NDA.
4. Active Data Room permission with explicit scope.
5. Scope hash in cache and artifact identity.
6. Only facts and files inside the active scope.
7. Investor watermark and audit event.
8. Separate Investor quota/rate policy.

## Non-conflict design

- Existing Business Dashboard routes are unchanged.
- The existing report panel remains mounted; Phase 6 adds a sibling viewer below it.
- Viewer CSS is scoped under `d68-report-viewer*`, with no global selectors or `!important`.
- Viewer code is lazy-loaded.
- Phase 6 requires no new Supabase schema, Storage policy or production function version.
