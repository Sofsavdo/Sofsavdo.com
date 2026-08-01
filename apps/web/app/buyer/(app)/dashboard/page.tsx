"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from "@/components/simplified/simplified-card";
import { SimplifiedLoading } from "@/components/simplified/simplified-loading";
import { SimplifiedBadge } from "@/components/simplified/simplified-badge";
import { formatMoneyMinor } from "@sofsavdo/types";
import { getMyOrders } from "@/lib/api/buyer-real";
import { useBuyerSession } from "@/services/buyerSession";
import { realOrderStatusMeta } from "@/lib/status";

export default function BuyerDashboardPage() {
  const { user } = useBuyerSession();
  const ordersQuery = useQuery({ queryKey: ["buyer-orders"], queryFn: getMyOrders });

  const orders = ordersQuery.data ?? [];
  const recentOrders = orders.slice(0, 5);

  if (ordersQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedLoading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Xush kelibsiz, {user?.displayName ?? user?.email}</h1>
              <p className="text-sm text-gray-600 mt-1">Buyurtmalaringiz va hisobingiz haqida umumiy ma'lumot.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Jami buyurtmalar</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{orders.length}</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Yetkazilgan buyurtmalar</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{orders.filter((o) => o.status === "DELIVERED").length}</p>
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>

          {/* Recent Orders */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>So'nggi buyurtmalar</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              {recentOrders.length === 0 ? (
                <p className="text-center text-gray-600 py-8">Hozircha buyurtmalar yo'q.</p>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((o) => (
                    <Link key={o.id} href={`/buyer/orders/${o.id}`} className="block">
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
                        <div>
                          <p className="font-medium text-gray-900">{o.offerName}</p>
                          <p className="text-sm text-gray-600 mt-1">{new Date(o.createdAt).toLocaleDateString("uz-UZ")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{formatMoneyMinor(o.totalMinor, o.currency)}</span>
                          <SimplifiedBadge variant={realOrderStatusMeta[o.status as keyof typeof realOrderStatusMeta].tone === 'success' ? 'success' : 'neutral'}>
                            {realOrderStatusMeta[o.status as keyof typeof realOrderStatusMeta].label}
                          </SimplifiedBadge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/buyer/orders" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
                Barcha buyurtmalarni ko'rish
              </Link>
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
      </div>
    </div>
  );
}
