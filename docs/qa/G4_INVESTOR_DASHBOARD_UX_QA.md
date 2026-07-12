# Gói 4 — QA Investor Dashboard UX

## Phạm vi

Gói 4 chỉ xử lý trải nghiệm Investor Dashboard:

1. Tiêu đề đầu trang dùng tên thật của Nhà đầu tư.
2. Investor ID hiển thị mờ ngay cạnh tên thật.
3. Bỏ tiêu đề chung “Quản lý hồ sơ và cơ hội đầu tư”.
4. Bỏ nút “Xem doanh nghiệp” ở đầu Dashboard.
5. Bỏ nút Đăng xuất bị lặp trong nội dung Dashboard.
6. Khôi phục link “Xem Hồ sơ hiển thị” trong menu trái.
7. Investor ID không còn badge nổi bật trong tab Hồ sơ.
8. Tiêu đề Business trong ba danh sách là link mở tab mới:
   - Tiêu chí & Gợi ý;
   - Đã lưu;
   - Proposal.
9. Không đổi workflow hồ sơ, gợi ý, proposal, liên hệ hoặc thanh toán.
10. Không thay đổi database hoặc Supabase.

## Điều kiện trước khi chạy

- Gói 3 đã được commit trên `beta-reference`.
- Có một tài khoản Investor test.
- Investor test có:
  - tên thật;
  - Investor ID;
  - public code;
  - ít nhất một Business gợi ý hoặc Proposal để kiểm tra link.

## Test 1 — Đầu Investor Dashboard

Mở:

```text
/dashboard/investor
```

Kết quả bắt buộc:

```text
Investor Dashboard
<Tên thật Nhà đầu tư>  INV-XXXX
```

Trong đó:

- tên thật là tiêu đề lớn;
- ID nằm cạnh tên;
- ID dùng chữ nhỏ, màu mờ;
- không dùng badge xanh nổi bật.

Không còn:

```text
Quản lý hồ sơ và cơ hội đầu tư
Xem doanh nghiệp
Đăng xuất
```

Đăng xuất vẫn thực hiện qua menu tài khoản của Header chung.

## Test 2 — Tên thật không lộ ra public

Mở DevTools và kiểm tra:

- URL Dashboard;
- tiêu đề HTML;
- meta description;
- Open Graph;
- URL public Investor;
- tab Network của public profile.

Tên thật không được xuất hiện trong:

```text
/investors/<code>
HTML title public
Open Graph public
public_investors_safe
```

Trang public tiếp tục dùng tên hiển thị ẩn danh do Admin quản lý.

## Test 3 — Link “Xem Hồ sơ hiển thị”

Trong menu trái phải có đúng text:

```text
Xem Hồ sơ hiển thị
```

Bấm link:

- mở tab mới;
- tiếng Việt → `/investors/<code>`;
- tiếng Anh → `/en/investors/<code>`;
- không dùng tên thật trong URL.

## Test 4 — Tab Hồ sơ

Mở:

```text
/dashboard/investor/profile
```

Kết quả:

- không có badge Investor ID ở đầu form;
- tên thật vẫn có trong input nội bộ;
- tên hiển thị public vẫn bị khóa;
- lưu hồ sơ vẫn hoạt động;
- mô tả vẫn đưa vào chờ Admin duyệt như trước.

## Test 5 — Tiêu chí & Gợi ý

Mở:

```text
/dashboard/investor/matches
```

Bấm trực tiếp vào tiêu đề một Business.

Kết quả:

- mở Business Detail trong tab mới;
- tab Dashboard vẫn giữ nguyên;
- route đúng Việt/Anh;
- nút Bày tỏ quan tâm và Yêu cầu dữ liệu vẫn hoạt động như trước.

## Test 6 — Đã lưu

Mở:

```text
/dashboard/investor/saved
```

Bấm tiêu đề Business.

Kết quả:

- mở Business Detail trong tab mới;
- tiêu đề có hover/focus rõ;
- nút “Xem chi tiết” cũ vẫn hoạt động;
- trạng thái quan tâm không bị thay đổi.

## Test 7 — Proposal

Mở:

```text
/dashboard/investor/proposals
```

Bấm tiêu đề Business.

Kết quả:

- mở Business Detail trong tab mới;
- nút Duyệt, Bỏ qua, Yêu cầu tài liệu vẫn hoạt động;
- trạng thái Proposal không bị thay đổi chỉ vì mở link.

## Test 8 — Investor không có slug Business

Với Business chưa có slug:

- tiêu đề vẫn hiển thị;
- không tạo link lỗi;
- không mở `/businesses/undefined`.

## Test 9 — Responsive

Kiểm tra:

```text
1440 × 900
1366 × 768
768 × 1024
375 × 812
```

Kết quả:

- tên thật và ID tự xuống dòng khi cần;
- không tràn ngang;
- ID không che tên;
- menu trái và public-profile link vẫn bấm được;
- link tiêu đề Business vẫn rõ trên mobile.

## Test 10 — Song ngữ

Từ Header chung đổi sang English.

Kết quả:

- Dashboard route thành `/en/dashboard/investor/...`;
- link public thành `/en/investors/<code>`;
- tiêu đề Business mở `/en/businesses/<slug>`;
- đổi lại tiếng Việt không mất tab hiện tại.

## Test 11 — Không hồi quy nghiệp vụ

Kiểm tra nhanh:

- lưu Hồ sơ;
- lọc gợi ý;
- bày tỏ quan tâm;
- yêu cầu dữ liệu;
- cập nhật Proposal;
- lưu liên hệ;
- mở Invoice/Thanh toán.

Không chức năng nào bị mất hoặc đổi logic.

## Điều kiện PASS Gói 4

- Build và Release QA PASS.
- Static G4 QA PASS.
- 11 test thủ công trên PASS.
- Không có migration Supabase.
- Không sửa Gói 1–3.
- Không đổi public name, SEO hoặc URL.
