"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, Skeleton, StatusBadge } from "@sofsavdo/ui";
import { formatMoneyMinor } from "@sofsavdo/types";
import { getMyOrders } from "@/lib/api/buyer-real";
import { useBuyerSession } from "@/services/buyerSession";
import { realOrderStatusMeta } from "@/lib/status";

export default function BuyerDashboardPage() {
  const { user } = useBuyerSession();
  const ordersQuery = useQuery({ queryKey: ["buyer-orders"], queryFn: getMyOrders });

  const orders = ordersQuery.data ?? [];
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Xush kelibsiz, {user?.displayName ?? user?.email}</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">Buyurtmalaringiz va hisobingiz haqida umumiy ma&apos;lumot.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="font-body text-sm text-text-secondary">Jami buyurtmalar</p>
          <p className="mt-1 font-numeric text-3xl font-bold tabular-nums text-text-primary">
            {ordersQuery.isLoading ? <Skeleton className="h-8 w-16" /> : orders.length}
          </p>
        </Card>
        <Card>
          <p className="font-body text-sm text-text-secondary">Yetkazilgan buyurtmalar</p>
          <p className="mt-1 font-numeric text-3xl font-bold tabular-nums text-text-primary">
            {ordersQuery.isLoading ? <Skeleton className="h-8 w-16" /> : orders.filter((o) => o.status === "DELIVERED").length}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>So&apos;nggi buyurtmalar</CardTitle>
        </CardHeader>
        {ordersQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : recentOrders.length === 0 ? (
          <p className="font-body text-sm text-text-muted">Hozircha buyurtmalar yo&apos;q.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {recentOrders.map((o) => (
              <Link key={o.id} href={`/buyer/orders/${o.id}`} className="flex items-center justify-between py-3 hover:bg-bg">
                <div>
                  <p className="font-body text-sm font-medium text-text-primary">{o.offerName}</p>
                  <p className="font-body text-xs text-text-muted">{new Date(o.createdAt).toLocaleDateString("uz-UZ")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-numeric text-sm tabular-nums text-text-primary">{formatMoneyMinor(o.totalMinor, o.currency)}</span>
                  <StatusBadge tone={realOrderStatusMeta[o.status as keyof typeof realOrderStatusMeta].tone} label={realOrderStatusMeta[o.status as keyof typeof realOrderStatusMeta].label} />
                </div>
              </Link>
            ))}
          </div>
        )}
        <Link href="/buyer/orders" className="mt-4 inline-block font-body text-sm text-accent underline">
          Barcha buyurtmalarni ko&apos;rish
        </Link>
      </Card>
    </div>
  );
}
