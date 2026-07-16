#!/usr/bin/env node
import fs from 'node:fs';
import ts from 'typescript';

const failures = [];
const files = {
  app: 'src/App.tsx',
  register: 'src/pages/InvestorRegisterV14.tsx',
  profilePage: 'src/pages/InvestorProfileV10.tsx',
  profileForm: 'src/components/investor/InvestorProfileFormV10.tsx',
  nav: 'src/components/investor/InvestorDashboardNav.tsx',
  admin: 'src/pages/AdminInvestorsV10.tsx',
  adminEditor: 'src/components/admin/InvestorProfileEditorV10.tsx',
  pickers: 'src/components/investor/InvestorCriteriaTagPickers.tsx',
  taxonomy: 'src/lib/investorCriteriaOptions.ts',
  migration: 'supabase/migrations/20260716190000_investor_public_profile_pending_v6.sql',
  css: 'src/styles/pages/investor-workflow-v14.css',
  cssIndex: 'src/styles/index.css',
};

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`Missing ${path}`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${label} missing: ${token}`);
  }
}

function rejectTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) failures.push(`${label} must not contain: ${token}`);
  }
}

for (const [label, path] of Object.entries(files)) {
  if (!path.endsWith('.tsx')) continue;
  const source = read(path);
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const diagnostic of parsed.parseDiagnostics) {
    failures.push(`${label}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

const app = read(files.app);
requireTokens('App routes', app, [
  'import InvestorRegisterV14',
  '<Route path="/register/investor" element={<InvestorRegisterV14 lang="vi"/>}/>',
  '<Route path="/en/register/investor" element={<InvestorRegisterV14 lang="en"/>}/>',
  '<Route path="/dashboard/investor/profile" element={<DashboardGate role="investor"><InvestorProfileV10/></DashboardGate>}/>',
  '<Route path="/dashboard/investor/*" element={<DashboardGate role="investor"><InvestorDashboard/></DashboardGate>}/>',
  '<Route path="/admin/investors" element={<AdminInvestorsV10/>}/>',
  '<Route path="/admin/investors/:code" element={<AdminInvestorsV10/>}/>',
]);

const register = read(files.register);
requireTokens('Investor registration', register, [
  'InvestorTypeMultiTagPicker',
  'InvestorStageMultiTagPicker',
  'InvestorRegionTagPicker',
  'InvestorCountryTagPicker',
  'IndustryTagPicker',
  'InvestorDealTypeTagPicker',
  "role: 'investor'",
  'createSignupBundle',
  'investorTypes,',
  'stages,',
  'targetRegions,',
  'targetCountries,',
  'sectors: industries',
  'dealTypes,',
  "source: 'investor_register_v14'",
]);
rejectTokens('Investor registration', register, [
  "toggleIndustry(T(lang",
  "code: 'INV-NEW-",
]);

const profilePage = read(files.profilePage);
const nav = read(files.nav);
requireTokens('Dashboard shell', profilePage, [
  'd68-dashboard-page d68-investor-dashboard-page',
  'd68-dashboard-head',
  '<InvestorDashboardNav lang={lang} publicInvestorPath={publicPath} />',
]);
requireTokens('Dashboard navigation', nav, [
  'BriefcaseBusiness',
  'LayoutDashboard',
  'FileText',
  'BarChart3',
  'Inbox',
  'CreditCard',
  'd68-dashboard-nav-icon',
]);
rejectTokens('Dashboard Profile shell', profilePage, ['const LINKS', '<nav className="d68-dashboard-side">']);

const profileForm = read(files.profileForm);
requireTokens('Dashboard Profile form', profileForm, [
  "'Tên hiển thị công khai (VN)'",
  "'Tên hiển thị công khai (EN)'",
  "'Loại hình nhà đầu tư'",
  "'Quốc gia trụ sở'",
  "'Giai đoạn phù hợp'",
  "'Khu vực đầu tư'",
  "'Thị trường quan tâm'",
  'InvestorTypeMultiTagPicker',
  'InvestorStageMultiTagPicker',
  'InvestorRegionTagPicker',
  'InvestorCountryTagPicker',
  'IndustryTagPicker',
  'InvestorDealTypeTagPicker',
  'investorTypes,',
  'stages,',
  'targetRegions,',
  'targetCountries,',
]);
rejectTokens('Dashboard Profile wording', profileForm, [
  'Tên public VN - Admin quản lý',
  'Tên public EN - Admin quản lý',
  "'Loại Investor'",
]);

const pickers = read(files.pickers);
requireTokens('Shared taxonomy pickers', pickers, [
  'export function InvestorTypeMultiTagPicker',
  'export function InvestorStageMultiTagPicker',
  'export function InvestorRegionTagPicker',
  'export function InvestorCountryTagPicker',
  'exclusiveValue="Any"',
  'exclusiveValue="global"',
]);

const taxonomy = read(files.taxonomy);
requireTokens('Canonical taxonomy', taxonomy, [
  'INVESTOR_TYPE_OPTIONS',
  'INVESTOR_STAGE_OPTIONS',
  'INVESTOR_REGION_OPTIONS',
  'INVESTOR_DEAL_OPTIONS',
  'optionValues',
  'optionLabels',
  'normalizeExclusiveSelection',
]);

const admin = read(files.admin);
requireTokens('Admin Investor list/detail', admin, [
  'Tài khoản mới',
  'Hồ sơ vừa cập nhật',
  'Khẩu vị/tiêu chí vừa cập nhật',
  'Trạng thái public',
  'Loại hình Nhà đầu tư',
  'Quốc gia trụ sở',
  'Thị trường quan tâm',
  'Ngành quan tâm',
  'Gói dịch vụ',
  '/admin/investors/${encodeURIComponent',
  'Tài khoản đăng nhập',
  'Gói dịch vụ & hiển thị',
  '<InvestorCoverEditorV10',
  '<InvestorProfileEditorV10',
  '<InvestorAppetiteEditorV10',
]);

const adminEditor = read(files.adminEditor);
requireTokens('Admin Investor editor', adminEditor, [
  'InvestorTypeMultiTagPicker',
  'InvestorStageMultiTagPicker',
  'InvestorRegionTagPicker',
  'InvestorCountryTagPicker',
  'IndustryTagPicker',
  'InvestorDealTypeTagPicker',
  'privacyAfterInvestorProfileApproval',
  'Duyệt hồ sơ public',
]);

const migration = read(files.migration);
requireTokens('Investor pending migration', migration, [
  'create or replace function public.update_my_investor_profile',
  "'type','country','country_iso2','region','stage'",
  "'ticket_min','ticket_max'",
  "'investorTypes','stages','targetRegions','targetCountries'",
  "v_privacy := jsonb_set(v_privacy, '{pending_profile_changes}', v_pending, true)",
  'private_name = case',
  'private_website = case',
  'revoke all on function public.update_my_investor_profile(jsonb, jsonb) from public',
]);
rejectTokens('Investor pending migration', migration, [
  'set\n    type =',
  'set\n    industries =',
]);

const css = read(files.css);
const cssIndex = read(files.cssIndex);
requireTokens('Scoped workflow CSS', css, [
  '.d68-investor-dashboard-page',
  '.d68-v10-admin-page',
  '.d68-v14-investor-table',
]);
if (/^\s*\.(col-|w-33|card\b)/m.test(css)) failures.push('Workflow CSS must not redefine global grid/card primitives');
if (!cssIndex.includes("@import './pages/investor-workflow-v14.css' layer(d68-overrides);")) {
  failures.push('Workflow CSS is not imported in the single CSS entry');
}

if (failures.length) {
  console.error('✗ Deals68 Investor Workflow V14 check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Deals68 Investor Workflow V14 check: PASS');
console.log('✓ Registration, Dashboard and Admin use the same canonical taxonomy.');
console.log('✓ Dashboard Profile inherits the main menu, icons and layout classes.');
console.log('✓ Admin keeps list filters and opens a full Investor detail workflow.');
console.log('✓ Investor public profile changes remain pending until Admin approval.');
