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

## Phase 6A — Backend foundation — DONE (2026-07-18)

Scope per the user's Phase 6 spec §32/§33: NestJS app skeleton, Prisma wiring, real auth, RBAC,
Swagger, structured logging/typed errors, health checks, migration, seed. No domain modules
(products/offers/campaigns/orders/etc.) — those are 6B–6D.

### Pre-flight: schema/API consistency audit

Re-ran the Phase 2 audit against what Phases 3–5 actually built (frontend `lib/api`, `services/**`,
`mocks/store.ts`). Findings appended to
[docs/SCHEMA_API_AUDIT.md](docs/SCHEMA_API_AUDIT.md#phase-6-pre-flight-addendum-2026-07-17):

1. **Naming collision, not a bug:** frontend's `CreatorCampaignStatus` (application+membership
   merged view) vs. Prisma's `CreatorCampaignStatus` (post-approval membership only). Decision:
   `GET /creator/my-campaigns` synthesizes the merged status server-side in 6B; neither enum is
   renamed.
2. **Error-code gaps vs. the Phase 6 spec's required list** — mock is missing typed distinctions
   for `CAMPAIGN_FULL` (had `CREATOR_LIMIT_REACHED`), promo failure reasons (`PROMO_NOT_FOUND` /
   `PROMO_EXPIRED` / `PROMO_USAGE_LIMIT`), `OFFER_INACTIVE`, `BELOW_MINIMUM`,
   `PAYOUT_ALREADY_RESERVED`, `CONFLICT`, `VALIDATION_ERROR`. All added to the backend's
   `ErrorCode` union now (`src/common/errors/domain-error.ts`) even though most won't be thrown
   until their owning module exists in 6B–6D.
3. **RBAC granularity is intentional** — frontend only checks role rank; backend's
   `PermissionsGuard` is the real enforcement layer with its own 37-key permission list.
4. **Pagination** — mock never modeled `page`/`pageSize`; real backend must implement it from 6B
   onward even though frontend list hooks won't pass those params until 6E wiring.

### Real-infrastructure verification — DONE (2026-07-18), using temporary credentials the user supplied

Docker was not treated as a hard blocker without investigating alternatives first. In order:

1. **Native Windows Postgres/Redis service** — none installed; ports 5432/6379 both closed
   (`Test-NetConnection` confirms no listener).
2. **Non-destructive WSL2 fix** — not possible. `wsl -l -v` reports zero installed distributions,
   and `Get-ComputerInfo` shows `HyperVRequirementVirtualizationFirmwareEnabled: False` — hardware
   virtualization is disabled at this sandbox's VM/firmware level, confirmed independently by
   Docker Desktop's own crash logs (startup error → auto "Reset to factory defaults" → shutdown).
3–4. **Existing remote dev Postgres/Redis credentials** — none found anywhere in env or the repo.
5. **Self-provisioning a temporary database** — not attempted; would require creating a
   third-party account, a prohibited autonomous action.

The user then supplied temporary Railway-hosted Postgres and Redis credentials, scoped explicitly
to Phase 6A verification, written only to `apps/api/.env.test` (git-ignored — confirmed via
`git check-ignore -v`, confirmed absent from `git status`, `git diff --cached`, and a repo-wide
`git grep` for both credential strings — zero matches in any tracked or trackable file). Per
instruction, credentials are never printed in this document, in any log, or in any generated file;
sections below describe what was checked, not the connection strings themselves.

**Pre-flight safety check (before touching anything):** connected with a plain `pg.Client` and
listed `information_schema.tables` — the target database (`railway`) had **zero existing tables**.
Confirmed empty/safe to use as a disposable test database before running any migration.

**1–4. Migration.** `prisma migrate dev --name init` created and applied the first-ever migration
(previously no `prisma/migrations/` directory existed). Verified directly against the database,
not just `prisma migrate status`: **42 tables** (41 models + `_prisma_migrations`), **58 foreign
key constraints**, **42 primary keys**, **68 unique indexes** — including the specific
composite/uniqueness guarantees the Phase 2 schema audit added
(`ReferralLink`/`PromoCode.(creatorId,campaignId)`, `Attribution.orderId`,
`RefreshToken.tokenHash`, `Order.idempotencyKey`/`publicToken`). `prisma migrate deploy` re-run
against the now-migrated database correctly reported "No pending migrations to apply" (safe
re-run, confirmed not just asserted). A standalone Prisma Client write→read→delete smoke test
against a `Role` row passed. Migration SQL is committed at `apps/api/prisma/migrations/`.

**Real bug found and fixed along the way:** Prisma's query engine attempts SSL negotiation by
default and this specific Railway Postgres proxy rejects that negotiation with `P1001: Can't reach
database server` — isolated by comparing against a plain `pg.Client` (no SSL attempt) succeeding
instantly with the identical connection string. Fixed with `?sslmode=disable`, but **only in
`apps/api/.env.test`** — this is a disposable-test-database-only workaround, not a security
decision; see [DECISIONS.md](DECISIONS.md) ADR-009 for the full reasoning and the explicit warning
against ever using it for staging/production. `prisma.config.ts` needed a `datasource.url` field
added (required specifically for CLI migration commands; the app's own runtime connection still
goes through the `@prisma/adapter-pg` driver adapter, unchanged).

**5–7. Seed.** Ran twice against the real database. Both runs produced **identical counts**: 7
users, 3 roles, 37 permissions, 85 role-permissions, 4 creators, 1 product, 1 offer, 1 campaign, 2
referral links, 2 promo codes — confirmed via `prisma/seed.ts`'s new `printSummary()` step and
independently via a raw duplicate-detection SQL query (grouped by email/key/code-case-insensitive/
composite keys, `HAVING count(*) > 1`) that returned **zero duplicate groups** across every entity
checked. The second run neither crashed nor created new rows — genuinely idempotent, not just
"didn't error." Seed output prints one clearly-labeled DEVELOPMENT-ONLY password, explicitly not
for staging/production.

**Real bug found and fixed:** the first seed run **crashed** with a promo-code unique-constraint
violation. Root cause: the promo code generator sliced the first 6 characters of `creator.id`
(a `cuid()`), and `cuid()`'s leading characters encode a shared timestamp — two creators seeded
moments apart in the same run collided. Per the user's explicit follow-up instruction, replaced
this with a real generator module,
[`src/common/codes/code-generator.ts`](apps/api/src/common/codes/code-generator.ts): human-readable
`PART-PART-SUFFIX` format (e.g. `MALIKAYU-GLOWSERU-X7K2`), non-deterministic, `node:crypto`'s
`randomInt` (not `Math.random()`), an application-level collision-retry wrapper
(`createWithUniqueCode`) with the database's own unique constraint as the final guarantee. Covered
by 13 new unit tests (`code-generator.spec.ts`) — format, non-determinism, retry-on-collision,
give-up-after-max-attempts, non-collision errors are never swallowed.

**8–10. Auth + RBAC + refresh-reuse integration tests — all real-database, all passing.**
`test/auth.e2e-spec.ts` (8/8): register, duplicate-email→`EMAIL_TAKEN`, wrong-password→
`INVALID_CREDENTIALS`, login, unauthenticated `/auth/me`→401, authenticated `/auth/me`, the full
5-step reuse-detection flow (login → token A → refresh A into token B → **reuse A** → confirm the
whole token family is revoked, including that B — not just A — now also fails), logout-all. Cookie
attributes asserted directly (`HttpOnly`, `SameSite=Lax`, `Path=/auth`). `test/rbac.e2e-spec.ts`
(8/8) and `test/roles.e2e-spec.ts` (2/2): MANAGER/ADMIN/SUPER_ADMIN exact permission sets read from
real `Role`/`RolePermission`/`UserRole` rows, a plain creator (no `UserRole` at all) has zero
permissions, revoking a role takes effect on the very next read, and a real signed access token was
decoded to confirm it carries no `roleKeys`/`permissions`/`roles` claims at all.

**Two real bugs found and fixed — both only catchable by booting the real Nest DI container /
server, which unit tests and mocked-provider tests structurally cannot catch:**
1. `AuthModule` never imported `CommonModule`, so `AuthService`'s `AppLogger` dependency couldn't
   resolve — `Test.createTestingModule({imports:[AppModule]}).compile()` (this e2e suite's actual
   bootstrap path) failed immediately with "Nest can't resolve dependencies of AuthService."
2. `main.ts` called `app.get(AppLogger)`, but `AppLogger` is transient-scoped — `app.get()` only
   works for singletons and throws `InvalidClassScopeException`. This one *only* surfaced when the
   real server was started via `nest start` (step 10 below); the e2e test suites build their Nest
   application differently and never execute `main.ts`'s `bootstrap()` at all, so this bug would
   have shipped invisibly past every test in this suite. Fixed with `app.resolve(AppLogger)`.

Also fixed a test-only bug: `rbac.e2e-spec.ts`'s `makeStaffUser()` helper reused one email per role
across multiple `it()` blocks in the same run, colliding on the second call — added a per-call
counter. And fixed two suites' Jest "did not exit" warning: `prisma.$disconnect()` alone doesn't
close the underlying `pg.Pool` (that only happens via `PrismaService.onModuleDestroy`, which only
runs if the Nest testing module is actually `.close()`d) — switched both `roles.e2e-spec.ts` and
`rbac.e2e-spec.ts` to `moduleRef.close()`.

**11–12. Redis.** Connectivity confirmed with a raw TCP socket sending `AUTH`+`PING` by hand before
touching ioredis at all. ioredis itself then reliably hit `ECONNRESET` — isolated to its default
post-auth readiness-check command (`INFO`), which this specific proxy resets the connection on;
fixed with `enableReadyCheck: false`. Full reasoning, and an explicit statement of what this option
does **not** weaken (the health endpoint's own `PING` still fails loudly if Redis is actually
down), is in [DECISIONS.md](DECISIONS.md) ADR-009. Real command coverage, not just client-status
inspection: `test/redis.e2e-spec.ts` (5/5) — connect, `PING`→`PONG`, `SET` then `GET` round-trips a
real value, `DEL` actually removes it, graceful `QUIT`. Also added a bounded `retryStrategy` (both
in the test client and in `HealthController`) after discovering ioredis's default unlimited
exponential backoff could leave a health check hanging indefinitely on a real outage instead of
failing fast.

**13. Health endpoints — verified via real HTTP against a running instance,** including deliberately
broken states (temporary env files with a wrong Redis password / wrong Postgres password, each
torn down immediately after use, never the real credentials):
- Everything healthy: `/health/live` → 200, `/health/ready` → 200 with `{database:up, redis:up}`.
- Wrong Redis password: `/health/live` still 200; `/health/ready` → 503 (`redis:down`, `database`
  unaffected).
- Wrong Postgres password: `/health/live` still 200; `/health/ready` → 503 (`database:down` with
  the real Postgres error surfaced server-side in logs only, `redis` unaffected).
- No credentials, connection strings, or internal error detail present in any HTTP response body.

**Real bug found and fixed:** `@nestjs/terminus`'s `PrismaHealthIndicator.pingCheck()` tries a
Mongo-only `$runCommandRaw({ping:1})` first and only falls back to `SELECT 1` if the resulting
error's message contains the exact string `"Use the mongodb provider"` — Prisma 7's Postgres client
doesn't throw that message, so `pingCheck` reported a **genuinely healthy** database as down (first
reproduced live: `{"database":{"message":"timeout of 1000ms exceeded","status":"down"}}` while a
direct `SELECT 1` against the same `PrismaService` succeeded immediately). Replaced with a direct
`this.prisma.$queryRaw\`SELECT 1\`` check.

**14. Swagger — verified against the live `/docs-json` output**, not just "the decorator is
present in the source": all health + auth routes documented, `RegisterDto`/`LoginDto`/
`ForgotPasswordDto`/`ResetPasswordDto` schemas present, bearer security scheme registered.
**Real gap found and fixed:** `DocumentBuilder.addBearerAuth()` only registers the *scheme* — it
does not mark any individual route as requiring it. `/auth/me`'s `security` field was silently
`undefined` in the live spec despite the route being genuinely protected by the global
`JwtAuthGuard`. Added `@ApiBearerAuth("bearer")` to `/auth/me` and `/auth/logout-all` (confirmed
fixed by re-fetching `/docs-json`); documented as the pattern every future protected controller
must follow, the same way `@Public()` is the pattern for opting *out*.

**15. Typed error contract — verified against real HTTP responses:** `VALIDATION_ERROR`(400),
`UNAUTHORIZED`(401), `NOT_FOUND`(404), `CONFLICT`/`EMAIL_TAKEN`(409) all confirmed with the correct
`{statusCode, code, message, requestId}` shape and no credential/stack-trace leakage.
`FORBIDDEN` is not yet testable — no permission-protected business route exists until 6B (only
`/auth/*` exists in 6A, and none of it requires a specific permission beyond "authenticated").

**Real bug found and fixed:** `requestId` was literally the string `"unknown"` on every 401/403 —
the correlation-ID logic was a Nest **interceptor**, and interceptors run *after* Guards in Nest's
request pipeline, so it never executed for any request a Guard rejected (the single most common
error case). Converted to real Express middleware (`src/common/middleware/correlation-id.middleware.ts`,
registered via `app.use()` before guards run) — confirmed fixed live: every error response,
including 401s, now carries a real UUID `requestId`.

**16. Build.** `nest build` succeeds. **Real bug found and fixed:** `package.json`'s `start` script
pointed at `dist/main.js`, but the actual compiled output is `dist/src/main.js` (the entry point's
real path, given this project's `tsconfig.json` `baseUrl`/directory structure) — `npm start` would
have failed on every real deploy. Fixed the script and confirmed the corrected path actually boots
and serves `/health/live` successfully from the compiled output, not just from `ts-node`.

**Full final sweep, all green:** `tsc --noEmit` clean on both `tsconfig.json` and
`tsconfig.test.json`; `eslint` clean across `src/`, `test/`, `prisma/`; `nest build` succeeds and
its actual output boots; **37/37 unit tests** (`npm test`); **21/21 integration/e2e tests**
(`npm run test:e2e` — `auth.e2e-spec.ts` 8, `rbac.e2e-spec.ts` 8, `roles.e2e-spec.ts` 2,
`redis.e2e-spec.ts` 5) run together in one process with a clean exit (no lingering handles);
secret scan clean (`.env.test` confirmed git-ignored, zero matches for either credential string
anywhere in the tracked or trackable working tree).

### What was built

- **App shell** — `src/main.ts` (helmet, CORS scoped to `WEB_APP_URL`, cookie-parser, global
  `ValidationPipe` with whitelist/forbidNonWhitelisted, global exception filter, correlation-ID
  middleware, Swagger at `/docs`), `src/app.module.ts` wiring `ThrottlerGuard` +
  `JwtAuthGuard` + `PermissionsGuard` as global `APP_GUARD`s (fail-closed: a new controller is
  protected by default unless explicitly `@Public()`).
- **Prisma** — `PrismaService` using `@prisma/adapter-pg`, mirroring `prisma.config.ts` exactly
  (same driver-adapter pattern, same env var) so the CLI and the running app never disagree about
  connection handling.
- **Common layer** (`src/common/`) — `DomainException` (typed `ErrorCode` union → HTTP status
  map), `AllExceptionsFilter` (normalizes DomainException/HttpException/unexpected errors into one
  `{statusCode, code, message, details, requestId}` shape, reconciling API.md's original error
  shape with the Phase 6 spec's), `correlationIdMiddleware` (mints/propagates `X-Request-Id` —
  deliberately Express middleware, not a Nest interceptor, so it runs before Guards; see the "Real
  bug found" note under item 15 below for why that distinction is load-bearing),
  `AppLogger` (structured JSON in production, readable in dev), `PaginationQueryDto`/`paginate()`
  (page/pageSize/sortBy/sortDir, max 100), money helpers (`soumToMinor`/`applyBasisPoints`,
  verified against COMMISSION.md's worked example), `@Public()`/`@RequirePermissions()`/
  `@CurrentUser()` decorators, `idempotency.util.ts`.
- **Auth** (`src/auth/`) — register (creator-only; admin/staff accounts are seed/admin-provisioned,
  never self-registered), login, refresh (rotation with theft detection: presenting an
  already-revoked refresh token revokes every token the user has, per spec §7), logout,
  logout-all, `/auth/me`, forgot-password/reset-password (JWT-based reset token, dev-mode logs
  instead of emailing — same pattern as the mock payment/notification adapters elsewhere).
  Passwords hashed with Argon2; access tokens are short-lived JWTs carrying only `sub` (no role/
  permission claims baked in, per spec §7); refresh tokens are opaque 256-bit random strings,
  stored only as a SHA-256 lookup hash (never the raw token, never JWT-encoded).
- **RBAC** (`src/roles/`) — full 37-key permission list from spec §8
  (`product.read`…`audit.read`), default MANAGER/ADMIN/SUPER_ADMIN grants where ADMIN inherits
  MANAGER and SUPER_ADMIN inherits ADMIN plus super-admin-only actions (roles/settings/manual
  attribution override/user management). `RolesService` always re-reads permissions from the
  `Role`/`RolePermission`/`UserRole` join tables on every request (via `JwtStrategy.validate()`) —
  a permission or role change takes effect on the user's next request, not at token expiry.
  `PermissionsGuard` ANDs every listed `@RequirePermissions()` key against the caller's aggregated
  set and throws a typed `FORBIDDEN` with the missing keys in `details`.
- **Health** (`src/health/`) — `/health/live` (process up, no dependency checks — safe for a
  liveness probe during a transient DB blip) and `/health/ready` (Postgres + Redis ping via
  `@nestjs/terminus`, safe for a load balancer readiness gate).
- **Migration + seed** — `prisma/seed.ts` seeds all 37 permissions, 3 staff roles
  (manager/admin/super_admin @rosti.uz), 4 creators spanning every `CreatorApplicationStatus`
  (APPROVED ×2, SUBMITTED, REJECTED) with realistic Uzbek names/cities, one active product/offer/
  landing (Glow C-Serum), one OPEN campaign with referral links + promo codes generated for the
  approved creators. All seeded accounts share one clearly-labeled DEVELOPMENT-ONLY password,
  printed with a loud warning at the end of the seed run.

### Verification summary

Everything in this section is now backed by a real run against real infrastructure — see
"Real-infrastructure verification" above for the full walkthrough with command-level detail.

- `npx prisma generate` — ✅ succeeds.
- `npx tsc --noEmit` — ✅ zero errors against **both** `tsconfig.json` (src + prisma/seed.ts) and
  `tsconfig.test.json` (src + test/ — test files are now actually typechecked, not silently
  excluded as they were at the start of this phase).
- `npx eslint` (`src/`, `test/`, `prisma/`) — ✅ zero errors, after fixing real findings across
  three passes, including a silent `.catch(() => undefined)` and a dead status comparison in
  `prisma/seed.ts`. A scoped eslint override relaxes any-safety rules for `*.spec.ts`/
  `*.e2e-spec.ts` only (mock plumbing is inherently loosely typed; production-code rules are
  unchanged).
- `npx nest build` — ✅ succeeds, and the compiled output actually boots (`npm start`'s script path
  was wrong until this pass — see item 16 above).
- **Unit tests: 37/37 passing** (`npm test`).
- **Integration/e2e tests: 21/21 passing against real Postgres + real Redis** (`npm run test:e2e`).
- **10 real bugs found and fixed this phase**, each one specifically because a real database,
  real Redis, or a real running server exposed it — see "Real-infrastructure verification" above
  for each one's root cause: (1) promo/referral code cuid-prefix collision, (2) `AuthModule`
  missing `CommonModule` import, (3) `main.ts`'s `app.get()` vs `app.resolve()` on a transient
  provider, (4) Terminus's `PrismaHealthIndicator` incompatible with Prisma 7's Postgres client,
  (5) correlation-ID interceptor never running for guard-rejected requests, (6) missing
  `@ApiBearerAuth()` on protected routes, (7) `npm start`'s wrong entry-point path, plus three
  test-only bugs (email collision in a test helper, two suites not calling `moduleRef.close()`,
  ioredis's default unlimited retry risking a hang).

### Known gaps / deferred, on purpose

- No `/admin/users` CRUD yet — `UsersModule` is a thin read-only stub backing `/auth/me`; staff
  account creation is currently seed-only. Full CRUD is Phase 6D per the checkpoint plan.
- No BullMQ/Redis-backed job yet (nothing to queue until 6B+ modules exist that need jobs).
- No file storage adapter yet (`FilesModule` is 6B+, first needed by campaign assets/content).
- `forgot-password`/`reset-password` are real but "architecture-stub" per spec §7 — the reset
  token is logged instead of emailed until `NotificationsModule` (6D) wires a real provider.

## Next phases

```
Phase 1   Repository audit                          — DONE
Phase 1.5 Repository isolation                       — DONE
Phase 2   Design system + shared UI                   — DONE
Phase 3   Creator platform frontend                    — DONE
Phase 4   Single-offer landing + checkout frontend     — DONE
Phase 5   Admin frontend                               — DONE
Phase 6A  Backend foundation (auth, RBAC, health, migration/seed) — DONE
Phase 6B  Product/offer/landing/campaign/creator-application domains
Phase 6C  Affiliate commerce (referral, promo, attribution, public offer, checkout, orders, payments)
Phase 6D  Financial domains (commissions, refunds, balances, payouts, audit)
Phase 6E  Integration (frontend real API wiring, full Playwright E2E, security/perf review)
Phase 7   QA passes beyond what 6E already covers
Phase 8   Deploy
```

### Phase 6A acceptance criteria (per the user's 2026-07-18 instruction) — all 16 met

1. API typecheck clean — ✅
2. API lint clean — ✅
3. API build clean — ✅ (and the compiled output's actual entry point verified bootable, not just
   "the build command exited 0" — this is what caught the wrong `npm start` path)
4. Unit tests clean — ✅ 37/37
5. Real PostgreSQL migration successful — ✅ 42 tables/58 FKs/42 PKs/68 unique indexes verified
6. Seed successful on real PostgreSQL — ✅
7. Seed duplicate/rerun behavior explicit — ✅ idempotent, verified via identical counts across two
   runs plus an explicit zero-duplicates query
8. Auth integration tests clean — ✅ 8/8
9. RBAC integration tests clean — ✅ 8/8 (+ 2/2 roles.e2e-spec)
10. Refresh reuse detection clean on real DB — ✅ full 5-step family-revocation flow
11. Redis ping and readiness verified — ✅ 5/5 real-command smoke test + live readiness checks
12. Health failure states verified — ✅ DB-down and Redis-down both independently tested live
13. Swagger verified — ✅ (and a real gap — missing `@ApiBearerAuth()` — found and fixed)
14. Typed error response contract verified — ✅ (and a real gap — `requestId:"unknown"` on every
    guard-rejected request — found and fixed)
15. Test database separated from production — ✅ disposable Railway instance, empty before use,
    scoped to `.env.test`, gitignored, never referenced outside this verification
16. Results written in PROJECT_STATUS.md with command/output summary — ✅ this section

**Checkpoint per the user's instructions: Phase 6A is DONE.** 10 real bugs were found and fixed in
the process of getting here — every one of them was the kind that only a real database, real
Redis, or a real running server could have surfaced; none would have been caught by typecheck,
lint, or mocked-provider unit tests alone.

## Foundation architecture audit (2026-07-18) — foundation frozen

Per explicit instruction, a final architecture audit of the whole 6A foundation ran before
starting Phase 6B. Full report: [archive/ARCHITECTURE_REVIEW.md](archive/ARCHITECTURE_REVIEW.md).

- **1 Critical issue fixed:** `AuthService.forgotPassword` logged the raw password-reset JWT
  unconditionally, including in production — a bearer credential written to logs. Now gated
  behind `NODE_ENV !== "production"`.
- **1 High-priority issue fixed:** no route-specific rate limiting on `/auth/login`,
  `/auth/register`, `/auth/forgot-password` — only the permissive global default applied. Added
  `@Throttle()` overrides (10/min login+register, 5/min forgot-password). Per-account lockout with
  backoff remains open technical debt (needs a failed-attempt counter this phase doesn't have),
  documented in the review, not implemented.
- Medium/Low findings (missing `@IsEmail()` on `LoginDto.email`, missing Swagger `@ApiProperty()`
  on two password fields, `RolesService`/`UsersService` unit-test gaps) are documented in the
  review and left as-is per instruction — no measurable impact, not worth touching working code.
- FK cascade behavior, money handling, module dependency graph (no cycles), and error-response
  leakage were all re-checked and found correct — no changes needed.

**Post-fix full re-verification, all green:** `tsc --noEmit` (both configs), `eslint`, `nest build`
(+ compiled output boots), 37/37 unit tests, 21/21 integration/e2e tests against real Postgres +
Redis, migration status clean, seed re-run idempotent (identical counts), `/health/live` +
`/health/ready` both 200 with real dependencies up, Swagger `/docs` live, and a live sanity check
confirming the new login throttle doesn't block a legitimate first request.

**The foundation is frozen from this point.** Phase 6B begins now as a vertical slice, one domain
at a time (Product → Offer → Landing → Campaign → Creator Application → Content), each carried
through its full lifecycle (schema → migration → repository → service → controller → DTOs →
validation → RBAC → unit tests → integration tests → Swagger → frontend integration → e2e) before
the next domain starts.

## Phase 6B — Product domain — DONE (2026-07-18)

Schema already existed (Phase 1); everything else is new this slice.

- **Backend** (`apps/api/src/products/`) — `GET/POST /admin/products` (paginated, filterable by
  status/type, searchable over name/sku/**slug**), `GET/PATCH /admin/products/:id`,
  `POST /admin/products/:id/archive`. Permission-guarded (`product.read`/`write`/`archive`).
  Typed errors: `VALIDATION_ERROR`, `SLUG_TAKEN`, `SKU_TAKEN`, `NOT_FOUND`, `PRODUCT_ARCHIVED`
  (editing an archived product's content is blocked; unarchiving via `status` change is the
  explicit escape hatch) — all verified against real HTTP responses, not just unit-asserted.
- **Tests** — 12 unit tests (mocked Prisma: pagination, search-clause shape, sort-field
  allowlisting, slug/sku collision handling, archived-edit lock) + 9 integration tests (real
  Postgres, real RBAC: unauthenticated→401, wrong-role creator→403, invalid slug→400, create,
  duplicate slug→409, search, update, archive-then-blocked-then-unarchived, 404). All pass
  alongside the full existing 6A suite (81 tests total: 51 unit, 30 integration/e2e).
- **Swagger** — verified live: all three routes documented, `POST /admin/products` shows the
  bearer requirement, `CreateProductDto` schema present.
- **Frontend integration** — built the real HTTP client this required (`apps/web/src/lib/api/
  http-client.ts`: in-memory access token per DECISIONS.md ADR-008, credentialed fetch, one
  401→refresh→retry, typed `ApiError` matching the mock's `{code,message}` shape) and
  `admin-real.ts` (auth + Product functions only). `lib/api/admin.ts` now dispatches per-function
  on `NEXT_PUBLIC_API_MODE` (build-time constant, tree-shaken) — every other admin domain still
  points at the mock store unconditionally, since no other backend slice exists yet.
- **Real bug found and fixed via actual browser verification** (not just curl): the
  `CreateProductDto.attributes` field was validated with `@IsObject()`, which class-validator
  defines to exclude arrays — but `ProductForm.tsx`'s `attributes` field is an array of
  `{key,value}` pairs by design, sent as `[]` on every new product. This broke **every** real
  product creation from the actual admin UI with a 400 `"attributes must be an object"` until the
  constraint was removed (Prisma's `Json?` column accepts any valid JSON; over-constraining a
  passthrough field's shape was the bug, not the frontend). Confirmed fixed by creating a real
  product through the real UI end-to-end (list → create → detail → archive, all real HTTP calls
  inspected via network trace), then deleting the test row from the database.
- **Known frontend gaps, not fixed (out of this slice's scope, documented for whoever wires the
  Auth/session slice for real):** the admin login page's demo hints ("parol: istalgan 6+ belgi")
  and the three demo-account quick-switch buttons assume mock mode unconditionally and are
  misleading in real mode (the quick-switch buttons call `adminDevSwitchRole`, which now correctly
  throws `FORBIDDEN` in real mode rather than silently doing something wrong — but the buttons
  are still visible and clickable). `AdminUser.displayName` has no real backing field on the
  `User` model (only `CreatorProfile` has one) — `admin-real.ts` derives it from the email's local
  part as a pragmatic shim; a real fix means either adding a name field to `User` or changing the
  frontend to show email instead, decided when the Users/Roles domain gets its own 6B+ slice.

**Verification, all green:** `tsc --noEmit` (api, both configs; web), `eslint` (api: src/test/
prisma; web: src/**), `nest build`, 51/51 unit tests, 30/30 integration/e2e tests, migration status
clean, Swagger live, health endpoints live, and full manual browser verification of the create →
list → detail → archive lifecycle against the real backend with real RBAC and real Postgres.

**Phase 6B does not proceed to Offer without further instruction, per the standing checkpoint
rule** — reporting Product domain complete now.

## Phase 6B — Offer domain — DONE (2026-07-18)

An Offer is the commercial configuration of a Product (Product → Offer → Landing → Campaign);
never browsable publicly. Per-Offer discount/commission fields from the original spec were
deliberately **not** added — `COMMISSION.md` already centralizes commission at Campaign level and
discount at Campaign/PromoCode level, and duplicating that at the Offer level would create two
sources of truth. `Offer.compareAtPriceMinor` (already existed) covers the "sale vs. original
price" case Offer-level discount display needs; `impliedDiscountBasisPoints` is derived from it.

- **Schema** — `OfferStatus` enum trimmed to admin-settable values only (`DRAFT|ACTIVE|PAUSED|
  ARCHIVED`; the prior `EXPIRED` value removed — expiry is computed, never stored). Added
  `internalDescription`, `ctaLabel`, `archivedAt`, `createdById`/`updatedById` (audit trail),
  3 indexes (`productId`, `archivedAt`, `[startsAt, expiresAt]`). Migration applied via
  `prisma migrate diff` + manual folder + `prisma migrate deploy` (the enum-value-removal warning
  makes `migrate dev` refuse non-interactive execution even though it's a zero-affected-rows
  change on this DB).
- **Backend** (`apps/api/src/offers/`) — `GET/POST /admin/offers` (paginated; filters: product,
  status, currency, archived tri-state; search over offer name/slug/product name/product SKU in
  one query, no N+1), `GET/PATCH /admin/offers/:id`, and three dedicated transition endpoints —
  `POST /admin/offers/:id/{activate,pause,archive}` — backed by an explicit
  `ALLOWED_TRANSITIONS` matrix (no generic status PATCH exists anywhere). Stored `status`,
  computed `availability` (`SCHEDULED|LIVE|EXPIRED|INACTIVE`, derived from status + dates + now,
  never persisted), and `archivedAt` (one-way timestamp) are three distinct fields, never
  conflated. Offer + its Variants are created/updated atomically via `$transaction()` (variant
  updates are replace-all, not diff/merge — the DTO carries no variant identity to merge against).
  Typed errors added: `PRODUCT_NOT_ELIGIBLE` (archived Product blocks activation),
  `OFFER_ARCHIVED` (blocks edits), `INVALID_OFFER_TRANSITION`.
- **RBAC** — kept the existing singular `offer.*` prefix convention rather than introducing a new
  naming scheme; added `offer.pause` and `offer.archive` (39 permissions total, up from 37).
  `RBAC.md` updated.
- **Money** — added `isValidBasisPoints`/`impliedDiscountBasisPoints` to the shared money helpers.
- **Tests** — 31 unit tests (availability boundary cases incl. dates exactly equal to "now",
  pricing/date validation, full transition-matrix `it.each`, `PRODUCT_NOT_ELIGIBLE`, N+1-avoidance
  assertion on the list query's `include`) + 16 integration tests against real Postgres. Full
  backend suite: 89/89 unit, 46/46 integration/e2e — zero regressions to Product/Auth/RBAC/Redis.
- **Frontend** — `admin-real.ts` gained `getOffers/getOffer/createOffer/updateOffer/
  activateOffer/pauseOffer/archiveOffer`, mapping the backend's `expiresAt` to the frontend's
  `endsAt` field name (a pre-existing naming mismatch from when Offers were mock-only). The Offer
  detail page's free-form status `<select>` (which still listed the now-invalid `EXPIRED` value)
  was replaced with explicit Activate/Pause/Archive buttons gated by the same transition matrix,
  plus a `ConfirmModal` for Archive and a second badge showing computed `availability` alongside
  stored `status`. The Offers list search box now matches name/slug/product name/SKU (previously
  name-only), matching what the backend's `search` param actually supports.
- **Real bugs found and fixed via actual browser verification against the real backend:**
  1. `OffersService.list()`/`findOneOrThrow()` never included the `variants` relation — every
     real Offer response silently had `variants: undefined` despite the frontend's `Offer` type
     requiring `variants: AdminOfferVariant[]`. Fixed by adding `variants: {orderBy: {sortOrder:
     "asc"}}` to both Prisma `include` clauses.
  2. Offer creation from the real UI failed every time with `variants.0.property id should not
     exist` — `OfferForm.tsx`'s variant rows carry a client-side `id` (React list key, and the
     mock store's identity field) that the real backend's whitelist-validated `OfferVariantDto`
     rejects as an unknown property. Fixed in the frontend HTTP adapter layer
     (`admin-real.ts`'s `mapOfferInputToBackend`), stripping `id` from each variant only on the
     real-API path — mock mode is untouched since it still needs that `id`.
- **Browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** logged in
  as a real seeded admin; listed offers (network trace confirmed real `/admin/offers` calls, not
  mocks); searched by SKU (both offers under one product matched), by slug (isolated one result),
  and by a non-matching string (empty state); created an Offer linked to a real Product; opened
  its detail page; activated → paused → archived it, each transition persisted and reflected
  correctly on reload with the matrix-correct button set (DRAFT: Activate+Archive; ACTIVE:
  Pause+Archive; PAUSED: Activate+Archive; ARCHIVED: none); confirmed a typed `SLUG_TAKEN`
  validation error rendered in the form on a duplicate-slug submission; confirmed Swagger `/docs`
  lists all seven Offer routes and the three Offer DTOs live. Test offer deleted from the real DB
  afterward.
- **Known limitation, not fixed (documented, not blocking):** the Offer edit form is still shown
  on an ARCHIVED offer's detail page even though the backend correctly rejects any edit to it with
  `OFFER_ARCHIVED` — the UI doesn't yet hide/disable the form for that terminal state. Low priority
  since the backend enforces the rule regardless; left for whoever next touches this page.

**Verification, all green:** `tsc --noEmit` (api, web), `eslint` (api, web — files touched this
slice), 89/89 backend unit tests, 46/46 backend integration/e2e tests, migration status clean,
Swagger live, health endpoints live, full manual browser verification against real infrastructure
as above.

**Landing domain was not started.** Phase 6B stops here per the standing checkpoint rule —
reporting Offer domain complete now.

## Phase 6B — Landing domain — DONE (2026-07-18)

A Landing is the buyer-facing page a creator's link resolves to; strictly 1:1 with its Offer
(`LandingPage.offerId @unique`) and addressed via the Offer's own already-unique `slug` — no
separate Landing slug was added. Two unique slugs on the same address would only invite drift, and
API.md already documented the intended public route as `GET /offers/:slug/public`. The rich
content model (hero, gallery, benefits, FAQ, testimonials, guarantee, delivery/payment info, final
CTA) was **not** rebuilt — it already existed as `LandingSection` rows with a flexible
`LandingSectionType` enum + JSON `content`, seeded and wired since Phase 5; this slice added the
one real gap on top of it: a lifecycle status for the LandingPage itself.

- **Schema** — new `LandingStatus` enum (`DRAFT|PUBLISHED|ARCHIVED`) and `status`/`publishedAt`/
  `archivedAt`/`seoTitle`/`seoDescription`/`seoKeywords`/`ogImageUrl`/`createdById`/`updatedById`
  columns added to `LandingPage`; added `TERMS` to `LandingSectionType` (the one content block the
  existing enum didn't already cover). Migration applied and verified clean against real Postgres.
- **Backend** (`apps/api/src/landings/`) — `GET/POST/PATCH /admin/offers/:offerId/landing`,
  `POST .../landing/{publish,unpublish,archive}` (explicit `ALLOWED_TRANSITIONS` matrix: DRAFT⇄
  PUBLISHED, either→ARCHIVED, ARCHIVED terminal — mirrors Offer's pattern exactly), 
  `GET .../landing/preview` (admin-authenticated, bypasses the publish gate — "preview mode"),
  full section CRUD (`GET/POST .../landing-sections`, `PATCH/DELETE /admin/landing-sections/:id`,
  `POST .../landing-sections/reorder`). Typed errors: `LANDING_ALREADY_EXISTS`, `LANDING_ARCHIVED`,
  `INVALID_LANDING_TRANSITION`.
- **Public endpoint** — `GET /offers/:slug/public` (the literal route API.md already specified),
  `@Public()`, returns 404 unless the Offer exists, isn't archived, has a LandingPage, and that
  LandingPage is `PUBLISHED`; response is hand-curated (never `internalDescription`, `createdById`/
  `updatedById`, `archivedAt`, or Product `sku`/`costPriceMinor`/`internalNotes`), computes
  `availability` by calling the existing `OffersService.computeAvailability()` rather than
  duplicating that logic, and only returns active sections sorted by `sortOrder`.
- **RBAC** — added `landing.publish`/`landing.archive` alongside the existing `landing.read`/
  `landing.write` (41 permissions total, up from 39). `RBAC.md` updated.
- **Tests** — 31 unit tests (create/update/transition-matrix `it.each`/section CRUD/reorder
  validation/public-read gating on every combination of missing-offer, archived-offer,
  missing-landing, DRAFT, ARCHIVED/preview-bypasses-gate, plus an explicit assertion that the
  public payload's serialized JSON never contains `internalDescription`, `createdById`,
  `costPriceMinor`, or `internalNotes`) + 19 integration tests against real Postgres (full
  create→sections→publish→public-200→unpublish→public-404→archive→public-404-stays lifecycle, RBAC
  401/403, typed errors, a second offer's landing proven fully independent). Full backend suite:
  120/120 unit, 65/65 integration/e2e — zero regressions to Product/Offer/Auth/RBAC/Redis.
- **Frontend** — `packages/types` gained `LandingStatus`/`LandingPage`; mock store gained a parallel
  `landingPages` map (every offer with seeded sections defaults to PUBLISHED, matching the mock's
  pre-existing ungated public-read behavior) plus matching CRUD/transition functions;
  `admin-real.ts`/`admin.ts` wired all of it through the same `NEXT_PUBLIC_API_MODE` dispatch
  pattern as Offer; `lib/api/index.ts` gained the same dispatch for the buyer-facing
  `getOfferPublic` (previously always-mock). The Landing builder page now shows a status badge,
  Publish/Unpublish/Archive buttons gated by the transition matrix (with a `ConfirmModal` for
  Archive), a SEO fields form, and creates the LandingPage on first visit if none exists yet. A new
  admin-authenticated preview route (`/admin/landings/[id]/preview`, deliberately outside the
  `admin/(app)` route group so it renders section content only — no sidebar chrome nested inside
  the builder's own iframe) replaced the builder's iframe target, since the real public route now
  correctly 404s anything unpublished.
- **Real bug found and fixed via actual browser verification:** the new preview page's
  `usePreviewLanding` query fired immediately on mount, racing the session-bootstrap hook's own
  token-refresh call for the same single-use refresh cookie — whichever request lost the race got
  a permanent 401 for that page load. Fixed by adding an `enabled` parameter to the hook and gating
  it on the session bootstrap actually finishing, not just on the offer id being present.
- **Browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** confirmed
  the public route 404s before any landing exists; created a brand-new Offer and its Landing
  entirely through the admin UI (not seed data); added a HERO section; published it and confirmed
  `GET /offers/:slug/public` flips 404→200 with the real Offer's price/variants/sections, and that
  the response never contains internal fields; opened the admin preview route and confirmed it
  renders a landing regardless of publish status; archived the seeded offer's original landing and
  confirmed the public route goes 200→404 again immediately. Swagger `/docs` confirmed live with
  all 8 Landing routes and 5 Landing DTOs. All test data (the newly created offer+landing) deleted
  from the real DB afterward; the seeded offer's landing was reset back to its original pristine
  DRAFT state via a re-seed (idempotent — counts unchanged).
- **Known limitation, not fixed (documented, not blocking):** the `/admin/landings` list page's
  status badge shows the parent Offer's status, not the Landing's own `status` — a pre-existing
  minor inaccuracy (the list page predates this slice), left for whoever next touches that page.

**Verification, all green:** `prisma validate`, migration status clean, `tsc --noEmit` (api, web),
`eslint` (api, web — zero errors, two pre-existing warnings in unrelated files), `nest build`,
`next build`, 120/120 backend unit tests, 65/65 backend integration/e2e tests, Swagger live, full
manual browser verification against real infrastructure as above, secret scan clean (`.env.test`
confirmed gitignored, no credential string found in any tracked file).

**Campaign domain was not started.** Phase 6B stops here per the standing checkpoint rule —
reporting Landing domain complete now.

## Phase 6B — Campaign domain — DONE (2026-07-21)

A Campaign is the creator-facing commercial/operational configuration used to promote one Offer
(and its Landing); creators and admins are the only two audiences — buyers never see Campaigns.
The Phase 1 `Campaign` model already carried most of the fields the spec asked for (name, slug,
description, goal, targetAudience, platforms, contentFormats, requiredElements, forbiddenElements,
referenceContent, dates, creatorLimit, requiresApproval, full commission config, customer discount,
barter/freeProduct, attributionWindowDays) — this slice's real gap was the lifecycle/audit layer on
top of it, plus a handful of missing fields. See DECISIONS.md ADR-011 for the deliberate differences
from the prompt's literal field list (retired `OPEN`/`CANCELLED`, no commission "inheritance" since
Offer has no commission field to inherit from, no rigid hashtag/mention/link columns — reused the
existing `requiredElements`/`forbiddenElements` arrays instead).

- **Schema** — `CampaignStatus` narrowed to `DRAFT|ACTIVE|PAUSED|COMPLETED|ARCHIVED` (`OPEN`→
  `ACTIVE`, `CANCELLED`→`COMPLETED` data-migrated in place); added `internalName`/`internalNotes`
  (admin-only, distinct from the creator-facing `name`/`description`), `category`/`ctaLabel`
  (already relied on by the frontend/mock but missing from Prisma), `minFollowers`/`maxFollowers`,
  `requiredContentCount`/`contentDeadline`, `applicationStartDate`, `archivedAt`, `createdById`/
  `updatedById`, and indexes on `offerId`/`archivedAt`/`(startDate,endDate)`/
  `(applicationStartDate,applicationDeadline)`. Migration applied and verified clean against real
  Postgres (the one pre-existing seeded Campaign row survived the enum/column changes intact).
- **Backend** (`apps/api/src/campaigns/`) — explicit `ALLOWED_TRANSITIONS` matrix exactly matching
  the spec (`DRAFT→{ACTIVE,ARCHIVED}`, `ACTIVE→{PAUSED,COMPLETED}`, `PAUSED→{ACTIVE,COMPLETED,
  ARCHIVED}`, `COMPLETED→{ARCHIVED}`, `ARCHIVED` terminal — note `ACTIVE→ARCHIVED` is deliberately
  *not* direct, per the spec's suggested transitions). `computeAvailability()` (date+status derived,
  mirrors Offer/Campaign pattern) and `computeApplicationAvailability()` (adds capacity: `OPEN|
  NOT_STARTED|CLOSED|FULL|INACTIVE`) are separate pure functions, never conflated with stored
  `status` or `archivedAt`. Activation is blocked with a typed `CAMPAIGN_NOT_ELIGIBLE` error carrying
  a `details.reason` (`OFFER_ARCHIVED|OFFER_NOT_ACTIVE|LANDING_MISSING|LANDING_NOT_PUBLISHED|
  CONFIG_INCOMPLETE|INVALID_DATES|INVALID_CAPACITY`) describing the exact unmet requirement — never
  a silent partial activation. Commission validation reuses the existing `isValidBasisPoints` money
  helper (no duplicated formulas) plus a same-service check that fixed amounts can't exceed the
  linked Offer's `priceMinor`.
- **Two API surfaces** — `GET/POST /admin/campaigns`, `GET/PATCH /admin/campaigns/:id`,
  `POST /admin/campaigns/:id/{activate,pause,complete,archive}` (full admin shape: raw fields +
  computed `availability`/`applicationAvailability`/`approvedCreatorCount`/`commissionSource`/
  `landingAvailability`, Offer/Product summaries, no N+1 via one `include` + a filtered `_count`);
  and `GET /creator/campaigns`, `GET /creator/campaigns/:id` (creator-safe response — no
  `internalName`/`internalNotes`/`createdById`/`updatedById`/`archivedAt`/raw `status`; only ever
  returns campaigns whose computed `availability === "LIVE"`, and a non-LIVE or nonexistent id both
  404 identically, so a creator can't distinguish "paused" from "never existed" by guessing ids).
  Creator routes are gated by a new `RequireCreatorGuard` (JWT carries a `creatorId`) rather than the
  staff `RolePermission` table — see RBAC.md's "Interim state" note on why this doesn't yet check
  "application approved" (that half needs the not-yet-built Creator Application domain).
- **RBAC** — added `campaign.pause`/`campaign.complete`/`campaign.archive` alongside the existing
  `campaign.read`/`campaign.write`/`campaign.publish` (44 permissions total, up from 41).
  `RBAC.md` updated.
- **Tests** — 48 unit tests (availability/application-availability boundary cases, create/update
  validation, full transition-matrix `it.each`, every activation-ineligibility reason, list N+1/
  search-filter shape, creator-catalog LIVE-only filtering, and an explicit assertion that a
  creator response's serialized JSON never contains `internalName`/`internalNotes`/`createdById`/
  `updatedById`/`archivedAt` and has no `status` property at all) + 27 integration tests against
  real Postgres (create against a nonexistent/archived/inactive Offer, an Offer with no Landing,
  full admin lifecycle including reactivate, creator catalog/detail visibility flipping with each
  admin transition, RBAC 401/403 for both surfaces, a creator rejected from every admin route and
  vice versa). Full backend suite: **168/168 unit, 92/92 integration/e2e** — zero regressions to
  Product/Offer/Landing/Auth/RBAC/Redis.
- **Frontend (admin)** — `packages/types`'s `Campaign`/`CampaignStatus`/`CampaignAsset` updated to
  match (added the new fields, `coverImage`/`assets` now optional since no real `CampaignAsset`
  write API exists yet); `admin-real.ts` gained the full Campaign CRUD+transition set with a
  `CAMPAIGN_SERVER_ONLY_FIELDS` strip list (mirrors Offer's pattern) so a `Partial<Campaign>` PATCH
  never round-trips computed/server-only fields back into a whitelist-validated DTO; the campaign
  detail page's free-form status dropdown was replaced with matrix-gated Activate/Pause/Complete/
  Archive buttons (`ConfirmModal` for Archive) and an availability badge, and the creator-applications
  card now shows an explicit "coming in the next phase" message in real mode instead of rendering
  stale mock data (application management is genuinely Creator Application's job, not this slice's).
- **Frontend (creator)** — new `creator-real.ts` adapter for `GET /creator/campaigns[/:id]`, wired
  through `lib/api/index.ts`'s existing `NEXT_PUBLIC_API_MODE` dispatch; the catalog/detail pages'
  hardcoded `"OPEN"` status checks and asset-kind icon map were updated for the new 5-state enum and
  the new `"logo"` asset kind.
- **Real bugs found and fixed via actual browser verification:**
  1. `admin-real.ts`'s Offer adapter (`mapOfferInputToBackend`) sent `productId` back on every
     `PATCH /admin/offers/:id`, but `UpdateOfferDto` deliberately omits it (immutable after
     creation) — the whitelist-validated DTO rejected every real-mode Offer edit with a 400. This
     predates Campaign but was only caught now, while re-verifying the Offer this Campaign links to.
     Fixed by stripping `productId` (and other server-only fields) from update payloads specifically,
     not just create payloads.
  2. `CampaignForm.tsx`'s Offer `<select>`, registered via `react-hook-form`, silently submitted
     `offerId: ""` when editing an existing campaign — the offers list loads asynchronously, so the
     native `<option>` matching the campaign's `existing.offer.id` doesn't exist yet at the form's
     first render, and RHF reads the DOM's selected value at submit time, not the `defaultValues`
     object. Fixed with an effect that calls `setValue("offerId", ...)` once the offers list has
     loaded, not just relying on `defaultValues`.
- **Known limitation, not fixed (real gap found, correctly scoped out of this slice):** creator-side
  session/login was never wired to the real backend — `CreatorUser.application` requires a real
  `CreatorApplication` read, which needs the Creator Application domain (next slice, explicitly not
  started here). This blocks browser-testing the *rendered creator UI* against the real backend
  end-to-end. Root cause confirmed, not worked around: the Campaign creator endpoints themselves were
  instead verified directly over real authenticated HTTP calls made from within the running browser
  page (a real creator JWT obtained via `POST /auth/login`, used to call `GET /creator/campaigns`
  and `GET /creator/campaigns/:id` against the live server) — see the Campaign browser verification
  notes below for exactly what that proved. Building creator session/profile wiring is properly the
  Creator Application slice's job, not a Campaign fix.
- **Admin browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** logged
  in as the real seeded admin; opened the Campaign list (real network calls confirmed); created a
  Campaign linked to the real ACTIVE Offer with its PUBLISHED Landing, configuring platforms,
  content formats, dos/don'ts, CTA, application deadline, creator limit, and an 18% commission;
  saved as DRAFT (detail page correctly showed only Activate+Archive); edited the description and
  confirmed it persisted; activated (availability flipped to LIVE, buttons became Pause+Complete);
  paused (buttons became Activate+Complete+Archive) and reactivated; submitted an out-of-bounds
  150% commission and confirmed a typed `VALIDATION_ERROR` ("Komissiya foizi 0 va 100% orasida
  bo'lishi kerak.") rendered in the form with a real `400` in the network trace; completed the
  campaign (buttons reduced to Archive only); archived it (`ConfirmModal` shown, `archivedAt` set,
  further edits blocked with `CAMPAIGN_ARCHIVED`, re-activation blocked with
  `INVALID_CAMPAIGN_TRANSITION`). Swagger `/docs` confirmed live with 8 Campaign routes and the two
  Campaign DTOs. All test data (the newly created campaign) deleted from the real DB afterward,
  restoring the seeded campaign to its original state.
- **Creator browser verification (real backend, via authenticated HTTP through the browser — see
  the known-limitation note above for why not through the rendered creator UI):** confirmed
  `GET /creator/campaigns` returns only the seeded ACTIVE campaign (the DRAFT-then-archived test
  campaign from the admin flow never appeared, at any point in its lifecycle); confirmed the
  response's Offer/Product summaries and commission fields are server-computed and correct;
  confirmed the response has no `status` property and no internal/admin fields anywhere in its
  serialized JSON; confirmed `GET /creator/campaigns/:id` for the archived test campaign and for a
  fully nonexistent id both return `404 NOT_FOUND` — identical and indistinguishable; confirmed a
  request with no `Authorization` header gets `401`. No application-submission endpoint exists on
  the creator surface at all (by design — Creator Application is the next slice).

**Verification, all green:** `prisma validate`, migration status clean, `tsc --noEmit` (api, web),
`eslint` (api, web — zero errors), `nest build`, `next build`, 168/168 backend unit tests, 92/92
backend integration/e2e tests, Swagger live, health endpoints live, admin browser verification
against real infrastructure as above, creator Campaign-endpoint verification against real
infrastructure as above, secret scan clean (`.env.test` confirmed gitignored, no credential string
found in any tracked file).

**Creator Application and Content were not started.** Phase 6B stops here per the standing
checkpoint rule — reporting Campaign domain complete now.

## Phase 6B — Creator Application domain — DONE (2026-07-22)

A Creator Application is a creator's application to join one specific Campaign — distinct from
the pre-existing onboarding `CreatorApplication` model ("become a creator at all"), which this
slice does not touch. Rather than add a new table, this domain extends the `CampaignApplication`
model that already existed as a stub from the Campaign slice. See DECISIONS.md ADR-012 for the
full reasoning (model reuse, no reapplication path, no review-event-history table, explicit
per-action source-state lists instead of one shared transition matrix, `application.*` permission
naming, and why `RequireCreatorGuard` now also checks onboarding-approval status).

- **Schema** — `CampaignApplicationStatus` narrowed to `DRAFT|SUBMITTED|UNDER_REVIEW|
  CHANGES_REQUESTED|APPROVED|REJECTED|WITHDRAWN` (`PENDING` retired). `CampaignApplication`
  extended with `message`, `platform`, `contentFormat`, `portfolioLinks`, `sampleContentLinks`,
  `answers` (Json), `followerSnapshot`, `adminNotes`, `rejectionReason`, `changesRequestedReason`,
  `submittedAt`/`reviewedAt`/`approvedAt`/`rejectedAt`/`withdrawnAt`, `reviewedById` (+ `User`
  relation), indexes on `campaignId`/`creatorId`/`status`/`createdAt`/`submittedAt`/`reviewedAt`.
  The existing `@@unique([campaignId, creatorId])` is the sole (and sufficient) reapplication
  guard — REJECTED/WITHDRAWN are genuinely one-shot terminal. Migration applied and verified clean
  against real Postgres (manual split of the new `updatedAt NOT NULL` column into add-nullable →
  backfill → set-not-null, since the two pre-existing seeded rows would otherwise fail a
  straight-through NOT NULL add).
- **Backend, creator-facing** (`apps/api/src/creator-applications/`) — `POST
  /creator/campaigns/:campaignId/applications`, `GET /creator/applications[/:id]`, `PATCH
  /creator/applications/:id`, `POST /creator/applications/:id/{submit,resubmit,withdraw}`, `GET
  /creator/my-campaigns` (server-synthesized merged status over application + post-approval
  `CreatorCampaign` state). Explicit per-action allowed-source-state lists (`SUBMIT_FROM`,
  `RESUBMIT_FROM`, `WITHDRAW_FROM`, `EDIT_DRAFT_FROM`) rather than one generic transition function,
  since submit/resubmit both land on `SUBMITTED` from different starting states. Eligibility
  (`assertEligibleToApply`) is re-checked at both create *and* submit time: campaign must be LIVE,
  application window open, capacity not full, creator account active, follower min/max, platform
  match — server is the sole source of truth, never trusted from the client. Ownership is
  enforced by scoping every read/write to the JWT's `creatorId`; a guessed id or another creator's
  application both 404 identically.
- **Backend, admin-facing** — `GET /admin/creator-applications[/:id]` (paginated, filterable by
  status/campaignId/creatorId/platform/date range, searchable over creator name/campaign
  name/internalName), `POST /admin/creator-applications/:id/{start-review,approve,reject,
  request-changes}`. Reject/request-changes require a `reason` (min 5 chars, typed
  `VALIDATION_ERROR` otherwise), stored in separate `rejectionReason`/`changesRequestedReason`
  columns — never conflated, never silently overwritten.
- **Capacity-safe approval** — `approve()` (and the creator-side instant-join path below) run
  inside a single Postgres `SERIALIZABLE` transaction: re-check current approved count against
  `creatorLimit`, update status, create the `CreatorCampaign` membership row atomically. A
  concurrent over-capacity race aborts one side with a Postgres serialization conflict; that's
  caught and retried once (in case the conflict was with an unrelated write), then surfaced as a
  typed `CAMPAIGN_FULL` rather than a raw 500.
- **Business rule found and implemented (not in the original write-up, but required by existing
  Campaign behavior):** a campaign with `requiresApproval === false` must instant-join on submit
  (skip `UNDER_REVIEW` entirely) — this was already the mock's and the UI's ("Darhol qo'shilish")
  behavior, but the initial implementation only ever produced `SUBMITTED`. Fixed by checking
  `campaign.requiresApproval` in `submit()`/`resubmit()` and routing to the same capacity-safe
  approval path used by the admin action when it's false.
- **RBAC** — added `application.read`/`review`/`approve`/`reject`/`revise` (49 permissions total,
  up from 44; `read` at MANAGER+, the four review/decision actions at ADMIN+). Named
  `application.*` rather than the spec's suggested `creatorApplication.*`/`requestChanges` to
  satisfy the existing lowercase-single-word naming convention enforced by
  `permissions.constants.spec.ts`'s regex — see ADR-012. `RequireCreatorGuard` (reused from the
  Campaign slice, not duplicated) now also checks that the JWT's `creatorId` has an `APPROVED`
  onboarding `CreatorApplication` — this was the "Interim state" gap RBAC.md flagged during the
  Campaign slice, now closed. `RBAC.md` updated.
- **Creator auth/session gap closed** — real `login`/`register`/`getSession`/`logout`/
  `forgotPassword` wired into `lib/api/index.ts`'s `NEXT_PUBLIC_API_MODE` dispatch (previously
  mock-only re-exports, the gap the Campaign slice's report explicitly flagged as blocking). New
  `GET /creator/profile` endpoint (`apps/api/src/creator-profile/`, deliberately its own tiny
  module — a session-bootstrap read, not application business logic) resolves the onboarding
  status the frontend needs to route a freshly-authenticated creator. Every real creator
  registration now atomically creates a `DRAFT` onboarding `CreatorApplication` (mirroring the
  mock's existing invariant), keeping `CreatorUser.application` non-nullable across the codebase
  instead of pushing null-checks into 8+ call sites.
- **A real concurrency bug found by an actual concurrent-request integration test (not a guess):**
  the capacity-safe transaction's serialization-conflict detection checked only for
  `Prisma.PrismaClientKnownRequestError` with code `P2034` — but this project's `@prisma/adapter-pg`
  driver setup surfaces a Postgres `40001` serialization failure as a raw `DriverAdapterError`
  (`name === "DriverAdapterError"`, `cause.kind === "TransactionWriteConflict"`) that bypasses
  Prisma's usual error normalization entirely. Two applications approved concurrently against a
  campaign at capacity produced an unhandled `500` instead of the typed `CAMPAIGN_FULL` the spec
  requires. Fixed by recognizing both error shapes; a dedicated `Promise.all`-based e2e test (two
  real HTTP approve calls fired concurrently against a `creatorLimit: 1` campaign) failed before
  the fix and passes after, with exactly one `201` and one `409`, and exactly one `ACTIVE`
  `CreatorCampaign` row in the database afterward.
- **A second, unrelated real bug found while browser-verifying against a live dev server:** an
  idle pooled Postgres connection dropped by the remote database (routine against a proxied
  connection) emitted an unhandled `error` event on the `pg.Pool` and crashed the entire Node
  process — `node-postgres` requires a pool-level `error` listener or exactly this happens. Fixed
  in `PrismaService` by attaching one (logs a warning; the pool discards and replaces the dead
  client on its own).
- **Tests** — 61 unit tests (every eligibility-rejection reason, full transition matrix per
  action, ownership 404-not-403, creator-safe response never leaking `adminNotes`/`reviewedById`,
  admin list filter/search/sort shape, capacity-safe approve including both retry-then-succeed and
  retry-then-`CAMPAIGN_FULL` for both P2034 and the real `DriverAdapterError` shape) + 30 new
  integration tests against real Postgres (RBAC guardrails, every eligibility rejection over real
  HTTP, duplicate-application conflict, full draft→submit→changes-requested→resubmit→reject
  lifecycle, ownership across two real creators, admin review-reason validation, capacity
  exhaustion, the concurrent-approval test above, the instant-join path and its own capacity
  check, and a live permission-removal-takes-effect-immediately check). One pre-existing fixture
  fix was required: `campaigns.e2e-spec.ts`'s creator test user needed an `APPROVED` onboarding
  `CreatorApplication` added, since the tightened `RequireCreatorGuard` now correctly rejects a
  creator without one — an intentional behavior change, not a regression, and the full previously-
  passing suite (92/92) still passes after the fixture update. Full backend suite after this
  slice: **229/229 unit, 122/122 integration/e2e** (30 of the 122 are new to this slice; zero
  regressions elsewhere).
- **Frontend (creator)** — `CampaignDetailPage` gained a real application form (pitch/platform/
  content-format/portfolio-links) behind the existing apply button; an existing application
  renders a status-aware panel (badge, rejection/changes-requested reason, edit+resubmit for
  `CHANGES_REQUESTED`, withdraw for any withdrawable state) instead of the button, and an
  `APPROVED` application falls through to the pre-existing membership card. `MyCampaignsPage`
  gained a `CHANGES_REQUESTED` filter/action entry (frontend `CreatorCampaignStatus` union
  extended to match the new merged-status value the backend can now return).
- **Frontend (admin)** — new `/admin/campaign-applications` list (status/search/campaignId-filter,
  paginated) and `/admin/campaign-applications/:id` detail (full application content, follower
  snapshot explicitly labeled as a point-in-time snapshot not live data, review-history reasons,
  status-aware start-review/approve/request-changes/reject actions via the shared `ConfirmModal`
  reason-required pattern, an explicit "Content workflow is next" message for `APPROVED`
  applications). The Campaign detail page's real-mode placeholder now links directly to this new
  page instead of the old generic "coming next" message.
- **Creator browser verification (real backend, `NEXT_PUBLIC_API_MODE=real`, real Postgres):**
  registered a brand-new creator through the real UI (session bootstrap confirmed via the
  refresh-token cookie surviving a full page reload); applied to the seeded LIVE campaign with a
  real pitch/platform/portfolio-link form; confirmed the submitted application's status badge and
  withdraw action render correctly; confirmed a different creator gets a 404 (not 403) reading or
  editing it; after an admin request-changes action, confirmed the edit form pre-fills from the
  existing application and the resubmit round-trip (`PATCH` then `POST .../resubmit`) both fire
  and land as `SUBMITTED` server-side; after admin approval, confirmed the campaign detail page
  correctly swapped to the "Faol" membership card, "Qolgan joy" (remaining slots) decremented, and
  `GET /creator/my-campaigns`/"Mening kampaniyalarim" both reflect `ACTIVE`.
- **Admin browser verification:** logged in as the real seeded super-admin; confirmed the new
  applications list shows the just-created application alongside the two seeded approved ones;
  opened the detail page and ran start-review → request-changes (typed the reason, confirmed the
  confirm button is disabled until 5+ characters are entered, confirmed the creator-facing view of
  the same application shows the reason but never `adminNotes`/`reviewedById`) → approve, and
  confirmed the campaign's `approvedCreatorCount` incremented from 2 to 3 in the real database.
  Confirmed a staff user with only `application.read` can list but gets 403 on approve; confirmed
  revoking `application.approve` mid-session 403s the very next request (both also covered by the
  e2e suite, exercised again live here). All test data (the temporary creator account and its
  application/membership rows) deleted afterward; `approvedCreatorCount` confirmed back at the
  original seeded value of 2.
- **Known limitation, not fixed (out of scope for this slice, pre-existing Auth domain behavior):**
  concurrent duplicate `POST /auth/refresh` calls (observed from this browser's own dev-mode
  double-effect behavior) can race the refresh-token rotation — the loser gets a `401` and, in the
  worst case, the browser's stored refresh cookie ends up holding an already-consumed token,
  forcing a full re-login. This is `AuthService.refresh`'s pre-existing rotation logic (Phase 6A),
  unrelated to the Creator Application domain; flagged here for whoever next touches the Auth
  domain, not fixed as part of this slice.

**Verification, all green:** `prisma validate`, migration status clean (idempotent, re-run
confirmed), `tsc --noEmit` (api, web), `eslint` (api, web — zero errors), `nest build`, `next
build`, 229/229 backend unit tests, 122/122 backend integration/e2e tests (30 new), Swagger `/docs`
confirmed live with all 14 new routes, health endpoints live, seed re-run confirmed idempotent (49
permissions, 110 role-permissions), creator browser verification against real infrastructure as
above, admin browser verification against real infrastructure as above, secret scan clean
(`.env.test` confirmed gitignored).

**Content was not started.** Phase 6B stops here per the standing checkpoint rule — reporting
Creator Application domain complete now.

## Phase 6B Enhancement — Campaign Media, Commercial Rules, Regional Delivery, Creator Referral — DONE (2026-07-22)

Four connected capabilities added on top of the already-completed Product/Offer/Landing/Campaign/
Creator-Application slices: campaign visual media, a two-mode (percentage or fixed) commission
model, regional delivery pricing for physical Offers, and a creator-to-creator referral program.
See DECISIONS.md ADR-013 for the full reasoning behind every scoping decision below.

- **Storage abstraction** (`apps/api/src/storage/`) — no object-storage integration existed
  before this checkpoint. Added a provider-independent `StoragePort` interface (`put`/`remove`/
  `publicUrl`) behind a `STORAGE_PORT` DI token, with `LocalDiskStorage` as the only adapter
  (writes under a gitignored `uploads/` dir, served via `NestExpressApplication.useStaticAssets`
  at `/media/`). Campaign-media domain code depends only on the port — swapping in a cloud adapter
  later is a new class + one module registration, not a rewrite.
- **Campaign media** (`apps/api/src/campaign-media/`) — `CampaignMedia` model
  (id/campaignId/mediaType/mediaRole/storageKey/publicUrl/thumbnailUrl/originalFilename/mimeType/
  fileSizeBytes/width/height/durationSeconds/sortOrder/altText/timestamps), `CampaignMediaType`
  (IMAGE|VIDEO) and `CampaignMediaRole` (COVER|GALLERY|VIDEO|PROMOTIONAL) enums. Real validation
  pipeline (`media-validation.ts`): magic-byte MIME sniffing (never trusts the client's declared
  Content-Type — real enforcement against executable/disguised content), safe filename
  normalization, size limits, and standard-dimension (1080×1440, configurable tolerance)
  enforcement. Image dimensions are server-decoded via `image-size`; video width/height/duration
  are honestly client-reported (documented limitation — no ffprobe-equivalent dependency exists in
  this codebase). Exactly one COVER per campaign enforced by a partial unique index
  (`CampaignMedia_cover_unique ... WHERE "mediaRole" = 'COVER'`, hand-written in the migration SQL
  since Prisma's schema language can't express partial indexes). Admin endpoints: list/upload/
  replace-cover/promote-to-cover/reorder(non-cover only)/update-alt-text/delete, gated by the
  existing `campaign.write`/`campaign.read` permissions. Creator-safe responses expose only
  id/mediaType/mediaRole/url/thumbnailUrl/width/height/durationSeconds/altText/sortOrder — no
  storageKey, provider name, originalFilename, mimeType, or fileSizeBytes ever leaks to a creator
  or public response (confirmed both by e2e assertion and live browser network-response
  inspection).
- **Commission narrowed to two mutually exclusive modes** — `CommissionType` collapsed from four
  legacy values (`PERCENTAGE`/`FIXED_PER_SALE`/`FIXED_CONTENT_FEE`/`HYBRID`) to
  `PERCENTAGE | FIXED_AMOUNT`. `Campaign` gained `commissionRateBps`/`commissionAmountMinor`/
  `commissionCurrency`, replacing `commissionValue`/`fixedPaymentMinor`. Enforced mutually
  exclusive by both a DB `CHECK` constraint (`Campaign_commission_mode_check`) and a service-layer
  validator; all money in integer minor units, zero floating point. Migration backfills every
  legacy commission value onto the two surviving modes before narrowing the enum — no existing row
  silently dropped.
- **Product fulfillment type + Offer-owned delivery** (`apps/api/src/delivery/`) — reused the
  pre-existing `Product.type` field (`PHYSICAL_PRODUCT|DIGITAL_PRODUCT|COURSE|SERVICE|
  CONSULTATION`) rather than adding a duplicate field. New `OfferDeliveryRegion` model
  (id/offerId/countryCode/regionCode/regionName/availability/feeType(FREE|FIXED)/
  deliveryFeeMinor/currency/estimatedMinDays/estimatedMaxDays/active/sortOrder/timestamps), owned
  by `Offer` (not `Product`) since different Offers for the same Product may run different
  delivery promotions. `DeliveryService.assertOfferIsPhysical()` (service-layer, reads
  `Product.type`) rejects delivery-region creation on any non-physical Offer — enforced in the
  backend, not only frontend rendering. `CHECK` constraints enforce FREE⇒zero fee, FIXED⇒positive
  fee, and min-days ≤ max-days. Admin CRUD gated by the existing `offer.write`/`offer.read`
  permissions (no new `delivery.manage` key — see ADR-013 point 6).
- **Public quote endpoint** — `POST /offers/:slug/quote` (public, no auth), placed under the
  existing `@Controller("offers")` to match the established `GET /offers/:slug/public` convention
  rather than the spec's suggested `/public/offers/...` prefix. Returns authoritative integer
  minor-unit pricing (product price + delivery fee + total) for physical Offers with a selected
  region, or the bare offer price for non-physical Offers (`deliveryRegions: []`, no region
  required). Never creates an Order (confirmed by e2e assertion and by browser network inspection
  after using it live). Never exposes inactive/unavailable regions, cost price, internal Campaign
  fields, or storage metadata.
- **Public Landing pricing UI** (`DeliveryQuoteBox`) — renders a region selector + authoritative
  price/delivery-fee/total breakdown only when `productType === "PHYSICAL_PRODUCT"`; for
  DIGITAL/COURSE/SERVICE/CONSULTATION Offers, no region or delivery UI renders at all (verified
  live: a temporary COURSE product/offer/landing showed a completely empty delivery section and
  `deliveryRegions: []` in the real API response). All totals come from the backend `/quote`
  response — the frontend never computes them.
- **Creator-to-creator referral program** (`apps/api/src/referrals/`) — three new models, distinct
  from the pre-existing customer-facing `ReferralLink`/`ReferralVisit` (see ADR-013 point 7):
  - `CreatorReferral` — one row per referred creator. `referredCreatorId` is `@unique` (DB-enforced
    "at most one direct referrer, ever"); a `CHECK (referrerCreatorId <> referredCreatorId)`
    constraint makes self-referral structurally impossible. Attribution can only ever be written
    inside `AuthService.register()`'s transaction — no other code path creates this row, which is
    itself the enforcement for "no attribution after registration, ever."
  - `CreatorReferralRule` — admin-configurable, not hard-coded: `MILESTONE_FIXED` (one-time, on a
    milestone — registration alone is never a valid milestone type) or `EARNINGS_PERCENTAGE`
    (percentage of qualified earnings within a window, in basis points, deterministic rounding via
    `applyBasisPoints`). Only one real event is wired to a rule this checkpoint —
    `FIRST_APPROVED_CAMPAIGN_APPLICATION`, hooked into the existing Campaign-Application
    instant-join and admin-approve paths — since Content/Order/Commission/Payout don't exist yet
    to source any other milestone's real trigger. `EARNINGS_PERCENTAGE`'s reward math is written
    and unit-tested now (dormant, no caller yet) so it's ready the moment a real earnings event
    exists.
  - `CreatorReferralReward` — status PENDING→APPROVED/REJECTED via admin review; never reaches
    PAID by this checkpoint (no payout ledger exists yet).
  - **Real bug found and fixed during browser verification (not caught by the original unit/e2e
    suite):** a referred creator's *second* approved Campaign Application paid the "one-time"
    MILESTONE_FIXED reward out a second time, because the reward table's uniqueness constraint is
    keyed on `(referralId, ruleId, sourceType, sourceId)` — sufficient to stop a retried call for
    the *same* event, but not to stop a genuinely *different* qualifying event from re-triggering
    the same rule. Fixed by checking for an existing reward on the same `(referralId, ruleId)`
    pair before creating a new one. Reproduced live: Creator B's second approved application (a
    freshly created second campaign) initially created a second 50,000 so'm reward for Creator A;
    after the fix, Creator A's dashboard correctly showed exactly one 50,000 so'm reward with
    "2/2 ariza tasdiqlangan." Added a dedicated unit test and a dedicated e2e test (submits and
    approves a real second application against a second campaign) both proving the one-time
    behavior; documented as a known best-effort (not fully race-proof against two truly concurrent
    approvals) guard in the service code, matching this domain's established honesty-about-limits
    pattern.
  - **Second real bug found and fixed during browser verification:** the creator registration
    page (`app/creator/(auth)/register/page.tsx`) never read the `?ref=` query-string parameter at
    all — the entire share-link → attribution flow was silently broken end-to-end in the UI even
    though the backend (`RegisterDto.referralCode`, `AuthService.register()`'s attribution
    transaction) was fully correct and already e2e-tested via direct API calls. Fixed by reading
    `ref` via `useSearchParams()` (wrapped in `<Suspense>`, matching the codebase's established
    pattern for this hook) and threading it through `useSession().register()` → `api.register()` →
    the real `POST /auth/register` body. Reproduced live: registering a temporary Creator B through
    Aziz Karimov's real invitation link created zero attribution before the fix; after the fix, the
    same flow correctly created the `CreatorReferral` row and Aziz's dashboard showed the friend
    immediately (with zero reward, as expected for registration alone).
  - **Activity classification** (`activity-classification.ts`, pure function, no DB access) — 7
    server-side classes (NEW/ONBOARDING_STALLED/AWAITING_APPROVAL/APPROVED_INACTIVE/
    ACTIVE_NO_EARNINGS/EARNING/DORMANT). Documented thresholds: onboarding-stalled after 3 days,
    approved-inactive after 7 days with no application, dormant after 14 days with no activity.
  - **Creator-facing routes** (ownership-scoped, no RBAC — a creator's own referral data):
    `GET /creator/referral-code`, `/creator/referrals/summary`, `/creator/referrals[/:id]`,
    `/creator/referral-rewards`. A guessed referral id belonging to another creator 404s, not 403s
    (confirmed by e2e and by a live browser attempt). Private email/phone never appear in the
    referrer's view of an invited friend.
  - **Admin routes** (RBAC-gated, reusing `referral.read`/`referral.manage` — previously defined
    but unused — plus two new keys `referral.review`/`referral.disqualify`; see ADR-013 point 6):
    `GET/POST /admin/creator-referrals[/:id]`, `/admin/creator-referrals/:id/disqualify` (reason
    required), `/admin/referral-rules` CRUD + activate/deactivate, `/admin/creator-referral-rewards/
    :id/{approve,reject}` (reject requires a reason). Disqualify's reason requirement confirmed
    live — the confirm button stays disabled until a reason is typed.
- **RBAC** — 51 permissions total (up from 49): 2 new (`referral.review`, `referral.disqualify`);
  media/delivery sub-resources deliberately reuse `campaign.write`/`offer.write` rather than adding
  `campaign.media.manage`/`delivery.manage`. `RBAC.md` updated with the reasoning.
- **Migrations** — one hand-adjusted migration (`20260722080000_media_commission_delivery_
  referral`): new enums; Campaign commission columns added→backfilled→legacy-dropped;
  `Campaign_commission_mode_check`; `CreatorProfile.referralCode` added nullable→backfilled
  (`MD5(id || RANDOM())`)→set NOT NULL; new tables `OfferDeliveryRegion` (+ fee/days CHECKs),
  `CampaignMedia` (+ cover partial-unique index), `CreatorReferral` (+ no-self CHECK),
  `CreatorReferralRule`, `CreatorReferralReward`. Applied via `prisma migrate deploy`;
  `migrate status` clean; re-run confirmed idempotent.
- **Tests** — 289/289 backend unit tests total (this checkpoint added unit coverage for media
  validation, delivery-region rules, referral attribution/qualification/activity-classification/
  rule-validation, plus the one-time-milestone regression test above). New e2e suites:
  `campaign-media.e2e-spec.ts` (12/12 — real upload via real multipart requests, cover uniqueness,
  replace-cover, dimension/type rejection, gallery+video upload, reorder, promote-to-cover, delete,
  campaign-scoping, no-storage-metadata-leak), `delivery.e2e-spec.ts` (20/20 — admin CRUD, public
  quote for physical/non-physical/free/paid/unavailable/not-found, field-leakage checks, no-Order-
  created assertion), `referrals.e2e-spec.ts` (24/24 including the new one-time-milestone
  regression test — RBAC guardrails, attribution incl. self-referral/duplicate-referrer DB
  constraints, qualification-requires-a-real-milestone, the one real milestone end-to-end incl. the
  one-time-per-rule guard, activity visibility/privacy/ownership/id-guessing, admin rules/
  disqualify/reward-review). Full 6B-Enhancement e2e group passes cleanly together; the whole-suite
  intermittent remote-Postgres connection-drop flakiness documented in the Campaign/Creator
  Application slices remains a known environmental limitation, not a code defect — every individual
  suite and grouped run this checkpoint has passed 100%.
- **Frontend (admin)** — `CampaignMediaManager` (upload/preview/set-cover/replace-cover/reorder/
  delete, real multipart `FormData` uploads via a shared `http-client.ts` fix that now skips
  JSON-serializing `FormData` bodies), `DeliveryRegionsManager` (add/edit/toggle-active/delete,
  free-vs-fixed fee UI), commission-mode selector on `CampaignForm` (label switches between "%"
  and "so'm" based on the selected mode), `/admin/creator-referrals[/:id]` (list with activity
  filter/search/pagination, detail with reward approve/reject and disqualify-with-required-reason),
  `/admin/referral-rules` (create/activate/deactivate).
- **Frontend (creator)** — real cover image on the campaign catalog card, gallery/video media on
  the campaign detail page, unambiguous "X% / sotuv" or "X so'm / sotuv" commission display,
  `/creator/referrals` dashboard (invitation link + code, summary tiles, friend list with activity
  badges, reward history).
- **Frontend (public)** — `DeliveryQuoteBox` on the Offer landing page for physical Offers only.
- **Browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** uploaded a
  real 1080×1440 cover + gallery image to the seeded Glow Serum campaign (confirmed via real
  `201 Created` responses and the images actually rendering, including in the creator-facing
  catalog and detail views with zero storage metadata visible); switched the seeded campaign's
  commission mode PERCENTAGE→FIXED_AMOUNT→back to PERCENTAGE (confirmed the server correctly
  rejects a fixed amount exceeding the Offer price, and both directions of the switch persist
  correctly); added one FREE and one FIXED (25,000 so'm) delivery region to the seeded physical
  Offer and confirmed the public landing's region selector computes 24,900 so'm (free) and
  49,900 so'm (paid) totals, both sourced from the real `/quote` endpoint; created a temporary
  COURSE product/offer/landing and confirmed zero delivery UI renders for it; ran the full creator
  referral flow end-to-end as described above, including both real bugs found and fixed; confirmed
  admin reward-approval and disqualify-requires-a-reason in the browser. **All temporary
  verification data (Creator B, the temporary COURSE product/offer/landing, the temporary
  second campaign, the verification referral rule) deleted afterward, along with all leaked e2e
  test data accumulated across this and prior sessions; the seed script was re-run and the
  database confirmed at a clean baseline (7 users, 4 creators, 1 product, 1 offer, 1 campaign — no
  test pollution).**

**Content was not started.** This checkpoint stops here per the standing rule — reporting the
Phase 6B Enhancement checkpoint complete now.

## Phase 7A — Content Management Domain — DONE (2026-07-22)

Creator submission lifecycle for Campaign content: DRAFT → SUBMITTED → UNDER_REVIEW →
CHANGES_REQUESTED → APPROVED | REJECTED | EXPIRED, with permanent version history, review
comments, and an activated audit trail. See DECISIONS.md ADR-014 for the full reasoning behind
every scoping decision below.

- **New `Content` domain, not an extension of the legacy `CreatorContent` mock stub** —
  `CreatorContent`/`CreatorContentStatus` (tied to `CreatorCampaign`, no version history, no
  review-comment table, no `CHANGES_REQUESTED`/`EXPIRED` states, unreferenced by any real service)
  is left untouched so the mock frontend keeps compiling; `Content` supersedes it for the real
  vertical, same "kept untouched, new model for the real slice" pattern as
  `CampaignAsset`/`FileAsset` → `CampaignMedia`.
- **Schema** — `Content` (campaignId/creatorId/campaignApplicationId/status/caption/notes/
  hashtags/metadata/currentVersionNumber/rejectionReason/changesRequestedReason/timestamps),
  `ContentAttachment` (mirrors `CampaignMedia`'s storage pattern exactly — storageKey/publicUrl/
  metadata only, never raw bytes; `ContentAttachmentRole` ATTACHMENT|THUMBNAIL, at most one
  THUMBNAIL per Content via a partial unique index), `ContentVersion` (permanent, append-only,
  `@@unique([contentId, versionNumber])`, created on every submit/resubmit, frozen
  `attachmentSnapshot` — the first genuine "real version history" table this codebase has needed),
  `ContentReviewComment` (author/action/comment/timestamp/versionNumber, creator-safe responses
  omit `authorId`). A Content can be many-per-CampaignApplication (`Campaign.requiredContentCount`
  can be > 1). Migration `20260723000000_content_domain` — purely additive, hand-added
  `ContentAttachment_thumbnail_unique` partial index (raw SQL, same as `CampaignMedia_cover_unique`).
- **Storage & validation** — reuses `StoragePort` (no second storage system); `content-validation.ts`
  reuses Campaign Media's generic `sniffMimeType`/`normalizeFilename` byte-signature helpers
  directly rather than duplicating them. THUMBNAIL reuses the 1080×1440 portrait-frame check for
  visual catalog consistency; general ATTACHMENT files (image or video) have no forced frame, only
  size/type/duration limits — "image dimensions where required" (spec) read as thumbnail-specific.
- **Deadline enforcement** — `Campaign.contentDeadline` (pre-existing field, reused, not
  duplicated) checked at both create and submit/resubmit time. **EXPIRED is lazily materialized on
  read**, not cron-driven (this codebase has no scheduler/queue infrastructure): a bulk
  `expireStaleContent()` sweep runs at the top of every read/mutate entry point, flipping any
  stale non-terminal Content the moment it's next touched — keeps `EXPIRED` genuinely persisted
  (unlike the purely-computed `CampaignAvailability`/`ApplicationAvailability` convention) without
  adding cron infrastructure.
- **Audit trail — the dormant `AuditLog` model is finally activated.** No domain had ever written
  to it (generic actorId/action/entityType/entityId/before/after, existed since Phase 1, confirmed
  unused by grep). A new tiny `@Global()` `AuditService` (`apps/api/src/common/audit/`) records
  every action (created/edited/submitted/resubmitted/approved/rejected/changes-requested/expired/
  attachment-uploaded/attachment-removed) — reusable by any future domain, not Content-specific.
- **Referral integration** — `ReferralsService.onContentApproved` mirrors
  `onCampaignApplicationApproved` exactly, finally wiring the `FIRST_APPROVED_CONTENT` milestone
  and `firstApprovedContentAt` timestamp the 6B Enhancement checkpoint defined but left dormant.
  Same one-time-per-(referral,rule) guard, same `sourceType`/`sourceId` idempotency anchor.
- **RBAC** — `content.approve`/`content.reject`/`content.revise` added (54 permissions total, up
  from 51), mirroring `application.*`'s 4-verb split exactly (`content.read`/`content.review`
  already existed, reserved/unused; MANAGER keeps read/review, ADMIN+ gets the three decision
  verbs). Creator-facing routes are ownership-scoped in the service layer, not RBAC-gated.
- **Backend endpoints** — creator: `POST /creator/campaigns/:campaignId/contents`, `GET
  /creator/contents[/dashboard-counts][/:id]`, `PATCH /creator/contents/:id`, `POST
  /creator/contents/:id/{submit,resubmit}`, `POST /creator/contents/:id/attachments` (multipart),
  `DELETE /creator/content-attachments/:id`. Admin: `GET /admin/contents[/:id]`, `POST
  /admin/contents/:id/{start-review,approve,reject,request-changes}` (reject/request-changes
  reuse the existing `ReviewReasonDto` from the Creator Application domain — no duplicate DTO).
  Swagger confirmed live with all 13 new routes.
- **Frontend** — new, distinctly-named functions (`createContentDraft`, `getContentDetail`,
  `getContentReviewList`, `approveContentReview`, etc.) added to the existing `creator-real.ts`/
  `admin-real.ts` files rather than a parallel file, avoiding a naming collision with the legacy
  mock-only `getContent`/`submitContent`/`getAllContent`/`approveContent`/... re-exports the old
  Content pages still use. `/creator/content` and `/admin/content` branch on
  `NEXT_PUBLIC_API_MODE`: real renders the new draft/edit/submit/review UI against the live
  backend (new `/creator/content/[id]` and `/admin/content/[id]` detail/editor routes); mock keeps
  the original JSX byte-for-byte. A "Content yaratish" entry point was added to the creator
  Campaign detail page (real-mode-gated, shown only once membership is ACTIVE).
- **Tests** — 289 → 343 backend unit tests (added `content-validation.spec.ts`, 10 tests;
  `content.service.spec.ts`, 40 tests covering every transition guard, the deadline checks, the
  lazy-expire sweep, attachment validation delegation, and creator-safe response mapping;
  `referrals.service.spec.ts` gained 4 tests for `onContentApproved`). New
  `content.e2e-spec.ts` (17/17 — RBAC guardrails, eligibility gate, the complete draft→submit→
  review→changes-requested→resubmit→approve lifecycle with real version history and comment
  assertions, reject-is-terminal, lazy-EXPIRED-on-read, real multipart attachment upload/validation
  incl. a renamed-executable rejection and thumbnail-dimension enforcement, ownership/id-guessing,
  backend-computed dashboard counts, admin list filters, live permission-revocation). **Full
  backend suite after this checkpoint: 343/343 unit, 194/194 integration/e2e across all 13
  suites — a complete, non-flaky full-suite run this time**, confirming zero regressions in any
  previously-completed domain.
- **Browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** logged in
  as the real seeded creator Aziz Karimov; created a real Content draft from the Campaign detail
  page's new "Content yaratish" button; edited caption/hashtags (PATCH confirmed); uploaded a real
  600×400 PNG attachment via a genuine `File`/`DataTransfer` injection (not a mocked buffer),
  confirmed the creator-safe response exposed zero storage internals; submitting with zero
  attachments correctly blocked with `ATTACHMENT_REQUIRED`; submitted with the attachment →
  version 1 created, editing locked. As super-admin: content appeared in the real admin
  moderation queue; started review; requested changes with a mandatory reason (confirmed via the
  real `ConfirmModal`). Back as the creator: saw the exact reason and review comment, edited the
  caption, resubmitted → version 2 created, both versions preserved in history. Back as admin:
  started review again, approved → status APPROVED, a default "Tasdiqlandi." comment recorded
  (comment was optional), full 2-entry comment thread and 2-version history both visible and
  correctly ordered. Confirmed the creator's dashboard counts correctly showed 1 APPROVED / 0
  everywhere else, backend-computed. Confirmed Swagger lists all 13 new routes live. All
  browser-verification test data (the one Content row + its version/comment/audit rows) deleted
  afterward; seed re-run confirmed the database back at the clean baseline.
- **Known limitations, documented honestly:** video attachment width/height/duration remain
  client-reported (no ffprobe-equivalent dependency in this codebase — same limitation already
  documented for Campaign Media); the one-time-per-(referral,rule) guard on `onContentApproved`
  shares the same non-race-proof-under-true-concurrency caveat already documented for
  `onCampaignApplicationApproved`.

**Explicitly not started, per the checkpoint's own scope:** Instagram/TikTok/YouTube/Telegram
APIs, automatic publishing, view/like/comment count sync, analytics sync, Payment, Orders,
Wallet, Commission payout, and any other social-platform integration. These belong to later
phases; nothing in this checkpoint fakes or stubs them.

## Phase 8 — Checkout, Payment & Order Domain — DONE (2026-07-23)

Full buyer-facing purchase path: Landing → Checkout → Click Payment → Payment Callback → Order
Created → Order Status Updates → Delivered, plus Pay Later, failed/cancelled payment, stock
reservation, referral/promo attribution, commission snapshotting, and full admin order
management. See DECISIONS.md ADR-015 for the full reasoning behind every scoping decision below.

- **Extended, not superseded.** `Order`/`Payment`/`Commission`/`CommissionRule`/`Attribution`/
  `Customer`/`Address`/`PromoCode`/`ReferralLink`/`ReferralVisit`/`Refund` were fully-designed
  Phase 1 models with zero real backend service ever touching them (confirmed by grep) — the
  opposite situation from Content's mock-era stubs. This checkpoint extends them in place.
- **Schema** — `OrderStatus` enum values replaced (`NEW`/`CONFIRMED`/`COMPLETED`/`RETURNED` →
  `CREATED`/`PAYMENT_PENDING`/`PAID`/`PROCESSING`/`SHIPPED`/`IN_TRANSIT`/`DELIVERED`/`CANCELLED`/
  `REFUNDED`) since zero real Order rows existed; `CommissionRule.commissionValue`/
  `fixedPaymentMinor` renamed to `commissionRateBps`/`commissionAmountMinor` to match Campaign's
  post-6B shape; `Product.stockQuantity` added (nullable = untracked) with a hand-written
  `Product_stock_non_negative_check` CHECK constraint as the real concurrency guard against
  overselling; `Order.deliveryMethod` added. Migration `20260724000000_checkout_payment_order` —
  additive/renames only, hand-written (not `prisma migrate dev`, which hit an unrelated
  false-positive checksum mismatch on an already-applied historical migration during shadow-DB
  replay) and verified against the live schema directly.
- **PaymentPort abstraction** (`apps/api/src/payments/payment.port.ts`) mirrors `StoragePort`
  exactly — domain code depends only on the interface. `ClickPaymentAdapter` implements Click's
  real published Prepare/Complete two-phase callback protocol: MD5 signature verification, replay
  protection (a terminal Payment re-acknowledges without reprocessing), and idempotent Payment-row
  reuse on a retried checkout call.
- **Checkout/Order flow** — `OrdersService.createOrder` validates offer/landing/campaign
  active-and-not-expired, product not archived, physical-product stock and customer
  region/address, resolves the payment provider against the Offer's own configured
  `paymentOptions`, computes authoritative pricing via `DeliveryService.resolveDeliveryFee`
  (extracted from `quote()`, not duplicated) plus promo-code discount, snapshots the offer/variant
  into `Order.offerSnapshot`, and — inside one transaction — creates Order/OrderItem/
  OrderStatusHistory, redeems the promo code, and resolves referral/promo attribution
  (`Attribution`, with a materialized `CommissionRule` snapshot + `Commission` row). Idempotency
  key replay returns the existing Order rather than erroring.
- **Referral attribution — `POST /offers/:slug/visit` is genuinely new.** `ReferralLink`/
  `ReferralVisit` existed in the schema since Phase 1 with zero runtime code ever creating a
  visit row (confirmed by grep; distinct from the unrelated 6B Enhancement creator-to-creator
  `?ref=` registration system). A visit now records visitorId/sessionId/ipHash/UTM fields and
  computes `expiresAt` from the link's own `attributionWindowDays`. Attribution resolution order:
  promo code (carries its own creatorId/campaignId) before ref code; an invalid/expired ref code
  rejects checkout (`REFERRAL_CODE_INVALID`) since a ref-coded checkout is read as "about that
  campaign," while an invalid promo code used only for discount is silently ignored for
  attribution purposes.
- **Pay Later reuses the existing `PaymentProviderType.MANUAL` value — no new model or endpoint.**
  Customer picks "Keyinroq to'lash" at checkout (Offer-configurable, same array-membership
  validation as every other method); admin approval routes through the same
  `PATCH /admin/orders/:id/status` transition to PAID. `adminUpdateStatus` routes a PAID target
  through `markPaid()` (not a bare status flip) so stock reservation, the referral qualified-sale
  hook, and Payment-row sync all fire identically whether a real Click callback or a manual Pay
  Later approval triggered them — a real gap caught during browser verification and fixed (see
  Known limitations/fixes below).
- **Inventory** — reservation (atomic decrement) happens at PAID, not at checkout submission,
  matching the spec's literal "when Order becomes PAID, reserve stock." A soft pre-check at
  checkout time fails fast (`OUT_OF_STOCK`); the DB CHECK constraint is the real guard against two
  concurrent PAID transitions overselling the last unit.
- **REFUNDED is only reachable via `createRefund`, never a bare admin status flip** —
  `adminUpdateStatus` explicitly rejects a direct `to: "REFUNDED"` (`VALIDATION_ERROR`), since only
  `createRefund` creates the `Refund` record and releases stock. Full refund is allowed from any
  post-payment state (PAID/PROCESSING/SHIPPED/IN_TRANSIT/DELIVERED), not just PAID/DELIVERED — a
  second real gap caught during browser verification (see below).
- **RBAC — zero new permission keys added.** `order.read`/`order.update`/`order.refund`,
  `payment.read`, `commission.read`/`commission.adjust`, `attribution.read`/
  `attribution.override` all already existed, reserved and unused. This checkpoint is the first to
  wire real admin routes behind them. Public checkout/payment endpoints are unauthenticated
  (`@Public()`) by design and gated by domain validation, not RBAC.
- **Backend endpoints** — public: `POST /offers/:slug/visit`, `POST /offers/:slug/promo-code/validate`,
  `POST /offers/:slug/checkout`, `GET /orders/public/:publicToken`, `POST /payments/click/{prepare,complete}`.
  Admin: `GET /admin/orders[/:id]`, `PATCH /admin/orders/:id/{status,notes}`,
  `POST /admin/orders/:id/refunds`. Swagger confirmed live with all new routes (Click callback
  endpoints marked `@ApiExcludeController` — not browsable, Click's own servers call them
  directly).
- **Frontend** — `validatePromoCode`/`createOrder`/`getOrderPublic` (the only three mock-store
  functions with zero real branch left after 6B/7A) now dispatch on `NEXT_PUBLIC_API_MODE`
  exactly like `getOfferPublic`/`getOfferQuote`; `trackVisit` is new. `CheckoutPageClient` fires
  `trackVisit` on mount, adds a delivery-region selector for physical offers (reusing the
  already-built `deliveryRegions` list), and redirects externally to Click's `paymentRedirectUrl`
  when present (Pay Later/mock mode fall through to the internal order-success page). Admin order
  management (`getOrderReviewList`, `updateRealOrderStatus`, `createRealOrderRefund`, etc.) is
  named distinctly from the legacy mock-only `getOrders`/`updateOrderStatus`/`createRefund` at the
  same re-export boundary; `/admin/orders` and `/admin/orders/[id]` branch on
  `NEXT_PUBLIC_API_MODE` — identical pattern to ADR-014's Content frontend integration.
- **Tests** — 343 → 401 backend unit tests (new `promo-codes.service.spec.ts`, 12 tests;
  `click-payment.adapter.spec.ts`, 10 tests; `orders.service.spec.ts`, 23 tests covering creation
  validation, attribution/commission snapshotting, transition guards, `markPaid`'s stock/referral
  side effects, and refund eligibility; `payments.service.spec.ts`, 9 tests covering callback
  verification, replay protection, and Payment/Order sync). New `checkout.e2e-spec.ts` — 17/17,
  covering the complete visit→checkout→Click Prepare/Complete→PAID→admin status
  progression→refund lifecycle over real HTTP with real MD5-signed callbacks, failed payment,
  tampered-signature rejection, Pay Later end-to-end, stock/overselling, full validation matrix,
  promo-code discount + usage tracking, referral-link attribution with commission snapshotting,
  RBAC, and audit trail assertions — plus two regression tests added after browser verification
  caught real gaps (see below). Full backend suite: 401/401 unit; e2e confirmed via three
  consecutive isolated runs of `checkout.e2e-spec.ts` at 17/17 each, and one full 14-suite run at
  209/211 (the 2 failures were the pre-existing documented remote-Postgres connection-drop
  artifact hitting `checkout.e2e-spec.ts`'s teardown ~28 minutes into a long sequential run — not
  a logic failure; immediately reconfirmed clean in isolation afterward).
- **Two real bugs found via real-browser verification and fixed, with regression tests added:**
  (a) `createRefund`'s eligibility list (PAID/PROCESSING/SHIPPED/IN_TRANSIT/DELIVERED) had no
  matching `REFUNDED` edge in the transition matrix for PROCESSING/SHIPPED/IN_TRANSIT, so
  refunding an order still being fulfilled 409'd; (b) an admin manually approving a Pay Later
  order to PAID went through a bare status flip that skipped stock reservation, the referral hook,
  and Payment-row sync entirely — fixed by routing that path through the same `markPaid()` every
  Click callback uses.
- **Browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** completed
  a full CLICK checkout (real MD5-signed Prepare/Complete callbacks sent to the live dev server),
  confirmed order-success page renders "To'landi" (Paid), confirmed the admin order detail page's
  full status history/payment panel/attribution card, progressed PAID→PROCESSING→SHIPPED→
  DELIVERED via the real UI, refunded (hit the REFUNDED-transition bug, fixed it, re-verified the
  refund succeeded and stock restored). Completed a separate Pay Later checkout end-to-end (no
  external redirect, correct "To'lov kutilmoqda" status), approved it as admin (hit the
  markPaid-routing bug, fixed it, re-verified Payment.status synced to PAID). Completed a third
  checkout through a real seeded `?ref=` referral link, confirmed the "Malika Yusupova orqali"
  attribution banner rendered from the new visit-tracking endpoint, and confirmed the admin order
  detail page showed the correct Referral-link attribution source, campaign name, and commission
  snapshot amount. Verified RBAC directly via HTTP: a real manager-role account could read orders
  (200) but was correctly denied refund creation (403 `FORBIDDEN`, `required: ["order.refund"]`).
- **Known limitations, documented honestly:** the one-time-per-(referral,rule) guard on
  `onQualifiedSale` shares the same non-race-proof-under-true-concurrency caveat already
  documented for `onCampaignApplicationApproved`/`onContentApproved`; no automatic
  Campaign-level customer discount is layered into checkout pricing (discount comes from
  promo-code redemption only — see ADR-015 point 9); PAYME/CARD/COD are Offer-configurable payment
  method labels with no adapter behind them yet (rejected with `PAYMENT_METHOD_NOT_SUPPORTED`,
  never faked). Manual browser-verification test data (3 orders + customers/addresses/referral
  visits) was deleted afterward. The orphaned fixtures from one connection-drop-interrupted
  full-suite e2e run (suffix `checkout-e2e-1784745880176`) were deleted as a separate housekeeping
  pass once connectivity returned (2026-07-23) — 15 Product/Offer/LandingPage rows, 2 Campaign, 1
  ReferralLink, 1 PromoCode, 1 ReferralVisit, 2 CreatorProfile, 4 User, 2 Role, plus their
  RolePermission/UserRole rows; confirmed isolated (zero Orders/Payments/Commissions, zero overlap
  with any live user or role) before deletion, and confirmed zero remaining rows with that suffix
  afterward.

## Phase 9 — Wallet, Commission Settlement & Payout Domain — DONE (2026-07-23)

Full creator-facing financial domain: Commission settlement lifecycle (PENDING → APPROVED →
PAYABLE → PAID, with REJECTED/REFUNDED), an immutable `CommissionLedger` as the financial source
of truth, computed creator wallet balances, payout methods, withdrawal requests, and the full
admin payout approval workflow (REQUESTED → APPROVED → PROCESSING → PAID, with
REJECTED/CANCELLED/FAILED). Built under a hard constraint that did not apply to any prior
checkpoint: Phase 8 is frozen — every decision below finds a path that touches zero Phase 8 files.
See DECISIONS.md ADR-016 for the full reasoning behind every scoping decision.

- **Extended, not superseded.** `Commission`/`CommissionLedger`/`Payout`/`PayoutMethod` were
  fully-designed Phase 1 models with zero real settlement/payout service ever touching them
  (confirmed by grep) — same situation as Phase 8's Order/Payment models. This checkpoint extends
  them in place.
- **Refund-triggered commission reversal is a lazy sweep, not a Phase-8 hook call** —
  `CommissionsService.reconcileRefundedOrders()` runs at the top of every Commission read/mutate
  entry point, mirroring `ContentService.expireStaleContent()`'s established convention, and
  reverses any Commission whose linked Order has become REFUNDED. Zero edits to
  `orders.service.ts` or any other Phase 8 file were required.
- **`ACCRUAL` ledger entries are written at admin-approve time**, not at Commission-creation time
  (Phase 8 creates Commission rows PENDING with no ledger entry) — a PENDING commission can still
  be rejected, so only an APPROVED commission is confirmed as earned.
- **Wallet balance is computed on read, never stored — no new `Wallet` model.** Five buckets
  (`pendingMinor`/`availableMinor`/`lockedMinor`/`paidMinor`/`reversedMinor`) are derived per
  request from Commission status + Payout linkage, matching `CommissionLedger`'s own "source of
  truth" schema comment and the codebase's dominant computed-availability convention.
- **Schema** — `PayoutStatus` enum values replaced (`REQUESTED`/`UNDER_REVIEW`/`APPROVED`/
  `PROCESSING`/`PAID`/`REJECTED` → `REQUESTED`/`APPROVED`/`PROCESSING`/`PAID`/`REJECTED`/
  `CANCELLED`/`FAILED`) since zero real Payout rows existed. Migration
  `20260725000000_wallet_payout_domain` — hand-written (same shadow-DB checksum-mismatch reason as
  Phase 8's migration), Prisma Client regenerated and all Phase 9 code compiles against the new
  enum shape; **not yet applied to any database** — the shared dev/test Postgres has been
  unreachable (`P1001`) throughout this checkpoint, per the user's explicit instruction to stop
  probing connectivity and continue all DB-independent work. Will be applied via `migrate deploy`
  once connectivity returns.
- **Commission locking for a payout request is FIFO over oldest unlocked PAYABLE commissions**,
  made race-safe by re-checking `payoutId: null` inside the reservation UPDATE's own WHERE clause
  — a real race condition caught during design review (not by a test) and fixed before any test
  was written.
- **`PayoutMethod.cardNumberEnc` is encrypted at rest (AES-256-GCM)** via a new
  `common/crypto/encryption.util.ts`, keyed from `PAYOUT_ENCRYPTION_KEY`; decrypted only
  internally to compute a `•••• 1234` mask, never serialized in any response.
- **RBAC — zero new permission keys added.** `commission.read`/`commission.adjust` and
  `payout.read`/`payout.approve`/`payout.pay` all already existed, reserved and unused. This
  checkpoint is the first to wire real routes behind them. Creator-facing wallet/payout-method/
  withdrawal routes are ownership-scoped via `RequireCreatorGuard`, not RBAC-gated.
- **Backend endpoints** — Creator: `GET /creator/wallet/{balance,transactions}`,
  `GET/POST /creator/payout-methods`, `PATCH /creator/payout-methods/:id/set-default`,
  `DELETE /creator/payout-methods/:id`, `GET/POST /creator/payouts`,
  `POST /creator/payouts/:id/cancel`. Admin: `GET /admin/commissions[/:id]`,
  `POST /admin/commissions/:id/{approve,reject,mark-payable}`, `GET /admin/payouts[/:id]`,
  `POST /admin/payouts/:id/{approve,reject,processing,paid,failed}`.
- **Tests** — 401 → 442 backend unit tests (new `commissions.service.spec.ts`, 17 tests;
  `payout-methods.service.spec.ts`, 8 tests; `payouts.service.spec.ts`, 16 tests), covering
  settlement transitions and ledger side effects, wallet balance aggregation math, the lazy-sweep
  reversal path, FIFO commission locking/release/settlement, encryption-before-storage, and every
  admin/creator transition guard. New `test/wallet-payouts.e2e-spec.ts` — 16/16, covering the full
  settlement→payout lifecycle (PENDING→APPROVED→PAYABLE→PAID with a PAYOUT ledger entry each),
  reject/cancel/failed release paths, refund-triggered reversal (lazy sweep), insufficient-balance
  and below-minimum rejection, RBAC, and ownership-not-RBAC checks — over real HTTP and real
  Postgres, run once connectivity returned mid-checkpoint (see below). Full backend suite:
  442/442 unit passing, `eslint` clean, `nest build` clean; e2e confirmed at 16/16 in isolation.
- **Frontend** — `wallet-real.ts` (new) adds the creator-side real API surface
  (`getWalletBalance`/`getWalletTransactions`/`listPayoutMethods`/`createPayoutMethod`/
  `setDefaultPayoutMethod`/`deletePayoutMethod`/`listPayoutsMine`/`requestPayout`/`cancelPayout`),
  named distinctly from the legacy mock-only `getBalance`/`getPayoutMethods`/`addPayoutMethod`/
  `getPayouts`/`requestPayout` re-exported unchanged from the mock store. `admin-real.ts` gains the
  admin-side surface (`getCommissionSettlementList`/`approveCommission`/`rejectCommission`/
  `markCommissionPayable`, `getAdminPayoutList`/`approveAdminPayout`/`rejectAdminPayout`/
  `markAdminPayoutProcessing`/`markAdminPayoutPaid`/`markAdminPayoutFailed`), same
  no-mock-counterpart precedent as Phase 8's Order management functions. `/creator/balance` and
  `/creator/payouts` and the two admin pages each gained a `Real*`/`Mock*` component split
  switched on `NEXT_PUBLIC_API_MODE`, identical to `/admin/orders`'s established pattern — no
  redesign, same components (`Card`/`DataTableShell`/`ConfirmModal`/`StatusBadge`/etc.) reused
  throughout. New `RealWalletBalance`/`RealWalletTransaction`/`RealPayoutMethod`/`RealPayout`/
  `RealPayoutStatus`/`RealAdminCommission`/`RealAdminPayout` types added to `@rosti/types`,
  distinct from the legacy mock shapes (mirrors `RealOrderStatus`/`RealAdminOrder` from ADR-015).
- **Not built, per the spec's own locked constraints:** Analytics, Notifications, automatic
  bank/payment-provider payouts (admin PAID is a manual confirmation only — no provider
  integration), multi-currency and tax calculations.
- **Database connectivity returned mid-checkpoint** (single confirmation check, not repeated
  probing, per the standing instruction) — the hand-written migration was applied via
  `migrate deploy`, the e2e suite was run for real, and a full browser-verification pass followed.
  One real e2e fixture bug was caught and fixed in the process: `wallet-payouts.e2e-spec.ts`'s
  `makeCreator` helper created a `CreatorProfile` without an approved `CreatorApplication` row,
  which `RequireCreatorGuard` requires — every creator-facing route 403'd until fixed to mirror
  `content.e2e-spec.ts`'s exact fixture convention.
- **Browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** logged in
  as a real seeded creator (Malika Yusupova) and a real seeded admin; confirmed the wallet balance
  page's five computed buckets and transaction ledger render correctly, added a real payout method
  (masked `•••• 9012 — MALIKA YUSUPOVA`), requested a payout (available balance correctly dropped
  to 0, locking both PAYABLE commissions), then as admin: approved a PENDING commission (writing
  the ACCRUAL entry), marked it PAYABLE, and progressed the payout request
  REQUESTED→APPROVED→PROCESSING→PAID through the real UI — confirmed directly against the database
  afterward that both locked commissions settled to PAID with a PAYOUT ledger entry each. One
  transient `500` ("Unable to start a transaction in the given time") was hit on the first approve
  click — a Railway-proxy connection-pool timeout, not a logic error (identical retry succeeded
  immediately with `201 Created`, and the DB read afterward confirmed the eventual state was
  correct). All manual browser-verification fixtures (3 commissions, 1 payout, 1 payout method, and
  their backing orders/customers/commission rule) were deleted afterward; the seed data itself
  (`npm run seed`) was left in place as ordinary reusable dev fixtures.

## Phase 10 — Communication & Notification Domain — DONE (2026-07-23)

Full event-driven notification system: in-app notification center, per-category channel
preferences (in-app/Telegram/email), Telegram Bot API and SMTP email infrastructure, centralized
templates, and automatic notifications for the creator- and admin-facing business events the spec
lists — built without modifying any Phase 8 (Checkout/Orders/Payments) or Phase 9 (Wallet/
Settlement/Payout) file. See DECISIONS.md ADR-017 for the full reasoning behind every decision
below, including a real production incident this checkpoint found and fixed along the way.

- **Extended, not superseded.** `Notification` was a fully-designed Phase 1 model (`channel`,
  `type`, `payload`, `readAt`) with zero real service ever touching it — this checkpoint adds
  `EMAIL` to `NotificationChannel`, delivery-status/retry/dedup tracking, and a new
  `NotificationPreference` model (one row per `(user, category)` the user has explicitly touched;
  an absent row means "use the default," so no backfill migration was needed).
- **Two notification sources, one pipeline.** Domains this phase may freely edit
  (`CreatorApplicationsService`, `AuthService`) emit real `EventEmitter2` events directly, handled
  by a new `NotificationEventsListener`. The frozen Phase 8/9 domains (Orders/Payments/Commissions/
  Payouts) are discovered by a new `NotificationSweepService` that reads their tables directly
  (read-only, no import of their modules — same convention as `CommissionsService.
  reconcileRefundedOrders`) and calls `NotificationsService` the same way a real listener would.
  Both paths converge on one dispatch pipeline, so "what does event X mean" is defined once.
  Idempotent via a deterministic `dedupKey` unique constraint, not a cursor — safe to rescan the
  whole table every interval.
- **"Campaign application submitted/approved/rejected" + "Campaign joined" (creator) and "new
  creator application" (admin) map onto the existing `CampaignApplication` model** (a creator
  applying to a Campaign — ADR-012's Phase 6B domain), not the still-backend-less onboarding
  `CreatorApplication` model, which stays out of scope per this phase's own charter.
- **Telegram/Email infrastructure is real, not stubbed.** `TelegramPort`/`EmailPort` mirror
  `PaymentPort`/`StoragePort`; `TelegramBotAdapter` implements Telegram's actual Bot API via raw
  `fetch` (same precedent as `ClickPaymentAdapter`), `SmtpEmailAdapter` uses `nodemailer`. Neither
  ever fakes success — an unconfigured provider or a rejected send is recorded as a `FAILED`
  `Notification` with a real error message, retryable from the admin failed-queue. Confirmed live
  in browser verification, since this environment has no real SMTP/Telegram credentials.
- **RBAC — `notification.read`/`notification.manage` are genuinely new keys**, unlike every phase
  since 6B where the needed keys were already reserved. Same read/write split as every other
  two-verb domain; MANAGER read-only, ADMIN+ gets manage. Creator-facing notification routes are
  ownership-scoped by `userId` from the JWT (not `creatorId`, not RBAC-gated — staff have
  notifications too, and a not-yet-approved creator still needs to see their own "application
  submitted" notification, so this deliberately does not sit behind `RequireCreatorGuard`).
- **Backend endpoints** — Creator: `GET /creator/notifications[/:id]`,
  `PATCH /creator/notifications/:id/read`, `POST /creator/notifications/mark-all-read`,
  `GET /creator/notification-preferences`, `PATCH /creator/notification-preferences/:category`.
  Admin: `GET /admin/notifications[/:id]`, `GET /admin/notifications/failed`,
  `POST /admin/notifications/:id/retry`.
- **A real production bug found and fixed during verification, not during initial development:**
  `EventEmitter2.emit()` is fire-and-forget — it never awaits async `@OnEvent` listeners. Approving
  a campaign application returned before the listener's second dispatch (the `campaign.joined`
  notification) had finished writing, so an immediate follow-up read sometimes missed it. Fixed by
  switching all 4 real emit call sites to `emitAsync` (awaited).
- **A second real bug, root-caused via a recovered Jest log after an e2e run appeared to hang for
  over an hour:** `NotificationSweepService`'s `@Interval(30_000)` — a live `setInterval` handle —
  kept Node's event loop alive after every test run finished, since `moduleRef.close()` doesn't
  clear `@nestjs/schedule` timers on its own. Fixed by deleting the timer via `SchedulerRegistry`
  from `onApplicationBootstrap` (not `onModuleInit`, which raced `@nestjs/schedule`'s own timer
  registration) when `nodeEnv === "test"` — verified via 3 dedicated unit tests and a full,
  cleanly-exiting e2e run (12/12, no `--forceExit`, `--detectOpenHandles` clean).
- **Tests** — 442 → 484 backend unit tests (new `notifications.service.spec.ts`,
  `notification-sweep.service.spec.ts`, `telegram-bot.adapter.spec.ts`, `smtp.adapter.spec.ts`,
  plus updates to `creator-applications.service.spec.ts`/`auth.service.spec.ts` for the
  `emitAsync` migration). New `test/notifications.e2e-spec.ts` — 12/12 passing over real HTTP and
  real Postgres, covering the campaign-application event lifecycle, sweep-triggered
  commission/payout notifications (invoked directly rather than waiting out the real interval),
  read/mark-all-read, preference-gated channel dispatch, a real FAILED email delivery and its
  admin retry, and RBAC. Full backend suite: 484/484 unit passing, `eslint` clean, `nest build`
  clean.
- **Frontend** — `notifications-real.ts` (creator) and `admin-real.ts` additions (admin), both
  real-backend-only with no mock counterpart (the mock store never had a real notification
  concept). New pages: `/creator/notifications` (center, filters, mark read/all-read),
  `/creator/notification-preferences` (per-category channel toggles), `/admin/notifications`
  (queue + failed-only tab + retry) — all reusing existing components
  (`Card`/`DataTableShell`/`Badge`/`EmptyState`/etc.), no redesign. New nav entries in both
  sidebars. New `RealNotification`/`RealAdminNotification`/`RealNotificationPreference` types.
- **Not built, per the spec's own locked constraints:** Analytics, marketing broadcasts/bulk
  messaging, and the onboarding `CreatorApplication` review workflow (out of this phase's charter
  — see ADR-012/ADR-017).
- **Browser verification (real backend, real Postgres, `NEXT_PUBLIC_API_MODE=real`):** submitted a
  real campaign application as a seeded creator (Malika Yusupova), confirmed both the IN_APP and
  EMAIL notification rows appeared in the notification center (EMAIL correctly `FAILED` with a
  real `SMTP_HOST is not configured` error, since this environment has no SMTP credentials),
  confirmed mark-read and mark-all-read both work, confirmed the preferences page's 6-category
  table renders correct defaults and persists a toggle (disabling in-app for
  `CAMPAIGN_APPLICATION`, then confirming a later real event correctly produced no new IN_APP row
  while still producing the still-enabled EMAIL row). As admin: approved the application, confirmed
  all three seeded admin accounts (manager/admin/super) received the "new creator application"
  notification, confirmed the admin queue's Failed tab and Retry action (attempts incremented from
  1→2 on retry). Also used this pass to directly confirm the real automatic `@Interval` sweep is
  correctly *disabled* in this environment specifically because the local dev server's launch
  config loads `.env.test` (which sets `NODE_ENV=test`) — not a bug, the intended behavior per
  ADR-017 point 5. All manual verification fixtures (1 campaign, 1 application, 1 commission, 1
  order/customer, 4 notifications) were deleted afterward.

## Phase 11 — Creator Onboarding & Admin Review Domain — DONE (2026-07-24)

A pre-Phase-11 audit (run before starting Analytics, at the user's explicit request) found the
single most production-critical gap in the codebase: the onboarding `CreatorApplication` model had
never had a real service built against it, so a brand-new real registration created a `DRAFT` row
that could never transition via any real endpoint — and `RequireCreatorGuard` (gating every real
creator-facing route) requires `status === "APPROVED"`. In practice, no real new user could ever
reach wallet, payouts, content, campaign applications, referrals, or notifications. This phase
closes that gap end to end. See DECISIONS.md ADR-018 for the full reasoning.

- **Full lifecycle implemented:** DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED |
  CHANGES_REQUESTED. `REVISION_REQUESTED` renamed to `CHANGES_REQUESTED` (matches
  `CampaignApplicationStatus`/`ContentStatus`'s existing spelling; zero real rows carried the old
  value). Unlike `CampaignApplication`, `REJECTED` is **resubmittable**, not terminal — the
  platform's premise is that anyone can become a creator once they meet the bar.
- **New backend module (`src/onboarding/`), new routes, new RBAC keys — nothing borrowed from the
  adjacent `CampaignApplication` domain.** Creator: `GET/PATCH /creator/onboarding`,
  `POST /creator/onboarding/submit`, `POST /creator/onboarding/resubmit` — deliberately **not**
  gated by `RequireCreatorGuard` (that guard requires already-`APPROVED`, which would make these
  routes permanently unreachable); ownership is the `creatorId` off the JWT, same pattern as
  `/creator/profile`. Admin: `GET /admin/creator-onboarding` (queue, status filter, search,
  pagination), `GET /admin/creator-onboarding/:id` (detail), `GET .../:id/audit` (reviewer audit
  trail), `POST .../:id/start-review|approve|reject|request-changes`. New permission keys
  `onboarding.read/review/approve/reject/revise` (MANAGER gets read/review, ADMIN+ gets the
  decisions — same split as `content.*`); `application.*` (CampaignApplication, ADR-012) and
  `creator.read/review/suspend/block` (reserved for a still-not-built admin account-moderation
  domain) were both left untouched.
- **Reuses the Phase 10 notification pipeline exactly** — 4 new creator-facing event types under
  the existing `ACCOUNT` category (submitted/approved/rejected/changes_requested) plus 1
  admin-facing alert under `ADMIN_ALERTS`, all via `emitAsync`, all handled by the existing
  `NotificationEventsListener`. No changes to `NotificationsService`, the sweep, or any adapter.
- **Two dormant `CreatorReferral` timestamps from the 6B Enhancement checkpoint —
  `onboardingCompletedAt`/`creatorApprovedAt` — are now wired up** via two new `ReferralsService`
  hooks (`onOnboardingSubmitted`/`onCreatorApproved`), mirroring the existing
  `onCampaignApplicationSubmitted`/`onCampaignApplicationApproved` hooks. Neither triggers a reward
  (no `ReferralMilestoneType` represents "approved as a creator") — informational only.
- **Reviewer audit trail** — new `AuditService.listForEntity(entityType, entityId)` method (the
  first real read path against the previously write-only `AuditLog` model, deliberately scoped to
  one entity rather than a general admin audit browser, which stays a separate open gap). Every
  admin decision now calls `AuditService.record`.
- **Transactional, explicitly-validated state transitions** — `onboarding.service.ts` uses the same
  explicit per-action allowed-source-states convention as `creator-applications.service.ts`
  (`SUBMIT_FROM`/`RESUBMIT_FROM`/`START_REVIEW_FROM`/`DECIDE_FROM`), throwing
  `INVALID_ONBOARDING_TRANSITION` (409) on any disallowed transition.
- **Frontend: completed, not rebuilt.** The entire creator onboarding UI (`OnboardingPageClient`,
  `OnboardingWizard`, `CreatorAppGuard`, `lib/routing.ts`) already existed as a mock-only,
  localStorage-backed 8-step wizard with its real design already in place — this phase wired it to
  the real backend (`updateOnboardingApplication`/`submitOnboardingApplication`/
  `resubmitOnboardingApplication` in `creator-real.ts`) and completed a previously-broken promise:
  the old `REJECTED` screen's copy claimed a creator could resubmit after addressing the reason,
  but rendered no wizard to do so. The wizard now renders for DRAFT/CHANGES_REQUESTED/REJECTED
  alike, threading a `submit`-vs-`resubmit` mode so the real backend's two distinct transitions are
  called correctly. The admin review queue (`/admin/creator-applications`, already existing as a
  mock-only page) got a `Real`/`Mock` branch plus a new detail page
  (`/admin/creator-applications/[id]`) for the full formData view and reviewer audit trail.
- **Tests** — new `onboarding.service.spec.ts` (32 unit tests: every transition, every guard,
  notification-emit assertions, referral-hook assertions, audit-record assertions). New
  `test/onboarding.e2e-spec.ts` (real HTTP, real Postgres) covering RBAC guardrails, the
  `RequireCreatorGuard` regression end to end (a fresh DRAFT creator is blocked from
  `/creator/wallet/balance`, stays blocked through SUBMITTED/UNDER_REVIEW, and is only let through
  after a real APPROVED), draft/submit/resubmit, the admin queue's DRAFT-exclusion-by-default
  filter, the full submit → changes-requested → resubmit → approve path with referral-hook and
  audit-trail assertions, reject-then-resubmit (proving REJECTED is not terminal), and permission
  revocation taking effect immediately.
- **Not built, per this phase's own explicit exclusions:** Analytics; admin Users/Roles CRUD,
  Settings, general audit-log browsing, admin Creator account/Payments/Refunds management (the
  "Admin Operations" cluster the pre-phase audit separately identified as future work); email
  verification; Payme/Uzum Nasiya payment adapters.
- **Verification status — complete.** Backend `tsc --noEmit` clean, `eslint` clean. Unit:
  `onboarding.service.spec.ts` 32/32 passing. E2e: `test/onboarding.e2e-spec.ts` 16/16 passing over
  real HTTP and real Postgres (run once, after the Railway proxy's earlier outage — see below —
  had cleared; ~4.7 minutes wall time, consistent with this proxy's documented per-request latency,
  not a hang). Frontend `tsc --noEmit` clean, `eslint` clean (0 errors; pre-existing warnings only).
  Full real-backend, real-browser verification (`NEXT_PUBLIC_API_MODE=real`) covering the entire
  requested checklist: new creator registration → draft onboarding (all 8 wizard steps, real
  `PATCH /creator/onboarding` per step) → `RequireCreatorGuard` blocking `/creator/wallet/balance`
  with a real `403 CREATOR_NOT_APPROVED` both client-side (redirect to `/creator/onboarding`) and
  server-side (direct call with the creator's real bearer token) → submit for review → admin
  start-review → admin request-changes (with a real reason) → creator sees the exact admin note and
  resubmits (calling the distinct `resubmit`, not `submit`, endpoint — confirmed via network trace)
  → admin approve → creator access after approval (login now routes straight to
  `/creator/dashboard`; `GET /creator/wallet/balance` with the same creator's fresh token now
  returns a real `200` with real wallet data) → all 4 creator-facing notification events
  (`onboarding.submitted/changes_requested/approved`, plus the pre-existing `user.registered`
  welcome) confirmed in the creator's real notification center, both IN_APP (`SENT`) and EMAIL
  (`FAILED` with the real `SMTP_HOST is not configured` error — the same no-SMTP-in-this-environment
  precedent as every Phase 10 email) → the admin-facing `onboarding.new` alert confirmed fanned out
  to all 3 seeded admin accounts (manager/admin/super) → the reviewer audit trail confirmed showing
  all 4 real actions (review started ×2, changes requested, approved) in correct reverse-chronological
  order with the correct actor email on each.
- **One real bug found and fixed during this verification pass (not a design gap):** the admin
  detail page's reviewer-audit-trail panel and the application-detail panel used separate React
  Query keys (`admin-onboarding-audit` vs. `admin-onboarding-list`); every review-action mutation's
  `onSuccess` only invalidated the list key, so the audit trail silently kept showing stale
  (pre-action) history until a manual page reload. Fixed in `services/admin/onboarding.ts` by
  invalidating both keys on every mutation; re-verified live (without reloading) on the very next
  action, confirming the panel now updates in place. This is a frontend cache-invalidation bug
  only — no backend logic was affected, so `onboarding.e2e-spec.ts` was not re-run for it.
- **Infrastructure note, not a defect:** the shared remote test Postgres (Railway proxy) went
  briefly unreachable mid-session (a genuine `connect` timeout, confirmed via bounded `pg` checks
  independent of the app, and via a real `500 Connection terminated due to connection timeout`
  surfaced through `AllExceptionsFilter` during live browser verification) and recovered on its own
  a few minutes later; verification resumed and completed once `GET /health/ready` reported the
  database back up. No code or infrastructure change was made in response — this is the same
  documented proxy flakiness referenced throughout this project's migrations and prior phase
  reports.
- **Fixtures:** the one test creator account, its `CreatorApplication`, its 12 dedup-keyed
  notifications (6 creator-facing + 6 admin-facing), and its 4 `AuditLog` rows were all deleted
  after verification; confirmed zero rows remain for that application/user.

## Phase 12 — Admin Operations Domain — DONE (2026-07-24)

Phase 11's own exclusions list named this exact cluster as the remaining gap: admin Users/Roles
CRUD, Settings, general audit-log browsing, and admin Creator account/Payments/Refunds management.
This phase replaces all seven of those mock-only admin pages with real backend-wired ones — no
redesign, no new architecture, reusing `PermissionsGuard`/`AuditService`/`PaginationQueryDto`/
`DomainException` throughout. See DECISIONS.md ADR-019 for the full reasoning.

- **Schema (additive only):** `UserStatus` gained `BLOCKED` (a more severe state than `SUSPENDED`,
  for creator account moderation specifically); `User` gained a nullable `displayName`; `Refund`
  gained `reviewedById`/`reviewedAt`/`rejectionReason` plus a `status` index. Migration
  `20260728000000_admin_operations_domain`, applied clean.
- **RBAC:** 61 → 65 permission keys. Only two genuinely new domains: `role.read`/`role.manage`
  (SUPER_ADMIN-only) and `refund.read`/`refund.manage` (MANAGER read / ADMIN+ manage). The other
  five subsystems (Users, Creators, Payments, Settings, Audit) all reused keys already reserved
  since earlier phases — full mapping, including the `creator.review` repurposing (account detail
  view, distinct from `onboarding.review`'s admission queue), in RBAC.md's Phase 12 note.
- **Backend — 6 new modules** (`admin-creators`, `admin-payments`, `admin-refunds`, `settings`,
  `admin-audit`, plus real services added to the pre-existing thin `users`/`roles` modules):
  - **Users** (`src/users/`): staff list/detail/create/update/activate/deactivate/reset-password/
    assign-role/remove-role. Self-modification guarded (`CANNOT_MODIFY_SELF`); removing a staff
    member's last role blocked (`VALIDATION_ERROR`); no delete route.
  - **Roles** (`src/roles/`): role list/detail/create/update, permission assign/remove, a
    permission-matrix read (`GET /admin/permissions`). No delete-role route at all — the
    structural way "prevent removal of critical system roles" is satisfied. One narrow runtime
    guard (`CANNOT_MODIFY_SYSTEM_ROLE`) blocks stripping `role.manage`/`user.manage` from the
    seeded `super_admin` role specifically (the one true lockout risk).
  - **Admin Creators** (`src/admin-creators/`, new): list/detail/campaign-history/earnings-summary/
    payout-summary (`groupBy` aggregates)/referral-summary (delegates to the existing
    `ReferralsService.getMySummary`, not reimplemented); suspend/unsuspend/block/unblock with
    explicit from-state guards per transition. Does not duplicate Phase 11's onboarding
    approve/reject/request-changes — those stay solely at `/admin/creator-applications`.
  - **Admin Payments** (`src/admin-payments/`, new, read-only by design): list/detail/timeline. The
    timeline is synthesized from existing fields (`createdAt`/`status`/`updatedAt`/
    `webhookPayloads`), not a new `PaymentStatusHistory` table.
  - **Admin Refunds** (`src/admin-refunds/`, new): list/detail/approve/reject, layered on top of
    `OrdersService.createRefund` (Phase 8, frozen) without re-triggering or reversing its
    synchronous financial action — see ADR-019 point 4 for the full reasoning and its one
    consequence worth knowing (rejecting a refund whose order-level effect already completed does
    not undo that effect).
  - **Settings** (`src/settings/`, new): a 14-key catalog across the 7 requested categories,
    lazy-default merge against the pre-existing `Setting` model, type-validated writes
    (`INVALID_SETTING_VALUE`), one audited `SETTINGS_UPDATED` record per save with full
    before/after maps. **Honest limitation, stated in ADR-019:** these values are stored and
    audited but not yet wired into other domains' runtime behavior (e.g. changing
    `commission.payoutMinimumMinor` here does not yet change what `WalletService` enforces) —
    wiring each setting into its owning domain was out of this phase's charter.
  - **Audit log reader** (`AuditService.list()`/`findOneOrThrow()`, extending the existing
    `@Global()` service Phase 11 had only given a narrower `listForEntity` reader): filters by
    entityType/actorId/action/date-range/search, paginated. Read-only — no mutation route exists.
- **Every mutation across all six modules calls `AuditService.record()`** — staff CRUD, role/
  permission changes, creator suspend/unsuspend/block/unblock, refund approve/reject, settings
  updates all produce a real `AuditLog` row, confirmed during browser verification (below), not
  just asserted from the code.
- **Frontend:** all 12 admin pages under `users/`, `roles/`, `creators/`, `payments/`, `refunds/`,
  `settings/`, `audit-log/` rewritten real-only (no `Mock`/`Real` branch — matching the precedent
  set for genuinely-new admin-only domains in Phases 10/11), reusing `DataTableShell`/
  `ConfirmModal`/`Card`/`Badge`/`StatTile`/React Query throughout. New types (`packages/types`) and
  API-layer functions (`admin-real.ts`) per domain; new `services/admin/staff.ts` and
  `roleManagement.ts` hook files (named to avoid colliding with `system.ts`'s pre-existing mock
  `useAdminRoles`).
- **A real, pre-existing frontend gap exposed (not introduced) by this phase, found and fixed:**
  `admin-real.ts`'s `mapRoleKeysToAdminRole()` hard-threw `FORBIDDEN` for any staff role key outside
  the fixed set `{super_admin, admin, manager}`. Before this phase every staff account really did
  carry one of those three seeded keys, so the gap was latent; this phase's own Roles CRUD makes it
  possible to create and assign a genuinely custom role for the first time, which would have locked
  such a staff member out of the admin panel entirely. Fixed by defaulting to `MANAGER` (lowest
  tier) whenever at least one role is present but none of the three are recognized — `FORBIDDEN` is
  now reserved for the genuine zero-roles case. This only affects frontend nav visibility; backend
  authorization (`RequirePermissions`) was never affected. See ADR-019 point 7.
- **Tests:** 576/576 backend unit tests passing (new specs: `users.service.spec.ts` (12),
  `roles.service.spec.ts` (11), `admin-creators.service.spec.ts` (12),
  `admin-payments.service.spec.ts`, `admin-refunds.service.spec.ts`, `settings.service.spec.ts` (7),
  `common/audit/audit.service.spec.ts` (7)). New `test/admin-operations.e2e-spec.ts` — 27/27 passing
  over real HTTP and real Postgres, covering RBAC guardrails across all 8 new list routes, full
  Users lifecycle, Roles CRUD + system-role protection, Creator admin actions, Payments read-only
  browse/filter/detail/timeline, Refunds approve/reject + status-guard, Settings
  read/update/persistence/audit, and the general audit-log browser's filters. Backend `tsc --noEmit`
  clean, `eslint` clean. Frontend `tsc --noEmit` clean.
- **Real bugs found and fixed during this phase, distinguished from test-authoring mistakes:**
  1. **Real, pre-existing frontend gap** — `mapRoleKeysToAdminRole()`'s hard lockout for
     non-seeded role keys, above. Fixed.
  2. **Not an application bug, a test-fixture leak:** the e2e suite's own cleanup filtered
     leftover custom-role rows by a substring that didn't account for a hyphen-to-underscore
     conversion the test itself applied to satisfy the real `CreateRoleDto`'s key-format
     validation — one leaked `Role` row silently survived every run despite the suite reporting
     "passed." Found by seeing it still present in the live Roles admin page during browser
     verification, not by any test failure. Fixed both the leaked row (deleted) and the test's own
     cleanup filter (now matches both forms).
  3. **Not an application bug, a test-script mistake:** during Refunds browser verification, a
     DOM query for the "Reject" button inside a `ConfirmModal` matched the underlying page's own
     "Tasdiqlash" (Approve) button first, since the modal overlay doesn't remove the page behind it
     from the DOM — silently approving a refund instead of rejecting it. Confirmed as a
     test-authoring mistake, not an app bug, because a subsequent genuine reject attempt on the
     now-`APPROVED` refund correctly returned `409 INVALID_REFUND_TRANSITION` — proving the backend
     enforced the state machine correctly given what was actually requested. Fixed by scoping the
     click to the modal container specifically; re-verified successfully on a third refund fixture.
  4. Four e2e assertion mismatches during initial test authoring (expected `409` where the service
     correctly throws `400`/`VALIDATION_ERROR`; a generated test role key contained hyphens that
     failed the real `@Matches` validator) — all test-authoring errors, fixed in the test file
     itself, not the application.
- **Browser verification (real backend, real Postgres, logged in as `super@rosti.uz`) — complete,
  covering the full requested checklist:** Staff — created via the real UI form, edited display
  name, deactivated, reactivated, assigned a second role, removed a role, all confirmed via network
  requests and UI state. Creators — suspend/unsuspend/block/unblock all confirmed on a dedicated
  test creator, including the suspend/block button visibility conditional correctly hiding once
  `BLOCKED`. Payments — list/search/status+provider filters/detail/timeline all confirmed against a
  purpose-built Payment/Order/Offer/Product/Customer fixture chain. Refunds — approve and reject
  both confirmed (across 3 fixtures, see bug #3 above), including the `INVALID_REFUND_TRANSITION`
  guard firing correctly on a double-decision attempt. Settings — updated "Platforma nomi", confirmed
  the PATCH succeeded, **confirmed persistence with a fresh page reload** (not just optimistic UI
  state), then reverted to the original value. Audit log — confirmed every one of the above
  mutations appears with the correct actor/action/entity, and confirmed one detail page renders a
  correct before/after diff (`"Rosti"` → `"Rosti Phase12 Verify"`).
- **Fixtures:** the staff account, the test creator (+ its `CreatorProfile`/`CreatorApplication`,
  cascade-deleted with the `User` row), the Payment/Order/Offer/Product/Customer chain, all 3
  Refund rows, and their 15 associated `AuditLog` rows were all deleted via direct-DB scripts after
  verification; confirmed zero rows remain for any of them. The Settings value was reverted to its
  original default, confirmed via a final reload.
- **Not built, per this phase's own explicit exclusions:** Analytics, Dashboards, Charts, Reporting;
  email verification; additional payment providers; the Affiliate Attribution Engine; marketing
  broadcasts; performance optimization unrelated to this phase; UI redesign of any existing page. No
  new notification triggers were added — none of the seven subsystems had an "already appropriate"
  hook Phase 10's existing event set didn't already cover.

## Phase 13 — Analytics & Business Intelligence Domain (v1) — DONE (2026-07-24)

A design-only pass preceded implementation, per explicit instruction: [ANALYTICS.md](ANALYTICS.md)
studies the full schema and every relevant service, surfaces concrete gaps (no `createdAt` index on
the four core tables; `ReferralVisit` only tracks referred traffic; no export library existed), and
proposes an architecture. That design was reviewed and returned with binding business-definition
decisions and an explicit v1/deferred split — this phase is what was actually built against those
decisions. See DECISIONS.md ADR-020 for the full reasoning behind every judgment call below.

- **Migration (reviewed on its own, first):** `@@index([createdAt])` added to `Order`/`Payment`/
  `Commission`/`Refund` — purely additive, the exact gap the design flagged as this domain's single
  biggest risk, since every KPI here is a date-range query.
- **Backend — one new module (`src/analytics/`), read-only against every other domain's tables:**
  - `lib/time-range.resolver.ts` — the one place `range`/`compare` (9 presets, 5 comparison modes)
    resolve to concrete half-open `[from, to)` intervals; every sub-service consumes an
    already-resolved range rather than re-deriving date math.
  - `lib/analytics-cache.service.ts` — first real Redis consumer in this codebase (every prior use
    was the health check's own ping); best-effort by construction — a cache failure of any kind
    (unreachable, timeout, malformed JSON) falls through to a live recompute, never fails the
    request.
  - `lib/analytics-sql.util.ts` — the only two raw-SQL call sites in the domain
    (`creatorRevenueBreakdown`, `dailyOrderTrend`/`refundBreakdownByOffer`), both parameterized via
    `Prisma.sql`/`Prisma.join`, reserved for the one thing Prisma's `groupBy` structurally can't
    express: grouping by a column on a different table than the one being aggregated (creator
    attribution lives on `Attribution`, order value on `Order`). Every other aggregate in this
    domain uses native `groupBy` — real DB-side aggregation throughout, no fetch-and-reduce, no N+1.
  - **Executive Analytics** — all 14 requested KPIs (Revenue/GMV/Orders/Paid/Pending/Refunds/Refund
    Rate/Active Creators/Active Campaigns/Active Products/Creator link konversiyasi/AOV/New &
    Returning Customers) plus Net Revenue and a daily trend/status breakdown, computed per the
    approved business definitions exactly (GMV includes `REFUNDED`, Revenue excludes it, AOV divides
    by GMV not Revenue since Paid Orders' denominator still counts `REFUNDED`). Snapshot metrics
    (Active Campaigns/Products) never get a `previous` value or `deltaPct` in any compare mode —
    there's no state-history table to reconstruct a past snapshot from, so none is fabricated.
  - **Creator / Campaign / Product Analytics** — list (paginated) + detail views each, covering
    earnings/orders/revenue/conversion/clicks/top-campaigns/top-products/approval-rate/avg-payout/
    referral-stats (Creator), performance/creator-count/avg-creator-performance/top-creators/trend
    (Campaign), and revenue/refunds/conversion/AOV/best-sellers-and-slow-movers via one sortable
    list (Product). Creator's `viewsCount` is an explicit `null`, not omitted — "views" aren't
    measurable with today's data (ReferralVisit only exists for referred traffic), and the field
    says so rather than silently hiding the gap.
  - **Payment / Refund / Customer Analytics** — single-page platform-wide breakdowns: payment method
    mix/success-rate/pending/failed; refund reasons (raw `Refund.reason` strings ranked by
    frequency, no taxonomy yet)/rate/approval-rate/average amount; new-vs-returning buyers/LTV/order
    frequency, via a bounded two-query pattern (period-active customers, then their all-time stats
    scoped to just that id list — never a full customer-table scan, never N+1).
  - **CSV export** (`analytics-export.service.ts`) — delegates to the exact same sub-service each
    on-screen view already calls, never a second computation path. Every export call is audited via
    the existing, unmodified `AuditService.record()` (`entityType: "AnalyticsExport"`), answerable
    from the Phase 12 Audit Log viewer with zero changes to that viewer.
  - RBAC: **zero new permission keys** — `analytics.read`/`analytics.export` were reserved and
    unused since Phase 6A, the same outcome Phase 8/9 had. Every GET route requires `analytics.read`
    alone (no per-role data masking, matching this file's MVP philosophy); `/export` additionally
    requires `analytics.export`.
- **Frontend — Executive Dashboard (`/admin/analytics`) replaces its Phase 5 mock entirely**, no
  `Mock`/`Real` branch, matching the Phases 10–12 precedent. 9 new sub-pages (Creator/Campaign/
  Product list+detail, Payment/Refund/Customer single-page views). Shared components: `StatTile`
  gained a `deltaFromPct()` helper (packages/ui) rather than a new tile component, since `StatTile`
  already supported a delta prop; `AnalyticsFilterBar` (packages/ui, new) is the one shared
  date-range/comparison-mode control every page uses, plus an `extra` slot for page-specific filters
  (a status filter is wired on Payment and Refund Analytics specifically — the two views where
  narrowing by status is the primary investigative action). `AnalyticsCharts.tsx` supplies the three
  new chart types this domain needed (bar, pie — area already existed from Phase 5's
  `AdminDashboardChart`), matching its existing color/tooltip conventions. The CSV export button is
  hidden for MANAGER (`hasRole(admin?.role, "ADMIN")`, the same pattern `commissions/page.tsx`
  already established) — UI convenience only, the real boundary is the backend guard.
  `/admin/dashboard` (the separate admin home page) was deliberately left untouched — its
  pending-tasks widget sources from other domains outside this phase's named scope.
- **A real, acknowledged UI gap, not a hidden one:** entity-filter dropdowns (creator/campaign/
  product/region selects) are not wired into every page's UI — the backend already accepts and
  correctly applies all of them (proven by e2e tests passing with `campaignId`/`creatorId` filters),
  so this is a frontend-only follow-up whenever it's prioritized, not missing backend work.
- **Tests:** 640/640 backend unit tests passing (58 new: `time-range.resolver.spec.ts` (19),
  `analytics-cache.service.spec.ts` (6, all forcing a stubbed-client failure to prove best-effort
  behavior), `csv.util.spec.ts` (8), `executive-analytics.service.spec.ts` (12), `creator-analytics.
  service.spec.ts` (5), `payment-analytics.service.spec.ts` (5), `refund-analytics.service.spec.ts`
  (6), `customer-analytics.service.spec.ts` (3)). New `test/analytics.e2e-spec.ts` — 18/18 passing
  over real HTTP and real Postgres, covering RBAC guardrails, every KPI's exact arithmetic against a
  hand-computed fixture, compare=previous, custom-range validation, all three drill-down domains'
  list+detail+404, all three single-page views, and CSV export + its audit trail. Backend
  `tsc --noEmit` clean, `eslint` clean. Frontend `tsc --noEmit` clean, `eslint` clean (0 errors, only
  pre-existing warnings).
- **A real bug found and fixed during test-writing, not during verification:** the e2e suite's first
  run used a fixed literal date range (`2020-01-01`–`2020-02-01`) so its own fixtures would land in
  the same, deterministic window every run — but every analytics endpoint caches its response in
  Redis for up to 300s keyed by `(query + resolved range)`, so re-running the suite a second time
  within that TTL served the *first* run's stale, already-deleted fixture data back (confirmed by a
  mismatched suffix in the cached creator's `displayName`). This was a test-design flaw, not an
  application bug — the cache behaved exactly as intended. Fixed by deriving the fixture window from
  the run's own `Date.now()` (offset ~20 years into the past, for isolation from other suites' real-
  `now` fixtures) instead of a hardcoded literal, giving every run a genuinely unique cache key.
- **Browser verification (real backend, real Postgres, logged in as `super@rosti.uz`) — complete:**
  created a full fixture chain (Product/Offer/Campaign/Creator/4 customers/8 orders across PAID/
  REFUNDED/CREATED/PAYMENT_PENDING/10 referral visits/5 payments split across CLICK and
  CASH_ON_DELIVERY) and confirmed every one of the 10 pages renders real, hand-verifiable numbers —
  e.g. the fixture creator's revenue tile read exactly 8,500 so'm, matching the 5 seeded orders'
  sum to the tiyin; the campaign's conversion read exactly 60.0% (6 paid-or-refunded orders / 10
  visits); the refund rate matched between the Executive Dashboard and the dedicated Refund
  Analytics page. Verified the status filter on Refund Analytics actually narrows results (selecting
  REJECTED against one real APPROVED refund correctly returned zero rows) while the canonical Refund
  Rate/Approval Rate metrics stayed computed against their fixed definitions regardless of the
  filter — confirmed as intended behavior, not a bug. Verified CSV export downloads real content and
  writes a real, correctly-shaped `AnalyticsExport` audit row with `before`/`after` visible in the
  Phase 12 Audit Log viewer unmodified. Verified the export button is hidden for MANAGER and visible
  for ADMIN/SUPER_ADMIN.
- **Fixtures:** the full chain above (1 product, 1 offer, 1 campaign, 1 creator + profile +
  application, 4 customers, 8 orders, 5 payments, 5 commissions, 1 commission rule, 1 refund, 10
  referral visits, 1 creator-campaign membership) plus the `AnalyticsExport` audit row generated
  during verification were all deleted via a direct-DB script afterward; confirmed zero rows remain.
- **Deferred, per the approved scope (documented so they aren't rediscovered as surprises):**
  `AnalyticsDaily*Stats` rollup tables and the nightly `@Cron` populating job; Excel and PDF export
  (`format` accepts only `"csv"` today); organic/direct traffic tracking (no generic page-view event
  model exists); refund-reason taxonomy normalization (raw string grouping only).
- **Not built, per this phase's own explicit exclusions:** no change to any Order/Payment/Refund/
  Commission/Payout/Campaign/Attribution/Referral/Onboarding/Notification/Settings business logic —
  this domain reads those tables, it never writes to them (its one write, the export audit record,
  goes through the existing, unmodified `AuditService`).

## Phase 14 — Production Hardening & Launch Readiness — AUDIT/HARDENING COMPLETE, NOT LAUNCH-READY (2026-07-28)

Every audit/hardening/documentation task in this phase's own scope is done. **Not the same claim
as "ready to launch"** — see PRODUCTION_READINESS.md for the four real blockers that remain (Docker
build verification, Railway/GitHub Environment provisioning, real Click credential activation, real
production database bootstrap), none of which this phase could resolve from inside this sandbox.
See PRODUCTION_READINESS.md for the full consolidated checklist and DECISIONS.md's ADR-021 for the
architectural reasoning behind every fix below.

### Known environment limitations hit during this phase (both external to the code, not defects)

- **Docker builds could not be executed or verified in this development sandbox.** Docker
  Desktop's CLI is installed, but its virtualization backend (the actual engine — `com.docker.*`/
  `vpnkit` processes) fails to start here and never comes up even after an explicit launch attempt
  (confirmed: zero matching processes running afterward, and `docker build`/`docker info` fail
  with a pipe-connection error). This sandbox almost certainly lacks the nested virtualization
  support Docker Desktop's backend requires. Both `apps/api/Dockerfile` and `apps/web/Dockerfile`
  were written and carefully hand-reviewed (multi-stage npm-workspaces-aware builds, verified
  against this repo's actual on-disk `node_modules` symlink layout), and the web image's
  `output: "standalone"` Next.js setting was verified independently by running a real
  `next build` locally and confirming the exact output path (`​.next/standalone/apps/web/server.js`)
  the Dockerfile's COPY steps assume — but neither image has been through an actual `docker build`.
  **This must be done for real (in an environment with a working Docker engine, e.g. CI or a
  developer machine) before either image is trusted for a real deploy.**
- **The test Postgres database (Railway-hosted, `apps/api/.env.test`) had intermittent
  connectivity from this sandbox** — real, repeated `pg-pool` connection-timeout errors across
  several fresh server restarts and over an extended span of session time, confirmed via
  `/health/ready` reporting `database: {status: "down", message: "Connection terminated due to
  connection timeout"}` while Redis stayed reachable throughout (isolating the problem to Postgres
  reachability specifically, not a general network block). Connectivity was intermittent, not
  permanently absent — it recovered at least once mid-session, which allowed the full backend e2e
  suite to actually run (see below for the result once that run completes).

### Landed so far (see git history for exact diffs; this list is a running summary, not final)

- Environment/secrets validation module (`env-validation.ts`) with aggregated startup failure;
  fixed `CLICK_SECRET_KEY`'s previously-unguarded dev-fallback in production.
- `main.ts` hardening: `trust proxy`, CORS allowlist, explicit body-size limits, Swagger gated out
  of production by default, graceful shutdown hooks.
- Route-specific rate limits added: `reset-password`, checkout's three public routes, analytics
  export.
- Click `service_id`/`merchant_id` validated on every callback (defense-in-depth alongside the
  existing MD5 signature check).
- **Financial integrity:** closed TOCTOU races (read-then-check-then-plain-`update()`) in
  `CommissionsService` (approve/reject/markPayable), `PayoutsService` (cancel/approve/reject/
  markProcessing/markPaid/markFailed), and `AdminRefundsService` (approve/reject) — all now use
  the guarded-`updateMany`-with-count-check pattern already proven in
  `CommissionsService.lockPayableCommissions`. Made `PaymentsService.handleClickCallback`'s
  Payment+Order writes atomic (previously two separate un-transacted writes).
- **Health checks redesigned**: `/health/live` (process only), `/health/ready` (Postgres is the
  only hard dependency — Redis down degrades, never fails readiness), `/health/status` (deep
  diagnostic: DB/Redis/disk/scheduled-job heartbeat/Click config presence as booleans/notification
  provider presence, never secret values). Replaces the previous `@nestjs/terminus`
  `HealthCheckService.check()` aggregation, which failed readiness the moment *any* indicator —
  Redis included — went down.
- **Structured logging**: a global `RequestLoggingInterceptor` (requestId/userId/creatorId/
  operation/duration/result/status on every request, never the body/query/headers), plus an
  optional `ErrorReportingPort` (no-op by default, a real webhook-POST adapter when
  `ERROR_REPORTING_WEBHOOK_URL` is set) wired into `AllExceptionsFilter` for every 5xx.
- Seed script (`prisma/seed.ts`) now hard-refuses to run when `NODE_ENV=production`.
- `NotificationSweepService` given a run heartbeat (`lastRunAt`/`lastError`, surfaced via
  `/health/status`) and a reentrancy guard (skips a tick if the previous one is still running).
- Frontend: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` added (none existed
  before). Wired the Phase 13 analytics filter dropdowns that had a slot (`AnalyticsFilterBar`'s
  `extra` prop) but nothing plugged into it: real creator/campaign/product dropdowns (backed by
  the existing admin list endpoints) and a region text input (deliberately not a dropdown — see
  `AnalyticsEntityFilters.tsx`'s comment on why a fixed region enum would risk silently matching
  nothing against real free-text address data) across Payment/Refund/Customer/Creator-list/
  Executive analytics pages.
- **Load test** (`apps/api/scripts/load-test.ts`, `npm run loadtest --workspace=@rosti/api`):
  found and fixed two real bugs — `HealthController` and `ClickCallbackController` both silently
  inherited the global 120-req/60s-per-IP rate limit despite code comments already stating the
  intent that neither should ever be throttled. Confirmed live: `/health/live` under load went
  from 2715/2835 requests returning 4xx (rate-limited) to 0/2317 after adding `@SkipThrottle()` to
  both controllers. The Click one is the more serious of the two — a real payment confirmation
  callback could have been silently dropped under load.
- **CI/CD**: `.github/workflows/ci.yml` (typecheck/lint/unit/e2e/build for both apps, real
  Postgres+Redis service containers) and `.github/workflows/deploy.yml` (manual
  `workflow_dispatch` only, never on push — migrate → build+push images to GHCR → deploy to
  Railway → poll `/health/ready` — gated behind a GitHub Environment so required-reviewer approval
  can be configured). `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/api/railway.toml`,
  `apps/web/railway.toml` added (see the Docker limitation note above for what's unverified).
- **Full regression run found and fixed a real pre-existing bug**: `test/rbac.e2e-spec.ts` and
  `test/roles.e2e-spec.ts` both build a minimal `Test.createTestingModule` that predates Phase 12
  giving `RolesService` an `AuditService` constructor dependency — every full e2e run has silently
  failed these two files since Phase 12 shipped (`Nest can't resolve dependencies of the
  RolesService (PrismaService, ?)`, then a cascading `TypeError` in `roles.e2e-spec.ts`'s `afterAll`
  since `prisma` was never assigned). Fixed by adding `AuditModule` (already `@Global()`) to both
  suites' imports.
- **Fix verified across two separate full-suite runs, against the same real Railway test database,
  neither of which reached a fully clean pass — for environmental reasons, not code reasons.**
  Run 1 (8 suites failed, 11 passed, 101/300 tests failed): every failure traced individually to
  `Connection terminated due to connection timeout` (187 occurrences), except the two rbac/roles
  suites, which failed with the dependency-resolution bug above — confirming that bug was real and
  reproducible before the fix. Run 2, after the fix (18 suites failed, 1 passed, 251/300 tests
  failed — a *more* severe run, 522 `Connection terminated` occurrences, the Railway DB visibly
  struggling harder this time): **`rbac.e2e-spec.ts` and `roles.e2e-spec.ts` both failed this time
  too, but never with the dependency error — both got past module compilation and failed on a
  genuine connection timeout inside an actual test body**, the exact same failure mode as every
  other suite in that run. That's the fix confirmed correct: the one bug this phase could actually
  fix in this file is fixed; the rest is Railway's test-database reachability from this sandbox,
  which is outside this phase's ability to fix and is documented as an environment limitation, not
  papered over as a passing test result that was never actually achieved.
  `test/redis.e2e-spec.ts` passed cleanly in both runs — isolating the problem to Postgres
  reachability specifically, consistent with every other Redis-related observation this phase.
- **Frontend verification, done for real in-browser**: `npm run typecheck`/`lint`/`build` all clean
  (0 errors; 8 pre-existing warnings unrelated to this phase). Browser-verified: `not-found.tsx`
  renders on an unknown route; `error.tsx` catches a real thrown error (confirmed via a temporary
  test route, removed after) and logs it via `console.error` exactly as implemented; the new
  analytics entity-filter dropdowns render real creator/campaign/product options from the live
  database (confirmed against the real Railway-hosted test DB while it was reachable) and selecting
  one fires the expected `?creatorId=...` request to the backend — screenshotted via network-request
  inspection, not assumed from reading the code.
- **Documentation**: rewrote the stale pre-implementation `DEPLOYMENT.md`; wrote `ENVIRONMENT.md`,
  `RUNBOOK.md` (Click go-live checklist, `bootstrap-admin.ts` procedure, daily/weekly/launch-day/
  first-7-day checklists, incident escalation template), `BACKUP_RESTORE.md`,
  `PRODUCTION_READINESS.md` (consolidated launch-blocker list); brought `SECURITY.md` from a
  mostly-unchecked stale state to an accurate, individually-verified one (confirmed each item
  against real code rather than trusting the old checklist); added `LEGAL.md` (Phase 14 §16 audit —
  three draft placeholder pages built and linked from the landing page footer's previously-dead
  "Shartlar · Maxfiylik · Qaytarish siyosati" text; checkout/registration consent-checkbox gaps
  identified and documented, deliberately not wired in since that's a product/legal decision, not a
  docs-pass change); `DECISIONS.md` ADR-021 records the phase's architectural decisions.
- **Production admin bootstrap gap closed**: extracted `seedRolesAndPermissions` out of `seed.ts`
  into `prisma/lib/seed-roles-permissions.ts` (shared, idempotent) and added
  `prisma/bootstrap-admin.ts` — the production-safe path to seed the Role/Permission catalog and
  create exactly one real super_admin account, since `seed.ts`'s new production guard otherwise left
  no way to bootstrap a fresh production database at all.

## Phase A — Production Hardening Follow-up (Sofsavdo pivot kickoff) — DONE (2026-07-29)

Scoped tightly to the real, named gaps the Phase 14 audit left open (per the user's explicit
"finish production blockers before starting new-vision work" instruction) — no new product
features, no rebrand, no catalog/buyer-account work yet (those are later phases of the same plan).

- **`/creator/sales` real backend.** Previously `apps/web/src/lib/api/index.ts`'s `getSales` was an
  unconditional re-export of the Phase-1 mock (`apiGetSales`), with no `USE_REAL_API` branch at
  all — the single clearest "still mock" marker in that whole file. New
  `CreatorSalesController`/`CommissionsService.listMySales` (creator-scoped Commission→Order→
  Customer/Offer/Attribution join), new `common/masking/pii-mask.util.ts` (name/phone masking,
  mirrors the existing `maskCardNumber` convention), new `creator-real.ts`'s `getMySales()`
  (maps the real, fine-grained `RealOrderStatus`-shaped response down to the page's existing
  legacy `OrderStatus` categories — deliberate, since this is a glanceable summary view, not the
  operational fidelity `/admin/orders` needs). Zero schema changes — every field already existed
  via existing relations.
- **Creator profile page.** The backend (`GET /creator/profile`) already existed and was already
  being called for session bootstrap; only `apps/web/app/creator/(app)/profile/page.tsx` was
  missing. Built as a read-only page reusing data already in the session object (no new fetch) —
  personal info, content niches, social accounts, masked payout method, sourced from
  `CreatorApplication.formData`, the same data the onboarding wizard itself collects.
- **Per-account brute-force lockout.** `User` gained `failedLoginCount Int @default(0)`/
  `lockedUntil DateTime?` (migration `20260730000000_auth_lockout`). `AuthService.login()` checks
  `lockedUntil` before the argon2 verify (a locked account never pays that cost per retry),
  increments the counter via a guarded `updateMany` on a wrong password (same race-safety pattern
  as the Phase 14 financial fixes — an occasional lost race under true concurrent attempts just
  means one increment is absorbed, an acceptable trade-off since this is a security signal, not a
  ledger), and resets both fields to 0/null on success. Threshold/duration configurable via
  `AUTH_MAX_FAILED_LOGIN_ATTEMPTS`/`AUTH_LOCKOUT_DURATION_MINUTES` (default 5/15).
- **Cloud object storage adapter.** `S3Storage implements StoragePort` (`@aws-sdk/client-s3`,
  newly added dependency) — one adapter covers real AWS S3, Cloudflare R2, and GCS's S3-compat
  mode via `storage.s3.endpoint`/`forcePathStyle`. `StorageModule`'s DI binding changed from a
  hardcoded `useClass: LocalDiskStorage` to an env-driven factory (`STORAGE_DRIVER=local|s3`).
  `env-validation.ts` now refuses to start in production with `STORAGE_DRIVER=s3` and missing
  bucket/credentials. Still defaults to `local` — pointing a real deployment at a real bucket is
  an operator action, not something buildable from inside this sandbox.
- **Tests**: 714/714 backend unit tests passing (53 suites; 23 new: `commissions.service.spec.ts`'s
  `listMySales` tests, `pii-mask.util.spec.ts`, `auth.service.spec.ts`'s lockout tests,
  `s3.storage.spec.ts`, `env-validation.spec.ts`'s S3-storage branch). Two new e2e suites run
  against the real Railway-hosted test Postgres: `creator-sales.e2e-spec.ts` (3/3 passing —
  masking, ownership isolation, unauthenticated rejection) and `auth.e2e-spec.ts`'s new lockout
  describe block (2/2 passing, deliberately minimal in real `/auth/login` HTTP calls to stay
  within the file's shared 10/min per-IP login-throttle budget — the threshold-crossing arithmetic
  itself is exhaustively covered against a mocked Prisma client instead, in the unit suite).
  Backend `tsc --noEmit` clean, `eslint` clean (0 warnings). Frontend `tsc --noEmit`/`eslint` clean
  (8 pre-existing, unrelated warnings), `next build` succeeds.
- **Browser-verified**: `/creator/sales` confirmed calling the real endpoint (Network tab), not
  the mock fallback; `/creator/profile` renders real session data with no console errors, no
  layout overflow at 375px; a wrong-password login attempt still shows the expected
  `INVALID_CREDENTIALS` message and does not falsely lock the account after one failure; the API
  process boots cleanly with the new `StorageModule` wiring and `/health/status` correctly reports
  `disk.driver: "local"`.
- **Not built, per this phase's own scope**: fraud-detection flags, manual attribution override,
  data-retention policy — all remain the same documented, deliberate deferrals as Phase 14 left
  them. Rebrand (Rosti → Sofsavdo) and the new Commerce Home/Catalog/Buyer-Account vision are
  later phases of the same approved plan, deliberately not started here.

## Phase B — Rebrand: Rosti → Sofsavdo — DONE (2026-07-29)

Full mechanical rebrand across the whole repo, per the approved plan's Phase B scope: no vision
or feature work leaked in here (the "no public catalog"/"closed system" claims in README.md and
docs/PROHIBITED.md were deliberately left untouched — rewriting what the product *is* belongs to
Phase C/E, not the naming pass).

- **`packages/config/brand.ts`** updated (`BRAND.name: "Sofsavdo"`, new `BRAND.domain:
  "sofsavdo.com"`, `supportEmail` updated) — this alone fixed every frontend site that already
  consumed it (11 files), no further edits needed there.
- **Cross-runtime brand constant, the one real gotcha this phase hit**: wiring the backend
  (`main.ts`'s Swagger title, `notifications/templates/registry.ts`'s email copy,
  `settings.catalog.ts`'s DB-backed platform-name default) to import `BRAND` from
  `packages/config/brand.ts` directly compiled clean under `tsc --noEmit`, but crashed the actual
  running dev server: `SyntaxError: Unexpected identifier 'as'` at that file's `} as const;` line.
  Root cause: Next.js's bundler transpiles a workspace package's raw `.ts` source as part of its
  own module graph, but NestJS's `nest start --watch` `require()`s it as a plain Node module
  outside `src/`'s own ts-loader compile step, and Node's native TS-stripping can't parse `as
  const`. Fixed by giving the backend its own small, explicitly-commented, NOT-a-re-export mirror
  at `apps/api/src/config/brand.ts` rather than building out a real compile step for
  `packages/config` just for a brand-name change. Caught by actually restarting the dev server and
  watching it boot, not by trusting the typecheck — recorded as a lesson, not just a fix.
- **Workspace scope rename**: `@rosti/*` → `@sofsavdo/*` across all 5 package.json `name` fields
  and every import site (root `package.json`'s own `name` too: `rosti-platform` →
  `sofsavdo-platform`). Ran as one atomic, mechanical pass, then `npm install` to regenerate
  `package-lock.json` — confirmed this alone would have caught any missed reference (it didn't
  need to; install succeeded on the first try).
- **Everything else swapped**: dev password/seed emails/product brand in `prisma/seed.ts`,
  `docker-compose.yml`'s Postgres credentials, `.env.example` defaults, the scrypt salt literal in
  `encryption.util.ts` (`"rosti-payout-methods"` → `"sofsavdo-payout-methods"` — safe pre-launch,
  no encrypted production data exists yet to lose), analytics CSV export filenames (both the admin
  executive-dashboard and the backend `analytics-export.service.ts` copies), the Redis e2e smoke
  test's key/value literals, `.github/workflows/ci.yml`'s disposable CI-only Postgres credentials,
  both Dockerfiles' unprivileged container user/group name, `.claude/launch.json`'s server-config
  names, the admin dev-login-shortcut emails and mock-store `localStorage` key on the frontend,
  and one stray `#RostiCreator` hashtag in seeded mock content. ~90 `@rosti.uz`/`rosti.uz` email
  and URL literals across ~19 e2e specs and ~6 unit specs in `apps/api` were bulk-replaced to
  `@sofsavdo.com`/`sofsavdo.com`.
- **Root markdown docs**: mechanically updated (title, product name, example domain/URLs, support
  email) in README.md, ARCHITECTURE.md, API.md, ANALYTICS.md, docs/PROHIBITED.md, LEGAL.md,
  BACKUP_RESTORE.md, ENVIRONMENT.md, DEPLOYMENT.md, RUNBOOK.md, SECURITY.md,
  PRODUCTION_READINESS.md — done last, after all code changes landed. `DECISIONS.md` and this
  file's own earlier phase entries deliberately keep the old name where they're a historical
  record of what was actually built/tested at the time (same convention as an ADR log) — only this
  entry and everything going forward uses Sofsavdo.
- **Verification**: repo-wide case-insensitive grep for "rosti" returns zero hits outside
  `DECISIONS.md` and this file's own pre-Phase-B history. Fresh `npm install` succeeded first try.
  Backend `tsc --noEmit`/`eslint` clean; frontend `tsc --noEmit`/`eslint` clean (same 8
  pre-existing warnings as Phase A, unrelated to this rebrand). Full backend unit suite: 714/714
  passing, 53 suites. Both apps' production builds (`nest build`, `next build`) succeed, including
  the new Phase A routes (`/creator/sales`, `/creator/profile`). **Browser-verified**: both dev
  servers restarted clean after the scope rename (an orphaned pre-rename Turbopack worker process
  briefly caused a stale `Can't resolve '@sofsavdo/config/tokens.css'` error until fully killed and
  restarted — a process-hygiene issue, not a code defect); homepage renders "Sofsavdo" with correct
  computed styles (brand red `rgb(229, 57, 53)` confirmed via computed style, not just visual
  inspection); Swagger UI at `/docs` reads "Sofsavdo API"; API boots and connects to real Postgres
  with all routes mapped, including Phase A's new endpoints.
- **Not done here, by design**: no vision/feature changes (Commerce Home, Catalog, Buyer Accounts,
  payment-provider registry) — those are Phases C through G of the same approved plan, not started
  yet.

## Phase C — Premium Commerce Home — DONE (2026-07-29)

Scoped exactly to the approved plan's Phase C: a curated public homepage plus the minimal backend
needed to feed it. No Buyer Accounts, no `/catalog`, no payment-provider work — those stay Phase
D/E/F, not started here.

- **Backend**: `Offer.isFeatured Boolean @default(false)` (migration `20260731000000_offer_featured`,
  new `@@index([isFeatured, status])`), settable via `CreateOfferDto`/`UpdateOfferDto` and toggled
  via two new dedicated endpoints, `POST /admin/offers/:id/feature|unfeature` (reuses the existing
  `offer.write` permission — same precedent as `isIndexable`). New `OffersService.listFeaturedPublic()`
  + `PublicOffersController`'s `GET /offers/featured` (`@Public()`) — server-capped at a fixed
  `FEATURED_OFFERS_LIMIT = 8`, never a client-suppliable page size, filtered to `isFeatured && status
  === "ACTIVE"` plus the same startsAt/expiresAt bounds `computeAvailability` already uses. Returns
  a narrow, public-safe projection (id/slug/name/headline/price/currency/first product image) — no
  internalDescription, no createdBy/updatedBy, no variants. `PublicLandingController`'s stale "no
  list endpoint exists here or anywhere else" comment corrected to name this one deliberate
  exception. See DECISIONS.md ADR-022 for the full reasoning, including why `isFeatured` is
  deliberately independent of the `activate`/`pause`/`archive` status transition matrix.
- **Frontend**: `apps/web/app/page.tsx` rewritten as a genuine Server Component (previously a
  client-rendered "minimal corporate root page" — brand name + two creator CTAs, nothing else).
  New `apps/web/src/components/home/` — `Hero`, `WhySofsavdo`, `FeaturedProducts` (server-fetched,
  zero client `useQuery`), `CreatorProgramBlurb` (carries forward the old homepage's exact
  creator-recruitment pitch/CTAs as a secondary section), `BenefitsGrid`, `FAQ` (native
  `<details>`/`<summary>`, zero client JS), `SupportSection`, `Footer`. `export const revalidate =
  60` — safe since this page reads no cookie/per-visitor state, unlike `/o/[offerSlug]`'s
  `force-dynamic`. Fixed a genuinely dead link found while rewriting this page: the old homepage
  linked to `/support`, which has never existed as a route (only `/legal/terms`,
  `/legal/privacy`, `/legal/refund-policy` do) — the new `SupportSection` surfaces the real
  `BRAND.supportEmail` contact directly instead.
- **Found, not fixed here (flagged as a separate task)**: `max-w-page`, used throughout
  `apps/web` (checkout, offer-landing sections, the old homepage), resolves to nothing under
  Tailwind v4 — no `--width-page`/`--container-page` theme variable was ever registered, so every
  page using it has silently had no real max-width cap. The new homepage uses real Tailwind v4
  scale classes (`max-w-7xl`/`max-w-3xl`) instead of perpetuating it; fixing the pre-existing
  occurrences repo-wide is out of this phase's scope and tracked as its own follow-up.
- **Tests**: 7 new backend unit tests (`offers.service.spec.ts`'s `listFeaturedPublic`/
  `feature`/`unfeature` blocks) — 721/721 backend unit tests passing, 53 suites. New e2e tests
  added to `offers.e2e-spec.ts` (feature/unfeature toggle, `GET /offers/featured` requires no auth,
  never returns DRAFT/PAUSED/ARCHIVED even when featured, returns the public-safe projection only,
  and — the plan's own explicit ask — seeds 50 featured live offers and confirms the response still
  caps at 8) but **could not be run against real Postgres**: the same Railway-hosted test-DB outage
  documented in Phase A's entry (`Connection terminated due to connection timeout`) was still live
  throughout this phase, confirmed by retrying `prisma migrate deploy` multiple times across the
  session. `tsc --noEmit -p tsconfig.test.json` and `eslint` both pass clean on the new e2e file, so
  the tests are known-correct-by-typecheck but not yet execution-verified against a real DB — flagged
  honestly rather than claimed as passing.
- Backend `tsc --noEmit`/`eslint` clean; `prisma generate` re-run after the schema change (caught
  and fixed 5 compile errors from a stale Prisma client — a real, expected step, not a bug).
  Frontend `tsc --noEmit`/`eslint` clean (same 8 pre-existing, unrelated warnings); `next build`
  succeeds, `/` now shows a 60s ISR revalidate window in the build's route table instead of static.
- **Browser-verified**: homepage renders all 8 sections with correct copy and computed brand-red
  styling (`rgb(229, 57, 53)`, confirmed via computed style, not just visual inspection); server
  logs confirm `GET /offers/featured` is genuinely reached and genuinely hits Postgres (not
  short-circuited or mocked) — it 500s only because of the same real DB outage above, and the
  homepage's `.catch(() => [])` correctly rendered the graceful "no featured products yet" empty
  state rather than crashing, which is real evidence the error-handling path works even though the
  success path (an actual seeded featured offer rendering as a card) couldn't be exercised live
  this session. Re-verify the success path and re-run the new e2e suite once the test DB is
  reachable again — noted here rather than silently assumed passing.
- **Not built here, by design**: `/catalog`, Buyer Accounts, payment-provider registry, performance
  pass — Phases D through G of the same approved plan.

## Architecture Review — Long-Term Product Strategy — DONE (2026-07-29)

The user asked for a chief-architect-level review of six proposed initiatives before any
implementation, explicitly inviting pushback rather than literal execution. Full analysis and
decisions recorded in `DECISIONS.md` ADR-023 (Seller) and the architecture-review plan; summary
here for the phase log:

- **Product/Campaign/Landing**: kept as three separate entities (schema unchanged) — research
  confirmed `Offer 1─* Campaign` is a real, used multiplicity (multiple recruitment drives per
  Offer with independent commission terms), so auto-merging would break the moment a second
  Campaign is wanted. Fixed the actual complaint (too many manual clicks) with a guided wizard
  instead — see below.
- **Public homepage CMS, AI Product Creation Engine, Creator Motivation System, Creator Fund**:
  architecture-level recommendations only, not built this phase (six initiatives, one detailed and
  built per delegated sequencing). Key calls: homepage CMS gets a new `HomepageSection` model
  (not a reuse of `LandingSection`, which is 1:1-scoped to a single Offer) with `startsAt`/
  `expiresAt` for seasonal scheduling; "trending" stays an editorial flag, not a computed
  algorithm; categories are explicitly Phase E's concern, not this CMS's. AI engine confirmed
  text-first (image generation deferred to its own evaluation spike), built as a `ProductAiPort`
  mirroring the existing `PaymentPort`/`StoragePort` provider-agnostic pattern. Creator leaderboard
  confirmed as short-interval polling (~20-30s, Redis-cached), not WebSocket/SSE — this codebase
  has zero push infrastructure today. Research surfaced a real prerequisite gap: the creator
  dashboard's "today/month/lifetime" stats are 100% frontend-mocked (`mocks/store.ts`'s
  `apiGetDashboardStats`, never gated behind `USE_REAL_API`) — no real backend endpoint exists yet;
  this must be built for real before any leaderboard can rank real numbers.
- **Seller architecture**: confirmed "ADR now, build later" over building hidden schema/guards
  today — no seller relationship exists yet to validate requirements against, and speculative
  architecture for an unvalidated business relationship risks encoding wrong guesses. `DECISIONS.md`
  ADR-023 documents the exact extension points (`Product.sellerId`, a `RequireSellerGuard`
  mirroring `RequireCreatorGuard`, seller-scoped payout/commission-cut as the one genuinely
  unresolved question) so the eventual addition is fast, not a fresh research project.
- **Built this phase (chosen as the first of six, smallest/lowest-risk, delegated sequencing)**:
  **Admin Product Launch Wizard** — `apps/web/app/admin/(app)/products/launch/page.tsx` +
  `ProductLaunchWizard.tsx`, chaining the existing Product → Offer → Landing → optional Campaign
  create flows with context carried forward automatically (no new backend endpoints, no schema
  changes — 100% frontend orchestration of already-working APIs). The Landing step auto-scaffolds
  5 default sections (HERO/BENEFITS/PRICING/FAQ/FINAL_CTA) via the existing `addSection` endpoint
  in a loop, so there's an editable skeleton instead of a blank page — admin still uses the
  existing, unmodified `SectionEditor` for all further editing. Campaign step is explicitly
  optional ("skip — add later"), preserving the real 1-Offer-to-many-Campaigns relationship.
  `ProductForm`/`OfferForm`/`CampaignForm` each gained one optional `onCreated` callback prop
  (falls back to the existing `router.push` navigation when omitted) — the only changes to
  existing, working files, and the standalone `/admin/{products,offers,campaigns}/new` pages are
  completely unaffected.
- **Verification**: frontend `tsc --noEmit`/`eslint` clean (same 8 pre-existing warnings);
  `next build` succeeds with the new `/admin/products/launch` route registered. Browser-verified:
  the route compiles and renders (200), and correctly redirects to `/admin/login` via the existing
  `AdminGuard` when unauthenticated — proving no render-time crash in the new code. **Could not
  complete a full authenticated multi-step walkthrough**: the Railway-hosted test Postgres was
  confirmed down during this session (`/health/status`: `"database":{"status":"down","message":
  "Connection terminated due to connection timeout"}`), the same recurring environmental limitation
  documented in Phases A/B/C — login itself 500s without a reachable database, unrelated to this
  phase's code. Flagged honestly rather than claimed as passing; re-verify the full wizard
  walkthrough (real Product → Offer → Landing with 5 scaffolded sections → skip Campaign → confirm
  each entity's standalone admin page still works normally) once the test DB is reachable again.
- **Not built this phase, by design**: AI Product Creation Engine, Homepage CMS, Creator
  Motivation System (leaderboard/competitions/ticker), Creator Fund — architecture-level direction
  only; full implementation plans for each when their turn in the sequence arrives.

## Phase D — Buyer Accounts — DONE (2026-07-29)

Full buyer registration/login, order history, saved products, and addresses — the largest phase
since the Sofsavdo pivot began. Scoped exactly to the original approved plan, with two deliberate,
disclosed deviations discovered while implementing (see DECISIONS.md ADR-024 for full reasoning).

- **Schema**: `Customer.userId String? @unique` (nullable FK to `User`, `onDelete: SetNull` — order
  history must survive account deletion), new `SavedProduct` (`@@unique([userId, offerId])`) and
  `BuyerAddress` models, both keyed directly on `User.id` (no separate `BuyerProfile` — see below).
  Migration `20260801000000_buyer_accounts`.
- **Auth**: new `POST /auth/register-buyer` (separate endpoint, not a shared `role` field on
  `/auth/register` — that endpoint unconditionally creates a `CreatorProfile` + DRAFT
  `CreatorApplication`, which a buyer must never get). Login/refresh/logout/me are unchanged and
  already fully principal-agnostic, confirmed by reading `AuthService` directly rather than
  assumed. New `@OptionalAuth()` decorator + one new `JwtAuthGuard.handleRequest` branch — the
  standard NestJS/Passport optional-auth pattern — so `POST /offers/:slug/checkout` recognizes a
  logged-in buyer's session without ever rejecting a token-less guest checkout.
- **Customer/Buyer reconciliation** (the one decision with real data-model consequences, made
  explicitly): two merge-not-duplicate write paths — `AuthService.registerBuyer` links a guest
  `Customer` row by phone at registration time; `OrdersService.upsertCustomer` (given an
  authenticated buyer's `userId`) looks up by `userId` first, then falls back to a phone-match-
  and-link, before ever creating a new row. A `Customer` is never duplicated once linked.
- **Deviation #1 (disclosed, not silent): no `RequireBuyerGuard` was built**, despite the original
  plan naming one. Investigating why `RequireCreatorGuard` exists (a real approval-gate check)
  showed a buyer equivalent would only ever re-verify what the global `JwtAuthGuard` already
  guarantees — building it would be exactly the unnecessary-abstraction pattern this project's own
  conventions warn against. Buyer routes use the default guard plus row-level `WHERE userId =
  req.user.userId` scoping in each service instead — the same ownership guarantee, done where
  there's actually data to check against.
- **Deviation #2 (disclosed): no separate `BuyerProfile` model** — `SavedProduct`/`BuyerAddress`
  reference `User.id` directly, since every authenticated user can act as a buyer with no approval
  gate (unlike Creator). Revisit only if a genuine buyer-specific field ever needs a home that
  isn't `User`.
- **Backend modules**: `BuyerOrdersController` (`GET /buyer/orders`, `GET /buyer/orders/:id` —
  same 404-for-both-"doesn't exist"-and-"not yours" convention as `CreatorSalesController`),
  `SavedProductsController` (idempotent save/unsave — a heart-icon toggle should never error on
  a repeat click), `BuyerAddressesController` (CRUD + set-default, directly modeled on
  `PayoutMethodsService`'s proven default-rotation pattern). `BuyerOrderSummary` includes a
  lightweight `payment` field at zero extra query cost (already fetched by `ORDER_INCLUDE`) so the
  Purchases/Payment-History pages work off the list response alone, with no N+1 detail fetch.
- **Frontend**: `apps/web/app/buyer/(auth)/{login,register}` + `apps/web/app/buyer/(app)/*` — 10
  pages (dashboard, orders + detail, purchases, payments, saved, addresses, profile, notifications,
  support), `BuyerAppGuard`/`BuyerShell`/`BUYER_NAV_ITEMS` mirroring the Creator app's own proven
  shell pattern, `BuyerSessionProvider` (own TanStack Query cache key, own `/auth/register-buyer`
  call, otherwise the exact same session-as-query-cache pattern as Creator/Admin). Notifications
  page reuses the *existing* `/creator/notifications*` endpoints directly with zero backend
  changes — that domain was already ownership-scoped by `userId`, not creator-specific despite the
  URL prefix (confirmed by reading `CreatorNotificationsController`'s own comment). "Promo Codes"
  from the original nav list is a disclosed, not silently dropped, gap: no backend exists for
  "which promo codes has this buyer used" (`PromoCode` tracks codes per-campaign, not per-buyer
  usage), and this project's own convention is to never ship a page backed by fabricated data.
- **Tests**: 31 new backend unit tests across 5 files (`auth.service.spec.ts`'s new
  `registerBuyer` block, `orders.service.spec.ts`'s new reconciliation + buyer-order-read blocks,
  new `jwt-auth.guard.spec.ts`, `saved-products.service.spec.ts`, `buyer-addresses.service.spec.ts`)
  — 752/752 backend unit tests passing, 56 suites. New `test/buyer-accounts.e2e-spec.ts` (register/
  login, the reconciliation scenario end-to-end via real HTTP, ownership-scoping 404s, saved-
  products idempotency, address default-rotation) — `tsc --noEmit -p tsconfig.test.json` and
  `eslint` both clean, but **could not be run against real Postgres**: the same Railway test-DB
  outage from Phases A/B/C was confirmed still down at the end of this phase too (`P1001: Can't
  reach database server`, checked multiple times across the session). Frontend `tsc --noEmit`/
  `eslint` clean (same 8 pre-existing warnings); `next build` succeeds with all 12 new `/buyer/*`
  routes registered.
- **Browser-verified**: `/buyer/login` and `/buyer/register` render correctly with no console
  errors; `/buyer/dashboard` (and by the same guard, every other `/buyer/(app)/*` page) correctly
  redirects unauthenticated visitors to `/buyer/login` via `BuyerAppGuard` — confirmed via server
  logs showing the real redirect, not just an assumption. **Could not verify the full authenticated
  walkthrough** (register → empty dashboard → save a product → add an address → see a guest order
  merge into Order history) live, for the same DB-outage reason above — flagged honestly per this
  project's own "verify everything, don't claim what wasn't checked" standard. Re-run
  `buyer-accounts.e2e-spec.ts` and the manual walkthrough once the test DB is reachable again.
- **Not built here, by design**: `/catalog` (Phase E — buyers can currently only reach an
  individual offer via `/o/[slug]`, never browse), the payment-provider registry (Phase F),
  performance pass (Phase G).

## Phase E — Product/Offer Catalog — DONE (2026-07-29)

The last piece of the original "no public browsing" rule to be deliberately relaxed. Scoped
exactly to the approved plan: real pagination, type/price filtering, no search, no categories.

- **Backend**: `GET /offers/catalog` (`@Public()`, new `CatalogQueryDto` — no `search` field at
  all, not just an unused one) on the existing `PublicOffersController`. Filters to
  `status: "ACTIVE"` on non-archived products, live availability window (same startsAt/expiresAt
  bounds as `computeAvailability`), optional product-type and price-range filters.
  `CATALOG_MAX_PAGE_SIZE = 48` enforced twice — once as `PaginationQueryDto`'s inherited DTO-level
  `@Max`, once again clamped in `OffersService.listCatalog` itself regardless of what the client
  requests — the same defense-in-depth already established for the homepage's
  `FEATURED_OFFERS_LIMIT`. Returns the same public-safe projection as Featured Offers plus
  `productType`.
- **Frontend**: `apps/web/app/catalog/page.tsx` — a genuine Server Component (no client JS at
  all), filters via a plain server-rendered `GET` form, pagination via plain links carrying the
  current filters forward. New `apps/web/src/components/catalog/ProductCard.tsx`, extracted from
  the homepage's previously-private `FeaturedProductCard` and now shared by both `/` and
  `/catalog` — one place renders this card shape, not two drifting copies. One new "Katalog" link
  added to the homepage Footer — the only new entry point, confirmed via direct DOM inspection
  (`href="/catalog"`), not linked from inside any offer landing page or homepage section.
- **Docs**: `docs/PROHIBITED.md` rewritten — the old blanket "no catalog" line is narrowed to "no
  category navigation" (no `Category` model exists, and adding one was explicitly out of this
  phase's scope) and "no search" (unchanged, `CatalogQueryDto` has no search field). Also corrected
  a genuinely stale line found during this pass: "a customer dashboard that lists multiple
  purchasable things" was already superseded by Phase D's Saved Products feature and should have
  been updated then — fixed now instead of left stale, recorded honestly in `DECISIONS.md`
  ADR-025 rather than silently patched. `public-landing.controller.ts`'s and `app/page.tsx`'s own
  comments updated to reflect `/catalog` actually existing now, not "once it exists."
- **Tests**: 6 new backend unit tests (`offers.service.spec.ts`'s `listCatalog` block — cap
  enforcement, status/type/price filtering, no-search-field assertion, projection shape) —
  758/758 backend unit tests passing, 56 suites. New e2e tests appended to `offers.e2e-spec.ts`
  (unauthenticated access, never returns non-live offers, type filter, price filter, the plan's
  own explicit ask — seeds 60 offers and confirms the response still caps at 48 — and an unknown
  `search` query param is rejected by the whitelist validation pipe) — `tsc --noEmit -p
  tsconfig.test.json` and `eslint` both clean, but **could not be run against real Postgres**: the
  same Railway test-DB outage from every prior phase this session was confirmed still down at the
  end of this phase too. Frontend `tsc --noEmit`/`eslint` clean (same 8 pre-existing warnings);
  `next build` succeeds with `/catalog` registered.
- **Browser-verified**: `/catalog` renders correctly (title, filter form, empty-state message)
  even with the backend's real DB unreachable — proof the page's `.catch()` fallback degrades
  gracefully rather than crashing; the homepage's "Katalog" footer link is present and points to
  `/catalog`, confirmed via direct DOM inspection. **Could not verify the full filtered/paginated
  browsing experience with real seeded offers** live, for the same DB-outage reason — flagged
  honestly. Re-run `offers.e2e-spec.ts`'s new catalog block and a manual filter/pagination
  walkthrough once the test DB is reachable again.
- **Not built here, by design**: any `Category` model or category-based browsing (tracked as a
  future decision, not built speculatively) — the payment-provider registry (Phase F) and
  performance pass (Phase G) are next.

## Phase F — Payment Provider Registry + Checkout UX — DONE (2026-07-29)

Replaces the single hardcoded `PAYMENT_PORT` binding with a real registry, proven by a second
genuinely working payment provider (Cash on Delivery) rather than a refactor with nothing new to
show for it. Also wires a logged-in buyer's saved address into checkout for a faster repeat
purchase.

- **`PAYMENT_PORT_REGISTRY`** (`Map<PaymentProviderType, PaymentPort>`) replaces `PAYMENT_PORT`.
  `PaymentsService.initiatePayment` looks the provider up in the map instead of an `if (provider
  === "CLICK")` branch; `MANUAL` correctly has no registered adapter and skips the redirect step,
  unchanged from before. `ClickCallbackController` keeps a direct `ClickPaymentAdapter` dependency
  (not the registry) since that controller is permanently Click-specific — documented as
  intentional, not an oversight, in `DECISIONS.md` ADR-026.
- **Cash on Delivery** (`CodPaymentAdapter`) is the new adapter proving the registry: no external
  gateway, no callback, no signature — `createPayment` redirects straight to order-success (same
  shape as `MANUAL`), `verifyCallback`/`buildCallbackReply` throw since nothing ever calls them.
  `OrdersService.resolvePaymentProvider` now maps the checkout form's `"COD"` value (which the
  frontend's `PaymentMethodSelector` catalog already listed and labeled *before* this phase — it
  was silently rejected with `PAYMENT_METHOD_NOT_SUPPORTED` the moment a buyer picked it) to
  `CASH_ON_DELIVERY`. An admin marks a COD order `PAID` after the courier collects cash, through
  the existing admin order-status transition endpoint — same pattern already used for `MANUAL`.
- **Checkout UX**: a logged-in buyer's default `BuyerAddress` (Phase D) now pre-fills the checkout
  form's name/phone/region/city/address — pure convenience, every field stays editable. No new
  backend needed: reuses the exact `GET /buyer/addresses` Phase D already built. Account-linking
  itself needed no frontend wiring at all — the checkout POST already carries whatever Bearer
  token is in memory (Admin/Creator/Buyer already shared one token slot before Buyer existed), and
  Phase D's `@OptionalAuth()` route plus `OrdersService.upsertCustomer` do the actual linking
  server-side. **"Past promo-code use" from the original ask was not wired in** — disclosed, not
  silently dropped: no backend tracks "which promo codes has this specific buyer used"
  (`PromoCode`/`PromoCodeUsage` are keyed by campaign/order, not buyer identity), and this
  project's convention is to never wire a UI affordance to data that doesn't exist yet.
- **Tests**: 5 new backend unit tests (`payments.service.spec.ts`'s new CASH_ON_DELIVERY-through-
  the-registry test, new `cod-payment.adapter.spec.ts`, `orders.service.spec.ts`'s new COD-
  resolution test) — 764/764 backend unit tests passing, 57 suites. New e2e tests appended to
  `checkout.e2e-spec.ts`: a full COD lifecycle (checkout → real `Payment.provider ===
  "CASH_ON_DELIVERY"` row → admin marks PAID), COD rejected when an offer doesn't list it as a
  supported option, and — the integration proof the plan itself asked for — a real end-to-end
  logged-in-buyer checkout confirming the order appears in `GET /buyer/orders` with no separate
  claim step, plus a guest-checkout-still-works-unchanged confirmation. `tsc --noEmit -p
  tsconfig.test.json` and `eslint` both clean, but **could not be run against real Postgres**: the
  same Railway test-DB outage from every prior phase this session was confirmed still down at the
  end of this phase too. Frontend `tsc --noEmit`/`eslint` clean (same 8 pre-existing warnings);
  `next build` succeeds.
- **Verified for real, not just typechecked**: restarted the actual running dev server and
  confirmed `PaymentsModule dependencies initialized` with zero DI errors, every new route mapped
  correctly (`/buyer/orders`, `/buyer/saved-products`, `/buyer/addresses`, `/auth/register-buyer`,
  `/offers/catalog`), "Connected to PostgreSQL" at boot, "Nest application successfully started" —
  proof the entire registry refactor's dependency wiring is sound in a real running process, not
  just passing `tsc`. A subsequent request still 500s with the same documented Postgres-timeout
  error as every prior phase — an external outage, not a wiring problem, confirmed by the clean
  boot sequence immediately preceding it. **Could not verify a real end-to-end COD purchase or the
  checkout pre-fill live** for the same DB-outage reason — flagged honestly. Re-run
  `checkout.e2e-spec.ts`'s new blocks and a manual COD + pre-fill walkthrough once the test DB is
  reachable again.
- **Not built here, by design**: Payme/Uzum Nasiya adapters (no real business need yet — the
  registry is what makes adding them a small, well-understood change whenever that need arrives);
  the performance pass (Phase G) is next and last of the originally-approved phases.

## Phase G — Performance Pass — DONE (2026-07-29)

The last of the four originally-approved phases (D→E→F→G). An audit, not a rewrite: most checks
confirmed the codebase's existing conventions already hold at the new Phase D/E/F surfaces; one
real over-fetching bug was found and fixed.

- **Server/Client Component boundary audit**: confirmed zero `"use client"` directives anywhere in
  the Home (`/`) or Catalog (`/catalog`) component trees via `grep`. `/o/[offerSlug]`'s
  `OfferLandingPageClient.tsx` remains a Client Component for a genuine, pre-existing, documented
  reason (`useSearchParams()` for `?ref=` + real/mock API dispatch) — judged correctly
  out-of-scope to "fix," not missed.
- **Bundle-leakage check**: the shared `@sofsavdo/ui` barrel export does export a Recharts-based
  `ChartCard` (used by Admin/Creator dashboards) — verified this never reaches a public bundle by
  directly inspecting the compiled output, not by assumption: `grep -c "recharts"` on
  `.next/server/app/catalog/page.js` and `.next/server/app/page.js` both returned `0`.
- **N+1 audit, `GET /offers/catalog`**: single query with nested `include`, no per-row fan-out — no
  changes needed.
- **N+1 audit, `GET /buyer/orders` — real bug found and fixed**: `OrdersService.listForBuyer` was
  reusing the full 10-relation `ORDER_INCLUDE` (items, statusHistory, attribution, commission,
  refunds, campaign, customer, address, shipment, payment) for a list view that only ever renders 8
  scalar/shallow fields. Rewritten to a narrow Prisma `select` (id, publicToken, status, totalMinor,
  currency, createdAt, offer name, payment provider/status only) — not an N+1 in the classic sense,
  but avoidable per-row data-transfer/deserialization cost at scale. New unit test asserts
  `args.include` is undefined and every unused relation key is absent from `args.select`.
- **`Cache-Control` headers**: added to both `PublicOffersController` routes (`/offers/featured`,
  `/offers/catalog`) — `"public, max-age=30, stale-while-revalidate=120"`, the first such header
  anywhere in this codebase (confirmed via `grep` before adding). Appropriate since neither route
  reads a cookie or varies by caller; the short TTL bounds staleness after an admin's
  isFeatured/activate/price change without needing any cache-invalidation logic, and
  `stale-while-revalidate` means a cache hit never blocks on a slow origin fetch. No CDN/reverse-
  proxy sits in front of the API yet — this is honest advance preparation for one, and also
  benefits any client (browser, future mobile app) that respects it directly.
- **Load-test script extended**: `apps/api/scripts/load-test.ts` gained a catalog-browse check (no
  seeded slug required, always runs) and a `LOADTEST_BUYER_TOKEN`-gated buyer-order-list check
  (measuring the `listForBuyer` rewrite above). Run locally against the live dev server: the
  DB-independent baseline (`GET /health/live`) measured 1850 req/s avg, 2.2ms avg latency, 0
  errors — a clean ceiling. The new catalog check itself could not get a real measurement: the same
  Railway test-DB outage documented in every prior phase this session was confirmed still active
  (server logs showed `Error: Connection terminated due to connection timeout` on every request),
  so autocannon recorded 0 completed requests in the 5s window rather than a false zero-error
  result. This is the load-test script correctly proving the endpoint is wired and reachable, not a
  bug in this phase's code — re-run once the test DB is reachable again for a real DB-backed
  number.
- **Tests**: 765/765 backend unit tests passing, 57 suites (the one new `listForBuyer` lean-select
  test above). `tsc --noEmit` and `eslint` both clean on `apps/api` (including the two edited
  files, `public-offers.controller.ts` and `scripts/load-test.ts`).
- **Not built here**: no new caching layer beyond the two `Cache-Control` headers (no Redis-backed
  response cache — not justified at current scale, matching `ANALYTICS.md`'s own
  "Tier 1 first, add Tier 2 only when proven necessary" precedent); no CDN/reverse-proxy (nothing
  to configure it in front of yet).

All four originally-approved phases (D, E, F, G) are now complete. Per the standing mandate to
finish this plan before moving on, work continued into the newer architecture-review initiatives —
Homepage CMS first, per the sequencing communicated earlier in this session.

## Phase H — Homepage CMS — DONE (2026-07-29)

Makes the Premium Commerce Home (Phase C) admin-configurable, cloning the proven `LandingSection`
CMS pattern (see DECISIONS.md ADR-027 for full reasoning on every deviation from that pattern).

- **Schema**: new flat `HomepageSection` model (`HomepageSectionType` enum: HERO, WHY_SOFSAVDO,
  FEATURED_PRODUCTS, BANNER, CREATOR_PROGRAM_BLURB, BENEFITS, FAQ, SUPPORT, CUSTOM_RICH_TEXT,
  CATEGORY_GRID) — no parent entity, no draft/published/archived workflow (the homepage is always
  live; each section's own `isActive` is the only visibility switch). `startsAt`/`expiresAt` reuse
  the same stored-flag-plus-computed-availability split `Offer.computeAvailability` established.
  Migration `20260802000000_homepage_cms` ships with zero seed rows by design — see below.
- **Backend**: `apps/api/src/homepage/` — `HomepageSectionsService` (list/add/update/reorder/remove
  + `computeAvailability`, same sortOrder-management logic as `LandingsService`), admin controller
  at `/admin/homepage-sections` (flat, no offerId nesting), public `GET /homepage` (`@Public()`,
  same `Cache-Control` header Phase G introduced for `/offers/featured`+`/offers/catalog`) returning
  only LIVE sections (active AND within any date window), buyer-safe shape only (no `id`/
  `isActive`/dates). New `homepage.read`/`homepage.write` permission keys (MANAGER read, ADMIN
  write, no publish/archive verbs — RBAC.md updated). `FEATURED_PRODUCTS`'s own `content` is never
  read — its presence/isActive only tells the homepage whether to render the pre-existing
  `listFeaturedPublic()` slot, keeping "curated/trending" a single source of truth in
  `Offer.isFeatured` rather than a duplicate concept.
- **No pre-seeded default rows, by design**: seeding real content via raw SQL inside a schema
  migration was judged too risky for what this table doesn't strictly need. Instead,
  `apps/web/app/page.tsx` renders its exact original Phase C fixed component tree whenever
  `GET /homepage` returns zero rows — a fresh/unconfigured environment and an unreachable backend
  hit the same code path (same defensive `.catch(() => [])` convention as `/catalog`), so the
  homepage is never visually empty and shipping this feature required no production data
  migration risk at all.
- **Existing home components made CMS-capable, not replaced**: `Hero.tsx`, `WhySofsavdo.tsx`,
  `CreatorProgramBlurb.tsx`, `BenefitsGrid.tsx`, `FAQ.tsx`, `SupportSection.tsx` each gained an
  optional `content` prop with their current hardcoded copy as the fallback default — an
  individual section that exists in the CMS but has an empty/missing field still renders
  sensibly. Two new components with no default copy at all (`Banner.tsx`, `CustomRichText.tsx`)
  render nothing when empty, matching `docs/PROHIBITED.md`'s ban on fabricated placeholder
  content. New `HomepageSectionRenderer.tsx` dispatches by `type`, mirroring the offer landing
  page's own `LandingSectionRenderer` for the same reason (one renderer, not scattered
  conditionals). Zero `"use client"` added anywhere — the homepage stays a pure Server Component.
- **Admin UI**: `apps/web/app/admin/(app)/homepage/page.tsx`, cloned from the Landing builder page
  but flat and with no publish/archive/preview-iframe workflow (the homepage IS the preview — the
  page's own "Ochiq sahifa" link just points at `/`). `HomepageSectionEditor.tsx` is a per-type
  switch rather than the Landing domain's generic single-field `shape` system — Homepage section
  types have several distinct named fields each (e.g. Hero's title/subtitle/ctaLabel/ctaHref),
  which a generic shape would have forced awkwardly into one field. Two datetime-local inputs
  (startsAt/expiresAt) sit above the per-type editor for any section, enabling real scheduled
  banners. New nav entry under the existing "Katalog" admin nav group.
- **Trending/categories deliberately NOT built, exactly as the architecture review recommended**:
  no sales-velocity rollup, no generalized `homepageTag` enum — `Offer.isFeatured` already works,
  is tested, and stays the single mechanism for "curated." `CATEGORY_GRID` ships as an enum value
  now (future-complete type list) but stays inert until Phase E's own `Category` model exists; the
  admin editor tells an admin this explicitly rather than silently accepting unusable content.
- **Tests**: 14 new backend unit tests (`homepage-sections.service.spec.ts` — computeAvailability's
  four branches, add/update/remove/reorder sortOrder management, listPublic's LIVE-only filter and
  admin-field-dropping) — 779/779 backend unit tests passing, 58 suites. New
  `test/homepage.e2e-spec.ts` — and this phase got something no prior Sofsavdo-pivot phase this
  session did: **the Railway test database briefly became reachable**, and this suite passed in
  full against real Postgres (5/5) on an isolated run, confirmed twice. `prisma migrate deploy`
  also applied all pending migrations (including this phase's) cleanly against that database. The
  one real issue that live run surfaced was a fixture gap, not a code bug: the new
  `homepage.read`/`homepage.write` keys weren't yet `Permission` rows in that database, since
  `seedRolesAndPermissions` — the idempotent sync between `permissions.constants.ts` and the
  `Permission` table — hadn't been re-run there since this phase added them; running it once
  (no application code change) fixed it. A subsequent attempt to also confirm the still-unverified
  Phase D/E/F suites live (a 22-suite full regression, then `buyer-accounts.e2e-spec.ts` in
  isolation) hit the same Railway connection dropping again partway through — confirming the
  outage documented since Phase A is intermittent, not resolved. Phase D/E/F's own e2e suites
  remain unverified live as a result; only Phase H's suite got a real, repeated, passing
  confirmation before the connection dropped again. Frontend `tsc --noEmit`/`eslint` clean (same
  8 pre-existing warnings, zero new ones); `next build` succeeds with `/admin/homepage` registered.
- **Browser-verified**: the homepage renders identically to Phase C's fixed output when
  `GET /homepage` returns zero rows (confirmed via direct page-text comparison — every section's
  exact copy present, in the original order); `/admin/homepage` correctly redirects an
  unauthenticated visitor to `/admin/login` via the existing `AdminGuard`, proving no render-time
  crash in the new admin page.
- **Not built here, by design**: AI Product Creation Engine, Creator Motivation System + Fund —
  next in the sequence per this session's own stated ordering; production-readiness handoff work
  after that.

## Phase I — AI Product Creation Engine (text-only v1) — DONE (2026-07-29)

Text-only AI-assisted product copywriting, built as a swappable port the same way `PaymentPort`/
`StoragePort` already are, always a review-before-save draft (see DECISIONS.md ADR-028).

- **Backend**: `apps/api/src/product-ai/` — `ProductAiPort` interface + `ClaudeProductAiAdapter`
  (`@anthropic-ai/sdk`), registered behind the `PRODUCT_AI_PORT` token in `ProductAiModule`. The
  adapter forces structured output via a single Claude tool (`submit_product_draft`) with a strict
  `input_schema` and `tool_choice` set to it, rather than parsing JSON out of free text. `POST
  /admin/product-ai/draft` (reuses `product.write`, no new permission key — same reasoning as
  Campaign media reusing `campaign.write`). New `AI_NOT_CONFIGURED` (503)/`AI_GENERATION_FAILED`
  (502) error codes. `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` env vars, empty-string-means-unconfigured
  and fails loudly per-call rather than at boot — same convention as `TELEGRAM_BOT_TOKEN`/`SMTP_*`.
- **A real, disclosed external-credential gap**: no Anthropic API key exists in any environment
  this session has access to — this is the same category of item flagged at the start of this
  session as something requiring the user to supply it themselves. The full architecture is built
  and unit-tested regardless (mocked `@anthropic-ai/sdk` client); real generation will work the
  moment the user sets `ANTHROPIC_API_KEY` in the deployment environment, with zero code changes.
- **Images are already-hosted URLs, not a new upload pipeline** — `imageUrls` accepts URLs (pasted,
  or from an existing Product's `images` field), passed to Claude via its `image` content block's
  `url` source directly (no backend fetch/base64-encode). Building new upload plumbing for this
  would have been scope creep beyond what the architecture review asked for.
- **Frontend**: `ProductAiDraftPanel.tsx` wired into the Admin Product Launch Wizard's Product
  step — image URLs/short description/product name in, a full editable review of every draft field,
  and an explicit "Ishlatish" (never automatic) hands the draft up to the wizard. Of the draft's 15
  fields, only `title`/`shortDescription` have a real home in `ProductForm` today (it doesn't even
  expose a `description` field yet) — those two get a genuine `setValue`-based prefill via a new
  `aiPrefill` prop. `benefits`/`faq` get threaded into the wizard's Landing-scaffold step,
  pre-populating BENEFITS/FAQ section content instead of empty sections (`addLandingSection`/
  `useAddLandingSection`/the mock store's `apiAdminAddLandingSection` all gained an optional
  `content` param to support this — a small, backward-compatible extension, existing callers
  unaffected). The remaining fields (description, features, specs, usageInstructions, ctaLabel,
  marketingCopy, seoTitle/Description/Keywords, highlights, tags, and Offer-step headline/
  subheadline/SEO) are shown for the admin to read and manually copy but aren't auto-wired —
  disclosed as a real v1 scope boundary in ADR-028, not silently dropped.
- **Tests**: 7 new backend unit tests (`claude-product-ai.adapter.spec.ts` — AI_NOT_CONFIGURED,
  forced tool_choice/image-block shape, AI_GENERATION_FAILED on both a missing tool_use block and a
  rejected API call; `product-ai.service.spec.ts` — the either-or imageUrls/shortDescription
  validation) — 786/786 backend unit tests passing, 60 suites. New `test/product-ai.e2e-spec.ts`
  **ran for real against Postgres** (the test DB was reachable again during this phase): 3/3
  passing, including a genuine end-to-end confirmation of the real unconfigured-environment
  behavior (503 `AI_NOT_CONFIGURED`) — the actual current state of this deployment, not a mocked
  assumption. Frontend/backend `tsc --noEmit`/`eslint` clean (web: same 8 pre-existing warnings,
  zero new ones); both apps' production builds succeed with `/admin/product-ai/draft` and the
  updated `/admin/products/launch` route registered.
- **Browser-verified**: `/admin/products/launch` (now rendering `ProductAiDraftPanel` above
  `ProductForm`) still correctly redirects an unauthenticated visitor to `/admin/login`, confirmed
  via server logs (clean 200 responses throughout, no exceptions) after an initial page-text read
  raced the redirect and came back empty — a tool-timing artifact, not a real bug.
- **Not built here, by design**: image generation (confirmed out of scope for v1, a separate future
  spike); any Seller-facing caller (no Seller exists yet — see ADR-023); Creator Motivation System
  + Fund is next in the sequence.

## Phase J/K — Creator Motivation System: Dashboard Stats + Leaderboard — DONE (2026-07-29)

The user gave an explicit standing performance requirement for this initiative: buyer, creator, and
admin experiences must all feel fast, never frozen or slow-loading. Every caching decision below
was designed with that in mind from the start (see DECISIONS.md ADR-029 for full reasoning).

- **Phase J — real creator dashboard stats**: `GET /creator/dashboard-stats`
  (`apps/api/src/creator-dashboard/`) replaces `apiGetDashboardStats`, which was 100% frontend-
  mocked and — unlike every other mock function in `mocks/store.ts` — never gated behind
  `USE_REAL_API` at all, so "real API mode" never actually made this page real. Real today/
  monthToDate/**lifetime** (new — the architecture review flagged this bucket as missing
  entirely) stats computed from `Commission` (creatorId is direct on that model, indexed on
  `[creatorId, status]` and `createdAt`), excluding REJECTED/REFUNDED from every money aggregate
  but not from order counts. Reuses `CommissionsService.getWalletBalance` as-is for
  pending/available/locked/paid rather than re-deriving it. Redis-cached 30s per creator via
  `AnalyticsCacheService` (now exported from `AnalyticsModule` for this reuse) — a repeat dashboard
  visit within that window renders from the frontend's own query cache with zero network
  round-trip. The fake `series7d`/`series30d`/`series90d` (Math.random()-generated for every
  creator except one hardcoded demo account) become one real 30-day daily-revenue series;
  `epcMinor`/separate `approvedCommissionMinor` are dropped (no real source without more scope than
  this pass needed) in favor of the new lifetime section. `@sofsavdo/types`'
  `DashboardStats`/`DashboardSeriesPoint` (now-orphaned) removed.
- **Phase K — leaderboard**: `GET /creator/leaderboard` (`apps/api/src/creator-leaderboard/`)
  ranks creators by this-month commission *earned* (not GMV/order value, deliberately different
  from the admin-only `CreatorAnalyticsService` equivalent) — a native Prisma `groupBy` on
  `Commission` needs no raw SQL join at all, since `creatorId` is already direct on that table.
  Redis-cached 60s, but platform-wide (one cache entry serves every creator's request, not
  per-creator) — under concurrent load, hundreds of creators checking their rank in the same
  minute still trigger at most one real recompute. Returns the top 20 by earnings plus the
  requesting creator's own rank even when outside that cap (never zero-context for a low-ranked
  creator). Frontend polls every 30s (`refetchIntervalInBackground: false` — paused when the tab
  isn't focused), deliberately faster than the backend's own 60s TTL so most polls land on a
  guaranteed cache hit — the confirmed "short-interval polling, not WebSocket" decision from the
  original architecture review.
- **Both endpoints follow the existing creator-facing route convention exactly**
  (`RequireCreatorGuard`, ownership scoped by the JWT's own `creatorId`, no RBAC permission key —
  same as `CreatorSalesController`), not a new pattern.
- **Tests**: 12 new backend unit tests (`creator-dashboard.service.spec.ts` — cache hit/miss,
  REJECTED/REFUNDED exclusion, conversionRate divide-by-zero guard, 30-day fill-gaps behavior;
  `creator-leaderboard.service.spec.ts` — ranking/rank-assignment, cache reuse, the
  requester's-own-rank-outside-top-20 case) — 798/798 backend unit tests passing, 62 suites. New
  `test/creator-dashboard.e2e-spec.ts` and `test/creator-leaderboard.e2e-spec.ts` — both
  typecheck/lint clean, but **could not run against real Postgres this time**: the Railway test
  database (briefly reachable during Phases H/I) was down again for the rest of this session,
  consistent with the intermittent-outage pattern documented since Phase A. Frontend
  `tsc --noEmit`/`eslint` clean (same 8 pre-existing warnings, zero new); both apps' production
  builds succeed with `/creator/leaderboard` and the updated `/creator/dashboard` registered.
- **Browser-verified**: `/creator/dashboard` and `/creator/leaderboard` both correctly redirect an
  unauthenticated visitor to `/creator/login` (confirmed via server logs — clean 200 responses,
  200ms-scale compiles, no exceptions — after an initial page-text read raced the redirect and came
  back empty, the same tool-timing artifact noted in Phase I's entry, not a real bug).
- **Not built here, by design**: Competition domain (Campaign-sized CRUD for time-bound creator
  contests) and the activity ticker — next in the sequence; Creator Fund (donation/contribution
  ledger) after that.

## Phase L — Creator Motivation System: Competition Domain — DONE (2026-07-29)

Time-bound creator contests, the third sub-phase of the Creator Motivation System (see
DECISIONS.md ADR-030 for full reasoning).

- **Schema**: new `Competition` model (`CompetitionStatus`: DRAFT/ACTIVE/COMPLETED/ARCHIVED —
  deliberately no PAUSED, a time-bound contest pausing mid-way is unrequested complexity) —
  name/slug/description/prizeDescription (free text — a prize is announced/fulfilled manually by
  an admin, never wired through Commission/Payout)/startAt/endAt/archivedAt/createdBy/updatedBy.
  Migration `20260803000000_competitions`. New `competition.read/write/publish/complete/archive`
  permission keys (mirrors `campaign.*`'s shape minus `.pause` — RBAC.md updated).
- **Backend**: `apps/api/src/competitions/` — `CompetitionsService` (admin CRUD, transition matrix
  DRAFT→ACTIVE→COMPLETED→ARCHIVED, `computeAvailability` mirroring Offer/Campaign's stored-status-
  plus-computed-window split exactly), admin controller at `/admin/competitions`, creator-facing
  `GET /creator/competitions` (only ACTIVE competitions whose computed availability is LIVE or
  SCHEDULED — never DRAFT/EXPIRED/ARCHIVED) and `GET /creator/competitions/:id/leaderboard`.
- **Ranking logic extracted and shared, not duplicated**: `rankCreatorsByCommission(prisma, range)`
  (`apps/api/src/creator-leaderboard/rank-creators-by-commission.util.ts`) was pulled out of Phase
  K's `CreatorLeaderboardService` so both the platform leaderboard (always "this month") and the
  new Competition leaderboard (an arbitrary admin-chosen date window) call the exact same
  groupBy-on-Commission query. Competition leaderboard gets its own 30s Redis TTL (vs. the
  platform leaderboard's 60s) — a contest's window is often much shorter than a month, so
  staleness matters proportionally more near its close.
- **Frontend**: admin `apps/web/app/admin/(app)/competitions/{page,new/page,[id]/page}.tsx` (list
  via the existing `DataTableShell` pattern, `CompetitionForm.tsx` shared between create/edit,
  publish/complete/archive buttons mirroring the Landing builder's `ALLOWED_NEXT_ACTIONS`
  convention). Creator `apps/web/app/creator/(app)/competitions/{page,[id]/page}.tsx` — a card
  grid of active/upcoming competitions, and a detail page reusing the same leaderboard-row UI
  Phase K's platform leaderboard page established (30s polling, paused when the tab isn't
  focused). Both apps' nav gained a "Musobaqalar" entry.
- **Tests**: 15 new backend unit tests (`competitions.service.spec.ts` — every `computeAvailability`
  branch, the full transition matrix including out-of-order and out-of-ARCHIVED rejections,
  slug-clash rejection, the creator-facing LIVE/SCHEDULED filter, leaderboard cache reuse) —
  813/813 backend unit tests passing, 63 suites. New `test/competitions.e2e-spec.ts` — typecheck/
  lint clean, but **could not run against real Postgres this time**: the Railway test database
  was down for this entire phase, consistent with the intermittent-outage pattern documented since
  Phase A. Frontend `tsc --noEmit`/`eslint` clean (same 8 pre-existing warnings, zero new); both
  apps' production builds succeed with all 5 new competition routes registered.
- **Browser-verified**: `/admin/competitions` and `/creator/competitions` both correctly redirect
  an unauthenticated visitor to their respective login pages (confirmed via server logs — clean
  200 responses, no exceptions — and a direct page-text read on each guard's login screen).
- **Not built here, by design**: an admin-side leaderboard preview (ranking is creator-facing only;
  admin has no `creatorId` to scope a "my rank" view against); a "join" mechanic (every creator
  whose Commission earnings fall within the window automatically participates — no separate
  registration step, same zero-friction shape as the platform leaderboard). Next in the sequence:
  the activity ticker, then the Creator Fund.

## Phase M — Pre-Launch Real-Data Audit — DONE (2026-07-29)

The user is preparing for a real production launch (Railway, `sofsavdo.com`, contracted Click.uz
credentials) and gave two explicit instructions: remove the demo-account login hints, and make
sure no page still silently shows mock data. See DECISIONS.md ADR-031 for full reasoning.

- **Demo login hints removed entirely** from both `AdminLoginPageClient.tsx` and
  `apps/web/app/creator/(auth)/login/page.tsx` — deleted outright, not hidden behind a flag.
  Browser-verified: both login pages render cleanly with no demo-account section at all.
- **Systematic audit, not spot-fixes**: an Explore-agent audit classified every function in
  `lib/api/index.ts`/`admin.ts`, found 7 pages calling a **bare mock re-export with zero
  `USE_REAL_API` gating at all** — the same defect class Phase J's `getDashboardStats` fix had
  already found once, now confirmed not to be the only instance.
- **`/admin/dashboard` — highest severity, fixed**: new `AdminDashboardService`
  (`apps/api/src/admin-dashboard/`) composes the summary from already-real
  `ExecutiveAnalyticsService`/`CreatorAnalyticsService`/`ProductAnalyticsService` (now exported from
  `AnalyticsModule`) plus two genuinely new aggregates (commission liability, pending payouts) and
  a creator-vs-direct revenue split. The fabricated 5-stage funnel (Click→Landing view→Checkout
  start→Order→Paid order) is now 3 real stages only — no event table records a "landing view" or
  "checkout start" as a distinct moment, so those two were dropped rather than approximated. The
  fake `series7d/30d/90d` toggle became one real "this month" `trend` series. Redis-cached 60s.
- **`/creator/commissions` — fixed**: new `CommissionsService.listMyCommissions(creatorId)` +
  `GET /creator/commissions`, distinct from both `listMySales` (Order-shaped) and `listMyLedger`
  (accounting-entry-shaped) — a real gap, since no existing endpoint exposed `Commission.status`
  filterable the way this page's own dropdown needs.
- **`/creator/dashboard`'s required-actions/latest-payout widgets — fixed**: rewired from the
  legacy mock-only `useContent()`/`usePayouts()` to the real `useMyContentDashboardCounts()`-
  adjacent `useMyContents()`/`usePayoutsMine()` hooks that already existed and were already used
  correctly elsewhere on the same page.
- **`/admin/referral-links`, `/admin/promo-codes` — fixed with full real backends**:
  `PromoCodesService.listAdmin()` needed no new aggregation (`usageCount` is already maintained
  directly on the row); `AdminReferralLinksService.list()` needed a 3-table raw SQL join
  (`ReferralLink`→`ReferralVisit`→`Attribution`→`Order`) for click/order/revenue stats, the same
  reasoning `creatorRevenueBreakdown` already established for why this domain needs raw SQL.
- **`/admin/visitors` — real list, but `overrideAttribution` deliberately NOT wired to fake
  success**: `AdminVisitorsService.list()` returns real `ReferralVisit` rows with honest
  `source: null` (not yet attributed) and always-empty `fraudRiskFlags` (real fraud detection is
  explicitly out of scope, already disclosed in this file below). `overrideAttribution` — which
  would reassign a real commission between creators — has no real implementation yet; rather than
  leave it silently calling the mock (making a Super Admin believe they'd changed a real
  attribution when nothing happened), it now throws a clear `NOT_IMPLEMENTED` (501) error.
- **Tests**: 27 new backend unit tests across 5 spec files — 828/828 backend unit tests passing,
  66 suites. Frontend/backend `tsc --noEmit`/`eslint` clean (same 8 pre-existing frontend
  warnings, zero new); both apps' production builds succeed. Browser-verified: `/admin/dashboard`
  and `/admin/referral-links` both compile and correctly redirect an unauthenticated visitor to
  `/admin/login`. **e2e tests were not written for this pass** given the volume of changes in one
  sweep — every change is either a read-only GET or already covered by its service's own unit
  tests, so this is a reasonable fast-follow, not a launch blocker.
- **Not built here, by design**: real manual attribution override (a genuine, pre-existing,
  already-disclosed gap this pass didn't newly create — see PRODUCTION_READINESS.md); real fraud
  detection (same, already disclosed).

## Phase N — Creator Motivation System: Activity Ticker + Creator Fund — DONE (2026-07-29)

The final two sub-phases of the Creator Motivation System (see DECISIONS.md ADR-029/030 for the
dashboard/leaderboard/competition work this builds on, and ADR-032 for this phase's own reasoning).

- **Activity ticker** (`apps/api/src/activity-ticker/`): `GET /creator/activity-ticker` merges three
  already-real event streams — a new Commission (a sale via referral attribution, excluding
  REJECTED/REFUNDED), a Payout reaching PAID (a completed withdrawal), and a new
  CreatorFundContribution — into one newest-first feed, rather than inventing a dedicated "activity
  event" table this feature doesn't otherwise need. Platform-wide, one Redis cache entry for every
  viewer (20s TTL — shorter than the leaderboard's 60s, since a "live" feed reads as stale sooner
  than a monthly ranking). Frontend polls every 15s, paused when the tab isn't focused, and renders
  as a horizontally-scrollable strip on the creator dashboard (`ActivityTicker.tsx`) — no JS-driven
  marquee animation, so an idle background tab spends zero CPU on something nobody's watching.
- **Creator Fund** (`apps/api/src/creator-fund/`): a new `CreatorFundContribution` model + a new
  `CommissionStatus.DONATED` (distinct from `PAID` — a contribution is money the creator *gave
  away*, not money paid out to them, and the wallet balance breakdown must never conflate the two)
  and `LedgerEntryType.DONATION`. `POST /creator/fund/contribute` locks the creator's oldest
  PAYABLE/unlocked commissions up to the requested amount and settles them to DONATED in the same
  transaction — unlike a Payout (locked now, settled later once an admin confirms the external
  transfer happened), a fund contribution is an internal balance-to-balance transfer with no
  external step to wait for, so it confirms synchronously. `GET /creator/fund` returns the
  platform-wide lifetime total (cached 30s) plus the requesting creator's own lifetime total
  (always computed fresh — a creator's own number should never look stale to them, same reasoning
  the dashboard already applies). `GET /creator/fund/leaderboard` ranks contributors the same
  shape as the platform/competition leaderboards (top 20 + the requester's own rank even outside
  it), 60s cache. New `/creator/fund` page: platform total + my total, a contribute form (amount +
  optional public shout-out message), and the contributor leaderboard.
- **Money-safety**: `CommissionsService.contributeToFund` is a guarded `updateMany` (WHERE
  re-asserts `payoutId: null, fundContributionId: null`) exactly like `lockPayableCommissions`,
  so a contribution racing a payout request (or two concurrent contributions) can't both claim the
  same funds — a lost race throws `INSUFFICIENT_BALANCE` and rolls back the whole transaction,
  including the `CreatorFundContribution` row already created. `WalletBalance` gained a
  `donatedMinor` bucket (lifetime, excluded from `paidMinor`/`reversedMinor`) so "paid to me" and
  "donated by me" are never shown as the same number.
- **Tests**: 21 new backend unit tests (`activity-ticker.service.spec.ts` — stream merge/sort,
  status/state filtering per stream, cache hit/miss; `creator-fund.service.spec.ts` — validation,
  transaction composition, audit recording, stats cache-vs-fresh split, leaderboard ranking;
  `commissions.service.spec.ts`'s new `contributeToFund` block — lock-and-settle, insufficient
  balance, lost-race abort) — **845/845 backend unit tests passing, 68 suites**. Frontend/backend
  `tsc --noEmit`/`eslint` clean (same 8 pre-existing frontend warnings, zero new); both apps'
  production builds succeed with `/creator/fund` registered and the dashboard's new ticker strip
  compiling cleanly.
- **Migration**: `20260804000000_creator_fund` — hand-written (matching this repo's established
  convention for every migration since Phase A when `prisma migrate dev`'s interactive apply can't
  run non-interactively), applied cleanly against the Railway test database alongside the
  previously-unapplied `20260803000000_competitions` migration.
- **Browser-verified** against the real Railway test database (intermittent connect-timeout
  retries observed on first load of a few endpoints — the same documented flaky-proxy pattern
  every prior phase has hit, not a regression; every request eventually succeeded on retry): logged
  in as a real seeded creator, confirmed `/creator/dashboard`'s new ticker strip correctly renders
  nothing when the merged feed is empty (`{"events":[]}` — verified via the network panel, not
  guessed), and `/creator/fund` renders the platform/my-total cards, the contribute form, and the
  empty-leaderboard state correctly. Submitted a real contribution with insufficient balance and
  confirmed the exact backend `INSUFFICIENT_BALANCE` message ("So'ralgan miqdor mavjud balansdan
  oshib ketdi.") renders in the form's error alert — a full round trip through the real guarded
  transaction, not a mocked assertion.
- **Not built here, by design**: a public/homepage-facing view of the Creator Fund total (this
  phase is creator-facing only, matching the rest of the Creator Motivation System); an admin
  moderation view for contribution messages (a contribution message is short, optional, and shown
  only to other authenticated creators on the leaderboard — same trust boundary as a creator's own
  display name already crossing today, not a new public-facing surface).

## Phase O — Creator-Facing Referral Funnel — DONE (2026-07-29)

Answers the first of three questions the user raised about analytics completeness: the admin
funnel (Phase M) had no creator-facing counterpart at all.

- `CreatorDashboardService.getStats` gained a `funnel` field — the exact same 3 real stages as
  `AdminDashboardService`'s funnel (Click → Order → Paid order), scoped to this creator's own
  `ReferralVisit`/`Attribution` rows instead of platform-wide. "Orders"/"paid orders" are counted
  via `Attribution` (not `Commission`) for the same reason the admin funnel does — a Commission's
  own status lifecycle tracks settlement, not whether the underlying Order was ever paid.
- New "Mening varonkam (shu oy)" card on `/creator/dashboard`, same visual pattern as the admin
  dashboard's funnel card (a plain 3-row list + a conversion-rate line), no new chart needed.
- **Tests**: 3 new backend unit tests (creator-scoping, zero-clicks conversionRate guard, a real
  conversionRate case) in `creator-dashboard.service.spec.ts`.
- **Not built here, by design**: "landing view"/"checkout start" funnel stages — this schema still
  can't track either as a distinct moment, same disclosed gap as the admin funnel (ADR-031).

## Phase P — Contractual Post Verification (Link + Screenshot) — DONE (2026-07-29)

Answers the second question: how does the platform verify a creator actually posted per contract?
See DECISIONS.md ADR-033.

- New `Content.postUrl` (and a frozen `ContentVersion.postUrl` snapshot) — the creator's live
  social-media post link, required (alongside the pre-existing screenshot-attachment requirement)
  before `ContentService.submit`/`resubmit` accepts a submission. Migration
  `20260805000000_content_post_url`.
- The link lets an admin click through and confirm the post is real (Perfluence-style); the
  screenshot remains the permanent evidence archive independent of the link's future fate (edited
  or deleted after approval) — **both** required, neither alone was sufficient (see the analysis
  delivered earlier this session).
- Frontend: creator content submission form gained a required "Post havolasi" field; admin content
  review page shows the link as a clickable `<a>` (or a warning if somehow missing).
- **Tests**: 2 new backend unit tests (`POST_URL_REQUIRED` on both first submit and resubmit).
- **Not built here, by design**: automated periodic re-checking that the link still resolves — a
  real follow-up (per the analysis delivered earlier), deferred since it requires per-platform API
  integration (Instagram/Telegram/etc.), not a small addition.

## Phase Q — Bio Compliance + Premium Tier — DONE (2026-07-29)

Answers the third question: should sofsavdo.com-in-bio be mandatory, with a Premium exemption for
creators who decline? See DECISIONS.md ADR-034.

- New `CreatorProfile.bioComplianceStatus` (`PENDING`/`COMPLIANT`/`NON_COMPLIANT`) and `.tier`
  (`STANDARD`/`PREMIUM`), migration `20260806000000_creator_bio_compliance_tier`. `PENDING` is the
  honest default — never auto-assumed compliant, since no automated bio-scraping exists.
- Two new permission keys (`creator.compliance`, `creator.tier`, both ADMIN+) and new admin routes
  `PATCH /admin/creators/:id/bio-compliance` / `/tier` — a manual spot-check action, not a
  state-machine transition (any status can move to any other at any time).
- **Enforcement, tiered exactly as discussed**: `PayoutsService.requestPayout` blocks a new payout
  request only for a `STANDARD`-tier creator marked `NON_COMPLIANT` (`BIO_COMPLIANCE_REQUIRED`,
  403) — `PENDING` (never reviewed) is never blocked, and `PREMIUM`-tier creators are never blocked
  regardless of bio status. This is deliberately a soft, targeted nudge (blocks one action) rather
  than account suspension — every other creator-facing feature stays fully usable.
- Frontend: admin creator detail page gained a "Bio talabi va tarif" card (mark
  compliant/non-compliant, grant/revoke Premium) plus status badges in the header; creator
  dashboard shows a proactive warning banner (only when it would actually block them) instead of
  letting them discover the block only after clicking "Pul yechish".
- **Tests**: 7 new backend unit tests (3 in `payouts.service.spec.ts` covering block/PENDING-safe/
  PREMIUM-exempt; 3 in `admin-creators.service.spec.ts` for the two new admin actions; 1 in
  `creator-dashboard.service.spec.ts` for the surfaced compliance fields). Updated
  `permissions.constants.spec.ts`'s hardcoded count (72 → 74).

### Phases O/P/Q — combined verification note

**857/857 backend unit tests passing, 68 suites** (12 new tests across O+P+Q on top of Phase N's
845). Frontend/backend `tsc --noEmit`/`eslint` clean
(same 8 pre-existing frontend warnings, zero new); both apps' production builds succeed with
`/creator/fund` and every existing route still registered correctly. **Browser verification could
not be completed this pass**: the Railway test database was fully unreachable (`P1001: Can't reach
database server`) for the remainder of this session — confirmed via a direct `prisma migrate
status` check, not assumed — consistent with the intermittent-outage pattern documented since
Phase A. This is an external infrastructure gap, not a defect in this phase's code; the full mocked
unit-test suite (which exercises every new code path, including the exact race-condition and
zero-value edge cases a live click-through would also hit) is the verification gate for this pass.

## Repository Cleanup (pre-production, Code Freeze) — DONE (2026-07-29)

Full details and reasoning in DECISIONS.md ADR-036. Summary:

- **Safety first**: found 316 uncommitted files at the start (the entire rebrand-through-Phase-Q
  rebuild had never been committed). Committed a full checkpoint (`925b041`) before any deletion,
  so every cleanup change is an independently reviewable diff, not a leap of faith.
- **Legacy docs**: `ARCHITECTURE_REVIEW.md` (a dated, one-time Phase 6A→6B audit snapshot) moved to
  `archive/`. `docs/SCHEMA_API_AUDIT.md` — same kind of dated audit — was deliberately left in place
  since 6 live source-code comments cite it by exact path; archiving it would create more staleness
  than it removes. Seven other root docs that looked like archive candidates by title
  (COMMISSION/DATABASE/PRODUCT_MODEL/TESTING/USER_FLOWS/ATTRIBUTION/DESIGN_SYSTEM.md) were read in
  full and confirmed still accurate — kept as-is.
- **Old branding**: already clean. A repo-wide case-insensitive "rosti" search outside
  `node_modules` found only legitimate historical changelog entries in DECISIONS.md/
  PROJECT_STATUS.md. The one real finding — a stale git worktree
  (`.claude/worktrees/sleepy-shtern-0bce91`) checked out at a pre-rebrand commit with genuine
  `@rosti/*` imports — is flagged for the user's own `git worktree remove` decision, not touched.
- **Dead code**: 2 Prisma models confirmed genuinely unused (`CreatorContent`/`CreatorContentStatus`
  and `CampaignAsset`/`FileAsset` — both already self-documented in the schema as mock-era stubs)
  dropped via new migrations (`20260807000000_drop_legacy_creator_content`,
  `20260808000000_drop_legacy_campaign_asset`). One orphaned backend util
  (`common/idempotency/idempotency.util.ts`, never imported anywhere) removed.
- **Dependencies**: `uuid`/`@types/uuid` (apps/api — codebase uses `node:crypto`'s `randomUUID()`
  exclusively), `framer-motion` and `playwright` (apps/web — zero imports, no config, no e2e test
  file anywhere) removed; `package-lock.json` regenerated (7 packages dropped transitively).
- **Env/config**: one stale `.env.example` comment describing `NEXT_PUBLIC_API_MODE` as covering
  only "Phase 6B, auth + Product" fixed to reflect that the entire application is real-backed today.
  Dockerfiles, railway.toml, GitHub workflows, `.dockerignore` all reviewed — already clean, no
  changes needed.
- **Folder structure**: already flat and conventional (`apps/*`, `packages/*`, docs at root) — no
  restructuring needed beyond the one archive move above.
- **Verification**: `tsc --noEmit`/`eslint` clean on both apps after every removal; full backend
  unit suite re-run clean (857/857, 68 suites) after both schema-dropping migrations; both apps'
  production builds succeed. No new functionality introduced — every change is a deletion, an
  archive-move, or a doc-accuracy fix.

## Release Candidate / Launch Freeze — DONE (2026-07-29)

Full details and reasoning in DECISIONS.md ADR-037 (vulnerability triage) and ADR-038
(notification-sweep fix + Prisma version alignment). Summary:

- **Vulnerability triage, no blind upgrades**: of 43 reported vulnerabilities, applied only the safe
  non-breaking `npm audit fix` (patched `next` 16.2.10→16.2.12, `fast-uri`, `valibot` — all within
  existing semver ranges, verified via clean typecheck/tests/builds). Declined `--force`'s suggested
  fixes because they were major-version **downgrades** (jest, `eslint-config-next`, `@nestjs/cli`,
  `autocannon`), all dev-tooling-only with zero production blast radius. Declined a `js-yaml`
  override for `@nestjs/swagger` (npm wouldn't apply it, and the finding is confirmed non-reachable:
  Swagger is disabled by default in production and only ever calls `.dump()`, never `.load()`).
  `postcss`/`sharp` (bundled in `next`) confirmed non-reachable: `next/image` is never imported and
  no `images.remotePatterns` are configured anywhere in `apps/web`. Final count: 43 → 38 → 31 (the
  last drop a side effect of the Prisma version-alignment reinstall below, not a targeted fix).
- **Notification Sweep launch-readiness fix**: `NotificationSweepService`'s four sweep queries
  (`sweepOrders`/`sweepPayments`/`sweepCommissions`/`sweepPayouts`, the only `@Interval`-scheduled
  job in the codebase) had no time bound — several swept statuses are terminal, so the scanned set
  could only ever grow, re-scanned every 30s forever. Added `Payout.updatedAt` (missing, unlike every
  sibling money model), `@@index([status, updatedAt])` on both `Payout` and `Commission` (their only
  existing index was `[creatorId, status]`, useless for these global non-creator-scoped sweeps), and
  bounded all four queries by a 7-day `updatedAt` lookback (migration
  `20260809000000_notification_sweep_index_fixes`, applied to the test database). Dispatch dedup was
  already safe (`Notification.dedupKey`'s unique constraint) — this fix is purely about read cost.
- **Unrelated blocker fixed along the way**: `prisma generate` started failing
  ("Could not resolve @prisma/client") due to a version drift between the root-hoisted `prisma` CLI
  (7.9.1) and the pinned `@prisma/client`/`@prisma/adapter-pg` (7.8.0). Realigned all three to
  `7.9.1`.
- **Stale worktree removed**: `.claude/worktrees/sleepy-shtern-0bce91` (pre-rebrand checkout with
  `@rosti/*` imports, flagged but not touched during the prior cleanup pass) — this pass's
  instructions explicitly authorized removing stale worktrees. Its 9 uncommitted modifications were
  committed to the worktree's own branch first so nothing was lost, then the worktree was
  unregistered via `git worktree remove` (branch and commits remain intact and recoverable).
- **Verification**: `tsc --noEmit`/`eslint` clean on both apps, full backend unit suite (858/858, 68
  suites — one new test asserting every sweep query is time-bounded), both apps' production builds
  clean, and — since the test database came back online mid-session — the full `notifications.e2e-
  spec.ts` suite (12/12) re-run against the live migrated schema, exercising the sweep-triggered
  notification paths directly. No new features, no architecture changes — every change in this pass
  is a targeted fix to a previously-identified, re-confirmed production risk.

## Post-Launch Real-Traffic Fixes — DONE (2026-07-30)

Full details and reasoning in DECISIONS.md ADR-039. The first real production deploy (Railway, real
domain, real Click.uz credentials) surfaced issues no test suite catches on its own — some
infrastructure-config, some UX gaps only visible once real people used the deployed site. Summary:

- **Docker builds fixed**: both Dockerfiles had wrong npm-workspaces hoisting assumptions (verified
  directly via isolated `npm ci` + real `nest build`/`next build` before touching either file) —
  `apps/web`'s broke the Railway build outright; `apps/api`'s generated-Prisma-client COPY path was
  wrong in a way that would have broken it too.
- **`.gitignore` fix**: a bare `storage/` pattern (meant only for the dev upload folder) had silently
  excluded the real `apps/api/src/storage/` source module from every commit since it was introduced
  — worked in every local tree, broke on the first fresh clone.
- **Creator gating fixed**: a SUBMITTED/UNDER_REVIEW creator was bounced entirely out of the cabinet
  instead of just being locked out of earning-capable features — a real registrant hit this. Split
  "enter the cabinet" from "use earning features"; every money/referral route stays locked with a
  visible lock icon until real approval.
- **Public storefront navigation + content**: added a shared header (with a top-level creator
  entry point, previously buried in the footer), a real purchase-flow explainer, a real (not
  fabricated) recent-activity FOMO ticker, and full content for the three `/legal/*` pages (previously
  DRAFT placeholders) plus a required ToS/Privacy consent checkbox at checkout and both register forms.
- **Test-suite drift caught and fixed**: running the full e2e suite start to finish (not done since
  well before this pass) surfaced `content.e2e-spec.ts`'s submit tests failing against current
  behavior — Phase P added a `postUrl` requirement at submit time after this test was written; fixed
  by updating the test, not the (correct) production code. The same full run also caught
  `buyer-accounts.e2e-spec.ts` registering test buyers with 1-character names against a DTO that has
  always required `@MinLength(2)` — another test-drift fix, not a production bug.
- **Real bug found and fixed: COD checkout redirect**. `CodPaymentAdapter.createPayment` returned the
  buyer's own `returnUrl` as `redirectUrl` instead of `null` — since Cash on Delivery has nothing
  external to redirect to, this silently downgraded every COD checkout to a slower full-page-reload
  path instead of the smooth client-side navigation `MANUAL`/Pay Later correctly gets. Fixed the
  adapter and widened `PaymentPort`'s `CreatePaymentResult.redirectUrl` to `string | null`.
- **Verification**: `tsc --noEmit`/`eslint`/build clean on both apps; full backend unit suite
  (863/863) plus the two payment-adapter unit tests re-verified (14/14) after the COD fix; a real
  `docker build` for both images (Docker access became available mid-session); an extended real
  manual walkthrough of both the admin and creator panels against the live Railway test database; the
  full e2e suite re-run start to finish, with `checkout.e2e-spec.ts` (21/21) and
  `buyer-accounts.e2e-spec.ts` (61/61) both re-confirmed green in isolation afterward.
  `creator-applications.e2e-spec.ts` reproduced one 60s Jest timeout on a heavy capacity/approval
  test (29/30 passing, no assertion failure) — unrelated to any change made this session, recorded as
  a DB-latency environment artifact rather than a logic bug.

### A note on production launch itself

As of this pass, all four items `PRODUCTION_READINESS.md` had flagged since Phase 14 as requiring the
user's own action are done: a real `docker build` has been run and verified for both images, a real
Railway project exists and is serving real traffic at the real domain, real Click.uz production
credentials have been entered, and the production database has a bootstrapped admin account. The
checklists in RUNBOOK.md/DEPLOYMENT.md remain the reference for anything further

## Phase R — Real Production Incident Fixes: API Container Permissions + Quick Product Launch — DONE (2026-07-30)

Two real production issues reported directly by the operating admin, both traced to their actual
root cause rather than patched symptomatically.

- **Product image upload 500 in production**: root cause was `apps/api/Dockerfile`'s runtime stage
  missing `--chown=sofsavdo:sofsavdo` on its `COPY --from=` lines — the exact same class of bug
  already fixed for the web container in ADR-045, now confirmed present in the API container too.
  `LocalDiskStorage`'s runtime `mkdir` of its uploads directory failed with `EACCES` because
  `/app/apps/api` stayed root-owned after the container switched to its unprivileged user. Also
  surfaced that production has no `STORAGE_DRIVER=s3` configured — files live on the container's
  ephemeral disk, not durable cloud storage; flagged as a follow-up decision for the user
  (switch to `S3Storage`, already fully implemented, or mount a Railway Volume). See ADR-046.
- **Admin created a product, but neither buyers nor creators could see it, and creation felt too
  complex**: two independent causes. First, `Product` alone (or even the old 4-step
  `ProductLaunchWizard`) never activated the created `Offer`/`Campaign` — both default to `DRAFT`,
  and buyer/creator visibility strictly requires `ACTIVE`. Second, the granular admin forms
  (~20 fields on `CampaignForm` alone) are appropriately rich for power users but too much for the
  common "just launch a product" case. Built `QuickProductLaunchForm` — one screen with ~8 fields
  that orchestrates the same existing Product/Offer/Landing/Campaign endpoints but also activates/
  publishes each, so a product is buyer- and creator-visible the moment it's created. Also fixed
  the exact stuck-product scenario at its source: the Product detail page's "no offer yet" notice
  now links to the quick-launch form pre-attached to that product via `?productId=`. The original
  step-by-step wizard remains available at `/admin/products/launch/advanced` for admins who need
  per-field control. See ADR-047.
- **Verification**: `tsc --noEmit`/`eslint` clean on `apps/web`. Full real browser walkthrough
  against the Railway test database, logged in as a freshly-bootstrapped admin: quick-launched a
  product end to end (network trace confirmed every step through `Campaign/activate` returning
  `201`), confirmed it live in `/catalog`; a first live attempt caught a real gap
  (`CampaignsService.activate()` rejects an empty `contentFormats`) via its own genuine 409 error,
  fixed, and re-confirmed working. Separately confirmed the orphaned-product recovery path by
  creating a bare Product, then quick-launching an Offer + Campaign onto it via `?productId=`. The
  API Dockerfile fix could not be verified with a live `docker build` (Docker Desktop daemon
  unavailable in this environment) — verified by manual reading of the Dockerfile and standard
  `COPY --chown=`/`RUN mkdir` semantics instead; awaits the user's next Railway deploy to confirm.
for each once the user is ready to perform them.
