# Production Readiness — Phase 14 master checklist

One consolidated view of "is Rosti actually ready for real creators, real customers, and real Click
payments" — the detail behind each line lives in the linked document. This file is the index;
update it as items move, don't duplicate their detail here.

**Bottom line as of this writing: not yet launch-ready.** Two external, environment-caused blockers
remain (below), plus two operator actions that have to happen for real, not just be documented.

## Blockers — must be resolved before launch

1. **Docker images have never been through a real `docker build`.** Both Dockerfiles are written
   and hand-reviewed, but this development sandbox has no working Docker engine. Build both for
   real (a developer machine, or by running `deploy.yml` against `staging` on a GitHub-hosted
   runner) before trusting either image. See [DEPLOYMENT.md](DEPLOYMENT.md#docker--built-hand-reviewed-not-yet-build-verified).
2. **No real Railway project, domain, or GitHub Environment secrets exist yet.** The CI/CD pipeline
   is real and tested at the workflow-definition level, but `deploy.yml` cannot actually deploy
   anything until `RAILWAY_TOKEN` and the target environment's `DATABASE_URL` are configured as real
   GitHub Environment secrets. See [DEPLOYMENT.md](DEPLOYMENT.md#railway-project-setup-once-a-real-project-exists).
3. **Real Click.uz production credentials have never been activated or tested.** Every Click code
   path (signature verification, amount validation, replay protection, atomicity) has been built and
   tested against test credentials only. See [RUNBOOK.md §1](RUNBOOK.md#1-clickuz-go-live-checklist)
   for the full checklist — none of it has been executed against real credentials.
4. **No production database has ever been bootstrapped.** `bootstrap-admin.ts` exists and is
   tested at the code level, but no one has run it against a real production database yet. See
   [RUNBOOK.md §2](RUNBOOK.md#2-first-super-admin-production-bootstrap).

## Audit findings — summary

Full detail in PROJECT_STATUS.md's Phase 14 entry. Headline items found and fixed this phase:

- `CLICK_SECRET_KEY` had no production guard — could silently fall back to a publicly-known dev
  value, enabling forged Click callbacks. **Fixed.**
- Financial state-transition methods (`CommissionsService`/`PayoutsService`/`AdminRefundsService`)
  had a TOCTOU race allowing a concurrent duplicate request to double-approve/double-settle/
  double-release. **Fixed** across all three services, with dedicated race-condition tests.
- `PaymentsService`'s Click-callback PAID/FAILED handling wrote Payment and Order status as two
  separate un-transacted operations. **Fixed** — now atomic.
- Health readiness (`/health/ready`) failed the whole check the moment Redis went down, even though
  Redis isn't required for the core order/payment flow. **Fixed** — redesigned so only Postgres
  gates readiness.
- `HealthController` and `ClickCallbackController` both silently inherited the global rate limiter,
  discovered by the Phase 14 load test — a real payment callback or a load-balancer health probe
  could get 429'd under load. **Fixed** (`@SkipThrottle()` on both).
- `rbac.e2e-spec.ts`/`roles.e2e-spec.ts` were broken (missing `AuditModule` dependency, a gap dating
  to Phase 12) — every run of the full e2e suite silently failed these two files. **Fixed.**
- No way existed to seed the Role/Permission catalog or create the first admin account in
  production once demo-seed was correctly blocked there. **Fixed** — `bootstrap-admin.ts`.
- No `error.tsx`/`global-error.tsx`/`not-found.tsx` existed anywhere in the Next.js app. **Fixed.**
- Analytics pages had a filter-bar slot for creator/campaign/product/region filters that nothing
  populated. **Fixed** for Payment/Refund/Customer/Creator-list/Executive analytics pages.
- Zero CI/CD, zero Dockerfiles, zero Railway config existed. **Fixed** at the file/workflow level —
  see Blockers above for what's still unverified in a real environment.

## Non-critical issues — deferred, documented, not launch blockers

- Docker image build verification (blocker #1 above) is the only *must-fix-before-launch* item from
  this list; everything else here is a genuine "known and acceptable to launch without" gap.
- `/creator/sales` still runs on Phase-1 mock data (`apps/web/src/mocks/store.ts`'s `apiGetSales`)
  — no real backend endpoint exists. The frontend already designs correctly for PII masking
  (`sale.customerMasked`), so building the real endpoint later is a data-wiring task, not a
  design fix. Out of Phase 14's scope to build (new feature, not hardening) — see SECURITY.md's
  PII section.
- Fraud detection (self-referral/shared-IP/high-velocity flags) — Attribution Engine scope,
  explicitly out of scope for every phase so far, not a regression.
- Manual attribution override — permission defined in the RBAC catalog, no implementing feature
  exists yet (same out-of-scope reasoning).
- Per-account brute-force lockout with exponential backoff — per-IP throttling on auth routes is a
  partial mitigation; a real counter-based lockout is tracked as technical debt (see SECURITY.md).
- Data retention policy — no table has an age-based deletion/archival policy yet; see
  [BACKUP_RESTORE.md](BACKUP_RESTORE.md#data-retention).
- A cloud storage adapter (S3/R2/GCS) — `LocalDiskStorage` is dev/test-appropriate only; moving off
  it before a real launch is strongly recommended but not this phase's scope to build.

## Financial integrity — verification summary

See SECURITY.md's "Money integrity" and "Payments" sections for the itemized list. In one sentence:
every financial state-transition method in the codebase now uses the guarded-`updateMany`-with-
count-check pattern to prevent concurrent-request double-actions, Click callback handling is
signature-verified/amount-validated/replay-safe/atomic, and every manual financial action produces
an audit trail.

## Click.uz readiness result

**Code-ready, credentials-unverified.** Every safeguard (signature, amount, replay, atomicity,
service_id) is implemented and tested against test credentials. See RUNBOOK.md §1 for the full
checklist that must be executed against real production credentials before launch — none of it has
been.

## Monitoring & logging result

`/health/live`, `/health/ready`, `/health/status` all real and tested. Structured request logging
and centralized exception handling in place. Optional external error-reporting hook built but
unconfigured (no `ERROR_REPORTING_WEBHOOK_URL` set anywhere yet — that's an operator decision, not
a gap).

## Performance result

See PROJECT_STATUS.md's Phase 14 entry for the load test's full methodology and numbers. Headline:
found and fixed two real rate-limiting bugs (health checks and Click callbacks being throttled);
no other bottleneck was found severe enough to warrant a code change at the load levels tested.

## Deployment readiness

CI/CD pipeline complete and real (see DEPLOYMENT.md). Blocked on Docker build verification and
Railway/GitHub Environment provisioning (Blockers #1–2 above) before it can ship anything for real.

## Launch checklist status

See [RUNBOOK.md §6](RUNBOOK.md#6-launch-day-checklist) for the actual checklist. Not started —
this phase built the checklist and the infrastructure it depends on, not the launch itself.

## Test results

**Backend unit suite: 691/691 passing (51 suites), clean.**

**Backend e2e suite: the one real pre-existing bug found (`rbac`/`roles` specs missing
`AuditModule`) is fixed and confirmed** — verified across two full-suite runs against the real
Railway-hosted test database: run 1 showed that exact dependency-resolution error before the fix;
run 2, after the fix, showed both suites failing only on the same genuine
`Connection terminated due to connection timeout` every other suite hit, never the old error. A
fully clean full-suite pass was **not achieved in this environment** — the Railway test database's
reachability from this sandbox is unreliable enough (522 connection-timeout occurrences in the
second run alone) that no run completed without some suites dropping mid-test. This is an
environment limitation, not a code defect: `test/redis.e2e-spec.ts` passed cleanly both times,
isolating the problem to Postgres reachability specifically. **Before trusting this suite as a real
CI gate, run it against a more reliably-reachable database** (the GitHub Actions CI pipeline's own
Postgres service container, for instance, rather than this external Railway proxy) to get an actual
clean-or-not signal.

**Frontend**: `typecheck`/`lint`/`build` all clean (0 errors; 8 pre-existing warnings, unrelated to
this phase). Browser-verified in a real running instance: `not-found.tsx` and `error.tsx` both
render correctly (the latter confirmed via a real thrown error, caught and logged exactly as
implemented); the new analytics entity-filter dropdowns render live creator/campaign/product data
from the real database and correctly trigger a filtered request on selection.

## Documentation updated this phase

DEPLOYMENT.md (rewritten — the previous version was pre-implementation speculation),
ENVIRONMENT.md (new), RUNBOOK.md (new), BACKUP_RESTORE.md (new), SECURITY.md (brought from a mostly-
unchecked stale state to an accurate, verified one), PROJECT_STATUS.md (Phase 14 entry),
PRODUCTION_READINESS.md (this file, new).

## Remaining blockers before real production launch

Restated from the top of this file, for anyone reading only this section: (1) Docker build
verification, (2) Railway/GitHub Environment provisioning, (3) real Click.uz credential activation
and end-to-end test, (4) real production database bootstrap. Everything else audited this phase is
either fixed, or a documented, deliberate, non-blocking deferral.
