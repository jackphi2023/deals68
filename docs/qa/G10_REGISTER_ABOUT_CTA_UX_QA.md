# QA Gói 10 — Register & About CTA UX

## Register Business
- Nút “Tạo tài khoản doanh nghiệp” cao tối thiểu 50px.
- Cỡ chữ 18px.
- Loading/disabled state hoạt động như cũ.

## Register Investor
- Nút “Tạo tài khoản Nhà đầu tư” cao tối thiểu 50px.
- Cỡ chữ 18px.
- Không thay đổi submit, payment acknowledgement hoặc validation.

## About
- Không còn nút “Xem doanh nghiệp”.
- Hiển thị “Hân hạnh được hợp tác và đồng hành”.
- English hiển thị “Honoured to collaborate and grow together”.
- Box nền #0F2A4A, chữ #F2B51D, font-size 20px, căn giữa.

## Regression
- `npm run qa:release` PASS.
- G10 static QA PASS.
- Đúng 5 file thay đổi.
- Không có Supabase migration.
