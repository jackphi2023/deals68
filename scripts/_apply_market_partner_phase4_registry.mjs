#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  '20260727110000_market_partner_affiliate_phase3_referral_v1.sql',
];`,
  `  '20260727110000_market_partner_affiliate_phase3_referral_v1.sql',
  '20260727113000_market_partner_affiliate_phase4_checkout_v1.sql',
];`,
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  `  {
    name: '20260727110000_market_partner_affiliate_phase3_referral_v1.sql',
    snippets: [
      'create or replace function public.d68_attach_affiliate_attribution_from_profile',
      "new.role::text not in ('business', 'investor')",
      "mp.status = 'active'",
      "clicked_at >= now() - interval '30 days'",
      'if v_requested_click_id is null then',
      'if v_click_id is null then',
      'on conflict (subject_profile_id) do nothing',
      'create trigger d68_profiles_attach_affiliate_attribution',
      'never creates commission or changes payment',
    ],
  },
];`,
  `  {
    name: '20260727110000_market_partner_affiliate_phase3_referral_v1.sql',
    snippets: [
      'create or replace function public.d68_attach_affiliate_attribution_from_profile',
      "new.role::text not in ('business', 'investor')",
      "mp.status = 'active'",
      "clicked_at >= now() - interval '30 days'",
      'if v_requested_click_id is null then',
      'if v_click_id is null then',
      'on conflict (subject_profile_id) do nothing',
      'create trigger d68_profiles_attach_affiliate_attribution',
      'never creates commission or changes payment',
    ],
  },
  {
    name: '20260727113000_market_partner_affiliate_phase4_checkout_v1.sql',
    snippets: [
      "commission_basis_currency text not null default 'VND'",
      'commission_tier_1_max numeric(20,2) not null default 20000000',
      'commission_tier_2_max numeric(20,2) not null default 50000000',
      'commission_tier_1_pct numeric(5,2) not null default 40',
      'commission_tier_2_pct numeric(5,2) not null default 50',
      'commission_tier_3_pct numeric(5,2) not null default 60',
      'create or replace function public.d68_admin_update_market_partner_commercial_policy',
      'create or replace function public.d68_get_affiliate_checkout_quote',
      'create or replace function public.d68_affiliate_commission_pct_for_net_paid',
      'Promo code cannot be combined with a Market Partner code',
      "'calculation_basis', 'net_paid_amount'",
      'No automatic commission trigger is installed in Phase 4',
    ],
  },
];`,
);

replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  `- \`20260727110000_market_partner_affiliate_phase3_referral_v1.sql\` — Market Partner/Affiliate Phase 3 source only; creates server-side Business/Investor signup attribution only when a matching active Partner click exists within 30 days. It does not change payment, discount or commission. **Not applied to production.**
`,
  `- \`20260727110000_market_partner_affiliate_phase3_referral_v1.sql\` — Market Partner/Affiliate Phase 3 source only; creates server-side Business/Investor signup attribution only when a matching active Partner click exists within 30 days. It does not change payment, discount or commission. **Not applied to production.**
- \`20260727113000_market_partner_affiliate_phase4_checkout_v1.sql\` — Market Partner/Affiliate Phase 4 source only; adds per-Partner X discount and three-tier Y policy, server-side package/term/affiliate repricing, private affiliate payment snapshots and explicit promo non-stacking. It installs no automatic payment/commission trigger. **Not applied to production.**
`,
);

console.log('✓ Phase 4 migration registry applicator completed.');
