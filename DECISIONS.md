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

## ADR-022: Sofsavdo Pivot Phase C — Premium Commerce Home

**Context:** The Sofsavdo pivot (see PROJECT_STATUS.md's Phase A/B entries) expands the product
from a closed, single-offer-per-link platform into one with a real public homepage. This ADR
records the one rule change that actually required deciding something — `docs/PROHIBITED.md`'s
"marketplace homepage" line, which this phase deliberately narrows rather than deletes.

**Decisions:**

1. **A curated, server-capped "featured products" section is now allowed on the homepage; a full
   public catalog is still not.** `docs/PROHIBITED.md`'s blanket "a marketplace homepage" line is
   replaced with a narrower rule naming the actual guardrail: `OffersService.listFeaturedPublic`
   always queries with a fixed `FEATURED_OFFERS_LIMIT` (8), never a caller-supplied page size —
   the same "hard cap, not a policy the client could override" pattern already used for other
   public-safe projections in this codebase. The "no public catalog / no category navigation" and
   "no public search" lines are untouched; those get revisited explicitly in Phase E when
   `/catalog` actually lands, not silently loosened here as a side effect.
2. **`Offer.isFeatured` is an editorial flag, deliberately independent of the `status` transition
   matrix** (`activate`/`pause`/`archive`) — an admin can mark an offer featured before it goes
   ACTIVE, exactly mirroring the existing "stored status vs. computed availability are different
   concepts" split `OffersService.computeAvailability` already established for expiry. The public
   read side (`listFeaturedPublic`) is what actually enforces "must also be live right now"
   (`status: "ACTIVE"` plus the same startsAt/expiresAt bounds `computeAvailability` uses), not the
   write side. Toggled via two new admin endpoints (`POST /admin/offers/:id/feature|unfeature`)
   reusing the existing `offer.write` permission — same precedent already documented for
   `isIndexable` (an existing admin-editable entity gaining a field, not a new permission-worthy
   domain).
3. **The new homepage (`apps/web/app/page.tsx`) is a genuine Server Component, not a client-fetched
   dashboard** — `getFeaturedOffers()` runs at request time on the server, with `revalidate = 60`
   (safe: this page reads no cookie and no per-visitor state, unlike `/o/[offerSlug]`'s
   `force-dynamic` for its per-request `?ref=` attribution). This is the first public page in the
   app built this way; Creator/Admin stay fully client-rendered dashboards by design, unchanged.
4. **A pre-existing, repo-wide dead CSS class was found and NOT fixed here.** `max-w-page` is used
   throughout `apps/web` (checkout, offer landing sections, the old homepage) but resolves to
   nothing under Tailwind v4 — no `--width-page`/`--container-page` theme variable was ever
   registered, so every element using it renders at its content's natural width with no cap. The
   new homepage components use real Tailwind v4 scale classes (`max-w-7xl`, `max-w-3xl`) instead of
   perpetuating the broken one. Fixing the existing occurrences repo-wide is flagged as a separate,
   unrelated task (spawned as its own suggestion) rather than folded into this phase's diff.

**Deferred to later phases of the same plan, not built here:** `/catalog` and its real pagination
(Phase E); Buyer Accounts (Phase D); the payment-provider registry (Phase F). The homepage's
"Katalog" nav link is intentionally absent until `/catalog` exists — nothing on this page links
anywhere except real, already-live routes (`/o/[slug]`, `/creator/register`, `/creator/login`, the
three existing `/legal/*` pages).

## ADR-023: Seller Architecture — Extension Points Documented, Not Built

**Context:** Sofsavdo is currently a single-seller platform (Product/Offer belong to "the platform,"
not to any merchant). A future need for trusted, manually-onboarded third-party sellers was raised
as a strategic question: build the Seller data model/guards now (hidden, unused) so a future
addition is fast, or defer entirely. Chosen: **defer the code, document the shape now.** Building
schema and guards for a business relationship (contracts, deposits, manual verification) that
hasn't happened yet risks encoding wrong guesses about requirements nobody has validated —
directly working against the "correct for 5-10 years" goal rather than serving it. The mirror-image
mistake (ignoring it entirely, writing nothing) risks a rushed, undocumented scramble when a real
seller relationship does arrive. This ADR is the middle path: capture the exact extension points
now, in enough detail that adding them later is a fast, well-understood change, without adding any
code, model, or migration that has no caller today.

**Decisions:**

1. **Access model is confirmed and requires no new architecture to support**: sellers are
   onboarded entirely offline (business contacts Sofsavdo, manual review, contract, deposit,
   verification), then an admin manually creates the account — no public registration, no
   onboarding wizard, no visible seller-facing marketing pages. This is not a new pattern to
   invent: it already exists in this codebase as `apps/api/prisma/bootstrap-admin.ts`'s
   admin-creates-user flow. When Seller is built, its account creation is a variant of that same
   script/admin-action, not new infrastructure.
2. **`Product.sellerId String?`** (nullable FK to a future `Seller` model) is the extension point
   on the product side — nullable so every existing Product (owned by the platform itself) needs
   no backfill or default value the day this lands. `Offer`/`Campaign` do not need their own
   `sellerId` — they already derive ownership transitively via `Offer.productId → Product`, the
   same way they derive everything else about a product today.
3. **`RequireSellerGuard`** would mirror `RequireCreatorGuard` (`apps/api/src/common/guards/
   require-creator.guard.ts`) exactly: ownership-scoped by checking a `sellerId` claim on the JWT
   (added to `AuthenticatedUser` alongside the existing `creatorId`), not gated through the staff
   `RolePermission` RBAC table — sellers are a fourth principal type, structurally parallel to
   Creator, not a variant of Admin/staff.
4. **Payout/commission-cut logic is the genuinely unresolved part, deliberately left unresolved
   here.** Whether Sofsavdo takes a platform cut from seller sales (and how — flat fee, percentage,
   tiered) is a real business-model decision with no default that can be safely assumed today; this
   ADR explicitly does *not* guess at it. When a real seller relationship exists, this is the first
   thing to design for real, informed by that relationship's actual contract terms — not before.
5. **Unified product creation (manual + AI-assisted) already accounts for this by construction**,
   not as a separate decision: the AI Product Creation Engine (see PROJECT_STATUS.md's architecture
   review entry) is being built as a principal-agnostic service from day one specifically so a
   future Seller Panel becomes a new caller of the same engine, never a parallel implementation —
   see that entry for the `ProductAiPort`/`ProductAiService` design.

**Not built as part of this ADR:** no `Seller` model, no migration, no guard code, no
`AuthenticatedUser.sellerId` field. This ADR is purely the documented shape for a fast, low-risk
addition later — revisit only when a real seller relationship exists to design against.

## ADR-024: Buyer Accounts — Customer Reconciliation and No Separate RequireBuyerGuard

**Context:** Phase D adds real Buyer accounts (register/login/orders/saved products/addresses)
alongside the existing guest-checkout flow, which has never required an account. Two decisions
here diverge from the originally-approved plan's literal wording, both discovered while
implementing rather than assumed upfront — recorded honestly rather than silently changed.

**Decisions:**

1. **Customer/Buyer reconciliation, exactly as originally planned**: `Customer.userId String?
   @unique` (nullable FK to `User`) — `Customer` stays the single "who actually received this
   order" record for every order, guest or authenticated, mirroring how `CreatorProfile` never
   duplicates order-relevant data. Two write paths set it, both merge-not-duplicate: (a)
   `AuthService.registerBuyer` looks up an existing guest `Customer` row by phone at registration
   time and links it if found (covers "guest ordered first, registered later"); (b)
   `OrdersService.upsertCustomer`, given an authenticated buyer's `userId` (see #2), looks up by
   `userId` first, falling back to a phone-match-and-link for a guest row, before ever creating a
   new row (covers "registered first, then checks out under a different phone than expected"). A
   `Customer` row is never duplicated once linked — this is the one invariant both paths share.
2. **`@OptionalAuth()`, a new capability not in the original plan**, was required to make (1)'s
   checkout-time path actually work: the checkout endpoint (`POST /offers/:slug/checkout`) had to
   distinguish "no token, true guest" from "valid token, logged-in buyer" without rejecting the
   guest case, which neither `@Public()` (never runs the JWT strategy — `req.user` is always
   undefined, even with a valid token) nor the default guarded behavior (rejects a missing token)
   could do. Added as `JwtAuthGuard.handleRequest`'s one new branch — the standard NestJS/Passport
   pattern for optional authentication — rather than a parallel guard class, since every other
   route's behavior is completely unchanged.
3. **No `RequireBuyerGuard` was built, despite the original plan naming one.** Investigating
   `RequireCreatorGuard` (the pattern it was meant to mirror) surfaced why it exists: Creator has a
   genuinely separate `CreatorProfile` entity with its own id and an approval gate
   (`CreatorApplication.status === "APPROVED"`) that must be checked on every request. Buyer has
   neither: there is no separate `BuyerProfile` model (a `User` row already *is* the entire buyer
   "profile" — see #4), and there is no approval gate (every authenticated user can act as a buyer
   immediately). A `RequireBuyerGuard` under this design would only ever check "is there a valid
   `req.user`" — exactly what the global `JwtAuthGuard` already guarantees on every non-`@Public()`
   route. Building a guard whose entire body duplicates a check the framework already performs
   would be exactly the kind of unnecessary abstraction this project's own conventions warn
   against. Buyer-scoped controllers (`GET /buyer/orders`, `SavedProduct`/`BuyerAddress` CRUD)
   instead just use the default global guard plus row-level `WHERE userId = req.user.userId`
   filtering in each service — the real ownership check, done where it actually has data to check
   against, not gestured at in a guard with nothing left to verify.
4. **No `BuyerProfile` model** — confirmed deliberate, not an oversight. `SavedProduct.userId` and
   `BuyerAddress.userId` both reference `User.id` directly. If a genuine buyer-specific field ever
   needs to exist that doesn't belong on `User` (e.g., a buyer-specific preference set), that is
   the trigger to introduce one — not before, per this project's own "don't build for hypothetical
   future requirements" convention.

## ADR-025: Product/Offer Catalog (Phase E)

**Context:** `/catalog` is the last piece of the original "no public browsing" rule to be
deliberately relaxed — Phase C already allowed a small curated homepage section, Phase D already
allowed a buyer to see their own saved/purchased items. This ADR records the catalog's own scope
boundary and one retroactive correction this pass surfaced: `docs/PROHIBITED.md`'s "customer
account/dashboard that lists multiple purchasable things" line was already superseded by Phase D's
Saved Products feature and should have been updated then, not left stale until this pass found it.

**Decisions:**

1. **`GET /offers/catalog` is real pagination with a server-enforced page-size ceiling
   (`CATALOG_MAX_PAGE_SIZE = 48`), independent of and stricter than `PaginationQueryDto`'s generic
   100-item admin bound** — clamped again in `OffersService.listCatalog` itself
   (`Math.min(query.take, CATALOG_MAX_PAGE_SIZE)`), not just validated at the DTO layer, the same
   defense-in-depth already established for the homepage's `FEATURED_OFFERS_LIMIT`. A public,
   unauthenticated endpoint gets the stricter bound than an admin-authenticated one, deliberately.
2. **Filtering is limited to product type and price range — no category, no search.** No
   `Category`/taxonomy model exists in the schema, and introducing one was explicitly not part of
   this phase's approved scope (the earlier architecture-review session floated a future
   `CATEGORY_GRID` homepage-CMS section type that would need one, but that is separate, not-yet-
   built work — this phase does not pull that forward). `docs/PROHIBITED.md`'s search ban is
   untouched: `CatalogQueryDto` has no `search` field at all, not a field that's merely unused.
3. **Card rendering is shared, not duplicated**: `ProductCard` (`apps/web/src/components/catalog/
   ProductCard.tsx`) was extracted from the Phase C homepage's private `FeaturedProductCard` and
   is now used by both `/` (featured products) and `/catalog` — the two surfaces show the same
   kind of public-safe offer projection, so there is one place that renders it, not two copies
   that will inevitably drift.
4. **`docs/PROHIBITED.md`'s "customer dashboard listing multiple purchasable things" line is
   corrected, not just narrowed for the catalog** — Phase D's Saved Products feature already *is*
   a buyer dashboard listing multiple different purchasable offers, by explicit design, and was
   already approved when Phase D shipped. The line is rewritten to state the actual rule (the
   platform doesn't algorithmically recommend/cross-sell; a buyer's own saved items and their own
   browsing at `/catalog` are both buyer-directed, not platform-directed) rather than a blanket
   "never show more than one" that a prior, already-shipped, already-correct feature had already
   made untrue.
5. **`/catalog` is reachable from exactly one place**: the homepage footer. Not from an offer
   landing page (`docs/PROHIBITED.md`'s "no UI path from a landing to a different offer" line is
   explicitly preserved, just reworded to name `/catalog` as the one exception's boundary), not
   inlined into the homepage's own sections.

**Not built here:** any `Category` model or category-based browsing/filtering — tracked as a
future decision if a real business need for it arrives, not built speculatively now.

## ADR-026: Payment Provider Registry + Checkout UX (Phase F)

**Context:** `PaymentsModule` bound exactly one `PAYMENT_PORT` (`ClickPaymentAdapter`) globally —
correct while Click was the only real integration, but structurally wrong the moment a second
provider needed to coexist per order rather than replace the first. This phase replaces the single
binding with a registry and proves it with a genuinely new, real provider (Cash on Delivery), not
just a refactor with no new behavior to show for it.

**Decisions:**

1. **`PAYMENT_PORT_REGISTRY` (`Map<PaymentProviderType, PaymentPort>`) replaces `PAYMENT_PORT`.**
   `PaymentsService.initiatePayment` looks the requested provider up in the map instead of an
   `if (provider === "CLICK")` branch; a provider with no registered adapter (`MANUAL`) correctly
   gets `undefined` back and skips the redirect step, exactly like before. Adding Payme/Uzum
   Nasiya later means one adapter class implementing the existing `PaymentPort` interface plus one
   line in `PaymentsModule`'s factory array — still no changes to `PaymentsService` or
   `OrdersService`.
2. **`ClickCallbackController` keeps a direct `ClickPaymentAdapter` dependency, not the registry.**
   That controller is permanently, structurally Click-specific (its own route prefix, Click's own
   exact `{click_trans_id, ...}` reply contract) — going through the registry there would add a
   lookup with no real polymorphism behind it. `PaymentsService.handleClickCallback` similarly
   hardcodes a `"CLICK"` lookup key, documented as intentional: this method only exists because
   Click itself calls it, and a future Payme/Uzum Nasiya callback would get its own equally
   provider-specific `handleXCallback` method, never a generalized one, since each provider's
   callback contract is genuinely different (this is the same reasoning `ClickCallbackController`
   itself already follows).
3. **Cash on Delivery is the adapter that proves the registry**, deliberately the simplest
   possible real one: no external gateway, no callback, no signature to verify — `createPayment`
   just redirects straight back to the order-success page (identical shape to `MANUAL` today), and
   `verifyCallback`/`buildCallbackReply` throw, since nothing ever calls them for a
   `CASH_ON_DELIVERY` payment. An admin marks the order `PAID` after the courier collects cash,
   through the existing admin order-status transition endpoint — the same "a human with
   real-world knowledge confirms it" pattern already established for `MANUAL` (Pay Later).
   `OrdersService.resolvePaymentProvider` now maps the `"COD"` checkout-form value (which the
   frontend's `PaymentMethodSelector`/`payment-methods.ts` catalog already listed and labeled
   before this phase — it was previously silently rejected with `PAYMENT_METHOD_NOT_SUPPORTED`
   the moment a buyer picked it) to `CASH_ON_DELIVERY`.
4. **Checkout UX**: a logged-in buyer's saved default `BuyerAddress` (Phase D) pre-fills the
   checkout form's name/phone/region/city/address fields — pure convenience, every field stays
   editable, and reuses the exact same `GET /buyer/addresses` Phase D already built (no new
   endpoint). Nothing else needed wiring for account-linking itself: the checkout `POST` already
   carries whatever Bearer token is in memory automatically (the same shared-token-slot behavior
   Admin/Creator sessions already had before Buyer existed), and Phase D's `@OptionalAuth()` route
   plus `OrdersService.upsertCustomer` already do the actual linking server-side. "Past promo-code
   use" from the original ask was **not** wired in — no backend tracks "which promo codes has this
   specific buyer used" (`PromoCode`/`PromoCodeUsage` are keyed by campaign/order, not buyer
   identity), and this project's own convention is to never wire a UI affordance to data that
   doesn't exist yet. Flagged honestly as a real, disclosed gap, not silently dropped.

**Verification note:** `test/checkout.e2e-spec.ts`'s new "Cash on Delivery" block includes the one
assertion that actually proves the registry rather than a hardcoded special case — a real
`Payment.provider === "CASH_ON_DELIVERY"` row created through the exact same
`PaymentsService.initiatePayment` code path Click uses, not a parallel one. A second new block
proves the Phase D + F integration end-to-end over real HTTP: a logged-in buyer's checkout appears
in `GET /buyer/orders` with no separate claim step, and a guest checkout with no token at all is
confirmed unchanged.

## ADR-027: Homepage CMS (Phase H)

**Context:** the Sofsavdo architecture review (see `curried-wobbling-locket.md` Part 1 §2) asked
for the Premium Commerce Home (Phase C) to become admin-configurable, using the same proven
`LandingSection` pattern (`type` enum + `sortOrder` + `isActive` + `content Json`, with a working
admin reorder/toggle/edit UI) already established for per-offer landing pages. Two things the
review explicitly pushed back on for this phase — a real trending algorithm and category
navigation — are addressed by *not* building them here, kept out of scope on purpose.

**Decisions:**

1. **`HomepageSection` is a flat top-level table, not scoped to a parent.** Unlike
   `LandingSection` (which belongs to a `LandingPage`, which belongs to an `Offer`), the homepage
   has no natural 1:1 parent entity to nest under — every route in `HomepageSectionsController`
   addresses a section directly by its own id, with no offerId-style path segment.
2. **No draft/published/archived workflow.** A `LandingPage` has a real status machine because an
   Offer's landing needs a review-before-going-live gate; the homepage has no equivalent business
   need — it's always live, and each section's own `isActive` flag (toggled directly from the
   builder UI, no separate "publish" step) is the only visibility switch. This is a deliberate
   simplification versus the Landing domain's own pattern, not an oversight.
3. **`startsAt`/`expiresAt` scheduling window, reusing the stored-flag-plus-computed-availability
   split `Offer.computeAvailability` already established** rather than inventing a separate
   "SeasonalCampaign" entity — a banner with a date window just IS a `HomepageSection` whose
   computed availability (`HomepageSectionsService.computeAvailability`) lapses. Redeclared on the
   new service rather than shared, matching this codebase's existing convention of each service
   owning its own model's availability logic (see `CampaignsService`'s equivalent).
4. **No pre-seeded default rows in the migration.** Seeding real content rows via raw SQL inside a
   schema migration was judged too risky for a table this migration doesn't strictly need
   populated — instead, `apps/web/app/page.tsx` renders its exact original Phase C fixed component
   tree (`Hero`/`WhySofsavdo`/`FeaturedProducts`/.../`SupportSection`) whenever `GET /homepage`
   returns zero rows, whether that's a fresh/unconfigured environment or the backend being
   unreachable (same defensive `.catch(() => [])` pattern already used for `/catalog`). This means
   shipping the feature required zero production data migration risk, and a homepage is never
   visually empty. Each existing home component (`Hero.tsx`, `WhySofsavdo.tsx`, etc.) gained an
   optional `content` prop with its current hardcoded copy as the fallback default, so an
   individual section that exists but has an empty/missing field still renders sensibly.
5. **`FEATURED_PRODUCTS` ignores its own `content` entirely.** Its presence and `isActive` state in
   the CMS list is all an admin controls; the actual data always comes from the pre-existing
   `OffersService.listFeaturedPublic()` call the homepage already made before this phase. This
   keeps "which offers are curated/trending" a single source of truth (`Offer.isFeatured`) instead
   of duplicating that concept into `HomepageSection.content`.
6. **"Trending" stays unbuilt, exactly as the architecture review recommended** — no sales-velocity
   rollup, no new `homepageTag` enum generalizing `Offer.isFeatured`. `isFeatured` already works,
   is tested, and is wired end-to-end (`create`/`update` DTOs, `feature`/`unfeature` service
   methods, `listFeaturedPublic`'s filter) — generalizing a working, tested field into a
   `FEATURED | TRENDING | NEW | null` enum for a "Trending" feature nobody has actually asked this
   phase to build would be exactly the speculative-architecture-for-a-hypothetical-future pattern
   this codebase's own conventions warn against. Revisit only if Trending becomes a real,
   requested deliverable.
7. **`CATEGORY_GRID` ships as an enum value now, inert until Phase E's own `Category` model
   exists** — same "future-complete type list, unbuilt implementation" treatment the review asked
   for, so the CMS's type list doesn't need a second schema migration when categories eventually
   land. The admin editor explicitly tells an admin this type "isn't built yet" rather than
   silently accepting content that would never render.
8. **Per-type editor, not a generic shape system.** Unlike `SectionEditor.tsx`'s single-field
   `shape` dispatch (text/items/steps/faq/...), each Homepage section type has several distinct
   named fields (e.g. Hero's `title`/`subtitle`/`ctaLabel`/`ctaHref`). `HomepageSectionEditor.tsx`
   is a per-type switch instead of forcing multi-field content through a generic single-field
   shape — more code than the Landing pattern, but honest about the actual content shape, and there
   are only 8 real editable types to cover.
9. **`homepage.read`/`homepage.write` permission keys, no `.publish`/`.archive`** — same two-verb
   split as `landing.*`, minus the two verbs Decision #2 above makes unnecessary. MANAGER gets
   `.read`, ADMIN gets `.write`, matching the existing Landing grant pattern exactly.

**Verification note:** the Railway test database, unreachable for the entire remainder of this
session (Phases D/E/F/G), became briefly reachable during this phase. `prisma migrate deploy`
applied all pending migrations (including this phase's) cleanly, and `test/homepage.e2e-spec.ts`
passed in full against real Postgres on an isolated run (5/5) — the first real, live e2e
confirmation of any Sofsavdo-pivot-era phase this session. That run surfaced one genuine fixture
gap, not a code bug: the new `homepage.read`/`homepage.write` keys didn't exist as `Permission` rows
in the test database yet, since `seedRolesAndPermissions` (the idempotent upsert that keeps
`PERMISSIONS` in `permissions.constants.ts` in sync with the `Permission` table) had never been
re-run against that database after this phase added the two new keys — resolved by running it
once, not by changing any application code. A subsequent attempt to run the full 22-suite e2e
regression to also confirm the still-unverified Phase D/E/F suites live hit the same Railway
connection dropping again partway through, confirming the outage documented since Phase A is
intermittent rather than fully resolved. `buyer-accounts.e2e-spec.ts` run again in isolation
immediately after also failed with the connection down — so Phase D/E/F's e2e suites remain
unverified live; only Phase H's own suite got a real, passing, repeated (twice) confirmation before
the connection dropped again.

## ADR-028: AI Product Creation Engine (Phase I, text-only v1)

**Context:** the Sofsavdo architecture review (`curried-wobbling-locket.md` Part 1 §3) asked for an
AI-assisted product-copy drafting engine, built as a swappable port the same way `PaymentPort`/
`StoragePort` already are, with two constraints confirmed up front: image generation is explicitly
out of scope for v1 (a separate future spike), and AI output must always be a review-before-save
draft, never silently auto-published.

**Decisions:**

1. **`ProductAiPort` + `ClaudeProductAiAdapter`** (`@anthropic-ai/sdk`), registered in
   `ProductAiModule` behind the `PRODUCT_AI_PORT` token — the exact provider-agnostic shape
   `PaymentPort`/`StoragePort` already established. A future second provider (or a self-hosted
   model) is one new adapter class plus one line in the module's factory, no changes to
   `ProductAiService` or its one caller.
2. **Structured output via a forced tool call, not prompt-engineered JSON.** The adapter defines
   one Claude tool (`submit_product_draft`) with a strict `input_schema` covering every
   `ProductAiDraft` field, and sets `tool_choice` to force that exact tool — the standard reliable
   technique for structured output from an LLM, avoiding the fragility of parsing JSON out of a
   free-text response (markdown fences, stray commentary, truncation).
3. **Fails loudly per-call, not at boot — `AI_NOT_CONFIGURED` (503) when `ANTHROPIC_API_KEY` is
   unset.** Same convention as `TelegramBotAdapter`/SMTP: a genuinely optional integration never
   blocks the app from starting, and an admin can always fall back to manual product entry. This is
   a real, disclosed external-credential dependency this session could not resolve itself — no
   Anthropic API key exists in any environment this session has access to. The full architecture
   (port, adapter, service, DTO, controller, module, frontend review-before-save flow) is built and
   unit-tested with a mocked SDK client regardless; `test/product-ai.e2e-spec.ts` honestly asserts
   the real unconfigured-environment behavior (503) rather than faking a live Claude response. Real
   generation will work the moment the user supplies `ANTHROPIC_API_KEY` (and optionally
   `ANTHROPIC_MODEL`) in the deployment environment — no code change needed.
4. **Images are already-hosted URLs, not a new upload pipeline.** `ProductAiDraftInput.imageUrls`
   expects URLs (pasted, or from an existing Product's `images` field) rather than accepting raw
   file uploads — this engine's job is drafting copy from what's already hosted, and building new
   upload plumbing for it would be scope creep beyond what the review actually asked for
   (`ProductForm` itself doesn't even expose an images-editing UI yet, a genuinely separate gap).
   Claude's `image` content block with a `url` source is used directly, so the backend never
   fetches/base64-encodes the image itself either.
5. **Reuses `product.write`, no new permission key** — same reasoning as Campaign media reusing
   `campaign.write`: this is a sub-capability of product creation, not an independent domain.
6. **Frontend integration is deliberately partial, not exhaustive, for v1.** `ProductAiDraftPanel`
   is wired into the Admin Product Launch Wizard's Product step. Of the draft's 15 fields, only
   `title`/`shortDescription` have a real home in `ProductForm` today (it doesn't even expose a
   `description` field yet) — those two get a genuine `setValue`-based prefill via a new
   `aiPrefill` prop, triggered only by an explicit "Ishlatish" click, never automatically.
   `benefits`/`faq` get threaded into the wizard's Landing-scaffold step, pre-populating the
   BENEFITS/FAQ sections' content instead of leaving them empty (still fully editable afterward
   through the existing, unmodified `SectionEditor`). The remaining fields (`description`,
   `features`, `specs`, `usageInstructions`, `ctaLabel`, `marketingCopy`, `seoTitle`,
   `seoDescription`, `seoKeywords`, `highlights`, `tags`, and the Offer step's headline/subheadline/
   SEO) are shown in the panel's review card for the admin to read and manually copy, but are not
   wired to auto-fill anything — disclosed as a real, deliberate v1 scope boundary (not silently
   dropped), since wiring all of them would mean either adding several new fields to `ProductForm`/
   `OfferForm` (out of scope for this phase) or a much larger wizard-state refactor.

**Not built this phase, by design:** image generation (confirmed as a separate future spike, not
v1); any Seller-facing caller (no Seller exists yet — see ADR-023).

## ADR-029: Creator Motivation System — Dashboard Stats + Leaderboard (Phases J/K)

**Context:** the Sofsavdo architecture review flagged a real prerequisite before any creator
leaderboard could be built: the creator dashboard's today/month/lifetime numbers were 100%
frontend-mocked (`apps/web/src/mocks/store.ts`'s `apiGetDashboardStats`), and — unlike every other
mock function in that file — never gated behind `USE_REAL_API` at all, so setting real API mode
never actually made this page real. This closes that gap first (Phase J), then builds the
leaderboard on top of real numbers (Phase K). The user separately gave an explicit standing
requirement for this initiative: buyer, creator, and admin experiences must all feel fast, with no
freezing or slow-loading pages — every caching/query decision below was made with that in mind, not
retrofitted afterward.

**Decisions:**

1. **`CreatorDashboardService`/`CreatorLeaderboardService` are both Redis-cached via
   `AnalyticsCacheService`**, exported from `AnalyticsModule` for this purpose (previously an
   internal, unexported provider). Dashboard stats: 30s TTL, keyed per-creator — short because a
   creator's own numbers change with every order, but long enough to absorb a page's own repeat
   polling. Leaderboard: 60s TTL, one cache entry serving *every* creator's request platform-wide
   (not per-creator) — a much bigger win under concurrent load, since a busy moment with hundreds
   of creators checking their rank still triggers at most one real recompute per minute, not one
   per request. Both are best-effort/fail-open (a Redis outage just means live recomputation, never
   a 500) — the same convention `AnalyticsCacheService` already established for admin analytics.
2. **Frontend `staleTime`/`refetchInterval` are tuned to match the backend's own cache TTLs, not
   picked arbitrarily** — the dashboard query's 30s `staleTime` means a repeat visit within that
   window renders instantly from the client cache with zero network round-trip; the leaderboard's
   30s `refetchInterval` (paused via `refetchIntervalInBackground: false` when the tab isn't
   focused) polls faster than its own 60s server-side TTL specifically so most polls land on a
   guaranteed cache hit. This is the confirmed "short-interval polling, not WebSocket/SSE" decision
   from the original architecture review (this codebase has zero push infrastructure today, and a
   leaderboard doesn't need sub-second latency to feel alive).
3. **Leaderboard ranks by commission *earned* (`Commission.amountMinor`), not GMV/revenue
   attributed** — a deliberate difference from the existing admin-only `CreatorAnalyticsService`
   equivalent (which ranks by `Order.totalMinor`, i.e. sales volume). A creator-facing motivational
   leaderboard should reward what the creator actually gets paid, not raw order value that could
   include heavy discounts. Also means this needed no raw-SQL join at all (`Commission.creatorId`
   is direct, unlike `Attribution`→`Order`'s relation) — a native Prisma `groupBy` is enough.
4. **Every dashboard/leaderboard money aggregate excludes `REJECTED`/`REFUNDED` commissions** —
   those never represented real earnings once reversed. `ordersCount` deliberately does NOT exclude
   them (a sale did happen, even if its commission was later rejected), matching how a creator
   would actually read "how many orders came from me."
5. **The old fake `series7d`/`series30d`/`series90d` (Math.random()-generated for every creator
   except one hardcoded demo account) become one real `dailyRevenue30d` series.** Three fake
   resolutions were never providing three levels of real information, just three flavors of
   fabrication — one real 30-day series is strictly more honest. `@sofsavdo/types`' now-orphaned
   `DashboardStats`/`DashboardSeriesPoint` types were removed (nothing else referenced them).
6. **The old `epcMinor` (earnings-per-click) and separate `approvedCommissionMinor` tiles are
   dropped, not faked.** EPC would need daily click/order series this phase didn't build (scope
   discipline — the 30-day revenue series was enough for the "motivation" narrative); "approved"
   commission has no separately-exposed real source either, since `CommissionsService.
   getWalletBalance` (reused as-is rather than re-derived) already folds PENDING+APPROVED into one
   `pendingMinor` bucket. A genuinely new **lifetime** section was added instead — the one bucket
   the architecture review explicitly flagged as missing entirely, and the single most motivating
   number a creator-facing dashboard can show ("look how far you've come").
7. **Leaderboard caps exposure to the top 20 creators' names + earnings**, not every creator
   platform-wide — a real, deliberate, requested competitive/motivational feature (unlike the
   admin analytics equivalent's internal-only audience), but bounded rather than unlimited. The
   requesting creator's own rank is always included separately even when they fall outside the
   top 20, so every creator sees "where do I stand," not just the top performers.
8. **Both new endpoints follow the existing creator-facing route convention exactly**
   (`RequireCreatorGuard`, never `@RequirePermissions` — this isn't staff RBAC — ownership scoped
   by the JWT's own `creatorId`, same as `CreatorSalesController`), not a new pattern.

**Verification note:** `test/creator-dashboard.e2e-spec.ts` and `test/creator-leaderboard.e2e-spec.ts`
are both typecheck/lint-clean but could not run against real Postgres this time — the Railway test
database (briefly reachable during Phases H/I) was down again for the remainder of this session,
consistent with the intermittent-outage pattern documented since Phase A. Backend unit suite:
798/798 passing, 62 suites (12 new tests across both services' `.spec.ts` files, mocked Prisma/
CommissionsService/AnalyticsCacheService).

## ADR-030: Creator Motivation System — Competition Domain (Phase L)

**Context:** the third sub-phase of the Creator Motivation System, per the architecture review's
sequencing ("Competition domain (Campaign-sized CRUD)"). A Competition is a time-bound contest an
admin creates; creators rank against each other on a Competition-scoped leaderboard, reusing the
same ranking logic Phase K's platform leaderboard already established.

**Decisions:**

1. **`CompetitionStatus` is deliberately smaller than `CampaignStatus`** — DRAFT/ACTIVE/COMPLETED/
   ARCHIVED, no PAUSED. A time-bound contest pausing mid-way (and resuming with what date window?)
   is speculative complexity nobody asked for; the same `computeAvailability` stored-status-plus-
   computed-window split already used by Offer/Campaign/HomepageSection applies unchanged.
2. **The ranking query is shared, not duplicated.** `rankCreatorsByCommission(prisma, range)`
   (`apps/api/src/creator-leaderboard/rank-creators-by-commission.util.ts`) was extracted from
   Phase K's `CreatorLeaderboardService` so both the platform leaderboard (always "this month") and
   `CompetitionsService.getLeaderboard` (an arbitrary admin-chosen date window) call the exact same
   groupBy-on-Commission query, parameterized only by the date range. Two real callers justified
   the extraction — this is DRY, not premature abstraction for a hypothetical third caller.
3. **The Competition-scoped leaderboard gets its own, shorter cache TTL (30s vs. the platform
   leaderboard's 60s)** — a Competition's window is often much shorter than a month (a one-week
   contest, say), so staleness matters proportionally more as it nears its close. Still a real win
   under load: every creator viewing one specific competition shares one cache entry.
4. **A prize is free text (`prizeDescription`), fulfilled manually by an admin — not a structured
   payout wired through Commission/Payout.** A contest prize is fundamentally different from a
   commission-per-sale: it doesn't scale per-transaction, and forcing it through the financial-
   integrity machinery built for exactly that shape would be over-engineering for what is,
   correctly, a one-time manual reward an admin arranges outside the platform (same "human
   confirms it" pattern already established for MANUAL/COD payments).
5. **Creators see a competition only when it's ACTIVE and its computed availability is LIVE or
   SCHEDULED** — never DRAFT (not published yet) or EXPIRED/ARCHIVED (already over) — mirroring
   `OffersService.listFeaturedPublic`'s "never show what a buyer/creator shouldn't act on"
   convention.
6. **`competition.*` permission keys mirror `campaign.*`'s shape exactly**, minus `.pause` (no
   PAUSED state — see Decision #1). `RequirePermissions` guards every admin route;
   `RequireCreatorGuard` (no RBAC permission) guards the creator-facing routes, same split as every
   other creator-facing controller in this codebase.

**Verification note:** `test/competitions.e2e-spec.ts` is typecheck/lint-clean but could not run
against real Postgres this time — the Railway test database was down for this entire phase,
consistent with the pattern documented since Phase A. Backend unit suite: 813/813 passing, 63
suites (15 new tests in `competitions.service.spec.ts` covering computeAvailability, the full
transition matrix, slug-clash rejection, the creator-facing LIVE/SCHEDULED filter, and leaderboard
cache reuse).

**Not built this phase, by design:** an admin-side leaderboard preview (admin manages the
competition's lifecycle only; ranking is a creator-facing feature, and admin has no `creatorId` to
scope a "my rank" view against anyway); a "join" mechanic (every creator whose Commission earnings
fall within the window automatically participates, same zero-friction shape as the platform
leaderboard — no separate registration step). The activity ticker and Creator Fund are next in the
sequence.

## ADR-031: Pre-Launch Real-Data Audit (Phase M)

**Context:** the user is preparing for a real production launch (Railway deploy, `sofsavdo.com`
domain, real Click.uz merchant credentials already contracted) and gave two explicit, safety-
critical instructions: (1) remove the demo-account quick-fill hints from the admin and creator
login pages — real users must never see them; (2) audit and fix every remaining page that still
silently shows mock/demo data instead of the real backend, since shipping fabricated data to real
creators/buyers/admins by omission would be a serious quality failure, not a cosmetic one.

**Decision 1 — demo login hints removed entirely, not just hidden.** `AdminLoginPageClient.tsx`'s
and `apps/web/app/creator/(auth)/login/page.tsx`'s `DEMO_ACCOUNTS` quick-fill buttons (and the
`setValue` wiring only they used) were deleted outright, not gated behind an environment check —
the explicit instruction was "must not be visible to the user," and a conditional flag is one
config mistake away from still showing them in production.

**Decision 2 — a systematic audit, not spot-fixes.** Rather than guessing which pages might still
be mocked, an Explore-agent audit read every function in `lib/api/index.ts`/`admin.ts`, classified
each as properly `USE_REAL_API`-gated, real-backend-only, or a **bare mock re-export with zero
gating at all** (the exact defect class Phase J's `getDashboardStats` fix had already found once),
then traced each risky function to its consuming page to confirm real-world reachability. This
found 7 pages with the same defect, none previously disclosed:

1. `/admin/dashboard` — the admin's front-door screen (revenue, commission liability, pending
   payouts, funnel, top offers/creators), **the highest-severity finding**: every admin saw 100%
   fabricated numbers on literally the first screen after login, with zero indication anything was
   fake.
2. `/creator/commissions` — a creator's own commission history, filterable by status, entirely
   fabricated.
3. `/creator/dashboard`'s "required actions"/"latest payout" widgets — called the legacy mock-only
   `useContent()`/`usePayouts()` hooks even though real equivalents (`useMyContentDashboardCounts`/
   `usePayoutsMine`) already existed and were used correctly elsewhere on the very same page.
4. `/admin/referral-links`, `/admin/promo-codes`, `/admin/visitors` — three admin operational
   screens with no real backend at all behind them.

**Decision 3 — build real backends by composing existing, already-correct services, not
re-deriving business logic.** `AdminDashboardService` (new) computes the dashboard by calling
`ExecutiveAnalyticsService`/`CreatorAnalyticsService`/`ProductAnalyticsService` (all exported from
`AnalyticsModule` for this reuse) rather than re-implementing GMV/refund-rate/top-N logic a second
time — the only genuinely new queries are commission liability, pending-payout totals, and the
creator-vs-direct revenue split, none of which existed anywhere else to reuse.

**Decision 4 — fabricated funnel stages were dropped, not faked with real-sounding numbers.** The
old mock funnel had 5 stages (Click → Landing view → Checkout start → Order → Paid order); only
Click (`ReferralVisit` count), Order, and Paid order are stages this schema can actually record —
"landing view" and "checkout start" have no event table backing them (only a completed `Order`
exists), so they were removed rather than approximated. Same principle as Phase J's dashboard-chart
simplification (one real series beats several fabricated ones) applied to the admin chart too:
the old `series7d`/`series30d`/`series90d` toggle (all three entirely `Math.random()`-generated)
became one real `trend` (this month, day by day, from `ExecutiveAnalyticsService`'s already-real
`dailyOrderTrend`).

**Decision 5 — `/creator/commissions` needed a genuinely new backend method, since no existing
endpoint served this shape.** `GET /creator/sales` (Phase A1) returns `Order.status`, not
`Commission.status` — filtering by PENDING/APPROVED/REJECTED/REFUNDED/PAYABLE/PAID (what the page's
own filter dropdown offers) needed a new `CommissionsService.listMyCommissions(creatorId)`, kept
deliberately distinct from both `listMySales` (one row per sale, Order-shaped) and `listMyLedger`
(one row per accounting entry, not per Commission).

**Decision 6 — `/admin/referral-links` and `/admin/promo-codes` got full real backends;
`/admin/visitors` got a real list but NOT a real `overrideAttribution`.** `PromoCode.usageCount` is
already maintained directly on the row by `commitUsage()`, so its admin list needed no new
aggregation at all. `ReferralLink` click/order/revenue stats needed a 3-table raw SQL join
(`ReferralLink` → `ReferralVisit` → `Attribution` → `Order`) for the same reason
`creatorRevenueBreakdown` already is raw SQL — Prisma's ORM groupBy can't traverse a relation this
deep. `overrideAttribution`, however, reassigns a real commission between creators — a genuine
financial-integrity operation — and no real implementation exists yet; **rather than wire it to
the old mock (which would make a Super Admin believe they'd just changed a real payout attribution
when nothing happened on the real backend)**, the real function now throws a clear
`NOT_IMPLEMENTED` (501) error instead of silently succeeding. This is the same category of gap
`PRODUCTION_READINESS.md` already disclosed ("Manual attribution override — permission defined in
the RBAC catalog, no implementing feature exists yet") — this ADR makes the runtime behavior match
that disclosure instead of silently contradicting it.

**Decision 7 — `AdminVisitorResponse.fraudRiskFlags` is always `[]`, never fabricated.** The old
mock randomly flagged every 11th visit as `HIGH_VELOCITY` — real fraud detection (self-referral/
shared-IP/high-velocity flags) is explicitly out of scope for every phase so far (see
`PRODUCTION_READINESS.md`'s own "Fraud detection... Attribution Engine scope" line), so the real
endpoint returns the honest empty array rather than inventing flags nobody is actually computing.
`source` (PROMO_CODE/REFERRAL_VISIT) is `null` until a real `Attribution` exists for that visit,
never guessed — a `ReferralVisit` row looks identical whether it came from a promo code or a
tracked link until (if) it converts.

**Verification note:** 828/828 backend unit tests passing, 66 suites (27 new tests across
`admin-dashboard.service.spec.ts`, `commissions.service.spec.ts`'s new `listMyCommissions` block,
`admin-referral-links.service.spec.ts`, `admin-visitors.service.spec.ts`, and
`promo-codes.service.spec.ts`'s new `listAdmin` block). Frontend/backend `tsc --noEmit`/`eslint`
clean on every touched file; both apps' production builds succeed with no new routes needed (all
fixes rewired existing pages) except the login-page demo-hint removal. Browser-verified:
`/admin/referral-links` and `/admin/dashboard` both compile and correctly redirect an
unauthenticated visitor to `/admin/login`; both login pages render with the demo-account section
fully gone. e2e tests were not written for these fixes given the volume of changes in this single
pass — a reasonable follow-up, not a launch blocker, since every change here is either a read-only
GET (low risk) or already covered by the underlying service's own unit tests.

## ADR-032: Creator Motivation System — Activity Ticker + Creator Fund (Phase N)

**Context:** the final two sub-phases of the Creator Motivation System, per the architecture
review's own sequencing note left at the end of Phase L ("The activity ticker and Creator Fund are
next in the sequence").

**Decision 1 — the activity ticker merges three already-real event streams instead of inventing a
dedicated "activity" event table.** A new Commission (excluding REJECTED/REFUNDED — those never
represented a real event worth surfacing), a Payout reaching PAID, and a new
CreatorFundContribution are each already the exact row their own domain writes for its own
reasons; `ActivityTickerService` only reads and interleaves them by timestamp. No new schema for
this feature at all.

**Decision 2 — the ticker's cache TTL (20s) is shorter than the leaderboard's (60s, ADR-029),
deliberately.** A "live activity" feed reads as stale much sooner than a monthly ranking does — the
whole point is that it visibly moves. Still platform-wide (one cache entry for every viewer), so
concurrent creators watching it never multiply the query cost; the frontend polls every 15s,
faster than the TTL so most polls land on a guaranteed cache hit, and pauses when the tab isn't
focused (the same performance-first convention every polled surface this session already follows).

**Decision 3 — a Creator Fund contribution settles synchronously, unlike a Payout.** A Payout is
locked now and settled later because real external money movement (a bank transfer) needs an admin
to confirm it actually happened. A Creator Fund contribution never leaves the platform — it's an
internal transfer from one creator's available balance into a shared pool — so there's no external
step to wait for, and `CommissionsService.contributeToFund` locks AND settles the selected
commissions in one transaction. The creator sees it confirmed immediately, not "pending."

**Decision 4 — a new `CommissionStatus.DONATED`, kept distinct from `PAID`.** Reusing `PAID` for a
contribution would make "money paid out to me" and "money I gave away" the same wallet number —
exactly the kind of conflation this codebase's own `WalletBalance` breakdown exists to prevent. A
new `donatedMinor` bucket was added instead, excluded from both `paidMinor` and `reversedMinor`. A
new `LedgerEntryType.DONATION` mirrors `PAYOUT`'s "money left the available balance" ledger meaning
with a distinct destination.

**Decision 5 — `contributeToFund` reuses `lockPayableCommissions`' exact selection and race-safety
shape (oldest-first PAYABLE/unlocked commissions, a guarded `updateMany` whose WHERE re-asserts the
lock fields), rather than a new locking strategy.** A fund contribution and a payout request are
both "claim some of this creator's available balance for a specific purpose" — the same invariant
(two concurrent claims can't both succeed against the same funds) applies identically, so the
proven pattern is reused rather than re-derived. The one difference — settling immediately instead
of waiting for a later trigger — is Decision 3 above, not a change to the locking logic itself.

**Decision 6 — the fund leaderboard's ranking query is NOT extracted into a shared util**, unlike
`rankCreatorsByCommission` (ADR-030), which had two real callers (platform + Competition
leaderboards) at the time of extraction. `CreatorFundService.rankContributors` has exactly one
caller today; extracting it now would be speculative reuse for a caller that doesn't exist yet.

**Decision 7 — the platform-wide fund total is cached (30s) but a creator's own lifetime
contribution total is always computed fresh.** Same reasoning the dashboard and wallet balance
already apply: a creator's own number should never look stale to them immediately after their own
action, while a platform-wide aggregate serving every viewer benefits from a short cache far more
than it costs in staleness.

**Verification note:** 845/845 backend unit tests passing, 68 suites (21 new tests across
`activity-ticker.service.spec.ts`, `creator-fund.service.spec.ts`, and
`commissions.service.spec.ts`'s new `contributeToFund` block). Migration
`20260804000000_creator_fund` is hand-written, matching every migration since Phase A in this
repo (`prisma migrate dev`'s interactive apply doesn't run non-interactively here) — applied
cleanly against the Railway test database. Frontend/backend `tsc --noEmit`/`eslint` clean (same 8
pre-existing frontend warnings, zero new); both apps' production builds succeed with `/creator/fund`
registered and the dashboard's new ticker strip compiling cleanly.

## ADR-033: Contractual Post Verification — Link + Screenshot (Phase P)

**Context:** the user asked how the platform verifies a creator actually posted per their
contractual terms — does a creator upload a screenshot after posting, or attach a link (Perfluence-
style)? Analysis delivered mid-session, approved before this was built.

**Decision 1 — both a link and a screenshot are required, neither alone is sufficient.** A
screenshot alone is trivially fakeable (an old screenshot, a borrowed one, or a since-deleted post)
and gives an admin nothing to independently check. A link alone is fragile — a creator can edit or
delete the post after approval, and a private account may not even be viewable by an admin without
the app's own login. Requiring both gets the strength of each: the link lets an admin click through
and verify at submission time; the screenshot is a permanent evidence archive that survives whatever
happens to the live post afterward.

**Decision 2 — `Content.postUrl` is a plain nullable string, not a separate model.** No new
verification-workflow state machine was added — `postUrl` is validated (`@IsUrl`) and required at
the exact same submit/resubmit gate the screenshot-attachment requirement (`ATTACHMENT_REQUIRED`)
already uses (`ContentService.assertSubmittable`), not a new review stage. `ContentVersion.postUrl`
freezes the link at that exact submission, mirroring `attachmentSnapshot`'s own "frozen at
submission time, independent of what the live row says later" reasoning.

**Decision 3 — automated periodic re-checking (does the link still resolve?) is explicitly
deferred, not built.** This would require per-social-platform API integration (Instagram, Telegram,
TikTok, etc. each have their own auth/rate-limit/ToS constraints) — genuinely new infrastructure,
not a small addition to this pass. Phase 1 is manual admin verification via click-through +
screenshot archive; automation is a real follow-up evaluation, not a silent gap (this file, and
PROJECT_STATUS.md's Phase P entry, disclose it explicitly).

**Verification note:** 2 new backend unit tests (`POST_URL_REQUIRED` on first submit and on
resubmit, in `content.service.spec.ts`) — 42/42 tests passing in that suite. Migration
`20260805000000_content_post_url` applied cleanly against the Railway test database (reachable at
the time this phase was built; became unreachable later in the session — see Phase O/P/Q's combined
verification note in PROJECT_STATUS.md).

## ADR-034: Bio Compliance + Premium Tier (Phase Q)

**Context:** the user asked whether requiring `sofsavdo.com` in a creator's public bio should be
mandatory for an active account, given micro-influencers would comply but medium/large ones would
resist — and whether a Premium tier should exempt the latter. Analysis delivered mid-session
(tiered enforcement, not a hard account-wide lock), approved before this was built.

**Decision 1 — `bioComplianceStatus` defaults to `PENDING`, never auto-assumed `COMPLIANT`.** No
automated bio-scraping exists (each social platform has its own API/ToS constraints, same class of
problem as ADR-033's deferred link re-checking) — the only real verification mechanism is a manual
admin spot-check, so the honest default is "not yet reviewed," not a guessed-compliant state that
would silently exempt every existing creator from a policy they were never actually checked
against.

**Decision 2 — enforcement blocks one specific action (new payout requests), not the account.** The
recommendation explicitly rejected full suspension: `PayoutsService.requestPayout` throws
`BIO_COMPLIANCE_REQUIRED` (403) only for a `STANDARD`-tier creator marked `NON_COMPLIANT` — every
other feature (dashboard, campaigns, content submission, referrals) stays fully usable. This keeps
the consequence proportional to the ask (a bio-link requirement) rather than treating it as a
trust/safety violation on par with fraud (which is what `creator.suspend`/`creator.block` are for).

**Decision 3 — `PENDING` is never blocked, only `NON_COMPLIANT` is.** An admin review backlog (a
creator who's genuinely compliant but simply hasn't been checked yet) must never become the
creator's problem — blocking on `PENDING` would punish creators for the platform's own review
throughput, not for anything they did.

**Decision 4 — Premium tier is a full exemption, not a discount.** A `PREMIUM`-tier creator is never
blocked regardless of `bioComplianceStatus` — this is the confirmed answer to "should we let bigger
creators skip the bio requirement via a paid/earned tier instead of losing them to a competitor
that doesn't ask." No commission-rate change is wired to Premium in this pass (the analysis flagged
this as a business-policy question the user may want to revisit — Premium today only changes the
bio-compliance gate, nothing else).

**Decision 5 — setting bio compliance has no state-machine transition guard**, unlike
`suspend`/`block`. A creator can update their bio at any time, and an admin should be able to
re-check and flip the status back and forth freely (`COMPLIANT` → `NON_COMPLIANT` → `COMPLIANT`) —
imposing an `ALLOWED_FROM` matrix here would model a workflow that doesn't exist; this is a spot-
check result, not a lifecycle.

**Decision 6 — two new permission keys (`creator.compliance`, `creator.tier`), both ADMIN+, not
folded into the pre-existing `creator.suspend`/`creator.block`.** Those two are account-status verbs
(`UserStatus` transitions); compliance/tier are business-policy fields on `CreatorProfile` itself —
conflating them would make a future "who can suspend accounts" audit also have to reason about bio-
policy grants, and vice versa.

**Verification note:** 7 new backend unit tests (3 in `payouts.service.spec.ts` — blocks STANDARD+
NON_COMPLIANT, never blocks PENDING, never blocks PREMIUM; 3 in `admin-creators.service.spec.ts` for
`setBioCompliance`/`setTier`; 1 in `creator-dashboard.service.spec.ts` surfacing the fields to the
creator). `permissions.constants.spec.ts`'s hardcoded permission count updated 72 → 74. Migration
`20260806000000_creator_bio_compliance_tier` applied cleanly against the Railway test database
(reachable at the time this phase was built).

## ADR-035: Creator-Facing Referral Funnel (Phase O)

**Context:** the user's first question asked whether the creator side has a funnel view matching
the admin side's. It didn't — Phase M built the admin funnel platform-wide only.

**Decision — reuse the admin funnel's exact 3-stage definition and data source, scoped to one
creator, rather than inventing a different creator-facing shape.** `CreatorDashboardService`'s new
`monthlyFunnel` counts clicks via `ReferralVisit.creatorId`, and orders/paid-orders via
`Attribution.creatorId` joined to `Order.status` — the identical tables and status set
(`PAID_ORDER_STATUSES`) `AdminDashboardService` already uses, just `WHERE creatorId = ...` instead
of platform-wide. This was a deliberate choice not to count via `Commission` (which a creator-facing
view might reach for first, since it's already creator-scoped) — a Commission's status lifecycle
tracks settlement (PENDING → APPROVED → PAYABLE → PAID), not whether the underlying Order was ever
actually paid for, so it would answer a different question than "how many of my clicks became paid
orders."

**Verification note:** 3 new backend unit tests in `creator-dashboard.service.spec.ts` (creator-
scoping of both queries, the zero-clicks conversionRate guard, a real conversionRate computation).
No schema change and no new endpoint — `funnel` is a new field on the existing, already-cached
`GET /creator/dashboard-stats` response.

## ADR-036: Repository Cleanup (pre-production, Code Freeze)

**Context:** entering Code Freeze before deployment. The user asked for a full repository cleanup —
legacy Rosti-era documentation, dead source files, old branding, folder structure, dependencies,
and env/config — with the explicit constraint that no new functionality be introduced.

**Decision 0 — a full checkpoint commit came first, before any deletion.** `git status` at the
start of this pass showed 316 modified/untracked files: every phase since the Rosti-era initial
commit (the entire Sofsavdo rebuild — rebrand through Phase Q) had never been committed. Deleting
files against an uncommitted working tree with no recovery point would have meant a misjudged
deletion had nothing to restore from except memory. Committed everything first (`925b041`), then
did the cleanup as a second, independently reviewable commit — this is why the cleanup diff is
clean and small relative to the size of what it's cleaning up.

**Decision 1 — branding was already clean; no action was fabricated to look like there was.** A
repo-wide case-insensitive search for "rosti" outside `node_modules` returned exactly two files:
DECISIONS.md and PROJECT_STATUS.md, both legitimate historical changelog entries describing the
Phase B rebrand itself (e.g. "Phase B — Rebrand: Rosti → Sofsavdo — DONE"). These were left
untouched — a changelog describing its own history is not a branding leak. The one real branding
finding was external to the working tree: a stray registered git worktree
(`.claude/worktrees/sleepy-shtern-0bce91`, branch `claude/sleepy-shtern-0bce91`) checked out at the
pre-rebrand commit, whose files genuinely still import `@rosti/types`/`@rosti/ui`. This wasn't
"fixed in place" (patching branding into an abandoned branch nobody uses is pointless) — it's
flagged for the user's own decision (`git worktree remove`), since removing another branch's
checkout isn't this session's call to make silently.

**Decision 2 — every proposed source-file/model/dependency removal required independent proof of
zero real usage, not just "it looks old."** Three categories were checked exhaustively before
touching anything:
- *Prisma models*: cross-referenced every model's Prisma-client accessor (`prisma.<model>.`) AND
  its relation field names (a model can be "used" purely via `include`/`select` without ever
  appearing as a direct accessor — this caught a false positive on `SocialAccount`, which looked
  unused by accessor alone but is actively read via `CreatorProfile.socialAccounts`). Three models
  survived this check as genuinely dead: `CreatorContent`/`CreatorContentStatus` (already self-
  documented in the schema as "mock-era stub... unreferenced by any real service," superseded by
  the real `Content` vertical from Phase 7A — not to be confused with the *frontend* mock type of
  the same name in `packages/types/index.ts`, which is a distinct, still-active demo-mode type,
  left untouched) and `CampaignAsset`/`FileAsset` (same "mock-era stub, superseded by CampaignMedia,
  no real rows exist" self-disclosure). All three were dropped via real migrations
  (`20260807000000_drop_legacy_creator_content`, `20260808000000_drop_legacy_campaign_asset`),
  applied to the test database and verified against the full 857-test suite, not just typechecked.
- *Backend utility files*: one genuine orphan found, `common/idempotency/idempotency.util.ts` —
  exported `isValidIdempotencyKey`/`generateIdempotencyKey` were never imported anywhere;
  `OrdersService` validates `idempotencyKey` directly via its own DTO instead. Removed.
- *npm dependencies*: `uuid`/`@types/uuid` (apps/api) — the codebase uses `node:crypto`'s
  `randomUUID()` exclusively, confirmed via a zero-match search for any `uuid` import across
  `apps/api/src`. `framer-motion` (apps/web) — zero imports anywhere. `playwright` (apps/web,
  devDependency) — zero imports, no config file, no e2e test file anywhere; this codebase's real
  e2e tests are backend Jest specs (`apps/api/test/*.e2e-spec.ts`), not browser automation.

**Decision 3 — Prisma migrations already applied to any environment are never deleted or rewritten,
even if they describe a phase whose feature later changed.** Every one of the ~23 migration files
is a permanent, ordered record of what actually happened to a real schema; deleting one would break
`prisma migrate deploy` for any fresh environment bootstrapped from scratch. "Cleaning up
migrations" here means *adding* two new ones that undo the dead tables, never touching the history.

**Decision 4 — `docs/SCHEMA_API_AUDIT.md` was kept in place, not archived, despite being a
dated (2026-07-17) one-time audit snapshot exactly like `ARCHITECTURE_REVIEW.md` (which WAS
archived).** The difference: `SCHEMA_API_AUDIT.md` is cited by exact relative path in six live
source-code comments across both apps (`permissions.constants.ts`, `domain-error.ts`,
`creator-applications.service.ts`, `creator-real.ts`, plus two doc cross-references), while
`ARCHITECTURE_REVIEW.md` had exactly one citation (a single PROJECT_STATUS.md link, updated to
point at its new `archive/` path). Moving a file that six source comments cite by path creates more
churn and staleness risk than the decluttering benefit justifies; moving a file only one doc links
to does not. This is a case-by-case judgment, not a blanket "audit docs get archived" rule.

**Decision 5 — the other seven root docs that looked like candidates for archiving on title alone
(`COMMISSION.md`, `DATABASE.md`, `PRODUCT_MODEL.md`, `TESTING.md`, `USER_FLOWS.md`,
`ATTRIBUTION.md`, `DESIGN_SYSTEM.md`) were read in full and kept as-is.** Each is a living
conceptual reference whose content still matches the current implementation exactly (verified by
cross-checking against this same session's own extensive, repeated citations of them) — not a
point-in-time snapshot like the two audit reports. "Old-sounding title" was not treated as evidence
of staleness on its own; content was.

**Verification note:** after every removal, `tsc --noEmit`, `eslint`, the full 857-test backend
suite, and both apps' production builds were re-run clean. `npm install` was re-run once after the
three dependency removals to regenerate `package-lock.json` (7 packages removed transitively). No
functionality was added — every change in this pass is a deletion, an archive-move, or a doc-
accuracy fix (the one stale `.env.example` comment describing `NEXT_PUBLIC_API_MODE` as a "Phase
6B, auth + Product only" feature, long since true of the entire application).

## ADR-037: Pre-launch Vulnerability Triage (no blind upgrades)

**Context:** before the production push, `npm audit` reported 43 vulnerabilities (36 high, 7
moderate). The explicit instruction was to investigate each one — production-reachable vs.
dev-tooling-only vs. transitive-only, safe upgrade available or not — rather than run
`npm audit fix --force` and accept whatever it changes.

**Decision — apply only the safe, non-breaking fix; document every unfixed finding with why it's
not upgraded and why it's not exploitable, instead of forcing anything.**

- **Applied:** plain `npm audit fix` (no `--force`), which bumped `next` 16.2.10 → 16.2.12 (patch,
  within the existing `^16.2.10` range — this alone fixes the top-level Next.js CVEs: SSRF, cache
  confusion, DoS, middleware bypass, unauthenticated internal endpoint disclosure), `fast-uri`
  3.1.3 → 3.1.4, and `valibot` ≤1.4.1 → 1.4.2. Verified via `tsc --noEmit` (both apps), the full
  backend unit suite, and both apps' production builds — all clean, confirming this was a true
  patch-level bump with no behavior change.
- **Declined — `npm audit fix --force`'s suggested "fixes" are downgrades, not fixes.** Its own
  `fixAvailable` field proposed jest 29.7.0 → 19.0.2, `eslint-config-next` 16.2.10 → 12.0.4,
  `@nestjs/cli` 11.0.0 → 6.8.1, and `autocannon` 8.0.0 → 2.0.1 — every one a major-version
  regression on a currently-declared range, not an upgrade. All four are dev-tooling only (test
  runner, lint config, CLI scaffolding, load-test tool) — never shipped to production — so even the
  vulnerabilities they carry (a `uuid` buffer-bounds issue reachable only through `autocannon`'s own
  transitive `hyperid`) have zero production blast radius. Declined rather than regress working dev
  tooling for a non-reachable finding.
  - **Follow-up, done separately (this same launch-freeze pass):** realigning `prisma`/
    `@prisma/client`/`@prisma/adapter-pg` to the same `7.9.1` (see this ADR's sibling entry on the
    `prisma generate` version-mismatch fix, folded into the notification-sweep index migration work
    below) coincidentally dropped the vulnerability count further, from 38 to 31, as a side effect
    of picking up newer transitive dependents — not a targeted fix, just observed and noted.
- **Declined — a scoped `overrides` entry for `js-yaml`.** `@nestjs/swagger@11.4.6` exactly pins
  `js-yaml@5.2.1` (a DoS in flow-collection parsing, GHSA-pm4m-ph32-ghv5). Adding a root-level
  `overrides` block to force `5.2.2` never actually took effect even after deleting the nested
  `node_modules` folder and reinstalling — npm kept resolving `5.2.1`. Rather than force a full
  lockfile regeneration to chase an override npm wouldn't apply, verified the finding is not
  production-reachable and left it alone: `swagger-module.js` only ever calls `jsyaml.dump()`
  (serializing our own OpenAPI spec), never `.load()` on untrusted input, and `main.ts` gates the
  entire Swagger module behind `NODE_ENV !== "production" || SWAGGER_ENABLED === "true"` — disabled
  by default in production regardless.
- **Declined — `postcss`/`sharp` (bundled inside `next`'s own dependency tree).** `next/image` is
  never imported anywhere in `apps/web` (only the ambient `next-env.d.ts` type reference exists),
  and `next.config.ts` has no `images.remotePatterns` configured — the vulnerable image-optimization
  and CSS-stringify code paths are never invoked by this app. The only available "fix" would
  downgrade `next` itself to `9.3.3`, a non-starter.
- **Result:** vulnerability count went from 43 → 38 after the safe `npm audit fix`, then to 31 after
  the unrelated Prisma version-alignment reinstall (see below). The remainder is either confirmed
  dev-tooling-only or confirmed non-production-reachable per the reasoning above — none of it is
  believed to be launch-blocking.

## ADR-038: Launch-Readiness Fixes (Notification Sweep) + Prisma Version Alignment

**Context:** the final pre-launch technical audit re-confirmed two findings already flagged in an
earlier read-only production-readiness pass and asked that they be fixed if still believed to be
real production risks, with everything else explicitly out of scope for this freeze.

**Finding — `NotificationSweepService`'s four sweep queries were genuinely unbounded.** Each of
`sweepOrders`/`sweepPayments`/`sweepCommissions`/`sweepPayouts` (the only `@Interval`-scheduled job
in the codebase, ticking every 30s) ran a plain `status: { in: [...] }` filter with no time bound, no
`take`, and no cursor. Several swept statuses are terminal (`Order.DELIVERED`,
`Payout.PAID`/`REJECTED`/`FAILED`), so that result set could only ever grow, re-scanned in full on
every tick, forever. `Commission`/`Payout` also had only a `[creatorId, status]` composite index —
useless for these global (non-creator-scoped) status filters — and `Payout` had no `updatedAt`
column at all, unlike every sibling money-movement model, which is exactly what made a real time
bound impossible to add without a schema change first.

**Decision — add `Payout.updatedAt`, add `@@index([status, updatedAt])` to both `Payout` and
`Commission`, and bound all four sweep queries by `updatedAt: { gte: since }` with a shared 168-hour
(7-day) lookback window.** Migration `20260809000000_notification_sweep_index_fixes`. The 7-day
window is deliberately generous — this repo's own test database has shown multi-hour Railway
unavailability during this session, so the window needs to comfortably outlast a real outage without
ever missing a dispatch once a sweep resumes. Safety of rescanning a bounded window is unchanged from
before: `NotificationsService.dispatchToCreator`/`dispatchToAdmins`'s deterministic `dedupKey` unique
constraint already makes a repeat dispatch for the same business event a silent no-op, so bounding by
recency costs nothing in correctness and only removes the unbounded-growth risk. Mirrors
`ActivityTickerService`'s existing `LOOKBACK_HOURS` precedent (72h there, wider here since that
feed's job is "look recently alive" while this one's job is "never miss a dispatch"). `Order`/
`Payment` already had adequate standalone `@@index([status])`/`@@index([createdAt])` coverage and did
not need a new composite index — only the query itself needed the `updatedAt` bound, kept consistent
across all four sweep methods.

**Unrelated blocker hit and fixed along the way — `prisma generate` failing with "Could not resolve
@prisma/client."** Diagnosed as a version mismatch: the root-hoisted `prisma` CLI had drifted to
`7.9.1` while `apps/api`'s `@prisma/client`/`@prisma/adapter-pg` stayed pinned at the lockfile's
`7.8.0` — Prisma 7 requires the CLI and client versions to match exactly, and a clean
`rm -rf node_modules && npm install` alone did not fix it, since npm kept re-resolving the same drift
from `package.json`'s open `^7.8.0` ranges. Fixed by explicitly installing
`@prisma/client@7.9.1 @prisma/adapter-pg@7.9.1 prisma@7.9.1` so every one of the three matches. Not a
scope expansion — a prerequisite for the migration above to typecheck and generate correctly.

**Verification note:** `prisma format` clean, `prisma generate` clean, `tsc --noEmit` clean (both
apps), `eslint` clean, full backend unit suite (858/858, including a new assertion that every sweep
query's `where` clause includes a `Date` `updatedAt.gte` bound). Migration deploy to the Railway test
database is pending that database's own availability (see this session's repeated `P1001: Can't
reach database server` — a pre-existing, documented intermittent condition of this specific
Railway-hosted test instance, unrelated to the migration's correctness) and will be retried before
this work is considered fully verified.

## ADR-039: Post-Launch Real-Traffic Fixes — Docker Builds, Storage Module, Creator Gating, Storefront

**Context:** the first real production deploy attempt (Railway, real domain, real Click.uz
credentials) surfaced several issues no test suite could have caught, since they were either
infrastructure-config problems or UX gaps only visible once real people (not test fixtures) actually
used the deployed site.

**Finding 1 — both Dockerfiles assumed every npm workspace gets its own nested `node_modules`.**
`apps/web/Dockerfile` copied a `apps/web/node_modules` that a clean `npm ci` never actually creates
(everything hoists to root) — this alone broke the Railway build. `apps/api/Dockerfile` had the
opposite bug in its generated-Prisma-client COPY: `apps/api/node_modules/.prisma` doesn't exist
either (that also hoists to root), while a *different* handful of packages (`@nestjs/cli`'s `nest`
binary in dev; `@nestjs/terminus` in prod) genuinely don't hoist and do need the nested copy kept.
Verified all three claims directly: isolated `npm ci` runs in a scratch directory, then real
`nest build`/`next build` against the result, before touching either Dockerfile.

**Finding 2 — `.gitignore`'s bare `storage/` pattern silently excluded a real source directory.**
`apps/api/src/storage/` (StorageModule, StoragePort, local-disk/S3 adapters) had never been part of
any commit — the pattern meant only for the dev upload folder (`uploads/`, already covered
separately) also matched this unrelated directory by name. A fresh clone (the Railway build) failed
with `Cannot find module './storage/storage.module'` until this was caught; existed fine in every
local working tree the whole time, which is exactly why it went unnoticed until a real clone.

**Finding 3 — a pending (SUBMITTED/UNDER_REVIEW) creator was bounced entirely out of the cabinet.**
Both `RequireCreatorGuard` (backend) and `CreatorAppGuard` (frontend) required a fully `APPROVED`
application just to see the dashboard — a real registrant hitting this in production is what
surfaced it. Fixed by splitting "can enter the cabinet at all" (`canEnterCabinet` —
SUBMITTED/UNDER_REVIEW/APPROVED) from "can use earning-capable features" (`canWorkAsCreator` —
APPROVED only); every referral/campaign/content/payout route stays locked (visibly, with a lock icon)
until real approval, everything else opens as soon as there's nothing left to fill in.

**Finding 4 — the public storefront had no navigation, no purchase-flow explanation, and no
creator entry point that didn't require scrolling to the footer.** `/` and `/catalog` had no way to
reach each other except one footer link; nothing on the homepage explained how a purchase actually
works; a creator's own sign-up link sat at the very bottom of the page. Fixed with a shared
`PublicHeader` (logo, Katalog, a top-level "Hamkorlik uchun" creator entry point, buyer login),
a `HowToBuy` 4-step explainer, and a real, honest FOMO ticker (`PublicActivityService` — the last few
actually-PAID/DELIVERED orders, anonymized to an offer name + city, never a name or amount) rather
than any fabricated "N people viewing" counter, which `docs/PROHIBITED.md`'s "fabricated stats" rule
already forbids.

**Finding 5 — the three `/legal/*` pages were structural placeholders with a "DRAFT" banner.**
Real, standard-form Terms of Service / Privacy Policy / Refund Policy content was written, grounded
in this platform's actual behavior (Click.uz + cash-on-delivery, buyer/creator accounts, real
Refund/Order states) — not a substitute for review by local counsel, but no longer an empty skeleton
a real customer could land on. Checkout and both register forms (buyer, creator) gained a required
ToS/Privacy consent checkbox, closing two gaps `LEGAL.md` had already flagged as open before a real
launch.

**Finding 6 (caught during this pass's own full e2e verification, not from production) —
`content.e2e-spec.ts`'s submit-flow tests were failing against the *current* codebase.** Root cause:
Phase P (`ContentService.assertSubmittable`) added a hard `postUrl` requirement at submit time after
this test file was written, and the test was never updated to set one. Not a regression from this
session's changes — a latent test/behavior drift from an earlier phase, surfaced by actually running
the full e2e suite start to finish. Fixed by setting `postUrl` via the existing draft-update PATCH
before both submit assertions.

**Finding 7 (also caught by the full e2e re-run) — `buyer-accounts.e2e-spec.ts` registered test
buyers with single-character names (`"A"`, `"B"`), which `RegisterBuyerDto.fullName`'s
`@MinLength(2)` has always rejected.** Another latent test/behavior drift, not a regression — fixed
by using `"Buyer A"` / `"Buyer B"`. Re-verified: suite passes in full (61/61, including this test).

**Finding 8 — a real bug, not test drift: `CodPaymentAdapter.createPayment` returned
`request.returnUrl` as `redirectUrl` instead of `null`.** `CheckoutPageClient` branches on
`paymentRedirectUrl` being truthy to choose between a full `window.location.assign` (meant for a
real external payment-gateway redirect) and a smooth client-side `router.push` (meant for the
no-redirect case, like `MANUAL`/Pay Later). Cash on Delivery has a registered adapter (unlike
`MANUAL`, which has none at all and so never reaches this code path) but nothing external to send
the buyer to — so every COD checkout was silently downgraded to the slower full-page-reload path.
Fixed by returning `redirectUrl: null` and widening `CreatePaymentResult.redirectUrl` to
`string | null` (Click's adapter, the only other implementer, always returns a real string and is
unaffected). Re-verified: `checkout.e2e-spec.ts` passes in full (21/21, including the "guest still
works" and "buyer-linked" checkout flows exercising this exact path), plus both payment adapters'
unit tests (14/14).

**Verification note:** `tsc --noEmit`/`eslint`/build clean on both apps; full backend unit suite
(863/863, 69 suites); a real Docker build (once Docker access became available mid-session) confirmed
the deps-only-copy web build and full api build/prisma-generate cycle end to end; a real, extended
manual walkthrough (dev servers pointed at the real Railway test database) covering admin login,
dashboard, creator-applications, products, the homepage CMS builder, plus a real creator registration
→ SUBMITTED-status cabinet entry → locked-nav-item verification → direct-URL-to-locked-route
redirect, all behaving exactly as designed; the full e2e suite re-run start to finish, catching and
fixing Findings 6, 7, and 8 above. The one remaining non-green result in that full re-run —
`creator-applications.e2e-spec.ts`'s capacity/approval test hitting a 60s Jest timeout — reproduced
in isolation as the same single timeout (29/30 passing) with no assertion failure; given it's an
unrelated, pre-existing, DB-latency-shaped multi-step test untouched by any change in this session,
it's recorded here as an environment artifact, not a confirmed logic bug.

## ADR-040: SEO/Discoverability Baseline — Structured Data, Sitemap, Robots

**Context:** searching the brand name "Sofsavdo" surfaced unrelated `.uz`/`.ru` domains ahead of
`sofsavdo.com` itself. Zero SEO infrastructure existed before this: no `robots.txt`, no sitemap, a
one-line `<title>`/`<description>` with no Open Graph/Twitter/canonical tags, no structured data,
and no `public/` directory at all (no favicon, no logo asset of any kind).

**What this can and cannot fix.** Ranking #1 for a brand-name query against already-indexed
competing domains, and appearing in AI-assistant answers, both depend on external factors no code
change controls directly: domain age, inbound links, competitor content, Google's own algorithm,
and — for AI systems — what got crawled/trained and whether the assistant does a live web search at
all. This ADR closes the technical gap that was actually missing (the site being properly
describable and crawlable); it does not and cannot guarantee a ranking position or an AI mention.

**What was added:**
- `packages/config/brand.ts` gained `url` and `tagline` — reused for every piece below instead of
  re-declaring the same domain/URL string per file.
- `apps/web/app/layout.tsx`: full `Metadata` — `metadataBase`, a title template, keywords,
  `alternates.canonical`, `openGraph`, `twitter`, plus Organization + WebSite JSON-LD
  (`schema.org`) in the document `<head>`. JSON-LD's `sameAs` is deliberately left empty rather
  than filled with guessed social-profile URLs — claiming an account this session doesn't actually
  control would be a false structured-data claim, not a helpful one.
- `apps/web/app/icon.tsx`: a generated brand-colored monogram favicon (`next/og`'s
  `ImageResponse`) — there was no logo asset anywhere in the repo to use instead; this only
  replaces a blank/browser-default tab icon, not a real designed logo.
- `apps/web/app/robots.ts`: allows the real public surface (`/`, `/catalog`, `/o/*`, `/legal/*`,
  and the register/login/forgot-password entry points), disallows every authenticated
  admin/creator/buyer dashboard route — those have zero SEO value and indexing them would only
  leak internal URL structure.
- `apps/web/app/sitemap.ts`: static public routes plus every live offer's `/o/[slug]` landing
  page, paginating through the existing public `GET /offers/catalog` endpoint (capped at 20 pages
  — far beyond this catalog's current real scale — with the same defensive `.catch` pattern
  `/catalog` and `/` already use, so a backend hiccup shrinks the sitemap rather than 500ing it).
- `apps/web/public/llms.txt`: a short, honest plain-text summary of what Sofsavdo is and links to
  its real public pages, following the emerging (unofficial, but harmless) convention of giving
  AI/LLM crawlers a direct, low-noise summary alongside the human-facing site.

**Explicitly out of scope of this ADR (require the user's own action, not a code change):**
registering the domain with Google Search Console / Yandex Webmaster and submitting the sitemap;
any backlink-building or off-site content; clarifying whether the competing `.uz`/`.ru` domains
seen in search results are related to this business at all (if they are, e.g. an old placeholder
domain, a redirect or a callout on the homepage would help; if unrelated, this is closer to a
trademark/brand-confusion question than an SEO one) — worth a direct answer from the user before
any further action here.

**Verification:** `tsc --noEmit`/`eslint` clean; a full `next build` confirmed `/icon`,
`/robots.txt`, and `/sitemap.xml` all generate as static routes; a live dev-server check confirmed
the rendered `<head>` carries the new title/description/OG/canonical/favicon and both JSON-LD
blocks, and that `/robots.txt` serves the expected allow/disallow rules.

## ADR-041: Notifications UI Fix + Real Cross-Principal Bug + Telegram Contact Channel

**Context:** the user tested registration on mobile and reported the notifications section as
disorganized — overflowing blocks, poorly-styled buttons, and no way to open a notification to
read its actual message. Separately, they asked to replace the public-facing email contact channel
with a Telegram handle (`@Sofsavdo_support`) everywhere it appears.

**Finding 1 (real bug, not just styling) — the buyer notifications page never actually fetched
any data, for any buyer, ever.** `useNotifications()` (`apps/web/src/services/notifications.ts`,
shared by both the creator and buyer notifications pages) gated its query on
`enabled: !!user` using the creator-scoped `SessionProvider`/`useSession()`
(`apps/web/src/services/session.tsx`). For a buyer-only account (no `creatorId`),
`creator-real.ts`'s `getSession()` deliberately throws a 403 ("Bu hisob creator emas.") which it
catches and converts to `null` — meaning `user` is permanently `null` for every buyer, and the
notifications query never fired at all, regardless of how many real notifications existed. The
buyer notifications page silently rendered as an honest-looking empty state ("Bildirishnoma yo'q")
instead of a loading or error state, so this looked like "no notifications" rather than "the page is
broken." Confirmed via a live registration + direct DB query: two real `Notification` rows existed
(`user.registered`, IN_APP + EMAIL) while the UI showed nothing; removing the buggy `enabled` gate
(this hook already has no reachable unauthenticated code path — both call sites sit behind their
own principal's app guard) fixed it immediately, verified live.

**Finding 2 — the backend never actually rendered a notification's message text for the IN_APP
channel.** `NotificationsService.toResponse` returned only the raw template variables (`payload`)
never the rendered `{ title, body }` that `TEMPLATES[type].inApp(vars)` was already written to
produce — that render function was only ever invoked for the TELEGRAM/EMAIL channels
(`attemptDelivery`), making it effectively dead code for the one channel end users actually see in
this UI. This is the real reason "a notification couldn't be opened" — there was no message body to
show, only a generic per-type label (`notificationTypeMeta[n.type].label`, e.g. "Yangi sotuv!") with
nothing underneath. Fixed by rendering `title`/`body` in `toResponse` and adding both fields to
`NotificationResponse`/`RealNotification`.

**Finding 3 — the same business event fans out into one `Notification` row per delivery channel**
(`NotificationsService.dispatchToUser` creates a separate IN_APP + EMAIL row for one event), which
the creator page surfaces on purpose via a channel Badge, but the buyer page had no such context —
two visually-identical "Xush kelibsiz!" rows with no explanation likely produced the "I think 4
messages came in, very disorganized" impression. Fixed by scoping the buyer page's query to
`channel: "IN_APP"` only — delivery-channel bookkeeping isn't a buyer-facing concept.

**UI/CSS fixes (both `apps/web/app/{buyer,creator}/(app)/notifications/page.tsx`):**
- Each row is now a real interactive element (a `<button>` wrapping the label/badges/body/date)
  that opens a `Dialog` (`packages/ui`) showing the full title + body + a mark-as-read action —
  this is the actual "open a notification" affordance that never existed before.
- `min-w-0` added to the row's flex-1 text column and `line-clamp-2`/`break-words` added to both
  the title and body text — the same overflow-prevention pattern already established in
  `CampaignCard.tsx`'s own comment about flex-child text overflow, which this file hadn't followed.
- The badge row (`Yangi`/channel/status) gained `flex-wrap` — on the creator page, up to 3 badges
  plus a label could previously overflow a narrow mobile viewport horizontally.
- The mark-as-read button gained `shrink-0` so long title text can no longer visually squeeze or
  overlap it in the `justify-between` row.
- The creator page's raw channel-filter `<select>` had ad hoc styling (`bg-bg`, no focus ring)
  inconsistent with every other control on the page — restyled to match
  `packages/ui/src/components/Field.tsx`'s shared `controlClasses` (kept as a plain `<select>`, not
  `SelectField`, since a labeled form field would look wrong for a compact inline filter).

**Telegram contact channel:** `packages/config/brand.ts` gained `supportTelegram`
("Sofsavdo_support") and `supportTelegramUrl`. Every public-facing "contact us" surface — the
homepage `SupportSection`, the offer landing page footer, `order-success`, the buyer support page,
and all three `/legal/*` pages — now links to Telegram instead of a `mailto:` email link.
`BRAND.supportEmail` itself is untouched and still used internally (the backend's own
Settings-catalog "general.supportEmail" admin setting) — only the end-user-visible contact channel
changed.

**Verification:** `tsc --noEmit`/`eslint` clean on both apps; `next build` clean; backend
`notifications.service.spec.ts` (20/20); a full live walkthrough — registered a real buyer account
on a mobile viewport (375×812) against the real Railway test database, confirmed the notifications
list was empty before the `useNotifications` fix and populated correctly after it, confirmed the
row-click Dialog opens with the full message, confirmed mark-as-read works end-to-end (badge and
button disappear after confirming), and confirmed IN_APP-only scoping removed the duplicate-looking
EMAIL row.

**Addendum — admin-side discoverability gap.** The user separately asked why no "creator ariza
yuborildi" alert reached the admin panel even though a real onboarding submission had happened.
Traced this end to end: `OnboardingService.submitOrResubmit` correctly emits
`ONBOARDING_SUBMITTED`, the listener correctly calls `dispatchToAdmins("onboarding.new", ...)`, and
the `super_admin`/`admin`/`manager` roles all correctly carry `notification.read`
(`seedRolesAndPermissions` resets each default role's permissions from
`DEFAULT_ROLE_PERMISSIONS` on every run, so this can't silently drift) — confirmed directly against
the real test database: the demo super-admin account already had 39 real unread IN_APP
notifications sitting there, several literally titled "Yangi creator arizasi". The actual gap: the
`/admin/notifications` nav item (`apps/web/src/components/admin/nav-items.ts`, under the last
"Tizim" group) has always existed, but carried zero unread-count indicator — nothing ever
prompted an admin to look. Fixed by adding a small unread-count badge to `AdminShell.tsx`'s
`NavLink`, sourced from the same `useNotifications({ channel: "IN_APP", unreadOnly: true })` hook
this ADR's main fix already made safe to reuse. Verified live: logged into the real test database
as the seeded super-admin account, confirmed the badge renders the real unread count and the
notifications page it links to shows genuine "Yangi creator arizasi" rows.
