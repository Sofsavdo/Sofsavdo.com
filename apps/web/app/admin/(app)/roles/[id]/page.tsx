"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Skeleton, TextField } from "@sofsavdo/ui";
import { ArrowLeft } from "lucide-react";
import { useRoleDetail, useAllPermissionKeys, useUpdateRole, useAssignRolePermission, useRemoveRolePermission } from "@/services/admin/roleManagement";
import { ApiError } from "@/lib/api/admin";

function RoleDetailContent({ id }: { id: string }) {
  const query = useRoleDetail(id);
  const permissionsQuery = useAllPermissionKeys();
  const update = useUpdateRole();
  const assign = useAssignRolePermission();
  const remove = useRemoveRolePermission();
  const [name, setName] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const keys = permissionsQuery.data ?? [];
    const byDomain = new Map<string, string[]>();
    for (const key of keys) {
      const domain = key.split(".")[0]!;
      byDomain.set(domain, [...(byDomain.get(domain) ?? []), key]);
    }
    return [...byDomain.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissionsQuery.data]);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const role = query.data;
  if (!role) return <Alert tone="error">Rol topilmadi.</Alert>;

  const permissionSet = new Set(role.permissions);
  const actionError = update.isError
    ? (update.error as ApiError).message
    : assign.isError
      ? (assign.error as ApiError).message
      : remove.isError
        ? (remove.error as ApiError).message
        : null;

  function togglePermission(key: string, checked: boolean) {
    if (checked) assign.mutate({ id, permissionKey: key });
    else remove.mutate({ id, permissionKey: key });
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/roles" className="inline-flex items-center gap-1 font-body text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" /> Ro&apos;yxatga qaytish
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">{role.name}</h1>
          <p className="font-body text-sm text-text-muted">
            {role.key} · {role.userCount} foydalanuvchi
          </p>
        </div>
        <Badge tone="neutral">{role.permissions.length} ruxsat</Badge>
      </div>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Nomi</CardTitle>
        </CardHeader>
        <div className="flex items-center gap-2">
          <TextField label="Rol nomi" value={name ?? role.name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Button size="sm" disabled={update.isPending || !name || name === role.name} onClick={() => update.mutate({ id, input: { name: name ?? undefined } })}>
            {update.isPending ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ruxsatlar matritsasi</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map(([domain, keys]) => (
            <div key={domain} className="rounded-input border border-border p-3">
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wide text-text-muted">{domain}</p>
              <div className="flex flex-col gap-1.5">
                {keys.map((key) => (
                  <label key={key} className="flex items-center gap-2 font-body text-sm text-text-secondary">
                    <input type="checkbox" checked={permissionSet.has(key)} onChange={(e) => togglePermission(key, e.target.checked)} disabled={assign.isPending || remove.isPending} />
                    {key}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGuard min="SUPER_ADMIN">
      <RoleDetailContent id={id} />
    </RoleGuard>
  );
}
