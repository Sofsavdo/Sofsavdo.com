import { Injectable } from "@nestjs/common";
import { AuditService } from "../common/audit/audit.service";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { CreatorAnalyticsService } from "./creator-analytics.service";
import { CampaignAnalyticsService } from "./campaign-analytics.service";
import { ProductAnalyticsService } from "./product-analytics.service";
import { PaymentAnalyticsService } from "./payment-analytics.service";
import { RefundAnalyticsService } from "./refund-analytics.service";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { toCsv } from "./lib/csv.util";
import type { AnalyticsExportQueryDto } from "./dto/analytics-export-query.dto";

export interface AnalyticsExportResult {
  filename: string;
  content: string;
}

// Delegates to the exact same sub-service the corresponding on-screen view uses (§7/§15 of
// ANALYTICS.md) — an export is never a second, differently-computed code path from what's on
// screen. Excel/PDF are deferred (approved scope); AnalyticsExportQueryDto's `format` only accepts
// "csv" today, so widening it is the only change needed later, not a rewrite of this service.
@Injectable()
export class AnalyticsExportService {
  constructor(
    private executive: ExecutiveAnalyticsService,
    private creatorAnalytics: CreatorAnalyticsService,
    private campaignAnalytics: CampaignAnalyticsService,
    private productAnalytics: ProductAnalyticsService,
    private paymentAnalytics: PaymentAnalyticsService,
    private refundAnalytics: RefundAnalyticsService,
    private customerAnalytics: CustomerAnalyticsService,
    private audit: AuditService,
  ) {}

  async export(query: AnalyticsExportQueryDto, actorId: string): Promise<AnalyticsExportResult> {
    const rows = await this.buildRows(query);
    const content = toCsv(rows);

    // An export is "data left the system" — worth the same audit trail every other sensitive
    // read-then-act operation gets, even though it isn't a mutation of business data. Answerable
    // from the existing Audit Log viewer (Phase 12) with zero changes to that viewer.
    await this.audit.record({
      actorId,
      action: "analytics.exported",
      entityType: "AnalyticsExport",
      entityId: query.view,
      after: { view: query.view, format: query.format, range: query.range, from: query.from, to: query.to, compare: query.compare, rowCount: rows.length },
    });

    return { filename: `sofsavdo-analytics-${query.view}-${new Date().toISOString().slice(0, 10)}.csv`, content };
  }

  private async buildRows(query: AnalyticsExportQueryDto): Promise<Record<string, unknown>[]> {
    switch (query.view) {
      case "executive": {
        const r = await this.executive.getSummary(query);
        return Object.keys(r.current).map((key) => ({
          metric: key,
          current: (r.current as unknown as Record<string, unknown>)[key],
          previous: r.previous ? (r.previous as unknown as Record<string, unknown>)[key] : "",
          deltaPct: r.deltaPct ? (r.deltaPct as Record<string, unknown>)[key] : "",
        }));
      }
      case "creators": {
        // Mutate pageSize on the existing DTO instance rather than spreading into a plain object —
        // `page`/`pageSize`'s `skip`/`take` getters live on PaginationQueryDto's prototype and are
        // lost by a `{...query}` spread.
        query.pageSize = 100;
        const r = await this.creatorAnalytics.list(query);
        return r.items as unknown as Record<string, unknown>[];
      }
      case "campaigns": {
        query.pageSize = 100;
        const r = await this.campaignAnalytics.list(query);
        return r.items as unknown as Record<string, unknown>[];
      }
      case "products": {
        query.pageSize = 100;
        const r = await this.productAnalytics.list(query);
        return r.items as unknown as Record<string, unknown>[];
      }
      case "payments": {
        const r = await this.paymentAnalytics.getSummary(query);
        return r.byMethod.map((m) => ({ provider: m.provider, count: m.count, amountMinor: m.amountMinor, totalCount: r.totalCount, successRate: r.successRate, pendingCount: r.pendingCount, failedCount: r.failedCount, refundsMinor: r.refundsMinor }));
      }
      case "refunds": {
        const r = await this.refundAnalytics.getSummary(query);
        return r.topReasons.map((t) => ({
          reason: t.reason,
          count: t.count,
          requestedCount: r.requestedCount,
          refundRate: r.refundRate,
          approvalRate: r.approvalRate,
          averageRefundAmountMinor: r.averageRefundAmountMinor,
          totalRefundedMinor: r.totalRefundedMinor,
        }));
      }
      case "customers": {
        const r = await this.customerAnalytics.getSummary(query);
        return [r as unknown as Record<string, unknown>];
      }
    }
  }
}
