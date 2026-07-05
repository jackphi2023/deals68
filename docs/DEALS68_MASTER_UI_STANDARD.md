# Deals68 Master UI Standard v1.0

Tài liệu này là **master UI baseline** để tiếp tục dựng Deals68.com theo Spec v1.3. Mục tiêu là thống nhất giao diện trên web/mobile, tránh sửa chắp vá gây lệch `ui-reference`, sai class CSS hoặc vỡ layout.

## 1. Nguồn chuẩn bắt buộc

Thứ tự ưu tiên khi dựng/sửa UI:

1. `ui-reference/*.dc.html` là chuẩn giao diện đầu tiên.
2. `src/styles/design-tokens.css` là nguồn màu, font, spacing, radius, shadow.
3. `src/styles/base.css` là lưới an toàn toàn cục: typography, form, button, chống tràn mobile.
4. `src/styles/app.css` là component shared.
5. `src/styles/pages/<page>.css` chỉ dùng để port chính xác từng page.
6. React TSX chỉ chuyển `href` → `Link`, `sc-for` → `.map`, `sc-if` → conditional, `{{ }}` → data thật.

Không được tự đổi section order, tự redesign, hoặc dùng inline style cho layout mới.

## 2. CSS architecture

`src/styles/index.css` là entry duy nhất, import theo layer:

```css
@layer d68-legacy, d68-base, d68-components, d68-utilities, d68-overrides;
```

Ý nghĩa:

- `d68-legacy`: CSS cũ còn tồn tại, sẽ xóa dần.
- `d68-base`: design tokens, base, shared app components.
- `d68-components`: CSS trích xuất từ UI Reference.
- `d68-utilities`: utilities trích xuất từ UI Reference.
- `d68-overrides`: page CSS đang port/hardening. Mục tiêu dài hạn là giảm dần override.

## 3. Quy tắc page-level

Mỗi page có CSS riêng:

```text
src/styles/pages/home.css
src/styles/pages/businesses.css
src/styles/pages/business-detail.css
src/styles/pages/investors.css
src/styles/pages/investor-detail.css
src/styles/pages/pricing.css
src/styles/pages/valuation.css
src/styles/pages/auth.css
src/styles/pages/dashboard.css
src/styles/pages/admin.css
src/styles/pages/static.css
```

Khi sửa page:

- Chỉ sửa file TSX và CSS tương ứng của page đó.
- Không sửa global style nếu lỗi chỉ nằm ở một page.
- Không thay inline style bằng inline style mới; phải dùng class.
- Nếu sửa logic, giữ nguyên class/layout.
- Nếu sửa UI, phải đối chiếu `ui-reference` trước.

## 4. Responsive rules

Bắt buộc test 3 mốc:

```text
375px mobile
768px tablet
1440px desktop
```

Không được có horizontal scroll toàn trang. Bảng rộng phải nằm trong `.d68-table-wrap` để scroll riêng. Text dài, email, URL, mã hồ sơ phải dùng:

```css
.d68-breakall
.d68-clamp-2
.d68-clamp-3
```

Form filter/list phải có:

```css
min-width: 0;
max-width: 100%;
overflow-wrap: anywhere;
```

## 5. Public/private data UI

Public UI chỉ hiển thị dữ liệu từ public select/snapshot:

```text
visible = true
status = active
public_snapshot_json is not null
```

Không public:

```text
owner_id
company_name_private
financial_input
quality_breakdown
pending_changes_json
last_approved_by
pending_submitted_by
private_email
private_phone
private_name
private_website
file_path
image_path
admin_note
service_role key
```

## 6. Definition of Done trước khi gửi patch

Patch chỉ được gửi khi đã kiểm tra:

- Route không trắng trang.
- Build syntax pass hoặc nêu rõ chưa chạy build.
- Desktop/tablet/mobile không vỡ layout.
- Không thêm section ngoài UI Reference.
- Không lộ private data.
- Header/nav/i18n không làm đổi URL sai.
- Form dài không tràn ngang.
- Table có scroll riêng.
- Public count/list/filter không lệch rõ do query khác nhau.

## 7. Prompt bắt buộc cho AI/Dev trước khi sửa

```text
TUÂN THỦ TUYỆT ĐỐI SPEC/UI REFERENCE.
Trước khi sửa, hãy đọc GitHub hiện tại và mô tả phạm vi sửa.
Không tự ý redesign. Không thay layout. Không thay class CSS. Không đổi inline style thay cho CSS hiện có. Không sửa file ngoài phạm vi. Không thay toàn bộ file nếu chỉ cần sửa vài dòng, trừ khi tôi duyệt rõ.
Nếu chỉ sửa logic thì giữ nguyên UI.
Nếu sửa UI thì phải dựa trên UI Reference, không tự dựng giao diện mới.
Trước khi gửi file, phải kiểm tra rủi ro: TypeScript/build, route, Supabase query, public/private data, responsive UI, class CSS hiện hữu, ảnh/logo/tên DN có nguy cơ lộ danh tính, count/list/filter có bị lệch không.
Nếu chưa chắc, dừng lại và hỏi. Không tạo file.
Tôi luôn cập nhật code qua GitHub Web, nên hãy cung cấp file hoàn chỉnh đúng đường dẫn, commit message, và mô tả route cần test sau deploy.
```
