# Legal & User-Facing Requirements Audit

Phase 14 §16 audit — where the UI needs Terms of Service, Privacy Policy, Refund Policy, a
payment explanation, a creator agreement, campaign rules acknowledgment, consent checkboxes, and
support contact info. **Nothing in this file is legal advice** — the draft pages this audit created
are structural placeholders only (section headers, no invented clauses), and every one of them
needs real review by local (Uzbekistan) legal counsel before a real launch.

## What was built this pass

Three draft placeholder pages, each carrying an unmissable "DRAFT — not legal advice" banner
(`src/components/legal/LegalDraftPage.tsx`):
- `/legal/terms` — Foydalanish shartlari (Terms of Service)
- `/legal/privacy` — Maxfiylik siyosati (Privacy Policy)
- `/legal/refund-policy` — Qaytarish siyosati (Refund Policy)

The public offer landing page's footer (`OfferLandingPageClient.tsx`) already had the literal
words "Shartlar · Maxfiylik · Qaytarish siyosati" — as **plain text with no links** — confirming
these were always intended to exist. That footer now links to the three real pages above, and its
support email is now a real `mailto:` link instead of plain text.

## Confirmed gaps — not fixed this pass (product decisions, not doc-writing)

Building real consent UI (a required checkbox, a blocking validation rule) is a product/UX
decision with real legal weight — not something to bolt on silently alongside a documentation
pass. Flagged here for a deliberate decision, with exact locations:

1. **Checkout has no ToS/Privacy Policy links, no consent checkbox, and no payment explanation.**
   `CheckoutPageClient.tsx`'s form goes straight from delivery/payment-method fields to a submit
   button — a customer can place a real order and pay real money with zero acknowledgment of any
   policy. At minimum, before real launch: add visible ToS/Privacy/Refund Policy links near the
   submit button, and consider whether an explicit "I agree" checkbox is legally required for this
   jurisdiction (that's a question for local counsel, not an engineering default).
2. **Creator registration has no consent checkbox.** `app/creator/(auth)/register/page.tsx`
   collects name/email/password with no ToS/Privacy acknowledgment at all.
3. **No creator agreement exists anywhere.** Creators go through onboarding
   (`/creator/onboarding`) and campaign applications without ever seeing or accepting a creator-
   specific agreement (commission terms, content rights, code-of-conduct, termination conditions).
   This is arguably the single highest-value document to get real legal review on, since it's the
   contract governing the money relationship between Rosti and every creator.
4. **No campaign-specific rules acknowledgment.** A creator applying to a campaign
   (`/creator/campaigns/[id]`) sees the campaign's commission/media requirements but never
   explicitly accepts them as binding.
5. **No payment explanation on checkout.** Nothing tells the customer which entity actually
   processes their card (Click.uz), what happens on a failed payment, or how a refund is initiated
   — all real behavior the code already implements, just never surfaced as customer-facing copy.

## What requires real local legal review before launch

- The three draft pages above — currently empty section headers, not usable as-is.
- A real creator agreement (see gap #3) — does not exist in any form yet, draft or otherwise.
- Whether Uzbek law requires an explicit opt-in consent checkbox at checkout/registration, or
  whether a footer link satisfies notice requirements — jurisdiction-specific, not an engineering
  judgment call.
- Data retention/deletion obligations for customer PII and financial records (see
  BACKUP_RESTORE.md's "Data retention" section) — tax/accounting law may set a *minimum* retention
  period for financial records that conflicts with a "delete on request" privacy expectation;
  reconciling that is a legal question.
- Click.uz's own merchant agreement terms — confirm Rosti's own ToS/refund policy doesn't
  contradict whatever Rosti agreed to as a Click merchant.

## Support contact info

`support@rosti.uz` appears on the order-success page and (now) the landing page footer. No other
support channel (phone, Telegram, live chat) exists in the UI. Confirm this is the actual, monitored
support channel before launch — a placeholder email that nobody checks is worse than no email, since
customers will believe it works.
