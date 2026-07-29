"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RealDailyTrendPoint } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { ChartCard } from "@sofsavdo/ui";

// Same color/tooltip conventions as AdminDashboardChart (Phase 5) — new chart types for this
// domain (bar, pie), same visual language, so these read as native to the app rather than bolted
// on. See ANALYTICS.md §12 for why each chart type was chosen for its metric.

// Area: emphasizes cumulative magnitude/trend over time — matches the pre-existing revenue chart
// convention exactly (ANALYTICS.md §12).
export function RevenueTrendChart({ trend }: { trend: RealDailyTrendPoint[] }) {
  return (
    <ChartCard title="Tushum va GMV dinamikasi">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="executiveRevenueGradient" x1="0" y1="0" x2="0" y2="1">
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
            formatter={(value) => [formatMoneyMinor(Number(value)), "Tushum"]}
            contentStyle={{ borderRadius: 10, borderColor: "var(--color-border)", fontSize: 13 }}
          />
          <Area type="monotone" dataKey="revenueMinor" stroke="var(--color-accent)" fill="url(#executiveRevenueGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Bar: OrderStatus is a small, fixed set of discrete categories — bars compare discrete
// categories far better than a line, which would imply a continuous progression the statuses
// don't have (ANALYTICS.md §12).
export function OrderStatusBarChart({ statusBreakdown }: { statusBreakdown: Array<{ status: string; count: number }> }) {
  return (
    <ChartCard title="Buyurtmalar holati bo&apos;yicha">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={statusBreakdown} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="status" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} width={32} />
          <Tooltip formatter={(value) => [String(value), "Buyurtmalar"]} contentStyle={{ borderRadius: 10, borderColor: "var(--color-border)", fontSize: 13 }} />
          <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// Kept as literal hex: unlike the single-series charts above, a pie's legend needs several
// genuinely distinct hues to distinguish categories — there is no "category-2"/"category-3"
// semantic token in tokens.css (only one accent color is defined), so re-typing these as CSS vars
// would require inventing tokens with no other consumer. Revisit if a categorical palette token
// is ever added to the design system.
const PIE_COLORS = ["#E53935", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA", "#00897B"];

// Pie: "share of a whole" is genuinely the right question for payment-method mix (few categories,
// ≤6 PaymentProviderType values, asking "what % of volume is each method") — the one case where a
// pie chart is the correct answer rather than the usually-overused default (ANALYTICS.md §12).
export function PaymentMixPieChart({ byMethod }: { byMethod: Array<{ provider: string; count: number; amountMinor: number }> }) {
  return (
    <ChartCard title="To&apos;lov usullari taqsimoti">
      {byMethod.length === 0 ? (
        <p className="font-body text-sm text-text-muted">Ma&apos;lumot yo&apos;q.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={byMethod} dataKey="amountMinor" nameKey="provider" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {byMethod.map((entry, index) => (
                <Cell key={entry.provider} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, _name, item) => [formatMoneyMinor(Number(value)), String(item?.payload?.provider ?? "")]} contentStyle={{ borderRadius: 10, borderColor: "var(--color-border)", fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
