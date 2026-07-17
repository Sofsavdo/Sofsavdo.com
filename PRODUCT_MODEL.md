# Product — Offer — Campaign

These three concepts are kept as separate database entities and separate admin
screens, on purpose — collapsing them into one "product" table is the single most
common way this kind of platform quietly turns into a generic e-commerce app.

## Product

The thing itself. What it *is*, not how it's sold or promoted.

```
type: PHYSICAL_PRODUCT | DIGITAL_PRODUCT | COURSE | SERVICE | CONSULTATION
name, slug, shortDescription, description, brand, sku, status (DRAFT|ACTIVE|ARCHIVED)
images, videos, attributes, costPrice, currency, internalNotes
```

A Product is never rendered to a buyer directly and never appears in any public
list. It exists only as the thing an Offer is built on top of.

*Examples: a face serum. The "Marketplace" course. The "AI va vibe coding" course.
A startup-MVP-build service. A paid consultation slot.*

## Offer

A concrete way to sell one Product: a price, a variant, a discount, a payment
option, and — critically — the landing page that presents it.

```
productId, name, slug, offerType, headline, subheadline
price, compareAtPrice, currency, variants[], bonuses[]
deliveryInfo, paymentOptions[], installmentOptions[]
ctaType: BUY_NOW | ORDER_FORM | APPLY_NOW | BOOK_CALL | PAY_INSTALLMENT
startsAt, expiresAt, status: DRAFT|ACTIVE|PAUSED|EXPIRED|ARCHIVED
landingTemplate, seoTitle, seoDescription
```

One Product can have multiple Offers. Example — the Marketplace course:

| Offer | Price | Terms | (Campaign) creator commission |
|---|---|---|---|
| Full payment | 2,990,000 so'm | one-time | 20% |
| Installment | — | 12 months | 300,000 so'm fixed |
| Premium tier | higher | one-time, extra content | 25% |

Each Offer gets exactly one landing page (`/o/[offerSlug]`), built from ordered,
toggleable sections (see ARCHITECTURE.md and the `LandingPage`/`LandingSection`
Prisma models) — never a shared generic product-page template that lists other
products.

## Campaign

The thing a creator actually sees and joins. A Campaign wraps one Offer with the
promotional rules: who should promote it, how, for what cut.

```
offerId, name, slug, description, goal, targetAudience
platforms[], contentFormats[], requiredElements[], forbiddenElements[], referenceContent
startDate, endDate, applicationDeadline, creatorLimit
commissionType: PERCENTAGE|FIXED_PER_SALE|FIXED_CONTENT_FEE|HYBRID, commissionValue, fixedPayment
customerDiscountType, customerDiscountValue
barterEnabled, freeProduct
attributionWindowDays
status: DRAFT|OPEN|ACTIVE|PAUSED|COMPLETED|CANCELLED
assets[]
```

Creators never browse Products or Offers directly — the `/creator/campaigns`
catalog lists **Campaigns**. Selecting one and getting approved is what generates
that creator's individual `ReferralLink` + `PromoCode`, both scoped to
`(creatorId, campaignId, offerId)`.

## Why three tables, not one

- Changing a Campaign's commission rate must never rewrite historical orders —
  only possible if Campaign/Offer/Order are distinct rows with the Order pinning a
  `CommissionRule` snapshot at creation time (see COMMISSION.md).
- One Offer can be attached to zero, one, or several simultaneous Campaigns (e.g.
  the same "premium tier" offer run as both an Instagram campaign and a Telegram
  campaign, with different commission terms) without duplicating price/variant data.
- Admin needs to edit landing copy (Offer-level) independently of creator-facing
  brief/commission terms (Campaign-level) without one screen's save accidentally
  touching the other's data.
