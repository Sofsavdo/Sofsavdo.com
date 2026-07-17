# User flows

## 1. Creator onboarding

```
Register (email/phone + password)
  → verify email or phone
  → personal info + city
  → social accounts (platform, handle, follower count, profile link)
  → audience info (age range, geography, interests)
  → content niches
  → prior partnership experience
  → payout details (card or bank account)
  → accept terms
  → submit application
  → [admin review]
      → APPROVED  → full creator dashboard unlocked
      → REVISION_REQUESTED → creator edits the flagged step, resubmits
      → REJECTED → creator sees reason, can reapply after a cooldown (admin setting)
```
Progress is saved after every step (`CreatorApplication.currentStep`), so a creator
can leave and resume without redoing earlier steps.

## 2. Creator campaign flow

```
Approved creator opens /creator/campaigns
  → filters by platform / product type / commission type / barter / deadline
  → opens a Campaign detail
  → reads offer, commission, content requirements, forbidden claims, deadline
  → applies (or, if the campaign allows instant-join, activates immediately)
  → [admin approval, if the campaign requires it]
  → system generates:
      - ReferralLink (creatorId, campaignId, offerId, unique slug/code)
      - PromoCode (creatorId, campaignId, offerId, unique code)
  → creator downloads brief + assets from /creator/promo-materials
  → creator produces content, submits via /creator/content
      DRAFT → SUBMITTED → UNDER_REVIEW → (REVISION_REQUESTED ⇄ resubmit) → APPROVED → PUBLISHED
      (REJECTED is terminal for that submission; reason is mandatory)
  → content goes live, audience starts clicking the referral link
```

## 3. Buyer flow

```
Buyer sees creator's content (Instagram/TikTok/YouTube/Telegram)
  → clicks creator's individual link → lands on /o/[offerSlug] (never anything else)
  → ReferralVisit recorded server-side (visitorId, campaign, creator, expiresAt)
  → reads offer content, picks a variant/tier
  → clicks the single CTA → /checkout/[offerSlug]
  → single-offer form: contact info (+ address for physical / tarif for course /
    brief for service), promo code (auto-filled from ref, or entered manually),
    payment method
  → POST /orders (idempotency key) → attribution resolved → price recalculated
    server-side → Order + Commission(PENDING) created in one transaction
  → payment adapter runs → webhook confirms
  → buyer sees /order-success/[orderId]; no path back into any other offer
```

## 4. Commission lifecycle

```
Order created           → Commission: PENDING   (snapshotted rule, base amount)
Payment confirmed       → Order: CONFIRMED/PROCESSING
Fulfilled
  physical: SHIPPED → DELIVERED
  course:   access granted → COMPLETED
  service:  booked/started → COMPLETED
Return/refund window elapses with no refund
  → Commission: PENDING → APPROVED → PAYABLE
Refund issued at any point before payout
  → Commission: → REFUNDED (reversal ledger entry, never a silent balance edit)
Creator requests payout (available balance ≥ admin minimum)
  → Payout: REQUESTED → UNDER_REVIEW → APPROVED → PROCESSING → PAID
  → Commission: PAYABLE → PAID
```

Cancelled orders never produce a payable commission. Manual attribution overrides
require an explicit permission and are always written to `AuditLog`.
