# QA Gói 9 — Public Discovery UX

## Homepage
- Tổng giá trị thương vụ không có phần thập phân.
- Với dữ liệu tương đương 3.099,8 tỷ phải hiển thị 3.099 tỷ ₫.
- Ba nhãn thống kê Hero có cỡ chữ 10px.
- Số liệu không tràn ô tại 1440px, 768px và 375px.

## Business List
- Hộp Bộ lọc vẫn có viền và cấu trúc cũ.
- Khoảng đệm trong đầu hộp, nội dung và nút áp dụng đã gọn hơn.
- Checkbox, số lượng, select và nút không bị cắt.

## Business Detail
- Ảnh Hero phủ hết chiều ngang card.
- Không còn dải trắng bên phải.
- Ảnh vẫn `object-fit: cover`.
- Thumbnail vẫn cuộn ngang và có khoảng đệm hợp lý.

## Regression
- `npm run qa:release` PASS.
- G9 static QA PASS.
- Đúng 6 file thay đổi.
- Không có Supabase migration.
