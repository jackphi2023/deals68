# Deals68 Investor Flow + OTP Auth Patch — 2026-07-05

Target branch: beta-reference
Commit message: fix: align investor signup otp and public profile flow

Scope
- Keeps the prior combined fixes: corrected valuation engine, industry taxonomy, location taxonomy, mobile business filter, business register/payment/detail, and OTP login/reset flow.
- Adds Investor flow parity with Business: signup + payment -> /login OTP -> dashboard editable but not public -> Admin approve public -> Investor edits become pending_profile_changes until Admin approves.
- Does not weaken public Business guard or Investor public visibility guard.

Files included
- src/contexts/AuthContext.tsx
- src/App.tsx
- src/components/Header.tsx
- src/lib/industryTaxonomy.ts
- src/lib/locationTaxonomy.ts
- src/lib/labels.ts
- src/lib/labelsBase.ts
- src/lib/numberFormat.ts
- src/lib/pricing.ts
- src/lib/valuationEngine.ts
- src/pages/AdminValuation.tsx
- src/pages/BusinessDashboard.tsx
- src/pages/BusinessDetail.tsx
- src/pages/ForgotPassword.tsx
- src/pages/InvestorDetail.tsx
- src/pages/Login.tsx
- src/pages/Register.tsx
- src/pages/ResetPassword.tsx
- src/pages/StaticPages.tsx
- src/pages/Valuation.tsx
- src/styles/pages/dashboard.css
- src/styles/pages/investor-detail.css
- src/styles/pages/ui-fixes.css
- src/styles/pages/valuation.css
- supabase/migrations/20260705_valuation_engine_and_taxonomy.sql
- supabase/migrations/20260705_business_location_taxonomy_and_flow.sql
- supabase/migrations/20260705_register_business_assets_signup_bundle.sql
- supabase/migrations/20260705_investor_flow_contact_and_email.sql

Investor Register changes
- "Tiêu chí đầu tư" -> "Thông tin Nhà đầu tư".
- Adds "Giới thiệu chung" for anonymous public description: maps to investors.desc_vi.
- Keeps "Mô tả khẩu vị đầu tư" as detailed appetite: maps to criteria.investment_appetite.
- Adds consistent service package/payment UI, QR transfer, disabled Sepay, disabled Stripe/Paypal.
- Investor terms are 4/8/12/16/24 months.
- Promo/referral input uses Supabase promo_codes via lookupPromo.
- VN uses VND; non-VN uses USD, consistent with Pricing page logic.
- Requires payment acknowledgment for Investor signup.
- Button: "Tạo tài khoản Nhà đầu tư".
- On success redirects to /login?role=investor&otp=1&next=/dashboard/investor.
- If visible/active investor email already exists, shows: "Email đã được đăng ký, vui lòng liên hệ partner@vietcapitalpartners.com để được hỗ trợ." Hidden investors remain allowed by the RPC rule.

Investor Detail changes
- UI structure aligned to reference screenshots:
  - Anonymous title + description + badges + right CTA "Gửi hồ sơ DN".
  - Box "Thông tin Nhà đầu tư": type, country, region, ticket size, stage, sectors.
  - Box "Tiêu chí đầu tư".
  - Box "Lịch sử nhận Proposal" without fabricated history; empty state if no approved public history exists.
  - Box "Thông tin liên hệ" with locked rows.
- Contact information is not selected from public query.
- Contact unlock is via RPC get_investor_contact_if_connected(), requiring authenticated connected Business with approved/connected proposal, investor owner, or Admin.
- Contact respects investor privacy share flags for email/phone/website.

Database/Supabase changes
- Adds investor_public_email_exists(email_text) SECURITY DEFINER RPC.
- Adds get_investor_contact_if_connected(investor_uuid) SECURITY DEFINER RPC.
- Existing create_signup_bundle already creates investor visible=false, status=pending_admin_review, profile dashboard_login_enabled=true.

Apply
```bash
git checkout beta-reference
unzip deals68_investor_flow_otp_register_detail_patch_20260705.zip -d /tmp/deals68_investor_patch
cp -R /tmp/deals68_investor_patch/src ./
cp -R /tmp/deals68_investor_patch/supabase ./
npm run build
git status
git add src supabase/migrations
git commit -m "fix: align investor signup otp and public profile flow"
git push origin beta-reference
```

Migration order
1. 20260705_valuation_engine_and_taxonomy.sql
2. 20260705_business_location_taxonomy_and_flow.sql
3. 20260705_register_business_assets_signup_bundle.sql
4. 20260705_investor_flow_contact_and_email.sql

Routes to test
- /register/investor
- /en/register/investor
- /login?role=investor&otp=1
- /dashboard/investor
- /dashboard/investor/profile
- /admin/investors
- /investors
- /investors/:code
- /register/business
- /login?role=business&otp=1
- /forgot-password?role=investor
- /reset-password

Mobile checklist
- 375px: investor register sections stack, payment plan cards stack, QR box stack, no horizontal overflow.
- 375px: investor detail hero/CTA/contact lock rows stack cleanly.
- 768px: investor detail hero becomes single column; profile boxes readable.
- 1440px: investor detail right CTA sticky and cards match reference proportions.

Not performed
- No GitHub commit/push.
- No Supabase migration applied.
- Build not executed against the full repository runtime; run npm run build after applying.
