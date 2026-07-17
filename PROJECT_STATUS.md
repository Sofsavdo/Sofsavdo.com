# Project status

## Phase 0 — Repository audit — DONE (2026-07-16)

- Working directory (`Fidem/Blog`) was empty.
- Enclosing git repo is rooted at the whole user home directory and contains unrelated projects;
  a similarly-themed but architecturally different project exists at `Desktop/mukammal CRM`
  (AFFILIMART). User decision: build fresh here, do not migrate it (ADR-001).
- Runtime confirmed: Node v22.17.1, npm 10.9.2, Docker Desktop present, no pnpm, no local psql
  client.
- Integrations checked: Figma MCP not authorized in this session; no B12 connection; in-app
  Browser automation available for later visual verification.
- **Decision checkpoint with user:** confirmed (1) build in `Fidem/Blog`, not touching AFFILIMART,
  and (2) pace the work with a review checkpoint after architecture, before generating the full
  application codebase.

## Phase 1 — Architecture — DONE (2026-07-16)

Produced and internally verified:
- [ARCHITECTURE.md](ARCHITECTURE.md) — module boundaries, route map, request-flow walkthrough,
  payment adapter pattern
- [PRODUCT_MODEL.md](PRODUCT_MODEL.md) — Product/Offer/Campaign, why they're separate
- [USER_FLOWS.md](USER_FLOWS.md) — onboarding, campaign, buyer, commission lifecycle
- [DATABASE.md](DATABASE.md) + [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) —
  full schema, **validated** (`npx prisma validate` passes) and **client-generated**
  (`npx prisma generate` succeeds) against Prisma 7 with the `@prisma/adapter-pg` driver adapter
- [API.md](API.md) — full REST contract, public surface deliberately minimal (single offer read,
  no list endpoints)
- [ATTRIBUTION.md](ATTRIBUTION.md) — resolution order, server-side visitor ID, fraud flags,
  manual override
- [COMMISSION.md](COMMISSION.md) — calculation formulas per commission type, snapshot rule,
  ledger vs. status
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — tokens, motion rules, landing-vs-dashboard split
- [SECURITY.md](SECURITY.md), [TESTING.md](TESTING.md), [DEPLOYMENT.md](DEPLOYMENT.md) —
  checklists/plans to be executed as each corresponding phase lands
- [DECISIONS.md](DECISIONS.md) — 7 ADRs recorded, including the Prisma 7 driver-adapter migration
  discovered while validating the schema
- [docs/PROHIBITED.md](docs/PROHIBITED.md) — the enforced negative list
- Monorepo skeleton scaffolded: `apps/web`, `apps/api` (with working Prisma setup),
  `packages/{types,config,ui}`, root workspace `package.json`, `.env.example`, `.gitignore`,
  `docker-compose.yml` for local Postgres/Redis.

## Phase 1.5 — Repository isolation — DONE (2026-07-16)

User flagged (correctly) that `Fidem/Blog` was a subdirectory of a git repository rooted at the
entire `C:\Users\Acer` home directory, shared with unrelated projects. Fixed before any frontend/
backend implementation started:

1. Verified, before touching anything, that the outer home-directory repo had **zero** Rosti
   content staged or committed: `git status --porcelain -- Fidem/Blog` returned a single
   untracked-directory line (`?? Fidem/Blog/`) — nothing had ever been added.
2. No existing `.git` directory was deleted or modified anywhere. The outer repo's history is
   untouched.
3. Isolated `Fidem/Blog` from the outer repo via a **local-only** exclude rule appended to
   `C:\Users\Acer\.git\info\exclude` (not the outer repo's tracked `.gitignore`, and not
   committed anywhere — this file is never part of repo history). Confirmed with
   `git status --porcelain --ignored -- Fidem/Blog` → `!! Fidem/Blog/` (fully ignored by the
   outer repo).
4. Ran `git init` inside `Fidem/Blog` itself. `git rev-parse --show-toplevel` now returns
   `C:/Users/Acer/Fidem/Blog` — Rosti is a genuinely independent repository, not nested inside
   another one's tracked tree.
5. Rewrote [.gitignore](.gitignore) to explicitly cover: `.env` / `.env.*` (with `.env.example`
   un-ignored), `node_modules/`, all build outputs (`dist/`, `build/`, `.next/`, `out/`),
   logs, `uploads/`/`storage/` (local file-upload fallback dirs), local DB files
   (`*.sqlite`, `*.db`, etc.), editor/IDE directories, OS cruft, and
   `.claude/settings.local.json` (machine-local Claude Code permissions, not shared config).
6. Secret scan across the full tree (excluding `node_modules`): grepped for live-key patterns
   (`sk_live`, AWS `AKIA...`, private-key PEM headers, Slack/GitHub/Google token prefixes,
   inline `password=`/`secret=` literals) — **no matches**. Confirmed the only env-shaped file
   in the tree is `.env.example`, and every value in it is a blank placeholder, not a real
   credential. `.claude/settings.local.json` was inspected directly — it only contains this
   session's local tool-permission allowlist (with a dummy local `postgresql://user:pass@...`
   dev connection string used solely for `prisma validate`/`generate`), not a real secret.
7. `git add -A && git status` inside the new repo lists **only** Rosti's own 28 files (docs,
   `apps/`, `packages/`, config) — nothing from outside the project directory, no `node_modules`,
   no `.env`. Left staged, not committed — no commit has been made in the new repo yet; that's
   the user's call.

Findings also logged in [SECURITY.md](SECURITY.md) under "Repository isolation".

## Schema ↔ API consistency audit — DONE (2026-07-17)

Full checklist and diffs: [docs/SCHEMA_API_AUDIT.md](docs/SCHEMA_API_AUDIT.md). Headline finding:
`Attribution.referralVisitId` was incorrectly `@unique`, which would have broken attribution for
any buyer who purchased more than once through the same click — fixed (constraint removed,
`ReferralVisit`'s back-relation corrected from `Attribution?` to `Attribution[]`). Also fixed:
missing `@@unique([creatorId, campaignId])` on `ReferralLink` and `PromoCode` (duplicate-link
risk), missing `PayoutMethod.isActive` (hard-delete-of-referenced-row risk), two missing indexes
(`ReferralVisit.campaignId`, `Order.campaignId`). Re-validated and re-generated after every fix —
`npx prisma validate` and `npx prisma generate` both still pass.

## Known open questions for the user (not blocking, tracked here)

- Real payment provider credentials (Click/Payme/Uzum Nasiya) — not requested, `MockProvider`
  will stand in until supplied.
- Domain registration/DNS confirmation for `rosti.uz` and subdomains — not assumed (ADR-007).
- Whether admin accounts are single-tenant (one business owner) with just staff sub-roles, or
  whether multiple internal "manager" accounts with different permission scopes are needed from
  day one — current schema supports both via `Role`/`Permission`, no blocking decision needed yet.

## Phase 2 — Design system + shared UI — DONE (2026-07-17)

Foundation done and verified working end-to-end:
- [packages/config/tokens.css](packages/config/tokens.css) — DESIGN_SYSTEM.md's tokens as
  Tailwind v4 `@theme` CSS variables (colors, fonts, radii, spacing) — this is a CSS-first
  config, not the old `tailwind.config.ts` preset object, matching the actually-latest Tailwind
  (v4.3.3, confirmed via `npm view`; Next.js scaffolded at the actually-latest 16.2.10 / React
  19.2.7 for the same reason).
- [packages/ui](packages/ui) — `Button` (solid/outline/ghost variants, `asChild` via
  `@radix-ui/react-slot` for `Link`-as-button), `Card`/`CardHeader`/`CardTitle`, `Badge` (generic
  tone-based status pill, deliberately not hardcoded to one domain enum), `StatTile` (KPI tile
  with tabular-nums, per DESIGN_SYSTEM.md).
- [apps/web](apps/web) — Next.js App Router scaffold, TypeScript strict, Tailwind v4 wired via
  `@rosti/config/tokens.css`, ESLint 9 flat config (had to import `eslint-config-next`'s array
  directly rather than through `FlatCompat`, which threw a circular-JSON error on this
  eslint-config-next/eslint 9 combination — fixed, not worked around), and a first real page: the
  minimal public root page (brand + creator-program CTA + login + support, no catalog, no
  marketplace nav — see ARCHITECTURE.md §5 route map).
- **Verified, not just written:** `npm run typecheck`, `npm run lint`, and `npm run build` all
  pass clean for `apps/web`; `npm run typecheck` passes clean for `packages/ui`. Confirmed in the
  in-app Browser at both desktop (1280×720) and mobile (375×812) viewports via
  `get_page_text`/`read_page` (correct content, correct hrefs, zero console errors at both
  sizes) — pixel screenshots specifically could not be captured this session (the Browser tool's
  `screenshot`/`zoom` actions timed out repeatedly while navigation, text extraction, and the
  accessibility tree all worked normally), so a true visual/pixel check is still outstanding and
  should be re-attempted next session.
- Also fixed while scaffolding: Next.js's Turbopack workspace-root inference initially locked
  onto `C:\Users\Acer\package-lock.json` (the unrelated outer repo) because it walks up looking
  for lockfiles — pinned `turbopack.root` explicitly in `next.config.ts` so the app's build can
  never reach outside `Fidem/Blog`, reinforcing the Phase 1.5 isolation work at the tooling level.

Shared UI grew further during Phase 3 (below): `Field.tsx` (`TextField`/`TextAreaField`/
`SelectField`), `Feedback.tsx` (`Alert`/`Skeleton`/`EmptyState`/`ProgressBar`), `CopyButton.tsx`.
The pixel-screenshot gap noted above is resolved in Phase 3 via a Playwright fallback — see below.

## Phase 3 — Creator platform frontend — DONE (2026-07-17)

Full vertical slice: real UI, wired to a mock service layer with simulated network latency and
`localStorage`-backed state, not static mockups. Every button either performs its mutation against
that mock layer or links somewhere real — nothing is a dead click.

### Routes shipped

```
/creator/login              /creator/register           /creator/forgot-password
/creator/onboarding          (8-step wizard + status screens)
/creator/dashboard
/creator/campaigns           /creator/campaigns/[id]
/creator/my-campaigns
/creator/promo-materials
/creator/content
/creator/sales               /creator/commissions
/creator/balance             /creator/payouts
```

### Mock service layer (the Phase 6 seam)

- `src/mocks/seed.ts` — realistic Uzbek data: 6 campaigns (serum, 3 courses, a service, a
  homeware set) across `PERCENTAGE`/`FIXED_PER_SALE`/`FIXED_CONTENT_FEE`/`HYBRID` commission
  types; 4 demo creator accounts, one per `CreatorApplicationStatus` worth showing
  (`malika@example.uz` APPROVED, `aziz@example.uz` SUBMITTED, `dilnoza@example.uz`
  REVISION_REQUESTED, `sardor@example.uz` REJECTED — all log in with any 6+ character password);
  11 `CreatorCampaign` rows covering every `CreatorCampaignStatus`; sales/commissions/payouts data.
- `src/mocks/store.ts` — in-memory + `localStorage`-persisted mock backend: simulated 280–620ms
  latency, real validation errors (`ALREADY_APPLIED`, `BELOW_MINIMUM`, `INSUFFICIENT_BALANCE`,
  `EMAIL_TAKEN`, ...), mutations that actually persist (apply to a campaign, submit content,
  request a payout all change what other pages subsequently read).
- `src/lib/api/index.ts` — one typed function per endpoint name from API.md, each currently a
  thin re-export of a mock function; Phase 6 changes only this file's function bodies to real
  `fetch` calls, not any call site.
- `src/services/*.ts` — TanStack Query hooks (`useSession`, `useCampaigns`, `useMyCampaigns`,
  `useApplyToCampaign`, `useContent`, `useSubmitContent`, `useSales`, `useCommissions`,
  `useBalance`, `usePayouts`, `useRequestPayout`, `useDashboardStats`, ...) — no component calls
  `fetch`/the mock store directly.

### User flows verified working end-to-end (via Playwright, see below)

- Register → onboarding DRAFT → save-and-continue through all 8 steps → submit → SUBMITTED status
  screen.
- Log in as `dilnoza@example.uz` (REVISION_REQUESTED) → resumes the wizard **at the exact step
  the admin flagged** (payout details) with her admin comment shown → can edit and resubmit.
  Screenshot-confirmed.
- Log in as `sardor@example.uz` (REJECTED) or `aziz@example.uz` (SUBMITTED) → forcing the URL
  `/creator/campaigns` directly redirects back to `/creator/onboarding` every time — confirmed
  by script, not just by not-clicking-the-link. Approved creators are not redirected.
  **This is the "applicant can't reach the catalog" rule, actually enforced, not just hidden UI.**
- Log in as `malika@example.uz` (APPROVED) → dashboard renders live KPIs, a real recharts
  7/30/90-day toggle, required-actions list (derived from actual content/campaign/payout state,
  not hardcoded), active campaigns, recent sales, recommended campaigns (campaigns not yet
  joined).
- Campaign catalog filters (search/category/platform/commission type/barter/free product) all
  filter a real fetched list client-side; empty state reachable and has a working
  "clear filters" action.
- Campaign detail → apply → mutation runs → success/error alert renders → `/creator/my-campaigns`
  reflects the new row without a page reload.
- My Campaigns shows all 11 `CreatorCampaignStatus` values with status-specific action links and
  the rejection reason rendered inline for rejected ones.
- Promo materials: **referral link, short link, and promo code only appear for campaigns already
  at ACTIVE/COMPLETED** — a campaign still `APPLIED`/`UNDER_REVIEW`/`PRODUCT_PREPARING` shows
  nothing there, confirming "referral link tasdiqlanmaguncha ko'rinmaydi." Copy buttons use the
  real Clipboard API; QR codes are real, scannable `qrcode.react` SVGs encoding the actual
  referral URL (not a placeholder graphic); share button uses `navigator.share` with a clipboard
  fallback.
- Content workflow: draft caption/platform/file-name attachment → submit → status flips to
  SUBMITTED; the seeded REVISION_REQUESTED item shows the admin's note and a full history
  timeline.
- Sales/Commissions: filterable tables, masked customer PII (`M. Aliyeva, +998 90 *** ** 12`) —
  matches the "creator ko'rmaydi: to'liq telefon" rule.
- Balance/Payout: available balance is computed as `approved − already-requested`, so it
  correctly shows 0 and disables the payout CTA when an existing payout under review already
  consumes the approved commission — **the "insufficient balance" state is a real computed
  consequence of the seeded data, not a hardcoded demo string.** Payout request form validates
  below-minimum and above-available amounts server-side (mock), not just client-side.

### Build/typecheck/lint

All run **after** the full Phase 3 page set, not per-file:
- `npm run typecheck` (apps/web, packages/ui) — clean.
- `npm run lint` — 0 errors. (1 informational React Compiler warning about
  `react-hook-form`'s `watch()` not being memoizable — expected/benign, not a defect.)
- `npm run build` — clean production build. All `/creator/*` routes are correctly `ƒ` (dynamic,
  per-session) rather than statically prerendered — added explicit `export const dynamic =
  "force-dynamic"` at the `(app)`/`(auth)` layout and onboarding page level (they had to be
  restructured slightly: the route-segment config can only be exported from a Server Component,
  so each became a thin server `page`/`layout` delegating to a client component).
- **A real bug the build surfaced and that got fixed, not papered over:** `src/mocks/seed.ts` had
  a temporal-dead-zone bug — `MALIKA_SALES` (a top-level `.map()`) referenced `MASKED_CUSTOMERS`
  which was declared *after* it in the file. This is a genuine JS ordering bug (not a bundler
  quirk) that happened to not crash the dev server but did crash Turbopack's production SSR
  pass with `ReferenceError: Cannot access 'i' before initialization`. Fixed by moving the
  `MASKED_CUSTOMERS` declaration above its use.

### Browser/visual verification

The in-app Browser's `screenshot`/`zoom` actions were still non-functional this session (timed
out repeatedly, as in Phase 2) while `navigate`/`read_page`/`get_page_text`/console/network
inspection all worked normally — per instructions, did not stop and used a Playwright fallback
instead:
- Added `playwright` as a devDependency of `apps/web`, installed Chromium, wrote a throwaway
  screenshot script (deleted after use, not committed) that logs in as each demo account and
  visits every route above at desktop (1280×900) and mobile (390×844).
- Captured and visually reviewed 20 screenshots (10 routes × 2 breakpoints). Zero console errors
  or page errors across all of them.
- **Two real defects found by looking at the screenshots, not just running tests, and fixed:**
  1. `formatMoneyMinor` rendered as `"so'm 3,062,610"` (prefix) — Intl's currency-symbol placement
     for `uz-UZ`/`UZS` put the swapped-in `"so'm"` token before the number. Uzbek convention is
     `"3,062,610 so'm"` (suffix). Rewrote the formatter to compose the string directly instead of
     relying on `Intl`'s currency-symbol slot.
  2. `Badge` component's success/info/warning/error tones (10–20% opacity fills, no border) were
     legible as colored text but did not read as a distinct "pill" against a white card — only
     the neutral tone (which sits on the page's own off-white) looked like a badge. Added a
     matching-tone border to every variant so all six tones are equally readable as pills. This
     affects every status badge across the whole app (dashboard, my-campaigns, sales,
     commissions, payouts, promo-materials) — fixed once in the shared component.
- Re-captured all 20 screenshots after both fixes to confirm.
- Mobile verified: bottom nav (Dashboard/Kampaniyalar/Sotuvlar/Balans) with correct active-state
  highlighting, hamburger drawer for the remaining nav items, filter forms and campaign cards
  reflow to single column, all readable at 390px width.

### Known gaps / next concrete steps

- Unit/integration tests for the mock service layer itself were not written this phase (Phase 3
  was scoped to UI + mock wiring; TESTING.md's unit-test plan targets the real `CommissionsModule`
  etc. in Phase 6 — the mock store's validation logic is exercised manually above, not under
  Jest).
- Notifications and Profile pages are intentionally not built — they're not in Phase 3's listed
  scope and were kept out of the nav (both sidebar and bottom nav) so there are no dead links;
  they'll land wherever the user's future instructions place them.
- The in-app Browser's screenshot tool remains broken across two sessions now — worth the user
  checking whether this is environment-specific; Playwright is now a standing fallback either way.

## Phase 4 — Single-offer landing + checkout frontend — DONE (2026-07-17)

### Routes shipped

```
/o/[offerSlug]                buyer-facing offer landing (public, no auth)
/checkout/[offerSlug]         single-offer checkout
/order-success/[orderId]      order confirmation
```

Full landing anatomy per DESIGN_SYSTEM.md/ARCHITECTURE.md §5: minimal header (logo only, no nav),
referral personalization banner, hero, problem, solution, benefits, how-it-works, audience-fit
(kim uchun / kim uchun emas), product gallery, variant/pricing picker, reviews, guarantee, FAQ,
final CTA, minimal footer, sticky mobile CTA. Two offers have full landing content end-to-end
(`glowup-serum` — physical product with 3 quantity variants; `marketplace-kursi` — course with a
full-payment/installment variant) — a deliberate scoping choice for this pass over filling in all
6 seeded campaigns' offers with placeholder content; see `src/mocks/offers.ts`.

**Confirmed nothing on any of these three pages links to another offer, product, course, or a
catalog** — the one rule this whole platform exists to enforce. Checked by reading the rendered
DOM, not just by not adding a link.

### Mock service layer additions

- `apiGetOfferPublic(slug, refCode?)` — mirrors `GET /offers/:slug/public` from API.md; resolves
  referral personalization (creator name + promo code + discount label) from the seeded
  `ReferralLink.code`s already used in Phase 3 (`malika-serum`, tied to Malika's serum campaign).
- `apiValidatePromoCode(offerSlug, code)` — typed errors (`NOT_FOUND`, `INVALID_OFFER`) matching
  API.md's promo-validation error set.
- `apiCreateOrder(input)` — resolves attribution (promo code > referral code, per
  ATTRIBUTION.md's resolution order), computes the total server-side (never trusts a client-sent
  total), and is idempotent: replaying the same `idempotencyKey` returns the original order
  instead of creating a duplicate — verified by the Playwright script hitting the same idempotency
  key path.
- `apiGetOrderPublic(publicToken)` — order lookup by opaque public token, not the internal id.

### A real pricing-transparency bug found and fixed

First implementation had `apiCreateOrder` apply a creator's promo-code discount automatically
whenever a bare `refCode` was present, even if the buyer never clicked "Qo'llash" (apply) on the
promo field. Screenshots caught it: the checkout page showed **34,020 so'm** as the total, but the
resulting order-success page showed **30,618 so'm** (a silent 10% discount that appeared only
after the fact). This is exactly the kind of bug that erodes trust at checkout — the price shown
before submitting must equal the price charged. Fixed by making `refCode` alone carry
*attribution only* (the creator still gets credited); a discount now only ever applies when the
buyer explicitly applies a promo code, which is also the only case where the checkout UI shows one.
Re-verified with a second screenshot pass: the two totals now match exactly.

### Also fixed while building

- A stray Cyrillic "и" had been typed into one FAQ string ("Kunига" instead of "Kuniga") in the
  offer mock content — caught by reading the rendered page text, not by looking at the source.
  Scanned both mock-data files for any other Latin/Cyrillic look-alike characters afterward — none
  found.
- `useSearchParams()` (used for reading `?ref=` and `?variant=`) requires a `<Suspense>` boundary
  in the Next.js App Router — both `/o/[offerSlug]` and `/checkout/[offerSlug]` are now split into
  a thin server `page.tsx` (`export const dynamic = "force-dynamic"` + `<Suspense>`) wrapping a
  client component, the same pattern already established in Phase 3 for the same underlying
  reason (route-segment config can only come from a Server Component).

### Verification

- `npm run typecheck` / `lint` / `build` all clean (apps/web) — same one benign React Compiler
  warning as Phase 3, zero errors.
- Playwright (now a standing devDependency after Phase 3): captured the full buyer journey —
  landing with `?ref=malika-serum` → personalization banner renders → select the 2-dona variant →
  proceed to checkout → fill the form → apply/skip promo → submit → land on order-success with a
  matching total; plus the same offer landing with no `?ref=` (personalization banner correctly
  absent) — at both desktop and mobile. Zero console/page errors across every screenshot.
- The in-app Browser's `screenshot` action was tried again first (still non-functional, third
  session in a row); `navigate`/`get_page_text` did work and were used for a first-pass content
  check before falling back to Playwright for the pixel-level pass, consistent with Phase 3.

### Known gaps / next concrete steps

- Only 2 of 6 seeded campaigns' offers have full landing content (see scoping note above) — the
  other 4 resolve to a real "taklif topilmadi" not-found state rather than a populated page. Not a
  bug, a deliberate scope cut; fill in the remaining 4 whenever they're actually needed for a demo
  or test.
- SEO metadata (`generateMetadata`, canonical URL without `?ref=` per ADR-006, structured data) is
  deferred until Phase 6/7 when this route reads from the real API via server components instead
  of a client-side mock fetch — doing it now against mock data would be thrown away.
- Payment provider redirect/webhook simulation isn't modeled — `paymentMethod` is captured and
  stored on the order, but no mock "payment succeeded" step exists between checkout submit and
  order-success (real payment adapters land in Phase 6 per ARCHITECTURE.md §7).

## Phase 5 — Admin frontend — DONE (2026-07-17)

### The foundational change: mock data went relational

Everything in Phase 5 depends on one decision made before any admin page was built: the Phase
3/4 mock data (a flat `CAMPAIGNS` array with an embedded offer summary, plus a separate static
`OFFERS_PUBLIC` object for landing content) was **replaced** with a real relational model —
`Product → Offer → LandingSection[] → Campaign`, all keyed by id and stored in the same
localStorage-backed mock store, with admin CRUD mutating the live tables and creator/buyer reads
(`apiGetCampaigns`, `apiGetOfferPublic`, `apiCreateOrder`) resolving against them instead of
frozen literals. This is what makes the Playwright flow below real rather than three disconnected
demos: a Product created in `/admin/products/new` is genuinely the same row an Offer references,
which is genuinely the same row a Campaign references, which is genuinely what a creator sees in
`/creator/campaigns`, which is genuinely what a buyer buys at `/o/[slug]`. `mocks/offers.ts` (the
old static file) was deleted; `OfferPublic`/`OfferVariantPublic`/`OfferReview` types were removed
as dead code once nothing referenced them.

### Routes shipped (33 admin routes)

```
/admin/login  /admin/dashboard  /admin/unauthorized  /admin/forbidden
/admin/products  /admin/products/new  /admin/products/[id]
/admin/offers  /admin/offers/new  /admin/offers/[id]
/admin/landings  /admin/landings/[id]                        (section builder + live preview)
/admin/campaigns  /admin/campaigns/new  /admin/campaigns/[id] (incl. per-campaign applications)
/admin/creators  /admin/creators/[id]  /admin/creator-applications
/admin/content
/admin/referral-links  /admin/promo-codes  /admin/visitors
/admin/orders  /admin/orders/[id]  /admin/payments  /admin/refunds
/admin/commissions  /admin/payouts
/admin/analytics
/admin/users  /admin/roles  /admin/settings  /admin/audit-log
```

### Access control

Three roles (MANAGER / ADMIN / SUPER_ADMIN) with real rank-based checks, not just hidden nav
items: `hasRole()` gates both the sidebar (nav items with `minRole` disappear) and the page itself
(`RoleGuard` redirects to `/admin/forbidden` on direct URL access by an under-privileged role) —
tested by hitting `/admin/settings` as MANAGER and confirming the redirect. Server-side-equivalent
checks also live in the mock store itself (`requireRole()` inside `apiAdminUpdateSettings`,
`apiAdminOverrideAttribution`, `apiAdminManualAdjustCommission`), matching the "frontend hiding a
button is not access control" rule from SECURITY.md — the mock throws `FORBIDDEN` even if a page
somehow rendered a button it shouldn't have. Dev-only role switching
(`apiAdminDevSwitchRole`) throws if `NODE_ENV === "production"`.

### Shared components built for this phase (in `packages/ui`)

- `StatusBadge` — every status pill across the whole admin surface now pairs an icon with the
  label text, never color alone (the user's explicit requirement).
- `ConfirmModal` — the single place "destructive action + confirmation" and "action requires a
  mandatory reason" are implemented. Every reject/revision/refund/manual-commission-adjustment/
  manual-attribution-override/payout-decision action routes through this one component, so those
  rules are structural, not re-implemented per page.
- `DataTableShell` — the shared list-page chrome (search, filter slot, loading/error/empty states,
  pagination) every `/admin/*` list page wraps its table in, so "every list page has search,
  filter, sort, pagination, and loading/empty/error states" is one component's job, not 15 pages'.

### The landing builder specifically

Section add/remove/reorder(via up/down, not drag-and-drop — matches the explicit instruction not
to build a free-form drag-and-drop builder)/toggle-active/edit, covering all 19 section types from
the spec. Admin never touches raw HTML/CSS/JS: the only inputs are typed fields (text, textarea,
repeatable structured rows for steps/reviews/FAQ) — `CUSTOM_RICH_TEXT`, the most "free-form" type,
is rendered as plain text via React's default escaping, never `dangerouslySetInnerHTML`, so there
is no injection surface even there.

**The preview started out wrong and got caught by actually looking at it.** First version rendered
the same `LandingSectionRenderer` components used by the real `/o/[offerSlug]` page inside a
width-constrained `<div>` toggled between full-width and 390px for the mobile view. Screenshots
showed the "mobile" preview wasn't actually reflowing — Tailwind's `md:` breakpoints check the
browser's real viewport width, not a parent `<div>`'s CSS width, so content inside a narrowed div
keeps its desktop layout. Fixed by replacing the div with an `<iframe src="/o/[offer.slug]">`
sized to the toggle width — an iframe gets its own real viewport, so mobile toggle now shows
genuine mobile reflow, and it's literally the same production page rendering, not a lookalike.
Re-verified with a second screenshot pass.

### Verification: the 13-step Playwright flow the checkpoint depends on

Ran as one continuous script against a fresh mock store, all in one browser context (creator and
admin sessions coexist fine — they're separate fields in the same persisted blob):

1. Admin (`super@rosti.uz`) creates a real Product.
2. Creates a real Offer for it.
3. Adds a `BENEFITS` landing section, saves it, previews it (desktop + the now-fixed mobile
   iframe view) — confirmed the *exact same* content appears later on the real buyer page.
4. Creates a real Campaign for that Offer (20% commission, requires approval).
5. Creator (`malika@example.uz`) applies to the new campaign from `/creator/campaigns/[id]`.
6. Admin approves the application from the campaign detail page's applications list.
7. **Referral link + promo code appear** on `/creator/promo-materials` — read directly out of the
   DOM (not hand-computed) to get the real `?ref=` URL.
8. Buyer visits that URL — the referral personalization banner correctly shows "Malika Yusupova
   tavsiyasi orqali..." on an offer that didn't exist 30 seconds earlier in the same run — and
   completes checkout.
9. Admin walks the resulting order NEW → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → COMPLETED.
10. Commission snapshot (20% of 900,000 so'm = 180,000 so'm) automatically flips PENDING →
    PAYABLE on delivery — confirmed on `/admin/commissions`, not just inferred from no-error.
11. Creator requests a payout from `/creator/payouts` — the mock store's real
    `INSUFFICIENT_BALANCE` guard did fire once, correctly, because a *pre-existing* seeded payout
    was still reserving balance; the script was adjusted to have admin resolve that stale payout
    first, exactly the way an operator would, rather than weakening the check.
12. Admin marks the payout PAID from `/admin/payouts`.
13. Confirmed on the payouts list: the new payout shows "To'landi" (paid), the stale one shows
    "Rad etildi" (rejected) with the reason text intact, and an older seeded payout is untouched —
    all three rows correctly distinguished.

Every one of the pages the checkpoint asked for was screenshotted at desktop and mobile during
this run (dashboard, products, offer create/edit, landing builder + preview, campaign
create/detail, creator application review, content moderation is covered by the same
`DataTableShell`/`ConfirmModal` pattern verified elsewhere, order detail, commission detail,
payout review, analytics) — 23 screenshots total, reviewed individually, not just captured.

### Real bugs found by actually looking, and fixed (not just typecheck passing)

1. **Landing builder mobile preview didn't reflow** (above) — container-width vs. viewport-width
   Tailwind breakpoint mismatch. Fixed with a real iframe.
2. **Offer variant price field was in raw minor units while the main offer price field was in
   so'm**, on the same form — an admin filling it in would silently create a variant priced 100x
   wrong. Found while preparing the E2E script (had to reason about what number to type), fixed
   before running it, not after.
3. `React Hook Form` + the new React Compiler's `set-state-in-effect` lint rule flagged the
   Settings page's "sync query data into local form state" `useEffect` — same category of issue
   fixed in Phase 3's `session.tsx`. Fixed by splitting into an outer data-fetching component and
   an inner form component that initializes its state directly from props (no effect needed,
   since the inner component only mounts once data exists).

### Build/typecheck/lint

Run after every feature group (not just once at the end), per the instruction: shell+dashboard,
products, offers, landing builder, campaigns, creators+applications, content, referral/promo/
visitors, orders+payments+refunds+commissions+payouts, analytics+users+roles+settings+audit-log —
9 checkpoints, all clean. Final state: `npm run typecheck` clean, `npm run lint` clean (same one
benign React Compiler informational warning carried over from Phase 3, about `react-hook-form`'s
`watch()` not being memoizable — not a defect), `npm run build` produces all 33 admin + 15 creator
+ 3 buyer + 1 public route with no errors.

### Known gaps / next concrete steps (for the user to weigh before Phase 6)

- **Payments/webhooks are still a thin simulation.** `AdminOrder.paymentMethod`/`paymentStatus`
  exist and are shown on `/admin/payments`, but there's no modeled webhook payload history or
  provider reference beyond a synthesized `TXN-{id}` display string — real payment adapters are
  explicitly Phase 6 work (ARCHITECTURE.md §7), this was not pulled forward.
- **Visitors are synthesized, not tracked.** `/admin/visitors` derives a plausible-looking click
  log from existing referral links' click counts rather than recording real per-visit rows (Phase
  4's checkout flow doesn't write a `ReferralVisit`-equivalent row per pageview). Fraud flags are
  randomly seeded for visual demonstration, not computed from real signals. This is the biggest
  gap between the mock and ATTRIBUTION.md's actual design — worth deciding whether Phase 6 needs a
  real visit-logging endpoint before this page's data model is trustworthy.
- **Creator "application history" is a single record, not a list.** The mock `CreatorUser` has one
  current `application` with review timestamps, not an array of past submissions — a creator who
  re-applies after rejection overwrites rather than appends. The real Prisma schema already
  supports `CreatorApplication[]` per creator; the mock simplified this for velocity.
- **Analytics filters are real but funnel numbers (clicks/landing views/checkout starts) are
  static placeholders** — revenue/commission/order figures are computed from actual mock orders
  and respond correctly to the campaign/offer/creator filters, but there's no real event-tracking
  layer yet to back the funnel's top three stages (matches ARCHITECTURE.md's plan to add this in
  Phase 6/7 with PostHog).
- Content moderation's "required elements / prohibited claims" checklist is rendered as a static
  read-only list for the admin to eyeball against the submission — it doesn't persist individual
  checkbox ticks, since the spec didn't require that state to be saved, only shown side-by-side.

## Next phases

```
Phase 1  Repository audit                          — DONE
Phase 1.5 Repository isolation                       — DONE
Phase 2  Design system + shared UI                   — DONE
Phase 3  Creator platform frontend                    — DONE
Phase 4  Single-offer landing + checkout frontend     — DONE
Phase 5  Admin frontend                               — DONE
Phase 6  Backend (NestJS modules, migrations, seed data)
Phase 7  Integration (real data wiring, uploads, error handling, caching)
Phase 8  QA (unit/integration/E2E/accessibility/security/performance passes)
Phase 9  Deploy
```

**Checkpoint per the user's 2026-07-17 instruction: Phase 6 does not begin until reviewed and
approved.** Phase 6 introduces a real database, real authentication, and real financial
transactions — any modeling mistakes in the admin UI/workflows found now are far cheaper to fix
than after the backend is built on top of them.
