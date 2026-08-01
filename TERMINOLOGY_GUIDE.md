# TERMINOLOGY GUIDE - SOFSAVDO

**Date**: 2026-08-01  
**Goal**: Replace every technical word with natural language  
**Principle**: "If a normal person would not naturally say the word, replace it."

---

## CORE BUSINESS ENTITIES

### Campaign → Product
**Old Term**: Campaign  
**New Term**: Product  
**Reason**: Creators don't understand "campaign" - they understand "product". Campaign is a marketing term, product is what they promote.  
**Usage**: "Browse products" instead of "Browse campaigns"  
**Backend Impact**: Keep Campaign table, hide from UI, map to Product in API

### Offer → (Hidden)
**Old Term**: Offer  
**New Term**: (Hidden - backend only)  
**Reason**: Offer is a technical distinction between Product and Campaign. Creators don't need to know this distinction.  
**Usage**: Never shown to creators. Admin sees "Product" only.  
**Backend Impact**: Keep Offer table, hide from UI entirely

### Landing Page → Product Page
**Old Term**: Landing Page  
**New Term**: Product Page  
**Reason**: "Landing page" is marketing terminology. "Product page" is what normal people call it.  
**Usage**: "Product page" instead of "Landing page"  
**Backend Impact**: Keep LandingPage table, hide from UI, merge into Product concept

---

## ATTRIBUTION & TRACKING

### Referral Link → Sharing Link / My Link
**Old Term**: Referral Link  
**New Term**: Sharing Link / My Link  
**Reason**: "Referral" is technical. "Sharing link" or "My link" is natural language.  
**Usage**: "Get your link" instead of "Get referral link"  
**Backend Impact**: Keep ReferralLink table, change UI labels

### Promo Code → Discount Code / (Hidden)
**Old Term**: Promo Code  
**New Term**: Discount Code (if shown to buyer) / Hidden (if internal)  
**Reason**: "Promo code" is marketing terminology. "Discount code" is more natural. Better yet, hide entirely.  
**Usage**: Auto-apply silently, don't show to buyer  
**Backend Impact**: Keep PromoCode table, hide from UI, auto-apply in checkout

### Attribution → (Hidden)
**Old Term**: Attribution  
**New Term**: (Hidden - backend only)  
**Reason**: Attribution is a technical concept for tracking who gets credit. Users don't need to know this exists.  
**Usage**: Never shown to any user  
**Backend Impact**: Keep Attribution table, hide from UI entirely

### Attribution Window → (Hidden)
**Old Term**: Attribution Window  
**New Term**: (Hidden - backend only)  
**Reason**: Technical concept for how long a link remains valid. Users don't need to know.  
**Usage**: Never shown to any user  
**Backend Impact**: Keep field, hide from UI

### UTM Parameters → (Hidden)
**Old Term**: UTM Parameters  
**New Term**: (Hidden - backend only)  
**Reason**: Marketing tracking parameters. Technical and confusing.  
**Usage**: Never shown to any user  
**Backend Impact**: Keep in URL for tracking, hide from UI

### Visitor ID → (Hidden)
**Old Term**: Visitor ID  
**New Term**: (Hidden - backend only)  
**Reason**: Technical identifier for tracking. Users don't need to know.  
**Usage**: Never shown to any user  
**Backend Impact**: Keep field, hide from UI

---

## COMMISSION & EARNINGS

### Commission → Earnings
**Old Term**: Commission  
**New Term**: Earnings  
**Reason**: "Commission" is business terminology. "Earnings" is what creators actually care about.  
**Usage**: "Your earnings" instead of "Your commission"  
**Backend Impact**: Keep Commission table, change UI labels

### Commission Type → (Hidden)
**Old Term**: Commission Type  
**New Term**: (Hidden - backend only)  
**Reason**: Technical distinction between percentage and fixed amount. Show only the result: "You earn 20%".  
**Usage**: Never show the type, show only the result  
**Backend Impact**: Keep field, hide from UI

### Commission Rate → Earning Rate / (Hidden)
**Old Term**: Commission Rate  
**New Term**: Earning Rate / (Hidden)  
**Reason**: "Commission rate" is technical. "You earn 20%" is natural.  
**Usage**: "You earn 20%" instead of "Commission rate: 20%"  
**Backend Impact**: Keep field, calculate display value

### Commission Rule → (Hidden)
**Old Term**: Commission Rule  
**New Term**: (Hidden - backend only)  
**Reason**: Technical concept for versioned commission rules. Users don't need to know.  
**Usage**: Never shown to any user  
**Backend Impact**: Keep table, hide from UI entirely

### Commission Ledger → (Hidden)
**Old Term**: Commission Ledger  
**New Term**: (Hidden - backend only)  
**Reason**: Technical accounting concept. Users see "Earnings history" instead.  
**Usage**: Show "Recent transactions" instead of "Commission ledger"  
**Backend Impact**: Keep table, change UI label

### Wallet Balance → Available Earnings
**Old Term**: Wallet Balance  
**New Term**: Available Earnings  
**Reason**: "Wallet" sounds like a separate app. "Available earnings" is clear.  
**Usage**: "Available: 405,000 so'm" instead of "Wallet balance: 405,000 so'm"  
**Backend Impact**: Keep logic, change UI label

### Pending Commission → Pending Earnings
**Old Term**: Pending Commission  
**New Term**: Pending Earnings  
**Reason**: Consistency with "Available Earnings".  
**Usage**: "Pending: 125,000 so'm" instead of "Pending commission: 125,000 so'm"  
**Backend Impact**: Keep logic, change UI label

### Payout → Withdrawal
**Old Term**: Payout  
**New Term**: Withdrawal  
**Reason**: "Payout" is business terminology. "Withdrawal" is what creators actually do.  
**Usage**: "Withdraw" instead of "Request payout"  
**Backend Impact**: Keep Payout table, change UI labels

### Payout Method → Payment Method
**Old Term**: Payout Method  
**New Term**: Payment Method  
**Reason**: "Payout method" is technical. "Payment method" is more natural.  
**Usage**: "Payment method" instead of "Payout method"  
**Backend Impact**: Keep field, change UI label

---

## PRODUCT & INVENTORY

### SKU → (Hidden)
**Old Term**: SKU  
**New Term**: (Hidden - backend only)  
**Reason**: Stock Keeping Unit is inventory terminology. Creators and buyers don't need to know.  
**Usage**: Auto-generate, never show  
**Backend Impact**: Keep field, auto-generate, hide from UI

### Slug → (Hidden)
**Old Term**: Slug  
**New Term**: (Hidden - backend only)  
**Reason**: URL-friendly identifier is technical. Auto-generate from title.  
**Usage**: Auto-generate from title, never show  
**Backend Impact**: Keep field, auto-generate, hide from UI

### Internal Code → (Hidden)
**Old Term**: Internal Code  
**New Term**: (Hidden - backend only)  
**Reason**: Internal identifier for business use. Users don't need to know.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

### Internal Notes → (Hidden)
**Old Term**: Internal Notes  
**New Term**: (Hidden - backend only)  
**Reason**: Internal business notes. Users don't need to know.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

### Cost Price → (Hidden)
**Old Term**: Cost Price  
**New Term**: (Hidden - backend only)  
**Reason**: Business cost information. Creators and buyers don't need to know.  
**Usage**: Never show to creators or buyers  
**Backend Impact**: Keep field, hide from UI

### Variant → Option
**Old Term**: Variant  
**New Term**: Option  
**Reason**: "Variant" is e-commerce terminology. "Option" is more natural.  
**Usage**: "Select option" instead of "Select variant"  
**Backend Impact**: Keep logic, change UI label

### Compare At Price → Original Price
**Old Term**: Compare At Price  
**New Term**: Original Price  
**Reason**: "Compare at price" is technical. "Original price" is natural.  
**Usage**: "Original price: 300,000 so'm" instead of "Compare at price: 300,000 so'm"  
**Backend Impact**: Keep field, change UI label

---

## CREATOR & APPLICATION

### Creator Application → Verification
**Old Term**: Creator Application  
**New Term**: Verification  
**Reason**: "Application" sounds bureaucratic. "Verification" is clearer.  
**Usage**: "Verification" instead of "Creator application"  
**Backend Impact**: Keep CreatorApplication table, change UI labels

### Campaign Application → (Removed)
**Old Term**: Campaign Application  
**New Term**: (Removed - instant join)  
**Reason**: No application needed. Instant join instead.  
**Usage**: Remove entirely, instant "Get Link"  
**Backend Impact**: Keep table for compatibility, but don't use in new flow

### Application Status → Verification Status
**Old Term**: Application Status  
**New Term**: Verification Status  
**Reason**: Consistency with "Verification" terminology.  
**Usage**: "Verification status" instead of "Application status"  
**Backend Impact**: Keep field, change UI label

### Creator Profile → Profile
**Old Term**: Creator Profile  
**New Term**: Profile  
**Reason**: "Creator profile" is redundant. "Profile" is sufficient.  
**Usage**: "Profile" instead of "Creator profile"  
**Backend Impact**: Keep table, change UI label

### Creator Tier → (Hidden)
**Old Term**: Creator Tier  
**New Term**: (Hidden - backend only)  
**Reason**: Internal classification. Creators don't need to know their tier.  
**Usage**: Never show to creators  
**Backend Impact**: Keep field, hide from UI

### Compliance Status → (Hidden)
**Old Term**: Compliance Status  
**New Term**: (Hidden - backend only)  
**Reason**: Internal compliance tracking. Creators don't need to know.  
**Usage**: Never show to creators  
**Backend Impact**: Keep field, hide from UI

---

## CONTENT & MATERIALS

### Creator Content → (Removed)
**Old Term**: Creator Content  
**New Term**: (Removed - no approval needed)  
**Reason**: Content approval is unnecessary friction. Remove entirely.  
**Usage**: Remove content submission and approval  
**Backend Impact**: Keep table for compatibility, but don't use in new flow

### Content Status → (Hidden)
**Old Term**: Content Status  
**New Term**: (Hidden - backend only)  
**Reason**: No content approval, so no status needed.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI

### Promo Materials → Product Images
**Old Term**: Promo Materials  
**New Term**: Product Images  
**Reason**: "Promo materials" is marketing terminology. "Product images" is natural.  
**Usage**: Show product images instead of separate download section  
**Backend Impact**: Remove separate section, use product images

### Content Deadline → (Hidden)
**Old Term**: Content Deadline  
**New Term**: (Hidden - backend only)  
**Reason**: No content submission, so no deadline needed.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI

### Required Elements → (Hidden)
**Old Term**: Required Elements  
**New Term**: (Hidden - backend only)  
**Reason**: Content requirements are unnecessary friction.  
**Usage**: Never show to creators  
**Backend Impact**: Keep field, hide from UI

### Forbidden Elements → (Hidden)
**Old Term**: Forbidden Elements  
**New Term**: (Hidden - backend only)  
**Reason**: Content restrictions are unnecessary friction.  
**Usage**: Never show to creators  
**Backend Impact**: Keep field, hide from UI

---

## ANALYTICS & METRICS

### Conversion Rate → Success Rate
**Old Term**: Conversion Rate  
**New Term**: Success Rate  
**Reason**: "Conversion" is marketing terminology. "Success rate" is more natural.  
**Usage**: "Success rate: 3.5%" instead of "Conversion rate: 3.5%"  
**Backend Impact**: Keep logic, change UI label

### Click-Through Rate → (Hidden)
**Old Term**: Click-Through Rate  
**New Term**: (Hidden - backend only)  
**Reason**: Technical metric. Creators don't need to know.  
**Usage**: Never show to creators  
**Backend Impact**: Keep field, hide from UI

### Average Order Value → Average Order
**Old Term**: Average Order Value  
**New Term**: Average Order  
**Reason**: "Average order value" is wordy. "Average order" is simpler.  
**Usage**: "Average order: 150,000 so'm" instead of "Average order value: 150,000 so'm"  
**Backend Impact**: Keep logic, change UI label

### GMV → Total Sales
**Old Term**: GMV (Gross Merchandise Value)  
**New Term**: Total Sales  
**Reason**: GMV is business terminology. "Total sales" is natural.  
**Usage**: "Total sales" instead of "GMV"  
**Backend Impact**: Keep logic, change UI label

### Net Revenue → Revenue
**Old Term**: Net Revenue  
**New Term**: Revenue  
**Reason**: "Net revenue" is technical. "Revenue" is sufficient.  
**Usage**: "Revenue" instead of "Net revenue"  
**Backend Impact**: Keep logic, change UI label

### Commission Liability → Pending Earnings
**Old Term**: Commission Liability  
**New Term**: Pending Earnings  
**Reason**: "Liability" is accounting terminology. "Pending earnings" is clear.  
**Usage**: "Pending earnings" instead of "Commission liability"  
**Backend Impact**: Keep logic, change UI label

---

## ORDER & PAYMENT

### Order Status → Order Status (simplified)
**Old Term**: Order Status (CREATED, PAYMENT_PENDING, PAID, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, CANCELLED, REFUNDED)  
**New Term**: Order Status (Paid, Shipped, Delivered, Cancelled)  
**Reason**: Too many statuses confuse users. Simplify to 4 key states.  
**Usage**: Show only 4 statuses to users  
**Backend Impact**: Keep all statuses, map to 4 for UI

### Payment Provider → Payment Method
**Old Term**: Payment Provider  
**New Term**: Payment Method  
**Reason**: "Provider" is technical. "Method" is what users understand.  
**Usage**: "Payment method: Click" instead of "Payment provider: Click"  
**Backend Impact**: Keep field, change UI label

### Idempotency Key → (Hidden)
**Old Term**: Idempotency Key  
**New Term**: (Hidden - backend only)  
**Reason**: Technical concept for preventing duplicate requests.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

### Webhook → (Hidden)
**Old Term**: Webhook  
**New Term**: (Hidden - backend only)  
**Reason**: Technical concept for external integrations.  
**Usage**: Never show to any user  
**Backend Impact**: Keep logic, hide from UI

---

## ADMIN & OPERATIONS

### RBAC → (Hidden)
**Old Term**: RBAC (Role-Based Access Control)  
**New Term**: (Hidden - backend only)  
**Reason**: Technical security concept.  
**Usage**: Never show to any user  
**Backend Impact**: Keep logic, hide from UI entirely

### Permission → (Hidden)
**Old Term**: Permission  
**New Term**: (Hidden - backend only)  
**Reason**: Technical access control concept.  
**Usage**: Never show to any user  
**Backend Impact**: Keep logic, hide from UI entirely

### Role → (Hidden)
**Old Term**: Role  
**New Term**: (Hidden - backend only)  
**Reason**: Internal access classification.  
**Usage**: Never show to any user  
**Backend Impact**: Keep logic, hide from UI entirely

### Audit Log → (Hidden)
**Old Term**: Audit Log  
**New Term**: (Hidden - backend only)  
**Reason**: Internal compliance tracking.  
**Usage**: Never show to any user  
**Backend Impact**: Keep table, hide from UI entirely

### Admin → (Hidden label)
**Old Term**: Admin  
**New Term**: (Hidden - use "SOFSAVDO" or brand name)  
**Reason**: "Admin" sounds technical. Use brand name instead.  
**Usage**: "SOFSAVDO team" instead of "Admin"  
**Backend Impact**: Keep logic, change UI labels

---

## TECHNICAL IDENTIFIERS

### CUID → (Hidden)
**Old Term**: CUID  
**New Term**: (Hidden - backend only)  
**Reason**: Technical identifier format.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

### ID → (Hidden)
**Old Term**: ID  
**New Term**: (Hidden - backend only)  
**Reason**: Technical database identifier.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

### Public Token → (Hidden)
**Old Term**: Public Token  
**New Term**: (Hidden - backend only)  
**Reason**: Technical security concept.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

### Hash → (Hidden)
**Old Term**: Hash (IP hash, etc.)  
**New Term**: (Hidden - backend only)  
**Reason**: Technical security concept.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

---

## STATUS & STATE

### Status → Status (simplified)
**Old Term**: Status (many complex enums)  
**New Term**: Status (simplified to Active/Inactive/Pending)  
**Reason**: Too many status values confuse users.  
**Usage**: Simplify to 3 states where possible  
**Backend Impact**: Keep all statuses, map to 3 for UI

### Draft → (Hidden)
**Old Term**: Draft  
**New Term**: (Hidden - auto-save)  
**Reason**: "Draft" implies manual saving. Auto-save instead.  
**Usage**: Auto-save, never show "Draft" status  
**Backend Impact**: Keep field, hide from UI

### Archived → Hidden
**Old Term**: Archived  
**New Term**: Hidden  
**Reason**: "Archived" sounds like storage. "Hidden" is clearer.  
**Usage**: "Hidden" instead of "Archived"  
**Backend Impact**: Keep field, change UI label

---

## COMMUNICATION

### Notification Channel → (Hidden)
**Old Term**: Notification Channel (IN_APP, TELEGRAM, EMAIL)  
**New Term**: (Hidden - backend only)  
**Reason**: Technical routing concept.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI

### Notification Category → (Hidden)
**Old Term**: Notification Category  
**New Term**: (Hidden - backend only)  
**Reason**: Technical classification.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI

### Deduplication Key → (Hidden)
**Old Term**: Deduplication Key  
**New Term**: (Hidden - backend only)  
**Reason**: Technical concept for preventing duplicates.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI entirely

---

## REFERRAL PROGRAM

### Creator Referral → (Hidden)
**Old Term**: Creator Referral  
**New Term**: (Hidden - backend only)  
**Reason**: Creator-to-creator referral is feature creep at current scale.  
**Usage**: Hide from main UI  
**Backend Impact**: Keep tables, hide from UI

### Referral Code → (Hidden)
**Old Term**: Referral Code  
**New Term**: (Hidden - backend only)  
**Reason**: Technical tracking concept.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI

### Referral Reward → (Hidden)
**Old Term**: Referral Reward  
**New Term**: (Hidden - backend only)  
**Reason**: Internal incentive tracking.  
**Usage**: Never show to any user  
**Backend Impact**: Keep tables, hide from UI

### Milestone → (Hidden)
**Old Term**: Milestone  
**New Term**: (Hidden - backend only)  
**Reason**: Internal incentive structure.  
**Usage**: Never show to any user  
**Backend Impact**: Keep field, hide from UI

---

## COMPETITIONS & GAMIFICATION

### Competition → (Hidden)
**Old Term**: Competition  
**New Term**: (Hidden - backend only)  
**Reason**: Gamification is distraction from core value (earning money).  
**Usage**: Hide from main UI  
**Backend Impact**: Keep tables, hide from UI

### Leaderboard → (Hidden)
**Old Term**: Leaderboard  
**New Term**: (Hidden - backend only)  
**Reason**: Gamification is distraction from core value.  
**Usage**: Hide from main UI  
**Backend Impact**: Keep tables, hide from UI

### Creator Fund → (Hidden)
**Old Term**: Creator Fund  
**New Term**: (Hidden - backend only)  
**Reason**: Internal incentive program.  
**Usage**: Hide from main UI  
**Backend Impact**: Keep tables, hide from UI

---

## IMPLEMENTATION NOTES

### Backend Compatibility
- **Keep all existing tables and fields** - Only hide from UI
- **Add view layers** - Create simplified DTOs for UI
- **Map terminology in API** - Transform old terms to new terms in responses
- **Version APIs** - `/v1/` for old terminology, `/v2/` for new terminology

### Migration Strategy
- **Phase 1**: Add new terminology alongside old (both shown)
- **Phase 2**: Show new terminology, old in tooltips
- **Phase 3**: Show only new terminology
- **Phase 4**: Remove old terminology from UI

### Testing Requirements
- **User testing** - Verify new terminology is understood
- **A/B testing** - Compare conversion with old vs new terminology
- **Support analysis** - Track if terminology questions decrease
- **Documentation update** - Update all help docs with new terminology

### Rollback Plan
- **Can revert to old terminology** if new terms cause confusion
- **Keep old terminology in API** for backward compatibility
- **Monitor metrics** - Track if confusion increases
- **Quick revert** - UI changes only, easy to rollback

---

## SUMMARY

**Total Terms Replaced**: 60+  
**Terms Hidden**: 40+  
**Terms Simplified**: 20+  

**Key Changes**:
- Campaign → Product
- Commission → Earnings
- Referral Link → Sharing Link
- Wallet Balance → Available Earnings
- Payout → Withdrawal
- Conversion Rate → Success Rate
- SKU/Slug/Internal IDs → Hidden

**Principle Applied**: If a normal person would not naturally say the word, replace it.

**Next Step**: Create PAGE_SIMPLIFICATION.md to classify every page.
