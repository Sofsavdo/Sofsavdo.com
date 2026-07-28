# Security checklist

Tracked here as a living checklist; each item gets checked off with the commit/PR that
implements it during Phase 6+ rather than deferred to a final "security phase".

## Repository isolation (verified 2026-07-16)

- [x] Rosti is its own independent git repository, rooted at `Fidem/Blog`
      (`git rev-parse --show-toplevel` → `C:/Users/Acer/Fidem/Blog`), not nested inside the
      unrelated home-directory repo it used to live under.
- [x] The outer repo was never modified: no file was committed to it, no `.gitignore` it tracks
      was edited, no `.git` directory anywhere was deleted. Isolation was done purely via a line
      added to the outer repo's local, uncommitted `.git/info/exclude`.
- [x] `.gitignore` covers `.env`/`.env.*` (with `.env.example` explicitly re-included as the only
      env file meant to be tracked), `node_modules/`, build outputs, logs, `uploads/`/`storage/`,
      local database files, IDE directories, OS cruft, and `.claude/settings.local.json`.
- [x] Full-tree secret scan (excluding `node_modules`) for live API keys, AWS keys, PEM private
      key headers, and inline password/secret literals — no matches. The only env-shaped file
      present is `.env.example`, and every value in it is blank.
- [x] `git status` inside the new repo lists only Rosti's own files — no content from the parent
      directory tree, no dependency or build artifacts.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) "Phase 1.5 — Repository isolation" for the full
step-by-step verification log.

## Auth
- [x] Argon2 password hashing (`argon2` package, default argon2id params) — `auth.service.ts`
- [x] JWT access token (15min default, `JWT_ACCESS_TTL`) + refresh token rotation, refresh token
      hashed at rest (`RefreshToken.tokenHash`, SHA-256 lookup hash), old token invalidated on use
      and reuse of a revoked token revokes the whole token family (`token.service.ts`,
      verified against real Postgres — see PROJECT_STATUS.md Phase 6A)
- [x] Rate limiting per-IP on `/auth/login` and `/auth/register` (10/min), `/auth/forgot-password`
      (5/min) via `@Throttle()` — added in the 6A→6B architecture audit; global default
      (120/60s) was the only limit before this and was too permissive for auth endpoints
- [ ] Per-account brute-force lockout with exponential backoff — **not implemented**, tracked as
      technical debt in the architecture review; needs a failed-attempt counter (likely
      Redis-backed) this phase doesn't have. Per-IP throttling above is a partial mitigation.
- [x] Secure (prod-only), HttpOnly, SameSite=Lax cookie for refresh token, scoped to `/auth`;
      access token returned once in the response body, held in memory by the frontend only
      (see DECISIONS.md ADR-008)

## Input handling
- [x] Every controller method validates via a DTO (`class-validator`) — global `ValidationPipe`
      (`whitelist: true, forbidNonWhitelisted: true, transform: true`) in `main.ts` strips/rejects
      any field not declared on a DTO; no controller reads raw `req.body`.
- [x] Output encoding — React's default escaping relied on throughout; confirmed no
      `dangerouslySetInnerHTML` anywhere in `apps/web` (checked directly). Landing sections render
      plain text/structured data only.
- [x] Prisma parameterizes all queries by construction. The handful of real `$queryRaw` uses in the
      codebase (`HealthController.checkDatabase`, both seed scripts) are all literal tagged
      templates with no interpolated user input — never string concatenation.

## Transport / infra
- [x] `helmet()` applied globally (`main.ts`).
- [x] CORS allowlist only — `resolveAllowedOrigins()` reads `CORS_ALLOWED_ORIGINS`/`WEB_APP_URL`,
      never a wildcard (Phase 14 hardening, `main.ts`).
- [x] `WEB_APP_URL` is enforced to be `https://` in production by `env-validation.ts`; refresh-token
      cookie is marked `Secure` in production (`auth.controller.ts`). Actual TLS termination is an
      infrastructure fact (Railway/Cloudflare edge) this repo's code cannot itself verify — confirm
      it's actually configured as part of RUNBOOK.md's launch-day checklist, not assumed from this checkbox.
- [x] `app.set("trust proxy", 1)` (Phase 14) — trusts exactly one reverse-proxy hop, so
      per-IP rate limiting and IP-hash-based visit tracking read the real client IP, not the proxy's.
- [x] Explicit request body size limits (1MB JSON/urlencoded; file uploads go through a separate
      100MB-capped multer pipeline) — Phase 14, previously an unconfirmed Express default.
- [x] Global + per-route rate limiting (`ThrottlerGuard`, 120/60s default; stricter limits on
      login/register/reset-password/checkout/visit-tracking/promo-validate/analytics-export).
      Health checks and the Click callback are explicitly exempt (`@SkipThrottle()`) — see "Rate
      limiting exemptions" below for why that's correct, not an oversight.
- [x] Swagger (`/docs`) is off by default in production (`SWAGGER_ENABLED` must be explicitly
      `"true"` to enable it there) — the full route/DTO surface isn't public by default.

## Rate limiting exemptions (deliberate, not gaps)
- [x] `HealthController` (`/health/*`) — `@SkipThrottle()`. A load balancer/orchestrator probing
      health at a real frequency must never get 429'd into looking unhealthy because of its own
      probe frequency. Confirmed via the Phase 14 load test: 2317/2317 requests were wrongly
      rate-limited before this fix, 0/2317 after.
- [x] `ClickCallbackController` (`/payments/click/*`) — no throttle. A real Click payment
      confirmation must never be silently dropped under load; a forged/malformed callback is
      rejected cheaply by signature verification regardless of rate, which is what actually bounds
      abuse here.

## Payments
- [x] Every Click callback verifies the MD5 signature (`ClickPaymentAdapter.verifyCallback`) before
      any processing — cannot be disabled by configuration. `service_id` is additionally validated
      against `CLICK_SERVICE_ID` (Phase 14 defense-in-depth).
- [x] Callback handling is idempotent and replay-safe — a callback for a `Payment` already in a
      terminal state (`PAID`/`FAILED`) is acknowledged without reprocessing (no double commission,
      no double stock decrement). Verified in `payments.service.spec.ts` and
      `test/checkout.e2e-spec.ts`.
- [x] Callback amount is validated against the stored `Payment.amountMinor`
      (`INVALID_PAYMENT_AMOUNT` on mismatch).
- [x] Payment state transitions happen inside a DB transaction alongside the Order update
      (`OrdersService.markPaid`/`markPaymentFailed`) — Phase 14 fix; previously two separate
      un-transacted writes with a crash window between them.

## Money integrity
- [x] All monetary fields are `Int` minor units throughout the schema.
- [x] Commission/Order/Payment writes happen inside transactions.
- [x] Every status-transition method on `CommissionsService`, `PayoutsService`, and
      `AdminRefundsService` uses a guarded `updateMany({where: {id, status: {in: FROM_STATES}}})` +
      affected-row-count check before performing any side effect (ledger write, lock/release/settle)
      — closes a real TOCTOU race (Phase 14) where two concurrent requests against the same row
      could both pass a plain read-then-check and both perform the side effect (double commission
      approval, double payout settlement). The pattern was already correct in
      `CommissionsService.lockPayableCommissions`; Phase 14 applied it everywhere else the same
      read-check-write shape existed.
- [x] Payout fund-locking (`lockPayableCommissions`) uses the same guarded-`updateMany` pattern to
      prevent double-spend across concurrent payout requests selecting overlapping commissions.

## PII
- [x] `PayoutMethod.cardNumberEnc` encrypted at rest (`common/crypto/encryption.util.ts`), only the
      last 4 digits ever rendered back.
- [x] File uploads: real magic-byte content sniffing (not just declared Content-Type/extension),
      size limits (both multer's 100MB hard cap and tighter business-level image/video limits),
      path-traversal-safe storage keys, sanitized filenames. Campaign/content media is intentionally
      public (served for landing pages) — "signed URLs for private files" doesn't apply to this
      media, since none of it is meant to be private.
- [ ] Creator-facing masking of customer info on `/creator/sales` — the frontend page and its
      `Sale` type already design for this correctly (`sale.customerMasked`, never a raw phone/
      address field), but `apiGetSales` is **still the Phase-1 mock implementation**
      (`apps/web/src/mocks/store.ts`) — no real NestJS endpoint backs this page yet. Confirmed via
      direct search: no `sales`-named controller exists anywhere in `apps/api/src`. This is a real,
      specific gap (a feature apparently never migrated off mock data in any later phase), not an
      Attribution-Engine-scope item — but building the real endpoint is new-feature work, out of
      Phase 14's own scope ("not to add major product features"). Flagged here so it isn't
      mistaken for done.

## Authorization
- [x] RBAC checked via `PermissionsGuard`, registered as a global `APP_GUARD` — every route is
      denied by default unless annotated `@Public()` or `@RequirePermissions(...)`; frontend
      hiding a button is UI convenience only, never the real boundary (confirmed pattern throughout
      the admin frontend).
- [ ] Manual attribution override — the permission (`attribution.override`) is defined in the RBAC
      catalog, but no service/controller implementing an actual override action was found in this
      audit. The Affiliate Attribution Engine is explicit out-of-scope for Phase 14 (and every phase
      so far) — this permission is reserved/scaffolded, not backing a real feature yet.

## Audit
- [x] Every admin write this audit could find on Orders/Commissions/Payouts/Refunds produces an
      `AuditLog` row with before/after snapshots (`AuditService.record`), including the Phase 14
      TOCTOU-hardened transitions.

## Fraud
- [ ] Self-referral/shared-IP/shared-payment-instrument/high-velocity fraud flags — **not built**.
      This is Affiliate Attribution Engine scope, explicitly out of scope for every phase completed
      so far (see DECISIONS.md, PROJECT_STATUS.md's deferred lists). Not a Phase 14 regression —
      never existed.

## Logging & error reporting (Phase 14)
- [x] Structured request logging (`RequestLoggingInterceptor`, global) — requestId, userId,
      creatorId, operation, duration, result, status on every request. Never logs the request body,
      query string, or headers — the fix that holds up over time against a password/token/payment
      field ending up in a log line is "this logger cannot see that data," not a redaction list.
- [x] `AllExceptionsFilter` centralizes exception handling; every 5xx is logged locally with
      requestId + stack, regardless of whether an external error-reporting provider is configured.
- [x] Optional external error-reporting hook (`ErrorReportingPort`) — no-op by default, a real
      webhook-POST adapter when `ERROR_REPORTING_WEBHOOK_URL` is set. Never required for startup.

## Monitoring & health (Phase 14)
- [x] `/health/live` (process only), `/health/ready` (Postgres is the only hard dependency — Redis
      down degrades, never fails readiness), `/health/status` (deep diagnostic: DB/Redis/disk/
      scheduled-job heartbeat/Click config presence as booleans/notification provider presence).
- [x] Scheduled job (`NotificationSweepService`) observability — run heartbeat + reentrancy guard,
      surfaced via `/health/status`.

## Seed & bootstrap safety (Phase 14)
- [x] `prisma/seed.ts` hard-refuses to run when `NODE_ENV=production` — it creates demo accounts
      sharing one publicly-known password, never appropriate for a real database.
- [x] `bootstrap-admin.ts` is the production-safe alternative: idempotent role/permission seeding +
      exactly one real super_admin account, refuses to create a second one without an explicit
      override flag, never logs the password.

## CI/CD gating (Phase 14)
- [x] `.github/workflows/ci.yml` blocks on typecheck/lint/unit tests/e2e tests/build for both apps.
- [x] `.github/workflows/deploy.yml` only runs on manual `workflow_dispatch` (never on push),
      reruns the full CI gate as its own first job, and polls `/health/ready` post-deploy before
      reporting success.
- [ ] Docker images (`apps/api/Dockerfile`, `apps/web/Dockerfile`) are written and reviewed but not
      yet build-verified in this environment (no working Docker engine in this sandbox) — must be
      built for real (a real machine, or the CI runner) before being trusted for a production
      deploy. See DEPLOYMENT.md.

## Secrets
- [x] No production credentials or secrets ever committed — `.env.example` lists names only, every
      value blank.
- [x] `.env`/`.env.*` git-ignored (`.env.example` explicitly re-included as the only tracked one).
- [x] `env-validation.ts` refuses to start in production if any required secret is missing, empty,
      or still set to one of the known dev-fallback placeholder values (`CLICK_SECRET_KEY` included
      — Phase 14 closed a real gap where this one specifically had no such guard before).
