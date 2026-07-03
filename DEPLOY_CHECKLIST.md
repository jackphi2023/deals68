# Deals68 v2 QA Checklist

## Build and route coverage
- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npm run check:routes` shows at least 40 screens. Current configured screens: 79.

## Supabase
- [ ] Apply migrations 0001 -> 0004.
- [ ] Create/verify storage buckets: `business-files-private`, `business-images-public`.
- [ ] Run `npm run seed` locally using service role key.
- [ ] Confirm admin login: `admin@deals68.com / deals68Admin68!`.
- [ ] Confirm 6 business logins.
- [ ] Confirm investor example: `inv_0001 / deals68MDE`.

## Business flow
- [ ] Register business from Pricing.
- [ ] Select Standard or Featured at Register Business.
- [ ] Payment pending state.
- [ ] Upload Word/Excel/PPT/PDF.
- [ ] Upload images.
- [ ] Edit sensitive financial data and verify pending review, not immediate public merge.
- [ ] Admin approves pending changes.

## Investor flow
- [ ] Investor Dashboard defaults to English.
- [ ] Update criteria: sectors, revenue range, EBITDA range.
- [ ] Save business from detail page.
- [ ] Recommended businesses sorted newest first.
- [ ] Proposal list displays business name, capital/stake, EBITDA, Business Quality Score.
- [ ] Privacy settings update email and WhatsApp/Zalo country code.

## Admin flow
- [ ] Admin can edit and hide/show all 6 seeded businesses.
- [ ] Admin can edit/hide/show investors.
- [ ] Public counts and filters update after hide/show.
- [ ] Admin can create promo code with role/quota/date constraints.
- [ ] Admin can edit Business Quality criteria.

## Internationalization
- [ ] Country code dropdown includes Top 5 and more.
- [ ] User profile stores country/language/timezone/phone country.
- [ ] EN/VI wording renders without broken ampersands or encoding issues.

## Launch gates
- [ ] Netlify deploy from GitHub.
- [ ] `deals68.com` and `www.deals68.com` domain connected.
- [ ] Supabase Auth Site URL and redirect URLs updated to production domain.
- [ ] Email templates and SMTP configured.
- [ ] Payment webhook disabled/placeholder unless PSP credentials are ready.
