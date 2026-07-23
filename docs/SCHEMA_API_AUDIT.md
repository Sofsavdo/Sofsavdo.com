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

## Phase 6 pre-flight addendum (2026-07-17)

Re-run before starting Phase 6, checking `schema.prisma` / `API.md` / `ATTRIBUTION.md` /
`COMMISSION.md` against what Phases 3–5 actually built: `apps/web/src/lib/api/{index,admin}.ts`,
`apps/web/src/services/**`, `apps/web/src/mocks/store.ts`, and the Playwright-verified flow.

| Check | Result |
|---|---|
| Every mock API function has a named counterpart in API.md's route list | ✅ Pass |
| Status enum values used by the mock match schema enums | 🔧 **1 naming collision found** — see below |
| Error codes thrown by the mock cover the spec's required list | 🔧 **partial — gaps below** |
| Money units (so'm ↔ minor) | ✅ Pass — every form converts at the boundary, schema is all-Int |
| Public order lookup never exposes internal `id` | ✅ Pass — `apiGetOrderPublic` keys only on `publicToken` |
| Pagination | 🔧 **gap** — mock does client-side filtering, never models `page`/`pageSize`; real backend must implement it per API.md, frontend list hooks need params added at 6E wiring time |
| RBAC granularity | ℹ️ **by design, not a bug** — see below |

1. **Naming collision, not a bug:** `packages/types/index.ts`'s `CreatorCampaignStatus` (`APPLIED |
   UNDER_REVIEW | APPROVED | REJECTED | ...`, used by the creator-facing "my campaigns" list) is a
   *different concept* from Prisma's `CreatorCampaignStatus` enum (`ACTIVE | PAUSED | ENDED`,
   the post-approval membership status only). The frontend type is a merged view over
   `CampaignApplication.status` + `CreatorCampaign.status`. **Decision:** the backend
   `GET /creator/my-campaigns` DTO must synthesize this merged status server-side (application
   pending/under-review/rejected states collapse from `CampaignApplication`, `ACTIVE`/`PAUSED`/
   `ENDED` come from `CreatorCampaign` once it exists) rather than exposing either Prisma enum
   directly. Do not rename either enum — keep the schema enum scoped to actual membership state.
2. **Error code gaps vs. the Phase 6 spec's required list.** Mock throws: `NOT_FOUND`,
   `INVALID_CREDENTIALS`, `BLOCKED`, `EMAIL_TAKEN`, `WEAK_PASSWORD`, `TERMS_REQUIRED`,
   `ALREADY_APPLIED`, `CREATOR_LIMIT_REACHED`, `INSUFFICIENT_BALANCE`, `INVALID_OFFER`,
   `UNAUTHORIZED`, `SLUG_TAKEN`, `REASON_REQUIRED`, `INVALID_TRANSITION`, `ALREADY_FINALIZED`,
   `ALREADY_PAID`, `FORBIDDEN`. Missing from the spec's required set: `CREATOR_NOT_APPROVED`,
   `CAMPAIGN_FULL` (mock only has `CREATOR_LIMIT_REACHED` — same concept, rename to
   `CAMPAIGN_FULL` for the real API to match the spec), `PROMO_NOT_FOUND`, `PROMO_EXPIRED`,
   `PROMO_USAGE_LIMIT` (mock's promo path throws generic `INVALID_OFFER`/`NOT_FOUND` without
   distinguishing promo failure reasons — real backend must add distinct codes),
   `OFFER_INACTIVE`, `BELOW_MINIMUM` (mock has no payout-minimum check at all — real gap),
   `PAYOUT_ALREADY_RESERVED`, `CONFLICT`, `VALIDATION_ERROR` (mock relies on client-side Zod only,
   never returns a structured validation error). Backend module list in §33 must implement all of
   these; `INVALID_TRANSITION` renamed to `INVALID_ORDER_TRANSITION` to match the spec exactly.
3. **RBAC granularity — intentional, not a gap.** Frontend only ever checks a coarse role rank
   (`MANAGER < ADMIN < SUPER_ADMIN` via `hasRole()`/`RoleGuard`) to hide/show UI. It never models
   the spec's fine-grained permission keys (`product.write`, `payout.approve`, etc.). This is
   correct per the spec's own instruction ("frontend may just hide buttons; backend must check
   permission per endpoint") — the backend's `PermissionsGuard` is the real enforcement layer and
   must define the full permission-key list independently, with a default role→permissions seed
   matching the three roles' current capabilities in the frontend.
4. **Pagination is not yet a frontend concern.** Admin list pages currently fetch the full mock
   collection and filter/paginate client-side. The real backend must still implement
   `?page=&pageSize=` (max 100) per API.md on every list endpoint now, even though frontend query
   hooks won't pass those params until the Phase 6E vertical-slice wiring — documented here so the
   6A/6B/6C DTOs aren't built page-less and then need a breaking change later.
