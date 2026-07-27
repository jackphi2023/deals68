#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

const migrationPath = fs.readdirSync('supabase/migrations')
  .map((name) => `supabase/migrations/${name}`)
  .find((name) => name.endsWith('_market_partner_affiliate_phase5_commission_payout_v1.sql'));
if (!migrationPath) throw new Error('Phase 5 migration not found');

replaceOnce(
  migrationPath,
  `create or replace function public.d68_claim_market_partner_signup(
`,
  `create or replace function public.d68_can_claim_market_partner_account(
  p_email text,
  p_affiliate_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text := public.d68_normalize_affiliate_code(p_affiliate_code);
begin
  if v_email = '' or position('@' in v_email) <= 1 or v_code is null then
    return false;
  end if;

  return exists (
    select 1
    from public.market_partners mp
    where lower(mp.contact_email) = v_email
      and mp.affiliate_code = v_code
      and mp.status = 'active'
      and mp.profile_id is null
  )
  and not exists (
    select 1 from public.profiles p where lower(coalesce(p.email, '')) = v_email
  )
  and not exists (
    select 1 from auth.users u where lower(coalesce(u.email, '')) = v_email
  );
end;
$$;

create or replace function public.d68_claim_market_partner_signup(
`,
);

replaceOnce(
  migrationPath,
  `revoke all on function public.d68_claim_market_partner_signup(uuid, text, text, text) from public, anon, authenticated;
`,
  `revoke all on function public.d68_can_claim_market_partner_account(text, text) from public, anon, authenticated;
revoke all on function public.d68_claim_market_partner_signup(uuid, text, text, text) from public, anon, authenticated;
`,
);

replaceOnce(
  migrationPath,
  `grant execute on function public.d68_claim_market_partner_signup(uuid, text, text, text) to anon, authenticated, service_role;
`,
  `grant execute on function public.d68_can_claim_market_partner_account(text, text) to anon, authenticated, service_role;
grant execute on function public.d68_claim_market_partner_signup(uuid, text, text, text) to anon, authenticated, service_role;
`,
);

replaceOnce(
  migrationPath,
  `comment on function public.d68_claim_market_partner_signup(uuid, text, text, text) is
`,
  `comment on function public.d68_can_claim_market_partner_account(text, text) is
  'Generic Partner activation preflight. Returns only true/false for an exact active unclaimed email/code pair and prevents creating an orphan Auth account.';
comment on function public.d68_claim_market_partner_signup(uuid, text, text, text) is
`,
);

replaceOnce(
  'src/pages/MarketPartnerLogin.tsx',
  `    const nonce = activationNonce();
    const { data, error: signupError } = await supabase.auth.signUp({
`,
  `    const { data: canClaim, error: preflightError } = await supabase.rpc(
      'd68_can_claim_market_partner_account',
      { p_email: cleanEmail, p_affiliate_code: cleanCode },
    );
    if (preflightError || canClaim !== true) {
      throw new Error('Email hoặc mã affiliate không khớp hồ sơ Partner đang hoạt động, hoặc tài khoản đã được kích hoạt.');
    }

    const nonce = activationNonce();
    const { data, error: signupError } = await supabase.auth.signUp({
`,
);

replaceOnce(
  'scripts/qa-market-partner-phase5.mjs',
  `  'policy_snapshot jsonb',
  'd68_claim_market_partner_signup',
`,
  `  'policy_snapshot jsonb',
  'd68_can_claim_market_partner_account',
  'd68_claim_market_partner_signup',
`,
);

replaceOnce(
  'scripts/qa-market-partner-phase5.mjs',
  `  'market_partner_affiliate_code',
  'd68_claim_market_partner_signup',
  "type: 'signup'",
`,
  `  'market_partner_affiliate_code',
  'd68_can_claim_market_partner_account',
  'd68_claim_market_partner_signup',
  "type: 'signup'",
`,
);

replaceOnce(
  'scripts/qa-market-partner-phase5.mjs',
  `  const activationNonce = 'phase5-activation-nonce-123456789012345678';
  await db.exec(\`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('\${claimUserId}','claim@example.com',now(),jsonb_build_object('role','market_partner','market_partner_activation_nonce','\${activationNonce}','market_partner_affiliate_code','CLAIM-P5'));\`);
`,
  `  const preflight = await db.query(\`select public.d68_can_claim_market_partner_account('claim@example.com','CLAIM-P5') as allowed;\`);
  assert.equal(preflight.rows[0].allowed, true);
  assert.equal((await db.query(\`select public.d68_can_claim_market_partner_account('claim@example.com','WRONG-P5') as allowed;\`)).rows[0].allowed, false);
  const activationNonce = 'phase5-activation-nonce-123456789012345678';
  await db.exec(\`insert into auth.users(id,email,created_at,raw_user_meta_data) values ('\${claimUserId}','claim@example.com',now(),jsonb_build_object('role','market_partner','market_partner_activation_nonce','\${activationNonce}','market_partner_affiliate_code','CLAIM-P5'));\`);
  assert.equal((await db.query(\`select public.d68_can_claim_market_partner_account('claim@example.com','CLAIM-P5') as allowed;\`)).rows[0].allowed, false);
`,
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `      'create or replace function public.d68_claim_market_partner_signup',
`,
  `      'create or replace function public.d68_can_claim_market_partner_account',
      'create or replace function public.d68_claim_market_partner_signup',
`,
);

replaceOnce(
  'docs/release/MARKET_PARTNER_PHASE5_RELEASE.md',
  `2. Partner claims the account with the exact approved email and affiliate code, then verifies email OTP.
`,
  `2. A generic preflight validates the exact active, unclaimed email/code pair before Auth signup; Partner then claims the account and verifies email OTP.
`,
);

console.log('✓ Partner activation preflight hardening applied.');
