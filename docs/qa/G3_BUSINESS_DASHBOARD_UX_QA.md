# Gói 3 — QA Business Dashboard UX

## Phạm vi

Gói 3 chỉ xử lý trải nghiệm Business Dashboard:

1. Menu trái không còn bị giới hạn chiều cao.
2. Menu không có thanh cuộn riêng.
3. Desktop vẫn giữ menu cố định khi cuộn trang.
4. Tablet/mobile để menu trong luồng trang bình thường.
5. Bỏ nút VI/EN và Thoát bị lặp trong đầu Dashboard.
6. Thanh điều hướng chung tiếp tục quản lý ngôn ngữ và đăng xuất.
7. Các link Dashboard giữ đúng phiên bản Việt/Anh.
8. Không đổi tên, thứ tự hoặc nghiệp vụ của các tab.

Gói này không sửa database, Storage, ảnh/file, Investor Dashboard, trang chủ,
định giá, thanh toán hoặc Admin review.

## Điều cần kiểm tra trước

- Gói 2 đã có trên `beta-reference`.
- Netlify Deploy Preview mới đã hoàn tất.
- Có một tài khoản Business test được phép mở Dashboard.

## Test 1 — Màn hình laptop 1366 × 768

Mở:

```text
/dashboard/business
```

Kết quả bắt buộc:

- thấy đủ bảy mục menu;
- thấy link “Xem hồ sơ công khai” khi Business có slug;
- thấy trọn box hỗ trợ ở cuối menu;
- không có thanh cuộn bên trong menu;
- không mục nào bị che hoặc mất;
- cuộn trang vẫn xem được nội dung chính.

## Test 2 — Desktop 1440 × 900

Cuộn từ đầu đến giữa và cuối trang Tổng quan.

Kết quả:

- menu trái giữ ở vị trí cách đầu màn hình khoảng 90 px;
- menu không nhảy, không bị cắt;
- trang chính cuộn độc lập bằng thanh cuộn của trình duyệt;
- không có tràn ngang.

## Test 3 — Tablet 768 × 1024

Kết quả:

- menu chuyển lên trên nội dung;
- không còn sticky;
- toàn bộ menu hiển thị;
- trang cuộn bình thường;
- card và form không tràn ngang.

## Test 4 — Mobile 375 × 812

Kết quả:

- menu hai cột như giao diện hiện tại;
- tất cả mục vẫn bấm được;
- box hỗ trợ nằm toàn chiều rộng phía dưới;
- không có thanh cuộn riêng trong menu;
- không có cuộn ngang toàn trang.

## Test 5 — Đầu Dashboard

Đầu trang chỉ còn:

```text
Business Dashboard
Tên hồ sơ Business
Gói hiển thị
Trạng thái
```

Không còn nút:

```text
VI/EN
Thoát / Exit
```

Các nút này đã có ở thanh điều hướng chung.

## Test 6 — Đổi ngôn ngữ từ Header chung

Tại `/dashboard/business`, đổi sang English từ Header.

Kết quả:

```text
/en/dashboard/business
```

Sau đó bấm lần lượt:

- Overview;
- Profile & data;
- Documents;
- Images;
- Proposals;
- Data requests;
- Services & billing.

Tất cả URL phải giữ tiền tố:

```text
/en/dashboard/business/...
```

Không được tự quay về route tiếng Việt.

Đổi lại tiếng Việt từ Header chung. URL trở về:

```text
/dashboard/business/...
```

## Test 7 — Link hồ sơ công khai

Ở Dashboard tiếng Anh, bấm “View public profile”.

Kết quả:

```text
/en/businesses/<slug>
```

Ở Dashboard tiếng Việt:

```text
/businesses/<slug>
```

Link mở tab mới như trước.

## Test 8 — Link tìm Nhà đầu tư

Tại Tổng quan, bấm “Tìm Nhà đầu tư / Find investors”.

Kết quả:

- tiếng Việt → `/investors`;
- tiếng Anh → `/en/investors`.

## Test 9 — Đăng xuất

Mở menu tài khoản ở Header chung và bấm:

```text
Thoát / Logout
```

Kết quả:

- đăng xuất thành công;
- Dashboard không còn truy cập được;
- không cần nút Thoát riêng trong nội dung Dashboard.

## Test 10 — Không hồi quy Gói 2

Mở tab Tài liệu và Ảnh:

- danh sách vẫn tải được;
- ảnh private vẫn xem được trong Dashboard;
- nút upload, đổi tên và xóa vẫn xuất hiện;
- Gói 3 không thay đổi các hàm xử lý asset.

## Điều kiện PASS

- Build và Release QA PASS.
- Static G3 QA PASS.
- 10 test thủ công trên PASS.
- Không sửa `release-cleanup.css`.
- Không đổi database hoặc Supabase migration.
- Không đổi thứ tự và nội dung tab Business Dashboard.
