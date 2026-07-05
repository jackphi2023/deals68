# Deals68 — Bộ quy chuẩn UI + Trang HTML kiểm thử (UI Standard v1.0)

Gói này gồm 3 phần: (A) TÀI LIỆU chuẩn, (B) FILE CODE enforce, (C) TRANG HTML
demo + kiểm thử tràn viền. Tất cả đã build + lint pass, và test render ở 375px/1440px.

## A. Tài liệu
- `Deals68_UI_Build_Standard_v1.docx` — rulebook 9 trang: nguyên tắc, kiến trúc file,
  bảng token, thư viện component, responsive/pixel-perfect, quy trình dựng trang,
  Definition of Done, prompt mẫu giao Dev/AI.

## B. File code đưa vào repo (GitHub Web)
| File trong gói | Đưa vào repo tại | Ghi chú |
|---|---|---|
| `src/styles/design-tokens.css` | `src/styles/design-tokens.css` | Nguồn giá trị màu/chữ/spacing |
| `src/styles/base.css` | `src/styles/base.css` | **CẬP NHẬT** — H1–H6, form, button, layout + **rule chống tràn viền/text dài mobile** |
| `src/styles/app.css` | `src/styles/app.css` | Component dùng chung |
| `src/styles/index.css` | `src/styles/index.css` | Import base.css vào layer d68-base |
| `.stylelintrc.json` / `.stylelintignore` | gốc repo | Chặn !important |
| `eslint.d68-ui.cjs` | gốc repo | Chặn inline style trong JSX |
| `scripts/*.mjs / *.cjs` | `scripts/` | extract CSS + sinh tài liệu |

## C. Trang HTML kiểm thử — `preview/deals68-ui-styleguide.html`
Mở bằng trình duyệt (double-click). Tự chứa (đã nhúng token + base.css), gồm:
- Bảng màu, thang H1–H6, button, form/input/label, badge, alert, card, bảng.
- **Mục 8 — Stress test tràn viền:** tiêu đề dài không ngắt, URL/email/mã dài,
  nút nhãn dài, badge dài, hàng flex chứa chuỗi dài, đoạn văn dài.
- **Mục 9 — Khung điện thoại 375px** nhúng ngay trong trang để xem mobile.
- Nút VI/EN đổi ngôn ngữ.
- 2 ảnh `sg-1440.png` / `sg-375.png`: kết quả render đã kiểm.

Đây là công cụ ĐỐI CHIẾU & QA — không phải trang production. Nó render bằng
CHÍNH base.css của dự án, nên nếu HTML này hiển thị đúng thì app React cũng đúng.

## Đã kiểm chứng (bằng chứng)
- `npm run build`: PASS (0 lỗi TypeScript).
- `npm run lint:css`: 0 error.
- Render styleguide: KHÔNG cuộn ngang ở 375px và 1440px; 0 lỗi JS.
- Mọi ca stress test (URL/email/mã/tiêu đề dài) tự xuống dòng gọn trong khung.
- Bảng rộng cuộn ngang RIÊNG trong `.d68-table-wrap`, không đẩy vỡ trang.

## Cách dùng chống tràn viền trong code (khi dựng trang mới)
- Tiêu đề/mô tả trong thẻ: thêm `d68-clamp-2` (cắt 2 dòng) — đã dùng ở BusinessCard.
- Chuỗi kỹ thuật (mã, URL, email) trong khung hẹp: thêm `d68-breakall`.
- Bảng: luôn bọc `<div class="d68-table-wrap"><table class="d68-table">…`.
- Hàng flex có ô chứa text dài: base.css đã set `min-width:0` cho con của `.d68-row/.d68-grid`.
- KHÔNG dùng `white-space:nowrap` cho text người dùng nhập.

## Không phá gì khi merge
base.css chỉ style element gốc + thêm lưới an toàn chống tràn. Trang có class riêng
vẫn giữ nguyên. `overflow-x: clip` ở html/body là lưới cuối, không phá header dính.
