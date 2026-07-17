import type { Sale } from "@rosti/types";
import { formatMoneyMinor } from "@rosti/types";
import { Badge, EmptyState } from "@rosti/ui";
import { orderStatusMeta } from "@/lib/status";

export function SalesTable({ sales, limit }: { sales: Sale[]; limit?: number }) {
  const rows = limit ? sales.slice(0, limit) : sales;

  if (rows.length === 0) {
    return <EmptyState title="Hozircha sotuvlar yo'q" description="Referral havolangiz orqali birinchi sotuv shu yerda ko'rinadi." />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-left font-body text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sana</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Kampaniya</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Mijoz</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Summa</th>
            <th className="whitespace-nowrap px-4 py-2.5 text-right font-medium">Komissiya</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Manba</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Holat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sale) => (
            <tr key={sale.id} className="border-t border-border">
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                {new Date(sale.createdAt).toLocaleDateString("uz-UZ")}
              </td>
              <td className="max-w-[220px] truncate px-4 py-2.5 text-text-primary">{sale.campaignName}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{sale.customerMasked}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-text-primary">
                {formatMoneyMinor(sale.amountMinor)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-numeric tabular-nums text-success">
                {formatMoneyMinor(sale.commissionMinor)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                {sale.attributionSource === "PROMO_CODE" ? "Promo kod" : "Referral link"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">
                <Badge tone={orderStatusMeta[sale.orderStatus].tone}>{orderStatusMeta[sale.orderStatus].label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
