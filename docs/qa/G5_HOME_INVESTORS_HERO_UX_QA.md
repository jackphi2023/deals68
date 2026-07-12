# Gói 5 — QA Trang chủ, Hero và danh sách Nhà đầu tư

## Phạm vi

Gói 5 xử lý đúng các vấn đề UX đã thống nhất:

1. Nút “Xem chi tiết” của Nhà đầu tư đầu tiên trên trang chủ không còn tự active.
2. Hero desktop ưu tiên tỷ lệ 1600×600.
3. Mỗi Hero có thể có ảnh mobile riêng 900×1200.
4. Admin chọn được điểm trọng tâm ngang/dọc để kiểm soát phần ảnh bị cắt.
5. Admin xem trước Hero desktop và mobile.
6. Danh sách Nhà đầu tư bỏ bộ lọc Khu vực đầu tư.
7. Tên hiển thị Nhà đầu tư là link tới trang chi tiết.
8. Không thay đổi nghiệp vụ Proposal, public privacy hoặc Dashboard.

## Logic Hero sau Gói 5

### Desktop

Khung Hero dùng chiều cao gần tỷ lệ:

```text
1600 × 600
```

Ảnh vẫn dùng `object-fit: cover` để không có khoảng trắng. Ảnh 1600×600 sẽ
khớp tốt ở các màn hình desktop phổ biến.

### Mobile

Khi Admin đã upload ảnh mobile:

```text
900 × 1200
```

trình duyệt dùng ảnh mobile tại màn hình nhỏ hơn hoặc bằng 700 px.

Khi chưa có ảnh mobile, hệ thống dùng ảnh desktop và điểm trọng tâm.

### Điểm trọng tâm

```text
X = 0   → ưu tiên bên trái
X = 50  → ưu tiên giữa
X = 100 → ưu tiên bên phải

Y = 0   → ưu tiên phía trên
Y = 50  → ưu tiên giữa
Y = 100 → ưu tiên phía dưới
```

`cover` không thể đảm bảo hiển thị 100% một ảnh trên mọi tỷ lệ màn hình.
Ảnh mobile riêng và điểm trọng tâm giúp kiểm soát phần bị cắt mà không tạo
khoảng trắng.

## Test 1 — Home Investor CTA

Mở trang chủ khi không đặt chuột lên card.

Kết quả:

- cả bốn nút “Xem chi tiết” đều nền trắng;
- không có nút đầu tiên màu vàng;
- rê chuột đúng lên nút thì nút chuyển vàng;
- rê chuột lên phần khác của card không làm nút active;
- dùng bàn phím Tab tới nút thì focus rõ.

## Test 2 — Hero desktop 1600×600

Trong Admin:

```text
/admin
→ Banner
→ Trang chủ Hero
```

Upload một ảnh desktop 1600×600.

Mở trang chủ tại:

```text
1440 × 900
1366 × 768
1600 × 900
```

Kết quả:

- ảnh phủ kín Hero;
- phần bị cắt ít hơn bản cũ;
- nội dung chính không bị lệch;
- slider, chấm chuyển slide và link vẫn hoạt động.

## Test 3 — Hero mobile riêng

Upload thêm ảnh mobile 900×1200 cho cùng slot.

Mở ở:

```text
375 × 812
390 × 844
```

Kết quả:

- trình duyệt dùng ảnh mobile;
- không dùng ảnh desktop bị cắt ngang quá mạnh;
- tiêu đề và thống kê vẫn đọc được;
- không tràn ngang.

## Test 4 — Focal point

Với ảnh có chủ thể lệch phải:

```text
X = 80
Y = 50
```

Lưu và refresh.

Kết quả:

- chủ thể được ưu tiên phía phải;
- preview Admin và trang chủ cùng hướng;
- giá trị 0–100 được chấp nhận;
- giá trị ngoài 0–100 bị giới hạn/chặn.

## Test 5 — Không có ảnh mobile

Xóa ảnh mobile riêng.

Kết quả:

- trang chủ vẫn hiển thị ảnh desktop;
- điểm trọng tâm vẫn được áp dụng;
- không xuất hiện ảnh lỗi.

## Test 6 — Thay ảnh Hero

Thay ảnh desktop hoặc mobile.

Kết quả:

- ảnh mới hiển thị;
- đường dẫn cũ được xóa khỏi Storage khi thay thành công;
- không mất dữ liệu slot;
- ngày hiển thị, ngôn ngữ và link được giữ theo form.

## Test 7 — Danh sách Nhà đầu tư

Mở:

```text
/investors
/en/investors
```

Kết quả:

- không còn “Khu vực đầu tư / Investment region”;
- vẫn có “Quốc gia đầu tư / Investment country”;
- các bộ lọc khác vẫn hoạt động;
- URL cũ có `?region=` vẫn mở trang, nhưng tham số bị bỏ qua.

## Test 8 — Tên Nhà đầu tư là link

Bấm tên hiển thị của Nhà đầu tư.

Kết quả:

- mở đúng `/investors/<code>`;
- bản English mở `/en/investors/<code>`;
- nút “Xem chi tiết” vẫn tồn tại;
- nút Proposal vẫn hoạt động;
- không lộ tên thật hoặc email riêng tư.

## Test 9 — Responsive danh sách Investor

Kiểm tra:

```text
1440 × 900
768 × 1024
375 × 812
```

Kết quả:

- tên link không tràn;
- hover/focus rõ;
- action buttons không lệch;
- sidebar còn đủ các bộ lọc hợp lệ.

## Test 10 — Không hồi quy

Kiểm tra nhanh:

- Home Business cards;
- Promotion banner;
- Hero auto-slide;
- Admin Banner;
- Investor pagination;
- gửi Proposal;
- public Investor detail;
- Header Việt/Anh.

## Điều kiện PASS

- TypeScript/Vite build PASS.
- Release QA 25/25 PASS.
- G5 static QA PASS.
- 10 test thủ công PASS.
- Migration responsive Hero đã có trên Supabase và Git.
- Không thay đổi Gói 1–4.
