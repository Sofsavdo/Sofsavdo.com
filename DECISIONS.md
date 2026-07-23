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

## ADR-008: Refresh token in an HttpOnly cookie, relying on `SameSite=Lax` for CSRF (no separate CSRF token)

**Context:** Phase 6 spec §6 requires an explicit choice between cookie-based and response-body
refresh tokens, with the corresponding CSRF (cookie) or XSS/storage (body) risk written down.

**Decision:** the refresh token is delivered exclusively via an `HttpOnly`, `Secure` (production
only — see below), `SameSite=Lax`, `Path=/auth` cookie named `refreshToken`, 30-day `maxAge`,
set/cleared by `AuthController` (`apps/api/src/auth/auth.controller.ts`). The access token is
never put in a cookie — it's returned once in the JSON response body and held in memory by the
frontend (never `localStorage`), sent via `Authorization: Bearer` on every subsequent request.
CORS is configured with `credentials: true` and an explicit origin allowlist (`WEB_APP_URL`), never
a wildcard, so the cookie is only readable/settable in the context of requests the API explicitly
trusts.

**Why HttpOnly cookie over response body, despite the CSRF surface it opens:** a refresh token in
the response body would have to be persisted somewhere the frontend can read on reload —
`localStorage`, `sessionStorage`, or a JS-readable cookie — all three are readable by any script
that runs on the page, so a single XSS bug anywhere in `apps/web` (a landing-page rich-text
section, a compromised dependency, etc.) becomes full session takeover with a 30-day-lived token.
An `HttpOnly` cookie is invisible to JavaScript entirely; the same XSS bug can still make
authenticated requests *while the page is open*, but cannot exfiltrate a long-lived credential to
replay later from an attacker's own machine. Given this platform's `LandingSectionRenderer` accepts
admin-authored rich content that is explicitly *not* meant to run arbitrary script but is still a
larger XSS surface than a typical SPA, defending the long-lived credential was judged more
important than eliminating the cookie's CSRF surface.

**Why `SameSite=Lax` is sufficient without a separate CSRF token:** the only two endpoints that
read the refresh cookie without also requiring a `Bearer` header are `POST /auth/refresh` and
`POST /auth/logout` — every other authenticated route requires the access token, which a CSRF
attacker cannot forge (it isn't in a cookie, so a cross-site form/fetch can't attach it).
`SameSite=Lax` cookies are excluded from cross-site subrequests (`fetch`/`XHR`/form-POST triggered
by another site) and only sent on top-level cross-site *navigation* (clicking a link) — a CSRF
attack against a JSON POST endpoint is exactly the case `Lax` blocks. The residual risk (a
cross-site page somehow triggering a top-level GET-navigation-based refresh) has no meaningful
payoff for an attacker: CORS still blocks the attacker's origin from reading the JSON response
containing the new access token, and the state change (token rotation) leaves the legitimate user
still logged in with a rotated cookie in their own browser — not an account compromise. A dedicated
CSRF token (double-submit cookie or synchronizer token) was judged as unnecessary complexity for
that residual risk; this call should be revisited if `/auth/refresh` or `/auth/logout` ever gain a
side effect beyond token lifecycle management.

**Dev vs. production cookie config:** `secure` is `false` in development (`NODE_ENV !== "production"`)
because local development runs over plain `http://localhost`, where a `Secure` cookie would never
be sent at all; it is `true` in production, requiring HTTPS end-to-end (terminated at the
Cloudflare/Vercel/Railway edge per DEPLOYMENT.md). `sameSite: "lax"` is unchanged between
environments — see ADR-007: even after the frontend/API split into separate subdomains
(`app.rosti.uz` / `api.rosti.uz`), they remain **same-site** (same registrable domain `rosti.uz`),
and `SameSite=Lax` cookies are sent on same-site cross-subdomain requests regardless of which
subdomain's page initiated the request — only genuinely cross-site (different registrable domain)
requests are blocked, which is exactly the CSRF case this ADR relies on.

## ADR-009: `sslmode=disable` for the Railway test Postgres only; `enableReadyCheck: false` for the Railway test Redis only — neither is a production default

**Context:** Phase 6A verification used temporary Railway-hosted Postgres and Redis instances
(credentials supplied by the user, scoped to `apps/api/.env.test`, never committed). Both required
a real fix, not a config-only workaround, to connect at all — documented here per explicit
instruction because both look like they could be silently copy-pasted into a production config by
a future session if the *reason* isn't written down next to the *what*.

**Postgres — `?sslmode=disable` appended to `DATABASE_URL`/`DIRECT_URL`:** Prisma's query engine
attempts SSL negotiation by default (`sslmode=prefer` behavior) and this fails with `P1001: Can't
reach database server` against Railway's Postgres proxy specifically — confirmed by isolating the
variable: a plain `pg.Client` connection (no SSL negotiation attempt) succeeds instantly with the
identical connection string, only Prisma's engine fails, and only until `sslmode=disable` is added.
**This is a test-database-only workaround, not a security decision.** `sslmode=disable` must never
appear in a production or staging `DATABASE_URL` — production Postgres connections terminate TLS
properly (see DEPLOYMENT.md), and the real fix, if this proxy behavior turns out to matter beyond
Phase 6A, is to investigate Railway's proxy-side TLS handling, not to disable TLS everywhere.
`apps/api/.env.test.example` carries a comment pointing back to this ADR. SSL policy for
production must be controlled by that environment's own `DATABASE_URL`/deployment config, never by
copying this test-only value.

**Redis — `enableReadyCheck: false`:** ioredis, after connecting and authenticating, sends an
additional readiness-check command (`INFO`) before considering the connection ready by default.
Against the Railway Redis proxy, that specific extra command reliably triggers `ECONNRESET` —
reproduced with a raw TCP socket sending `AUTH`+`PING` by hand (which succeeds) versus ioredis's
default handshake (which resets), isolating the readiness-check command as the cause.
**What this option does and does not weaken:** it removes ioredis's own extra pre-flight check; it
does **not** remove this codebase's own health check, which still issues a real `PING` command
(`HealthController.ready()` calls `redis.ping()`, not a client-status inspection — see §"Health
endpoints" in TESTING.md) and still fails loudly if Redis is actually unreachable. A full command
smoke test (`test/redis.e2e-spec.ts`: connect, `PING`, `SET`, `GET`, `DEL`, graceful `QUIT`) passes
against this same configuration, confirming real commands execute correctly, not just that the
client object reports "connected". Applied in `HealthController` (`src/health/health.controller.ts`)
because the health endpoint is the one place in the 6A codebase that instantiates a Redis client
outside of tests; any future module that creates its own Redis client (BullMQ in 6B+) should
re-evaluate whether the same option is needed against whatever Redis instance it's pointed at —
this is a proxy-specific workaround, not a universal ioredis setting this codebase mandates
everywhere.

**Verification status:** cookie attributes are implemented in code
(`AuthController.setRefreshCookie`) but the actual `Set-Cookie` header emitted by a running
instance has not yet been observed against a real request — blocked by the same local-Docker
environment issue tracked in PROJECT_STATUS.md's Phase 6A section. `test/auth.e2e-spec.ts`
already asserts `Set-Cookie` matches `/refreshToken=/` on register/login/refresh; a follow-up
assertion on the full attribute string (`HttpOnly; SameSite=Lax; Path=/auth`) should be added
before this ADR's cookie contract is considered proven, not just implemented.

## ADR-010: A Landing has no slug of its own — addressed via its Offer's slug

**Context:** The Phase 6B Landing domain spec asked for "slug uniqueness" as one of its
requirements. `LandingPage` is and always was a strict 1:1 with `Offer` (`offerId @unique`), and
`Offer.slug` was already unique and already the key the public route resolves buyer traffic
through — `API.md` had already documented the intended public contract as
`GET /offers/:slug/public`, written before this slice existed.

**Decision:** Do not add a second `slug` column to `LandingPage`. The Landing is addressed
entirely through its Offer's slug; "slug uniqueness" for the Landing domain is satisfied by the
uniqueness Offer already enforces, not by a second independent unique column.

**Why:** A second slug on the same 1:1 address would be a second name for the same thing with no
mechanism keeping the two in sync — exactly the kind of duplicate-source-of-truth problem the Offer
slice was explicitly told to avoid for commission/discount fields (see PROJECT_STATUS.md's Offer
domain section). Buyers only ever reach a Landing by opening an Offer's link; there is no scenario
where a Landing needs to be addressable independently of its Offer. If Landings ever become
addressable by something other than their Offer (e.g. a future many-Landings-per-Offer A/B test
model), that is a different relationship (1:many, not 1:1) and would warrant revisiting this ADR
rather than bolting a slug onto the current 1:1 shape.

## ADR-011: Campaign — retired `OPEN`/`CANCELLED`, no commission inheritance from Offer, no rigid hashtag/mention/link columns

**Context:** The Phase 6B Campaign spec asked for a 5-state lifecycle (`DRAFT|ACTIVE|PAUSED|
COMPLETED|ARCHIVED`) with an explicit transition matrix, "commission inheritance/override" between
Offer and Campaign, and a long list of granular content-requirement fields (required hashtags,
mentions, links, disclosure text, usage rights, revision allowance). The pre-existing Phase 1
`Campaign` model already had `CampaignStatus = DRAFT|OPEN|ACTIVE|PAUSED|COMPLETED|CANCELLED` and a
full commission config directly on `Campaign` (`commissionType`/`commissionValue`/
`fixedPaymentMinor`) — `Offer` has never had any creator-commission field of its own (confirmed
during the Offer domain slice, which deliberately did not add one, per `COMMISSION.md`).

**Decisions:**
1. **Status enum**: replaced `OPEN`/`CANCELLED` with `ARCHIVED`, matching the spec's 5-state model
   exactly. No real Campaign rows existed under the old enum in a shipped product yet (only one
   seeded row), so the migration data-fixes it in place (`OPEN`→`ACTIVE`, `CANCELLED`→`COMPLETED`)
   rather than preserving the old values — see the migration SQL for the exact mapping.
2. **Commission is never "inherited"** — Offer has no commission field to inherit from, so every
   Campaign's commission is its own by construction. The API exposes `commissionSource: "CAMPAIGN"`
   as a literal (not a computed inherited/overridden distinction) purely so a future slice that
   *does* add Offer-level commission has a field to start varying without a breaking API change.
3. **No dedicated columns for hashtags/mentions/links/disclosure/usage-rights/revision-allowance.**
   The existing `requiredElements`/`forbiddenElements`/`referenceContent` string arrays (already
   present on the Phase 1 model, used today for "dos"/"don'ts"/reference links) are flexible enough
   to hold this content verbatim as free-form strings; dedicated rigid columns for each would
   duplicate what these arrays already do, and nothing in the existing frontend/mock model treats
   these as structurally distinct from "dos"/"don'ts" today.
4. **No structured eligibility (allowed creator categories, per-platform follower minimums beyond a
   single min/max pair).** `CreatorProfile`/`SocialAccount` has no per-category tagging beyond
   `contentNiches` (free-text, unrelated to Campaign categories) and no existing UI concept of
   "allowed categories" — `minFollowers`/`maxFollowers` were added as a single coarse pair (checked
   against a creator's highest `SocialAccount.followerCount` across all platforms) since the data
   to support anything more granular doesn't exist yet.

**Why:** Same principle as ADR-010 — preserve the established business model and avoid duplicate
sources of truth rather than blindly adding every field a prompt lists literally. If per-platform
eligibility or Offer-level commission become real requirements later, this ADR is the place to
revisit, not a reason to have spliced half-built versions of them in now.

## ADR-012: Creator Application reuses the existing `CampaignApplication` model, not the onboarding `CreatorApplication` model

**Context:** The schema already had two similarly-named-but-distinct models: `CreatorApplication`
("should this person be allowed to be a creator on the platform at all" — the onboarding flow, its
own admin review queue at `/admin/applications`, untouched by this slice) and `CampaignApplication`
("has this already-a-creator applied to join this specific Campaign" — thin, PENDING/APPROVED/
REJECTED, no real backend). The Phase 6B "Creator Application" domain name refers to the latter:
a creator applying to a Campaign, not onboarding review.

**Decisions:**
1. Extended `CampaignApplication` in place (retired `PENDING` for the spec's 7-state model —
   `DRAFT|SUBMITTED|UNDER_REVIEW|CHANGES_REQUESTED|APPROVED|REJECTED|WITHDRAWN`; only `APPROVED`
   rows existed for real, so this is a clean rename). Did not touch `CreatorApplication` at all.
2. **No reapplication after rejection or withdrawal.** The pre-existing
   `@@unique([campaignId, creatorId])` is a hard, permanent one-row-ever constraint — REJECTED and
   WITHDRAWN are genuinely terminal with no path back to a new application for that same pair. The
   spec explicitly allowed this default ("unless the business model explicitly supports
   resubmission after rejection") and nothing in the existing schema/UI implies reapplication
   should be supported.
3. **No review-event history table.** `rejectionReason`/`changesRequestedReason`/`adminNotes` each
   hold only their latest value — an admin re-rejecting (impossible, REJECTED is terminal) or
   re-requesting changes overwrites the previous reason. The spec's own escape hatch ("otherwise
   document the current limitation rather than creating an oversized workflow engine") is invoked
   here rather than adding an audit/history model for a single admin-facing domain.
4. **Explicit per-action source-states, not one shared `transition(to)` matrix.** `submit` (DRAFT→
   SUBMITTED) and `resubmit` (CHANGES_REQUESTED→SUBMITTED) both land on the same status from
   different starting states and are distinct API actions per the spec's own suggested routes —
   modeling this as a single generic transition function would obscure that they're different
   creator actions with different eligibility re-checks.
5. **Permission keys are `application.*`, not the spec-suggested `creatorApplication.*`.** Every
   existing permission key is a single lowercase domain word + single lowercase action word
   (enforced by `permissions.constants.spec.ts`'s regex) — `creatorApplication`/`requestChanges`
   would be the first camelCase keys in the file. Kept the existing convention: `application.read/
   review/approve/reject/revise` ("revise" = request-changes).
6. **`RequireCreatorGuard` now also checks the onboarding `CreatorApplication.status === APPROVED`**
   for the linked creator (previously it only checked that a `creatorId` existed on the JWT — see
   RBAC.md's now-resolved "Interim state" note). This is a read of existing onboarding data, not
   onboarding business logic, so it stays in the shared auth-guard file rather than moving into
   this domain's module. `GET /creator/profile` (new, minimal, separate from both application
   modules) is deliberately NOT behind this tightened guard, since it's how the frontend discovers
   *why* a not-yet-approved creator is blocked in the first place.

**Why:** Same "preserve what already exists, avoid duplicate architectures" principle as every
other Phase 6B slice's ADR. Building a second full application-workflow engine (onboarding-style)
for Campaign applications when a thinner, purpose-built model already existed would have been
exactly the "duplicate infrastructure" the spec explicitly warned against.

## ADR-013: Phase 6B Enhancement — Campaign media, two-mode commission, Offer-owned delivery, and creator-to-creator referral

**Context:** A single checkpoint added four connected capabilities on top of the already-completed
Product/Offer/Landing/Campaign/Creator-Application slices: campaign visual media, a two-mode
commission model (percentage or fixed), regional delivery pricing for physical products, and a
creator-to-creator referral program. Each had its own scoping question against the existing schema
and architecture.

**Decisions:**

1. **Provider-independent storage abstraction, not a vendor SDK.** No object-storage integration
   existed anywhere in the codebase. Introduced a `StoragePort` interface (`put`/`remove`/
   `publicUrl`) behind a `STORAGE_PORT` injection token, with a `LocalDiskStorage` adapter as the
   only implementation (serves files under `/media/` via `NestExpressApplication.useStaticAssets`).
   Campaign-media domain code depends only on the port, never on `fs`/disk paths directly, so a
   future S3/R2/GCS adapter is a new class + one module registration, not a rewrite.
2. **Video dimensions/duration are honestly client-reported, not server-verified.** No
   ffprobe-equivalent dependency exists in this codebase. Image dimensions ARE server-decoded (via
   the `image-size` package) and enforced against the 1080×1440 standard with configurable
   tolerance; video metadata comes from the browser's `<video>` element at upload time and is
   trusted as-is. This is documented in code rather than silently overclaiming full server-side
   media validation.
3. **Commission narrowed to exactly two mutually exclusive modes.** The pre-existing
   `CommissionType` enum (`PERCENTAGE`/`FIXED_PER_SALE`/`FIXED_CONTENT_FEE`/`HYBRID`) collapsed to
   `PERCENTAGE | FIXED_AMOUNT`, with `commissionRateBps`/`commissionAmountMinor`/
   `commissionCurrency` replacing the old `commissionValue`/`fixedPaymentMinor` fields. Enforced
   mutually exclusive via a DB `CHECK` constraint (`Campaign_commission_mode_check`) in addition to
   the service-layer validator — belt-and-suspenders on money-shaped data. The migration backfills
   legacy `HYBRID`/`FIXED_PER_SALE`/`FIXED_CONTENT_FEE` rows onto the two surviving modes before
   narrowing the enum, so no existing row is silently dropped.
4. **Delivery rules belong to `Offer`, not `Product`.** Per the spec's own reasoning — different
   Offers for the same Product may run different delivery promotions — `OfferDeliveryRegion` hangs
   off `Offer`. "Only physical Offers may have delivery rules" is enforced in
   `DeliveryService.assertOfferIsPhysical()` (a service-layer check reading `Product.type`), not a
   DB-level cross-table constraint, since Postgres can't express "check a column on a joined table"
   without a trigger — judged not worth the added complexity for one invariant.
5. **`POST /offers/:slug/quote` lives under the existing `offers` controller, not a new `/public`
   prefix.** The spec suggested `/public/offers/:slug/quote`; the existing public-offer route is
   already `GET /offers/:slug/public` under `@Controller("offers")`. Matching that established
   convention took priority over the spec's literal suggestion. The endpoint never creates an
   Order — it is a pure, backend-authoritative price calculator (integer minor units in, integer
   minor units out), exactly as scoped.
6. **Referral RBAC reuses two pre-existing, previously-unused permission keys and adds exactly
   two new ones — deliberately deviating from the spec's suggested key names.** The naming
   convention enforced by `permissions.constants.spec.ts` (`^[a-z]+\.[a-z]+$`, exactly two lowercase
   segments) rules out the spec's `referral.rule.manage` / `campaign.media.manage` /
   `delivery.manage`. Used `referral.read`/`referral.manage` (already defined, never wired to a
   route) plus two new keys `referral.review`/`referral.disqualify`, and reused `campaign.write`/
   `offer.write` for the media/delivery sub-resources — mirroring the already-established
   "landing-sections reuses `landing.write`" precedent instead of inventing parallel keys per
   sub-resource.
7. **Distinct from the pre-existing `ReferralLink`/`ReferralVisit` models.** Those are
   customer-facing sales-attribution links a creator shares with buyers; `CreatorReferral` /
   `CreatorReferralRule` / `CreatorReferralReward` are a separate creator-recruits-creator program.
   Sharing one name for two different concepts would have been the "duplicate concept" the spec
   warned against — so `CreatorProfile.referralCode` (creator-to-creator) and the customer-facing
   promo/referral codes on `ReferralLink` are deliberately two different code spaces.
8. **Attribution is structurally enforced, not just validated.** `CreatorReferral.referredCreatorId`
   is `@unique` (a DB constraint, not an application check) — the database itself makes "at most one
   direct referrer, ever" impossible to violate, even under concurrent requests. A `CHECK
   (referrerCreatorId <> referredCreatorId)` constraint makes self-referral structurally
   impossible the same way. Attribution can only ever be written inside
   `AuthService.register()`'s transaction — there is no other code path that creates a
   `CreatorReferral` row — which is itself the enforcement mechanism for "no attribution after
   registration."
9. **Exactly one milestone is wired to a real event this checkpoint:**
   `FIRST_APPROVED_CAMPAIGN_APPLICATION`, hooked into the existing Campaign-Application submit
   (instant-join) and admin-approve paths. All other `ReferralMilestoneType` values and
   `EARNINGS_PERCENTAGE` are fully configurable in the admin UI but dormant — no Content/Order/
   Commission domain exists yet to source their triggering events from. The math for
   `EARNINGS_PERCENTAGE` (`calculateEarningsPercentageReward`, using `applyBasisPoints` for
   deterministic integer rounding) is written and unit-tested now so it is ready the moment a real
   qualified-earnings event exists, rather than being designed later under time pressure.
10. **MILESTONE_FIXED rewards are one-time per (referral, rule), enforced at the application layer,
    not only via the DB's per-event uniqueness constraint.** The `CreatorReferralReward` unique
    constraint is `(referralId, ruleId, sourceType, sourceId)` — necessary for retry-idempotency on
    a single event, but insufficient on its own to stop a *second, different* qualifying event
    (e.g. a referred creator's second approved Campaign Application) from paying the same
    "one-time" milestone out again while the rule stays active. `ReferralsService.
    onCampaignApplicationApproved()` checks for an existing reward on the same (referralId, ruleId)
    pair before creating a new one. This check-then-create is not race-proof against two truly
    concurrent approvals for the same referred creator, but campaign-application approval is an
    infrequent, admin-only action, so that residual window is accepted rather than adding
    DB-trigger-level locking for it — documented as a known limitation in the service code.
11. **No real payout ledger yet, so no reward is ever marked `PAID` by this checkpoint.**
    `CreatorReferralReward.status` reaches `PENDING`→`APPROVED`/`REJECTED` via admin review; moving
    to `PAID` is explicitly left to whenever a real Payout domain exists, per the spec's "do not
    falsely claim final financial settlement already works."

**Why:** Every decision above follows the same governing constraint stated throughout this
checkpoint's spec: preserve what already exists, avoid inventing parallel/duplicate concepts, and
be honest in code and docs about what is and is not really enforced yet (video metadata, the
milestone one-time guard's race window, the absence of a payout ledger) rather than overclaiming
completeness for functionality that depends on domains (Content, Order, Commission, Payout) that
do not exist yet.

## ADR-014: Phase 7A — Content Management Domain

**Context:** Content represents a creator's submission (caption/notes/hashtags/attachments/
thumbnail) against a Campaign, going through a DRAFT→SUBMITTED→UNDER_REVIEW→CHANGES_REQUESTED→
APPROVED|REJECTED|EXPIRED lifecycle with permanent version history and review comments. A
mock-era `CreatorContent`/`CreatorContentStatus` model and matching frontend already existed,
along with `content.read`/`content.review` RBAC keys and a dormant `FIRST_APPROVED_CONTENT`
referral milestone from the 6B Enhancement checkpoint — none of which matched the real spec's
shape.

**Decisions:**

1. **New `Content` model, not an extension of `CreatorContent`.** The existing `CreatorContent`
   is tied to `CreatorCampaign` (not `Campaign`+`CampaignApplication`+`CreatorProfile` directly),
   has no version-history/review-comment tables, no `CHANGES_REQUESTED`/`EXPIRED` states, and is
   unreferenced by any real backend service (mock-store-only, confirmed by grep). Extending it in
   place would have meant bolting a genuinely different data model onto a table already shaped
   for something else. `CreatorContent` is left untouched — no real rows exist, and the mock
   frontend still compiles against it — while `Content` supersedes it for the real vertical, the
   same "kept untouched, new model for the real slice" pattern already used for
   `CampaignAsset`/`FileAsset` → `CampaignMedia`.
2. **Content can be many-per-CampaignApplication.** `Campaign.requiredContentCount` can be > 1, so
   `Content` has no uniqueness constraint against `campaignApplicationId` — a creator may submit
   several Content rows against one approved application, each with its own independent
   DRAFT→...→APPROVED lifecycle.
3. **`ContentAttachment` mirrors `CampaignMedia`'s storage pattern exactly** — binary bytes never
   touch Postgres, only `storageKey`/`publicUrl`/metadata, behind the same `StoragePort`
   abstraction (no second storage system introduced). `ContentAttachmentRole` (`ATTACHMENT` |
   `THUMBNAIL`) mirrors `CampaignMediaRole`'s "one designated role is exactly-one-per-parent"
   pattern: at most one THUMBNAIL per Content, enforced by a partial unique index
   (`ContentAttachment_thumbnail_unique`, raw SQL — Prisma can't express partial indexes, same as
   `CampaignMedia_cover_unique`). THUMBNAIL reuses Campaign media's 1080×1440 portrait-frame
   validation (visual consistency with the catalog); general ATTACHMENT files have no forced
   frame, only size/type/duration limits — "image dimensions where required" (spec §Validation)
   is read as "required for the thumbnail specifically."
4. **`ContentVersion` is a genuinely new pattern for this codebase — a real, permanent, append-only
   history table.** Every other "history" in this codebase (`CampaignApplication`'s
   rejection/changes-requested reasons, `CreatorReferral`'s disqualification reason) is a
   latest-value-only field, explicitly not a history table, because no prior domain needed real
   version history. Content's spec explicitly requires "no version may ever be deleted," so
   `ContentVersion` is a real snapshot row created on every submit/resubmit (never updated,
   `@@unique([contentId, versionNumber])`), storing caption/notes/hashtags/metadata plus a frozen
   `attachmentSnapshot` (denormalized Json, independent of whatever the live attachment rows say
   later).
5. **`ContentReviewComment` is separate from `Content`'s own latest-reason fields, not a
   replacement for them.** `Content.rejectionReason`/`changesRequestedReason` stay
   latest-value-only (matching the established convention, used for quick "current state"
   display); `ContentReviewComment` is the real, never-deleted, append-only comment thread
   (author, action, comment, timestamp, per-version) the spec's "Review Comments" and "Audit
   Trail" sections require. Creator-facing comment responses omit `authorId` — reviewer identity
   is not the creator's business, same convention as hiding `reviewedById` from
   `ApplicationCreatorResponse`.
6. **The dormant `AuditLog` model is finally activated, not duplicated.** No domain in this
   codebase had ever written to `AuditLog` (generic `actorId`/`action`/`entityType`/`entityId`/
   `before`/`after`, confirmed unused by grep) despite it existing since Phase 1. Content is the
   first domain to actually populate it — via a new, tiny, `@Global()` `AuditService`
   (`apps/api/src/common/audit/`) any future domain can reuse — rather than inventing a
   Content-specific audit table. Every action (created/edited/submitted/resubmitted/approved/
   rejected/changes-requested/expired/attachment-uploaded/attachment-removed) writes one row.
7. **EXPIRED is lazily materialized on read, not cron-driven.** This codebase has no scheduler or
   queue infrastructure. Rather than leave `EXPIRED` as a purely computed-at-read value (the
   existing convention for `CampaignAvailability`/`ApplicationAvailability`), the spec explicitly
   lists `EXPIRED` as one of only seven *stored* statuses — so `ContentService` runs a bulk
   `expireStaleContent()` sweep (one `findMany` + one `updateMany`, keyed off
   `campaign.contentDeadline` or the Campaign's own computed `EXPIRED` availability) at the top of
   every read/mutate entry point, flipping any stale non-terminal row the moment it's next
   touched. This keeps `EXPIRED` genuinely persisted (dashboards/admin filters can query it
   directly) without adding cron infrastructure this checkpoint doesn't need.
8. **`content.approve`/`content.reject`/`content.revise` added, mirroring `application.*`'s
   4-verb split exactly** (`content.read`/`content.review` already existed, reserved/unused).
   MANAGER keeps read/review only; ADMIN+ gets the three decision verbs — same reasoning as
   `application.*`'s split between review (start) and approve/reject/revise (decide). 54
   permissions total (up from 51).
9. **`ReferralsService.onContentApproved` mirrors `onCampaignApplicationApproved` exactly**,
   finally wiring the `FIRST_APPROVED_CONTENT` milestone and `firstApprovedContentAt` timestamp
   that the 6B Enhancement checkpoint defined but left dormant pending a real Content-approval
   event. Same one-time-per-(referral,rule) guard, same `sourceType`/`sourceId` idempotency
   anchor, same "reuse the existing hook pattern" reasoning as that checkpoint's own ADR.
10. **Frontend: new functions/types/routes, not renames of the legacy mock-only Content flow.**
    `getContent`/`submitContent`/`getAllContent`/`approveContent`/`requestContentRevision`/
    `rejectContent` (mock-store-backed, used by the pre-existing Content pages) are untouched;
    the real domain's frontend functions are named distinctly (`createContentDraft`,
    `getContentDetail`, `getContentReviewList`, `approveContentReview`, etc.) to avoid a naming
    collision at the same re-export boundary, and the existing `/creator/content` and
    `/admin/content` pages branch on `NEXT_PUBLIC_API_MODE` (real renders the new UI against the
    live backend; mock keeps the original JSX byte-for-byte) rather than being replaced outright.

**Why:** Same governing principle as every prior checkpoint's ADR — preserve what already exists,
reuse rather than duplicate infrastructure (`StoragePort`, `AuditLog`, the `application.*` RBAC
pattern, the referral milestone-hook pattern), and be explicit in code and docs about the one
genuinely new pattern this domain required (a real append-only version/comment history) rather
than forcing it into a "latest value only" shape that would silently violate the spec's own "no
version may ever be deleted" requirement.

## ADR-015: Phase 8 — Checkout, Payment & Order Domain

**Context:** `Order`/`Payment`/`Commission`/`CommissionRule`/`Attribution`/`Customer`/`Address`/
`PromoCode`/`ReferralLink`/`ReferralVisit`/`Refund` all existed in schema.prisma as fully-designed
Phase 1 models — real relations, real indexes, forward-looking comments — but with **zero** real
backend service ever touching them (confirmed by grep across every `.service.ts`/`.controller.ts`
before writing any Phase 8 code). Unlike `CreatorContent`/`CampaignAsset` (explicitly-commented
mock-era stubs meant to be superseded), these models were architecturally sound and simply
unbuilt. The governing decision this checkpoint: **extend these models, never supersede them.**

**Decisions:**

1. **`OrderStatus` enum values replaced outright** (`NEW`/`CONFIRMED`/`COMPLETED`/`RETURNED` →
   `CREATED`/`PAYMENT_PENDING`/`PAID`/`PROCESSING`/`SHIPPED`/`IN_TRANSIT`/`DELIVERED`/`CANCELLED`/
   `REFUNDED`). Zero real `Order` rows existed (no `OrdersService` existed before this phase), so
   this is a rename, not a breaking change — same reasoning as ADR-011's `CampaignStatus` retirement
   of `OPEN`/`CANCELLED`. The new set matches the spec's explicit checkout-lifecycle requirement
   (an Order must exist, unpaid, before payment resolves) that the old set couldn't express.
2. **`CommissionRule.commissionValue`/`fixedPaymentMinor` renamed to `commissionRateBps`/
   `commissionAmountMinor`**, realigning it with `Campaign`'s own post-6B-Enhancement commission
   shape (ADR-013 narrowed `Campaign` to this exact pair with a DB CHECK constraint enforcing
   mutual exclusivity). `CommissionRule` predates that rename and had zero real rows, so this is
   also a safe rename. `OrdersService.getOrCreateCurrentCommissionRule` materializes a snapshot
   from the live `Campaign` config at order-creation time — reusing the currently-open rule
   (`effectiveTo: null`) if its values still match, closing it out and opening a new one otherwise
   — implementing the model's own "snapshot of the rule in effect... orders reference the
   snapshot, never the live Campaign row" comment for the first time.
3. **`Product.stockQuantity` added (nullable = untracked)**, not a separate `Inventory`/warehouse
   model. No stock/inventory field existed anywhere in the schema. A single nullable `Int` on
   `Product` (physical inventory is a property of the underlying product, not of any one `Offer`
   selling it) satisfies "reserve stock, prevent overselling" with the least new surface area; a
   dedicated warehouse model can layer on top later without breaking this field, per the spec's own
   "support future warehouse expansion." The real concurrency guard is a hand-written
   `Product_stock_non_negative_check` DB CHECK constraint (Prisma can't express CHECK constraints,
   same as `Campaign_commission_mode_check`) — two concurrent `PAID` transitions racing past the
   app-level pre-check can't both succeed; Postgres rejects whichever commits second.
4. **Reservation happens at PAID, not at checkout-submission time** — matching the spec's literal
   "when Order becomes PAID, reserve stock" (§Inventory), not the more common
   reserve-at-cart-open pattern. A soft pre-check at checkout time (`OUT_OF_STOCK` if the offer is
   already known to be short) still runs to fail fast, but the authoritative atomic decrement is
   `OrdersService.markPaid`'s job, called only once `PaymentsService` has verified a real payment.
5. **`PaymentPort`/`PAYMENT_PORT`, a new abstraction mirroring `StoragePort`/`STORAGE_PORT` exactly**
   — domain code depends only on the interface, never a concrete provider. `ClickPaymentAdapter` is
   the only adapter wired today (the spec's "current implementation Click; designed so Payme/Uzum
   Nasiya can be added later without refactoring"); adding one means a new adapter class and a
   changed `PaymentsModule` binding, no `OrdersService`/`PaymentsService` changes. Click's real
   Prepare/Complete two-phase callback protocol (MD5 signature over
   `click_trans_id+service_id+SECRET+merchant_trans_id[+merchant_prepare_id]+amount+action+sign_time`)
   is implemented for real, not stubbed — this is Click's actual published merchant contract, not
   something specific to this codebase.
6. **Pay Later reuses the existing `PaymentProviderType.MANUAL` value — no new model.** The spec's
   "customer submits request, admin reviews manually, no financing automation" maps directly onto
   a `Payment` row with `provider: MANUAL`, `status: PENDING`, created via the same
   `PaymentsService.initiatePayment` path as Click (just without a `PaymentPort` call or redirect
   URL). Admin approval is the existing manual `PATCH /admin/orders/:id/status` transition
   (`PAYMENT_PENDING` → `PAID`) — no separate "Pay Later request" endpoint or table was needed.
7. **`ReferralVisit` tracking (`POST /offers/:slug/visit`) is genuinely new — this concept existed
   in the schema since Phase 1 with zero runtime code ever creating a row** (confirmed by grep;
   distinct from the unrelated 6B Enhancement creator-to-creator `CreatorReferral`/`?ref=` system
   at `/creator/register`, which already worked). A visit records `visitorId`/`sessionId`/
   `ipHash`/UTM fields and computes `expiresAt` from the `ReferralLink`'s own
   `attributionWindowDays`, exactly per the model's existing field comments. An unknown/expired
   `ref` code never blocks the page view or the checkout — it just means no attribution signal,
   consistent with "never lose attribution after payment" applying only when attribution actually
   resolved.
8. **Attribution resolution order: `promoCode` before `refCode`.** A redeemed `PromoCode` carries
   its own `creatorId`/`campaignId` directly (no join through `ReferralLink` required), making it
   the more specific signal when both are somehow present on one checkout. A `refCode` alone
   resolves attribution via `ReferralLink` + the most recent matching `ReferralVisit` (if a
   `visitorId` was supplied), linking `Attribution.referralVisitId` when found. An invalid/expired
   `refCode` — unlike an invalid/expired `promoCode` used only as a discount — **does** reject the
   checkout (`REFERRAL_CODE_INVALID`): a checkout carrying a referral code is read as "this sale
   is fundamentally about that campaign link," not an incidental reference.
9. **No automatic Campaign-level customer discount at checkout — discount comes from `PromoCode`
   redemption only.** `Campaign.customerDiscountType`/`customerDiscountValue` (6B Enhancement)
   exists but is not layered into Phase 8 checkout pricing; the existing frontend's checkout UI is
   specifically a promo-code entry box, not an automatic campaign-discount badge, and the spec's
   own "Discount" checkout field maps naturally onto that already-built UI. Layering a second,
   independent discount mechanism was out of scope for this checkpoint.
10. **`DeliveryService.resolveDeliveryFee` extracted from `quote()`**, not duplicated. Checkout
    needed the exact same region-fee lookup/validation `quote()` already performed, but `quote()`'s
    own contract (offer price + region fee, no variant/promo awareness) couldn't just be reused
    wholesale. The region-lookup logic was pulled into a new shared method both `quote()` and
    `OrdersService.createOrder` call — `quote()`'s public contract and existing e2e coverage are
    unchanged; checkout adds variant pricing and promo/discount on top of the same delivery-fee
    number, never recomputing it independently.
11. **Idempotency: replay returns the existing Order, never an error.** `Order.idempotencyKey` is
    unique; a second checkout call with the same key returns the already-created Order's current
    state rather than throwing `IDEMPOTENCY_KEY_REUSED` — the safer behavior for a customer-facing
    retry (double-click, flaky network) is "you already did this, here's what happened," not a
    confusing error. `PaymentsService.initiatePayment` is separately idempotent (reuses the
    existing `Payment` row, a stateless Click redirect URL is safely recomputable), and
    `OrdersService.markPaid`/Click-callback handling both no-op on an already-terminal Payment —
    replay-safety at every layer, not just the outermost one.
12. **Frontend: new functions/types/hooks, not renames of the legacy mock-only checkout/order
    flow.** `validatePromoCode`/`createOrder`/`getOrderPublic` (the only three mock-store functions
    with zero real branch left after 6B/7A) now dispatch on `NEXT_PUBLIC_API_MODE` exactly like
    `getOfferPublic`/`getOfferQuote` already did; `trackVisit` is new (mock mode resolves to a
    harmless stub `visitorId`, since the mock store has no `ReferralVisit` concept). Admin order
    management (`getOrderReviewList`, `updateRealOrderStatus`, `createRealOrderRefund`, etc.) is
    named distinctly from the legacy mock-only `getOrders`/`updateOrderStatus`/`createRefund` at
    the same re-export boundary, and `/orders/[id]` (creator checkout) and `/admin/orders`/
    `/admin/orders/[id]` all branch on `NEXT_PUBLIC_API_MODE` rather than being replaced outright —
    identical pattern to ADR-014's Content frontend integration.

**Why:** Same governing principle as every prior checkpoint — extend real, well-designed
infrastructure that predates this slice rather than rebuilding it (`CommissionRule`,
`ReferralLink`/`ReferralVisit`, `PromoCode`, the `PaymentProviderType.MANUAL` value), mirror
already-proven patterns for new infrastructure (`PaymentPort` mirrors `StoragePort`,
`getOrCreateCurrentCommissionRule` finally implements a comment that had waited three checkpoints
for its first caller), and keep every side effect of "a payment succeeded" — status transition,
stock reservation, referral reward — in one place (`OrdersService.markPaid`) so `PaymentsService`
stays a thin, replay-safe boundary between an external provider and this codebase's actual
business rules.
