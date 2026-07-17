"use client";

import { RoleGuard } from "@/components/admin/RoleGuard";
import { Badge, DataTableShell } from "@rosti/ui";
import { useAdminUsers } from "@/services/admin/system";
import { ROLE_LABELS } from "@/lib/adminRouting";

function UsersPageContent() {
  const query = useAdminUsers();
  const users = query.data ?? [];

  return (
    <DataTableShell title="Foydalanuvchilar" description="Admin panelga kirish huquqiga ega hisoblar." isLoading={query.isLoading} isEmpty={users.length === 0} emptyTitle="Foydalanuvchi topilmadi">
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Ism</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Email</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Rol</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-4 py-2.5 text-text-primary">{u.displayName}</td>
              <td className="px-4 py-2.5 text-text-secondary">{u.email}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone="neutral">{ROLE_LABELS[u.role]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}

export default function AdminUsersPage() {
  return (
    <RoleGuard min="SUPER_ADMIN">
      <UsersPageContent />
    </RoleGuard>
  );
}
