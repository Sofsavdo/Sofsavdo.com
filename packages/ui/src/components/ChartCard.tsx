import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle } from "./Card";

export interface ChartCardProps {
  title: string;
  /** e.g. a period-range Tabs control, rendered top-right next to the title. */
  controls?: ReactNode;
  /** Fixed chart height — Recharts' ResponsiveContainer needs an explicit-height ancestor. */
  height?: number;
  children: ReactNode;
}

// Every chart on the dashboard/analytics pages independently re-wrote the same
// Card+CardHeader+CardTitle+fixed-height-div shell (AdminDashboardChart, AnalyticsCharts,
// DashboardChart all did this by hand). This is that shell, componentized — it does not touch
// the chart internals (Recharts config, data shape) at all, so existing chart components can
// adopt it by wrapping their existing <ResponsiveContainer>...</ResponsiveContainer> in it
// without changing how the chart itself renders.
//
// Recharts color values still need to be passed as literal hex or a CSS var() string (e.g.
// `stroke="var(--color-accent)"`) per chart — Recharts' SVG props are plain attribute strings,
// not something this wrapper can inject generically. See DESIGN_SYSTEM.md's Charts rule: use
// `var(--color-accent)`/`var(--color-text-muted)` etc. rather than re-typing hex, now that these
// are real CSS custom properties (not just documentation) any modern browser resolves inside SVG
// presentation attributes.
export function ChartCard({ title, controls, height = 256, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {controls}
      </CardHeader>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </Card>
  );
}
