// Payment method display metadata for the checkout selector. Keyed by the same string values
// Offer.paymentOptions/create-checkout.dto.ts already use (CLICK/PAYME/CARD/COD/PAY_LATER) — this
// file only adds *display* structure on top, it does not change which methods are actually
// selectable for a given offer (that stays offer.paymentOptions, read verbatim in
// CheckoutPageClient). Click, Paylater, and Uzum Nasiya are brand names and must never be
// translated; only the category label and description are Uzbek copy.
export type PaymentMethodCategory = "ONLINE" | "CASH_ON_DELIVERY" | "INSTALLMENT";

export interface PaymentMethodMeta {
  /** The exact string value used in Offer.paymentOptions / the checkout paymentMethod field. */
  id: string;
  category: PaymentMethodCategory;
  /** Brand or plain-language name, shown as-is — never translated for brand names (Click, Paylater, Uzum Nasiya). */
  displayName: string;
  /** Short Uzbek description shown under the name. */
  description: string;
  /** Optional logo URL/src. Left unset for every method today; the selector renders an emoji/initial
   *  fallback in its place so a logo can be added later without touching the layout. */
  logo?: string;
}

export const PAYMENT_METHOD_CATEGORY_META: Record<PaymentMethodCategory, { icon: string; label: string }> = {
  ONLINE: { icon: "💳", label: "Online Payment" },
  CASH_ON_DELIVERY: { icon: "💵", label: "Cash on Delivery" },
  INSTALLMENT: { icon: "📅", label: "Installment Payment" },
};

// UZUM_NASIYA has a catalog entry (per the "future ready" requirement) even though no Offer
// selects it today — the moment an offer's paymentOptions includes it, it renders correctly with
// no further UI work.
//
// Descriptions for COD/PAY_LATER/UZUM_NASIYA deliberately say an operator contacts the customer
// to complete the arrangement — only CLICK is a real self-service online payment integration
// (see OrdersService.resolvePaymentProvider); the other three only create an order/request, so
// their copy must never imply the platform processes payment automatically.
export const PAYMENT_METHOD_CATALOG: Record<string, PaymentMethodMeta> = {
  CLICK: { id: "CLICK", category: "ONLINE", displayName: "Click", description: "Click orqali hozir onlayn to'lang." },
  PAYME: { id: "PAYME", category: "ONLINE", displayName: "Payme", description: "Onlayn to'lov" },
  CARD: { id: "CARD", category: "ONLINE", displayName: "Bank kartasi", description: "Onlayn to'lov" },
  COD: {
    id: "COD",
    category: "CASH_ON_DELIVERY",
    displayName: "Naqd to'lov",
    description: "Operator buyurtmani tasdiqlash uchun bog'lanadi. To'lov yetkazib berilganda amalga oshiriladi.",
  },
  PAY_LATER: {
    id: "PAY_LATER",
    category: "INSTALLMENT",
    displayName: "Paylater",
    description: "Muddatli to'lov uchun ariza qoldiring. Operator rasmiylashtirish uchun bog'lanadi.",
  },
  UZUM_NASIYA: {
    id: "UZUM_NASIYA",
    category: "INSTALLMENT",
    displayName: "Uzum Nasiya",
    description: "Muddatli to'lov uchun ariza qoldiring. Operator rasmiylashtirish uchun bog'lanadi.",
  },
};

const CATEGORY_ORDER: PaymentMethodCategory[] = ["ONLINE", "CASH_ON_DELIVERY", "INSTALLMENT"];

export function resolvePaymentMethodMeta(id: string): PaymentMethodMeta {
  return PAYMENT_METHOD_CATALOG[id] ?? { id, category: "ONLINE", displayName: id, description: "" };
}

/** Groups a flat list of offer-supported payment method ids into ordered category buckets, preserving each method's within-offer order. */
export function groupPaymentMethods(methodIds: string[]): Array<{ category: PaymentMethodCategory; methods: PaymentMethodMeta[] }> {
  const buckets = new Map<PaymentMethodCategory, PaymentMethodMeta[]>();
  for (const id of methodIds) {
    const meta = resolvePaymentMethodMeta(id);
    const bucket = buckets.get(meta.category) ?? [];
    bucket.push(meta);
    buckets.set(meta.category, bucket);
  }
  return CATEGORY_ORDER.filter((category) => buckets.has(category)).map((category) => ({
    category,
    methods: buckets.get(category)!,
  }));
}
