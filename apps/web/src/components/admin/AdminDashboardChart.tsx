"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyMinor } from "@sofsavdo/types";
import { ChartCard } from "@sofsavdo/ui";

export interface AdminDashboardTrendPoint {
  day: string;
  ordersCount: number;
  revenueMinor: number;
}

// One real "this month, day by day" trend (AdminDashboardService.getSummary, backed by
// ExecutiveAnalyticsService's already-real dailyOrderTrend) — replacing the old 7d/30d/90d
// period-toggle that switched between three entirely fabricated series. Same simplification
// precedent as the creator dashboard's own chart (see DECISIONS.md ADR-031).
export function AdminDashboardChart({ trend }: { trend: AdminDashboardTrendPoint[] }) {
  return (
    <ChartCard title="Tushum dinamikasi (shu oy)">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <defs>
            {/* var(--color-accent) works directly as an SVG presentation-attribute value in every
                modern browser — DESIGN_SYSTEM.md's "Charts: ... using semantic tokens only" rule
                was previously prose-only here; every color below was hardcoded hex instead. */}
            <linearGradient id="adminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="day"
            tickFormatter={(d) => new Date(String(d)).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            labelFormatter={(d) => new Date(String(d)).toLocaleDateString("uz-UZ")}
            formatter={(value, name) => [name === "revenueMinor" ? formatMoneyMinor(Number(value)) : String(value), name === "revenueMinor" ? "Tushum" : "Buyurtma"]}
            contentStyle={{ borderRadius: 10, borderColor: "var(--color-border)", fontSize: 13 }}
          />
          <Area type="monotone" dataKey="revenueMinor" stroke="var(--color-accent)" fill="url(#adminRevenueGradient)" strokeWidth={2} />
          <Area type="monotone" dataKey="ordersCount" stroke="var(--color-info)" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
