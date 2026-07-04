# Deals68 Truth-first + Visual Flow Patch

## Mục tiêu
Sửa nhóm P0/P1 quan trọng trước khi test nghiệp vụ sâu: public pages không được hiển thị deal/investor/mock/claim giả khi fetch lỗi hoặc khi database thiếu dữ liệu.

## Files thay thế
- `src/lib/data.ts`
- `src/pages/Home.tsx`
- `src/pages/Businesses.tsx`
- `src/pages/BusinessDetail.tsx`
- `src/pages/Investors.tsx`
- `src/pages/InvestorDetail.tsx`
- `src/pages/StaticPages.tsx`
- `src/App.tsx`

## Files bổ sung
- `supabase/migrations/20260704_contact_partner_leads.sql`
- `scripts/visual-diff-full-flow.mjs`
- `scripts/apply-p1-safety-fixes.mjs`

## Đã sửa
1. Bỏ initial state/fallback fake listings ở Businesses/Investors.
2. Loading hiện skeleton hoặc trạng thái đang tải, không hiển thị mock data.
3. Fetch lỗi hiện empty/error state, không thay bằng seed/reference deals.
4. BusinessDetail không dùng `detailData` hardcoded. Chỉ hiển thị dữ liệu từ `businesses` và `business_files`.
5. InvestorDetail không dùng `FALLBACK_INVESTORS`. Không tự tạo proposal history/charts/criteria khi DB chưa có.
6. Home stats lấy từ `countBusinesses()` và `countInvestors()`, không hardcode 6/624/tổng ask tự tính tay.
7. `listBusinesses` và `listInvestors` hỗ trợ `limit/offset`; thêm `countBusinesses/countInvestors`.
8. `createBusinessFromProfile` tự tạo `public_code` nếu payload không có.
9. Contact form và Market Partner form chỉ báo thành công khi insert Supabase thành công; nếu thiếu bảng sẽ báo lỗi thật.
10. App lazy-load Admin, Dashboards và StaticPages để giảm main bundle public.
11. Thêm visual diff script cho full public flow.

## Chưa làm trong patch này
- Chưa chuyển toàn bộ inline style sang CSS modules/layers. Đây là P2, nên làm sau khi khóa dữ liệu đúng.
- Chưa hoàn tất route SEO `/vi/...` và `/en/...`.
- Chưa tự động trừ quota promo/proposal; cần RPC/migration riêng.
- Chưa chạy được `npm run build` hay visual diff trong sandbox này vì không có full repo runtime/dependencies/app server. Đã kiểm tra TSX transpile cho các file thay thế.

## Apply
```bash
unzip deals68_truth_first_visual_patch.zip -d /tmp/deals68-truth
cp -f /tmp/deals68-truth/src/lib/data.ts src/lib/data.ts
cp -f /tmp/deals68-truth/src/pages/Home.tsx src/pages/Home.tsx
cp -f /tmp/deals68-truth/src/pages/Businesses.tsx src/pages/Businesses.tsx
cp -f /tmp/deals68-truth/src/pages/BusinessDetail.tsx src/pages/BusinessDetail.tsx
cp -f /tmp/deals68-truth/src/pages/Investors.tsx src/pages/Investors.tsx
cp -f /tmp/deals68-truth/src/pages/InvestorDetail.tsx src/pages/InvestorDetail.tsx
cp -f /tmp/deals68-truth/src/pages/StaticPages.tsx src/pages/StaticPages.tsx
cp -f /tmp/deals68-truth/src/App.tsx src/App.tsx
mkdir -p scripts supabase/migrations
cp -f /tmp/deals68-truth/scripts/visual-diff-full-flow.mjs scripts/visual-diff-full-flow.mjs
cp -f /tmp/deals68-truth/scripts/apply-p1-safety-fixes.mjs scripts/apply-p1-safety-fixes.mjs
cp -f /tmp/deals68-truth/supabase/migrations/20260704_contact_partner_leads.sql supabase/migrations/20260704_contact_partner_leads.sql

# optional but recommended: removes autoEnglishFromVietnamese write-paths in Register/BusinessDashboard/Admin
node scripts/apply-p1-safety-fixes.mjs

# remove dead CSS traps if present and unimported
rm -f src/styles.css src/reference-overrides.css

npm run build
```

## Supabase migration
Apply `supabase/migrations/20260704_contact_partner_leads.sql` before testing `/contact` and `/partners`, or those forms will correctly show insert errors instead of fake success.

## Visual diff sau khi build
```bash
npm run build
(npm run preview -- --host 127.0.0.1 > /tmp/deals68-preview.log 2>&1 & echo $! > /tmp/deals68-preview.pid)
sleep 3
node scripts/visual-diff-full-flow.mjs
kill $(cat /tmp/deals68-preview.pid)
```

Default routes covered:
`/`, `/businesses`, `/investors`, `/pricing`, `/valuation`, `/about`, `/terms`, `/privacy`, `/contact`, `/partners`, `/login?role=business`, `/login?role=investor`, `/register/business`, `/register/investor` on desktop and mobile.
