-- Deals68 Advisor/Broker — Session 6 FK coverage.
-- Keep foreign-key lookups for the new authority evidence/review tables indexed
-- without changing any RLS, grants, ownership, publication or Advisor scopes.

create index if not exists advisor_authority_evidence_business_idx
  on public.advisor_authority_evidence(business_id, created_at desc);

create index if not exists advisor_authority_review_business_idx
  on public.advisor_authority_review_events(business_id, created_at asc);

create index if not exists advisor_authority_review_actor_idx
  on public.advisor_authority_review_events(actor_profile_id, created_at asc)
  where actor_profile_id is not null;

create index if not exists advisor_authority_review_evidence_idx
  on public.advisor_authority_review_events(evidence_id, created_at asc)
  where evidence_id is not null;

-- Session 6 boundary remains unchanged: indexes only.