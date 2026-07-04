# Deals68 Beta deploy checklist

## Supabase

- [ ] Run 0001 schema migration
- [ ] Run 0002 country calling codes seed
- [ ] Run 0003 quality criteria seed
- [ ] Add env vars locally
- [ ] Run `npm run seed`
- [ ] Verify buckets `business-files-private`, `business-images-public`
- [ ] Verify Admin profile active
- [ ] Verify 6 seeded businesses visible
- [ ] Verify 624 imported investors visible
- [ ] Verify promo codes `FREE10JULY-DN16` and `FREE10JULY-INV16`

## Functional tests

- [ ] Home search Businesses
- [ ] Home search Investors
- [ ] Business detail: guest sees demo Quality criteria only
- [ ] Investor login sees full Quality breakdown
- [ ] Business uploads Word/Excel/PPT/PDF file
- [ ] Business uploads image
- [ ] Business edits sensitive financial fields; public profile unchanged until Admin approval
- [ ] Investor saves business
- [ ] Investor expresses interest
- [ ] Business accepts interest
- [ ] Investor sends Request Data
- [ ] Business marks Request Data fulfilled
- [ ] Admin edits 6 seeded businesses
- [ ] Admin hides/shows business and public count/list updates
- [ ] Admin edits investor and hides/shows investor
- [ ] Admin creates promo with quota 16 until 10/7/2026
- [ ] Register Business from Pricing preserves role and selects Standard/Featured in register step

## Netlify

- [ ] Connect GitHub repo
- [ ] Set build command `npm run build`
- [ ] Set publish directory `dist`
- [ ] Add `VITE_SUPABASE_URL`
- [ ] Add `VITE_SUPABASE_ANON_KEY`
- [ ] Add custom domain `deals68.com`
