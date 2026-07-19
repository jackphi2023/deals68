# Gói 1 — Kế hoạch kiểm thử quyền tài khoản và dữ liệu riêng tư

## Mục tiêu

Gói 1 xử lý bốn rủi ro release nghiêm trọng:

1. Tài khoản thường không thể tự đổi `profiles.role` thành `admin`.
2. Business owner không thể tự bật public hoặc sửa trường do Admin quản lý.
3. Investor owner không thể tự sửa tên public, trạng thái duyệt và cờ Admin.
4. Trang public đọc dữ liệu qua safe views, không dựa vào `select=*` trên raw tables.

Gói này không xử lý Storage/xóa ảnh-file; nội dung đó thuộc Gói 2.

## Hai pha bắt buộc

### Phase A — áp dụng cùng lúc với code beta

Phase A tương thích ngược với code `main` hiện tại vì chưa thu hồi raw public SELECT.
Nó tạo safe views/RPCs, khóa trường nhạy cảm và xóa mật khẩu ban đầu lưu trong profiles.

### Phase B — chỉ áp dụng sau khi main đã dùng safe views

Phase B thu hồi anonymous SELECT trên raw `businesses`/`investors` và thay policy public bằng policy owner/Admin.
Không chạy file Phase B trong lúc production còn sử dụng raw tables.

## QA tự động trong Codespaces

Lệnh 1 phải PASS:

```text
npm run qa:release
node scripts/deals68-security-phase-a-check.mjs
git diff --check
```

## QA database sau Phase A

Chạy bằng tài khoản test, không dùng dữ liệu thật.

### A. Tài khoản thường không leo quyền

- Đăng nhập Business test.
- Gửi API update `profiles.role=admin`.
- Kết quả bắt buộc: thất bại `protected_profile_field`.
- Role trong database vẫn là `business`.

Lặp lại với Investor test.

### B. Business không tự public

- Đăng nhập Business test.
- Gửi update `visible=true`, `status=active`.
- Kết quả bắt buộc: thất bại.
- Business vẫn giữ trạng thái trước đó.
- Sửa hồ sơ qua Dashboard vẫn tạo `pending_changes_json` thành công.

### C. Investor không tự sửa tên public

- Đăng nhập Investor test.
- Gửi update trực tiếp `title_vi`, `title_en`, `visible`, `status`.
- Kết quả bắt buộc: thất bại.
- Sửa hồ sơ qua RPC Dashboard vẫn thành công.
- Chỉ `desc_vi/desc_en` và `criteria.investment_appetite_vi/en` nằm trong pending để Admin duyệt; các tiêu chí khác lưu ngay.

### D. Không còn mật khẩu lưu trong profiles

- `profiles.initial_password` phải NULL toàn bộ.
- Admin không hiển thị mật khẩu.
- Đổi/quên mật khẩu dùng Supabase Auth OTP.

### E. Public safe views

Cửa sổ ẩn danh phải tải được:

- Trang chủ.
- Danh sách Business.
- Business detail.
- Danh sách Investor.
- Investor detail.
- Tổng giá trị thương vụ.

Response safe views không được có:

- `owner_id`.
- `company_name_private`.
- `private_name`.
- `private_email`.
- `private_phone`.
- `private_website`.
- `privacy`.
- `pending_changes_json`.
- `initial_password`.

### F. Dashboard cross-party data

Business Dashboard vẫn xem được Investor liên quan trong:

- Proposal.
- Quan tâm.
- Yêu cầu data.

Investor Dashboard vẫn xem được Business liên quan trong:

- Đã lưu/quan tâm.
- Proposal.

RPC chỉ trả public-safe fields của bên còn lại.

## QA sau Phase B

Chỉ chạy sau khi beta và main đều đã deploy code Gói 1.

- Anonymous `select=*` từ raw `businesses` phải bị từ chối.
- Anonymous `select=*` từ raw `investors` phải bị từ chối.
- Authenticated Business chỉ đọc raw Business của chính họ.
- Authenticated Investor chỉ đọc raw Investor của chính họ.
- Admin vẫn đọc raw records.
- Public pages vẫn hoạt động qua safe views.

## Điều kiện PASS Gói 1

- Build/Release QA PASS.
- Không có lỗi console trên 5 public routes chính.
- Các test A–F PASS.
- Không áp dụng Phase B sớm.
- Có backup Supabase trước Phase A và Phase B.
