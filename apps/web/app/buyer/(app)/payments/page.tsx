"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton, Badge } from "@sofsavdo/ui";
import { formatMoneyMinor } from "@sofsavdo/types";
import { getMyOrders } from "@/lib/api/buyer-real";

export default function BuyerPaymentsPage() {
  const ordersQuery = useQuery({ queryKey: ["buyer-orders"], queryFn: getMyOrders });
  const withPayments = (ordersQuery.data ?? []).filter((o) => o.payment != null);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold text-text-primary">To&apos;lovlar tarixi</h1>

      {ordersQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : withPayments.length === 0 ? (
        <Card>
          <p className="font-body text-sm text-text-muted">Hozircha to&apos;lovlar yo&apos;q.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {withPayments.map((o) => (
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
                    <Badge tone={o.payment?.status === "PAID" ? "success" : "neutral"}>
                      {o.payment?.provider} — {o.payment?.status}
                    </Badge>
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
