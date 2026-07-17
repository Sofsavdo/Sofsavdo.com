# Deployment

No existing production infrastructure was found for this project during the Phase 0 audit (the
working directory was empty). The targets below are proposed, not yet provisioned — nothing in
this file has been deployed.

## Targets

```
Frontend (apps/web):  Vercel
Backend  (apps/api):  Railway
Database:              Railway Postgres (or any managed Postgres — connection is via
                        DATABASE_URL + the pg driver adapter, see DATABASE.md)
Redis:                  Railway Redis (BullMQ queues + cache)
Object storage:         Cloudflare R2 (S3-compatible — FilesModule uses the S3 SDK against it)
DNS / CDN:              Cloudflare
Error monitoring:       Sentry
Product analytics:      PostHog
```

Domain plan (per spec, not yet registered/confirmed by the user):
```
rosti.uz            marketing/root
creator.rosti.uz     creator app (or /creator path on the same Next.js app at MVP)
admin.rosti.uz       admin app (or /admin path, same app, at MVP)
api.rosti.uz         NestJS API + Swagger docs
```
At MVP scale a single Next.js deployment serving `/`, `/creator/*`, `/o/*`, `/checkout/*`, and
`/admin/*` behind route groups is simpler to operate than three separate deployments — the
subdomain split is a later infra migration, not a Phase-1 requirement.

## Health endpoints

```
GET /health         liveness + a static OK
GET /health/ready    checks DB connection + Redis connection
GET /health/live     process liveness only, no dependency checks (safe for aggressive polling)
```

## Docker

`apps/api` ships a `Dockerfile` (Phase 6). Local dev uses `docker-compose.yml` at the repo root
for Postgres + Redis only — the Next.js and NestJS apps run via `npm run dev` locally, not
containerized, to keep the inner dev loop fast.

## Migrations & seed

`npx prisma migrate deploy` runs in the Railway deploy pipeline before the API process starts.
Seed data (`apps/api/prisma/seed.ts`, per the realistic-Uzbek-content requirement in the master
spec) runs once against a fresh environment, never against production without an explicit
operator action.

## Rollback

Railway/Vercel both support redeploying a previous build immediately; database rollback relies on
Prisma migration `down` scripts being written for any migration that isn't purely additive — this
is a Phase 6+ discipline, tracked per-migration once migrations exist.

## What I will not assume

Per the master prompt's own guidance, I have not assumed production payment credentials,
production secrets, an officially confirmed domain, legal documents, or performed any destructive
database operation. All provider integrations (Click, Payme, Uzum Nasiya) run against the
`MockProvider` (see ARCHITECTURE.md §7) until real credentials are supplied by the user.
