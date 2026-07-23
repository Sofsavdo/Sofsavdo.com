# Architecture review — Phase 6A → 6B checkpoint (2026-07-18)

Audit of the entire backend foundation before starting Phase 6B, per explicit instruction. Method:
direct inspection of `schema.prisma`, every module in `apps/api/src/`, all DTOs, the RBAC matrix,
logging call sites, module import graph, and the earlier schema/API consistency audits
(`docs/SCHEMA_API_AUDIT.md`). Only issues with measurable architectural, security, correctness, or
scalability impact are listed — no style-only findings.

## Critical issues — fixed

1. **Password-reset token logged unconditionally, including in production.** `AuthService.forgotPassword`
   wrote the raw JWT reset token (a bearer credential capable of account takeover) to
   `AppLogger` on every call, regardless of `NODE_ENV`. Anyone with log read access could take over
   any account that requested a reset. **Fixed:** token is only logged when `NODE_ENV !== "production"`;
   production logs only that a reset was requested, never the token itself.

## High priority — fixed

1. **No route-specific rate limiting on auth endpoints.** Only the global default (120 req/60s per
   IP) applied to `/auth/login`, `/auth/register`, `/auth/forgot-password` — permissive enough that
   credential-stuffing or password-guessing was effectively unthrottled, despite SECURITY.md
   explicitly requiring this. **Fixed:** `@Throttle()` overrides — 10/min on login and register,
   5/min on forgot-password.

## Medium priority — documented, not auto-fixed

1. **No per-account brute-force lockout.** Per-IP throttling (above) is a partial mitigation, not
   a replacement — a distributed attempt from many IPs against one account isn't slowed. Needs a
   failed-attempt counter (Redis-backed is the natural fit, given BullMQ/Redis infra lands in 6B+)
   and exponential backoff. Sized as its own piece of work, not a quick audit fix.
2. **`LoginDto.email` isn't validated as an email shape** (`@IsString()` only, not `@IsEmail()`) —
   harmless today (a malformed value just fails the DB lookup and returns `INVALID_CREDENTIALS`,
   Prisma parameterizes the query so there's no injection risk), but worth tightening for
   consistency with `RegisterDto`.
3. **`RolesService` has no pure unit test**, only real-database coverage via `rbac.e2e-spec.ts`/
   `roles.e2e-spec.ts`. The e2e coverage is genuinely more valuable for this specific logic (it's a
   Prisma join, mocking it would test the mock, not the query), but a fast mocked-Prisma unit test
   would still catch a regression in the aggregation logic itself without a DB round-trip.
4. **Naming collision between frontend and Prisma `CreatorCampaignStatus`** — already documented
   as an intentional, tracked decision in `docs/SCHEMA_API_AUDIT.md`; restated here only so this
   review doesn't imply it was missed. No action needed beyond what's already planned for 6B
   (`GET /creator/my-campaigns` synthesizes the merged status server-side).

## Low priority — documented, not auto-fixed

1. `LoginDto.password` and `ResetPasswordDto`'s fields have no `@ApiProperty()` — Swagger still
   documents the endpoint and required-body shape correctly via the DTO class itself, this only
   affects per-field descriptions in `/docs`.
2. `UsersService` (a two-line Prisma passthrough) has no dedicated unit test — trivial enough that
   a test would mostly assert Prisma's own behavior. Revisit once it grows real logic in 6D.

## Technical debt

- Per-account brute-force lockout (Medium #1 above).
- `NotificationsModule` doesn't exist yet — forgot-password "delivery" is a log line by design
  until 6D wires a real email/Telegram provider (already documented in PROJECT_STATUS.md).
- Pagination (`PaginationQueryDto`/`paginate()`) exists but nothing calls it yet — first real usage
  will be 6B's `GET /admin/products` list endpoint; worth a second look once a real list query
  exists to confirm the `skip`/`take` math holds up against a populated table.

## Performance risks

- None found at this scope. The only real query traffic today is auth (`User` lookups by
  `@unique` email/phone, `RefreshToken` lookup by `@unique tokenHash`, `Role`/`Permission` joins by
  indexed FK) — all backed by indexes already verified against the live schema (68 unique indexes,
  111 total). Revisit once 6B's `Product`/`Offer` list endpoints exist — `Product` already has
  `@@index([type, status])` and `Offer` has `@@index([status])` anticipating the admin list-filter
  pattern, so no schema change is expected, but this should be confirmed once real query patterns
  exist rather than assumed now.

## Security observations

- Foreign keys were audited for cascade behavior: every financially/historically significant
  relation (`Order`→`Offer`/`Campaign`/`Customer`/`Address`/`PromoCode`, `Commission`→`Order`,
  etc.) correctly uses the Postgres default (`NO ACTION`/restrict-like) — deleting a `Product`,
  `Offer`, or `Campaign` while real orders reference it is blocked at the database level, not just
  by application convention. Only genuinely-owned child rows (`OfferVariant`, `LandingPage`,
  `LandingSection`, `RefreshToken`, `UserRole`, `RolePermission`, etc.) cascade.
- `AllExceptionsFilter` was re-checked for leakage: unexpected (non-`DomainException`,
  non-`HttpException`) errors never expose their raw message or stack to the client — only a
  generic message; the real detail is logged server-side only. No change needed.
- No circular module dependencies exist in the current graph (`AuthModule` → `RolesModule` +
  `CommonModule`, one direction only). Worth re-checking after each 6B domain module is added,
  since that's exactly the point at which cross-module imports tend to appear.
- Money handling re-confirmed: every monetary field in `schema.prisma` is `Int` (minor units); no
  `Float`/`Decimal-as-float` anywhere; `src/common/money/money.ts` is the only place minor-unit
  math happens and is unit-tested against COMMISSION.md's worked example.

## Recommended fixes (forward-looking, for 6B+)

- When `ProductsModule`/`OffersModule` land, give their multi-step admin mutations (e.g.
  archive-cascades, reorder operations) the same `prisma.$transaction()` treatment already used in
  `TokenService.rotateRefreshToken` — there is no multi-step business operation in 6A's scope to
  audit yet, so this is a forward requirement, not a finding against existing code.
- Apply the per-account lockout (Medium #1) before Phase 6C's public checkout surface goes live —
  checkout endpoints are a second, higher-value brute-force/abuse target (promo code guessing).

## Verification after fixes

`tsc --noEmit` (both configs) clean, `eslint` clean — see below for the full re-run including
build/unit/integration/migration/seed/Swagger/health, per the required checklist.
