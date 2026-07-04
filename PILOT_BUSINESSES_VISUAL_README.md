# Pilot port — `/businesses` theo extraction-report + visual diff

## Mục tiêu

Port route `/businesses` theo `ui-reference/Deals68 Businesses.dc.html` và `src/styles/reference/extraction-report.md`, thay vì vá bằng CSS override hoặc JSX tự suy luận.

## Thay đổi chính

### 1. `/businesses` JSX port lại theo reference

File:

```txt
src/pages/Businesses.tsx
```

Đã chuyển sang cấu trúc gần reference:

```txt
- Transaction tabs ngay dưới header
- Breadcrumb + title + summary
- Sidebar 288px với checkbox filter
- Results toolbar với Grid/List toggle
- Sort dropdown
- Grid card 3 cột
- List view 236px image + content
- Pagination
```

### 2. CSS page riêng cho pilot

File:

```txt
src/styles/pages/businesses.css
```

Được import qua `src/styles/index.css` trong layer `d68-overrides` để pilot thắng legacy mà không dùng thêm `!important`.

### 3. Layout guard cho dữ liệu thật

Card đã có:

```txt
- line clamp tiêu đề / mô tả
- min-height ổn định
- fallback tint nền nếu ảnh lỗi
- fixed media height
- grid/list view riêng
```

### 4. Visual diff pilot

Files:

```txt
scripts/visual-diff-businesses.mjs
tests/visual/README.md
.github/workflows/visual-businesses.yml
package.json
```

Lệnh local:

```bash
npm install --no-audit --no-fund --package-lock=false
npx playwright install chromium
npm run visual:businesses:local
```

So sánh:

```txt
Target:    http://127.0.0.1:4173/businesses
Reference: https://glittering-unicorn-afbf10.netlify.app/businesses
Widths:    1440 / 768 / 375
Threshold: 3%
```

Output:

```txt
visual-diff/businesses/reference-1440.png
visual-diff/businesses/target-1440.png
visual-diff/businesses/diff-1440.png
visual-diff/businesses/visual-report.json
```

## Cách upload

Upload các file trong patch vào root repo, không upload `node_modules`, `dist`, `package-lock.json`.

Commit message gợi ý:

```txt
Pilot port businesses visual diff
```

Sau deploy, kiểm tra:

```txt
/businesses
/businesses?view=list
/businesses?dealType=Fundraise
/businesses?featured=1
```
