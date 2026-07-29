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

## Full permission list (65)

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
| Creator | `creator.compliance` |
| Creator | `creator.tier` |
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
| Notification | `notification.read` |
| Notification | `notification.manage` |
| Onboarding (creator account admission) | `onboarding.read` |
| Onboarding (creator account admission) | `onboarding.review` |
| Onboarding (creator account admission) | `onboarding.approve` |
| Onboarding (creator account admission) | `onboarding.reject` |
| Onboarding (creator account admission) | `onboarding.revise` |
| Role (staff role/permission management) | `role.read` |
| Role (staff role/permission management) | `role.manage` |
| Refund (admin review decision) | `refund.read` |
| Refund (admin review decision) | `refund.manage` |
| Homepage (public homepage CMS sections) | `homepage.read` |
| Homepage (public homepage CMS sections) | `homepage.write` |
| Competition (creator motivation contests) | `competition.read` |
| Competition (creator motivation contests) | `competition.write` |
| Competition (creator motivation contests) | `competition.publish` |
| Competition (creator motivation contests) | `competition.complete` |
| Competition (creator motivation contests) | `competition.archive` |

**Homepage CMS note:** `homepage.read`/`homepage.write` follow the same two-verb split as
`landing.*`, but with no `.publish`/`.archive` verbs — the homepage has no draft/published/archived
workflow (see DECISIONS.md ADR-027), it's always live, and each section's own `isActive` flag
(toggled via `.write`) is the only visibility switch.

**Competition note:** `competition.*` mirrors `campaign.*`'s permission shape exactly, minus a
`.pause` verb — `CompetitionStatus` has no PAUSED state (see schema.prisma's own comment on why).

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

**Phase 9 note:** `commission.read`/`commission.adjust` and `payout.read`/`payout.approve`/
`payout.pay` all already existed (reserved, unused — no real settlement/payout service existed
before this phase). The Wallet/Commission Settlement/Payout domain is the first to wire admin
routes behind them; **zero new permission keys were added.** `commission.adjust` gates all three
settlement transitions (approve/reject/mark-payable); `payout.approve` gates the review decisions
(approve/reject) while `payout.pay` gates the money-movement steps (processing/paid/failed) — MANAGER
keeps read-only access to both resources, matching the matrix below unchanged. Creator-facing
payout method and withdrawal routes (`/creator/wallet/*`, `/creator/payout-methods/*`,
`/creator/payouts/*`) are ownership-scoped via `RequireCreatorGuard` in the service layer, not
gated by these RBAC keys at all — same pattern as Phase 7A's Content domain. See DECISIONS.md
ADR-016.

**Phase 10 note:** `notification.read`/`notification.manage` are **genuinely new** — unlike every
prior phase since 6B, nothing reserved these keys ahead of time (the Phase 6 spec's original
permission list never anticipated a Communication & Notification domain). `notification.read`
gates the admin notification queue and failed-deliveries views; `notification.manage` gates retry
actions — MANAGER gets read-only, ADMIN+ gets manage, the same split as every other two-verb
domain in this file. Creator-facing notification routes (`/creator/notifications/*`,
`/creator/notification-preferences`) are ownership-scoped via `RequireCreatorGuard`-equivalent
`userId`-from-JWT checks (not `creatorId`, since admins also have notifications) — see DECISIONS.md
ADR-017.

**Phase 11 note:** `onboarding.read/review/approve/reject/revise` are **genuinely new** — the
pre-existing `creator.read/review/suspend/block` keys are shaped for a future admin *account*
moderation domain (suspend/block are `UserStatus` verbs), not application decisions, so they are
left untouched for that domain instead of being repurposed here. `application.*` was not reused
either — it already gates CampaignApplication review (a creator applying to join a *Campaign*,
distinct from whether someone may be a creator on the platform at all — see ADR-012). The split
mirrors `content.*` exactly: MANAGER gets `onboarding.read`/`onboarding.review` (view the queue,
move a submission into UNDER_REVIEW); only ADMIN+ can decide (`approve`/`reject`/`revise`, where
"revise" is this file's established spelling of "request changes"). Creator-facing onboarding
routes (`/creator/onboarding/*`) are deliberately **not** gated by `RequireCreatorGuard` — that
guard requires an *already-approved* application, which would make it impossible for an unapproved
creator to ever submit one; ownership is enforced by reading the creator id off the JWT, same
pattern as `/creator/profile`. See DECISIONS.md ADR-018.

**Phase 12 note:** `role.read`/`role.manage` and `refund.read`/`refund.manage` are the only two
genuinely new domains this phase added. Everything else it touches already had a fitting key
reserved and unused: staff account management uses `user.read`/`user.manage` (real CRUD for the
first time); creator account administration (list/detail/stats/history/summaries/suspend/block)
uses `creator.read`/`creator.review`/`creator.suspend`/`creator.block` — `creator.review` now gates
the account *detail* view (stats, campaign history, earnings/payout/referral summaries), distinct
from `onboarding.review` (the onboarding application queue, Phase 11); platform payments visibility
uses `payment.read` (read-only, per this phase's own spec — no `payment.manage` was added); Settings
uses `settings.read`/`settings.write`; the audit-log viewer uses `audit.read`. `refund.read`/
`refund.manage` are distinct from the pre-existing `order.refund` (unchanged — still gates refund
*creation* from the order detail page, ADR-015); the new keys gate the *review decision*
(approve/reject) layered on top of an already-created `Refund` row, which previously had no code
path to ever leave its initial `REQUESTED` status. See DECISIONS.md ADR-019 for why approve/reject
does not re-trigger or reverse the order-level financial action `OrdersService.createRefund`
already performs synchronously at request time.

**Phase 13 note:** `analytics.read`/`analytics.export` already existed, reserved and unused since
Phase 6A — this phase is the first to actually wire admin routes behind them, and **zero new
permission keys were added**, the same outcome Phase 8/9 had. All 10 new `/admin/analytics/*` GET
routes (Executive/Creator/Campaign/Product/Payment/Refund/Customer) require `analytics.read` alone
— every staff role sees every analytics view identically; this domain does not introduce per-role
data masking, matching this file's own stated MVP philosophy ("a role either has a permission or it
doesn't, no per-resource scoping"). The one `/admin/analytics/export` route additionally requires
`analytics.export`, changing nothing in practice since no role in `DEFAULT_ROLE_PERMISSIONS` has
`analytics.export` without also having `analytics.read`. See DECISIONS.md ADR-020.

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
| `creator.compliance` | | ✓ | ✓ |
| `creator.tier` | | ✓ | ✓ |
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
| `notification.read` | ✓ | ✓ | ✓ |
| `notification.manage` | | ✓ | ✓ |
| `onboarding.read` | ✓ | ✓ | ✓ |
| `onboarding.review` | ✓ | ✓ | ✓ |
| `onboarding.approve` | | ✓ | ✓ |
| `onboarding.reject` | | ✓ | ✓ |
| `onboarding.revise` | | ✓ | ✓ |
| `role.read` | | | ✓ |
| `role.manage` | | | ✓ |
| `refund.read` | ✓ | ✓ | ✓ |
| `refund.manage` | | ✓ | ✓ |
| `homepage.read` | ✓ | ✓ | ✓ |
| `homepage.write` | | ✓ | ✓ |
| `competition.read` | ✓ | ✓ | ✓ |
| `competition.write` | | ✓ | ✓ |
| `competition.publish` | | ✓ | ✓ |
| `competition.complete` | | ✓ | ✓ |
| `competition.archive` | | ✓ | ✓ |

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
