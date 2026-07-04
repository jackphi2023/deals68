# Deals68 Phase 5.2 — UI Reference Alignment Patch

Mục tiêu: sửa nguyên nhân UI production khác `ui-reference` bằng cách đưa lại public chrome/listing geometry theo thiết kế review.

## Nguyên nhân chính đã xử lý

1. React app không port 1:1 từ `ui-reference`; trước đó dùng markup riêng (`.hero`, `.grid`, `.footer`, `.deal-card`) và CSS legacy, nên DOM/CSS khác thiết kế.
2. `ui-reference` dùng header/footer inline style với class `d68-*`, max-width 1200/1240, mobile drawer, listing title/filter geometry riêng.
3. React app có `design-tokens.css`/`app.css` nhưng component chính chưa sử dụng đúng hệ class/reference geometry.
4. Footer React cũ là một dòng JSX dùng `.footer`, khác hoàn toàn footer 4 cột trong reference.
5. Businesses/Investors cũ dùng hero lớn, trong khi reference listing dùng breadcrumb + title + sidebar filter + grid.

## File thay đổi

- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/pages/Businesses.tsx`
- `src/pages/Investors.tsx`
- `src/App.tsx`
- `src/main.tsx`
- `src/reference-overrides.css`

## Hướng xử lý

- Header được viết lại theo geometry của `ui-reference`: sticky, 70px, max-width 1240, nav spacing 26px, language pill, register dropdown, mobile drawer.
- Footer được viết lại theo footer reference 4 cột, nền #0B2038, logo trắng, bottom copyright row.
- Businesses và Investors chuyển từ big hero layout về listing layout giống reference: breadcrumb/title, statbar, sidebar filter, toolbar, 3-column grid.
- `src/reference-overrides.css` được import sau `styles.css` để thắng cascade legacy mà chưa cần phá toàn bộ dashboard/admin CSS.
- App root có `data-lang={lang}` để chuẩn hoá toggle/layer ngôn ngữ theo reference.

## Build test

Đã chạy local:

```bash
npm install --no-audit --no-fund --package-lock=false
npm run build
```

Kết quả:

```txt
✓ 140 modules transformed.
✓ built in 1.77s
```

## Upload

Upload/overwrite toàn bộ file trong patch vào root repo. Không upload `node_modules`, `dist`, `package-lock.json`.

Sau đó Netlify: **Trigger deploy → Clear cache and deploy site**.

## QA sau deploy

So sánh production với UI reference:

- `/` header, hero, footer
- `/businesses` title/breadcrumb/sidebar/grid/footer
- `/investors` title/sidebar/grid/footer
- mobile 375px: header drawer, no horizontal scroll

Lưu ý: bản này tập trung fix chrome/listing layout. Các trang chi tiết/dashboard vẫn nên QA riêng ở Phase 5.3/6.
