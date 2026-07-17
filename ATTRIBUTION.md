# Attribution engine

Decides, at order-creation time, which single creator (if any) gets credit for a sale.
Runs inside the same database transaction as `Order` creation, so an order and its
`Attribution` row are created atomically — there is never a moment where an order
exists without an attribution decision already made.

## Inputs available to the resolver

```
promoCodeInput?: string          // entered at checkout, or pre-filled from ?ref=
visitorId: string                // server-issued (see below), sent by the client on checkout
offerId: string
```

## Resolution order

```
1. If promoCodeInput is present and valid for this offer (see COMMISSION.md/PromoCodes
   validation rules) → attribute to that code's creator. source = PROMO_CODE.
2. Else, look up ReferralVisit rows for this visitorId + offerId where expiresAt > now,
   ordered by createdAt DESC → attribute to the most recent valid visit's creator.
   source = REFERRAL_VISIT.
3. Else → no attribution. Order proceeds as a direct/organic sale (creatorId null on
   Attribution is not modeled — instead, no Attribution row is written at all, and the
   order is simply absent from creator-driven revenue in analytics).
4. If the promo code's creator and the latest valid visit's creator differ, the promo
   code wins (rule 1 already covers this since it's checked first) — this is the only
   tie-break the system needs, but it is asserted explicitly in tests because it is easy
   to get backwards when a codebase changes the check order later.
```

Default `attributionWindowDays` is 30, overridable per-Campaign (`Campaign.attributionWindowDays`,
copied onto `ReferralLink.attributionWindowDays` and `ReferralVisit.expiresAt` at write time so a
later campaign edit never changes the expiry of visits already recorded).

## Server-side visitor identity

A `visitorId` is minted server-side on first landing-page hit (signed, stored both as an
HttpOnly cookie **and** returned to the client) specifically so attribution does not silently
break when a browser blocks third-party or even first-party cookies — the checkout call sends
`visitorId` explicitly as part of the order payload, sourced from whichever the client still has
(cookie or a same-origin `localStorage` fallback written from the returned value). Cookie
presence is never a hard requirement for attribution to function; it is a convenience carrier for
an ID the server already generated and is willing to look up by other means the client provides.

## Fraud / integrity checks (advisory flags, not silent blocks)

Written to `Attribution.fraudRiskFlags` and `Order.fraudRiskFlags`, surfaced in
`/admin/orders` and `/admin/visitors` for manual review — the system never auto-rejects an
order on these, because false positives (e.g. a creator legitimately buying their own product
as a gift) are common enough that auto-rejection would create support burden:

- `SELF_REFERRAL` — the resolved creator's own contact info (phone/email/known payout details)
  matches the order's customer.
- `SHARED_IP` — the same `ipHash` produced orders attributed to multiple different creators
  within a short window.
- `SHARED_PAYMENT_INSTRUMENT` — same card/account used across orders attributed to different
  creators.
- `HIGH_VELOCITY` — unusually high order count from one visitorId/ipHash in a short window.

## Manual override

Only permitted with an explicit `attribution.manual_override` permission. Requires
`manualById` and `manualReason`; always paired with an `AuditLog` row
(`action: "attribution.manual_override"`, `before`/`after` snapshots of the Attribution row).
An order's attribution can be corrected exactly once at a time — the audit log is the history,
the `Attribution` row is always the current truth.

## Refund/cancellation interaction

A `CANCELLED` order's Attribution row still exists (for audit purposes) but the
`CommissionsModule` never reads a commission into `PAYABLE` for it — commission creation itself
is skipped for orders that never reach a paid state, and refunds after a paid state trigger a
`REVERSAL` ledger entry (see COMMISSION.md) rather than deleting the Attribution.
