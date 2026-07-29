"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Card, CardHeader, CardTitle } from "@sofsavdo/ui";

export interface DashboardRevenuePoint {
  date: string;
  revenueMinor: number;
}

// One real 30-day series (CreatorDashboardService.getStats — apps/api/src/creator-dashboard/
// creator-dashboard.service.ts), replacing the old 7d/30d/90d period-toggle that switched between
// three entirely Math.random()-generated series (see DECISIONS.md ADR-029). A single real series
// beats three fake ones at three different resolutions.
export function DashboardChart({ dailyRevenue30d }: { dailyRevenue30d: DashboardRevenuePoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daromad dinamikasi (30 kun)</CardTitle>
      </CardHeader>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyRevenue30d} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
              formatter={(value) => [formatMoneyMinor(Number(value)), "Daromad"]}
              contentStyle={{ borderRadius: 10, borderColor: "#E7E7E3", fontSize: 13 }}
            />
            <Area type="monotone" dataKey="revenueMinor" stroke="#E53935" fill="url(#revenueGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
