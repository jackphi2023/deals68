# Deals68 RC1 — Rollback Notes

## Frontend rollback

1. In Netlify, open **Deploys**.
2. Select the last known-good production deploy.
3. Choose **Publish deploy**.
4. In GitHub, revert the RC1 merge commit rather than deleting history.

## Signup compatibility rollback

The Phase A migration keeps signup RPC v1 available during cutover. The v1 RPC is revoked only by the post-main migration.

If production is rolled back after the post-main migration, temporarily restore v1 client access:

```sql
grant execute on function public.create_signup_bundle(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb
) to anon, authenticated;
```

After the v2 frontend is restored, reapply the revoke migration.

## Proposal RPC

The Phase A Proposal RPC keeps the same function name and parameters, so both old and new frontend builds can call it. No rollback should be necessary. Do not restore the direct-insert Proposal policy.

## Storage public URLs

The migration removes broad `storage.objects` listing policies, not the public status of the buckets. If an unexpected legacy client requires listing, investigate and replace it with a constrained server-side query. Avoid restoring broad public listing unless it is an emergency.
