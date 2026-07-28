# Environment Variables

Full reference for every environment variable Rosti reads. See
[`.env.example`](.env.example) for the actual file to copy; see
`apps/api/src/config/env-validation.ts` for the code that enforces the "required in production"
rules below — this document and that file must stay in sync (that file is the enforcement,
this one is the explanation).

**Startup behavior**: `validateEnv()` runs once, at the very start of `main.ts`'s `bootstrap()`,
before Nest even begins building the DI graph. In `development`/`test`, it only checks that
`NODE_ENV` itself is a recognized value. In `production`, it aggregates **every** problem into one
thrown error and refuses to start — one failed deploy shows the complete list of what's wrong, not
just the first missing variable.

## Required in production

Missing any of these (or setting one to a known dev-fallback value) makes the process refuse to
start when `NODE_ENV=production`. In `development`/`test`, each has a dev-only fallback baked into
`configuration.ts` and can be left unset.

| Variable | Purpose | Production rule |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (`@prisma/adapter-pg`) | Must be a valid URL |
| `JWT_ACCESS_SECRET` | Signs access tokens | Must not equal `dev-access-secret-change-me` |
| `JWT_REFRESH_SECRET` | Signs refresh tokens | Must not equal `dev-refresh-secret-change-me` |
| `PAYOUT_ENCRYPTION_KEY` | Encrypts `PayoutMethod.cardNumberEnc` | Must not equal `dev-payout-encryption-key-change-me` |
| `WEB_APP_URL` | Frontend origin — CORS allowlist fallback, cookie domain reasoning | Must be a valid URL, must start with `https://` |
| `API_URL` | This API's own public URL (used in a few generated links) | Must be a valid URL |
| `CLICK_MERCHANT_ID` | Click.uz merchant ID | Must be set |
| `CLICK_SERVICE_ID` | Click.uz service ID — also checked against every real callback (defense-in-depth alongside signature verification) | Must be set |
| `CLICK_SECRET_KEY` | Signs/verifies Click callbacks (MD5) | Must not equal `dev-click-secret-change-me` — this is the single most sensitive value in the whole system, since anyone who knows it can forge a "payment succeeded" callback |
| `CLICK_ENV` | Operator's own declaration of which Click credential set this is (`test`/`production`) | Must equal `production` — never left as (or silently defaulted to) `test`; this is what stops production from accidentally running Click's test merchant, or vice versa |

## Optional — the app degrades gracefully without them

| Variable | Default / behavior if unset |
|---|---|
| `REDIS_URL` | Defaults to `redis://localhost:6379`. Redis being unreachable degrades rate-limiting/analytics-caching but never fails `/health/ready` or blocks checkout/payment (Phase 14 health-check redesign) |
| `PORT` | Defaults to `4000` (API) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Default `15m` / `30d` |
| `STORAGE_DRIVER` | Defaults to `local` (`LocalDiskStorage`) — set to a real value only once a cloud storage adapter is actually built (none is, as of Phase 14; see PROJECT_STATUS.md's deferred list) |
| `STORAGE_LOCAL_DIR` | Defaults to `uploads` (gitignored, dev/test only) |
| `STORAGE_PUBLIC_BASE_URL` | Defaults to `http://localhost:<PORT>/media` |
| `MEDIA_MAX_IMAGE_BYTES` / `MEDIA_MAX_VIDEO_BYTES` / `MEDIA_MAX_VIDEO_DURATION_SECONDS` / `MEDIA_ASPECT_RATIO_TOLERANCE` | Campaign media validation limits — sensible defaults, override only if the business rule genuinely changes |
| `CONTENT_MAX_ATTACHMENT_*` | Same, for Content-domain attachments |
| `PAYME_MERCHANT_ID` / `PAYME_SECRET_KEY` / `UZUM_NASIYA_MERCHANT_ID` / `UZUM_NASIYA_SECRET_KEY` | Reserved for a future phase — read by nothing today (see DECISIONS.md) |
| `PAYOUT_MINIMUM_MINOR` | Defaults to 100,000.00 so'm — below this, a payout request is rejected (`BELOW_MINIMUM`) |
| `TELEGRAM_BOT_TOKEN` | Unset means Telegram delivery is unconfigured — `TelegramBotAdapter` fails loudly per-send (a `FAILED` `Notification` row), never silently no-ops |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Same pattern for email delivery |
| `NOTIFICATION_MAX_DELIVERY_ATTEMPTS` | Defaults to `3` — how many attempts (initial + retries) before a `Notification` is left permanently `FAILED` for the admin queue |
| `ERROR_REPORTING_WEBHOOK_URL` | Unset means every 5xx is still logged locally (`AllExceptionsFilter` → `AppLogger`) but never forwarded anywhere. Set it to POST a JSON error payload to any webhook-shaped ingest endpoint |
| `SENTRY_DSN` / `POSTHOG_API_KEY` / `POSTHOG_HOST` | Reserved for a future phase — read by nothing today |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed browser origins; falls back to `[WEB_APP_URL]` if unset — set this when staging and production share one API, or for a www/non-www pair |
| `SWAGGER_ENABLED` | In production, Swagger (`/docs`) is mounted only if this is exactly `"true"` — off by default so the full route/DTO surface isn't public |
| `NODE_ENV` | `development` (default) / `test` / `production` — anything else is rejected in all environments, not just production |

## Frontend (`apps/web`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_MODE` | `mock` (default, no backend needed) or `real` (talks to the actual NestJS API). Inlined into the client bundle at **build** time — see `apps/web/Dockerfile`'s comment on why a real deploy must set this as a Docker build `ARG`, not just a runtime env var |
| `NEXT_PUBLIC_API_URL` | Same build-time-inlined behavior as above |

## Production admin bootstrap (one-time use only)

| Variable | Purpose |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Read only by `npm run bootstrap:admin` (never by the running app) — set on the command line for that one invocation, never in a committed `.env`. See RUNBOOK.md §2 |
| `BOOTSTRAP_ALLOW_ADDITIONAL_ADMIN` | Set to `true` to let `bootstrap-admin.ts` create a second super_admin when one already exists — otherwise it refuses |

## Never log, never expose

`CLICK_SECRET_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PAYOUT_ENCRYPTION_KEY`,
`SMTP_PASS`, `TELEGRAM_BOT_TOKEN`, `BOOTSTRAP_ADMIN_PASSWORD`, `DATABASE_URL`/`REDIS_URL` (these
carry embedded credentials). `/health/status` deliberately exposes only *presence* booleans for the
Click/notification config (`merchantIdConfigured`, `secretConfigured`, etc.) — never the actual
values — see `HealthController.checkClickConfig()`.
