"use client";

import { use } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Card, CardHeader, CardTitle, Skeleton } from "@sofsavdo/ui";
import { ArrowLeft } from "lucide-react";
import { useRealPaymentDetail, useRealPaymentTimeline } from "@/services/admin/orders";

const STATUS_TONE: Record<string, "success" | "info" | "error" | "neutral"> = {
  PAID: "success",
  PROCESSING: "info",
  PENDING: "neutral",
  FAILED: "error",
  CANCELLED: "neutral",
  REFUNDED: "error",
};

function PaymentDetailContent({ id }: { id: string }) {
  const query = useRealPaymentDetail(id);
  const timelineQuery = useRealPaymentTimeline(id);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const payment = query.data;
  if (!payment) return <Alert tone="error">To&apos;lov topilmadi.</Alert>;

  return (
    <div className="space-y-6">
      <Link href="/admin/payments" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">{payment.order.offerName}</h1>
          <p className="font-body text-sm text-text-muted">
            {payment.order.customerName} · {payment.order.customerPhone}
          </p>
        </div>
        <Badge tone={STATUS_TONE[payment.status] ?? "neutral"}>{payment.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lov ma&apos;lumotlari</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 font-body text-sm">
          <div>
            <dt className="text-text-muted">Provider</dt>
            <dd className="text-text-primary">{payment.provider}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Summa</dt>
            <dd className="text-text-primary">{formatMoneyMinor(payment.amountMinor, payment.currency)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Provider reference</dt>
            <dd className="text-text-primary">{payment.providerReference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Buyurtma</dt>
            <dd className="text-text-primary">#{payment.order.publicToken}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lov tarixi</CardTitle>
        </CardHeader>
        {(timelineQuery.data ?? []).length === 0 ? (
          <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
        ) : (
          <ul className="space-y-3">
            {(timelineQuery.data ?? []).map((entry, i) => (
              <li key={i} className="border-b border-border pb-3 last:border-none last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm font-medium text-text-primary">{entry.label}</span>
                  <span className="font-body text-xs text-text-muted">{new Date(entry.at).toLocaleString("uz-UZ")}</span>
                </div>
                {entry.detail ? <pre className="mt-1 overflow-x-auto rounded-input bg-bg p-2 font-numeric text-xs text-text-secondary">{JSON.stringify(entry.detail, null, 2)}</pre> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PaymentDetailContent id={id} />;
}
