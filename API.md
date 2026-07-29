# API contract

Full interactive contract will be served at `api.sofsavdo.com/docs` (Swagger/OpenAPI, generated from
NestJS decorators — this file is the human-readable index kept in sync with it, not a
replacement for it). Every mutating endpoint requires a JSON body validated by a Zod-derived DTO
shared from `packages/types`; every list endpoint is paginated (`?page=&pageSize=`, max 100).

## Auth

```
POST   /auth/register              { email|phone, password }
POST   /auth/login                 { email|phone, password } → { accessToken }, refresh via cookie
POST   /auth/refresh
POST   /auth/logout
POST   /auth/logout-all
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
```

## Creator (JWT + `creator` role required unless noted)

```
POST   /creator/application                 create/update the draft application
GET    /creator/application                 current application + status
PATCH  /creator/application                 partial update (step-by-step save)
POST   /creator/application/submit

GET    /creator/dashboard                   KPIs + charts, see ANALYTICS section below
GET    /creator/campaigns                   catalog, filterable (approved creators only)
GET    /creator/campaigns/:id
POST   /creator/campaigns/:id/apply         creates CampaignApplication, or joins instantly
                                             if campaign.requiresApproval = false
GET    /creator/my-campaigns

GET    /creator/referral-links
GET    /creator/promo-codes
GET    /creator/assets                      campaign assets for joined campaigns

POST   /creator/content
GET    /creator/content
PATCH  /creator/content/:id                 creator edits own DRAFT/REVISION_REQUESTED content

GET    /creator/clicks                      own ReferralVisit stats (aggregated, no raw PII)
GET    /creator/sales                       own Order-derived sales list (masked customer data)
GET    /creator/commissions
GET    /creator/balance

POST   /creator/payout-methods
GET    /creator/payout-methods
POST   /creator/payouts
GET    /creator/payouts

GET    /creator/profile
PATCH  /creator/profile
```

## Public (no auth) — buyer-facing, deliberately minimal

```
GET    /offers/:slug/public                 THE ONLY public read of an offer. No list endpoint
                                             exists for offers/products anywhere in this API.
POST   /referrals/track                     records a ReferralVisit (called by the landing page
                                             on load; idempotent per session via visitorId)
POST   /promo-codes/validate                { code, offerId } → discount preview, or a typed error
                                             (see PROMO_CODE errors in the master spec / COMMISSION.md)
POST   /orders                              { offerId, variantId, promoCode?, visitorId,
                                               customer fields, idempotencyKey }
GET    /orders/:publicToken                 buyer's own order-status lookup (opaque token, not
                                             the internal id)
```

There is intentionally no `GET /offers`, `GET /products`, or any endpoint that enumerates more
than one sellable thing to an unauthenticated caller.

## Admin (JWT + RBAC permission per route)

```
GET    /admin/dashboard

CRUD   /admin/products
CRUD   /admin/offers
CRUD   /admin/offers/:id/landing-sections    reorder / toggle / edit LandingSection rows
CRUD   /admin/campaigns
GET    /admin/campaigns/:id/applications
PATCH  /admin/campaigns/:id/applications/:appId   approve/reject

GET    /admin/creators
GET    /admin/creators/:id
PATCH  /admin/creators/:id/status

GET    /admin/applications                   CreatorApplication review queue
PATCH  /admin/applications/:id                approve/revision/reject

GET    /admin/content
PATCH  /admin/content/:id/status

GET    /admin/referral-links
GET    /admin/promo-codes
POST   /admin/promo-codes                     manual promo code (rare — normally system-generated)

GET    /admin/visitors                        ReferralVisit list + fraud flags

GET    /admin/orders
PATCH  /admin/orders/:id/status
POST   /admin/orders/:id/attribution/override  manual attribution (requires permission, audited)

GET    /admin/payments
GET    /admin/commissions
POST   /admin/refunds
PATCH  /admin/refunds/:id/status

GET    /admin/payouts
PATCH  /admin/payouts/:id/status

GET    /admin/analytics/...                   see ANALYTICS section

CRUD   /admin/users                           staff accounts
CRUD   /admin/roles                           role/permission management (super_admin only)
GET    /admin/settings
PATCH  /admin/settings
GET    /admin/audit-log
```

## Analytics endpoints (read-only, scoped by role)

```
GET /creator/dashboard              → clicks/orders/revenue/commission today, MTD, 7/30/90d series
GET /admin/analytics/overview       → revenue, net revenue, AOV, refund rate, creator- vs
                                       direct-driven split, top offers/creators/campaigns
GET /admin/analytics/campaigns/:id  → approved/active creators, published content, clicks,
                                       orders, revenue, commission, refund, ROI
GET /admin/analytics/offers/:id     → views, unique visitors, CTA clicks, checkout starts,
                                       conversion funnel, scroll depth / video-play if tracked
```

All heavy aggregates are read from daily rollup tables populated by a BullMQ job (see
ARCHITECTURE.md §8), not computed live over raw `ReferralVisit`/`Order` tables on every
dashboard load.

## Error shape (all endpoints)

```json
{
  "statusCode": 400,
  "error": "PROMO_CODE_EXPIRED",
  "message": "Human-readable, safe to show to the caller",
  "requestId": "..."
}
```

Typed error codes (not just HTTP status) are required wherever the spec enumerates specific
failure reasons — e.g. promo code validation must distinguish `NOT_FOUND` / `INACTIVE` /
`EXPIRED` / `NOT_STARTED` / `USAGE_LIMIT_REACHED` / `CUSTOMER_LIMIT_REACHED` /
`INVALID_OFFER` / `MINIMUM_AMOUNT_NOT_REACHED` so the frontend can render the right copy instead
of a generic "something went wrong".
