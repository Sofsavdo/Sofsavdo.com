"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton, StatusBadge } from "@sofsavdo/ui";
import { formatMoneyMinor } from "@sofsavdo/types";
import { getMyOrders } from "@/lib/api/buyer-real";
import { realOrderStatusMeta } from "@/lib/status";

export default function BuyerOrdersPage() {
  const ordersQuery = useQuery({ queryKey: ["buyer-orders"], queryFn: getMyOrders });
  const orders = ordersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Buyurtmalar</h1>

      {ordersQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <p className="font-body text-sm text-text-muted">Hozircha buyurtmalar yo&apos;q.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/buyer/orders/${o.id}`}>
              <Card className="transition-shadow hover:shadow-elevated">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body font-medium text-text-primary">{o.offerName}</p>
                    <p className="mt-0.5 font-body text-xs text-text-muted">{new Date(o.createdAt).toLocaleDateString("uz-UZ")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-numeric text-sm font-semibold tabular-nums text-text-primary">
                      {formatMoneyMinor(o.totalMinor, o.currency)}
                    </span>
                    <StatusBadge
                      tone={realOrderStatusMeta[o.status as keyof typeof realOrderStatusMeta].tone}
                      label={realOrderStatusMeta[o.status as keyof typeof realOrderStatusMeta].label}
                    />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
