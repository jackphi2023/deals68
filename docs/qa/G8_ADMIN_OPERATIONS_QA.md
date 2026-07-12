# Gói 8 — QA Admin Operations & Review Queues

## Phạm vi

Gói 8 tập trung vào vận hành Admin Beta:

1. Tổng quan hàng chờ:
   - Thanh toán chờ xác nhận;
   - Doanh nghiệp chờ duyệt;
   - Nhà đầu tư chờ duyệt;
   - Proposal chưa duyệt;
   - yêu cầu dữ liệu và lead cần phản hồi.

2. Điều hướng:
   - card mở trực tiếp đúng hàng chờ;
   - menu trái hiển thị badge số lượng;
   - tab tiếp tục được xác định bằng URL path.

3. Bộ lọc và trang:
   - search, filter Business/Investor;
   - filter Payment/Proposal;
   - trang Investor;
   - lưu trong URL để refresh/back/forward không mất trạng thái.

4. Ưu tiên vận hành:
   - Payment mặc định chờ xác nhận;
   - Proposal mặc định chưa duyệt;
   - Investor cần duyệt được sắp lên đầu;
   - hàng pending được tô nền nhẹ.

5. Dữ liệu:
   - hiển thị thời điểm refresh gần nhất;
   - realtime refresh khi Business, asset, Investor, Payment hoặc Proposal thay đổi.

Không thay đổi Supabase, RPC thanh toán, RLS, pricing, quota hoặc public workflow.

## Test 1 — Tổng quan Admin

Mở:

```text
/admin
```

Kết quả:

- có tiêu đề “Hàng chờ vận hành”;
- có 4 card chính;
- số Payment/Business/Investor/Proposal khớp dữ liệu;
- có tổng Business, Investor, Profiles, Payments, Proposals;
- có hàng chờ bổ sung Data request và Leads;
- thời điểm cập nhật hiển thị.

## Test 2 — Link Payment queue

Bấm card Thanh toán chờ xác nhận.

URL:

```text
/admin/payments?ps=pending
```

Kết quả:

- chỉ hiển thị payment pending/payment_pending/new;
- filter đang chọn “Chờ xác nhận”;
- pending được tô nền;
- confirm/reject vẫn gọi RPC Gói 7;
- khi chuyển sang filter đã xử lý, các action cũ vẫn tồn tại; RPC Gói 7 bảo đảm idempotency.

## Test 3 — Link Business review

Bấm card Doanh nghiệp chờ duyệt.

URL:

```text
/admin/business-review?queue=pending
```

Kết quả:

- chỉ dùng danh sách `pendingBusinesses` hiện có;
- không tự public;
- duyệt Business vẫn dùng workflow cũ;
- asset/file pending vẫn được tính.

## Test 4 — Link Investor review

Bấm card Nhà đầu tư chờ duyệt.

URL:

```text
/admin/investors?review=pending
```

Kết quả:

- filter Hàng chờ = Chỉ hồ sơ cần duyệt;
- chỉ hiện Investor cần review;
- hồ sơ pending được xếp lên đầu;
- duyệt Investor không thay đổi nghiệp vụ;
- refresh trang vẫn giữ filter.

## Test 5 — Link Proposal queue

Bấm card Proposal chưa duyệt.

URL:

```text
/admin/proposals?prs=sent
```

Kết quả:

- chỉ hiện Proposal status sent;
- filter mặc định “Chưa duyệt”;
- Duyệt/Từ chối/Connected vẫn hoạt động;
- Proposal đã xử lý vẫn có thể chuyển trạng thái tiếp, ví dụ Approved → Connected.

## Test 6 — Badge menu trái

Kiểm tra các tab:

```text
Thanh toán
Proposal
Duyệt public DN
Nhà đầu tư
Yêu cầu data
Liên hệ/Đối tác
```

Kết quả:

- tab có việc pending hiển thị badge số;
- tab sạch không hiển thị badge 0;
- badge không làm menu tràn ngang;
- mobile vẫn đọc được.

## Test 7 — URL giữ bộ lọc

Thử các bộ lọc:

```text
Business: q, bs, bi
Investor: q, review, iv, io, ic, ii, ip
Payment: ps
Proposal: prs
```

Kết quả:

- URL thay đổi khi đổi filter;
- reload không mất filter;
- Back/Forward khôi phục đúng;
- đổi tab bằng menu làm sạch query của tab cũ;
- trang Investor `ip` giữ đúng.

## Test 8 — Refresh timestamp và realtime

Mở Admin ở hai tab trình duyệt.

Tạo/chỉnh sửa một row test ở:

```text
businesses
business_files
business_images
investors
payment_orders
proposals
```

Kết quả:

- Admin tự refresh;
- badge và queue count cập nhật;
- thời gian “Cập nhật” thay đổi;
- nút Refresh vẫn hoạt động.

## Test 9 — Responsive

Kiểm tra:

```text
1440 × 900
1024 × 768
768 × 1024
390 × 844
```

Kết quả:

- desktop 4 queue card;
- tablet 2 card mỗi hàng;
- mobile 1 card mỗi hàng;
- summary không tràn;
- filter Payment/Proposal full width trên mobile;
- bảng vẫn cuộn ngang như hiện tại.

## Test 10 — Không hồi quy Gói 7

Kiểm tra:

- Admin confirm payment;
- Admin reject payment;
- confirm lại không cộng quota hai lần;
- `adminSetPaymentOrderStatus` vẫn được dùng;
- không xuất hiện direct update `payment_orders`;
- Business/Investor Dashboard payment không thay đổi.

## Điều kiện PASS

- TypeScript/Vite build PASS.
- Release QA 25/25 PASS.
- G8 static QA PASS.
- Đúng 6 file repository thay đổi.
- Không có migration Supabase.
- Không sửa `paymentOrders.ts`, `proposals.ts` hoặc migration Gói 7.
- 10 test thủ công PASS trước khi merge main.
