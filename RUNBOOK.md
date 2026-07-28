# Rosti — Launch & Operations Runbook

Practical, step-by-step procedures for taking Rosti from a deployed-but-empty instance to serving
real creators, real customers, and real Click payments — and for running it day to day afterward.
Written against the actual code in this repo as of Phase 14 (Production Hardening); every command
and endpoint below is real, not illustrative. Placeholders (`<...>`) are things only the operator
can fill in — nothing here invents contact names, phone numbers, or legal text.

See also: [ENVIRONMENT.md](ENVIRONMENT.md) for every environment variable, [DEPLOYMENT.md](DEPLOYMENT.md)
for how a deploy actually happens, [BACKUP_RESTORE.md](BACKUP_RESTORE.md) for database recovery,
[SECURITY.md](SECURITY.md) for the security posture, and [PROJECT_STATUS.md](PROJECT_STATUS.md) for
what's built vs. deferred.

## 1. Click.uz go-live checklist

Rosti's Click integration ([click-payment.adapter.ts](apps/api/src/payments/click-payment.adapter.ts),
[click-callback.controller.ts](apps/api/src/payments/click-callback.controller.ts)) has been built and
tested against **test credentials only**. Nobody on this project has activated real production Click
credentials. Before doing so:

1. **Obtain real production credentials from Click.uz**: `CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`,
   `CLICK_SECRET_KEY`. Confirm with Click which environment (sandbox vs. production) each value
   belongs to — do not guess from the value's shape.
2. **Set `CLICK_ENV=production`** alongside the three values above, in the real production
   environment's variables only (never in a committed `.env` file). `env-validation.ts` hard-fails
   startup if `NODE_ENV=production` and `CLICK_ENV` is anything other than `"production"` — this is
   the safeguard against accidentally launching against Click's test merchant, or the reverse.
3. **Register the real callback URLs with Click**: `https://<your-production-api-domain>/payments/click/prepare`
   and `.../complete`. These routes are `@Public()` (no JWT required — Click calls them directly)
   and deliberately **not** rate-limited (`ClickCallbackController` carries `@SkipThrottle()`,
   confirmed via the Phase 14 load test) — a legitimate payment confirmation must never be silently
   dropped because too many arrived in one window. Rejection of bad requests is cheap (a failed MD5
   signature check returns instantly), which is what actually bounds abuse here, not a rate limit.
4. **Confirm signature verification is real, not bypassed**: `ClickPaymentAdapter.verifyCallback()`
   computes the MD5 signature per Click's documented algorithm and rejects any request whose
   signature doesn't match — this cannot be disabled by configuration. Also validates `service_id`
   against `CLICK_SERVICE_ID` as defense-in-depth (Phase 14 addition) — a forged callback claiming a
   different service_id is rejected even before the signature check would catch it.
5. **Confirm amount validation**: `PaymentsService.handleClickCallback` compares the callback's
   `amount` against the stored `Payment.amountMinor` and rejects a mismatch with
   `INVALID_PAYMENT_AMOUNT` — a manipulated callback claiming a different (lower) amount than the
   real order total cannot mark that order paid.
6. **Confirm duplicate/replay handling**: a callback for a `Payment` already in a terminal state
   (`PAID`/`FAILED`) is acknowledged (Click stops retrying) but not reprocessed — no double
   commission, no double stock decrement. Verified in `payments.service.spec.ts` and exercised
   end-to-end in `test/checkout.e2e-spec.ts`.
7. **Confirm PAID/FAILED writes are atomic**: `OrdersService.markPaid`/`markPaymentFailed` update
   the `Order` and `Payment` rows in one `$transaction` (Phase 14 fix — previously two separate
   writes with a crash window between them).
8. **Do a real, small, end-to-end test transaction** against production credentials before
   announcing launch: place a real order for the smallest real offer, pay with a real card, confirm
   the order flips to PAID, confirm the commission accrues, then refund it through the admin UI
   (`/admin/refunds`) and confirm the refund actually reaches the customer's card.
9. **Confirm `/health/status`'s Click section reports `secretConfigured: true`, `env: "production"`**
   once live — this is presence-only (booleans, never the actual secret), safe to check from any
   monitoring dashboard.
10. **Do not activate production Click credentials until items 1–9 are all checked** — this is the
    one integration in the system that moves real customer money.

## 2. First super admin (production bootstrap)

A fresh production database has no Role/Permission/User rows at all — `prisma/seed.ts` (which
creates those, plus demo creators/campaigns) refuses to run once `NODE_ENV=production` (Phase 14
guard: it shares one publicly-known password across every seeded account). Use the dedicated
bootstrap script instead:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@yourcompany.uz BOOTSTRAP_ADMIN_PASSWORD='a-real-strong-password-12+chars' \
  npm run bootstrap:admin --workspace=@rosti/api
```

What it does ([bootstrap-admin.ts](apps/api/prisma/bootstrap-admin.ts)):
- Seeds the Permission/Role/RolePermission catalog from the real `permissions.constants.ts`
  definitions (idempotent — safe to re-run, e.g. after adding a new permission in a later release).
- Creates exactly one `super_admin` user with the email/password you provide.
- Refuses to create a second super_admin if one already exists, unless you explicitly pass
  `BOOTSTRAP_ALLOW_ADDITIONAL_ADMIN=true` — this stops a copy-pasted command from silently minting
  extra full-power accounts.
- Never logs the password anywhere.

Run this once, immediately after the first production migration deploy and before any other setup
step. Log in at `/admin/login` with the email/password you set, then **rotate that password** from
the account's own settings — a password that was ever typed into a shell command or CI secret
should not remain the permanent one.

From here, use the real admin UI (`/admin/users`, `/admin/roles`) to create additional
manager/admin accounts for the rest of the team — `bootstrap-admin.ts` is a one-time bootstrap tool,
not the ongoing way staff accounts get created.

## 3. Initial content setup (before accepting real orders)

Order matters — each step depends on the one before it existing:

1. **Products** (`/admin/products`) — at least one real product with accurate name, images, and
   `costPriceMinor` (used in margin-aware analytics).
2. **Offers** (`/admin/offers`) — at least one Offer per Product (price, currency, delivery
   settings). Configure `OfferDeliveryRegion` rows if the offer uses regional delivery pricing.
3. **Landing page** (`/admin/landings`) — build and **publish** the landing for each Offer (an
   unpublished landing 404s for real visitors).
4. **Campaign** (`/admin/campaigns`) — create the campaign that ties an Offer to a creator program:
   commission rules, `creatorLimit`, campaign media (portrait 1080×1440 images/video — validated
   server-side, real magic-byte content sniffing, not just a declared Content-Type).
5. **Creators** — either invite creators to apply via the public creator-application flow (reviewed
   at `/admin/creator-applications`) or, for the first few, create accounts directly.
6. **Promo codes** (`/admin/promo-codes`), if the launch uses any — confirm discount type/amount and
   validity window.
7. **Delivery regions/rules** — confirm `/admin/settings` and each Offer's delivery configuration
   matches real fulfillment capability before launch, not placeholder data.

Do a full manual walkthrough of the public flow (`/o/<offer-slug>` → checkout → payment) with a real
test order before inviting real creators to share links.

## 4. Daily operator workflow

Run through this every business day, roughly in this order:

1. **`/admin/dashboard`** — quick scan for anything visually off (a metric at zero that shouldn't
   be, a spike in refunds).
2. **`/admin/orders`** — filter by `PAYMENT_PENDING` older than ~1 hour: a payment that never
   completed on Click's side may need customer follow-up.
3. **`/admin/payments`** — check for any `FAILED` payments; `NotificationSweepService` already
   notifies admins of these automatically (`payment.failed.admin`), but confirm none were missed
   (check `/admin/notifications` too — a failed Telegram/email send lands in the admin's
   failed-delivery queue, retryable from there).
4. **`/admin/refunds`** — action any `REQUESTED` refunds sitting unreviewed.
5. **`/admin/creator-applications`** — review any new applications.
6. **`/admin/commissions`** — spot-check that `APPROVED`/`PAYABLE` commissions look right relative
   to the day's paid orders.
7. **`/admin/payouts`** — action any `REQUESTED` payouts (approve → mark processing once the real
   bank/Click transfer is sent → mark paid once confirmed, or mark failed with a reason).
8. **`/health/status`** (authenticated ops access, or a monitoring tool hitting it directly) —
   confirm `database`/`redis`/`scheduledJobs` are all `up`, `disk` is `up` or `skipped` as expected.

## 5. Weekly financial reconciliation checklist

1. Pull `/admin/analytics/payments` for the week: compare `successRate`, total paid amount, and
   `byMethod` breakdown against Click's own merchant dashboard for the same period — these two
   totals must match exactly (both are counting the same real transactions).
2. Pull `/admin/analytics/refunds` for the week: confirm `totalRefundedMinor` matches what actually
   left the business's Click account.
3. Reconcile `/admin/commissions` (`APPROVED`/`PAYABLE` totals for the week) against the orders that
   generated them — spot-check a sample, don't assume the aggregate is right without ever having
   traced one order through.
4. Reconcile `/admin/payouts` (`PAID` total for the week) against actual bank/Click transfers sent
   — every `PAID` payout row should correspond to money that actually left the account.
5. Check `/admin/audit-log` for any manual financial actions taken during the week (refund
   approvals, payout status overrides) and confirm each one was legitimate and expected.
6. File or note discrepancies immediately — a mismatch here is the earliest signal of either a bug
   or fraud, and gets harder to trace the longer it sits.

## 6. Launch-day checklist

- [ ] Production migrations deployed and confirmed (`prisma migrate deploy` exit code 0 — see
      [DEPLOYMENT.md](DEPLOYMENT.md)).
- [ ] `bootstrap:admin` run, super admin password rotated.
- [ ] `/health/ready` returns 200 with `status: "ok"` (not `"degraded"`) — both Postgres and Redis
      reachable.
- [ ] Section 1's Click go-live checklist fully complete, including the real end-to-end test
      transaction.
- [ ] Section 3's initial content setup complete; a manual walkthrough of the public flow succeeded.
- [ ] CORS origin (`CORS_ALLOWED_ORIGINS`/`WEB_APP_URL`) points at the real production frontend
      domain, not a staging/localhost URL.
- [ ] `SWAGGER_ENABLED` left unset (or `false`) in production, unless a protected staging-style docs
      view is genuinely wanted.
- [ ] At least one other staff member (not just the bootstrap super admin) has a working
      manager/admin account, so a single person's lost session doesn't block operations.
- [ ] Rollback plan reviewed (see [DEPLOYMENT.md](DEPLOYMENT.md)'s rollback section) in case
      launch-day reveals a real blocker.
- [ ] `<Incident escalation contact — fill in: who gets paged, and how, if something breaks on
      launch day>`.

## 7. First 7-day monitoring checklist

- **Every day**: run the Section 4 daily workflow, plus explicitly check `/health/status`'s
  `scheduledJobs` section — a stale `lastRunAt` (or a non-null `lastError`) means
  `NotificationSweepService` isn't running cleanly, which means creators/admins are silently missing
  real notifications about their own orders/commissions/payouts.
- **Day 1–2**: watch Click payment success rate closely (`/admin/analytics/payments`) — this is
  where a production-credentials misconfiguration would show up fastest (e.g., a signature mismatch
  from a copy-paste error in `CLICK_SECRET_KEY`).
- **Day 3**: run the Section 5 weekly reconciliation early, even though a full week hasn't passed —
  catching a systematic financial discrepancy on day 3 instead of day 7 matters.
- **Day 7**: do the full Section 5 weekly reconciliation for real. Also review
  `/admin/audit-log` for the whole week end to end, not just spot-checks — this is the first point
  where a full week of real operator behavior exists to sanity-check.
- Throughout: treat any `/health/ready` response with `status: "degraded"` (Redis down) as worth
  investigating same-day even though it doesn't take checkout/payment down — a persistently down
  Redis silently degrades rate limiting and analytics caching.

## 8. Incident escalation

`<This section intentionally left as a template — fill in with real operational details before
launch:>`
- `<Who is on-call, and how are they reached (phone/Telegram/etc.)?>`
- `<What's the threshold for waking someone up outside business hours — e.g. payments completely
  down vs. a single failed refund?>`
- `<Who has production database access for an emergency query, and how is that access requested?>`
- `<Click.uz's own support contact, for when the problem is on their side (signature/merchant
  config disputes, payment gateway outages)>`
