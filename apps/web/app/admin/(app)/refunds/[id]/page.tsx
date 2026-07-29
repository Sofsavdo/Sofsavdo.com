"use client";

import { use, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton } from "@sofsavdo/ui";
import { ArrowLeft } from "lucide-react";
import { useRealRefundDetail, useApproveRealRefund, useRejectRealRefund } from "@/services/admin/orders";
import { ApiError } from "@/lib/api/admin";

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  REQUESTED: "warning",
  APPROVED: "success",
  PROCESSED: "success",
  REJECTED: "error",
};

function RefundDetailContent({ id }: { id: string }) {
  const query = useRealRefundDetail(id);
  const approve = useApproveRealRefund();
  const reject = useRejectRealRefund();
  const [rejectOpen, setRejectOpen] = useState(false);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const refund = query.data;
  if (!refund) return <Alert tone="error">Refund topilmadi.</Alert>;

  const actionError = approve.isError ? (approve.error as ApiError).message : reject.isError ? (reject.error as ApiError).message : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/refunds" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">
            #{refund.orderPublicToken} — {refund.offerName}
          </h1>
          <p className="font-body text-sm text-text-muted">{refund.customerName}</p>
        </div>
        <Badge tone={STATUS_TONE[refund.status] ?? "neutral"}>{refund.status}</Badge>
      </div>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Refund ma&apos;lumotlari</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 font-body text-sm">
          <div>
            <dt className="text-text-muted">Summa</dt>
            <dd className="text-error">−{formatMoneyMinor(refund.amountMinor)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Turi</dt>
            <dd className="text-text-primary">{refund.isPartial ? "Qisman" : "To'liq"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-text-muted">Sabab</dt>
            <dd className="text-text-primary">{refund.reason}</dd>
          </div>
          {refund.rejectionReason ? (
            <div className="col-span-2">
              <dt className="text-text-muted">Rad etish sababi</dt>
              <dd className="text-error">{refund.rejectionReason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {refund.status === "REQUESTED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Qaror</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(id)}>
              {approve.isPending ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
            </Button>
            <Button size="sm" variant="outline" className="border-error text-error" onClick={() => setRejectOpen(true)}>
              Rad etish
            </Button>
          </div>
        </Card>
      ) : null}

      <ConfirmModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Refundni rad etish"
        description="Sabab audit yozuvida saqlanadi."
        requireReason
        destructive
        isPending={reject.isPending}
        onConfirm={async (reason) => {
          if (!reason) return;
          await reject.mutateAsync({ id, reason });
          setRejectOpen(false);
        }}
      />
    </div>
  );
}

export default function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RefundDetailContent id={id} />;
}
