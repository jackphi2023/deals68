# Deals68.com — E2E Test Checklist

Mirrors Admin → Dev Handoff in the app. Use this as a regression pass before every deploy, and
after migrating any flow off the localStorage mock onto Supabase.

## Signup & payment gate
- [ ] Signup Business/Investor/Advisor → creates account + profile in `Pending`/`draft` state
- [ ] Bank QR payment step shows correct amount, transfer note (`DEALS68-{order_code}`), and 7-day hold
- [ ] Admin confirms bank transfer → account moves to `pending_admin_review`
- [ ] Admin approves → dashboard unlocks, business profile goes `Live`
- [ ] 100%-off promo code skips the bank-transfer step entirely, still requires Admin approval
- [ ] Login for a `payment_pending` / `pending_admin_review` / `hidden` / `expired` account shows
      the correct gated message (not a silent failure or wrong copy)

## Business Quality Score
- [ ] Admin → Business Quality Score: edit a criterion's VI/EN label and weight → persists
- [ ] Toggle a criterion off → total weight and every business's score recompute
- [ ] Add a custom criterion (label + weight + default %) → appears in every business's score breakdown
- [ ] Delete a custom criterion → disappears from scoring; "Reset to defaults" restores the 8 built-ins
- [ ] Public Deal page: investor NOT logged in → sees score/100 + criterion names only + lock wording
- [ ] Public Deal page: investor logged in → sees full per-criterion point breakdown, no lock wording

## Pending re-review (sensitive edits)
- [ ] Business edits financials/deal terms/valuation reason on a `Live` profile → status flips to
      `Pending review`, banner shows on Dashboard Overview + header badge changes
- [ ] Flagged profile appears in Admin → Chờ duyệt → "chờ duyệt lại" list with the reason + date
- [ ] Admin clicks "Duyệt lại & Hiển thị" → status returns to `Live`, banner disappears
- [ ] Editing a NON-sensitive field (e.g. highlights only) does NOT trigger re-review

## Investor account / login
- [ ] Self-registered investor logs in → `session.investorCode` matches their own account's code
      (not the hardcoded demo account's code)
- [ ] Investor Dashboard header shows the investor's real name (from registration) and code —
      not the demo account's name — for any non-demo investor
- [ ] Investor can rename themselves in Profile → name persists and updates the header

## Request Data workflow
- [ ] Investor: Saved businesses tab → pick a document type → "Request data" creates a `pending` entry
- [ ] Entry appears in Admin → Request Data Queue with correct investor code / business / field / date
- [ ] Entry appears (read-only) in the target Business Dashboard's Documents tab
- [ ] Admin marks Fulfilled/Declined → status updates consistently everywhere it's shown

## Interested investors / connect flow
- [ ] Logged-in investor clicks "Bày tỏ quan tâm" on a Deal page → button flips to "✓ đã bày tỏ quan tâm"
- [ ] Logged-out user clicking the same button is routed to Login
- [ ] Business Dashboard "Nhà đầu tư Quan tâm" tab lists the interest with investor type/country/ticket
- [ ] Business clicks "Đồng ý kết nối" → status flips to Connected; contact info shows only if the
      investor's Privacy config opted into sharing email/phone

## Investor Dashboard (criteria, watchlist, proposals, privacy)
- [ ] Investment criteria tab: sector/revenue/EBITDA filters update the recommendations grid,
      newest businesses first, correct empty state when nothing matches
- [ ] Save/unsave a business updates the "Doanh nghiệp đã lưu" tab immediately
- [ ] Proposals received show business name, ask amount + %, EBITDA margin, and Quality Score
- [ ] Privacy tab: email/phone share toggles + country-code phone persist and gate contact reveal
      correctly on the Business side (see "Interested investors" above)

## Affiliate
- [ ] Register Affiliate (name/email/password/payout method) → account created as
      `pending_admin_review`, NOT immediately active
- [ ] New affiliate appears in Admin → Chờ duyệt with role "Affiliate"
- [ ] Admin approves → affiliate can log in
- [ ] Affiliate Dashboard shows the REAL registrant's name/code and honest zeroed stats
      (not the seeded demo account's referral history)
- [ ] The pre-existing demo affiliate account (`affiliate@deals68.com` / `deals68aff`) still logs
      in and shows its full seeded referral/payout history unchanged

## Advisor (placeholder scope)
- [ ] Register Advisor → payment/approval flow behaves like other paid roles
- [ ] Post-registration screen and Login gate mention the Dashboard is "coming soon"
- [ ] After approval, login redirects to the Advisor Dashboard placeholder (not a dead link or
      a silent fallback to the Businesses listing)

## Pricing
- [ ] Business role: Gói dịch vụ toggle (Thường/Ưu tiên) changes the calculated price (+30%)
- [ ] "Gói theo vai trò" cards: Doanh nghiệp · Thường (500k₫, 100 proposal) and
      Doanh nghiệp · Ưu tiên (650k₫, 200 proposal) both present; no stray "Phổ biến" badge

## SEO
- [ ] Every public page (Home, Businesses, Business Detail, Deal, Investors, Investor Detail,
      Pricing, Valuation) has valid JSON-LD (`JSON.parse` succeeds) and self-referencing
      `hreflang` (vi/en/x-default) matching its canonical URL
- [ ] `robots.txt` disallows `/dashboard/`, `/admin`, `/login`, `/register/`, password-reset pages
- [ ] `sitemap.xml` lists only the `index,follow` routes and matches `robots.txt`
- [ ] Private/dashboard/admin pages carry `noindex` and are excluded from the sitemap

## General
- [ ] Language toggle (VI/EN) persists correctly across every dashboard tab and public page
- [ ] No `never resolved` console warnings beyond known-benign streaming placeholders on
      `<option>` loops (verify against current console output before shipping)
