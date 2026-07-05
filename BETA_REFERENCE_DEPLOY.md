# Deals68 beta-reference — Gói deploy đầy đủ (Home + Header + Footer + /businesses)

Gói này là TOÀN BỘ source repo (không kèm node_modules/dist — Netlify tự cài & build).
Đã port theo UI Reference và gắn data thật Supabase, tuân thủ SPEC v1.3.

## Đã có trong gói (so với bản trước)
- `src/pages/Home.tsx` — PORT MỚI theo `ui-reference/Deals68 Home.dc.html`:
  hero + search 2 tab, stats (count thật từ DB), role cards, promo banner,
  featured deals (Supabase), industries, valuation CTA, investors (Supabase),
  how-it-works, partner CTA. Dùng class trong `src/styles/pages/home.css`.
- `src/pages/Businesses.tsx` + `src/styles/pages/businesses.css` — port /businesses (bản trước).
- `src/lib/data.ts` — filter public + facets (bản trước).
- `src/components/Header.tsx`, `src/components/Footer.tsx` — đã khớp reference
  (nav Doanh nghiệp/Nhà đầu tư/Định giá/Bảng giá; footer 4 cột + song ngữ l-vi/l-en).

## Cách đưa lên GitHub (beta-reference) — GitHub Web
Cách A (dễ nhất, thay cả branch):
1. Tạo branch `beta-reference` trên GitHub nếu chưa có.
2. Giải nén gói này ra máy.
3. Trên GitHub, mở branch `beta-reference` → "Add file" → "Upload files".
4. Kéo THẢ toàn bộ nội dung BÊN TRONG thư mục (không kéo cả thư mục cha) vào.
   Bỏ qua `node_modules` và `dist` (đã loại sẵn khỏi gói).
5. Commit message: `feat: beta-reference — Home/Header/Footer/Businesses theo UI Reference + real Supabase data`.
6. Commit trực tiếp vào `beta-reference`.

Cách B (chỉ cập nhật file đã đổi — nhẹ hơn):
Chỉ cần upload 4 file:
- `src/pages/Home.tsx`
- `src/pages/Businesses.tsx`
- `src/styles/pages/businesses.css`
- `src/lib/data.ts`
(Home.css, Header, Footer đã có sẵn trong repo nếu bạn đã upload các bản trước.)

## Netlify
1. Site → Site configuration → Build & deploy:
   - Build command: `npm run build`
   - Publish directory: `dist`
2. Environment variables (BẮT BUỘC — nếu thiếu, trang sẽ trắng):
   - `VITE_SUPABASE_URL = https://tucaqhsfdjbclxqaoxio.supabase.co`
   - `VITE_SUPABASE_ANON_KEY = <anon key của bạn>`
3. Deploys → **Clear cache and deploy site**.

## Route cần kiểm tra sau deploy (1440 / 768 / 375)
- `/` — hero, search 2 tab, stats hiện SỐ THẬT (6 business, >600 investor),
  featured deals + investors lấy từ DB, các CTA bấm ra đúng trang.
- `/businesses` — 6 deal thật, tab + sidebar count khớp, filter chạy.
- Bấm thẻ deal → `/businesses/:slug` mở đúng.
- Footer đủ 4 cột; chuyển VI/EN đổi ngôn ngữ toàn trang.
- Mobile 375px: không tràn ngang.

## Rollback
GitHub → Commits → mở commit vừa push → **Revert**. Netlify tự deploy lại.
Gói này KHÔNG đụng database/migrations nên rollback chỉ cần revert code.

## Kết quả kiểm tra trong môi trường đóng gói (bằng chứng B9)
- `npm run build` (tsc + vite): PASS ✓ (0 lỗi TS mới).
- `npm run check:routes`: PASS (79 routes).
- Smoke test Playwright (Home): render đủ 10 khối reference + header + footer,
  h1 = "Nơi Doanh nghiệp gặp gỡ Nhà đầu tư", 0 page error,
  KHÔNG tràn ngang ở 375px. Khi Supabase chưa trả data → hiện empty state
  an toàn, KHÔNG dùng mock (đúng B5).
- Chưa test với anon key thật (cần env trên Netlify) → chạy checklist route ở trên sau deploy.

## Lưu ý còn mở (đề xuất task kế tiếp, cần Founder duyệt theo §15.1)
- Home stats ô thứ 3 hiện "Ẩn danh" thay cho một con số tổng giá trị deal (bản cũ
  cộng tay dễ sai khi data đổi) — nếu muốn hiện số, cần chốt cách tính từ DB.
- Promo banner trỏ `/pricing`; ảnh `promo-vn/en.png` đã có trong `public/assets`.
- Trang tiếp theo nên port cùng chuẩn: Business Detail → Investors → Investor Detail → Pricing/Valuation.
