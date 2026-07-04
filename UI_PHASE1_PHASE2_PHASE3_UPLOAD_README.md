# Deals68 Phase 1 + 2 + 3 Upload README

Patch này gộp 3 đợt để upload một lần lên GitHub:

- Phase 1: UI Core + Home + Market Partner wording/routes.
- Phase 2: Businesses listing + Deal card + Business Detail + Quality Score gating.
- Phase 3: Investor list + Investor detail + Privacy/anonymisation.

## Cách upload qua GitHub web

1. Giải nén file zip.
2. Vào repo `jackphi2023/deals68`.
3. Upload/overwrite đúng các file theo cấu trúc thư mục trong patch.
4. Không upload nguyên file `.zip` vào repo.
5. Không upload `node_modules`, `dist`, hoặc `package-lock.json`.
6. Commit message đề xuất: `Phase 1-3 UI core businesses investors`.
7. Netlify: Deploys → Trigger deploy → Clear cache and deploy site.

## Test nhanh sau deploy

- `/`
- `/businesses`
- Click một deal card → `/businesses/:slug`
- `/investors`
- Click một investor card → `/investors/:code`
- `/register/market-partner`
- `/dashboard/market-partner`
- `/admin/market-partners`

## Privacy notes

Investor public listing/detail không render các field riêng tư:

- `private_name`
- `private_website`
- `private_email`
- `private_phone`

Trong code, `listInvestors()` và `getInvestorByCode()` dùng public select whitelist. `getInvestorByOwner()` vẫn giữ select `*` để dashboard chủ sở hữu có thể dùng cho profile của chính họ.

## Supabase role note

UI hiển thị là `Market Partner`, nhưng internal role vẫn giữ là `affiliate` để không phá enum/RLS hiện tại. Nếu muốn đổi schema thật sang `market_partner`, làm migration riêng sau.
