# Deals68 patch — Business Create → Display flow, location taxonomy, valuation, mobile filter

Target branch: `beta-reference`
Date: 2026-07-05

This zip supersedes the previous valuation/taxonomy/mobile patch and adds the Business Register + Business Detail flow fixes requested in this turn.

## Included fixes

### 1. Business Register wording and data intake
- `Tên DN thật (chỉ Admin thấy)` → `Tên doanh nghiệp`, with helper text: legal name on business registration certificate.
- `Doanh thu 2025` → `Doanh thu năm gần nhất`.
- `EBITDA margin (%)` → `Tỷ suất lợi nhuận/EBITDA (%)` in VI, `EBITDA margin (%)` in EN.
- `Nhu cầu vốn/Giá chào` → `Số tiền gọi vốn / giá trị giao dịch mong muốn`.
- `Thành phố` → `Tỉnh/Thành phố`.
- Reason for fundraising/sale changed to a one-line input.
- Business images and profile docs now allow up to 5 each.
- Added extra spacing for these register labels/inputs: `Điểm nổi bật của doanh nghiệp`, `Lý do gọi vốn/chuyển nhượng`, `Giá trị tài sản vật chất KHÔNG nằm trong giao dịch`.

### 2. Province/City taxonomy
- Adds shared `src/lib/locationTaxonomy.ts`.
- Vietnam uses 34 province/city options after merger.
- Other country support starts with US states, Canada provinces/territories, Australia states/territories, Singapore, Hong Kong, UAE/Dubai, and `Other` fallback.
- Adds Supabase migration `20260705_business_location_taxonomy_and_flow.sql` with `location_taxonomy` table and `businesses.city_key`.
- Register writes both `city` and `city_key`; `/businesses` filter can continue using `city` label without changing public data guard.

### 3. Pricing and payment in Business Register
- Business Register pricing now follows the same VN / Other country logic as `/pricing`:
  - Vietnam → VND.
  - Other countries → USD.
  - Business term options: 4, 8, 12, 16, 24 weeks.
  - Discount logic matches Pricing: 8+ weeks = 15%, 16+ weeks = 20%.
- Adds Standard / Priority cards in the style of the supplied screenshots.
- Adds promo/referral code input and pricing summary: subtotal, term discount, promo discount, total due.
- Adds payment method block:
  - QR bank transfer active.
  - Sepay disabled / coming soon.
  - Stripe / Paypal disabled / coming soon.
- VietQR includes the amount only for VND payments. For USD payments, QR keeps the transfer note but avoids incorrectly encoding a USD amount as VND.
- Adds payment confirmation checkbox before submit.

### 4. Register success/error flow
- If required fields are missing, shows red message above the submit button with exact missing fields.
- If successful, shows green success message for ~12 seconds and redirects home.
- User is signed out after signup; dashboard remains locked until Admin confirms payment/activation.
- New business stays hidden/pending: `visible=false`, `status=pending_admin_review`, `public_snapshot_json=null`.

### 5. Valuation sanity check in Business Register
- Shows `Định giá quy đổi` from ask amount / stake percentage.
- Shows `Định giá tham chiếu` as benchmark low–high using the corrected valuation engine.
- No net debt input is requested.
- Benchmark still follows the valuation spec: country, industry, revenue, EBITDA margin, growth, size and admin config.

### 6. Business Detail display flow
- Removes the wording: `Public page chỉ dùng dữ liệu active/visible/approved...`.
- Replaces `Phiên bản public` with `DN tự định giá` in key facts.
- Moves `Tài liệu Hồ sơ doanh nghiệp` under `Điểm nổi bật`.
- Document names are shown. A Download button is shown only for investor accounts with approved/connected proposal access.
- Renames `Hồ sơ doanh nghiệp` section to `Business Quality Score`.
- Guest / normal user: sees score + investor-login prompt.
- Logged-in investor: sees score + checklist of scoring inputs.
- Removes the financial table/box to avoid displaying missing or inferred financial rows.

### 7. Existing included fixes from prior patch
- Corrected `/valuation` input scope: country, industry, latest annual revenue, EBITDA margin, revenue growth only.
- Admin valuation config route remains included.
- 23-industry taxonomy remains included.
- `/businesses` mobile filter hotfix remains included.
- Header mobile/login hotfix and static page updates remain included from previous combined patch.

## Files changed
- src/components/Header.tsx
- src/App.tsx
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
- src/pages/Register.tsx
- src/pages/StaticPages.tsx
- src/pages/Valuation.tsx
- src/styles/pages/dashboard.css
- src/styles/pages/ui-fixes.css
- src/styles/pages/valuation.css
- supabase/migrations/20260705_valuation_engine_and_taxonomy.sql
- supabase/migrations/20260705_business_location_taxonomy_and_flow.sql
- supabase/migrations/20260705_register_business_assets_signup_bundle.sql

## Commit message
fix: improve business registration and detail flow

## Apply
```bash
git checkout beta-reference
unzip deals68_business_flow_register_detail_location_patch_20260705.zip -d /tmp/deals68_business_flow_patch
cp -R /tmp/deals68_business_flow_patch/src ./
cp -R /tmp/deals68_business_flow_patch/supabase ./
npm run build
git status
git add src supabase/migrations
git commit -m "fix: improve business registration and detail flow"
git push origin beta-reference
```

## Migration order
Apply Supabase migrations after code review, in this order:
1. `20260705_valuation_engine_and_taxonomy.sql`
2. `20260705_business_location_taxonomy_and_flow.sql`
3. `20260705_register_business_assets_signup_bundle.sql`

## Routes to test
Public:
- `/businesses`
- `/en/businesses`
- `/businesses/:slug`
- `/en/businesses/:slug`
- `/valuation`
- `/en/valuation`
- `/pricing`
- `/en/pricing`
- `/register/business`
- `/en/register/business`
- `/register/investor`

Dashboard/Admin:
- `/dashboard/business`
- `/dashboard/business/profile`
- `/dashboard/business/files`
- `/admin/business-review`
- `/admin/valuation`
- `/admin/valuation-config`

## Mobile checklist
375px:
- `/businesses` filter full width; no narrow broken column.
- Register plan/payment cards stack cleanly.
- QR box stacks cleanly.
- Upload image/file rows do not overflow.
- Business Detail document rows/download buttons do not overflow.

768px:
- Register form fields remain readable in two-column where appropriate.
- Pricing/payment summary remains next to options or stacks cleanly.
- Business Detail sidebar moves below main content where CSS dictates.

1440px:
- Register card max-width preserved.
- Business Detail two-column layout preserved.
- Desktop `/businesses` sidebar remains sticky.

## Guardrails
- No public business guard loosened: public data still requires active/visible/approved snapshot via the existing data layer.
- New business signup remains pending and hidden until Admin review.
- Private company name remains private/admin-only.
- Uploaded docs are locked by default.
- No Supabase migration is applied automatically by this patch.
- Build was not run in this chat runtime; run `npm run build` before commit.
