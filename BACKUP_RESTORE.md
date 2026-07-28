# Backup & Restore

Rosti's only stateful, irreplaceable data store is Postgres (`DATABASE_URL`). Redis holds nothing
that isn't safe to lose (rate-limit counters, analytics cache — see `AnalyticsCacheService`/
`HealthController`'s "Redis down degrades, never breaks correctness" design). Locally-stored media
(`LocalDiskStorage`, dev/test only) is not covered here — production is expected to move to a real
cloud storage adapter before launch (see PROJECT_STATUS.md's deferred list); this file will need a
media-backup section added once that adapter exists.

## Backup process

**Railway-managed Postgres** ships its own automated backup feature — confirm what's actually
enabled for the real production database in Railway's current dashboard (Settings → Backups) before
relying on anything below as the *only* backup; treat the commands here as the portable,
tool-agnostic fallback that works regardless of what Railway's UI currently offers.

Manual/scripted logical backup, using the same connection string the app itself uses:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="rosti-backup-$(date +%Y%m%d-%H%M%S).dump"
```

- `--format=custom` (not plain SQL) — enables selective restore and is compressed by default.
- Run this on a schedule appropriate to real transaction volume once launched (starting point:
  daily, retained for at least 30 days — tighten once real order/payment volume gives a basis for
  an actual RPO decision, not a guess).
- Store the resulting `.dump` file somewhere **other than** the same Railway project (a separate
  cloud storage bucket, at minimum) — a backup that lives next to the thing it's backing up
  doesn't survive the failure modes that actually matter (account compromise, accidental project
  deletion).
- Never commit a `.dump` file to git — it contains real customer/creator PII and payment
  references once the database has real data.

## Restore process

```bash
# Into a NEW, empty database — never restore over a live one without reading the section below first.
pg_restore --dbname="$RESTORE_TARGET_DATABASE_URL" --clean --if-exists --no-owner rosti-backup-<timestamp>.dump
```

- `--clean --if-exists` drops existing objects before recreating them — safe against a target that
  already has the same schema (e.g. restoring into a freshly-migrated empty database), a no-op
  against a genuinely empty one.
- `--no-owner` — the backup's original role names won't exist in a different environment; this
  avoids restore failing on ownership `ALTER` statements it can't satisfy.
- After restoring, run `prisma migrate deploy` against the restored database to catch it up to
  whatever schema version the running application code actually expects, if the backup predates the
  most recent migration.
- Restart the API process afterward (or redeploy) so Prisma's engine/connection pool doesn't hold
  any stale state from before the restore.

## Restore test procedure (do this before you ever need it for real)

A backup nobody has ever restored is a hope, not a plan. Before launch, and periodically afterward:

1. Provision a throwaway Postgres instance (a local Docker container is fine — this test never
   needs to touch production infrastructure).
2. Restore the most recent real backup into it (commands above).
3. Run `prisma migrate deploy` against it, confirm it exits 0.
4. Point a local instance of the API at it (`DATABASE_URL` env var only, nothing else changes) and
   confirm `/health/ready` reports `database: {status: "up"}`.
5. Spot-check real data landed correctly — pick a handful of known-real Order/Payment/Commission
   rows (by ID, from before the backup was taken) and confirm they're present and unchanged.
6. Tear down the throwaway instance. Record the date this test was last run and its result
   somewhere the team will actually see it (this repo's PROJECT_STATUS.md, an internal wiki, etc.)
   — a restore procedure that was only ever tested once, a year ago, is not meaningfully tested.

## Data retention

No retention/deletion policy exists in this codebase today — every table grows indefinitely.
Before this becomes a real compliance question (GDPR-style "right to be forgotten" requests,
local data-protection law, or simply storage cost), decide and document:
- How long `AuditLog`, `Notification`, and `ReferralVisit` rows are kept (these are the highest-
  volume, lowest-long-term-value tables — `ReferralVisit` in particular grows with every single
  landing-page visit).
- Whether financial records (`Order`, `Payment`, `Commission`, `Payout`, `Refund`) have a *minimum*
  retention requirement under Uzbek tax/accounting law — check with local legal counsel
  (see `<Legal — Financial record retention period>` in the legal audit, once written) before
  deleting anything in these tables, ever.

## Production seed safety (cross-reference)

Production must never run destructive/demo seed logic automatically — enforced in code, not just
documented here: `prisma/seed.ts` hard-throws if `NODE_ENV=production` (Phase 14 guard — it shares
one publicly-known password across every account it creates). The production-safe path for
bootstrapping a fresh database is `bootstrap-admin.ts` (idempotent role/permission seeding + exactly
one real super_admin account) — see [RUNBOOK.md](RUNBOOK.md) §2.
