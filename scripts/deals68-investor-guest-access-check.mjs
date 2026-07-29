#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const access = fs.readFileSync('src/lib/investorAccess.ts', 'utf8');
const homeData = fs.readFileSync('src/lib/homePublicData.ts', 'utf8');
const supabaseClient = fs.readFileSync('src/lib/supabase.ts', 'utf8');
const headerCss = fs.readFileSync('src/styles/components/header.css', 'utf8');
const sitemap = fs.readFileSync('scripts/generate-sitemap.mjs', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20260729123000_investor_guest_access_hardening_v1.sql',
  'utf8',
);

assert.match(access, /new Set\(\['business', 'investor', 'admin'\]\)/);
assert.match(access, /Chỉ doanh nghiệp hoặc nhà đầu tư đã đăng nhập mới được xem/);

assert.match(app, /function InvestorMarketplaceGate/);
assert.match(app, /canViewInvestorMarketplace\(profile\.role\)/);
assert.match(app, /data-investor-access=\{investorAccess \? 'allowed' : 'locked'\}/);
assert.match(app, /path="\/investors" element=\{<InvestorMarketplaceGate><Investors lang="vi"\/><\/InvestorMarketplaceGate>\}/);
assert.match(app, /path="\/investors\/:code" element=\{<InvestorMarketplaceGate><InvestorDetail lang="vi"\/><\/InvestorMarketplaceGate>\}/);
assert.match(app, /path="\/en\/investors" element=\{<InvestorMarketplaceGate><Investors lang="en"\/><\/InvestorMarketplaceGate>\}/);
assert.match(app, /path="\/en\/investors\/:code" element=\{<InvestorMarketplaceGate><InvestorDetail lang="en"\/><\/InvestorMarketplaceGate>\}/);
assert.match(app, /<Navigate to=\{`\$\{loginPath\}\?next=\$\{next\}`\} replace \/>/);

assert.match(headerCss, /data-investor-access="locked"/);
assert.match(headerCss, /Chỉ doanh nghiệp hoặc nhà đầu tư đã đăng nhập mới được xem/);
assert.match(headerCss, /\.d68-home-investor-band/);
assert.match(headerCss, /:hover::after/);

assert.match(homeData, /supabase\.rpc\('d68_get_public_investor_count'\)/);
assert.match(homeData, /canViewInvestors \? listInvestors/);
assert.match(homeData, /\.from\('profiles'\)/);
assert.match(homeData, /cacheKey: `viewer:\$\{userId\}`/);
assert.doesNotMatch(homeData, /countInvestors/);

const publicPathBlock = supabaseClient.match(/const PUBLIC_REST_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
assert.doesNotMatch(publicPathBlock, /public_investors_safe/);

assert.doesNotMatch(sitemap, /['"]\/investors(?:['"/])/);
assert.doesNotMatch(sitemap, /['"]\/en\/investors(?:['"/])/);
assert.doesNotMatch(sitemap, /public_investors_safe/);

for (const token of [
  'create or replace function public.d68_can_view_investor_marketplace()',
  "'business'::public.user_role",
  "'investor'::public.user_role",
  "'admin'::public.user_role",
  'create or replace function public.d68_get_public_investor_count()',
  'to anon, authenticated, service_role',
  'create policy "investor marketplace authenticated read"',
  'revoke all on table public.investors from public, anon',
  'revoke all on table public.public_investors_safe from public, anon',
  'public.d68_can_view_investor_marketplace()',
  'revoke all on function public.get_public_homepage_bootstrap(integer, integer)',
]) {
  assert.ok(migration.includes(token), `Migration missing: ${token}`);
}

console.log('✓ Investor guest access contract: PASS');
console.log('✓ Guest receives only Investor count; list/detail rows require Business, Investor or Admin login.');
