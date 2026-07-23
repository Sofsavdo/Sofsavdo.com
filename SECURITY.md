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
- [ ] Every controller method validates via a DTO (`class-validator` or Zod), no raw `req.body`
      access
- [ ] Output encoding / React's default escaping relied on for XSS — no `dangerouslySetInnerHTML`
      without sanitization (rich-text landing sections go through a sanitizer allowlist)
- [ ] Prisma parameterizes all queries by construction — no raw SQL string concatenation;
      `$queryRaw` usage (if ever needed for a rollup) must use tagged templates only

## Transport / infra
- [ ] `helmet` on all NestJS responses
- [ ] CORS allowlist (web app origin(s) only, no `*`)
- [ ] TLS everywhere in production (terminated at Cloudflare/Vercel/Railway edge)

## Payments
- [ ] Every payment webhook verifies provider signature before processing
- [ ] Webhook handlers are idempotent (keyed by provider reference) and replay-safe
- [ ] Payment state transitions happen inside a DB transaction alongside the Order update

## Money integrity
- [ ] All monetary fields are `Int` minor units (enforced by schema — see DATABASE.md)
- [ ] Commission/Order/Payment writes happen inside transactions (no partial commit of
      Order+Commission)
- [ ] Payout selection locks candidate Commission rows (`SELECT ... FOR UPDATE` semantics via
      Prisma transaction) to prevent double-spend across concurrent payout requests

## PII
- [ ] Creator-facing sales data masks customer phone/address (see API.md `/creator/sales`)
- [ ] `PayoutMethod.cardNumberEnc` encrypted at rest, only last 4 digits ever rendered
- [ ] File uploads: validated MIME type + size limit, served from a non-executable storage path,
      signed URLs for anything not meant to be public

## Authorization
- [ ] RBAC checked in a NestJS guard on every admin/creator route — frontend hiding a button is
      never treated as an access control measure
- [ ] Manual attribution override requires an explicit permission and always writes an `AuditLog`
      row (see ATTRIBUTION.md)

## Audit
- [ ] Every admin write to Orders/Commissions/Payouts/Attribution/Refunds produces an `AuditLog`
      row with before/after snapshots

## Fraud
- [ ] Self-referral, shared-IP, shared-payment-instrument, and high-velocity flags computed at
      order time (see ATTRIBUTION.md), surfaced for manual review — never silently auto-blocked

## Secrets
- [ ] No production credentials or secrets ever committed — `.env.example` lists names only
- [ ] `.env` is git-ignored (see `.gitignore`)
