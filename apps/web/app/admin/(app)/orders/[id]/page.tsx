"use client";

import { use, useState } from "react";
import Link from "next/link";
import type { OrderStatus, RealOrderStatus } from "@rosti/types";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatusBadge, TextAreaField } from "@rosti/ui";
import { useAdminOrder, useUpdateOrderNotes, useUpdateOrderStatus, useCreateRefund } from "@/services/admin/orders";
import { useOrderReviewDetail, useUpdateRealOrderStatus, useUpdateRealOrderNotes, useCreateRealOrderRefund } from "@/services/admin/orders";
import { useAdminCommissions } from "@/services/admin/finance";
import { orderStatusMeta, realOrderStatusMeta } from "@/lib/status";
import { ApiError } from "@/lib/api/admin";

const USE_REAL_API = process.env.NEXT_PUBLIC_API_MODE === "real";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{order.offer.name}</h1>
          <p className="font-body text-sm text-text-muted">#{order.publicToken}</p>
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
            <CardTitle>Attribution / Creator</CardTitle>
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
                <Badge tone="neutral">{order.commission.status}</Badge>
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
          <CardTitle>To&apos;lov</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 font-body text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Usul</dt>
            <dd className="text-text-primary">{order.payment?.provider ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Holat</dt>
            <dd className="text-text-primary">{order.payment?.status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Mijoz</dt>
            <dd className="text-text-primary">{order.customer.fullName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Telefon</dt>
            <dd className="text-text-primary">{order.customer.phone}</dd>
          </div>
        </dl>
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
  );
}

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "COMPLETED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["COMPLETED", "RETURNED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
};

function MockOrderDetailPage({ id }: { id: string }) {
  const orderQuery = useAdminOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const updateNotes = useUpdateOrderNotes();
  const createRefund = useCreateRefund();
  const commissionsQuery = useAdminCommissions();

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

  const commission = commissionsQuery.data?.find((c) => c.orderId === order.id);
  const nextStatuses = NEXT_STATUSES[order.status];
  const canRefund = order.status === "COMPLETED" || order.status === "DELIVERED" || order.status === "RETURNED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{order.offerName}</h1>
          <p className="font-body text-sm text-text-muted">#{order.publicToken}</p>
        </div>
        <StatusBadge tone={orderStatusMeta[order.status].tone} label={orderStatusMeta[order.status].label} />
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
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <dt className="text-text-muted">{item.variantName}</dt>
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
            <CardTitle>Attribution / Creator</CardTitle>
          </CardHeader>
          {order.attributedCreatorName ? (
            <dl className="space-y-2 font-body text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Creator</dt>
                <dd className="text-text-primary">{order.attributedCreatorName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Manba</dt>
                <dd className="text-text-primary">{order.attributionSource === "PROMO_CODE" ? "Promo kod" : "Referral link"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Campaign</dt>
                <dd className="text-text-primary">{order.campaignName ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="font-body text-sm text-text-muted">Direct sotuv — creatorga bog&apos;lanmagan.</p>
          )}

          {commission ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 font-body text-xs font-medium text-text-muted">Commission snapshot</p>
              <div className="flex items-center justify-between font-body text-sm">
                <Link href="/admin/commissions" className="text-accent underline">
                  {formatMoneyMinor(commission.amountMinor, order.currency)}
                </Link>
                <Badge tone="neutral">{commission.status}</Badge>
              </div>
              {order.status === "CANCELLED" || order.status === "REFUNDED" ? (
                <Alert tone="warning" className="mt-2">
                  Bu buyurtma {order.status === "CANCELLED" ? "bekor qilingan" : "pul qaytarilgan"} — komissiya{" "}
                  {order.status === "CANCELLED" ? "rad etildi" : "REVERSAL yozuvi bilan bekor qilindi"}.
                </Alert>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>To&apos;lov</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 font-body text-sm sm:grid-cols-4">
          <div>
            <dt className="text-text-muted">Usul</dt>
            <dd className="text-text-primary">{order.paymentMethod}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Holat</dt>
            <dd className="text-text-primary">{order.paymentStatus}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Mijoz</dt>
            <dd className="text-text-primary">{order.customer.fullName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Telefon</dt>
            <dd className="text-text-primary">{order.customer.phone}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status tarixi</CardTitle>
        </CardHeader>
        <ul className="space-y-1.5 font-body text-sm">
          {order.statusHistory.map((h, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-text-primary">
                {orderStatusMeta[h.status].label} {h.note ? `— ${h.note}` : ""}
              </span>
              <span className="text-xs text-text-muted">{new Date(h.at).toLocaleString("uz-UZ")}</span>
            </li>
          ))}
        </ul>

        {nextStatuses.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {nextStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: order.id, status: s })}
              >
                → {orderStatusMeta[s].label}
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
        <TextAreaField label="" value={notes ?? order.internalNotes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-fit"
          onClick={() => notes !== null && updateNotes.mutate({ id: order.id, internalNotes: notes })}
          disabled={updateNotes.isPending || notes === null}
        >
          Saqlash
        </Button>
      </Card>

      <ConfirmModal
        open={refundModal}
        onClose={() => setRefundModal(false)}
        title="Refund yaratish"
        description={`Jami to'lov: ${formatMoneyMinor(order.totalMinor, order.currency)}. Bu amal commission uchun REVERSAL yozuvi yaratadi.`}
        requireReason
        reasonLabel="Refund sababi"
        destructive
        isPending={createRefund.isPending}
        error={createRefund.isError ? (createRefund.error as ApiError).message : null}
        onConfirm={async (reason) => {
          if (!reason) return;
          const amount = refundAmount ? Math.round(Number(refundAmount) * 100) : order.totalMinor;
          await createRefund.mutateAsync({ orderId: order.id, amountMinor: amount, reason, isPartial: amount < order.totalMinor });
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
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return USE_REAL_API ? <RealOrderDetailPage id={id} /> : <MockOrderDetailPage id={id} />;
}
