# Deals68 Release Lock & QA Checklist

Cập nhật: 2026-07-10

## Mục tiêu

Đóng băng `beta-reference` thành bản RC trước khi merge vào `main`.

- `beta-reference`: build test/debug, deploy beta.deals68.com.
- `main`: production, deploy deals68.com.
- Không merge `beta-reference` thẳng vào `main` khi còn hotfix UI/CSS chồng hoặc QA chưa khóa.

## Nguyên tắc release

1. Không thêm tính năng mới trong giai đoạn release lock.
2. Chỉ sửa lỗi blocker hoặc lỗi UI/flow được ghi rõ.
3. Không commit file patch tạm `apply_*.py`.
4. CSS ổn định phải nằm đúng file page:
   - Home → `src/styles/pages/home.css`
   - Business detail → `src/styles/pages/business-detail.css`
   - Investor detail → `src/styles/pages/investor-detail.css`
   - Dashboard → `src/styles/pages/dashboard.css`
   - Admin → `src/styles/pages/admin.css`
5. `release-cleanup.css` chỉ còn legacy/hotfix đang kiểm chứng, không dùng để chồng thêm homepage UI chính.

## Lệnh bắt buộc trước khi tạo release branch

```bash
git checkout beta-reference
git pull origin beta-reference
npm run qa:release
git status
```

Điều kiện đạt:

```text
Release QA static check passed
npm run build pass
git status clean hoặc chỉ có file QA/cleanup đã được commit rõ ràng
```

## QA thủ công trên beta.deals68.com

### Public

- Home desktop/mobile.
- Box định giá trang chủ không còn mảng trắng/xanh chắp vá.
- Nhãn “Nhà đầu tư tiêu biểu” rõ, không bị mờ.
- Ngành nổi bật click sang `/businesses?industry=...`.
- Business listing/filter/pagination.
- Business detail mobile ảnh hero không tràn.
- Investor listing/detail.
- Register Business không còn valuation disclaimer thừa.
- Pricing, Valuation, About/FAQ static pages.

### Business

- Đăng ký Business → OTP → vào dashboard.
- Dashboard tổng quan hiển thị đúng quota proposal.
- Business cập nhật giới thiệu/điểm nổi bật → Admin thấy pending.
- Business upload ảnh/file → Admin thấy ảnh/file hoặc upload_plan cảnh báo.
- Business gửi proposal khi còn quota.
- Khi quota Admin set 6, Dashboard hiển thị 6.

### Investor

- Đăng ký Investor → OTP → dashboard.
- Investor sửa profile → Admin thấy pending.
- Admin duyệt investor → public mới cập nhật.
- Admin filter quốc gia trụ sở hoạt động.
- Khu vực quan tâm hiển thị tag.

### Admin

- `/admin/businesses` search/filter/sort.
- `/admin/businesses/<id>`:
  - Tab Thanh toán & Quota.
  - Tab Thông tin.
  - Tab Hình ảnh & Files.
- Duyệt public business → `pending_changes_json` clear.
- Duyệt ảnh/file → alert vàng tắt nếu không còn pending.
- `/admin/investors` phân trang 30/trang.
- Confirm/reject payment hoạt động.

## Tạo release branch

```bash
git checkout beta-reference
git pull origin beta-reference
git checkout -b release/deals68-beta-rc1
git push origin release/deals68-beta-rc1
```

## Merge production

Chỉ merge sau khi QA pass:

```bash
git checkout main
git pull origin main
git merge --no-ff release/deals68-beta-rc1 -m "release: Deals68 beta reference to production"
npm run qa:release
git push origin main
```

## Supabase/Auth trước production

- Xác nhận production Supabase project.
- Chạy/kiểm tra migrations cần thiết.
- Kiểm tra OTP Auth SMTP + templates.
- Site URL production: `https://deals68.com`.
- Redirect URL gồm:
  - `https://deals68.com/**`
  - `https://www.deals68.com/**`
  - beta domain nếu vẫn test song song.
