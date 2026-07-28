"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Badge, Button, Card, CardHeader, CardTitle, Skeleton } from "@rosti/ui";
import { useRoleList } from "@/services/admin/roleManagement";

function RolesPageContent() {
  const query = useRoleList();

  if (query.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Rollar</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">Har bir rol o&apos;ziga biriktirilgan ruxsatlar orqali aniqlanadi.</p>
        </div>
        <Link href="/admin/roles/new">
          <Button size="sm">+ Yangi rol</Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(query.data ?? []).map((r) => (
          <Link key={r.id} href={`/admin/roles/${r.id}`}>
            <Card className="h-full transition-colors hover:border-accent">
              <CardHeader className="flex-col items-start gap-1">
                <CardTitle>{r.name}</CardTitle>
                <p className="font-body text-xs text-text-muted">{r.key}</p>
              </CardHeader>
              <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
                <Badge tone="neutral">{r.permissions.length} ruxsat</Badge>
                <Badge tone="neutral">{r.userCount} foydalanuvchi</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminRolesPage() {
  return (
    <RoleGuard min="SUPER_ADMIN">
      <RolesPageContent />
    </RoleGuard>
  );
}
