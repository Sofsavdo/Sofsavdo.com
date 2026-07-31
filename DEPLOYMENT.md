# Deployment

Supersedes the original Phase 0/1 speculative version of this file — that draft predated any real
implementation (it assumed S3 storage, a Dockerfile that didn't actually exist yet, etc.). Everything
below reflects what's actually built as of Phase 14 (Production Hardening). See
[RUNBOOK.md](RUNBOOK.md) for the operational side (first admin, Click go-live, daily/weekly
checklists) and [ENVIRONMENT.md](ENVIRONMENT.md) for the full environment variable reference.

## Targets

```
Frontend (apps/web):  Railway (Docker) — see apps/web/Dockerfile, apps/web/railway.toml
Backend  (apps/api):  Railway (Docker) — see apps/api/Dockerfile, apps/api/railway.toml
Database:              Railway Postgres (DATABASE_URL + @prisma/adapter-pg)
Redis:                  Railway Redis (rate limiting + analytics caching — see health.controller.ts
                        for why a Redis outage degrades performance rather than taking the app down)
Object storage:         LocalDiskStorage today (dev/test only, gitignored uploads/ dir) — a cloud
                        adapter (S3/R2/GCS) implements the same StoragePort when one is actually
                        provisioned; none is wired up yet (see PROJECT_STATUS.md's deferred list)
Container registry:     GitHub Container Registry (ghcr.io) — images built and pushed by
                        .github/workflows/deploy.yml
Error reporting:        None required — AllExceptionsFilter always logs 5xxs locally; an optional
                        webhook-based forwarder activates only if ERROR_REPORTING_WEBHOOK_URL is set
                        (see apps/api/src/common/error-reporting/)
```

No production domain, Railway project, or GitHub Environment secrets have been provisioned during
this phase — the pipeline below is real and ready to run, but nobody has pointed it at a live
Railway project yet. See RUNBOOK.md §1 and §6 for what must happen before that's true.

## CI/CD pipeline

Two workflows, both real (`.github/workflows/`):

**`ci.yml`** — runs on every push and PR: `npm ci` → `prisma generate` → `prisma validate` →
typecheck → lint → `prisma migrate deploy` against a real Postgres+Redis service-container pair →
unit tests → e2e tests → build. Both apps (`api` and `web` jobs) run in parallel. This is the
Phase 14 §14 requirement in force: a broken typecheck, lint failure, failing test, or failed build
blocks everything downstream, because `deploy.yml` calls this workflow as its own first job.

**`deploy.yml`** — **manual only** (`workflow_dispatch`, choose `staging` or `production`; never
triggered by a push). Per Phase 14 §14 ("do not automatically deploy to production without an
explicit deployment action"), there is no path from a git push to a production deploy without a
human explicitly running this workflow. Steps, in order:
1. `quality-gate` — reruns `ci.yml` in full.
2. `migrate` — `prisma migrate deploy` against the target environment's real `DATABASE_URL`
   (a GitHub Environment secret, not committed anywhere).
3. `build-and-push` — builds both Dockerfiles, pushes to `ghcr.io/<repo>/api` and `.../web`, tagged
   `<environment>-<git-sha>`.
4. `deploy` — `railway up` for both services via the Railway CLI (needs `RAILWAY_TOKEN` as a GitHub
   Environment secret — not configured yet, since no real Railway project exists to point at).
5. `verify` — polls the deployed API's `/health/ready` for up to 2 minutes; the workflow only
   reports success once that returns 200. A deploy that ships but boots into a crash loop, or can't
   reach its database, shows up as a **failed** Actions run, not a silent bad deploy.

Configuring a GitHub Environment (Settings → Environments) for `staging`/`production` also lets a
required-reviewer approval gate be added on top of the manual trigger, if that's wanted.

## Docker — built, hand-reviewed, NOT yet build-verified

Both `apps/api/Dockerfile` and `apps/web/Dockerfile` exist, are multi-stage (deps → build →
prod-deps → runtime), and were written and reviewed against this repo's actual npm-workspaces
layout — but **neither has been through an actual `docker build` in this environment**: the
development sandbox this phase was done in has no working Docker Desktop virtualization backend
(confirmed: the engine never comes up, `docker build`/`docker info` fail with a pipe-connection
error). See PROJECT_STATUS.md's Phase 14 entry for the full confirmation detail.

**Before trusting either image for a real deploy**, build both for real in an environment with a
working Docker engine (a developer machine, or simply by triggering `deploy.yml` against `staging`
— its `build-and-push` job runs on GitHub-hosted runners, which do have Docker):
```bash
docker build -f apps/api/Dockerfile -t sofsavdo-api:test .
docker build -f apps/web/Dockerfile -t sofsavdo-web:test .
```
Both must be built with the **repo root** as the build context (`.`), not `apps/api`/`apps/web` —
see each Dockerfile's own header comment for why (npm workspaces).

The web build's `NEXT_PUBLIC_API_MODE`/`NEXT_PUBLIC_API_URL` are baked in at build time via Docker
`ARG`s (Next.js inlines `NEXT_PUBLIC_*` into the client bundle) — a staging build and a production
build are genuinely different images, not the same image with different runtime env vars for those
two specific variables.

## Railway project setup (once a real project exists)

Two services in one Railway project, both pointed at this same repo with **Root Directory left at
the monorepo root** (`/`), not `apps/api`/`apps/web` — each service's `railway.toml`
(`dockerfilePath`) already assumes that. Plus one Postgres and one Redis instance (Railway's own
managed offerings, or any Postgres/Redis reachable via `DATABASE_URL`/`REDIS_URL`).

```
sofsavdo-api → apps/api/railway.toml → healthcheckPath /health/ready
sofsavdo-web → apps/web/railway.toml → healthcheckPath /
```

Configure every required environment variable per [ENVIRONMENT.md](ENVIRONMENT.md) directly in
Railway's dashboard for each service — never in a committed file.

## Persistent file storage (Railway Volume) — required if staying on LocalDiskStorage

Two real production incidents traced back to this exact area (see DECISIONS.md ADR-046/048):
uploaded images returned a URL nobody's browser could ever reach, and — separately — every
uploaded file lives on the API container's own ephemeral disk, so it's wiped on every redeploy or
restart unless a volume is attached. Both must be fixed for uploads to actually work and persist:

1. **`STORAGE_PUBLIC_BASE_URL`** — set this on the `sofsavdo-api` Railway service to the API's real
   public origin plus `/media` (e.g. `https://api.sofsavdo.com/media`, matching the static-file
   prefix registered in `apps/api/src/main.ts`). Boot now refuses to start without this when
   `STORAGE_DRIVER` isn't `s3` (see `env-validation.ts`) — a missing or `localhost` value here is
   exactly what caused uploaded images to succeed but never display for any real visitor.
2. **Attach a Railway Volume to `sofsavdo-api`, mounted at exactly `/app/apps/api/uploads`** — this
   must be done through Railway's own dashboard or CLI (`railway volume add`), not this repo's
   `railway.toml`; Railway volumes are a per-service resource attached out-of-band, not a
   declarative config key this repo's config format supports. Steps: open the `sofsavdo-api`
   service in the Railway dashboard → **Volumes** tab → **New Volume** → mount path
   `/app/apps/api/uploads`. The Dockerfile/entrypoint (`apps/api/docker-entrypoint.sh`) already
   handle a freshly-mounted, root-owned volume correctly — it re-`chown`s the mount to the
   unprivileged runtime user at every container start before the app process runs, so no further
   manual permission fix is needed after attaching it.

Alternatively, switching `STORAGE_DRIVER=s3` (with real bucket credentials — see `S3Storage`,
already fully implemented) replaces both of the above with a real cloud object store and needs no
volume at all. Either path is valid; a volume is the faster path if a cloud storage account isn't
already set up, S3/R2 is the more scalable one long-term.

## Safe migration process

- **Never** run `prisma migrate dev` against a real environment — that command can generate a new
  migration interactively and is meant for local development only.
- Production/staging always run `prisma migrate deploy` (`npm run prisma:migrate:deploy
  --workspace=@sofsavdo/api`), which only applies migrations already committed and code-reviewed —
  it never creates or edits one.
- Write every migration to be additive/backward-compatible where realistically possible (add a
  column nullable or with a default, don't rename in the same migration you also change application
  code to read the new name) — this is what actually makes a rollback safe, more than any specific
  tooling.
- Migrations run as their own CI/CD step (`deploy.yml`'s `migrate` job), before the new image is
  even built — never baked into the Docker image's `CMD` (see `apps/api/Dockerfile`'s comment on
  why: multiple replicas starting the same image must never race each other into applying the same
  migration concurrently).

## Rollback

- **Application code**: redeploy the previous image tag (`ghcr.io/<repo>/api:<environment>-<previous-sha>`)
  via `railway up` (or Railway's dashboard "redeploy" on a previous deployment) — the image registry
  keeps every previously-pushed tag.
- **Database**: only safe if the migration being rolled back from was additive (see above). A
  destructive migration (dropped column, changed type) is not safely reversible by redeploying old
  code alone — restoring from a recent backup is the real answer in that case (see
  [BACKUP_RESTORE.md](BACKUP_RESTORE.md)).
- Always confirm `/health/ready` returns `{status: "ok"}` after any rollback, the same as after a
  forward deploy.

## Emergency hotfix process

1. Branch from `main`, make the minimal fix, open a PR — `ci.yml` still gates it like any other
   change; skipping tests/typecheck to "move fast" during an incident is exactly when a second bug
   gets shipped on top of the first.
2. Merge once CI is green.
3. Run `deploy.yml` manually against `production` — the same pipeline as any other deploy, not a
   separate "fast path" that bypasses migration safety or the post-deploy `/health/ready` check.
4. Record the incident (what broke, what the fix was, why) in DECISIONS.md or wherever the team
   tracks postmortems — not covered by any file in this repo today.
