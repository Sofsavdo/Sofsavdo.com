import { Module } from "@nestjs/common";
import { AnalyticsAdminController } from "./analytics-admin.controller";
import { ExecutiveAnalyticsService } from "./executive-analytics.service";
import { CreatorAnalyticsService } from "./creator-analytics.service";
import { CampaignAnalyticsService } from "./campaign-analytics.service";
import { ProductAnalyticsService } from "./product-analytics.service";
import { PaymentAnalyticsService } from "./payment-analytics.service";
import { RefundAnalyticsService } from "./refund-analytics.service";
import { CustomerAnalyticsService } from "./customer-analytics.service";
import { AnalyticsExportService } from "./analytics-export.service";
import { AnalyticsCacheService } from "./lib/analytics-cache.service";

// Read-only against every other domain's tables (Order/Payment/Refund/Commission/Campaign/
// Attribution/ReferralVisit/CreatorProfile/Customer) — no other module's service is imported here,
// since nothing in this domain mutates business data (the one write, AuditService.record for
// exports, comes from the already-@Global AuditModule). See ANALYTICS.md §5, DECISIONS.md ADR-020.
@Module({
  controllers: [AnalyticsAdminController],
  providers: [
    AnalyticsCacheService,
    ExecutiveAnalyticsService,
    CreatorAnalyticsService,
    CampaignAnalyticsService,
    ProductAnalyticsService,
    PaymentAnalyticsService,
    RefundAnalyticsService,
    CustomerAnalyticsService,
    AnalyticsExportService,
  ],
  // AnalyticsCacheService is exported so other domains needing the same "short-TTL, best-effort,
  // fail-open Redis cache" shape (e.g. CreatorDashboardService, the creator leaderboard) can reuse
  // it directly instead of standing up a third independent ioredis client for the same purpose —
  // see DECISIONS.md ADR-029. Executive/Creator/Product analytics services are also exported so
  // AdminDashboardService (Phase M) can compose the admin home page's real numbers from these
  // already-correct, already-cached queries instead of re-deriving GMV/revenue/top-N logic a
  // second time — see DECISIONS.md ADR-031.
  exports: [AnalyticsCacheService, ExecutiveAnalyticsService, CreatorAnalyticsService, ProductAnalyticsService],
})
export class AnalyticsModule {}
