# PAGE SIMPLIFICATION - SOFSAVDO

**Date**: 2026-08-01  
**Goal**: Classify every page: Current, Future, Merge, Remove, Hidden  
**Principle**: "How can an ordinary person understand and use this platform within 2 minutes?"

---

## CREATOR PAGES

### Authentication

#### `/creator/auth/login`
**Current**: Login page with email/password  
**Future**: SIMPLIFY - Phone + SMS code only  
**New Path**: `/creator/auth/login`  
**Reason**: Email is less common in Uzbekistan. Phone + SMS is simpler and more secure.  
**Backend Impact**: Update auth logic to support phone-only login

#### `/creator/auth/register`
**Current**: 8-step registration wizard  
**Future**: SIMPLIFY - 3-step registration (name, phone, city, social link)  
**New Path**: `/creator/auth/register`  
**Reason**: Current 8-step wizard causes abandonment. Most data not needed upfront.  
**Backend Impact**: Simplify onboarding service, progressive data collection

#### `/creator/auth/forgot-password`
**Current**: Password reset flow  
**Future**: REMOVE - No passwords with phone-only login  
**New Path**: N/A  
**Reason**: Phone + SMS login eliminates password reset need.  
**Backend Impact**: Remove password reset endpoints

---

### Dashboard

#### `/creator/dashboard`
**Current**: Complex dashboard with 30+ elements, charts, multiple sections  
**Future**: SIMPLIFY - Simple earnings page with 10 elements  
**New Path**: `/creator/earnings`  
**Reason**: Current dashboard is overwhelming. Creators care about earnings, not technical metrics.  
**Backend Impact**: Simplify dashboard service, remove complex aggregations

---

### Products

#### `/creator/campaigns`
**Current**: Campaign catalog with complex filters, campaign detail pages  
**Future**: SIMPLIFY - Product catalog with simple cards  
**New Path**: `/creator/products`  
**Reason**: "Campaign" is technical. "Product" is natural. Complex filters cause analysis paralysis.  
**Backend Impact**: Rename endpoint, simplify filters, merge Campaign/Offer/Product

#### `/creator/campaigns/[id]`
**Current**: Campaign detail with 20+ data points, requirements, deadlines  
**Future**: SIMPLIFY - Product detail with 5 data points  
**New Path**: `/creator/products/[id]`  
**Reason**: Too much information. Creators just need product info and link.  
**Backend Impact**: Simplify response DTO, hide technical fields

#### `/creator/my-campaigns`
**Current**: My Campaigns with status, links, materials, statistics  
**Future**: SIMPLIFY - My Products with cards showing key stats  
**New Path**: `/creator/my-products`  
**Reason**: Separate detail page unnecessary. Everything on card.  
**Backend Impact**: Simplify service, remove detail page

#### `/creator/promo-materials`
**Current**: Separate page to download banners, images, videos  
**Future**: REMOVE - Integrate into product detail or remove entirely  
**New Path**: N/A  
**Reason**: Unnecessary step. Product images are sufficient.  
**Backend Impact**: Remove separate page, use product images

---

### Content

#### `/creator/content`
**Current**: Content creation, submission, review workflow  
**Future**: REMOVE - No content approval needed  
**New Path**: N/A  
**Reason**: Content approval is unnecessary friction. Trust creators or use post-audit.  
**Backend Impact**: Keep table for compatibility, don't use in new flow

#### `/creator/content/[id]`
**Current**: Content detail with versions, comments, attachments  
**Future**: REMOVE  
**New Path**: N/A  
**Reason**: No content submission means no detail page needed.  
**Backend Impact**: Keep table, hide from UI

---

### Sales & Analytics

#### `/creator/sales`
**Current**: Sales table with filters, details  
**Future**: MERGE - Show recent transactions on Earnings page  
**New Path**: `/creator/earnings`  
**Reason**: Separate sales page is unnecessary. Show as recent transactions.  
**Backend Impact**: Merge into earnings service

#### `/creator/commissions`
**Current**: Commissions table with status, details  
**Future**: MERGE - Show as recent transactions on Earnings page  
**New Path**: `/creator/earnings`  
**Reason**: Creators don't understand distinction between commissions and earnings.  
**Backend Impact**: Merge into earnings service

#### `/creator/clicks`
**Current**: Clicks analytics with charts  
**Future**: MERGE - Show simple "Views" on My Products cards  
**New Path**: `/creator/my-products`  
**Reason**: Too technical. "Views" is sufficient.  
**Backend Impact**: Simplify to view count on product cards

---

### Money

#### `/creator/balance`
**Current**: Balance page with available, pending, ledger  
**Future**: MERGE - Single Earnings page with available, pending  
**New Path**: `/creator/earnings`  
**Reason**: Three separate money pages is confusing.  
**Backend Impact**: Merge into single earnings service

#### `/creator/payouts`
**Current**: Payouts page with history, request form  
**Future**: MERGE - Withdraw modal on Earnings page  
**New Path**: `/creator/earnings`  
**Reason**: Separate page unnecessary. Simple modal is sufficient.  
**Backend Impact**: Simplify to modal on earnings page

#### `/creator/payout-methods`
**Current**: Payout methods management  
**Future**: MERGE - Single field in Profile  
**New Path**: `/creator/profile`  
**Reason**: Separate page unnecessary. Single field in profile is sufficient.  
**Backend Impact**: Move to profile service

---

### Profile

#### `/creator/profile`
**Current**: Complex profile with tabs, social accounts, payout methods  
**Future**: SIMPLIFY - Single page with 5 fields  
**New Path**: `/creator/profile`  
**Reason**: Current profile has too many fields. Most not needed.  
**Backend Impact**: Simplify profile service, remove tabs

#### `/creator/onboarding`
**Current**: Onboarding wizard (same as registration)  
**Future**: MERGE - Part of registration flow  
**New Path**: `/creator/auth/register`  
**Reason**: Separate onboarding page unnecessary. Part of registration.  
**Backend Impact**: Merge into registration flow

---

### Notifications

#### `/creator/notifications`
**Current**: Notifications list with filters, preferences  
**Future**: SIMPLIFY - Simple list with clear messages  
**New Path**: `/creator/notifications`  
**Reason**: Current notifications are complex. Simplify to clear messages.  
**Backend Impact**: Simplify notification service

#### `/creator/notification-preferences`
**Current**: Per-category notification settings  
**Future**: REMOVE - Simple on/off toggle in settings  
**New Path**: `/creator/settings` (if needed) or remove entirely  
**Reason**: Too complex. Most users don't configure per-category settings.  
**Backend Impact**: Remove separate page, add simple toggle if needed

---

### Extras

#### `/creator/referrals`
**Current**: Creator-to-creator referral program  
**Future**: HIDE - Backend only, hide from main UI  
**New Path**: N/A  
**Reason**: Feature creep at current scale.  
**Backend Impact**: Keep tables, hide from UI

#### `/creator/fund`
**Current**: Creator fund contributions  
**Future**: HIDE - Backend only, hide from main UI  
**New Path**: N/A  
**Reason**: Internal incentive program.  
**Backend Impact**: Keep tables, hide from UI

#### `/creator/leaderboard`
**Current**: Creator rankings  
**Future**: HIDE - Backend only, hide from main UI  
**New Path**: N/A  
**Reason**: Gamification is distraction from core value.  
**Backend Impact**: Keep tables, hide from UI

#### `/creator/competitions`
**Current**: Competitions list  
**Future**: HIDE - Backend only, hide from main UI  
**New Path**: N/A  
**Reason**: Gamification is distraction from core value.  
**Backend Impact**: Keep tables, hide from UI

---

## ADMIN PAGES

### Authentication

#### `/admin/login`
**Current**: Admin login with email/password  
**Future**: KEEP - Email/password is fine for staff  
**New Path**: `/admin/login`  
**Reason**: Staff accounts can use email/password. No change needed.  
**Backend Impact**: No change

#### `/admin/unauthorized`
**Current**: Unauthorized access page  
**Future**: KEEP - Needed for security  
**New Path**: `/admin/unauthorized`  
**Reason**: Security requirement.  
**Backend Impact**: No change

#### `/admin/forbidden`
**Current**: Forbidden access page  
**Future**: KEEP - Needed for security  
**New Path**: `/admin/forbidden`  
**Reason**: Security requirement.  
**Backend Impact**: No change

---

### Dashboard

#### `/admin/dashboard`
**Current**: Complex dashboard with 25+ elements, charts, lists  
**Future**: SIMPLIFY - Simple dashboard with 5 key metrics  
**New Path**: `/admin/dashboard`  
**Reason**: Current dashboard is overwhelming. Admins don't need all metrics daily.  
**Backend Impact**: Simplify dashboard service, remove complex aggregations

---

### Product Management

#### `/admin/products`
**Current**: Products list with 15+ fields  
**Future**: SIMPLIFY - Products list with 5 fields  
**New Path**: `/admin/products`  
**Reason**: Current product creation is too complex.  
**Backend Impact**: Simplify product service, auto-generate slugs/SKUs

#### `/admin/products/[id]`
**Current**: Product detail with tabs, many fields  
**Future**: SIMPLIFY - Product detail with 5 fields  
**New Path**: `/admin/products/[id]`  
**Reason**: Too many fields. Simplify to essentials.  
**Backend Impact**: Simplify DTO, hide technical fields

#### `/admin/products/create`
**Current**: Product creation form with 15+ fields  
**Future**: SIMPLIFY - Product creation with 5 fields  
**New Path**: `/admin/products/create`  
**Reason**: Too complex. Businesses abandon before publishing.  
**Backend Impact**: Simplify form, auto-generate fields

#### `/admin/offers`
**Current**: Separate offers management  
**Future**: MERGE - Merge into Products  
**New Path**: `/admin/products`  
**Reason**: Separate Offer entity is confusing. Merge into Product.  
**Backend Impact**: Keep Offer table, hide from UI, merge logic

#### `/admin/offers/[id]`
**Current**: Offer detail page  
**Future**: MERGE - Part of Product detail  
**New Path**: `/admin/products/[id]`  
**Reason**: Separate Offer page unnecessary.  
**Backend Impact**: Merge into Product service

#### `/admin/landings`
**Current**: Landing page CMS with sections, templates  
**Future**: MERGE - Use simple template, merge into Product  
**New Path**: `/admin/products/[id]`  
**Reason**: Complex CMS is overkill. Use simple template.  
**Backend Impact**: Keep LandingPage table, simplify to template

#### `/admin/landings/[id]`
**Current**: Landing page editor  
**Future**: MERGE - Part of Product detail  
**New Path**: `/admin/products/[id]`  
**Reason**: Separate landing page editor unnecessary.  
**Backend Impact**: Merge into Product service

---

### Campaign Management

#### `/admin/campaigns`
**Current**: Campaigns list with 20+ fields  
**Future**: MERGE - Merge into Products  
**New Path**: `/admin/products`  
**Reason**: Separate Campaign entity is confusing. Merge into Product.  
**Backend Impact**: Keep Campaign table, hide from UI, merge logic

#### `/admin/campaigns/[id]`
**Current**: Campaign detail with complex settings  
**Future**: MERGE - Part of Product detail  
**New Path**: `/admin/products/[id]`  
**Reason**: Too complex. Simplify to Product.  
**Backend Impact**: Merge into Product service

#### `/admin/campaigns/create`
**Current**: Campaign creation with 20+ fields  
**Future**: MERGE - Part of Product creation  
**New Path**: `/admin/products/create`  
**Reason**: Too complex. Merge into Product.  
**Backend Impact**: Merge into Product service

---

### Creator Management

#### `/admin/creators`
**Current**: Creators list with 10+ columns  
**Future**: SIMPLIFY - Creators list with 5 columns  
**New Path**: `/admin/creators`  
**Reason**: Too many columns. Simplify to key metrics.  
**Backend Impact**: Simplify service, hide technical fields

#### `/admin/creators/[id]`
**Current**: Creator detail with 10+ sections  
**Future**: SIMPLIFY - Creator detail with 5 sections  
**New Path**: `/admin/creators/[id]`  
**Reason**: Too much information. Simplify to key data.  
**Backend Impact**: Simplify DTO, hide technical sections

#### `/admin/creator-applications`
**Current**: Creator application queue  
**Future**: SIMPLIFY - Auto-approve, simple list  
**New Path**: `/admin/creators` (filter by pending)  
**Reason**: Manual approval is bottleneck. Auto-approve or simplify.  
**Backend Impact**: Simplify service, auto-approve where possible

#### `/admin/creator-applications/[id]`
**Current**: Application detail with review  
**Future**: MERGE - Part of Creator detail  
**New Path**: `/admin/creators/[id]`  
**Reason**: Separate application page unnecessary.  
**Backend Impact**: Merge into Creator service

---

### Content Management

#### `/admin/content`
**Current**: Content review queue with versions, comments  
**Future**: REMOVE - No content approval needed  
**New Path**: N/A  
**Reason**: Content approval is unnecessary friction.  
**Backend Impact**: Keep table, hide from UI

#### `/admin/content/[id]`
**Current**: Content detail with review actions  
**Future**: REMOVE  
**New Path**: N/A  
**Reason**: No content approval means no review page.  
**Backend Impact**: Keep table, hide from UI

---

### Campaign Applications

#### `/admin/campaign-applications`
**Current**: Campaign application queue  
**Future**: REMOVE - Instant join, no applications  
**New Path**: N/A  
**Reason**: Application approval is bottleneck. Instant join instead.  
**Backend Impact**: Keep table, don't use in new flow

#### `/admin/campaign-applications/[id]`
**Current**: Application detail with review  
**Future**: REMOVE  
**New Path**: N/A  
**Reason**: No applications means no review page.  
**Backend Impact**: Keep table, hide from UI

---

### Orders & Payments

#### `/admin/orders`
**Current**: Orders list with 15+ columns, filters  
**Future**: SIMPLIFY - Orders list with 5 columns  
**New Path**: `/admin/orders`  
**Reason**: Too many columns. Simplify to key data.  
**Backend Impact**: Simplify service, hide technical columns

#### `/admin/orders/[id]`
**Current**: Order detail with 10+ sections  
**Future**: SIMPLIFY - Order detail with 5 sections  
**New Path**: `/admin/orders/[id]`  
**Reason**: Too much information. Simplify to essentials.  
**Backend Impact**: Simplify DTO, hide technical sections

#### `/admin/payments`
**Current**: Payments list with processing details  
**Future**: SIMPLIFY - Show as part of Orders  
**New Path**: `/admin/orders`  
**Reason**: Separate payments page unnecessary.  
**Backend Impact**: Merge into Orders service

#### `/admin/payments/[id]`
**Current**: Payment detail  
**Future**: MERGE - Part of Order detail  
**New Path**: `/admin/orders/[id]`  
**Reason**: Separate payment detail unnecessary.  
**Backend Impact**: Merge into Order service

---

### Earnings & Payouts

#### `/admin/commissions`
**Current**: Commissions list with approval actions  
**Future**: REMOVE - Auto-approve commissions  
**New Path**: N/A  
**Reason**: Manual commission approval is bottleneck. Auto-approve.  
**Backend Impact**: Keep table, auto-approve logic

#### `/admin/payouts`
**Current**: Payouts list with processing actions  
**Future**: SIMPLIFY - Earnings page with payout requests  
**New Path**: `/admin/earnings`  
**Reason**: Separate commissions/payouts pages confusing.  
**Backend Impact**: Merge into single Earnings service

#### `/admin/payouts/[id]`
**Current**: Payout detail  
**Future**: MERGE - Part of Earnings page  
**New Path**: `/admin/earnings`  
**Reason**: Separate payout detail unnecessary.  
**Backend Impact**: Merge into Earnings service

---

### Referral & Promo

#### `/admin/referral-links`
**Current**: Referral links management  
**Future**: HIDE - Auto-generated, hide from UI  
**New Path**: N/A  
**Reason**: Manual management unnecessary. Auto-generate.  
**Backend Impact**: Keep table, hide from UI

#### `/admin/promo-codes`
**Current**: Promo codes management  
**Future**: HIDE - Auto-generated, hide from UI  
**New Path**: N/A  
**Reason**: Manual management unnecessary. Auto-generate.  
**Backend Impact**: Keep table, hide from UI

#### `/admin/visitors`
**Current**: Visitor analytics  
**Future**: HIDE - Technical analytics, hide from UI  
**New Path**: N/A  
**Reason**: Too technical. Hide from main UI.  
**Backend Impact**: Keep table, hide from UI

---

### Referral Program

#### `/admin/creator-referrals`
**Current**: Creator-to-creator referral management  
**Future**: HIDE - Backend only, hide from UI  
**New Path**: N/A  
**Reason**: Feature creep at current scale.  
**Backend Impact**: Keep tables, hide from UI

#### `/admin/referral-rules`
**Current**: Referral rule configuration  
**Future**: HIDE - Backend only, hide from UI  
**New Path**: N/A  
**Reason**: Internal configuration.  
**Backend Impact**: Keep tables, hide from UI

---

### Analytics

#### `/admin/analytics`
**Current**: Analytics with 10+ different views  
**Future**: SIMPLIFY - Show key metrics on Dashboard  
**New Path**: `/admin/dashboard`  
**Reason**: Too complex for current scale. Simplify to dashboard.  
**Backend Impact**: Simplify analytics, merge into dashboard

#### `/admin/analytics/*`
**Current**: Multiple analytics sub-pages  
**Future**: REMOVE - Show on Dashboard only  
**New Path**: N/A  
**Reason**: Too many analytics views. Overkill.  
**Backend Impact**: Keep service, hide from UI

---

### User Management

#### `/admin/users`
**Current**: Staff user management  
**Future**: SIMPLIFY - Simple staff list in Settings  
**New Path**: `/admin/settings` (staff section)  
**Reason**: Separate user management unnecessary for small team.  
**Backend Impact**: Simplify, move to Settings

#### `/admin/users/[id]`
**Current**: User detail with permissions  
**Future**: MERGE - Part of Settings  
**New Path**: `/admin/settings`  
**Reason**: Separate user detail unnecessary.  
**Backend Impact**: Merge into Settings

#### `/admin/roles`
**Current**: Role and permission management  
**Future**: HIDE - Backend only, hide from UI  
**New Path**: N/A  
**Reason**: Too technical. Small team doesn't need UI for this.  
**Backend Impact**: Keep tables, hide from UI

---

### Settings

#### `/admin/settings`
**Current**: Settings with multiple categories  
**Future**: SIMPLIFY - Simple settings with 5 key options  
**New Path**: `/admin/settings`  
**Reason**: Too many settings. Simplify to essentials.  
**Backend Impact**: Simplify settings service

#### `/admin/audit-log`
**Current**: Audit log viewer  
**Future**: HIDE - Backend only, hide from UI  
**New Path**: N/A  
**Reason**: Internal compliance. Hide from main UI.  
**Backend Impact**: Keep table, hide from UI

---

### Extras

#### `/admin/homepage`
**Current**: Homepage CMS  
**Future**: SIMPLIFY - Simple settings or remove  
**New Path**: `/admin/settings` (homepage section)  
**Reason**: Complex CMS overkill. Simplify or remove.  
**Backend Impact**: Simplify or remove

#### `/admin/competitions`
**Current**: Competitions management  
**Future**: HIDE - Backend only, hide from UI  
**New Path**: N/A  
**Reason**: Gamification is distraction.  
**Backend Impact**: Keep tables, hide from UI

#### `/admin/notifications`
**Current**: Notification management  
**Future**: HIDE - Backend only, hide from UI  
**New Path**: N/A  
**Reason**: Internal configuration.  
**Backend Impact**: Keep service, hide from UI

---

## BUYER PAGES

### Product

#### `/o/[slug]`
**Current**: Offer landing with technical URL, affiliate wording  
**Future**: SIMPLIFY - Clean product page with no affiliate wording  
**New Path**: `/f/[code]`  
**Reason**: Ugly URL reveals affiliate nature. Clean URL needed.  
**Backend Impact**: Change routing, silent tracking

#### `/o/[slug]?ref=...`
**Current**: Landing with visible tracking parameters  
**Future**: SIMPLIFY - Clean URL, silent tracking  
**New Path**: `/f/[code]`  
**Reason**: Visible parameters reduce trust.  
**Backend Impact**: Change routing, silent tracking

---

### Checkout

#### `/checkout/[slug]`
**Current**: Checkout with 8+ fields, promo code visible  
**Future**: SIMPLIFY - Checkout with 4 fields, no promo code  
**New Path**: `/checkout`  
**Reason**: Too many fields. Promo code reveals affiliate nature.  
**Backend Impact**: Simplify form, hide promo code

---

### Order Success

#### `/order-success/[token]`
**Current**: Order success with affiliate disclosure  
**Future**: SIMPLIFY - Thank you page, no affiliate wording  
**New Path**: `/order-success/[token]`  
**Reason**: Affiliate disclosure unnecessary.  
**Backend Impact**: Remove affiliate wording

---

### Buyer Auth

#### `/buyer/auth/login`
**Current**: Buyer login (if exists)  
**Future**: REMOVE - Guest checkout only  
**New Path**: N/A  
**Reason**: Buyer accounts unnecessary for current scale.  
**Backend Impact**: Remove buyer auth

#### `/buyer/auth/register`
**Current**: Buyer registration (if exists)  
**Future**: REMOVE - Guest checkout only  
**New Path**: N/A  
**Reason**: Buyer accounts unnecessary.  
**Backend Impact**: Remove buyer auth

---

## PUBLIC PAGES

### Homepage

#### `/`
**Current**: Public homepage  
**Future**: KEEP - Simplify if needed  
**New Path**: `/`  
**Reason**: Homepage needed for discovery.  
**Backend Impact**: Simplify if complex

#### `/catalog`
**Current**: Product catalog  
**Future**: KEEP - Simplify if needed  
**New Path**: `/catalog`  
**Reason**: Public catalog needed for discovery.  
**Backend Impact**: Simplify if complex

---

### Legal

#### `/legal/terms`
**Current**: Terms of service  
**Future**: KEEP - Legal requirement  
**New Path**: `/legal/terms`  
**Reason**: Legal requirement.  
**Backend Impact**: No change

#### `/legal/privacy`
**Current**: Privacy policy  
**Future**: KEEP - Legal requirement  
**New Path**: `/legal/privacy`  
**Reason**: Legal requirement.  
**Backend Impact**: No change

---

### Error Pages

#### `/error`
**Current**: Error page  
**Future**: KEEP - Needed for errors  
**New Path**: `/error`  
**Reason**: Error handling required.  
**Backend Impact**: No change

#### `/not-found`
**Current**: 404 page  
**Future**: KEEP - Needed for 404s  
**New Path**: `/not-found`  
**Reason**: 404 handling required.  
**Backend Impact**: No change

---

## SUMMARY

### Creator Pages
- **Total Current**: 20+ pages
- **Total Future**: 4 pages (Products, My Products, Earnings, Profile, Notifications)
- **Removed**: 8 pages
- **Merged**: 8 pages
- **Hidden**: 4 pages
- **Simplified**: 6 pages

### Admin Pages
- **Total Current**: 30+ pages
- **Total Future**: 6 pages (Dashboard, Products, Orders, Creators, Earnings, Settings)
- **Removed**: 10 pages
- **Merged**: 12 pages
- **Hidden**: 8 pages
- **Simplified**: 4 pages

### Buyer Pages
- **Total Current**: 5+ pages
- **Total Future**: 3 pages (Product, Checkout, Order Success)
- **Removed**: 2 pages
- **Simplified**: 3 pages

### Public Pages
- **Total Current**: 5+ pages
- **Total Future**: 5 pages (Homepage, Catalog, Terms, Privacy, Error pages)
- **Removed**: 0 pages
- **Simplified**: 2 pages

### Overall Reduction
- **Total Pages**: 60+ → 18
- **Reduction**: 70% fewer pages
- **Complexity**: Dramatically simplified

---

## IMPLEMENTATION NOTES

### Backend Compatibility
- **Keep all existing tables** - Only hide from UI
- **Keep all existing endpoints** - Add new simplified endpoints
- **Version APIs** - `/v1/` for old, `/v2/` for new
- **Gradual migration** - Phase out old pages over time

### Migration Strategy
- **Phase 1**: Create new simplified pages alongside old
- **Phase 2**: A/B test new vs old pages
- **Phase 3**: Redirect old to new
- **Phase 4**: Remove old pages

### Testing Requirements
- **User testing** - Verify new pages are understood
- **Conversion testing** - Compare old vs new conversion
- **Error testing** - Ensure no broken links
- **Performance testing** - Ensure no performance regression

### Rollback Plan
- **Can revert to old pages** if issues arise
- **Keep old endpoints** for backward compatibility
- **Monitor metrics** - Track if issues increase
- **Quick revert** - UI changes only, easy to rollback

---

## NEXT STEP

Create IMPLEMENTATION_PLAN.md with safe phases, no breaking changes, backward compatible.
