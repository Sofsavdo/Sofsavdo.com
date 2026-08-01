"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTableShell, MobileDataCard } from "@sofsavdo/ui";
import { useRealAuditLogList } from "@/services/admin/system";

export default function AdminAuditLogPage() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const query = useRealAuditLogList({
    search: search || undefined,
    entityType: entityType || undefined,
    action: action || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 20,
  });

  return (
    <DataTableShell
      title="Audit log"
      description="Barcha sezgir admin amallari — kim, nima, qachon."
      searchValue={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      searchPlaceholder="Entity ID yoki actor emaili bo'yicha qidirish"
      filters={
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Entity turi (User, Refund, Role...)"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          />
          <input
            placeholder="Amal (STAFF_CREATED...)"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm"
          />
        </div>
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      isEmpty={(query.data?.items.length ?? 0) === 0}
      emptyTitle="Audit yozuv yo'q"
      emptyDescription="Admin amallar (yaratish, tasdiqlash, rad etish va h.k.) bajarilgach shu yerda ko'rinadi."
      page={query.data?.page}
      pageCount={query.data?.totalPages}
      onPageChange={setPage}
      mobileCards={(query.data?.items ?? []).map((e) => (
        <MobileDataCard
          key={e.id}
          href={`/admin/audit-log/${e.id}`}
          title={e.action}
          meta={<span className="font-body text-xs text-text-muted">{new Date(e.createdAt).toLocaleDateString("uz-UZ")}</span>}
          fields={[
            { label: "Actor", value: e.actor?.email ?? "Tizim" },
            { label: "Entity", value: `${e.entityType}#${e.entityId?.slice(-6)}` },
          ]}
        />
      ))}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Vaqt</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Actor</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Amal</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Entity</th>
          </tr>
        </thead>
        <tbody>
          {(query.data?.items ?? []).map((e) => (
            <tr key={e.id} className="border-t border-border hover:bg-bg">
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{new Date(e.createdAt).toLocaleString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-primary">{e.actor?.email ?? "Tizim"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{e.action}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">
                <Link href={`/admin/audit-log/${e.id}`} className="hover:text-accent hover:underline">
                  {e.entityType}#{e.entityId?.slice(-6)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </DataTableShell>
  );
}
