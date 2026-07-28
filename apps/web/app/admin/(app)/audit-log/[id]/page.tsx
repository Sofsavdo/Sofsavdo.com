"use client";

import { use } from "react";
import Link from "next/link";
import { Alert, Card, CardHeader, CardTitle, Skeleton } from "@rosti/ui";
import { ArrowLeft } from "lucide-react";
import { useRealAuditLogDetail } from "@/services/admin/system";

function AuditLogDetailContent({ id }: { id: string }) {
  const query = useRealAuditLogDetail(id);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const entry = query.data;
  if (!entry) return <Alert tone="error">Audit yozuvi topilmadi.</Alert>;

  return (
    <div className="space-y-6">
      <Link href="/admin/audit-log" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div>
        <h1 className="font-heading text-xl font-bold text-text-primary">{entry.action}</h1>
        <p className="font-body text-sm text-text-muted">{new Date(entry.createdAt).toLocaleString("uz-UZ")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tafsilotlar</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-3 font-body text-sm">
          <div>
            <dt className="text-text-muted">Actor</dt>
            <dd className="text-text-primary">{entry.actor?.email ?? "Tizim"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Entity</dt>
            <dd className="text-text-primary">
              {entry.entityType}#{entry.entityId}
            </dd>
          </div>
        </dl>
      </Card>

      {entry.before ? (
        <Card>
          <CardHeader>
            <CardTitle>Oldin</CardTitle>
          </CardHeader>
          <pre className="overflow-x-auto rounded-input bg-bg p-3 font-numeric text-xs text-text-secondary">{JSON.stringify(entry.before, null, 2)}</pre>
        </Card>
      ) : null}

      {entry.after ? (
        <Card>
          <CardHeader>
            <CardTitle>Keyin</CardTitle>
          </CardHeader>
          <pre className="overflow-x-auto rounded-input bg-bg p-3 font-numeric text-xs text-text-secondary">{JSON.stringify(entry.after, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}

export default function AuditLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AuditLogDetailContent id={id} />;
}
