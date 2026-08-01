# SOFSAVDO PRODUCT SIMPLIFICATION AUDIT

**Date**: 2026-08-01  
**Purpose**: Complete product audit before UX simplification  
**Scope**: Creator, Admin, and Buyer experiences  
**Goal**: Make SOFSAVDO the easiest affiliate platform in Uzbekistan

---

## PART 1: Current Architecture Review

### Backend Architecture
- **Pattern**: Modular monolith (NestJS) with 26+ modules
- **Database**: PostgreSQL with Prisma ORM
- **Modules**: Auth, Users, Roles, Creators, Products, Offers, Campaigns, Applications, Content, Referral Links, Promo Codes, Attribution, Orders, Payments, Commissions, Payouts, Notifications, Analytics, Audit, and more
- **Strengths**: Clean module boundaries, transactional integrity, comprehensive RBAC
- **Weaknesses**: Over-engineered for the actual use case, too many abstractions

### Frontend Architecture
- **Framework**: Next.js App Router with TypeScript
- **Route Groups**: `(creator)`, `(admin)`, `(buyer)`, `(public)`
- **State Management**: TanStack Query with React Hook Form
- **Components**: shadcn/ui with custom design system
- **Strengths**: Modern stack, type-safe, good separation
- **Weaknesses**: Too many routes, complex navigation, engineer-focused design

### Database Schema
- **Models**: 50+ Prisma models
- **Key Relationships**: Product → Offer → Campaign → CreatorCampaign → ReferralLink/PromoCode
- **Money Handling**: Integer minor units (1 so'm = 100 minor units)
- **Snapshots**: CommissionRule, Order.offerSnapshot for financial integrity
- **Strengths**: Financial correctness, audit trails, data integrity
- **Weaknesses**: Over-normalized for the actual business needs

---

## PART 2: Current UX Problems

### Creator Experience Problems
1. **Too Many Concepts**: Creators must understand Campaign, Offer, Referral Link, Creator Content, Slug, SKU, Internal IDs
2. **Long Journey**: Register → 8-step onboarding → Wait for approval → Browse campaigns → Apply → Wait for approval → Get link → Download materials → Create content → Submit for review → Wait for approval → Share
3. **Complex Dashboard**: 15+ menu items, confusing statistics, technical terminology
4. **Multiple Approval Gates**: Creator application, Campaign application, Content approval
5. **Technical Language**: "Commission", "Attribution", "Conversion", "SKU", "Slug"

### Admin Experience Problems
1. **ERP-like Interface**: 30+ menu items, complex navigation
2. **Too Many Entities**: Products, Offers, Landings, Campaigns, Applications, Content, Referral Links, Promo Codes, Visitors, Orders, Payments, Commissions, Payouts, Refunds, Analytics, Users, Settings, Audit Log
3. **Complex Product Creation**: 15+ fields, many technical (slug, SKU, internal codes)
4. **Overlapping Concepts**: Campaign vs Offer, Landing vs Offer, Referral Link vs Promo Code
5. **Information Overload**: Too much data on every screen

### Buyer Experience Problems
1. **Ugly URLs**: `/o/serum?ref=malika` - technical parameters visible
2. **Affiliate Wording**: "Referral", "Promo code" - technical language
3. **Complex Attribution**: Multiple tracking mechanisms (promo code, visit, manual)
4. **No Seamless Experience**: Tracking is visible in URL and flow

---

## PART 3: Every Unnecessary Page

### Creator Pages to Remove/Simplify
1. **`/creator/campaigns/[id]`** - Too much detail, should be simplified to card view
2. **`/creator/my-campaigns`** - Should be merged into main dashboard as "My Products"
3. **`/creator/content`** - Content submission should be simplified or removed
4. **`/creator/promo-materials`** - Should be integrated into product detail
5. **`/creator/clicks`** - Too technical, should be simplified to "Views"
6. **`/creator/commissions`** - Should be merged into wallet/balance
7. **`/creator/balance`** - Should be simplified to just "Earnings"
8. **`/creator/payouts`** - Should be simplified to "Withdraw"
9. **`/creator/notification-preferences`** - Too complex, should be simplified
10. **`/creator/referrals`** - Creator-to-creator referrals should be hidden or simplified
11. **`/creator/fund`** - Creator fund should be hidden from main interface
12. **`/creator/leaderboard`** - Should be optional or hidden
13. **`/creator/competitions`** - Should be simplified or hidden

### Admin Pages to Remove/Simplify
1. **`/admin/landings`** - Should be merged into Offers
2. **`/admin/campaign-applications`** - Should be simplified or merged
3. **`/admin/content`** - Content review should be simplified
4. **`/admin/referral-links`** - Should be hidden from main UI
5. **`/admin/promo-codes`** - Should be hidden from main UI
6. **`/admin/visitors`** - Too technical, should be simplified
7. **`/admin/roles`** - Should be simplified or hidden
8. **`/admin/users`** - Should be merged into creators
9. **`/admin/audit-log`** - Should be hidden from main UI
10. **`/admin/notifications`** - Should be simplified
11. **`/admin/referral-rules`** - Should be hidden
12. **`/admin/creator-referrals`** - Should be hidden
13. **`/admin/homepage`** - Should be simplified

---

## PART 4: Every Unnecessary Menu

### Creator Menu to Simplify
**Current**: Dashboard, Campaigns, My Campaigns, Promo Materials, Content, Sales, Commissions, Balance, Payouts, Notifications, Profile, Referrals, Fund, Leaderboard, Competitions

**Simplified**: Products, Earnings, Profile, Notifications

### Admin Menu to Simplify
**Current**: Dashboard, Products, Offers, Landings, Campaigns, Creators, Applications, Content, Referral Links, Promo Codes, Visitors, Orders, Payments, Commissions, Refunds, Payouts, Analytics, Users, Settings, Audit Log, Homepage, Competitions, Creator Referrals, Referral Rules, Notifications, Roles

**Simplified**: Dashboard, Products, Orders, Creators, Earnings, Settings

---

## PART 5: Every Unnecessary Field

### Product Creation Fields to Remove/Auto-generate
1. **Slug** - Auto-generate from name
2. **SKU** - Auto-generate or remove
3. **Internal Code** - Remove entirely
4. **Internal Notes** - Keep but hide from quick view
5. **Cost Price** - Keep but hide from quick view
6. **Brand** - Optional, move to advanced
7. **Attributes** - Simplify or remove
8. **Videos** - Simplify or remove
9. **Multiple Images** - Limit to 3-5

### Campaign Fields to Remove/Auto-generate
1. **Slug** - Auto-generate from name
2. **Internal Name** - Remove (use only name)
3. **Internal Notes** - Keep but hide
4. **Category** - Simplify to 3-5 options
5. **Goal** - Remove or simplify
6. **Target Audience** - Simplify to dropdown
7. **Platforms** - Simplify to checkboxes
8. **Content Formats** - Simplify
9. **Required Elements** - Simplify to 3-5 key items
10. **Forbidden Elements** - Simplify
11. **Reference Content** - Remove or simplify
12. **Min/Max Followers** - Simplify or remove
13. **Required Content Count** - Remove or simplify
14. **Content Deadline** - Simplify
15. **Multiple Date Fields** - Consolidate

### Creator Application Fields to Simplify
1. **8-step wizard** - Reduce to 3-4 steps
2. **Detailed audience info** - Simplify
3. **Content niches** - Simplify to dropdown
4. **Prior partnership experience** - Remove or simplify
5. **Detailed payout details** - Simplify

---

## PART 6: Every Confusing Terminology

### Current → Simplified Terminology
- **Referral Link** → "My Link" or "Sharing Link"
- **Promo Code** → "Discount Code" or hide entirely
- **Campaign** → "Product" (for creators)
- **Offer** → Hide entirely (backend only)
- **Creator Content** → "My Posts" or remove
- **Slug** → Auto-generate, hide from UI
- **SKU** → Auto-generate, hide from UI
- **Commission** → "Earnings"
- **Attribution** → Hide entirely
- **Conversion Rate** → "Success Rate"
- **Wallet Balance** → "Available Earnings"
- **Pending Payout** → "Pending Earnings"
- **Creator Application** → "Verification"
- **Campaign Application** → Remove (instant join)
- **Commission Type** → Hide, show only "You earn X%"
- **Attribution Window** → Hide entirely

---

## PART 7: Creator Journey Analysis

### Current Creator Journey (Too Complex)
```
Register (email/phone + password)
  → Email/Phone verification
  → 8-step onboarding wizard
      - Personal info
      - City
      - Social accounts (platform, handle, followers, link)
      - Audience info (age, geography, interests)
      - Content niches
      - Prior experience
      - Payout details (card/bank)
      - Terms acceptance
  → Submit application
  → Wait for admin review (SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/CHANGES_REQUESTED)
  → If approved, access dashboard
  → Browse campaigns catalog (filters: category, platform, commission type, barter, free product)
  → Open campaign detail
  → Read complex requirements (platforms, formats, required elements, forbidden elements, reference content)
  → Apply to campaign
  → Wait for admin approval (SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED)
  → If approved, get ReferralLink + PromoCode
  → Download promo materials
  → Create content
  → Submit content for review
  → Wait for content approval (DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/CHANGES_REQUESTED)
  → Share referral link
  → Track clicks, sales, commissions
  → Request payout when balance reaches minimum
  → Wait for payout processing
```

### Simplified Creator Journey (Target)
```
Register (phone + name)
  → SMS verification
  → Basic profile (name, city, social link)
  → Browse products
  → Click "Take Product"
  → Get sharing link instantly
  → Share link
  → Earn
```

### Key Simplifications
1. **Remove onboarding wizard** - Basic profile only
2. **Remove campaign application** - Instant join
3. **Remove content submission** - No approval needed
4. **Remove complex filters** - Simple product cards
5. **Remove promo materials download** - Link is enough
6. **Simplify payout** - One-click withdraw

---

## PART 8: Buyer Journey Analysis

### Current Buyer Journey
```
Click creator's link: sofsavdo.com/o/serum?ref=malika
  → Server records ReferralVisit (visitorId, sessionId, ip hash, UA, utm params)
  → Landing page renders with personalization ("Malika tavsiyasi orqali...")
  → Buyer sees offer content, picks variant
  → Clicks CTA → /checkout/serum
  → Fills form: contact info, address, promo code (auto-filled), payment method
  → POST /orders with idempotency key
  → Attribution resolved (promo code > visit)
  → Order + Commission(PENDING) created
  → Payment initiated
  → Webhook confirms payment
  → Order success page
```

### Simplified Buyer Journey (Target)
```
Click creator's link: sofsavdo.com/f/ABCD123
  → Silent tracking (no visible parameters)
  → Clean product page (no affiliate wording)
  → Buyer sees product, clicks buy
  → Simple checkout form
  → Payment
  → Thank you page
```

### Key Simplifications
1. **Clean URLs** - No visible tracking parameters
2. **No affiliate wording** - No "referral", "promo code" mentions
3. **Silent tracking** - Attribution happens invisibly
4. **Simplified checkout** - Fewer fields, auto-fill where possible

---

## PART 9: Admin Journey Analysis

### Current Admin Journey (Too Complex)
```
Login
  → Dashboard with 30+ menu items
  → Create Product (15+ fields)
  → Create Offer (10+ fields)
  → Create Landing Page (sections, templates)
  → Create Campaign (20+ fields)
  → Review Creator Applications (queue, approve/reject)
  → Review Campaign Applications (queue, approve/reject)
  → Review Content (queue, approve/reject)
  → Manage Referral Links (view, manage)
  → Manage Promo Codes (view, manage)
  → View Visitors (analytics)
  → Manage Orders (list, detail, refund)
  → Manage Payments (view, process)
  → Manage Commissions (approve, adjust)
  → Manage Payouts (approve, process)
  → View Analytics (10+ different views)
  → Manage Users (staff accounts)
  → Manage Roles (permissions)
  → View Audit Log
  → Manage Settings
  → Manage Homepage CMS
  → Manage Competitions
  → Manage Creator Referrals
```

### Simplified Admin Journey (Target)
```
Login
  → Dashboard (key metrics only)
  → Add Product (name, price, image, commission - 5 fields)
  → View Orders
  → View Creators
  → View Earnings
  → Settings (basic)
```

### Key Simplifications
1. **Merge Product/Offer/Campaign** - Single "Product" entity for admin
2. **Remove Landing Page editor** - Use simple template
3. **Remove application queues** - Auto-approve or simplify
4. **Remove content review** - No approval needed
5. **Remove referral/promo management** - Auto-generated
6. **Simplify analytics** - 3-4 key metrics only
7. **Remove audit log** - Keep in background
8. **Remove roles/permissions** - Simple admin/staff split

---

## PART 10: Ghost/Admin Operations Analysis

### Operations That Should Be Hidden/Internal
1. **Slug generation** - Auto-generate, never show
2. **SKU generation** - Auto-generate, never show
3. **Referral link generation** - Auto-generate on join
4. **Promo code generation** - Auto-generate on join
5. **Attribution resolution** - Silent backend process
6. **Commission calculation** - Silent backend process
7. **Commission snapshots** - Internal only
8. **Audit logging** - Internal only
9. **Status transitions** - Simplify or hide
10. **Idempotency keys** - Internal only
11. **Visitor tracking** - Silent backend process
12. **Fraud detection** - Silent backend process
13. **Webhook processing** - Internal only
14. **Background jobs** - Internal only
15. **Cache management** - Internal only

### Operations That Should Be Simplified
1. **Product creation** - Reduce from 15+ to 5 fields
2. **Campaign creation** - Reduce from 20+ to 5 fields
3. **Creator approval** - Auto-approve or one-click
4. **Payout processing** - One-click approve
5. **Content approval** - Remove entirely
6. **Application review** - Remove or simplify

---

## PART 11: Information Architecture Redesign

### Current Information Architecture (Too Complex)
```
Creator:
  - Dashboard (stats, charts, tasks)
  - Campaigns (catalog with filters)
  - Campaign Detail (complex requirements)
  - My Campaigns (status, links)
  - Promo Materials (downloads)
  - Content (create, submit, review)
  - Sales (table, details)
  - Commissions (table, status)
  - Balance (available, pending)
  - Payouts (request, history)
  - Notifications (list, preferences)
  - Profile (edit, social)
  - Referrals (creator-to-creator)
  - Fund (contributions)
  - Leaderboard (ranking)
  - Competitions (contests)

Admin:
  - Dashboard (30+ metrics)
  - Products (CRUD)
  - Offers (CRUD)
  - Landings (CMS)
  - Campaigns (CRUD)
  - Creators (list, detail)
  - Creator Applications (queue)
  - Campaign Applications (queue)
  - Content (queue, review)
  - Referral Links (manage)
  - Promo Codes (manage)
  - Visitors (analytics)
  - Orders (list, detail)
  - Payments (list, process)
  - Commissions (approve, adjust)
  - Refunds (approve, process)
  - Payouts (approve, process)
  - Analytics (10+ views)
  - Users (staff management)
  - Roles (permissions)
  - Settings (config)
  - Audit Log (history)
  - Homepage (CMS)
  - Competitions (manage)
  - Creator Referrals (manage)
  - Referral Rules (configure)
  - Notifications (manage)
```

### Simplified Information Architecture
```
Creator:
  - Products (simple catalog)
  - My Products (active products with links)
  - Earnings (balance, withdraw)
  - Profile (basic info)

Admin:
  - Dashboard (5 key metrics)
  - Products (add, edit, list)
  - Orders (list, detail)
  - Creators (list, approve)
  - Earnings (overview, payouts)
  - Settings (basic config)
```

### Key Changes
1. **Reduce from 15+ creator pages to 4**
2. **Reduce from 30+ admin pages to 6**
3. **Merge related entities** (Product/Offer/Campaign → Product)
4. **Hide technical concepts** (attribution, referrals, promo codes)
5. **Simplify navigation** - Flat structure, no nested menus

---

## PART 12: New Navigation Structure

### Creator Navigation (Simplified)
```
Sidebar (Desktop) / Bottom Nav (Mobile):
  - Products (icon: grid)
  - My Products (icon: heart)
  - Earnings (icon: wallet)
  - Profile (icon: user)
```

### Admin Navigation (Simplified)
```
Sidebar:
  - Dashboard
  - Products
  - Orders
  - Creators
  - Earnings
  - Settings
```

### Key Principles
1. **Flat structure** - No nested menus
2. **Icon-based** - Visual recognition
3. **Mobile-first** - Bottom nav for creators
4. **Consistent** - Same pattern across all pages
5. **Minimal** - Only essential items

---

## PART 13: Screen-by-Screen Redesign

### Creator Screens

#### 1. Products (Catalog)
**Current**: Complex filters, campaign cards with 10+ data points
**Redesign**:
- Simple product cards
- Image, title, commission, earnings estimate
- One button: "Take Product"
- No filters or simple category filter only
- Mobile-first grid layout

#### 2. Product Detail
**Current**: Campaign detail with complex requirements
**Redesign**:
- Product image, title, description
- Commission rate (e.g., "You earn 20%")
- Estimated earnings
- One button: "Get Link"
- No technical requirements

#### 3. My Products
**Current**: My Campaigns with status, links, materials
**Redesign**:
- List of active products
- Product image, title, commission
- Views, orders, earnings
- Copy link button
- Share button (Telegram, Instagram, WhatsApp)
- Archive button

#### 4. Earnings
**Current**: Balance, commissions, payouts separate
**Redesign**:
- Available earnings (big number)
- Pending earnings
- Withdraw button
- Recent transactions
- Simple chart (last 7 days)

#### 5. Profile
**Current**: Complex profile with social accounts, niches, etc.
**Redesign**:
- Name, photo
- City
- Social link (one field)
- Payout method (card/bank)
- Save button

### Admin Screens

#### 1. Dashboard
**Current**: 30+ metrics, complex charts
**Redesign**:
- Today's revenue
- Active creators
- Total orders
- Pending payouts
- Simple trend chart (7 days)

#### 2. Products
**Current**: Separate Products, Offers, Landings, Campaigns
**Redesign**:
- Single product list
- Add Product button
- Product cards: image, title, price, commission
- Edit/Delete actions

#### 3. Add/Edit Product
**Current**: 15+ fields across multiple tabs
**Redesign**:
- Title
- Description
- Price
- Commission (%)
- Images (max 5)
- Save button

#### 4. Orders
**Current**: Complex order management
**Redesign**:
- Order list with status
- Order detail: customer, items, total
- Simple status change (paid, shipped, delivered)
- Refund button

#### 5. Creators
**Current**: Complex creator management
**Redesign**:
- Creator list with status
- Creator detail: name, social, earnings
- Approve/Block actions
- Simple stats

#### 6. Earnings
**Current**: Separate commissions, payouts
**Redesign**:
- Total paid
- Pending payouts
- Payout requests list
- Approve/Process actions

#### 7. Settings
**Current**: Complex settings with many options
**Redesign**:
- Minimum payout amount
- Commission defaults
- Payment methods
- Save button

---

## PART 14: Database Impact

### Tables to Keep (Backend Only)
- **Product** - Simplified, merge Offer/Campaign fields
- **Order** - Keep as-is
- **Payment** - Keep as-is
- **Commission** - Keep as-is
- **Payout** - Keep as-is
- **User** - Keep as-is
- **CreatorProfile** - Simplified
- **ReferralLink** - Keep but hide from UI
- **PromoCode** - Keep but hide from UI
- **Attribution** - Keep but hide from UI
- **ReferralVisit** - Keep but hide from UI

### Tables to Deprecate or Hide
- **Offer** - Merge into Product
- **LandingPage** - Use simple template
- **Campaign** - Merge into Product
- **CampaignApplication** - Remove (instant join)
- **CreatorCampaign** - Simplify to Product-Creator join
- **Content** - Remove (no content approval)
- **CreatorApplication** - Simplify to basic profile
- **CampaignMedia** - Merge into Product images
- **CommissionRule** - Keep but simplify
- **Notification** - Keep but simplify
- **AuditLog** - Keep but hide from UI

### Fields to Remove or Auto-generate
- **Slug** - Auto-generate everywhere
- **SKU** - Auto-generate or remove
- **Internal codes** - Remove
- **Complex status enums** - Simplify to ACTIVE/INACTIVE
- **Multiple date fields** - Consolidate
- **Technical metadata** - Hide from UI

---

## PART 15: Migration Strategy

### Phase 1: Backend Simplification (No Breaking Changes)
1. **Add auto-generation** for slugs, SKUs
2. **Add view layers** to hide technical fields
3. **Create simplified DTOs** for UI
4. **Add deprecation flags** for old fields
5. **Maintain backward compatibility**

### Phase 2: Frontend Simplification
1. **Create new simplified pages** alongside old ones
2. **A/B test** new vs old flows
3. **Migrate users** gradually
4. **Remove old pages** after validation

### Phase 3: Database Cleanup
1. **Merge tables** (Offer → Product)
2. **Remove deprecated fields**
3. **Simplify enums**
4. **Update indexes**
5. **Run data migrations**

### Phase 4: Launch
1. **Full cutover** to new UI
2. **Monitor metrics**
3. **Rollback plan** ready
4. **User communication**

---

## PART 16: Backward Compatibility

### API Compatibility
- **Keep existing endpoints** - Add new simplified ones
- **Version APIs** - `/v1/` for old, `/v2/` for new
- **Graceful degradation** - Old clients still work
- **Deprecation timeline** - 6 months notice

### Data Compatibility
- **No data loss** - All data preserved
- **Data migration** - Automatic transformation
- **Rollback possible** - Can revert to old schema
- **Audit trail** - Track all changes

### Business Logic Compatibility
- **Financial integrity** - No changes to money logic
- **Attribution accuracy** - No changes to tracking
- **Commission calculation** - No changes to math
- **Payout processing** - No changes to flow

---

## PART 17: Implementation Order

### Sprint 1: Creator Simplification (2 weeks)
1. **Simplify creator registration** - Remove wizard, basic profile only
2. **Simplify product catalog** - Simple cards, "Take Product" button
3. **Instant link generation** - No application approval
4. **Simplify "My Products"** - List with copy/share
5. **Simplify earnings** - Available + withdraw

### Sprint 2: Admin Simplification (2 weeks)
1. **Merge Product/Offer/Campaign** - Single entity
2. **Simplify product creation** - 5 fields only
3. **Simplify dashboard** - 5 metrics only
4. **Simplify orders** - List + detail
5. **Simplify creators** - List + approve

### Sprint 3: Buyer Simplification (1 week)
1. **Clean URLs** - `/f/ABCD123` format
2. **Silent tracking** - No visible parameters
3. **Simplify checkout** - Fewer fields
4. **Remove affiliate wording** - Clean copy

### Sprint 4: Database Cleanup (2 weeks)
1. **Merge tables** - Data migration
2. **Remove deprecated fields**
3. **Simplify enums**
4. **Update indexes**
5. **Test rollback**

### Sprint 5: Polish & Launch (1 week)
1. **Mobile optimization**
2. **Performance optimization**
3. **User testing**
4. **Bug fixes**
5. **Launch**

### Total Timeline: 8 weeks

---

## Summary

**Current State**: SOFSAVDO is engineer-friendly, not user-friendly. Too many concepts, too many steps, too much complexity.

**Target State**: SOFSAVDO becomes the easiest affiliate platform in Uzbekistan. Creators understand in 2 minutes. Admins publish in 3 minutes. Buyers never notice tracking.

**Key Changes**:
- Reduce creator pages from 15+ to 4
- Reduce admin pages from 30+ to 6
- Simplify product creation from 15+ fields to 5
- Remove approval gates (instant join)
- Hide technical concepts (attribution, slugs, SKUs)
- Clean URLs and silent tracking
- Human terminology throughout

**Risk Mitigation**:
- Maintain financial integrity
- Keep backward compatibility
- Gradual migration
- Rollback plan ready
- Extensive testing

**Success Metrics**:
- Creator onboarding time: < 2 minutes
- Admin product creation: < 3 minutes
- Creator retention: Increase by 50%
- Support tickets: Decrease by 70%
- User satisfaction: > 4.5/5

---

**Next Step**: Review this audit with stakeholders, approve simplification direction, then begin Sprint 1 implementation.
