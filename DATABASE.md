# Database

Full schema: [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) (validated against
Prisma 7 — `npx prisma validate` passes, client generates cleanly).

## Conventions

- **All money is `Int`, minor units** (1 so'm = 100 minor units). No `Float`, no naive
  `Decimal`-as-string-then-parse. Every monetary field is suffixed `Minor`.
- **IDs are `cuid()`** — sortable-ish, collision-safe, no auto-increment enumeration leak.
- **Every state-carrying entity has an explicit enum status**, never a boolean flag standing in
  for a multi-state lifecycle (e.g. `OrderStatus`, not `isDelivered: boolean`).
- **Snapshots over live joins for money-relevant data.** `Order.offerSnapshot` (Json) and
  `CommissionRule` (a versioned copy of a Campaign's commission terms) exist specifically so that
  editing a live Offer or Campaign later never rewrites the economics of a past order.
- **Ledger over mutable balance.** `CommissionLedger` is append-only; a creator's balance is
  always a sum over ledger rows, never a single mutable integer column that could be
  double-decremented by a race condition.

## Entity groups

### Auth/RBAC
`User → UserRole → Role → RolePermission → Permission`. A `User` is the login identity shared by
staff and creators; `CreatorProfile` is a 1:1 extension of `User` for creator-specific fields, so
creator and admin accounts live in the same auth table without creators inheriting staff
permissions or vice versa.

### Creator
`CreatorProfile → SocialAccount[]`, `CreatorProfile → CreatorApplication[]` (the approval
lifecycle, one profile can reapply after rejection so this is a list, not 1:1).

### Product / Offer / Campaign
`Product → Offer[] → OfferVariant[]`; `Offer → LandingPage → LandingSection[]`;
`Offer → Campaign[]` (an Offer can run under more than one simultaneous Campaign — see
PRODUCT_MODEL.md). `Campaign → CampaignApplication[]` (creator asks to join) and, once approved,
`Campaign → CreatorCampaign[]` (the active join record that content and referral links hang off).

### Referral / Attribution / Promo
`CreatorCampaign` → creator gets one `ReferralLink` and one `PromoCode` per `(creator, campaign)`
pair — enforced by `@@unique([creatorId, campaignId])` on both models, plus the 1:1
`ReferralLink.promoCodeId`. `ReferralVisit` is the high-volume click log; `Attribution` is one row
per `Order` (`Attribution.orderId` is `@unique`), written once at order-creation time by the
Attribution engine and never mutated except through the explicit manual-override path
(`manualById` + `manualReason`, always paired with an `AuditLog` row — see ATTRIBUTION.md). A
single `ReferralVisit` is **not** unique-constrained to one `Attribution` — a buyer can return via
the same click and purchase more than once inside the attribution window, and each such order gets
its own `Attribution` row pointing at the same visit (see
[docs/SCHEMA_API_AUDIT.md](docs/SCHEMA_API_AUDIT.md) for why this was a bug the first time it was
modeled as unique).

### Order / Payment / Shipping
`Order` is the transactional root: it snapshots the offer content and price, and fans out to
`OrderItem[]`, `OrderStatusHistory[]` (append-only audit of status transitions),
`Payment` (1:1 — one order, one payment attempt record; retries are modeled inside
`Payment.webhookPayloads` and provider reference, not as multiple Payment rows, since a retried
payment for the same order reuses the same idempotency key), and `Shipment` (physical orders
only).

### Commission / Refund / Payout
`CommissionRule` snapshots a `Campaign`'s commission terms; `Commission` references one
`CommissionRule` and one `Order` (1:1) and accumulates `CommissionLedger` entries. `Refund`
against an `Order` triggers a `REVERSAL` ledger entry against its `Commission`, it never deletes
or edits the original `ACCRUAL` row. `Payout` batches one or more `Commission` rows (via
`Commission.payoutId`) once they reach `PAYABLE`.

### Cross-cutting
`Notification` (in-app/Telegram fan-out), `AuditLog` (generic before/after diff keyed by
entityType+entityId, used for every admin override), `Setting` (key/Json — e.g. minimum payout
amount, default attribution window), `FileAsset` (uploads, referenced by `CampaignAsset` and
`CreatorProfile.avatarFileId`).

## Key invariants enforced by the schema (not just by application code)

- `Order.idempotencyKey` and `Payment.idempotencyKey` are `@unique` — a retried request cannot
  create a second order or a second payment attempt at the database level.
- `Attribution.orderId` and `Commission.orderId` are `@unique` — one order can have at most one
  attribution and at most one commission row, structurally preventing double-crediting a sale.
- `CampaignApplication` has `@@unique([campaignId, creatorId])` and `CreatorCampaign` the same —
  a creator cannot apply to or join the same campaign twice.
- `ReferralLink.promoCodeId` is `@unique` — a promo code can back at most one referral link.
- `ReferralLink` and `PromoCode` both have `@@unique([creatorId, campaignId])` — a creator cannot
  end up with two active links or two active codes for the same campaign.
- `PromoCodeUsage.orderId` is `@unique` — a promo code's usage count is derived from a table an
  order can appear in at most once, not from a mutable counter alone (`PromoCode.usageCount` is a
  denormalized fast-path counter kept in sync inside the same transaction, `PromoCodeUsage` is the
  source of truth for per-customer limit checks).
- `PayoutMethod.isActive` — removing a payout method is a deactivation, never a hard delete,
  since historical `Payout` rows hold a required FK to it.

Full audit trail for these invariants (including one real bug found and fixed —
over-constraining `Attribution.referralVisitId`): [docs/SCHEMA_API_AUDIT.md](docs/SCHEMA_API_AUDIT.md).

## Migrations

Local dev: `docker-compose up -d postgres redis`, then
`cd apps/api && npx prisma migrate dev --name init`. No migration exists yet — this is Phase 1
architecture, migrations get generated in Phase 6 once the schema is confirmed. `prisma generate`
has already been run once against this schema to confirm it compiles.
