"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { Badge, Button, DataTableShell, MobileDataCard } from "@sofsavdo/ui";
import { useStaffUserList } from "@/services/admin/staff";
import type { RealUserStatus } from "@sofsavdo/types";

const STATUS_TONE: Record<RealUserStatus, "success" | "warning" | "error" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BLOCKED: "error",
  DELETED: "neutral",
};

const STATUS_LABEL: Record<RealUserStatus, string> = {
  ACTIVE: "Faol",
  SUSPENDED: "Faolsizlantirilgan",
  BLOCKED: "Bloklangan",
  DELETED: "O'chirilgan",
};

function UsersPageContent() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RealUserStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const query = useStaffUserList({ search: search || undefined, status: status === "ALL" ? undefined : status, page, pageSize: 20 });

  return (
    <DataTableShell
      title="Foydalanuvchilar"
      description="Admin panelga kirish huquqiga ega xodim hisoblari."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Ism yoki email bo'yicha qidirish"
      filters={
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as RealUserStatus | "ALL");
            setPage(1);
          }}
          className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
        >
          <option value="ALL">Barchasi</option>
          <option value="ACTIVE">Faol</option>
          <option value="SUSPENDED">Faolsizlantirilgan</option>
        </select>
      }
      actions={
        <Link href="/admin/users/new">
          <Button size="sm">+ Yangi xodim</Button>
        </Link>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Foydalanuvchi topilmadi"
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((u) => (
        <MobileDataCard
          key={u.id}
          href={`/admin/users/${u.id}`}
          title={u.displayName ?? "—"}
          meta={<Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge>}
          fields={[
            { label: "Email", value: u.email ?? u.phone ?? "—" },
            {
              label: "Rollar",
              value: (
                <div className="flex flex-wrap justify-end gap-1">
                  {u.roles.map((r) => (
                    <Badge key={r.id} tone="neutral">
                      {r.name}
                    </Badge>
                  ))}
                </div>
              ),
            },
          ]}
        />
      ))}
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Ism</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Email</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Rollar</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((u) => (
            <tr key={u.id} className="border-t border-border hover:bg-bg">
              <td className="px-4 py-2.5">
                <Link href={`/admin/users/${u.id}`} className="font-medium text-text-primary hover:text-accent">
                  {u.displayName ?? "—"}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-text-secondary">{u.email ?? u.phone ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <Badge key={r.id} tone="neutral">
                      {r.name}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Badge>
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
