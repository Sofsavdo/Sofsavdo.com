# Schema ↔ API consistency audit (2026-07-17)

Run before starting Phase 2, per user request. Checked `apps/api/prisma/schema.prisma` against
[API.md](../API.md), [COMMISSION.md](../COMMISSION.md), and [ATTRIBUTION.md](../ATTRIBUTION.md).
Re-validated after fixes: `npx prisma validate` passes, `npx prisma generate` succeeds.

## Checklist and result

| Check | Result |
|---|---|
| Every entity API.md references exists in schema | ✅ Pass — no gaps found |
| Enum/status values match the spec's lists exactly | ✅ Pass (CreatorApplicationStatus, CreatorContentStatus, OrderStatus, PaymentStatus, CommissionStatus, PayoutStatus, CampaignStatus, OfferStatus, ProductStatus, CampaignApplicationStatus all cross-checked) |
| Relations & unique constraints | 🔧 **2 gaps found and fixed** — see below |
| Financial values stored as integers | ✅ Pass, plus 🔧 clarified dual-meaning fields |
| Indexes | 🔧 **2 missing indexes added** |
| Models needing soft-delete | 🔧 **1 gap found and fixed** (PayoutMethod) |
| Audit log | ✅ Pass — `AuditLog` model present, generic before/after diff |
| Idempotency | ✅ Pass — `Order.idempotencyKey`, `Payment.idempotencyKey` both `@unique` |
| Commission snapshot | ✅ Pass — `CommissionRule` versioned, `Commission.commissionRuleId` FK, see COMMISSION.md |
| Attribution uniqueness | 🔧 **1 real bug found and fixed** — see below, most significant finding |
| Payout double-spend protection | ✅ Pass — `Commission.payoutId` is a scalar FK (a commission can only belong to one payout by construction); the remaining race (two concurrent payout requests selecting the same not-yet-assigned commission) is a transaction/row-lock concern for `PayoutsModule`, correctly scoped to application code, not schema |

## Fixes applied

1. **`Attribution.referralVisitId` was incorrectly `@unique` — real bug, not just a style
   nit.** Per ATTRIBUTION.md, a buyer can return via the same click and place more than one
   order inside the attribution window; each such order gets its own `Attribution` row pointing
   at the *same* `ReferralVisit`. A unique constraint on that FK would have made the second
   order's insert fail outright (or forced application code to drop attribution for repeat
   purchases, silently costing the creator commission). Removed the `@unique`; kept
   `Attribution.orderId`'s `@unique` (the guarantee that actually matters — one order, one
   attribution) intact. Updated the `ReferralVisit` back-relation from `Attribution?` to
   `Attribution[]` accordingly.
2. **`ReferralLink` and `PromoCode` had no composite uniqueness on `(creatorId, campaignId)`.**
   DATABASE.md already asserted "one link/code per creator per campaign" as an invariant, but
   nothing enforced it — a double-click on "generate my link" in the UI, or a retried request,
   could have minted two active referral links (and two promo codes) for the same creator on the
   same campaign, splitting their click/sales history across two identities. Added
   `@@unique([creatorId, campaignId])` to both models.
3. **Missing indexes:** `ReferralVisit.campaignId` and `Order.campaignId` — both are filtered on
   directly by campaign-scoped admin analytics (`GET /admin/analytics/campaigns/:id`) and would
   have forced a sequential scan at any real data volume.
4. **`PayoutMethod` had no soft-delete flag.** `Payout.payoutMethodId` is a required FK; a
   creator "removing" a card/account would have had no safe path — hard-deleting the
   `PayoutMethod` row would break every historical `Payout`'s reference. Added
   `isActive Boolean @default(true)`; removal in the UI is a deactivation, not a delete.
5. **Documented the dual-meaning of discount/commission integer fields.** `commissionValue`,
   `Campaign.customerDiscountValue`, and `PromoCode.discountValue` all reuse one `Int` column to
   mean either basis points or a minor-unit amount depending on a sibling `type` enum. This was
   already intentional (COMMISSION.md documents it for `commissionValue`) but wasn't called out
   next to the other two fields in the schema itself — added matching inline comments so a
   future reader doesn't have to rediscover the convention from COMMISSION.md alone.
6. **Documented case-insensitive promo code matching without a citext dependency.** `PromoCode.code`
   is a plain unique `String`; case-insensitivity (required by the spec) is enforced by
   `PromoCodesModule` always normalizing codes to uppercase on write and on lookup, rather than
   by adding a Postgres extension. Noted inline in the schema.

## Not changed, and why

- `Address` rows can be referenced by multiple `Order`s (a customer's saved address reused
  across purchases). Editing an `Address` in place could retroactively change what a past
  shipped order "shows" as its delivery address. This is flagged as an **application-level rule**
  (never mutate an `Address` once any `Shipment` referencing its `Order` has left `PENDING`;
  create a new `Address` row instead) rather than a schema change, since the reuse itself is
  desirable and the correct fix is a service-layer invariant, not a structural one.
- `Product`/`Offer`/`Campaign` already have status-enum-based soft delete (`ARCHIVED`/
  `CANCELLED`), so no separate `deletedAt` column was added to them.
