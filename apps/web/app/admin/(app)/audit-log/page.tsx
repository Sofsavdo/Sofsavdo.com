"use client";

import { useMemo, useState } from "react";
import { DataTableShell } from "@rosti/ui";
import { useAdminAuditLog } from "@/services/admin/system";

export default function AdminAuditLogPage() {
  const query = useAdminAuditLog();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const actions = useMemo(() => Array.from(new Set((query.data ?? []).map((e) => e.action))), [query.data]);

  const filtered = (query.data ?? []).filter(
    (e) =>
      (actionFilter === "ALL" || e.action === actionFilter) &&
      (e.actor.toLowerCase().includes(search.toLowerCase()) || e.entityType.toLowerCase().includes(search.toLowerCase()) || e.entityId.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <DataTableShell
      title="Audit log"
      description="Barcha sezgir admin amallari — kim, nima, qachon, nima uchun."
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Actor yoki entity bo'yicha qidirish"
      filters={
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="h-10 rounded-input border border-border bg-bg px-3 font-body text-sm">
          <option value="ALL">Barcha amallar</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      }
      isLoading={query.isLoading}
      isEmpty={filtered.length === 0}
      emptyTitle="Audit yozuv yo'q"
      emptyDescription="Admin amallar (reject, refund, manual adjustment va h.k.) bajarilgach shu yerda ko'rinadi."
    >
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Vaqt</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Actor</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Amal</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Entity</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sabab</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <tr key={e.id} className="border-t border-border">
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">{new Date(e.createdAt).toLocaleString("uz-UZ")}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-primary">{e.actor}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{e.action}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-muted">
                {e.entityType}#{e.entityId.slice(-6)}
              </td>
              <td className="px-4 py-2.5 text-text-secondary">{e.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
