import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const requireToken = (text, token, message) => {
  if (!text.includes(token)) failures.push(message);
};
const forbidToken = (text, token, message) => {
  if (text.includes(token)) failures.push(message);
};

const data = read('src/lib/data.ts');
const metrics = read('src/lib/publicMetrics.ts');
const auth = read('src/contexts/AuthContext.tsx');
const admin = read('src/pages/Admin.tsx');
const businessDashboard = read('src/pages/BusinessDashboard.tsx');
const investorDashboard = read('src/pages/InvestorDashboard.tsx');
const migration = read('supabase/migrations/20260712090520_security_foundation_phase_a.sql');
const viewHardening = read('supabase/migrations/20260712090329_security_foundation_phase_a_view_hardening.sql');
const phaseB = read('docs/security/PHASE_B_AFTER_MAIN_CUTOVER.sql');

requireToken(data, "public_businesses_safe", 'data.ts chưa chuyển public Business sang safe view');
requireToken(data, "public_investors_safe", 'data.ts chưa chuyển public Investor sang safe view');
requireToken(metrics, ".from('public_businesses_safe')", 'Public metrics còn đọc raw businesses');
requireToken(auth, "select('id,role,username,display_name,email,country_iso2,language_code,timezone,status,dashboard_login_enabled')", 'AuthContext chưa giới hạn cột profile');
forbidToken(auth, ".from('profiles').select('*')", 'AuthContext còn select * profiles');
forbidToken(admin, 'initial_password', 'Admin còn đọc/hiển thị initial_password');
requireToken(admin, 'Quản lý bằng Supabase Auth · không lưu trong database', 'Admin thiếu thông báo không lưu mật khẩu');
requireToken(businessDashboard, "get_my_business_dashboard_relations", 'Business Dashboard chưa dùng safe relation RPC');
requireToken(businessDashboard, ".from('public_businesses_safe')", 'Business benchmark còn đọc raw public businesses');
forbidToken(businessDashboard, "request_data').select('*, investors(", 'Business Dashboard còn nested raw Investor request query');
forbidToken(businessDashboard, "investor_interests').select('*, investors(", 'Business Dashboard còn nested raw Investor interest query');
requireToken(investorDashboard, "get_my_investor_dashboard_relations", 'Investor Dashboard chưa dùng safe relation RPC');
forbidToken(investorDashboard, "investor_interests')\n          .select(", 'Investor Dashboard còn nested raw Business interest query');

for (const token of [
  'public_businesses_safe',
  'public_investors_safe',
  'protect_profile_security_fields',
  'protect_business_admin_fields',
  'protect_investor_admin_fields',
  'security invoker',
  'update public.profiles',
  'set initial_password = null',
  'get_my_investor_dashboard_relations',
  'get_my_business_dashboard_relations',
]) {
  requireToken(migration.toLowerCase(), token.toLowerCase(), `Phase A migration thiếu: ${token}`);
}
forbidToken(migration, 'revoke select on public.businesses, public.investors from anon', 'Phase A không được thu hồi raw SELECT trước main cutover');
requireToken(migration, 'security_invoker = true', 'Phase A safe views chưa dùng SECURITY INVOKER');
requireToken(viewHardening, 'security_invoker = true', 'Migration view hardening thiếu SECURITY INVOKER');
requireToken(viewHardening, 'revoke all on public.public_businesses_safe from public, anon, authenticated', 'View hardening chưa thu hồi quyền thừa');
requireToken(phaseB, 'revoke select on public.businesses, public.investors from anon', 'Phase B thiếu raw SELECT enforcement');
requireToken(phaseB, 'business owner or admin raw select', 'Phase B thiếu owner/admin Business policy');
requireToken(phaseB, 'investor owner or admin raw select', 'Phase B thiếu owner/admin Investor policy');

if (failures.length) {
  console.error('✗ Deals68 G1 security static check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 G1 security static check: PASS');
console.log('✓ Public frontend uses safe views.');
console.log('✓ Dashboard cross-party relations use ownership-checked RPCs.');
console.log('✓ Plaintext initial_password removed from frontend/Admin.');
console.log('✓ Phase A remains backward-compatible with current main.');
console.log('✓ Phase B enforcement is isolated from automatic migrations.');
