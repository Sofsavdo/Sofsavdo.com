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

## ADR-016: Phase 9 — Wallet, Commission Settlement & Payout Domain

**Context:** `Commission`/`CommissionLedger`/`Payout`/`PayoutMethod` are the Phase 9 instance of the
same recurring situation as ADR-015's opening paragraph: fully-designed Phase 1 schema models —
`CommissionLedger`'s own comment already says "`Commission.status` is a derived read model, this
table is the source of truth" — with zero real settlement/payout service ever touching them before
this checkpoint. Same governing rule applies again: **extend these models, never supersede them.**
This phase additionally operates under a hard constraint the prior seven did not: Phase 8
(`orders.service.ts`, `payments.service.ts`, `checkout.service.ts`, and their modules/controllers)
is complete, tested, and explicitly frozen — "do not modify Phase 8 code" — so every Phase 9
decision below had to find a path that touches zero Phase 8 files.

**Decisions:**

1. **Refund-triggered commission reversal is a lazy sweep, not a cross-service hook call.** The
   natural implementation — `OrdersService.createRefund` calls
   `CommissionsService.reverseForOrder(orderId)` once an order becomes `REFUNDED` — would require
   adding that call inside `orders.service.ts`, which is off-limits. Instead,
   `CommissionsService.reconcileRefundedOrders()` runs at the top of every Commission read/mutate
   entry point (`list`, `findOneOrThrow`, `getWalletBalance`, `listMyLedger`), exactly mirroring
   `ContentService.expireStaleContent()`'s established "materialize on next read/mutate touch, no
   cron/hook infrastructure" convention from ADR-014. It queries `Commission` rows whose linked
   `Order.status = REFUNDED` but whose own status isn't yet `REFUNDED`/`PAID`, and reverses them —
   writing a `CommissionLedger` `REVERSAL` entry only if the commission had already accrued
   (`APPROVED`/`PAYABLE`). Zero edits to any Phase 8 file were needed for this feature.
2. **The `ACCRUAL` ledger entry is written at admin-approve time, not at Commission-creation
   time.** Phase 8's `OrdersService.createOrder` creates `Commission` rows at `PENDING` with no
   `CommissionLedger` entry at all (confirmed by reading the file directly). Moving accrual
   recognition to `CommissionsService.approve()` was originally forced by the "can't edit
   `orders.service.ts`" constraint, but stands independently on business-semantics grounds: a
   `PENDING` commission can still be rejected, so only an `APPROVED` commission is confirmed as
   truly earned and belongs in an append-only ledger.
3. **Wallet balance is computed on read, never stored — no new `Wallet` model.** This matches the
   codebase's dominant convention for availability-style state (`CampaignAvailability`,
   `OfferAvailability`, Content's lazy `EXPIRE`), and is directly supported by
   `CommissionLedger`'s own "this table is the source of truth" comment. Five buckets are derived
   per request: `pendingMinor` (`PENDING`+`APPROVED`), `availableMinor` (`PAYABLE` with
   `payoutId: null`), `lockedMinor` (any status with a `payoutId` whose `Payout.status` is one of
   `REQUESTED`/`APPROVED`/`PROCESSING`), `paidMinor` (`PAID`), `reversedMinor`
   (`REJECTED`+`REFUNDED`).
4. **`PayoutStatus` enum replaced outright** (`REQUESTED`/`UNDER_REVIEW`/`APPROVED`/`PROCESSING`/
   `PAID`/`REJECTED` → `REQUESTED`/`APPROVED`/`PROCESSING`/`PAID`/`REJECTED`/`CANCELLED`/`FAILED`).
   Zero real `Payout` rows existed before this phase (no service touched the model), so this is a
   rename, not a breaking change — same reasoning as ADR-015's `OrderStatus` replacement. `FAILED`
   is terminal, not retryable: a failed payout requires the creator to submit a new request, since
   this phase does not implement automatic bank/provider payouts (locked constraint) and a stale
   `PROCESSING`→`FAILED` transition should not silently reactivate.
5. **Commission-locking for a Payout request is FIFO over oldest unlocked `PAYABLE` commissions,
   made race-safe by re-checking `payoutId: null` inside the UPDATE's own WHERE clause**
   (`tx.commission.updateMany({ where: { id: { in: selected }, payoutId: null }, ... })`), not just
   in the preceding SELECT. If the updated row count doesn't match the selected count, the whole
   transaction throws `INSUFFICIENT_BALANCE`. A naive "select then update by id list" would let two
   concurrent payout requests double-lock the same commission rows; this is the standard guard
   against that class of race under Postgres read-committed semantics.
6. **`PayoutMethod.cardNumberEnc` uses AES-256-GCM (`common/crypto/encryption.util.ts`), keyed from
   `PAYOUT_ENCRYPTION_KEY` via `scryptSync`** — the only field this codebase encrypts at rest,
   matching the schema's own pre-existing comment on that column. `bankAccount`/`bankName`/
   `cardHolder` stay plain, per the same comment. The decrypted value is used only internally to
   compute a last-4 mask (`•••• 1234`); it is never serialized in any API response.
7. **Zero new RBAC permission keys.** `commission.read`/`commission.adjust` (already existed) cover
   the full settlement workflow — `commission.adjust` gates approve/reject/mark-payable, the same
   way `referral.manage` already covers multiple sub-actions in this codebase.
   `payout.read`/`payout.approve`/`payout.pay` (already existed) cover the full admin payout
   workflow: `payout.approve` gates the review decisions (approve/reject), `payout.pay` gates the
   money-movement steps (processing/paid/failed). MANAGER remains read-only; ADMIN and above hold
   the write verbs — this is exactly what `RBAC.md` already documented before this phase started.
8. **Creator-facing payout method and withdrawal endpoints are ownership-scoped via
   `RequireCreatorGuard`, not RBAC-gated** — identical pattern to Phase 7A's
   `CreatorContentController`. A creator can only ever see/act on their own rows; a mismatched
   owner returns `PAYOUT_NOT_FOUND`/`PAYOUT_METHOD_NOT_FOUND` rather than `403`, so the response
   never functions as an id-guessing oracle for other creators' financial data.

**Why:** The single hardest constraint this phase faced — "preserve Phase 8 behavior, touch zero
Phase 8 files" — is satisfied entirely through patterns this codebase had already proven
(`ContentService`'s lazy sweep, `StoragePort`-style ownership scoping, the existing RBAC matrix)
rather than through new cross-service coupling. Every new financial primitive (ledger-as-source-of-
truth, computed wallet balance, FIFO commission locking) either implements a comment the schema had
already been carrying since Phase 1, or extends an established convention rather than inventing a
new one.

## ADR-017: Phase 10 — Communication & Notification Domain

**Context:** `Notification` was a Phase 1 pre-designed-but-unbuilt model (`channel: IN_APP|
TELEGRAM`, `type`/`payload`/`readAt`, reserved-unused) — same situation as every prior phase's
starting point. This phase's spec explicitly requires an event-driven architecture ("Business
services should emit events rather than directly sending notifications. Avoid tight coupling.")
while simultaneously locking Phase 8 (Checkout/Orders/Payments) and Phase 9 (Wallet/Settlement/
Payout) as frozen. Those two requirements are in direct tension: the domains that produce the most
notification-worthy events (an order got paid, a commission became payable, a payout was
requested) are exactly the domains this phase is forbidden from editing.

**Decisions:**

1. **Two notification sources feeding one pipeline, not one uniform mechanism.** For domains this
   phase may freely edit (`CreatorApplicationsService`, `AuthService`), business methods emit real
   `EventEmitter2` events directly. For the frozen Phase 8/9 domains, a new
   `NotificationSweepService` discovers business events by reading their tables directly (read-only,
   via `PrismaService`, exactly like `CommissionsService.reconcileRefundedOrders` reads `Order`
   without `OrdersModule` ever knowing this domain exists) and calls `NotificationsService` the same
   way a real listener would. Both paths converge on the same `NotificationsService.dispatchTo*`
   methods, so "what does event X mean for notifications" is defined exactly once regardless of
   which path discovered it.
2. **Sweep idempotency is a deterministic `dedupKey` unique constraint on `Notification`, not a
   cursor.** Every dispatch from the sweep carries a key like `payout.failed:{payoutId}`; a repeat
   dispatch for the same business event collides on the unique index and is silently skipped
   (`createMany`-style skip-duplicates behavior via a caught `P2002`). This makes it safe to rescan
   the *entire* unfiltered table every interval — no "already seen" bookkeeping, no risk of missing
   an event because a cursor was set wrong — at the cost of an unbounded scan, an acceptable
   trade-off at this app's scale (same reasoning as `reconcileRefundedOrders`'s own unbounded scan).
3. **"Campaign application submitted/approved/rejected" + "Campaign joined" (creator) and "new
   creator application" (admin) map onto the existing `CampaignApplication` model, not the
   onboarding `CreatorApplication` model.** ADR-012 already drew this exact distinction for Phase
   6B ("Creator Application" in the spec's domain sense means a creator applying to a *Campaign*,
   not onboarding review) and confirmed the onboarding `CreatorApplication` review workflow has no
   real backend to this day (a `DRAFT` row is created at registration and never transitions via any
   real endpoint). Building a new onboarding approve/reject API was out of this phase's scope
   ("Communication & Notification domain," not "Creator Onboarding domain"), so these events hook
   into `CreatorApplicationsService`'s real `submit`/`approve`/`reject` methods instead.
4. **`EventEmitter2.emitAsync`, not `.emit`.** `.emit()` is fire-and-forget — it does not await
   async `@OnEvent` listeners, so a caller returning immediately after emitting can race the
   listener's own database writes. This was caught as a real bug during verification: approving a
   campaign application returned before `NotificationEventsListener`'s second `dispatchToCreator`
   call (the `campaign.joined` notification) had finished, so an immediate follow-up read
   sometimes missed it. All four emit call sites (`creator-applications.service.ts` ×3,
   `auth.service.ts` ×2) use `emitAsync` and are awaited.
5. **`NotificationSweepService`'s `@Interval(30_000)` is disabled in test environments via
   `SchedulerRegistry.deleteInterval`, called from `onApplicationBootstrap` — not a body-level
   `if (nodeEnv === "test") return` inside `sweep()` itself.** A live `setInterval` handle keeps
   Node's event loop non-empty regardless of what its callback does once it fires, and
   `moduleRef.close()` does not clear `@nestjs/schedule` timers on its own; an early version of
   this guard left an orphaned interval retrying (and, once the shared dev Postgres blipped,
   failing) a database query every 30s long after an e2e run had already finished, discovered via
   a recovered Jest log showing `Timeout._onTimeout` still firing minutes after "Test Suites: ..."
   had already printed — the actual reason a run appeared to hang for over an hour. Deleting the
   timer must happen from `onApplicationBootstrap`, not `onModuleInit`: `@nestjs/schedule`'s own
   `ScheduleExplorer` registers every `@Interval`/`@Cron` from *its* `onModuleInit`, and
   `onModuleInit` hooks across unrelated modules have no guaranteed cross-module order — the first
   attempt sometimes ran before `ScheduleExplorer`'s own and threw "No Interval was found".
   `onApplicationBootstrap` is a strictly later phase that only starts once every `onModuleInit` in
   the application has already resolved. Deleting the timer (rather than a body-level guard) is
   also what lets `notifications.e2e-spec.ts` call `sweep.sweep()` directly and get real,
   un-short-circuited behavior — a body-level guard cannot distinguish "the interval fired
   automatically" from "a test called this method directly".
6. **`NotificationChannel` gains `EMAIL` (additive); a new `NotificationPreference` model, one row
   per `(user, category)` the user has explicitly touched** — an absent row means "use the
   default" (in-app on, telegram off, email on), so no backfill migration was needed for existing
   users. Email defaults on because every email this domain sends is transactional (locked
   constraint: no marketing/bulk), so opt-out is the safe default; Telegram defaults off because it
   additionally requires a linked `User.telegramChatId` before it can ever deliver anything
   regardless of the toggle. Password-reset email bypasses preference-gating entirely — it is
   security-critical and explicitly user-initiated, not a togglable category.
7. **`TelegramPort`/`EmailPort` mirror `PaymentPort`/`StoragePort` exactly** — domain code depends
   only on the interface; `TelegramBotAdapter` implements Telegram's real Bot API via raw `fetch`
   (same "implement the provider's actual published contract directly, no SDK" precedent as
   `ClickPaymentAdapter`), `SmtpEmailAdapter` uses `nodemailer`. Neither ever fakes success: an
   unconfigured provider or a rejected send returns `{ok: false, errorMessage}`, recorded as a
   `FAILED` `Notification` for the admin failed-queue to retry — verified live in this checkpoint's
   browser pass, since this environment has no real SMTP/Telegram credentials configured.
8. **`notification.read`/`notification.manage` are genuinely new RBAC keys** — unlike every phase
   since 6B, nothing reserved these ahead of time. Same read/write split as every other two-verb
   domain in `permissions.constants.ts`; MANAGER gets `.read`, ADMIN+ gets `.manage`.
9. **Templates are centralized in one registry** (`notifications/templates/registry.ts`), one
   entry per `Notification.type` string, each rendering in-app/Telegram/email from typed variables
   — never string concatenation at the emit/sweep call site. Uzbek-only today (matching every other
   user-facing string in this codebase) but structured so a second locale is a new dictionary, not
   a rewrite of any call site.

**Why:** The governing tension — "must be event-driven" vs. "must not touch Phase 8/9" — is
resolved the same way ADR-016 resolved an identical tension for commission-reversal: a lazy
discovery mechanism (here, a scheduled sweep instead of a read-triggered one, since notification
consumers don't reliably "touch" the source domain the way a wallet-balance check does) that
funnels into the same real event-handling code a direct emit would use, so the distinction between
"real event" and "swept event" is invisible past the point of discovery.

## ADR-018: Phase 11 — Creator Onboarding & Admin Review Domain

**Context:** A pre-Phase-11 codebase/documentation audit (triggered before starting Analytics)
found that the onboarding `CreatorApplication` model — distinct from `CampaignApplication` (a
creator applying to join a specific Campaign, see ADR-012) — had never had a real service built
against it. `AuthService.register` creates a `DRAFT` row in the same write as the `CreatorProfile`
(unchanged by this phase), but no real endpoint anywhere ever moved it out of `DRAFT`, and
`RequireCreatorGuard` (gating every `/creator/*` route except `/creator/profile` and, as of this
phase, `/creator/onboarding`) requires `status === "APPROVED"`. The practical consequence: a real
user who registered through the actual app could never reach any creator-facing feature — wallet,
payouts, content, campaign applications, referrals, notifications — because there was no real way
for their application to ever become `APPROVED` outside a direct database write. This made the
gap more urgent than Analytics and became this phase's entire scope.

**Decisions:**

1. **`CreatorApplicationStatus.REVISION_REQUESTED` renamed to `CHANGES_REQUESTED`.** Matches the
   identical state name `CampaignApplicationStatus`/`ContentStatus` already use, so one vocabulary
   describes "sent back for edits" everywhere. No real row had ever carried the old value (only a
   comment referenced it outside the schema/mock), so this is a rename, not a breaking change —
   same precedent as ADR-011/012/015/016. Migration `20260727000000_creator_onboarding_domain`
   does the standard Prisma enum-swap dance (see `20260721060000_creator_application_lifecycle`
   for the identical pattern applied to `CampaignApplicationStatus`), with the `USING` clause
   mapping any stray old value defensively rather than assuming zero rows.
2. **`REJECTED` is resubmittable here, unlike `CampaignApplicationStatus`'s terminal `REJECTED`.**
   Onboarding is a single continuous account gate, not a per-campaign one-shot decision —
   permanently locking out a rejected creator would contradict the platform's basic premise that
   anyone can become a creator once they meet the bar. A creator may edit and resubmit from either
   `CHANGES_REQUESTED` or `REJECTED`; only `DRAFT`'s first-ever submission uses the separate
   `submit` action (`SUBMIT_FROM` vs. `RESUBMIT_FROM` in `onboarding.service.ts`, mirroring
   `creator-applications.service.ts`'s own explicit-per-action-allowed-states convention rather
   than one generic `transition(to)`).
3. **New module (`src/onboarding/`), new route prefixes, new RBAC keys — nothing reused from the
   adjacent `CampaignApplication` domain.** `admin/creator-applications` and the `application.*`
   permission keys already belong to `CampaignApplication` review (ADR-012); this domain uses
   `admin/creator-onboarding` and `onboarding.read/review/approve/reject/revise`. The pre-existing
   `creator.read/review/suspend/block` keys were also left untouched — they are shaped for a
   future admin *account*-moderation domain (suspend/block are `UserStatus` verbs, not application
   decisions, and were flagged as a separate, still-open gap by the pre-phase audit), not this
   admission decision. Read/review = MANAGER, approve/reject/revise = ADMIN — the same split
   `content.*` uses (MANAGER can move a submission into `UNDER_REVIEW`; only ADMIN+ decides).
4. **Creator-facing onboarding routes are not gated by `RequireCreatorGuard`.** That guard requires
   an *already-approved* application — gating the routes that exist to get a creator approved
   behind approval would make them permanently unreachable. Ownership is the `creatorId` off the
   JWT, the same pattern `/creator/profile` (`CreatorProfileController`) already established.
5. **`formData` stays an untyped `Record<string, unknown>` passthrough Json bag, validated at the
   frontend wizard, not per-field on the backend** — matching the schema's own original comment
   ("audience info, experience, payout details, etc.") and the same convention
   `CampaignApplication.answers`/`Content.metadata` already use. `UpdateOnboardingDto` only
   validates the one field this domain's own transition logic depends on (`currentStep`).
6. **Reuses the Phase 10 notification pipeline exactly** — four new event types
   (`onboarding.submitted/approved/rejected/changes_requested`) under the existing `ACCOUNT`
   category (an onboarding decision is about the creator's own account, not a per-campaign
   concern), plus one admin-facing `onboarding.new` alert under `ADMIN_ALERTS`, all emitted via
   `emitAsync` (never `.emit`, per ADR-017's decision 4) and handled by
   `NotificationEventsListener` exactly like `CreatorApplicationsService`'s existing events. No
   changes to `NotificationsService`, `NotificationSweepService`, or any delivery adapter.
7. **The two dormant `CreatorReferral` timestamps designed back in the 6B Enhancement checkpoint —
   `onboardingCompletedAt` and `creatorApprovedAt` — are wired up via two new
   `ReferralsService` hooks** (`onOnboardingSubmitted`, `onCreatorApproved`), mirroring
   `onCampaignApplicationSubmitted`/`onCampaignApplicationApproved` exactly. Neither maps to a
   `ReferralMilestoneType` (no reward type represents "was approved as a creator"), so unlike
   `onCampaignApplicationApproved` there is no rule-matching/reward-creation step — these are
   informational timestamps for `classifyActivity` only.
8. **A new `AuditService.listForEntity(entityType, entityId)` method**, added because this phase's
   explicit "reviewer audit trail" requirement needs a real read path against the pre-existing,
   previously write-only `AuditLog` model. Deliberately scoped to one entity's history, not a
   general admin-facing audit-log browser — the pre-phase audit flagged a general audit-log reader
   as a separate, still-open gap, out of scope here. Every admin decision
   (`start-review`/`approve`/`reject`/`request-changes`) now calls `AuditService.record`, which
   `creator-applications.service.ts`'s equivalent actions never did.
9. **Frontend: completed rather than rebuilt.** The entire creator-facing onboarding UI
   (`OnboardingPageClient`, `OnboardingWizard`, `CreatorAppGuard`, `lib/routing.ts`) already
   existed as a mock-only, localStorage-backed flow with a real design already in place; this phase
   wired it to the real backend (new `updateOnboardingApplication`/`submitOnboardingApplication`/
   `resubmitOnboardingApplication` in `creator-real.ts`) rather than redesigning it, and completed
   one previously-broken promise: the old `REJECTED` screen's copy claimed a creator could
   resubmit after addressing the reason, but rendered no wizard to do so — `OnboardingPageClient`
   now renders the same editable wizard for `DRAFT`/`CHANGES_REQUESTED`/`REJECTED` alike, threading
   a `mode: "submit" | "resubmit"` prop so the real backend's two distinct transitions are called
   correctly. The admin review queue (`admin/creator-applications`) already existed as a mock-only
   page too (`useAdminCreators` + approve/reject/revision mutations); this phase added a
   `Real`/`Mock` branch (matching every other admin domain's convention) plus a new detail page
   (`admin/creator-applications/[id]`) for the formData view and reviewer audit trail the queue
   view alone can't show.

**Explicitly out of scope (per this phase's own instructions and the pre-phase audit's findings):**
Analytics; admin Users/Roles CRUD, Settings, general audit-log browsing, admin Creator
account/Payments/Refunds management (the "Admin Operations" cluster the audit separately
identified); email verification; Payme/Uzum Nasiya payment adapters. None of these were touched.

## ADR-019: Phase 12 — Admin Operations Domain

**Context:** Phase 11's own explicit exclusions list named exactly this cluster as future work:
admin Users/Roles CRUD, Settings, general audit-log browsing, and admin Creator
account/Payments/Refunds management. Until this phase, the platform operator had no real way to
do any of these seven things through the app itself — every one of those admin pages was still
`mocks/store.ts`-backed, even though the real backend had accumulated several fitting-but-unused
RBAC keys and a write-only `AuditLog` model anticipating exactly this. The goal was operational
completeness — reusing existing services/schema/RBAC/audit conventions throughout, not designing
anything new.

**Decisions:**

1. **Only two of the seven subsystems needed genuinely new RBAC keys.** `role.read`/`role.manage`
   (Roles & Permissions CRUD) and `refund.read`/`refund.manage` (Refund review decisions) had no
   prior reserved key. The other five (Users, Creators, Payments, Settings, Audit) all reused keys
   the Phase 6 spec had already reserved-but-left-unused in anticipation of this exact cluster —
   see RBAC.md's Phase 12 note for the full per-domain mapping, including the one repurposing
   worth flagging: `creator.review` now gates the admin creator *account detail* view (stats,
   campaign history, earnings/payout/referral summaries), distinct from `onboarding.review` (the
   CreatorApplication admission queue, ADR-018) — the two were never the same thing, but
   `creator.review` had sat unused until this phase gave it a real route to gate.
2. **`UserStatus.BLOCKED` added as a new enum value, distinct from the existing `SUSPENDED`.**
   Both staff and creator accounts share the one `User`/`UserStatus` model. Staff activate/
   deactivate reuses `ACTIVE`/`SUSPENDED` (already meaningful for staff). Creators needed a second,
   more severe state — the pre-existing RBAC split (`creator.suspend` at ADMIN, `creator.block` at
   SUPER_ADMIN, both reserved since an earlier phase but never wired to any real transition) only
   makes sense if suspend and block are genuinely different severities, not two names for the same
   state. `AuthService.login` now throws a distinct, more severe-reading message for `BLOCKED` than
   for `SUSPENDED`. Both are soft states — this phase never adds a way to hard-delete a `User` row
   for either staff or creators, satisfying "never delete staff accounts / never delete creators"
   structurally rather than by convention alone.
3. **No DELETE-role endpoint exists at all.** "Prevent removal of critical system roles" is
   satisfied by never building the one operation that could remove any role, critical or not —
   simpler and more permanent than runtime protection logic would have been, and nothing in the
   phase spec actually required deleting a role as a feature. A narrower, separately-justified
   runtime guard still exists: `RolesService.removePermission` throws `CANNOT_MODIFY_SYSTEM_ROLE`
   specifically when asked to strip `role.manage` or `user.manage` from the seeded `super_admin`
   role — the one scenario that could produce total operator lockout with no other permission-key
   path back in, distinct from the "no delete route" structural protection.
4. **Refund approve/reject is a review-decision layer on top of the `Refund` row, not a rebuild of
   payment/order logic.** `OrdersService.createRefund` (Phase 8, frozen) already performs the real
   financial action — stock release and an `Order` status flip to `REFUNDED` — synchronously at
   refund-*request*-creation time for a full refund, and never itself transitions `Refund.status`
   away from `REQUESTED`. This phase adds `reviewedById`/`reviewedAt`/`rejectionReason` to `Refund`
   and two new endpoints (`approve`/`reject`, gated `refund.manage`) that move `Refund.status`
   `REQUESTED → APPROVED | REJECTED` and audit the decision — but deliberately do **not**
   re-trigger, reverse, or otherwise touch the order-level action `createRefund` already performed.
   A concrete consequence worth stating plainly: rejecting a `Refund` whose underlying full-refund
   order action already completed does not and cannot undo that order-level effect — the review
   decision here is an administrative record of whether the refund *should have* been granted, not
   a control that gates whether the money movement happens. Reusing rather than rewriting the
   payment architecture was an explicit instruction; this is the design that honors it.
5. **Settings management is real persistence with a stated, explicit limitation.** The pre-existing
   `Setting` model (key/value rows) had never had a service built against it. This phase adds a
   14-key catalog (`settings.catalog.ts`) across the seven requested categories (General,
   Commission, Creator defaults, Notification defaults, Payment configuration, Feature flags,
   Validation rules), a lazy-default merge (`getAll()` returns the catalog default for any key with
   no stored row yet — no backfill needed), type-checked writes (`validateValue()`,
   `INVALID_SETTING_VALUE` on mismatch), and one audited `SETTINGS_UPDATED` record per save
   containing the full before/after map. **These values are stored and audited but not yet wired
   into any other domain's runtime behavior** — e.g. `commission.payoutMinimumMinor` does not
   actually change what `WalletService` enforces yet. This is an honest scope boundary, not an
   oversight: wiring each setting into its owning domain would mean touching Commission/Wallet/
   Notification/Payment/Validation logic that Phase 12's own charter said not to redesign. The
   catalog and audit trail this phase built are exactly what a future "make settings live" pass
   would read from.
6. **The general audit-log browser is a new read path on the same write-only `AuditLog` model
   Phase 11 already used for its narrower `listForEntity` reader.** `AuditService.list()` adds
   pagination plus entityType/actorId/action/date-range/search filtering; `findOneOrThrow()` adds a
   single-entry detail read. Both are additive methods on the existing `@Global()` `AuditService` —
   no new audit-writing path, no schema change, and (per the spec's own explicit instruction) no
   mutation route of any kind sits behind `audit.read`.
7. **A real, pre-existing frontend gap — not introduced by this phase but newly exposed by it — was
   fixed:** `admin-real.ts`'s `mapRoleKeysToAdminRole()` mapped a staff account's role keys to the
   coarse 3-tier `AdminRole` (`MANAGER`/`ADMIN`/`SUPER_ADMIN`) used only for frontend nav/section
   visibility (`RoleGuard`), and hard-threw `FORBIDDEN` for any role key outside that fixed set of
   three. Before this phase, every staff account really did carry one of exactly those three seeded
   role keys, so the gap was latent. Phase 12's own Roles CRUD makes it possible to create and
   assign a genuinely custom role for the first time — assigning a staff account *only* such a role
   would have locked them out of the admin panel entirely, even though the real authorization
   boundary (backend `RequirePermissions`) would have happily authorized whatever that custom
   role's permissions actually granted. Fixed by defaulting to the lowest tier (`MANAGER`) whenever
   a staff account has at least one role but none of the three recognized keys, rather than
   throwing; `FORBIDDEN` is now reserved for the genuine zero-roles case. This does not change
   backend authorization at all — `RoleGuard`'s own code comment already documents that it was
   never the real authorization boundary — it only fixes which coarse-grained nav a custom-role
   staff member sees.
8. **Never delete, always soft-transition — verified structurally, not just by convention.** Staff:
   activate/deactivate only, no delete route. Creators: suspend/unsuspend/block/unblock only, no
   delete route. Both enforced by simply not building the missing endpoint, matching this phase's
   explicit instruction and this project's established precedent (ADR-011/012 use the same
   "structural absence" pattern for other "never allow X" requirements).

**Explicitly out of scope (per this phase's own instructions):** Analytics, Dashboards, Charts,
Reporting; email verification; additional payment providers; the Affiliate Attribution Engine;
marketing broadcasts; performance optimization unrelated to this phase; UI redesign of any existing
page. No new notification triggers were added — none of the seven subsystems had an "already
appropriate" hook that Phase 10's existing event set didn't already cover.

## ADR-020: Phase 13 — Analytics & Business Intelligence Domain (v1)

**Context:** Phase 12's own exclusions list named Analytics as the one deliberately-deferred
cluster. A design-only pass (ANALYTICS.md) preceded implementation per explicit instruction —
studying the full schema, every relevant service, and the existing mock Analytics/Dashboard pages
before proposing anything — and surfaced concrete gaps rather than assuming a clean slate: no
`createdAt` index existed on `Order`/`Payment`/`Refund`/`Commission` despite this domain being
entirely date-range queries; `ReferralVisit` only records referred traffic (confirmed by reading
`CheckoutService.trackVisit()`'s early return), so no real "views" or site-wide conversion signal
exists; and no CSV/Excel/PDF export capability existed anywhere in the backend. The design was
reviewed and returned with binding business-definition decisions and an explicit v1/deferred split,
recorded here as what was actually built against those decisions.

**Decisions:**

1. **Business definitions are the approved ones, not this phase's own invention** — GMV includes
   `REFUNDED` orders (a refund doesn't erase that a sale happened), Revenue excludes them, Net
   Revenue subtracts decided refund amounts, Paid Orders mirrors GMV's status set, Active Creator
   means "attributed at least one order in the selected period" (not a static campaign-membership
   snapshot, so it's period-comparable), Active Product means "ACTIVE status and has ≥1 ACTIVE
   offer" (not merely cataloged), and Conversion is labeled **"Creator link konversiyasi"**,
   explicitly not a platform-wide conversion rate — it measures attributed paid orders against
   `ReferralVisit` count, which by construction only covers referred traffic. Every one of these is
   implemented exactly as approved; see `executive-analytics.service.ts`'s own inline comments for
   the arithmetic.
2. **AOV divides by GMV, not Revenue** — a judgment call made explicit rather than silently decided:
   since Paid Orders (the denominator) already counts `REFUNDED` orders, pairing it with Revenue
   (which excludes their value) would understate AOV in any period with refunds. GMV/PaidOrders is
   the internally consistent pairing.
3. **Snapshot metrics (Active Campaigns, Active Products) are never given a `previous` value or a
   `deltaPct`, in any compare mode.** There is no state-history table to reconstruct "as of a past
   date" from — fabricating a historical comparison from data that doesn't exist would be a worse
   error than omitting it. `ExecutiveAnalyticsService.computeForRange`'s `includeSnapshots` flag is
   `false` for the `previous` computation specifically so this isn't a runtime accident.
4. **Only two raw SQL queries exist in this entire domain, both justified by the same structural
   reason.** Every single-table aggregate (Order by status/offerId/campaignId, Commission by
   creator+status, Payout by creator+status, CampaignApplication by creator+status, Refund by
   orderId/status, Payment by provider/status, ReferralVisit by creator/campaign) uses Prisma's
   native `groupBy` — real DB-side aggregation, never fetch-then-reduce in JavaScript. The one thing
   Prisma's ORM-level `groupBy` structurally cannot express is grouping by a column that lives on a
   *different* table than the one being aggregated: creator attribution lives on `Attribution`,
   order value lives on `Order`. `creatorRevenueBreakdown` (used by Creator Analytics' list/detail
   and Campaign Analytics' top-creators) and `dailyOrderTrend`/`refundBreakdownByOffer` (date-bucket
   and per-offer-refund grouping, same cross-table reasoning) are the only raw `$queryRaw` calls in
   the codebase outside the pre-existing health check — both parameterized via `Prisma.sql`/
   `Prisma.join`, never string-concatenated, and both documented in `lib/analytics-sql.util.ts` as
   deliberately narrow exceptions, not a general pattern to reach for.
5. **New/returning customer classification uses a bounded two-query pattern, not a full-table
   scan.** `computeNewReturningCustomers` first finds which customers ordered *in the period*
   (bounded by period order volume), then — scoped only to that customer-id list — finds each one's
   all-time first-order date and total order count. This avoids both N+1 (one query per customer)
   and the more expensive alternative of aggregating every customer who has ever ordered, at the
   cost of one extra bounded query. The same pattern is reused by `CustomerAnalyticsService`.
6. **Redis is a genuinely new consumer, not new infrastructure.** `AnalyticsCacheService` is the
   first real cache usage in this codebase (every prior use was the health check's own throwaway
   ping). Every read/write is wrapped so a Redis failure — unreachable, timeout, malformed cached
   JSON — always falls through to a live recompute rather than failing the request; this is not a
   defensive afterthought, it is the entire point of "best-effort," and is covered by dedicated unit
   tests that stub the underlying client to fail in each of those ways.
7. **The four new indexes are the first migration of this phase, reviewed as its own change** —
   `@@index([createdAt])` on `Order`/`Payment`/`Commission`/`Refund`, purely additive, no data
   change. Every other table these queries touch already had a fitting index from earlier phases.
8. **CSV export reuses the exact sub-service each on-screen view already calls** — an export is
   never a second, differently-computed code path from what's rendered on screen, the same
   principle Phase 8 established for payment logic. Every export call is audited via the existing,
   unmodified `AuditService.record()` (`entityType: "AnalyticsExport"`, `entityId` = the view name),
   answerable from the Phase 12 Audit Log viewer with zero changes to that viewer.
9. **The Executive Dashboard replaces its own Phase 5 mock page entirely** (`/admin/analytics`), no
   `Mock`/`Real` branch — the same precedent Phases 10–12 established for domains whose real backend
   now fully exists. `/admin/dashboard` (the separate admin home page, with its own unrelated
   pending-tasks widget sourced from other domains) was deliberately **left untouched** — rewiring
   its tasks widget would mean touching Campaign Application/Content/Payout aggregation outside this
   phase's named scope, not an oversight.
10. **Global filters were implemented at the API level for every dimension (Date, Creator, Campaign,
    Product, Payment Method, Region, Status) but given UI controls only where they were highest-
    value for v1** — the shared date-range/comparison-mode bar on every page, plus a status filter
    on Payment and Refund Analytics specifically (the two views where narrowing by status is the
    primary investigative action). The remaining entity-filter dropdowns (creator/campaign/product/
    region selects on every page) are a real, acknowledged UI gap, not a hidden one — the backend
    already accepts and correctly applies every one of them (proven by e2e tests passing with
    `campaignId`/`creatorId` filters applied), so adding the remaining dropdowns is a frontend-only
    follow-up, not new backend work.

**Deferred (approved scope, not implemented, tracked here so they aren't rediscovered as
surprises):** `AnalyticsDaily{Platform,Creator,Campaign,Product}Stats` rollup tables and the nightly
`@Cron` job that would populate them (§4 Tier 2 of ANALYTICS.md) — live aggregation is correct and
fast enough at current data volume; Excel and PDF export (`AnalyticsExportQueryDto.format` accepts
only `"csv"` today — widening it is the only change needed later, not a rewrite); organic/direct
traffic tracking (no `AnalyticsEvent`-equivalent table exists — "Creator link konversiyasi" and
"clicks" remain explicitly scoped to referred traffic only); refund-reason taxonomy normalization
(`Refund.reason` stays free text, grouped as-is by raw string).

**Explicitly out of scope, unchanged by this phase:** all Order/Payment/Refund/Commission/Payout/
Campaign/Attribution/Referral/Onboarding/Notification/Settings business logic — this domain reads,
it never writes to any of those tables (its one write, the export audit record, goes through the
existing `AuditService`).

## ADR-021: Phase 14 — Production Hardening & Launch Readiness

**Context:** Phases 1–13 built a functionally complete platform; this phase's explicit mandate was
"make it safe, observable, recoverable, deployable, and ready for real users and real money" — not
new product features. A full audit preceded changes (env/secrets, main.ts, auth, Click integration,
financial state machines, health checks, logging, CI/CD, frontend error handling) per explicit
instruction, surfacing real, confirmed defects rather than assumed ones. Every decision below is a
fix for something the audit actually found, or an explicit, honest deferral — not speculative
hardening.

**Decisions:**

1. **The TOCTOU race-condition fix is one pattern, applied everywhere the same shape existed, not
   invented per-service.** `CommissionsService.lockPayableCommissions` already used the correct
   pattern (guarded `updateMany({where:{id,status:{in:FROM_STATES}}})` + affected-row-count check
   before any side effect) — the audit found the *same* read-then-check-then-plain-`update()` bug
   in `CommissionsService.approve/reject/markPayable` and every `PayoutsService`/
   `AdminRefundsService` status-transition method, and replicated the already-correct pattern rather
   than designing a new one. This is a concurrency-safety fix only — no RBAC/business-permission
   logic changed anywhere in this pass, honoring the constraint "do not change business permissions
   unless a real security defect is found."
2. **Click callback atomicity fix moved responsibility, it didn't add a transaction where none
   existed.** `PaymentsService.handleClickCallback` used to write `Payment.status` directly, then
   separately call `OrdersService.markPaid`/`markPaymentFailed` (which already wrapped Order+Payment
   in its own `$transaction`) — two separate writes with a real crash window between them. The fix
   deletes the standalone Payment write entirely and lets `markPaid`/`markPaymentFailed` own both
   writes atomically, since that transaction already existed and was already correct.
3. **Health readiness was redesigned away from `@nestjs/terminus`'s `HealthCheckService.check()`
   because its all-or-nothing aggregation directly contradicted this phase's own explicit
   requirement** ("Redis failure must degrade performance, not take down core transactional
   flows") — Terminus fails the whole check the moment *any* indicator is down, Redis included.
   `/health/ready` now hand-rolls the DB/Redis checks so only Postgres gates the 503; `/health/status`
   is the new deep-diagnostic endpoint (disk, scheduled-job heartbeat, Click/notification config
   presence as booleans only — never secret values). `@nestjs/terminus` is no longer imported
   anywhere in the codebase as a result, though the dependency itself was left installed (removing
   unused dependencies wasn't this phase's task).
4. **`ERROR_REPORTING_WEBHOOK_URL` is a generic webhook POST, not a Sentry SDK integration** — the
   codebase already had a `SENTRY_DSN` variable reserved since Phase 1 but never read by anything.
   Rather than adopt the Sentry SDK as a new dependency (a heavier commitment than this phase's
   scope), the error-reporting hook follows this codebase's own established pattern
   (`TelegramBotAdapter`, `ClickPaymentAdapter`: implement the provider's actual protocol directly,
   no SDK) — a plain `fetch()` POST to any webhook-shaped endpoint. `SENTRY_DSN`/`POSTHOG_*` remain
   reserved-but-unread, same as `PAYME_MERCHANT_ID`/`UZUM_NASIYA_MERCHANT_ID`.
5. **`bootstrap-admin.ts` exists because the seed.ts production guard created a real gap, not
   because a bootstrap script was independently planned.** Blocking `seed.ts` from running in
   production (it shares one publicly-known password across every account it creates) left a fresh
   production database with an empty Role/Permission catalog and no way to create the first admin
   — every staff-creation path in the app itself requires an existing `user.manage` permission, a
   chicken-and-egg problem. `seedRolesAndPermissions` was extracted from `seed.ts` into
   `prisma/lib/seed-roles-permissions.ts` so both scripts share one definition instead of two
   copies drifting apart; `bootstrap-admin.ts` seeds that catalog (idempotent) plus exactly one real
   super_admin account, refusing a second one without an explicit override flag.
6. **The `rbac.e2e-spec.ts`/`roles.e2e-spec.ts` fix is a Phase 12 gap, surfaced by this phase's own
   "run the full regression" task, not a Phase 14 regression.** Both suites build a minimal
   `Test.createTestingModule` (`ConfigModule`, `PrismaModule`, `RolesModule` only) that predates
   Phase 12 giving `RolesService` an `AuditService` constructor dependency — every run of the full
   e2e suite has silently failed these two files (module compile error cascading into an `afterAll`
   `TypeError`) since Phase 12 shipped. Fixed by adding `AuditModule` (already `@Global()`, only
   needs `PrismaService`) to both suites' imports.
7. **The Phase 14 load test earned its place by finding two real bugs, not by producing a clean
   report.** `HealthController` and `ClickCallbackController` both silently inherited the global
   120-req/60s-per-IP `ThrottlerGuard` default despite existing code comments already stating
   neither should ever be throttled — confirmed live (2317/2317 health-check requests rate-limited
   before `@SkipThrottle()`, 0/2317 after). The Click one is the more serious of the two: a real
   payment confirmation callback could have been silently dropped under load, exactly the kind of
   defect this phase exists to find.
8. **CI/CD gates on the same quality checks a human would run, and only ever deploys to production
   on an explicit manual trigger** (`workflow_dispatch`, never on push) — per this phase's own
   explicit instruction not to automate that step away. `deploy.yml`'s `verify` job polls
   `/health/ready` post-deploy specifically so "the deploy command exited 0" and "the service is
   actually serving traffic" are never conflated into the same success signal.
9. **Docker images were built and reviewed but never build-verified, and this is reported as an
   open blocker, not silently assumed fine.** This development sandbox has no working Docker
   virtualization backend — confirmed (the engine never comes up, `docker build`/`docker info` fail
   with a pipe-connection error), not inferred. Both Dockerfiles were checked line-by-line against
   this repo's actual npm-workspaces `node_modules` layout and the real `next.config.ts`
   `output:"standalone"` build path, but "carefully reviewed" is not the same claim as "verified by
   a real build" — PRODUCTION_READINESS.md lists this as the first launch blocker rather than
   letting it pass as done.
10. **The analytics entity-filter dropdowns use a text input for region, not a `<select>`, and this
    is a deliberate fit to the data model, not a shortcut.** Creator/Campaign/Product all have real,
    fixed, ID-backed entities with list endpoints already built (Phase 12) — real `<select>`
    dropdowns backed by `useRealCreatorList`/`useAdminCampaigns`/`useAdminProducts`. Region has no
    equivalent: `Order.address.region` is free text a customer typed at checkout, matched
    server-side with a case-insensitive `contains` specifically to tolerate that — a hardcoded
    dropdown of "standard" region names would risk silently matching nothing against real messy
    address data. `getCampaigns()`/`getProducts()` were also changed to request `pageSize=100`
    (the backend's actual max) instead of the previous implicit default of 20, since a filter
    dropdown needs the effectively-whole catalog, not its first page.
11. **The legal audit built placeholder policy pages but did not wire consent checkboxes into
    checkout/registration forms** — turning three words of existing-but-dead footer text
    ("Shartlar · Maxfiylik · Qaytarish siyosati") into real links is completing already-referenced
    UI, not a new feature; adding a required consent checkbox is a product/legal decision with real
    weight (does this jurisdiction require explicit opt-in, what does it block) that shouldn't be
    decided silently inside a documentation pass. LEGAL.md documents the exact gap and location for
    a deliberate follow-up decision.

**Deferred (confirmed real gaps, explicitly not built this phase, tracked so they aren't
rediscovered as surprises):** creator-facing PII masking on `/creator/sales` — the page and its
`Sale` type already design for masking (`customerMasked`) but the endpoint is still Phase-1 mock
data, no real backend exists; a cloud storage adapter (S3/R2/GCS) to replace `LocalDiskStorage`
before real launch; per-account brute-force lockout (per-IP throttling is a partial mitigation
only); data retention/deletion policy for any table.

**Explicitly out of scope, unchanged by this phase:** the Affiliate Attribution Engine and its
fraud-detection flags (self-referral/shared-IP/high-velocity), creator catalog, business
self-service onboarding, Excel/PDF export, analytics rollup tables, mobile apps, Payme/Uzum Nasiya
integration, major UI redesign, multilingual expansion — per the phase's own explicit exclusion
list. `attribution.override` remains a defined-but-unimplemented permission in the RBAC catalog,
same as before this phase.
