# RBAC — permission matrix

Source of truth for the permission-key list is
[apps/api/src/roles/permissions.constants.ts](apps/api/src/roles/permissions.constants.ts) — this
document must stay in sync with it (an automated test,
[apps/api/src/roles/permissions.constants.spec.ts](apps/api/src/roles/permissions.constants.spec.ts),
asserts the two agree on set membership so this file can't silently drift).

## Why individual permissions, not grouped strings

The Phase 6 spec's shorthand (`product.read/write/archive`) describes three **separate**
permission keys, not one compound string — `PermissionsGuard` checks membership of exact keys in
`RolePermission`, so `product.read` and `product.write` can be granted independently (e.g. a
future "content-only" role could read products without being able to edit them). Every entry below
is a distinct row in the `Permission` table.

## Full permission list (51)

| Domain | Permission key |
|---|---|
| Product | `product.read` |
| Product | `product.write` |
| Product | `product.archive` |
| Offer | `offer.read` |
| Offer | `offer.write` |
| Offer | `offer.publish` |
| Offer | `offer.pause` |
| Offer | `offer.archive` |
| Landing | `landing.read` |
| Landing | `landing.write` |
| Landing | `landing.publish` |
| Landing | `landing.archive` |
| Campaign | `campaign.read` |
| Campaign | `campaign.write` |
| Campaign | `campaign.publish` |
| Campaign | `campaign.pause` |
| Campaign | `campaign.complete` |
| Campaign | `campaign.archive` |
| Application (creator → Campaign) | `application.read` |
| Application (creator → Campaign) | `application.review` |
| Application (creator → Campaign) | `application.approve` |
| Application (creator → Campaign) | `application.reject` |
| Application (creator → Campaign) | `application.revise` |
| Creator | `creator.read` |
| Creator | `creator.review` |
| Creator | `creator.suspend` |
| Creator | `creator.block` |
| Content | `content.read` |
| Content | `content.review` |
| Content | `content.approve` |
| Content | `content.reject` |
| Content | `content.revise` |
| Referral (creator → creator, 6B Enhancement) | `referral.read` |
| Referral (creator → creator, 6B Enhancement) | `referral.manage` |
| Referral (creator → creator, 6B Enhancement) | `referral.review` |
| Referral (creator → creator, 6B Enhancement) | `referral.disqualify` |
| Attribution | `attribution.read` |
| Attribution | `attribution.override` |
| Order | `order.read` |
| Order | `order.update` |
| Order | `order.refund` |
| Payment | `payment.read` |
| Commission | `commission.read` |
| Commission | `commission.adjust` |
| Payout | `payout.read` |
| Payout | `payout.approve` |
| Payout | `payout.pay` |
| Analytics | `analytics.read` |
| Analytics | `analytics.export` |
| Settings | `settings.read` |
| Settings | `settings.write` |
| User | `user.read` |
| User | `user.manage` |
| Audit | `audit.read` |

**6B Enhancement note:** `referral.read`/`referral.manage` were reserved-but-unused rows before this
checkpoint (no admin route consumed them yet); they're now the real gate for the creator-to-creator
referral program's admin listing and rule CRUD. `referral.review` (reward approve/reject) and
`referral.disqualify` are the two genuinely new keys this domain added. Campaign media management
and Offer delivery-region management are sub-resources of an already-admin-editable entity, so they
deliberately reuse `campaign.write` and `offer.write` respectively (the same pattern landing
sections already use for `landing.write`) rather than adding `campaign.media.manage`/
`delivery.manage` — see DECISIONS.md ADR-013.

**Phase 7A note:** `content.approve`/`content.reject`/`content.revise` are the three genuinely new
keys the Content domain added, mirroring `application.*`'s review/approve/reject/revise split
exactly (MANAGER keeps `content.read`/`content.review` only; only ADMIN+ can decide) — see
DECISIONS.md ADR-014. Creator-facing Content routes are ownership-scoped in the service layer
(same pattern as Campaign Applications), not gated by these RBAC keys at all.

**Phase 8 note:** `order.read`/`order.update`/`order.refund`, `payment.read`, `commission.read`/
`commission.adjust`, and `attribution.read`/`attribution.override` all already existed
(reserved, unused — no real Order/Payment/Commission service existed before this phase). The
Checkout/Payment/Order domain is the first to actually wire admin routes behind them; **zero new
permission keys were added** — "add only missing permissions" per the spec, and none were missing.
Public checkout/payment endpoints (`/offers/:slug/checkout`, `/offers/:slug/visit`,
`/payments/click/prepare|complete`, `/orders/public/:publicToken`) are unauthenticated (`@Public()`)
by design — a customer never has a staff session — and are not gated by any RBAC key at all; every
validation there is a domain-level check (offer/campaign active, stock, signature verification),
not a permission check. See DECISIONS.md ADR-015.

## Role → permission matrix

`✓` = granted. Blank = not granted. ADMIN is a strict superset of MANAGER; SUPER_ADMIN is a strict
superset of ADMIN. There is no "partial" role — a role either has a permission or it doesn't, no
per-resource scoping in the MVP.

| Permission | MANAGER | ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|
| `product.read` | ✓ | ✓ | ✓ |
| `product.write` | | ✓ | ✓ |
| `product.archive` | | ✓ | ✓ |
| `offer.read` | ✓ | ✓ | ✓ |
| `offer.write` | | ✓ | ✓ |
| `offer.publish` | | ✓ | ✓ |
| `offer.pause` | | ✓ | ✓ |
| `offer.archive` | | ✓ | ✓ |
| `landing.read` | ✓ | ✓ | ✓ |
| `landing.write` | | ✓ | ✓ |
| `landing.publish` | | ✓ | ✓ |
| `landing.archive` | | ✓ | ✓ |
| `campaign.read` | ✓ | ✓ | ✓ |
| `campaign.write` | | ✓ | ✓ |
| `campaign.publish` | | ✓ | ✓ |
| `campaign.pause` | | ✓ | ✓ |
| `campaign.complete` | | ✓ | ✓ |
| `campaign.archive` | | ✓ | ✓ |
| `application.read` | ✓ | ✓ | ✓ |
| `application.review` | | ✓ | ✓ |
| `application.approve` | | ✓ | ✓ |
| `application.reject` | | ✓ | ✓ |
| `application.revise` | | ✓ | ✓ |
| `creator.read` | ✓ | ✓ | ✓ |
| `creator.review` | ✓ | ✓ | ✓ |
| `creator.suspend` | | ✓ | ✓ |
| `creator.block` | | | ✓ |
| `content.read` | ✓ | ✓ | ✓ |
| `content.review` | ✓ | ✓ | ✓ |
| `content.approve` | | ✓ | ✓ |
| `content.reject` | | ✓ | ✓ |
| `content.revise` | | ✓ | ✓ |
| `referral.read` | ✓ | ✓ | ✓ |
| `referral.manage` | | ✓ | ✓ |
| `referral.review` | | ✓ | ✓ |
| `referral.disqualify` | | ✓ | ✓ |
| `attribution.read` | ✓ | ✓ | ✓ |
| `attribution.override` | | | ✓ |
| `order.read` | ✓ | ✓ | ✓ |
| `order.update` | ✓ | ✓ | ✓ |
| `order.refund` | | ✓ | ✓ |
| `payment.read` | ✓ | ✓ | ✓ |
| `commission.read` | ✓ | ✓ | ✓ |
| `commission.adjust` | | ✓ | ✓ |
| `payout.read` | ✓ | ✓ | ✓ |
| `payout.approve` | | ✓ | ✓ |
| `payout.pay` | | ✓ | ✓ |
| `analytics.read` | ✓ | ✓ | ✓ |
| `analytics.export` | | ✓ | ✓ |
| `settings.read` | | | ✓ |
| `settings.write` | | | ✓ |
| `user.read` | | | ✓ |
| `user.manage` | | | ✓ |
| `audit.read` | ✓ | ✓ | ✓ |

A plain creator (a `User` with a `CreatorProfile` and no `UserRole` rows at all) has **zero**
entries in this table — `RolesService.getRoleKeysAndPermissionsForUser` returns an empty array for
them, so any route guarded by `@RequirePermissions(...)` rejects them with `FORBIDDEN`
unconditionally. Creator-facing routes (6B+) are authorized by a separate check (creator profile
exists + application approved), not by this permission table — the two authorization systems are
deliberately kept apart because creators and staff are different kinds of principal.

**Resolved (Creator Application domain, 2026-07-22):** `RequireCreatorGuard` (used by every
`/creator/*` route, including Campaign's) now checks both that the JWT carries a `creatorId` *and*
that creator's onboarding `CreatorApplication.status === "APPROVED"`, throwing `CREATOR_NOT_APPROVED`
(403) otherwise. The interim narrower gate noted above (creatorId presence only) no longer applies.

## Enforcement guarantees (see `PermissionsGuard`/`RolesService` for the code)

1. **Never trust the JWT for authorization.** The access token carries only `sub` (user id) — no
   role or permission claims. `JwtStrategy.validate()` re-reads
   `Role`/`RolePermission`/`UserRole` from Postgres on *every* authenticated request. A permission
   or role change takes effect on the very next request from that user, not at token expiry.
2. **AND, not OR.** `@RequirePermissions("a", "b")` requires both `a` and `b` — there is no route
   in this codebase that accepts "any one of" a permission list.
3. **Fail closed.** Every route requires at minimum a valid access token (`JwtAuthGuard`, global)
   unless explicitly `@Public()`. A route with no `@RequirePermissions()` still requires
   authentication; it just doesn't check role-specific permissions beyond that.
4. **Frontend role-rank checks are UI-only.** `apps/web`'s `hasRole()`/`RoleGuard` hide buttons;
   they are not consulted anywhere in the backend and cannot be relied on for authorization —
   confirmed by `docs/SCHEMA_API_AUDIT.md`'s "RBAC granularity" note.

## Verification status

Automated matrix test: `apps/api/src/roles/permissions.constants.spec.ts` (pure, no DB — asserts
`DEFAULT_ROLE_PERMISSIONS` matches this table exactly, catching drift between the two the moment
someone edits one without the other). Real-database integration coverage (seeded roles actually
carrying these grants in Postgres, a plain creator actually getting `FORBIDDEN` against a
permission-guarded route, a revoked permission taking effect on the very next request) is written
in `apps/api/test/rbac.e2e-spec.ts` but **not yet executed** — see PROJECT_STATUS.md's Phase 6A
section for why (blocked by local Docker environment; alternative test infrastructure required).
