# Deals68 beta-reference — Baseline + Business Detail port patch

## Mục tiêu
Patch này gộp baseline hardening Home + /businesses trước đó và thêm Business Detail để deploy/test chung một lần trên Netlify branch `beta-reference`.

## File trong patch
- `src/lib/data.ts`
- `src/pages/Home.tsx`
- `src/pages/Businesses.tsx`
- `src/pages/BusinessDetail.tsx`
- `src/styles/index.css`
- `src/styles/pages/home.css`
- `src/styles/pages/business-detail.css`

## Business Detail — phạm vi sửa
- Port lại `/businesses/:slug` theo block order của `ui-reference/Deals68 Business Detail.dc.html`:
  - breadcrumb
  - status badges + title + lead
  - image slider/thumbnail
  - key facts grid
  - highlights
  - business profile
  - financials table
  - documents locked/public state
  - disclaimer
  - transaction sidebar
  - connect card / locked fields
  - verification card
  - similar businesses
  - FAQ
- Dùng CSS class riêng trong `src/styles/pages/business-detail.css`, không dùng inline redesign cũ.
- Data lấy qua:
  - `getBusinessBySlug(slug)`
  - `getBusinessDetailAssets(b.id, { publicOnly: true })`
  - `listBusinesses()` cho similar businesses.
- Không render private fields: company_name_private, owner_id, financial_input, pending_changes_json, private contact, file_path, image_path.
- Deal type render theo VI/EN, không để raw English như `asset transfer/fundraise` trên UI tiếng Việt.

## Baseline hardening giữ lại từ patch trước
- Home business cards dùng class riêng, không dùng `.d68-home-role-card`.
- Home không fallback public slug sang `username`.
- `/businesses` map nhãn deal type VI/EN.
- `data.ts` bỏ fallback `row.username || row.id` trong public slug.
- `data.ts` mở rộng synonym filter dealType nhưng giữ public guard.

## Không đụng tới
- Investors
- Investor Detail
- Pricing / Valuation
- Dashboards
- Admin
- Static pages
- Supabase schema/migrations
- Netlify config

## Commit message đề xuất
`feat(beta-reference): port business detail and harden public baseline`

## Test sau deploy
- `/`
- `/en`
- `/businesses`
- `/en/businesses`
- `/businesses/<slug thật>`
- `/en/businesses/<slug thật>`

Checklist:
- Home business cards không vỡ.
- `/businesses` tiếng Việt không còn raw deal_type tiếng Anh.
- Business Detail không trắng, không vỡ layout 1440/768/375.
- Business Detail không lộ tên DN thật/private fields.
- Image/detail/docs chỉ hiện public/sanitized/locked states.
- Interest/request data nếu chưa login redirect đúng login.

## Rollback
Revert commit vừa upload trên branch `beta-reference` hoặc thay lại các file từ commit trước đó.
