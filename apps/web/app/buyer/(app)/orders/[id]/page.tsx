"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, Skeleton, StatusBadge } from "@sofsavdo/ui";
import { formatMoneyMinor } from "@sofsavdo/types";
import { getMyOrder } from "@/lib/api/buyer-real";
import { realOrderStatusMeta } from "@/lib/status";

export default function BuyerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orderQuery = useQuery({ queryKey: ["buyer-order", id], queryFn: () => getMyOrder(id) });

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const order = orderQuery.data;
  if (!order) {
    return <p className="font-body text-sm text-text-muted">Buyurtma topilmadi.</p>;
  }

  const statusMeta = realOrderStatusMeta[order.status as keyof typeof realOrderStatusMeta];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/buyer/orders" className="flex w-fit items-center gap-1.5 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Buyurtmalarga qaytish
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-text-primary">{order.offer.name}</h1>
        <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Mahsulotlar</CardTitle>
        </CardHeader>
        <div className="flex flex-col divide-y divide-border">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2">
              <span className="font-body text-sm text-text-primary">
                {item.nameSnapshot} &times; {item.quantity}
              </span>
              <span className="font-numeric text-sm tabular-nums text-text-secondary">{formatMoneyMinor(item.totalMinor, order.currency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 font-body text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>Mahsulotlar summasi</span>
            <span className="font-numeric tabular-nums">{formatMoneyMinor(order.subtotalMinor, order.currency)}</span>
          </div>
          {order.discountMinor > 0 ? (
            <div className="flex justify-between text-text-secondary">
              <span>Chegirma</span>
              <span className="font-numeric tabular-nums">-{formatMoneyMinor(order.discountMinor, order.currency)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-text-secondary">
            <span>Yetkazib berish</span>
            <span className="font-numeric tabular-nums">{formatMoneyMinor(order.shippingMinor, order.currency)}</span>
          </div>
          <div className="flex justify-between font-semibold text-text-primary">
            <span>Jami</span>
            <span className="font-numeric tabular-nums">{formatMoneyMinor(order.totalMinor, order.currency)}</span>
          </div>
        </div>
      </Card>

      {order.address ? (
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Yetkazib berish manzili</CardTitle>
          </CardHeader>
          <p className="font-body text-sm text-text-secondary">
            {order.address.region}, {order.address.city}
            {order.address.district ? `, ${order.address.district}` : ""}, {order.address.line1}
          </p>
          {order.address.comment ? <p className="mt-1 font-body text-xs text-text-muted">{order.address.comment}</p> : null}
        </Card>
      ) : null}

      {order.payment ? (
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>To&apos;lov</CardTitle>
          </CardHeader>
          <p className="font-body text-sm text-text-secondary">
            {order.payment.provider} — {order.payment.status}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
