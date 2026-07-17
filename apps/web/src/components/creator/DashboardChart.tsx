"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSeriesPoint } from "@rosti/types";
import { Card, CardHeader, CardTitle, cn } from "@rosti/ui";

const PERIODS = [
  { key: "7", label: "7 kun" },
  { key: "30", label: "30 kun" },
  { key: "90", label: "90 kun" },
] as const;

export function DashboardChart({
  series7d,
  series30d,
  series90d,
}: {
  series7d: DashboardSeriesPoint[];
  series30d: DashboardSeriesPoint[];
  series90d: DashboardSeriesPoint[];
}) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("30");
  const data = period === "7" ? series7d : period === "30" ? series30d : series90d;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Click va sotuvlar dinamikasi</CardTitle>
        <div className="flex gap-1 rounded-input bg-bg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-input px-3 py-1 font-body text-sm transition-colors",
                period === p.key ? "bg-surface text-text-primary shadow-sm" : "text-text-secondary",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E53935" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#E53935" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#E7E7E3" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" })}
              tick={{ fontSize: 11, fill: "#929292" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 11, fill: "#929292" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              labelFormatter={(d) => new Date(String(d)).toLocaleDateString("uz-UZ")}
              formatter={(value, name) => [String(value), name === "clicks" ? "Click" : "Sotuv"]}
              contentStyle={{ borderRadius: 10, borderColor: "#E7E7E3", fontSize: 13 }}
            />
            <Area type="monotone" dataKey="clicks" stroke="#E53935" fill="url(#clicksGradient)" strokeWidth={2} />
            <Area type="monotone" dataKey="orders" stroke="#2F80ED" fill="transparent" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
