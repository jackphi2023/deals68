#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`${path}: expected source fragment not found`);
  }
  const next = source.replace(before, after);
  if (next === source) throw new Error(`${path}: replacement produced no change`);
  fs.writeFileSync(path, next);
}

const migrationName = '20260723183000_investor_plan_entitlements_v1.sql';

fs.writeFileSync('src/lib/investorPlans.ts', `export type InvestorPlan = 'standard' | 'premium';

export type InvestorEntitlement =
  | 'receive_proposals'
  | 'save_businesses'
  | 'express_interest'
  | 'request_documents'
  | 'dataroom_access'
  | 'investment_opportunity_report'
  | 'portfolio_management'
  | 'advanced_analytics';

export const INVESTOR_PREMIUM_MONTHLY_VND = 50_000_000;
export const INVESTOR_PREMIUM_MONTHLY_USD = 2_500;

export const INVESTOR_STANDARD_ENTITLEMENTS: readonly InvestorEntitlement[] = [
  'receive_proposals',
  'save_businesses',
  'express_interest',
  'request_documents',
  'dataroom_access',
];

export const INVESTOR_PREMIUM_ENTITLEMENTS: readonly InvestorEntitlement[] = [
  ...INVESTOR_STANDARD_ENTITLEMENTS,
  'investment_opportunity_report',
  'portfolio_management',
  'advanced_analytics',
];

export function effectiveInvestorPlan(
  investor: {
    plan?: string | null;
    membership_expires_at?: string | null;
  },
  at = Date.now(),
): InvestorPlan {
  if (investor.plan !== 'premium') return 'standard';
  if (!investor.membership_expires_at) return 'premium';
  const expiresAt = new Date(investor.membership_expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt > at ? 'premium' : 'standard';
}

export function investorHasEntitlement(
  investor: {
    plan?: string | null;
    membership_expires_at?: string | null;
  },
  entitlement: InvestorEntitlement,
  at = Date.now(),
) {
  const available = effectiveInvestorPlan(investor, at) === 'premium'
    ? INVESTOR_PREMIUM_ENTITLEMENTS
    : INVESTOR_STANDARD_ENTITLEMENTS;
  return available.includes(entitlement);
}
`);

fs.writeFileSync(`supabase/migrations/${migrationName}`, `-- Deals68 Investor Plan Entitlements — Phase 1.
-- Adds Standard/Premium plan state, server-side entitlement checks, Admin controls,
-- payment-to-Premium synchronization and a canonical Premium price contract.

alter table public.investors
  add column if not exists plan text not null default 'standard';

-- Founder decision: every Investor existing before this migration starts on Standard.
-- Historical payment orders remain intact; stale membership timestamps are removed so
-- they cannot accidentally grant Premium access.
update public.investors
set plan = 'standard',
    membership_started_at = null,
    membership_expires_at = null,
    updated_at = now();

alter table public.investors
  alter column plan set default 'standard',
  alter column plan set not null;

alter table public.investors
  drop constraint if exists investors_plan_check;

alter table public.investors
  add constraint investors_plan_check
  check (plan in ('standard', 'premium'));

create index if not exists investors_plan_expiry_idx
  on public.investors (plan, membership_expires_at);

comment on column public.investors.plan is
  'Investor commercial plan. Standard keeps core marketplace access; Premium unlocks paid analytics entitlements.';
comment on column public.investors.membership_started_at is
  'Premium Investor service start timestamp. Null for Standard or indefinite Premium granted by Admin.';
comment on column public.investors.membership_expires_at is
  'Premium Investor service expiry timestamp. Null means no expiry only when plan is Premium.';

create or replace function public.d68_guard_investor_plan_contract()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  privileged boolean :=
    public.is_admin()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
begin
  if tg_op = 'INSERT' then
    if not privileged then
      new.plan := 'standard';
      new.membership_started_at := null;
      new.membership_expires_at := null;
    end if;
    return new;
  end if;

  if not privileged and (
    new.plan is distinct from old.plan
    or new.membership_started_at is distinct from old.membership_started_at
    or new.membership_expires_at is distinct from old.membership_expires_at
  ) then
    raise exception 'Investor plan changes require Admin, payment confirmation or service role'
      using errcode = '42501';
  end if;

  if privileged then
    -- An explicit downgrade clears Premium dates.
    if new.plan = 'standard' and old.plan is distinct from 'standard' then
      new.membership_started_at := null;
      new.membership_expires_at := null;
    -- Existing payment confirmation writes membership timestamps. Promote the row
    -- atomically even though the legacy payment RPC predates the plan column.
    elsif (
      new.membership_started_at is distinct from old.membership_started_at
      or new.membership_expires_at is distinct from old.membership_expires_at
    ) and (
      new.membership_started_at is not null
      or new.membership_expires_at is not null
    ) then
      new.plan := 'premium';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.d68_guard_investor_plan_contract()
from public, anon, authenticated;

drop trigger if exists investors_plan_contract_insert on public.investors;
create trigger investors_plan_contract_insert
before insert on public.investors
for each row execute function public.d68_guard_investor_plan_contract();

drop trigger if exists investors_plan_contract_update on public.investors;
create trigger investors_plan_contract_update
before update of plan, membership_started_at, membership_expires_at
on public.investors
for each row execute function public.d68_guard_investor_plan_contract();

create or replace function public.d68_get_investor_premium_price(
  p_country_iso2 text default 'VN'
)
returns jsonb
language sql
immutable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'plan', 'premium',
    'billing_period', 'month',
    'currency', case when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 'VND' else 'USD' end,
    'unit_amount', case when upper(trim(coalesce(p_country_iso2, 'VN'))) = 'VN' then 50000000 else 2500 end
  );
$$;

revoke all on function public.d68_get_investor_premium_price(text)
from public;
grant execute on function public.d68_get_investor_premium_price(text)
to anon, authenticated, service_role;

create or replace function public.d68_get_investor_plan_snapshot(
  p_investor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  investor_row public.investors%rowtype;
  premium_active boolean;
begin
  select *
  into investor_row
  from public.investors
  where id = p_investor_id;

  if not found then
    raise exception 'Investor not found' using errcode = 'P0002';
  end if;

  if not (
    investor_row.owner_id = auth.uid()
    or public.is_admin()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  ) then
    raise exception 'Investor plan access denied' using errcode = '42501';
  end if;

  premium_active :=
    investor_row.plan = 'premium'
    and (
      investor_row.membership_expires_at is null
      or investor_row.membership_expires_at > now()
    );

  return jsonb_build_object(
    'investor_id', investor_row.id,
    'stored_plan', investor_row.plan,
    'effective_plan', case when premium_active then 'premium' else 'standard' end,
    'premium_active', premium_active,
    'membership_started_at', investor_row.membership_started_at,
    'membership_expires_at', investor_row.membership_expires_at,
    'entitlements', jsonb_build_object(
      'receive_proposals', true,
      'save_businesses', true,
      'express_interest', true,
      'request_documents', true,
      'dataroom_access', true,
      'investment_opportunity_report', premium_active,
      'portfolio_management', premium_active,
      'advanced_analytics', premium_active
    )
  );
end;
$$;

revoke all on function public.d68_get_investor_plan_snapshot(uuid)
from public, anon;
grant execute on function public.d68_get_investor_plan_snapshot(uuid)
to authenticated, service_role;

create or replace function public.d68_investor_has_entitlement(
  p_investor_id uuid,
  p_entitlement_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  entitlement_key text := lower(trim(coalesce(p_entitlement_key, '')));
begin
  snapshot := public.d68_get_investor_plan_snapshot(p_investor_id);

  if entitlement_key not in (
    'receive_proposals',
    'save_businesses',
    'express_interest',
    'request_documents',
    'dataroom_access',
    'investment_opportunity_report',
    'portfolio_management',
    'advanced_analytics'
  ) then
    return false;
  end if;

  return coalesce((snapshot -> 'entitlements' ->> entitlement_key)::boolean, false);
end;
$$;

revoke all on function public.d68_investor_has_entitlement(uuid, text)
from public, anon;
grant execute on function public.d68_investor_has_entitlement(uuid, text)
to authenticated, service_role;

create or replace function public.admin_set_investor_plan(
  p_investor_id uuid,
  p_plan text,
  p_started_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  investor_row public.investors%rowtype;
  normalized_plan text := lower(trim(coalesce(p_plan, '')));
  effective_started_at timestamptz;
  actor_uuid uuid := auth.uid();
  result_value jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if normalized_plan not in ('standard', 'premium') then
    raise exception 'Unsupported Investor plan: %', normalized_plan;
  end if;

  select *
  into investor_row
  from public.investors
  where id = p_investor_id
  for update;

  if not found then
    raise exception 'Investor not found' using errcode = 'P0002';
  end if;

  if normalized_plan = 'premium' then
    effective_started_at := coalesce(p_started_at, now());
    if p_expires_at is not null and p_expires_at <= effective_started_at then
      raise exception 'Premium expiry must be later than its start time';
    end if;

    update public.investors
    set plan = 'premium',
        membership_started_at = effective_started_at,
        membership_expires_at = p_expires_at,
        updated_at = now()
    where id = p_investor_id;
  else
    update public.investors
    set plan = 'standard',
        membership_started_at = null,
        membership_expires_at = null,
        updated_at = now()
    where id = p_investor_id;
  end if;

  result_value := public.d68_get_investor_plan_snapshot(p_investor_id);

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_uuid,
    'admin_set_investor_plan',
    'investor',
    p_investor_id,
    jsonb_build_object(
      'old_plan', investor_row.plan,
      'new_plan', normalized_plan,
      'old_membership_started_at', investor_row.membership_started_at,
      'old_membership_expires_at', investor_row.membership_expires_at,
      'new_membership_started_at', result_value ->> 'membership_started_at',
      'new_membership_expires_at', result_value ->> 'membership_expires_at',
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'source', 'admin'
    )
  );

  return result_value;
end;
$$;

revoke all on function public.admin_set_investor_plan(uuid, text, timestamptz, timestamptz, text)
from public, anon;
grant execute on function public.admin_set_investor_plan(uuid, text, timestamptz, timestamptz, text)
to authenticated;

comment on function public.d68_investor_has_entitlement(uuid, text) is
  'Checks package entitlement only. eNDA, Dataroom grants and Business-specific access remain separate mandatory gates.';
comment on function public.admin_set_investor_plan(uuid, text, timestamptz, timestamptz, text) is
  'Admin-only audited Standard/Premium assignment. Premium may have an expiry or be indefinite.';
`);

fs.writeFileSync('scripts/deals68-investor-plan-entitlements-check.mjs', `#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const migrationPath = 'supabase/migrations/${migrationName}';
const migration = fs.readFileSync(migrationPath, 'utf8');
const planSource = fs.readFileSync('src/lib/investorPlans.ts', 'utf8');
const pricingSource = fs.readFileSync('src/lib/pricing.ts', 'utf8');
const pricingPage = fs.readFileSync('src/pages/Pricing.tsx', 'utf8');

function requireSnippet(label, source, snippet) {
  if (!source.includes(snippet)) failures.push(label + ': missing ' + snippet);
}

[
  "add column if not exists plan text not null default 'standard'",
  "set plan = 'standard'",
  'membership_started_at = null',
  'membership_expires_at = null',
  'constraint investors_plan_check',
  'create or replace function public.d68_guard_investor_plan_contract',
  'create or replace function public.d68_get_investor_plan_snapshot',
  'create or replace function public.d68_investor_has_entitlement',
  'create or replace function public.admin_set_investor_plan',
  'investors_plan_contract_insert',
  'investors_plan_contract_update',
  'Investor plan changes require Admin, payment confirmation or service role',
  'then 50000000 else 2500 end',
  'to authenticated, service_role',
].forEach((snippet) => requireSnippet('migration', migration, snippet));

requireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_VND = 50_000_000');
requireSnippet('plan constants', planSource, 'INVESTOR_PREMIUM_MONTHLY_USD = 2_500');
requireSnippet('plan constants', planSource, "'investment_opportunity_report'");
requireSnippet('pricing core', pricingSource, 'INVESTOR_PREMIUM_MONTHLY_VND');
requireSnippet('pricing core', pricingSource, "role === 'investor'");
requireSnippet('pricing page', pricingPage, 'INVESTOR_PREMIUM_MONTHLY_VND');
requireSnippet('pricing page', pricingPage, "'Nhà đầu tư Nâng cao'");
requireSnippet('pricing page', pricingPage, "investorPlan: role === 'investor' ? 'premium' : undefined");

if (pricingSource.includes("role === 'business' ? (currency === 'VND' ? 500_000 : 20) : (currency === 'VND' ? 1_000_000 : 50)")) {
  failures.push('pricing core still uses the legacy generic Investor rate');
}
if (pricingPage.includes("investor: { unitVi: 'tháng', unitEn: 'month', vn: 1_000_000, other: 50")) {
  failures.push('Pricing page still uses the legacy Investor rate');
}

if (failures.length) {
  console.error('✗ Investor plan entitlement Phase 1 check failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}

console.log('✓ Investor plan entitlement Phase 1 check: PASS');
`);

replaceOnce(
  'src/lib/pricing.ts',
  "import { BUSINESS_FEATURED_PROPOSAL_QUOTA, BUSINESS_STANDARD_PROPOSAL_QUOTA } from './businessPlans';\n",
  "import { BUSINESS_FEATURED_PROPOSAL_QUOTA, BUSINESS_STANDARD_PROPOSAL_QUOTA } from './businessPlans';\nimport { INVESTOR_PREMIUM_MONTHLY_USD, INVESTOR_PREMIUM_MONTHLY_VND } from './investorPlans';\n",
);
replaceOnce(
  'src/lib/pricing.ts',
  "  const baseWeekly = role === 'business' ? (currency === 'VND' ? 500_000 : 20) : (currency === 'VND' ? 1_000_000 : 50);",
  "  const baseWeekly = role === 'business'\n    ? (currency === 'VND' ? 500_000 : 20)\n    : role === 'investor'\n      ? (currency === 'VND' ? INVESTOR_PREMIUM_MONTHLY_VND : INVESTOR_PREMIUM_MONTHLY_USD)\n      : (currency === 'VND' ? 1_000_000 : 50);",
);
replaceOnce(
  'src/lib/pricing.ts',
  "    planLabel: role === 'business' && businessPlan === 'featured' ? 'Featured' : 'Standard',",
  "    planLabel: role === 'business' && businessPlan === 'featured'\n      ? 'Featured'\n      : role === 'investor'\n        ? 'Premium'\n        : 'Standard',",
);
replaceOnce(
  'src/lib/pricing.ts',
  "      role === 'business' && businessPlan === 'featured' ? `Featured visibility, ${BUSINESS_FEATURED_PROPOSAL_QUOTA} proposal quota, higher ranking.` : role === 'business' ? `Standard visibility, ${BUSINESS_STANDARD_PROPOSAL_QUOTA} proposal quota.` : 'Membership access is activated after payment/admin approval.',",
  "      role === 'business' && businessPlan === 'featured' ? `Featured visibility, ${BUSINESS_FEATURED_PROPOSAL_QUOTA} proposal quota, higher ranking.` : role === 'business' ? `Standard visibility, ${BUSINESS_STANDARD_PROPOSAL_QUOTA} proposal quota.` : role === 'investor' ? 'Premium Investor access is activated after payment or Admin approval.' : 'Membership access is activated after payment/admin approval.',",
);

replaceOnce(
  'src/pages/Pricing.tsx',
  "import { toLocalizedPath } from '../lib/i18nRoutes';\n",
  "import { toLocalizedPath } from '../lib/i18nRoutes';\nimport { INVESTOR_PREMIUM_MONTHLY_USD, INVESTOR_PREMIUM_MONTHLY_VND } from '../lib/investorPlans';\n",
);
replaceOnce(
  'src/pages/Pricing.tsx',
  "  investor: { unitVi: 'tháng', unitEn: 'month', vn: 1_000_000, other: 50, min: 4, terms: [4, 8, 12, 16, 24], disc: (u: number) => u >= 16 ? 20 : u >= 8 ? 15 : 0 },",
  "  investor: { unitVi: 'tháng', unitEn: 'month', vn: INVESTOR_PREMIUM_MONTHLY_VND, other: INVESTOR_PREMIUM_MONTHLY_USD, min: 4, terms: [4, 8, 12, 16, 24], disc: (u: number) => u >= 16 ? 20 : u >= 8 ? 15 : 0 },",
);
replaceOnce(
  'src/pages/Pricing.tsx',
  "  const planName = role === 'business'\n    ? (bizPlan === 'featured'\n      ? T(lang, 'Gói Ưu tiên', 'Priority package')\n      : T(lang, 'Gói Thường', 'Regular package'))\n    : roleLabel(lang, role);",
  "  const planName = role === 'business'\n    ? (bizPlan === 'featured'\n      ? T(lang, 'Gói Ưu tiên', 'Priority package')\n      : T(lang, 'Gói Thường', 'Regular package'))\n    : role === 'investor'\n      ? T(lang, 'Nhà đầu tư Nâng cao', 'Premium Investor')\n      : roleLabel(lang, role);",
);
replaceOnce(
  'src/pages/Pricing.tsx',
  "      titleVi: 'Nhà đầu tư',\n      titleEn: 'Investor',\n      descVi: 'Tìm doanh nghiệp phù hợp, lưu deal và gửi yêu cầu kết nối/data room.',\n      descEn: 'Find matching businesses, save deals and request connection/data room.',",
  "      titleVi: 'Nhà đầu tư Nâng cao',\n      titleEn: 'Premium Investor',\n      descVi: 'Toàn bộ quyền kết nối của Nhà đầu tư Tiêu chuẩn, cộng Báo cáo Phân tích cơ hội đầu tư và các tính năng nâng cao.',\n      descEn: 'All Standard Investor connection rights, plus Investment Opportunity Reports and advanced features.',",
);
replaceOnce(
  'src/pages/Pricing.tsx',
  "        T(lang, 'Xem Báo cáo Phân tích đầu tư', 'View Investment Analysis Report'),",
  "        T(lang, 'Tạo Báo cáo Phân tích cơ hội đầu tư', 'Generate Investment Opportunity Reports'),",
);
replaceOnce(
  'src/pages/Pricing.tsx',
  "      businessPlan: bizPlan,\n      promoCode:",
  "      businessPlan: bizPlan,\n      investorPlan: role === 'investor' ? 'premium' : undefined,\n      promoCode:",
);
replaceOnce(
  'src/pages/Pricing.tsx',
  "Doanh nghiệp trả phí hiển thị theo tuần; Nhà đầu tư & Cố vấn trả phí thành viên theo tháng. Kỳ hạn dài hơn — giảm giá nhiều hơn.",
  "Doanh nghiệp trả phí hiển thị theo tuần; Nhà đầu tư Nâng cao và Cố vấn trả phí theo tháng. Kỳ hạn dài hơn — giảm giá nhiều hơn.",
);
replaceOnce(
  'src/pages/Pricing.tsx',
  "Businesses pay a weekly listing fee; Investors & Advisors pay a monthly membership. Longer terms mean bigger discounts.",
  "Businesses pay a weekly listing fee; Premium Investors and Advisors pay monthly. Longer terms mean bigger discounts.",
);

replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  "| 20260721121832 | `20260721121832_ai_report_phase5_worker_artifact_v1.sql` |",
  "| 20260721121832 | `20260721121832_ai_report_phase5_worker_artifact_v1.sql` |\n| 20260723183000 | `20260723183000_investor_plan_entitlements_v1.sql` |",
);
replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  "- `20260721121832_ai_report_phase5_worker_artifact_v1.sql` — additive Phase 5 artifact foundation applied to production; creates the private `business-reports-private` bucket, atomic `ai_reports` storage, service-role finalize/fail RPCs and safe latest-report metadata for Business. Every PDF and artifact is constrained to `source_label = \"Deals68 AI Report\"`; private storage paths are not exposed to Business clients.",
  "- `20260721121832_ai_report_phase5_worker_artifact_v1.sql` — additive Phase 5 artifact foundation applied to production; creates the private `business-reports-private` bucket, atomic `ai_reports` storage, service-role finalize/fail RPCs and safe latest-report metadata for Business. Every PDF and artifact is constrained to `source_label = \"Deals68 AI Report\"`; private storage paths are not exposed to Business clients.\n- `20260723183000_investor_plan_entitlements_v1.sql` — Investor Plan Phase 1; backfills every existing Investor to Standard, protects plan fields from client-side mutation, promotes confirmed paid membership to Premium, provides audited Admin assignment and server-side entitlement/price contracts. Premium pricing is 50,000,000 VND/month in Vietnam and 2,500 USD/month elsewhere.",
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  "  '20260721121832_ai_report_phase5_worker_artifact_v1.sql',\n];",
  "  '20260721121832_ai_report_phase5_worker_artifact_v1.sql',\n  '${migrationName}',\n];",
);
replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  "  {\n    name: '20260721121832_ai_report_phase5_worker_artifact_v1.sql',\n    snippets: [\n      'create table if not exists public.ai_reports',\n      \"source_label text not null default 'Deals68 AI Report'\",\n      \"constraint ai_reports_source_label_check check (source_label = 'Deals68 AI Report')\",\n      \"'business-reports-private'\",\n      'create or replace function public.d68_finalize_business_report',\n      'create or replace function public.d68_fail_business_report_request',\n      'create or replace function public.d68_get_latest_business_report',\n      'to service_role',\n      'no private storage path is exposed',\n    ],\n  },\n];",
  "  {\n    name: '20260721121832_ai_report_phase5_worker_artifact_v1.sql',\n    snippets: [\n      'create table if not exists public.ai_reports',\n      \"source_label text not null default 'Deals68 AI Report'\",\n      \"constraint ai_reports_source_label_check check (source_label = 'Deals68 AI Report')\",\n      \"'business-reports-private'\",\n      'create or replace function public.d68_finalize_business_report',\n      'create or replace function public.d68_fail_business_report_request',\n      'create or replace function public.d68_get_latest_business_report',\n      'to service_role',\n      'no private storage path is exposed',\n    ],\n  },\n  {\n    name: '${migrationName}',\n    snippets: [\n      \"add column if not exists plan text not null default 'standard'\",\n      \"set plan = 'standard'\",\n      'create or replace function public.d68_guard_investor_plan_contract',\n      'create or replace function public.d68_get_investor_plan_snapshot',\n      'create or replace function public.d68_investor_has_entitlement',\n      'create or replace function public.admin_set_investor_plan',\n      'then 50000000 else 2500 end',\n    ],\n  },\n];",
);

replaceOnce(
  'scripts/deals68-package-checks.mjs',
  "  'scripts/deals68-session8-final-regression-check.mjs',\n];",
  "  'scripts/deals68-session8-final-regression-check.mjs',\n  'scripts/deals68-investor-plan-entitlements-check.mjs',\n];",
);
replaceOnce(
  'package.json',
  '    "qa:business-report-phase6": "node scripts/deals68-business-report-phase6-check.mjs"\n',
  '    "qa:business-report-phase6": "node scripts/deals68-business-report-phase6-check.mjs",\n    "qa:investor-plans": "node scripts/deals68-investor-plan-entitlements-check.mjs"\n',
);

console.log('Investor plan entitlement Phase 1 source applied.');
