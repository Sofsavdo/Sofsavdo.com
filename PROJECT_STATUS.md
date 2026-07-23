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
starting Phase 6B. Full report: [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md).

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
