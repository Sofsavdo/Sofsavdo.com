// Payment method display metadata for the checkout selector. Keyed by the same string values
// Offer.paymentOptions/create-checkout.dto.ts already use (CLICK/PAYME/CARD/COD/PAY_LATER) — this
// file only adds *display* structure on top, it does not change which methods are actually
// selectable for a given offer (that stays offer.paymentOptions, read verbatim in
// CheckoutPageClient). Click is a brand name and must never be translated.
export type PaymentMethodCategory = "ONLINE" | "CASH_ON_DELIVERY" | "INSTALLMENT";

export interface PaymentMethodMeta {
  /** The exact string value used in Offer.paymentOptions / the checkout paymentMethod field. */
  id: string;
  category: PaymentMethodCategory;
  /** Brand or plain-language name, shown as-is — never translated for a brand name (Click). */
  displayName: string;
  /** Short Uzbek description shown under the name. */
  description: string;
  /** Optional logo URL/src. Left unset for every method today; the selector renders an emoji/initial
   *  fallback in its place so a logo can be added later without touching the layout. */
  logo?: string;
}

// CLICK and COD (Phase F) are the two providers with a real adapter in PaymentsModule's registry
// today; PAYME/CARD still only create an order/request with no adapter behind them at all (see
// OrdersService.resolvePaymentProvider) — QuickProductLaunchForm deliberately excludes both from
// the payment options it sets on a new Offer, so they should never actually reach a buyer.
export const PAYMENT_METHOD_CATALOG: Record<string, PaymentMethodMeta> = {
  CLICK: { id: "CLICK", category: "ONLINE", displayName: "Click", description: "Hozir onlayn to'lang" },
  PAYME: { id: "PAYME", category: "ONLINE", displayName: "Payme", description: "Onlayn to'lov" },
  CARD: { id: "CARD", category: "ONLINE", displayName: "Bank kartasi", description: "Onlayn to'lov" },
  COD: { id: "COD", category: "CASH_ON_DELIVERY", displayName: "Naqd pul", description: "Yetkazib berilganda naqd to'lang" },
  // Single installment option, deliberately worded as one plain choice ("12 months") rather than
  // a specific provider name — Uzum Nasiya was never wired to a real adapter and never appears on
  // any real Offer, so it's not in this catalog at all; if that changes, it must still present as
  // this same one tile, never a second, separate installment button next to this one.
  PAY_LATER: { id: "PAY_LATER", category: "INSTALLMENT", displayName: "Bo'lib to'lash", description: "12 oyga bo'lib to'lang" },
};

export function resolvePaymentMethodMeta(id: string): PaymentMethodMeta {
  return PAYMENT_METHOD_CATALOG[id] ?? { id, category: "ONLINE", displayName: id, description: "" };
}
