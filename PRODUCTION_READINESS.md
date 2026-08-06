# Production Readiness — master checklist

One consolidated view of "is Sofsavdo actually ready for real creators, real customers, and real Click
payments" — the detail behind each line lives in the linked document. This file is the index;
update it as items move, don't duplicate their detail here.

> **Status as of 2026-08-06: live in production.** Real Railway deployment serving real traffic at
> `sofsavdo.com`/`api.sofsavdo.com`, real Click.uz credentials active, real creators and orders
> flowing through the system. The "Blockers" section below is preserved as history — all four were
> resolved as of Phase R (2026-07-30, see `PROJECT_STATUS.md`). Everything below that predates this
> notice was written for a pre-launch audience; treat `PROJECT_STATUS.md`'s Phase entries (newest at
> the bottom) as the current source of truth for what's actually been verified, especially Phase T
> (2026-08-06), which fixed a live financial race condition, hardened the system for scale, and
> added/verified the Fidem partner integration.

## Blockers — resolved as of Phase R (2026-07-30)

All four originally listed here are done for real, not just documented:

1. ~~Docker images have never been through a real `docker build`.~~ Done — verified per
   `PROJECT_STATUS.md`'s Phase Q entry.
2. ~~No real Railway project, domain, or GitHub Environment secrets exist yet.~~ Done — the system
   has been serving real traffic at the real domain since Phase R.
3. ~~Real Click.uz production credentials have never been activated or tested.~~ Done — real
   credentials entered and processing real payments.
4. ~~No production database has ever been bootstrapped.~~ Done — the production database has a
   bootstrapped admin account and real data.

See [RUNBOOK.md](RUNBOOK.md) for the checklists that were executed, and `PROJECT_STATUS.md`'s "A
note on production launch itself" (end of the Phase Q/R section) for the original confirmation.

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

## Resolved this phase (Phase A — production-hardening pass, post-Sofsavdo-pivot kickoff)

- **`/creator/sales` real backend** — previously ran entirely on Phase-1 mock data
  (`apps/web/src/lib/api/index.ts`'s `getSales` unconditionally re-exported the mock
  `apiGetSales`). Now backed by a real `GET /creator/sales` endpoint
  (`CreatorSalesController`/`CommissionsService.listMySales`), server-side masked
  (`common/masking/pii-mask.util.ts`), ownership-scoped to the authenticated creator. Verified via
  3 new e2e tests against real Postgres (masking, ownership isolation, auth) plus unit tests, and
  confirmed in-browser (Network tab shows the real request, not a mock fallback).
- **Per-account brute-force lockout** — previously per-IP throttling only. `User` gained
  `failedLoginCount`/`lockedUntil`; `AuthService.login()` now locks an account for a configurable
  window (`AUTH_MAX_FAILED_LOGIN_ATTEMPTS`/`AUTH_LOCKOUT_DURATION_MINUTES`, default 5/15) after
  consecutive failures, using the same guarded-`updateMany` race-safety pattern as the Phase 14
  financial fixes. Verified via unit tests (threshold, reset-on-success, locked-before-password-
  check) and e2e tests against real Postgres.
- **Cloud object storage adapter** — `S3Storage implements StoragePort` added (real
  `@aws-sdk/client-s3`, covers AWS S3/Cloudflare R2/GCS via their S3-compatible endpoints).
  `StorageModule`'s binding is now env-driven (`STORAGE_DRIVER=local|s3`) instead of hardcoded to
  `LocalDiskStorage`. **Still defaults to `local`** — actually moving a real deployment onto S3/R2
  is an operator action (set `STORAGE_DRIVER=s3` + the credential env vars), not something this
  phase could do from inside a sandbox with no real bucket to point at. Production startup now
  refuses to boot with `STORAGE_DRIVER=s3` and missing bucket/credentials (env-validation.ts).
- **Creator profile page** — the backend (`GET /creator/profile`) already existed; only the
  frontend page was missing. Added `apps/web/app/creator/(app)/profile/page.tsx` (read-only,
  reuses data already in the session object — no new fetch) + a nav entry.

## Non-critical issues — deferred, documented, not launch blockers

- Docker image build verification (blocker #1 above) is the only *must-fix-before-launch* item from
  this list; everything else here is a genuine "known and acceptable to launch without" gap.
- Fraud detection (self-referral/shared-IP/high-velocity flags) — Attribution Engine scope,
  explicitly out of scope for every phase so far, not a regression.
- Manual attribution override — permission defined in the RBAC catalog, no implementing feature
  exists yet (same out-of-scope reasoning).
- Data retention policy — no table has an age-based deletion/archival policy yet; see
  [BACKUP_RESTORE.md](BACKUP_RESTORE.md#data-retention).
- Actually provisioning a real S3/R2 bucket and switching `STORAGE_DRIVER` to `s3` in production —
  the adapter exists and is tested; pointing it at a real bucket is an operator action, same
  category as the 4 blockers above but not added to that list since local-disk storage, while not
  production-ideal, doesn't block a first launch the way an unbootstrapped database would.

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

**Backend unit suite: 714/714 passing (53 suites), clean** (691 baseline + 23 new: sales/masking/
lockout/S3-storage/env-validation tests from Phase A).

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

**Phase A update**: SECURITY.md's brute-force-lockout line updated (was "not implemented," now
implemented+tested), PII section's `/creator/sales` gap note removed (resolved), a new "Cloud
storage" line added; PROJECT_STATUS.md gained a Phase A entry; this file's Blockers/Resolved split
above.

## Remaining blockers before real production launch

None — see the status note at the top of this file. All four items originally listed here (Docker
build verification, Railway/GitHub Environment provisioning, real Click.uz credential activation,
real production database bootstrap) were completed as of Phase R (2026-07-30); the system has been
live since. For what's been found and fixed in production since launch, see `PROJECT_STATUS.md`'s
Phase R onward (Phase T, 2026-08-06, is the most recent as of this writing).
