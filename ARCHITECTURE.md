# Architecture

## 1. What this system is

A single business owner sells their own physical products, courses, and services.
Approved creators discover active campaigns in a closed catalog, activate the ones
they want to promote, and receive an individual referral link + promo code per
campaign. Their audience is sent to exactly one offer landing page. Purchases are
attributed back to the creator, commission is calculated and snapshotted, and the
creator withdraws it through a payout flow. Admin operates every part of this from
one panel.

It is explicitly **not**: a public storefront, a multi-vendor marketplace, a public
course/service catalog, or a system with cross-selling or general browsing. See
[docs/PROHIBITED.md](docs/PROHIBITED.md) for the enforced negative list.

## 2. Three audiences, three experiences

| Audience | Surface | Can see |
|---|---|---|
| Creator | `/creator/*` | Full campaign catalog, own stats, own links/codes |
| Buyer | `/o/[offerSlug]`, `/checkout/[offerSlug]` | Exactly one offer. No nav to anything else. |
| Admin/Manager | `/admin/*` | Everything: products, offers, campaigns, creators, orders, money |

This split is enforced at three layers, not just hidden in the UI:
1. **Routing** — the buyer-facing Next.js route group has no links, no search
   component, and no shared layout with the creator/admin apps.
2. **API** — `GET /offers/:slug/public` returns only that offer's data; there is no
   `GET /offers` public list endpoint at all.
3. **Data** — `Product.status` and catalog visibility are admin/creator-only; there is
   no query path that lets an unauthenticated buyer enumerate products.

## 3. Monorepo layout

```
apps/
  web/                Next.js 14+ App Router, TypeScript strict
    app/
      (creator)/creator/...      creator dashboard, auth'd
      (buyer)/o/[offerSlug]      offer landing, public
      (buyer)/checkout/[offerSlug]
      (buyer)/order-success/[orderId]
      (admin)/admin/...          admin panel, auth'd + RBAC
      (public)/                  minimal corporate root page
    src/
      lib/api/            typed API client wrappers (no ad-hoc fetch in components)
      services/            per-domain service functions built on lib/api
      components/
      features/            domain-oriented feature folders (creator, offer, admin)
  api/                 NestJS, modular monolith (see §4)
    prisma/schema.prisma
    src/
      modules/<domain>/{*.module,*.controller,*.service,dto/}.ts
      common/           guards, interceptors, pipes, filters
packages/
  types/                Shared enums/DTOs/zod schemas used by both apps
  config/               tsconfig base, eslint, tailwind preset
  ui/                   shadcn-based shared components (buttons, cards, charts wrappers)
docs/                   Supplementary notes (prohibited list, ADR appendix)
```

Rationale for a **modular monolith** over microservices (see [DECISIONS.md](DECISIONS.md) ADR-002):
single team, single deploy target at MVP scale, transactional integrity across
Order → Commission → Ledger is much simpler in one process/DB, and NestJS modules
already give clean domain boundaries if we need to peel a service out later.

## 4. Backend modules (NestJS)

```
AuthModule            UsersModule           RolesModule
CreatorsModule        SocialAccountsModule  CreatorApplicationsModule
ProductsModule        OffersModule          LandingPagesModule
CampaignsModule       CampaignApplicationsModule  CreatorContentModule
AssetsModule          ReferralLinksModule   ReferralVisitsModule
AttributionModule     PromoCodesModule
OrdersModule          PaymentsModule        ShippingModule
CommissionsModule     RefundsModule         PayoutsModule
NotificationsModule   AnalyticsModule       SettingsModule
AuditModule           FilesModule           TelegramModule
```

Each module: `controller` (HTTP + DTO validation only) → `service` (business logic,
wraps Prisma transactions) → Prisma as the data-access layer (no separate repository
class unless a module needs to swap storage, which none do at MVP). Cross-module
calls happen through injected services, never through direct Prisma access into
another module's tables — this is what keeps module boundaries real instead of
decorative.

### Why these modules are split the way they are
- `ReferralLinksModule` (the link entity, CRUD) is separate from `ReferralVisitsModule`
  (the click-log, high write volume, candidate for a different retention/partition
  policy later) and both are separate from `AttributionModule` (the decision engine
  that reads visits + promo usage and decides who an order belongs to). Merging
  these would hide the fact that "recording a click" and "resolving attribution for
  an order" have completely different consistency and performance requirements.
- `CommissionsModule` computes and snapshots; `PayoutsModule` only moves already-
  approved commission balances out. Keeping payout logic away from commission
  calculation is what makes the "snapshot never changes retroactively" rule
  (see [COMMISSION.md](COMMISSION.md)) enforceable — payout code physically cannot
  recalculate a commission, it can only read the ledger.

## 5. Route map

```
/                                   minimal corporate page (brand, creator program CTA, login, support)
/creator/login
/creator/register
/creator/onboarding
/creator/dashboard
/creator/campaigns
/creator/campaigns/[id]
/creator/my-campaigns
/creator/content
/creator/promo-materials
/creator/clicks
/creator/sales
/creator/commissions
/creator/balance
/creator/payouts
/creator/notifications
/creator/profile

/o/[offerSlug]                     public offer landing — the ONLY thing a buyer sees
/checkout/[offerSlug]               single-offer checkout
/order-success/[orderId]

/admin/dashboard
/admin/products
/admin/offers
/admin/landings
/admin/campaigns
/admin/creators
/admin/applications
/admin/content
/admin/referral-links
/admin/promo-codes
/admin/visitors
/admin/orders
/admin/payments
/admin/commissions
/admin/refunds
/admin/payouts
/admin/analytics
/admin/users
/admin/settings
/admin/audit-log
```

`/creator/*` and `/admin/*` are `noindex`. `/o/[offerSlug]` is indexable per-offer,
controlled by an admin toggle; the `ref` query parameter is stripped from the
canonical URL (see SEO notes in DECISIONS.md ADR-006).

## 6. Request flow example — buyer purchase

```
Creator's audience clicks sofsavdo.com/o/serum?ref=malika
  → Next.js server component fetches GET /offers/serum/public
  → API resolves referral code "malika" for offer "serum", writes a ReferralVisit
    (visitorId, sessionId, ip hash, UA, utm params, expiresAt = now + campaign.attributionWindowDays)
  → landing renders offer content + personalization block ("Malika tavsiyasi orqali...")
Buyer picks a variant, goes to /checkout/serum
  → POST /orders { offerId, variantId, promoCode?, customer fields, idempotencyKey }
  → API: AttributionModule resolves creator (promo code > visit, see ATTRIBUTION.md)
         PromoCodesModule validates code server-side
         OrdersModule creates Order + OrderItem inside a transaction, snapshotting
         price/discount/offer content at that instant
         CommissionsModule creates a PENDING Commission snapshot in the same transaction
  → PaymentsModule initiates payment (adapter pattern, see §7)
  → webhook confirms payment → Order status progresses → on delivery/completion,
    Commission moves PENDING → APPROVED → PAYABLE
```

## 7. Payment adapter pattern

```ts
interface PaymentProvider {
  createPayment(order: OrderSnapshot): Promise<PaymentIntent>;
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string,string>): boolean;
  handleWebhook(payload: unknown): Promise<PaymentResult>;
}
```
Concrete adapters: `ClickProvider`, `PaymeProvider`, `UzumNasiyaProvider`,
`CardProvider`, `CashOnDeliveryProvider`, and a `MockProvider` used until real
merchant credentials exist — same interface, so swapping in production credentials
later requires zero call-site changes.

## 8. Background jobs (BullMQ + Redis)

- Payout batch processing / status polling
- Commission auto-transition after delivery/refund-window expiry
- Notification fan-out (in-app + Telegram)
- Analytics rollups (daily creator/campaign/offer aggregates, so dashboards don't
  scan raw event tables live)

## 9. Frontend data flow

Components never call `fetch` directly. `src/lib/api/*` holds one typed function per
endpoint (using the shared `packages/types` DTOs); `src/services/*` composes those
into TanStack Query hooks (`useCreatorDashboard()`, `useOfferPublic(slug)`, etc.).
Forms use React Hook Form + Zod resolvers sharing the same Zod schemas the API
validates DTOs against, generated once in `packages/types` so frontend and backend
validation cannot drift apart.
