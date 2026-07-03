# Deals68.com — DATA_FIELDS

UI field → data source mapping. Every value a screen renders must resolve to a
Supabase column (or a derived/computed value). **Privacy is enforced server-side (RLS)**,
not by hiding in the client. Columns marked 🔒 must never reach a public/teaser payload.

Table names follow the V1.5 schema in the brief. Types are indicative.

---

## `app_accounts` — identity & gating
| UI field | Column | Type | Notes |
|----------|--------|------|-------|
| Role | `role` | enum(guest,business,investor,advisor,affiliate,admin) | drives routing + RBAC |
| Account status | `status` | enum(active,pending,hidden,banned) | |
| Dashboard access | `dashboard_login_enabled` | bool | gate write actions |
| Payment gate | `payment_gate` | enum(unpaid,paid,expiring,expired) | controls send/connect |
| Email 🔒 | `email` | text | never rendered on frontend |

## `business_profiles` — teaser + full
| UI field | Column | Type | Notes |
|----------|--------|------|-------|
| Teaser title | `teaser_title` | text | anonymised; shown public |
| Internal name 🔒 | `legal_name` | text | unlock after connection |
| Tax code 🔒 | `tax_code` | text | admin verify only |
| Country / Region / City | `country_id` `region` `location_id` | fk | region→country filter |
| Industry | `industry_id` | fk | |
| Deal type | `deal_type` | enum | raise / sell-stake / sell-all / debt |
| Revenue | `revenue` | numeric | label: Actual/Estimate |
| EBITDA / margin | `ebitda` `margin` | numeric | |
| Growth | `growth` | numeric % | |
| Valuation expected | `valuation` | numeric | |
| Ask amount | `ask` | numeric | |
| Stake offered | `stake` | numeric % | |
| Status | `status` | enum(live,pending_review,hidden,expiring,expired) | Badge |
| Plan / quota | `plan` `proposal_quota` | enum / int | Standard 100 · Priority 200 |
| Quality score | *derived* | int 0–100 | from completeness+activity; investor-gated |
| Currency | *derived* | VND if country=VN else USD | admin override |

## `business_files` 🔒
| UI field | Column | Notes |
|----------|--------|-------|
| File title | `file_title` | Profile/Financials/Legal/Teaser-IM/Other |
| Category | `category` | enum |
| Visibility | `visibility` | public / locked |
| Storage path 🔒 | `storage_path` | signed short-lived URL only; never exposed |

## `business_images`
| UI field | Column | Notes |
|----------|--------|-------|
| Image (max 6) | `storage_path` | ≤10MB each |
| Blurred variant | `storage_path_blurred` | admin anonymise |
| Caption / alt | `caption` `alt_text` | |
| Blur state | `is_blurred` | admin flag |
| Sort / hero | `sort_order` `is_hero` | |

## `investor_profiles` — public/anonymised
| UI field | Column | Notes |
|----------|--------|-------|
| Investor type | `investor_type` | Angel/VC/PE/FamilyOffice/Corporate/Lender/SearchFund |
| Current country | `country_id` | |
| Geographies of interest | `geographies` | region/country array |
| Ticket size min–max | `ticket_min` `ticket_max` | |
| Preferred sectors | `industries` | array |
| Deal types | `deal_types` | array |
| Stage | `stage` | |
| Activity level | `activity_level` | ranking input |
| Verified / active badge | `verification_status` | |
| Ranking score | *derived* | activity+deals+approved-proposals+admin_weight, sort desc |
| Real name / website / LinkedIn 🔒 | in `investor_private_sources` | admin-only |

## `investor_private_sources` 🔒 / `investor_contacts` 🔒
Admin-only real name, website, source data, contact person. **Email never reaches frontend.**
Website/contact unlock only after an admin-approved proposal, if admin allows.

## `payment_orders`
| UI field | Column | Notes |
|----------|--------|-------|
| Order ref | `order_ref` | |
| Method | `method` | QR / Senpay / Paypal |
| Amount / currency | `amount` `currency` | |
| Status | `status` | pending/paid/expired (7-day expiry) |

## `connections` / `messages`
| UI field | Column | Notes |
|----------|--------|-------|
| Request status | `status` | sent/accepted/rejected/expired/blocked |
| NDA consent | `nda_accepted_at` | timestamp |
| Message body | `messages.body` | chat opens only when status=accepted |

## `proposals`
| UI field | Column | Notes |
|----------|--------|-------|
| Business name | fk → `business_profiles` | |
| Capital & stake ask | `ask` `stake` | |
| EBITDA % | `ebitda_pct` | |
| Quality score | *derived* | approval basis |
| Status | `status` | pending/approved/declined; quota-capped 100/200 |

## `data_requests` (investor → admin → business)
| UI field | Column | Notes |
|----------|--------|-------|
| Requester | `investor_id` | |
| Target business | `business_id` | |
| Status | `status` | requested/approved/fulfilled |

## `affiliates` / `commissions` / `payouts`
Referral code, 15% discount, tier, commission (only on successful non-refunded payment),
payout period/amount/status/dates. Admin updates payout status.

---

### Derived / computed (not stored raw)
- **Quality score**, **Ranking score**, **Currency**, **Fit score**, price totals
  (base × term − term-discount − promo). Compute server-side or in a shared util so
  UI never re-implements the formula divergently.
