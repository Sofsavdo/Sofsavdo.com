# Analytics & Business Intelligence Domain — Phase 13 Design

> **STATUS: DESIGN ONLY — NOT IMPLEMENTED.** No code, migration, or schema change has been made
> for this domain. Everything below is a proposal for review. Implementation does not start until
> this document is explicitly approved, per the phase instructions.

## 0. What was studied before writing this

Read in full before proposing anything: `PROJECT_STATUS.md` (all 12 phases), `DECISIONS.md`
(all 19 ADRs, ADR-019 closely), `RBAC.md`, the complete `apps/api/prisma/schema.prisma` (1,654
lines, every model), and the source of `orders.service.ts`, `checkout.service.ts`,
`admin-creators.service.ts`, `admin-payments.service.ts`, `admin-refunds.service.ts`,
`referrals.service.ts`, `common/pagination/pagination.dto.ts`, `common/audit/audit.service.ts`,
`notification-sweep.service.ts` (for the existing scheduled-job pattern), plus the current mock
`/admin/analytics` and `/admin/dashboard` pages and their mock data shape
(`apiAdminGetAnalytics`/`apiAdminGetDashboard` in `src/mocks/store.ts`). Findings from that reading
are woven through this document rather than listed separately, and load-bearing ones are called
out explicitly as **Finding**.

---

## 1. Interpretation of the three audiences

- **Platform Owner** — the Executive Dashboard: a small number of trustworthy, always-visible
  headline numbers (§9), trend context, and no drill-down responsibility of their own (they read,
  they don't filter fifteen ways).
- **Admin Team** — the operational analytics: Creator/Campaign/Product/Payment/Refund/Customer
  views, all filterable, all paginated, used to answer "what's happening in category X" and to
  spot outliers (a slow-moving product, a creator whose approval rate dropped).
- **Future Business Intelligence** — not a UI at all. This means: a stable, versioned API surface
  a future external BI tool (Metabase, a data warehouse sync, a public partner API) could consume
  without the frontend being the only client. This shapes §5–§7: analytics logic lives entirely in
  backend services with a real HTTP API, never as frontend-only aggregation over list endpoints.

**Scope clarification (a real ambiguity in the request, resolved here):** "Creator Analytics"
below is the **admin's view of creator performance**, not a creator-facing self-service page. The
three named audiences are Platform Owner, Admin Team, and future BI — not creators. A creator's own
performance view already exists (`/creator/dashboard`, `/creator/wallet`, `/creator/commissions`,
built in earlier phases) and is out of scope here; Phase 13 does not duplicate it.

---

## 2. Concrete findings from studying the current data model

These are not guesses — each was confirmed by reading the actual schema/service code, and each
materially shapes the design below.

1. **No `createdAt` index exists on `Order`, `Payment`, `Refund`, or `Commission`.** Every one of
   these models is indexed on `status` and its foreign keys, but not on `createdAt`. Analytics is
   fundamentally a time-series domain — every single KPI in this document is "X within a date
   range." Querying by date range today means a sequential scan filtered by an unindexed column at
   any real data volume. **This is the single most important infrastructure gap this design
   surfaces** — see §8 (Query Strategy) and §12 (Risks). No index was added while writing this
   document; that would violate "do not modify the database" for a design-approval step. It is
   listed as the first required action of implementation.
2. **`ReferralVisit` only records referred traffic, not organic/direct traffic.**
   `CheckoutService.trackVisit()` returns immediately without writing a row when `refCode` is
   absent (confirmed by reading the method — the early-return is unconditional). This means: there
   is currently **no way to measure site-wide "views" or "conversion rate" for traffic that didn't
   arrive via a creator's referral link.** The Executive Dashboard's "Conversion Rate" and the
   Creator Analytics "Views (future-ready)" requirement both run into this. §3 and §11 address it
   directly rather than silently inventing numbers.
3. **`Refund.reason` is free-text (`String`), not an enum.** "Refund reasons" analytics (a
   requested deliverable) needs categorical grouping to chart meaningfully. Grouping free text
   requires either (a) a future enum + migration, or (b) frequency-ranking the raw strings as-is
   (a simple `GROUP BY reason` still works, it just won't normalize "mahsulot nosoz" vs. "mahsulot
   ishlamayapti" into one bucket). Recommendation is in §11.6.
4. **Commission rows are created at order-creation time**, inside the same transaction as the
   order (confirmed in `OrdersService`, not on a later PAID webhook) — so `Commission.createdAt` ≈
   `Order.createdAt`, meaning creator-earnings time-series can bucket by either field
   interchangeably. This simplifies §8's query design (no need to join through `Order` just to get
   a comparable timestamp).
5. **Redis is provisioned and verified reachable, but is used nowhere in the codebase except the
   health check.** Phase 13 would be the first real consumer of it as an actual cache, not a new
   piece of infrastructure — no new service to stand up, just a new use of an existing one.
6. **No export library (CSV/Excel/PDF) exists anywhere in the backend today.** The only existing
   "export" is the Phase 5 mock's client-side CSV string-join (`apiAdminExportAnalyticsCsv` in
   `mocks/store.ts`). CSV needs no new dependency (string-join, same technique, just computed
   server-side over real data). Excel and PDF are genuinely new capabilities requiring a new
   dependency each — flagged explicitly in §11, not silently assumed available.
7. **`recharts` (already a dependency, already used for `AdminDashboardChart`/`DashboardChart`) is
   sufficient for every chart type this domain needs** — bar, line, area, pie, funnel are all part
   of the same package already installed. No new charting library is required.
8. **`analytics.read` and `analytics.export` already exist in `RBAC.md`**, reserved and unused
   since Phase 6A, granted `analytics.read` to MANAGER/ADMIN/SUPER_ADMIN and `analytics.export` to
   ADMIN/SUPER_ADMIN only. This is the same "reserved key anticipated years ago, first real
   consumer lands now" pattern every phase since 6B has followed — see §10. It means **RBAC needs
   zero new permission keys** for this domain, the same "add only missing permissions, and none
   were missing" outcome Phase 8/9 already had.
9. **A mock Executive Dashboard and Analytics page already exist** (`/admin/dashboard`,
   `/admin/analytics`, Phase 5), with a specific, already-designed data shape (revenue,
   netRevenue, orders, paidOrders, conversionRate, AOV, refundRate, top creators/campaigns/offers,
   a 5-stage funnel, CSV export, campaign/offer/creator filters). Per the established convention
   for every phase 10+ domain (Notifications, Onboarding, Admin Operations), the real
   implementation should **replace this mock page entirely** with a real-backed one — not add a
   parallel `Real`/`Mock` branch that has to be maintained forever. The mock's shape is a useful
   starting reference for what fields the frontend already expects, not a contract that has to be
   preserved unchanged.

---

## 3. Decisions this design makes explicit (need business/product sign-off before coding)

Analytics is unusually full of definitions that are genuinely ambiguous until someone states them.
Rather than silently picking one and hiding the ambiguity, each is stated here as a recommendation
with its reasoning, so it can be confirmed or overridden before implementation.

| Term | Recommended definition | Why |
|---|---|---|
| **GMV** | Σ `Order.totalMinor` for orders in-period with status ∈ `{PAID, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, REFUNDED}` | "Gross value of everything that became a real transaction" — includes orders later refunded (the sale happened), excludes carts that never got past `CREATED`/`PAYMENT_PENDING`/`CANCELLED`. |
| **Revenue** | Same set, minus `REFUNDED` | "What the platform actually retained." GMV − Revenue = refunded value. |
| **Net Revenue** (already in the Phase 5 mock shape) | Revenue − Σ `Refund.amountMinor` where status ∈ `{APPROVED, PROCESSED}` in-period | Matches the existing mock field so the frontend contract doesn't need renaming. |
| **Paid Orders** | Orders whose *current* status ∈ `{PAID, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, REFUNDED}` | `OrderStatus` is a linear pipeline (confirmed in schema comments) — `REFUNDED` is only reachable after `PAID`, so current-status is a safe proxy for "reached PAID at some point" without needing to scan `OrderStatusHistory`. |
| **Pending Orders** | status ∈ `{CREATED, PAYMENT_PENDING}` | Awaiting payment resolution. |
| **Refund Rate** | Orders with an `APPROVED`/`PROCESSED` refund in-period ÷ Paid Orders in the same period | Matches how the Phase 5 mock already frames it (`s.refunds.length / orders.length`), tightened to only count decided refunds, not raw requests. |
| **Active Creators** | Distinct `creatorId` with ≥1 `Attribution` (an attributed sale) in the selected period | Chosen over "has an `ACTIVE` `CreatorCampaign` row" because it's period-comparable (varies week over week, so Comparison Mode has something real to compare) — a membership snapshot doesn't. Flagged as a decision, not a certainty: if the Owner wants "currently has any active campaign membership" instead, that's a one-line query swap, not a redesign. |
| **Active Campaigns** | `Campaign.status = ACTIVE`, counted **as of the period's end date**, not a flow metric | This is inherently a snapshot, not a period total — Comparison Mode should show "as of [end of period A]" vs. "as of [end of period B]," not a summed count. |
| **Active Products** | `Product.status = ACTIVE` **and** has ≥1 `Offer.status = ACTIVE` | A product with zero sellable offers isn't actually purchasable; counting it as "active" would overstate the catalog. |
| **Conversion Rate** | Paid Orders with an `Attribution` row ÷ `ReferralVisit` count, same period | **Only measures creator-attributed traffic** (Finding #2). Explicitly labeled "Creator-Attributed Conversion Rate" in the UI, not plain "Conversion Rate," until a real site-wide visit-tracking model exists (§11.1). Overstating this as whole-site conversion would be a real, misleading number shown to the Owner — worse than not showing it. |
| **New / Returning Customers** | New = `Customer` whose first-ever `Order.createdAt` falls in-period. Returning = `Customer` with ≥2 total orders ever, at least one in-period. | Computed via `MIN(createdAt)` per customer today (no denormalized "first order date" field exists, and adding one is a schema change out of scope here) — a rollup candidate at scale, see §9. |
| **Refund reasons** | Group raw `Refund.reason` strings as-is (`GROUP BY reason`, ranked by count) | No enum exists (Finding #3). This gives a real, if unnormalized, "top refund reasons" list from day one; normalizing into a fixed taxonomy is a separate, later schema decision if the raw grouping proves too noisy in practice. |

None of these need to block *design approval* — they need to be confirmed (or overridden) before
the first query is written, since changing a KPI's definition after a dashboard ships is a much
more visible correction than agreeing on it now.

---

## 4. Overall analytics architecture

Three tiers, chosen specifically because of Finding #1 (no time-series indexes yet) and Finding #5
(Redis idle):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 3 — Cache (Redis, already provisioned, currently idle)         │
│  key: sha256(view + resolved-date-range + filters + compareMode)    │
│  TTL: 60s for ranges that include "today"; 15 min for closed        │
│  historical ranges (a closed month never changes after month-end)   │
└─────────────────────────────────────────────────────────────────────┘
                              ▲ miss
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 2 — Daily rollup tables (NEW, proposed — needs a migration,    │
│ not part of this design-approval step)                              │
│  AnalyticsDailyPlatformStats / …DailyCreatorStats /                 │
│  …DailyCampaignStats / …DailyProductStats — one row per (day,       │
│  dimension). Populated by a nightly @Cron job (identical mechanism  │
│  to NotificationSweepService's @Interval — same package, same       │
│  SchedulerRegistry pattern, zero new infra). Serves any *closed*    │
│  historical range: This Month, Last Month, Quarter, Year, and both  │
│  sides of a comparison. A 90-day trend chart becomes ~90 row reads  │
│  instead of scanning every order in the range.                      │
└─────────────────────────────────────────────────────────────────────┘
                              ▲ (rollup doesn't cover "still open" ranges)
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 1 — Live aggregation (Today, Yesterday, This Week — any range  │
│ still accumulating data). Direct Prisma groupBy/aggregate against   │
│ Order/Payment/Refund/Commission/Attribution/ReferralVisit, scoped   │
│ tightly by date + the required new indexes from Finding #1.         │
└─────────────────────────────────────────────────────────────────────┘
```

This mirrors, at small scale, how every real analytics system is built (OLTP tables feed a rollup
layer feeds a cache), while adding **zero new infrastructure** — Postgres, Redis, and
`@nestjs/schedule` are all already in the stack. Nothing here requires a data warehouse, a
message queue, or a separate analytics database. That would be over-engineering for Rosti's actual
current scale (a single-business platform, not a multi-tenant SaaS with per-tenant analytics).

---

## 5. Required backend modules

Following the codebase's one-module-per-domain, reuse-don't-duplicate convention (the same
reasoning `admin-payments`/`admin-refunds` already follow: their own module, but reading
`Order`/`Payment`/`Refund` directly rather than re-implementing order logic):

```
src/analytics/
  analytics.module.ts
  dto/
    analytics-query.dto.ts        — shared: range, compare, from/to, creatorId, campaignId,
                                     productId, paymentMethod, region, status (all optional)
    export-query.dto.ts           — view discriminator + format + the same filters
  lib/
    time-range.resolver.ts        — resolves range enum → {from, to}, and compare mode →
                                     {previousFrom, previousTo}. ONE place this logic exists,
                                     reused by every sub-service — avoids re-deriving "what does
                                     'last month' mean" seven times.
    analytics-cache.service.ts    — thin Redis wrapper (get/set-with-TTL, key = hash of
                                     view+range+filters), first real consumer of Redis per
                                     Finding #5.
  executive-analytics.service.ts  — §9 KPIs
  creator-analytics.service.ts    — reuses AdminCreatorsService's existing earnings/payout
                                     groupBy methods (Phase 12) where the shape already matches,
                                     rather than re-deriving them
  campaign-analytics.service.ts
  product-analytics.service.ts
  payment-analytics.service.ts
  refund-analytics.service.ts
  customer-analytics.service.ts
  analytics-export.service.ts     — CSV (no new dep) / Excel (new dep, e.g. `exceljs`) / PDF
                                     (new dep, e.g. `pdfkit` — NOT a headless-browser renderer;
                                     a structured KPI report doesn't need HTML/CSS rendering, and
                                     Puppeteer-class tools are heavy for this)
  analytics-admin.controller.ts   — one controller, one route family (§7)

src/analytics-rollup/             — separate module (separate concern: a scheduled writer, not a
  analytics-rollup.module.ts        request-time reader), proposed for the implementation phase
  analytics-rollup.service.ts      once the rollup tables exist (§4 Tier 2, §9)
```

**Nothing in Order/Payment/Refund/Commission/Campaign/Creator/Notification/Settings services
changes.** Analytics is read-only against all of them. The one deliberate cross-cutting touch:
`AnalyticsExportService` calls the existing `AuditService.record()` on every export (not a
mutation of business data, but "data left the system" is worth the same audit trail every other
sensitive read-then-act operation gets — e.g. `entityType: "AnalyticsExport"`, `action:
"analytics.exported"`). This is additive to `AuditService`, no signature change to existing calls.

---

## 6. Required frontend pages

Per Finding #9, these **replace** the existing mock pages entirely (no `Mock`/`Real` branch —
matching the Notifications/Onboarding/Admin-Operations precedent for genuinely-new-backend
domains):

```
/admin/analytics                    — Executive Dashboard (§9), the default landing view
/admin/analytics/creators           — Creator Analytics list (paginated, sortable, filterable)
/admin/analytics/creators/[id]      — one creator's full analytics detail
/admin/analytics/campaigns          — Campaign Analytics list
/admin/analytics/campaigns/[id]     — one campaign's full analytics detail
/admin/analytics/products           — Product Analytics list (best sellers / slow movers)
/admin/analytics/products/[id]      — one product's full analytics detail
/admin/analytics/payments           — Payment Analytics (methods, success/pending/failed)
/admin/analytics/refunds            — Refund Analytics (reasons, rate, approval rate)
/admin/analytics/customers          — Customer Analytics (new/returning, LTV, frequency)
```

Shared components (new, in `packages/ui` since every analytics page reuses them identically —
this is exactly the kind of cross-page reuse `packages/ui` exists for):

- `<AnalyticsFilterBar>` — date-range picker (the 9 presets + custom), comparison-mode toggle,
  and the global filter selects (creator/campaign/product/payment method/region/status) — one
  component, not reimplemented per page.
- `<KpiTile>` — extends the existing `StatTile` with an optional comparison delta (`▲ 12.3%` /
  `▼ 4.1%`, colored via the existing `success`/`error` tone tokens — no new design tokens needed).
- Chart wrappers per type (§7 names the type per metric) — thin recharts wrappers matching
  `AdminDashboardChart`'s existing styling conventions (same color tokens, same tooltip format,
  same `formatMoneyMinor` usage) so the new pages look native to the app, not bolted on.

`/admin/dashboard` (the existing admin home/landing page) either redirects to
`/admin/analytics` or embeds the same Executive Dashboard component — a decision for
implementation, not this design (both are one-line choices once the component exists).

---

## 7. API structure

All routes under `/admin/analytics`, all requiring `analytics.read` at minimum (§10). Every list-
shaped response uses the existing `PaginationQueryDto`/`PaginatedResult<T>` convention verbatim —
no new pagination shape invented.

| Method | Route | Purpose | Extra permission |
|---|---|---|---|
| GET | `/admin/analytics/executive` | §9 KPI set + trend series | — |
| GET | `/admin/analytics/creators` | Paginated creator performance list | — |
| GET | `/admin/analytics/creators/:id` | One creator's full detail | — |
| GET | `/admin/analytics/campaigns` | Paginated campaign performance list | — |
| GET | `/admin/analytics/campaigns/:id` | One campaign's full detail | — |
| GET | `/admin/analytics/products` | Paginated product performance list | — |
| GET | `/admin/analytics/products/:id` | One product's full detail | — |
| GET | `/admin/analytics/payments` | Payment method breakdown + status funnel | — |
| GET | `/admin/analytics/refunds` | Refund reasons/rate/approval/average | — |
| GET | `/admin/analytics/customers` | New/returning/LTV/frequency | — |
| GET | `/admin/analytics/export` | Streams CSV/Excel/PDF for any of the above views | **+ `analytics.export`** |

Every GET (except `/export`) accepts the same shared querystring contract, resolved once by
`time-range.resolver.ts`:

```
?range=today|yesterday|this_week|last_week|this_month|last_month|quarter|year|custom
&from=&to=                              (required only when range=custom)
&compare=none|previous|wow|mom|yoy
&creatorId=&campaignId=&productId=&paymentMethod=&region=&status=
&page=&pageSize=&sortBy=&sortDir=       (list-shaped views only)
```

Response shape for every non-list KPI view:

```
{ current: { ...metrics }, previous?: { ...metrics }, deltaPct?: { ...same keys as metrics } }
```

`previous`/`deltaPct` are present only when `compare != none`. This one shape, reused everywhere,
is what makes `<KpiTile>` a single generic component instead of one bespoke component per page.

`/export` takes `view` as an additional required query param (`executive|creators|campaigns|...`)
plus `format=csv|xlsx|pdf`, and delegates to the *same* sub-service the corresponding GET route
uses — an export is never a second, differently-computed code path from the on-screen numbers.
This is the same principle Phase 8 stated for payment logic: never a second implementation of the
same computation.

---

## 8. Query strategy

Three techniques, applied consistently, every one already precedented somewhere in this codebase:

1. **`groupBy` + `_sum`/`_count`/`_avg` for every aggregate**, never fetch-then-reduce-in-JS.
   `admin-creators.service.ts` already does exactly this (`prisma.commission.groupBy({ by:
   ["status"], where: { creatorId }, _sum: { amountMinor: true } })`) — every new analytics query
   follows the identical shape, just with `createdAt` range predicates and different `by`
   dimensions (`by: ["provider"]` for payment methods, `by: ["campaignId"]` for campaign
   breakdowns, etc.).
2. **One query per KPI group, not one query per KPI.** The Executive Dashboard's 14 KPIs are not
   14 round-trips — they decompose into ~5–6 `groupBy`/`aggregate` calls (one for Order-derived
   counts+sums by status, one for Refund aggregates, one for Attribution-derived Active Creators,
   one for Campaign/Product snapshot counts, one for Customer new/returning), run with
   `Promise.all` (already the standard pattern in every existing multi-summary method, e.g.
   `AdminCreatorsService.findOneOrThrow`'s parallel summary calls).
3. **No N+1 across drill-down lists.** A paginated Creator Analytics list computing per-row
   revenue/orders/conversion must use one `groupBy` keyed by `creatorId` for the whole visible
   page (or the whole filtered set, capped, then paginated in-memory for small result sets) —
   never one query per creator row. Same rule for Campaign/Product lists. This is the direct,
   concrete answer to the brief's "avoid N+1 queries" requirement, not a generic promise.
4. **Date-range predicates always use the resolved `[from, to)` half-open interval** from
   `time-range.resolver.ts`, never ad hoc date math per service — the exact reason that shared
   utility exists (§5).

Once the Finding #1 indexes exist (`@@index([status, createdAt])` on `Order`; `@@index([createdAt])`
or `@@index([status, createdAt])` on `Payment`/`Refund`/`Commission`), every one of the above
queries is a fast indexed range scan, not a sequential scan. This index addition is listed as
implementation step zero in §13, not something to defer.

---

## 9. Performance strategy

| Concern | Strategy |
|---|---|
| Large datasets | Tier 2 rollup tables (§4) turn "sum every order in a quarter" into "sum ~90 pre-aggregated daily rows." |
| Pagination | Every list-shaped analytics endpoint (Creator/Campaign/Product lists) uses the existing `PaginationQueryDto` — same `page`/`pageSize`/`sortBy`/`sortDir` contract as every other admin list in the app, capped at `pageSize` ≤ 100 like everywhere else. |
| Caching | Tier 3 (Redis) — short TTL (60s) for anything touching "today," longer (15 min) for closed historical ranges that cannot change. Cache key includes every filter, so two different filtered views never collide. |
| Aggregation | `groupBy`/`_sum`/`_count`/`_avg` exclusively (§8) — the database aggregates, the application never does. |
| Materialized statistics | §4 Tier 2 — proposed `AnalyticsDaily{Platform,Creator,Campaign,Product}Stats` tables, populated by a nightly `@Cron` job (new dependency: none — `@Cron` is part of the already-installed `@nestjs/schedule`, just a decorator this codebase hasn't used yet, only `@Interval` has). Idempotent by design: re-running a day's rollup upserts that day's row, never appends duplicates — same `skipDuplicates`/upsert discipline `NotificationSweepService` already established. |
| Avoiding N+1 | §8 point 3. |
| Rollup staleness | Today's row is intentionally never rollup-served (§4) — it's always live, so "today" numbers are never stale by more than the 60s cache TTL. Yesterday's rollup row is written once, right after midnight, by the nightly job — a closed day's numbers don't change afterward (no order gets un-created), so no invalidation logic is needed for historical rows at all. |

---

## 10. RBAC strategy

**Zero new permission keys.** `analytics.read` and `analytics.export` already exist (Finding #8),
already granted exactly where they should be:

| Permission | MANAGER | ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|
| `analytics.read` | ✓ | ✓ | ✓ |
| `analytics.export` | | ✓ | ✓ |

- Every GET route (§7) requires `analytics.read` alone — every staff role sees every analytics
  view identically. This deliberately does **not** introduce per-role data masking (e.g. hiding
  certain creators' financials from MANAGER) — `RBAC.md` states its own philosophy plainly ("a
  role either has a permission or it doesn't, no per-resource scoping in the MVP"); introducing
  partial visibility within one permission key would be new, undocumented behavior inconsistent
  with every other domain in this app. If the Owner wants MANAGER to see less financial detail
  than ADMIN, that's a **new, explicit decision** (and likely a new permission key, e.g.
  `analytics.financial.read`) — not something this design should smuggle in silently.
- `/export` requires **both** `analytics.read` and `analytics.export` (the existing
  `@RequirePermissions(...)` "AND, not OR" rule) — which changes nothing in practice, since no
  role in `DEFAULT_ROLE_PERMISSIONS` has `analytics.export` without also having `analytics.read`.
- Creator-facing routes are irrelevant here — this domain has none (§1's scope clarification).
  There is no `RequireCreatorGuard` touch-point at all.
- Frontend: a `RoleGuard`-gated Export button (hidden for MANAGER, matching every other
  ADMIN+-only action button elsewhere in the admin UI) — UI-only convenience, the real boundary
  stays the backend guard per the project's established dual-layer pattern.

---

## 11. Dashboard layouts

### 11.1 Executive Dashboard (`/admin/analytics`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Date range: This Month ▾]  [vs Previous ▾]        [⬇ Export ▾]        │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌─────────┐│
│ │ Revenue  ││   GMV    ││  Orders  ││   Paid   ││ Pending  ││ Refunds ││
│ │ ▲ 8.2%   ││ ▲ 6.1%   ││ ▲ 4.0%   ││ ▲ 5.5%   ││ ▼ 2.0%   ││ ▼ 1.1%  ││
│ └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└─────────┘│
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌─────────┐│
│ │ Refund   ││ Active   ││ Active   ││ Active   ││Creator-  ││   AOV   ││
│ │  Rate    ││Creators  ││Campaigns ││ Products ││Attr.Conv.││         ││
│ └──────────┘└──────────┘└──────────┘└──────────┘└──────────┘└─────────┘│
│ ┌──────────┐┌──────────┐                                                │
│ │   New    ││Returning │                                                │
│ │Customers ││Customers │                                                │
│ └──────────┘└──────────┘                                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Revenue & GMV trend (area chart, daily points across the range)        │
├───────────────────────────────┬───────────────────────────────────────┤
│ Orders by status (bar)        │ Payment method mix (pie/donut)          │
├───────────────────────────────┼───────────────────────────────────────┤
│ Top 5 Creators (table)        │ Top 5 Campaigns │ Top 5 Products        │
└───────────────────────────────┴───────────────────────────────────────┘
```

14 KPI tiles (exactly the requested list), one trend chart, one status breakdown, one payment
mix, three "top 5" lists — deliberately not more than this on one screen; anything needing more
detail is a click into the dedicated Creator/Campaign/Product/Payment/Refund/Customer page.

### 11.2 Creator / Campaign / Product Analytics (list pages)

Same shell for all three (reusing `DataTableShell`, per the "one shared list-page chrome"
precedent from Phase 5): `<AnalyticsFilterBar>` at top, a sortable table (revenue/orders/
conversion/etc. as sortable columns via the existing `sortBy`/`sortDir` contract), row click →
detail page.

### 11.3 Detail pages (creator/campaign/product `[id]`)

Header (identity + key stat row) → trend chart scoped to that one entity → breakdown tables
specific to that entity type (§ per-domain metric lists below).

### 11.4 Payment / Refund / Customer Analytics

Single-page views (no list+detail split needed — these are inherently platform-wide breakdowns,
not per-entity drill-downs): KPI row + the specific charts named in §11.6–11.8.

### 11.5 Creator Analytics — metrics → source

| Metric | Source | Notes |
|---|---|---|
| Earnings | `Commission` (`_sum(amountMinor)` by status) | Mirrors `AdminCreatorsService.getEarningsSummary` (Phase 12) — reused, not re-derived. |
| Orders | `Attribution` joined to `Order`, or `Commission` count | One row per attributed order. |
| Revenue generated | Σ `Order.totalMinor` for attributed orders | |
| Conversion rate | Attributed Paid Orders ÷ that creator's `ReferralVisit` count | Same "creator-attributed" caveat as §3. |
| Clicks | `ReferralVisit` count where `creatorId` matches | Real data, already collected. |
| Views (future-ready) | **Not measurable today** (Finding #2) | Documented as a known gap, not faked — see §11.1's future-events proposal. |
| Top campaigns / Top products | `groupBy` on `Attribution.campaignId` / joined `Order.offerId`, `_sum(totalMinor)`, top N | |
| Approval rate | `CampaignApplication` for that creator: approved ÷ (approved + rejected) | Distinct from platform-wide *onboarding* approval rate (that's a separate, Executive-level metric if ever wanted — different source table, `CreatorApplication`). |
| Average payout | `Payout` where status = PAID, `_avg(amountMinor)` | Mirrors `AdminCreatorsService.getPayoutSummary`. |
| Referral statistics | `CreatorReferral`/`CreatorReferralReward` for that creator as referrer | Referrals given, milestones reached, rewards earned. |

### 11.6 Campaign Analytics — metrics → source

Performance/Orders/Revenue/Conversion from `Order`+`Attribution` scoped by `campaignId`. Creator
count from distinct `creatorId` in `CreatorCampaign` (or `CampaignApplication` status=APPROVED).
Average creator performance = campaign revenue ÷ creator count. Top creators = `groupBy`
`Attribution.creatorId` within the campaign, ranked. Time trends = the same daily-bucketed
trend chart as the Executive Dashboard, scoped to one `campaignId`.

### 11.7 Product Analytics — metrics → source

Revenue/Orders from `OrderItem` (`variant → offer → product`) — this is the correct join, not
`Order` directly, since one Order can (in principle) span variants and a Product can have several
Offers. Refunds = `Refund` joined through `Order` → `Offer` → `Product`. Conversion = product-page
`ReferralVisit`s (same creator-attributed caveat) → orders for that offer. AOV = product revenue ÷
product order count. Best sellers / slow movers = the same ranked-by-revenue (or by unit count)
list, sorted ascending vs. descending — one query, two sort directions, not two separate features.

### 11.8 Payment / Refund / Customer Analytics — metrics → source

- **Payment methods** — `groupBy Payment.provider`, count + `_sum(amountMinor)`.
- **Success rate** — `PAID` ÷ total `Payment` rows in period.
- **Pending / Failed** — `groupBy Payment.status`, filtered to `PENDING`/`PROCESSING` and `FAILED`
  respectively.
- **Refund reasons** — `groupBy Refund.reason` (Finding #3, §3).
- **Refund rate / approval rate** — §3's definitions; approval rate = `APPROVED`+`PROCESSED` ÷
  all decided (`APPROVED`+`PROCESSED`+`REJECTED`).
- **Average refund amount** — `Refund._avg(amountMinor)` where status ∈ decided set.
- **First-time / returning buyers, LTV, order frequency** — `Customer` + `Order` per §3; LTV = Σ
  `totalMinor` across all of that customer's orders ever (lifetime, not period-bound by
  definition); order frequency = orders ÷ customer tenure in days (or simply "orders per customer"
  as the simpler, still-useful v1 metric — averaging a true frequency needs a tenure baseline that
  may be worth deferring to v2).

---

## 12. Charts & KPI visualization mapping (with why)

| Metric / KPI | Chart | Why this type |
|---|---|---|
| Revenue/GMV over time | **Area chart** (already the `AdminDashboardChart` pattern) | Area emphasizes cumulative magnitude and trend direction at once — the existing admin dashboard already uses this for revenue, so this stays visually consistent rather than introducing a second convention for the same kind of data. |
| Orders by status | **Horizontal or vertical bar chart** | Status is a small, fixed set of discrete categories (9 `OrderStatus` values) — bars compare discrete categories far better than a line (which implies a continuous progression the statuses don't have). |
| Payment method mix | **Pie/donut chart** | A payment-method breakdown is fundamentally "share of a whole" — the one case where a pie chart is the *right* answer rather than the usually-overused default, because there are few categories (≤6 `PaymentProviderType` values) and the question being asked is genuinely "what % of volume is each method," not "compare exact values" (which bars would serve better with many categories). |
| Refund rate / conversion rate / success rate trend | **Line chart** | These are ratios/rates over time, not magnitudes — a line makes rate-of-change and inflection points legible; an area chart's filled region would visually imply a summable quantity, which a percentage is not. |
| Top N creators/campaigns/products | **Ranked horizontal bar list (or a simple sorted table)** | Ranking is the point — horizontal bars let labels (names) stay readable at any length, unlike a vertical bar chart where long creator names would collide. |
| Click → Order funnel | **Funnel chart** (recharts `FunnelChart`, not yet used elsewhere but part of the already-installed package) | A funnel is the standard, correct shape for a strictly-decreasing multi-stage conversion process — bars or a line would lose the "each stage is a subset of the last" visual relationship a funnel makes automatic. |
| New vs. returning customers | **Stacked bar chart over time** | Shows both the total and the composition (what fraction is new vs. returning) in one glance — a pie loses the time dimension, a line loses the composition. |
| Best sellers vs. slow movers | **Same ranked bar list, sorted both directions** | Per §11.7 — one component, two sort orders, not two chart types. |
| Executive KPI tiles (Revenue, Orders, AOV, etc.) | **Number tile with a small delta indicator**, not a chart at all | The Owner's stated need is "the number, and is it going the right way" — a full chart per KPI on the headline dashboard would be visual noise; the trend chart section below the tiles already carries the "over time" story for the handful of metrics where it matters. |

---

## 13. Time Analysis & Comparison Mode

Both fully covered by `time-range.resolver.ts` (§5) — one function resolving every `range` value
to a concrete `{from, to}`, and every `compare` value to the matching prior-period `{from, to}`:

| `range` | Resolves to |
|---|---|
| `today` / `yesterday` | The current/previous calendar day |
| `this_week` / `last_week` | ISO week boundaries |
| `this_month` / `last_month` | Calendar month boundaries |
| `quarter` | Current calendar quarter |
| `year` | Current calendar year |
| `custom` | The caller's own `from`/`to`, validated `from < to` (else `DomainException("VALIDATION_ERROR", ...)`, same pattern as every other DTO validation in this codebase) |

| `compare` | Resolves to |
|---|---|
| `previous` | The immediately preceding period of equal length (a 2-week custom range compares to the 2 weeks before it) |
| `wow` | Same weekday range, 7 days earlier |
| `mom` | Same day-of-month range, 1 calendar month earlier |
| `yoy` | Same range, 1 calendar year earlier |

`Active Campaigns`/`Active Products` (snapshot metrics, §3) are the one exception the resolver
must special-case: their "previous" value is a snapshot *as of the previous period's end date*,
not a second range-summed query — flagged explicitly so this isn't implemented as a silent bug
later.

---

## 14. Filtering

The six requested global filters (Date, Creator, Campaign, Product, Payment Method, Region,
Status) are one shared querystring contract (§7), applied identically by every sub-service's
`where` clause — never redefined per page. Region filters against `Order` → `Address.region` (the
existing field, no new column). Status filtering is context-sensitive per view (an `OrderStatus`
value on Executive/Product views, a `RefundStatus` value on the Refund view, a `PaymentStatus`
value on the Payment view) — the DTO accepts a plain string and each sub-service validates it
against its own relevant enum, rejecting an invalid value with the existing `DomainException`
pattern rather than silently ignoring it.

---

## 15. Export

| Format | New dependency? | Approach |
|---|---|---|
| CSV | **No** | Same string-join technique the Phase 5 mock already uses, computed server-side from the real query result instead of mock data. |
| Excel (.xlsx) | **Yes** — e.g. `exceljs` | Genuinely new capability; flagged so it's a conscious dependency addition, not assumed free. |
| PDF | **Yes** — e.g. `pdfkit` (structured document, not `puppeteer`) | A KPI report is tables and numbers, not a pixel-perfect rendering of the web page — a lightweight document-generation library avoids shipping a headless Chromium for a report that doesn't need one. |

Every export call is routed through `AnalyticsExportService`, which delegates to the *same*
sub-service the on-screen view uses (§7) and records one `AuditService.record()` call per export
(Finding #6/§5) — `entityType: "AnalyticsExport"`, `after: { view, format, filters, range }`, so
"who exported what, when" is answerable from the existing Audit Log viewer (Phase 12) with zero
changes to that viewer.

---

## 16. Future readiness

| Future feature | How this design already accommodates it |
|---|---|
| Creator catalog | Product/Campaign/Creator Analytics are already dimension-scoped, not hardcoded to today's catalog shape — a future "creator catalog" (creators listing their own products) would be a new dimension joined the same way Campaign/Product already are, not a redesign. |
| Affiliate attribution engine | The entire Creator/Campaign Analytics layer already reads through `Attribution`, the existing resolved-attribution table — a more sophisticated attribution engine (multi-touch, weighted) would change what populates `Attribution`, not how Analytics reads it. This is precisely why Analytics queries `Attribution` rather than re-deriving "which creator gets credit" itself. |
| Mobile app | The API (§7) is a real HTTP surface independent of the Next.js frontend already — a mobile app consuming `/admin/analytics/*` needs no new backend work, only a new client. |
| Public API | The same reasoning — the moment there's a decision to expose a subset of this externally (e.g. a creator-facing "my performance" public API), it's a new, narrower-scoped controller reusing these same sub-services, not new query logic. |
| BI integrations | §4's Tier 2 rollup tables are, incidentally, already shaped like the kind of table a BI tool's SQL connector would query directly (one row per day per dimension) — a future Metabase/Looker connection could point at those tables read-only with no new export pipeline needed, beyond `/export` for the in-app case. |

---

## 17. Risks

1. **Finding #1 (missing time-series indexes) is the top risk.** Every KPI in this document
   degrades from "fast indexed scan" to "sequential scan" without it. This must be the first PR of
   implementation, reviewed on its own, before any analytics endpoint is built on top of it.
2. **Finding #2 (no organic-traffic tracking) means "Conversion Rate" and "Views" will under-
   represent reality** if presented without the "creator-attributed only" caveat — the real risk
   is a stakeholder trusting a partial number as if it were the whole picture. Mitigated by
   explicit labeling (§3), not by hiding the metric.
3. **KPI-definition disagreement after the fact.** §3's table exists specifically to surface this
   risk before coding, not after a dashboard ships with numbers someone disputes.
4. **Rollup-table staleness bugs** are a classic category of analytics bug (a nightly job silently
   failing, dashboards quietly showing yesterday's-yesterday). Mitigated by the same job-liveness
   discipline `NotificationSweepService` already established (registered in `SchedulerRegistry`,
   observable, testable) — not a new pattern to invent.
5. **Two dependencies added for export** (Excel, PDF) — ordinary supply-chain surface area, no
   different from any other npm dependency this project already vets, but worth naming as a real
   addition rather than treating export as free.
6. **Redis as a cache, for the first time**, introduces a new failure mode: a cache miss storm if
   Redis is unreachable. Mitigated by treating cache reads as best-effort (a Redis error falls
   through to live computation, exactly like the existing health-check's already-documented
   "Redis down ≠ app down" precedent from Phase 6A) — never a hard dependency for correctness, only
   for speed.

---

## 18. Recommended implementation order

1. **Migration: add the missing indexes** from Finding #1 (`Order`, `Payment`, `Refund`,
   `Commission`) — reviewed and merged on its own before any analytics code exists, since it's a
   pure, low-risk, high-value change independent of everything else here.
2. **Confirm §3's KPI definitions** with the Owner/product — the one step that isn't code at all,
   but blocks writing the "right" numbers instead of "a" set of numbers.
3. **Backend: `time-range.resolver.ts` + Executive Analytics** (the smallest complete vertical
   slice — one endpoint, all the shared time/comparison plumbing other views will reuse).
4. **Frontend: Executive Dashboard**, replacing the mock page — the first real end-to-end
   verification point.
5. **Backend + frontend: Creator / Campaign / Product Analytics** (list + detail pages) — these
   three share the most query-shape similarity, so building them together avoids re-solving the
   same "paginated performance list" problem three separate times.
6. **Backend + frontend: Payment / Refund / Customer Analytics** (simpler, single-page views).
7. **Export (CSV first — zero new dependency; Excel/PDF once CSV's plumbing is proven).**
8. **Migration: `AnalyticsDaily*Stats` rollup tables + the nightly `@Cron` job + Redis caching**
   (§4 Tiers 2–3) — deliberately last, as a performance optimization layered onto already-correct
   live-computed numbers, not a prerequisite for correctness. Ships once real data volume
   justifies it, not speculatively.

---

## 19. Out of scope (explicit, per the phase instructions)

No production code was written. No migration was run. No existing business logic
(Order/Payment/Refund/Commission/Payout/Campaign/Referral/Onboarding/Notification/Settings
services) was modified. This document is the design and implementation plan only, awaiting
approval before Phase 13 implementation begins.
