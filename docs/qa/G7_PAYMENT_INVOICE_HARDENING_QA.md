# Gói 7 — QA Thanh toán, Invoice và Investor Registration

## Phạm vi

Gói 7 xử lý hai nhóm:

1. Đồng bộ giao diện Đăng ký Investor trên desktop:
   - ô mã khuyến mãi rộng 200 px;
   - nút Áp dụng giữ 88 px;
   - hộp Tạm tính/Tổng thanh toán rộng 350 px;
   - mobile vẫn một cột như trước.

2. Làm vững luồng thanh toán/Invoice:
   - mỗi đơn có mã giao dịch duy nhất;
   - Business và Investor Dashboard tạo đơn qua helper kiểm tra kết quả database;
   - người dùng không thể tự đổi trạng thái payment;
   - Admin xác nhận/từ chối qua RPC atomically;
   - bấm xác nhận lại không cộng gói/quota lần hai;
   - lưu thời điểm xác nhận, người xác nhận và kết quả đã áp dụng;
   - theo dõi ngày hết hạn gói Business và dịch vụ Investor;
   - tương thích với đơn đăng ký và đơn upgrade cũ.

## Test 1 — Investor registration desktop

Mở:

```text
/register/investor
/en/register/investor
```

Kiểm tra ở:

```text
1440 × 900
1366 × 768
1200 × 800
```

Kết quả:

- input mã khuyến mãi đúng 200 px;
- nút Áp dụng 88 px;
- khoảng cách 8 px;
- summary bên phải 350 px;
- không tràn ngang;
- Business registration vẫn giữ cùng kích thước.

## Test 2 — Register mobile

Kiểm tra Business và Investor tại:

```text
375 × 812
390 × 844
768 × 1024
```

Kết quả:

- layout một cột;
- input/nút không tràn;
- summary xuống dưới;
- không có thanh cuộn ngang.

## Test 3 — Mã đơn đăng ký duy nhất

Tạo hai tài khoản test khác nhau.

Kết quả:

- QR và payment payload có `orderCode`;
- `order_code` trong database không rỗng;
- hai đơn có mã khác nhau;
- mã trên QR, Dashboard và Admin giống nhau.

Không dùng dữ liệu/email live. Dùng tiền tố tài khoản:

```text
TEST_G7_
```

## Test 4 — Business Dashboard tạo upgrade

Mở:

```text
/dashboard/business/payments
```

Tạo hai đơn upgrade test liên tiếp, không cần xác nhận thanh toán thật.

Kết quả:

- hai order code khác nhau;
- cả hai row status `pending`;
- lịch sử hiển thị mã đơn;
- không gặp lỗi unique constraint;
- đơn mới chỉ thuộc Business đang đăng nhập.

## Test 5 — Investor Dashboard tạo upgrade

Mở:

```text
/dashboard/investor/billing
```

Kết quả tương tự Test 4:

- mã đơn khác nhau;
- status pending;
- lịch sử hiển thị mã;
- không thể tạo đơn cho Investor khác.

## Test 6 — User không tự xác nhận payment

Dùng tài khoản Business/Investor test:

- thử update `payment_orders.status` qua Console/Supabase client;
- thử đổi thành `confirmed`.

Kết quả bắt buộc:

```text
RLS deny
```

User chỉ được insert đơn pending và đọc đơn của mình.

## Test 7 — Admin xác nhận Business upgrade

Ghi lại trước khi xác nhận:

```text
business.plan
business.quota_total
business.plan_expires_at
payment.applied_at
```

Admin bấm Xác nhận một lần.

Kết quả:

- payment status = confirmed;
- `confirmed_at`, `confirmed_by`, `applied_at` có dữ liệu;
- plan cập nhật đúng;
- quota chỉ cộng đúng số payload;
- plan expiry tăng đúng số tuần;
- audit log có `confirm_payment_order_atomic`.

## Test 8 — Idempotency

Bấm Xác nhận lại đúng payment ở Test 7.

Kết quả:

- RPC trả `already_applied`;
- quota không tăng lần hai;
- expiry không tăng lần hai;
- Dashboard/Admin không báo lỗi giả;
- payment vẫn confirmed.

## Test 9 — Investor membership

Xác nhận một đơn `investor_service_upgrade`.

Kết quả:

- `membership_started_at` được đặt;
- `membership_expires_at` tăng đúng số tháng;
- Dashboard Investor hiển thị hạn dịch vụ;
- xác nhận lại không kéo dài lần hai.

## Test 10 — Từ chối payment

Tạo một đơn pending mới rồi bấm Từ chối.

Kết quả:

- status = rejected;
- `rejected_at`, `rejected_by` có dữ liệu;
- không đổi plan/quota/expiry;
- không thể từ chối đơn đã applied.

## Test 11 — Đơn đăng ký cũ

Kiểm tra một đơn registration payload kiểu cũ:

```text
payload.role
payload.plan
payload.price.termWeeks
payload.price.proposalQuota
```

Admin xác nhận đơn pending test.

Kết quả:

- profile được mở dashboard;
- Business/Investor chuyển pending_admin_review;
- không public tự động;
- kỳ hạn lấy từ payload cũ;
- không cộng quota upgrade ngoài ý muốn.

## Test 12 — Admin tables

Tại:

```text
/admin/payments
/admin/businesses/<id> → Thanh toán & Quota
```

Kết quả:

- thấy mã đơn;
- thấy title, amount, status, ngày;
- xác nhận/từ chối dùng RPC;
- payment đã confirmed có thể bấm lại an toàn nhưng không áp dụng lần hai.

## Test 13 — Legacy compatibility

Database hiện có các đơn cũ.

Kết quả:

- mọi order cũ đã có `D68-OLD-*`;
- không có mã trùng;
- confirmed cũ có `applied_at` backfill;
- G7 không tái cộng quota cho confirmed cũ;
- source production cũ vẫn insert được trong cửa sổ chuyển tiếp.

## Điều kiện PASS

- TypeScript/Vite build PASS.
- Release QA 25/25 PASS.
- G7 static QA PASS.
- Đúng 10 file repository thay đổi.
- Hai migration có trong Git và Supabase.
- 13 test thủ công trên beta PASS trước khi merge main.
