"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyMinor } from "@rosti/types";
import { ChartCard, Tabs } from "@rosti/ui";

interface Point {
  date: string;
  clicks: number;
  orders: number;
  revenueMinor: number;
}

const PERIODS = [
  { key: "7", label: "7 kun" },
  { key: "30", label: "30 kun" },
  { key: "90", label: "90 kun" },
] as const;

export function AdminDashboardChart({ series7d, series30d, series90d }: { series7d: Point[]; series30d: Point[]; series90d: Point[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("30");
  const data = period === "7" ? series7d : period === "30" ? series30d : series90d;

  return (
    <ChartCard
      title="Tushum dinamikasi"
      controls={<Tabs items={PERIODS.map((p) => ({ value: p.key, label: p.label }))} value={period} onChange={(v) => setPeriod(v as (typeof PERIODS)[number]["key"])} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
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
            dataKey="date"
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
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
