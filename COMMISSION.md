# Commission engine

## Base calculation

```
commissionBase = order.subtotalMinor − order.discountMinor
                  (shipping excluded; refunds handled separately, see below)
```

`order.subtotalMinor`/`discountMinor` are themselves snapshots taken at checkout
(`Order.offerSnapshot` carries the priced variant + any promo discount applied), so a later
price edit on the live Offer never touches an existing order's commission base.

## Commission types (`CommissionRule.commissionType`)

| Type | `commissionValue` meaning | amount formula |
|---|---|---|
| `PERCENTAGE` | basis points (e.g. `2000` = 20.00%) | `base * commissionValue / 10000` |
| `FIXED_PER_SALE` | minor-unit amount | `commissionValue` (flat, regardless of base) |
| `FIXED_CONTENT_FEE` | minor-unit amount | paid once per approved content submission, not per sale — modeled as a manually-triggered Commission with `baseAmountMinor = 0` |
| `HYBRID` | basis points in `commissionValue` **and** a flat add-on in `fixedPaymentMinor` | `(base * commissionValue / 10000) + fixedPaymentMinor` |

Worked example (percentage), matching the spec:
```
Original price:      100,000
Customer discount:    10,000
Commission base:      90,000
Rate:                 20% (commissionValue = 2000 bps)
Commission amount:    90,000 * 2000 / 10000 = 18,000
```

All arithmetic is integer basis-point math — no floating point anywhere in this path.

## Snapshot rule

When an `Order` is created:
1. Look up the `Campaign`'s current commission terms.
2. Write (or reuse, if an identical unexpired one already exists for this campaign)
   a `CommissionRule` row — this is the actual value the Commission will reference,
   *not* a live pointer to `Campaign`.
3. Create the `Commission` row referencing that `CommissionRule`, with `status = PENDING`.

If an admin later changes `Campaign.commissionValue`, a **new** `CommissionRule` row is created
with `effectiveFrom = now()`; the old rule's `effectiveTo` is set. Every `Commission` row created
before that edit keeps pointing at the old rule. This is the mechanism, not a convention to
remember — there is no code path that lets an Order's Commission be recomputed against a
different rule than the one it was created with.

## Status lifecycle

```
PENDING → APPROVED → PAYABLE → PAID
   ↓
REJECTED   (order cancelled before fulfillment, or fraud confirmed)
   ↓ (from APPROVED or PAYABLE, if a refund is issued)
REFUNDED
```

Transitions are driven by `Order.status`, not set directly by any endpoint that isn't
`OrdersModule`/`RefundsModule`:

- `Order` reaches `DELIVERED` (physical) or `COMPLETED` (course/service) → after the campaign's
  configured return/refund window elapses with no refund, a scheduled job moves
  `Commission: PENDING → APPROVED`, then immediately `→ PAYABLE` (these are logically two steps
  so `APPROVED` can be surfaced as "commission confirmed, awaiting hold period" if the business
  ever wants a gap between them — currently the hold period *is* the refund window, so they
  happen in the same job run).
- `Order` reaches `CANCELLED` before that → `Commission: PENDING → REJECTED`, no ledger entry
  is ever created (a `PENDING` commission with no `ACCRUAL` ledger row yet is safe to just mark
  rejected).
- A `Refund` is approved and processed against an order whose Commission is already
  `APPROVED`/`PAYABLE`/`PAID` → `Commission → REFUNDED` **and** a `CommissionLedger` row with
  `type: REVERSAL`, `amountMinor: -commission.amountMinor` is appended. The original `ACCRUAL`
  row is never edited or deleted.

## Ledger vs. status

`Commission.status` is a convenience read model for "what stage is this in". The actual balance
a creator sees on `/creator/balance` is always computed as
`sum(CommissionLedger.amountMinor) grouped by creatorId, filtered by ledger entry state matching
pending/available/paid` — so a bug that mutates `Commission.status` incorrectly cannot, by itself,
change how much money the system thinks it owes anyone. This is the same reason payouts consume
`CommissionLedger`/`Commission` rows rather than debiting a single mutable balance integer (see
DATABASE.md).

## Payout interaction

A `Payout` batches N `Commission` rows with `status = PAYABLE` belonging to one creator, up to
the requested amount, and stamps `Commission.payoutId` on each. Moving `Payout: APPROVED →
PROCESSING → PAID` is the only path that flips those Commissions to `PAID` — normal application
code has no other route to set that status, which is what makes "payout double-spend protection"
enforceable: a Commission with a non-null `payoutId` cannot be selected into a second Payout
(enforced in `PayoutsModule`'s selection query, inside a transaction with a row lock).

## Deliberately out of scope for MVP commission math

Payment processor fees and tax are **not** netted out of the commission base by default — the
spec calls for this to be admin-configurable ("payment fee admin qoidasi asosida"), so
`Setting` will carry a `commission.deductProcessorFee: boolean` and
`commission.taxRateBps: number` toggle read at commission-creation time once Phase 6 implements
the module; the base calculation above is the default with both toggles off.
