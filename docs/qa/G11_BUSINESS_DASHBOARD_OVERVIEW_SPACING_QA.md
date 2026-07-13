# QA Gói 11 — Business Dashboard Overview Spacing

## Desktop
- Bốn thẻ số liệu tổng quan vẫn nằm cùng một hàng khi đủ chiều rộng.
- Có khoảng cách 24px giữa hàng thẻ số liệu và hộp hạn mức.
- Không còn cảm giác ba thẻ cuối sát hộp hạn mức.
- Tiêu đề hiển thị:
  `Hạn mức Gửi Hồ sơ doanh nghiệp/Proposal`.

## English
- Tiêu đề hiển thị:
  `Business profile / Proposal sending quota`.

## Tablet và Mobile
- Hàng số liệu chuyển cột theo quy tắc hiện tại.
- Khoảng cách tới hộp hạn mức là 20px.
- Không tràn chữ hoặc tràn ngang.

## Regression
- Không thay đổi cách tính quota.
- Không thay đổi số hồ sơ đã gửi, được duyệt hoặc nhà đầu tư quan tâm.
- `npm run qa:release` PASS.
- G11 static QA PASS.
- Đúng 4 file thay đổi.
- Không có Supabase migration.
