# Gói 6 — QA Đăng ký Business và Định giá

## Phạm vi

Gói 6 chỉ xử lý hai nhóm giao diện:

1. Đăng ký Business trên desktop:
   - ô nhập mã khuyến mãi rộng đúng 200 px;
   - giữ nguyên nút Áp dụng;
   - giữ nguyên hộp Tạm tính/Tổng thanh toán ở cột phải;
   - tăng cột hộp này từ 290 px lên 350 px, tức +60 px;
   - không thay đổi kích thước phần đăng ký Investor;
   - mobile tiếp tục dùng layout một cột như hiện tại.

2. Trang Định giá:
   - bỏ mặc định Việt Nam;
   - bỏ mặc định ngành F&B;
   - bỏ doanh thu 9 tỷ;
   - bỏ EBITDA 17%;
   - bỏ tăng trưởng 10%;
   - tất cả trường bắt đầu trống;
   - chỉ tính khi có quốc gia, ngành và doanh thu năm lớn hơn 0;
   - khi chưa đủ dữ liệu, các kết quả hiển thị “—”.

Gói này không thay đổi database, Supabase, thanh toán, quota hoặc công thức định giá.

## Test 1 — Đăng ký Business desktop

Mở:

```text
/register/business
/en/register/business
```

Kiểm tra tại:

```text
1440 × 900
1366 × 768
1200 × 800
```

Kết quả bắt buộc:

- hộp Tạm tính/Tổng thanh toán vẫn ở bên phải;
- hộp không bị chuyển xuống dưới;
- chiều rộng cột phải là 350 px;
- nội dung trong hộp không bị cắt;
- số tiền không tràn;
- phần bên trái vẫn còn đủ chỗ.

## Test 2 — Mã khuyến mãi Business desktop

Tại khu vực Gói dịch vụ và Thanh toán:

- input mã khuyến mãi rộng 200 px;
- nút Áp dụng giữ nguyên rộng 88 px;
- khoảng cách giữa input và nút là 8 px;
- input không kéo dài hết cột trái;
- nhập mã và bấm Áp dụng vẫn hoạt động;
- thông báo hợp lệ/không hợp lệ hiển thị như cũ.

## Test 3 — Không ảnh hưởng Investor registration

Mở:

```text
/register/investor
/en/register/investor
```

Kết quả:

- cột Tạm tính/Tổng thanh toán vẫn dùng cấu trúc cũ 290 px;
- ô mã khuyến mãi vẫn dùng layout cũ;
- không nhận class Business-only;
- không thay đổi nghiệp vụ đăng ký Investor.

## Test 4 — Mobile Register

Kiểm tra:

```text
375 × 812
390 × 844
768 × 1024
```

Kết quả:

- payment grid chuyển một cột như trước;
- input và nút mã khuyến mãi không tràn ngang;
- hộp Tạm tính/Tổng thanh toán nằm dưới phần bên trái;
- không xuất hiện thanh cuộn ngang.

## Test 5 — Định giá lần đầu mở

Mở:

```text
/valuation
/en/valuation
```

Kết quả:

- Quốc gia chưa được chọn;
- Ngành chưa được chọn;
- Doanh thu trống;
- EBITDA trống;
- Tăng trưởng trống;
- không còn F&B;
- không còn doanh thu 9.000.000.000;
- không còn 17%;
- không còn 10%;
- tiêu đề kết quả hiển thị “—”;
- các dòng Thấp, Trung bình, Cao, Phương pháp, Ngành, Quốc gia đều là “—”.

## Test 6 — Chưa đủ dữ liệu

Thử từng trường hợp:

```text
Chỉ chọn quốc gia
Chọn quốc gia + ngành
Chọn quốc gia + doanh thu
Chọn ngành + doanh thu
Doanh thu = 0
```

Kết quả:

- hệ thống chưa tính;
- kết quả vẫn là “—”;
- không xuất hiện số định giá giả định.

## Test 7 — Đủ dữ liệu tối thiểu

Nhập:

```text
Quốc gia
Ngành
Doanh thu năm > 0
```

Không bắt buộc nhập EBITDA và tăng trưởng.

Kết quả:

- hệ thống tính định giá;
- hiển thị khoảng thấp–cao;
- hiển thị ngành và quốc gia đã chọn;
- phương pháp tính hiển thị đúng;
- thay doanh thu làm kết quả cập nhật.

## Test 8 — EBITDA và tăng trưởng tùy chọn

Sau khi đã đủ ba dữ liệu bắt buộc:

- nhập EBITDA;
- nhập tăng trưởng;
- xóa EBITDA;
- xóa tăng trưởng.

Kết quả:

- hệ thống không lỗi;
- kết quả cập nhật theo engine hiện tại;
- xóa hai trường tùy chọn không làm mất điều kiện tính.

## Test 9 — Song ngữ

Đổi Việt/Anh bằng Header.

Kết quả:

- placeholder Quốc gia/Ngành đúng ngôn ngữ;
- nội dung hướng dẫn đúng ngôn ngữ;
- dữ liệu không tự chuyển về giá trị mặc định;
- route giữ đúng `/valuation` và `/en/valuation`.

## Test 10 — Không hồi quy

Kiểm tra nhanh:

- Register Business submit;
- Register Investor submit;
- lookup mã khuyến mãi;
- kỳ hạn;
- gói Thường/Ưu tiên;
- QR thanh toán;
- link Đăng hồ sơ doanh nghiệp từ Valuation;
- công thức valuation engine;
- Admin valuation config.

## Điều kiện PASS

- TypeScript/Vite build PASS.
- Release QA 25/25 PASS.
- G6 static QA PASS.
- Đúng 5 file repository thay đổi.
- Không có migration Supabase.
- Không sửa payment/quota/valuation engine.
