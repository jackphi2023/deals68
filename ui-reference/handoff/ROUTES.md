# Deals68.com — ROUTES

Maps every public URL to the screen file and the top-level components it renders.
Screen files are the approved HTML designs (`*.dc.html`). React devs should mirror
this route table 1:1 in the router. `Auth` = required role; `–` = public.

| # | URL | Screen | Design file | Auth | Key components |
|---|-----|--------|-------------|------|----------------|
| 1 | `/` | Home | `Deals68 Home.dc.html` | – | Header, Hero+SearchTabs, TrustStats, RoleCards, FeaturedDeals (DealCard×6), RegionGrid, IndustryGrid, HowItWorks, ValuationCTA, Footer |
| 2 | `/businesses` | Businesses listing | `Deals68 Businesses.dc.html` | – | Header, FilterBar, FilterSidebar (region→country), DealCard grid, SortDropdown, Pagination, Footer |
| 3 | `/businesses/:id` | Business detail | `Deals68 Business Detail.dc.html` | – (teaser) | Header, ProfileHeader, FinancialTable, Highlights, DocumentsList (locked), QualityScore, ConnectCTA, FAQ, SimilarDeals, Footer |
| 4 | `/businesses/deal` (deal view) | Deal detail | `Deals68 Deal.dc.html` | – (teaser) / investor (full) | Header, TeaserHeader, QualityScore (gated), FinancialTable, Documents, ExpressInterest modal, Footer |
| 5 | `/investors` | Investors listing | `Deals68 Investors.dc.html` | – | Header, FilterBar, InvestorCard grid, RankingSort, Pagination, Footer |
| 6 | `/investors/:id` | Investor detail | `Deals68 Investor Detail.dc.html` | – (teaser) | Header, InvestorHeader (anonymised), CriteriaPanel, TicketRange, Geographies, SendProposal CTA, Footer |
| 7 | `/pricing` | Pricing | `Deals68 Pricing.dc.html` | – | Header, PriceEstimator (role/country/term/promo), PlanCard×3, DiscountTiers, PayMethods, FAQ, Footer |
| 8 | `/valuation` | Valuation tool | `Deals68 Valuation.dc.html` | – | Header, ValuationForm, ResultRange, ConfidenceMeter, LeadCapture, Disclaimer, Footer |
| 9 | `/login` | Login | `Deals68 Login.dc.html` | – | Header (minimal), AuthCard, Form, Footer |
| 10 | `/forgot-password` | Forgot password | `Deals68 Forgot Password.dc.html` | – | AuthCard, Form (email), Alert |
| 11 | `/reset-password` | Reset password | `Deals68 Reset Password.dc.html` | – | AuthCard, Form (new password), Alert |
| 12 | `/register/business` | Register Business | `Deals68 Register Business.dc.html` | – | StepperWizard (Identity→Classification→Financials→Deal→Files→Images→Preview), ValuationPanel |
| 13 | `/register/investor` | Register Investor | `Deals68 Register Investor.dc.html` | – | StepperWizard + membership checkout |
| 14 | `/register/advisor` | Register Advisor | `Deals68 Register Advisor.dc.html` | – | StepperWizard + membership checkout |
| 15 | `/register/affiliate` | Register Affiliate | `Deals68 Register Affiliate.dc.html` | – | AuthCard, Form, terms consent |
| 16 | `/dashboard/business` | Business Dashboard | `Deals68 Business Dashboard.dc.html` | business | DashboardShell (Sidebar+Topbar), Tabs (Profile, Financials, Files, Images, Interested investors, Requests, Plan, Settings), StatusBanner, VCP help box |
| 17 | `/dashboard/investor` | Investor Dashboard | `Deals68 Investor Dashboard.dc.html` | investor | DashboardShell, Tabs (Profile, Investment criteria, Saved businesses, Proposals, Privacy, Alerts, Contacts, Security) |
| 18 | `/dashboard/affiliate` | Affiliate Dashboard | `Deals68 Affiliate Dashboard.dc.html` | affiliate | DashboardShell, ReferralLink, CommissionTable, PayoutsTable |
| 19 | `/dashboard/advisor` | Advisor Dashboard | `Deals68 Advisor Dashboard.dc.html` | advisor | DashboardShell, ComingSoon placeholder |
| 20 | `/admin/login` | Admin Login | `Deals68 Admin Login.dc.html` | – | AuthCard (admin theme), Form |
| 21 | `/admin` | Admin Dashboard | `Deals68 Admin.dc.html` | admin | AdminShell, Sections (Payments, Business Review, Investor Manager, Investor Contacts, Proposal Manager, Affiliate Manager, Data Requests) |

## Notes
- **Language**: every screen is bilingual VI/EN via a `[data-lang]` attribute on `<body>`; strings toggle with `.l-vi`/`.l-en`. In React, drive this with an i18n context, not CSS display toggles.
- **Currency**: VND when `country = Vietnam`, USD otherwise; admin can override.
- **Auth gates**: dashboards require the matching role + an *active* paid plan for write actions. Guests hitting a dashboard route → redirect to `/login`.
- **SEO robots**: public marketing/listing routes `index,follow`; auth, dashboard, admin, register and reset routes `noindex,nofollow`.
