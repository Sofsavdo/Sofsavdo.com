# Architecture decision records

## ADR-001: Build fresh in `Fidem/Blog`, do not migrate `Desktop/mukammal CRM` (AFFILIMART)

**Context:** Phase 0 audit found an existing, similarly-shaped project ("AFFILIMART") at
`Desktop/mukammal CRM`, on Node/Express/Knex, modeling bloggers/merchants/affiliate links.
**Decision:** User explicitly chose a clean independent build in `Fidem/Blog`. AFFILIMART code is
not read, reused, or migrated.
**Why it matters later:** if a future session is tempted to "just port" a model or migration
from AFFILIMART, don't — the data model here (Product/Offer/Campaign as three distinct entities,
single-owner not multi-merchant, snapshot-based commission) is deliberately different from that
project's merchant-marketplace shape.

## ADR-002: Modular monolith (NestJS), not microservices

**Context:** spec lists 26 backend "modules".
**Decision:** one NestJS app, one Postgres database, modules as NestJS `Module`s with service-
layer boundaries — not separate deployable services.
**Why:** Order → Attribution → Commission creation must be one ACID transaction. Splitting these
across services would require distributed transactions or eventual consistency for money-
correctness-critical logic, for no benefit at this team/traffic size. NestJS module boundaries
already prevent one domain from reaching into another's Prisma models directly (see
ARCHITECTURE.md §4), so the option to extract a service later isn't foreclosed.

## ADR-003: Prisma 7 with driver adapters (`@prisma/adapter-pg`), not the legacy `url`-in-schema config

**Context:** `npm install prisma` on 2026-07-16 installed v7.8.0, which removed
`datasource.url` in favor of `prisma.config.ts` + a driver adapter.
**Decision:** adopted the current major (7.x) rather than pinning to an older Prisma with the
familiar schema-embedded `url`. Schema validated (`prisma validate`) and client generation
(`prisma generate`) both confirmed working against this setup — see DATABASE.md.
**Why:** this is a brand-new project with no legacy constraint pulling it toward an older major;
building against a version already scheduled for deprecation would be a self-inflicted upgrade
debt on day one.

## ADR-004: Money as integer minor units everywhere

**Decision:** every price/commission/payout field is `Int`, minor units (1 so'm = 100).
**Why:** spec explicitly prohibits floats for money; integers make commission math exactly
reproducible and make `CommissionLedger` sums exact.

## ADR-005: Commission snapshotting via a separate `CommissionRule` row, not a JSON blob on `Order`

**Context:** the spec requires that editing a campaign's commission rate must never change past
orders' commission amounts.
**Decision:** rather than freezing the rule as JSON directly on `Order` or `Commission`,
`CommissionRule` is its own versioned table (`effectiveFrom`/`effectiveTo`), and `Commission`
points to the specific rule version active when the order was placed.
**Why:** a first-class row is queryable/auditable ("show me every commission paid under rule
version X") in a way a duplicated JSON blob per order isn't, at negligible extra write cost.

## ADR-006: `ref` query param stripped from canonical URL, not from the served URL

**Decision:** the offer landing is served at `/o/[slug]?ref=...` (so the referral code survives
navigation/reload), but the `<link rel="canonical">` and any Open Graph URL point at
`/o/[slug]` without the query string.
**Why:** prevents search engines from indexing N duplicate URLs per offer (one per creator ref
code) while keeping attribution fully functional — attribution is resolved server-side from the
query param on the initial request, not relied upon for SEO.

## ADR-007: Single Next.js deployment for creator/admin/offer surfaces at MVP, not three subdomains

**Decision:** despite the spec's target domain structure (`creator.rosti.uz`, `admin.rosti.uz`,
`api.rosti.uz`), MVP ships all three frontend surfaces from one Next.js app via route groups.
**Why:** no DNS/domain has been confirmed by the user yet (explicitly not assumed, per the
master prompt's own constraint), and splitting into subdomains is a deployment-config change, not
an application-architecture one — the route-group boundaries already keep the three surfaces'
code, layouts, and auth guards separate, so the later split is routing config, not a rewrite.
