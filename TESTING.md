# Testing plan

## Unit (Jest, `apps/api`)

- Promo code validation (all typed error branches — see API.md error codes)
- Attribution resolution (promo-wins-over-visit, most-recent-visit-wins, expiry boundary,
  self-referral flagging)
- Commission calculation (all four `CommissionType` variants, discount-then-commission ordering,
  basis-point rounding)
- Commission snapshot immutability (changing a Campaign's rule after an order exists must not
  change that order's Commission)
- Refund reversal (ledger entry sign/amount, status transition)
- Payout eligibility (only `PAYABLE` commissions selectable, already-`payoutId`-tagged ones
  excluded, minimum payout threshold from `Setting`)
- Offer price / order total computation (variant price + discount + shipping)
- RBAC guard behavior (permission present/absent cases)

## Integration (Jest + a real test Postgres via Docker, or Testcontainers)

- Creator register → application submit → admin approve → dashboard unlocked
- Campaign apply (approval-required and instant-join paths)
- Referral link + promo code generation on campaign join
- `/referrals/track` writes a well-formed `ReferralVisit`
- Promo code use at checkout end-to-end (validate → apply → order)
- `POST /orders` full path: attribution → price recalculation → Order + Commission created in
  one transaction, idempotency key replay returns the original order rather than creating a
  duplicate
- Payment webhook (mock provider) → Order status progression
- Commission auto-transition job (PENDING → APPROVED → PAYABLE after refund window)
- Refund → Commission REFUNDED + ledger reversal
- Payout request → admin approval → PAID, and a second concurrent payout request against the
  same commissions is rejected

## E2E (Playwright, `apps/web`)

Mirrors the 15-step flow in USER_FLOWS.md exactly:
1. Creator registers
2. Admin approves the creator
3. Creator selects a campaign and joins
4. Creator gets a referral link + promo code
5. Buyer opens the referral link → lands on exactly one offer page
6. Buyer completes single-offer checkout
7. Promo code applies correctly
8. Order is attributed to the correct creator
9. Commission is created as PENDING
10. Admin marks the order delivered
11. Commission becomes APPROVED/PAYABLE
12. Creator requests a payout
13. Admin approves and pays out
14. Commission shows PAID
15. Regression check: from the offer landing, there is no reachable link to any other
    offer/product/course (explicit negative assertion, not just "didn't test for it")

Also covered: responsive rendering at mobile/tablet/desktop breakpoints for the offer landing
and creator dashboard, and a console-error assertion (zero uncaught errors) on every route in the
E2E suite.

## Phase 6A test commands (implemented)

Run from `apps/api/`:

```
npm run test              # unit tests only, no DB — money/DomainException/PermissionsGuard/
                           # TokenService(mocked Prisma)/permission-matrix
npm run test:unit         # alias of the above
npm run test:integration  # roles.e2e-spec.ts + rbac.e2e-spec.ts — service-layer tests against a
                           # real Postgres, no HTTP layer
npm run test:e2e          # every *.e2e-spec.ts including auth.e2e-spec.ts's full HTTP flow
                           # (register/login/refresh/logout-all/cookie attributes)
npm run db:migrate:test   # prisma migrate deploy against .env.test's DATABASE_URL
npm run db:seed:test      # prisma/seed.ts against .env.test's DATABASE_URL
```

`test:integration`/`test:e2e`/`db:migrate:test`/`db:seed:test` load `apps/api/.env.test` (copy
from `.env.test.example`, never committed) via `dotenv-cli` — this is a deliberate second
environment file, separate from `apps/api/.env` (local dev), so a test run can never point at
whatever database a developer happens to have configured for day-to-day work. `--runInBand` is
used for the DB-backed suites so files execute serially against the one test database instead of
racing each other; within a file, each `describe` block generates a unique per-run suffix
(`` `e2e-${Date.now()}` ``) for every row it creates and deletes only rows matching that suffix in
`afterAll`, so two suites (or two manual re-runs) never collide even without `--runInBand`.

## What "done" looks like per phase

Unit tests ship with the module that introduces the logic (e.g. `CommissionsModule` is not
considered complete without its calculation unit tests). Integration tests ship once two or more
modules are wired together for a flow. E2E tests are written once the corresponding frontend
pages exist and are runnable against a seeded local environment.
