#!/usr/bin/env node
import fs from 'node:fs';

const component = fs.readFileSync('src/components/admin/InvestorAdminReviewPanel.tsx', 'utf8');
const css = fs.readFileSync('src/styles/pages/admin.css', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260723115526_investor_plan_entitlements_v1.sql', 'utf8');
const failures = [];

function requireSnippet(label, source, snippet) {
  if (!source.includes(snippet)) failures.push(`${label}: missing ${snippet}`);
}

[
  'effectiveInvestorPlan',
  "type InvestorPlanFilter = '' | 'standard' | 'premium' | 'expiring' | 'expired'",
  'Nhà đầu tư Nâng cao / Premium',
  'Quản lý Standard/Premium độc lập với “Ưu tiên Homepage” (admin_priority).',
  "supabase.rpc('admin_set_investor_plan'",
  'p_investor_id: investor.id',
  'Cấp / gia hạn Premium',
  'Thu hồi Premium và chuyển Nhà đầu tư về gói Standard?',
  'Premium sắp hết hạn (30 ngày)',
  'Premium đã hết hạn',
  'Có quyền Báo cáo Phân tích cơ hội đầu tư',
  'Mọi thay đổi được ghi audit bởi RPC Admin.',
  'Mã ưu đãi',
  'Đối tác',
].forEach((snippet) => requireSnippet('component', component, snippet));

[
  '.d68-admin-investor-plan-box',
  '.d68-admin-investor-plan-grid',
  '.d68-admin-investor-plan-stats',
  '.d68-admin-investor-plan-toggle',
].forEach((snippet) => requireSnippet('css', css, snippet));

[
  'create or replace function public.admin_set_investor_plan',
  "'admin_set_investor_plan'",
  "'source', 'admin'",
  'to authenticated',
].forEach((snippet) => requireSnippet('migration', migration, snippet));

if (component.includes("admin_priority: form.get('admin_priority') === 'on',\n      plan:")) {
  failures.push('Plan management was coupled into the profile patch instead of the audited RPC.');
}

if (failures.length) {
  console.error('✗ Admin Investor Plans Phase 4 check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}
console.log('✓ Admin Investor Plans Phase 4 check: PASS');
