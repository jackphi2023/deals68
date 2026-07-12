# Gói 2 — Checklist QA ảnh, file và quyền tải

## Mục tiêu

Gói 2 xử lý:

1. Ảnh mới của Business được upload vào bucket riêng tư.
2. Business chỉ được upload vào thư mục của chính Business đó.
3. Xóa ảnh/file phải xóa thật cả Storage và database.
4. Không báo thành công khi xóa thất bại hoặc xóa 0 dòng.
5. Admin không còn thấy asset đã xóa.
6. Investor đã kết nối chỉ tải được file đã được Admin duyệt.
7. Ảnh chưa duyệt cũ được chuyển khỏi bucket public.
8. Ảnh được Admin duyệt mới được đưa sang bucket public.

## Trạng thái database trước test

Sau Phase A:

```text
Business file rows: 15
Private file objects: 15
Business image rows: 10
Public image objects: 10
Legacy pending/hidden images still in public bucket: 4
Private image bucket: exists
```

Bốn ảnh legacy chưa được tự di chuyển để tránh làm thay đổi URL/file khi chưa có code frontend mới.

## Test 1 — Di chuyển ảnh legacy khỏi public

Đăng nhập Admin:

```text
/admin/businesses
→ mở một Business
→ tab Hình ảnh & Files
```

Khi có cảnh báo:

```text
4 ảnh chưa duyệt vẫn nằm ở vùng public cũ
```

bấm:

```text
Chuyển toàn bộ sang vùng riêng tư
```

Kết quả:

- thông báo đã chuyển 4/4;
- cảnh báo biến mất;
- ảnh chưa duyệt vẫn xem được trong Admin bằng signed URL;
- ảnh công khai đã duyệt vẫn hiển thị ở frontend;
- không có ảnh hero bị mất ngoài ảnh chưa duyệt.

## Test 2 — Business upload ảnh mới

Đăng nhập Business test:

```text
Dashboard Business
→ Ảnh
→ upload JPG/PNG/WebP
```

Kết quả:

- ảnh hiện trong Dashboard Business;
- trạng thái chờ Admin duyệt;
- ảnh không xuất hiện ở Business Detail public;
- row có `storage_bucket=business-images-private`;
- `public_url` là NULL;
- object tồn tại trong `business-images-private`;
- không có object mới trong `business-images-public`.

## Test 3 — Business upload file mới

Tải lên một PDF hoặc XLSX.

Kết quả:

- file hiện trong Dashboard;
- row có `review_status=pending_admin_approval`;
- `public_visible=false`;
- object nằm trong `business-files-private`;
- Investor chưa kết nối không tải được.

## Test 4 — Xóa ảnh thật

Dùng ảnh test vừa tải:

1. bấm Xóa;
2. xác nhận;
3. thấy thông báo thành công;
4. refresh trang;
5. mở lại Dashboard;
6. mở Admin.

Kết quả bắt buộc:

- ảnh không còn ở Dashboard Business;
- ảnh không còn trong Admin;
- row database không còn;
- object Storage không còn;
- không có orphan object.

## Test 5 — Xóa file thật

Lặp lại với file test.

Kết quả bắt buộc:

- file không còn trong Dashboard Business;
- file không còn trong Admin;
- row database không còn;
- object Storage không còn;
- không có orphan object.

## Test 6 — Không báo thành công giả

Thử xóa lại ID đã bị xóa bằng DevTools/API.

Kết quả:

- nhận lỗi `asset_not_found_or_not_owned`;
- frontend không báo thành công.

## Test 7 — Không xóa tài sản của Business khác

Dùng tài khoản Business A gọi RPC delete target với asset của Business B.

Kết quả:

```text
asset_not_found_or_not_owned
```

Row và object của Business B vẫn còn nguyên.

## Test 8 — Admin duyệt ảnh

Admin mở ảnh pending:

1. đặt tên hiển thị;
2. tick đã xử lý logo/tên;
3. tick hiển thị frontend;
4. chọn ảnh chính khi cần;
5. bấm duyệt.

Kết quả:

- object được chuyển private → public;
- row chuyển `storage_bucket=business-images-public`;
- `review_status=approved`;
- `public_visible=true`;
- `is_sanitized=true`;
- có public URL;
- ảnh xuất hiện trên Business Detail.

## Test 9 — Admin ẩn ảnh đã duyệt

Admin bỏ tick hiển thị hoặc xử lý ẩn ảnh, rồi duyệt lại.

Kết quả:

- object chuyển public → private;
- `public_url` trở về NULL;
- `public_visible=false`;
- ảnh biến mất khỏi frontend;
- Admin/owner vẫn xem được signed preview.

## Test 10 — Business đổi tên ảnh đã duyệt

Business đổi tên một ảnh đang public.

Kết quả:

- ảnh được chuyển về private;
- cần Admin duyệt lại;
- URL public cũ không còn object;
- ảnh không còn xuất hiện ở frontend cho đến khi duyệt lại.

## Test 11 — Investor xem tên file

Investor đăng nhập nhưng chưa kết nối:

- thấy tên các file `approved + public_visible`;
- không nhận `file_path`;
- không tải được.

File pending hoặc hidden không xuất hiện.

## Test 12 — Investor connected tải file

Tài khoản Investor có Proposal `approved/connected`:

- tải được file có `review_status=approved`;
- không đọc hoặc tải được file pending/hidden;
- signed URL có thời hạn ngắn.

## Test 13 — Mobile và lỗi mạng

Kiểm tra:

- nút Xóa không bị bấm hai lần khi đang xử lý;
- mất mạng khi xóa không báo thành công;
- reload vẫn phản ánh đúng database;
- ảnh private hết hạn signed URL có thể tải lại sau refresh.

## Điều kiện PASS Gói 2

- Build và release QA PASS.
- Security static QA PASS.
- 4 ảnh legacy được chuyển thành công.
- Upload ảnh mới vào private bucket.
- Xóa ảnh/file xóa cả row và object.
- Admin không thấy asset đã xóa.
- Investor chỉ tải file approved.
- Không có orphan/missing objects sau test.
- Phase B chưa chạy trước khi main dùng code Gói 2.
