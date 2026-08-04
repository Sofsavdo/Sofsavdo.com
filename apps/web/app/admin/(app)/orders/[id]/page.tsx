"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { OrderStatus, RealOrderStatus } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatusBadge, TextAreaField } from "@sofsavdo/ui";
import { useAdminOrder, useUpdateOrderNotes, useUpdateOrderStatus, useCreateRefund } from "@/services/admin/orders";
import { useOrderReviewDetail, useUpdateRealOrderStatus, useUpdateRealOrderNotes, useCreateRealOrderRefund } from "@/services/admin/orders";
import { useAdminCommissions } from "@/services/admin/finance";
import { orderStatusMeta, realOrderStatusMeta, commissionStatusMeta, paymentProviderMeta, paymentStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

// Mirrors OrdersService.TRANSITIONS, minus REFUNDED — the backend's adminUpdateStatus rejects a
// bare status flip to REFUNDED (it would skip the Refund record and stock release), so it's never
// offered as a quick-transition button; "Refund yaratish" (canRefund below) is the only path to it.
const REAL_NEXT_STATUSES: Record<RealOrderStatus, RealOrderStatus[]> = {
  CREATED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

function RealOrderDetailPage({ id }: { id: string }) {
  const orderQuery = useOrderReviewDetail(id);
  const updateStatus = useUpdateRealOrderStatus();
  const updateNotes = useUpdateRealOrderNotes();
  const createRefund = useCreateRealOrderRefund();

  const [notes, setNotes] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const order = orderQuery.data;
  if (!order) return <Alert tone="error">Buyurtma topilmadi.</Alert>;

  const nextStatuses = REAL_NEXT_STATUSES[order.status];
  const canRefund = ["PAID", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(order.status);

  const paymentProviderLabel = order.payment ? (paymentProviderMeta[order.payment.provider] ?? order.payment.provider) : "—";
  const paymentStatusLabel = order.payment ? (paymentStatusMeta[order.payment.status]?.label ?? order.payment.status) : "To'lanmagan";
  const addressLine = order.address
    ? [order.address.region, order.address.city, order.address.line1].filter(Boolean).join(", ") || "—"
    : "—";

  return (
    <>
      {/* Print-only summary — `window.print()` used to print this entire admin page (sidebar,
          buttons, internal notes editor and all) with zero way to limit it. This is the only
          thing visible when printing (see the `print:hidden` on the real page content below):
          just what a courier/admin actually needs on paper. */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{order.offer.name}</h1>
        <p className="mt-1 text-sm">Buyurtma #{order.publicToken}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between border-b py-1">
            <dt>Mijoz</dt>
            <dd>{order.customer.fullName}</dd>
          </div>
          <div className="flex justify-between border-b py-1">
            <dt>Telefon</dt>
            <dd>{order.customer.phone}</dd>
          </div>
          <div className="flex justify-between border-b py-1">
            <dt>Manzil</dt>
            <dd>{addressLine}</dd>
          </div>
          <div className="flex justify-between border-b py-1">
            <dt>Jami summa</dt>
            <dd>{formatMoneyMinor(order.totalMinor, order.currency)}</dd>
          </div>
          <div className="flex justify-between border-b py-1">
            <dt>To&apos;lov usuli</dt>
            <dd>{paymentProviderLabel}</dd>
          </div>
          <div className="flex justify-between border-b py-1">
            <dt>To&apos;lov holati</dt>
            <dd>{paymentStatusLabel}</dd>
          </div>
        </dl>
      </div>

    <div className="space-y-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {order.offer.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage-driver-dependent host
            <img src={order.offer.imageUrl} alt="" className="size-14 shrink-0 rounded-input object-cover" />
          ) : null}
          <div>
            <h1 className="font-heading text-2xl font-bold text-text-primary">{order.offer.name}</h1>
            <p className="font-body text-sm text-text-muted">#{order.publicToken}</p>
          </div>
        </div>
        <StatusBadge tone={realOrderStatusMeta[order.status].tone} label={realOrderStatusMeta[order.status].label} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Offer / narx snapshot</CardTitle>
          </CardHeader>
          <dl className="space-y-2 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Turi</dt>
              <dd className="text-text-primary">{order.type}</dd>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <dt className="text-text-muted">{item.nameSnapshot}</dt>
                <dd className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(item.unitPriceMinor, order.currency)}</dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt className="text-text-muted">Chegirma</dt>
              <dd className="font-numeric tabular-nums text-success">−{formatMoneyMinor(order.discountMinor, order.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Yetkazib berish</dt>
              <dd className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(order.shippingMinor, order.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <dt className="text-text-primary">Jami</dt>
              <dd className="font-numeric text-lg tabular-nums text-text-primary">{formatMoneyMinor(order.totalMinor, order.currency)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manba / Creator</CardTitle>
          </CardHeader>
          {order.attribution ? (
            <dl className="space-y-2 font-body text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Manba</dt>
                <dd className="text-text-primary">{order.attribution.source === "PROMO_CODE" ? "Promo kod" : "Referral link"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Campaign</dt>
                <dd className="text-text-primary">{order.campaign?.name ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="font-body text-sm text-text-muted">Direct sotuv — creatorga bog&apos;lanmagan.</p>
          )}

          {order.commission ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 font-body text-xs font-medium text-text-muted">Commission snapshot</p>
              <div className="flex items-center justify-between font-body text-sm">
                <span className="text-text-primary">
                  {order.commission.creatorName} — {formatMoneyMinor(order.commission.amountMinor, order.currency)}
                </span>
                <Badge tone={(commissionStatusMeta[order.commission.status as keyof typeof commissionStatusMeta]?.tone) ?? "neutral"}>
                  {commissionStatusMeta[order.commission.status as keyof typeof commissionStatusMeta]?.label ?? order.commission.status}
                </Badge>
              </div>
              {order.status === "CANCELLED" || order.status === "REFUNDED" ? (
                <Alert tone="warning" className="mt-2">
                  Bu buyurtma {order.status === "CANCELLED" ? "bekor qilingan" : "pul qaytarilgan"}.
                </Alert>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lov va Yetkazib berish</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 font-body text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Mijoz</dt>
            <dd className="text-text-primary">{order.customer.fullName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Telefon</dt>
            <dd className="text-text-primary">
              <a href={`tel:${order.customer.phone}`} className="text-accent hover:underline">
                {order.customer.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">To&apos;lov usuli</dt>
            <dd className="text-text-primary">{order.payment ? (paymentProviderMeta[order.payment.provider] ?? order.payment.provider) : "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">To&apos;lov holati</dt>
            <dd className="text-text-primary">
              {order.payment ? (paymentStatusMeta[order.payment.status]?.label ?? order.payment.status) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Jami summa</dt>
            <dd className="font-numeric tabular-nums text-text-primary">{formatMoneyMinor(order.totalMinor, order.currency)}</dd>
          </div>
        </dl>
        {order.type === "PHYSICAL" && order.address ? (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 font-body text-xs font-medium text-text-muted">Yetkazib berish manzili</p>
            <p className="font-body text-sm text-text-primary">
              {order.address.region && <>{order.address.region}, </>}
              {order.address.city && <>{order.address.city}, </>}
              {order.address.line1}
            </p>
          </div>
        ) : null}
        {order.address?.comment ? (
          <div className="mt-2">
            <p className="mb-1 font-body text-xs font-medium text-text-muted">Mijoz izohi</p>
            <p className="font-body text-sm text-text-primary">{order.address.comment}</p>
          </div>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={() => window.print()}
        >
          Chop etish
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status tarixi</CardTitle>
        </CardHeader>
        <ul className="space-y-1.5 font-body text-sm">
          {order.statusHistory.map((h, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-text-primary">
                {realOrderStatusMeta[h.toStatus].label} {h.note ? `— ${h.note}` : ""}
              </span>
              <span className="text-xs text-text-muted">{new Date(h.createdAt).toLocaleString("uz-UZ")}</span>
            </li>
          ))}
        </ul>

        {nextStatuses.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {nextStatuses.map((s) => (
              <Button key={s} size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: order.id, status: s })}>
                → {realOrderStatusMeta[s].label}
              </Button>
            ))}
          </div>
        ) : null}
        {updateStatus.isError ? (
          <Alert tone="error" className="mt-2">
            {(updateStatus.error as ApiError).message}
          </Alert>
        ) : null}

        {canRefund ? (
          <Button variant="outline" size="sm" className="mt-3 border-error text-error" onClick={() => setRefundModal(true)}>
            Refund yaratish
          </Button>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ichki izohlar</CardTitle>
        </CardHeader>
        <TextAreaField label="" value={notes ?? order.notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-fit"
          onClick={() => notes !== null && updateNotes.mutate({ id: order.id, notes })}
          disabled={updateNotes.isPending || notes === null}
        >
          Saqlash
        </Button>
      </Card>

      <ConfirmModal
        open={refundModal}
        onClose={() => setRefundModal(false)}
        title="Refund yaratish"
        description={`Jami to'lov: ${formatMoneyMinor(order.totalMinor, order.currency)}.`}
        requireReason
        reasonLabel="Refund sababi"
        destructive
        isPending={createRefund.isPending}
        error={createRefund.isError ? (createRefund.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!reason) return;
          const amount = refundAmount ? Math.round(Number(refundAmount) * 100) : order.totalMinor;
          await createRefund.mutateAsync({ id: order.id, amountMinor: amount, reason });
          setRefundModal(false);
        }}
      >
        <input
          value={refundAmount}
          onChange={(e) => setRefundAmount(e.target.value)}
          placeholder={`To'liq: ${(order.totalMinor / 100).toLocaleString("uz-UZ")}`}
          className="mt-2 h-9 w-full rounded-input border border-border bg-surface px-3 font-body text-sm"
        />
      </ConfirmModal>
    </div>
    </>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RealOrderDetailPage id={id} />;
}
