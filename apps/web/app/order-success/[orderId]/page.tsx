"use client";

import { use } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Card, CardHeader, CardTitle, Skeleton } from "@sofsavdo/ui";
import { BRAND } from "@sofsavdo/config/brand";
import { CheckCircle2 } from "lucide-react";
import { useOrderPublic } from "@/services/offer";

const PAYMENT_RESULT_LABELS: Record<string, string> = {
  PAYMENT_PENDING: "To'lov kutilmoqda",
  PAID: "To'landi",
  PROCESSING: "Tayyorlanmoqda",
  SHIPPED: "Jo'natildi",
  IN_TRANSIT: "Yo'lda",
  DELIVERED: "Yetkazildi",
  CANCELLED: "Bekor qilindi",
  REFUNDED: "Qaytarildi",
};

export default function OrderSuccessPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const query = useOrderPublic(orderId);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-pad-mobile py-16 md:px-pad-desktop">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const order = query.data;
  const paymentResultLabel = order ? PAYMENT_RESULT_LABELS[(order as { status?: string }).status ?? ""] : undefined;
  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-pad-mobile py-20 text-center md:px-pad-desktop">
        <h1 className="font-heading text-xl font-bold text-text-primary">Buyurtma topilmadi</h1>
        <Link href="/" className="mt-3 inline-block font-body text-sm text-accent underline">
          Bosh sahifaga qaytish
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-pad-mobile py-16 md:px-pad-desktop">
      <div className="mb-6 flex flex-col items-center text-center">
        <CheckCircle2 className="size-12 text-success" />
        <h1 className="mt-3 font-heading text-2xl font-bold text-text-primary">Buyurtma qabul qilindi!</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">
          Buyurtma raqami: <strong>{order.publicToken}</strong>
        </p>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>{order.offerName}</CardTitle>
          <p className="font-body text-sm text-text-secondary">{order.variantName}</p>
        </CardHeader>
        <dl className="space-y-2 font-body text-sm">
          <div className="flex justify-between text-text-secondary">
            <dt>Mijoz</dt>
            <dd className="text-text-primary">{order.customer.fullName}</dd>
          </div>
          <div className="flex justify-between text-text-secondary">
            <dt>Telefon</dt>
            <dd className="text-text-primary">{order.customer.phone}</dd>
          </div>
          {order.discountMinor > 0 ? (
            <div className="flex justify-between text-success">
              <dt>Chegirma</dt>
              <dd>−{formatMoneyMinor(order.discountMinor, order.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-2 font-medium text-text-primary">
            <dt>Jami to&apos;lov</dt>
            <dd className="font-numeric text-lg tabular-nums">{formatMoneyMinor(order.totalMinor, order.currency)}</dd>
          </div>
          {paymentResultLabel ? (
            <div className="flex justify-between text-text-secondary">
              <dt>To&apos;lov holati</dt>
              <dd className="text-text-primary">{paymentResultLabel}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <p className="mt-6 text-center font-body text-xs text-text-muted">
        Savol yuzasidan Telegram: @{BRAND.supportTelegram} orqali murojaat qiling.
      </p>
    </div>
  );
}
