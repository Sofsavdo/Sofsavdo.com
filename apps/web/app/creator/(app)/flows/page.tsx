"use client";

import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton } from "@sofsavdo/ui";
import { useFlows, usePauseFlow, useActivateFlow, getReferralUrl } from "@/services/flows";
import { useSession } from "@/services/session";
import { canWorkAsCreator } from "@/lib/routing";

export default function FlowsPage() {
  const { user } = useSession();
  const approved = !!user && canWorkAsCreator(user.application.status);

  const flows = useFlows();
  const pauseFlow = usePauseFlow();
  const activateFlow = useActivateFlow();

  if (!approved) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Mening Oqimlarim</h1>
        <Alert tone="info">
          Arizangiz tasdiqlanmaguncha bu bo&apos;limga kirish imkonsiz.
        </Alert>
      </div>
    );
  }

  if (flows.isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Mening Oqimlarim</h1>
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const flowsList = flows.data?.flows ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Mening Oqimlarim</h1>

      {flowsList.length === 0 ? (
        <EmptyState

          title="Oqim yo'q"
          description="Hozircha sizda hech qanday oqim yo'q. Dashboarddan mahsulot tanlab oqim yarating."
          action={
            <Button asChild variant="outline">
              <a href="/creator/dashboard">Dashboardga o'tish</a>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flowsList.map((flow) => (
            <Card key={flow.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{flow.product.name}</CardTitle>
                    <p className="mt-1 font-body text-xs text-text-muted">
                      Komissiya:{" "}
                      {flow.product.commissionType === "PERCENTAGE"
                        ? `${(flow.product.commissionRateBps! / 100).toFixed(1)}%`
                        : formatMoneyMinor(flow.product.commissionAmountMinor!)}
                    </p>
                  </div>
                  <Badge tone={flow.status === "ACTIVE" ? "success" : "neutral"}>
                    {flow.status === "ACTIVE" ? "Faol" : "To'xtatilgan"}
                  </Badge>
                </div>
              </CardHeader>
              <div className="flex flex-1 flex-col gap-3 px-6 pb-6">
                {flow.product.images.length > 0 && (
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border">
                    <img
                      src={flow.product.images[0]}
                      alt={flow.product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-bg p-3">
                  <div className="text-center">
                    <p className="font-numeric text-lg font-semibold tabular-nums text-text-primary">
                      {flow.clickCount}
                    </p>
                    <p className="font-body text-xs text-text-muted">Click</p>
                  </div>
                  <div className="text-center">
                    <p className="font-numeric text-lg font-semibold tabular-nums text-text-primary">
                      {flow.orderCount}
                    </p>
                    <p className="font-body text-xs text-text-muted">Buyurtma</p>
                  </div>
                  <div className="text-center">
                    <p className="font-numeric text-lg font-semibold tabular-nums text-text-primary">
                      {formatMoneyMinor(flow.commissionEarnedMinor)}
                    </p>
                    <p className="font-body text-xs text-text-muted">Komissiya</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getReferralUrl(flow.referralCode)}
                      className="flex-1 rounded-input border border-border bg-bg px-3 py-2 font-body text-sm text-text-muted"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(getReferralUrl(flow.referralCode))}
                    >
                      Nusxa
                    </Button>
                  </div>

                  {flow.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => pauseFlow.mutateAsync(flow.id)}
                      disabled={pauseFlow.isPending}
                    >
                      {pauseFlow.isPending ? "To'xtatilmoqda..." : "Oqimni to'xtatish"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => activateFlow.mutateAsync(flow.id)}
                      disabled={activateFlow.isPending}
                    >
                      {activateFlow.isPending ? "Yoqilmoqda..." : "Oqimni yoqish"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
