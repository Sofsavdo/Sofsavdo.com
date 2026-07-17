# Rosti — Closed Creator Affiliate Commerce Platform

Rosti is **not** an online store, not a marketplace, and not a public product catalog.
It is a closed system that lets one business owner sell their own physical products,
courses, and services through approved creators (bloggers/influencers), each with an
individual referral link and promo code, with automatic attribution, commission
calculation, and payout management.

The rule that drives every design decision in this repo:

> **Creators see a catalog of campaigns. Buyers see exactly one offer.**

A buyer who lands on `rosti.uz/o/serum?ref=malika` can only see and buy that one
offer. There is no public catalog, no search, no cart, no cross-sell, no way to
navigate to any other product, course, or service. See [PRODUCT_MODEL.md](PRODUCT_MODEL.md)
and [docs/PROHIBITED.md](docs/PROHIBITED.md) for the full list of things this platform
deliberately does not do.

## Repository audit (Phase 0 — done 2026-07-16)

- Working directory (`Fidem/Blog`) was empty prior to this build — no prior Rosti code exists here.
- The enclosing git repository is rooted at `C:\Users\Acer` (the whole user home directory), not at
  this folder. It contains unrelated projects (a Yandex Market seller tool under
  `Desktop/SellerCloudX`-style commits, Cursor editor extension binaries, etc.) and a separate,
  earlier project at `Desktop/mukammal CRM` ("AFFILIMART") that models a similar
  blogger/affiliate/merchant marketplace on a Node/Express/Knex stack. Per explicit user decision,
  Rosti is a **clean, independent build in this directory** — AFFILIMART is not reused or migrated.
- Runtime available: Node v22.17.1, npm 10.9.2, Docker Desktop. No `pnpm`, no local `psql` client
  (Postgres will run via Docker for local dev).
- MCP/integrations checked: no Figma MCP connection is currently authorized in this session
  (`plugin:product-management:figma` requires OAuth the user must complete via claude.ai connector
  settings). No B12 integration is connected. Browser automation (in-app Browser) is available and
  will be used in later phases to visually verify pages. Until Figma is connected, the design system
  in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) is the source of truth, built directly in code.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui + Radix + TanStack
  Query + React Hook Form + Zod + Framer Motion + Recharts.
- **Backend:** NestJS + TypeScript + PostgreSQL + Prisma + Redis + BullMQ + Swagger/OpenAPI + JWT
  (refresh rotation) + S3-compatible storage.
- **Monorepo:** npm workspaces (`apps/web`, `apps/api`, `packages/types`, `packages/config`,
  `packages/ui`).

## Structure

```
apps/
  web/      Next.js app: creator platform, /o offer landings, single-offer checkout, admin
  api/      NestJS backend: all domain modules, Prisma schema, migrations, seed
packages/
  types/    Shared TS types/enums/DTOs used by both web and api
  config/   Shared tsconfig/eslint/tailwind config
  ui/       Shared design-system components (shadcn-based)
docs/       Supplementary architecture notes (prohibited-features list, ADRs detail, etc.)
```

## Documentation index

| File | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, module boundaries, route map |
| [PRODUCT_MODEL.md](PRODUCT_MODEL.md) | Product / Offer / Campaign model with examples |
| [USER_FLOWS.md](USER_FLOWS.md) | Creator onboarding, campaign, buyer, commission flows |
| [DATABASE.md](DATABASE.md) | Entity relationships, key invariants |
| [API.md](API.md) | REST endpoint contract |
| [ATTRIBUTION.md](ATTRIBUTION.md) | Attribution engine rules |
| [COMMISSION.md](COMMISSION.md) | Commission calculation rules |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colors, type, spacing, component rules |
| [SECURITY.md](SECURITY.md) | Security checklist |
| [TESTING.md](TESTING.md) | Unit/integration/E2E test plan |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment targets, health checks |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Phase-by-phase progress log |
| [DECISIONS.md](DECISIONS.md) | Architecture decision records |
| [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) | Full database schema |

## Status

Phase 0 (audit) and Phase 1 (architecture) are complete. Implementation (Phases 2–9) starts after
architecture review — see [PROJECT_STATUS.md](PROJECT_STATUS.md).
