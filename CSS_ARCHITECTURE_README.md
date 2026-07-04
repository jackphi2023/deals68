# Deals68 — Kiến trúc CSS một nguồn chuẩn (UI Reference → React)

## Vấn đề đã xử lý
- 3.548 inline style trong 25 trang `ui-reference/*.dc.html` chưa từng tồn tại
  dưới dạng CSS dùng lại được → mỗi lần port là chép tay, gây lệch UI.
- `styles.css` chứa CSS legacy (thiết kế cũ) định nghĩa trùng class với bản mới,
  phải vá bằng 55 chỗ `!important` trong `reference-overrides.css`.

## Kiến trúc mới
Entry duy nhất: `src/styles/index.css`, cascade kiểm soát bằng CSS `@layer`:

```
d68-legacy  <  d68-base  <  d68-components  <  d68-utilities  <  d68-overrides
(CSS cũ)       (handoff)    (extract từ ref)   (extract từ ref)   (patch tay, tạm)
```

Layer sau LUÔN thắng layer trước bất kể specificity → không cần `!important`,
không còn "style cũ lẫn style mới" (checklist §12 spec).

## Files
| File | Nguồn | Sửa tay? |
|---|---|---|
| `src/styles/index.css` | entry + thứ tự layer | Có (hiếm khi) |
| `src/styles/design-tokens.css` | handoff | Có |
| `src/styles/app.css` | handoff | Có |
| `src/styles/legacy.css` | tách từ styles.css cũ | Chỉ XÓA dần |
| `src/styles/reference/d68-components.css` | **auto-gen** | KHÔNG |
| `src/styles/reference/d68-utilities.css` | **auto-gen** | KHÔNG |
| `src/styles/reference/d68-page-styles.css` | **auto-gen** | KHÔNG |
| `src/styles/overrides.css` | reference-overrides cũ | Chỉ XÓA dần |

## Quy trình khi design thay đổi
1. Sửa trên nhánh `ui-reference` (file `.dc.html`).
2. Chạy `npm run extract:reference` → 3 file trong `src/styles/reference/` được sinh lại.
3. Commit + PR sang `main`. KHÔNG sửa style trực tiếp trên `main`.

## Quy trình port 1 trang (xem chi tiết: src/styles/reference/extraction-report.md)
1. Copy cấu trúc markup từ `.dc.html` sang JSX, GIỮ NGUYÊN class.
2. Element có class + `style="..."` → xóa style attr (rule đã ở d68-components.css;
   nếu report đánh dấu ⚠ nhiều biến thể → dùng `.class--v2`, `.class--v3` đúng ngữ cảnh).
3. Element không class + `style="..."` → tra bảng B trong report, thay bằng `d68-u-xxx`.
4. Giá trị động (`{{ d.tint }}`) → CSS đã đổi thành `var(--d68-dyn)`,
   JSX set: `style={{ ['--d68-dyn' as any]: value }}`.
5. Thay `{{ }}` bằng data Supabase. KHÔNG đụng `lib/`, `contexts/` (logic giữ nguyên).
6. Port xong trang nào: xóa khối CSS tương ứng trong `legacy.css` + `overrides.css`.
7. QA: screenshot diff với reference ở 1440 / 768 / 375 trước khi merge.

## Definition of Done cho toàn bộ migration
- `legacy.css` và `overrides.css` rỗng và bị xóa.
- 0 `!important`, 0 inline style trong JSX (trừ `--d68-dyn`).
- Mọi route pass screenshot diff ≤ 3% so với ui-reference.
- Regression TC-001 → TC-015 pass.

## Build đã verify
`npm run build` pass (tsc + vite, @layer được giữ nguyên trong bundle).
CSS bundle hiện ~30KB gzip; sẽ giảm khi xóa legacy/overrides. Nếu muốn giảm thêm,
bước sau có thể purge utility không dùng bằng cách quét className trong src/.
