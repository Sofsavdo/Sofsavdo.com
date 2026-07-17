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
- [ ] Argon2id password hashing (not bcrypt/md5)
- [ ] JWT access token (short-lived, ~15min) + refresh token rotation, refresh token hashed at
      rest (`RefreshToken.tokenHash`), old token invalidated on use (rotation, not reuse)
- [ ] Rate limiting on `/auth/login`, `/auth/forgot-password` (per-IP and per-account)
- [ ] Brute-force lockout with exponential backoff on repeated login failures
- [ ] Secure, HttpOnly, SameSite cookies for refresh token; access token in memory only on web

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
