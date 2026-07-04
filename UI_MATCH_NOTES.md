# Deals68 UI Match Notes — Phase 1 + 2 + 3

## Scope

Patch này gộp:

1. UI Core + Home + Market Partner.
2. Businesses listing + Deal card + Business Detail + Quality Score gating.
3. Investor list + Investor detail + privacy/anonymisation.

## UI reference

Chuẩn đối chiếu vẫn là Netlify UI Reference:

https://glittering-unicorn-afbf10.netlify.app/

React app là bản production-beta, nên mục tiêu hiện tại là đồng bộ dần public pages theo reference trước khi qua dashboard/admin.

## Phase 3 privacy/anonymisation

- Public investor list/detail dùng whitelist fields.
- Không gửi `private_name`, `private_website`, `private_email`, `private_phone` xuống public investor pages.
- Business chưa có approved connection chỉ thấy teaser investor profile.
- Admin private-source management sẽ làm ở Admin phase sau.

## QA required

Test 4 viewport:

- Desktop 1440
- Laptop 1280
- Tablet 768
- Mobile 375

Routes cần test:

- `/`
- `/businesses`
- `/businesses/:slug`
- `/investors`
- `/investors/:code`
- `/register/market-partner`
