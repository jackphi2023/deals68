# Deals68 — All Bugs Final Fix Bundle

## Mục tiêu
Gom toàn bộ các fix cuối cùng sau khi phát hiện Home/Detail/Static/Auth/Pricing/Register/Admin bị lệch UI Reference hoặc có rủi ro runtime/build.

## File copy trực tiếp
- `src/App.tsx`
  - ScrollToTop.
  - Route VI/EN ổn định.
  - Register nhận `lang` từ App/Header.
- `src/components/Header.tsx`
  - Ẩn hoàn toàn Cố vấn/Advisors khỏi desktop nav, mobile drawer, dropdown đăng ký.
- `src/pages/Home.tsx`
  - Khôi phục trang chủ theo UI Reference: hero, search, stats, role cards, promo banner, featured deals, ngành nổi bật, valuation CTA, investors, how it works, partner CTA.
- `src/pages/BusinessDetail.tsx`
  - Khôi phục layout theo `ui-reference/Deals68 Deal.dc.html` nhưng dùng Supabase public snapshot/approved assets.
- `src/pages/InvestorDetail.tsx`
  - Khôi phục layout theo `ui-reference/Deals68 Investor Detail.dc.html`, không lộ thông tin nhạy cảm.
- `src/pages/StaticPages.tsx`
  - Khôi phục nhóm About/Terms/Privacy/Contact/Market Partner về style landing/legal/contact/partner đồng bộ UI Reference.
- `supabase/migrations/20260704_102_final_home_seed_public_fix.sql`
  - Defensive schema columns.
  - Mark 6 seed deal D68-01..D68-06 là Admin-approved public snapshot v1.

## Script fix thêm
- `scripts/apply_all_final_bugs_fix.mjs`
  - Copy toàn bộ file direct ở trên.
  - Ẩn Advisor khỏi Login/Pricing visible UI.
  - Sửa Senpay -> Sepay.
  - Bỏ switch VI/EN riêng trong Register.
  - App truyền lang vào Register.
  - Sửa Admin `.catch()` trên Supabase query builder.

## Cách apply nhanh
Chạy từ root repo `deals68`:

```bash
node /tmp/deals68-all/deals68_all_bugs_final_fix/scripts/apply_all_final_bugs_fix.mjs
npm run build
```

Hoặc copy thủ công các file trong patch vào đúng path rồi chạy `npm run build`.

## Supabase
Migration `final_home_seed_public_fix` đã được chạy thành công trên project Supabase production trong cuộc chat này. File SQL vẫn được kèm theo repo để version-control và chạy lại an toàn nếu cần.

## Đã kiểm tra trong môi trường tạo patch
- `node --check scripts/apply_all_final_bugs_fix.mjs`: PASS
- TypeScript transpile:
  - `src/App.tsx`: PASS
  - `src/components/Header.tsx`: PASS
  - `src/pages/Home.tsx`: PASS
  - `src/pages/BusinessDetail.tsx`: PASS
  - `src/pages/InvestorDetail.tsx`: PASS
  - `src/pages/StaticPages.tsx`: PASS

## Chưa kiểm tra được ở đây
- Chưa chạy full `npm run build` trên repo thực tế sau khi script patch Login/Pricing/Register/Admin, vì không có full repo runtime trong sandbox.
- Cần deploy Netlify và kiểm tra UI thực tế trên browser.

## Test route sau deploy
- `/`
- `/businesses`
- `/businesses/dermatology-aesthetics-chain-vietnam`
- `/businesses/global-mobile-app-studio-fundraise`
- `/investors`
- `/investors/<code>`
- `/pricing`
- `/valuation`
- `/login`
- `/forgot-password`
- `/register/business`
- `/register/investor`
- `/dashboard/business`
- `/dashboard/investor`
- `/admin`
- `/about`
- `/terms`
- `/privacy`
- `/contact`
- `/market-partner`
