# Deals68 Business Quality Score v1

## Công thức 100 điểm

- Độ đầy đủ hồ sơ: 15
- Chất lượng số liệu tài chính: 20
- Tài liệu chứng minh: 20
- Hình ảnh: 10
- Định giá & độ hợp lý đề xuất: 25
- Mức sẵn sàng giao dịch/kết nối: 10

## Logic định giá

- Có ask amount: +2
- Có stake %: +2
- Có benchmark: +1
- So sánh DN tự định giá với benchmark: tối đa 20
  - Trong khoảng benchmark: 16
  - Thấp hơn benchmark 0-15%: 18
  - Thấp hơn benchmark 15-35%: 20
  - Thấp hơn benchmark >35%: 16 + cảnh báo kiểm tra dữ liệu
  - Cao hơn benchmark 0-15%: 13
  - Cao hơn benchmark 15-35%: 9
  - Cao hơn benchmark 35-60%: 5
  - Cao hơn benchmark >60%: 2

## Public profile

Guest chỉ thấy 6 nhóm tiêu chí, không thấy công thức chi tiết.
Investor đã login thấy điểm từng nhóm tiêu chí của mọi business public profile.

## Admin

Admin vẫn chỉnh `Business Quality Score` theo thang 0-100.
Nếu tick `Giữ điểm Admin nhập`, hệ thống giữ điểm Admin nhập thay vì tự động ghi đè.

## Apply

1. Upload/copy files trong patch vào branch `beta-reference`.
2. Chạy migration `supabase/migrations/20260706_business_quality_score_v1.sql` trong Supabase SQL Editor.
3. Nếu có local repo:

```bash
node scripts/apply-business-quality-score-v1.mjs
npm run build
git add .
git commit -m "feat: add Business Quality Score v1"
git push origin beta-reference
```

4. Test:
- `/businesses/:slug` guest: thấy giải thích 6 tiêu chí, không lộ công thức chi tiết.
- `/businesses/:slug` investor login: thấy điểm từng tiêu chí.
- `/dashboard/business`: thấy breakdown.
- `/admin/business-review`: có input BQS 0-100 và checkbox giữ điểm Admin nhập.
