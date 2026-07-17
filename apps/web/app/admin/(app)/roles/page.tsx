"use client";

import { RoleGuard } from "@/components/admin/RoleGuard";
import { Card, CardHeader, CardTitle, Skeleton } from "@rosti/ui";
import { useAdminRoles } from "@/services/admin/system";
import { ROLE_LABELS } from "@/lib/adminRouting";

function RolesPageContent() {
  const query = useAdminRoles();

  if (query.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Rollar</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">Har bir rol o&apos;zidan pastki rolning barcha huquqlarini meros qilib oladi.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(query.data ?? []).map((r) => (
          <Card key={r.role}>
            <CardHeader>
              <CardTitle>{ROLE_LABELS[r.role]}</CardTitle>
            </CardHeader>
            <ul className="space-y-1.5 font-body text-sm text-text-secondary">
              {r.permissions.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          </Card>
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
